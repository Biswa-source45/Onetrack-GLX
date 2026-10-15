package handler

import (
	"bytes"
	"testing"
)

func TestValidateTenderDoc(t *testing.T) {
	pdf := []byte("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n1 0 obj\n")
	zip := []byte{'P', 'K', 3, 4, 0x14, 0, 0, 0, 8, 0}
	png := []byte("\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR")
	txt := []byte("Tender notes: all documents are due on Friday.\n")

	cases := []struct {
		name     string
		file     string
		size     int64
		head     []byte
		wantType string // "" = must be rejected
	}{
		{"pdf ok", "rfp.pdf", int64(len(pdf)), pdf, "application/pdf"},
		{"pdf uppercase ext", "RFP.PDF", int64(len(pdf)), pdf, "application/pdf"},
		{"docx ok", "atc.docx", int64(len(zip)), zip, "application/vnd.openxmlformats-officedocument.wordprocessingml.document"},
		{"txt ok", "notes.txt", int64(len(txt)), txt, "text/plain; charset=utf-8"},
		{"xlsx zip renamed to docx is accepted only as docx", "sheet.xlsx", int64(len(zip)), zip, ""},
		{"png rejected", "scan.png", int64(len(png)), png, ""},
		{"png renamed to pdf rejected", "scan.pdf", int64(len(png)), png, ""},
		{"pdf bytes named txt rejected", "rfp.txt", int64(len(pdf)), pdf, ""},
		{"text named pdf rejected", "fake.pdf", int64(len(txt)), txt, ""},
		{"binary named txt rejected", "bin.txt", 8, []byte{0, 1, 2, 3, 0, 5, 6, 7}, ""},
		{"empty rejected", "empty.pdf", 0, nil, ""},
		{"too large rejected", "big.pdf", maxTenderDocBytes + 1, pdf, ""},
		{"no extension rejected", "rfp", int64(len(pdf)), pdf, ""},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, err := validateTenderDoc(tc.size, tc.file, tc.head)
			if tc.wantType == "" {
				if err == nil {
					t.Fatalf("expected rejection, got type %q", got)
				}
				return
			}
			if err != nil || got != tc.wantType {
				t.Fatalf("got (%q, %v), want %q", got, err, tc.wantType)
			}
		})
	}
}

func TestSafeNameAndSlug(t *testing.T) {
	if got := safeName("../../etc/passwd"); bytes.ContainsAny([]byte(got), "/\\") {
		t.Fatalf("path separators survived: %q", got)
	}
	if got := safeName("RFP / ATC final"); got != "RFP___ATC_final" {
		t.Fatalf("got %q", got)
	}
	if got := safeName("...."); got != "file" {
		t.Fatalf("got %q", got)
	}
	if got := folderSlug("Supply of Desktops (Lot-2)!"); got != "supply-of-desktops-lot-2" {
		t.Fatalf("got %q", got)
	}
	if got := folderSlug("!!!"); got != "tender" {
		t.Fatalf("got %q", got)
	}
}
