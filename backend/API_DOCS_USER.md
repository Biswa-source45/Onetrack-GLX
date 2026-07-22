# OneTrack — User Management API Documentation

## Base URL

```
http://localhost:8080
```

## Authentication

All User Management endpoints require a valid JWT access token:

```
Authorization: Bearer <access_token>
```

---

# Endpoints

---

## 1. Create User

Create a new user account. The user will be created with `force_password_change = true`.

```
POST /api/v1/users
```

**Auth Required:** Yes
**Permission Required:** `user.create`

### Request Body

| Field           | Type     | Required | Description                      |
| --------------- | -------- | -------- | -------------------------------- |
| `employee_code` | string   | Yes      | Unique employee identifier       |
| `full_name`     | string   | Yes      | Full name of the user            |
| `username`      | string   | Yes      | Login username (unique)          |
| `email`         | string   | No       | Email address (unique if set)    |
| `phone`         | string   | No       | Phone number                     |
| `department`    | string   | No       | Department name                  |
| `password`      | string   | Yes      | Temporary password (min 8 chars) |
| `roles`         | string[] | Yes      | At least one role name           |

```json
{
  "employee_code": "EMP001",
  "full_name": "John Doe",
  "username": "john.doe",
  "email": "john@company.com",
  "phone": "9876543210",
  "department": "IT",
  "password": "TempPassword123",
  "roles": ["BID_MANAGER"]
}
```

### Response `201 Created`

```json
{
  "success": true,
  "message": "User created successfully",
  "data": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "employee_code": "EMP001",
    "username": "john.doe",
    "full_name": "John Doe",
    "email": "john@company.com",
    "phone": "9876543210",
    "department": "IT",
    "force_password_change": true,
    "is_active": true,
    "roles": ["BID_MANAGER"],
    "permissions": ["bid.create", "bid.view", "bid.edit", "..."],
    "created_at": "2026-05-27T12:00:00Z",
    "updated_at": "2026-05-27T12:00:00Z"
  }
}
```

### Response `409 Conflict` — Duplicate Username

```json
{
  "success": false,
  "error": {
    "code": "CONFLICT",
    "message": "Username already exists"
  }
}
```

### Response `409 Conflict` — Duplicate Employee Code

```json
{
  "success": false,
  "error": {
    "code": "CONFLICT",
    "message": "Employee code already exists"
  }
}
```

### Response `400 Bad Request` — Invalid Role

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid role specified",
    "details": "role not found: INVALID_ROLE"
  }
}
```

### Response `403 Forbidden` — Insufficient Permissions

```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "Insufficient permissions"
  }
}
```

---

## 2. List Users

Retrieve a paginated, filterable list of users.

```
GET /api/v1/users
```

**Auth Required:** Yes
**Permission Required:** `user.view`

### Query Parameters

| Param       | Type    | Default | Description                           |
| ----------- | ------- | ------- | ------------------------------------- |
| `page`      | int     | 1       | Page number                           |
| `limit`     | int     | 20      | Items per page (max 100)              |
| `search`    | string  |         | Search by username, full_name, or employee_code |
| `role`      | string  |         | Filter by role name                   |
| `is_active` | boolean |         | Filter by active status               |
| `department`| string  |         | Filter by department                  |

### Example

```
GET /api/v1/users?page=1&limit=10&search=john&role=BID_MANAGER&is_active=true
```

### Response `200 OK`

```json
{
  "success": true,
  "message": "Users retrieved successfully",
  "data": {
    "users": [
      {
        "id": "uuid",
        "employee_code": "EMP001",
        "username": "john.doe",
        "full_name": "John Doe",
        "email": "john@company.com",
        "department": "IT",
        "force_password_change": false,
        "is_active": true,
        "last_login_at": "2026-05-27T10:00:00Z",
        "roles": ["BID_MANAGER"],
        "permissions": ["bid.create", "bid.view", "..."],
        "created_at": "2026-05-20T12:00:00Z",
        "updated_at": "2026-05-27T10:00:00Z"
      }
    ],
    "total": 45,
    "page": 1,
    "limit": 10,
    "total_pages": 5
  }
}
```

---

## 3. Get My Profile

Retrieve the profile of the currently authenticated user. Does **not** require any special permission — any logged-in user can access this.

```
GET /api/v1/users/me
```

**Auth Required:** Yes
**Permission Required:** None (authenticated only)

### Response `200 OK`

```json
{
  "success": true,
  "message": "Profile retrieved successfully",
  "data": {
    "id": "uuid",
    "employee_code": "ADMIN001",
    "username": "admin",
    "full_name": "",
    "force_password_change": true,
    "is_active": true,
    "last_login_at": "2026-05-27T06:21:59Z",
    "roles": ["SUPER_ADMIN"],
    "permissions": ["bid.create", "bid.view", "admin.system", "..."],
    "created_at": "2026-05-27T05:00:00Z",
    "updated_at": "2026-05-27T06:21:59Z"
  }
}
```

---

## 4. Get User by ID

Retrieve a specific user's full profile.

```
GET /api/v1/users/{id}
```

**Auth Required:** Yes
**Permission Required:** `user.view`

### Path Parameters

| Param | Type | Description |
| ----- | ---- | ----------- |
| `id`  | UUID | User's ID   |

### Response `200 OK`

Same shape as Create User response `data` field.

### Response `404 Not Found`

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "User not found"
  }
}
```

