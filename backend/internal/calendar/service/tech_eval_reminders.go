package service

import (
	"context"
	"fmt"
	"html"
	"log"
	"strings"
	"time"

	alertDomain "github.com/onetrack/backend/internal/alert/domain"
	"github.com/onetrack/backend/internal/calendar/domain"
)

// Day-before reminder for the Technical Evaluation dates (evaluation, clarification, negotiation,
// reverse auction): on the calendar day before a date, the tender's Account Manager, Reporting
// Manager and Pre-Sales get one "tomorrow" mail. The dedup type carries the date, so an extended
// date reminds again for its new day and the same date never twice.
var techEvalReminderFields = map[string]struct{ code, label string }{
	"bidExtension":   {"BEXT", "Bid Date Extension"},
	"evaluation":     {"EVAL", "Technical Evaluation"},
	"clarification":  {"CLAR", "Technical Clarification"},
	"negotiation":    {"NEGO", "Technical Negotiation"},
	"reverseAuction": {"RA", "Reverse Auction"},
}

func isTechEvalRecipient(sh domain.TenderStakeholder) bool {
	return strings.Contains(sh.Roles, "Account Manager") || strings.Contains(sh.Roles, "Reporting Manager") || strings.Contains(sh.Roles, "Pre-Sales")
}

// remindTechEvalDates returns how many recipients were alerted, never more than budget.
func (s *workingCalendarService) remindTechEvalDates(ctx context.Context, now time.Time, budget int) int {
	dates, err := s.repo.ListTechEvalDates(ctx)
	if err != nil {
		log.Printf("[WorkingCalendar] technical evaluation date lookup failed: %v", err)
		return 0
	}
	rules := map[string]*calRules{}
	sent := 0
	for _, c := range dates {
		if sent >= budget || ctx.Err() != nil {
			break
		}
		f, ok := techEvalReminderFields[c.Field]
		if !ok {
			continue
		}
		key := deref(c.CalendarID)
		r := rules[key]
		if r == nil {
			if r, err = s.loadRules(ctx, key); err != nil {
				log.Printf("[WorkingCalendar] calendar %q unavailable for tender %s: %v", key, c.TenderID, err)
				continue
			}
			rules[key] = r
		}
		if c.Date != now.In(r.loc).AddDate(0, 0, 1).Format("2006-01-02") {
			continue
		}
		day, err := time.ParseInLocation("2006-01-02", c.Date, r.loc)
		if err != nil {
			continue
		}

		title := fmt.Sprintf("⏰ Tomorrow: %s Date — %s", f.label, c.Title)
		message := fmt.Sprintf(`<p><strong>%s Date</strong> for tender <strong>%s</strong> is <strong>tomorrow</strong> (%s).</p>`+
			`<p>Open the Technical Evaluation stage to follow up or extend the date.</p>`,
			html.EscapeString(f.label), html.EscapeString(c.Title), day.Format("02 Jan 2006"))
		out, err := s.notifyStakeholdersWhere(ctx, c.TenderID,
			domain.TaskNotification{NotificationType: fmt.Sprintf("TEVAL_%s_%s", f.code, day.Format("20060102")), ScheduledAt: day, Subject: title, Message: message},
			alertDomain.Alert{Type: "ACTION_REQUIRED", Title: title, Message: message, Link: alertDomain.StageLink(c.TenderID, "TECHNICAL_EVALUATION")},
			false, false, isTechEvalRecipient)
		if err != nil || out.errs > 0 {
			log.Printf("[WorkingCalendar] technical evaluation reminder for tender %s incomplete: %v (%d claim errors)", c.TenderID, err, out.errs)
		}
		sent += len(out.notified)
		if len(out.notified) > 0 && s.systemLog != nil {
			s.systemLog.Record(ctx, "TENDER", "TENDER_TECH_EVAL_REMINDER", "", nil,
				fmt.Sprintf("%s date reminder sent to %d people for tender %s", f.label, len(out.notified), c.Title),
				map[string]interface{}{"tender_id": c.TenderID, "tender_title": c.Title, "field": c.Field, "date": c.Date, "stakeholders": len(out.notified)})
		}
	}
	return sent
}

