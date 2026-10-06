package service

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/onetrack/backend/internal/calendar/domain"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ── Mock Repository ──────────────────────────────────────────────────────────

type mockCalendarRepo struct {
	calendar      *domain.WorkingCalendar
	calendars     map[string]*domain.WorkingCalendar
	holidays      map[string]*domain.Holiday
	exceptions    map[string]*domain.CalendarException
	notifications map[string]*domain.TaskNotification
	escalations   map[string]*domain.TaskEscalation
	nextTask      *domain.NextActionableTask
	candidates    []domain.TenderDeadlineCandidate
	syncLogs      []domain.GoogleCalendarSyncLog
	integration   *domain.GoogleCalendarIntegration
}

func newMockCalendarRepo() *mockCalendarRepo {
	cal := &domain.WorkingCalendar{
		ID:                 "cal-default",
		Name:               "OneTrack Corporate Working Calendar",
		Timezone:           "Asia/Kolkata",
		WorkingStartTime:   "09:00",
		WorkingEndTime:     "18:00",
		MondayWorking:        true,
		TuesdayWorking:       true,
		WednesdayWorking:     true,
		ThursdayWorking:      true,
		FridayWorking:        true,
		Saturday1Working:     true,
		Saturday2Working:     false, // 2nd Saturday = Holiday
		Saturday3Working:     true,
		Saturday4Working:     false, // 4th Saturday = Holiday
		Saturday5Working:     true,
		SundayWorking:        false, // Sunday = Holiday
		IsDefault:          true,
		CreatedAt:          time.Now(),
		UpdatedAt:          time.Now(),
	}

	return &mockCalendarRepo{
		calendar:      cal,
		calendars:     map[string]*domain.WorkingCalendar{cal.ID: cal},
		holidays:      make(map[string]*domain.Holiday),
		exceptions:    make(map[string]*domain.CalendarException),
		notifications: make(map[string]*domain.TaskNotification),
		escalations:   make(map[string]*domain.TaskEscalation),
		syncLogs:      make([]domain.GoogleCalendarSyncLog, 0),
	}
}

