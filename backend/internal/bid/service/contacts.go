package service

import (
	"context"
	"fmt"
	"regexp"
	"strings"

	"github.com/onetrack/backend/internal/bid/domain"
)

var contactEmailRe = regexp.MustCompile(`^[^\s@]+@[^\s@]+\.[^\s@]+$`)

var contactKindLabel = map[string]string{
	domain.ContactKindCustomer: "Customer", domain.ContactKindBidder: "Bidder", domain.ContactKindOEM: "OEM", domain.ContactKindOther: "Other",
}

func digitsOnly(s string) string {
	return strings.Map(func(r rune) rune {
		if r >= '0' && r <= '9' {
			return r
		}
		return -1
	}, s)
}

// phoneKey is what makes two phone numbers "the same": their last 10 digits, so "+91 98765 43210" and
// "98765 43210" are one person.
func phoneKey(s string) string {
	d := digitsOnly(s)
	if len(d) > 10 {
		return d[len(d)-10:]
	}
	return d
}

// cleanContact trims every text field and lower-cases the email (so duplicates compare equal).
func cleanContact(c *domain.TenderContact) {
	c.Kind = strings.ToUpper(strings.TrimSpace(c.Kind))
	c.Name, c.Org, c.Designation = strings.TrimSpace(c.Name), strings.TrimSpace(c.Org), strings.TrimSpace(c.Designation)
	c.Phone, c.Notes = strings.TrimSpace(c.Phone), strings.TrimSpace(c.Notes)
	c.Email = strings.ToLower(strings.TrimSpace(c.Email))
	c.BannedReason = strings.TrimSpace(c.BannedReason)
}

func validateContact(c *domain.TenderContact) error {
	switch {
	case !domain.ContactKinds[c.Kind]:
		return fmt.Errorf("%w: contact type must be Customer, Bidder, OEM or Other", domain.ErrValidation)
	case c.Name == "":
		return fmt.Errorf("%w: contact name is required", domain.ErrValidation)
	case len(c.Name) > 120 || len(c.Org) > 160 || len(c.Designation) > 120 || len(c.Notes) > 1000:
		return fmt.Errorf("%w: a contact field is too long", domain.ErrValidation)
	case c.Email != "" && !contactEmailRe.MatchString(c.Email):
		return fmt.Errorf("%w: email address is not valid", domain.ErrValidation)
	case c.Phone != "" && len(digitsOnly(c.Phone)) < 7:
		return fmt.Errorf("%w: phone number looks too short", domain.ErrValidation)
	case c.Source != domain.ContactSourceManual && c.Source != domain.ContactSourceOEMAuth:
		return fmt.Errorf("%w: unknown contact source", domain.ErrValidation)
	case c.Source == domain.ContactSourceOEMAuth && (c.Kind != domain.ContactKindOEM || c.SourceRef == "") && c.ID == "":
		return fmt.Errorf("%w: an OEM Authorization contact must be an OEM contact linked to its OEM row", domain.ErrValidation)
	case c.Banned && c.BannedReason == "":
		return fmt.Errorf("%w: give a reason for banning this contact", domain.ErrValidation)
	}
	return nil
}

// duplicateContact finds another contact of the tender with the same email or phone number.
func duplicateContact(all []domain.TenderContact, c *domain.TenderContact) *domain.TenderContact {
	phone := phoneKey(c.Phone)
	for i := range all {
		o := &all[i]
		if o.ID == c.ID {
			continue
		}
		if (c.Email != "" && o.Email == c.Email) || (phone != "" && phoneKey(o.Phone) == phone) {
			return o
		}
	}
	return nil
}

func contactDuplicateError(d *domain.TenderContact) error {
	return fmt.Errorf("%w: %s is already listed on this tender under %s", domain.ErrConflict, d.Name, contactKindLabel[d.Kind])
}

func (s *bidService) ListContacts(ctx context.Context, bidID string) ([]domain.TenderContact, error) {
	if _, err := s.repo.GetByID(ctx, bidID); err != nil {
		return nil, err
	}
	return s.repo.ListContacts(ctx, bidID)
}

func (s *bidService) AddContact(ctx context.Context, bidID string, req *domain.SaveContactRequest, actorID string) (*domain.TenderContact, error) {
	bid, err := s.repo.GetByID(ctx, bidID)
	if err != nil {
		return nil, err
	}
	c := &domain.TenderContact{BidID: bidID, Kind: req.Kind, Name: req.Name, Org: req.Org, Designation: req.Designation,
		Phone: req.Phone, Email: req.Email, Notes: req.Notes, Source: req.Source, SourceRef: strings.TrimSpace(req.SourceRef)}
	if c.Source == "" {
		c.Source = domain.ContactSourceManual
	}
	cleanContact(c)
	if err := validateContact(c); err != nil {
		return nil, err
	}
	all, err := s.repo.ListContacts(ctx, bidID)
	if err != nil {
		return nil, err
	}
	if d := duplicateContact(all, c); d != nil {
		return nil, contactDuplicateError(d)
	}
	out, err := s.repo.CreateContact(ctx, c, actorID)
	if err != nil {
		return nil, err
	}
	s.logAction(ctx, bidID, bid.Title, "CONTACT_ADDED", actorID, fmt.Sprintf("Contact added: %s (%s)", out.Name, contactKindLabel[out.Kind]))
	return out, nil
}

