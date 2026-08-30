package importer

import (
	"fmt"
	"math"
	"regexp"
	"strconv"
	"strings"
	"time"
)

// excelEpoch is the serial-date origin used by Excel on Windows.
var excelEpoch = time.Date(1899, 12, 30, 0, 0, 0, 0, time.UTC)

var spaceRun = regexp.MustCompile(`\s+`)

// norm collapses internal whitespace runs and trims. The tracker contains
// values like "Not  Submitted" (double space) and "Globx Price is L1 ".
func norm(s string) string {
	return strings.TrimSpace(spaceRun.ReplaceAllString(s, " "))
}

func normLower(s string) string { return strings.ToLower(norm(s)) }

// isBlank reports whether a cell carries no usable information. The sheet uses
// several different placeholders for "nothing here".
func isBlank(s string) bool {
	v := normLower(s)
	switch v {
	case "", "na", "n/a", "-", "_", "nil", "none", "data not found",
		"not required", "not specified", "not applicable", "not available":
		return true
	}
	// The tracker writes placeholders like "N/A - Quotation" in the ID column
	// for tenders that never had a portal reference. Treating those as a real
	// identifier would make every such row collide with the next one.
	return strings.HasPrefix(v, "n/a")
}

// ---------------------------------------------------------------- dates

// parseSerialDate converts an Excel serial number to a date.
func parseSerialDate(s string) (time.Time, bool) {
	f, err := strconv.ParseFloat(norm(s), 64)
	if err != nil || f <= 0 {
		return time.Time{}, false
	}
	return excelEpoch.AddDate(0, 0, int(f)), true
}

// monthTypos repairs the misspellings found in the tracker's text dates.
// "22-Arp-26" appears 11 times - "Arp" is a transposition of "Apr".
var monthTypos = strings.NewReplacer(
	"arp", "Apr", "Arp", "Apr", "ARP", "Apr",
	"jly", "Jul", "Jly", "Jul",
	"spt", "Sep", "Spt", "Sep",
)

var textDateLayouts = []string{
	"2-Jan-06", "02-Jan-06", "2-Jan-2006", "02-Jan-2006",
	"02-01-2006", "2-1-2006", "02/01/2006", "2/1/2006",
	"2006-01-02",
}

// ParseDate handles both Excel serials and the hand-typed text dates that
// escaped Excel's own date parser.
func ParseDate(s string) (time.Time, bool, string) {
	s = norm(s)
	if isBlank(s) {
		return time.Time{}, false, ""
	}
	if t, ok := parseSerialDate(s); ok {
		return t, true, ""
	}
	fixed := monthTypos.Replace(s)
	for _, layout := range textDateLayouts {
		if t, err := time.Parse(layout, fixed); err == nil {
			var warn string
			if fixed != s {
				warn = fmt.Sprintf("repaired text date %q -> %q", s, fixed)
			} else {
				warn = fmt.Sprintf("parsed text date %q (not an Excel date)", s)
			}
			return t, true, warn
		}
	}
	return time.Time{}, false, fmt.Sprintf("unparseable date %q", s)
}

// ParseReportingMonth reads the tracker's "Reporting Month" column, which the
// authority's sheet writes as a plain label such as "Dec-2025" or "Jun-2026".
//
// The earlier sheet stored this as a date and Excel had mangled it - typing
// "Dec-25" produced 25 December of the current year, so the day secretly held
// the year. That workaround is no longer needed, but the serial form is still
// accepted so a stray date-formatted cell does not fail the whole import.
func ParseReportingMonth(s string) (time.Time, bool, string) {
	raw := norm(s)
	if isBlank(raw) {
		return time.Time{}, false, ""
	}
	for _, layout := range []string{"Jan-2006", "January-2006", "Jan 2006", "January 2006", "01-2006", "2006-01"} {
		if t, err := time.Parse(layout, raw); err == nil {
			return time.Date(t.Year(), t.Month(), 1, 0, 0, 0, 0, time.UTC), true, ""
		}
	}
	if t, ok := parseSerialDate(raw); ok {
		return time.Date(t.Year(), t.Month(), 1, 0, 0, 0, 0, time.UTC), true,
			fmt.Sprintf("reporting month %q was a date cell, read as %s", raw, t.Format("Jan-2006"))
	}
	return time.Time{}, false, fmt.Sprintf("unreadable reporting month %q", raw)
}

