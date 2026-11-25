package extractor

import (
	"fmt"
	"io"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/onetrack/backend/internal/platform/response"
)

const maxUploadSize = 25 * 1024 * 1024 // 25 MB

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// ExtractDocument handles POST /api/v1/tenders/extract-document
func (h *Handler) ExtractDocument(c *gin.Context) {
	h.extractWithMode(c, "tender")
}

// ExtractLeadDocument handles POST /api/v1/leads/extract-document
func (h *Handler) ExtractLeadDocument(c *gin.Context) {
	h.extractWithMode(c, "lead")
}

func (h *Handler) extractWithMode(c *gin.Context, defaultMode string) {
	// Limit upload size
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxUploadSize)

	file, header, err := c.Request.FormFile("file")
	if err != nil {
		response.BadRequest(c, "Please attach a document using the form field 'file' (.pdf, .docx, or .txt)", nil)
		return
	}
	defer file.Close()

	if header.Size > maxUploadSize {
		response.BadRequest(c, fmt.Sprintf("File size exceeds 25 MB limit (%d bytes)", header.Size), nil)
		return
	}

	fileBytes, err := io.ReadAll(file)
	if err != nil {
		response.InternalError(c, fmt.Sprintf("Failed to read uploaded file: %v", err))
		return
	}

	mode := c.Query("mode")
	if mode == "" {
		mode = c.PostForm("mode")
	}
	if mode == "" {
		mode = defaultMode
	}

	// Delegate document extraction & accuracy scoring to Python FastAPI microservice
	extractionResp, err := h.service.ExtractDocumentViaMicroservice(c.Request.Context(), header.Filename, fileBytes, mode)
	if err != nil {
		response.InternalError(c, fmt.Sprintf("AI extraction microservice error: %v", err))
		return
	}

	c.JSON(http.StatusOK, extractionResp)
}