func (s *bidService) UpdateContact(ctx context.Context, bidID, contactID string, req *domain.UpdateContactRequest, actorID string) (*domain.TenderContact, error) {
	bid, err := s.repo.GetByID(ctx, bidID)
	if err != nil {
		return nil, err
	}
	old, err := s.repo.GetContact(ctx, bidID, contactID)
	if err != nil {
		return nil, err
	}
	c := *old
	set := func(dst *string, v *string) {
		if v != nil {
			*dst = *v
		}
	}
	set(&c.Kind, req.Kind)
	set(&c.Name, req.Name)
	set(&c.Org, req.Org)
	set(&c.Designation, req.Designation)
	set(&c.Phone, req.Phone)
	set(&c.Email, req.Email)
	set(&c.Notes, req.Notes)
	if req.Banned != nil {
		c.Banned = *req.Banned
	}
	set(&c.BannedReason, req.BannedReason)
	cleanContact(&c)
	if !c.Banned {
		c.BannedReason = ""
	}
	if err := validateContact(&c); err != nil {
		return nil, err
	}
	all, err := s.repo.ListContacts(ctx, bidID)
	if err != nil {
		return nil, err
	}
	if d := duplicateContact(all, &c); d != nil {
		return nil, contactDuplicateError(d)
	}
	if err := s.repo.UpdateContact(ctx, &c); err != nil {
		return nil, err
	}
	switch {
	case c.Banned && !old.Banned:
		s.logAction(ctx, bidID, bid.Title, "CONTACT_BANNED", actorID, fmt.Sprintf("Contact banned: %s (%s)", c.Name, c.BannedReason))
	case !c.Banned && old.Banned:
		s.logAction(ctx, bidID, bid.Title, "CONTACT_UNBANNED", actorID, "Contact un-banned: "+c.Name)
	case c.Kind != old.Kind:
		s.logAction(ctx, bidID, bid.Title, "CONTACT_MOVED", actorID, fmt.Sprintf("Contact moved: %s from %s to %s", c.Name, contactKindLabel[old.Kind], contactKindLabel[c.Kind]))
	default:
		s.logAction(ctx, bidID, bid.Title, "CONTACT_UPDATED", actorID, "Contact updated: "+c.Name)
	}
	return s.repo.GetContact(ctx, bidID, contactID)
}

func (s *bidService) DeleteContact(ctx context.Context, bidID, contactID, actorID string) error {
	bid, err := s.repo.GetByID(ctx, bidID)
	if err != nil {
		return err
	}
	old, err := s.repo.GetContact(ctx, bidID, contactID)
	if err != nil {
		return err
	}
	if err := s.repo.DeleteContact(ctx, bidID, contactID); err != nil {
		return err
	}
	s.logAction(ctx, bidID, bid.Title, "CONTACT_DELETED", actorID, fmt.Sprintf("Contact deleted: %s (%s)", old.Name, contactKindLabel[old.Kind]))
	return nil
}

// ReorderContacts saves a drag-and-drop result and returns the tender's contacts as stored.
func (s *bidService) ReorderContacts(ctx context.Context, bidID string, req *domain.ReorderContactsRequest, actorID string) ([]domain.TenderContact, error) {
	bid, err := s.repo.GetByID(ctx, bidID)
	if err != nil {
		return nil, err
	}
	if len(req.Items) == 0 {
		return nil, fmt.Errorf("%w: nothing to reorder", domain.ErrValidation)
	}
	seen := map[string]bool{}
	for i := range req.Items {
		it := &req.Items[i]
		it.Kind = strings.ToUpper(strings.TrimSpace(it.Kind))
		if it.ID == "" || seen[it.ID] || !domain.ContactKinds[it.Kind] || it.SortOrder < 0 {
			return nil, fmt.Errorf("%w: invalid contact order", domain.ErrValidation)
		}
		seen[it.ID] = true
	}
	before, err := s.repo.ListContacts(ctx, bidID)
	if err != nil {
		return nil, err
	}
	was := map[string]domain.TenderContact{}
	for _, c := range before {
		was[c.ID] = c
	}
	if err := s.repo.ReorderContacts(ctx, bidID, req.Items); err != nil {
		return nil, err
	}
	for _, it := range req.Items {
		if o, ok := was[it.ID]; ok && o.Kind != it.Kind {
			s.logAction(ctx, bidID, bid.Title, "CONTACT_MOVED", actorID, fmt.Sprintf("Contact moved: %s from %s to %s", o.Name, contactKindLabel[o.Kind], contactKindLabel[it.Kind]))
		}
	}
	return s.repo.ListContacts(ctx, bidID)
}