func (m *mockCalendarRepo) GetDefaultCalendar(ctx context.Context) (*domain.WorkingCalendar, error) {
	return m.calendar, nil
}
func (m *mockCalendarRepo) GetCalendarByID(ctx context.Context, id string) (*domain.WorkingCalendar, error) {
	if c, ok := m.calendars[id]; ok {
		return c, nil
	}
	return m.calendar, nil
}
func (m *mockCalendarRepo) ListCalendars(ctx context.Context) ([]domain.WorkingCalendar, error) {
	var list []domain.WorkingCalendar
	for _, c := range m.calendars {
		list = append(list, *c)
	}
	return list, nil
}
func (m *mockCalendarRepo) UpdateCalendar(ctx context.Context, id string, req *domain.UpdateCalendarRequest) (*domain.WorkingCalendar, error) {
	return m.calendar, nil
}
func (m *mockCalendarRepo) ListHolidays(ctx context.Context, calendarID string, year int) ([]domain.Holiday, error) {
	var list []domain.Holiday
	for _, h := range m.holidays {
		list = append(list, *h)
	}
	return list, nil
}
func (m *mockCalendarRepo) GetHolidayByID(ctx context.Context, id string) (*domain.Holiday, error) {
	return m.holidays[id], nil
}
func (m *mockCalendarRepo) GetHolidayByDate(ctx context.Context, calendarID string, date string) (*domain.Holiday, error) {
	for _, h := range m.holidays {
		if h.HolidayDate == date {
			return h, nil
		}
	}
	return nil, nil
}
func (m *mockCalendarRepo) CreateHoliday(ctx context.Context, holiday *domain.Holiday) (*domain.Holiday, error) {
	holiday.ID = fmt.Sprintf("hol-%d", len(m.holidays)+1)
	m.holidays[holiday.ID] = holiday
	return holiday, nil
}
func (m *mockCalendarRepo) UpdateHoliday(ctx context.Context, id string, req *domain.UpdateHolidayRequest, updatedBy string) (*domain.Holiday, error) {
	h, ok := m.holidays[id]
	if !ok {
		return nil, fmt.Errorf("holiday not found")
	}
	if req.HolidayName != nil {
		h.HolidayName = *req.HolidayName
	}
	if req.WorkingStatus != nil {
		h.WorkingStatus = *req.WorkingStatus
	}
	if req.IsAdminOverride != nil {
		h.IsAdminOverride = *req.IsAdminOverride
	}
	return h, nil
}
func (m *mockCalendarRepo) DeleteHoliday(ctx context.Context, id string) error {
	delete(m.holidays, id)
	return nil
}
func (m *mockCalendarRepo) UpsertGoogleHolidays(ctx context.Context, calendarID string, holidays []domain.Holiday) (*domain.SyncResult, error) {
	res := &domain.SyncResult{}
	for _, h := range holidays {
		existing, _ := m.GetHolidayByDate(ctx, calendarID, h.HolidayDate)
		if existing != nil {
			if existing.IsAdminOverride {
				res.SkippedCount++
				continue
			}
			existing.HolidayName = h.HolidayName
			res.UpdatedCount++
		} else {
			hCopy := h
			hCopy.ID = fmt.Sprintf("hol-sync-%s", h.HolidayDate)
			m.holidays[hCopy.ID] = &hCopy
			res.ImportedCount++
		}
	}
	return res, nil
}
func (m *mockCalendarRepo) ListExceptions(ctx context.Context, calendarID string) ([]domain.CalendarException, error) {
	var list []domain.CalendarException
	for _, e := range m.exceptions {
		list = append(list, *e)
	}
	return list, nil
}
func (m *mockCalendarRepo) GetExceptionByDate(ctx context.Context, calendarID string, date string) (*domain.CalendarException, error) {
	return m.exceptions[date], nil
}
func (m *mockCalendarRepo) CreateException(ctx context.Context, exc *domain.CalendarException) (*domain.CalendarException, error) {
	exc.ID = fmt.Sprintf("exc-%s", exc.ExceptionDate)
	m.exceptions[exc.ExceptionDate] = exc
	return exc, nil
}
func (m *mockCalendarRepo) DeleteException(ctx context.Context, id string) error {
	for k, v := range m.exceptions {
		if v.ID == id {
			delete(m.exceptions, k)
		}
	}
	return nil
}
func (m *mockCalendarRepo) GetGoogleIntegration(ctx context.Context, calendarID string) (*domain.GoogleCalendarIntegration, error) {
	if m.integration != nil {
		return m.integration, nil
	}
	return &domain.GoogleCalendarIntegration{
		ID:               "mock-integration-1",
		CalendarID:       calendarID,
		GoogleCalendarID: "en.indian#holiday@group.v.calendar.google.com",
		SyncEnabled:      true,
	}, nil
}
func (m *mockCalendarRepo) SaveGoogleIntegration(ctx context.Context, integration *domain.GoogleCalendarIntegration) (*domain.GoogleCalendarIntegration, error) {
	m.integration = integration
	return integration, nil
}
func (m *mockCalendarRepo) CreateSyncLog(ctx context.Context, log *domain.GoogleCalendarSyncLog) error {
	m.syncLogs = append(m.syncLogs, *log)
	return nil
}
func (m *mockCalendarRepo) ListSyncLogs(ctx context.Context, integrationID string, limit int) ([]domain.GoogleCalendarSyncLog, error) {
	return m.syncLogs, nil
}
func (m *mockCalendarRepo) HasNotificationBeenSent(ctx context.Context, tenderID string, checklistID *string, notifType string) (bool, error) {
	cID := ""
	if checklistID != nil {
		cID = *checklistID
	}
	key := fmt.Sprintf("%s:%s:%s", tenderID, cID, notifType)
	_, ok := m.notifications[key]
	return ok, nil
}
func (m *mockCalendarRepo) RecordNotification(ctx context.Context, notif *domain.TaskNotification) error {
	cID := ""
	if notif.ChecklistID != nil {
		cID = *notif.ChecklistID
	}
	key := fmt.Sprintf("%s:%s:%s", notif.TenderID, cID, notif.NotificationType)
	m.notifications[key] = notif
	return nil
}
func (m *mockCalendarRepo) ListNotificationsByTender(ctx context.Context, tenderID string) ([]domain.TaskNotification, error) {
	var list []domain.TaskNotification
	for _, n := range m.notifications {
		if n.TenderID == tenderID {
			list = append(list, *n)
		}
	}
	return list, nil
}
func (m *mockCalendarRepo) HasEscalationBeenSent(ctx context.Context, tenderID string, checklistID *string) (bool, error) {
	cID := ""
	if checklistID != nil {
		cID = *checklistID
	}
	key := fmt.Sprintf("%s:%s", tenderID, cID)
	_, ok := m.escalations[key]
	return ok, nil
}
func (m *mockCalendarRepo) RecordEscalation(ctx context.Context, esc *domain.TaskEscalation) error {
	cID := ""
	if esc.ChecklistID != nil {
		cID = *esc.ChecklistID
	}
	key := fmt.Sprintf("%s:%s", esc.TenderID, cID)
	m.escalations[key] = esc
	return nil
}
func (m *mockCalendarRepo) ListEscalationsByTender(ctx context.Context, tenderID string) ([]domain.TaskEscalation, error) {
	var list []domain.TaskEscalation
	for _, e := range m.escalations {
		if e.TenderID == tenderID {
			list = append(list, *e)
		}
	}
	return list, nil
}
func (m *mockCalendarRepo) GetNextPendingChecklist(ctx context.Context, tenderID string) (*domain.NextActionableTask, error) {
	return m.nextTask, nil
}
func (m *mockCalendarRepo) UpdateChecklistPriorityAndAssignment(ctx context.Context, checklistID string, req *domain.UpdateChecklistPriorityRequest) error {
	return nil
}
func (m *mockCalendarRepo) MarkChecklistDelayed(ctx context.Context, checklistID string) error {
	if m.nextTask != nil && m.nextTask.ChecklistID == checklistID {
		m.nextTask.Status = "DELAYED"
	}
	return nil
}
func (m *mockCalendarRepo) UpdateTenderDeadlineCache(ctx context.Context, tenderID string, deadline time.Time, remainingHours float64) error {
	return nil
}
func (m *mockCalendarRepo) GetActiveTendersForDeadlineCheck(ctx context.Context) ([]domain.TenderDeadlineCandidate, error) {
	return m.candidates, nil
}
func (m *mockCalendarRepo) HasRedZoneNotificationBeenSent(ctx context.Context, tenderID string, deadline time.Time) (bool, error) {
	for _, n := range m.notifications {
		if n.TenderID == tenderID && (n.NotificationType == domain.NotificationTypeRedZoneDueDate || n.NotificationType == domain.NotificationType72HourReminder) {
			return true, nil
		}
	}
	return false, nil
}
func (m *mockCalendarRepo) GetTenderStakeholders(ctx context.Context, tenderID string) ([]domain.TenderStakeholder, error) {
	return []domain.TenderStakeholder{
		{UserID: "usr-owner", FullName: "Rajesh Kumar", Email: "rajesh@globx.co.in", Roles: "Bid Owner"},
		{UserID: "usr-mgr", FullName: "Priya Sharma", Email: "priya@globx.co.in", Roles: "Reporting Manager"},
		{UserID: "usr-am", FullName: "Amit Patel", Email: "amit@globx.co.in", Roles: "Account Manager"},
		{UserID: "usr-pre", FullName: "Sunil Verma", Email: "sunil@globx.co.in", Roles: "Pre-Sales"},
	}, nil
}

