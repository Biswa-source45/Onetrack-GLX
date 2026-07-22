package service

import (
	"context"
	"errors"
	"fmt"

	"golang.org/x/crypto/bcrypt"

	authDomain "github.com/onetrack/backend/internal/auth/domain"
	"github.com/onetrack/backend/internal/user/domain"
	"github.com/onetrack/backend/internal/user/repository"
)

var (
	ErrUserNotFound       = errors.New("user not found")
	ErrUsernameExists     = errors.New("username already exists")
	ErrEmployeeCodeExists = errors.New("employee code already exists")
	ErrNoFieldsToUpdate   = errors.New("no fields to update")
	ErrRoleNotFound       = errors.New("role not found")
	ErrPermissionNotFound = errors.New("permission not found")
)

type userService struct {
	repo domain.UserRepository
}

func NewUserService(repo domain.UserRepository) domain.UserService {
	return &userService{repo: repo}
}

func (s *userService) CreateUser(ctx context.Context, req domain.CreateUserRequest, createdBy string) (*domain.UserResponse, error) {
	// Check uniqueness
	exists, err := s.repo.UsernameExists(ctx, req.Username)
	if err != nil {
		return nil, fmt.Errorf("failed to check username: %w", err)
	}
	if exists {
		return nil, ErrUsernameExists
	}

	exists, err = s.repo.EmployeeCodeExists(ctx, req.EmployeeCode)
	if err != nil {
		return nil, fmt.Errorf("failed to check employee code: %w", err)
	}
	if exists {
		return nil, ErrEmployeeCodeExists
	}

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}

	// Create user
	user := &authDomain.User{
		EmployeeCode: req.EmployeeCode,
		FullName:     req.FullName,
		Username:     req.Username,
		Email:        req.Email,
		Phone:        req.Phone,
		Department:   req.Department,
	}

	userID, err := s.repo.Create(ctx, user, string(hashedPassword))
	if err != nil {
		return nil, fmt.Errorf("failed to create user: %w", err)
	}

	// Assign roles
	if err := s.repo.AssignRoles(ctx, userID, req.Roles, createdBy); err != nil {
		return nil, fmt.Errorf("failed to assign roles: %w", err)
	}

	return s.GetUser(ctx, userID)
}

func (s *userService) GetUser(ctx context.Context, id string) (*domain.UserResponse, error) {
	user, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, ErrUserNotFound
	}

	return s.buildUserResponse(ctx, user)
}

func (s *userService) GetMyProfile(ctx context.Context, userID string) (*domain.UserResponse, error) {
	return s.GetUser(ctx, userID)
}

func (s *userService) ListUsers(ctx context.Context, params domain.ListUsersParams) (*domain.UserListResponse, error) {
	if params.Page < 1 {
		params.Page = 1
	}
	if params.Limit < 1 || params.Limit > 100 {
		params.Limit = 20
	}

	users, total, err := s.repo.List(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("failed to list users: %w", err)
	}

	userResponses := make([]domain.UserResponse, 0, len(users))
	for i := range users {
		resp, err := s.buildUserResponse(ctx, &users[i])
		if err != nil {
			continue
		}
		userResponses = append(userResponses, *resp)
	}

	return &domain.UserListResponse{
		Users:      userResponses,
		Total:      total,
		Page:       params.Page,
		Limit:      params.Limit,
		TotalPages: repository.TotalPages(total, params.Limit),
	}, nil
}

func (s *userService) UpdateUser(ctx context.Context, id string, req domain.UpdateUserRequest) (*domain.UserResponse, error) {
	if req.FullName == nil && req.Email == nil && req.Phone == nil && req.Department == nil {
		return nil, ErrNoFieldsToUpdate
	}

	// Check user exists
	_, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, ErrUserNotFound
	}

	if err := s.repo.Update(ctx, id, req); err != nil {
		return nil, fmt.Errorf("failed to update user: %w", err)
	}

	return s.GetUser(ctx, id)
}

func (s *userService) UpdateStatus(ctx context.Context, id string, req domain.UpdateStatusRequest) error {
	_, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return ErrUserNotFound
	}

	return s.repo.UpdateStatus(ctx, id, req.IsActive)
}

func (s *userService) UpdateRoles(ctx context.Context, userID string, req domain.UpdateRolesRequest, assignedBy string) error {
	_, err := s.repo.GetByID(ctx, userID)
	if err != nil {
		return ErrUserNotFound
	}

	return s.repo.AssignRoles(ctx, userID, req.Roles, assignedBy)
}

func (s *userService) UpdatePermissions(ctx context.Context, userID string, req domain.UpdatePermissionsRequest) error {
	_, err := s.repo.GetByID(ctx, userID)
	if err != nil {
		return ErrUserNotFound
	}

	return s.repo.SetPermissionOverrides(ctx, userID, req.Allow, req.Deny)
}

func (s *userService) buildUserResponse(ctx context.Context, user *authDomain.User) (*domain.UserResponse, error) {
	roles, err := s.repo.GetRolesByUserID(ctx, user.ID)
	if err != nil {
		roles = []string{}
	}

	permissions, err := s.repo.GetEffectivePermissions(ctx, user.ID)
	if err != nil {
		permissions = []string{}
	}

	return &domain.UserResponse{
		ID:                  user.ID,
		EmployeeCode:        user.EmployeeCode,
		Username:            user.Username,
		FullName:            user.FullName,
		Email:               user.Email,
		Phone:               user.Phone,
		Department:          user.Department,
		ForcePasswordChange: user.ForcePasswordChange,
		IsActive:            user.IsActive,
		LastLoginAt:         user.LastLoginAt,
		Roles:               roles,
		Permissions:         permissions,
		CreatedAt:           user.CreatedAt,
		UpdatedAt:           user.UpdatedAt,
	}, nil
}
