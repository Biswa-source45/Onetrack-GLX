package service

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"html"
	"strings"
	"time"

	alertDomain "github.com/onetrack/backend/internal/alert/domain"
	"github.com/onetrack/backend/internal/bid/domain"
)

const (
	techEvalMaxText    = 1000
	techEvalMaxLog     = 500
	techEvalMaxYears   = 5
	techEvalRetries    = 3
	techEvalDateLayout = "2006-01-02"
)

func techEvalLabel(field string) string {
	for _, f := range domain.TechEvalDateFields {
		if f.Key == field {
			return f.Label
		}
	}
	return ""
}

func parseTechEval(raw []byte) *domain.TechEval {
	te := &domain.TechEval{Dates: map[string]string{}, Log: []domain.TechEvalEntry{}}
	if len(raw) > 0 {
		_ = json.Unmarshal(raw, te)
	}
	if te.Dates == nil {
		te.Dates = map[string]string{}
	}
	if te.Log == nil {
		te.Log = []domain.TechEvalEntry{}
	}
	return te
}

// checkTechEvalOpened keeps a PATCH from walking round the lock: no Technical Evaluation
// result or completion until the stage has been opened.
func checkTechEvalOpened(bid *domain.BidWorkspace, req *domain.UpdateBidRequest) error {
	recording := (req.TechnicalResult != nil && strings.TrimSpace(*req.TechnicalResult) != "") ||
		req.StageCompletions[domain.StageTechnicalEvaluation]
	if recording && parseTechEval(bid.TechEval).OpenedAt == "" {
		return fmt.Errorf("%w: open Technical Evaluation (from Bid Submission) before recording its result", domain.ErrValidation)
	}
	return nil
}

func techEvalText(label, s string) (string, error) {
	s = strings.TrimSpace(s)
	switch {
	case s == "":
		return "", fmt.Errorf("%w: %s is required", domain.ErrValidation, label)
	case len([]rune(s)) > techEvalMaxText:
		return "", fmt.Errorf("%w: %s can be at most %d characters", domain.ErrValidation, label, techEvalMaxText)
	}
	return s, nil
}

// techEvalDate checks a YYYY-MM-DD date: a real calendar date, not before the day the bid
// was submitted (one day of slack for time zones) and not more than five years ahead.
func techEvalDate(s string, bid *domain.BidWorkspace, now time.Time) error {
	d, err := time.Parse(techEvalDateLayout, s)
	if err != nil || d.Format(techEvalDateLayout) != s {
		return fmt.Errorf("%w: enter the date as YYYY-MM-DD", domain.ErrValidation)
	}
	var pb struct {
		SubmittedAt string `json:"submittedAt"`
	}
	_ = json.Unmarshal(bid.PostBid, &pb)
	if at, err := time.Parse(time.RFC3339, pb.SubmittedAt); err == nil {
		if min := at.UTC().AddDate(0, 0, -1).Format(techEvalDateLayout); s < min {
			return fmt.Errorf("%w: the date cannot be before the bid was submitted", domain.ErrValidation)
		}
	}
	if d.After(now.UTC().AddDate(techEvalMaxYears, 0, 0)) {
		return fmt.Errorf("%w: the date is too far in the future", domain.ErrValidation)
	}
	return nil
}

