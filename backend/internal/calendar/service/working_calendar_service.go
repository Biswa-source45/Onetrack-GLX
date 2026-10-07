package service

import (
	"context"
	"errors"
	"fmt"
	"html"
	"log"
	"math"
	"strconv"
	"strings"
	"time"

	alertDomain "github.com/onetrack/backend/internal/alert/domain"
	"github.com/onetrack/backend/internal/calendar/domain"
	systemlogDomain "github.com/onetrack/backend/internal/systemlog/domain"
)

const (
	// maxScanDays bounds every day-by-day walk; hitting it is an error, never a guess.
	maxScanDays = 1100
	// maxNotificationsPerTick caps recipients alerted by one evaluation so a bug can never mass-mail.
	maxNotificationsPerTick = 50
)

var errScanLimit = errors.New("working calendar has no working days within the supported range")

type workingCalendarService struct {
	repo      domain.WorkingCalendarRepository
	alertSvc  alertDomain.AlertService
	systemLog systemlogDomain.Recorder
	now       func() time.Time
}

func NewWorkingCalendarService(
	repo domain.WorkingCalendarRepository,
	alertSvc alertDomain.AlertService,
	systemLog systemlogDomain.Recorder,
) domain.WorkingCalendarService {
	return &workingCalendarService{repo: repo, alertSvc: alertSvc, systemLog: systemLog, now: time.Now}
}

// ── Calendar rules (one DB load per calendar per evaluation) ─────────────────

type calRules struct {
	cal        *domain.WorkingCalendar
	loc        *time.Location
	holidays   map[string]domain.Holiday // active holidays by date; first row wins (repo orders by precedence)
	exceptions map[string]string         // date -> exception type
	dayHours   float64                   // working hours in one working day
	startH     int
	startM     int
	endH       int
	endM       int
}

func (s *workingCalendarService) loadRules(ctx context.Context, calendarID string) (*calRules, error) {
	cal, err := s.getCalendar(ctx, calendarID)
	if err != nil {
		return nil, err
	}
	hols, err := s.repo.ListHolidays(ctx, cal.ID, 0)
	if err != nil {
		return nil, err
	}
	excs, err := s.repo.ListExceptions(ctx, cal.ID)
	if err != nil {
		return nil, err
	}

	r := &calRules{
		cal:        cal,
		loc:        calendarLocation(cal),
		holidays:   make(map[string]domain.Holiday, len(hols)),
		exceptions: make(map[string]string, len(excs)),
	}
	for _, h := range hols {
		if _, seen := r.holidays[h.HolidayDate]; !seen && h.IsActive {
			r.holidays[h.HolidayDate] = h
		}
	}
	for _, e := range excs {
		r.exceptions[e.ExceptionDate] = e.ExceptionType
	}
	r.startH, r.startM = parseTimeHM(cal.WorkingStartTime, 9, 0)
	r.endH, r.endM = parseTimeHM(cal.WorkingEndTime, 18, 0)
	r.dayHours = float64((r.endH*60+r.endM)-(r.startH*60+r.startM)) / 60
	if r.dayHours <= 0 {
		r.dayHours = 9
	}
	return r, nil
}

// window returns the working window of the given calendar day.
func (r *calRules) window(d time.Time) (time.Time, time.Time) {
	d = d.In(r.loc)
	return time.Date(d.Year(), d.Month(), d.Day(), r.startH, r.startM, 0, 0, r.loc),
		time.Date(d.Year(), d.Month(), d.Day(), r.endH, r.endM, 0, 0, r.loc)
}

