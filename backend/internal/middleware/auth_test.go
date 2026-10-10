package middleware

import (
	"context"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/onetrack/backend/internal/auth/domain"
)

// fakeJWT treats the bearer token as the caller's user id and returns the
// claims registered for it.
type fakeJWT struct {
	claims map[string]*domain.TokenClaims
}

func (f fakeJWT) GenerateTokenPair(domain.TokenClaims) (*domain.TokenPair, error) { return nil, nil }
func (f fakeJWT) ValidateAccessToken(t string) (*domain.TokenClaims, error) {
	return f.claims[t], nil
}
func (f fakeJWT) ValidateRefreshToken(string) (*domain.TokenClaims, error) { return nil, nil }
func (f fakeJWT) BlacklistToken(context.Context, string, int64) error      { return nil }
func (f fakeJWT) IsTokenBlacklisted(context.Context, string) (bool, error) { return false, nil }

func call(r *gin.Engine, method, path, as string) int {
	req := httptest.NewRequest(method, path, nil)
	req.Header.Set("Authorization", "Bearer "+as)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w.Code
}

func TestOrganisationRoleGating(t *testing.T) {
	gin.SetMode(gin.TestMode)
	m := NewAuthMiddleware(fakeJWT{claims: map[string]*domain.TokenClaims{
		// Bid Executive: user.edit, but no admin tier.
		"be": {UserID: "be", Roles: []string{"BID_EXECUTIVE"}, Permissions: []string{"user.edit", "bid.edit"}},
		// Managing Director: admin.system -> every permission; acts as ADMIN.
		"md": {UserID: "md", Roles: []string{"MANAGING_DIRECTOR"}, Permissions: []string{"admin.system"}},
		// Bid Executive who is also a Finance Executive.
		"befe": {UserID: "befe", Roles: []string{"BID_EXECUTIVE", "FINANCE_EXECUTIVE"}, Permissions: []string{"bid.edit"}},
		// Delivery Manager acts as MANAGER but holds no bid.edit.
		"dm": {UserID: "dm", Roles: []string{"DELIVERY_MANAGER"}, Permissions: []string{"bid.view", "user.edit"}},
	}})

	r := gin.New()
	r.Use(m.Authenticate())
	r.PATCH("/users/:id", m.RequirePermission("user.edit"), m.RequireSelfOrAnyRole("SUPER_ADMIN", "ADMIN"), func(c *gin.Context) { c.Status(200) })
	r.PATCH("/force-reset", m.RequireAnyRole("SUPER_ADMIN", "ADMIN"), func(c *gin.Context) { c.Status(200) })
	r.PUT("/emd", m.RequireAnyRole("SUPER_ADMIN", "ADMIN", "FINANCE"), func(c *gin.Context) { c.Status(200) })
	r.PUT("/stages", m.RequireAnyRole("SUPER_ADMIN", "ADMIN", "MANAGER"), m.RequirePermission("bid.edit"), func(c *gin.Context) { c.Status(200) })

	for _, tc := range []struct {
		name, method, path, as string
		want                   int
	}{
		{"BE edits own profile", "PATCH", "/users/be", "be", 200},
		{"BE cannot edit someone else", "PATCH", "/users/md", "be", 403},
		{"MD edits anyone", "PATCH", "/users/be", "md", 200},
		{"BE cannot force-reset", "PATCH", "/force-reset", "be", 403},
		{"MD can force-reset (acts as ADMIN)", "PATCH", "/force-reset", "md", 200},
		{"BE+FE passes the Finance-gated EMD route", "PUT", "/emd", "befe", 200},
		{"BE alone does not", "PUT", "/emd", "be", 403},
		{"DM acts as MANAGER but lacks bid.edit", "PUT", "/stages", "dm", 403},
	} {
		if got := call(r, tc.method, tc.path, tc.as); got != tc.want {
			t.Errorf("%s: got %d, want %d", tc.name, got, tc.want)
		}
	}
}
