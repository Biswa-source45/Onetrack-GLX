// Package preferences stores each user's own display choices (see migration 000067).
// Every logged-in user can read and change only their own.
package preferences

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"slices"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/onetrack/backend/internal/middleware"
	"github.com/onetrack/backend/internal/platform/response"
)

// allowed: the only keys a client can store, and the values each may take.
// Add a line here to add a preference; no migration needed.
var allowed = map[string][]string{
	"tenders_view": {"sheets", "cards"}, // how the Tenders page opens
}

// Normalize trims the input and rejects unknown keys and values.
func Normalize(in map[string]string) (map[string]string, error) {
	if len(in) == 0 {
		return nil, fmt.Errorf("nothing to save")
	}
	out := make(map[string]string, len(in))
	for k, v := range in {
		values, ok := allowed[k]
		if !ok {
			return nil, fmt.Errorf("unknown preference %q", k)
		}
		v = strings.TrimSpace(v)
		if !slices.Contains(values, v) {
			return nil, fmt.Errorf("%s must be one of: %s", k, strings.Join(values, ", "))
		}
		out[k] = v
	}
	return out, nil
}

type Handler struct{ pool *pgxpool.Pool }

func NewHandler(pool *pgxpool.Pool) *Handler { return &Handler{pool: pool} }

func RegisterRoutes(rg *gin.RouterGroup, h *Handler, auth *middleware.AuthMiddleware) {
	g := rg.Group("/preferences")
	g.Use(auth.Authenticate())
	g.GET("", h.get)
	g.PUT("", h.put)
}

// get returns what the user has chosen; anything they have not chosen is absent,
// and the page falls back to its own default.
func (h *Handler) get(c *gin.Context) {
	var raw []byte
	err := h.pool.QueryRow(c.Request.Context(),
		`SELECT COALESCE((SELECT prefs FROM auth.user_preferences WHERE user_id::text = $1), '{}'::jsonb)`,
		c.GetString("user_id")).Scan(&raw)
	if err != nil {
		fail(c, err)
		return
	}
	respond(c, raw)
}

// put merges the given choices into the user's stored ones and returns them all.
func (h *Handler) put(c *gin.Context) {
	var body map[string]string
	if err := c.ShouldBindJSON(&body); err != nil {
		response.BadRequest(c, "invalid request", nil)
		return
	}
	prefs, err := Normalize(body)
	if err != nil {
		response.BadRequest(c, err.Error(), nil)
		return
	}
	patch, _ := json.Marshal(prefs)
	var raw []byte
	err = h.pool.QueryRow(c.Request.Context(), `
		INSERT INTO auth.user_preferences (user_id, prefs) VALUES ($1::uuid, $2::jsonb)
		ON CONFLICT (user_id) DO UPDATE
		SET prefs = auth.user_preferences.prefs || EXCLUDED.prefs, updated_at = NOW()
		RETURNING prefs`, c.GetString("user_id"), string(patch)).Scan(&raw)
	if err != nil {
		fail(c, err)
		return
	}
	respond(c, raw)
}

func respond(c *gin.Context, raw []byte) {
	prefs := map[string]string{}
	_ = json.Unmarshal(raw, &prefs)
	response.Success(c, http.StatusOK, "Preferences", prefs)
}

func fail(c *gin.Context, err error) {
	log.Printf("[preferences] %v", err)
	response.InternalError(c, "Something went wrong, please try again")
}