// isWorking classifies one calendar day: exceptions beat holidays, which beat weekday rules.
func (r *calRules) isWorking(date time.Time) (bool, string) {
	d := date.In(r.loc)
	key := d.Format("2006-01-02")

	switch r.exceptions[key] {
	case domain.ExceptionSpecialWorkingDay:
		return true, "Special Working Day Override"
	case domain.ExceptionSpecialNonWorkingDay:
		return false, "Special Non-Working Day"
	}
	if h, ok := r.holidays[key]; ok {
		if h.WorkingStatus == domain.WorkingStatusWorking {
			return true, fmt.Sprintf("Holiday marked Working (%s)", h.HolidayName)
		}
		return false, fmt.Sprintf("Holiday: %s (%s)", h.HolidayName, h.HolidayType)
	}

	c := r.cal
	switch d.Weekday() {
	case time.Sunday:
		if c.SundayWorking {
			return true, "Sunday (Configured Working)"
		}
		return false, "Sunday Holiday"
	case time.Saturday:
		n := saturdayNumber(d)
		working := [...]bool{c.Saturday1Working, c.Saturday2Working, c.Saturday3Working, c.Saturday4Working, c.Saturday5Working}[n-1]
		if working {
			return true, fmt.Sprintf("%s Saturday Working Day", ordinal(n))
		}
		return false, fmt.Sprintf("%s Saturday Holiday", ordinal(n))
	case time.Monday:
		return c.MondayWorking, dayDesc("Monday", c.MondayWorking)
	case time.Tuesday:
		return c.TuesdayWorking, dayDesc("Tuesday", c.TuesdayWorking)
	case time.Wednesday:
		return c.WednesdayWorking, dayDesc("Wednesday", c.WednesdayWorking)
	case time.Thursday:
		return c.ThursdayWorking, dayDesc("Thursday", c.ThursdayWorking)
	default:
		return c.FridayWorking, dayDesc("Friday", c.FridayWorking)
	}
}

// subtractHours walks back through working windows until `hours` of working time is consumed.
func (r *calRules) subtractHours(from time.Time, hours float64) (time.Time, error) {
	if hours <= 0 {
		return from, nil
	}
	remaining := time.Duration(hours * float64(time.Hour))
	curr := from.In(r.loc)

	for i := 0; i < maxScanDays; i++ {
		if ok, _ := r.isWorking(curr); ok {
			start, end := r.window(curr)
			if curr.Before(end) {
				end = curr
			}
			if end.After(start) {
				avail := end.Sub(start)
				if avail >= remaining {
					return end.Add(-remaining), nil
				}
				remaining -= avail
			}
		}
		prev := curr.AddDate(0, 0, -1)
		curr = time.Date(prev.Year(), prev.Month(), prev.Day(), 23, 59, 59, 0, r.loc)
	}
	return time.Time{}, errScanLimit
}

// subtractDays steps back whole working days, keeping the time of day.
func (r *calRules) subtractDays(from time.Time, days int) (time.Time, error) {
	if days <= 0 {
		return from, nil
	}
	curr := from.In(r.loc)
	d := time.Date(curr.Year(), curr.Month(), curr.Day(), 12, 0, 0, 0, r.loc)

	for counted, i := 0, 0; counted < days; i++ {
		if i >= maxScanDays {
			return time.Time{}, errScanLimit
		}
		d = d.AddDate(0, 0, -1)
		if ok, _ := r.isWorking(d); ok {
			counted++
		}
	}
	return time.Date(d.Year(), d.Month(), d.Day(), curr.Hour(), curr.Minute(), curr.Second(), curr.Nanosecond(), r.loc), nil
}

// subtractTime is the single definition of the trigger: value/24 working days
// back (HOURS) or value working days (DAYS), the fractional day in working
// hours. Larger values therefore always give an earlier trigger.
func (r *calRules) subtractTime(from time.Time, value float64, unit string) (time.Time, error) {
	days := domain.TriggerDays(value, unit)
	whole := math.Floor(days + 1e-9)
	frac := days - whole
	if frac < 1e-9 {
		frac = 0
	}
	t, err := r.subtractDays(from, int(whole))
	if err != nil || frac == 0 {
		return t, err
	}
	return r.subtractHours(t, frac*r.dayHours)
}

