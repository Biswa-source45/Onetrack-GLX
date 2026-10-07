package handler

import (
	"testing"
	"time"

	"github.com/onetrack/backend/internal/calendar/domain"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMaskIntegrationNeverExposesKey(t *testing.T) {
	key := "AIzaSyExampleKey1234"
	g := &domain.GoogleCalendarIntegration{ID: "i1", APIKey: &key}

	m := maskIntegration(g)
	assert.Nil(t, m.APIKey)
	assert.True(t, m.APIKeySet)
	assert.Equal(t, "1234", m.APIKeyHint)
	assert.NotNil(t, g.APIKey, "the stored object is untouched")

	none := maskIntegration(&domain.GoogleCalendarIntegration{})
	assert.False(t, none.APIKeySet)
	assert.Empty(t, none.APIKeyHint)
}

func TestIsRealAPIKeyRejectsPlaceholders(t *testing.T) {
	assert.True(t, isRealAPIKey("AIzaSyExample-Key_123"))
	for _, placeholder := range []string{"", "••••••••", "AIzaSyAB...XYZ", "AIza****1234", "key with space"} {
		assert.False(t, isRealAPIKey(placeholder), placeholder)
	}
}

func TestParseClosingUsesCalendarZoneForNaiveValues(t *testing.T) {
	ist := time.FixedZone("IST", 5*3600+1800)

	naive, err := parseClosing("2026-10-16T15:30", ist)
	require.NoError(t, err)
	assert.True(t, naive.Equal(time.Date(2026, 10, 16, 15, 30, 0, 0, ist)), naive)

	explicit, err := parseClosing("2026-10-16T15:30:00Z", ist)
	require.NoError(t, err)
	assert.True(t, explicit.Equal(time.Date(2026, 10, 16, 15, 30, 0, 0, time.UTC)), explicit)

	_, err = parseClosing("16/10/2026", ist)
	assert.Error(t, err)
}