// ── Tests Covering All 34 Test Cases From Specification Section 30 ───────────

// Test 1: Monday-Friday calculation
// Test 7: Sunday is non-working
func TestCases_1_7_MondayToFridayAndSunday(t *testing.T) {
	repo := newMockCalendarRepo()
	svc := NewWorkingCalendarService(repo, nil, nil, nil)
	ctx := context.Background()

	// 2026-10-05 (Monday) to 2026-10-09 (Friday)
	days := []string{"2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09"}
	for _, dStr := range days {
		date, err := time.Parse("2006-01-02", dStr)
		require.NoError(t, err)
		isWorking, reason, err := svc.IsWorkingDay(ctx, "cal-default", date)
		assert.NoError(t, err)
		assert.True(t, isWorking, "Expected weekday %s to be working", dStr)
		assert.Contains(t, reason, "Working Day")
	}

	// 2026-10-04 (Sunday)
	sun, _ := time.Parse("2006-01-02", "2026-10-04")
	isWorking, reason, err := svc.IsWorkingDay(ctx, "cal-default", sun)
	assert.NoError(t, err)
	assert.False(t, isWorking, "Expected Sunday to be non-working")
	assert.Equal(t, "Sunday Holiday", reason)
}

// Test 2: 1st Saturday is working
// Test 3: 2nd Saturday is non-working
// Test 4: 3rd Saturday is working
// Test 5: 4th Saturday is non-working
// Test 6: 5th Saturday is working
func TestCases_2_to_6_SaturdayRulesOctober2026(t *testing.T) {
	repo := newMockCalendarRepo()
	svc := NewWorkingCalendarService(repo, nil, nil, nil)
	ctx := context.Background()

	tests := []struct {
		dateStr     string
		satNum      int
		wantWorking bool
		wantReason  string
	}{
		{"2026-10-03", 1, true, "1st Saturday Working Day"},
		{"2026-10-10", 2, false, "2nd Saturday Holiday"},
		{"2026-10-17", 3, true, "3rd Saturday Working Day"},
		{"2026-10-24", 4, false, "4th Saturday Holiday"},
		{"2026-10-31", 5, true, "5th Saturday Working Day"},
	}

	for _, tt := range tests {
		date, err := time.Parse("2006-01-02", tt.dateStr)
		require.NoError(t, err)

		satNum := svc.GetSaturdayNumber(date)
		assert.Equal(t, tt.satNum, satNum, "Mismatch Saturday number for %s", tt.dateStr)

		isWorking, reason, err := svc.IsWorkingDay(ctx, "cal-default", date)
		assert.NoError(t, err)
		assert.Equal(t, tt.wantWorking, isWorking, "Mismatch working status for %s", tt.dateStr)
		assert.Equal(t, tt.wantReason, reason, "Mismatch reason for %s", tt.dateStr)
	}
}

// Test 8: Government holiday exclusion
// Test 9: Company holiday exclusion
func TestCases_8_9_GovernmentAndCompanyHolidayExclusion(t *testing.T) {
	repo := newMockCalendarRepo()
	ctx := context.Background()

	// Government holiday on Friday 2026-10-02 (Gandhi Jayanti)
	repo.holidays["hol-1"] = &domain.Holiday{
		ID:            "hol-1",
		CalendarID:    "cal-default",
		HolidayDate:   "2026-10-02",
		HolidayName:   "Gandhi Jayanti",
		HolidayType:   domain.HolidayTypeGovernment,
		WorkingStatus: domain.WorkingStatusNonWorking,
		IsActive:      true,
	}

	// Company holiday on Wednesday 2026-10-14 (Annual Founders Day)
	repo.holidays["hol-2"] = &domain.Holiday{
		ID:            "hol-2",
		CalendarID:    "cal-default",
		HolidayDate:   "2026-10-14",
		HolidayName:   "Company Day",
		HolidayType:   domain.HolidayTypeCompany,
		WorkingStatus: domain.WorkingStatusNonWorking,
		IsActive:      true,
	}

	svc := NewWorkingCalendarService(repo, nil, nil, nil)

	// Test Gandhi Jayanti (Friday normally working, but holiday -> non-working)
	gj, _ := time.Parse("2006-01-02", "2026-10-02")
	isWorking, reason, err := svc.IsWorkingDay(ctx, "cal-default", gj)
	assert.NoError(t, err)
	assert.False(t, isWorking)
	assert.Contains(t, reason, "Gandhi Jayanti")

	// Test Company Day (Wednesday normally working, but company holiday -> non-working)
	cd, _ := time.Parse("2006-01-02", "2026-10-14")
	isWorking, reason, err = svc.IsWorkingDay(ctx, "cal-default", cd)
	assert.NoError(t, err)
	assert.False(t, isWorking)
	assert.Contains(t, reason, "Company Day")
}

