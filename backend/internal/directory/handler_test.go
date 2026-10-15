package directory

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestEntryNormalize(t *testing.T) {
	in := EntryInput{Name: "  IIT Bhubaneswar ", Sector: " Institute ", Website: "https://iitbbs.ac.in"}
	if err := in.Normalize(); err != nil || in.Name != "IIT Bhubaneswar" || in.Sector != "Institute" {
		t.Fatalf("ok case: %v %+v", err, in)
	}
	for name, bad := range map[string]EntryInput{
		"no name":     {Name: "  "},
		"bad website": {Name: "a", Website: "iitbbs.ac.in"},
		"js website":  {Name: "a", Website: "javascript:alert(1)"},
		"long notes":  {Name: "a", Notes: strings.Repeat("x", 2001)},
	} {
		if err := bad.Normalize(); err == nil {
			t.Errorf("%s: want error", name)
		}
	}
}

func TestContactNormalize(t *testing.T) {
	in := ContactInput{Name: " Asha ", Email: " Asha@Example.COM ", Phone: "+91 98765 43210"}
	if err := in.Normalize(); err != nil || in.Email != "asha@example.com" || in.Name != "Asha" {
		t.Fatalf("ok case: %v %+v", err, in)
	}
	for name, bad := range map[string]ContactInput{
		"no name":      {Name: ""},
		"bad email":    {Name: "a", Email: "asha@"},
		"name in mail": {Name: "a", Email: "Asha <a@b.com>"},
		"short phone":  {Name: "a", Phone: "123"},
	} {
		if err := bad.Normalize(); err == nil {
			t.Errorf("%s: want error", name)
		}
	}
	empty := ContactInput{Name: "x"}
	if err := empty.Normalize(); err != nil {
		t.Errorf("email and phone are optional: %v", err)
	}
}

// The role gate decides before any database is touched.
func TestKindGate(t *testing.T) {
	gin.SetMode(gin.TestMode)
	run := func(kind string, roles []string) int {
		r := gin.New()
		r.GET("/:kind", func(c *gin.Context) { c.Set("roles", roles) }, kindGate, func(c *gin.Context) {
			c.String(http.StatusOK, c.GetString(ctxKind))
		})
		w := httptest.NewRecorder()
		r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/"+kind, nil))
		return w.Code
	}
	cases := []struct {
		kind  string
		roles []string
		want  int
	}{
		{"accounts", []string{"SALES_MANAGER", "ACCOUNT_MANAGER"}, 200},
		{"oems", []string{"PRESALES_MANAGER", "MANAGER", "PRE_SALES"}, 200},
		{"accounts", []string{"PRE_SALES"}, 403},
		{"oems", []string{"ACCOUNT_MANAGER"}, 403},
		{"accounts", []string{"SUPER_ADMIN", "ADMIN"}, 403},
		{"leads", []string{"ACCOUNT_MANAGER"}, 404},
	}
	for _, c := range cases {
		if got := run(c.kind, c.roles); got != c.want {
			t.Errorf("%s %v: got %d want %d", c.kind, c.roles, got, c.want)
		}
	}
}
