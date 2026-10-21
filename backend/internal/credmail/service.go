// Package credmail sends login details (or a "password reset" confirmation) to many users at once. A Super
// Admin triggers it from User Management; nothing here runs when a user is created.
package credmail

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net/mail"
	"strings"
	"sync"
	"time"

	"golang.org/x/crypto/bcrypt"

	systemlogDomain "github.com/onetrack/backend/internal/systemlog/domain"
)

var (
	ErrNotConfigured = errors.New("email is not configured on this server")
	ErrNothingToSend = errors.New("nobody is selected, or everyone selected was already alerted")
)

// PasswordMismatchError lists users whose typed password is not the one saved for them. Nothing is sent.
type PasswordMismatchError struct{ Usernames []string }

func (e *PasswordMismatchError) Error() string {
	return "the password you typed does not match the saved password for: " + strings.Join(e.Usernames, ", ")
}

// Mailer is the part of the email service this package uses.
type Mailer interface {
	Configured() bool
	SendNow(to []string, subject, htmlBody string) error
}

// Row is a user as shown in the Alert users tab. No password, no hash.
type Row struct {
	ID            string     `json:"id"`
	Username      string     `json:"username"`
	FullName      string     `json:"full_name"`
	Email         string     `json:"email"`
	Roles         []string   `json:"roles"`
	LastAlertedAt *time.Time `json:"last_alerted_at"`
}

type Skipped struct {
	NoEmail  int `json:"no_email"`
	Inactive int `json:"inactive"`
}

type Preview struct {
	Initial        []Row   `json:"initial"`
	Reset          []Row   `json:"reset"`
	Temp           []Row   `json:"temp"` // an admin set their password; the admin types it to alert them
	Skipped        Skipped `json:"skipped"`
	SMTPConfigured bool    `json:"smtp_configured"`
	RunningBatchID string  `json:"running_batch_id"`
}

type SendRequest struct {
	Kinds          []Kind   `json:"kinds"`
	UserIDs        []string `json:"user_ids"`
	IncludeAlerted bool     `json:"include_alerted"`
	// Passwords maps user id -> the password the admin set, for TEMP_PASSWORD users only.
	Passwords map[string]string `json:"passwords"`
}

type Service struct {
	store           Store
	mail            Mailer
	log             systemlogDomain.Recorder
	defaultPassword string
	appURL          string
	pause           time.Duration // between two mails, so a provider's rate limit is not hit
	match           func(hash, password string) bool
}

func NewService(store Store, mail Mailer, rec systemlogDomain.Recorder, defaultPassword, appBaseURL string) *Service {
	return &Service{
		store: store, mail: mail, log: rec,
		defaultPassword: defaultPassword,
		appURL:          strings.TrimRight(appBaseURL, "/"),
		pause:           300 * time.Millisecond,
		match: func(hash, pw string) bool {
			return bcrypt.CompareHashAndPassword([]byte(hash), []byte(pw)) == nil
		},
	}
}

func validEmail(e string) bool {
	a, err := mail.ParseAddress(e)
	return err == nil && a.Address == e
}

// matchAll compares every candidate's hash with the default password, four at a time (bcrypt is deliberately slow).
func (s *Service) matchAll(ctx context.Context, cands []Candidate) []bool {
	out := make([]bool, len(cands))
	sem := make(chan struct{}, 4)
	var wg sync.WaitGroup
	for i := range cands {
		if ctx.Err() != nil {
			break
		}
		wg.Add(1)
		sem <- struct{}{}
		go func(i int) {
			defer wg.Done()
			defer func() { <-sem }()
			out[i] = s.match(cands[i].hash, s.defaultPassword)
		}(i)
	}
	wg.Wait()
	return out
}

func rowOf(c Candidate, k Kind) Row {
	return Row{ID: c.ID, Username: c.Username, FullName: c.FullName, Email: c.Email, Roles: c.Roles, LastAlertedAt: c.LastAlerted[k]}
}