// remindTechEvalFollowUp initiates automated email triggers to AM/PM/RM if technical
// evaluation or technical clarification lacks timely follow-up (SLA: 24 hours / daily).
func (s *workingCalendarService) remindTechEvalFollowUp(ctx context.Context, now time.Time, budget int) int {
	candidates, err := s.repo.ListTechEvalFollowUpCandidates(ctx)
	if err != nil {
		log.Printf("[WorkingCalendar] technical evaluation follow-up lookup failed: %v", err)
		return 0
	}
	sent := 0
	todayStr := now.Format("20060102")
	for _, c := range candidates {
		if sent >= budget || ctx.Err() != nil {
			break
		}
		var lastTime time.Time
		if c.LastRemarkAt != "" {
			lastTime, _ = time.Parse(time.RFC3339, c.LastRemarkAt)
		} else if c.OpenedAt != "" {
			lastTime, _ = time.Parse(time.RFC3339, c.OpenedAt)
		}
		if lastTime.IsZero() || now.Sub(lastTime).Hours() < 24 {
			continue
		}

		hours := now.Sub(lastTime).Hours()
		title := fmt.Sprintf("⚠️ Follow-up Required: Technical Evaluation — %s", c.Title)
		evalInfo := c.EvalDate
		if evalInfo == "" {
			evalInfo = "Not Set"
		}
		clarInfo := c.ClarDate
		if clarInfo == "" {
			clarInfo = "Not Set"
		}
		extInfo := c.ExtDate
		if extInfo == "" {
			extInfo = "Not Set"
		}
		lastStr := "No daily update recorded"
		if c.LastRemarkAt != "" {
			lastStr = fmt.Sprintf("%.1f hours ago by %s", hours, c.LastRemarkBy)
		}

		message := fmt.Sprintf(
			`<p>Tender <strong>%s</strong> in <strong>Stage 9 (Technical Evaluation)</strong> lacks timely follow-up.</p>`+
				`<p>The Bid Executive has not logged a daily remark update in the last <strong>%.1f hours</strong> (SLA threshold: 24h).</p>`+
				`<ul>`+
				`<li><strong>Technical Evaluation Date:</strong> %s</li>`+
				`<li><strong>Technical Clarification Date:</strong> %s</li>`+
				`<li><strong>Bid Date Extension:</strong> %s</li>`+
				`<li><strong>Last Follow-up:</strong> %s</li>`+
				`</ul>`+
				`<p>Please coordinate with the Bid Executive and follow up with the procuring authority.</p>`,
			html.EscapeString(c.Title), hours, html.EscapeString(evalInfo), html.EscapeString(clarInfo), html.EscapeString(extInfo), html.EscapeString(lastStr),
		)

		out, err := s.notifyStakeholdersWhere(ctx, c.TenderID,
			domain.TaskNotification{
				NotificationType: fmt.Sprintf("TEVAL_FOLLOWUP_%s", todayStr),
				ScheduledAt:      now,
				Subject:          title,
				Message:          message,
			},
			alertDomain.Alert{
				Type:    "ACTION_REQUIRED",
				Title:   title,
				Message: message,
				Link:    alertDomain.StageLink(c.TenderID, "TECHNICAL_EVALUATION"),
			},
			false, false, isTechEvalRecipient)
		if err != nil || out.errs > 0 {
			log.Printf("[WorkingCalendar] follow-up reminder for tender %s incomplete: %v (%d claim errors)", c.TenderID, err, out.errs)
		}
		sent += len(out.notified)
		if len(out.notified) > 0 && s.systemLog != nil {
			s.systemLog.Record(ctx, "TENDER", "TENDER_TECH_EVAL_FOLLOWUP_REMINDER", "", nil,
				fmt.Sprintf("Technical evaluation follow-up reminder sent to %d people for tender %s", len(out.notified), c.Title),
				map[string]interface{}{"tender_id": c.TenderID, "tender_title": c.Title, "hours_since_last": hours, "stakeholders": len(out.notified)})
		}
	}
	return sent
}
