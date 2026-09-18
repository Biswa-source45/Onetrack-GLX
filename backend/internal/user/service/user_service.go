package service

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"golang.org/x/crypto/bcrypt"

	authDomain "github.com/onetrack/backend/internal/auth/domain"
	systemlogDomain "github.com/onetrack/backend/internal/systemlog/domain"
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
	repo      domain.UserRepository
	systemLog systemlogDomain.Recorder
}

func NewUserService(repo domain.UserRepository, systemLog systemlogDomain.Recorder) domain.UserService {
	return &userService{repo: repo, systemLog: systemLog}
}

// logEvent is a tiny wrapper so every call site doesn't have to nil-check
// systemLog (tests construct userService without one) or repeat the
// category constant.
func (s *userService) logEvent(ctx context.Context, eventType, actorID string, targetUserID *string, summary string, details interface{}) {
	if s.systemLog == nil {
		return
	}
	s.systemLog.Record(ctx, systemlogDomain.CategoryUserMgmt, eventType, actorID, targetUserID, summary, details)
}

func (s *userService) CreateUser(ctx context.Context, req domain.CreateUserRequest, createdBy string) (*domain.UserResponse, error) {
	req.Username = strings.ToLower(strings.TrimSpace(req.Username))
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

	// Validate roles (1 or 2 roles: Primary and optional Secondary)
	if len(req.Roles) == 0 {
		return nil, fmt.Errorf("at least one role must be assigned")
	}
	if len(req.Roles) > 2 {
		return nil, fmt.Errorf("a user cannot have more than 2 roles (one primary and one secondary)")
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

	s.logEvent(ctx, "USER_CREATED", createdBy, &userID,
		fmt.Sprintf("Created user %s (@%s) with role(s) %s", req.FullName, req.Username, strings.Join(req.Roles, ", ")),
		map[string]interface{}{"roles": req.Roles})

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

func (s *userService) UpdateStatus(ctx context.Context, id string, req domain.UpdateStatusRequest, actorID string) error {
	user, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return ErrUserNotFound
	}

	if err := s.repo.UpdateStatus(ctx, id, req.IsActive); err != nil {
		return err
	}

	verb := "Deactivated"
	if req.IsActive {
		verb = "Activated"
	}
	s.logEvent(ctx, "USER_STATUS_CHANGED", actorID, &id,
		fmt.Sprintf("%s user %s (@%s)", verb, user.FullName, user.Username), nil)
	return nil
}

func (s *userService) DeleteUser(ctx context.Context, id string, requestingUserID string) error {
	if id == requestingUserID {
		return fmt.Errorf("cannot delete your own account")
	}

	user, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return ErrUserNotFound
	}

	// Prevent deletion of system super admin seeded accounts
	if strings.EqualFold(user.Username, "sadmin") {
		return fmt.Errorf("cannot delete the system super admin account")
	}

	if err := s.repo.Delete(ctx, id); err != nil {
		return err
	}
	// targetUserID is intentionally nil, not &id — the account no longer
	// exists, and auth.system_events.target_user_id's ON DELETE SET NULL
	// would just clear it anyway.
	s.logEvent(ctx, "USER_DELETED", requestingUserID, nil,
		fmt.Sprintf("Deleted user %s (@%s)", user.FullName, user.Username), nil)
	return nil
}

func (s *userService) UpdateRoles(ctx context.Context, userID string, req domain.UpdateRolesRequest, assignedBy string) error {
	user, err := s.repo.GetByID(ctx, userID)
	if err != nil {
		return ErrUserNotFound
	}

	if len(req.Roles) == 0 {
		return fmt.Errorf("at least one role must be assigned")
	}
	if len(req.Roles) > 2 {
		return fmt.Errorf("a user cannot have more than 2 roles (one primary and one secondary)")
	}

	if err := s.repo.AssignRoles(ctx, userID, req.Roles, assignedBy); err != nil {
		return err
	}
	s.logEvent(ctx, "USER_ROLES_CHANGED", assignedBy, &userID,
		fmt.Sprintf("Set roles for %s (@%s) to %s", user.FullName, user.Username, strings.Join(req.Roles, ", ")),
		map[string]interface{}{"roles": req.Roles})
	return nil
}

func (s *userService) UpdatePermissions(ctx context.Context, userID string, req domain.UpdatePermissionsRequest, actorID string) error {
	user, err := s.repo.GetByID(ctx, userID)
	if err != nil {
		return ErrUserNotFound
	}

	if err := s.repo.SetPermissionOverrides(ctx, userID, req.Allow, req.Deny); err != nil {
		return err
	}
	s.logEvent(ctx, "USER_PERMISSIONS_CHANGED", actorID, &userID,
		fmt.Sprintf("Updated permission overrides for %s (@%s)", user.FullName, user.Username),
		map[string]interface{}{"allow": req.Allow, "deny": req.Deny})
	return nil
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