// ---------------------------------------------------------------- money

var digitsOnly = regexp.MustCompile(`^[0-9]+$`)

// ParseMoney reads the amount columns, which mix clean numbers with Indian
// digit grouping ("10, 00,000"), additive forms ("126900 + 2000"), multi-value
// lists ("170000, 5000, 5000") and plain prose.
func ParseMoney(s string) (float64, bool, string) {
	raw := norm(s)
	if isBlank(raw) {
		return 0, false, ""
	}
	if f, err := strconv.ParseFloat(raw, 64); err == nil {
		return round2(f), true, ""
	}

	// Additive form: sum the parts.
	if strings.Contains(raw, "+") {
		if total, ok := sumParts(strings.Split(raw, "+")); ok {
			return round2(total), true, fmt.Sprintf("summed additive amount %q -> %.2f", raw, total)
		}
	}

	if strings.Contains(raw, ",") {
		segs := strings.Split(raw, ",")
		for i := range segs {
			segs[i] = strings.TrimSpace(segs[i])
		}
		// Indian digit grouping: every segment after the first is a 2- or
		// 3-digit group, so the commas separate groups within one number.
		grouping := len(segs) > 1
		for _, seg := range segs {
			if !digitsOnly.MatchString(seg) {
				grouping = false
				break
			}
		}
		if grouping {
			for _, seg := range segs[1:] {
				if len(seg) != 2 && len(seg) != 3 {
					grouping = false
					break
				}
			}
		}
		if grouping {
			joined := strings.Join(segs, "")
			if f, err := strconv.ParseFloat(joined, 64); err == nil {
				return round2(f), true, fmt.Sprintf("read %q as grouped number %.0f", raw, f)
			}
		}
		// Otherwise treat it as a list of separate amounts and total them.
		if total, ok := sumParts(segs); ok {
			return round2(total), true,
				fmt.Sprintf("multi-value amount %q summed to %.2f - verify", raw, total)
		}
	}

	return 0, false, fmt.Sprintf("non-numeric amount %q", raw)
}

func sumParts(parts []string) (float64, bool) {
	total := 0.0
	n := 0
	for _, p := range parts {
		p = strings.ReplaceAll(strings.TrimSpace(p), ",", "")
		if p == "" {
			continue
		}
		f, err := strconv.ParseFloat(p, 64)
		if err != nil {
			return 0, false
		}
		total += f
		n++
	}
	return total, n > 0
}

func round2(f float64) float64 { return math.Round(f*100) / 100 }

// ParseRate reads the BG column, which holds fractions such as 0.05 alongside
// float artifacts like "1E-4" and "1.2500000000000001E-2".
func ParseRate(s string) (float64, bool, string) {
	raw := norm(s)
	if isBlank(raw) {
		return 0, false, ""
	}
	f, err := strconv.ParseFloat(raw, 64)
	if err != nil {
		return 0, false, fmt.Sprintf("non-numeric BG rate %q", raw)
	}
	rounded := math.Round(f*10000) / 10000
	var warn string
	if math.Abs(f-rounded) > 1e-12 {
		warn = fmt.Sprintf("BG rate %q rounded to %.4f", raw, rounded)
	}
	return rounded, true, warn
}

// ---------------------------------------------------------------- enums

// canon maps an observed spelling onto its canonical value, falling back to the
// cleaned original when the value is unrecognised.
func canon(s string, table map[string]string) string {
	if v, ok := table[normLower(s)]; ok {
		return v
	}
	if isBlank(s) {
		return ""
	}
	return norm(s)
}

