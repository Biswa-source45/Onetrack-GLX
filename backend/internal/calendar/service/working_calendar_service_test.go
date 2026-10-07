package service

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"testing"
	"time"

	alertDomain "github.com/onetrack/backend/internal/alert/domain"
	"github.com/onetrack/backend/internal/calendar/domain"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

var ist = time.FixedZone("IST", 5*3600+1800)

// ── Mock repository ──────────────────────────────────────────────────────────

type mockCalendarRepo struct {
	calendar      *domain.WorkingCalendar
	calendars     map[string]*domain.WorkingCalendar
	holidays      map[string]*domain.Holiday
	exceptions    map[string]*domain.CalendarException
	notifications map[string]*domain.TaskNotification // tender|user|type
	nextTask      *domain.NextActionableTask
	candidates    []domain.TenderDeadlineCandidate
	stakeholders  []domain.TenderStakeholder
	syncLogs      []domain.GoogleCalendarSyncLog
	integration   *domain.GoogleCalendarIntegration

	baselined    bool
	lockBusy     bool
	claimErr     error
	cacheWrites  int
	failedClaims []string
}

func newMockCalendarRepo() *mockCalendarRepo {
	cal := &domain.WorkingCalendar{
		ID:                   "cal-default",
		Name:                 "OneTrack Corporate Working Calendar",
		Timezone:             "Asia/Kolkata",
		WorkingStartTime:     "09:00",
		WorkingEndTime:       "18:00",
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
		SundayWorking:        false,
		IsDefault:            true,
		DeadlineTriggerValue: 72,
		DeadlineTriggerUnit:  "HOURS",
	}
	return &mockCalendarRepo{
		calendar:      cal,
		calendars:     map[string]*domain.WorkingCalendar{cal.ID: cal},
		holidays:      map[string]*domain.Holiday{},
		exceptions:    map[string]*domain.CalendarException{},
		notifications: map[string]*domain.TaskNotification{},
		stakeholders: []domain.TenderStakeholder{
			{UserID: "usr-owner", FullName: "Rajesh Kumar", Email: "rajesh@globx.co.in", Roles: "Bid Owner"},
			{UserID: "usr-mgr", FullName: "Priya Sharma", Email: "priya@globx.co.in", Roles: "Reporting Manager"},
			{UserID: "usr-am", FullName: "Amit Patel", Email: "amit@globx.co.in", Roles: "Account Manager"},
			{UserID: "usr-pre", FullName: "Sunil Verma", Email: "sunil@globx.co.in", Roles: "Pre-Sales"},
		},
	}
}

func (m *mockCalendarRepo) GetDefaultCalendar(ctx context.Context) (*domain.WorkingCalendar, error) {
	return m.calendar, nil
}
func (m *mockCalendarRepo) GetCalendarByID(ctx context.Context, id string) (*domain.WorkingCalendar, error) {
	return m.calendars[id], nil
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
		if h.CalendarID == calendarID {
			list = append(list, *h)
		}
	}
	sort.Slice(list, func(i, j int) bool { return list[i].HolidayDate < list[j].HolidayDate })
	return list, nil
}
func (m *mockCalendarRepo) GetHolidayByID(ctx context.Context, id string) (*domain.Holiday, error) {
	return m.holidays[id], nil
}
func (m *mockCalendarRepo) CreateHoliday(ctx context.Context, h *domain.Holiday) (*domain.Holiday, error) {
	h.ID = fmt.Sprintf("hol-%d", len(m.holidays)+1)
	m.holidays[h.ID] = h
	return h, nil
}
func (m *mockCalendarRepo) UpdateHoliday(ctx context.Context, id string, req *domain.UpdateHolidayRequest, updatedBy string) (*domain.Holiday, error) {
	return m.holidays[id], nil
}
func (m *mockCalendarRepo) DeleteHoliday(ctx context.Context, id string) error {
	delete(m.holidays, id)
	return nil
}