---

## 5. Update User Profile

Update a user's profile fields. Only provided fields are updated.

```
PATCH /api/v1/users/{id}
```

**Auth Required:** Yes
**Permission Required:** `user.edit`

### Request Body (all fields optional, at least one required)

| Field        | Type   | Description          |
| ------------ | ------ | -------------------- |
| `full_name`  | string | Updated full name    |
| `email`      | string | Updated email        |
| `phone`      | string | Updated phone        |
| `department` | string | Updated department   |

```json
{
  "full_name": "John D. Doe",
  "email": "john.doe@company.com",
  "department": "Sales"
}
```

### Response `200 OK`

Returns the full updated user object.

### Response `400 Bad Request` — No Fields

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "No fields to update"
  }
}
```

---

## 6. Update User Status (Activate/Deactivate)

Activate or deactivate a user account.

```
PATCH /api/v1/users/{id}/status
```

**Auth Required:** Yes
**Permission Required:** `user.deactivate`

### Request Body

| Field       | Type    | Required | Description                |
| ----------- | ------- | -------- | -------------------------- |
| `is_active` | boolean | Yes      | `true` to activate, `false` to deactivate |

```json
{
  "is_active": false
}
```

### Response `200 OK`

```json
{
  "success": true,
  "message": "User deactivated successfully"
}
```

---

## 7. Update User Roles

Replace all roles assigned to a user. This is a **full replacement** — previous roles are removed and the new set is applied.

```
PATCH /api/v1/users/{id}/roles
```

**Auth Required:** Yes
**Permission Required:** `user.assign_role`

### Request Body

| Field   | Type     | Required | Description                     |
| ------- | -------- | -------- | ------------------------------- |
| `roles` | string[] | Yes      | New set of role names (min 1)   |

```json
{
  "roles": ["BID_MANAGER", "REVIEWER"]
}
```

### Response `200 OK`

```json
{
  "success": true,
  "message": "Roles updated successfully"
}
```

### Response `400 Bad Request` — Invalid Role

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid role specified",
    "details": "role not found: INVALID_ROLE"
  }
}
```

---

## 8. Update Permission Overrides

Set user-level permission overrides. Replaces any existing overrides. Use `allow` to grant permissions beyond the user's roles, and `deny` to revoke permissions their roles would normally grant.

```
PATCH /api/v1/users/{id}/permissions
```

**Auth Required:** Yes
**Permission Required:** `user.assign_role`

### Request Body

| Field   | Type     | Required | Description                                        |
| ------- | -------- | -------- | -------------------------------------------------- |
| `allow` | string[] | No       | Permissions to explicitly grant (format: `resource.action`) |
| `deny`  | string[] | No       | Permissions to explicitly deny (format: `resource.action`)  |

```json
{
  "allow": ["bid.delete"],
  "deny": ["quotation.approve"]
}
```

### Response `200 OK`

```json
{
  "success": true,
  "message": "Permission overrides updated successfully"
}
```

### Response `400 Bad Request` — Invalid Permission

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid permission specified",
    "details": "permission not found: invalid.perm"
  }
}
```

---

# Endpoint Summary

| Method  | Endpoint                          | Permission         | Description              |
| ------- | --------------------------------- | ------------------ | ------------------------ |
| `POST`  | `/api/v1/users`                   | `user.create`      | Create user              |
| `GET`   | `/api/v1/users`                   | `user.view`        | List users (paginated)   |
| `GET`   | `/api/v1/users/me`                | authenticated      | Get own profile          |
| `GET`   | `/api/v1/users/{id}`              | `user.view`        | Get user by ID           |
| `PATCH` | `/api/v1/users/{id}`              | `user.edit`        | Update user profile      |
| `PATCH` | `/api/v1/users/{id}/status`       | `user.deactivate`  | Activate/deactivate user |
| `PATCH` | `/api/v1/users/{id}/roles`        | `user.assign_role` | Update user roles        |
| `PATCH` | `/api/v1/users/{id}/permissions`  | `user.assign_role` | Set permission overrides |

---

# Available Roles

| Role            | Description                              |
| --------------- | ---------------------------------------- |
| `SUPER_ADMIN`   | Full system access                       |
| `ADMIN`         | Administrative access                    |
| `BID_MANAGER`   | Manages bid lifecycle and workspace      |
| `BID_OWNER`     | Owns specific bid workspaces             |
| `REVIEWER`      | Reviews qualifications and approvals     |
| `FINANCE`       | Commercial and financial operations      |
| `MANAGEMENT`    | Strategic oversight and approvals        |
| `OPERATOR`      | Day-to-day operational tasks             |

---

# Permission Override Behavior

Permissions are computed as:

```
effective_permissions = (role_based_permissions - DENY_overrides) + ALLOW_overrides
```

- **ALLOW** overrides add permissions the user's roles don't have
- **DENY** overrides remove permissions the user's roles would normally grant
- Override format must be `resource.action` (e.g., `bid.delete`, `quotation.approve`)
- Setting new overrides **replaces** all existing overrides for that user
