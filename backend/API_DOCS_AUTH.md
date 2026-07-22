# OneTrack — Authentication API Documentation

## Base URL

```
http://localhost:8080
```

## API Version

```
/api/v1
```

## Content Type

All requests and responses use:

```
Content-Type: application/json
```

---

## Response Envelope

### Success Response

```json
{
  "success": true,
  "message": "Operation description",
  "data": { }
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": null
  }
}
```

---

## Common Error Codes

| Code               | HTTP Status | Description                         |
| ------------------ | ----------- | ----------------------------------- |
| `VALIDATION_ERROR` | 400         | Invalid request body or parameters  |
| `UNAUTHORIZED`     | 401         | Missing, invalid, or expired token  |
| `FORBIDDEN`        | 403         | Insufficient permissions or inactive account |
| `NOT_FOUND`        | 404         | Resource not found                  |
| `INTERNAL_ERROR`   | 500         | Unexpected server error             |

---

# Endpoints

---

## 1. Health Check

Check if the server is running.

```
GET /health
```

**Auth Required:** No

### Response `200 OK`

```json
{
  "status": "healthy",
  "service": "onetrack-backend",
  "time": "2026-05-27T06:21:59Z"
}
```

---

## 2. Login

Authenticate a user and receive JWT tokens.

```
POST /api/v1/auth/login
```

**Auth Required:** No

### Request Body

| Field      | Type   | Required | Description         |
| ---------- | ------ | -------- | ------------------- |
| `username` | string | Yes      | User's username     |
| `password` | string | Yes      | User's password     |

```json
{
  "username": "admin",
  "password": "Admin@123"
}
```

### Response `200 OK` — Login Successful

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expires_in": 900,
    "user": {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "username": "admin",
      "roles": ["SUPER_ADMIN"],
      "permissions": [
        "bid.create",
        "bid.view",
        "bid.edit",
        "bid.delete",
        "task.create",
        "task.view",
        "quotation.approve",
        "admin.system"
      ]
    }
  }
}
```

### Response `401 Unauthorized` — Invalid Credentials

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid username or password"
  }
}
```

### Response `403 Forbidden` — Account Inactive

```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "Account is inactive"
  }
}
```

### Response `400 Bad Request` — Missing Fields

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request payload",
    "details": "Key: 'LoginRequest.Username' Error:Field validation for 'Username' failed on the 'required' tag"
  }
}
```

---

## 3. Refresh Token

Exchange a valid refresh token for a new token pair. Implements **refresh token rotation** — the old refresh token is blacklisted after use.

```
POST /api/v1/auth/refresh
```

**Auth Required:** No

### Request Body

| Field           | Type   | Required | Description                    |
| --------------- | ------ | -------- | ------------------------------ |
| `refresh_token` | string | Yes      | Refresh token from login/refresh response |

```json
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Response `200 OK` — Token Refreshed

```json
{
  "success": true,
  "message": "Token refreshed successfully",
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expires_in": 900,
    "user": {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "username": "admin",
      "roles": ["SUPER_ADMIN"],
      "permissions": ["bid.create", "bid.view", "..."]
    }
  }
}
```

### Response `401 Unauthorized` — Invalid or Blacklisted Token

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Token has been invalidated"
  }
}
```

### Response `403 Forbidden` — Account Deactivated Since Token Issued

```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "Account is inactive"
  }
}
```

---

## 4. Logout

Invalidate the current access token and refresh token by adding them to the Redis blacklist.

```
POST /api/v1/auth/logout
```

**Auth Required:** Yes — `Authorization: Bearer <access_token>`

### Headers

| Header          | Value                    | Required |
| --------------- | ------------------------ | -------- |
| `Authorization` | `Bearer <access_token>`  | Yes      |

### Request Body

| Field           | Type   | Required | Description                          |
| --------------- | ------ | -------- | ------------------------------------ |
| `refresh_token` | string | No       | Refresh token to also invalidate     |

```json
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Response `200 OK` — Logged Out

```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

### Response `401 Unauthorized` — No Token Provided

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "No token provided"
  }
}
```

---

## 5. Change Password

Change the password for the currently authenticated user. Also clears the `force_password_change` flag.

```
PATCH /api/v1/auth/change-password
```

**Auth Required:** Yes — `Authorization: Bearer <access_token>`

### Headers

| Header          | Value                    | Required |
| --------------- | ------------------------ | -------- |
| `Authorization` | `Bearer <access_token>`  | Yes      |

### Request Body

| Field              | Type   | Required | Validation   | Description              |
| ------------------ | ------ | -------- | ------------ | ------------------------ |
| `current_password` | string | Yes      |              | Current password         |
| `new_password`     | string | Yes      | min 8 chars  | New password             |

