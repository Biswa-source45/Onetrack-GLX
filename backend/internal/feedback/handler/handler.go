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
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/onetrack/backend/internal/feedback/domain"
	"github.com/onetrack/backend/internal/middleware"
	"github.com/onetrack/backend/internal/platform/pagination"
	"github.com/onetrack/backend/internal/platform/response"
)

// maxImageBytes caps a feedback attachment (screenshot or photo) — well
// above what a page screenshot needs, well below anything that'd be
// awkward to store as plain files.
const maxImageBytes = 5 << 20

// allowedImageTypes are the only content types (sniffed from the file's
// actual bytes, never trusted from the filename) a feedback attachment may
// be. SVG is deliberately excluded — it can carry <script> and would be a
// stored-XSS vector if ever linked to directly.
var allowedImageTypes = map[string]string{
	"image/jpeg": ".jpg",
	"image/png":  ".png",
	"image/webp": ".webp",
}

type TicketHandler struct {
	svc       domain.TicketService
	uploadDir string
}

func NewTicketHandler(svc domain.TicketService, uploadDir string) *TicketHandler {
	return &TicketHandler{svc: svc, uploadDir: uploadDir}
}

func RegisterTicketRoutes(rg *gin.RouterGroup, h *TicketHandler, authMiddleware *middleware.AuthMiddleware) {
	tickets := rg.Group("/tickets")
	tickets.Use(authMiddleware.Authenticate())
	{
		// Open to every authenticated user — "Implement Feedback for all
		// users" — no permission gate beyond being logged in.
		tickets.POST("", h.CreateTicket)
		tickets.GET("/mine", h.ListMyTickets)
		tickets.GET("/:id", h.GetTicket)
		tickets.GET("/:id/history", h.GetTicketHistory)
		tickets.GET("/:id/image", h.GetTicketImage)

		// Triage is Super Admin only — same one-line gate Bulk Import
		// already uses, nothing new to build for it.
		tickets.GET("", authMiddleware.RequireRole("SUPER_ADMIN"), h.ListAllTickets)
		tickets.GET("/open-count", authMiddleware.RequireRole("SUPER_ADMIN"), h.CountOpen)
		tickets.PATCH("/:id/status", authMiddleware.RequireRole("SUPER_ADMIN"), h.UpdateStatus)
	}
}

func (h *TicketHandler) CreateTicket(c *gin.Context) {
	// Super Admin is who Feedback Loop notifies, not who it collects from —
	// enforced here too, not just by hiding the tab in the sidebar.
	if hasRole(c, "SUPER_ADMIN") {
		response.Forbidden(c, "Super Admin manages feedback, not submit it")
		return
	}
	// Always multipart, whether or not an image is attached — the frontend
	// always submits FormData now, so there's exactly one binding path to
	// maintain instead of two (JSON and multipart) for the same endpoint.
	req := domain.CreateTicketRequest{
		Category:    c.PostForm("category"),
		Description: c.PostForm("description"),
	}
	if v := c.PostForm("custom_category"); v != "" {
		req.CustomCategory = &v
	}
	if req.Category == "" || req.Description == "" {
		response.BadRequest(c, "category and description are required", nil)
		return
	}

	if fh, err := c.FormFile("image"); err == nil {
		path, saveErr := h.saveTicketImage(fh)
		if saveErr != nil {
			response.BadRequest(c, saveErr.Error(), nil)
			return
		}
		req.ImagePath = &path
	}

	userID := c.GetString("user_id")
	ticket, err := h.svc.CreateTicket(c.Request.Context(), &req, userID)
	if err != nil {
		if errors.Is(err, domain.ErrValidation) {
			response.BadRequest(c, err.Error(), nil)
			return
		}
		response.InternalError(c, err.Error())
		return
	}
	response.Success(c, http.StatusCreated, "Feedback submitted", ticket)
}

// validateImageUpload is the pure, directly-testable part of image
// validation: given a declared size and the file's first bytes, it returns
// the extension to save under or an error — no filesystem or multipart
// involved, so a test can call it with plain byte slices.
func validateImageUpload(size int64, head []byte) (string, error) {
	if size > maxImageBytes {
		return "", fmt.Errorf("image exceeds the %d MB limit", maxImageBytes>>20)
	}
	ext, ok := allowedImageTypes[http.DetectContentType(head)]
	if !ok {
		return "", fmt.Errorf("only JPEG, PNG, or WebP images are allowed")
	}
	return ext, nil
}

