# OneTrack GlobX — API Documentation

Complete reference for every HTTP endpoint the OneTrack backend exposes: what each one does, who may call it, what to send, and what comes back. Endpoints are grouped by module, and within each module ordered the way you would normally use them.

> Source of truth: generated from the backend code (`backend/internal/*/handler`, `*/domain`) and verified against a running instance on 2026-10-01. If code and this document ever disagree, the code wins — please update this file.

---

## Contents

1. [Getting started](#1-getting-started)
   - 1.1 Base URL
   - 1.2 Authentication flow (step by step)
   - 1.3 Response envelope
   - 1.4 Errors and status codes
   - 1.5 Pagination
   - 1.6 Data conventions
   - 1.7 Roles and permissions
2. [Health](#2-health)
3. [Auth](#3-auth--apiv1auth)
4. [Users & Profile](#4-users--profile--apiv1users)
5. [Stage Access Control](#5-stage-access-control--apiv1usersidstage-restrictions)
6. [Tenders (Bid Workspaces)](#6-tenders-bid-workspaces--apiv1bids)
7. [Leads](#7-leads--apiv1leads)
8. [Alerts](#8-alerts--apiv1alerts)
9. [Feedback Tickets](#9-feedback-tickets--apiv1tickets)
10. [System Configuration](#10-system-configuration--apiv1systemconfig)
11. [System Logs](#11-system-logs--apiv1system-logs)
12. [Appendix: enums and reference values](#12-appendix-enums-and-reference-values)
13. [Appendix: endpoint index](#13-appendix-endpoint-index)

---

## 1. Getting started

### 1.1 Base URL

| Environment | Base URL | Notes |
|---|---|---|
| Docker / LAN deployment | `http://<server-ip>/api/v1` | The frontend's nginx proxies `/api/` to the backend container. |
| Backend directly | `http://<server-ip>:8081/api/v1` | Port 8081 is published by `docker-compose.yml`. |
| Local development | `http://localhost:5173/api/v1` or `http://localhost:8081/api/v1` | Vite dev server proxies `/api` to `localhost:8081`. |

Every path in this document is relative to the base URL, e.g. `POST /auth/login` means `POST http://<server-ip>/api/v1/auth/login`. The only exception is `GET /health`, which lives at the server root (no `/api/v1`).

**Limits to know**

| Limit | Value | Where |
|---|---|---|
| Request body through nginx | 30 MB | `frontend/nginx.conf` |
| Server read/write timeout | 15 s | `cmd/server/main.go` |
| Lead document | 25 MB per file | Leads module |
| Feedback image | 5 MB | Feedback module |
| Bulk-import workbook | 10 MB | Tenders bulk import |

### 1.2 Authentication flow (step by step)

The API uses **JWT bearer tokens**. Access tokens live 15 minutes (`expires_in: 900`); refresh tokens live 7 days (168 h) by default.

**Step 1 — Log in** and keep both tokens:

```http
POST /api/v1/auth/login
Content-Type: application/json

{ "username": "jdoe", "password": "S3cure@Pass" }
```

**Step 2 — Call any protected endpoint** with the access token:

```http
GET /api/v1/bids
Authorization: Bearer <access_token>
```

**Step 3 — When a call returns `401`**, exchange the refresh token for a new pair and retry the call once:

```http
POST /api/v1/auth/refresh
Content-Type: application/json

{ "refresh_token": "<refresh_token>" }
```

The refresh response also carries a freshly computed `user.permissions` list, so permission changes reach a logged-in user within one access-token lifetime (≤ 15 minutes).

**Step 4 — Log out** to blacklist the tokens:

```http
POST /api/v1/auth/logout
Authorization: Bearer <access_token>
Content-Type: application/json

{ "refresh_token": "<refresh_token>" }
```

### 1.3 Response envelope

Every JSON response uses one of three shapes.

**Success (single object or list):**

```json
{
  "success": true,
  "message": "Human-readable result",
  "data": { }
}
```

**Success with pagination metadata** (lists that page):

```json
{
  "success": true,
  "data": [ ],
  "meta": { "next_cursor": "MjAyNi0x...", "has_more": true }
}
```

**Error:**

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "account name is required",
    "details": null
  }
}
```

`message` and `details` may be omitted when empty. Binary downloads (documents, ticket images) return the raw file instead of JSON.

### 1.4 Errors and status codes

| HTTP | `error.code` | Meaning |
|---|---|---|
| 200 | — | OK |
| 201 | — | Created |
| 202 | — | Accepted, **held for approval** (see [6.6](#66-the-approval-202-response)) |
| 400 | `VALIDATION_ERROR` | Bad payload, missing field, invalid value, invalid cursor |
| 401 | `UNAUTHORIZED` | Missing / invalid / expired / blacklisted token, wrong credentials |
| 403 | `FORBIDDEN` | Authenticated but lacks the permission, role, or ownership required |
| 404 | `NOT_FOUND` | Resource does not exist (or is not visible to you) |
| 409 | `CONFLICT` | Duplicate value (username, employee code, tender identifier) or an illegal stage transition |
| 500 | `INTERNAL_ERROR` | Unexpected server error |

Middleware-level messages you may see on any protected endpoint:

| Status | Message |
|---|---|
| 401 | `Missing or invalid authorization header` |
| 401 | `Token has been invalidated` (logged out) |
| 401 | `Invalid or expired token` |
| 403 | `Insufficient permissions` (permission gate) |
| 403 | `Insufficient role` (role gate) |

### 1.5 Pagination

Two styles are used.

**Page/limit (offset)** — Users and Tenders lists. Send `?page=1&limit=20`; the response returns `total`, `page`, `limit`, `total_pages`.

**Cursor (keyset)** — audit feeds, stage history, system logs, and tickets. Send `?limit=30` for the first page; for the next page pass the previous response's `meta.next_cursor` as `?cursor=...`. Stop when `meta.has_more` is `false`. Cursors are opaque; a tampered or stale cursor returns `400 Invalid or expired cursor`. Default limit 30, maximum 200.

### 1.6 Data conventions

| Kind | Format | Example |
|---|---|---|
| IDs | UUID v4 string | `"af30e5b8-845c-46f1-b560-c2789fea2847"` |
| Timestamps (responses) | RFC 3339 with offset | `"2026-10-01T13:28:24.98+05:30"` |
| Tender dates (requests) | RFC 3339 | `"2026-11-20T00:00:00.000Z"` |
| Lead dates (requests) | `YYYY-MM-DD` | `"2026-11-20"` |
| Money | number, rupees | `5000000` |
| Optional fields | omit, or send `null` | — |
| "Raw JSON string" fields | a JSON document **encoded as a string** | `"requested_products": "[{\"product\":\"Firewall\"}]"` |

### 1.7 Roles and permissions

**Roles:** `SUPER_ADMIN`, `ADMIN`, `MANAGER`, `ACCOUNT_MANAGER`, `BID_EXECUTIVE`, `PRE_SALES`, `FINANCE`. A user can hold more than one role.

**Permissions** are `resource.action` strings. Effective permissions = permissions of all the user's roles, plus per-user `ALLOW` overrides, minus per-user `DENY` overrides. `admin.system` acts as a wildcard that passes every permission check.

| Resource | Actions |
|---|---|
| `bid` | `create`, `view`, `edit`, `delete`, `assign` |
| `lead` | `view`, `create` |
| `task` | `create`, `view`, `edit`, `assign`, `complete` |
| `document` | `upload`, `view`, `delete` |
| `user` | `create`, `view`, `edit`, `deactivate`, `assign_role` |
| `analytics` | `view`, `export` |
| `notification` | `view` |
| `admin` | `system` |

Each endpoint below lists its **Access** requirement:

- **Public** — no token.
- **Authenticated** — any valid token.
- **Permission `x.y`** — token whose permissions include `x.y` (or `admin.system`).
- **Role `ROLE`** — token whose roles include exactly `ROLE` (no inheritance).

---

## 2. Health

### 2.1 `GET /health`

Liveness check used by Docker. **Not** under `/api/v1`.

**Access:** Public

**Response `200`**

```json
{
  "status": "healthy",
  "service": "onetrack-backend",
  "time": "2026-10-01T07:58:14Z"
}
```

---

## 3. Auth — `/api/v1/auth`

### 3.1 `POST /auth/login`

Exchange username + password for tokens and the user's profile, roles and effective permissions.

**Access:** Public

**Request body**

| Field | Type | Required | Notes |
|---|---|---|---|
| `username` | string | yes | Case as registered |
| `password` | string | yes | |

```json
{ "username": "jdoe", "password": "S3cure@Pass" }
```

**Response `200`**

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIs...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
    "expires_in": 900,
    "user": {
      "id": "af30e5b8-845c-46f1-b560-c2789fea2847",
      "username": "jdoe",
      "full_name": "Jai Doshi",
      "email": "jai.doshi@example.com",
      "employee_code": "EMP001",
      "department": "Sales",
      "roles": ["BID_EXECUTIVE"],
      "permissions": ["bid.create", "bid.view", "bid.edit", "lead.create", "lead.view", "user.view"]
    }
  }
}
```

**Errors:** `400` invalid payload · `401` `Invalid username or password` · `403` `Account is inactive` · `500`

---

### 3.2 `POST /auth/refresh`

Get a new token pair with a valid refresh token. Response shape is identical to login.

**Access:** Public

**Request body**

```json
{ "refresh_token": "eyJhbGciOiJIUzI1NiIs..." }
```

**Response `200`** — `message: "Token refreshed successfully"`, `data` same as [3.1](#31-post-authlogin).

**Errors:** `400` · `401` `Token has been invalidated` / `Invalid refresh token` · `403` `Account is inactive`

---

### 3.3 `POST /auth/logout`

Blacklist the current access token and (if sent) the refresh token.

**Access:** Authenticated

**Request body (optional)**

```json
{ "refresh_token": "eyJhbGciOiJIUzI1NiIs..." }
```

**Response `200`**

```json
{ "success": true, "message": "Logged out successfully" }
```

---

### 3.4 `PATCH /auth/change-password`

Change your own password.

**Access:** Authenticated

**Request body**

| Field | Type | Required | Notes |
|---|---|---|---|
| `current_password` | string | yes | |
| `new_password` | string | yes | min 8 characters |

**Response `200`** — `message: "Password changed successfully"`

**Errors:** `400` `Current password is incorrect` · `404` `User not found`

---

### 3.5 `PATCH /auth/force-reset`

An administrator sets another user's password (the user is then required to change it at next login).

**Access:** Permission `user.edit`

**Request body**

```json
{ "user_id": "ccc9d972-a5c1-4954-adeb-55f0de5ee9e7", "new_password": "Temp@12345" }
```

**Response `200`** — `message: "Password reset successfully"`

**Errors:** `400` · `404` `User not found`

---

### 3.6 Forgot-password flow (OTP by email)

Three public calls, in order.

**Step 1 — `POST /auth/forgot-password`** · sends a one-time code to the registered email.

```json
{ "email": "jai.doshi@example.com" }
```

`200` `OTP sent to your email address` · `400` invalid email · `404` `No account registered with this email address`

**Step 2 — `POST /auth/verify-otp`** · checks the code (optional, lets the UI validate before asking for a new password).

```json
{ "email": "jai.doshi@example.com", "otp": "482913" }
```

`200` `OTP code verified successfully` · `400` `Invalid or expired OTP code`

**Step 3 — `POST /auth/reset-password-otp`** · sets the new password.

```json
{ "email": "jai.doshi@example.com", "otp": "482913", "new_password": "N3w@Password" }
```

`200` `Password reset successfully. You can now login.` · `400` `Invalid or expired OTP code`

---

## 4. Users & Profile — `/api/v1/users`

All routes require authentication.

### User object

Returned by every user endpoint.

```json
{
  "id": "ccc9d972-a5c1-4954-adeb-55f0de5ee9e7",
  "employee_code": "EMP012",
  "username": "account",
  "full_name": "Riya Account Manager",
  "email": "riya@example.com",
  "phone": "9800000000",
  "department": "Sales",
  "force_password_change": false,
  "is_active": true,
  "last_login_at": "2026-09-29T17:38:40.43+05:30",
  "roles": ["ACCOUNT_MANAGER", "PRE_SALES"],
  "permissions": ["bid.assign", "bid.view", "lead.view", "user.view"],
  "created_at": "2026-09-01T17:34:38.59+05:30",
  "updated_at": "2026-09-29T17:38:40.43+05:30"
}
```

`email`, `phone`, `department`, `last_login_at` are omitted when empty.

### 4.1 `GET /users/me`

Your own profile.

**Access:** Authenticated

**Response `200`** — `message: "Profile retrieved successfully"`, `data`: User object.

---

### 4.2 `POST /users`

Create a user.

**Access:** Permission `user.create`

**Request body**

| Field | Type | Required | Notes |
|---|---|---|---|
| `employee_code` | string | yes | unique |
| `full_name` | string | yes | |
| `username` | string | yes | unique |
| `password` | string | yes | min 8; user must change it at first login |
| `roles` | string[] | yes | at least one role name |
| `email` | string | no | needed for OTP password reset and alert emails |
| `phone` | string | no | |
| `department` | string | no | |

```json
{
  "employee_code": "EMP020",
  "full_name": "Arjun Mehta",
  "username": "arjun",
  "password": "Welcome@123",
  "roles": ["BID_EXECUTIVE"],
  "email": "arjun@example.com",
  "department": "Bids"
}
```

**Response `201`** — `message: "User created successfully"`, `data`: User object.

**Errors:** `400` invalid payload / `Invalid role specified` · `409` `Username already exists` / `Employee code already exists`

---

### 4.3 `GET /users`

List users with filters.

**Access:** Permission `user.view`

**Query parameters**

| Param | Type | Default | Notes |
|---|---|---|---|
| `page` | int | 1 | |
| `limit` | int | 20 | 1–100; out-of-range falls back to 20 |
| `search` | string | — | matches full name / username / employee code |
| `role` | string | — | e.g. `FINANCE` |
| `is_active` | bool | — | `true` or `false` |
| `department` | string | — | |

**Response `200`**

```json
{
  "success": true,
  "message": "Users retrieved successfully",
  "data": {
    "users": [ { "...": "User object" } ],
    "total": 7,
    "page": 1,
    "limit": 20,
    "total_pages": 1
  }
}
```

---

### 4.4 `GET /users/:id`

**Access:** Permission `user.view`

**Response `200`** — `data`: User object · **Errors:** `404` `User not found`

---

### 4.5 `PATCH /users/:id`

Update profile fields. Send only what changes.

**Access:** Permission `user.edit`

```json
{ "full_name": "Arjun K. Mehta", "phone": "9811111111", "department": "Bids", "email": "arjun.k@example.com" }
```

**Response `200`** — `message: "User updated successfully"`, `data`: User object.

**Errors:** `400` `No fields to update` · `404`

---

### 4.6 `PATCH /users/:id/status`

Activate or deactivate an account (inactive users cannot log in or refresh).

**Access:** Permission `user.deactivate`

```json
{ "is_active": false }
```

**Response `200`** — `message: "User deactivated successfully"` (or `activated`).

---

### 4.7 `PATCH /users/:id/roles`

Replace the user's full role set.

**Access:** Permission `user.assign_role`

```json
{ "roles": ["MANAGER", "ACCOUNT_MANAGER"] }
```

**Response `200`** — `message: "Roles updated successfully"`

**Errors:** `400` `Invalid role specified` · `404`

---

### 4.8 `PATCH /users/:id/permissions`

Replace the user's per-user permission overrides. `allow` adds permissions on top of their roles; `deny` removes permissions their roles would grant.

**Access:** Permission `user.assign_role`

```json
{ "allow": ["bid.delete"], "deny": ["lead.create"] }
```

**Response `200`** — `message: "Permission overrides updated successfully"`

**Errors:** `400` `Invalid permission specified` / `Invalid permission format (expected resource.action)` · `404`

---

### 4.9 `DELETE /users/:id`

Delete a user.

**Access:** Permission `user.deactivate`

**Response `200`** — `message: "User deleted successfully"`

**Errors:** `400` `Cannot delete your own account` / `Cannot delete the system super admin account` · `404`

---

## 5. Stage Access Control — `/api/v1/users/:id/stage-restrictions`

Locks specific tender workflow stages for a **Bid Executive** (a restricted stage is read-only for them). Implemented in the tender module, exposed under `/users`.

### 5.1 `GET /users/:id/stage-restrictions`

**Access:** Authenticated — your own `:id`, or any user if you are `SUPER_ADMIN` / `ADMIN` / `MANAGER`.

**Response `200`**

```json
{
  "success": true,
  "message": "Stage restrictions retrieved",
  "data": {
    "user_id": "98a85cae-cf25-413b-a0b8-d637cca2129d",
    "restricted_stages": ["PRICING_REQUEST", "EMD_PROCESSING"]
  }
}
```

An empty array means full access.

**Errors:** `403` `Only Super Admin, Admin, or Manager can view another user's stage access`

---

### 5.2 `PUT /users/:id/stage-restrictions`

Replace the restricted set (not a diff). Send `[]` to clear all restrictions.

**Access:** Role `SUPER_ADMIN`, `ADMIN` or `MANAGER`

```json
{ "stages": ["PRICING_REQUEST", "EMD_PROCESSING"] }
```

**Response `200`** — `message: "Stage access updated"`

**Errors:** `400` `user not found` / `stage access can only be restricted for a Bid Executive` / `unknown workflow stage "X"`

Valid stages: see [12.1](#121-tender-workflow-stages).

---

## 6. Tenders (Bid Workspaces) — `/api/v1/bids`

A **bid workspace** (tender) moves through 11 workflow stages from Discovery to Award & Handover. All routes require authentication.

### 6.1 Typical lifecycle (step by step)

1. **Create** the tender — `POST /bids` ([6.2](#62-post-bids--create-tender)).
2. **Find / open** it — `GET /bids` ([6.3](#63-get-bids--list-tenders)), `GET /bids/:id` ([6.4](#64-get-bidsid--tender-detail)).
3. **Work the stages** — save stage data with `PATCH /bids/:id` ([6.5](#65-patch-bidsid--update-tender)), tick checklist items ([6.11](#611-checklists)), then move forward with `POST /bids/:id/transition` ([6.8](#68-post-bidsidtransition--move-stage)).
4. **Approvals** — a Bid Executive's full edit, cancel or delete returns `202` and waits for their Reporting Manager ([6.6](#66-the-approval-202-response), [6.7](#67-edit-approvals)).
5. **Record the result** — `PATCH /bids/:id/outcome` ([6.13](#613-patch-bidsidoutcome--record-outcome)).
6. **Review history** — `GET /bids/:id/stage-history` ([6.9](#69-history-and-audit)).
7. **Bin / restore / purge** when needed ([6.14](#614-tender-bin)).

### 6.2 `POST /bids` — create tender

**Access:** Permission `bid.create`

**Request body** (only `creation_mode`, `title`, `bid_owner_id` are required)

| Field | Type | Notes |
|---|---|---|
| `creation_mode` | string | **required** — `MANUAL` or `INTELLIGENCE` |
| `title` | string | **required** — tender title |
| `bid_owner_id` | UUID | **required** — owner user |
| `gem_bid_no` | string | BID / RFP number (must be unique across tenders) |
| `bid_no` | string | internal number (unique) |
| `organization_name` | string | account / client |
| `department_name` | string | department / ministry |
| `location` | string | |
| `high_level_scope` | string | |
| `portal_source` | string | e.g. `GeM`, `CPPP`, `eProcure`, `Private`, `RTC`, or custom |
| `bid_type` | string | `BID` or `BID_TO_RA` |
| `category` | string | category / scope group |
| `scope_type` | string | e.g. `Supply`, `Implementation`, `Support` |
| `quantity` | int | |
| `estimated_value` | number | ₹ |
| `start_date` / `opening_date` | RFC 3339 | either name accepted |
| `end_date` / `closing_date` | RFC 3339 | submission deadline (with time) |
| `target_month_date` | RFC 3339 | |
| `emd_amount` | number | |
| `emd_not_applicable` | bool | true = tender has no EMD at all |
| `emd_exemption_types` | string[] | any of `MSME`, `STARTUP`, `OTHER` |
| `emd_exemption_reason` | string | required when `OTHER` is in the list |
| `emd_bank_name`, `emd_account_number`, `emd_ifsc_code`, `emd_branch` | string | EMD via online payment |
| `emd_beneficiary`, `emd_payable_at` | string | EMD via demand draft |
| `bg_required` | bool | bank guarantee needed |
| `bg_rate` | number | BG % |
| `bg_duration_months` | int | |
| `reporting_manager_id` | UUID | approves the Bid Executive's edits |
| `account_manager_id` | UUID | runs Primary Review |
| `presales_id` | UUID | |
| `requested_products` | raw JSON string | `[{"product","description","qty","oem"}]` |
| `alert_note` | raw JSON string | `{"text","label","color"}` — highlighted note in the discovery alert |
| `remarks` | string | |
| `bidder_checklists` | string[] | seed checklist items, e.g. `"[Bidder] Experience Certificate"` |
| `oem_checklists` | string[] | e.g. `"[OEM] MAF Certificate"` |

Also accepted (used by imports / legacy clients): `gem_bid_type`, `our_rank`, `emd_type`, `emd_exempted`, `emd_exemption_type`, `duration_months`, `authority`, `metadata` (raw JSON string), `checklists`, `team`, `activity_type`, `excel_bid_status`, `submission_status`, `financial_evaluation_status`, `po_received_status`, `bid_result`.

**Example**

```json
{
  "creation_mode": "MANUAL",
  "title": "Supply and Implementation of Enterprise Firewall",
  "gem_bid_no": "GEM/2026/B/87654",
  "organization_name": "NIC Delhi",
  "department_name": "Ministry of Electronics & IT",
  "location": "New Delhi",
  "portal_source": "GeM",
  "bid_type": "BID",
  "category": "Security",
  "scope_type": "Supply",
  "quantity": 4,
  "estimated_value": 5000000,
  "start_date": "2026-10-05T00:00:00.000Z",
  "end_date": "2026-10-25T11:00:00.000Z",
  "emd_amount": 100000,
  "emd_not_applicable": false,
  "emd_exemption_types": ["MSME"],
  "emd_bank_name": "State Bank of India",
  "emd_account_number": "012345678901",
  "emd_ifsc_code": "SBIN0001234",
  "bg_required": true,
  "bg_rate": 3,
  "bg_duration_months": 12,
  "bid_owner_id": "98a85cae-cf25-413b-a0b8-d637cca2129d",
  "reporting_manager_id": "5f0c...e1",
  "account_manager_id": "ccc9d972-a5c1-4954-adeb-55f0de5ee9e7",
  "requested_products": "[{\"product\":\"NGFW\",\"description\":\"10 Gbps\",\"qty\":\"4\",\"oem\":\"Fortinet\"}]",
  "bidder_checklists": ["[Bidder] Experience Certificate", "[Bidder] Bidder Turnover"],
  "oem_checklists": ["[OEM] MAF Certificate"]
}
```

**Response `201`** — `message: "Bid workspace created successfully"`, `data`: Tender detail object ([6.4](#64-get-bidsid--tender-detail)). The tender starts in stage `DISCOVERED`; owner, managers and alerts are notified.

**Errors:** `400` validation · `409` `tender identifier already exists` (duplicate `gem_bid_no` / `bid_no`)

---

### 6.3 `GET /bids` — list tenders

**Access:** Permission `bid.view`

**Query parameters**

| Param | Notes |
|---|---|
| `page`, `limit` | default 1 / 20; `limit` capped at 100 |
| `search` | free text over title, `bid_no`, `gem_bid_no`, organization, department, category, owner name |
| `workflow_stage` | one of [12.1](#121-tender-workflow-stages) |
| `bid_status` | `ACTIVE`, `WON`, `LOST`, `CANCELLED`, `CLOSED`, `ARCHIVED` |
| `bid_outcome` | `WON`, `LOST`, `CANCELLED` |
| `bid_owner_id` | UUID |
| `category`, `portal_source` | exact match |
| `creation_mode` | `MANUAL` / `INTELLIGENCE` |
| `closing_before`, `closing_after` | RFC 3339 |
| `oem_required` | `true` / `false` |
| `in_bin` | `true` lists the Tender Bin (archived) instead (`show_deleted=true` also works) |

**Response `200`**

```json
{
  "success": true,
  "data": [
    {
      "id": "200a8392-5d07-4354-9976-fd64882711b8",
      "title": "Supply and Implementation of Enterprise Firewall",
      "gem_bid_no": "GEM/2026/B/87654",
      "bid_no": null,
      "organization_name": "NIC Delhi",
      "department_name": "Ministry of Electronics & IT",
      "portal_source": "GeM",
      "category": "Security",
      "bid_type": "BID",
      "creation_mode": "MANUAL",
      "workflow_stage": "PRICING_REQUEST",
      "bid_status": "ACTIVE",
      "derived_status": "ACTIVE",
      "bid_outcome": null,
      "estimated_value": 5000000,
      "emd_amount": 100000,
      "opening_date": "2026-10-05T05:30:00+05:30",
      "closing_date": "2026-10-25T16:30:00+05:30",
      "oem_required": true,
      "bid_owner": { "id": "98a8...", "full_name": "Arjun Mehta", "username": "arjun", "role": "BID_EXECUTIVE" },
      "account_manager": { "id": "ccc9...", "full_name": "Riya Account Manager", "username": "account" },
      "emd_exempted": false,
      "emd_not_applicable": false,
      "emd_ready": false,
      "emd_returned": false,
      "submission_done": false,
      "delivery_complete": false,
      "has_tech_eval": false,
      "is_imported": false,
      "created_at": "2026-10-01T10:12:00+05:30",
      "days_remaining": 24
    }
  ],
  "meta": {
    "page": 1, "limit": 20, "total": 235, "total_pages": 12,
    "active_count": 19, "won_count": 16, "lost_count": 34, "cancelled_count": 7,
    "closed_count": 145, "tech_eval_count": 14, "submitted_count": 0
  }
}
```

`derived_status` is the single status the UI shows (`ACTIVE`, `TECHNICAL_EVALUATION`, `SUBMITTED`, `WON`, `LOST`, `CANCELLED`, `CLOSED`), computed from stage, status, outcome and submission flags. The `*_count` meta fields are counts across the whole filtered set, not just this page.

---

### 6.4 `GET /bids/:id` — tender detail

**Access:** Permission `bid.view`

**Response `200`** — `message: "Bid retrieved"`, `data`: full Tender object. Main fields:

| Group | Fields |
|---|---|
| Identity | `id`, `title`, `gem_bid_no`, `bid_no`, `organization_name`, `department_name`, `location`, `portal_source`, `creation_mode`, `is_imported` |
| Lifecycle | `workflow_stage`, `bid_status`, `derived_status`, `bid_outcome`, `outcome_reason`, `qualification_status`, `result_date`, `archived_at`, `days_remaining` |
| Classification | `category`, `scope_type`, `bid_type`, `gem_bid_type`, `quantity`, `our_rank`, `high_level_scope` |
| Dates | `start_date`, `end_date`, `opening_date`, `closing_date`, `duration_months`, `target_month_date` |
| Money | `estimated_value`, `final_bid_value`, `quoted_price`, `l1_price`, `gem_submission_price`, `final_price`, `price_difference`, `price_difference_pct`, `l1_company_name` |
| EMD | `emd_amount`, `emd_type`, `emd_exempted`, `emd_not_applicable`, `emd_exemption_type(s)`, `emd_exemption_reason`, `emd_bank_name`, `emd_account_number`, `emd_ifsc_code`, `emd_branch`, `emd_beneficiary`, `emd_payable_at`, `emd_ready`, `emd_ready_date`, `emd_returned`, `emd_returned_date`, `emd_remarks`, `finance_alerted` |
| BG | `bg_required`, `bg_rate`, `bg_duration_months`, `bg_target_date`, `bg_discharged`, `bg_discharged_date` |
| People | `bid_owner`, `reporting_manager`, `account_manager`, `presales` (each `{id, full_name, username, role}`), `members[]`, `created_by` |
| Stage data | `stage_completions` (map stage→bool), `stage_remarks` (map stage→text), `stage_reviews` (map stage→bool), `primary_review`, `pricing_workspace`, `oem_workspace`, `requested_products`, `alert_note`, `checklists[]` |
| Results | `submission_done`, `technical_result`, `disqualification_reason`, `financial_result`, `po_received_date`, `delivery_complete`, `delivery_complete_date`, `competitor_info` |

**Errors:** `404` `Bid not found`

---

### 6.5 `PATCH /bids/:id` — update tender

Partial update: send only the fields to change. Used both by the **Edit Tender** form and by every **stage workspace save** (EMD ready, pricing sheet, OEM matrix, stage remarks...).

**Access:** Permission `bid.edit` (the service additionally checks stage access and ownership rules).

**Request body** — any field from [6.2](#62-post-bids--create-tender) (except `creation_mode`) plus:

| Field | Type | Notes |
|---|---|---|
| `full_edit_submission` | bool | `true` when sent from the Edit Tender form; a Bid Executive's full edit then needs Reporting Manager approval (`202`) |
| `bid_owner_id` | UUID | reassign owner — only the tender's Account/Reporting Manager or an admin |
| `primary_review` | raw JSON string | Stage 2 Go/No-Go data |
| `pricing_workspace` | raw JSON string | Stage 4 pricing sheet |
| `oem_workspace` | raw JSON string | Stage 3 OEM matrix |
| `stage_completions` | `{stage: bool}` | mark stage actions done |
| `stage_remarks` | `{stage: string}` | |
| `stage_reviews` | `{stage: bool}` | |
| `workflow_stage`, `bid_status`, `bid_outcome` | string | prefer the dedicated transition / outcome endpoints |
| `tech_compliance_status`, `qualification_status` | string | |
| `finance_alerted`, `emd_ready`, `emd_returned`, `bg_discharged`, `delivery_complete`, `submission_done` | bool | stage tracking flags |
| `emd_ready_date`, `emd_returned_date`, `bg_discharged_date`, `bg_target_date`, `po_received_date`, `delivery_complete_date` | RFC 3339 | |
| `gem_submission_price`, `quoted_price`, `final_price`, `l1_price`, `price_difference`, `price_difference_pct` | number | |
| `technical_result`, `disqualification_reason`, `financial_result`, `l1_company_name`, `eligibility_remarks`, `emd_remarks` | string | |

**Example — stage workspace save**

```json
{
  "emd_ready": true,
  "emd_ready_date": "2026-10-10T00:00:00.000Z",
  "stage_completions": { "EMD_PROCESSING": true },
  "stage_remarks": { "EMD_PROCESSING": "DD handed to courier" }
}
```

**Responses**

- `200` — `message: "Bid updated successfully"` (applied immediately).
- `202` — held for approval, see [6.6](#66-the-approval-202-response).

**Errors:** `400` validation · `403` not allowed / `an edit is already awaiting approval for this tender` · `404` · `409` duplicate identifier

---

### 6.6 The approval `202` response

When a **Bid Executive** submits a full edit (`full_edit_submission: true`), cancels, or deletes a tender, the change is **not** applied. It is stored as a pending approval for that tender's Reporting Manager, who gets an alert. The endpoint answers:

```json
{
  "success": true,
  "message": "edit submitted for Priya Manager's approval",
  "data": {
    "status": "PENDING_APPROVAL",
    "pending_edit_id": "7d1c6a52-...",
    "reporting_manager_name": "Priya Manager"
  }
}
```

Endpoints that can return this: `PATCH /bids/:id`, `POST /bids/:id/transition`, `PATCH /bids/:id/outcome`, `DELETE /bids/:id`, `DELETE /bids/:id/permanent`. Only one pending approval may exist per tender at a time.

---

### 6.7 Edit approvals

#### `GET /bids/:id/pending-edit`

The tender's open approval, or `null`.

**Access:** Permission `bid.view`

```json
{
  "success": true,
  "message": "Pending edit retrieved",
  "data": {
    "id": "7d1c6a52-...",
    "bid_id": "200a8392-...",
    "bid_title": "Supply and Implementation of Enterprise Firewall",
    "requested_by": { "id": "98a8...", "full_name": "Arjun Mehta", "username": "arjun" },
    "reporting_manager_id": "5f0c...",
    "status": "PENDING",
    "action_type": "EDIT",
    "payload": { "estimated_value": 5500000, "full_edit_submission": true },
    "diff": [ { "field": "estimated_value", "old": "5000000", "new": "5500000" } ],
    "created_at": "2026-10-01T11:00:00+05:30",
    "updated_at": "2026-10-01T11:00:00+05:30"
  }
}
```

`action_type`: `EDIT` (payload = update fields), `CANCEL` (payload `{"outcome_reason": "..."}`), `DELETE` (payload `{"mode": "ARCHIVE" | "PERMANENT"}`). After a decision: `status` becomes `APPROVED`/`REJECTED`, with `decided_payload`, `decision_diff`, `decision_comment`, `decided_by`, `decided_at`.

#### `GET /bids/my-approvals`

Everything waiting on **you**.

**Access:** Permission `bid.view`

```json
{
  "success": true,
  "message": "Pending approvals retrieved",
  "data": [
    {
      "bid_id": "200a8392-...",
      "bid_title": "Supply and Implementation of Enterprise Firewall",
      "gem_bid_no": "GEM/2026/B/87654",
      "kind": "EDIT",
      "requested_by": "Arjun Mehta",
      "requested_at": "2026-10-01T11:00:00+05:30",
      "link": "/dashboard/tenders/200a8392-...?approval=1"
    }
  ]
}
```

`kind`: `EDIT`, `CANCEL`, `DELETE`, `PRICING` (you are the pricing approver), `INTERNAL_APPROVAL` (you are the tender's Account/Reporting Manager and it awaits sign-off).

#### `POST /bids/pending-edits/:editId/approve`

Approve, optionally correcting the proposal first. Send any update fields to override the requested values, plus an optional comment.

**Access:** Permission `bid.edit` — and you must be that edit's Reporting Manager (or an admin).

```json
{ "estimated_value": 5400000, "comment": "Approved with corrected value" }
```

`200` `Edit approved` · `400` · `403`

#### `POST /bids/pending-edits/:editId/reject`

Discard the proposal; the requester is notified with the comment.

**Access:** same as approve.

```json
{ "comment": "Value not supported by the RFP" }
```

`200` `Edit rejected` · `400` · `403`

---

### 6.8 `POST /bids/:id/transition` — move stage

**Access:** Permission `bid.edit`

**Request body**

```json
{ "target_stage": "PRICING_REQUEST", "reason": "OEM authorisation received" }
```

`target_stage` is a workflow stage ([12.1](#121-tender-workflow-stages)) or a terminal state `WON` / `LOST` / `CANCELLED`.

**Transition rules**

- **Forward** moves must follow the allowed-next table below.
- **Backward** moves (to any earlier stage) are always allowed.
- **Terminal** targets (`WON`, `LOST`, `CANCELLED`) are always allowed from a non-terminal stage.
- From a terminal stage nothing moves, except a `CANCELLED` tender may be reopened to a non-terminal stage.
- Moving into `EMD_PROCESSING` on a tender with no EMD (exempted or not applicable) lands on `INTERNAL_APPROVAL` instead.
- A Bid Executive cannot leave or enter a stage that is locked for them ([5](#5-stage-access-control--apiv1usersidstage-restrictions)).

| From | Allowed forward targets |
|---|---|
| `DISCOVERED` | `PRIMARY_REVIEW`, `OEM_AUTHORIZATION_REQUEST` |
| `PRIMARY_REVIEW` | `OEM_AUTHORIZATION_REQUEST` |
| `OEM_AUTHORIZATION_REQUEST` | `PRICING_REQUEST`, `DOCUMENT_CHECKLIST_PREPARATION` |
| `PRICING_REQUEST` | `DOCUMENT_CHECKLIST_PREPARATION`, `EMD_PROCESSING` |
| `DOCUMENT_CHECKLIST_PREPARATION` | `EMD_PROCESSING`, `INTERNAL_APPROVAL` |
| `EMD_PROCESSING` | `INTERNAL_APPROVAL`, `GEM_SUBMISSION` |
| `INTERNAL_APPROVAL` | `GEM_SUBMISSION` |
| `GEM_SUBMISSION` | `TECHNICAL_EVALUATION` |
| `TECHNICAL_EVALUATION` | `FINANCIAL_EVALUATION` |
| `FINANCIAL_EVALUATION` | `AWARD_HANDOVER` |
| `AWARD_HANDOVER` | (none; record the outcome instead) |

**Response `200`**

```json
{
  "success": true,
  "message": "Bid stage transitioned successfully",
  "data": {
    "bid_id": "200a8392-...",
    "previous_stage": "OEM_AUTHORIZATION_REQUEST",
    "current_stage": "PRICING_REQUEST",
    "transitioned_at": "2026-10-01T12:00:00+05:30"
  }
}
```

**Also:** `202` pending approval ([6.6](#66-the-approval-202-response)) · `409` with the reason, e.g. `transition from GEM_SUBMISSION to AWARD_HANDOVER is not allowed for MANUAL mode`, `bid is in a terminal stage: WON`, or a stage-access lock.

---

### 6.9 History and audit

#### `GET /bids/:id/stage-history`

One tender's History tab, newest first, cursor-paginated.

**Access:** Permission `bid.view` · **Query:** `limit` (default 30, max 200), `cursor`

```json
{
  "success": true,
  "data": [
    {
      "id": "d6b92d56-...",
      "from_stage": "AWARD_HANDOVER",
      "to_stage": "AWARD_HANDOVER",
      "transition_reason": "[Completed Stage Action]: PO received",
      "transitioned_by": { "id": "98a8...", "full_name": "Arjun Mehta", "username": "arjun", "role": "BID_EXECUTIVE" },
      "event_type": "STAGE_CHANGE",
      "details": null,
      "created_at": "2026-09-25T16:20:48+05:30"
    }
  ],
  "meta": { "next_cursor": "MjAyNi0w...", "has_more": true }
}
```

**Errors:** `400` invalid cursor · `404`

#### `POST /bids/:id/history`

Log a granular event (pricing change, alert sent, checklist edit...) so every user sees it in History.

**Access:** Permission `bid.edit`

| Field | Type | Required |
|---|---|---|
| `to_stage` | string | yes |
| `event_type` | string | yes — e.g. `PRICING_UPDATED`, `ALERT_SENT` |
| `from_stage` | string | no |
| `transition_reason` | string | no |
| `details` | JSON | no — any object |

```json
{
  "to_stage": "PRICING_REQUEST",
  "event_type": "PRICING_UPDATED",
  "transition_reason": "Margin revised",
  "details": { "old_margin": 12, "new_margin": 10 }
}
```

`201` `Event logged` (returns the event) · `404`

#### `GET /bids/audit-history`

Global audit trail across all tenders (also contains deleted tenders via the stored title). With `user_id`, it becomes that person's Activity Log.

**Access:** Permission `bid.view`; using `user_id` additionally needs role `SUPER_ADMIN`, `ADMIN` or `MANAGER`.

**Query:** `limit` (default 30, max 200), `cursor`, `user_id`

```json
{
  "success": true,
  "data": [
    {
      "id": "c39eca43-...",
      "bid_id": null,
      "bid_title": "Old Tender (deleted)",
      "to_stage": "TENDER_DELETED",
      "transition_reason": "Permanently deleted",
      "event_type": "TENDER_DELETED",
      "transitioned_by": { "id": "af30...", "full_name": "Admin", "username": "Sadmin", "role": "SUPER_ADMIN" },
      "created_at": "2026-10-01T13:33:02+05:30"
    }
  ],
  "meta": { "next_cursor": "MjAyNi0x...", "has_more": true }
}
```

`403` `Only Super Admin, Admin, or Manager can view another user's activity log`

---

### 6.10 Workspace members

#### `POST /bids/:id/members`

**Access:** Permission `bid.edit`

```json
{ "user_id": "5f0c...", "role": "REVIEWER" }
```

`role`: `OWNER`, `MANAGER`, `MEMBER`, `REVIEWER`, `OBSERVER`.

`201` `Member added to workspace` · `409` already a member

#### `DELETE /bids/:id/members/:user_id`

**Access:** Permission `bid.edit` · `200` `Member removed from workspace` · `400`

---

### 6.11 Checklists

Document checklist items of a tender. Titles conventionally start with `[Bidder]` or `[OEM]`.

**Checklist item object**

```json
{
  "id": "42d52164-...",
  "title": "[Bidder] Experience Certificate",
  "is_done": true,
  "done_by": { "id": "98a8...", "full_name": "Arjun Mehta", "username": "arjun", "role": "BID_EXECUTIVE" },
  "done_at": "2026-09-25T16:05:07+05:30",
  "sort_order": 0,
  "checklist_group": "",
  "created_at": "2026-09-25T15:34:23+05:30"
}
```

| # | Method & path | Access | Body | Success |
|---|---|---|---|---|
| 1 | `GET /bids/:id/checklists` | `bid.view` | — | `200` `Checklists retrieved`, `data`: item[] |
| 2 | `POST /bids/:id/checklists` | `bid.edit` | `{"title": "[OEM] MII Certificate", "sort_order": 3}` (`sort_order` optional) | `201` `Checklist item added`, `data`: item |
| 3 | `PATCH /bids/:id/checklists/:cid` | `bid.edit` | `{"is_done": true}` | `200` `Checklist updated`, `data`: item |
| 4 | `PUT /bids/:id/checklists/:cid` | `bid.edit` | `{"title": "...", "sort_order": 2}` (both optional) | `200` `Checklist item updated` |
| 5 | `PUT /bids/:id/checklists/reorder` | `bid.edit` | `{"items": [{"id": "...", "sort_order": 0}, {"id": "...", "sort_order": 1}]}` | `200` `Checklists reordered`, `data`: item[] |
| 6 | `DELETE /bids/:id/checklists/:cid` | `bid.edit` | — | `200` `Checklist item deleted` |

Errors: `400` invalid payload, `404` item or tender not found.

---

### 6.12 Helpers: Field Memory, pricing hint, performance matrix

#### `GET /bids/field-suggestions?field=<key>`

Previously typed values for a free-text field, most used first (up to 500). Powers autocomplete.

**Access:** Permission `bid.view`

Common keys: `organization_name`, `department_name`, `location`, `title`, `portal_source`, `category`, `scope_type`, `product`, `oem`, `emd_bank_name`, `emd_beneficiary`, `emd_payable_at`, `ticket_category_other`.

```json
{
  "success": true,
  "message": "Field suggestions retrieved",
  "data": [
    { "value": "Odisha", "usage_count": 12 },
    { "value": "New Delhi", "usage_count": 3 }
  ]
}
```

`400` `field is required`

#### `GET /bids/pricing-suggestion?desc=<product description>`

Suggested unit price and margin: average over the last N approved deals of that product (N = config `pricing_suggestion_window`).

**Access:** Permission `bid.view`

```json
{
  "success": true,
  "message": "Pricing suggestion retrieved",
  "data": {
    "count": 3,
    "avg_unit_price_excl_gst": 84500,
    "avg_margin_pct": 11.2,
    "last_margin_pct": 10,
    "window": 5,
    "deals": [
      { "bid_id": "...", "bid_title": "...", "date": "2026-08-12T00:00:00Z", "unit_price_excl_gst": 85000, "margin_pct": 10 }
    ]
  }
}
```

`count: 0` (not an error) when the product was never priced.

#### `GET /bids/performance-matrix`

Tender counts per owner. Management roles (`SUPER_ADMIN`, `ADMIN`, `MANAGER`, `ACCOUNT_MANAGER`) see every owner; everyone else sees only their own row.

**Access:** Permission `bid.view`

```json
{
  "success": true,
  "message": "Tender performance matrix retrieved",
  "data": [
    {
      "user_id": "af30...", "full_name": "Arjun Mehta", "username": "arjun", "role": "BID_EXECUTIVE",
      "total": 42, "active": 6, "submitted": 20, "tech_eval": 3, "fin_eval": 5,
      "award": 2, "won": 4, "lost": 6, "cancelled": 1, "closed": 10
    }
  ]
}
```

---

### 6.13 `PATCH /bids/:id/outcome` — record outcome

**Access:** Permission `bid.edit`

| Field | Type | Required | Notes |
|---|---|---|---|
| `bid_outcome` | string | yes | `WON`, `LOST`, `CANCELLED` |
| `final_bid_value` | number | no | |
| `quoted_price` | number | no | |
| `l1_price` | number | no | |
| `outcome_reason` | string | no | |
| `result_date` | string | no | |
| `competitor_info` | array | no | `[{"name", "quoted_price", "rank"}]` |

```json
{
  "bid_outcome": "LOST",
  "quoted_price": 4900000,
  "l1_price": 4720000,
  "outcome_reason": "L2 on price",
  "competitor_info": [ { "name": "Acme Infra", "quoted_price": 4720000, "rank": "L1" } ]
}
```

`200` `Bid outcome recorded` · `202` pending approval (Bid Executive cancelling) · `403` · `404`

---

### 6.14 Tender Bin

| Step | Method & path | Access | Result |
|---|---|---|---|
| 1. Move to bin (soft delete) | `DELETE /bids/:id` | `bid.delete` | `200` `Bid moved to Tender Bin successfully` or `202` pending approval |
| 2. List the bin | `GET /bids?in_bin=true` | `bid.view` | archived tenders |
| 3. Restore | `POST /bids/:id/restore` | `bid.edit` | `200` `Bid restored successfully` · `409` identifier now taken by another tender |
| 4. Delete forever | `DELETE /bids/:id/permanent` | `bid.delete` | `200` `Bid permanently deleted` or `202` pending approval |

A permanently deleted tender's history entries stay in the audit trail with its title.

---

### 6.15 `POST /bids/bulk-import` — Excel import

Import many tenders from a tracker workbook in one transaction. **Defaults to a dry run** so an accidental call never writes.

**Access:** Role `SUPER_ADMIN`

**Request:** `multipart/form-data` with field `file` (`.xlsx`, max 10 MB).

**Query parameters**

| Param | Default | Notes |
|---|---|---|
| `dry_run` | `true` | `false` actually writes |
| `format` | `gbx` | `gbx` (GBX tracker) or `dashboard` (Tender Dashboard workbook) |
| `owner` | uploader | user to own the imported tenders: user ID, username, or email |

```bash
curl -X POST "http://<server-ip>/api/v1/bids/bulk-import?dry_run=false&format=gbx" \
  -H "Authorization: Bearer <token>" \
  -F "file=@GBX_Tracker.xlsx"
```

**Response** — `200` `Preview generated - nothing was written` (dry run) or `201` `Imported 120 tenders, skipped 3 already present`:

```json
{
  "success": true,
  "message": "Imported 120 tenders, skipped 3 already present",
  "data": {
    "format": "gbx",
    "dry_run": false,
    "row_count": 123,
    "import_count": 120,
    "stage_counts": { "AWARD_HANDOVER": 10, "TECHNICAL_EVALUATION": 14 },
    "warning_rows": 2,
    "duplicates": [ { "bid_id": "GEM/2026/B/1", "rows": [4, 9] } ],
    "skipped": [ { "row": 7, "bid_id": "GEM/2025/B/77", "title": "...", "reason": "already present" } ],
    "skipped_sheets": [ { "name": "Notes", "rows": 12 } ],
    "rows": [
      { "row": 2, "title": "...", "bid_id": "GEM/2026/B/5", "client": "NIC", "workflow_stage": "GEM_SUBMISSION", "bid_status": "ACTIVE", "reason": "", "skipped": false, "warnings": ["missing end date"] }
    ],
    "created_ids": ["..."],
    "owner_id": "af30..."
  }
}
```

**Errors:** `400` bad `format`, missing/oversized/unreadable file, unknown owner · `500` `import rolled back: ...` (nothing written)

---

## 7. Leads — `/api/v1/leads`

Pre-tender opportunities (Lead → Quote → Bid). Stored in their own `leads` schema with no link to tender tables. All routes require authentication.

### 7.1 Typical flow (step by step)

1. `POST /leads` — create the lead (JSON).
2. If it is **Published**, `POST /leads/:id/documents` — upload each document, **one file per request**.
3. `GET /leads` — the Leads dashboard list.
4. `GET /leads/:id` — detail with its documents.
5. `GET /leads/:id/documents/:docId` — download; `DELETE` to remove a wrong upload.

### Lead object

```json
{
  "id": "491719b9-4e73-40bc-829a-363f51b03895",
  "publish_status": "PUBLISHED",
  "lead_type": "GOV",
  "account_name": "Odisha Computer Application Centre",
  "department_name": "E&IT Department",
  "location": "Bhubaneswar",
  "high_level_scope": "Data centre refresh",
  "expected_date": "2026-11-20",
  "scope_type": "Supply",
  "category": "IT infra",
  "estimated_value": 7500000,
  "title": "Data Centre Refresh RFP",
  "published_details": { "gem_bid_no": "GEM/2026/B/999", "emd_not_applicable": true },
  "lead_owner": { "id": "af30...", "full_name": "Arjun Mehta" },
  "reporting_manager": { "id": "5f0c...", "full_name": "Priya Manager" },
  "created_by": { "id": "af30...", "full_name": "Arjun Mehta" },
  "folder_name": "data-centre-refresh-rfp-454b9c",
  "document_count": 4,
  "created_at": "2026-10-01T13:30:20+05:30",
  "updated_at": "2026-10-01T13:30:20+05:30"
}
```

`title` and `published_details` are `null` for an Unpublished lead; `reporting_manager` is `null` when not set. `documents` is included only by `GET /leads/:id`.

### 7.2 `POST /leads` — create lead

**Access:** Permission `lead.create`

**Request body**

| Field | Type | Required | Notes |
|---|---|---|---|
| `publish_status` | string | yes | `PUBLISHED` or `UNPUBLISHED` |
| `lead_type` | string | yes | `GOV` or `PVT` |
| `account_name` | string | yes | |
| `title` | string | if `PUBLISHED` | tender title |
| `department_name` | string | no | |
| `location` | string | no | |
| `high_level_scope` | string | no | |
| `expected_date` | string | no | `YYYY-MM-DD` |
| `scope_type` | string | no | |
| `category` | string | no | category / scope group |
| `estimated_value` | number | no | ≥ 0 |
| `lead_owner_id` | UUID | no | defaults to the caller |
| `reporting_manager_id` | UUID | no | |
| `published_details` | object | no | Published only — the tender Section 1 fields below |

**`published_details`** (same keys as the tender create payload, so a future Lead → Tender conversion can pass them through):

`gem_bid_no`, `start_date` (YYYY-MM-DD), `end_date` (RFC 3339), `portal_source`, `bid_type`, `quantity`, `requested_products` (array of `{product, description, qty, oem}`), `emd_not_applicable`, `emd_amount`, `emd_online` (bool), `emd_bank_name`, `emd_account_number`, `emd_ifsc_code`, `emd_branch`, `emd_dd` (bool), `emd_beneficiary`, `emd_payable_at`, `emd_exemption_types`, `emd_exemption_reason`, `bg_required`, `bg_rate`, `bg_duration_months`.

Server rules: text is trimmed (blank → `null`); for an **Unpublished** lead `title` and `published_details` are dropped; `published_details` must be a JSON object.

**Example — Unpublished**

```json
{
  "publish_status": "UNPUBLISHED",
  "lead_type": "PVT",
  "account_name": "Kalinga Steels Pvt Ltd",
  "location": "Jajpur",
  "expected_date": "2026-12-01",
  "estimated_value": 2500000
}
```

**Example — Published**

```json
{
  "publish_status": "PUBLISHED",
  "lead_type": "GOV",
  "account_name": "Odisha Computer Application Centre",
  "department_name": "E&IT Department",
  "location": "Bhubaneswar",
  "expected_date": "2026-11-20",
  "category": "IT infra",
  "estimated_value": 7500000,
  "title": "Data Centre Refresh RFP",
  "lead_owner_id": "af30e5b8-845c-46f1-b560-c2789fea2847",
  "reporting_manager_id": "5f0c...",
  "published_details": {
    "gem_bid_no": "GEM/2026/B/999",
    "portal_source": "GeM",
    "bid_type": "BID",
    "quantity": 2,
    "end_date": "2026-11-15T11:00:00.000Z",
    "requested_products": [ { "product": "Rack server", "description": "2U", "qty": "2", "oem": "" } ],
    "emd_not_applicable": true,
    "bg_required": false
  }
}
```

**Response `201`** — `message: "Lead created"`, `data`: Lead object (with empty `documents`). The server also creates the lead's storage folder `<LEADS_UPLOAD_DIR>/<folder_name>/docs/`.

**Errors (`400`):** `lead status must be Published or Unpublished` · `lead type must be PVT or GOV` · `account name is required` · `tender title is required for a published lead` · `expected date must be YYYY-MM-DD` · `estimated value cannot be negative` · `published details must be a JSON object` · `selected owner or reporting manager does not exist` · `invalid lead payload`

---

### 7.3 `GET /leads` — list leads

All leads, newest first (not paginated).

**Access:** Permission `lead.view`

```json
{ "success": true, "message": "Leads retrieved", "data": [ { "...": "Lead object" } ] }
```

---

### 7.4 `GET /leads/:id` — lead detail

**Access:** Permission `lead.view`

**Response `200`** — Lead object plus `documents`, grouped by category (uncategorised last):

```json
{
  "documents": [
    {
      "id": "1e2af933-ff63-4312-b9ef-e23bec5797a2",
      "category": "RFP",
      "original_name": "rfp.pdf",
      "content_type": "application/pdf",
      "size_bytes": 1048576,
      "uploaded_by_name": "Arjun Mehta",
      "created_at": "2026-10-01T13:28:24+05:30"
    }
  ]
}
```

`category: null` = a bulk (uncategorised) upload. **Errors:** `404` `Lead not found`

---

### 7.5 `POST /leads/:id/documents` — upload one document

**Access:** Permission `lead.create`

**Request:** `multipart/form-data`

| Field | Required | Notes |
|---|---|---|
| `file` | yes | one file, max 25 MB |
| `category` | no | document type label, e.g. `RFP`, `BOQ` (max 60 chars). Omit for a bulk upload |

Allowed files, checked by the file's actual content, not its name: **PDF**, **JPEG/PNG/WebP**, **Word/Excel/PowerPoint** (`.doc/.docx/.xls/.xlsx/.ppt/.pptx`). SVG/HTML and everything else are rejected.

Stored at `<LEADS_UPLOAD_DIR>/<folder_name>/docs/[<Category>/]<random>_<name>` (Docker host: `./leads-assets/...`).

```bash
curl -X POST "http://<server-ip>/api/v1/leads/<lead-id>/documents" \
  -H "Authorization: Bearer <token>" \
  -F "file=@RFP Document.pdf" \
  -F "category=RFP"
```

**Response `201`**

```json
{
  "success": true,
  "message": "Document uploaded",
  "data": {
    "id": "1e2af933-...",
    "category": "RFP",
    "original_name": "RFP Document.pdf",
    "content_type": "application/pdf",
    "size_bytes": 1048576,
    "uploaded_by_name": null,
    "created_at": "2026-10-01T13:28:24+05:30"
  }
}
```

**Errors:** `400` `attach one file up to 25 MB` / `file exceeds the 25 MB limit` / `file is empty` / `only PDF, images (JPG/PNG/WebP) and Office files (Word/Excel/PowerPoint) are allowed` · `404` `Lead not found`

---

### 7.6 `GET /leads/:id/documents/:docId` — download

**Access:** Permission `lead.view`

**Response `200`** — the raw file with `Content-Type` set to the stored type and `Content-Disposition: attachment; filename="<original name>"`.

**Errors:** `404` `Document not found` (also when the document belongs to a different lead) · `404` `File is missing from storage`

---

### 7.7 `DELETE /leads/:id/documents/:docId`

Removes the record and the file on disk.

**Access:** Permission `lead.create`

`200` `Document deleted` · `404` `Document not found`

---

## 8. Alerts — `/api/v1/alerts`

In-app notifications (also emailed). An alert targets either one user (`user_id`) or everyone with a role (`target_role`). All routes require authentication.

### Alert object

```json
{
  "id": "2c2d0b94-f6d8-4e5f-a110-2a49b01cf6cb",
  "user_id": "98a8...",
  "target_role": "SUPER_ADMIN",
  "bid_id": "200a8392-...",
  "created_by": "af30...",
  "type": "STAGE_CHANGE",
  "title": "Tender moved to Pricing Request",
  "message": "Supply and Implementation of Enterprise Firewall moved to Pricing Request",
  "link": "/dashboard/tenders/200a8392-...?tab=stages&stage=PRICING_REQUEST",
  "is_read": false,
  "created_at": "2026-10-01T12:00:00+05:30"
}
```

Optional fields are omitted when empty. `link` is always an in-app path starting with `/dashboard/`.

### 8.1 `GET /alerts`

Alerts addressed to you, to your primary role (the first role on your account), or to `ALL`, newest first.

**Response `200`** — `message: "Alerts retrieved"`, `data`: Alert[] (empty array when none).

### 8.2 `POST /alerts`

Create an alert (and its email).

| Field | Type | Required | Notes |
|---|---|---|---|
| `title` | string | yes | |
| `message` | string | yes | |
| `user_id` | UUID | one of these | specific recipient |
| `target_role` | string | one of these | role-wide broadcast; `ALL` reaches everyone |
| `bid_id` | UUID | no | related tender |
| `type` | string | no | default `INFO` |
| `link` | string | no | in-app path; anything not starting with `/dashboard/` is replaced by the tender link (or dropped) |
| `created_by` | UUID | no | defaults to caller |

```json
{
  "user_id": "ccc9...",
  "bid_id": "200a8392-...",
  "type": "REMINDER",
  "title": "EMD due tomorrow",
  "message": "Please arrange the DD for GEM/2026/B/87654",
  "link": "/dashboard/tenders/200a8392-...?tab=stages&stage=EMD_PROCESSING"
}
```

`201` `Alert created` (`data`: Alert) · `400` `title and message are required`

### 8.3 `PUT /alerts/:id/read`

`200` `Alert marked as read`

### 8.4 `PUT /alerts/read-all`

`200` `All alerts marked as read`

### 8.5 `DELETE /alerts/:id`

`200` `Alert deleted` · `404` `Alert not found`

---

## 9. Feedback Tickets — `/api/v1/tickets`

Feedback Loop: every user except Super Admin can raise a ticket; only Super Admin triages. All routes require authentication.

### Ticket object

```json
{
  "id": "dfe9c701-376d-4919-b862-0a45b2e1a539",
  "category": "Pricing & OEM Workspace",
  "custom_category": null,
  "description": "Margin field does not save after editing",
  "status": "OPEN",
  "image_url": "/api/v1/tickets/dfe9c701-.../image",
  "reporter": { "id": "98a8...", "full_name": "Arjun Mehta", "username": "arjun" },
  "resolved_by": null,
  "resolved_at": null,
  "created_at": "2026-09-21T15:15:44+05:30",
  "updated_at": "2026-09-21T15:15:44+05:30"
}
```

Statuses: `OPEN`, `IN_PROGRESS`, `RESOLVED`. Categories: see [12.5](#125-feedback-categories).

### 9.1 `POST /tickets` — submit feedback

**Access:** Authenticated, **except** role `SUPER_ADMIN` (`403`).

**Request:** always `multipart/form-data`.

| Field | Required | Notes |
|---|---|---|
| `category` | yes | one of [12.5](#125-feedback-categories) |
| `description` | yes | |
| `custom_category` | when `category` = `Other` | free text |
| `image` | no | JPEG/PNG/WebP, max 5 MB (content-checked; SVG rejected) |

```bash
curl -X POST "http://<server-ip>/api/v1/tickets" \
  -H "Authorization: Bearer <token>" \
  -F "category=Bug Report" \
  -F "description=Export button does nothing on Master Sheet" \
  -F "image=@screenshot.png"
```

`201` `Feedback submitted` (`data`: Ticket; Super Admin is notified by email) · `400` missing fields / bad image · `403` `Super Admin manages feedback, not submit it`

### 9.2 `GET /tickets/mine`

Your own tickets, cursor-paginated (`limit` default 30, max 200; `cursor`).

```json
{ "success": true, "data": [ { "...": "Ticket" } ], "meta": { "next_cursor": "...", "has_more": false } }
```

### 9.3 `GET /tickets/:id`

Owner or Super Admin. `200` `Ticket retrieved` · `403` `You can only view your own feedback` · `404`

### 9.4 `GET /tickets/:id/history`

Status change history (owner or Super Admin).

```json
{
  "success": true,
  "message": "Ticket history retrieved",
  "data": [
    {
      "id": "...",
      "from_status": "OPEN",
      "to_status": "IN_PROGRESS",
      "changed_by": { "id": "af30...", "full_name": "Admin", "username": "Sadmin" },
      "note": "Looking into it",
      "created_at": "2026-09-22T10:00:00+05:30"
    }
  ]
}
```

### 9.5 `GET /tickets/:id/image`

Streams the attached image (owner or Super Admin). `404` `This ticket has no image`.

### 9.6 `GET /tickets` — all tickets (triage)

**Access:** Role `SUPER_ADMIN`

**Query:** `limit`, `cursor`, `status`, `category`. Same paged shape as [9.2](#92-get-ticketsmine).

### 9.7 `GET /tickets/open-count`

**Access:** Role `SUPER_ADMIN`

```json
{ "success": true, "message": "Open ticket count retrieved", "data": { "open_count": 4 } }
```

### 9.8 `PATCH /tickets/:id/status`

**Access:** Role `SUPER_ADMIN`

```json
{ "status": "RESOLVED", "note": "Fixed in release 2026-10-01" }
```

`200` `Ticket status updated` (the reporter is emailed when it becomes `RESOLVED`) · `400` invalid status · `404`

---

## 10. System Configuration — `/api/v1/system/config`

Platform settings stored as JSON values. All routes require authentication.

| Key | Type | Default | Meaning |
|---|---|---|---|
| `stage2_require_am_presales` | bool | `true` | Primary Review (Stage 2) requires Account Manager and Pre-Sales |
| `pricing_suggestion_window` | int | `5` | Past approved deals averaged for the pricing hint |

### 10.1 `GET /system/config`

All settings as a map.

```json
{ "success": true, "data": { "pricing_suggestion_window": 5, "stage2_require_am_presales": true } }
```

### 10.2 `GET /system/config/:key`

```json
{
  "success": true,
  "data": {
    "key": "pricing_suggestion_window",
    "value": 5,
    "description": "Number of past approved deals to average for the Pricing Request suggested unit price / margin hint",
    "updated_by": "af30e5b8-...",
    "updated_at": "2026-09-22T13:25:36+05:30"
  }
}
```

`404` `Configuration key not found`

### 10.3 `PUT /system/config/:key`

**Access:** Role `SUPER_ADMIN`

```json
{ "value": 7 }
```

`value` may be any JSON (number, boolean, string, object). `200` `Configuration updated successfully` (recorded in System Logs) · `400` `Invalid request payload: 'value' is required`

---

## 11. System Logs — `/api/v1/system-logs`

Account and access audit trail (logins, user creation, role and permission changes, stage-access changes, configuration changes). Tender activity is in [6.9](#69-history-and-audit) instead.

### 11.1 `GET /system-logs`

**Access:** Role `SUPER_ADMIN`

**Query:** `limit` (default 30, max 200), `cursor`, `category` (`USER_MGMT`, `ACCESS_CONTROL`, `SECURITY`, `CONFIGURATION`)

```json
{
  "success": true,
  "data": [
    {
      "id": "9b4d8711-...",
      "category": "SECURITY",
      "event_type": "LOGIN_SUCCESS",
      "actor": { "id": "af30...", "full_name": "Admin", "username": "Sadmin" },
      "target_user": { "id": "...", "full_name": "...", "username": "..." },
      "summary": "'Sadmin' logged in",
      "details": { },
      "created_at": "2026-10-01T16:37:22+05:30"
    }
  ],
  "meta": { "next_cursor": "MjAyNi0x...", "has_more": true }
}
```

`target_user` and `details` appear only when relevant. `400` invalid cursor.

---

## 12. Appendix: enums and reference values

### 12.1 Tender workflow stages

In order:

| # | Value | Name |
|---|---|---|
| 1 | `DISCOVERED` | Search & Identification |
| 2 | `PRIMARY_REVIEW` | Primary Review (Go / No-Go) |
| 3 | `OEM_AUTHORIZATION_REQUEST` | OEM Authorization |
| 4 | `PRICING_REQUEST` | Pricing Request |
| 5 | `DOCUMENT_CHECKLIST_PREPARATION` | Document Checklist |
| 6 | `EMD_PROCESSING` | EMD Processing (skipped when EMD is not required) |
| 7 | `INTERNAL_APPROVAL` | Internal Approval |
| 8 | `GEM_SUBMISSION` | GeM Submission |
| 9 | `TECHNICAL_EVALUATION` | Technical Evaluation |
| 10 | `FINANCIAL_EVALUATION` | Financial Evaluation |
| 11 | `AWARD_HANDOVER` | Award & Handover |

Terminal: `WON`, `LOST`, `CANCELLED`.

### 12.2 Tender status values

| Field | Values |
|---|---|
| `bid_status` | `ACTIVE`, `WON`, `LOST`, `CANCELLED`, `CLOSED` (assessed, no bid submitted), `ARCHIVED` |
| `bid_outcome` | `WON`, `LOST`, `CANCELLED` |
| `derived_status` | `ACTIVE`, `TECHNICAL_EVALUATION`, `SUBMITTED`, `WON`, `LOST`, `CANCELLED`, `CLOSED` |
| `creation_mode` | `MANUAL`, `INTELLIGENCE` |
| `bid_type` | `BID`, `BID_TO_RA` |
| Member `role` | `OWNER`, `MANAGER`, `MEMBER`, `REVIEWER`, `OBSERVER` |
| Approval `action_type` | `EDIT`, `CANCEL`, `DELETE` |
| Approval `status` | `PENDING`, `APPROVED`, `REJECTED` |
| Pending approval `kind` | `EDIT`, `CANCEL`, `DELETE`, `PRICING`, `INTERNAL_APPROVAL` |
| EMD exemption types | `MSME`, `STARTUP`, `OTHER` |

### 12.3 Lead values

| Field | Values |
|---|---|
| `publish_status` | `PUBLISHED`, `UNPUBLISHED` |
| `lead_type` | `GOV`, `PVT` |

### 12.4 Preset dropdown values (free text also accepted)

| Field | Presets |
|---|---|
| `portal_source` | `GeM`, `Private`, `RTC`, `CPPP`, `eProcure` |
| `scope_type` | `Supply`, `Implementation`, `Support`, `N/A` |
| `category` | `End computing`, `IT infra`, `Non-IT infra`, `Security`, `Cloud`, `Surveillance`, `Software`, `Manpower-augmentation` |
| Lead document `category` | `RFP`, `Corrigendum`, `BOQ`, `Technical Specification`, `Commercial Terms`, `Drawings` |

### 12.5 Feedback categories

`Tender Form (Add / Edit)`, `Tender Metadata / Master Sheet`, `Pricing & OEM Workspace`, `EMD & Financials`, `Checklist & Documents`, `Stage Workflow & Approvals`, `User & Role Management`, `Reports & Analytics`, `Login & Access`, `Bug Report`, `General Question`, `Other` (requires `custom_category`).

---

## 13. Appendix: endpoint index

| Method | Path | Access |
|---|---|---|
| GET | `/health` | Public |
| POST | `/auth/login` | Public |
| POST | `/auth/refresh` | Public |
| POST | `/auth/forgot-password` | Public |
| POST | `/auth/verify-otp` | Public |
| POST | `/auth/reset-password-otp` | Public |
| POST | `/auth/logout` | Authenticated |
| PATCH | `/auth/change-password` | Authenticated |
| PATCH | `/auth/force-reset` | `user.edit` |
| GET | `/users/me` | Authenticated |
| POST | `/users` | `user.create` |
| GET | `/users` | `user.view` |
| GET | `/users/:id` | `user.view` |
| PATCH | `/users/:id` | `user.edit` |
| PATCH | `/users/:id/status` | `user.deactivate` |
| PATCH | `/users/:id/roles` | `user.assign_role` |
| PATCH | `/users/:id/permissions` | `user.assign_role` |
| DELETE | `/users/:id` | `user.deactivate` |
| GET | `/users/:id/stage-restrictions` | self, or SUPER_ADMIN / ADMIN / MANAGER |
| PUT | `/users/:id/stage-restrictions` | SUPER_ADMIN / ADMIN / MANAGER |
| POST | `/bids` | `bid.create` |
| GET | `/bids` | `bid.view` |
| GET | `/bids/:id` | `bid.view` |
| PATCH | `/bids/:id` | `bid.edit` |
| GET | `/bids/my-approvals` | `bid.view` |
| GET | `/bids/:id/pending-edit` | `bid.view` |
| POST | `/bids/pending-edits/:editId/approve` | `bid.edit` + approver |
| POST | `/bids/pending-edits/:editId/reject` | `bid.edit` + approver |
| POST | `/bids/:id/transition` | `bid.edit` |
| GET | `/bids/:id/stage-history` | `bid.view` |
| POST | `/bids/:id/history` | `bid.edit` |
| GET | `/bids/audit-history` | `bid.view` (`user_id`: SUPER_ADMIN / ADMIN / MANAGER) |
| GET | `/bids/performance-matrix` | `bid.view` |
| GET | `/bids/field-suggestions` | `bid.view` |
| GET | `/bids/pricing-suggestion` | `bid.view` |
| POST | `/bids/:id/members` | `bid.edit` |
| DELETE | `/bids/:id/members/:user_id` | `bid.edit` |
| PATCH | `/bids/:id/outcome` | `bid.edit` |
| GET | `/bids/:id/checklists` | `bid.view` |
| POST | `/bids/:id/checklists` | `bid.edit` |
| PUT | `/bids/:id/checklists/reorder` | `bid.edit` |
| PATCH | `/bids/:id/checklists/:cid` | `bid.edit` |
| PUT | `/bids/:id/checklists/:cid` | `bid.edit` |
| DELETE | `/bids/:id/checklists/:cid` | `bid.edit` |
| DELETE | `/bids/:id` | `bid.delete` |
| POST | `/bids/:id/restore` | `bid.edit` |
| DELETE | `/bids/:id/permanent` | `bid.delete` |
| POST | `/bids/bulk-import` | SUPER_ADMIN |
| GET | `/leads` | `lead.view` |
| POST | `/leads` | `lead.create` |
| GET | `/leads/:id` | `lead.view` |
| POST | `/leads/:id/documents` | `lead.create` |
| GET | `/leads/:id/documents/:docId` | `lead.view` |
| DELETE | `/leads/:id/documents/:docId` | `lead.create` |
| GET | `/alerts` | Authenticated |
| POST | `/alerts` | Authenticated |
| PUT | `/alerts/:id/read` | Authenticated |
| PUT | `/alerts/read-all` | Authenticated |
| DELETE | `/alerts/:id` | Authenticated |
| POST | `/tickets` | Authenticated, not SUPER_ADMIN |
| GET | `/tickets/mine` | Authenticated |
| GET | `/tickets/:id` | owner or SUPER_ADMIN |
| GET | `/tickets/:id/history` | owner or SUPER_ADMIN |
| GET | `/tickets/:id/image` | owner or SUPER_ADMIN |
| GET | `/tickets` | SUPER_ADMIN |
| GET | `/tickets/open-count` | SUPER_ADMIN |
| PATCH | `/tickets/:id/status` | SUPER_ADMIN |
| GET | `/system/config` | Authenticated |
| GET | `/system/config/:key` | Authenticated |
| PUT | `/system/config/:key` | SUPER_ADMIN |
| GET | `/system-logs` | SUPER_ADMIN |
