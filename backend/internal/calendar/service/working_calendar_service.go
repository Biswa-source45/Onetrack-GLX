package service

import (
	"context"
	"fmt"
	"log"
	"math"
	"strconv"
	"strings"
	"time"

	alertDomain "github.com/onetrack/backend/internal/alert/domain"
	"github.com/onetrack/backend/internal/calendar/domain"
	emailService "github.com/onetrack/backend/internal/platform/email"
	systemlogDomain "github.com/onetrack/backend/internal/systemlog/domain"
)

type workingCalendarService struct {
	repo      domain.WorkingCalendarRepository
	alertSvc  alertDomain.AlertService
	emailSvc  *emailService.EmailService
	systemLog systemlogDomain.Recorder
}

func NewWorkingCalendarService(
	repo domain.WorkingCalendarRepository,
	alertSvc alertDomain.AlertService,
	emailSvc *emailService.EmailService,
	systemLog systemlogDomain.Recorder,
) domain.WorkingCalendarService {
	return &workingCalendarService{
		repo:      repo,
		alertSvc:  alertSvc,
		emailSvc:  emailSvc,
		systemLog: systemLog,
	}
}

// ── Saturday Helper (Section 8) ──────────────────────────────────────────────

// GetSaturdayNumber returns 1, 2, 3, 4, or 5 indicating which Saturday of the month it is.
func (s *workingCalendarService) GetSaturdayNumber(date time.Time) int {
	if date.Weekday() != time.Saturday {
		return 0
	}
	day := date.Day()
	return (day-1)/7 + 1
}

// IsSaturdayHoliday checks Saturday rules dynamically based on calendar configuration.
// By default: 1st, 3rd, 5th Saturday are WORKING; 2nd and 4th Saturday are NON_WORKING / HOLIDAY.
func (s *workingCalendarService) IsSaturdayHoliday(calendar *domain.WorkingCalendar, date time.Time) bool {
	if date.Weekday() != time.Saturday {
		return false
	}
	satNum := s.GetSaturdayNumber(date)
	switch satNum {
	case 1:
		return !calendar.Saturday1Working
	case 2:
		return !calendar.Saturday2Working // Default false -> is holiday
	case 3:
		return !calendar.Saturday3Working
	case 4:
		return !calendar.Saturday4Working // Default false -> is holiday
	case 5:
		return !calendar.Saturday5Working
	default:
		return false
	}
}

// ── Exception Helpers (Section 9) ────────────────────────────────────────────

func (s *workingCalendarService) IsSpecialWorkingDay(ctx context.Context, calendarID string, date time.Time) (bool, error) {
	dateStr := date.Format("2006-01-02")
	exc, err := s.repo.GetExceptionByDate(ctx, calendarID, dateStr)
	if err != nil {
		return false, err
	}
	if exc != nil && exc.ExceptionType == domain.ExceptionSpecialWorkingDay {
		return true, nil
	}
	return false, nil
}

func (s *workingCalendarService) IsSpecialNonWorkingDay(ctx context.Context, calendarID string, date time.Time) (bool, error) {
	dateStr := date.Format("2006-01-02")
	exc, err := s.repo.GetExceptionByDate(ctx, calendarID, dateStr)
	if err != nil {
		return false, err
	}
	if exc != nil && exc.ExceptionType == domain.ExceptionSpecialNonWorkingDay {
		return true, nil
	}
	return false, nil
}

// ── Holiday Helper (Section 5 & 6) ───────────────────────────────────────────

func (s *workingCalendarService) IsHoliday(ctx context.Context, calendarID string, date time.Time) (bool, *domain.Holiday, error) {
	dateStr := date.Format("2006-01-02")
	h, err := s.repo.GetHolidayByDate(ctx, calendarID, dateStr)
	if err != nil {
		return false, nil, err
	}
	if h != nil && h.IsActive {
		return true, h, nil
	}
	return false, nil, nil
}

// ── Working Day Determination (Sections 7, 8, 9, 10) ─────────────────────────

// IsWorkingDay determines whether a specific date is working or non-working and returns the reason.
func (s *workingCalendarService) IsWorkingDay(ctx context.Context, calendarID string, date time.Time) (bool, string, error) {
	// 1. Date-specific exception overrides EVERYTHING
	isSpecialWorking, err := s.IsSpecialWorkingDay(ctx, calendarID, date)
	if err != nil {
		return false, "", err
	}
	if isSpecialWorking {
		return true, "Special Working Day Override", nil
	}

	isSpecialNonWorking, err := s.IsSpecialNonWorkingDay(ctx, calendarID, date)
	if err != nil {
		return false, "", err
	}
	if isSpecialNonWorking {
		return false, "Special Non-Working Day", nil
	}

	// 2. Check internal Holiday database
	isHol, holiday, err := s.IsHoliday(ctx, calendarID, date)
	if err != nil {
		return false, "", err
	}
	if isHol && holiday != nil {
		if holiday.WorkingStatus == domain.WorkingStatusWorking {
			return true, fmt.Sprintf("Holiday marked Working (%s)", holiday.HolidayName), nil
		}
		return false, fmt.Sprintf("Holiday: %s (%s)", holiday.HolidayName, holiday.HolidayType), nil
	}

	// 3. Calendar Day-of-Week Rules
	cal, err := s.getCalendar(ctx, calendarID)
	if err != nil {
		return false, "", err
	}

	switch date.Weekday() {
	case time.Sunday:
		if cal.SundayWorking {
			return true, "Sunday (Configured Working)", nil
		}
		return false, "Sunday Holiday", nil

	case time.Saturday:
		satNum := s.GetSaturdayNumber(date)
		if s.IsSaturdayHoliday(cal, date) {
			return false, fmt.Sprintf("%s Saturday Holiday", ordinal(satNum)), nil
		}
		return true, fmt.Sprintf("%s Saturday Working Day", ordinal(satNum)), nil

	case time.Monday:
		return cal.MondayWorking, dayDesc("Monday", cal.MondayWorking), nil
	case time.Tuesday:
		return cal.TuesdayWorking, dayDesc("Tuesday", cal.TuesdayWorking), nil
	case time.Wednesday:
		return cal.WednesdayWorking, dayDesc("Wednesday", cal.WednesdayWorking), nil
	case time.Thursday:
		return cal.ThursdayWorking, dayDesc("Thursday", cal.ThursdayWorking), nil
	case time.Friday:
		return cal.FridayWorking, dayDesc("Friday", cal.FridayWorking), nil
	default:
		return false, "Unknown day", nil
	}
}

