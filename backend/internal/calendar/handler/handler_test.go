package handler

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	authDomain "github.com/onetrack/backend/internal/auth/domain"
	"github.com/onetrack/backend/internal/calendar/domain"
	"github.com/onetrack/backend/internal/middleware"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// stubJWT maps a bearer token straight to its roles.
type stubJWT struct{ authDomain.JWTService }

func (stubJWT) IsTokenBlacklisted(context.Context, string) (bool, error) { return false, nil }
func (stubJWT) ValidateAccessToken(token string) (*authDomain.TokenClaims, error) {
	if token == "bad" {
		return nil, errors.New("invalid")
	}
	return &authDomain.TokenClaims{UserID: "u1", Roles: []string{token}}, nil
}

// Only the methods the engine endpoints use are implemented; any other call panics.
type stubRepo struct {
	domain.WorkingCalendarRepository
}

func (stubRepo) GetDefaultCalendar(context.Context) (*domain.WorkingCalendar, error) {
	return &domain.WorkingCalendar{SchedulerIntervalValue: 30, SchedulerIntervalUnit: "SECONDS"}, nil
}
func (stubRepo) IsEngineBaselined(context.Context) (bool, error) { return true, nil }

type stubSvc struct {
	domain.WorkingCalendarService
	by string
}

func (s *stubSvc) EvaluateActiveTenders(_ context.Context, by string) (*domain.EvaluationSummary, error) {
	s.by = by
	return &domain.EvaluationSummary{Evaluated: 2, RedZone: []domain.RedZoneEntry{}}, nil
}
func (s *stubSvc) EngineRuntime() domain.EngineRuntime {
	at := time.Date(2026, 10, 8, 10, 0, 0, 0, time.UTC)
	return domain.EngineRuntime{LastRun: &domain.LastRun{At: at, Trigger: "SCHEDULER", Summary: &domain.EvaluationSummary{Evaluated: 2, RedZone: []domain.RedZoneEntry{}}}}
}

func engineRouter(svc *stubSvc, enabled bool) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	RegisterCalendarRoutes(r.Group("/api/v1"), NewCalendarHandler(stubRepo{}, svc, nil, enabled), middleware.NewAuthMiddleware(stubJWT{}))
	return r
}

func call(r *gin.Engine, method, path, role string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, nil)
	req.Header.Set("Authorization", "Bearer "+role)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

func TestEngineStatusIsAdminOnly(t *testing.T) {
	r := engineRouter(&stubSvc{}, true)
	assert.Equal(t, http.StatusForbidden, call(r, "GET", "/api/v1/calendars/engine-status", "USER").Code)
	assert.Equal(t, http.StatusUnauthorized, call(r, "GET", "/api/v1/calendars/engine-status", "").Code)
	assert.Equal(t, http.StatusOK, call(r, "GET", "/api/v1/calendars/engine-status", "ADMIN").Code)
	assert.Equal(t, http.StatusOK, call(r, "GET", "/api/v1/calendars/engine-status", "SUPER_ADMIN").Code)
}

func TestEngineStatusShape(t *testing.T) {
	w := call(engineRouter(&stubSvc{}, true), "GET", "/api/v1/calendars/engine-status", "ADMIN")
	require.Equal(t, http.StatusOK, w.Code)

	var body struct {
		Data map[string]json.RawMessage `json:"data"`
	}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
	for _, k := range []string{"scheduler_enabled", "interval_value", "interval_unit", "cadence_seconds", "baselined", "next_run_at", "last_run"} {
		assert.Contains(t, body.Data, k)
	}
	assert.JSONEq(t, `true`, string(body.Data["scheduler_enabled"]))
	assert.JSONEq(t, `30`, string(body.Data["interval_value"]))
	assert.JSONEq(t, `"SECONDS"`, string(body.Data["interval_unit"]))
	assert.JSONEq(t, `30`, string(body.Data["cadence_seconds"]))
	assert.JSONEq(t, `true`, string(body.Data["baselined"]))
	assert.JSONEq(t, `null`, string(body.Data["next_run_at"]))

	var last struct {
		At      time.Time       `json:"at"`
		Trigger string          `json:"trigger"`
		Error   string          `json:"error"`
		Summary json.RawMessage `json:"summary"`
	}
	require.NoError(t, json.Unmarshal(body.Data["last_run"], &last))
	assert.Equal(t, "SCHEDULER", last.Trigger)
	assert.Empty(t, last.Error)
	assert.Contains(t, string(last.Summary), `"coverage"`)
	assert.Contains(t, string(last.Summary), `"red_zone":[]`)

	disabled := call(engineRouter(&stubSvc{}, false), "GET", "/api/v1/calendars/engine-status", "ADMIN")
	assert.Contains(t, disabled.Body.String(), `"scheduler_enabled":false`)
}

func TestManualEvaluationIsRecordedAsManual(t *testing.T) {
	svc := &stubSvc{}
	w := call(engineRouter(svc, true), "POST", "/api/v1/calendars/evaluate-deadlines", "ADMIN")
	require.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, domain.RunTriggerManual, svc.by)
	for _, k := range []string{`"escalated"`, `"window_days"`, `"coverage"`, `"total_active"`, `"submitted_or_resolved"`, `"red_zone"`} {
		assert.Contains(t, w.Body.String(), k)
	}
	assert.Equal(t, http.StatusForbidden, call(engineRouter(svc, true), "POST", "/api/v1/calendars/evaluate-deadlines", "USER").Code)
}

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