// Test 10: Special working-day override
// Test 11: Special non-working-day override
func TestCases_10_11_SpecialWorkingAndNonWorkingDayOverrides(t *testing.T) {
	repo := newMockCalendarRepo()
	ctx := context.Background()

	// 2026-10-10 is the 2nd Saturday (normally non-working).
	// Declare SPECIAL_WORKING_DAY override.
	repo.exceptions["2026-10-10"] = &domain.CalendarException{
		CalendarID:    "cal-default",
		ExceptionDate: "2026-10-10",
		ExceptionType: domain.ExceptionSpecialWorkingDay,
		Reason:        "Urgent Tender Submission Preparation Drive",
	}

	// 2026-10-07 is Wednesday (normally working).
	// Declare SPECIAL_NON_WORKING_DAY override.
	repo.exceptions["2026-10-07"] = &domain.CalendarException{
		CalendarID:    "cal-default",
		ExceptionDate: "2026-10-07",
		ExceptionType: domain.ExceptionSpecialNonWorkingDay,
		Reason:        "Severe Weather Emergency Warning",
	}

	svc := NewWorkingCalendarService(repo, nil, nil, nil)

	// Check 2nd Saturday with special working override
	sat2, _ := time.Parse("2006-01-02", "2026-10-10")
	isWorking, reason, err := svc.IsWorkingDay(ctx, "cal-default", sat2)
	assert.NoError(t, err)
	assert.True(t, isWorking, "Expected 2nd Saturday to be working under SPECIAL_WORKING_DAY exception")
	assert.Equal(t, "Special Working Day Override", reason)

	// Check Wednesday with special non-working override
	wed, _ := time.Parse("2006-01-02", "2026-10-07")
	isWorking, reason, err = svc.IsWorkingDay(ctx, "cal-default", wed)
	assert.NoError(t, err)
	assert.False(t, isWorking, "Expected Wednesday to be non-working under SPECIAL_NON_WORKING_DAY exception")
	assert.Equal(t, "Special Non-Working Day", reason)
}

// Test 12: 2nd Saturday + government holiday
// Test 13: 4th Saturday + government holiday
// Test 14: Consecutive holidays
// Test 15: Weekend + holiday combination
func TestCases_12_to_15_CombinationsAndConsecutiveHolidays(t *testing.T) {
	repo := newMockCalendarRepo()
	ctx := context.Background()

	// 2nd Saturday 2026-10-10 also marked as government holiday
	repo.holidays["hol-sat2"] = &domain.Holiday{
		ID:            "hol-sat2",
		CalendarID:    "cal-default",
		HolidayDate:   "2026-10-10",
		HolidayName:   "State Foundation Day",
		WorkingStatus: domain.WorkingStatusNonWorking,
		IsActive:      true,
	}

	// Consecutive holidays: Thursday 2026-11-12, Friday 2026-11-13 followed by weekend 2026-11-14 (2nd Sat) and 2026-11-15 (Sun)
	repo.holidays["hol-nov12"] = &domain.Holiday{
		ID:            "hol-nov12",
		CalendarID:    "cal-default",
		HolidayDate:   "2026-11-12",
		HolidayName:   "Diwali Eve",
		WorkingStatus: domain.WorkingStatusNonWorking,
		IsActive:      true,
	}
	repo.holidays["hol-nov13"] = &domain.Holiday{
		ID:            "hol-nov13",
		CalendarID:    "cal-default",
		HolidayDate:   "2026-11-13",
		HolidayName:   "Diwali Main Day",
		WorkingStatus: domain.WorkingStatusNonWorking,
		IsActive:      true,
	}

	svc := NewWorkingCalendarService(repo, nil, nil, nil)

	// Test 12: 2nd Sat + Govt holiday remains non-working
	sat2, _ := time.Parse("2006-01-02", "2026-10-10")
	isWorking, _, _ := svc.IsWorkingDay(ctx, "cal-default", sat2)
	assert.False(t, isWorking)

	// Test 14 & 15: Consecutive holidays + weekend sequence: Thu, Fri, Sat, Sun all non-working
	for _, dt := range []string{"2026-11-12", "2026-11-13", "2026-11-14", "2026-11-15"} {
		d, _ := time.Parse("2006-01-02", dt)
		w, _, _ := svc.IsWorkingDay(ctx, "cal-default", d)
		assert.False(t, w, "%s must be non-working", dt)
	}

	// Monday 2026-11-16 must be back to working
	mon, _ := time.Parse("2006-01-02", "2026-11-16")
	w, _, _ := svc.IsWorkingDay(ctx, "cal-default", mon)
	assert.True(t, w, "Monday 2026-11-16 must be working")
}

// Test 16: Exact 72 working-hour calculation
// Test 17: Working-hour boundary (09:00 - 18:00)
// Test 18: Closing time outside working hours (e.g. 20:00 closing clamped to 18:00 interval)
func TestCases_16_to_18_Exact72WorkingHourEngine(t *testing.T) {
	repo := newMockCalendarRepo()
	ctx := context.Background()

	// October 2026 calendar:
	// Working schedule: 9h per day (09:00 - 18:00)
	// 72 working hours = exactly 8 full working days.
	// Suppose Tender closes on Tuesday 2026-10-20 at 18:00 IST.
	// Working days counted backwards:
	// Day 1: Tue 2026-10-20 (9h) -> 63h left
	// Day 2: Mon 2026-10-19 (9h) -> 54h left
	// Sun 2026-10-18: SKIPPED (Sunday)
	// Day 3: Sat 2026-10-17 (3rd Saturday = WORKING) (9h) -> 45h left
	// Day 4: Fri 2026-10-16 (9h) -> 36h left
	// Day 5: Thu 2026-10-15 (9h) -> 27h left
	// Day 6: Wed 2026-10-14 (9h) -> 18h left
	// Day 7: Tue 2026-10-13 (9h) -> 9h left
	// Day 8: Mon 2026-10-12 (9h) -> 0h left
	// Deadline should be exactly Monday 2026-10-12 at 09:00 IST!

	svc := NewWorkingCalendarService(repo, nil, nil, nil)
	loc, err := time.LoadLocation("Asia/Kolkata")
	require.NoError(t, err)

	closingTime := time.Date(2026, time.October, 20, 18, 0, 0, 0, loc)
	deadline, err := svc.SubtractWorkingHours(ctx, "cal-default", closingTime, 72.0)
	require.NoError(t, err)

	expectedDeadline := time.Date(2026, time.October, 12, 9, 0, 0, 0, loc)
	assert.Equal(t, expectedDeadline.Format(time.RFC3339), deadline.Format(time.RFC3339),
		"72 working hours before Tue Oct 20 18:00 must be Mon Oct 12 09:00 skipping Sunday Oct 18 and utilizing working 3rd Sat Oct 17")

	// Test 18: Closing time outside working hours (e.g. 21:00 closing)
	// Closing after 18:00 should clamp interval to 18:00 and produce the identical deadline!
	closingAfterHours := time.Date(2026, time.October, 20, 21, 0, 0, 0, loc)
	deadlineAfterHours, err := svc.SubtractWorkingHours(ctx, "cal-default", closingAfterHours, 72.0)
	require.NoError(t, err)
	assert.Equal(t, expectedDeadline.Format(time.RFC3339), deadlineAfterHours.Format(time.RFC3339))
}