// ── Working Intervals Helper ─────────────────────────────────────────────────

func (s *workingCalendarService) GetWorkingIntervals(calendar *domain.WorkingCalendar, date time.Time) []domain.WorkingInterval {
	loc := s.getCalendarLocation(calendar)
	d := date.In(loc)

	startHour, startMin := parseTimeHM(calendar.WorkingStartTime, 9, 0)
	endHour, endMin := parseTimeHM(calendar.WorkingEndTime, 18, 0)

	start := time.Date(d.Year(), d.Month(), d.Day(), startHour, startMin, 0, 0, loc)
	end := time.Date(d.Year(), d.Month(), d.Day(), endHour, endMin, 0, 0, loc)

	if end.Before(start) {
		end = start
	}

	return []domain.WorkingInterval{
		{Start: start, End: end},
	}
}

// ── Working Hours Calculations Engine (Sections 10, 12, 13) ──────────────────

// SubtractWorkingHours moves backward through working intervals, skipping non-working days
// and non-working hours, until exactly `hours` working hours have been accumulated.
func (s *workingCalendarService) SubtractWorkingHours(
	ctx context.Context,
	calendarID string,
	fromTime time.Time,
	hours float64,
) (time.Time, error) {
	if hours <= 0 {
		return fromTime, nil
	}

	cal, err := s.getCalendar(ctx, calendarID)
	if err != nil {
		return time.Time{}, err
	}
	loc := s.getCalendarLocation(cal)
	curr := fromTime.In(loc)

	remainingSeconds := hours * 3600.0

	// Limit search to 365 days back to prevent infinite loops
	maxDays := 365

	for dayOffset := 0; dayOffset < maxDays && remainingSeconds > 0; dayOffset++ {
		isWork, _, err := s.IsWorkingDay(ctx, cal.ID, curr)
		if err != nil {
			return time.Time{}, err
		}

		if isWork {
			intervals := s.GetWorkingIntervals(cal, curr)
			for i := len(intervals) - 1; i >= 0 && remainingSeconds > 0; i-- {
				interval := intervals[i]

				// Effective end of working time on this day
				effEnd := interval.End
				if curr.Before(effEnd) {
					effEnd = curr
				}

				effStart := interval.Start

				if effEnd.After(effStart) {
					availableSeconds := effEnd.Sub(effStart).Seconds()
					if availableSeconds >= remainingSeconds {
						// Found exact target timestamp
						target := effEnd.Add(-time.Duration(remainingSeconds * float64(time.Second)))
						return target, nil
					}
					remainingSeconds -= availableSeconds
					curr = effStart
				}
			}
		}

		// Move curr to end of previous day in calendar's timezone
		prevDay := curr.AddDate(0, 0, -1)
		curr = time.Date(prevDay.Year(), prevDay.Month(), prevDay.Day(), 23, 59, 59, 0, loc)
	}

	return curr, nil
}

// AddWorkingHours moves forward through working intervals, accumulating working hours.
func (s *workingCalendarService) AddWorkingHours(
	ctx context.Context,
	calendarID string,
	fromTime time.Time,
	hours float64,
) (time.Time, error) {
	if hours <= 0 {
		return fromTime, nil
	}

	cal, err := s.getCalendar(ctx, calendarID)
	if err != nil {
		return time.Time{}, err
	}
	loc := s.getCalendarLocation(cal)
	curr := fromTime.In(loc)

	remainingSeconds := hours * 3600.0
	maxDays := 365

	for dayOffset := 0; dayOffset < maxDays && remainingSeconds > 0; dayOffset++ {
		isWork, _, err := s.IsWorkingDay(ctx, cal.ID, curr)
		if err != nil {
			return time.Time{}, err
		}

		if isWork {
			intervals := s.GetWorkingIntervals(cal, curr)
			for _, interval := range intervals {
				effStart := interval.Start
				if curr.After(effStart) {
					effStart = curr
				}

				effEnd := interval.End

				if effStart.Before(effEnd) {
					availableSeconds := effEnd.Sub(effStart).Seconds()
					if availableSeconds >= remainingSeconds {
						target := effStart.Add(time.Duration(remainingSeconds * float64(time.Second)))
						return target, nil
					}
					remainingSeconds -= availableSeconds
					curr = effEnd
				}
			}
		}

		// Move to start of next day
		nextDay := curr.AddDate(0, 0, 1)
		curr = time.Date(nextDay.Year(), nextDay.Month(), nextDay.Day(), 0, 0, 0, 0, loc)
	}

	return curr, nil
}

// CalculateRemainingWorkingHours calculates total working hours between fromTime and toTime.
func (s *workingCalendarService) CalculateRemainingWorkingHours(
	ctx context.Context,
	calendarID string,
	fromTime, toTime time.Time,
) (float64, error) {
	if !toTime.After(fromTime) {
		return 0, nil
	}

	cal, err := s.getCalendar(ctx, calendarID)
	if err != nil {
		return 0, err
	}
	loc := s.getCalendarLocation(cal)

	curr := fromTime.In(loc)
	end := toTime.In(loc)

	totalSeconds := 0.0
	maxDays := 365

	for dayOffset := 0; dayOffset < maxDays && curr.Before(end); dayOffset++ {
		isWork, _, err := s.IsWorkingDay(ctx, cal.ID, curr)
		if err != nil {
			return 0, err
		}

		if isWork {
			intervals := s.GetWorkingIntervals(cal, curr)
			for _, interval := range intervals {
				intStart := interval.Start
				if curr.After(intStart) {
					intStart = curr
				}

				intEnd := interval.End
				if end.Before(intEnd) {
					intEnd = end
				}

				if intStart.Before(intEnd) {
					totalSeconds += intEnd.Sub(intStart).Seconds()
				}
			}
		}

		nextDay := curr.AddDate(0, 0, 1)
		curr = time.Date(nextDay.Year(), nextDay.Month(), nextDay.Day(), 0, 0, 0, 0, loc)
	}

	return math.Round((totalSeconds/3600.0)*100) / 100, nil
}

