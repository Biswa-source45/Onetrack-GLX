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
	GetUserByEmail(ctx context.Context, email string) (*User, error)
	CreateOTP(ctx context.Context, email, otp string) error
	VerifyOTP(ctx context.Context, email, otp string) (bool, error)
	DeleteOTP(ctx context.Context, email string) error
}

type AuthService interface {
	Login(ctx context.Context, req LoginRequest) (*LoginResponse, error)
	// Logout takes the acting user's id (from the authenticated request,
	// not the token being blacklisted) purely so it can be attributed in
	// System Logs.
	Logout(ctx context.Context, userID string, accessToken string, refreshToken string) error
	RefreshToken(ctx context.Context, refreshToken string) (*LoginResponse, error)
	ChangePassword(ctx context.Context, userID string, req ChangePasswordRequest) error
	// ForceResetPassword takes the acting admin's id so the System Logs
	// entry can say who reset it, not just whose password changed.
	ForceResetPassword(ctx context.Context, actorID string, req ForceResetRequest) error
	ForgotPassword(ctx context.Context, email string) error
	VerifyOTP(ctx context.Context, email, otp string) error
	ResetPasswordWithOTP(ctx context.Context, email, otp, newPassword string) error
}

type JWTService interface {
	GenerateTokenPair(claims TokenClaims) (*TokenPair, error)
	ValidateAccessToken(token string) (*TokenClaims, error)
	ValidateRefreshToken(token string) (*TokenClaims, error)
	BlacklistToken(ctx context.Context, token string, expiresIn int64) error
	IsTokenBlacklisted(ctx context.Context, token string) (bool, error)
}