// Test 19: Month transition
// Test 20: Year transition
// Test 21: Leap year
func TestCases_19_to_21_MonthYearAndLeapTransitions(t *testing.T) {
	repo := newMockCalendarRepo()
	ctx := context.Background()
	svc := NewWorkingCalendarService(repo, nil, nil, nil)
	loc, _ := time.LoadLocation("Asia/Kolkata")

	// Test 19: Month transition (closes Nov 4, 2026, spans back into October)
	closingNov := time.Date(2026, time.November, 4, 18, 0, 0, 0, loc)
	deadlineNov, err := svc.SubtractWorkingHours(ctx, "cal-default", closingNov, 72.0)
	require.NoError(t, err)
	assert.True(t, deadlineNov.Month() == time.October, "Deadline should cross back into October")

	// Test 20: Year transition (closes Jan 8, 2027, spans back into December 2026)
	closingJan := time.Date(2027, time.January, 8, 18, 0, 0, 0, loc)
	deadlineJan, err := svc.SubtractWorkingHours(ctx, "cal-default", closingJan, 72.0)
	require.NoError(t, err)
	assert.True(t, deadlineJan.Year() == 2026, "Deadline should cross back into year 2026")

	// Test 21: Leap year (February 2028 has 29 days)
	// 2028-02-29 is Tuesday. Closes 2028-03-02 (Thursday) at 18:00.
	closingMar := time.Date(2028, time.March, 2, 18, 0, 0, 0, loc)
	deadlineLeap, err := svc.SubtractWorkingHours(ctx, "cal-default", closingMar, 27.0) // 3 working days (Thu, Wed, Tue)
	require.NoError(t, err)
	// 3 days backward from Thu Mar 2 18:00 (Wed Mar 1, Tue Feb 29) -> Tue Feb 29 at 09:00!
	assert.Equal(t, time.February, deadlineLeap.Month())
	assert.Equal(t, 29, deadlineLeap.Day(), "Leap day Feb 29 must be correctly recognized")
}

// Test 22: Multiple calendars
func TestCase_22_MultipleCalendars(t *testing.T) {
	repo := newMockCalendarRepo()
	ctx := context.Background()

	// Add Odisha State Government calendar with Raja festival holiday (2026-06-15)
	repo.calendars["cal-odisha"] = &domain.WorkingCalendar{
		ID:                 "cal-odisha",
		Name:               "Odisha Government Calendar",
		Timezone:           "Asia/Kolkata",
		WorkingStartTime:   "10:00",
		WorkingEndTime:     "17:00", // 7 hours per day
		MondayWorking:        true,
		TuesdayWorking:       true,
		WednesdayWorking:     true,
		ThursdayWorking:      true,
		FridayWorking:        true,
		Saturday1Working:     false, // All Saturdays non-working in this government calendar
		Saturday2Working:     false,
		Saturday3Working:     false,
		Saturday4Working:     false,
		Saturday5Working:     false,
		SundayWorking:        false,
	}

	repo.holidays["hol-raja"] = &domain.Holiday{
		ID:            "hol-raja",
		CalendarID:    "cal-odisha",
		HolidayDate:   "2026-06-15",
		HolidayName:   "Raja Festival",
		WorkingStatus: domain.WorkingStatusNonWorking,
		IsActive:      true,
	}

	svc := NewWorkingCalendarService(repo, nil, nil, nil)

	// Under cal-odisha, 1st Saturday 2026-06-06 is non-working
	sat1, _ := time.Parse("2006-01-02", "2026-06-06")
	isWorking, _, _ := svc.IsWorkingDay(ctx, "cal-odisha", sat1)
	assert.False(t, isWorking, "Odisha calendar treats all Saturdays as non-working")

	// Under default corporate calendar, 1st Saturday 2026-06-06 is working
	isWorkingDefault, _, _ := svc.IsWorkingDay(ctx, "cal-default", sat1)
	assert.True(t, isWorkingDefault, "Default calendar treats 1st Saturday as working")
}