var categoryMap = map[string]string{
	"microsoft": "Microsoft", "autodesk": "AutoDesk",
	"manpower": "Manpower", "redhat": "RedHat",
}

var scopeTypeMap = map[string]string{
	"implementation": "Implementation", "supply": "Supply", "support": "Support",
}

var activityTypeMap = map[string]string{
	"bid": "Bid", "bid to ra": "Bid to RA", "in ra": "Bid to RA", "quotation": "Quotation",
}

var submissionMap = map[string]string{
	"submitted": "Submitted", "not submitted": "Not Submitted",
	"not submited": "Not Submitted", "in progress": "In Progress",
}

// evalMap normalises the technical/financial evaluation columns. "Not
// Submitted" and "Yet to submit" mean the bid never reached evaluation at all,
// so they collapse to empty rather than to a status.
var evalMap = map[string]string{
	"qualified": "Qualified", "qulaified": "Qualified",
	"disqualified": "Disqualified", "completed": "Completed",
	"awaiting": "Awaiting", "not evaluated": "Not Evaluated",
	"not submitted": "", "yet to submit": "", "data not found": "",
	"_": "",
}

var poMap = map[string]string{
	"received": "Received", "not received": "Not Received",
	"to be determined": "To be determined", "bid cancelled": "Bid Cancelled",
	"not evaluated": "Not Evaluated",
	"not submitted": "", "yet to submit": "",
}

// lRankRe extracts the L-position from a result string. Anchored on word
// boundaries so "Our Price L11" reads as eleventh, not first.
var lRankRe = regexp.MustCompile(`(?i)\bl\s*(\d+)\b`)

// LRank returns the competitive position recorded in a Result cell.
func LRank(s string) (int, bool) {
	m := lRankRe.FindStringSubmatch(norm(s))
	if m == nil {
		return 0, false
	}
	n, err := strconv.Atoi(m[1])
	if err != nil {
		return 0, false
	}
	return n, true
}

// The app treats PO receipt as a binary fact, written by the Stage 12
// checklist. These are the only two values it stores.
const (
	POReceived = "PO Received"
	POPending  = "Pending"
)

// CanonTechnicalResult maps the sheet's evaluation wording onto the enum used
// everywhere else in the app (StageWorkspaces writes QUALIFIED / DISQUALIFIED).
// Anything without a verdict yet - awaiting, not evaluated, never submitted -
// stays empty, which the UI renders as "Pending".
func CanonTechnicalResult(s string) string {
	switch normLower(canon(s, evalMap)) {
	case "qualified", "completed":
		return "QUALIFIED"
	case "disqualified":
		return "DISQUALIFIED"
	}
	return ""
}

// CanonPOStatus collapses the sheet's PO wording onto that binary status.
// "To be determined" means the PO has not been received yet, so it maps to
// Pending - only an explicit "Received" counts as a PO in hand.
func CanonPOStatus(s string) string {
	if isBlank(s) {
		return ""
	}
	if normLower(canon(s, poMap)) == "received" {
		return POReceived
	}
	return POPending
}

// ParseQuantity reads the tracker's Quantity column. It is blank on most rows -
// only a handful of tenders record a unit count.
func ParseQuantity(s string) (int, bool) {
	raw := norm(s)
	if isBlank(raw) {
		return 0, false
	}
	f, err := strconv.ParseFloat(strings.ReplaceAll(raw, ",", ""), 64)
	if err != nil || f <= 0 {
		return 0, false
	}
	return int(f), true
}

// rankRe matches a competitive position: L1..L14, or H1 for the highest quote.
var rankRe = regexp.MustCompile(`(?i)^([LH])\s*(\d+)$`)

// CanonRank normalises the Price Ranking column to an upper-case L/H position.
func CanonRank(s string) string {
	raw := norm(s)
	if isBlank(raw) {
		return ""
	}
	if m := rankRe.FindStringSubmatch(raw); m != nil {
		return strings.ToUpper(m[1]) + m[2]
	}
	return strings.ToUpper(raw)
}