func newTechEvalID() string {
	b := make([]byte, 6)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

// mutateTechEval loads the tender, applies fn to its tech_eval and saves it on the revision it
// was read at. Two people writing at once just retry on the newer revision, so no note is lost.
func (s *bidService) mutateTechEval(ctx context.Context, bidID, actorID string, fn func(bid *domain.BidWorkspace, te *domain.TechEval, who string, now time.Time) error) (*domain.BidWorkspace, *domain.TechEval, error) {
	if err := s.checkStageAccess(ctx, actorID, domain.StageTechnicalEvaluation); err != nil {
		return nil, nil, err
	}
	who := actorID
	if u, err := s.repo.GetUserSummary(ctx, actorID); err == nil && u != nil {
		if who = strings.TrimSpace(u.FullName); who == "" {
			who = u.Username
		}
	}
	for attempt := 0; ; attempt++ {
		bid, err := s.repo.GetByID(ctx, bidID)
		if err != nil {
			return nil, nil, err
		}
		switch bid.BidStatus {
		case domain.BidStatusWon, domain.BidStatusLost, domain.BidStatusCancelled, domain.BidStatusClosed, domain.BidStatusArchived:
			return nil, nil, fmt.Errorf("%w: this tender is %s, so Technical Evaluation can no longer be changed", domain.ErrValidation, strings.ToLower(bid.BidStatus))
		}
		te := parseTechEval(bid.TechEval)
		oldRev := te.Rev
		if err := fn(bid, te, who, time.Now()); err != nil {
			return nil, nil, err
		}
		if len(te.Log) > techEvalMaxLog {
			te.Log = te.Log[len(te.Log)-techEvalMaxLog:]
		}
		te.Rev = oldRev + 1
		doc, err := json.Marshal(te)
		if err != nil {
			return nil, nil, err
		}
		err = s.repo.UpdateTechEval(ctx, bidID, doc, oldRev)
		if errors.Is(err, domain.ErrConflict) && attempt+1 < techEvalRetries {
			continue
		}
		if err != nil {
			return nil, nil, err
		}
		return bid, te, nil
	}
}

func (s *bidService) OpenTechEval(ctx context.Context, bidID string, req *domain.OpenTechEvalRequest, actorID string) (*domain.TechEval, error) {
	remark, err := techEvalText("the remark", req.Remark)
	if err != nil {
		return nil, err
	}
	var date string
	bid, te, err := s.mutateTechEval(ctx, bidID, actorID, func(bid *domain.BidWorkspace, te *domain.TechEval, who string, now time.Time) error {
		var done map[string]bool
		_ = json.Unmarshal(bid.StageCompletions, &done)
		var pb struct {
			SubmittedAt string `json:"submittedAt"`
		}
		_ = json.Unmarshal(bid.PostBid, &pb)
		switch {
		case te.OpenedAt != "":
			return fmt.Errorf("%w: Technical Evaluation is already open", domain.ErrConflict)
		case pb.SubmittedAt == "" || !done[domain.StageGeMSubmission]:
			return fmt.Errorf("%w: submit the bid and complete Bid Submission before opening Technical Evaluation", domain.ErrValidation)
		}
		date = strings.TrimSpace(req.Date)
		if err := techEvalDate(date, bid, now); err != nil {
			return err
		}
		at := now.UTC().Format(time.RFC3339)
		te.OpenedAt, te.OpenedBy, te.OpenedByID = at, who, actorID
		te.Dates["evaluation"] = date
		te.Log = append(te.Log, domain.TechEvalEntry{
			ID: newTechEvalID(), At: at, By: who, ByID: actorID, Kind: domain.TechLogOpen,
			Text: remark, Field: "evaluation", To: date, Change: domain.TechChangeSet,
		})
		return nil
	})
	if err != nil {
		return nil, err
	}
	s.logAction(ctx, bidID, bid.Title, "TECH_EVAL_OPENED", actorID, fmt.Sprintf("Technical Evaluation opened for %s by %s", date, te.OpenedBy))
	s.notifyTechEval(ctx, bid, actorID, "Technical Evaluation opened",
		fmt.Sprintf("<p>Technical Evaluation was opened by <strong>%s</strong> on tender <strong>%s</strong>.</p><p>Technical Evaluation Date: <strong>%s</strong></p><p>Remark: %s</p>",
			html.EscapeString(te.OpenedBy), html.EscapeString(bid.Title), techEvalPretty(date), html.EscapeString(remark)))
	return te, nil
}

func (s *bidService) SetTechEvalDate(ctx context.Context, bidID string, req *domain.SetTechEvalDateRequest, actorID string) (*domain.TechEval, error) {
	label := techEvalLabel(req.Field)
	if label == "" {
		return nil, fmt.Errorf("%w: unknown date", domain.ErrValidation)
	}
	date := strings.TrimSpace(req.Date)
	var change, from, reason string
	bid, te, err := s.mutateTechEval(ctx, bidID, actorID, func(bid *domain.BidWorkspace, te *domain.TechEval, who string, now time.Time) error {
		if te.OpenedAt == "" {
			return fmt.Errorf("%w: open Technical Evaluation first", domain.ErrValidation)
		}
		from = te.Dates[req.Field]
		switch {
		case date == from:
			return fmt.Errorf("%w: that is already the %s", domain.ErrValidation, strings.ToLower(label))
		case date == "":
			change = domain.TechChangeClear
		case from == "":
			change = domain.TechChangeSet
		case date > from: // YYYY-MM-DD sorts as a date
			change = domain.TechChangeExtend
		default:
			change = domain.TechChangePrepone
		}
		if date != "" {
			if err := techEvalDate(date, bid, now); err != nil {
				return err
			}
		}
		var err error
		if change == domain.TechChangeSet {
			reason = strings.TrimSpace(req.Reason)
			if len([]rune(reason)) > techEvalMaxText {
				return fmt.Errorf("%w: the reason can be at most %d characters", domain.ErrValidation, techEvalMaxText)
			}
		} else if reason, err = techEvalText("a reason for the change", req.Reason); err != nil {
			return err
		}
		if date == "" {
			delete(te.Dates, req.Field)
		} else {
			te.Dates[req.Field] = date
		}
		te.Log = append(te.Log, domain.TechEvalEntry{
			ID: newTechEvalID(), At: now.UTC().Format(time.RFC3339), By: who, ByID: actorID, Kind: domain.TechLogDate,
			Text: reason, Field: req.Field, From: from, To: date, Change: change,
		})
		return nil
	})
	if err != nil {
		return nil, err
	}
	summary := fmt.Sprintf("%s: %s", label, techEvalChangeText(change, from, date))
	s.logAction(ctx, bidID, bid.Title, "TECH_EVAL_DATE_CHANGED", actorID, summary)
	body := fmt.Sprintf("<p><strong>%s</strong> on tender <strong>%s</strong>: %s.</p>", html.EscapeString(label), html.EscapeString(bid.Title), techEvalChangeText(change, from, date))
	if reason != "" {
		body += fmt.Sprintf("<p>Reason: %s</p>", html.EscapeString(reason))
	}
	s.notifyTechEval(ctx, bid, actorID, label+" updated", body)
	return te, nil
}

func (s *bidService) AddTechEvalNote(ctx context.Context, bidID string, req *domain.AddTechEvalNoteRequest, actorID string) (*domain.TechEval, error) {
	text, err := techEvalText("the note", req.Text)
	if err != nil {
		return nil, err
	}
	bid, te, err := s.mutateTechEval(ctx, bidID, actorID, func(bid *domain.BidWorkspace, te *domain.TechEval, who string, now time.Time) error {
		if te.OpenedAt == "" {
			return fmt.Errorf("%w: open Technical Evaluation first", domain.ErrValidation)
		}
		te.Log = append(te.Log, domain.TechEvalEntry{
			ID: newTechEvalID(), At: now.UTC().Format(time.RFC3339), By: who, ByID: actorID, Kind: domain.TechLogNote, Text: text,
		})
		return nil
	})
	if err != nil {
		return nil, err
	}
	s.logAction(ctx, bidID, bid.Title, "TECH_EVAL_NOTE", actorID, "Note added to Technical Evaluation")
	return te, nil
}

func techEvalPretty(date string) string {
	if d, err := time.Parse(techEvalDateLayout, date); err == nil {
		return d.Format("02 Jan 2006")
	}
	return html.EscapeString(date)
}

func techEvalChangeText(change, from, to string) string {
	switch change {
	case domain.TechChangeSet:
		return "set to " + techEvalPretty(to)
	case domain.TechChangeClear:
		return "cleared (was " + techEvalPretty(from) + ")"
	case domain.TechChangeExtend:
		return "extended from " + techEvalPretty(from) + " to " + techEvalPretty(to)
	}
	return "moved earlier from " + techEvalPretty(from) + " to " + techEvalPretty(to)
}

// notifyTechEval tells the tender's Account Manager, Reporting Manager and Pre-Sales (not the
// person who just acted). The title is fixed text plus the tender title, as for every other
// stage alert; everything the user typed is escaped into the body.
func (s *bidService) notifyTechEval(ctx context.Context, bid *domain.BidWorkspace, actorID, title, body string) {
	seen := map[string]bool{actorID: true}
	for _, id := range []*string{bid.AccountManagerID, bid.ReportingManagerID, bid.PresalesID} {
		if id == nil || *id == "" || seen[*id] {
			continue
		}
		seen[*id] = true
		uid, bidID := *id, bid.ID
		_ = s.alertSvc.CreateAlert(ctx, &alertDomain.Alert{
			UserID: &uid, BidID: &bidID, CreatedBy: &actorID,
			Type:    "ACTION_REQUIRED",
			Title:   fmt.Sprintf("%s: %s", title, bid.Title),
			Message: body,
			Link:    alertDomain.StageLink(bidID, domain.StageTechnicalEvaluation),
		})
	}
}
