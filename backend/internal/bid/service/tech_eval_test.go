package service

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/onetrack/backend/internal/bid/domain"
)

func techEvalFixture(opened bool) (*bidService, *fakeBidRepo, *fakeAlertSvc) {
	am, rm, ps := "am-1", "rm-1", "ps-1"
	bid := &domain.BidWorkspace{
		ID: "bid-1", Title: "Tender <A>", BidStatus: domain.BidStatusActive, WorkflowStage: domain.StageTechnicalEvaluation,
		BidOwnerID: "owner-1", AccountManagerID: &am, ReportingManagerID: &rm, PresalesID: &ps,
		StageCompletions: []byte(`{"GEM_SUBMISSION":true}`),
		PostBid:          []byte(`{"submittedAt":"` + time.Now().UTC().Format(time.RFC3339) + `"}`),
	}
	if opened {
		bid.TechEval = []byte(`{"rev":1,"openedAt":"2026-01-01T00:00:00Z","dates":{"evaluation":"2030-01-10"},"log":[]}`)
	}
	repo := &fakeBidRepo{bid: bid}
	alerts := &fakeAlertSvc{}
	return NewBidService(repo, alerts, &fakeSystemLog{}).(*bidService), repo, alerts
}

func isValidation(err error) bool { return errors.Is(err, domain.ErrValidation) }

func TestOpenTechEval(t *testing.T) {
	ctx := context.Background()
	today := time.Now().UTC().Format("2006-01-02")
	future := time.Now().UTC().AddDate(0, 0, 10).Format("2006-01-02")

	s, repo, alerts := techEvalFixture(false)
	for name, req := range map[string]domain.OpenTechEvalRequest{
		"empty remark":    {Date: today, Remark: "   "},
		"long remark":     {Date: today, Remark: strings.Repeat("x", 1001)},
		"bad date":        {Date: "2026-13-45", Remark: "ok"},
		"date has no day": {Date: "2026-11", Remark: "ok"},
		"too far ahead":   {Date: "2099-01-01", Remark: "ok"},
	} {
		if _, err := s.OpenTechEval(ctx, "bid-1", &req, "exec-1"); !isValidation(err) {
			t.Errorf("%s: want ErrValidation, got %v", name, err)
		}
	}
	if repo.bid.TechEval != nil {
		t.Fatal("a rejected request must not write anything")
	}

	// Opening without a date is valid (dates are optional).
	teNoDate, err := s.OpenTechEval(ctx, "bid-1", &domain.OpenTechEvalRequest{Remark: "Opened without date"}, "exec-1")
	if err != nil {
		t.Fatalf("open without date: %v", err)
	}
	if teNoDate.OpenedAt == "" || teNoDate.Dates["evaluation"] != "" || len(teNoDate.Log) != 1 || teNoDate.Log[0].Kind != domain.TechLogOpen {
		t.Fatalf("unexpected state for open without date %+v", teNoDate)
	}

	// Reset fixture for full open test
	s, repo, alerts = techEvalFixture(false)
	te, err := s.OpenTechEval(ctx, "bid-1", &domain.OpenTechEvalRequest{Date: future, Remark: " Opened <b>today</b> "}, "exec-1")
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	if te.OpenedAt == "" || te.Dates["evaluation"] != future || len(te.Log) != 1 || te.Log[0].Kind != domain.TechLogOpen || te.Log[0].Text != "Opened <b>today</b>" || te.Rev != 1 {
		t.Fatalf("unexpected state %+v", te)
	}
	if len(alerts.created) != 3 {
		t.Fatalf("AM, RM and Pre-Sales should be mailed, got %d alerts", len(alerts.created))
	}
	for _, a := range alerts.created {
		if strings.Contains(a.Message, "<b>") {
			t.Errorf("user text must be escaped in the alert body: %s", a.Message)
		}
	}
	if _, err := s.OpenTechEval(ctx, "bid-1", &domain.OpenTechEvalRequest{Date: future, Remark: "again"}, "exec-1"); !errors.Is(err, domain.ErrConflict) {
		t.Errorf("opening twice: want ErrConflict, got %v", err)
	}

	// Not submitted / Stage 8 not completed.
	s, repo, _ = techEvalFixture(false)
	repo.bid.StageCompletions = []byte(`{}`)
	if _, err := s.OpenTechEval(ctx, "bid-1", &domain.OpenTechEvalRequest{Date: future, Remark: "x"}, "exec-1"); !isValidation(err) {
		t.Errorf("Stage 8 incomplete: want ErrValidation, got %v", err)
	}
	repo.bid.StageCompletions = []byte(`{"GEM_SUBMISSION":true}`)
	repo.bid.PostBid = nil
	if _, err := s.OpenTechEval(ctx, "bid-1", &domain.OpenTechEvalRequest{Date: future, Remark: "x"}, "exec-1"); !isValidation(err) {
		t.Errorf("not submitted: want ErrValidation, got %v", err)
	}

	// The actor is never mailed about their own action.
	s, repo, alerts = techEvalFixture(false)
	if _, err := s.OpenTechEval(ctx, "bid-1", &domain.OpenTechEvalRequest{Date: future, Remark: "x"}, "am-1"); err != nil {
		t.Fatal(err)
	}
	if len(alerts.created) != 2 {
		t.Errorf("actor excluded: want 2 alerts, got %d", len(alerts.created))
	}
}

