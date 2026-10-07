package handler

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"log"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"regexp"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/onetrack/backend/internal/bid/domain"
	"github.com/onetrack/backend/internal/platform/response"
)

const maxEMDReceiptBytes = 10 << 20 // 10 MB

var allowedEMDReceiptTypes = map[string]string{
	"image/jpeg":      ".jpg",
	"image/png":       ".png",
	"image/webp":      ".webp",
	"application/pdf": ".pdf",
}

var (
	// Both come from the URL and end up in a file path, so they are pinned to
	// the exact shapes this module writes.
	bidIDRe       = regexp.MustCompile(`^[0-9a-fA-F-]{36}$`)
	receiptNameRe = regexp.MustCompile(`^[0-9a-f]{32}\.(jpg|png|webp|pdf)$`)
)

func validateReceiptUpload(size int64, head []byte) (string, error) {
	if size > maxEMDReceiptBytes {
		return "", fmt.Errorf("file exceeds the %d MB limit", maxEMDReceiptBytes>>20)
	}
	ext, ok := allowedEMDReceiptTypes[http.DetectContentType(head)]
	if !ok {
		return "", fmt.Errorf("only JPEG, PNG, WebP images or PDF documents are allowed")
	}
	return ext, nil
}

// saveReceiptFile stores the upload under dir (one folder per tender) with a
// random name and returns that name.
func saveReceiptFile(fh *multipart.FileHeader, dir string) (string, error) {
	f, err := fh.Open()
	if err != nil {
		return "", fmt.Errorf("could not read the uploaded file: %w", err)
	}
	defer f.Close()

	head := make([]byte, 512)
	n, _ := io.ReadFull(f, head)
	ext, err := validateReceiptUpload(fh.Size, head[:n])
	if err != nil {
		return "", err
	}

	nameBytes := make([]byte, 16)
	if _, err := rand.Read(nameBytes); err != nil {
		return "", fmt.Errorf("could not generate unique filename: %w", err)
	}
	filename := hex.EncodeToString(nameBytes) + ext

	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", fmt.Errorf("could not create emd upload directory: %w", err)
	}
	out, err := os.Create(filepath.Join(dir, filename))
	if err != nil {
		return "", fmt.Errorf("could not save receipt file: %w", err)
	}
	defer out.Close()

	if _, err := f.Seek(0, io.SeekStart); err != nil {
		return "", fmt.Errorf("could not rewind file: %w", err)
	}
	if _, err := io.Copy(out, f); err != nil {
		return "", fmt.Errorf("could not write file: %w", err)
	}
	return filename, nil
}

func mapServiceError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, domain.ErrForbidden):
		response.Forbidden(c, err.Error())
	case errors.Is(err, domain.ErrValidation):
		response.BadRequest(c, err.Error(), nil)
	case errors.Is(err, pgx.ErrNoRows):
		response.NotFound(c, "Bid not found")
	default:
		log.Printf("emd: %v", err)
		response.InternalError(c, "Could not complete the EMD request")
	}
}

func actorRoles(c *gin.Context) []string {
	roles, _ := c.Get("roles")
	r, _ := roles.([]string)
	return r
}

// emdAction runs one lifecycle action for the calling user and writes the response.
func (h *BidHandler) emdAction(c *gin.Context, message string, do func(ctx context.Context, bidID, actorID string, roles []string) (*domain.TenderEMDResponse, error)) {
	resp, err := do(c.Request.Context(), c.Param("id"), c.GetString("user_id"), actorRoles(c))
	if err != nil {
		mapServiceError(c, err)
		return
	}
	response.Success(c, http.StatusOK, message, resp)
}

func (h *BidHandler) GetEMDDetails(c *gin.Context) {
	resp, err := h.svc.GetEMDDetails(c.Request.Context(), c.Param("id"), actorRoles(c))
	if err != nil {
		mapServiceError(c, err)
		return
	}
	response.Success(c, http.StatusOK, "EMD details retrieved", resp)
}

func (h *BidHandler) UpdateBasicEMD(c *gin.Context) {
	var req domain.UpdateBasicEMDRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error(), nil)
		return
	}
	h.emdAction(c, "Basic EMD details updated", func(ctx context.Context, id, actor string, roles []string) (*domain.TenderEMDResponse, error) {
		return h.svc.UpdateBasicEMD(ctx, id, &req, actor, roles)
	})
}

