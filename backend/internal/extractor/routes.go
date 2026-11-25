package extractor

import (
	"github.com/gin-gonic/gin"
	"github.com/onetrack/backend/internal/middleware"
)

// RegisterRoutes registers the AI document extraction endpoints.
func RegisterRoutes(rg *gin.RouterGroup, h *Handler, authMiddleware *middleware.AuthMiddleware) {
	// 1. Production Authenticated Routes
	tendersAuth := rg.Group("/tenders")
	if authMiddleware != nil {
		tendersAuth.Use(authMiddleware.Authenticate())
	}
	{
		tendersAuth.POST("/extract-document", h.ExtractDocument)
	}

	bidsAuth := rg.Group("/bids")
	if authMiddleware != nil {
		bidsAuth.Use(authMiddleware.Authenticate())
	}
	{
		bidsAuth.POST("/extract-document", h.ExtractDocument)
	}

	leadsAuth := rg.Group("/leads")
	if authMiddleware != nil {
		leadsAuth.Use(authMiddleware.Authenticate())
	}
	{
		leadsAuth.POST("/extract-document", h.ExtractLeadDocument)
	}

	// 2. Direct Testing Routes (for Postman testing without requiring prior JWT login)
	testGroup := rg.Group("/tenders/extract-document")
	{
		testGroup.POST("/test", h.ExtractDocument)
	}
	bidsTestGroup := rg.Group("/bids/extract-document")
	{
		bidsTestGroup.POST("/test", h.ExtractDocument)
	}
	leadsTestGroup := rg.Group("/leads/extract-document")
	{
		leadsTestGroup.POST("/test", h.ExtractLeadDocument)
	}
}
