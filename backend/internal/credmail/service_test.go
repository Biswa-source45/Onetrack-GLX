package credmail

import (
	"context"
	"errors"
	"strings"
	"sync"
	"testing"
	"time"
)

// ---- fakes ----------------------------------------------------------------

type fakeStore struct {
	mu      sync.Mutex
	cands   []Candidate
	running string
	items   map[string]string // userID -> PENDING|SENT|FAILED
	errs    map[string]string
	status  string
	created int
}

func (f *fakeStore) Candidates(context.Context) ([]Candidate, error) { return f.cands, nil }
func (f *fakeStore) RunningBatch(context.Context) (string, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.running, nil
}
func (f *fakeStore) CreateBatch(_ context.Context, _ string, items []Item) (string, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.running != "" {
		return "", ErrBatchRunning
	}
	f.created++
	f.running = "b1"
	f.items, f.errs = map[string]string{}, map[string]string{}
	for _, it := range items {
		f.items[it.UserID] = "PENDING"
	}
	return "b1", nil
}
func (f *fakeStore) MarkItem(_ context.Context, _, userID string, sent bool, msg string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.items[userID], f.errs[userID] = "SENT", ""
	if !sent {
		f.items[userID], f.errs[userID] = "FAILED", msg
	}
	return nil
}
func (f *fakeStore) FinishBatch(_ context.Context, _, status string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	for id, st := range f.items {
		if st == "PENDING" {
			f.items[id] = "FAILED"
		}
	}
	f.status, f.running = status, ""
	return nil
}
func (f *fakeStore) SweepStale(context.Context) (int, error)          { return 0, nil }
func (f *fakeStore) GetBatch(context.Context, string) (*Batch, error) { return nil, ErrBatchNotFound }

type fakeMailer struct {
	mu       sync.Mutex
	on       bool
	sent     map[string]string // to -> body
	failFor  string
	panicFor string
	block    chan struct{}
}

