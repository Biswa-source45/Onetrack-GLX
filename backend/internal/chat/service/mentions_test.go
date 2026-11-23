package service

import (
	"sort"
	"strings"
	"testing"

	"github.com/onetrack/backend/internal/chat/domain"
)

func TestResolveMentions(t *testing.T) {
	members := []*domain.ChatMember{
		{ID: "sender", FullName: "Sam Sender", Username: "sam", Role: "BID_EXECUTIVE", IsOwner: true},
		{ID: "owner", FullName: "Olive Owner", Username: "olive", Role: "BID_MANAGER", IsOwner: true},
		{ID: "mem", FullName: "Mia Member", Username: "mia", Role: "FINANCE", IsMember: true},
		{ID: "out", FullName: "Ali Outsider", Username: "alice", Role: "FINANCE"},
		{ID: "md", FullName: "Mona Director", Username: "md1", Role: "MANAGING_DIRECTOR"},
	}
	ids := func(ms []*domain.ChatMember) string {
		var out []string
		for _, m := range ms {
			out = append(out, m.ID)
		}
		sort.Strings(out)
		return strings.Join(out, ",")
	}

	cases := []struct {
		name, text string
		after5     bool
		want       string
	}{
		{"@all stages 1-5: team only, no outsider, no MD", "hi @all", false, "mem,owner"},
		{"@all stage 6+: MD included", "hi @all", true, "md,mem,owner"},
		{"@everyone alias", "ping @Everyone!", false, "mem,owner"},
		{"@alice is not @all", "thanks @alice", false, "out"},
		{"@ali is not @alice", "thanks @ali", false, ""},
		{"direct full name with spaces", "cc @Mona Director please", false, "md"},
		{"direct mention of MD before stage 5 still works", "@md1 look", false, "md"},
		{"email is not a mention", "mail a@mia.com", false, ""},
		{"no self notify", "@sam @all", false, "mem,owner"},
	}
	for _, c := range cases {
		_, got := resolveMentions(c.text, "sender", members, c.after5)
		if g := ids(got); g != c.want {
			t.Errorf("%s: got %q want %q", c.name, g, c.want)
		}
	}

	labels, _ := resolveMentions("@all and @mia", "sender", members, false)
	if strings.Join(labels, ",") != "all,mia" {
		t.Errorf("labels = %v", labels)
	}
}
