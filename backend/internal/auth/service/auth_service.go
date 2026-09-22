package service

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"math/big"
	"strings"

	"golang.org/x/crypto/bcrypt"

	"github.com/onetrack/backend/internal/auth/domain"
	"github.com/onetrack/backend/internal/platform/email"
	systemlogDomain "github.com/onetrack/backend/internal/systemlog/domain"
)

var (
	ErrInvalidCredentials     = errors.New("invalid username or password")
	ErrAccountInactive        = errors.New("account is inactive")
	ErrPasswordChangeRequired = errors.New("password change required")
	ErrInvalidCurrentPassword = errors.New("current password is incorrect")
	ErrTokenBlacklisted       = errors.New("token has been invalidated")
	ErrUserNotFound           = errors.New("user not found")
	ErrOTPInvalid             = errors.New("invalid or expired OTP code")
)

type authService struct {
	repo         domain.AuthRepository
	jwtService   domain.JWTService
	emailService *email.EmailService
	systemLog    systemlogDomain.Recorder
}

func NewAuthService(repo domain.AuthRepository, jwtService domain.JWTService, emailService *email.EmailService, systemLog systemlogDomain.Recorder) domain.AuthService {
	return &authService{
		repo:         repo,
		jwtService:   jwtService,
		emailService: emailService,
		systemLog:    systemLog,
	}
}

// logEvent nil-checks systemLog once here rather than at every call site.
func (s *authService) logEvent(ctx context.Context, eventType, actorID string, targetUserID *string, summary string) {
	if s.systemLog == nil {
		return
	}
	s.systemLog.Record(ctx, systemlogDomain.CategorySecurity, eventType, actorID, targetUserID, summary, nil)
}