func TestSetTechEvalDate(t *testing.T) {
	ctx := context.Background()
	s, _, alerts := techEvalFixture(true)
	set := func(field, date, reason string) (*domain.TechEval, error) {
		return s.SetTechEvalDate(ctx, "bid-1", &domain.SetTechEvalDateRequest{Field: field, Date: date, Reason: reason}, "exec-1")
	}
	if _, err := set("bogus", "2030-02-01", ""); !isValidation(err) {
		t.Errorf("unknown field: %v", err)
	}
	if _, err := set("clarification", "2030-02-30", ""); !isValidation(err) {
		t.Errorf("impossible date: %v", err)
	}

	// First set needs no reason.
	te, err := set("clarification", "2030-02-01", "")
	if err != nil || te.Dates["clarification"] != "2030-02-01" || te.Log[len(te.Log)-1].Change != domain.TechChangeSet {
		t.Fatalf("first set: %v %+v", err, te)
	}
	if len(alerts.created) != 3 {
		t.Errorf("date set should mail AM/RM/Pre-Sales, got %d", len(alerts.created))
	}
	// A change does not require a reason and can extend without reason.
	te, err = set("clarification", "2030-02-09", "")
	if err != nil || te.Log[len(te.Log)-1].Change != domain.TechChangeExtend || te.Log[len(te.Log)-1].From != "2030-02-01" {
		t.Fatalf("extend without reason: %v %+v", err, te)
	}
	// Same date does not error.
	if _, err := set("clarification", "2030-02-09", ""); err != nil {
		t.Errorf("same date should not error: %v", err)
	}
	te, err = set("clarification", "2030-02-05", "moved up")
	if err != nil || te.Log[len(te.Log)-1].Change != domain.TechChangePrepone {
		t.Fatalf("prepone: %v %+v", err, te)
	}
	te, err = set("clarification", "", "not needed")
	if err != nil || te.Dates["clarification"] != "" || te.Log[len(te.Log)-1].Change != domain.TechChangeClear {
		t.Fatalf("clear: %v %+v", err, te)
	}
	if te.Rev != 6 {
		t.Errorf("rev should advance once per write, got %d", te.Rev)
	}

	// Not opened yet.
	s, _, _ = techEvalFixture(false)
	if _, err := set("negotiation", "2030-02-01", ""); !isValidation(err) {
		t.Errorf("not opened: %v", err)
	}
}

func TestTechEvalNotesAndGuards(t *testing.T) {
	ctx := context.Background()
	s, repo, _ := techEvalFixture(true)
	if _, err := s.AddTechEvalNote(ctx, "bid-1", &domain.AddTechEvalNoteRequest{Text: "  "}, "exec-1"); !isValidation(err) {
		t.Errorf("empty note: %v", err)
	}
	// Two concurrent writers: the first save conflicts, the retry lands on the new revision.
	repo.techEvalConflicts = 1
	te, err := s.AddTechEvalNote(ctx, "bid-1", &domain.AddTechEvalNoteRequest{Text: "hello"}, "exec-1")
	if err != nil || len(te.Log) != 1 || te.Log[0].Kind != domain.TechLogNote {
		t.Fatalf("note with one conflict: %v %+v", err, te)
	}
	repo.techEvalConflicts = 5
	if _, err := s.AddTechEvalNote(ctx, "bid-1", &domain.AddTechEvalNoteRequest{Text: "hi"}, "exec-1"); !errors.Is(err, domain.ErrConflict) {
		t.Errorf("persistent conflict should surface: %v", err)
	}
	repo.techEvalConflicts = 0

	// Terminal tenders are read-only.
	repo.bid.BidStatus = domain.BidStatusLost
	if _, err := s.AddTechEvalNote(ctx, "bid-1", &domain.AddTechEvalNoteRequest{Text: "late"}, "exec-1"); !isValidation(err) {
		t.Errorf("lost tender: %v", err)
	}
}

func TestUpdateBid_TechResultNeedsOpenedTechEval(t *testing.T) {
	ctx := context.Background()
	qualified := "QUALIFIED"
	req := func() *domain.UpdateBidRequest { return &domain.UpdateBidRequest{TechnicalResult: &qualified} }

	s, _, _ := techEvalFixture(false)
	if err := s.UpdateBid(ctx, "bid-1", req(), "exec-1", nil); !isValidation(err) {
		t.Errorf("result before opening: want ErrValidation, got %v", err)
	}
	done := &domain.UpdateBidRequest{StageCompletions: map[string]bool{domain.StageTechnicalEvaluation: true}}
	if err := s.UpdateBid(ctx, "bid-1", done, "exec-1", nil); !isValidation(err) {
		t.Errorf("completion before opening: want ErrValidation, got %v", err)
	}
	s, _, _ = techEvalFixture(true)
	if err := s.UpdateBid(ctx, "bid-1", req(), "exec-1", nil); err != nil {
		t.Errorf("result after opening: %v", err)
	}
}

