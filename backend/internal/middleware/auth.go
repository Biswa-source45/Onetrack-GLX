package middleware

import (
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/onetrack/backend/internal/auth/domain"
	"github.com/onetrack/backend/internal/platform/response"
)

type AuthMiddleware struct {
	jwtService domain.JWTService
}

func NewAuthMiddleware(jwtService domain.JWTService) *AuthMiddleware {
	return &AuthMiddleware{jwtService: jwtService}
}

func (m *AuthMiddleware) Authenticate() gin.HandlerFunc {
	return func(c *gin.Context) {
		token := extractBearerToken(c)
		if token == "" {
			response.Unauthorized(c, "Missing or invalid authorization header")
			c.Abort()
			return
		}

		// Check if token is blacklisted
		blacklisted, err := m.jwtService.IsTokenBlacklisted(c.Request.Context(), token)
		if err != nil {
			response.InternalError(c, "Failed to validate token")
			c.Abort()
			return
		}
		if blacklisted {
			response.Unauthorized(c, "Token has been invalidated")
			c.Abort()
			return
		}

		// Validate token
		claims, err := m.jwtService.ValidateAccessToken(token)
		if err != nil {
			response.Unauthorized(c, "Invalid or expired token")
			c.Abort()
			return
		}

		// Set user context
		c.Set("user_id", claims.UserID)
		c.Set("username", claims.Username)
		c.Set("roles", claims.Roles)
		c.Set("permissions", claims.Permissions)

		c.Next()
	}
}

func (m *AuthMiddleware) RequirePermission(permission string) gin.HandlerFunc {
	return func(c *gin.Context) {
		permissions, exists := c.Get("permissions")
		if !exists {
			response.Forbidden(c, "No permissions found")
			c.Abort()
			return
		}

		userPermissions, ok := permissions.([]string)
		if !ok {
			response.Forbidden(c, "Invalid permissions format")
			c.Abort()
			return
		}

		// Check if user has the required permission
		if !hasPermission(userPermissions, permission) {
			response.Forbidden(c, "Insufficient permissions")
			c.Abort()
			return
		}

		c.Next()
	}
}

func (m *AuthMiddleware) RequireRole(role string) gin.HandlerFunc {
	return func(c *gin.Context) {
		roles, exists := c.Get("roles")
		if !exists {
			response.Forbidden(c, "No roles found")
			c.Abort()
			return
		}

		userRoles, ok := roles.([]string)
		if !ok {
			response.Forbidden(c, "Invalid roles format")
			c.Abort()
			return
		}

		for _, r := range userRoles {
			if r == role {
				c.Next()
				return
			}
		}

		response.Forbidden(c, "Insufficient role")
		c.Abort()
	}
}

func hasPermission(userPermissions []string, required string) bool {
	for _, p := range userPermissions {
		if p == required {
			return true
		}
		// Wildcard support: admin.system grants everything
		if p == "admin.system" {
			return true
		}
	}
	return false
}

func extractBearerToken(c *gin.Context) string {
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
