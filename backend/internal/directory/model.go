// Package directory holds the private lists behind "My Accounts" (Account Managers) and "My OEMs"
// (Pre-Sales): one record per account / OEM, each with any number of contacts. One shape, two kinds.
package directory

import (
	"errors"
	"net/mail"
	"net/url"
	"strings"
	"time"
	"unicode/utf8"
)

var (
	ErrNotFound   = errors.New("not found")
	ErrDuplicate  = errors.New("duplicate")
	ErrValidation = errors.New("validation")
)

// kind is what the URL names ("accounts", "oems"); role is who may use it.
type kind struct{ db, role string }

var kinds = map[string]kind{
	"accounts": {db: "ACCOUNT", role: "ACCOUNT_MANAGER"},
	"oems":     {db: "OEM", role: "PRE_SALES"},
}

type Entry struct {
	ID           string    `json:"id"`
	Name         string    `json:"name"`
	Sector       string    `json:"sector"`
	Location     string    `json:"location"`
	Website      string    `json:"website"`
	Notes        string    `json:"notes"`
	ContactCount int       `json:"contact_count"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
	Contacts     []Contact `json:"contacts,omitempty"`
}

type Contact struct {
	ID          string    `json:"id"`
	EntryID     string    `json:"entry_id"`
	Name        string    `json:"name"`
	Designation string    `json:"designation"`
	Email       string    `json:"email"`
	Phone       string    `json:"phone"`
	Remarks     string    `json:"remarks"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// EntryInput and ContactInput are whole-record writes (create and replace), so a field left out is cleared.
type EntryInput struct {
	Name     string `json:"name"`
	Sector   string `json:"sector"`
	Location string `json:"location"`
	Website  string `json:"website"`
	Notes    string `json:"notes"`
}

type ContactInput struct {
	Name        string `json:"name"`
	Designation string `json:"designation"`
	Email       string `json:"email"`
	Phone       string `json:"phone"`
	Remarks     string `json:"remarks"`
}

func invalid(msg string) error { return errors.Join(ErrValidation, errors.New(msg)) }

// UserMessage is the sentence to show for an error from Normalize.
func UserMessage(err error) string {
	parts := strings.SplitN(err.Error(), "\n", 2)
	return parts[len(parts)-1]
}

func tooLong(label, v string, max int) error {
	if utf8.RuneCountInString(v) > max {
		return invalid(label + " is too long")
	}
	return nil
}

func digitCount(s string) int {
	n := 0
	for _, r := range s {
		if r >= '0' && r <= '9' {
			n++
		}
	}
	return n
}

// Normalize trims the fields and rejects what cannot be saved.
func (in *EntryInput) Normalize() error {
	in.Name, in.Sector, in.Location = strings.TrimSpace(in.Name), strings.TrimSpace(in.Sector), strings.TrimSpace(in.Location)
	in.Website, in.Notes = strings.TrimSpace(in.Website), strings.TrimSpace(in.Notes)
	if in.Name == "" {
		return invalid("Name is required")
	}
	for _, c := range []struct {
		label, v string
		max      int
	}{{"Name", in.Name, 200}, {"Sector", in.Sector, 100}, {"Location", in.Location, 200}, {"Website", in.Website, 300}, {"Notes", in.Notes, 2000}} {
		if err := tooLong(c.label, c.v, c.max); err != nil {
			return err
		}
	}
	if in.Website != "" {
		u, err := url.Parse(in.Website)
		if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" {
			return invalid("Website must start with http:// or https://")
		}
	}
	return nil
}

func (in *ContactInput) Normalize() error {
	in.Name, in.Designation = strings.TrimSpace(in.Name), strings.TrimSpace(in.Designation)
	in.Email, in.Phone, in.Remarks = strings.ToLower(strings.TrimSpace(in.Email)), strings.TrimSpace(in.Phone), strings.TrimSpace(in.Remarks)
	if in.Name == "" {
		return invalid("Name is required")
	}
	for _, c := range []struct {
		label, v string
		max      int
	}{{"Name", in.Name, 200}, {"Designation", in.Designation, 150}, {"Email", in.Email, 200}, {"Phone", in.Phone, 40}, {"Remarks", in.Remarks, 1000}} {
		if err := tooLong(c.label, c.v, c.max); err != nil {
			return err
		}
	}
	if in.Email != "" {
		if a, err := mail.ParseAddress(in.Email); err != nil || a.Address != in.Email || !strings.Contains(in.Email[strings.Index(in.Email, "@"):], ".") {
			return invalid("Email address is not valid")
		}
	}
	if in.Phone != "" && digitCount(in.Phone) < 7 {
		return invalid("Phone number looks too short")
	}
	return nil
}
