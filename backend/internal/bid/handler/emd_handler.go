package handler

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"
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

func validateReceiptUpload(size int64, head []byte, declaredName string) (string, error) {
	if size > maxEMDReceiptBytes {
		return "", fmt.Errorf("file exceeds the %d MB limit", maxEMDReceiptBytes>>20)
	}

	detected := http.DetectContentType(head)
	ext, ok := allowedEMDReceiptTypes[detected]
	if !ok {
		// DetectContentType can sometimes report "application/octet-stream" for PDF
		if strings.HasSuffix(strings.ToLower(declaredName), ".pdf") && strings.HasPrefix(string(head), "%PDF-") {
			return ".pdf", nil
		}
		return "", fmt.Errorf("only JPEG, PNG, WebP images or PDF documents are allowed")
	}
	return ext, nil
}

func saveReceiptFile(fh *multipart.FileHeader, uploadDir string) (string, error) {
	f, err := fh.Open()
	if err != nil {
		return "", fmt.Errorf("could not read the uploaded file: %w", err)
	}
	defer f.Close()

	head := make([]byte, 512)
	n, _ := io.ReadFull(f, head)
	ext, err := validateReceiptUpload(fh.Size, head[:n], fh.Filename)
	if err != nil {
		return "", err
	}

	nameBytes := make([]byte, 16)
	if _, err := rand.Read(nameBytes); err != nil {
		return "", fmt.Errorf("could not generate unique filename: %w", err)
	}
	filename := hex.EncodeToString(nameBytes) + ext

	emdDir := filepath.Join(uploadDir, "emd")
	if err := os.MkdirAll(emdDir, 0o755); err != nil {
		return "", fmt.Errorf("could not create emd upload directory: %w", err)
	}

	fullPath := filepath.Join(emdDir, filename)
	out, err := os.Create(fullPath)
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

// ────────────────────────────────────────
// EMD Handler Endpoints
// ────────────────────────────────────────

func (h *BidHandler) GetEMDDetails(c *gin.Context) {
	bidID := c.Param("id")
	emd, err := h.svc.GetEMDDetails(c.Request.Context(), bidID)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.Success(c, http.StatusOK, "EMD details retrieved", emd)
}

func (h *BidHandler) UpdateBasicEMD(c *gin.Context) {
	bidID := c.Param("id")
	var req domain.UpdateBasicEMDRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error(), nil)
		return
	}

	actorID := c.GetString("user_id")
	rolesVal, _ := c.Get("roles")
	actorRoles, _ := rolesVal.([]string)

	resp, err := h.svc.UpdateBasicEMD(c.Request.Context(), bidID, &req, actorID, actorRoles)
	if err != nil {
		if errors.Is(err, domain.ErrForbidden) {
			response.Forbidden(c, err.Error())
			return
		}
		if errors.Is(err, domain.ErrValidation) {
			response.BadRequest(c, err.Error(), nil)
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.Success(c, http.StatusOK, "Basic EMD details updated", resp)
}

func (h *BidHandler) SubmitEMDForMDApproval(c *gin.Context) {
	bidID := c.Param("id")
	var req domain.SubmitMDApprovalRequest
	_ = c.ShouldBindJSON(&req) // remarks optional

	actorID := c.GetString("user_id")
	rolesVal, _ := c.Get("roles")
	actorRoles, _ := rolesVal.([]string)

	resp, err := h.svc.SubmitEMDForMDApproval(c.Request.Context(), bidID, &req, actorID, actorRoles)
	if err != nil {
		if errors.Is(err, domain.ErrForbidden) {
			response.Forbidden(c, err.Error())
			return
		}
		if errors.Is(err, domain.ErrValidation) {
			response.BadRequest(c, err.Error(), nil)
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.Success(c, http.StatusOK, "EMD details submitted for MD Approval", resp)
}

func (h *BidHandler) ApproveEMD(c *gin.Context) {
	bidID := c.Param("id")
	var req domain.MDDecisionRequest
	_ = c.ShouldBindJSON(&req)

	actorID := c.GetString("user_id")
	rolesVal, _ := c.Get("roles")
	actorRoles, _ := rolesVal.([]string)

	resp, err := h.svc.ApproveEMD(c.Request.Context(), bidID, &req, actorID, actorRoles)
	if err != nil {
		if errors.Is(err, domain.ErrForbidden) {
			response.Forbidden(c, err.Error())
			return
		}
		if errors.Is(err, domain.ErrValidation) {
			response.BadRequest(c, err.Error(), nil)
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.Success(c, http.StatusOK, "EMD approved by MD successfully", resp)
}

func (h *BidHandler) RejectEMD(c *gin.Context) {
	bidID := c.Param("id")
	var req domain.MDDecisionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Rejection remarks are required", nil)
		return
	}

	actorID := c.GetString("user_id")
	rolesVal, _ := c.Get("roles")
	actorRoles, _ := rolesVal.([]string)

	resp, err := h.svc.RejectEMD(c.Request.Context(), bidID, &req, actorID, actorRoles)
	if err != nil {
		if errors.Is(err, domain.ErrForbidden) {
			response.Forbidden(c, err.Error())
			return
		}
		if errors.Is(err, domain.ErrValidation) {
			response.BadRequest(c, err.Error(), nil)
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.Success(c, http.StatusOK, "EMD rejected and returned to Finance", resp)
}

func (h *BidHandler) RecordEMDPayment(c *gin.Context) {
	bidID := c.Param("id")
	var req domain.RecordEMDPaymentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error(), nil)
		return
	}

	actorID := c.GetString("user_id")
	rolesVal, _ := c.Get("roles")
	actorRoles, _ := rolesVal.([]string)

	resp, err := h.svc.RecordEMDPayment(c.Request.Context(), bidID, &req, actorID, actorRoles)
	if err != nil {
		if errors.Is(err, domain.ErrForbidden) {
			response.Forbidden(c, err.Error())
			return
		}
		if errors.Is(err, domain.ErrValidation) {
			response.BadRequest(c, err.Error(), nil)
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.Success(c, http.StatusOK, "EMD payment recorded successfully", resp)
}

func (h *BidHandler) VerifyEMDPayment(c *gin.Context) {
	bidID := c.Param("id")
	var req domain.VerifyEMDPaymentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error(), nil)
		return
	}

	actorID := c.GetString("user_id")
	rolesVal, _ := c.Get("roles")
	actorRoles, _ := rolesVal.([]string)

	resp, err := h.svc.VerifyEMDPayment(c.Request.Context(), bidID, &req, actorID, actorRoles)
	if err != nil {
		if errors.Is(err, domain.ErrForbidden) {
			response.Forbidden(c, err.Error())
			return
		}
		if errors.Is(err, domain.ErrValidation) {
			response.BadRequest(c, err.Error(), nil)
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.Success(c, http.StatusOK, "EMD payment verification updated", resp)
}

func (h *BidHandler) UpdateEMDRefund(c *gin.Context) {
	bidID := c.Param("id")
	var req domain.UpdateEMDRefundRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error(), nil)
		return
	}

	actorID := c.GetString("user_id")
	rolesVal, _ := c.Get("roles")
	actorRoles, _ := rolesVal.([]string)

	resp, err := h.svc.UpdateEMDRefund(c.Request.Context(), bidID, &req, actorID, actorRoles)
	if err != nil {
		if errors.Is(err, domain.ErrForbidden) {
			response.Forbidden(c, err.Error())
			return
		}
		if errors.Is(err, domain.ErrValidation) {
			response.BadRequest(c, err.Error(), nil)
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.Success(c, http.StatusOK, "EMD release/refund tracking updated", resp)
}

func (h *BidHandler) GetEMDAuditLogs(c *gin.Context) {
	bidID := c.Param("id")
	logs, err := h.svc.GetEMDAuditLogs(c.Request.Context(), bidID)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.Success(c, http.StatusOK, "EMD audit logs retrieved", logs)
}

func (h *BidHandler) UploadEMDReceipt(c *gin.Context) {
	rolesVal, _ := c.Get("roles")
	actorRoles, _ := rolesVal.([]string)
	hasAllowedRole := false
	for _, r := range actorRoles {
		if strings.EqualFold(r, "SUPER_ADMIN") || strings.EqualFold(r, "ADMIN") || strings.EqualFold(r, "FINANCE") {
			hasAllowedRole = true
			break
		}
	}
	if !hasAllowedRole {
		response.Forbidden(c, "only Finance team or Administrators can upload EMD receipts")
		return
	}

	fileHeader, err := c.FormFile("file")
	if err != nil {
		response.BadRequest(c, "File is required (field name: 'file')", nil)
		return
	}

	uploadDir := "./uploads"
	filename, err := saveReceiptFile(fileHeader, uploadDir)
	if err != nil {
		response.BadRequest(c, err.Error(), nil)
		return
	}

	receiptURL := fmt.Sprintf("/api/v1/bids/%s/emd/receipt/%s", c.Param("id"), filename)
	response.Success(c, http.StatusOK, "Receipt uploaded successfully", gin.H{
		"filename":    filename,
		"receipt_url": receiptURL,
	})
}

func (h *BidHandler) GetEMDReceiptFile(c *gin.Context) {
	filename := filepath.Base(c.Param("filename"))
	fullPath := filepath.Join("./uploads/emd", filename)
	if _, err := os.Stat(fullPath); os.IsNotExist(err) {
		response.NotFound(c, "Receipt file not found")
		return
	}
	c.File(fullPath)
}
