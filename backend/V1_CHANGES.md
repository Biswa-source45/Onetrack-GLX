# V1 Beta — Backend Changes

**Branch:** `V1`  
**Date:** June 17, 2026

---

## Overview

This document describes all backend changes made for the V1 beta release. The scope covers:

1. Assigning a **Technical Manager** as a first-class field on a bid (alongside Bid Owner)
2. **Bid-scoped checklists** — created at bid-creation time, ticked/unticked post-creation with actor + timestamp
3. **Operational status fields** now updatable via `PATCH /bids/:id`

---

## Database Migration

**File:** `migrations/000007_v1_bid_checklists.up.sql`

### Changes

#### 1. New column on `bid.bid_workspaces`

```sql
ALTER TABLE bid.bid_workspaces
    ADD COLUMN IF NOT EXISTS technical_manager_id UUID REFERENCES auth.users(id);
```

#### 2. New table `bid.bid_checklists`

```sql
CREATE TABLE bid.bid_checklists (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bid_id      UUID NOT NULL REFERENCES bid.bid_workspaces(id) ON DELETE CASCADE,
    title       TEXT NOT NULL,
    is_done     BOOLEAN NOT NULL DEFAULT false,
    done_by     UUID REFERENCES auth.users(id),
    done_at     TIMESTAMPTZ,
    sort_order  INT NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bid_checklists_bid ON bid.bid_checklists(bid_id);
```

**Rollback:** `migrations/000007_v1_bid_checklists.down.sql`

---

## Files Changed

### `internal/bid/domain/models.go`

| Change | Detail |
|---|---|
| `BidWorkspace` | Added `TechnicalManagerID *string` |
| New struct `BidChecklist` | Raw DB entity: `id, bid_id, title, is_done, done_by, done_at, sort_order, created_at` |
| New struct `BidChecklistItem` | Response DTO: same fields with `DoneBy *UserSummary` instead of raw UUID |
| `CreateBidRequest` | Added `TechnicalManagerID *string` and `Checklists []string` (checklist titles to seed on creation) |
| `UpdateBidRequest` | Added `TechnicalManagerID *string`, `TechComplianceStatus *string`, `QualificationStatus *string` |
| `BidResponse` | Added `TechnicalManager *UserSummary` and `Checklists []BidChecklistItem` |
| `BidListItem` | Added `TechnicalManager *UserSummary` |
| `CreateBidParams` | Added `TechnicalManagerID *string` |

---

### `internal/bid/domain/interfaces.go`

**`BidRepository` — new methods:**

```go
BulkInsertChecklists(ctx context.Context, bidID string, titles []string) error
GetChecklists(ctx context.Context, bidID string) ([]BidChecklist, error)
ToggleChecklist(ctx context.Context, checklistID string, isDone bool, doneBy string) error
```

**`BidService` — new methods:**

```go
GetChecklists(ctx context.Context, bidID string) ([]BidChecklistItem, error)
ToggleChecklist(ctx context.Context, bidID string, checklistID string, isDone bool, actorID string) (*BidChecklistItem, error)
```

---

### `internal/bid/repository/postgres.go`

| Change | Detail |
|---|---|
| `Create()` INSERT | Added `technical_manager_id` column and `$11` arg; renumbered all subsequent params ($11→$12 through $34→$35) |
| `GetByID()` SELECT | Added `technical_manager_id` to SELECT column list |
| `scanBidFields()` | Added `&b.TechnicalManagerID` to Scan call |
| `Update()` | Added `if` blocks for `TechnicalManagerID`, `TechComplianceStatus`, `QualificationStatus` |
| New `BulkInsertChecklists()` | Inserts checklist titles in order with `sort_order = index` |
| New `GetChecklists()` | Queries `bid.bid_checklists` ordered by `sort_order ASC, created_at ASC` |
| New `ToggleChecklist()` | Sets `is_done=true, done_by, done_at=NOW()` when ticking; clears all three when unticking |

---

### `internal/bid/service/bid_service.go`

