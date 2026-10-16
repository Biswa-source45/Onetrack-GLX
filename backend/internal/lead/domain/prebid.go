package domain

import (
	"fmt"
	"strings"
	"time"
	"unicode/utf8"
)

// Prebid query round — see migration 000066. The Account Manager (the lead's
// owner) is the hub: the sheet goes to one person at a time and always comes
// back to the AM, who may send it to PM / DM / BM in any order, repeatedly.
//
//	NOT_STARTED -> WITH_PM -> WITH_AM <-> WITH_DM / WITH_BM -> SENT -> CLOSED
const (
	PbNotStarted = "NOT_STARTED"
	PbWithPM     = "WITH_PM"
	PbWithDM     = "WITH_DM"
	PbWithBM     = "WITH_BM"
	PbWithAM     = "WITH_AM"
	PbSent       = "SENT"
	PbClosed     = "CLOSED"
)

// Prebid actions. Each is also the event_type recorded on the lead's timeline.
const (
	PbStart    = "PREBID_START"
	PbSendPM   = "PREBID_SEND_PM"
	PbSendDM   = "PREBID_SEND_DM"
	PbSendBM   = "PREBID_SEND_BM"
	PbReturn   = "PREBID_RETURN"
	PbMarkSent = "PREBID_MARK_SENT"
	PbClose    = "PREBID_CLOSE"
)

// PrebidAssigneeRoles: who may be handed the sheet by each action — DB role
// names. The handler widens them with roles.Holders (Pre-Sales Manager acts as
// Pre-Sales); the Delivery Manager is a view-only role, so it is named directly.
// To change who the "DM" or "BM" step belongs to, edit this map only.
var PrebidAssigneeRoles = map[string][]string{
	PbStart:  {"PRE_SALES"},
	PbSendPM: {"PRE_SALES"},
	PbSendDM: {"DELIVERY_MANAGER"},
	PbSendBM: {"BID_MANAGER"},
}

// PrebidFields: JSON field -> column. The only columns a cell edit can touch.
var PrebidFields = map[string]string{
	"clause_ref": "clause_ref", "product": "product", "oem": "oem",
	"pm_remarks": "pm_remarks", "dm_comment": "dm_comment", "bm_comment": "bm_comment",
	"query": "query", "customer_response": "customer_response",
}

const prebidMaxFieldRunes = 4000

// PrebidItem is one row of the sheet.
type PrebidItem struct {
	ID               string `json:"id"`
	ClauseRef        string `json:"clause_ref"`
	Product          string `json:"product"`
	OEM              string `json:"oem"`
	PMRemarks        string `json:"pm_remarks"`
	DMComment        string `json:"dm_comment"`
	BMComment        string `json:"bm_comment"`
	Query            string `json:"query"`
	CustomerResponse string `json:"customer_response"`
}

type PrebidState struct {
	Stage    string       `json:"stage"`
	Assignee *UserSummary `json:"assignee"`
	SentAt   *time.Time   `json:"sent_at"`
	// Items, Actions and Editable are filled on the detail response only; the
	// last two are computed for the caller, so the page never re-implements the rules.
	Items    []PrebidItem `json:"items"`
	Actions  []string     `json:"actions"`
	Editable []string     `json:"editable"`
}

// isAM: the lead's owner (the Account Manager), or an Admin stepping in.
func (l *Lead) isAM(a Actor) bool {
	return l.LeadOwner.ID == a.ID || a.hasAny(AdminRoles)
}

// isPrebidHolder: whoever the sheet is currently with, or an Admin stepping in.
func (l *Lead) isPrebidHolder(a Actor) bool {
	return (l.Prebid.Assignee != nil && l.Prebid.Assignee.ID == a.ID) || a.hasAny(AdminRoles)
}

// PrebidNext returns the stage action moves the sheet to, or why this actor
// can't take it right now. ActionsFor-style listing is derived from it.
func (l *Lead) PrebidNext(action string, a Actor) (string, error) {
	type rule struct {
		from []string
		to   string
		am   bool // true: the Account Manager's step; false: the current holder's
	}
	holders := []string{PbWithPM, PbWithDM, PbWithBM}
	rules := map[string]rule{
		PbStart:    {[]string{PbNotStarted}, PbWithPM, true},
		PbSendPM:   {[]string{PbWithAM}, PbWithPM, true},
		PbSendDM:   {[]string{PbWithAM}, PbWithDM, true},
		PbSendBM:   {[]string{PbWithAM}, PbWithBM, true},
		PbReturn:   {holders, PbWithAM, false},
		PbMarkSent: {[]string{PbWithAM}, PbSent, true},
		PbClose:    {[]string{PbSent}, PbClosed, true},
	}
	r, ok := rules[action]
	if !ok {
		return "", fmt.Errorf("%w: unknown action", ErrValidation)
	}
	if l.PublishStatus != StatusPublished {
		return "", fmt.Errorf("%w: prebid queries are only for published leads — they need an RFP", ErrValidation)
	}
	if l.Stage == StageNoGo {
		return "", fmt.Errorf("%w: this lead was cancelled (No-Go)", ErrValidation)
	}
	if !contains(r.from, l.Prebid.Stage) {
		return "", fmt.Errorf("%w: the prebid sheet is no longer at a stage where that is possible — reload the page", ErrValidation)
	}
	if r.am && !l.isAM(a) {
		return "", fmt.Errorf("%w: only this lead's owner (the Account Manager) or an Admin can do that", ErrForbidden)
	}
	if !r.am && !l.isPrebidHolder(a) {
		return "", fmt.Errorf("%w: the sheet is with someone else right now", ErrForbidden)
	}
	return r.to, nil
}