// remainingHours sums working time between two instants.
func (r *calRules) remainingHours(from, to time.Time) (float64, error) {
	if !to.After(from) {
		return 0, nil
	}
	if to.Sub(from) > maxScanDays*24*time.Hour {
		return 0, errScanLimit
	}
	curr, end := from.In(r.loc), to.In(r.loc)

	var total time.Duration
	for day := time.Date(curr.Year(), curr.Month(), curr.Day(), 0, 0, 0, 0, r.loc); day.Before(end); day = day.AddDate(0, 0, 1) {
		if ok, _ := r.isWorking(day); !ok {
			continue
		}
		start, stop := r.window(day)
		if curr.After(start) {
			start = curr
		}
		if end.Before(stop) {
			stop = end
		}
		if stop.After(start) {
			total += stop.Sub(start)
		}
	}
	return round2(total.Hours()), nil
}

func (r *calRules) remainingDays(hours float64) float64 { return round2(hours / r.dayHours) }

// ── Public calendar maths ────────────────────────────────────────────────────

func (s *workingCalendarService) GetSaturdayNumber(date time.Time) int {
	if date.Weekday() != time.Saturday {
		return 0
	}
	return saturdayNumber(date)
}

func (s *workingCalendarService) IsWorkingDay(ctx context.Context, calendarID string, date time.Time) (bool, string, error) {
	r, err := s.loadRules(ctx, calendarID)
	if err != nil {
		return false, "", err
	}
	ok, reason := r.isWorking(date)
	return ok, reason, nil
}

func (s *workingCalendarService) SubtractWorkingHours(ctx context.Context, calendarID string, from time.Time, hours float64) (time.Time, error) {
	r, err := s.loadRules(ctx, calendarID)
	if err != nil {
		return time.Time{}, err
	}
	return r.subtractHours(from, hours)
}

func (s *workingCalendarService) SubtractWorkingDays(ctx context.Context, calendarID string, from time.Time, days int) (time.Time, error) {
	r, err := s.loadRules(ctx, calendarID)
	if err != nil {
		return time.Time{}, err
	}
	return r.subtractDays(from, days)
}

func (s *workingCalendarService) CalculateRemainingWorkingHours(ctx context.Context, calendarID string, from, to time.Time) (float64, error) {
	r, err := s.loadRules(ctx, calendarID)
	if err != nil {
		return 0, err
	}
	return r.remainingHours(from, to)
}

// CalculateRemainingWorkingDays is remaining working hours / working-day length.
func (s *workingCalendarService) CalculateRemainingWorkingDays(ctx context.Context, calendarID string, from, to time.Time) (float64, error) {
	r, err := s.loadRules(ctx, calendarID)
	if err != nil {
		return 0, err
	}
	h, err := r.remainingHours(from, to)
	if err != nil {
		return 0, err
	}
	return r.remainingDays(h), nil
}

// ── Deadline calculation ─────────────────────────────────────────────────────

type deadlineCalc struct {
	deadline  time.Time
	remHours  float64
	remDays   float64
	triggered bool // now is at/after the trigger and before closing
}

func (s *workingCalendarService) compute(r *calRules, closing time.Time, value float64, unit string, now time.Time) (*deadlineCalc, error) {
	deadline, err := r.subtractTime(closing, value, unit)
	if err != nil {
		return nil, err
	}
	rem, err := r.remainingHours(now, closing)
	if err != nil {
		return nil, err
	}
	return &deadlineCalc{
		deadline:  deadline,
		remHours:  rem,
		remDays:   r.remainingDays(rem),
		triggered: !now.Before(deadline) && now.Before(closing),
	}, nil
}

// trigger returns the calendar's configured trigger, falling back to 72 hours
// when the stored value is missing or no longer valid (e.g. a retired unit).
func trigger(cal *domain.WorkingCalendar) (float64, string) {
	if u, err := domain.ValidateTrigger(cal.DeadlineTriggerValue, cal.DeadlineTriggerUnit); err == nil {
		return cal.DeadlineTriggerValue, u
	}
	return 72, domain.TriggerUnitHours
}