// UpsertGoogleHolidays records what the sync handed over; the real SQL is not exercised here.
func (m *mockCalendarRepo) UpsertGoogleHolidays(ctx context.Context, calendarID string, holidays []domain.Holiday) (*domain.SyncResult, error) {
	for _, h := range holidays {
		hc := h
		hc.ID = "hol-sync-" + h.HolidayDate
		m.holidays[hc.ID] = &hc
	}
	return &domain.SyncResult{Status: "SUCCESS", ImportedCount: len(holidays)}, nil
}
func (m *mockCalendarRepo) ListExceptions(ctx context.Context, calendarID string) ([]domain.CalendarException, error) {
	var list []domain.CalendarException
	for _, e := range m.exceptions {
		if e.CalendarID == calendarID {
			list = append(list, *e)
		}
	}
	return list, nil
}
func (m *mockCalendarRepo) CreateException(ctx context.Context, exc *domain.CalendarException) (*domain.CalendarException, error) {
	m.exceptions[exc.ExceptionDate] = exc
	return exc, nil
}
func (m *mockCalendarRepo) DeleteException(ctx context.Context, id string) error { return nil }
func (m *mockCalendarRepo) GetGoogleIntegration(ctx context.Context, calendarID string) (*domain.GoogleCalendarIntegration, error) {
	if m.integration != nil {
		return m.integration, nil
	}
	return &domain.GoogleCalendarIntegration{
		ID: "mock-integration-1", CalendarID: calendarID,
		GoogleCalendarID: "en.indian#holiday@group.v.calendar.google.com", SyncEnabled: true,
	}, nil
}
func (m *mockCalendarRepo) SaveGoogleIntegration(ctx context.Context, g *domain.GoogleCalendarIntegration) (*domain.GoogleCalendarIntegration, error) {
	m.integration = g
	return g, nil
}
func (m *mockCalendarRepo) CreateSyncLog(ctx context.Context, l *domain.GoogleCalendarSyncLog) error {
	m.syncLogs = append(m.syncLogs, *l)
	return nil
}
func (m *mockCalendarRepo) ListSyncLogs(ctx context.Context, integrationID string, limit int) ([]domain.GoogleCalendarSyncLog, error) {
	return m.syncLogs, nil
}

func notifKey(tender, user, typ string) string { return tender + "|" + user + "|" + typ }

func (m *mockCalendarRepo) HasRedZoneNotificationBeenSent(ctx context.Context, tenderID string, deadline time.Time) (bool, error) {
	for _, n := range m.notifications {
		if n.TenderID == tenderID && n.ScheduledAt.Sub(deadline).Abs() <= 24*time.Hour {
			return true, nil
		}
	}
	return false, nil
}

