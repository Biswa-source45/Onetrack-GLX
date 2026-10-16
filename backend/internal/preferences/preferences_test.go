package preferences

import "testing"

func TestNormalize(t *testing.T) {
	if got, err := Normalize(map[string]string{"tenders_view": " cards "}); err != nil || got["tenders_view"] != "cards" {
		t.Fatalf("a known key with an allowed value is kept and trimmed, got %v, %v", got, err)
	}
	for name, in := range map[string]map[string]string{
		"unknown key":   {"theme": "dark"},
		"unknown value": {"tenders_view": "grid"},
		"empty":         {},
	} {
		if _, err := Normalize(in); err == nil {
			t.Errorf("%s must be rejected", name)
		}
	}
}