// CalculateTender72HourDeadline computes the configured working deadline for a tender.
func (s *workingCalendarService) CalculateTender72HourDeadline(ctx context.Context, tenderID string) (*domain.CalculateDeadlineResult, error) {
	t, err := s.repo.GetTenderCandidate(ctx, tenderID)
	if err != nil {
		return nil, err
	}
	if t == nil {
		return nil, domain.ErrTenderNotFound
	}
	r, err := s.loadRules(ctx, deref(t.CalendarID))
	if err != nil {
		return nil, err
	}
	v, u := trigger(r.cal)
	res, err := s.deadlineResult(r, t.ClosingDate, v, u)
	if err != nil {
		return nil, err
	}
	res.TenderID, res.TenderTitle = tenderID, t.Title

	if next, err := s.repo.GetNextPendingChecklist(ctx, tenderID); err == nil {
		res.NextAction = next
	}
	if sh, err := s.repo.GetTenderStakeholders(ctx, tenderID); err == nil {
		res.Stakeholders = sh
	}
	s.cacheDeadline(ctx, t, res.CalculatedDeadline, res.RemainingWorkingHours)
	return res, nil
}

func (s *workingCalendarService) CalculateArbitraryDeadline(ctx context.Context, calendarID string, closingDate time.Time, targetHours float64) (*domain.CalculateDeadlineResult, error) {
	return s.CalculateArbitraryDeadlineWithUnit(ctx, calendarID, closingDate, targetHours, domain.TriggerUnitHours)
}

func (s *workingCalendarService) CalculateArbitraryDeadlineWithUnit(ctx context.Context, calendarID string, closingDate time.Time, targetValue float64, targetUnit string) (*domain.CalculateDeadlineResult, error) {
	r, err := s.loadRules(ctx, calendarID)
	if err != nil {
		return nil, err
	}
	if targetValue <= 0 {
		targetValue, targetUnit = 72, domain.TriggerUnitHours
	}
	return s.deadlineResult(r, closingDate, targetValue, targetUnit)
}

func (s *workingCalendarService) deadlineResult(r *calRules, closing time.Time, value float64, unit string) (*domain.CalculateDeadlineResult, error) {
	unit, err := domain.ValidateTrigger(value, unit)
	if err != nil {
		return nil, err
	}
	now := s.now()
	c, err := s.compute(r, closing, value, unit, now)
	if err != nil {
		return nil, err
	}

	targetDays := domain.TriggerDays(value, unit)
	spanned := int(math.Ceil(closing.Sub(c.deadline).Hours() / 24))
	if spanned < 1 {
		spanned = 1
	}

	var skipped []domain.SkippedDateInfo
	endDay := closing.In(r.loc)
	endDay = time.Date(endDay.Year(), endDay.Month(), endDay.Day(), 0, 0, 0, 0, r.loc)
	startDay := c.deadline.In(r.loc)
	for d := time.Date(startDay.Year(), startDay.Month(), startDay.Day(), 0, 0, 0, 0, r.loc); !d.After(endDay); d = d.AddDate(0, 0, 1) {
		if ok, reason := r.isWorking(d); !ok {
			skipped = append(skipped, domain.SkippedDateInfo{Date: d.Format("02-Jan-2006 (Mon)"), Reason: reason})
		}
	}

	start, end := r.window(closing)
	return &domain.CalculateDeadlineResult{
		ClosingDate:           closing,
		TargetWorkingHours:    round2(targetDays * r.dayHours),
		TargetWorkingDays:     int(math.Ceil(targetDays)),
		TargetWorkingValue:    value,
		TargetWorkingUnit:     unit,
		CalculatedDeadline:    c.deadline,
		RemainingWorkingHours: c.remHours,
		RemainingWorkingDays:  c.remDays,
		WorkingDayHours:       r.dayHours,
		CalendarDaysSpanned:   spanned,
		SkippedDates:          skipped,
		IsThresholdReached:    c.triggered,
		CalendarName:          r.cal.Name,
		WorkingIntervals:      []domain.WorkingInterval{{Start: start, End: end}},
	}, nil
}