| Change | Detail |
|---|---|
| `CreateBid()` | Maps `req.TechnicalManagerID` to `params.TechnicalManagerID`; calls `BulkInsertChecklists` after bid insert if `req.Checklists` is non-empty |
| `GetBid()` | Resolves `TechnicalManagerID` → full `UserSummary`; fetches checklists and enriches `DoneBy` UUID → `UserSummary`; passes both to `buildBidResponse` |
| New `GetChecklists()` | Fetches and enriches checklist items with `DoneBy` user summary |
| New `ToggleChecklist()` | Delegates to repo, re-fetches the specific item and returns enriched response |
| `buildBidResponse()` signature | Now accepts `techManager *UserSummary` and `checklists []BidChecklistItem` |
| `buildBidResponse()` body | Maps `TechnicalManager` and `Checklists` fields onto `BidResponse` |

---

### `internal/bid/handler/handler.go`

New handlers added:

#### `GetChecklists`
```
GET /bids/:id/checklists
Permission: bid.view
```
Returns all checklist items for a bid with full `done_by` user info and timestamps.

#### `ToggleChecklist`
```
PATCH /bids/:id/checklists/:cid
Permission: bid.edit
Body: { "is_done": true }
```
Marks a checklist item done (records actor + timestamp) or undone (clears actor + timestamp). Returns the updated item.

---

### `internal/bid/handler/routes.go`

Two routes added under the `/bids` group:

```go
bids.GET("/:id/checklists",        authMiddleware.RequirePermission("bid.view"), handler.GetChecklists)
bids.PATCH("/:id/checklists/:cid", authMiddleware.RequirePermission("bid.edit"), handler.ToggleChecklist)
```

---

## API Changes Summary

### `POST /api/v1/bids` — updated request body

```json
{
  "title": "Supply of Laptops",
  "creation_mode": "MANUAL",
  "bid_owner_id": "uuid-of-owner",
  "technical_manager_id": "uuid-of-tech-manager",
  "checklists": [
    "Upload EMD Receipt",
    "Submit Qualification Documents",
    "OEM Authorization Letter"
  ]
}
```

- `technical_manager_id` — optional, UUID of the technical manager
- `checklists` — optional array of strings; each becomes a checklist item seeded on creation

---

### `GET /api/v1/bids/:id` — updated response

```json
{
  "id": "bid-uuid",
  "title": "Supply of Laptops",
  "bid_owner": { "id": "uuid", "full_name": "Rahul Sharma", "username": "rahul" },
  "technical_manager": { "id": "uuid", "full_name": "Priya Singh", "username": "priya" },
  "checklists": [
    {
      "id": "cl-uuid-1",
      "title": "Upload EMD Receipt",
      "is_done": true,
      "done_by": { "id": "uuid", "full_name": "Rahul Sharma", "username": "rahul" },
      "done_at": "2026-06-17T10:30:00Z",
      "sort_order": 0,
      "created_at": "2026-06-17T09:00:00Z"
    },
    {
      "id": "cl-uuid-2",
      "title": "Submit Qualification Documents",
      "is_done": false,
      "done_by": null,
      "done_at": null,
      "sort_order": 1,
      "created_at": "2026-06-17T09:00:00Z"
    }
  ]
}
```

---

### `GET /api/v1/bids/:id/checklists`

Returns the same `checklists[]` array as above, standalone.

---

### `PATCH /api/v1/bids/:id/checklists/:cid`

**Request:**
```json
{ "is_done": true }
```

**Response:**
```json
{
  "success": true,
  "message": "Checklist updated",
  "data": {
    "id": "cl-uuid-1",
    "title": "Upload EMD Receipt",
    "is_done": true,
    "done_by": { "id": "uuid", "full_name": "Rahul Sharma", "username": "rahul" },
    "done_at": "2026-06-17T10:30:00Z",
    "sort_order": 0,
    "created_at": "2026-06-17T09:00:00Z"
  }
}
```

---

### `PATCH /api/v1/bids/:id` — newly updatable fields

These fields were previously missing from `UpdateBidRequest` and are now fully supported:

| Field | Type | Description |
|---|---|---|
| `technical_manager_id` | `string` (UUID) | Assign or change technical manager |
| `tech_compliance_status` | `string` | e.g. `COMPLIANT`, `NON_COMPLIANT`, `PENDING` |
| `qualification_status` | `string` | e.g. `QUALIFIED`, `DISQUALIFIED`, `PENDING` |

---

## What Was Not Changed

- `task.*` schema and all task module files — untouched
- Auth and user modules — untouched
- Migrations 000001–000006 — untouched
- No changes to `main.go` — `BidHandler` and `BidService` wiring is unchanged
