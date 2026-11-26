package handler

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"html"
	"log"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	bidDomain "github.com/onetrack/backend/internal/bid/domain"
	"github.com/onetrack/backend/internal/lead/domain"
	"github.com/onetrack/backend/internal/platform/response"
)

// CreateTender and AttachTenderDoc are what conversion needs from the tender
// module; main wires them, so leads don't depend on its internals.
type (
	CreateTender    func(ctx context.Context, req *bidDomain.CreateBidRequest, createdBy string) (*bidDomain.BidResponse, error)
	AttachTenderDoc func(ctx context.Context, bidID, bidTitle, name, original, srcPath, userID string) error
)

// EnableConversion turns on POST /leads/:id/convert.
func (h *LeadHandler) EnableConversion(create CreateTender, attach AttachTenderDoc) {
	h.createTender, h.attachDoc = create, attach
}

// publishedKeys are the published_details fields that carry over to the tender
// under the same name. published_details is client-supplied JSON, so anything
// else in it (owner ids, metadata, results) is ignored.
var publishedKeys = []string{
	"gem_bid_no", "start_date", "end_date", "portal_source", "bid_type", "quantity",
	"emd_not_applicable", "emd_amount", "emd_bank_name", "emd_account_number", "emd_ifsc_code", "emd_branch",
	"emd_beneficiary", "emd_payable_at", "emd_exemption_types", "emd_exemption_reason",
	"bg_required", "bg_rate", "bg_duration_months",
}

// tenderFromLead maps a lead onto the tender create request. Lead Owner becomes
// Bid Owner and the Reporting Manager carries over; Account Manager and
// Pre-Sales are left for the tender's Primary Review.
func tenderFromLead(l *domain.Lead) *bidDomain.CreateBidRequest {
	req := &bidDomain.CreateBidRequest{}

	var details map[string]any
	_ = json.Unmarshal(l.PublishedDetails, &details)
	carried := map[string]any{}
	for _, k := range publishedKeys {
		if v, ok := details[k]; ok && v != nil {
			carried[k] = v
		}
	}
	if b, err := json.Marshal(carried); err == nil {
		_ = json.Unmarshal(b, req) // a value of the wrong type is skipped, the rest still land
	}
	if products, ok := details["requested_products"].([]any); ok && len(products) > 0 {
		if b, err := json.Marshal(products); err == nil {
			s := string(b)
			req.RequestedProducts = &s
		}
	}
	// Tender dates are RFC3339; the lead keeps the start date as a plain day.
	if req.StartDate != nil {
		if t, err := time.Parse("2006-01-02", *req.StartDate); err == nil {
			s := t.Format(time.RFC3339)
			req.StartDate = &s
		}
	}

	req.CreationMode = "MANUAL"
	req.Title = leadName(l)
	req.OrganizationName = &l.AccountName
	req.DepartmentName = l.DepartmentName
	req.Location = l.Location
	req.Category = l.Category
	req.ScopeType = l.ScopeType
	req.HighLevelScope = l.HighLevelScope
	req.EstimatedValue = l.EstimatedValue
	req.BidOwnerID = l.LeadOwner.ID
	if l.ReportingManager != nil {
		req.ReportingManagerID = &l.ReportingManager.ID
	}
	if req.PortalSource == nil && l.LeadType == "PVT" {
		private := "Private"
		req.PortalSource = &private
	}
	return req
}

// Convert creates the tender for a Go lead, copies the lead's documents onto it
// and links the two.
func (h *LeadHandler) Convert(c *gin.Context) {
	// Finish even if the browser goes away: half a conversion is worse than a late one.
	ctx := context.WithoutCancel(c.Request.Context())
	id, actor := c.Param("id"), actorOf(c)
	if h.createTender == nil {
		response.InternalError(c, "tender conversion is not configured")
		return
	}
	lead, err := h.repo.Get(ctx, id)
	if err != nil {
		fail(c, err)
		return
	}
	if err := lead.ConvertNext(actor); err != nil {
		fail(c, err)
		return
	}
	if err := h.repo.ClaimConversion(ctx, lead.ID); err != nil {
		fail(c, err)
		return
	}

	bid, err := h.createTender(ctx, tenderFromLead(lead), actor.ID)
	if err != nil {
		if rerr := h.repo.ReleaseConversion(ctx, lead.ID); rerr != nil {
			log.Printf("[leads] could not release conversion claim on lead %s: %v", lead.ID, rerr)
		}
		switch {
		case errors.Is(err, bidDomain.ErrDuplicateIdentifier):
			response.Conflict(c, err.Error())
		case errors.Is(err, bidDomain.ErrValidation):
			response.BadRequest(c, err.Error(), nil)
		default:
			response.InternalError(c, err.Error())
		}
		return
	}
	if err := h.repo.FinishConversion(ctx, lead.ID, bid.ID, actor.ID); err != nil {
		log.Printf("[leads] tender %s was created but lead %s could not be linked to it: %v", bid.ID, lead.ID, err)
		response.InternalError(c, "The tender was created but could not be linked to this lead. Check the tender list before trying again.")
		return
	}

	// Documents are best effort: the tender takes PDF, DOCX and TXT only, and
	// whatever can't be copied stays on the lead and is named in the response.
	skipped := []string{}
	for _, d := range lead.Documents {
		name := strings.TrimSuffix(d.OriginalName, filepath.Ext(d.OriginalName))
		if d.Category != nil && *d.Category != "" {
			name = *d.Category
		}
		src := filepath.Join(h.rootDir, lead.FolderName, filepath.FromSlash(d.StoredPath))
		if err := h.attachDoc(ctx, bid.ID, bid.Title, name, d.OriginalName, src, actor.ID); err != nil {
			log.Printf("[leads] document %q of lead %s not copied to tender %s: %v", d.OriginalName, lead.ID, bid.ID, err)
			skipped = append(skipped, d.OriginalName)
		}
	}

	lead, err = h.repo.Get(ctx, lead.ID)
	if err != nil {
		fail(c, err)
		return
	}
	h.notify(lead, actor.ID, "LEAD_CONVERTED", "Lead converted to tender: "+leadName(lead),
		fmt.Sprintf("%s converted this lead into a tender.", html.EscapeString(eventActorName(lead, actor.ID))),
		lead.LeadOwner.ID, managerID(lead), approverID(lead))
	h.forActor(lead, actor)
	response.Success(c, http.StatusCreated, "Lead converted to tender", gin.H{"lead": lead, "skipped_documents": skipped})
}