// PrebidActionsFor lists what this actor can do to the sheet right now.
func (l *Lead) PrebidActionsFor(a Actor) []string {
	allowed := []string{}
	for _, action := range []string{PbStart, PbSendPM, PbSendDM, PbSendBM, PbReturn, PbMarkSent, PbClose} {
		if _, err := l.PrebidNext(action, a); err == nil {
			allowed = append(allowed, action)
		}
	}
	return allowed
}

// PrebidEditableFields: the cells this actor may edit now. Whoever can edit
// "product" may also add and delete rows — see CanChangePrebidRows.
func (l *Lead) PrebidEditableFields(a Actor) []string {
	none := []string{}
	if l.PublishStatus != StatusPublished || l.Stage == StageNoGo {
		return none
	}
	switch l.Prebid.Stage {
	case PbWithPM:
		if l.isPrebidHolder(a) {
			return []string{"product", "oem", "pm_remarks"}
		}
	case PbWithDM:
		if l.isPrebidHolder(a) {
			return []string{"dm_comment"}
		}
	case PbWithBM:
		if l.isPrebidHolder(a) {
			return []string{"bm_comment"}
		}
	case PbWithAM:
		if l.isAM(a) {
			return []string{"product", "oem", "pm_remarks", "clause_ref", "query"}
		}
	case PbSent:
		if l.isAM(a) {
			return []string{"customer_response"}
		}
	}
	return none
}

func (l *Lead) CanChangePrebidRows(a Actor) bool {
	return contains(l.PrebidEditableFields(a), "product")
}

// PrebidReadyToSend: the customer's list must hold at least one query.
func (l *Lead) PrebidReadyToSend() error {
	for _, it := range l.Prebid.Items {
		if strings.TrimSpace(it.Query) != "" {
			return nil
		}
	}
	return fmt.Errorf("%w: write at least one query before marking the list as sent to the customer", ErrValidation)
}

// PrebidTransitionRequest is the body of POST /leads/:id/prebid/transition.
type PrebidTransitionRequest struct {
	Action     string `json:"action"`
	AssigneeID string `json:"assignee_id"` // Start and the Send* actions
	Note       string `json:"note"`
}

func (r *PrebidTransitionRequest) Normalize() error {
	r.Action = strings.ToUpper(strings.TrimSpace(r.Action))
	r.AssigneeID = strings.TrimSpace(r.AssigneeID)
	r.Note = strings.TrimSpace(r.Note)
	if _, needs := PrebidAssigneeRoles[r.Action]; needs {
		if r.AssigneeID == "" {
			return fmt.Errorf("%w: choose who should get the sheet", ErrValidation)
		}
	} else {
		r.AssigneeID = ""
	}
	if utf8.RuneCountInString(r.Note) > prebidMaxFieldRunes {
		return fmt.Errorf("%w: the note is too long", ErrValidation)
	}
	return nil
}

// NormalizePrebidEdit trims a cell edit and rejects unknown or oversized fields.
// Whether the caller may edit each field is checked against PrebidEditableFields.
func NormalizePrebidEdit(in map[string]string) (map[string]string, error) {
	if len(in) == 0 {
		return nil, fmt.Errorf("%w: nothing to save", ErrValidation)
	}
	out := make(map[string]string, len(in))
	for k, v := range in {
		if _, ok := PrebidFields[k]; !ok {
			return nil, fmt.Errorf("%w: unknown field %q", ErrValidation, k)
		}
		v = strings.TrimSpace(v)
		if utf8.RuneCountInString(v) > prebidMaxFieldRunes {
			return nil, fmt.Errorf("%w: %s is too long (max %d characters)", ErrValidation, k, prebidMaxFieldRunes)
		}
		out[k] = v
	}
	return out, nil
}

func contains(list []string, s string) bool {
	for _, v := range list {
		if v == s {
			return true
		}
	}
	return false
}
