package service

import (
	"context"
	"errors"
	"fmt"

	"golang.org/x/crypto/bcrypt"

	"github.com/onetrack/backend/internal/auth/domain"
)

var (
	ErrInvalidCredentials    = errors.New("invalid username or password")
	ErrAccountInactive       = errors.New("account is inactive")
	ErrPasswordChangeRequired = errors.New("password change required")
	ErrInvalidCurrentPassword = errors.New("current password is incorrect")
	ErrTokenBlacklisted      = errors.New("token has been invalidated")
	ErrUserNotFound          = errors.New("user not found")
)

type authService struct {
	repo       domain.AuthRepository
	jwtService domain.JWTService
}

func NewAuthService(repo domain.AuthRepository, jwtService domain.JWTService) domain.AuthService {
	return &authService{
		repo:       repo,
		jwtService: jwtService,
	}
}

func (s *authService) Login(ctx context.Context, req domain.LoginRequest) (*domain.LoginResponse, error) {
	user, err := s.repo.GetUserByUsername(ctx, req.Username)
	if err != nil {
		return nil, ErrInvalidCredentials
	}

	if !user.IsActive {
		return nil, ErrAccountInactive
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		return nil, ErrInvalidCredentials
	}

	// Get roles
	roles, err := s.repo.GetUserRoles(ctx, user.ID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user roles: %w", err)
	}

	roleNames := make([]string, len(roles))
	for i, r := range roles {
		roleNames[i] = r.Name
	}

	// Get effective permissions (role-based + overrides)
	permissions, err := s.repo.GetUserPermissions(ctx, user.ID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user permissions: %w", err)
	}

	// Generate token pair
	tokenClaims := domain.TokenClaims{
		UserID:      user.ID,
		Username:    user.Username,
		Roles:       roleNames,
		Permissions: permissions,
	}

	tokenPair, err := s.jwtService.GenerateTokenPair(tokenClaims)
	if err != nil {
		return nil, fmt.Errorf("failed to generate tokens: %w", err)
	}

	// Update last login
	_ = s.repo.UpdateLastLogin(ctx, user.ID)

	return &domain.LoginResponse{
		AccessToken:  tokenPair.AccessToken,
		RefreshToken: tokenPair.RefreshToken,
		ExpiresIn:    tokenPair.ExpiresIn,
		User: domain.UserInfo{
			ID:          user.ID,
			Username:    user.Username,
			Roles:       roleNames,
			Permissions: permissions,
		},
	}, nil
}

func (s *authService) Logout(ctx context.Context, accessToken string, refreshToken string) error {
	// Blacklist both tokens
	// Access token: blacklist for remaining lifetime (15 min max)
	if err := s.jwtService.BlacklistToken(ctx, accessToken, 900); err != nil {
		return fmt.Errorf("failed to blacklist access token: %w", err)
	}

	// Refresh token: blacklist for remaining lifetime (7 days max)
	if err := s.jwtService.BlacklistToken(ctx, refreshToken, 604800); err != nil {
		return fmt.Errorf("failed to blacklist refresh token: %w", err)
	}

	return nil
}

func (s *authService) RefreshToken(ctx context.Context, refreshToken string) (*domain.LoginResponse, error) {
	// Check if token is blacklisted
	blacklisted, err := s.jwtService.IsTokenBlacklisted(ctx, refreshToken)
	if err != nil {
		return nil, fmt.Errorf("failed to check token blacklist: %w", err)
	}
	if blacklisted {
		return nil, ErrTokenBlacklisted
	}

	// Validate refresh token
	claims, err := s.jwtService.ValidateRefreshToken(refreshToken)
	if err != nil {
		return nil, fmt.Errorf("invalid refresh token: %w", err)
	}

	// Get fresh user data
	user, err := s.repo.GetUserByID(ctx, claims.UserID)
	if err != nil {
		return nil, ErrUserNotFound
	}

	if !user.IsActive {
		return nil, ErrAccountInactive
	}

	// Get fresh roles and permissions
	roles, err := s.repo.GetUserRoles(ctx, user.ID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user roles: %w", err)
	}

	roleNames := make([]string, len(roles))
	for i, r := range roles {
		roleNames[i] = r.Name
	}

	permissions, err := s.repo.GetUserPermissions(ctx, user.ID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user permissions: %w", err)
	}

	// Blacklist old refresh token (rotation)
	_ = s.jwtService.BlacklistToken(ctx, refreshToken, 604800)

	// Generate new token pair
	tokenClaims := domain.TokenClaims{
		UserID:      user.ID,
		Username:    user.Username,
		Roles:       roleNames,
		Permissions: permissions,
	}

	tokenPair, err := s.jwtService.GenerateTokenPair(tokenClaims)
	if err != nil {
		return nil, fmt.Errorf("failed to generate tokens: %w", err)
	}

	return &domain.LoginResponse{
		AccessToken:  tokenPair.AccessToken,
		RefreshToken: tokenPair.RefreshToken,
		ExpiresIn:    tokenPair.ExpiresIn,
		User: domain.UserInfo{
			ID:          user.ID,
			Username:    user.Username,
			Roles:       roleNames,
			Permissions: permissions,
		},
	}, nil
}

func (s *authService) ChangePassword(ctx context.Context, userID string, req domain.ChangePasswordRequest) error {
	user, err := s.repo.GetUserByID(ctx, userID)
	if err != nil {
		return ErrUserNotFound
	}

	// Verify current password
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.CurrentPassword)); err != nil {
		return ErrInvalidCurrentPassword
	}

	// Hash new password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("failed to hash password: %w", err)
	}

	// Update password (also clears force_password_change)
	return s.repo.UpdatePassword(ctx, userID, string(hashedPassword))
}

func (s *authService) ForceResetPassword(ctx context.Context, req domain.ForceResetRequest) error {
	_, err := s.repo.GetUserByID(ctx, req.UserID)
	if err != nil {
		return ErrUserNotFound
	}

	// Hash new password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("failed to hash password: %w", err)
	}

	// Update password
	if err := s.repo.UpdatePassword(ctx, req.UserID, string(hashedPassword)); err != nil {
		return err
	}

	// Set force password change flag
	return s.repo.SetForcePasswordChange(ctx, req.UserID, true)
}
