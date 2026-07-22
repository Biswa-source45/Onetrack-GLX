package handler

import (
	"errors"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/onetrack/backend/internal/auth/domain"
	"github.com/onetrack/backend/internal/auth/service"
	"github.com/onetrack/backend/internal/platform/response"
)

type AuthHandler struct {
	authService domain.AuthService
}

func NewAuthHandler(authService domain.AuthService) *AuthHandler {
	return &AuthHandler{authService: authService}
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req domain.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request payload", err.Error())
		return
	}

	result, err := h.authService.Login(c.Request.Context(), req)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrInvalidCredentials):
			response.Unauthorized(c, "Invalid username or password")
		case errors.Is(err, service.ErrAccountInactive):
			response.Forbidden(c, "Account is inactive")
		default:
			response.InternalError(c, "Login failed")
		}
		return
	}

	response.Success(c, http.StatusOK, "Login successful", result)
}

func (h *AuthHandler) Refresh(c *gin.Context) {
	var req domain.RefreshRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request payload", err.Error())
		return
	}

	result, err := h.authService.RefreshToken(c.Request.Context(), req.RefreshToken)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrTokenBlacklisted):
			response.Unauthorized(c, "Token has been invalidated")
		case errors.Is(err, service.ErrAccountInactive):
			response.Forbidden(c, "Account is inactive")
		default:
			response.Unauthorized(c, "Invalid refresh token")
		}
		return
	}

	response.Success(c, http.StatusOK, "Token refreshed successfully", result)
}

func (h *AuthHandler) Logout(c *gin.Context) {
	accessToken := extractTokenFromHeader(c)
	if accessToken == "" {
		response.Unauthorized(c, "No token provided")
		return
	}

	// Get refresh token from body (optional, for full invalidation)
	var body struct {
		RefreshToken string `json:"refresh_token"`
	}
	_ = c.ShouldBindJSON(&body)

	refreshToken := body.RefreshToken
	if refreshToken == "" {
		refreshToken = "placeholder"
	}

	if err := h.authService.Logout(c.Request.Context(), accessToken, refreshToken); err != nil {
		response.InternalError(c, "Logout failed")
		return
	}

	response.Success(c, http.StatusOK, "Logged out successfully", nil)
}

func (h *AuthHandler) ChangePassword(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		response.Unauthorized(c, "User not authenticated")
		return
	}

	var req domain.ChangePasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request payload", err.Error())
		return
	}

	err := h.authService.ChangePassword(c.Request.Context(), userID.(string), req)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrInvalidCurrentPassword):
			response.BadRequest(c, "Current password is incorrect", nil)
		case errors.Is(err, service.ErrUserNotFound):
			response.NotFound(c, "User not found")
		default:
			response.InternalError(c, "Failed to change password")
		}
		return
	}

	response.Success(c, http.StatusOK, "Password changed successfully", nil)
}

func (h *AuthHandler) ForceReset(c *gin.Context) {
	var req domain.ForceResetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request payload", err.Error())
		return
	}

	err := h.authService.ForceResetPassword(c.Request.Context(), req)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrUserNotFound):
			response.NotFound(c, "User not found")
		default:
			response.InternalError(c, "Failed to reset password")
		}
		return
	}

	response.Success(c, http.StatusOK, "Password reset successfully", nil)
}

func extractTokenFromHeader(c *gin.Context) string {
	authHeader := c.GetHeader("Authorization")
	if authHeader == "" {
		return ""
	}
	parts := strings.SplitN(authHeader, " ", 2)
	if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
		return ""
	}
	return parts[1]
}