func (s *workingCalendarService) GetTenderStakeholders(ctx context.Context, tenderID string) ([]domain.TenderStakeholder, error) {
	return s.repo.GetTenderStakeholders(ctx, tenderID)
}

// cacheDeadline refreshes the tender's cached columns only when they changed.
func (s *workingCalendarService) cacheDeadline(ctx context.Context, t *domain.TenderDeadlineCandidate, deadline time.Time, remHours float64) {
	if t.CachedDeadline != nil && t.CachedRemainingHours != nil &&
		t.CachedDeadline.Sub(deadline).Abs() < time.Second &&
		math.Abs(*t.CachedRemainingHours-remHours) < 0.005 {
		return
	}
	if err := s.repo.UpdateTenderDeadlineCache(ctx, t.ID, deadline, remHours); err != nil {
		log.Printf("[WorkingCalendar] failed to cache deadline for tender %s: %v", t.ID, err)
	}
}

// ── Red Zone evaluation ──────────────────────────────────────────────────────

// EvaluateActiveTenders is one engine pass. It is single-flight across
// instances (advisory lock). The first pass ever only records tenders already in
// the window as notified, so enabling the engine never floods stakeholders.
func (s *workingCalendarService) EvaluateActiveTenders(ctx context.Context) (*domain.EvaluationSummary, error) {
	release, ok, err := s.repo.TryLockEvaluation(ctx)
	if err != nil {
		return nil, fmt.Errorf("evaluation lock: %w", err)
	}
	if !ok {
		return &domain.EvaluationSummary{Skipped: true}, nil
	}
	defer release()

	baselined, err := s.repo.IsEngineBaselined(ctx)
	if err != nil {
		return nil, err
	}
	cals, err := s.repo.ListCalendars(ctx)
	if err != nil {
		return nil, err
	}
	maxDays := 0.0
	for _, c := range cals {
		v, u := trigger(&c)
		maxDays = math.Max(maxDays, domain.TriggerDays(v, u))
	}
	// Closing within trigger working days x 7 (weekends) + 14 days of holiday slack.
	now := s.now()
	window := time.Duration(math.Ceil(maxDays)*7+14) * 24 * time.Hour

	tenders, err := s.repo.GetActiveTendersForDeadlineCheck(ctx, now, now.Add(window))
	if err != nil {
		return nil, fmt.Errorf("failed to fetch active tenders for deadline check: %w", err)
	}

	sum := &domain.EvaluationSummary{Baselined: !baselined}
	rules := map[string]*calRules{}
	clean := true

	for i := range tenders {
		t := &tenders[i]
		if ctx.Err() != nil {
			clean = false
			break
		}
		if sum.Notified >= maxNotificationsPerTick {
			log.Printf("[WorkingCalendar] per-run notification cap (%d) reached; remaining tenders wait for the next run", maxNotificationsPerTick)
			break
		}

		key := deref(t.CalendarID)
		r := rules[key]
		if r == nil {
			if r, err = s.loadRules(ctx, key); err != nil {
				log.Printf("[WorkingCalendar] calendar %q unavailable: %v", key, err)
				clean = false
				continue
			}
			rules[key] = r
		}
		v, u := trigger(r.cal)
		c, err := s.compute(r, t.ClosingDate, v, u, now)
		if err != nil {
			log.Printf("[WorkingCalendar] tender %s: %v", t.ID, err)
			continue
		}
		sum.Evaluated++
		s.cacheDeadline(ctx, t, c.deadline, c.remHours)
		if !c.triggered {
			continue
		}
		sum.InRedZone++

		sent, err := s.repo.HasRedZoneNotificationBeenSent(ctx, t.ID, c.deadline)
		if err != nil {
			log.Printf("[WorkingCalendar] tender %s dedup check failed: %v", t.ID, err)
			clean = false
			continue
		}
		if sent {
			continue
		}
		out, err := s.notifyTender(ctx, t, r, c, v, u, false, !baselined)
		if err != nil || out.errs > 0 {
			log.Printf("[WorkingCalendar] tender %s notification incomplete: %v (%d claim errors)", t.ID, err, out.errs)
			clean = false
		}
		sum.Notified += len(out.notified)
	}

	if !baselined && clean {
		if err := s.repo.MarkEngineBaselined(ctx); err != nil {
			return sum, err
		}
		log.Printf("[WorkingCalendar] engine baselined: %d in-window tenders recorded without notifying", sum.InRedZone)
	}
	return sum, nil
}