// Preview sorts users into who would get which mail. The decision rests on the stored hash, so a mail never
// states an initial password the user no longer has:
//   - hash matches the default                      -> INITIAL (credentials)
//   - hash differs, no forced change pending        -> RESET_CONFIRM (they chose their own password)
//   - hash differs, forced change pending           -> TEMP (an admin set it; the admin types it in to alert them)
func (s *Service) Preview(ctx context.Context) (*Preview, error) {
	p, _, err := s.classify(ctx)
	return p, err
}

// classify is Preview plus each listed user's password hash (kept inside this package, for checking a typed
// password in Send).
func (s *Service) classify(ctx context.Context) (*Preview, map[string]string, error) {
	cands, err := s.store.Candidates(ctx)
	if err != nil {
		return nil, nil, err
	}
	p := &Preview{Initial: []Row{}, Reset: []Row{}, Temp: []Row{}, SMTPConfigured: s.mail.Configured()}
	if p.RunningBatchID, err = s.store.RunningBatch(ctx); err != nil {
		return nil, nil, err
	}

	var usable []Candidate
	for _, c := range cands {
		switch {
		case !c.IsActive:
			p.Skipped.Inactive++
		case !validEmail(c.Email):
			p.Skipped.NoEmail++
		default:
			usable = append(usable, c)
		}
	}
	matches := s.matchAll(ctx, usable)
	if err := ctx.Err(); err != nil {
		return nil, nil, err
	}
	hashes := make(map[string]string, len(usable))
	for i, c := range usable {
		hashes[c.ID] = c.hash
		switch {
		case matches[i]:
			p.Initial = append(p.Initial, rowOf(c, KindInitial))
		case !c.ForceChange:
			p.Reset = append(p.Reset, rowOf(c, KindReset))
		default:
			p.Temp = append(p.Temp, rowOf(c, KindInitial))
		}
	}
	return p, hashes, nil
}

// Send queues the mails and starts the background worker. Eligibility is worked out again here; the request
// can only narrow it down, never widen it.
func (s *Service) Send(ctx context.Context, actorID string, req SendRequest) (string, int, error) {
	if !s.mail.Configured() {
		return "", 0, ErrNotConfigured
	}
	p, hashes, err := s.classify(ctx)
	if err != nil {
		return "", 0, err
	}
	if p.RunningBatchID != "" {
		return "", 0, ErrBatchRunning
	}

	wantKind := map[Kind]bool{}
	for _, k := range req.Kinds {
		wantKind[k] = true
	}
	wantUser := map[string]bool{}
	for _, id := range req.UserIDs {
		wantUser[id] = true
	}

	var items []Item
	var mismatched []string
	add := func(rows []Row, k Kind, mailKind Kind) {
		if !wantKind[k] {
			return
		}
		for _, r := range rows {
			if !wantUser[r.ID] || (r.LastAlertedAt != nil && !req.IncludeAlerted) {
				continue
			}
			it := Item{UserID: r.ID, Kind: mailKind, Email: r.Email, Username: r.Username, FullName: r.FullName, Roles: r.Roles}
			switch k {
			case KindInitial:
				it.Password = s.defaultPassword
			case KindTemp:
				it.Temp = true
				// The mail must state a password that is true: check what the admin typed against the saved hash.
				it.Password = req.Passwords[r.ID]
				if it.Password == "" || !s.match(hashes[r.ID], it.Password) {
					mismatched = append(mismatched, r.Username)
					continue
				}
			}
			items = append(items, it)
		}
	}
	add(p.Initial, KindInitial, KindInitial)
	add(p.Temp, KindTemp, KindInitial)
	add(p.Reset, KindReset, KindReset)
	if len(mismatched) > 0 {
		return "", 0, &PasswordMismatchError{Usernames: mismatched}
	}
	if len(items) == 0 {
		return "", 0, ErrNothingToSend
	}

	batchID, err := s.store.CreateBatch(ctx, actorID, items)
	if err != nil {
		return "", 0, err
	}
	if s.log != nil {
		s.log.Record(ctx, systemlogDomain.CategoryUserMgmt, "CREDENTIALS_ALERT_SENT", actorID, nil,
			fmt.Sprintf("Started a credential mail batch for %d user(s)", len(items)),
			map[string]interface{}{"batch_id": batchID, "count": len(items)})
	}
	go s.run(batchID, items)
	return batchID, len(items), nil
}