// ── Working Days Calculations Engine ──────────────────────────────────────────

// AddWorkingDays moves forward by working days, skipping non-working days
// (2nd/4th Saturdays, Sundays, configured holidays, and calendar exceptions).
func (s *workingCalendarService) AddWorkingDays(
	ctx context.Context,
	calendarID string,
	fromTime time.Time,
	days int,
) (time.Time, error) {
	if days <= 0 {
		return fromTime, nil
	}

	cal, err := s.getCalendar(ctx, calendarID)
	if err != nil {
		return time.Time{}, err
	}
	loc := s.getCalendarLocation(cal)
	curr := fromTime.In(loc)

	hour, min, sec := curr.Hour(), curr.Minute(), curr.Second()
	nsec := curr.Nanosecond()

	daysCounted := 0
	testDate := time.Date(curr.Year(), curr.Month(), curr.Day(), 12, 0, 0, 0, loc)

	for i := 0; i < 365 && daysCounted < days; i++ {
		testDate = testDate.AddDate(0, 0, 1)
		isWork, _, err := s.IsWorkingDay(ctx, cal.ID, testDate)
		if err != nil {
			return time.Time{}, err
		}
		if isWork {
			daysCounted++
		}
	}

	target := time.Date(testDate.Year(), testDate.Month(), testDate.Day(), hour, min, sec, nsec, loc)
	return target, nil
}

// SubtractWorkingDays moves backward by working days, skipping non-working days
// (2nd/4th Saturdays, Sundays, configured holidays, and calendar exceptions).
func (s *workingCalendarService) SubtractWorkingDays(
	ctx context.Context,
	calendarID string,
	fromTime time.Time,
	days int,
) (time.Time, error) {
	if days <= 0 {
		return fromTime, nil
	}

	cal, err := s.getCalendar(ctx, calendarID)
	if err != nil {
		return time.Time{}, err
	}
	loc := s.getCalendarLocation(cal)
	curr := fromTime.In(loc)

	hour, min, sec := curr.Hour(), curr.Minute(), curr.Second()
	nsec := curr.Nanosecond()

	daysCounted := 0
	testDate := time.Date(curr.Year(), curr.Month(), curr.Day(), 12, 0, 0, 0, loc)

	for i := 0; i < 365 && daysCounted < days; i++ {
		testDate = testDate.AddDate(0, 0, -1)
		isWork, _, err := s.IsWorkingDay(ctx, cal.ID, testDate)
		if err != nil {
			return time.Time{}, err
		}
		if isWork {
			daysCounted++
		}
	}

	target := time.Date(testDate.Year(), testDate.Month(), testDate.Day(), hour, min, sec, nsec, loc)
	return target, nil
}

// CalculateRemainingWorkingDays calculates total working days between fromTime and toTime.
func (s *workingCalendarService) CalculateRemainingWorkingDays(
	ctx context.Context,
	calendarID string,
	fromTime, toTime time.Time,
) (float64, error) {
	if !toTime.After(fromTime) {
		return 0, nil
	}

	cal, err := s.getCalendar(ctx, calendarID)
	if err != nil {
		return 0, err
	}
	loc := s.getCalendarLocation(cal)

	curr := fromTime.In(loc)
	end := toTime.In(loc)

	totalDays := 0.0
	maxDays := 365

	startDay := time.Date(curr.Year(), curr.Month(), curr.Day(), 0, 0, 0, 0, loc)
	endDay := time.Date(end.Year(), end.Month(), end.Day(), 0, 0, 0, 0, loc)

	for d := startDay; !d.After(endDay) && maxDays > 0; d = d.AddDate(0, 0, 1) {
		maxDays--
		isWork, _, err := s.IsWorkingDay(ctx, cal.ID, d)
		if err != nil {
			return 0, err
		}
		if !isWork {
			continue
		}

		dayStart := d
		dayEnd := d.AddDate(0, 0, 1)

		overlapStart := curr
		if overlapStart.Before(dayStart) {
			overlapStart = dayStart
		}

		overlapEnd := end
		if overlapEnd.After(dayEnd) {
			overlapEnd = dayEnd
		}

		if overlapStart.Before(overlapEnd) {
			totalDays += overlapEnd.Sub(overlapStart).Hours() / 24.0
		}
	}

	return math.Round(totalDays*100) / 100, nil
}

// CalculateTender72HourDeadline computes the exact 3 working-day (72h) deadline for a tender.
func (s *workingCalendarService) CalculateTender72HourDeadline(
	ctx context.Context,
	tenderID string,
) (*domain.CalculateDeadlineResult, error) {
	// Look up tender details
	candidate, err := s.findTenderCandidate(ctx, tenderID)
	if err != nil {
		return nil, err
	}
	if candidate == nil {
		return nil, fmt.Errorf("tender %s not found or has no closing date", tenderID)
	}

	calendarID := ""
	if candidate.CalendarID != nil {
		calendarID = *candidate.CalendarID
	}

	res, err := s.CalculateArbitraryDeadline(ctx, calendarID, candidate.ClosingDate, 72.0)
	if err != nil {
		return nil, err
	}
	res.TenderID = tenderID
	res.TenderTitle = candidate.Title

	// Identify next actionable task
	nextTask, err := s.repo.GetNextPendingChecklist(ctx, tenderID)
	if err == nil && nextTask != nil {
		res.NextAction = nextTask
	}

	// Fetch all stakeholders involved in this tender
	stakeholders, err := s.repo.GetTenderStakeholders(ctx, tenderID)
	if err == nil {
		res.Stakeholders = stakeholders
	}

	// Cache calculation in tender record
	_ = s.repo.UpdateTenderDeadlineCache(ctx, tenderID, res.CalculatedDeadline, res.RemainingWorkingHours)

	return res, nil
}

