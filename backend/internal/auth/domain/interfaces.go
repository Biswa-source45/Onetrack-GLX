package domain

import "context"

type AuthRepository interface {
	GetUserByUsername(ctx context.Context, username string) (*User, error)
	GetUserByID(ctx context.Context, id string) (*User, error)
	UpdateLastLogin(ctx context.Context, userID string) error
	UpdatePassword(ctx context.Context, userID string, passwordHash string) error
	SetForcePasswordChange(ctx context.Context, userID string, force bool) error
	GetUserRoles(ctx context.Context, userID string) ([]Role, error)
	GetUserPermissions(ctx context.Context, userID string) ([]string, error)
	GetPermissionOverrides(ctx context.Context, userID string) ([]UserPermissionOverride, error)
}

type AuthService interface {
	Login(ctx context.Context, req LoginRequest) (*LoginResponse, error)
	Logout(ctx context.Context, accessToken string, refreshToken string) error
	RefreshToken(ctx context.Context, refreshToken string) (*LoginResponse, error)
	ChangePassword(ctx context.Context, userID string, req ChangePasswordRequest) error
	ForceResetPassword(ctx context.Context, req ForceResetRequest) error
}

type JWTService interface {
	GenerateTokenPair(claims TokenClaims) (*TokenPair, error)
	ValidateAccessToken(token string) (*TokenClaims, error)
	ValidateRefreshToken(token string) (*TokenClaims, error)
	BlacklistToken(ctx context.Context, token string, expiresIn int64) error
	IsTokenBlacklisted(ctx context.Context, token string) (bool, error)
}
