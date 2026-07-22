package domain

import "time"

type CreateUserRequest struct {
	EmployeeCode string   `json:"employee_code" binding:"required"`
	FullName     string   `json:"full_name" binding:"required"`
	Username     string   `json:"username" binding:"required"`
	Email        *string  `json:"email"`
	Phone        *string  `json:"phone"`
	Department   *string  `json:"department"`
	Password     string   `json:"password" binding:"required,min=8"`
	Roles        []string `json:"roles" binding:"required,min=1"`
}

type UpdateUserRequest struct {
	FullName   *string `json:"full_name"`
	Email      *string `json:"email"`
	Phone      *string `json:"phone"`
	Department *string `json:"department"`
}

type UpdateStatusRequest struct {
	IsActive bool `json:"is_active"`
}

type UpdateRolesRequest struct {
	Roles []string `json:"roles" binding:"required,min=1"`
}

type UpdatePermissionsRequest struct {
	Allow []string `json:"allow"`
	Deny  []string `json:"deny"`
}

type UserResponse struct {
	ID                  string     `json:"id"`
	EmployeeCode        string     `json:"employee_code"`
	Username            string     `json:"username"`
	FullName            string     `json:"full_name"`
	Email               *string    `json:"email,omitempty"`
	Phone               *string    `json:"phone,omitempty"`
	Department          *string    `json:"department,omitempty"`
	ForcePasswordChange bool       `json:"force_password_change"`
	IsActive            bool       `json:"is_active"`
	LastLoginAt         *time.Time `json:"last_login_at,omitempty"`
	Roles               []string   `json:"roles"`
	Permissions         []string   `json:"permissions"`
	CreatedAt           time.Time  `json:"created_at"`
	UpdatedAt           time.Time  `json:"updated_at"`
}

type UserListResponse struct {
	Users      []UserResponse `json:"users"`
	Total      int            `json:"total"`
	Page       int            `json:"page"`
	Limit      int            `json:"limit"`
	TotalPages int            `json:"total_pages"`
}

type ListUsersParams struct {
	Page       int
	Limit      int
	Search     string
	Role       string
	IsActive   *bool
	Department string
}