func (s *workingCalendarService) CalculateArbitraryDeadline(
	ctx context.Context,
	calendarID string,
	closingDate time.Time,
	targetHours float64,
) (*domain.CalculateDeadlineResult, error) {
	cal, err := s.getCalendar(ctx, calendarID)
	if err != nil {
		return nil, err
	}

	// 72 hours means 3 working days. Calculate target working days:
	targetDays := int(math.Round(targetHours / 24.0))
	if targetHours <= 10.0 && targetHours > 0 {
		targetDays = int(targetHours)
	}
	if targetDays < 1 {
		targetDays = 1
	}

	deadline, err := s.SubtractWorkingDays(ctx, cal.ID, closingDate, targetDays)
	if err != nil {
		return nil, err
	}

	now := time.Now().In(s.getCalendarLocation(cal))
	remDays, err := s.CalculateRemainingWorkingDays(ctx, cal.ID, now, closingDate)
	if err != nil {
		return nil, err
	}
	remHours := remDays * 24.0

	isReached := !now.Before(deadline) && now.Before(closingDate)

	// Calculate calendar days spanned
	daysSpanned := int(math.Ceil(closingDate.Sub(deadline).Hours() / 24.0))
	if daysSpanned < 1 {
		daysSpanned = 1
	}

	// Collect skipped non-working dates between deadline and closingDate
	loc := s.getCalendarLocation(cal)
	startDay := time.Date(deadline.Year(), deadline.Month(), deadline.Day(), 0, 0, 0, 0, loc)
	endDay := time.Date(closingDate.Year(), closingDate.Month(), closingDate.Day(), 0, 0, 0, 0, loc)

	var skippedDates []domain.SkippedDateInfo
	for d := startDay; !d.After(endDay); d = d.AddDate(0, 0, 1) {
		isWork, reason, _ := s.IsWorkingDay(ctx, cal.ID, d)
		if !isWork {
			skippedDates = append(skippedDates, domain.SkippedDateInfo{
				Date:   d.Format("02-Jan-2006 (Mon)"),
				Reason: reason,
			})
		}
	}

	return &domain.CalculateDeadlineResult{
		ClosingDate:           closingDate,
		TargetWorkingHours:    float64(targetDays * 24),
		TargetWorkingDays:     targetDays,
		CalculatedDeadline:    deadline,
		RemainingWorkingHours: remHours,
		RemainingWorkingDays:  remDays,
		CalendarDaysSpanned:   daysSpanned,
		SkippedDates:          skippedDates,
		IsThresholdReached:    isReached,
		CalendarName:          cal.Name,
		WorkingIntervals:      s.GetWorkingIntervals(cal, closingDate),
	}, nil
}

func (s *workingCalendarService) GetNextActionableTask(ctx context.Context, tenderID string) (*domain.NextActionableTask, error) {
	return s.repo.GetNextPendingChecklist(ctx, tenderID)
}

func (s *workingCalendarService) GetTenderStakeholders(ctx context.Context, tenderID string) ([]domain.TenderStakeholder, error) {
	return s.repo.GetTenderStakeholders(ctx, tenderID)
}

func (s *workingCalendarService) EvaluateActiveTenders(ctx context.Context) error {
	tenders, err := s.repo.GetActiveTendersForDeadlineCheck(ctx)
	if err != nil {
		return fmt.Errorf("failed to fetch active tenders for deadline check: %w", err)
	}

	for _, t := range tenders {
		calID := ""
		if t.CalendarID != nil {
			calID = *t.CalendarID
		}

		cal, err := s.getCalendar(ctx, calID)
		if err != nil {
			continue
		}

		now := time.Now().In(s.getCalendarLocation(cal))
		remDays, err := s.CalculateRemainingWorkingDays(ctx, cal.ID, now, t.ClosingDate)
		if err != nil {
			continue
		}
		remHours := remDays * 24.0

		// Calculate 3 working days backward from tender closing date (72 hours = 3 working days)
		deadline, err := s.SubtractWorkingDays(ctx, cal.ID, t.ClosingDate, 3)
		if err != nil {
			continue
		}

		// Update cache so UI displays live remaining working days/hours and 3-day threshold
		_ = s.repo.UpdateTenderDeadlineCache(ctx, t.ID, deadline, remHours)

		// Check if 3 working-day threshold is reached (remDays <= 3.0 or !now.Before(deadline))
		if (!now.Before(deadline) || remDays <= 3.0) && now.Before(t.ClosingDate) {
			// 1. Red Zone – Tender Due Date Notification:
			// Trigger an email notification to all respective stakeholders 3 working days before tender due date.
			// Pass the calculated deadline so extended/updated tender deadlines trigger afresh.
			sent, _ := s.repo.HasRedZoneNotificationBeenSent(ctx, t.ID, deadline)
			if !sent {
				_, _ = s.sendRedZoneTenderDueDateNotification(ctx, t, deadline, remDays, remHours)
			}

			// 2. Delay & Escalation Detection for next actionable task
			nextTask, err := s.repo.GetNextPendingChecklist(ctx, t.ID)
			if err == nil && nextTask != nil {
				delayThresholdHours := float64(cal.EscalationDelayHours)
				if delayThresholdHours <= 0 {
					delayThresholdHours = 4.0
				}

				delayTime := deadline.Add(time.Duration(delayThresholdHours * float64(time.Hour)))
				if now.After(delayTime) && nextTask.Status != domain.TaskStatusCompleted {
					_ = s.repo.MarkChecklistDelayed(ctx, nextTask.ChecklistID)

					escSent, _ := s.repo.HasEscalationBeenSent(ctx, t.ID, &nextTask.ChecklistID)
					if !escSent {
						s.sendEscalationNotification(ctx, t, nextTask, delayThresholdHours)
					}
				}
			}
		}
	}

	return nil
}

