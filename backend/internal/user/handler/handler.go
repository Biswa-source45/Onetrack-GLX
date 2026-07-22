package handler

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/onetrack/backend/internal/platform/response"
	"github.com/onetrack/backend/internal/user/domain"
	"github.com/onetrack/backend/internal/user/service"
)

type UserHandler struct {
	userService domain.UserService
}

func NewUserHandler(userService domain.UserService) *UserHandler {
	return &UserHandler{userService: userService}
}

func (h *UserHandler) CreateUser(c *gin.Context) {
	var req domain.CreateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request payload", err.Error())
		return
	}

	createdBy, _ := c.Get("user_id")

	result, err := h.userService.CreateUser(c.Request.Context(), req, createdBy.(string))
	if err != nil {
		switch {
		case errors.Is(err, service.ErrUsernameExists):
			response.Conflict(c, "Username already exists")
		case errors.Is(err, service.ErrEmployeeCodeExists):
			response.Conflict(c, "Employee code already exists")
		case strings.Contains(err.Error(), "role not found"):
			response.BadRequest(c, "Invalid role specified", err.Error())
		default:
			response.InternalError(c, "Failed to create user")
		}
		return
	}

	response.Success(c, http.StatusCreated, "User created successfully", result)
}

func (h *UserHandler) ListUsers(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	search := c.Query("search")
	role := c.Query("role")
	department := c.Query("department")

	var isActive *bool
	if activeStr := c.Query("is_active"); activeStr != "" {
		val := activeStr == "true"
		isActive = &val
	}

	params := domain.ListUsersParams{
		Page:       page,
		Limit:      limit,
		Search:     search,
		Role:       role,
		IsActive:   isActive,
		Department: department,
	}

	result, err := h.userService.ListUsers(c.Request.Context(), params)
	if err != nil {
		response.InternalError(c, "Failed to list users")
		return
	}

	response.Success(c, http.StatusOK, "Users retrieved successfully", result)
}

func (h *UserHandler) GetUser(c *gin.Context) {
	id := c.Param("id")

	result, err := h.userService.GetUser(c.Request.Context(), id)
	if err != nil {
		if errors.Is(err, service.ErrUserNotFound) {
			response.NotFound(c, "User not found")
			return
		}
		response.InternalError(c, "Failed to get user")
		return
	}

	response.Success(c, http.StatusOK, "User retrieved successfully", result)
}

func (h *UserHandler) GetMyProfile(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		response.Unauthorized(c, "User not authenticated")
		return
	}

	result, err := h.userService.GetMyProfile(c.Request.Context(), userID.(string))
	if err != nil {
		if errors.Is(err, service.ErrUserNotFound) {
			response.NotFound(c, "User not found")
			return
		}
		response.InternalError(c, "Failed to get profile")
		return
	}

	response.Success(c, http.StatusOK, "Profile retrieved successfully", result)
}

func (h *UserHandler) UpdateUser(c *gin.Context) {
	id := c.Param("id")

	var req domain.UpdateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request payload", err.Error())
		return
	}

	result, err := h.userService.UpdateUser(c.Request.Context(), id, req)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrUserNotFound):
			response.NotFound(c, "User not found")
		case errors.Is(err, service.ErrNoFieldsToUpdate):
			response.BadRequest(c, "No fields to update", nil)
		default:
			response.InternalError(c, "Failed to update user")
		}
		return
	}

	response.Success(c, http.StatusOK, "User updated successfully", result)
}

func (h *UserHandler) UpdateStatus(c *gin.Context) {
	id := c.Param("id")

	var req domain.UpdateStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request payload", err.Error())
		return
	}

	err := h.userService.UpdateStatus(c.Request.Context(), id, req)
	if err != nil {
		if errors.Is(err, service.ErrUserNotFound) {
			response.NotFound(c, "User not found")
			return
		}
		response.InternalError(c, "Failed to update status")
		return
	}

	status := "activated"
	if !req.IsActive {
		status = "deactivated"
	}
	response.Success(c, http.StatusOK, "User "+status+" successfully", nil)
}

func (h *UserHandler) UpdateRoles(c *gin.Context) {
	id := c.Param("id")

	var req domain.UpdateRolesRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request payload", err.Error())
		return
	}

	assignedBy, _ := c.Get("user_id")

	err := h.userService.UpdateRoles(c.Request.Context(), id, req, assignedBy.(string))
	if err != nil {
		switch {
		case errors.Is(err, service.ErrUserNotFound):
			response.NotFound(c, "User not found")
		case strings.Contains(err.Error(), "role not found"):
			response.BadRequest(c, "Invalid role specified", err.Error())
		default:
			response.InternalError(c, "Failed to update roles")
		}
		return
	}

	response.Success(c, http.StatusOK, "Roles updated successfully", nil)
}

func (h *UserHandler) UpdatePermissions(c *gin.Context) {
	id := c.Param("id")

	var req domain.UpdatePermissionsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request payload", err.Error())
		return
	}

	err := h.userService.UpdatePermissions(c.Request.Context(), id, req)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrUserNotFound):
			response.NotFound(c, "User not found")
		case strings.Contains(err.Error(), "permission not found"):
			response.BadRequest(c, "Invalid permission specified", err.Error())
		case strings.Contains(err.Error(), "invalid permission format"):
			response.BadRequest(c, "Invalid permission format (expected resource.action)", err.Error())
		default:
			response.InternalError(c, "Failed to update permissions")
		}
		return
	}

	response.Success(c, http.StatusOK, "Permission overrides updated successfully", nil)
}
