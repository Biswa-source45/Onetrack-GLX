# OneTrack (GlobX) — System Architecture, Role Access Control (RBAC) & Application Flow Guide

> **Presentation Reference Guide for Team Training & Operations**  
> *Deployment URL:* `http://192.168.1.8/`  
> *System Version:* OneTrack v1.0 Enterprise  

---

## Executive Summary

**OneTrack** is an enterprise-grade GeM (Government e-Marketplace) and public e-Procurement tender management application. It streamlines the complete lifecycle of government and enterprise bids—from discovery, qualification, OEM coordination, commercial costing, internal reviews, portal submission, to reverse auction (RA) and final win/loss analysis.

---

## 1. System Architecture Overview

```
                          ┌───────────────────────────┐
                          │   Frontend Browser Client │
                          │   http://192.168.1.8/     │
                          └─────────────┬─────────────┘
                                        │ (HTTP / Port 80)
                                        ▼
                          ┌───────────────────────────┐
                          │    Nginx Web Reverse Proxy │
                          └─────────────┬─────────────┘
                                        │
                 ┌──────────────────────┴──────────────────────┐
                 ▼                                             ▼
  ┌─────────────────────────────┐               ┌─────────────────────────────┐
  │ React Single Page App (SPA) │               │   Go REST API Backend       │
  │ (Dashboard, Bids, Admin)    │               │   (Port 8080)               │
  └─────────────────────────────┘               └──────────────┬──────────────┘
                                                               │
                                       ┌───────────────────────┴───────────────────────┐
                                       ▼                                               ▼
                        ┌──────────────────────────────┐                ┌──────────────────────────────┐
                        │   PostgreSQL Database        │                │   Redis Cache / Session      │
                        │   (Auth, Bids, Tasks, Seed)  │                │   (JWT Token Blacklisting)   │
                        └──────────────────────────────┘                └──────────────────────────────┘
```

---

## 2. Role & Access Control (RBAC) Deep-Dive

OneTrack uses a **Role-Based Access Control (RBAC)** architecture combined with **Granular Permission Overrides** (`resource.action` format).

### 2.1 The 8 System Roles & Responsibilities

| Role | Role Name | Primary Responsibility & Purpose | System Role? |
| :--- | :--- | :--- | :---: |
| 🛡️ | **`SUPER_ADMIN`** | Full system control, technical administration, system settings, database management. | Yes |
| 🔑 | **`ADMIN`** | User management, role assignments, user activation/deactivation, high-level operational oversight. | Yes |
| 📋 | **`BID_MANAGER`** | Manages the full bid workspace pipeline, creates bids, assigns teams, tracks stage progression. | No |
| 👤 | **`BID_OWNER`** | Assigned owner of specific tenders; leads document compilation, task execution, and milestone tracking. | No |
| 🔍 | **`REVIEWER`** | Technical & compliance reviewer; verifies qualification criteria, documents, and compliance notes. | No |
| 💰 | **`FINANCE`** | Commercial specialist; manages cost sheets, EMD details, Bank Guarantees (BG), quotations, and pricing. | No |
| 👔 | **`MANAGEMENT`** | Strategic executive oversight; reviews margins, gives final bid approvals, overrides pipeline stage locks. | No |
| ⚙️ | **`OPERATOR`** | Day-to-day execution worker; uploads documents, completes assigned checklists/subtasks, logs activities. | No |

---

### 2.2 Key Question Breakdown: Who Can Do What?

#### ❓ Q1: Who can create a Bid / Tender?
* **Authorized Roles:** `SUPER_ADMIN`, `ADMIN`, `BID_MANAGER`, `BID_OWNER`.
* **Required Permission:** `bid.create`
* **How it works:** In the UI, clicking **"+ Add Tender"** allows creating bids manually or via bulk upload. The creator designates the **Bid Owner** during creation.

#### ❓ Q2: Who manages Users (Create, Edit Roles, Reset Passwords, Deactivate)?
* **Authorized Roles:** `SUPER_ADMIN`, `ADMIN`.
* **Required Permissions:** `user.create`, `user.edit`, `user.deactivate`, `user.assign_role`
* **How it works:** Under the **User Management** admin panel, admins can:
  1. Create new employee accounts (sets mandatory temporary password change on first login).
  2. Assign or change user roles.
  3. Apply granular **Allow/Deny** permission overrides per user.
  4. Force reset user passwords.
  5. Activate or deactivate accounts.

#### ❓ Q3: Who can select/assign the Bid Owner?
* **Authorized Roles:** `SUPER_ADMIN`, `ADMIN`, `BID_MANAGER`.
* **Required Permissions:** `bid.create`, `bid.assign`, `bid.edit`
* **How it works:** During bid creation or editing in `AddTenderPage` / `EditTenderDialog`, a dropdown populates active team members. The Bid Manager selects who will own and drive the bid.