func (h *BidHandler) SubmitEMDForMDApproval(c *gin.Context) {
	var req domain.SubmitMDApprovalRequest
	_ = c.ShouldBindJSON(&req) // remarks optional
	h.emdAction(c, "EMD details submitted for MD Approval", func(ctx context.Context, id, actor string, roles []string) (*domain.TenderEMDResponse, error) {
		return h.svc.SubmitEMDForMDApproval(ctx, id, &req, actor, roles)
	})
}

func (h *BidHandler) ApproveEMD(c *gin.Context) {
	var req domain.MDDecisionRequest
	_ = c.ShouldBindJSON(&req) // remarks optional
	h.emdAction(c, "EMD approved by MD successfully", func(ctx context.Context, id, actor string, roles []string) (*domain.TenderEMDResponse, error) {
		return h.svc.ApproveEMD(ctx, id, &req, actor, roles)
	})
}

func (h *BidHandler) RejectEMD(c *gin.Context) {
	var req domain.MDDecisionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Rejection remarks are required", nil)
		return
	}
	h.emdAction(c, "EMD rejected and returned to Finance", func(ctx context.Context, id, actor string, roles []string) (*domain.TenderEMDResponse, error) {
		return h.svc.RejectEMD(ctx, id, &req, actor, roles)
	})
}

func (h *BidHandler) RecordEMDPayment(c *gin.Context) {
	var req domain.RecordEMDPaymentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error(), nil)
		return
	}
	h.emdAction(c, "EMD payment recorded successfully", func(ctx context.Context, id, actor string, roles []string) (*domain.TenderEMDResponse, error) {
		return h.svc.RecordEMDPayment(ctx, id, &req, actor, roles)
	})
}

func (h *BidHandler) VerifyEMDPayment(c *gin.Context) {
	var req domain.VerifyEMDPaymentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error(), nil)
		return
	}
	h.emdAction(c, "EMD payment verification updated", func(ctx context.Context, id, actor string, roles []string) (*domain.TenderEMDResponse, error) {
		return h.svc.VerifyEMDPayment(ctx, id, &req, actor, roles)
	})
}

func (h *BidHandler) UpdateEMDRefund(c *gin.Context) {
	var req domain.UpdateEMDRefundRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error(), nil)
		return
	}
	h.emdAction(c, "EMD release/refund tracking updated", func(ctx context.Context, id, actor string, roles []string) (*domain.TenderEMDResponse, error) {
		return h.svc.UpdateEMDRefund(ctx, id, &req, actor, roles)
	})
}

func (h *BidHandler) GetEMDAuditLogs(c *gin.Context) {
	logs, err := h.svc.GetEMDAuditLogs(c.Request.Context(), c.Param("id"))
	if err != nil {
		mapServiceError(c, err)
		return
	}
	response.Success(c, http.StatusOK, "EMD audit logs retrieved", logs)
}

// UploadEMDReceipt: the route already limits this to Finance and admins.
func (h *BidHandler) UploadEMDReceipt(c *gin.Context) {
	bidID := c.Param("id")
	if !bidIDRe.MatchString(bidID) {
		response.BadRequest(c, "Invalid tender id", nil)
		return
	}
	if err := h.svc.EnsureEMDRequired(c.Request.Context(), bidID); err != nil {
		mapServiceError(c, err)
		return
	}

	// A little headroom over the file limit for the multipart framing.
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxEMDReceiptBytes+(1<<20))
	fileHeader, err := c.FormFile("file")
	if err != nil {
		response.BadRequest(c, "File is required (field name: 'file', max 10 MB)", nil)
		return
	}
	filename, err := saveReceiptFile(fileHeader, filepath.Join(h.emdUploadDir, bidID))
	if err != nil {
		response.BadRequest(c, err.Error(), nil)
		return
	}

	response.Success(c, http.StatusOK, "Receipt uploaded successfully", gin.H{
		"filename":    filename,
		"receipt_url": fmt.Sprintf("/api/v1/bids/%s/emd/receipt/%s", bidID, filename),
	})
}

// GetEMDReceiptFile serves a receipt only under the tender it was uploaded for.
func (h *BidHandler) GetEMDReceiptFile(c *gin.Context) {
	bidID, name := c.Param("id"), c.Param("filename")
	if !bidIDRe.MatchString(bidID) || !receiptNameRe.MatchString(name) {
		response.NotFound(c, "Receipt file not found")
		return
	}
	fullPath := filepath.Join(h.emdUploadDir, bidID, name)
	if _, err := os.Stat(fullPath); err != nil {
		response.NotFound(c, "Receipt file not found")
		return
	}
	c.Header("X-Content-Type-Options", "nosniff")
	c.File(fullPath)
}
