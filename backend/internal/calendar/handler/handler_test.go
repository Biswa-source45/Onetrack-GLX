package handler

import (
	"testing"

	"github.com/onetrack/backend/internal/calendar/domain"
	"github.com/stretchr/testify/assert"
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