#### ❓ Q4: Who can add Bid Workspace Members & Assign Roles inside a Bid?
* **Authorized Roles:** `SUPER_ADMIN`, `ADMIN`, `BID_MANAGER`, `BID_OWNER`.
* **Required Permissions:** `bid.edit`
* **Workspace Member Roles Available:**
  * `OWNER`: Full control of the workspace.
  * `MANAGER`: Manages tasks and stage progression.
  * `MEMBER`: General contributor working on tasks.
  * `REVIEWER`: Verifies compliance and technical accuracy.
  * `OBSERVER`: Read-only stakeholder monitoring progress.

#### ❓ Q5: Who can manage Tasks and Checklists?
* **Create/Assign Tasks:** `SUPER_ADMIN`, `ADMIN`, `BID_MANAGER`, `BID_OWNER`, `OPERATOR` (`task.create`, `task.assign`).
* **Complete Tasks/Checklists:** Assigned team members, `OPERATOR`, `REVIEWER`, `FINANCE` (`task.complete`, `task.edit`).

#### ❓ Q6: Who approves Quotations & Costing?
* **Costing & Quotation Creation:** `FINANCE`, `BID_MANAGER`, `BID_OWNER` (`quotation.create`, `costing.edit`).
* **Approval & Locking:** `FINANCE`, `MANAGEMENT`, `SUPER_ADMIN` (`quotation.approve`, `quotation.lock`).

---

### 2.3 Master Permission Matrix

| Resource & Action | Super Admin | Admin | Bid Manager | Bid Owner | Reviewer | Finance | Management | Operator |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `bid.create` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `bid.view` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `bid.edit` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| `bid.delete` (Archive) | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `bid.assign` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `task.create` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `task.view` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `task.edit` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| `task.assign` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| `task.complete` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| `document.upload` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| `document.view` | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| `qualification.view` | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ |
| `qualification.approve`| ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ |
| `quotation.create/edit`| ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| `quotation.approve/lock`| ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ | ❌ |
| `costing.view/edit` | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ |
| `workflow.transition` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `workflow.override` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| `user.manage` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `analytics.view` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## 3. End-to-End Application Workflow (Step-by-Step)

The lifecycle of a tender in OneTrack consists of **8 core operational stages**:

```
 ┌────────────────┐      ┌─────────────────────┐      ┌─────────────────────────┐
 │ 1. USER SETUP  ├─────►│ 2. TENDER CREATION  ├─────►│ 3. QUALIFICATION REVIEW │
 │  (Admin/HR)    │      │ (Manager/Owner)     │      │ (Reviewer/Owner)        │
 └────────────────┘      └─────────────────────┘      └────────────┬────────────┘
                                                                   │
 ┌────────────────┐      ┌─────────────────────┐                   ▼
 │ 6. SUBMISSION  │◄─────┤ 5. MGMT APPROVAL    │◄─────┌─────────────────────────┐
 │ (Portal Ops)   │      │ (Management/Finance)│      │ 4. COSTING & OEM MAF    │
 └───────┬────────┘      └─────────────────────┘      │ (Finance/Operator)      │
         │                                            └─────────────────────────┘
         ▼
 ┌────────────────┐      ┌─────────────────────┐
 │ 7. RA AUCTION  ├─────►│ 8. OUTCOME & WIN/LOSS│
 │ (Live Bidding) │      │ (Analytics & Audit) │
 └────────────────┘      └─────────────────────┘
```

---

### Step 1: Account & Team Provisioning
* **Who:** `ADMIN` or `SUPER_ADMIN`.
* **Action:**
  1. Admin opens **User Management**.
  2. Creates accounts for team members (e.g. Bid Owners, Finance Leads, Reviewers).
  3. Assigns roles (`BID_MANAGER`, `FINANCE`, etc.).
  4. System generates temporary credentials (`force_password_change = true`).
  5. User logs in at `http://192.168.1.8/` and updates their password.

---

### Step 2: Tender Discovery & Workspace Initialization
* **Who:** `BID_MANAGER` or `BID_OWNER`.
* **Action:**
  1. Click **"+ Add Tender"**.
  2. Fill tender details:
     * Title (e.g. *Supply of Enterprise Switches — NIC*)
     * GeM Bid No (e.g. `GEM/2026/B/987654`)
     * Organization & Department Name
     * Portal Source (`GeM`, `CPPP`, `eProcure`)
     * Estimated Tender Value & EMD Amount / Type
     * Opening & Closing Deadlines
     * OEM MAF Requirement (`Yes/No`)
  3. Select **Bid Owner** and **Technical Manager**.
  4. Pre-populate initial checklists (EMD, MAF, Compliance).
  5. Bid enters stage: **`DISCOVERED`**.

---

