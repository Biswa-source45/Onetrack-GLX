package handler

import (
	"bytes"
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/onetrack/backend/internal/bid/importer"
	"github.com/onetrack/backend/internal/platform/response"
)

// maxUploadBytes caps the workbook size. The tracker is ~35KB; 10MB leaves
// generous headroom while keeping a malicious upload out of memory.
const maxUploadBytes = 10 << 20

// BulkImportHandler loads a GBX tracker workbook into bid workspaces. It talks
// to the pool directly because the import runs as one transaction spanning many
// inserts, which the per-bid service API does not express.
type BulkImportHandler struct {
	pool *pgxpool.Pool
}

func NewBulkImportHandler(pool *pgxpool.Pool) *BulkImportHandler {
	return &BulkImportHandler{pool: pool}
}

type bulkImportResponse struct {
	Format        string                  `json:"format"`
	DryRun        bool                    `json:"dry_run"`
	RowCount      int                     `json:"row_count"`
	ImportCount   int                     `json:"import_count"`
	StageCounts   map[string]int          `json:"stage_counts"`
	WarningRows   int                     `json:"warning_rows"`
	Duplicates    []importer.Duplicate    `json:"duplicates"`
	Skipped       []importer.SkippedRow   `json:"skipped"`
	SkippedSheets []importer.SkippedSheet `json:"skipped_sheets,omitempty"`
	Rows          []bulkImportRow         `json:"rows"`
	CreatedIDs    []string                `json:"created_ids,omitempty"`
	OwnerID       string                  `json:"owner_id"`
}

type bulkImportRow struct {
	Row           int      `json:"row"`
	Title         string   `json:"title"`
	BidID         string   `json:"bid_id"`
	Client        string   `json:"client"`
	WorkflowStage string   `json:"workflow_stage"`
	BidStatus     string   `json:"bid_status"`
	Reason        string   `json:"reason"`
	Skipped       bool     `json:"skipped"`
	SkipReason    string   `json:"skip_reason,omitempty"`
	Warnings      []string `json:"warnings,omitempty"`
}

