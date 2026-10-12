package service

import (
	"context"
	"fmt"
	"html"
	"log"
	"time"

	alertDomain "github.com/onetrack/backend/internal/alert/domain"
	"github.com/onetrack/backend/internal/calendar/domain"
)

// Reminders for document-shortfall rounds (Technical Evaluation). They ride the
// deadline engine: the same scheduler tick, the same working-calendar maths, the
// same stakeholder list and dedup table as the red-zone alert. A round whose deadline
// is inside the calendar's trigger window gets one "due" reminder, and one "overdue"
// reminder once the deadline has passed, each sent once per recipient per round.
const (
	shortfallDueType     = "SHORTFALL_DUE_R"
	shortfallOverdueType = "SHORTFALL_OVERDUE_R"
)

// remindShortfalls returns how many recipients were alerted, never more than budget.
func (s *workingCalendarService) remindShortfalls(ctx context.Context, now time.Time, budget int) int {
	rounds, err := s.repo.ListOpenShortfalls(ctx)
	if err != nil {
		log.Printf("[WorkingCalendar] shortfall lookup failed: %v", err)
		return 0
	}
	rules := map[string]*calRules{}
	sent := 0
	for _, c := range rounds {
		if sent >= budget || ctx.Err() != nil {
			break
		}
		key := deref(c.CalendarID)
		r := rules[key]
		if r == nil {
			if r, err = s.loadRules(ctx, key); err != nil {
				log.Printf("[WorkingCalendar] calendar %q unavailable for shortfall of tender %s: %v", key, c.TenderID, err)
				continue
			}
			rules[key] = r
		}

		var ntype, title, message string
		if !now.Before(c.Deadline) {
			ntype = fmt.Sprintf("%s%d", shortfallOverdueType, c.Round)
			title, message = shortfallAlert(c, r, "", 0, true)
		} else {
			v, u := trigger(r.cal)
			calc, err := s.compute(r, c.Deadline, v, u, now)
			if err != nil {
				log.Printf("[WorkingCalendar] shortfall of tender %s: %v", c.TenderID, err)
				continue
			}
			if !calc.triggered {
				continue
			}
			ntype = fmt.Sprintf("%s%d", shortfallDueType, c.Round)
			title, message = shortfallAlert(c, r, thresholdLabel(v, u), calc.remDays, false)
		}

		out, err := s.notifyStakeholders(ctx, c.TenderID,
			domain.TaskNotification{NotificationType: ntype, ScheduledAt: c.Deadline, Subject: title, Message: message},
			alertDomain.Alert{Type: "ACTION_REQUIRED", Title: title, Message: message, Link: alertDomain.StageLink(c.TenderID, "TECHNICAL_EVALUATION")},
			false, false)
		if err != nil || out.errs > 0 {
			log.Printf("[WorkingCalendar] shortfall reminder for tender %s incomplete: %v (%d claim errors)", c.TenderID, err, out.errs)
		}
		sent += len(out.notified)
		if len(out.notified) > 0 && s.systemLog != nil {
			s.systemLog.Record(ctx, "TENDER", "TENDER_SHORTFALL_REMINDER", "", nil,
				fmt.Sprintf("Document shortfall reminder (%s) sent to %d stakeholders for tender %s", ntype, len(out.notified), c.Title),
				map[string]interface{}{"tender_id": c.TenderID, "tender_title": c.Title, "round": c.Round, "deadline": c.Deadline.Format(time.RFC3339), "stakeholders": len(out.notified)})
		}
	}
	return sent
}

// shortfallAlert builds the alert title and HTML body; every interpolated value is escaped.
func shortfallAlert(c domain.ShortfallCandidate, r *calRules, label string, remDays float64, overdue bool) (string, string) {
	e := html.EscapeString
	const stamp = "02-Jan-2006 15:04 MST"
	progress := fmt.Sprintf("%d of %d documents added", c.DocsAdded, c.DocsTotal)
	status := map[string]string{
		"COLLECTING":       "still collecting the documents",
		"PENDING_APPROVAL": "documents are waiting for approval",
		"APPROVED":         "documents are approved but not yet sent to the customer",
	}[c.Status]
	if status == "" {
		status = c.Status
	}

	if overdue {
		return fmt.Sprintf("🚨 OVERDUE: document shortfall deadline passed — %s", c.Title),
			fmt.Sprintf(`<p>The customer's document shortfall deadline for tender <strong>%s</strong> (round %d) was <strong>%s</strong> and the documents have not been sent yet.</p>`+
				`<p>%s; %s. Open the Technical Evaluation stage and finish it now, or record the bid as lost.</p>`,
				e(c.Title), c.Round, e(c.Deadline.In(r.loc).Format(stamp)), e(progress), e(status))
	}
	return fmt.Sprintf("⏰ DOCUMENT SHORTFALL: %s left — %s", label, c.Title),
		fmt.Sprintf(`<p>The document shortfall deadline for tender <strong>%s</strong> (round %d) is inside its red zone: %s of working time remain.</p>`+
			`<p>Deadline: <strong>%s</strong><br/>Remaining: <strong>%.1f working days</strong><br/>%s; %s.</p>`+
			`<p>Open the Technical Evaluation stage to add, approve and send the documents.</p>`,
			e(c.Title), c.Round, e(label), e(c.Deadline.In(r.loc).Format(stamp)), remDays, e(progress), e(status))
}