func (s *workingCalendarService) TriggerRedZoneNotificationForTender(
	ctx context.Context,
	tenderID string,
	force bool,
) (*domain.RedZoneNotificationResult, error) {
	candidate, err := s.findTenderCandidate(ctx, tenderID)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch tender: %w", err)
	}
	if candidate == nil {
		return nil, fmt.Errorf("tender %s not found or has no closing date", tenderID)
	}

	calID := ""
	if candidate.CalendarID != nil {
		calID = *candidate.CalendarID
	}
	cal, err := s.getCalendar(ctx, calID)
	if err != nil {
		return nil, fmt.Errorf("failed to get calendar: %w", err)
	}

	now := time.Now().In(s.getCalendarLocation(cal))
	remDays, err := s.CalculateRemainingWorkingDays(ctx, cal.ID, now, candidate.ClosingDate)
	if err != nil {
		return nil, fmt.Errorf("failed to compute remaining working days: %w", err)
	}
	remHours := remDays * 24.0

	// 72 hours = 3 working days backward from tender closing date
	deadline, err := s.SubtractWorkingDays(ctx, cal.ID, candidate.ClosingDate, 3)
	if err != nil {
		return nil, fmt.Errorf("failed to compute 3-working-day deadline: %w", err)
	}

	_ = s.repo.UpdateTenderDeadlineCache(ctx, candidate.ID, deadline, remHours)

	if !force {
		sent, _ := s.repo.HasRedZoneNotificationBeenSent(ctx, candidate.ID, deadline)
		if sent {
			stakeholders, _ := s.repo.GetTenderStakeholders(ctx, candidate.ID)
			return &domain.RedZoneNotificationResult{
				TenderID:              candidate.ID,
				TenderTitle:           candidate.Title,
				ClosingDate:           candidate.ClosingDate,
				Calculated72hDeadline: deadline,
				RemainingWorkingHours: remHours,
				RemainingWorkingDays:  remDays,
				StakeholdersNotified:  stakeholders,
				DeliveryStatus:        "ALREADY_SENT",
				TriggeredAt:           now,
				Message:               "Red Zone notification was already sent to stakeholders previously for this deadline",
			}, nil
		}

		// If not sent, verify that the tender is actually in the 3-working-day Red Zone
		if now.Before(deadline) && remDays > 3.0 {
			stakeholders, _ := s.repo.GetTenderStakeholders(ctx, candidate.ID)
			return &domain.RedZoneNotificationResult{
				TenderID:              candidate.ID,
				TenderTitle:           candidate.Title,
				ClosingDate:           candidate.ClosingDate,
				Calculated72hDeadline: deadline,
				RemainingWorkingHours: remHours,
				RemainingWorkingDays:  remDays,
				StakeholdersNotified:  stakeholders,
				DeliveryStatus:        "NOT_IN_RED_ZONE",
				TriggeredAt:           now,
				Message:               "Tender is not yet in the 3-working-day Red Zone",
			}, nil
		}
	}

	return s.sendRedZoneTenderDueDateNotification(ctx, *candidate, deadline, remDays, remHours)
}

