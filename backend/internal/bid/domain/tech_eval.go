package domain

// TechEval is the tender's tech_eval JSONB (migration 000072): Technical Evaluation is
// opened explicitly after Bid Submission, then tracks four dates and one log that is both
// the notes thread and the date history. Only the /tech-eval endpoints write it, so
// author and time always come from the server.
type TechEval struct {
	Rev        int               `json:"rev"`
	OpenedAt   string            `json:"openedAt"`
	OpenedBy   string            `json:"openedBy"`
	OpenedByID string            `json:"openedById,omitempty"`
	Legacy     bool              `json:"legacy,omitempty"`
	Dates      map[string]string `json:"dates"`
	Log        []TechEvalEntry   `json:"log"`
}

const (
	TechLogOpen = "OPEN"
	TechLogNote = "NOTE"
	TechLogDate = "DATE"

	TechChangeSet     = "SET"
	TechChangeExtend  = "EXTEND"
	TechChangePrepone = "PREPONE"
	TechChangeClear   = "CLEAR"
)

type TechEvalEntry struct {
	ID     string `json:"id"`
	At     string `json:"at"`
	By     string `json:"by"`
	ByID   string `json:"byId,omitempty"`
	Kind   string `json:"kind"`
	Text   string `json:"text"`
	Field  string `json:"field,omitempty"`
	From   string `json:"from,omitempty"`
	To     string `json:"to,omitempty"`
	Change string `json:"change,omitempty"`
}

// TechEvalDateFields maps a date key to its label, in display order.
var TechEvalDateFields = []struct{ Key, Label string }{
	{"evaluation", "Technical Evaluation Date"},
	{"clarification", "Technical Clarification Date"},
	{"negotiation", "Technical Negotiation Date"},
	{"reverseAuction", "Reverse Auction Date"},
}

type OpenTechEvalRequest struct {
	Date   string `json:"date"`
	Remark string `json:"remark"`
}

// SetTechEvalDateRequest sets, changes or (Date == "") clears one date. Reason is required
// whenever a date already exists.
type SetTechEvalDateRequest struct {
	Field  string `json:"field"`
	Date   string `json:"date"`
	Reason string `json:"reason"`
}

type AddTechEvalNoteRequest struct {
	Text string `json:"text"`
}
