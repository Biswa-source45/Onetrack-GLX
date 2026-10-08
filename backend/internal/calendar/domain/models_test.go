package domain

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func strp(s string) *string   { return &s }
func f64p(f float64) *float64 { return &f }
func intp(i int) *int         { return &i }

func TestUpdateCalendarRequestValidate(t *testing.T) {
	cur := &WorkingCalendar{WorkingStartTime: "09:00", WorkingEndTime: "18:00", DeadlineTriggerValue: 72, DeadlineTriggerUnit: "HOURS",
		SchedulerIntervalValue: 10, SchedulerIntervalUnit: "MINUTES"}

	for name, tc := range map[string]struct {
		req     UpdateCalendarRequest
		wantErr bool
	}{
		"empty request keeps everything": {UpdateCalendarRequest{}, false},
		"valid full update": {UpdateCalendarRequest{Name: strp("Corp"), WorkingStartTime: strp("08:30"), WorkingEndTime: strp("17:30"),
			DeadlineTriggerValue: f64p(48), DeadlineTriggerUnit: strp("hours"), SchedulerIntervalValue: intp(5)}, false},
		"blank name":             {UpdateCalendarRequest{Name: strp("  ")}, true},
		"bad time format":        {UpdateCalendarRequest{WorkingStartTime: strp("9am")}, true},
		"end before start":       {UpdateCalendarRequest{WorkingEndTime: strp("08:00")}, true},
		"end equals start":       {UpdateCalendarRequest{WorkingStartTime: strp("18:00")}, true},
		"zero trigger":           {UpdateCalendarRequest{DeadlineTriggerValue: f64p(0)}, true},
		"negative trigger":       {UpdateCalendarRequest{DeadlineTriggerValue: f64p(-3)}, true},
		"trigger beyond bound":   {UpdateCalendarRequest{DeadlineTriggerValue: f64p(24*MaxTriggerDays + 1)}, true},
		"unknown unit":           {UpdateCalendarRequest{DeadlineTriggerUnit: strp("WEEKS")}, true},
		"days trigger":           {UpdateCalendarRequest{DeadlineTriggerValue: f64p(5), DeadlineTriggerUnit: strp("DAYS")}, false},
		"days trigger too large": {UpdateCalendarRequest{DeadlineTriggerValue: f64p(MaxTriggerDays + 1), DeadlineTriggerUnit: strp("DAYS")}, true},
		"interval below 1":       {UpdateCalendarRequest{SchedulerIntervalValue: intp(0)}, true},
		"interval above a day":   {UpdateCalendarRequest{SchedulerIntervalValue: intp(1441)}, true},

		"48 seconds":          {UpdateCalendarRequest{DeadlineTriggerValue: f64p(48), DeadlineTriggerUnit: strp("seconds")}, false},
		"seconds upper bound": {UpdateCalendarRequest{DeadlineTriggerValue: f64p(86400), DeadlineTriggerUnit: strp("SECONDS")}, false},
		"seconds too large":   {UpdateCalendarRequest{DeadlineTriggerValue: f64p(86401), DeadlineTriggerUnit: strp("SECONDS")}, true},
		"seconds below 1":     {UpdateCalendarRequest{DeadlineTriggerValue: f64p(0.5), DeadlineTriggerUnit: strp("SECONDS")}, true},
		"30 minutes":          {UpdateCalendarRequest{DeadlineTriggerValue: f64p(30), DeadlineTriggerUnit: strp("MINUTES")}, false},
		"minutes upper bound": {UpdateCalendarRequest{DeadlineTriggerValue: f64p(43200), DeadlineTriggerUnit: strp("MINUTES")}, false},
		"minutes too large":   {UpdateCalendarRequest{DeadlineTriggerValue: f64p(43201), DeadlineTriggerUnit: strp("MINUTES")}, true},
		"unit alone keeps the stored value (72 seconds)": {UpdateCalendarRequest{DeadlineTriggerUnit: strp("SECONDS")}, false},
		"hours bound unchanged":                          {UpdateCalendarRequest{DeadlineTriggerValue: f64p(24 * MaxTriggerDays), DeadlineTriggerUnit: strp("HOURS")}, false},

		"interval in seconds":       {UpdateCalendarRequest{SchedulerIntervalValue: intp(30), SchedulerIntervalUnit: strp("seconds")}, false},
		"interval seconds floor":    {UpdateCalendarRequest{SchedulerIntervalValue: intp(5), SchedulerIntervalUnit: strp("SECONDS")}, false},
		"interval below 5 seconds":  {UpdateCalendarRequest{SchedulerIntervalValue: intp(4), SchedulerIntervalUnit: strp("SECONDS")}, true},
		"interval above an hour":    {UpdateCalendarRequest{SchedulerIntervalValue: intp(3601), SchedulerIntervalUnit: strp("SECONDS")}, true},
		"interval bad unit":         {UpdateCalendarRequest{SchedulerIntervalValue: intp(5), SchedulerIntervalUnit: strp("HOURS")}, true},
		"interval unit alone":       {UpdateCalendarRequest{SchedulerIntervalUnit: strp("MINUTES")}, false},
		"escalation delay":          {UpdateCalendarRequest{EscalationDelayHours: intp(8)}, false},
		"escalation delay too low":  {UpdateCalendarRequest{EscalationDelayHours: intp(0)}, true},
		"escalation delay too high": {UpdateCalendarRequest{EscalationDelayHours: intp(721)}, true},
	} {
		t.Run(name, func(t *testing.T) {
			req := tc.req
			err := req.Validate(cur)
			assert.Equal(t, tc.wantErr, err != nil, "%v", err)
		})
	}
}

func TestSchedulerIntervalCombinesValueAndUnit(t *testing.T) {
	for _, tc := range []struct {
		value int
		unit  string
		want  time.Duration
	}{
		{30, "SECONDS", 30 * time.Second},
		{5, "MINUTES", 5 * time.Minute},
		{1440, "MINUTES", 24 * time.Hour},
		{3, "", 3 * time.Minute}, // legacy rows
		{0, "MINUTES", DefaultSchedulerInterval},
		{4, "SECONDS", DefaultSchedulerInterval},
		{5, "DAYS", DefaultSchedulerInterval},
	} {
		c := &WorkingCalendar{SchedulerIntervalValue: tc.value, SchedulerIntervalUnit: tc.unit}
		assert.Equal(t, tc.want, c.SchedulerInterval(), "%d %q", tc.value, tc.unit)
	}
}

func TestValidateIntervalNormalisesUnit(t *testing.T) {
	u, err := ValidateInterval(30, " seconds ")
	assert.NoError(t, err)
	assert.Equal(t, "SECONDS", u)
	u, err = ValidateInterval(5, "")
	assert.NoError(t, err)
	assert.Equal(t, "MINUTES", u)
	_, err = ValidateInterval(1441, "")
	assert.Error(t, err)
}

func TestValidateTriggerNormalisesUnit(t *testing.T) {
	u, err := ValidateTrigger(72, " hours ")
	assert.NoError(t, err)
	assert.Equal(t, "HOURS", u)
	u, err = ValidateTrigger(3, "")
	assert.NoError(t, err)
	assert.Equal(t, "HOURS", u)
}