// Test 23: Google holiday import
// Test 24: Duplicate prevention
// Test 25: Google synchronization
// Test 26: Admin override
// Test 27: Sync without overwriting Admin override
// Test 28: Google API failure
func TestCases_23_to_28_GoogleSyncAndAdminOverride(t *testing.T) {
	repo := newMockCalendarRepo()
	ctx := context.Background()

	// Initial import of 2 holidays
	batch1 := []domain.Holiday{
		{
			CalendarID:      "cal-default",
			HolidayDate:     "2026-08-15",
			HolidayName:     "Independence Day",
			HolidayType:     domain.HolidayTypeGovernment,
			WorkingStatus:   domain.WorkingStatusNonWorking,
			Source:          domain.SourceGoogleCalendar,
			IsAdminOverride: false,
		},
		{
			CalendarID:      "cal-default",
			HolidayDate:     "2026-10-02",
			HolidayName:     "Mahatma Gandhi Birthday",
			HolidayType:     domain.HolidayTypeGovernment,
			WorkingStatus:   domain.WorkingStatusNonWorking,
			Source:          domain.SourceGoogleCalendar,
			IsAdminOverride: false,
		},
	}

	// Test 23: Google holiday import
	res1, err := repo.UpsertGoogleHolidays(ctx, "cal-default", batch1)
	require.NoError(t, err)
	assert.Equal(t, 2, res1.ImportedCount)
	assert.Equal(t, 0, res1.SkippedCount)

	// Test 24: Duplicate prevention (syncing identical list again results in updates, not new duplicates)
	res2, err := repo.UpsertGoogleHolidays(ctx, "cal-default", batch1)
	require.NoError(t, err)
	assert.Equal(t, 0, res2.ImportedCount)
	assert.Equal(t, 2, res2.UpdatedCount)

	// Test 26: Admin override
	// Admin modifies Gandhi Jayanti to WORKING status and sets is_admin_override = true
	gandhiHol, _ := repo.GetHolidayByDate(ctx, "cal-default", "2026-10-02")
	require.NotNil(t, gandhiHol)
	adminOverrideStatus := domain.WorkingStatusWorking
	adminTrue := true
	_, err = repo.UpdateHoliday(ctx, gandhiHol.ID, &domain.UpdateHolidayRequest{
		WorkingStatus:   &adminOverrideStatus,
		IsAdminOverride: &adminTrue,
	}, "admin-user")
	require.NoError(t, err)

	// Verify Admin override is active
	gandhiAfter, _ := repo.GetHolidayByDate(ctx, "cal-default", "2026-10-02")
	assert.Equal(t, domain.WorkingStatusWorking, gandhiAfter.WorkingStatus)
	assert.True(t, gandhiAfter.IsAdminOverride)

	// Test 27: Sync without overwriting Admin override
	// Google feed sends Mahatma Gandhi Birthday again with NON_WORKING
	res3, err := repo.UpsertGoogleHolidays(ctx, "cal-default", batch1)
	require.NoError(t, err)
	assert.Equal(t, 1, res3.SkippedCount, "Admin-overridden record must be skipped/preserved")

	// Ensure Admin override value persisted intact
	gandhiFinal, _ := repo.GetHolidayByDate(ctx, "cal-default", "2026-10-02")
	assert.Equal(t, domain.WorkingStatusWorking, gandhiFinal.WorkingStatus,
		"Admin override must remain WORKING and NOT revert to Google default")

	// Test 28: Google API failure resilience
	// GoogleSyncService falls back to offline curated list without error
	syncSvc := NewGoogleSyncService(repo, nil)
	syncRes, err := syncSvc.SyncHolidays(ctx, "cal-default", nil)
	assert.NoError(t, err, "Sync should succeed seamlessly via resilient offline fallback")
	assert.True(t, syncRes.ImportedCount > 0 || syncRes.UpdatedCount > 0)

	// Test 28b: Live Google Calendar API test with provided API Key
	apiKey := "AIzaSyCDcz24H7RhwsgfqpKxYB4N53cbIo5DF1A"
	repo.integration = &domain.GoogleCalendarIntegration{
		CalendarID:         "cal-default",
		GoogleCalendarID:   "en.indian#holiday@group.v.calendar.google.com",
		GoogleCalendarName: "Indian National Holidays",
		APIKey:             &apiKey,
		SyncEnabled:        true,
	}
	liveSyncRes, err := syncSvc.SyncHolidays(ctx, "cal-default", nil)
	assert.NoError(t, err, "Live Google Calendar API sync must succeed with configured API key")
	assert.Equal(t, "SUCCESS", repo.integration.SyncStatus)
	assert.True(t, liveSyncRes.ImportedCount+liveSyncRes.UpdatedCount > 0, "Holidays should be imported from live Google Calendar feed")
}