### Step 3: Qualification Review & Document Checklists
* **Who:** `BID_OWNER`, `REVIEWER`, `OPERATOR`.
* **Action:**
  1. Transition bid stage to **`QUALIFICATION_REVIEW`**.
  2. Workspace automatically provides subtask checklists:
     * Check turnover requirements.
     * Verify past experience certificates.
     * Confirm OEM partnership level.
  3. Assigned team members upload certificates & proof documents.
  4. Reviewer approves qualification status (**`QUALIFIED`**).

---

### Step 4: OEM Coordination & Commercial Costing
* **Who:** `BID_OWNER`, `OPERATOR`, `FINANCE`.
* **Action:**
  1. Transition stage to **`OEM_COORDINATION`** & **`COMMERCIAL_PREPARATION`**.
  2. **OEM Coordination:** Request Manufacturer Authorization Form (MAF) & OEM pricing support from partners (e.g. Cisco, HP).
  3. **Finance & Costing:**
     * Deposit EMD / Generate Bank Guarantee (BG).
     * Calculate internal cost estimate, margins, and taxes.
     * Draft final quotation.

---

### Step 5: Internal Review & Management Final Approval
* **Who:** `REVIEWER`, `FINANCE`, `MANAGEMENT`.
* **Action:**
  1. Transition stage to **`INTERNAL_REVIEW`** then **`FINAL_APPROVAL`**.
  2. Management reviews:
     * Technical compliance report.
     * Financial margins & BG risk.
     * Competitive landscape.
  3. Management approves and locks the final quotation (`quotation.lock`).
  4. Bid stage updated to **`READY_FOR_SUBMISSION`**.

---

### Step 6: Portal Submission on GeM / CPPP
* **Who:** `BID_OWNER` or `OPERATOR`.
* **Action:**
  1. Download compiled document bundle from OneTrack.
  2. Upload bid on government portal (GeM / CPPP) before closing deadline.
  3. Mark bid as **`SUBMITTED`** in OneTrack and record exact submission timestamp.

---

### Step 7: Reverse Auction (RA) & Technical Evaluation
* **Who:** `BID_OWNER`, `MANAGEMENT`.
* **Action:**
  1. If technical evaluation opens, track query responses in Task Manager.
  2. If GeM triggers Reverse Auction (RA):
     * Move stage to **`RA_ACTIVE`**.
     * Monitor live pricing floor approved by Management.

---

### Step 8: Outcome Recording & Analytics
* **Who:** `BID_MANAGER`, `MANAGEMENT`.
* **Action:**
  1. When results are announced on portal, click **"Record Outcome"**.
  2. Input:
     * **Outcome:** `WON`, `LOST`, or `CANCELLED`.
     * **Final Quoted Price** & **L1 Winner Price**.
     * **Competitor Information** (Names, ranks L1, L2, L3, prices).
     * **Outcome Reason** (e.g. *L1 Winner, OEM MAF accepted* or *Disqualified due to turnover clause*).
  3. System automatically calculates Win/Loss conversion rates, average contract size, and team performance metrics on the Analytics Dashboard.

---

## 4. Key UI Sections Reference

1. **Dashboard (`/`)**: High-level overview of active bids, upcoming submission deadlines, win/loss stats, total pipeline value.
2. **Tenders Workspace (`/tenders`)**: Filterable, searchable table & Kanban views for all bids, workflow stages, closing dates, and owners.
3. **Tender Detail View (`/tenders/:id`)**: Full 360-degree workspace for a specific bid containing:
   * **Overview:** Tender metadata, deadlines, OEM details.
   * **Checklist & Tasks:** Action items, assigned subtasks, activities timeline.
   * **Documents:** Uploaded tender specs, MAFs, EMD receipts.
   * **Team Members:** Workspace role assignments.
   * **Stage History:** Audit log of every workflow movement.
4. **Task Manager (`/tasks`)**: Cross-bid dashboard showing "My Assigned Tasks" sorted by urgency.
5. **User Management (`/admin/users`)**: Admin panel for user accounts, role management, and permission overrides.

---

## 5. Team Presentation Cheat Sheet (Quick Answers)

| Question | Team Answer |
| :--- | :--- |
| **Where do we access it?** | Open browser to `http://192.168.1.8/` |
| **Default Admin Login?** | Username: `admin` \| Password set during setup (forces change on first login) |
| **Who handles GeM Bid Numbers?** | The Bid Creator/Owner inputs the GeM Bid No (`GEM/2026/B/XXXXX`) when adding a tender. |
| **Can one person have multiple roles?** | Yes, users can be assigned multiple roles, and admins can grant specific permission overrides. |
| **How are tasks organized?** | Every task is tied to a specific Tender Workspace and can have subtasks and interactive checklists. |
| **Is history tracked?** | Yes, every stage transition, status change, and comment is logged in an immutable audit timeline. |

---
*Report generated for team onboarding & operational reference.*