// BulkImport parses an uploaded .xlsx and, unless dry_run is set, writes every
// row in a single transaction.
//
//	POST /bids/bulk-import?dry_run=true|false&format=gbx|dashboard   multipart form, field "file"
//
// dry_run defaults to true so that an accidental call cannot write. format
// defaults to "gbx" (the original tracker layout); "dashboard" selects the
// Tender Dashboard layout, which has a different column set and its own
// competitive-intelligence (L1-L4 bidder) data.
func (h *BulkImportHandler) BulkImport(c *gin.Context) {
	dryRun := c.DefaultQuery("dry_run", "true") != "false"
	format := c.DefaultQuery("format", "gbx")
	if format != "gbx" && format != "dashboard" {
		response.BadRequest(c, `format must be "gbx" or "dashboard"`, nil)
		return
	}

	fileHeader, err := c.FormFile("file")
	if err != nil {
		response.BadRequest(c, "a .xlsx file is required in the 'file' field", nil)
		return
	}
	if fileHeader.Size > maxUploadBytes {
		response.BadRequest(c, fmt.Sprintf("file exceeds the %d MB limit", maxUploadBytes>>20), nil)
		return
	}

	f, err := fileHeader.Open()
	if err != nil {
		response.BadRequest(c, "could not read the uploaded file", nil)
		return
	}
	defer f.Close()

	var buf bytes.Buffer
	if _, err := buf.ReadFrom(f); err != nil {
		response.BadRequest(c, "could not read the uploaded file", nil)
		return
	}

	var preview *importer.Preview
	if format == "dashboard" {
		preview, err = importer.ParseUploadDashboard(bytes.NewReader(buf.Bytes()), int64(buf.Len()))
	} else {
		preview, err = importer.ParseUpload(bytes.NewReader(buf.Bytes()), int64(buf.Len()))
	}
	if err != nil {
		response.BadRequest(c, err.Error(), nil)
		return
	}

	ctx := c.Request.Context()

	// Flag rows whose tender id is already taken - by a live tender or by an
	// earlier row of this sheet - so they are reported and then skipped.
	if err := importer.MarkDuplicates(ctx, h.pool, preview); err != nil {
		response.InternalError(c, err.Error())
		return
	}

	// Default the owner to the Super Admin performing the upload; the bid owner
	// stays editable in-app afterwards.
	owner := c.Query("owner")
	if owner == "" {
		owner = c.GetString("user_id")
	}
	ownerID, err := importer.ResolveOwner(ctx, h.pool, owner)
	if err != nil {
		response.BadRequest(c, err.Error(), nil)
		return
	}

	// In dry-run mode, show what enrichment WOULD happen too - run it inside a
	// transaction that always rolls back, so the preview is honest about cross-
	// file effects without writing anything.
	if dryRun && format == "dashboard" {
		if err := func() error {
			tx, err := h.pool.Begin(ctx)
			if err != nil {
				return err
			}
			defer tx.Rollback(ctx)
			return importer.EnrichDuplicates(ctx, tx, preview)
		}(); err != nil {
			response.InternalError(c, err.Error())
			return
		}
	}

	resp := bulkImportResponse{
		Format:        format,
		DryRun:        dryRun,
		RowCount:      len(preview.Bids),
		ImportCount:   preview.ImportCount,
		StageCounts:   preview.StageCounts,
		WarningRows:   preview.WarningRows,
		Duplicates:    preview.Duplicates,
		Skipped:       preview.Skipped,
		SkippedSheets: preview.SkippedSheets,
		Rows:          summarise(preview),
		OwnerID:       ownerID,
	}

	if dryRun {
		response.Success(c, http.StatusOK, "Preview generated - nothing was written", resp)
		return
	}

	tx, err := h.pool.Begin(ctx)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	defer tx.Rollback(ctx)

	// Cross-file duplicates: the same tender can be tracked in both this
	// workbook and the other format's, sometimes with different completeness.
	// Rather than the second upload's data being discarded, any field the
	// already-existing tender is missing gets filled in from this row.
	if format == "dashboard" {
		if err := importer.EnrichDuplicates(ctx, tx, preview); err != nil {
			response.InternalError(c, "import rolled back: "+err.Error())
			return
		}
		resp.Skipped = preview.Skipped
	}

	ids, err := importer.InsertAll(ctx, tx, preview.Bids, ownerID, fileHeader.Filename)
	if err != nil {
		response.InternalError(c, "import rolled back: "+err.Error())
		return
	}
	if err := tx.Commit(ctx); err != nil {
		response.InternalError(c, err.Error())
		return
	}

	resp.CreatedIDs = ids
	msg := fmt.Sprintf("Imported %d tenders", len(ids))
	if n := len(preview.Skipped); n > 0 {
		msg = fmt.Sprintf("%s, skipped %d already present", msg, n)
	}
	response.Success(c, http.StatusCreated, msg, resp)
}

func summarise(p *importer.Preview) []bulkImportRow {
	out := make([]bulkImportRow, 0, len(p.Bids))
	for _, b := range p.Bids {
		id := ""
		switch {
		case b.GemBidNo != nil:
			id = *b.GemBidNo
		case b.BidNo != nil:
			id = *b.BidNo
		}
		client := ""
		if b.OrganizationName != nil {
			client = *b.OrganizationName
		}
		out = append(out, bulkImportRow{
			Row:           b.RowNum,
			Title:         b.Title,
			BidID:         id,
			Client:        client,
			WorkflowStage: b.WorkflowStage,
			BidStatus:     b.BidStatus,
			Reason:        b.DerivationReason,
			Skipped:       b.Skip,
			SkipReason:    b.SkipReason,
			Warnings:      b.Warnings,
		})
	}
	return out
}
