# OneTrack (GlobX) — Bug Fix & RBAC UI Overhaul Report

## Executive Summary
This report details the resolution of the **Bid Owner & Technical Manager Dropdown Population Bug** alongside a **Complete UI/UX Overhaul of the Roles & Permissions Management Dialog**.

- **Bug Resolved**: `BID_MANAGER` (and other operational roles) were previously unable to see users in the **Bid Owner** and **Technical Manager** dropdowns when creating/editing tender workspaces.
- **Root Cause**: `GET /api/v1/users` requires `user.view` permission, which was historically restricted to `SUPER_ADMIN` and `ADMIN`.
- **UI/UX Overhaul**: Replaced cryptic raw permission strings (e.g. `bid.create`, `user.assign_role`) with **clean human-readable titles**, **category dropdown selectors**, **search filtering**, and **interactive `(i)` info tooltips** on hover for every role and permission.

---

## 🛠️ Partitioned Fix Plan & Execution

### Phase 1: Backend & Database Permission Fix
- [x] **Task 1.1 — Create Database Migration `000009`**:
  - Created `backend/migrations/000009_grant_user_view_to_team_roles.up.sql` to grant `user.view` to `BID_MANAGER`, `BID_OWNER`, `MANAGEMENT`, `REVIEWER`, `FINANCE`, and `OPERATOR`.
  - Created corresponding rollback migration `000009_grant_user_view_to_team_roles.down.sql`.
- [x] **Task 1.2 — Update Seed Permissions (`000006`)**:
  - Updated `backend/migrations/000006_seed_role_permissions.up.sql` to include `(p.resource = 'user' AND p.action = 'view')` across operational team roles for future fresh system deployments.
- [x] **Task 1.3 — Backend Compilation & Auto-Migration Test**:
  - Verified Go compilation (`go build ./...`) executed with zero errors. On service startup, `RunAutoMigrations` automatically applies migration `000009`.

---

### Phase 2: Roles & Permissions UI Overhaul
- [x] **Task 2.1 — Created Permission Metadata Dictionary (`permissionMetaData.js`)**:
  - Mapped all 35+ system permissions to readable labels (e.g. `bid.create` ➔ *"Create Tender Workspace"*), category groupings (Tender Workspace, Tasks, Documents, User Management, Quotations, Costing, Workflow, Analytics, Notifications, System Admin), and detailed hover tooltips.
  - Added role descriptions and access summaries for all 8 roles (`SUPER_ADMIN` down to `OPERATOR`).
- [x] **Task 2.2 — Redesigned `RolesPermissionsDialog.jsx`**:
  - Replaced manual raw text inputs with a **Category Filter Dropdown** and **Live Search Bar**.
  - Added an **`(i)` Info Tooltip Button** next to every system role and every permission option. Hovering or clicking displays a mini popup explaining what that role or permission allows.
  - Formatted **Explicitly Allowed (Green)** and **Explicitly Denied (Red)** active override chips with friendly labels and single-click removal.
- [x] **Task 2.3 — Frontend Production Build Verification**:
  - Verified Vite frontend build (`npm run build`). Compiled cleanly in 1.25s with 0 errors.

---

## 🧪 E2E Test & Verification Matrix

| Test Case | Role / Target | Expected Behavior | Result |
| :--- | :--- | :--- | :--- |
| **TC-01: User Directory Access** | `BID_MANAGER` | Calling `GET /api/v1/users?limit=100` succeeds with `200 OK` (previously `403 Forbidden`). | **PASSED** ✅ |
| **TC-02: Add Tender Dropdowns** | `BID_MANAGER` | **Bid Owner** and **Technical Manager** dropdowns in `AddTenderPage` populate with active team members. | **PASSED** ✅ |
| **TC-03: Create Tender & Assign Roles** | `BID_MANAGER` | Demo tender created with selected Bid Owner and Technical Manager without error. | **PASSED** ✅ |
| **TC-04: Friendly Permission Picker** | `ADMIN` / `SUPER_ADMIN` | `RolesPermissionsDialog` renders friendly names (e.g. *"Create Tender Workspace"*) instead of `bid.create`. | **PASSED** ✅ |
| **TC-05: Info Tooltip Hover** | `ADMIN` / `SUPER_ADMIN` | Hovering over the `(i)` icon next to any role or permission displays formatted description box. | **PASSED** ✅ |
| **TC-06: Explicit Overrides** | Target User Account | Admin can add explicit Allow/Deny overrides via category picker. System calculates `(Role - Denied) + Allowed`. | **PASSED** ✅ |

---

## 💡 Important Session Note for Testing User Overrides
When an Admin updates roles or explicit permission overrides for a user account:
- In OneTrack, permissions are embedded into the user's **JWT Access Token payload**.
- To test permission changes on an active user account, the user should **log out and log back in** (or refresh their session token) so their browser stores the updated JWT claims.
