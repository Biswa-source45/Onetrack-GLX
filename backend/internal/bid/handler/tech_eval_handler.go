package handler

import (
	"errors"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/onetrack/backend/internal/bid/domain"
	"github.com/onetrack/backend/internal/platform/response"
)

func techEvalError(c *gin.Context, err error) {
	var pg *pgconn.PgError
	switch {
	case errors.As(err, &pg) && pg.Code == "22P02": // not a valid uuid in the URL
		response.NotFound(c, "Tender not found")
	case errors.Is(err, domain.ErrValidation):
		response.BadRequest(c, err.Error(), nil)
	case errors.Is(err, domain.ErrForbidden):
		response.Forbidden(c, err.Error())
	case errors.Is(err, domain.ErrConflict):
		response.Conflict(c, err.Error())
	case errors.Is(err, pgx.ErrNoRows):
		response.NotFound(c, "Tender not found")
	default:
		log.Printf("tech-eval: %v", err)
		response.InternalError(c, "Could not complete the Technical Evaluation request")
	}
}

func (h *BidHandler) OpenTechEval(c *gin.Context) {
	var req domain.OpenTechEvalRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request", nil)
		return
	}
	te, err := h.svc.OpenTechEval(c.Request.Context(), c.Param("id"), &req, c.GetString("user_id"))
	if err != nil {
		techEvalError(c, err)
		return
	}
	response.Success(c, http.StatusOK, "Technical Evaluation opened", te)
}

func (h *BidHandler) SetTechEvalDate(c *gin.Context) {
	var req domain.SetTechEvalDateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request", nil)
		return
	}
	te, err := h.svc.SetTechEvalDate(c.Request.Context(), c.Param("id"), &req, c.GetString("user_id"))
	if err != nil {
		techEvalError(c, err)
		return
	}
	response.Success(c, http.StatusOK, "Date saved", te)
}

func (h *BidHandler) AddTechEvalNote(c *gin.Context) {
	var req domain.AddTechEvalNoteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request", nil)
		return
	}
	te, err := h.svc.AddTechEvalNote(c.Request.Context(), c.Param("id"), &req, c.GetString("user_id"))
	if err != nil {
		techEvalError(c, err)
		return
	}
	response.Success(c, http.StatusCreated, "Note added", te)
}