func TestAddTechEvalDailyRemark_ProcessFlow(t *testing.T) {
	ctx := context.Background()
	s, _, alerts := techEvalFixture(true)

	if _, err := s.AddTechEvalDailyRemark(ctx, "bid-1", &domain.AddTechEvalDailyRemarkRequest{Text: "   "}, "be-1"); !isValidation(err) {
		t.Errorf("empty daily remark: want ErrValidation, got %v", err)
	}

	te, err := s.AddTechEvalDailyRemark(ctx, "bid-1", &domain.AddTechEvalDailyRemarkRequest{Text: "Followed up with authority officer; clarifications submitted"}, "be-1")
	if err != nil {
		t.Fatalf("add daily remark: %v", err)
	}
	if te.DailyRemarksCount != 1 || te.LastDailyRemarkText == "" || te.LastDailyRemarkAt == "" {
		t.Fatalf("unexpected state %+v", te)
	}
	if len(te.Log) != 1 || te.Log[0].Kind != domain.TechLogDailyRemark {
		t.Fatalf("log entry missing or wrong kind: %+v", te.Log)
	}

	// Verify Process Flow: BE -> Notification to AM (and PM/Pre-Sales/RM)
	if len(alerts.created) != 3 {
		t.Fatalf("expected alerts to AM, RM, and Pre-Sales, got %d", len(alerts.created))
	}
	alertFound := false
	for _, a := range alerts.created {
		if strings.Contains(a.Title, "Daily Remark") && strings.Contains(a.Message, "Followed up with authority") {
			alertFound = true
			break
		}
	}
	if !alertFound {
		t.Errorf("expected daily remark alert content in created alerts")
	}
}

func TestSetTechEvalDate_BidExtension(t *testing.T) {
	ctx := context.Background()
	s, _, alerts := techEvalFixture(true)

	future := time.Now().UTC().AddDate(0, 0, 15).Format("2006-01-02")
	te, err := s.SetTechEvalDate(ctx, "bid-1", &domain.SetTechEvalDateRequest{
		Field:  "bidExtension",
		Date:   future,
		Reason: "Authority extended bid validity by 15 days",
	}, "be-1")
	if err != nil {
		t.Fatalf("set bid extension date: %v", err)
	}
	if te.Dates["bidExtension"] != future {
		t.Errorf("expected bidExtension to be %s, got %s", future, te.Dates["bidExtension"])
	}

	// Stakeholders alerted
	if len(alerts.created) != 3 {
		t.Errorf("expected 3 alerts, got %d", len(alerts.created))
	}
}

func TestGetTechEvalFollowUpStatus_SLA(t *testing.T) {
	ctx := context.Background()
	s, repo, _ := techEvalFixture(true)

	// Brand new open tech eval (opened in 2026-01-01 -> >24h overdue)
	status, err := s.GetTechEvalFollowUpStatus(ctx, "bid-1")
	if err != nil {
		t.Fatalf("get follow-up status: %v", err)
	}
	if !status.IsFollowUpDue || !status.IsOverdue {
		t.Errorf("expected overdue status when >24 hours, got %+v", status)
	}

	// Log a fresh remark today
	freshTime := time.Now().UTC().Format(time.RFC3339)
	repo.bid.TechEval = []byte(`{"rev":2,"openedAt":"2026-01-01T00:00:00Z","lastDailyRemarkAt":"` + freshTime + `","lastDailyRemarkBy":"BE John","dates":{},"log":[]}`)

	status, err = s.GetTechEvalFollowUpStatus(ctx, "bid-1")
	if err != nil {
		t.Fatalf("get follow-up status: %v", err)
	}
	if status.IsFollowUpDue || status.IsOverdue {
		t.Errorf("expected timely status within 24 hours, got %+v", status)
	}
}

func TestTriggerTechEvalFollowUpReminder(t *testing.T) {
	ctx := context.Background()
	s, _, alerts := techEvalFixture(true)

	err := s.TriggerTechEvalFollowUpReminder(ctx, "bid-1", "be-1")
	if err != nil {
		t.Fatalf("trigger reminder: %v", err)
	}
	if len(alerts.created) != 3 {
		t.Fatalf("expected 3 alerts to AM/PM/RM, got %d", len(alerts.created))
	}
	if !strings.Contains(alerts.created[0].Title, "Follow-up") {
		t.Errorf("expected follow-up in alert title, got %s", alerts.created[0].Title)
	}
}
