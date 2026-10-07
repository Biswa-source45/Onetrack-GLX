package handler

import (
	"bytes"
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
	"strings"

	"github.com/gin-gonic/gin"
	alertDomain "github.com/onetrack/backend/internal/alert/domain"
	"github.com/onetrack/backend/internal/lead/domain"
	"github.com/onetrack/backend/internal/lead/repository"
	"github.com/onetrack/backend/internal/middleware"
	"github.com/onetrack/backend/internal/platform/response"
)

// maxDocBytes caps one lead document. The frontend uploads files one per
// request, so this is also the request cap (plus multipart overhead).
const maxDocBytes = 25 << 20

type LeadHandler struct {
	repo    *repository.Repo
	rootDir string
	alerts  alertDomain.AlertService // nil = no notifications
}

func NewLeadHandler(repo *repository.Repo, rootDir string, alerts alertDomain.AlertService) *LeadHandler {
	return &LeadHandler{repo: repo, rootDir: rootDir, alerts: alerts}
}

func RegisterLeadRoutes(rg *gin.RouterGroup, h *LeadHandler, auth *middleware.AuthMiddleware) {
	leads := rg.Group("/leads")
	leads.Use(auth.Authenticate())
	{
		leads.GET("", auth.RequirePermission("lead.view"), h.List)
		leads.POST("", auth.RequirePermission("lead.create"), h.Create)
		leads.GET("/:id", auth.RequirePermission("lead.view"), h.Get)
		// Editing and the approval workflow are gated per lead (its Reporting
		// Manager, its approver, Admin/Manager roles — see domain/workflow.go),
		// not by a blanket permission: seeing the lead is the only precondition.
		leads.PUT("/:id", auth.RequirePermission("lead.view"), h.Update)
		leads.POST("/:id/transition", auth.RequirePermission("lead.view"), h.Transition)
		leads.DELETE("/:id", auth.RequirePermission("lead.view"), h.Delete)
		leads.POST("/:id/documents", auth.RequirePermission("lead.create"), h.UploadDocument)
		leads.GET("/:id/documents/:docId", auth.RequirePermission("lead.view"), h.DownloadDocument)
		leads.DELETE("/:id/documents/:docId", auth.RequirePermission("lead.create"), h.DeleteDocument)
	}
}

func (h *LeadHandler) List(c *gin.Context) {
	leads, err := h.repo.List(c.Request.Context())
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.Success(c, http.StatusOK, "Leads retrieved", leads)
}

func (h *LeadHandler) Create(c *gin.Context) {
	var req domain.CreateLeadRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "invalid lead payload", nil)
		return
	}
	userID := c.GetString("user_id")
	if strings.TrimSpace(req.LeadOwnerID) == "" {
		req.LeadOwnerID = userID // "by default who is adding"
	}
	if err := req.Normalize(); err != nil {
		response.BadRequest(c, userMessage(err), nil)
		return
	}

	name := req.AccountName
	if req.Title != nil {
		name = *req.Title
	}
	folder := domain.FolderSlug(name) + "-" + randomHex(3)

	id, err := h.repo.Create(c.Request.Context(), &req, userID, folder)
	if err != nil {
		if errors.Is(err, domain.ErrValidation) {
			response.BadRequest(c, userMessage(err), nil)
			return
		}
		response.InternalError(c, err.Error())
		return
	}
	// Folder exists from day one so it's visible on the host even before
	// any upload. Best-effort: uploads MkdirAll again anyway.
	if err := os.MkdirAll(filepath.Join(h.rootDir, folder, "docs"), 0o755); err != nil {
		log.Printf("[leads] could not create folder for lead %s: %v", id, err)
	}

	lead, err := h.repo.Get(c.Request.Context(), id)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	h.notifyCreated(lead, userID)
	h.forActor(lead, actorOf(c))
	response.Success(c, http.StatusCreated, "Lead created", lead)
}

func (h *LeadHandler) Get(c *gin.Context) {
	lead, err := h.repo.Get(c.Request.Context(), c.Param("id"))
	if errors.Is(err, domain.ErrNotFound) {
		response.NotFound(c, "Lead not found")
		return
	}
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	h.forActor(lead, actorOf(c))
	response.Success(c, http.StatusOK, "Lead retrieved", lead)
}

// UploadDocument stores one file: multipart fields "file" and optional
// "category" (blank = bulk upload). Saved at
// <root>/<lead folder>/docs[/<Category>]/<random>_<name>.
func (h *LeadHandler) UploadDocument(c *gin.Context) {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxDocBytes+(1<<20))
	folder, err := h.repo.FolderName(c.Request.Context(), c.Param("id"))
	if errors.Is(err, domain.ErrNotFound) {
		response.NotFound(c, "Lead not found")
		return
	}
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	fh, err := c.FormFile("file")
	if err != nil {
		response.BadRequest(c, fmt.Sprintf("attach one file up to %d MB", maxDocBytes>>20), nil)
		return
	}
	var category *string
	if v := strings.TrimSpace(c.PostForm("category")); v != "" {
		if len([]rune(v)) > 60 {
			v = string([]rune(v)[:60])
		}
		category = &v
	}

	doc, err := h.saveDocument(fh, folder, category)
	if err != nil {
		response.BadRequest(c, err.Error(), nil)
		return
	}
	if err := h.repo.AddDocument(c.Request.Context(), c.Param("id"), doc, c.GetString("user_id")); err != nil {
		_ = os.Remove(filepath.Join(h.rootDir, folder, doc.StoredPath))
		response.InternalError(c, err.Error())
		return
	}
	response.Success(c, http.StatusCreated, "Document uploaded", doc)
}

