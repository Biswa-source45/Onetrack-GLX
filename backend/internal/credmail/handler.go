package credmail

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/onetrack/backend/internal/middleware"
	"github.com/onetrack/backend/internal/platform/response"
)

type Handler struct{ svc *Service }

func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

// RegisterRoutes mounts the Super Admin only routes under /users/credentials. Gin matches the fixed
// "credentials" segment ahead of the user routes' ":id".
func RegisterRoutes(router *gin.RouterGroup, h *Handler, auth *middleware.AuthMiddleware) {
	g := router.Group("/users/credentials")
	g.Use(auth.Authenticate(), auth.RequireAnyRole("SUPER_ADMIN"))
	g.GET("/preview", h.Preview)
	g.POST("/send", h.Send)
	g.GET("/batches/:id", h.Batch)
}

func (h *Handler) Preview(c *gin.Context) {
	p, err := h.svc.Preview(c.Request.Context())
	if err != nil {
		response.InternalError(c, "Could not load the users")
		return
	}
	response.Success(c, http.StatusOK, "", p)
}

func (h *Handler) Send(c *gin.Context) {
	var req SendRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request payload", err.Error())
		return
	}
	for _, k := range req.Kinds {
		if k != KindInitial && k != KindReset && k != KindTemp {
			response.BadRequest(c, "Unknown mail kind", string(k))
			return
		}
	}
	actor, _ := c.Get("user_id")
	actorID, _ := actor.(string)

	var mismatch *PasswordMismatchError
	id, total, err := h.svc.Send(c.Request.Context(), actorID, req)
	switch {
	case err == nil:
		response.Success(c, http.StatusAccepted, "Sending started", gin.H{"batch_id": id, "total": total})
	case errors.As(err, &mismatch):
		response.Error(c, http.StatusUnprocessableEntity, "PASSWORD_MISMATCH", mismatch.Error(), gin.H{"usernames": mismatch.Usernames})
	case errors.Is(err, ErrNotConfigured):
		response.Error(c, http.StatusPreconditionFailed, "EMAIL_NOT_CONFIGURED", err.Error(), nil)
	case errors.Is(err, ErrBatchRunning):
		response.Conflict(c, "A batch is already being sent. Wait for it to finish.")
	case errors.Is(err, ErrNothingToSend):
		response.BadRequest(c, err.Error(), nil)
	default:
		response.InternalError(c, "Could not start sending")
	}
}

func (h *Handler) Batch(c *gin.Context) {
	b, err := h.svc.Batch(c.Request.Context(), c.Param("id"))
	switch {
	case err == nil:
		response.Success(c, http.StatusOK, "", b)
	case errors.Is(err, ErrBatchNotFound):
		response.NotFound(c, "Batch not found")
	default:
		// Includes a malformed id (Postgres rejects it as a uuid): not found is the honest answer for the caller.
		response.NotFound(c, "Batch not found")
	}
}
