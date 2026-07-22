package domain

import (
	"context"

	authDomain "github.com/onetrack/backend/internal/auth/domain"
)

type UserRepository interface {
	Create(ctx context.Context, user *authDomain.User, passwordHash string) (string, error)
	GetByID(ctx context.Context, id string) (*authDomain.User, error)
	List(ctx context.Context, params ListUsersParams) ([]authDomain.User, int, error)
	Update(ctx context.Context, id string, req UpdateUserRequest) error
	UpdateStatus(ctx context.Context, id string, isActive bool) error
	AssignRoles(ctx context.Context, userID string, roleNames []string, assignedBy string) error
	SetPermissionOverrides(ctx context.Context, userID string, allow []string, deny []string) error
	GetRolesByUserID(ctx context.Context, userID string) ([]string, error)
	GetEffectivePermissions(ctx context.Context, userID string) ([]string, error)
	UsernameExists(ctx context.Context, username string) (bool, error)
	EmployeeCodeExists(ctx context.Context, employeeCode string) (bool, error)
}

type UserService interface {
	CreateUser(ctx context.Context, req CreateUserRequest, createdBy string) (*UserResponse, error)
	GetUser(ctx context.Context, id string) (*UserResponse, error)
	GetMyProfile(ctx context.Context, userID string) (*UserResponse, error)
	ListUsers(ctx context.Context, params ListUsersParams) (*UserListResponse, error)
	UpdateUser(ctx context.Context, id string, req UpdateUserRequest) (*UserResponse, error)
	UpdateStatus(ctx context.Context, id string, req UpdateStatusRequest) error
	UpdateRoles(ctx context.Context, userID string, req UpdateRolesRequest, assignedBy string) error
	UpdatePermissions(ctx context.Context, userID string, req UpdatePermissionsRequest) error
}