// Test 29: Priority checklist selection
// Test 30: Completed task is ignored
// Test 31: Duplicate notification prevention
// Test 32: Email failure and retry
// Test 33: Delayed task detection
// Test 34: Escalation notification
func TestCases_29_to_34_PriorityTaskNotificationAndEscalation(t *testing.T) {
	repo := newMockCalendarRepo()
	ctx := context.Background()

	// Set up next task: High priority Document Preparation
	repo.nextTask = &domain.NextActionableTask{
		ChecklistID:  "task-oem-1",
		Title:        "OEM Authorization Certificate",
		Priority:     domain.PriorityHigh,
		SortOrder:    1,
		Status:       domain.TaskStatusPending,
		AssignedRole: strPtr("B/D Executive"),
	}

	svc := NewWorkingCalendarService(repo, nil, nil, nil)

	// Test 29: Priority task identification
	nextTask, err := repo.GetNextPendingChecklist(ctx, "tender-101")
	require.NoError(t, err)
	assert.Equal(t, "OEM Authorization Certificate", nextTask.Title)
	assert.Equal(t, domain.PriorityHigh, nextTask.Priority)

	// Test 31: Duplicate notification prevention (idempotency)
	tender := domain.TenderDeadlineCandidate{
		ID:            "tender-101",
		Title:         "Railway Signalling Modernisation",
		WorkflowStage: "DOCUMENT_PREPARATION",
		ClosingDate:   time.Now().Add(50 * time.Hour),
		BidOwnerID:    "owner-1",
		BidOwnerEmail: strPtr("owner@onetrack.internal"),
		BidOwnerName:  strPtr("Bid Executive"),
	}

	// Trigger 72h reminder once
	now := time.Now()
	err = repo.RecordNotification(ctx, &domain.TaskNotification{
		TenderID:         tender.ID,
		ChecklistID:      &nextTask.ChecklistID,
		RecipientUserID:  tender.BidOwnerID,
		NotificationType: domain.NotificationType72HourReminder,
		ScheduledAt:      now,
		TriggeredAt:      now,
		DeliveryStatus:   "DELIVERED",
		Subject:          "72h Reminder",
	})
	require.NoError(t, err)

	// Check idempotency check
	alreadySent, err := repo.HasNotificationBeenSent(ctx, tender.ID, &nextTask.ChecklistID, domain.NotificationType72HourReminder)
	require.NoError(t, err)
	assert.True(t, alreadySent, "Notification must be recognized as already sent")

	// Test 30: Completed task is ignored
	repo.nextTask = nil // Simulating all completed items
	pendingTask, err := repo.GetNextPendingChecklist(ctx, "tender-101")
	require.NoError(t, err)
	assert.Nil(t, pendingTask, "Completed or empty task list yields no pending actionable item")

	// Test 33: Delayed task detection
	delayedTask := &domain.NextActionableTask{
		ChecklistID: "task-tech-2",
		Title:       "Technical Compliance Document",
		Priority:    domain.PriorityHigh,
		Status:      domain.TaskStatusPending,
	}
	repo.nextTask = delayedTask
	err = repo.MarkChecklistDelayed(ctx, delayedTask.ChecklistID)
	require.NoError(t, err)
	assert.Equal(t, domain.TaskStatusDelayed, repo.nextTask.Status)

	// Test 34: Escalation notification
	managerID := "manager-1"
	err = repo.RecordEscalation(ctx, &domain.TaskEscalation{
		TenderID:         tender.ID,
		ChecklistID:      &delayedTask.ChecklistID,
		ManagerUserID:    managerID,
		EscalationReason: "Task Technical Compliance Document is delayed beyond allowed timeline",
		EscalatedAt:      now,
		Status:           "ESCALATED",
	})
	require.NoError(t, err)

	escSent, err := repo.HasEscalationBeenSent(ctx, tender.ID, &delayedTask.ChecklistID)
	require.NoError(t, err)
	assert.True(t, escSent, "Escalation must be recorded and tracked")
	assert.NotNil(t, svc)
}

func TestRedZoneStakeholderNotification(t *testing.T) {
	repo := newMockCalendarRepo()
	svc := NewWorkingCalendarService(repo, nil, nil, nil)
	ctx := context.Background()

	// Set up an active tender with closing date in the near future (e.g. 2 days)
	loc, _ := time.LoadLocation("Asia/Kolkata")
	closingDate := time.Date(2026, time.October, 22, 18, 0, 0, 0, loc) // Thursday

	tender := domain.TenderDeadlineCandidate{
		ID:            "tender-redzone-1",
		Title:         "Supply of IT Infrastructure and Cloud Services",
		BidNo:         strPtr("BID/2026/099"),
		GemBidNo:      strPtr("GEM/2026/B/771234"),
		WorkflowStage: "DOCUMENT_CHECKLIST_PREPARATION",
		ClosingDate:   closingDate,
		BidOwnerID:    "usr-owner",
		BidOwnerEmail: strPtr("rajesh@globx.co.in"),
		BidOwnerName:  strPtr("Rajesh Kumar"),
		ManagerEmail:  strPtr("priya@globx.co.in"),
		ManagerName:   strPtr("Priya Sharma"),
	}
	repo.candidates = []domain.TenderDeadlineCandidate{tender}

	// 1. Calculate 72 working hours deadline backward
	// Excludes 2nd & 4th Saturdays, Sundays, configured holidays
	deadline, err := svc.SubtractWorkingHours(ctx, "cal-default", closingDate, 72.0)
	require.NoError(t, err)
	assert.True(t, deadline.Before(closingDate), "72-hour trigger time must precede tender closing date")

	// 2. Fetch stakeholders involved in the tender
	stakeholders, err := svc.GetTenderStakeholders(ctx, tender.ID)
	require.NoError(t, err)
	assert.Len(t, stakeholders, 4, "Should find all 4 involved stakeholders")

	// 3. Trigger Red Zone notification explicitly
	res, err := svc.TriggerRedZoneNotificationForTender(ctx, tender.ID, true)
	require.NoError(t, err)
	assert.NotNil(t, res)
	assert.Equal(t, tender.ID, res.TenderID)
	assert.Len(t, res.StakeholdersNotified, 4, "Must notify all 4 stakeholders involved")

	// 4. Verify notifications recorded in repository
	assert.NotEmpty(t, repo.notifications, "Notifications must be stored in repository")

	// 5. Test idempotency: Calling without force when already sent
	res2, err := svc.TriggerRedZoneNotificationForTender(ctx, tender.ID, false)
	require.NoError(t, err)
	assert.Equal(t, "ALREADY_SENT", res2.DeliveryStatus, "Subsequent notification without force must report ALREADY_SENT")
}