func (s *workingCalendarService) TriggerRedZoneNotificationForTender(ctx context.Context, tenderID string, force bool) (*domain.RedZoneNotificationResult, error) {
	t, err := s.repo.GetTenderCandidate(ctx, tenderID)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch tender: %w", err)
	}
	if t == nil {
		return nil, domain.ErrTenderNotFound
	}
	r, err := s.loadRules(ctx, deref(t.CalendarID))
	if err != nil {
		return nil, fmt.Errorf("failed to get calendar: %w", err)
	}
	now := s.now()
	v, u := trigger(r.cal)
	c, err := s.compute(r, t.ClosingDate, v, u, now)
	if err != nil {
		return nil, fmt.Errorf("failed to compute tender deadline: %w", err)
	}
	s.cacheDeadline(ctx, t, c.deadline, c.remHours)

	res := &domain.RedZoneNotificationResult{
		TenderID:              t.ID,
		TenderTitle:           t.Title,
		ClosingDate:           t.ClosingDate,
		Calculated72hDeadline: c.deadline,
		RemainingWorkingHours: c.remHours,
		RemainingWorkingDays:  c.remDays,
		TriggeredAt:           now,
	}
	if !c.triggered {
		res.DeliveryStatus = "NOT_IN_RED_ZONE"
		res.Message = fmt.Sprintf("Tender is not in the red zone (trigger: %s before closing)", thresholdLabel(v, u))
		return res, nil
	}
	if !force {
		sent, err := s.repo.HasRedZoneNotificationBeenSent(ctx, t.ID, c.deadline)
		if err != nil {
			return nil, fmt.Errorf("failed to check previous notifications: %w", err)
		}
		if sent {
			res.DeliveryStatus = "ALREADY_SENT"
			res.Message = "Red Zone notification was already sent to stakeholders for this deadline"
			return res, nil
		}
	}

	out, err := s.notifyTender(ctx, t, r, c, v, u, force, false)
	if err != nil {
		return nil, err
	}
	res.StakeholdersNotified = out.notified
	switch {
	case len(out.notified) > 0:
		res.DeliveryStatus = "SENT"
		res.Message = fmt.Sprintf("Red Zone notification sent to %d stakeholders", len(out.notified))
	case out.failed > 0 || out.errs > 0:
		res.DeliveryStatus = "FAILED"
		res.Message = "Red Zone notification could not be delivered; see server logs"
	default:
		res.DeliveryStatus = "ALREADY_SENT"
		res.Message = "Red Zone notification was already sent to stakeholders for this deadline"
	}
	return res, nil
}

type notifyOutcome struct {
	notified []domain.TenderStakeholder
	failed   int // claimed but the alert could not be created
	errs     int // claim itself failed; nothing was sent for that recipient
}