// saveTicketImage validates an uploaded file's real content (never trusting
// the filename/extension) and writes it under a fresh random name — 16
// random bytes hex-encoded is unique enough on its own, so no per-ticket
// folder is needed (the ticket doesn't exist yet at upload time anyway,
// since the image rides along in the same create-ticket request).
func (h *TicketHandler) saveTicketImage(fh *multipart.FileHeader) (string, error) {
	f, err := fh.Open()
	if err != nil {
		return "", fmt.Errorf("could not read the uploaded image")
	}
	defer f.Close()

	head := make([]byte, 512)
	n, _ := io.ReadFull(f, head)
	ext, err := validateImageUpload(fh.Size, head[:n])
	if err != nil {
		return "", err
	}

	nameBytes := make([]byte, 16)
	if _, err := rand.Read(nameBytes); err != nil {
		return "", fmt.Errorf("could not generate a filename")
	}
	relPath := hex.EncodeToString(nameBytes) + ext
	fullPath := filepath.Join(h.uploadDir, relPath)
	if err := os.MkdirAll(h.uploadDir, 0o755); err != nil {
		return "", fmt.Errorf("could not prepare storage for the image")
	}

	out, err := os.Create(fullPath)
	if err != nil {
		return "", fmt.Errorf("could not save the image")
	}
	defer out.Close()

	if _, err := f.Seek(0, io.SeekStart); err != nil {
		return "", fmt.Errorf("could not save the image")
	}
	if _, err := io.Copy(out, f); err != nil {
		return "", fmt.Errorf("could not save the image")
	}
	return relPath, nil
}

// GetTicketImage streams a ticket's attachment. Authorization mirrors
// GetTicket exactly (owner or Super Admin) via the same service call, so
// there's no separate access-control logic to get wrong here.
func (h *TicketHandler) GetTicketImage(c *gin.Context) {
	id := c.Param("id")
	userID := c.GetString("user_id")
	isSuperAdmin := hasRole(c, "SUPER_ADMIN")
	path, err := h.svc.GetTicketImagePath(c.Request.Context(), id, userID, isSuperAdmin)
	if err != nil {
		if errors.Is(err, domain.ErrForbidden) {
			response.Forbidden(c, "You can only view your own feedback")
			return
		}
		response.NotFound(c, "Ticket not found")
		return
	}
	if path == nil {
		response.NotFound(c, "This ticket has no image")
		return
	}
	c.File(filepath.Join(h.uploadDir, *path))
}

func (h *TicketHandler) ListMyTickets(c *gin.Context) {
	userID := c.GetString("user_id")
	page, err := h.svc.ListMyTickets(c.Request.Context(), userID, parseListParams(c))
	respondPage(c, page, err)
}

func (h *TicketHandler) ListAllTickets(c *gin.Context) {
	params := parseListParams(c)
	params.Status = c.Query("status")
	params.Category = c.Query("category")
	page, err := h.svc.ListAllTickets(c.Request.Context(), params)
	respondPage(c, page, err)
}

func respondPage(c *gin.Context, page *domain.TicketListPage, err error) {
	if err != nil {
		if errors.Is(err, pagination.ErrInvalidCursor) {
			response.BadRequest(c, "Invalid or expired cursor", nil)
			return
		}
		response.InternalError(c, err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    page.Items,
		"meta": gin.H{
			"next_cursor": page.NextCursor,
			"has_more":    page.HasMore,
		},
	})
}

func parseListParams(c *gin.Context) domain.ListTicketsParams {
	limit := 30
	if v := c.Query("limit"); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			limit = n
		}
	}
	return domain.ListTicketsParams{Limit: limit, Cursor: c.Query("cursor")}
}

func (h *TicketHandler) GetTicket(c *gin.Context) {
	id := c.Param("id")
	userID := c.GetString("user_id")
	isSuperAdmin := hasRole(c, "SUPER_ADMIN")
	ticket, err := h.svc.GetTicket(c.Request.Context(), id, userID, isSuperAdmin)
	if err != nil {
		if errors.Is(err, domain.ErrForbidden) {
			response.Forbidden(c, "You can only view your own feedback")
			return
		}
		response.NotFound(c, "Ticket not found")
		return
	}
	response.Success(c, http.StatusOK, "Ticket retrieved", ticket)
}

func (h *TicketHandler) GetTicketHistory(c *gin.Context) {
	id := c.Param("id")
	userID := c.GetString("user_id")
	isSuperAdmin := hasRole(c, "SUPER_ADMIN")
	history, err := h.svc.GetStatusHistory(c.Request.Context(), id, userID, isSuperAdmin)
	if err != nil {
		if errors.Is(err, domain.ErrForbidden) {
			response.Forbidden(c, "You can only view your own feedback")
			return
		}
		response.NotFound(c, "Ticket not found")
		return
	}
	response.Success(c, http.StatusOK, "Ticket history retrieved", history)
}

func (h *TicketHandler) UpdateStatus(c *gin.Context) {
	id := c.Param("id")
	var req domain.UpdateTicketStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error(), nil)
		return
	}
	actorID := c.GetString("user_id")
	if err := h.svc.UpdateStatus(c.Request.Context(), id, &req, actorID); err != nil {
		if errors.Is(err, domain.ErrValidation) {
			response.BadRequest(c, err.Error(), nil)
			return
		}
		response.NotFound(c, "Ticket not found")
		return
	}
	response.Success(c, http.StatusOK, "Ticket status updated", nil)
}

func (h *TicketHandler) CountOpen(c *gin.Context) {
	count, err := h.svc.CountOpen(c.Request.Context())
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.Success(c, http.StatusOK, "Open ticket count retrieved", gin.H{"open_count": count})
}

func hasRole(c *gin.Context, role string) bool {
	rolesVal, _ := c.Get("roles")
	roles, _ := rolesVal.([]string)
	for _, r := range roles {
		if r == role {
			return true
		}
	}
	return false
}