func (h *LeadHandler) saveDocument(fh *multipart.FileHeader, folder string, category *string) (*domain.Document, error) {
	f, err := fh.Open()
	if err != nil {
		return nil, fmt.Errorf("could not read the uploaded file")
	}
	defer f.Close()

	head := make([]byte, 512)
	n, _ := io.ReadFull(f, head)
	contentType, err := validateDocument(fh.Size, fh.Filename, head[:n])
	if err != nil {
		return nil, err
	}

	dir := "docs"
	if category != nil {
		dir = filepath.Join("docs", safeName(*category))
	}
	rel := filepath.ToSlash(filepath.Join(dir, randomHex(4)+"_"+safeName(filepath.Base(fh.Filename))))
	full := filepath.Join(h.rootDir, folder, rel)
	if err := os.MkdirAll(filepath.Dir(full), 0o755); err != nil {
		return nil, fmt.Errorf("could not prepare storage for the file")
	}
	out, err := os.Create(full)
	if err != nil {
		return nil, fmt.Errorf("could not save the file")
	}
	if _, err := f.Seek(0, io.SeekStart); err == nil {
		_, err = io.Copy(out, f)
	}
	if cerr := out.Close(); err == nil {
		err = cerr
	}
	if err != nil {
		_ = os.Remove(full)
		return nil, fmt.Errorf("could not save the file")
	}
	return &domain.Document{
		Category:     category,
		OriginalName: filepath.Base(fh.Filename),
		StoredPath:   rel,
		ContentType:  contentType,
		SizeBytes:    fh.Size,
	}, nil
}

func (h *LeadHandler) DownloadDocument(c *gin.Context) {
	doc, folder, err := h.repo.Document(c.Request.Context(), c.Param("id"), c.Param("docId"))
	if errors.Is(err, domain.ErrNotFound) {
		response.NotFound(c, "Document not found")
		return
	}
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	full := filepath.Join(h.rootDir, folder, filepath.FromSlash(doc.StoredPath))
	if _, err := os.Stat(full); err != nil {
		response.NotFound(c, "File is missing from storage")
		return
	}
	c.Header("Content-Type", doc.ContentType)
	c.FileAttachment(full, doc.OriginalName)
}

func (h *LeadHandler) DeleteDocument(c *gin.Context) {
	doc, folder, err := h.repo.Document(c.Request.Context(), c.Param("id"), c.Param("docId"))
	if errors.Is(err, domain.ErrNotFound) {
		response.NotFound(c, "Document not found")
		return
	}
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	if err := h.repo.DeleteDocument(c.Request.Context(), doc.ID); err != nil {
		response.InternalError(c, err.Error())
		return
	}
	// Row first, file second: a failed file delete leaves a harmless orphan
	// on disk rather than a listed document that 404s.
	_ = os.Remove(filepath.Join(h.rootDir, folder, filepath.FromSlash(doc.StoredPath)))
	response.Success(c, http.StatusOK, "Document deleted", nil)
}

// oleMagic starts every legacy Office file (.doc/.xls/.ppt).
var oleMagic = []byte{0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1}

// validateDocument checks size and the file's real bytes — never the
// filename alone — and returns the content type to store. PDF, JPEG/PNG/
// WebP images, and Office files (modern ones are ZIPs, so the extension
// picks which). SVG/HTML are rejected: they can carry scripts.
func validateDocument(size int64, filename string, head []byte) (string, error) {
	if size > maxDocBytes {
		return "", fmt.Errorf("file exceeds the %d MB limit", maxDocBytes>>20)
	}
	if size == 0 {
		return "", fmt.Errorf("file is empty")
	}
	ext := strings.ToLower(filepath.Ext(filename))
	sniffed := http.DetectContentType(head)
	switch {
	case sniffed == "application/pdf", sniffed == "image/jpeg", sniffed == "image/png", sniffed == "image/webp":
		return sniffed, nil
	case sniffed == "application/zip" && ext == ".docx":
		return "application/vnd.openxmlformats-officedocument.wordprocessingml.document", nil
	case sniffed == "application/zip" && ext == ".xlsx":
		return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", nil
	case sniffed == "application/zip" && ext == ".pptx":
		return "application/vnd.openxmlformats-officedocument.presentationml.presentation", nil
	case bytes.HasPrefix(head, oleMagic) && (ext == ".doc" || ext == ".xls" || ext == ".ppt"):
		return map[string]string{".doc": "application/msword", ".xls": "application/vnd.ms-excel",
			".ppt": "application/vnd.ms-powerpoint"}[ext], nil
	}
	return "", fmt.Errorf("only PDF, images (JPG/PNG/WebP) and Office files (Word/Excel/PowerPoint) are allowed")
}

// safeName keeps a readable, filesystem-safe version of a user-supplied
// name: letters, digits, dot, dash, underscore; everything else becomes
// "_". Capped at 100 chars, keeping the extension.
func safeName(name string) string {
	var b strings.Builder
	for _, c := range name {
		if (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '.' || c == '-' || c == '_' {
			b.WriteRune(c)
		} else {
			b.WriteByte('_')
		}
	}
	s := strings.Trim(b.String(), "._")
	if s == "" {
		s = "file"
	}
	if len(s) > 100 {
		ext := filepath.Ext(s)
		if len(ext) > 10 {
			ext = ""
		}
		s = s[:100-len(ext)] + ext
	}
	return s
}

// userMessage drops the "validation error: " sentinel prefix, leaving the
// sentence the user should actually read in the toast.
func userMessage(err error) string {
	return strings.TrimPrefix(err.Error(), domain.ErrValidation.Error()+": ")
}

func randomHex(n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}
