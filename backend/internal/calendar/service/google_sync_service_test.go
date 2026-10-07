package service

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/onetrack/backend/internal/calendar/domain"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// googleFixture serves a canned Google Calendar response and records the key it was called with.
func googleFixture(t *testing.T, status int, body string, gotKey *string) *googleSyncService {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if gotKey != nil {
			*gotKey = r.URL.Query().Get("key")
		}
		w.WriteHeader(status)
		_, _ = w.Write([]byte(body))
	}))
	t.Cleanup(srv.Close)

	repo := newMockCalendarRepo()
	svc := NewGoogleSyncService(repo, nil, "env-test-key").(*googleSyncService)
	svc.baseURL = srv.URL
	return svc
}

func syncRepo(s *googleSyncService) *mockCalendarRepo { return s.repo.(*mockCalendarRepo) }

const feed = `{"items":[
 {"id":"e1","summary":"Republic Day","description":"Public holiday","start":{"date":"2026-01-26"}},
 {"id":"e2","summary":"Valentine's Day","description":"Observance\nTo hide observances, go to Google Calendar Settings","start":{"date":"2026-02-14"}},
 {"id":"e3","summary":"Regional Festival","description":"","start":{"date":"2026-03-04"}},
 {"id":"e4","summary":"Duplicate Same Day","description":"Public holiday","start":{"date":"2026-01-26"}}
]}`

func TestGoogleSyncImportsPublicHolidaysOnly(t *testing.T) {
	var key string
	s := googleFixture(t, http.StatusOK, feed, &key)

	res, err := s.SyncHolidays(context.Background(), "cal-default", nil)
	require.NoError(t, err)

	assert.Equal(t, "SUCCESS", res.Status)
	assert.Equal(t, "env-test-key", key, "the env key is the primary source")
	repo := syncRepo(s)
	assert.Equal(t, "SUCCESS", repo.integration.SyncStatus)

	got := map[string]domain.Holiday{}
	for _, h := range repo.holidays {
		got[h.HolidayDate] = *h
	}
	require.Len(t, got, 2, "observances and same-day duplicates are not imported")
	assert.Equal(t, "Republic Day", got["2026-01-26"].HolidayName)
	assert.Equal(t, domain.HolidayTypeGovernment, got["2026-01-26"].HolidayType)
	assert.Equal(t, domain.PriorityHigh, got["2026-01-26"].Priority)
	assert.Equal(t, domain.HolidayTypeRegional, got["2026-03-04"].HolidayType)
	assert.Equal(t, domain.PriorityMedium, got["2026-03-04"].Priority)
}

func TestGoogleSyncFailsWithoutFabricatingHolidays(t *testing.T) {
	for name, tc := range map[string]struct {
		status int
		body   string
	}{
		"server error": {http.StatusInternalServerError, `{"error":"boom"}`},
		"forbidden":    {http.StatusForbidden, `{"error":"bad key"}`},
		"not found":    {http.StatusNotFound, `{}`},
		"empty feed":   {http.StatusOK, `{"items":[]}`},
		"only observances": {http.StatusOK,
			`{"items":[{"id":"x","summary":"Some Day","description":"Observance","start":{"date":"2026-05-05"}}]}`},
		"bad json": {http.StatusOK, `not json`},
	} {
		t.Run(name, func(t *testing.T) {
			s := googleFixture(t, tc.status, tc.body, nil)

			res, err := s.SyncHolidays(context.Background(), "cal-default", nil)
			require.NoError(t, err)

			assert.Equal(t, "FAILED", res.Status)
			repo := syncRepo(s)
			assert.Empty(t, repo.holidays, "nothing is imported or invented on failure")
			assert.Equal(t, "FAILED", repo.integration.SyncStatus)
			require.NotNil(t, repo.integration.LastError)
			require.Len(t, repo.syncLogs, 1)
			assert.Equal(t, "FAILED", repo.syncLogs[0].Status)
		})
	}
}

func TestGoogleSyncFailsWhenUnreachable(t *testing.T) {
	s := googleFixture(t, http.StatusOK, feed, nil)
	s.baseURL = "http://127.0.0.1:1" // nothing listens here

	res, err := s.SyncHolidays(context.Background(), "cal-default", nil)
	require.NoError(t, err)
	assert.Equal(t, "FAILED", res.Status)
	assert.Empty(t, syncRepo(s).holidays)
	assert.NotContains(t, res.Message, "env-test-key", "the key must never leak into messages")
}

func TestGoogleSyncKeySources(t *testing.T) {
	// No env key: a key stored on the integration is the fallback.
	var key string
	s := googleFixture(t, http.StatusOK, feed, &key)
	s.envAPIKey = ""
	stored := "stored-db-key"
	syncRepo(s).integration = &domain.GoogleCalendarIntegration{ID: "i1", CalendarID: "cal-default", APIKey: &stored}
	res, err := s.SyncHolidays(context.Background(), "cal-default", nil)
	require.NoError(t, err)
	assert.Equal(t, "SUCCESS", res.Status)
	assert.Equal(t, "stored-db-key", key)

	// No key anywhere: FAILED, no request needed.
	s2 := googleFixture(t, http.StatusOK, feed, nil)
	s2.envAPIKey = ""
	res, err = s2.SyncHolidays(context.Background(), "cal-default", nil)
	require.NoError(t, err)
	assert.Equal(t, "FAILED", res.Status)
	assert.Contains(t, res.Message, "API key")
}
