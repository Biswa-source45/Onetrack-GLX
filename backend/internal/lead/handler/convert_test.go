package handler

import (
	"encoding/json"
	"testing"

	"github.com/onetrack/backend/internal/lead/domain"
)

func TestTenderFromLead(t *testing.T) {
	title := "Firewall supply"
	l := &domain.Lead{
		PublishStatus: domain.StatusPublished, LeadType: "GOV", AccountName: "NIC", Title: &title,
		LeadOwner:        domain.UserSummary{ID: "owner"},
		ReportingManager: &domain.UserSummary{ID: "rm"},
		PublishedDetails: json.RawMessage(`{
			"gem_bid_no":"GEM/1","start_date":"2026-12-01","end_date":"2026-12-20T10:30:00.000Z",
			"quantity":4,"emd_amount":5000,"bg_required":true,"bg_rate":3,"bg_duration_months":12,
			"requested_products":[{"product":"FW","qty":"4"}],
			"bid_owner_id":"intruder","account_manager_id":"intruder","metadata":"{}"}`),
	}
	r := tenderFromLead(l)

	if r.Title != title || *r.OrganizationName != "NIC" || r.CreationMode != "MANUAL" {
		t.Errorf("basics: %+v", r)
	}
	if r.BidOwnerID != "owner" || *r.ReportingManagerID != "rm" || r.AccountManagerID != nil || r.Metadata != nil {
		t.Errorf("ownership must come from the lead, never from published_details: %+v", r)
	}
	if *r.GemBidNo != "GEM/1" || *r.Quantity != 4 || *r.EMDAmount != 5000 || *r.BGRate != 3 || *r.BGDurationMonths != 12 {
		t.Errorf("published details not carried: %+v", r)
	}
	if *r.StartDate != "2026-12-01T00:00:00Z" || *r.EndDate != "2026-12-20T10:30:00.000Z" {
		t.Errorf("dates: %s / %s", *r.StartDate, *r.EndDate)
	}
	if r.RequestedProducts == nil || *r.RequestedProducts != `[{"product":"FW","qty":"4"}]` {
		t.Errorf("products: %v", r.RequestedProducts)
	}

	// Unpublished, private lead: no tender details, no manager.
	u := tenderFromLead(&domain.Lead{PublishStatus: domain.StatusUnpublished, LeadType: "PVT", AccountName: "Acme", LeadOwner: domain.UserSummary{ID: "o"}})
	if u.Title != "Acme" || u.ReportingManagerID != nil || u.GemBidNo != nil || *u.PortalSource != "Private" {
		t.Errorf("unpublished: %+v", u)
	}
}
