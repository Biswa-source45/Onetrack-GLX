package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/redis/go-redis/v9"
	"github.com/onetrack/backend/internal/auth/domain"
	"github.com/onetrack/backend/internal/platform/config"
)

type jwtService struct {
	accessSecret  string
	refreshSecret string
	accessExpiry  time.Duration
	refreshExpiry time.Duration
	redisClient   *redis.Client
}

func NewJWTService(cfg config.JWTConfig, redisClient *redis.Client) domain.JWTService {
	return &jwtService{
		accessSecret:  cfg.AccessSecret,
		refreshSecret: cfg.RefreshSecret,
		accessExpiry:  time.Duration(cfg.AccessExpiryMinutes) * time.Minute,
		refreshExpiry: time.Duration(cfg.RefreshExpiryHours) * time.Hour,
		redisClient:   redisClient,
	}
}

type CustomClaims struct {
	UserID      string   `json:"user_id"`
	Username    string   `json:"username"`
	Roles       []string `json:"roles"`
	Permissions []string `json:"permissions"`
	jwt.RegisteredClaims
}

func (s *jwtService) GenerateTokenPair(claims domain.TokenClaims) (*domain.TokenPair, error) {
	now := time.Now()

	// Generate access token
	accessClaims := CustomClaims{
		UserID:      claims.UserID,
		Username:    claims.Username,
		Roles:       claims.Roles,
		Permissions: claims.Permissions,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(now.Add(s.accessExpiry)),
			IssuedAt:  jwt.NewNumericDate(now),
			Issuer:    "onetrack",
			Subject:   claims.UserID,
		},
	}

	accessToken := jwt.NewWithClaims(jwt.SigningMethodHS256, accessClaims)
	accessTokenStr, err := accessToken.SignedString([]byte(s.accessSecret))
	if err != nil {
		return nil, fmt.Errorf("failed to sign access token: %w", err)
	}

	// Generate refresh token (minimal claims)
	refreshClaims := CustomClaims{
		UserID:   claims.UserID,
		Username: claims.Username,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(now.Add(s.refreshExpiry)),
			IssuedAt:  jwt.NewNumericDate(now),
			Issuer:    "onetrack",
			Subject:   claims.UserID,
		},
	}

	refreshToken := jwt.NewWithClaims(jwt.SigningMethodHS256, refreshClaims)
	refreshTokenStr, err := refreshToken.SignedString([]byte(s.refreshSecret))
	if err != nil {
		return nil, fmt.Errorf("failed to sign refresh token: %w", err)
	}

	return &domain.TokenPair{
		AccessToken:  accessTokenStr,
		RefreshToken: refreshTokenStr,
		ExpiresIn:    int(s.accessExpiry.Seconds()),
	}, nil
}

func (s *jwtService) ValidateAccessToken(tokenStr string) (*domain.TokenClaims, error) {
	return s.validateToken(tokenStr, s.accessSecret)
}

func (s *jwtService) ValidateRefreshToken(tokenStr string) (*domain.TokenClaims, error) {
	return s.validateToken(tokenStr, s.refreshSecret)
}

func (s *jwtService) validateToken(tokenStr string, secret string) (*domain.TokenClaims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &CustomClaims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(secret), nil
	})
	if err != nil {
		return nil, fmt.Errorf("invalid token: %w", err)
	}

	claims, ok := token.Claims.(*CustomClaims)
	if !ok || !token.Valid {
		return nil, fmt.Errorf("invalid token claims")
	}

	return &domain.TokenClaims{
		UserID:      claims.UserID,
		Username:    claims.Username,
		Roles:       claims.Roles,
		Permissions: claims.Permissions,
	}, nil
}

func (s *jwtService) BlacklistToken(ctx context.Context, token string, expiresIn int64) error {
	hash := s.hashToken(token)
	key := fmt.Sprintf("blacklist:%s", hash)
	return s.redisClient.Set(ctx, key, "1", time.Duration(expiresIn)*time.Second).Err()
}

func (s *jwtService) IsTokenBlacklisted(ctx context.Context, token string) (bool, error) {
	hash := s.hashToken(token)
	key := fmt.Sprintf("blacklist:%s", hash)
	result, err := s.redisClient.Exists(ctx, key).Result()
	if err != nil {
		return false, err
	}
	return result > 0, nil
}

func (s *jwtService) hashToken(token string) string {
	h := sha256.Sum256([]byte(token))
	return hex.EncodeToString(h[:])
}