// ClaimNotification mirrors the SQL: an existing row for the same deadline (±24h) blocks the claim unless forced.
func (m *mockCalendarRepo) ClaimNotification(ctx context.Context, n *domain.TaskNotification, force bool) (string, error) {
	if m.claimErr != nil {
		return "", m.claimErr
	}
	key := notifKey(n.TenderID, n.RecipientUserID, n.NotificationType)
	if ex, ok := m.notifications[key]; ok && !force && ex.ScheduledAt.Sub(n.ScheduledAt).Abs() <= 24*time.Hour {
		return "", nil
	}
	c := *n
	c.ID = "n-" + key
	c.DeliveryStatus = "SENT"
	m.notifications[key] = &c
	return c.ID, nil
}
func (m *mockCalendarRepo) FailNotification(ctx context.Context, id, errMsg string) error {
	m.failedClaims = append(m.failedClaims, id)
	for _, n := range m.notifications {
		if n.ID == id {
			n.DeliveryStatus = "FAILED"
		}
	}
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
func (m *mockCalendarRepo) IsEngineBaselined(ctx context.Context) (bool, error) {
	return m.baselined, nil
}
func (m *mockCalendarRepo) MarkEngineBaselined(ctx context.Context) error {
	m.baselined = true
	return nil
}
func (m *mockCalendarRepo) TryLockEvaluation(ctx context.Context) (func(), bool, error) {
	return func() {}, !m.lockBusy, nil
}
func (m *mockCalendarRepo) GetTenderStakeholders(ctx context.Context, tenderID string) ([]domain.TenderStakeholder, error) {
	return m.stakeholders, nil
}
func (m *mockCalendarRepo) GetNextPendingChecklist(ctx context.Context, tenderID string) (*domain.NextActionableTask, error) {
	return m.nextTask, nil
}
func (m *mockCalendarRepo) UpdateChecklistPriorityAndAssignment(ctx context.Context, checklistID string, req *domain.UpdateChecklistPriorityRequest) error {
	return nil
}

// UpdateTenderDeadlineCache behaves like the DB: the candidate's cached columns change with it.
func (m *mockCalendarRepo) UpdateTenderDeadlineCache(ctx context.Context, tenderID string, deadline time.Time, remainingHours float64) error {
	m.cacheWrites++
	for i := range m.candidates {
		if m.candidates[i].ID == tenderID {
			d, h := deadline, remainingHours
			m.candidates[i].CachedDeadline, m.candidates[i].CachedRemainingHours = &d, &h
		}
	}
	return nil
}
func (m *mockCalendarRepo) GetActiveTendersForDeadlineCheck(ctx context.Context, from, to time.Time) ([]domain.TenderDeadlineCandidate, error) {
	return m.candidates, nil
}
func (m *mockCalendarRepo) GetTenderCandidate(ctx context.Context, tenderID string) (*domain.TenderDeadlineCandidate, error) {
	for i := range m.candidates {
		if m.candidates[i].ID == tenderID {
			c := m.candidates[i]
			return &c, nil
		}
	}
	return nil, nil
}

// ── Mock alert service ───────────────────────────────────────────────────────

type mockAlertSvc struct {
	alertDomain.AlertService
	created []alertDomain.Alert
	err     error
}

func (a *mockAlertSvc) CreateAlert(ctx context.Context, alert *alertDomain.Alert) error {
	if a.err != nil {
		return a.err
	}
	a.created = append(a.created, *alert)
	return nil
}

// ── Helpers ──────────────────────────────────────────────────────────────────

// newSvc builds a service with a fixed clock.
func newSvc(repo *mockCalendarRepo, alerts *mockAlertSvc, now time.Time) *workingCalendarService {
	var a alertDomain.AlertService
	if alerts != nil {
		a = alerts
	}
	svc := NewWorkingCalendarService(repo, a, nil).(*workingCalendarService)
	svc.now = func() time.Time { return now }
	return svc
}

// Wed 14-Oct-2026 10:00 IST. A tender closing Fri 16-Oct 15:30 has its 72h
// (3 working day) trigger at Tue 13-Oct 15:30, so it is inside the window.
var testNow = time.Date(2026, 10, 14, 10, 0, 0, 0, ist)

func inWindowTender(id string) domain.TenderDeadlineCandidate {
	return domain.TenderDeadlineCandidate{
		ID:            id,
		Title:         "Supply of IT Infrastructure",
		WorkflowStage: "DOCUMENT_CHECKLIST_PREPARATION",
		ClosingDate:   time.Date(2026, 10, 16, 15, 30, 0, 0, ist),
	}
}

// ── Calendar rules ───────────────────────────────────────────────────────────

func TestWeekdaysAndSundayRules(t *testing.T) {
	svc := newSvc(newMockCalendarRepo(), nil, testNow)
	ctx := context.Background()

	for _, d := range []string{"2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09"} {
		date, _ := time.Parse("2006-01-02", d)
		ok, reason, err := svc.IsWorkingDay(ctx, "cal-default", date)
		require.NoError(t, err)
		assert.True(t, ok, d)
		assert.Contains(t, reason, "Working Day")
	}
	sun, _ := time.Parse("2006-01-02", "2026-10-04")
	ok, reason, err := svc.IsWorkingDay(ctx, "cal-default", sun)
	require.NoError(t, err)
	assert.False(t, ok)
	assert.Equal(t, "Sunday Holiday", reason)
}

func TestSaturdayRulesOctober2026(t *testing.T) {
	svc := newSvc(newMockCalendarRepo(), nil, testNow)
	for _, tt := range []struct {
		date    string
		num     int
		working bool
		reason  string
	}{
		{"2026-10-03", 1, true, "1st Saturday Working Day"},
		{"2026-10-10", 2, false, "2nd Saturday Holiday"},
		{"2026-10-17", 3, true, "3rd Saturday Working Day"},
		{"2026-10-24", 4, false, "4th Saturday Holiday"},
		{"2026-10-31", 5, true, "5th Saturday Working Day"},
	} {
		date, _ := time.Parse("2006-01-02", tt.date)
		assert.Equal(t, tt.num, svc.GetSaturdayNumber(date))
		ok, reason, err := svc.IsWorkingDay(context.Background(), "cal-default", date)
		require.NoError(t, err)
		assert.Equal(t, tt.working, ok, tt.date)
		assert.Equal(t, tt.reason, reason, tt.date)
	}
}

func TestHolidaysAndExceptions(t *testing.T) {
	repo := newMockCalendarRepo()
	repo.holidays["h1"] = &domain.Holiday{ID: "h1", CalendarID: "cal-default", HolidayDate: "2026-10-02", HolidayName: "Gandhi Jayanti",
		HolidayType: domain.HolidayTypeGovernment, WorkingStatus: domain.WorkingStatusNonWorking, IsActive: true}
	repo.holidays["h2"] = &domain.Holiday{ID: "h2", CalendarID: "cal-default", HolidayDate: "2026-10-14", HolidayName: "Company Day",
		HolidayType: domain.HolidayTypeCompany, WorkingStatus: domain.WorkingStatusNonWorking, IsActive: true}
	repo.holidays["h3"] = &domain.Holiday{ID: "h3", CalendarID: "cal-default", HolidayDate: "2026-10-15", HolidayName: "Inactive",
		WorkingStatus: domain.WorkingStatusNonWorking, IsActive: false}
	repo.exceptions["2026-10-10"] = &domain.CalendarException{CalendarID: "cal-default", ExceptionDate: "2026-10-10", ExceptionType: domain.ExceptionSpecialWorkingDay}
	repo.exceptions["2026-10-07"] = &domain.CalendarException{CalendarID: "cal-default", ExceptionDate: "2026-10-07", ExceptionType: domain.ExceptionSpecialNonWorkingDay}
	svc := newSvc(repo, nil, testNow)
	ctx := context.Background()

	check := func(date string, wantWorking bool, wantReason string) {
		d, _ := time.Parse("2006-01-02", date)
		ok, reason, err := svc.IsWorkingDay(ctx, "cal-default", d)
		require.NoError(t, err)
		assert.Equal(t, wantWorking, ok, date)
		assert.Contains(t, reason, wantReason, date)
	}
	check("2026-10-02", false, "Gandhi Jayanti")
	check("2026-10-14", false, "Company Day")
	check("2026-10-15", true, "Thursday")                 // inactive holiday ignored
	check("2026-10-10", true, "Special Working Day")      // 2nd Saturday opened by exception
	check("2026-10-07", false, "Special Non-Working Day") // Wednesday closed by exception
}

func TestMultipleCalendars(t *testing.T) {
	repo := newMockCalendarRepo()
	repo.calendars["cal-odisha"] = &domain.WorkingCalendar{
		ID: "cal-odisha", Name: "Odisha", Timezone: "Asia/Kolkata", WorkingStartTime: "10:00", WorkingEndTime: "17:00",
		MondayWorking: true, TuesdayWorking: true, WednesdayWorking: true, ThursdayWorking: true, FridayWorking: true,
	}
	repo.holidays["raja"] = &domain.Holiday{ID: "raja", CalendarID: "cal-odisha", HolidayDate: "2026-06-15", HolidayName: "Raja",
		WorkingStatus: domain.WorkingStatusNonWorking, IsActive: true}
	svc := newSvc(repo, nil, testNow)
	sat1, _ := time.Parse("2006-01-02", "2026-06-06")

	odisha, _, _ := svc.IsWorkingDay(context.Background(), "cal-odisha", sat1)
	corp, _, _ := svc.IsWorkingDay(context.Background(), "cal-default", sat1)
	assert.False(t, odisha)
	assert.True(t, corp)

	// The Odisha holiday must not leak into the default calendar.
	raja, _ := time.Parse("2006-01-02", "2026-06-15")
	ok, _, _ := svc.IsWorkingDay(context.Background(), "cal-default", raja)
	assert.True(t, ok)
}

// ── Working-time maths ───────────────────────────────────────────────────────

func TestSubtractWorkingHours(t *testing.T) {
	svc := newSvc(newMockCalendarRepo(), nil, testNow)
	ctx := context.Background()

	// 72 working hours = 8 working days of 9h: Tue 20-Oct 18:00 back to Mon 12-Oct 09:00,
	// skipping Sunday 18-Oct and using the working 3rd Saturday 17-Oct.
	closing := time.Date(2026, 10, 20, 18, 0, 0, 0, ist)
	got, err := svc.SubtractWorkingHours(ctx, "cal-default", closing, 72)
	require.NoError(t, err)
	assert.True(t, got.Equal(time.Date(2026, 10, 12, 9, 0, 0, 0, ist)), got)

	// A closing time after hours clamps to 18:00.
	got, err = svc.SubtractWorkingHours(ctx, "cal-default", time.Date(2026, 10, 20, 21, 0, 0, 0, ist), 72)
	require.NoError(t, err)
	assert.True(t, got.Equal(time.Date(2026, 10, 12, 9, 0, 0, 0, ist)), got)

	// Month, year and leap-day crossings.
	got, _ = svc.SubtractWorkingHours(ctx, "cal-default", time.Date(2026, 11, 4, 18, 0, 0, 0, ist), 72)
	assert.Equal(t, time.October, got.Month())
	got, _ = svc.SubtractWorkingHours(ctx, "cal-default", time.Date(2027, 1, 8, 18, 0, 0, 0, ist), 72)
	assert.Equal(t, 2026, got.Year())
	got, _ = svc.SubtractWorkingHours(ctx, "cal-default", time.Date(2028, 3, 2, 18, 0, 0, 0, ist), 27)
	assert.Equal(t, 29, got.Day())
	assert.Equal(t, time.February, got.Month())
}

func TestSubtractWorkingDaysKeepsTimeAndSkipsNonWorking(t *testing.T) {
	svc := newSvc(newMockCalendarRepo(), nil, testNow)
	ctx := context.Background()

	fri := time.Date(2026, 10, 16, 15, 30, 0, 0, ist)
	got, err := svc.SubtractWorkingDays(ctx, "cal-default", fri, 3)
	require.NoError(t, err)
	assert.True(t, got.Equal(time.Date(2026, 10, 13, 15, 30, 0, 0, ist)), got)

	// From Mon 12-Oct: Sun 11 and 2nd Saturday 10 are skipped -> Wed 7-Oct.
	got, err = svc.SubtractWorkingDays(ctx, "cal-default", time.Date(2026, 10, 12, 11, 0, 0, 0, ist), 3)
	require.NoError(t, err)
	assert.True(t, got.Equal(time.Date(2026, 10, 7, 11, 0, 0, 0, ist)), got)
}

func TestScanLimitReturnsErrorInsteadOfWrongDate(t *testing.T) {
	repo := newMockCalendarRepo()
	c := repo.calendar
	c.MondayWorking, c.TuesdayWorking, c.WednesdayWorking, c.ThursdayWorking, c.FridayWorking = false, false, false, false, false
	c.Saturday1Working, c.Saturday3Working, c.Saturday5Working = false, false, false
	svc := newSvc(repo, nil, testNow)
	ctx := context.Background()
	closing := time.Date(2026, 10, 16, 15, 30, 0, 0, ist)

	_, err := svc.SubtractWorkingDays(ctx, "cal-default", closing, 1)
	assert.ErrorIs(t, err, errScanLimit)
	_, err = svc.SubtractWorkingHours(ctx, "cal-default", closing, 5)
	assert.ErrorIs(t, err, errScanLimit)
	_, err = svc.CalculateRemainingWorkingHours(ctx, "cal-default", testNow, testNow.AddDate(4, 0, 0))
	assert.ErrorIs(t, err, errScanLimit)
}

func TestTriggerOrderingIsMonotonic(t *testing.T) {
	svc := newSvc(newMockCalendarRepo(), nil, testNow)
	ctx := context.Background()
	closing := time.Date(2026, 10, 16, 15, 30, 0, 0, ist) // Fri 15:30

	at := func(v float64, unit string) time.Time {
		res, err := svc.CalculateArbitraryDeadlineWithUnit(ctx, "cal-default", closing, v, unit)
		require.NoError(t, err)
		return res.CalculatedDeadline
	}
	d36, d48, d72 := at(36, "HOURS"), at(48, "HOURS"), at(72, "HOURS")

	// 36h = 1.5 working days: Thu 15-Oct 15:30 minus 4.5 working hours = Thu 11:00.
	assert.True(t, d36.Equal(time.Date(2026, 10, 15, 11, 0, 0, 0, ist)), d36)
	assert.True(t, d48.Equal(time.Date(2026, 10, 14, 15, 30, 0, 0, ist)), d48)
	assert.True(t, d72.Equal(time.Date(2026, 10, 13, 15, 30, 0, 0, ist)), d72)
	assert.True(t, d36.After(d48) && d48.After(d72), "a larger trigger must give an earlier deadline")

	assert.True(t, at(3, "DAYS").Equal(d72), "DAYS = that many working days")
	assert.True(t, at(24, "HOURS").After(d36))
	assert.True(t, at(12, "HOURS").After(at(24, "HOURS")))

	res, err := svc.CalculateArbitraryDeadline(ctx, "cal-default", closing, 72)
	require.NoError(t, err)
	assert.Equal(t, 3, res.TargetWorkingDays)
	assert.Equal(t, 27.0, res.TargetWorkingHours) // 3 working days x 9h
	assert.Equal(t, 9.0, res.WorkingDayHours)
}

func TestRemainingWorkingHours(t *testing.T) {
	svc := newSvc(newMockCalendarRepo(), nil, testNow)
	ctx := context.Background()

	// Tue 13-Oct 15:30 -> Fri 16-Oct 15:30: 2.5 + 9 + 9 + 6.5 = 27 working hours = 3 working days.
	from, to := time.Date(2026, 10, 13, 15, 30, 0, 0, ist), time.Date(2026, 10, 16, 15, 30, 0, 0, ist)
	h, err := svc.CalculateRemainingWorkingHours(ctx, "cal-default", from, to)
	require.NoError(t, err)
	assert.Equal(t, 27.0, h)
	d, err := svc.CalculateRemainingWorkingDays(ctx, "cal-default", from, to)
	require.NoError(t, err)
	assert.Equal(t, 3.0, d)

	// Fri 9-Oct 16:00 -> Mon 12-Oct 10:00 over a 2nd Saturday and a Sunday: 2h + 1h.
	h, err = svc.CalculateRemainingWorkingHours(ctx, "cal-default", time.Date(2026, 10, 9, 16, 0, 0, 0, ist), time.Date(2026, 10, 12, 10, 0, 0, 0, ist))
	require.NoError(t, err)
	assert.Equal(t, 3.0, h)

	// Nothing remains once closing has passed.
	h, _ = svc.CalculateRemainingWorkingHours(ctx, "cal-default", to, from)
	assert.Zero(t, h)

	// The tender result reports real working hours (23.5), not days x 24.
	repo := newMockCalendarRepo()
	repo.candidates = []domain.TenderDeadlineCandidate{inWindowTender("t1")}
	res, err := newSvc(repo, nil, testNow).CalculateTender72HourDeadline(ctx, "t1")
	require.NoError(t, err)
	assert.Equal(t, 23.5, res.RemainingWorkingHours)
	assert.InDelta(t, 2.61, res.RemainingWorkingDays, 0.001)
	assert.True(t, res.IsThresholdReached)
}

func TestThresholdLabelIsDerived(t *testing.T) {
	assert.Equal(t, "3 working days (72h)", thresholdLabel(72, "HOURS"))
	assert.Equal(t, "2 working days (48h)", thresholdLabel(48, "HOURS"))
	assert.Equal(t, "1.5 working days (36h)", thresholdLabel(36, "HOURS"))
	assert.Equal(t, "1 working day (24h)", thresholdLabel(24, "HOURS"))
	assert.Equal(t, "5 working days", thresholdLabel(5, "DAYS"))
}

// ── Deadline engine ──────────────────────────────────────────────────────────

func TestFirstRunBaselinesWithoutSending(t *testing.T) {
	repo := newMockCalendarRepo()
	repo.candidates = []domain.TenderDeadlineCandidate{inWindowTender("t1")}
	alerts := &mockAlertSvc{}
	svc := newSvc(repo, alerts, testNow)
	ctx := context.Background()

	sum, err := svc.EvaluateActiveTenders(ctx)
	require.NoError(t, err)
	assert.True(t, sum.Baselined)
	assert.Equal(t, 1, sum.InRedZone)
	assert.Empty(t, alerts.created, "the baseline run must not send anything")
	assert.Len(t, repo.notifications, 4, "one dedup row per stakeholder")
	assert.True(t, repo.baselined)

	// The next run finds the tender already recorded and still sends nothing.
	sum, err = svc.EvaluateActiveTenders(ctx)
	require.NoError(t, err)
	assert.False(t, sum.Baselined)
	assert.Empty(t, alerts.created)
}

func TestNewTenderAfterBaselineIsAlertedOnce(t *testing.T) {
	repo := newMockCalendarRepo()
	repo.baselined = true
	repo.nextTask = &domain.NextActionableTask{ChecklistID: "c1", Title: "OEM <b>Certificate</b>", Priority: "HIGH"}
	tender := inWindowTender("t1")
	tender.Title = `Rail <script>alert(1)</script> & Co`
	repo.candidates = []domain.TenderDeadlineCandidate{tender}
	alerts := &mockAlertSvc{}
	svc := newSvc(repo, alerts, testNow)
	ctx := context.Background()

	sum, err := svc.EvaluateActiveTenders(ctx)
	require.NoError(t, err)
	assert.Equal(t, 4, sum.Notified)
	require.Len(t, alerts.created, 4, "one alert (in-app + email) per stakeholder, no separate combined email")

	a := alerts.created[0]
	assert.Equal(t, "/dashboard/tenders/t1", a.Link)
	assert.Equal(t, "TENDER", a.Type)
	assert.NotContains(t, a.Message, "<script>", "tender title must be HTML-escaped")
	assert.Contains(t, a.Message, "&lt;script&gt;")
	assert.NotContains(t, a.Message, "<b>Certificate")
	assert.Contains(t, a.Message, "3 working days (72h)")
	assert.Contains(t, a.Message, "23.5 working hours")

	// Second tick: dedup holds, nothing more is sent.
	_, err = svc.EvaluateActiveTenders(ctx)
	require.NoError(t, err)
	assert.Len(t, alerts.created, 4)
	assert.Equal(t, 1, repo.cacheWrites, "unchanged deadline values are not rewritten")
}

func TestClaimIsDedupedPerRecipient(t *testing.T) {
	repo := newMockCalendarRepo()
	repo.baselined = true
	repo.candidates = []domain.TenderDeadlineCandidate{inWindowTender("t1")}
	alerts := &mockAlertSvc{}
	svc := newSvc(repo, alerts, testNow)
	ctx := context.Background()

	// One recipient was already claimed (e.g. by another instance): only the other three are alerted.
	_, _ = repo.ClaimNotification(ctx, &domain.TaskNotification{
		TenderID: "t1", RecipientUserID: "usr-owner", NotificationType: domain.NotificationTypeRedZoneDueDate,
		ScheduledAt: time.Date(2026, 10, 13, 15, 30, 0, 0, ist),
	}, false)
	tender := inWindowTender("t1")
	r, err := svc.loadRules(ctx, "")
	require.NoError(t, err)
	c, err := svc.compute(r, tender.ClosingDate, 72, "HOURS", testNow)
	require.NoError(t, err)

	out, err := svc.notifyTender(ctx, &tender, r, c, 72, "HOURS", false, false)
	require.NoError(t, err)
	assert.Len(t, out.notified, 3)
	assert.Len(t, alerts.created, 3)
}

func TestClaimFailureNeverSends(t *testing.T) {
	repo := newMockCalendarRepo()
	repo.baselined = true
	repo.claimErr = errors.New("db down")
	repo.candidates = []domain.TenderDeadlineCandidate{inWindowTender("t1")}
	alerts := &mockAlertSvc{}

	_, err := newSvc(repo, alerts, testNow).EvaluateActiveTenders(context.Background())
	require.NoError(t, err)
	assert.Empty(t, alerts.created, "no claim, no send")
}

func TestBaselineNotMarkedWhenClaimsFail(t *testing.T) {
	repo := newMockCalendarRepo()
	repo.claimErr = errors.New("db down")
	repo.candidates = []domain.TenderDeadlineCandidate{inWindowTender("t1")}

	_, err := newSvc(repo, &mockAlertSvc{}, testNow).EvaluateActiveTenders(context.Background())
	require.NoError(t, err)
	assert.False(t, repo.baselined, "a partial baseline must be retried, not trusted")
}

func TestAlertFailureIsRecordedAndNotRetried(t *testing.T) {
	repo := newMockCalendarRepo()
	repo.baselined = true
	repo.candidates = []domain.TenderDeadlineCandidate{inWindowTender("t1")}
	alerts := &mockAlertSvc{err: errors.New("alert store down")}
	svc := newSvc(repo, alerts, testNow)
	ctx := context.Background()

	_, err := svc.EvaluateActiveTenders(ctx)
	require.NoError(t, err)
	assert.Len(t, repo.failedClaims, 4)
	for _, n := range repo.notifications {
		assert.Equal(t, "FAILED", n.DeliveryStatus)
	}

	alerts.err = nil
	_, err = svc.EvaluateActiveTenders(ctx)
	require.NoError(t, err)
	assert.Empty(t, alerts.created, "a claimed (failed) recipient is not mass-retried every tick")
}

func TestPerRunCap(t *testing.T) {
	repo := newMockCalendarRepo()
	repo.baselined = true
	for i := 0; i < 60; i++ {
		repo.candidates = append(repo.candidates, inWindowTender(fmt.Sprintf("t%02d", i)))
	}
	alerts := &mockAlertSvc{}

	sum, err := newSvc(repo, alerts, testNow).EvaluateActiveTenders(context.Background())
	require.NoError(t, err)
	// The cap is checked between tenders: 13 tenders x 4 recipients = 52 >= 50 stops the run.
	assert.Equal(t, 52, sum.Notified)
	assert.Len(t, alerts.created, 52)
	assert.Less(t, len(alerts.created), 60*4)
}

func TestSkippedWhenAnotherInstanceHoldsTheLock(t *testing.T) {
	repo := newMockCalendarRepo()
	repo.baselined = true
	repo.lockBusy = true
	repo.candidates = []domain.TenderDeadlineCandidate{inWindowTender("t1")}
	alerts := &mockAlertSvc{}

	sum, err := newSvc(repo, alerts, testNow).EvaluateActiveTenders(context.Background())
	require.NoError(t, err)
	assert.True(t, sum.Skipped)
	assert.Empty(t, alerts.created)
	assert.Zero(t, repo.cacheWrites)
}

func TestTenderOutsideWindowIsNotAlerted(t *testing.T) {
	repo := newMockCalendarRepo()
	repo.baselined = true
	far := inWindowTender("t1")
	far.ClosingDate = time.Date(2026, 10, 30, 15, 30, 0, 0, ist) // trigger is still in the future
	repo.candidates = []domain.TenderDeadlineCandidate{far}
	alerts := &mockAlertSvc{}

	sum, err := newSvc(repo, alerts, testNow).EvaluateActiveTenders(context.Background())
	require.NoError(t, err)
	assert.Equal(t, 1, sum.Evaluated)
	assert.Zero(t, sum.InRedZone)
	assert.Empty(t, alerts.created)
}

func TestManualTrigger(t *testing.T) {
	repo := newMockCalendarRepo()
	repo.candidates = []domain.TenderDeadlineCandidate{inWindowTender("t1")}
	alerts := &mockAlertSvc{}
	svc := newSvc(repo, alerts, testNow)
	ctx := context.Background()

	res, err := svc.TriggerRedZoneNotificationForTender(ctx, "t1", false)
	require.NoError(t, err)
	assert.Equal(t, "SENT", res.DeliveryStatus)
	assert.Len(t, res.StakeholdersNotified, 4)
	assert.Len(t, alerts.created, 4)

	res, err = svc.TriggerRedZoneNotificationForTender(ctx, "t1", false)
	require.NoError(t, err)
	assert.Equal(t, "ALREADY_SENT", res.DeliveryStatus)
	assert.Len(t, alerts.created, 4)

	res, err = svc.TriggerRedZoneNotificationForTender(ctx, "t1", true)
	require.NoError(t, err)
	assert.Equal(t, "SENT", res.DeliveryStatus)
	assert.Len(t, alerts.created, 8, "force re-sends")

	_, err = svc.TriggerRedZoneNotificationForTender(ctx, "missing", false)
	assert.ErrorIs(t, err, domain.ErrTenderNotFound)

	// Before its trigger time a tender is not in the red zone.
	early := newSvc(repo, alerts, time.Date(2026, 10, 12, 10, 0, 0, 0, ist))
	res, err = early.TriggerRedZoneNotificationForTender(ctx, "t1", true)
	require.NoError(t, err)
	assert.Equal(t, "NOT_IN_RED_ZONE", res.DeliveryStatus)
	assert.Len(t, alerts.created, 8)
}

func TestBadStoredTriggerFallsBackTo72Hours(t *testing.T) {
	cal := &domain.WorkingCalendar{DeadlineTriggerValue: 48, DeadlineTriggerUnit: "SECONDS"}
	v, u := trigger(cal)
	assert.Equal(t, 72.0, v)
	assert.Equal(t, "HOURS", u)
}