// notifyTender alerts every stakeholder once through the alert service
// (in-app + email). Each recipient is claimed in the dedup table first and
// only alerted if the claim succeeded; in baseline mode it claims and never sends.
func (s *workingCalendarService) notifyTender(
	ctx context.Context,
	t *domain.TenderDeadlineCandidate,
	r *calRules,
	c *deadlineCalc,
	value float64,
	unit string,
	force, baseline bool,
) (notifyOutcome, error) {
	var out notifyOutcome
	stakeholders, err := s.repo.GetTenderStakeholders(ctx, t.ID)
	if err != nil {
		return out, fmt.Errorf("stakeholders: %w", err)
	}

	next, err := s.repo.GetNextPendingChecklist(ctx, t.ID)
	if err != nil {
		log.Printf("[WorkingCalendar] next checklist lookup failed for %s: %v", t.ID, err)
	}
	label := thresholdLabel(value, unit)
	title, message := redZoneAlert(t, r, c, label, next)
	subject, body := title, message
	if baseline {
		subject = "Baseline: tender was already in its red zone when the deadline engine was enabled"
		body = subject
	}

	for _, sh := range stakeholders {
		role := sh.Roles
		id, err := s.repo.ClaimNotification(ctx, &domain.TaskNotification{
			TenderID:         t.ID,
			RecipientUserID:  sh.UserID,
			RecipientRole:    &role,
			NotificationType: domain.NotificationTypeRedZoneDueDate,
			ScheduledAt:      c.deadline,
			Subject:          subject,
			Message:          body,
		}, force)
		if err != nil {
			log.Printf("[WorkingCalendar] claim failed for tender %s user %s: %v", t.ID, sh.UserID, err)
			out.errs++
			continue
		}
		if id == "" || baseline {
			continue
		}

		userID, tenderID := sh.UserID, t.ID
		if err := s.alertSvc.CreateAlert(ctx, &alertDomain.Alert{
			UserID:  &userID,
			BidID:   &tenderID,
			Type:    "TENDER",
			Title:   title,
			Message: message,
			Link:    alertDomain.TenderLink(t.ID),
		}); err != nil {
			log.Printf("[WorkingCalendar] alert failed for tender %s user %s: %v", t.ID, sh.UserID, err)
			if ferr := s.repo.FailNotification(ctx, id, err.Error()); ferr != nil {
				log.Printf("[WorkingCalendar] could not flag notification %s failed: %v", id, ferr)
			}
			out.failed++
			continue
		}
		out.notified = append(out.notified, sh)
	}

	if len(out.notified) > 0 && s.systemLog != nil {
		s.systemLog.Record(ctx, "TENDER", "TENDER_RED_ZONE_NOTIFIED", "", nil,
			fmt.Sprintf("Red Zone (%s) notification sent to %d stakeholders for tender %s", label, len(out.notified), t.Title),
			map[string]interface{}{
				"tender_id":       t.ID,
				"tender_title":    t.Title,
				"threshold":       label,
				"stakeholders":    len(out.notified),
				"remaining_days":  c.remDays,
				"remaining_hours": c.remHours,
				"deadline":        c.deadline.Format(time.RFC3339),
			},
		)
	}
	return out, nil
}