func (s *workingCalendarService) sendRedZoneTenderDueDateNotification(
	ctx context.Context,
	t domain.TenderDeadlineCandidate,
	deadline time.Time,
	remDays float64,
	remHours float64,
) (*domain.RedZoneNotificationResult, error) {
	// 1. Discover all relevant stakeholders involved in this particular tender
	stakeholders, err := s.repo.GetTenderStakeholders(ctx, t.ID)
	if err != nil {
		log.Printf("[WorkingCalendar Service] Warning: Failed to query stakeholders for %s: %v", t.ID, err)
	}

	// Fallback to direct candidate fields if database relations returned empty
	if len(stakeholders) == 0 {
		if t.BidOwnerID != "" {
			name := "Bid Owner"
			if t.BidOwnerName != nil && *t.BidOwnerName != "" {
				name = *t.BidOwnerName
			}
			email := ""
			if t.BidOwnerEmail != nil {
				email = *t.BidOwnerEmail
			}
			stakeholders = append(stakeholders, domain.TenderStakeholder{
				UserID:   t.BidOwnerID,
				FullName: name,
				Email:    email,
				Roles:    "Bid Owner",
			})
		}
		if t.ReportingManagerID != nil && *t.ReportingManagerID != "" {
			name := "Reporting Manager"
			if t.ManagerName != nil && *t.ManagerName != "" {
				name = *t.ManagerName
			}
			email := ""
			if t.ManagerEmail != nil {
				email = *t.ManagerEmail
			}
			if len(stakeholders) == 0 || stakeholders[0].UserID != *t.ReportingManagerID {
				stakeholders = append(stakeholders, domain.TenderStakeholder{
					UserID:   *t.ReportingManagerID,
					FullName: name,
					Email:    email,
					Roles:    "Reporting Manager",
				})
			}
		}
	}

	// Deduplicate and filter non-empty email addresses
	var recipientEmails []string
	seenEmails := make(map[string]bool)
	for _, sh := range stakeholders {
		email := strings.TrimSpace(sh.Email)
		if email != "" && !seenEmails[email] {
			seenEmails[email] = true
			recipientEmails = append(recipientEmails, email)
		}
	}

	refNo := t.Title
	if t.GemBidNo != nil && *t.GemBidNo != "" {
		refNo = *t.GemBidNo
	} else if t.BidNo != nil && *t.BidNo != "" {
		refNo = *t.BidNo
	}

	nextTask, _ := s.repo.GetNextPendingChecklist(ctx, t.ID)
	nextTaskTitle := "Review tender documents and checklist requirements"
	nextTaskPriority := "HIGH"
	nextTaskResponsible := "Bid Executive"
	if nextTask != nil {
		nextTaskTitle = nextTask.Title
		nextTaskPriority = nextTask.Priority
		if nextTask.AssignedToName != nil && *nextTask.AssignedToName != "" {
			nextTaskResponsible = *nextTask.AssignedToName
		}
	}

	subject := fmt.Sprintf("🚨 RED ZONE ALERT: 3 Working Days (72h) Remaining – Tender Due Date Approaching (%s)", t.Title)

	// Build stakeholder rows for email HTML table
	var stakeholderRows strings.Builder
	for _, sh := range stakeholders {
		emailDisplay := sh.Email
		if emailDisplay == "" {
			emailDisplay = "—"
		}
		stakeholderRows.WriteString(fmt.Sprintf(`
			<tr style="border-bottom: 1px solid #f1f5f9;">
				<td style="padding: 8px 12px; font-weight: 600; color: #0f172a;">%s</td>
				<td style="padding: 8px 12px; color: #2563eb; font-weight: 500;">%s</td>
				<td style="padding: 8px 12px; color: #64748b; font-family: monospace; font-size: 12px;">%s</td>
			</tr>
		`, sh.FullName, sh.Roles, emailDisplay))
	}

	orgDisplay := "—"
	if t.OrganizationName != nil && *t.OrganizationName != "" {
		orgDisplay = *t.OrganizationName
		if t.DepartmentName != nil && *t.DepartmentName != "" {
			orgDisplay += fmt.Sprintf(" (%s)", *t.DepartmentName)
		}
	}

	htmlBody := fmt.Sprintf(`
		<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; max-width: 650px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
			<div style="background: linear-gradient(135deg, #dc2626 0%%, #991b1b 100%%); color: #ffffff; padding: 12px 20px; border-radius: 8px; font-weight: 800; font-size: 13px; display: inline-flex; align-items: center; gap: 8px; margin-bottom: 20px; letter-spacing: 0.5px;">
				<span>🚨</span> RED ZONE — TENDER DUE DATE NOTIFICATION (3 WORKING DAYS / 72H)
			</div>
			
			<h2 style="margin: 0 0 12px 0; color: #0f172a; font-size: 22px; font-weight: 700; line-height: 1.3;">
				%s
			</h2>
			<p style="font-size: 14px; line-height: 1.6; color: #334155; margin-bottom: 20px;">
				This automated <strong>Red Zone alert</strong> has been dispatched to all stakeholders involved in this tender. 
				Exactly <strong>3 working days (72 hours)</strong> remain before the tender submission deadline. Immediate action is required to complete pending tasks and avoid last-minute submission bottlenecks.
			</p>

			<table style="width: 100%%; border-collapse: collapse; margin: 20px 0; font-size: 13px; background-color: #f8fafc; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0;">
				<tr style="border-bottom: 1px solid #e2e8f0;">
					<td style="padding: 10px 16px; font-weight: 600; color: #64748b; width: 38%%;">Tender Title</td>
					<td style="padding: 10px 16px; font-weight: 700; color: #0f172a;">%s</td>
				</tr>
				<tr style="border-bottom: 1px solid #e2e8f0;">
					<td style="padding: 10px 16px; font-weight: 600; color: #64748b;">Reference / GeM Bid No</td>
					<td style="padding: 10px 16px; font-weight: 600; color: #2563eb; font-family: monospace;">%s</td>
				</tr>
				<tr style="border-bottom: 1px solid #e2e8f0;">
					<td style="padding: 10px 16px; font-weight: 600; color: #64748b;">Procuring Authority</td>
					<td style="padding: 10px 16px; color: #334155;">%s</td>
				</tr>
				<tr style="border-bottom: 1px solid #e2e8f0;">
					<td style="padding: 10px 16px; font-weight: 600; color: #64748b;">Current Stage</td>
					<td style="padding: 10px 16px; color: #0f172a;">
						<span style="background: #e0f2fe; color: #0369a1; padding: 3px 10px; border-radius: 4px; font-weight: 700; font-size: 11px; text-transform: uppercase;">%s</span>
					</td>
				</tr>
				<tr style="border-bottom: 1px solid #e2e8f0;">
					<td style="padding: 10px 16px; font-weight: 600; color: #64748b;">Tender Due Date / Time</td>
					<td style="padding: 10px 16px; font-weight: 700; color: #b91c1c; font-size: 14px;">%s</td>
				</tr>
				<tr style="border-bottom: 1px solid #e2e8f0;">
					<td style="padding: 10px 16px; font-weight: 600; color: #64748b;">Calculated 3-Day Trigger Time</td>
					<td style="padding: 10px 16px; font-weight: 600; color: #0f172a;">%s</td>
				</tr>
				<tr style="border-bottom: 1px solid #e2e8f0;">
					<td style="padding: 10px 16px; font-weight: 600; color: #64748b;">Remaining Working Days</td>
					<td style="padding: 10px 16px; font-weight: 800; color: #dc2626; font-size: 15px;">%.1f working days <span style="font-size: 12px; font-weight: 500; color: #64748b;">(%.1f hrs)</span></td>
				</tr>
				<tr>
					<td style="padding: 10px 16px; font-weight: 600; color: #64748b;">Next Action / Task</td>
					<td style="padding: 10px 16px; color: #0f172a;">
						<strong>%s</strong> 
						<span style="margin-left: 8px; background: #fee2e2; color: #991b1b; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 700;">%s PRIORITY</span>
						<div style="font-size: 12px; color: #64748b; margin-top: 4px;">Assigned to: %s</div>
					</td>
				</tr>
			</table>

			<div style="background-color: #fef2f2; border-left: 4px solid #ef4444; border-radius: 4px; padding: 12px 16px; margin: 20px 0;">
				<p style="margin: 0; font-size: 12px; line-height: 1.5; color: #991b1b;">
					<strong>Working Calendar Exclusions:</strong> This trigger date/time was computed backward from the tender due date by <strong>3 working days (72 hours)</strong>, excluding:
					<strong>2nd and 4th Saturdays</strong> of the month, <strong>Sundays</strong>, <strong>configured public holidays</strong>, and <strong>other non-working days</strong> defined in the corporate working calendar.
				</p>
			</div>

			<div style="margin: 24px 0;">
				<h4 style="margin: 0 0 10px 0; font-size: 13px; font-weight: 700; color: #334155; text-transform: uppercase; letter-spacing: 0.5px;">
					Involved Stakeholders Notified (%d Team Members)
				</h4>
				<table style="width: 100%%; border-collapse: collapse; font-size: 12px; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden;">
					<thead>
						<tr style="background-color: #f1f5f9; text-align: left; color: #475569; font-weight: 600; text-transform: uppercase; font-size: 11px;">
							<th style="padding: 8px 12px;">Name</th>
							<th style="padding: 8px 12px;">Role on Tender</th>
							<th style="padding: 8px 12px;">Email</th>
						</tr>
					</thead>
					<tbody>
						%s
					</tbody>
				</table>
			</div>

			<div style="margin: 28px 0 16px 0; text-align: center;">
				<div style="font-size: 12px; color: #64748b; margin-top: 8px;">
					Please log in to OneTrack to complete all pending checklist items and finalize the bid submission.
				</div>
			</div>

			<div style="font-size: 11px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 16px; text-align: center;">
				OneTrack Tender Operations Engine • GlobX Technologies Pvt Ltd • Automated Red Zone Notification
			</div>
		</div>
	`,
		t.Title,
		t.Title,
		refNo,
		orgDisplay,
		t.WorkflowStage,
		t.ClosingDate.Format("02-Jan-2006 15:04 MST"),
		deadline.Format("02-Jan-2006 15:04 MST"),
		remDays,
		remHours,
		nextTaskTitle,
		nextTaskPriority,
		nextTaskResponsible,
		len(stakeholders),
		stakeholderRows.String(),
	)

	message := fmt.Sprintf(
		"🚨 RED ZONE ALERT: Tender '%s' (Ref: %s) has entered the Red Zone.\n\n"+
			"Tender Due Date: %s\n"+
			"3 Working-Day Notification Timestamp: %s\n"+
			"Remaining: %.1f working days (%.1f hrs)\n"+
			"Current Workflow Stage: %s\n"+
			"Next Required Action: %s [Priority: %s]\n"+
			"Responsible Person: %s\n\n"+
			"All %d involved stakeholders have been notified.\n"+
			"Calculation Exclusions: 2nd/4th Saturdays, Sundays, configured holidays, and non-working calendar days.",
		t.Title, refNo,
		t.ClosingDate.Format("02-Jan-2006 15:04 MST"),
		deadline.Format("02-Jan-2006 15:04 MST"),
		remDays, remHours,
		t.WorkflowStage,
		nextTaskTitle, nextTaskPriority, nextTaskResponsible,
		len(stakeholders),
	)

	// 2. Dispatch email to all stakeholder emails
	deliveryStatus := "SENT"
	var errStr *string

	if s.emailSvc != nil && len(recipientEmails) > 0 {
		err := s.emailSvc.SendEmail(recipientEmails, subject, htmlBody)
		if err != nil {
			deliveryStatus = "FAILED"
			e := err.Error()
			errStr = &e
			log.Printf("[WorkingCalendar Service] Email dispatch failed for tender %s: %v", t.ID, err)
		} else {
			log.Printf("[WorkingCalendar Service] Red Zone email dispatched to %d stakeholders for tender %s", len(recipientEmails), t.Title)
		}
	}

	now := time.Now().UTC()

	// 3. Dispatch in-app alert to every stakeholder user ID
	for _, sh := range stakeholders {
		if sh.UserID != "" && s.alertSvc != nil {
			_ = s.alertSvc.CreateAlert(ctx, &alertDomain.Alert{
				UserID:  &sh.UserID,
				BidID:   &t.ID,
				Type:    "TENDER",
				Title:   fmt.Sprintf("🚨 RED ZONE: 3 Working Days (72h) Remaining — %s", t.Title),
				Message: fmt.Sprintf("Tender '%s' is in the Red Zone. Due date: %s. Remaining: %.1f working days. Please complete pending submissions immediately.", 
					t.Title, t.ClosingDate.Format("02-Jan-2006 15:04 MST"), remDays),
			})
		}

		// 4. Record notification audit trail for each stakeholder
		if sh.UserID != "" {
			roleCopy := sh.Roles
			var checklistID *string
			if nextTask != nil {
				checklistID = &nextTask.ChecklistID
			}

			_ = s.repo.RecordNotification(ctx, &domain.TaskNotification{
				TenderID:         t.ID,
				ChecklistID:      checklistID,
				RecipientUserID:  sh.UserID,
				RecipientRole:    &roleCopy,
				NotificationType: domain.NotificationTypeRedZoneDueDate,
				ScheduledAt:      deadline,
				TriggeredAt:      now,
				SentAt:           &now,
				DeliveryStatus:   deliveryStatus,
				Subject:          subject,
				Message:          message,
				ErrorMessage:     errStr,
			})

			// Backward compatibility record
			_ = s.repo.RecordNotification(ctx, &domain.TaskNotification{
				TenderID:         t.ID,
				ChecklistID:      checklistID,
				RecipientUserID:  sh.UserID,
				RecipientRole:    &roleCopy,
				NotificationType: domain.NotificationType72HourReminder,
				ScheduledAt:      deadline,
				TriggeredAt:      now,
				SentAt:           &now,
				DeliveryStatus:   deliveryStatus,
				Subject:          subject,
				Message:          message,
				ErrorMessage:     errStr,
			})
		}
	}

	// 5. System audit log
	if s.systemLog != nil {
		s.systemLog.Record(ctx, "TENDER", "TENDER_RED_ZONE_NOTIFIED", "", nil,
			fmt.Sprintf("Red Zone 3-working-day notification sent to %d stakeholders for tender %s", len(stakeholders), t.Title),
			map[string]interface{}{
				"tender_id":       t.ID,
				"tender_title":    t.Title,
				"stakeholders":    len(stakeholders),
				"remaining_days":  remDays,
				"remaining_hours": remHours,
				"deadline":        deadline.Format(time.RFC3339),
			},
		)
	}

	return &domain.RedZoneNotificationResult{
		TenderID:              t.ID,
		TenderTitle:           t.Title,
		ClosingDate:           t.ClosingDate,
		Calculated72hDeadline: deadline,
		RemainingWorkingHours: remHours,
		RemainingWorkingDays:  remDays,
		StakeholdersNotified:  stakeholders,
		DeliveryStatus:        deliveryStatus,
		TriggeredAt:           now,
		Message:               fmt.Sprintf("Red Zone notification successfully dispatched to %d stakeholders (%d emails)", len(stakeholders), len(recipientEmails)),
	}, nil
}

