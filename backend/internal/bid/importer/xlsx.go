package importer

import (
	"archive/zip"
	"encoding/xml"
	"errors"
	"fmt"
	"io"
	"strings"
)

// Minimal .xlsx reader built on the standard library. The tracker sheet is a
// flat single-sheet table, so a full spreadsheet library would be dead weight —
// we only need shared strings, inline strings and raw cell values.

type richRun struct {
	T string `xml:"t"`
}

type sstItem struct {
	T string    `xml:"t"`
	R []richRun `xml:"r"`
}

func (s sstItem) text() string {
	if len(s.R) > 0 {
		var b strings.Builder
		for _, r := range s.R {
			b.WriteString(r.T)
		}
		return b.String()
	}
	return s.T
}

type sstXML struct {
	Items []sstItem `xml:"si"`
}

type cellXML struct {
	Ref string `xml:"r,attr"`
	Typ string `xml:"t,attr"`
	V   string `xml:"v"`
	Is  struct {
		T string    `xml:"t"`
		R []richRun `xml:"r"`
	} `xml:"is"`
}

type rowXML struct {
	Cells []cellXML `xml:"c"`
}

type sheetXML struct {
	Rows []rowXML `xml:"sheetData>row"`
}

// colIndex converts a cell reference like "AB12" to a zero-based column index.
func colIndex(ref string) int {
	n := 0
	for _, ch := range ref {
		if ch < 'A' || ch > 'Z' {
			break
		}
		n = n*26 + int(ch-'A') + 1
	}
	return n - 1
}

// maxEntryBytes caps how much a single workbook part may expand to once
// decompressed. A .xlsx is a zip, so a small upload can otherwise inflate to
// gigabytes and exhaust the server's memory - the tracker's own parts are a few
// hundred KB, so 64MB is far more headroom than any real sheet needs.
const maxEntryBytes = 64 << 20

func readZipEntry(z *zip.Reader, name string) ([]byte, error) {
	for _, f := range z.File {
		if f.Name == name {
			// The declared uncompressed size is attacker-controlled, so it is
			// only used to reject obvious bombs early; the real protection is
			// the limited reader below.
			if f.UncompressedSize64 > maxEntryBytes {
				return nil, fmt.Errorf("workbook part %s is too large (%d bytes)", name, f.UncompressedSize64)
			}
			rc, err := f.Open()
			if err != nil {
				return nil, err
			}
			defer rc.Close()

			// Read one byte past the cap so an over-sized part is detected
			// rather than silently truncated into malformed XML.
			data, err := io.ReadAll(io.LimitReader(rc, maxEntryBytes+1))
			if err != nil {
				return nil, err
			}
			if len(data) > maxEntryBytes {
				return nil, fmt.Errorf("workbook part %s exceeds the %d MB limit", name, maxEntryBytes>>20)
			}
			return data, nil
		}
	}
	return nil, fmt.Errorf("%w: %s", errEntryNotFound, name)
}

// errEntryNotFound distinguishes an absent workbook part (fine - not every
// workbook has a shared-string table) from a part that could not be read
// safely, which must surface to the caller rather than be skipped.
var errEntryNotFound = errors.New("workbook entry not found")

// ReadSheet returns every row of the first worksheet of the workbook at path.
func ReadSheet(path string) ([][]string, error) {
	z, err := zip.OpenReader(path)
	if err != nil {
		return nil, fmt.Errorf("open workbook: %w", err)
	}
	defer z.Close()
	return readSheetFromZip(&z.Reader, "")
}

// ReadSheetFrom reads a workbook already in memory, so an uploaded file can be
// parsed without first being written to disk.
func ReadSheetFrom(r io.ReaderAt, size int64) ([][]string, error) {
	z, err := zip.NewReader(r, size)
	if err != nil {
		return nil, fmt.Errorf("open workbook: %w", err)
	}
	return readSheetFromZip(z, "")
}

// ReadNamedSheet reads one specific worksheet out of a multi-sheet workbook at
// path, matched case-insensitively and ignoring surrounding whitespace (Excel
// tab names routinely carry a trailing space, as this one does: "TENDERS ").
func ReadNamedSheet(path, sheetName string) ([][]string, error) {
	z, err := zip.OpenReader(path)
	if err != nil {
		return nil, fmt.Errorf("open workbook: %w", err)
	}
	defer z.Close()
	return readSheetFromZip(&z.Reader, sheetName)
}

// ReadNamedSheetFrom is ReadNamedSheet for a workbook already in memory.
func ReadNamedSheetFrom(r io.ReaderAt, size int64, sheetName string) ([][]string, error) {
	z, err := zip.NewReader(r, size)
	if err != nil {
		return nil, fmt.Errorf("open workbook: %w", err)
	}
	return readSheetFromZip(z, sheetName)
}

// ListSheetNames returns the worksheet tab names in a workbook already in
// memory, in workbook order. Used to tell the caller which sheets a multi-sheet
// upload actually contains (e.g. to report "SUPPORTING BID (40 rows) was not
// imported").
func ListSheetNames(r io.ReaderAt, size int64) ([]string, error) {
	z, err := zip.NewReader(r, size)
	if err != nil {
		return nil, fmt.Errorf("open workbook: %w", err)
	}
	_, names, err := resolveSheetTarget(z, "")
	return names, err
}