func (m *fakeMailer) Configured() bool { return m.on }
func (m *fakeMailer) SendNow(to []string, _ string, body string) error {
	if m.block != nil {
		<-m.block
	}
	if to[0] == m.panicFor {
		panic("boom")
	}
	if to[0] == m.failFor {
		return errors.New("550 mailbox unavailable")
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	m.sent[to[0]] = body
	return nil
}

func cand(id, user, email string, force, active bool, hash string) Candidate {
	return Candidate{ID: id, Username: user, FullName: strings.ToUpper(user), Email: email, Roles: []string{"SALES_MANAGER"},
		ForceChange: force, IsActive: active, hash: hash, LastAlerted: map[Kind]*time.Time{}}
}

// The "hash" is just the password text; the fake matcher compares it with the default.
func newSvc(cands []Candidate, m *fakeMailer) (*Service, *fakeStore) {
	st := &fakeStore{cands: cands}
	s := NewService(st, m, nil, "Globx@2026", "https://app.example.in/")
	s.pause = 0
	s.match = func(hash, pw string) bool { return hash == pw }
	return s, st
}

func waitDone(t *testing.T, st *fakeStore) {
	t.Helper()
	for i := 0; i < 200; i++ {
		st.mu.Lock()
		done := st.status != ""
		st.mu.Unlock()
		if done {
			return
		}
		time.Sleep(5 * time.Millisecond)
	}
	t.Fatal("batch never finished")
}

func ids(rows []Row) string {
	var out []string
	for _, r := range rows {
		out = append(out, r.ID)
	}
	return strings.Join(out, ",")
}

// ---- tests ----------------------------------------------------------------

func TestPreviewBuckets(t *testing.T) {
	cands := []Candidate{
		cand("a", "asha", "asha@x.in", true, true, "Globx@2026"),    // never changed -> INITIAL
		cand("b", "bala", "bala@x.in", false, true, "MyOwn#1"),      // chose own password -> RESET
		cand("c", "chitra", "c@x.in", true, true, "Temp#9"),         // admin-set temporary -> skipped
		cand("d", "dev", "", true, true, "Globx@2026"),              // no email
		cand("e", "esha", "not-an-email", true, true, "Globx@2026"), // bad email
		cand("f", "fay", "f@x.in", true, false, "Globx@2026"),       // inactive
		cand("g", "gita", "g@x.in", false, true, "Globx@2026"),      // still on default, no forced change -> INITIAL
	}
	s, _ := newSvc(cands, &fakeMailer{on: true})
	p, err := s.Preview(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if ids(p.Initial) != "a,g" || ids(p.Reset) != "b" || ids(p.Temp) != "c" {
		t.Fatalf("initial=%s reset=%s temp=%s", ids(p.Initial), ids(p.Reset), ids(p.Temp))
	}
	if p.Skipped != (Skipped{NoEmail: 2, Inactive: 1}) {
		t.Fatalf("skipped %+v", p.Skipped)
	}
}

func TestSendDeliversRightMailToRightPeople(t *testing.T) {
	m := &fakeMailer{on: true, sent: map[string]string{}}
	s, st := newSvc([]Candidate{
		cand("a", "asha", "asha@x.in", true, true, "Globx@2026"),
		cand("b", "bala", "bala@x.in", false, true, "MyOwn#1"),
	}, m)
	_, total, err := s.Send(context.Background(), "admin", SendRequest{Kinds: []Kind{KindInitial, KindReset}, UserIDs: []string{"a", "b"}})
	if err != nil || total != 2 {
		t.Fatalf("total=%d err=%v", total, err)
	}
	waitDone(t, st)
	if st.status != "DONE" || st.items["a"] != "SENT" || st.items["b"] != "SENT" {
		t.Fatalf("status %s items %v", st.status, st.items)
	}
	if !strings.Contains(m.sent["asha@x.in"], "Globx@2026") || !strings.Contains(m.sent["asha@x.in"], "Sales Manager") {
		t.Fatal("initial mail must carry the password and the role")
	}
	if strings.Contains(m.sent["bala@x.in"], "Globx@2026") || strings.Contains(m.sent["bala@x.in"], "MyOwn#1") {
		t.Fatal("reset confirmation must never carry a password")
	}
}

func TestSendOnlyNarrowsNeverWidens(t *testing.T) {
	m := &fakeMailer{on: true, sent: map[string]string{}}
	s, st := newSvc([]Candidate{
		cand("a", "asha", "asha@x.in", true, true, "Globx@2026"),
		cand("c", "chitra", "c@x.in", true, true, "Temp#9"), // admin-set password: only the TEMP kind reaches her
	}, m)
	// Asking for a user under the wrong kind, or for a kind nobody is in, sends nothing.
	if _, _, err := s.Send(context.Background(), "x", SendRequest{Kinds: []Kind{KindInitial}, UserIDs: []string{"c"}}); !errors.Is(err, ErrNothingToSend) {
		t.Fatalf("want ErrNothingToSend, got %v", err)
	}
	if _, _, err := s.Send(context.Background(), "x", SendRequest{Kinds: []Kind{KindReset}, UserIDs: []string{"a"}}); !errors.Is(err, ErrNothingToSend) {
		t.Fatalf("want ErrNothingToSend, got %v", err)
	}
	// An empty selection is "nobody", not "everybody".
	if _, _, err := s.Send(context.Background(), "x", SendRequest{Kinds: []Kind{KindInitial}}); !errors.Is(err, ErrNothingToSend) {
		t.Fatalf("empty user list must send nothing, got %v", err)
	}
	if st.created != 0 || len(m.sent) != 0 {
		t.Fatal("nothing should have been queued or sent")
	}
}

func TestAlreadyAlertedSkippedUnlessIncluded(t *testing.T) {
	when := time.Now().Add(-time.Hour)
	a := cand("a", "asha", "asha@x.in", true, true, "Globx@2026")
	a.LastAlerted[KindInitial] = &when
	m := &fakeMailer{on: true, sent: map[string]string{}}
	s, st := newSvc([]Candidate{a}, m)
	req := SendRequest{Kinds: []Kind{KindInitial}, UserIDs: []string{"a"}}
	if _, _, err := s.Send(context.Background(), "x", req); !errors.Is(err, ErrNothingToSend) {
		t.Fatalf("already alerted user must be skipped, got %v", err)
	}
	req.IncludeAlerted = true
	if _, total, err := s.Send(context.Background(), "x", req); err != nil || total != 1 {
		t.Fatalf("total=%d err=%v", total, err)
	}
	waitDone(t, st)
}

func TestFailedMailIsRecordedAndBatchStillFinishes(t *testing.T) {
	m := &fakeMailer{on: true, sent: map[string]string{}, failFor: "bad@x.in"}
	s, st := newSvc([]Candidate{
		cand("a", "asha", "asha@x.in", true, true, "Globx@2026"),
		cand("b", "bad", "bad@x.in", true, true, "Globx@2026"),
		cand("c", "chitra", "c@x.in", true, true, "Globx@2026"),
	}, m)
	if _, _, err := s.Send(context.Background(), "x", SendRequest{Kinds: []Kind{KindInitial}, UserIDs: []string{"a", "b", "c"}}); err != nil {
		t.Fatal(err)
	}
	waitDone(t, st)
	if st.status != "DONE" || st.items["b"] != "FAILED" || st.items["a"] != "SENT" || st.items["c"] != "SENT" {
		t.Fatalf("status %s items %v", st.status, st.items)
	}
	if !strings.Contains(st.errs["b"], "550") {
		t.Fatalf("reason lost: %q", st.errs["b"])
	}
}

func TestPanicInSenderClosesBatchAndFreesTheGuard(t *testing.T) {
	m := &fakeMailer{on: true, sent: map[string]string{}, panicFor: "b@x.in"}
	s, st := newSvc([]Candidate{
		cand("a", "asha", "a@x.in", true, true, "Globx@2026"),
		cand("b", "bala", "b@x.in", true, true, "Globx@2026"),
		cand("c", "chitra", "c@x.in", true, true, "Globx@2026"),
	}, m)
	if _, _, err := s.Send(context.Background(), "x", SendRequest{Kinds: []Kind{KindInitial}, UserIDs: []string{"a", "b", "c"}}); err != nil {
		t.Fatal(err)
	}
	waitDone(t, st)
	if st.status != "FAILED" || st.items["a"] != "SENT" || st.items["c"] != "FAILED" {
		t.Fatalf("status %s items %v", st.status, st.items)
	}
	if st.running != "" {
		t.Fatal("a crashed batch must not block the next send")
	}
}

func TestSecondSendWhileRunningIsRefused(t *testing.T) {
	gate := make(chan struct{})
	m := &fakeMailer{on: true, sent: map[string]string{}, block: gate}
	s, st := newSvc([]Candidate{cand("a", "asha", "a@x.in", true, true, "Globx@2026")}, m)
	req := SendRequest{Kinds: []Kind{KindInitial}, UserIDs: []string{"a"}}
	if _, _, err := s.Send(context.Background(), "x", req); err != nil {
		t.Fatal(err)
	}
	if _, _, err := s.Send(context.Background(), "x", req); !errors.Is(err, ErrBatchRunning) {
		t.Fatalf("want ErrBatchRunning, got %v", err)
	}
	close(gate)
	waitDone(t, st)
}

func TestNotConfiguredSendsNothing(t *testing.T) {
	s, st := newSvc([]Candidate{cand("a", "asha", "a@x.in", true, true, "Globx@2026")}, &fakeMailer{on: false})
	if _, _, err := s.Send(context.Background(), "x", SendRequest{Kinds: []Kind{KindInitial}, UserIDs: []string{"a"}}); !errors.Is(err, ErrNotConfigured) {
		t.Fatalf("want ErrNotConfigured, got %v", err)
	}
	if st.created != 0 {
		t.Fatal("no batch may be created when mail cannot be sent")
	}
}

func TestHostileValuesAreEscaped(t *testing.T) {
	it := Item{Kind: KindInitial, Email: "", Username: `<script>alert(1)</script>`, FullName: `<img src=x>`, Roles: []string{"ADMIN"}, Password: "p<w>&"}
	_, body := Message(it, `https://app.example.in/"><x>`)
	for _, bad := range []string{"<script>", "<img", "p<w>", `"><x>`} {
		if strings.Contains(body, bad) {
			t.Fatalf("user-supplied text must be HTML-escaped, found %q", bad)
		}
	}
}

func TestWelcomeMailFollowsTheTeamFormat(t *testing.T) {
	it := Item{Kind: KindInitial, Email: "amit@globx.co.in", Username: "amit", Roles: []string{"SALES_MANAGER"}, Password: "Globx@2026"}
	subject, body := Message(it, "http://192.168.1.50")
	if subject != "Welcome to OneTrack – Your Login Credentials" {
		t.Fatalf("subject %q", subject)
	}
	for _, want := range []string{
		"Dear Sir/Madam,",
		"Greetings from the Software Development Team at GLOBX!",
		"designed to streamline actions related to Bidding &amp; Tenders",
		">Username:<", "amit@globx.co.in",
		">Password:<", "Globx@2026", "you will be prompted to change this upon first login*",
		">Platform link:<", "http://192.168.1.50/login",
		"If you have already begun using the OneTrack app, kindly disregard this email",
		"Best Regards,", "Software Development &amp; Engineering (SDE) Team", "GLOBX",
		"Sales Manager",
	} {
		if !strings.Contains(body, want) {
			t.Fatalf("mail is missing %q", want)
		}
	}
	// without APP_BASE_URL there is no link line (rather than a broken one)
	if _, b := Message(it, ""); strings.Contains(b, "Platform link") {
		t.Fatal("no link line without APP_BASE_URL")
	}
	// an admin-set password changes only the note
	it.Temp, it.Password = true, "Test@123"
	_, tb := Message(it, "http://192.168.1.50")
	if !strings.Contains(tb, "reset by an administrator") || !strings.Contains(tb, "Test@123") || strings.Contains(tb, "begun using") {
		t.Fatal("temp-password wording wrong")
	}
}

func TestResetConfirmationKeepsTheWelcomeFormatWithoutAPassword(t *testing.T) {
	it := Item{Kind: KindReset, Email: "amit@globx.co.in", Username: "amit", Roles: []string{"ADMIN"}, Password: "never-shown"}
	subject, body := Message(it, "http://192.168.1.50")
	if subject != "OneTrack – Please Log In with Your Own Credentials" {
		t.Fatalf("subject %q", subject)
	}
	if strings.Contains(body, "never-shown") || strings.Contains(body, "Globx@2026") {
		t.Fatal("confirmation must not carry a password")
	}
	for _, want := range []string{
		"Dear Sir/Madam,", "Greetings from the Software Development Team at GLOBX!",
		">Username:<", "amit@globx.co.in", ">Role:<", ">Password:<", "The password you set yourself",
		">Platform link:<", "http://192.168.1.50/login",
		"Please log in with your own credentials. If you face any issue, kindly contact the Dev Team.",
		"Best Regards,", "Software Development &amp; Engineering (SDE) Team",
	} {
		if !strings.Contains(body, want) {
			t.Fatalf("mail is missing %q", want)
		}
	}
}

func TestNoteIsABoldHighlightedCallout(t *testing.T) {
	for name, it := range map[string]Item{
		"welcome": {Kind: KindInitial, Email: "a@x.in", Password: "p"},
		"admin":   {Kind: KindInitial, Email: "a@x.in", Password: "p", Temp: true},
		"reset":   {Kind: KindReset, Email: "a@x.in"},
	} {
		_, body := Message(it, "")
		if !strings.Contains(body, "font-weight:700") || !strings.Contains(body, "background:#fffbeb") || !strings.Contains(body, ">*Note*: ") {
			t.Fatalf("%s mail: the *Note* must be a bold, highlighted block", name)
		}
	}
	_, body := Message(Item{Kind: KindInitial, Email: "a@x.in", Password: "p", Temp: true}, "")
	if !strings.Contains(body, "Your password was reset by an administrator. If you have already changed it since, kindly disregard this email and continue with your existing credentials.") {
		t.Fatal("admin-reset note text changed")
	}
}

func TestLoginDetailsAreABorderedTableInEveryMail(t *testing.T) {
	for name, it := range map[string]Item{
		"welcome": {Kind: KindInitial, Email: "a@x.in", Password: "p"},
		"admin":   {Kind: KindInitial, Email: "a@x.in", Password: "p", Temp: true},
		"reset":   {Kind: KindReset, Email: "a@x.in"},
	} {
		_, body := Message(it, "http://h")
		if !strings.Contains(body, "Your Login Details") || strings.Count(body, "border:1px solid #d1d5db") < 6 {
			t.Fatalf("%s mail: login details must be a bordered table with a header row", name)
		}
	}
}
