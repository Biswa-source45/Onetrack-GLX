package handler

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"

	"github.com/gin-gonic/gin"
	"github.com/onetrack/backend/internal/platform/response"
)

// Documents added for a Technical Evaluation document shortfall. Same storage and
// limits as EMD receipts (JPEG/PNG/WebP/PDF, 10 MB), in a sub-folder of the
// tender's upload folder so the two never mix.
func (h *BidHandler) shortfallDir(bidID string) string {
	return filepath.Join(h.emdUploadDir, bidID, "shortfall")
}

func (h *BidHandler) UploadShortfallDoc(c *gin.Context) {
	bidID := c.Param("id")
	if !bidIDRe.MatchString(bidID) {
		response.BadRequest(c, "Invalid tender id", nil)
		return
	}
	if _, err := h.svc.GetBid(c.Request.Context(), bidID); err != nil {
		response.NotFound(c, "Bid not found")
		return
	}

	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxEMDReceiptBytes+(1<<20))
	fileHeader, err := c.FormFile("file")
	if err != nil {
		response.BadRequest(c, "File is required (field name: 'file', max 10 MB)", nil)
		return
	}
	filename, err := saveReceiptFile(fileHeader, h.shortfallDir(bidID))
	if err != nil {
		response.BadRequest(c, err.Error(), nil)
		return
	}
	response.Success(c, http.StatusOK, "Document uploaded", gin.H{
		"filename": filename,
		"url":      fmt.Sprintf("/api/v1/bids/%s/shortfall/file/%s", bidID, filename),
	})
}

// GetShortfallFile serves a document only under the tender it was uploaded for.
func (h *BidHandler) GetShortfallFile(c *gin.Context) {
	bidID, name := c.Param("id"), c.Param("filename")
	if !bidIDRe.MatchString(bidID) || !receiptNameRe.MatchString(name) {
		response.NotFound(c, "Document not found")
		return
	}
	fullPath := filepath.Join(h.shortfallDir(bidID), name)
	if _, err := os.Stat(fullPath); err != nil {
		response.NotFound(c, "Document not found")
		return
	}
	c.Header("X-Content-Type-Options", "nosniff")
	c.File(fullPath)
}