func (s *authService) Login(ctx context.Context, req domain.LoginRequest) (*domain.LoginResponse, error) {
	req.Username = strings.ToLower(strings.TrimSpace(req.Username))
	user, err := s.repo.GetUserByUsername(ctx, req.Username)
	if err != nil {
		// No such user — actorID "" so the log entry still records the
		// attempted username without a real user to attribute it to.
		s.logEvent(ctx, "LOGIN_FAILED", "", nil, fmt.Sprintf("Failed login attempt for unknown username '%s'", req.Username))
		return nil, ErrInvalidCredentials
	}

	if !user.IsActive {
		s.logEvent(ctx, "LOGIN_FAILED", user.ID, nil, fmt.Sprintf("Login attempt for inactive account '%s'", req.Username))
		return nil, ErrAccountInactive
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		s.logEvent(ctx, "LOGIN_FAILED", user.ID, nil, fmt.Sprintf("Failed login attempt for '%s' (wrong password)", req.Username))
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
	s.logEvent(ctx, "LOGIN_SUCCESS", user.ID, nil, fmt.Sprintf("'%s' logged in", user.Username))

	emailStr := ""
	if user.Email != nil {
		emailStr = *user.Email
	}
	deptStr := ""
	if user.Department != nil {
		deptStr = *user.Department
	}

	return &domain.LoginResponse{
		AccessToken:  tokenPair.AccessToken,
		RefreshToken: tokenPair.RefreshToken,
		ExpiresIn:    tokenPair.ExpiresIn,
		User: domain.UserInfo{
			ID:           user.ID,
			Username:     user.Username,
			FullName:     user.FullName,
			Email:        emailStr,
			EmployeeCode: user.EmployeeCode,
			Department:   deptStr,
			Roles:        roleNames,
			Permissions:  permissions,
		},
	}, nil
}

func (s *authService) Logout(ctx context.Context, userID string, accessToken string, refreshToken string) error {
	// Blacklist both tokens
	// Access token: blacklist for remaining lifetime (15 min max)
	if err := s.jwtService.BlacklistToken(ctx, accessToken, 900); err != nil {
		return fmt.Errorf("failed to blacklist access token: %w", err)
	}

	// Refresh token: blacklist for remaining lifetime (7 days max)
	if err := s.jwtService.BlacklistToken(ctx, refreshToken, 604800); err != nil {
		return fmt.Errorf("failed to blacklist refresh token: %w", err)
	}

	if userID != "" {
		s.logEvent(ctx, "LOGOUT", userID, nil, "Logged out")
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
	if err := s.repo.UpdatePassword(ctx, userID, string(hashedPassword)); err != nil {
		return err
	}
	s.logEvent(ctx, "PASSWORD_CHANGED", userID, nil, fmt.Sprintf("'%s' changed their password", user.Username))
	return nil
}

func (s *authService) ForceResetPassword(ctx context.Context, actorID string, req domain.ForceResetRequest) error {
	target, err := s.repo.GetUserByID(ctx, req.UserID)
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
	if err := s.repo.SetForcePasswordChange(ctx, req.UserID, true); err != nil {
		return err
	}
	s.logEvent(ctx, "PASSWORD_RESET_FORCED", actorID, &req.UserID, fmt.Sprintf("Reset password for '%s'", target.Username))
	return nil
}

func (s *authService) ForgotPassword(ctx context.Context, emailStr string) error {
	user, err := s.repo.GetUserByEmail(ctx, emailStr)
	if err != nil || user == nil {
		return ErrUserNotFound
	}

	// Generate 6 digit cryptographically secure random OTP code
	n, err := rand.Int(rand.Reader, big.NewInt(1000000))
	if err != nil {
		return fmt.Errorf("failed to generate secure OTP: %w", err)
	}
	otp := fmt.Sprintf("%06d", n.Int64())

	if err := s.repo.CreateOTP(ctx, emailStr, otp); err != nil {
		return fmt.Errorf("failed to save OTP: %w", err)
	}

	// Dispatch OTP Email if email service is available
	if s.emailService != nil {
		htmlBody := fmt.Sprintf(`
			<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; background-color: #ffffff; border-radius: 16px; border: 1px solid #e5e7eb;">
				<h2 style="color: #111827; margin-top: 0;">OneTrack Password Reset</h2>
				<p style="color: #4b5563; font-size: 14px;">Use the following 6-digit verification code to reset your account password:</p>
				<div style="text-align: center; margin: 24px 0;">
					<span style="font-family: monospace; font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #2563eb; background-color: #eff6ff; padding: 12px 24px; border-radius: 12px; display: inline-block; border: 1px solid #bfdbfe;">%s</span>
				</div>
				<p style="color: #6b7280; font-size: 12px; margin-bottom: 0;">This OTP code will expire in 10 minutes. If you did not request this code, please ignore this message.</p>
			</div>
		`, otp)
		_ = s.emailService.SendEmail([]string{emailStr}, "OneTrack Verification Code: "+otp, htmlBody)
	}

	return nil
}

func (s *authService) VerifyOTP(ctx context.Context, emailStr, otp string) error {
	valid, err := s.repo.VerifyOTP(ctx, emailStr, otp)
	if err != nil || !valid {
		return ErrOTPInvalid
	}
	return nil
}

func (s *authService) ResetPasswordWithOTP(ctx context.Context, emailStr, otp, newPassword string) error {
	valid, err := s.repo.VerifyOTP(ctx, emailStr, otp)
	if err != nil || !valid {
		return ErrOTPInvalid
	}

	user, err := s.repo.GetUserByEmail(ctx, emailStr)
	if err != nil || user == nil {
		return ErrUserNotFound
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("failed to hash password: %w", err)
	}

	if err := s.repo.UpdatePassword(ctx, user.ID, string(hashedPassword)); err != nil {
		return err
	}

	_ = s.repo.DeleteOTP(ctx, emailStr)
	s.logEvent(ctx, "PASSWORD_RESET_OTP", user.ID, nil, fmt.Sprintf("'%s' reset their password via OTP", user.Username))
	return nil
}