func (s *workingCalendarService) send72HourPriorityNotification(
	ctx context.Context,
	t domain.TenderDeadlineCandidate,
	task *domain.NextActionableTask,
	deadline time.Time,
	remHours float64,
) {
	_, _ = s.sendRedZoneTenderDueDateNotification(ctx, t, deadline, remHours/24.0, remHours)
}

func (s *workingCalendarService) sendEscalationNotification(
	ctx context.Context,
	t domain.TenderDeadlineCandidate,
	task *domain.NextActionableTask,
	delayHours float64,
) {
	if t.ReportingManagerID == nil || *t.ReportingManagerID == "" {
		return
	}
	managerID := *t.ReportingManagerID
	managerEmail := ""
	managerName := "Reporting Manager"

	if t.ManagerEmail != nil {
		managerEmail = *t.ManagerEmail
	}
	if t.ManagerName != nil {
		managerName = *t.ManagerName
	}

	reason := fmt.Sprintf("Task '%s' [Priority: %s] has remained incomplete past the 72 working-hour threshold (Delayed by >%.1f hrs)",
		task.Title, task.Priority, delayHours)

	// Send in-app escalation alert to manager
	if s.alertSvc != nil {
		_ = s.alertSvc.CreateAlert(ctx, &alertDomain.Alert{
			UserID:  &managerID,
			BidID:   &t.ID,
			Type:    "TENDER",
			Title:   fmt.Sprintf("ESCALATION: Delayed Task on Tender '%s'", t.Title),
			Message: reason,
		})
	}

	// Send email to manager
	if s.emailSvc != nil && managerEmail != "" {
		subject := fmt.Sprintf("ESCALATION: Delayed Task on Tender '%s' – Immediate Manager Action Required", t.Title)
		htmlBody := fmt.Sprintf(`
			<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1e293b; max-width: 600px; padding: 24px; border: 2px solid #ef4444; border-radius: 8px;">
				<div style="background-color: #991b1b; color: white; padding: 8px 16px; border-radius: 6px; font-weight: bold; font-size: 14px; display: inline-block; margin-bottom: 16px;">
					⚠️ TASK ESCALATION TO REPORTING MANAGER
				</div>
				<h2 style="margin: 0 0 16px 0; color: #0f172a;">Delay Escalation: %s</h2>
				<p style="font-size: 14px; line-height: 1.6; color: #334155;">
					The critical task <strong>%s</strong> on tender <strong>%s</strong> remains pending past the allowed deadline.
				</p>
				<p style="font-size: 14px; line-height: 1.6; color: #b91c1c; font-weight: 600;">
					%s
				</p>
				<p style="font-size: 13px; color: #64748b; margin-top: 24px;">Please review this tender in OneTrack to resolve the bottleneck.</p>
			</div>
		`, t.Title, task.Title, t.Title, reason)

		_ = s.emailSvc.SendEmail([]string{managerEmail}, subject, htmlBody)
	}

	// Record escalation in DB (Section 18)
	_ = s.repo.RecordEscalation(ctx, &domain.TaskEscalation{
		TenderID:         t.ID,
		ChecklistID:      &task.ChecklistID,
		ManagerUserID:    managerID,
		EscalationReason: reason,
		EscalatedAt:      time.Now().UTC(),
		Status:           "ESCALATED",
	})

	// Audit log (Section 28)
	if s.systemLog != nil {
		s.systemLog.Record(ctx, "TENDER", "TENDER_TASK_ESCALATED", "", &managerID,
			fmt.Sprintf("Task escalation triggered for tender %s", t.Title),
			map[string]interface{}{
				"tender_title":    t.Title,
				"checklist_id":    task.ChecklistID,
				"checklist_title": task.Title,
				"manager_id":      managerID,
				"manager_name":    managerName,
				"reason":          reason,
			},
		)
	}
}