```json
{
  "current_password": "Admin@123",
  "new_password": "NewSecure@456"
}
```

### Response `200 OK` — Password Changed

```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

### Response `400 Bad Request` — Wrong Current Password

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Current password is incorrect"
  }
}
```

### Response `404 Not Found` — User Not Found

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

## 6. Force Password Reset

Admin-initiated password reset for any user. Sets the `force_password_change` flag to `true`, requiring the user to change their password on next login.

```
PATCH /api/v1/auth/force-reset
```

**Auth Required:** Yes — `Authorization: Bearer <access_token>`

**Permission Required:** `user.edit`

### Headers

| Header          | Value                    | Required |
| --------------- | ------------------------ | -------- |
| `Authorization` | `Bearer <access_token>`  | Yes      |

### Request Body

| Field          | Type   | Required | Validation  | Description                    |
| -------------- | ------ | -------- | ----------- | ------------------------------ |
| `user_id`      | string | Yes      | UUID        | Target user's ID               |
| `new_password` | string | Yes      | min 8 chars | Temporary password to set      |

```json
{
  "user_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "new_password": "TempPass@789"
}
```

### Response `200 OK` — Password Reset

```json
{
  "success": true,
  "message": "Password reset successfully"
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

### Response `404 Not Found` — Target User Not Found

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

# Authentication Flow

```
┌─────────────────────────────────────────────────────────┐
│                    AUTHENTICATION FLOW                    │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  1. Client sends POST /api/v1/auth/login                │
│     ↓                                                    │
│  2. Server validates credentials                         │
│     ↓                                                    │
│  3. Server returns access_token (15 min)                │
│     + refresh_token (7 days)                            │
│     ↓                                                    │
│  4. Client stores tokens                                 │
│     ↓                                                    │
│  5. Client sends requests with                           │
│     Authorization: Bearer <access_token>                │
│     ↓                                                    │
│  6. When access_token expires:                           │
│     POST /api/v1/auth/refresh                           │
│     with refresh_token → get new pair                   │
│     (old refresh_token is blacklisted)                  │
│     ↓                                                    │
│  7. On logout:                                           │
│     POST /api/v1/auth/logout                            │
│     Both tokens are blacklisted in Redis                │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

# Token Details

| Property          | Access Token              | Refresh Token             |
| ----------------- | ------------------------- | ------------------------- |
| **Expiry**        | 15 minutes                | 7 days (168 hours)        |
| **Algorithm**     | HS256                     | HS256                     |
| **Issuer**        | `onetrack`                | `onetrack`                |
| **Contains**      | user_id, username, roles, permissions | user_id, username |
| **Blacklist**     | Redis (on logout)         | Redis (on logout/refresh) |

### Access Token JWT Payload

```json
{
  "user_id": "uuid",
  "username": "admin",
  "roles": ["SUPER_ADMIN"],
  "permissions": ["bid.create", "bid.view", "..."],
  "iss": "onetrack",
  "sub": "uuid",
  "exp": 1716789600,
  "iat": 1716788700
}
```

---

# Endpoint Summary

| Method  | Endpoint                          | Auth | Permission  | Description              |
| ------- | --------------------------------- | ---- | ----------- | ------------------------ |
| `GET`   | `/health`                         | No   | —           | Health check             |
| `POST`  | `/api/v1/auth/login`              | No   | —           | User login               |
| `POST`  | `/api/v1/auth/refresh`            | No   | —           | Refresh token pair       |
| `POST`  | `/api/v1/auth/logout`             | Yes  | —           | Logout & blacklist       |
| `PATCH` | `/api/v1/auth/change-password`    | Yes  | —           | Change own password      |
| `PATCH` | `/api/v1/auth/force-reset`        | Yes  | `user.edit` | Admin reset user password|

---

# Default Seed Data

### Admin User

| Field             | Value        |
| ----------------- | ------------ |
| Username          | `admin`      |
| Password          | `Admin@123`  |
| Employee Code     | `ADMIN001`   |
| Force Password Change | `true`   |
| Role              | `SUPER_ADMIN`|

### Available Roles

| Role            | Description                              | System |
| --------------- | ---------------------------------------- | ------ |
| `SUPER_ADMIN`   | Full system access                       | Yes    |
| `ADMIN`         | Administrative access (no system admin)  | Yes    |
| `BID_MANAGER`   | Manages bid lifecycle and workspace      | No     |
| `BID_OWNER`     | Owns specific bid workspaces             | No     |
| `REVIEWER`      | Reviews qualifications and approvals     | No     |
| `FINANCE`       | Commercial and financial operations      | No     |
| `MANAGEMENT`    | Strategic oversight and approvals        | No     |
| `OPERATOR`      | Day-to-day operational tasks             | No     |