// resolveSheetTarget maps a worksheet tab name to its part path (e.g.
// "xl/worksheets/sheet2.xml") by following workbook.xml -> a relationship id ->
// workbook.xml.rels, rather than assuming sheet order matches sheetN.xml
// numbering (Excel does not guarantee that once sheets are added, removed or
// reordered). An empty sheetName selects the first sheet in workbook order.
// Always returns every sheet name found, in order, alongside the match.
func resolveSheetTarget(z *zip.Reader, sheetName string) (target string, names []string, err error) {
	wbRaw, err := readZipEntry(z, "xl/workbook.xml")
	if err != nil {
		return "", nil, fmt.Errorf("read workbook.xml: %w", err)
	}
	var wb struct {
		Sheets []struct {
			Name string `xml:"name,attr"`
			RID  string `xml:"id,attr"`
		} `xml:"sheets>sheet"`
	}
	if err := xml.Unmarshal(wbRaw, &wb); err != nil {
		return "", nil, fmt.Errorf("parse workbook.xml: %w", err)
	}
	if len(wb.Sheets) == 0 {
		return "", nil, fmt.Errorf("workbook has no sheets")
	}

	relsRaw, err := readZipEntry(z, "xl/_rels/workbook.xml.rels")
	if err != nil {
		return "", nil, fmt.Errorf("read workbook.xml.rels: %w", err)
	}
	var rels struct {
		Rel []struct {
			ID     string `xml:"Id,attr"`
			Target string `xml:"Target,attr"`
		} `xml:"Relationship"`
	}
	if err := xml.Unmarshal(relsRaw, &rels); err != nil {
		return "", nil, fmt.Errorf("parse workbook.xml.rels: %w", err)
	}
	targetByRID := make(map[string]string, len(rels.Rel))
	for _, r := range rels.Rel {
		targetByRID[r.ID] = r.Target
	}

	want := strings.ToLower(strings.TrimSpace(sheetName))
	for i, s := range wb.Sheets {
		names = append(names, strings.TrimSpace(s.Name))
		matches := want == "" && i == 0 || want != "" && strings.ToLower(strings.TrimSpace(s.Name)) == want
		if matches && target == "" {
			t := targetByRID[s.RID]
			if t == "" {
				return "", names, fmt.Errorf("sheet %q has no worksheet relationship", s.Name)
			}
			// Targets are relative to xl/; normalise to a full zip path.
			target = "xl/" + strings.TrimPrefix(t, "/xl/")
			target = strings.TrimPrefix(target, "xl/xl/")
		}
	}
	if target == "" {
		if sheetName == "" {
			return "", names, fmt.Errorf("workbook has no sheets")
		}
		return "", names, fmt.Errorf("sheet %q not found (workbook has: %s)", sheetName, strings.Join(names, ", "))
	}
	return target, names, nil
}

// readSheetFromZip returns every row of the named worksheet (or the first
// sheet, when sheetName is empty) as a slice of cell strings, padded so that
// index i always corresponds to spreadsheet column i.
func readSheetFromZip(z *zip.Reader, sheetName string) ([][]string, error) {
	var shared []string
	raw, err := readZipEntry(z, "xl/sharedStrings.xml")
	switch {
	case err == nil:
		var sst sstXML
		if err := xml.Unmarshal(raw, &sst); err != nil {
			return nil, fmt.Errorf("parse sharedStrings: %w", err)
		}
		for _, it := range sst.Items {
			shared = append(shared, it.text())
		}
	case errors.Is(err, errEntryNotFound):
		// Workbook stores its strings inline; nothing to load.
	default:
		return nil, err
	}

	target, _, err := resolveSheetTarget(z, sheetName)
	if err != nil {
		return nil, err
	}

	sheetRaw, err := readZipEntry(z, target)
	if err != nil {
		return nil, err
	}
	var sheet sheetXML
	if err := xml.Unmarshal(sheetRaw, &sheet); err != nil {
		return nil, fmt.Errorf("parse %s: %w", target, err)
	}

	out := make([][]string, 0, len(sheet.Rows))
	for _, r := range sheet.Rows {
		row := make([]string, 0, len(r.Cells))
		for _, c := range r.Cells {
			idx := colIndex(c.Ref)
			if idx < 0 {
				continue
			}
			for len(row) <= idx {
				row = append(row, "")
			}
			var val string
			switch c.Typ {
			case "s":
				if n := atoiSafe(c.V); n >= 0 && n < len(shared) {
					val = shared[n]
				}
			case "inlineStr":
				if len(c.Is.R) > 0 {
					var b strings.Builder
					for _, rr := range c.Is.R {
						b.WriteString(rr.T)
					}
					val = b.String()
				} else {
					val = c.Is.T
				}
			default:
				val = c.V
			}
			row[idx] = val
		}
		out = append(out, row)
	}
	return out, nil
}

func atoiSafe(s string) int {
	n := 0
	if s == "" {
		return -1
	}
	for _, ch := range s {
		if ch < '0' || ch > '9' {
			return -1
		}
		n = n*10 + int(ch-'0')
	}
	return n
}