// redZoneAlert builds the alert title and its HTML body (alerts render HTML);
// every interpolated value is escaped.
func redZoneAlert(t *domain.TenderDeadlineCandidate, r *calRules, c *deadlineCalc, label string, next *domain.NextActionableTask) (string, string) {
	ref := t.Title
	if t.GemBidNo != nil && *t.GemBidNo != "" {
		ref = *t.GemBidNo
	} else if t.BidNo != nil && *t.BidNo != "" {
		ref = *t.BidNo
	}
	authority := deref(t.OrganizationName)
	if d := deref(t.DepartmentName); d != "" {
		authority += " (" + d + ")"
	}
	if authority == "" {
		authority = "—"
	}
	nextTask := "Review tender documents and checklist requirements"
	if next != nil {
		who := "unassigned"
		if next.AssignedToName != nil && *next.AssignedToName != "" {
			who = *next.AssignedToName
		}
		nextTask = fmt.Sprintf("%s [%s priority] — %s", next.Title, next.Priority, who)
	}
	e := html.EscapeString
	const stamp = "02-Jan-2006 15:04 MST"

	title := fmt.Sprintf("🚨 RED ZONE: %s left — %s", label, t.Title)
	message := fmt.Sprintf(
		`<p>Tender <strong>%s</strong> (Ref: %s) is inside its red zone: %s of working time remain before the closing date. Immediate action is required on the pending checklist items.</p>`+
			`<p>Closing: <strong>%s</strong><br/>Trigger time: %s<br/>Remaining: <strong>%.1f working days</strong> (%.1f working hours)<br/>Stage: %s<br/>Procuring authority: %s<br/>Next task: %s</p>`+
			`<p style="color:#64748b;font-size:12px;">Working time excludes non-working Saturdays, Sundays, holidays and special non-working days of the %s calendar.</p>`,
		e(t.Title), e(ref), e(label),
		e(t.ClosingDate.In(r.loc).Format(stamp)), e(c.deadline.In(r.loc).Format(stamp)),
		c.remDays, c.remHours, e(t.WorkflowStage), e(authority), e(nextTask), e(r.cal.Name),
	)
	return title, message
}

// ── Helpers ──────────────────────────────────────────────────────────────────

// thresholdLabel describes a trigger from its value and unit, e.g. "3 working days (72h)".
func thresholdLabel(value float64, unit string) string {
	days := domain.TriggerDays(value, unit)
	word := "working days"
	if days == 1 {
		word = "working day"
	}
	if unit == domain.TriggerUnitHours {
		return fmt.Sprintf("%s %s (%sh)", fmtNum(days), word, fmtNum(value))
	}
	return fmt.Sprintf("%s %s", fmtNum(days), word)
}

func fmtNum(v float64) string { return strconv.FormatFloat(math.Round(v*10)/10, 'f', -1, 64) }

func round2(v float64) float64 { return math.Round(v*100) / 100 }

func deref(p *string) string {
	if p == nil {
		return ""
	}
	return *p
}

func (s *workingCalendarService) getCalendar(ctx context.Context, calendarID string) (*domain.WorkingCalendar, error) {
	if calendarID != "" {
		if cal, err := s.repo.GetCalendarByID(ctx, calendarID); err == nil && cal != nil {
			return cal, nil
		}
	}
	cal, err := s.repo.GetDefaultCalendar(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to retrieve default calendar: %w", err)
	}
	if cal == nil {
		return nil, fmt.Errorf("no default working calendar found")
	}
	return cal, nil
}

func calendarLocation(cal *domain.WorkingCalendar) *time.Location {
	tz := "Asia/Kolkata"
	if cal != nil && cal.Timezone != "" {
		tz = cal.Timezone
	}
	loc, err := time.LoadLocation(tz)
	if err != nil {
		return time.FixedZone("IST", 5*3600+1800)
	}
	return loc
}

func parseTimeHM(str string, defH, defM int) (int, int) {
	parts := strings.Split(strings.TrimSpace(str), ":")
	if len(parts) != 2 {
		return defH, defM
	}
	h, err := strconv.Atoi(parts[0])
	if err != nil {
		return defH, defM
	}
	m, err := strconv.Atoi(parts[1])
	if err != nil {
		return defH, defM
	}
	return h, m
}

// saturdayNumber is the 1-based position of a Saturday within its month.
func saturdayNumber(d time.Time) int { return (d.Day()-1)/7 + 1 }

func ordinal(n int) string {
	switch n {
	case 1:
		return "1st"
	case 2:
		return "2nd"
	case 3:
		return "3rd"
	default:
		return fmt.Sprintf("%dth", n)
	}
}

func dayDesc(dayName string, isWorking bool) string {
	if isWorking {
		return fmt.Sprintf("%s Working Day", dayName)
	}
	return fmt.Sprintf("%s Holiday / Non-Working", dayName)
}