// run sends one mail after another. Each row is updated on its own, so there are no long transactions and no
// two writers ever wait on each other. It must finish the batch whatever happens, or the next send is blocked.
func (s *Service) run(batchID string, items []Item) {
	status := "DONE"
	defer func() {
		if r := recover(); r != nil {
			log.Printf("[credmail] batch %s panicked: %v", batchID, r)
			status = "FAILED"
		}
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()
		if err := s.store.FinishBatch(ctx, batchID, status); err != nil {
			log.Printf("[credmail] could not close batch %s: %v", batchID, err)
		}
	}()

	for i, it := range items {
		if i > 0 && s.pause > 0 {
			time.Sleep(s.pause)
		}
		subject, body := Message(it, s.appURL)
		sendErr := s.mail.SendNow([]string{it.Email}, subject, body)
		msg := ""
		if sendErr != nil {
			msg = sendErr.Error()
			if len(msg) > 300 {
				msg = msg[:300]
			}
			log.Printf("[credmail] batch %s: mail to %s failed: %v", batchID, it.Username, sendErr)
		}
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		if err := s.store.MarkItem(ctx, batchID, it.UserID, sendErr == nil, msg); err != nil {
			log.Printf("[credmail] batch %s: could not record result for %s: %v", batchID, it.Username, err)
		}
		cancel()
	}
}

func (s *Service) Batch(ctx context.Context, id string) (*Batch, error) {
	return s.store.GetBatch(ctx, id)
}

// SweepStale is called once at start-up.
func (s *Service) SweepStale(ctx context.Context) {
	n, err := s.store.SweepStale(ctx)
	if err != nil {
		log.Printf("[credmail] stale batch sweep failed: %v", err)
		return
	}
	if n > 0 {
		log.Printf("[credmail] marked %d interrupted batch(es) as failed", n)
	}
}

// SendAccessAlert emails all active users (who have a valid email) an
// informational message about the current site URL and how to access it.
// Mails are sent one at a time in a background goroutine so the caller returns
// immediately. Returns the number of recipients queued (not yet sent).
func (s *Service) SendAccessAlert(ctx context.Context, actorID, siteURL string) (int, error) {
	if !s.mail.Configured() {
		return 0, ErrNotConfigured
	}
	if strings.TrimSpace(siteURL) == "" {
		return 0, errors.New("site_url must not be empty")
	}

	cands, err := s.store.Candidates(ctx)
	if err != nil {
		return 0, fmt.Errorf("list users: %w", err)
	}

	var recipients []string
	for _, c := range cands {
		if c.IsActive && validEmail(c.Email) {
			recipients = append(recipients, c.Email)
		}
	}
	if len(recipients) == 0 {
		return 0, ErrNothingToSend
	}

	subject, body := AccessAlertMessage(siteURL)
	total := len(recipients)

	// Send in background so the HTTP handler returns at once.
	go func() {
		sent := 0
		for i, email := range recipients {
			if i > 0 && s.pause > 0 {
				time.Sleep(s.pause)
			}
			if err := s.mail.SendNow([]string{email}, subject, body); err != nil {
				log.Printf("[credmail] access-alert to %s failed: %v", email, err)
				continue
			}
			sent++
		}
		log.Printf("[credmail] access-alert complete: %d/%d sent, URL=%s", sent, total, siteURL)
	}()

	if s.log != nil {
		s.log.Record(ctx, systemlogDomain.CategoryUserMgmt, "ACCESS_ALERT_SENT", actorID, nil,
			fmt.Sprintf("Dispatched access-info mail to %d user(s) with URL: %s", total, siteURL),
			map[string]interface{}{"total": total, "site_url": siteURL})
	}
	return total, nil
}
