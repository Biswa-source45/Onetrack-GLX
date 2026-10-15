package directory

import (
	"errors"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/onetrack/backend/internal/middleware"
	"github.com/onetrack/backend/internal/platform/response"
)

type Handler struct{ repo *Repo }

func NewHandler(repo *Repo) *Handler { return &Handler{repo: repo} }

// RegisterRoutes mounts /directory/{accounts|oems}. The role is checked per kind, so an Account
// Manager cannot open the OEM list and a Pre-Sales person cannot open accounts; Admins hold neither.
func RegisterRoutes(rg *gin.RouterGroup, h *Handler, auth *middleware.AuthMiddleware) {
	g := rg.Group("/directory/:kind")
	g.Use(auth.Authenticate(), kindGate)
	{
		g.GET("", h.list)
		g.POST("", h.create)
		g.GET("/:id", h.get)
		g.PUT("/:id", h.update)
		g.DELETE("/:id", h.remove)
		g.POST("/:id/contacts", h.addContact)
		g.PUT("/:id/contacts/:cid", h.updateContact)
		g.DELETE("/:id/contacts/:cid", h.deleteContact)
	}
}

const ctxKind = "directory_kind"

func kindGate(c *gin.Context) {
	k, ok := kinds[c.Param("kind")]
	if !ok {
		response.NotFound(c, "Not found")
		c.Abort()
		return
	}
	roles, _ := c.Get("roles")
	held, _ := roles.([]string)
	for _, r := range held {
		if r == k.role {
			c.Set(ctxKind, k.db)
			c.Next()
			return
		}
	}
	response.Forbidden(c, "Your role does not have this list")
	c.Abort()
}

// fail answers for an error from the repository or Normalize.
func fail(c *gin.Context, err error) {
	switch {
	case errors.Is(err, ErrValidation):
		response.BadRequest(c, UserMessage(err), nil)
	case errors.Is(err, ErrNotFound):
		response.NotFound(c, "Not found")
	case errors.Is(err, ErrDuplicate):
		response.Conflict(c, "You already have one with this name")
	default:
		log.Printf("[directory] %v", err)
		response.InternalError(c, "Something went wrong, please try again")
	}
}

func who(c *gin.Context) (owner, kind string) { return c.GetString("user_id"), c.GetString(ctxKind) }

// reply sends the record as it now stands, so the screen never has to guess what a write did.
func (h *Handler) reply(c *gin.Context, status int, msg, id string) {
	owner, kind := who(c)
	e, err := h.repo.Get(c.Request.Context(), owner, kind, id)
	if err != nil {
		fail(c, err)
		return
	}
	response.Success(c, status, msg, e)
}

func (h *Handler) list(c *gin.Context) {
	owner, kind := who(c)
	out, err := h.repo.List(c.Request.Context(), owner, kind)
	if err != nil {
		fail(c, err)
		return
	}
	response.Success(c, http.StatusOK, "Retrieved", out)
}

func (h *Handler) get(c *gin.Context) { h.reply(c, http.StatusOK, "Retrieved", c.Param("id")) }

func (h *Handler) create(c *gin.Context) {
	var in EntryInput
	if c.ShouldBindJSON(&in) != nil {
		response.BadRequest(c, "Invalid request", nil)
		return
	}
	if err := in.Normalize(); err != nil {
		fail(c, err)
		return
	}
	owner, kind := who(c)
	id, err := h.repo.Create(c.Request.Context(), owner, kind, in)
	if err != nil {
		fail(c, err)
		return
	}
	h.reply(c, http.StatusCreated, "Created", id)
}

func (h *Handler) update(c *gin.Context) {
	var in EntryInput
	if c.ShouldBindJSON(&in) != nil {
		response.BadRequest(c, "Invalid request", nil)
		return
	}
	if err := in.Normalize(); err != nil {
		fail(c, err)
		return
	}
	owner, kind := who(c)
	if err := h.repo.Update(c.Request.Context(), owner, kind, c.Param("id"), in); err != nil {
		fail(c, err)
		return
	}
	h.reply(c, http.StatusOK, "Updated", c.Param("id"))
}

func (h *Handler) remove(c *gin.Context) {
	owner, kind := who(c)
	if err := h.repo.Delete(c.Request.Context(), owner, kind, c.Param("id")); err != nil {
		fail(c, err)
		return
	}
	response.Success(c, http.StatusOK, "Deleted", nil)
}

func (h *Handler) addContact(c *gin.Context) {
	var in ContactInput
	if c.ShouldBindJSON(&in) != nil {
		response.BadRequest(c, "Invalid request", nil)
		return
	}
	if err := in.Normalize(); err != nil {
		fail(c, err)
		return
	}
	owner, kind := who(c)
	if err := h.repo.AddContact(c.Request.Context(), owner, kind, c.Param("id"), in); err != nil {
		fail(c, err)
		return
	}
	h.reply(c, http.StatusCreated, "Contact added", c.Param("id"))
}

func (h *Handler) updateContact(c *gin.Context) {
	var in ContactInput
	if c.ShouldBindJSON(&in) != nil {
		response.BadRequest(c, "Invalid request", nil)
		return
	}
	if err := in.Normalize(); err != nil {
		fail(c, err)
		return
	}
	owner, kind := who(c)
	if err := h.repo.UpdateContact(c.Request.Context(), owner, kind, c.Param("id"), c.Param("cid"), in); err != nil {
		fail(c, err)
		return
	}
	h.reply(c, http.StatusOK, "Contact updated", c.Param("id"))
}

func (h *Handler) deleteContact(c *gin.Context) {
	owner, kind := who(c)
	if err := h.repo.DeleteContact(c.Request.Context(), owner, kind, c.Param("id"), c.Param("cid")); err != nil {
		fail(c, err)
		return
	}
	h.reply(c, http.StatusOK, "Contact deleted", c.Param("id"))
}
