package domain

import "testing"

func TestSafeLink(t *testing.T) {
	bid := "b1"
	cases := []struct {
		link  string
		bidID *string
		want  string
	}{
		{"/dashboard/tenders/b1?tab=stages&stage=PRICING_REQUEST", &bid, "/dashboard/tenders/b1?tab=stages&stage=PRICING_REQUEST"},
		{"", &bid, "/dashboard/tenders/b1"},
		{"https://evil.example/x", &bid, "/dashboard/tenders/b1"},
		{"//evil.example/dashboard/", &bid, "/dashboard/tenders/b1"},
		{`/dashboard/x" onclick="y`, &bid, "/dashboard/tenders/b1"},
		{"javascript:alert(1)", nil, ""},
		{"/dashboard/tickets", nil, "/dashboard/tickets"},
	}
	for _, c := range cases {
		if got := SafeLink(c.link, c.bidID); got != c.want {
			t.Errorf("SafeLink(%q) = %q, want %q", c.link, got, c.want)
		}
	}
}
