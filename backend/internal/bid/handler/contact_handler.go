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

func contactError(c *gin.Context, err error) {
	var pg *pgconn.PgError
	switch {
	case errors.As(err, &pg) && pg.Code == "22P02": // not a valid uuid in the URL or body
		response.NotFound(c, "Contact not found")
	case errors.Is(err, domain.ErrValidation):
		response.BadRequest(c, err.Error(), nil)
	case errors.Is(err, domain.ErrConflict):
		response.Conflict(c, err.Error())
	case errors.Is(err, pgx.ErrNoRows):
		response.NotFound(c, "Contact not found")
	default:
		log.Printf("contacts: %v", err)
		response.InternalError(c, "Could not complete the contact request")
	}
}

func (h *BidHandler) ListContacts(c *gin.Context) {
	items, err := h.svc.ListContacts(c.Request.Context(), c.Param("id"))
	if err != nil {
		contactError(c, err)
		return
	}
	response.Success(c, http.StatusOK, "Contacts retrieved", items)
}

func (h *BidHandler) AddContact(c *gin.Context) {
	var req domain.SaveContactRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error(), nil)
		return
	}
	item, err := h.svc.AddContact(c.Request.Context(), c.Param("id"), &req, c.GetString("user_id"))
	if err != nil {
		contactError(c, err)
		return
	}
	response.Success(c, http.StatusCreated, "Contact added", item)
}

func (h *BidHandler) UpdateContact(c *gin.Context) {
	var req domain.UpdateContactRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error(), nil)
		return
	}
	item, err := h.svc.UpdateContact(c.Request.Context(), c.Param("id"), c.Param("cid"), &req, c.GetString("user_id"))
	if err != nil {
		contactError(c, err)
		return
	}
	response.Success(c, http.StatusOK, "Contact updated", item)
}

func (h *BidHandler) DeleteContact(c *gin.Context) {
	if err := h.svc.DeleteContact(c.Request.Context(), c.Param("id"), c.Param("cid"), c.GetString("user_id")); err != nil {
		contactError(c, err)
		return
	}
	response.Success(c, http.StatusOK, "Contact deleted", nil)
}

func (h *BidHandler) ReorderContacts(c *gin.Context) {
	var req domain.ReorderContactsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error(), nil)
		return
	}
	items, err := h.svc.ReorderContacts(c.Request.Context(), c.Param("id"), &req, c.GetString("user_id"))
	if err != nil {
		contactError(c, err)
		return
	}
	response.Success(c, http.StatusOK, "Contacts reordered", items)
}
