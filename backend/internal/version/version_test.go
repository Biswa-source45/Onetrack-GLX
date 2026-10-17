package version

import (
	"encoding/json"
	"os"
	"regexp"
	"testing"
)

func TestCurrentIsSemverAndMatchesFrontend(t *testing.T) {
	if !regexp.MustCompile(`^\d+\.\d+\.\d+$`).MatchString(Current) {
		t.Fatalf("version %q is not MAJOR.MINOR.PATCH", Current)
	}
	raw, err := os.ReadFile("../../../frontend/package.json")
	if err != nil {
		t.Skipf("frontend not in this checkout: %v", err)
	}
	var pkg struct {
		Version string `json:"version"`
	}
	if err := json.Unmarshal(raw, &pkg); err != nil {
		t.Fatal(err)
	}
	if pkg.Version != Current {
		t.Fatalf("frontend/package.json is %q but version.Current is %q: change both together", pkg.Version, Current)
	}
}
