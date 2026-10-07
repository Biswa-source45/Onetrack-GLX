package domain

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func strp(s string) *string   { return &s }
func f64p(f float64) *float64 { return &f }
func intp(i int) *int         { return &i }

func TestUpdateCalendarRequestValidate(t *testing.T) {
	cur := &WorkingCalendar{WorkingStartTime: "09:00", WorkingEndTime: "18:00", DeadlineTriggerValue: 72, DeadlineTriggerUnit: "HOURS"}

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
		"retired unit":           {UpdateCalendarRequest{DeadlineTriggerUnit: strp("SECONDS")}, true},
		"days trigger":           {UpdateCalendarRequest{DeadlineTriggerValue: f64p(5), DeadlineTriggerUnit: strp("DAYS")}, false},
		"days trigger too large": {UpdateCalendarRequest{DeadlineTriggerValue: f64p(MaxTriggerDays + 1), DeadlineTriggerUnit: strp("DAYS")}, true},
		"interval below 1":       {UpdateCalendarRequest{SchedulerIntervalValue: intp(0)}, true},
		"interval above a day":   {UpdateCalendarRequest{SchedulerIntervalValue: intp(1441)}, true},
	} {
		t.Run(name, func(t *testing.T) {
			req := tc.req
			err := req.Validate(cur)
			assert.Equal(t, tc.wantErr, err != nil, "%v", err)
		})
	}
}

func TestValidateTriggerNormalisesUnit(t *testing.T) {
	u, err := ValidateTrigger(72, " hours ")
	assert.NoError(t, err)
	assert.Equal(t, "HOURS", u)
	u, err = ValidateTrigger(3, "")
	assert.NoError(t, err)
	assert.Equal(t, "HOURS", u)
}