// ── Private Helpers ──────────────────────────────────────────────────────────

func (s *workingCalendarService) getCalendar(ctx context.Context, calendarID string) (*domain.WorkingCalendar, error) {
	if calendarID != "" {
		cal, err := s.repo.GetCalendarByID(ctx, calendarID)
		if err == nil && cal != nil {
			return cal, nil
		}
	}
	// Fall back to default
	cal, err := s.repo.GetDefaultCalendar(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to retrieve default calendar: %w", err)
	}
	if cal == nil {
		return nil, fmt.Errorf("no default working calendar found")
	}
	return cal, nil
}

func (s *workingCalendarService) getCalendarLocation(cal *domain.WorkingCalendar) *time.Location {
	tz := "Asia/Kolkata"
	if cal != nil && cal.Timezone != "" {
		tz = cal.Timezone
	}
	loc, err := time.LoadLocation(tz)
	if err != nil {
		return time.FixedZone("IST", 5*3600+1800) // UTC+05:30 fallback
	}
	return loc
}

func (s *workingCalendarService) findTenderCandidate(ctx context.Context, tenderID string) (*domain.TenderDeadlineCandidate, error) {
	candidates, err := s.repo.GetActiveTendersForDeadlineCheck(ctx)
	if err != nil {
		return nil, err
	}
	for _, c := range candidates {
		if c.ID == tenderID {
			return &c, nil
		}
	}
	return nil, nil
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

func ordinal(n int) string {
	switch n {
	case 1:
		return "1st"
	case 2:
		return "2nd"
	case 3:
		return "3rd"
	case 4:
		return "4th"
	case 5:
		return "5th"
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