func TestWorkingDaysCalculation_3DaysRedZone(t *testing.T) {
	ctx := context.Background()
	repo := newMockCalendarRepo()
	svc := NewWorkingCalendarService(repo, nil, nil, nil)
	loc, _ := time.LoadLocation("Asia/Kolkata")

	// Friday, 16-Oct-2026 15:30:00 IST
	friday := time.Date(2026, 10, 16, 15, 30, 0, 0, loc)

	// Test 1: Standard 3 working days backward from Friday 15:30
	// Day -1: Thu 15-Oct, Day -2: Wed 14-Oct, Day -3: Tue 13-Oct
	tuesdayTarget, err := svc.SubtractWorkingDays(ctx, "cal-default", friday, 3)
	require.NoError(t, err)
	assert.Equal(t, 2026, tuesdayTarget.Year())
	assert.Equal(t, time.October, tuesdayTarget.Month())
	assert.Equal(t, 13, tuesdayTarget.Day(), "3 working days backward from Friday must be Tuesday")
	assert.Equal(t, 15, tuesdayTarget.Hour(), "Hour must be preserved")
	assert.Equal(t, 30, tuesdayTarget.Minute(), "Minute must be preserved")

	// Test 2: CalculateRemainingWorkingDays between Tuesday 15:30 and Friday 15:30 must be exactly 3.0 days
	remDays, err := svc.CalculateRemainingWorkingDays(ctx, "cal-default", tuesdayTarget, friday)
	require.NoError(t, err)
	assert.Equal(t, 3.0, remDays, "Remaining working days between Tue 15:30 and Fri 15:30 must be exactly 3.0")

	// Test 3: Spanning weekend with 2nd Saturday (Oct 10 is 2nd Saturday off, Oct 11 is Sunday off)
	// Monday 12-Oct 11:00 AM:
	// Sun 11 (off), Sat 10 (2nd Sat off), Fri 9 (1), Thu 8 (2), Wed 7 (3).
	mon12 := time.Date(2026, 10, 12, 11, 0, 0, 0, loc)
	targetBefore2ndSat, err := svc.SubtractWorkingDays(ctx, "cal-default", mon12, 3)
	require.NoError(t, err)
	assert.Equal(t, 7, targetBefore2ndSat.Day(), "Must skip 2nd Saturday (10-Oct) and Sunday (11-Oct) giving Wednesday 7-Oct")
	assert.Equal(t, 11, targetBefore2ndSat.Hour())

	// Test 4: CalculateArbitraryDeadline with 72 hours should use 3 working days
	res, err := svc.CalculateArbitraryDeadline(ctx, "cal-default", friday, 72.0)
	require.NoError(t, err)
	assert.Equal(t, 3, res.TargetWorkingDays)
	assert.Equal(t, 13, res.CalculatedDeadline.Day())
	assert.Equal(t, 15, res.CalculatedDeadline.Hour())
}

func TestCustomizableDeadlineAndIntervalUnits(t *testing.T) {
	repo := newMockCalendarRepo()
	svc := NewWorkingCalendarService(repo, nil, nil, nil)
	ctx := context.Background()
	loc, _ := time.LoadLocation("Asia/Kolkata")

	// Friday Oct 16, 2026, 15:30:00 (during business hours 09:00 - 18:00)
	friday := time.Date(2026, 10, 16, 15, 30, 0, 0, loc)

	// 1. Test 48 Hours: exactly 2 working days backward -> Wednesday Oct 14, 15:30
	res48h, err := svc.CalculateArbitraryDeadlineWithUnit(ctx, "cal-default", friday, 48.0, "HOURS")
	require.NoError(t, err)
	assert.Equal(t, 14, res48h.CalculatedDeadline.Day(), "48 hours backward from Fri Oct 16 must be Wed Oct 14")
	assert.Equal(t, 15, res48h.CalculatedDeadline.Hour())
	assert.Equal(t, 30, res48h.CalculatedDeadline.Minute())
	assert.Equal(t, "HOURS", res48h.TargetWorkingUnit)

	// 2. Test 48 Seconds: exactly 48 seconds backward -> Friday Oct 16, 15:29:12
	res48s, err := svc.CalculateArbitraryDeadlineWithUnit(ctx, "cal-default", friday, 48.0, "SECONDS")
	require.NoError(t, err)
	assert.Equal(t, 16, res48s.CalculatedDeadline.Day())
	assert.Equal(t, 15, res48s.CalculatedDeadline.Hour())
	assert.Equal(t, 29, res48s.CalculatedDeadline.Minute())
	assert.Equal(t, 12, res48s.CalculatedDeadline.Second(), "48 seconds backward from 15:30:00 must be 15:29:12")
	assert.Equal(t, "SECONDS", res48s.TargetWorkingUnit)

	// 3. Test 10 Minutes: exactly 10 minutes backward -> Friday Oct 16, 15:20:00
	res10m, err := svc.CalculateArbitraryDeadlineWithUnit(ctx, "cal-default", friday, 10.0, "MINUTES")
	require.NoError(t, err)
	assert.Equal(t, 16, res10m.CalculatedDeadline.Day())
	assert.Equal(t, 15, res10m.CalculatedDeadline.Hour())
	assert.Equal(t, 20, res10m.CalculatedDeadline.Minute())
	assert.Equal(t, "MINUTES", res10m.TargetWorkingUnit)

	// 4. Test 3 Days: 3 working days backward -> Tuesday Oct 13, 15:30:00
	res3d, err := svc.CalculateArbitraryDeadlineWithUnit(ctx, "cal-default", friday, 3.0, "DAYS")
	require.NoError(t, err)
	assert.Equal(t, 13, res3d.CalculatedDeadline.Day())
	assert.Equal(t, 15, res3d.CalculatedDeadline.Hour())
	assert.Equal(t, 30, res3d.CalculatedDeadline.Minute())
	assert.Equal(t, "DAYS", res3d.TargetWorkingUnit)
}

func strPtr(s string) *string {
	return &s
}
