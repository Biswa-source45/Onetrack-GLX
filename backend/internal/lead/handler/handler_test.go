package handler

import (
	"errors"
	"testing"

	"github.com/onetrack/backend/internal/lead/domain"
)

func strp(s string) *string { return &s }

func TestNormalize(t *testing.T) {
	// Unpublished drops stale published-only data instead of rejecting it.
	r := domain.CreateLeadRequest{PublishStatus: "unpublished", LeadType: "gov", AccountName: " NIC ",
		LeadOwnerID: "u1", Title: strp("x"), PublishedDetails: []byte(`{"a":1}`), Location: strp("  ")}
	if err := r.Normalize(); err != nil {
		t.Fatal(err)
	}
	if r.Title != nil || r.PublishedDetails != nil || r.Location != nil || r.AccountName != "NIC" || r.LeadType != "GOV" {
		t.Fatalf("not normalized: %+v", r)
	}

	bad := []domain.CreateLeadRequest{
		{PublishStatus: "X", LeadType: "PVT", AccountName: "a", LeadOwnerID: "u"},
		{PublishStatus: "PUBLISHED", LeadType: "NGO", AccountName: "a", LeadOwnerID: "u"},
		{PublishStatus: "PUBLISHED", LeadType: "PVT", AccountName: "", LeadOwnerID: "u"},
		{PublishStatus: "PUBLISHED", LeadType: "PVT", AccountName: "a", LeadOwnerID: "u"}, // no title
		{PublishStatus: "PUBLISHED", LeadType: "PVT", AccountName: "a", LeadOwnerID: "u", Title: strp("t"), // details not an object
			PublishedDetails: []byte(`[1]`)},
		{PublishStatus: "UNPUBLISHED", LeadType: "PVT", AccountName: "a", LeadOwnerID: "u", ExpectedDate: strp("01/02/2026")},
	}
	for i, b := range bad {
		if err := b.Normalize(); !errors.Is(err, domain.ErrValidation) {
			t.Errorf("case %d: want validation error, got %v", i, err)
		}
	}
}

func TestFolderSlugAndSafeName(t *testing.T) {
	if got := domain.FolderSlug("  NIC Delhi / Firewall RFP #2 "); got != "nic-delhi-firewall-rfp-2" {
		t.Errorf("slug: %q", got)
	}
	if got := domain.FolderSlug("!!!"); got != "lead" {
		t.Errorf("empty slug: %q", got)
	}
	if got := safeName(`../..\etc/passwd`); got != "etc_passwd" { // no separator survives
		t.Errorf("traversal: %q", got)
	}
	if got := safeName(".."); got != "file" {
		t.Errorf("dot-dot: %q", got)
	}
	if got := safeName("RFP Doc (final).pdf"); got != "RFP_Doc__final_.pdf" {
		t.Errorf("safeName: %q", got)
	}
}

func TestValidateDocument(t *testing.T) {
	pdf := []byte("%PDF-1.7\n")
	zip := []byte("PK\x03\x04\x14\x00\x06\x00")
	ole := append([]byte{}, oleMagic...)
	html := []byte("<html><script>alert(1)</script>")

	ok := []struct {
		name string
		head []byte
	}{{"a.pdf", pdf}, {"a.docx", zip}, {"a.xlsx", zip}, {"a.doc", ole}}
	for _, c := range ok {
		if _, err := validateDocument(10, c.name, c.head); err != nil {
			t.Errorf("%s rejected: %v", c.name, err)
		}
	}
	rejects := []struct {
		name string
		size int64
		head []byte
	}{
		{"a.zip", 10, zip},              // plain zip
		{"a.pdf", 10, html},             // renamed html
		{"a.pdf", maxDocBytes + 1, pdf}, // too big
		{"a.pdf", 0, pdf},               // empty
		{"a.doc", 10, zip},              // zip pretending to be .doc
	}
	for _, c := range rejects {
		if _, err := validateDocument(c.size, c.name, c.head); err == nil {
			t.Errorf("%s (%d bytes) accepted", c.name, c.size)
		}
	}
}
