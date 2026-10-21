# Graph Report - Onetrack-GlobX  (2026-10-08)

## Corpus Check
- 287 files · ~345,785 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 11 file(s) not represented in the graph (top: (none) 5, .exe 2, .css 2)

## Summary
- 2905 nodes · 8221 edges · 130 communities (102 shown, 28 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 156 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `37987f35`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- importer.go
- github.com/jackc/pgx/v5/pgxpool.Pool
- context.Context
- mockCalendarRepo
- cn
- Landing.jsx
- TicketResponse
- TendersPage.jsx
- react
- time.Time
- Endpoints
- testing.T
- FeedbackPage.jsx
- Alert
- emd_service.go
- Endpoints
- github.com/gin-gonic/gin.Context
- App.jsx
- bid_service.go
- systemlog/domain/models.go
- WorkingCalendarPage.jsx
- userService
- Files Changed
- encoding/json.RawMessage
- bidService
- emd_models.go
- authService
- BidService
- dependencies
- go_pkg_errors
- package.json
- calendar/domain/models.go
- components.json
- StageWorkspaces.jsx
- JWTService
- go_pkg_strings
- BulkImportPage.jsx
- CreateUserSheet
- EmdDetailsDialog.jsx
- go_pkg_log
- EditTenderDialog.jsx
- LedgerRow
- diffBidFields
- Browser Session Management
- Lead
- devDependencies
- updateUserProfile
- Storage Management
- fakeBidRepo
- scripts
- .TransitionStage
- TenderDetailPage.jsx
- compilerOptions
- Test generation (plan → generate → heal)
- Tracing
- github.com/onetrack/backend
- server/main.go
- CLAUDE.md
- .claude/CLAUDE.md
- ledgerTheme.js
- apiFetch
- .applyUpdate
- config.go
- PART 2 — TASK MANAGEMENT APIs
- OneTrack GlobX — API Documentation
- Deployment Readiness & Runbook — Bulk Import Fix Release
- go_pkg_github_com_onetrack_backend_internal_bid_domain
- 6. Tenders (Bid Workspaces) — `/api/v1/bids`
- go_pkg_github_com_onetrack_backend_internal_user_domain
- BidWorkspace
- PART 1 — BID WORKSPACE APIs
- Browser Automation with playwright-cli
- go_pkg_github_com_onetrack_backend_internal_bid_repository
- Running Custom Playwright Code
- PART 2B — TYPED TASK APIs
- Product
- API_DOCS_BID.md
- 4. Users & Profile — `/api/v1/users`
- SKILL.md
- 9. Feedback Tickets — `/api/v1/tickets`
- LeadDetailPage.jsx
- 7. Leads — `/api/v1/leads`
- 1. Getting started
- AuditLogQuery
- 3. Auth — `/api/v1/auth`
- 8. Alerts — `/api/v1/alerts`
- Commands
- 12. Appendix: enums and reference values
- Actor
- 6.7 Edit approvals
- Cookies
- Video Recording
- 6.12 Helpers: Field Memory, pricing hint, performance matrix
- 6.9 History and audit
- Components
- PipelineConstellation.jsx
- Advanced Mocking with run-code
- Local Storage
- 3. Heal
- POST /api/v1/bids/{id}/transition
- go_pkg_github_com_onetrack_backend_internal_calendar_handler
- go_pkg_github_com_onetrack_backend_internal_calendar_repository
- POST /api/v1/bids
- POST /api/v1/tasks/{id}/activities
- PrimaryButton
- vite.config.js
- POST /api/v1/tasks/{id}/approve
- POST /api/v1/tasks/{id}/oem-followup
- POST /api/v1/bids/{id}/tasks/document
- POST /api/v1/bids/{id}/tasks
- React + Vite
- PendingApprovalError
- go_pkg_github_com_onetrack_backend_internal_alert_handler
- go_pkg_github_com_onetrack_backend_internal_alert_repository
- go_pkg_github_com_onetrack_backend_internal_alert_service
- go_pkg_github_com_onetrack_backend_internal_auth_handler
- go_pkg_github_com_onetrack_backend_internal_auth_repository
- go_pkg_github_com_onetrack_backend_internal_feedback_handler
- go_pkg_github_com_onetrack_backend_internal_feedback_repository
- go_pkg_github_com_onetrack_backend_internal_lead_handler
- go_pkg_github_com_onetrack_backend_internal_lead_repository
- go_pkg_github_com_onetrack_backend_internal_platform_database
- go_pkg_github_com_onetrack_backend_internal_systemconfig_handler
- go_pkg_github_com_onetrack_backend_internal_systemconfig_repository
- go_pkg_github_com_onetrack_backend_internal_systemconfig_service
- go_pkg_github_com_onetrack_backend_internal_systemlog_handler
- go_pkg_github_com_onetrack_backend_internal_systemlog_repository
- go_pkg_github_com_onetrack_backend_internal_systemlog_service
- go_pkg_github_com_onetrack_backend_internal_user_handler
- go_pkg_github_com_onetrack_backend_internal_user_repository

## God Nodes (most connected - your core abstractions)
1. `cn()` - 95 edges
2. `Success()` - 85 edges
3. `apiFetch()` - 83 edges
4. `react` - 76 edges
5. `lucide-react` - 60 edges
6. `bidService` - 59 edges
7. `fakeBidRepo` - 59 edges
8. `InternalError()` - 58 edges
9. `BadRequest()` - 57 edges
10. `Button()` - 46 edges

## Surprising Connections (you probably didn't know these)
- `The Ledger Stamp Mark (signature component)` --references--> `LedgerStampMark()`  [INFERRED]
  frontend/DESIGN.md → frontend/src/lib/ledgerMarks.jsx
- `Do:` --references--> `LedgerRow()`  [INFERRED]
  frontend/DESIGN.md → frontend/src/lib/LedgerRow.jsx
- `Hierarchy` --references--> `LedgerRow()`  [INFERRED]
  frontend/DESIGN.md → frontend/src/lib/LedgerRow.jsx
- `Layout` --references--> `LedgerRow()`  [INFERRED]
  frontend/DESIGN.md → frontend/src/lib/LedgerRow.jsx
- `Named Rules` --references--> `LedgerRow()`  [INFERRED]
  frontend/DESIGN.md → frontend/src/lib/LedgerRow.jsx

## Import Cycles
- None detected.

## Communities (130 total, 28 thin omitted)

### Community 0 - "importer.go"
Cohesion: 0.05
Nodes (94): commit(), connect(), getEnv(), pgx.Conn, main(), printSummary(), summarise(), canonDashboardActivity() (+86 more)

### Community 1 - "github.com/jackc/pgx/v5/pgxpool.Pool"
Cohesion: 0.18
Nodes (10): NewPostgresAuthRepository(), NewPostgresBidRepository(), NewPostgresCalendarRepository(), NewPostgresPool(), Event, postgresRepo, NewPostgresUserRepository(), EnsureDefaultAdmin() (+2 more)

### Community 2 - "context.Context"
Cohesion: 0.04
Nodes (15): AuthRepository, Role, User, UserPermissionOverride, BidRepository, UserSummary, FieldSuggestion, TenderOwnerPerformanceStat (+7 more)

### Community 3 - "mockCalendarRepo"
Cohesion: 0.03
Nodes (21): WorkingCalendarRepository, DefaultIntegration(), CalendarException, GoogleCalendarIntegration, GoogleCalendarSyncLog, Holiday, NextActionableTask, SyncResult (+13 more)

### Community 4 - "cn"
Cohesion: 0.06
Nodes (65): backdropVariants, closeButtonVariants, INITIAL_FORM, panelVariants, ROLE_CONFIG, ROLE_LABELS, RoleBadge(), getHue() (+57 more)

### Community 5 - "Landing.jsx"
Cohesion: 0.09
Nodes (7): DEMO_SHEET_TENDERS, Landing(), MotionLink, ROLES, FaqSection(), InteractiveBoardDemo(), LEDGER_STAGES

### Community 6 - "TicketResponse"
Cohesion: 0.05
Nodes (18): FieldMemory, TicketRepository, TicketService, CreateTicketRequest, ListTicketsParams, Ticket, TicketListPage, TicketResponse (+10 more)

### Community 7 - "TendersPage.jsx"
Cohesion: 0.07
Nodes (53): PermissionGuard(), LeadsPage(), STATUS_FILTERS, TYPE_FILTERS, ExportSuccessDialog(), ImportedPill(), InProgressPill(), COLUMNS (+45 more)

### Community 8 - "react"
Cohesion: 0.09
Nodes (36): brands, keys, ActivityLogDialog(), eventBadge(), INITIAL_FORM, PERMISSION_CATEGORIES, PERMISSION_METADATA, ROLE_DETAILS (+28 more)

### Community 9 - "time.Time"
Cohesion: 0.11
Nodes (20): TenderDeadlineCandidate, RedZoneNotificationResult, TriggerDays(), scanCandidate(), dayDesc(), deref(), fmtNum(), ordinal() (+12 more)

### Community 10 - "Endpoints"
Cohesion: 0.04
Nodes (46): 1. Health Check, 2. Login, 3. Refresh Token, 4. Logout, 5. Change Password, 6. Force Password Reset, Access Token JWT Payload, Admin User (+38 more)

### Community 11 - "testing.T"
Cohesion: 0.06
Nodes (94): strPtr(), extractProductFields(), fieldSuggestionEntries(), NewBidService(), boolPtr(), floatPtr(), hasAlertType(), intPtr() (+86 more)

### Community 12 - "FeedbackPage.jsx"
Cohesion: 0.12
Nodes (27): ALLOWED_IMAGE_TYPES, FeedbackPage(), handleSubmit(), loadMyTickets(), removeImage(), formatDate(), formatWhen(), TicketDetailDialog() (+19 more)

### Community 13 - "Alert"
Cohesion: 0.06
Nodes (12): Alert, AlertRepository, AlertService, SafeLink(), TestSafeLink(), NewAlertHandler(), NewPostgresAlertRepository(), fakeAlertSvc (+4 more)

### Community 14 - "emd_service.go"
Cohesion: 0.24
Nodes (13): MDDecisionRequest, TenderEMDResponse, emdForbidden(), emdInvalid(), emdIsApproved(), emdIsPaid(), isAdminRole(), isFinanceOrAdmin() (+5 more)

### Community 15 - "Endpoints"
Cohesion: 0.05
Nodes (39): 1. Create User, 2. List Users, 3. Get My Profile, 4. Get User by ID, 5. Update User Profile, 6. Update User Status (Activate/Deactivate), 7. Update User Roles, 8. Update Permission Overrides (+31 more)

### Community 16 - "github.com/gin-gonic/gin.Context"
Cohesion: 0.05
Nodes (40): extractTokenFromHeader(), actorRoles(), BidHandler, mapServiceError(), saveReceiptFile(), validateReceiptUpload(), parseIntQuery(), actorPtr() (+32 more)

### Community 17 - "App.jsx"
Cohesion: 0.09
Nodes (31): App(), useDebounce(), UserManagement(), AnalyticsPage(), CATEGORY_COLORS, ROLE_BADGES, STAGE_COLORS, STAGE_LABELS (+23 more)

### Community 18 - "bid_service.go"
Cohesion: 0.09
Nodes (26): deref(), fmtDate(), fmtNum(), writeReport(), PricingSuggestion, pickL1PricingQuote(), PricingDeal, SetStageRestrictionsRequest (+18 more)

### Community 19 - "systemlog/domain/models.go"
Cohesion: 0.14
Nodes (15): NewAuthService(), NewWorkingCalendarService(), Repository, Service, EventItem, ListQuery, Page, Handler (+7 more)

### Community 20 - "WorkingCalendarPage.jsx"
Cohesion: 0.09
Nodes (52): CURRENT_YEAR, DEADLINE_PRESETS, EMPTY_HOLIDAY_FORM, INTERVAL_PRESETS, LEGEND, listFrom(), SATURDAYS, WorkingCalendarPage() (+44 more)

### Community 21 - "userService"
Cohesion: 0.11
Nodes (11): UserService, CreateUserRequest, UpdatePermissionsRequest, UpdateRolesRequest, UpdateStatusRequest, UpdateUserRequest, UserListResponse, UserResponse (+3 more)

### Community 22 - "Files Changed"
Cohesion: 0.09
Nodes (22): 1. New column on `bid.bid_workspaces`, 2. New table `bid.bid_checklists`, API Changes Summary, Changes, Database Migration, Files Changed, `GET /api/v1/bids/:id/checklists`, `GET /api/v1/bids/:id` — updated response (+14 more)

### Community 23 - "encoding/json.RawMessage"
Cohesion: 0.13
Nodes (11): Repository, Service, SystemConfig, NewHandler(), postgresRepo, NewPostgresRepository(), service, NewService() (+3 more)

### Community 24 - "bidService"
Cohesion: 0.20
Nodes (4): approverDisplayName(), authorizeEditDecision(), needsRMApproval(), bidService

### Community 25 - "emd_models.go"
Cohesion: 0.13
Nodes (13): RecordEMDPaymentRequest, SubmitMDApprovalRequest, TenderEMDAuditLog, TenderEMDDetails, UpdateBasicEMDRequest, UpdateEMDRefundRequest, VerifyEMDPaymentRequest, postgresBidRepo (+5 more)

### Community 26 - "authService"
Cohesion: 0.12
Nodes (8): AuthService, ChangePasswordRequest, ForceResetRequest, LoginRequest, LoginResponse, NewAuthHandler(), UserInfo, authService

### Community 27 - "BidService"
Cohesion: 0.06
Nodes (19): BidService, AddChecklistRequest, AddMemberRequest, BidChecklistItem, BidListItem, BidListResponse, BidResponse, ListBidsParams (+11 more)

### Community 28 - "dependencies"
Cohesion: 0.08
Nodes (25): dependencies, canvas-confetti, class-variance-authority, clsx, exceljs, @fontsource-variable/instrument-sans, @fontsource-variable/inter, framer-motion (+17 more)

### Community 29 - "go_pkg_errors"
Cohesion: 0.13
Nodes (23): TestValidateImageUpload(), validateImageUpload(), FolderSlug(), safeName(), strp(), TestFolderSlugAndSafeName(), TestNormalize(), TestValidateDocument() (+15 more)

### Community 30 - "package.json"
Cohesion: 0.09
Nodes (23): name, private, type, version, canvas-confetti, clsx, eslint, @eslint/js (+15 more)

### Community 31 - "calendar/domain/models.go"
Cohesion: 0.09
Nodes (20): GoogleSyncService, WorkingCalendarService, CalculateDeadlineResult, EvaluationSummary, isRealAPIKey(), NewCalendarHandler(), TestIsRealAPIKeyRejectsPlaceholders(), NewGoogleSyncService() (+12 more)

### Community 32 - "components.json"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 33 - "StageWorkspaces.jsx"
Cohesion: 0.09
Nodes (59): ExcludeRoleGuard(), RoleGuard(), AssignPresalesModal(), buildEmdDetailsTableHtml(), buildPresalesCands(), buildRemarkCalloutHtml(), buildTenderDetailHtml(), buildValuesAdjustedBannerHtml() (+51 more)

### Community 34 - "JWTService"
Cohesion: 0.18
Nodes (6): JWTService, TokenClaims, TokenPair, redis.Client, NewJWTService(), jwtService

### Community 35 - "go_pkg_strings"
Cohesion: 0.17
Nodes (12): ForgotPasswordRequest, Permission, RefreshRequest, ResetPasswordOTPRequest, VerifyOTPRequest, go_pkg_crypto_sha256, go_pkg_github_com_golang_jwt_jwt_v5, go_pkg_golang_org_x_crypto_bcrypt (+4 more)

### Community 36 - "BulkImportPage.jsx"
Cohesion: 0.19
Nodes (13): BulkImportPage(), handleCommit(), handleFile(), FORMATS, STAGE_LABELS, STAGE_ORDER, ImportConsole(), PREFIX (+5 more)

### Community 37 - "CreateUserSheet"
Cohesion: 0.16
Nodes (12): CreateUserDialog(), handleClose(), handleSubmit(), resetForm(), validate(), CreateUserSheet(), handleSubmit(), onKeyDown() (+4 more)

### Community 38 - "EmdDetailsDialog.jsx"
Cohesion: 0.13
Nodes (29): EmdApprovalDialog(), EmdAuditDialog(), fmtDate(), EmdDetailsDialog(), fmtDate(), SECTIONS, EmdLifecycleCard(), parsePaymentDetails() (+21 more)

### Community 39 - "go_pkg_log"
Cohesion: 0.10
Nodes (23): boolOr(), env(), fmtF(), main(), strOr(), env(), main(), printSection() (+15 more)

### Community 40 - "EditTenderDialog.jsx"
Cohesion: 0.09
Nodes (41): STATUS_OPTIONS, AddTenderDialog(), BID_TYPES, EMD_TYPES, PORTAL_SOURCES, useMacOSDialog(), BIDDER_SUGGESTIONS, OEM_SUGGESTIONS (+33 more)

### Community 41 - "LedgerRow"
Cohesion: 0.12
Nodes (20): Colors, Deep Panel (login left panel only), Design System: OneTrack — The Ledger, Do:, Do's and Don'ts, Don't:, Elevation & Depth, Hierarchy (+12 more)

### Community 42 - "diffBidFields"
Cohesion: 0.29
Nodes (9): FieldDiff, derefFloat(), derefInt(), derefStr(), diffBidFields(), diffDateField(), diffField(), diffRequestFields() (+1 more)

### Community 43 - "Browser Session Management"
Cohesion: 0.10
Nodes (20): 1. Name Browser Sessions Semantically, 2. Always Clean Up, 3. Delete Stale Browser Data, A/B Testing Sessions, Attach by channel name, Attach via browser extension, Attach via CDP endpoint, Attaching to a Running Browser (+12 more)

### Community 44 - "Lead"
Cohesion: 0.11
Nodes (13): CreateLeadRequest, Document, Lead, NewLeadHandler(), approverID(), detailsHTML(), leadName(), managerID() (+5 more)

### Community 45 - "devDependencies"
Cohesion: 0.20
Nodes (10): devDependencies, eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals, @types/react, @types/react-dom (+2 more)

### Community 46 - "updateUserProfile"
Cohesion: 0.43
Nodes (6): EditUserDialog(), handleClose(), handleSubmit(), UserProfileModal(), handleSaveProfile(), updateUserProfile()

### Community 47 - "Storage Management"
Cohesion: 0.11
Nodes (18): Authentication State Reuse, Clear sessionStorage, Common Patterns, Delete Database, Delete Single Item, Get Single Value, IndexedDB, List All sessionStorage Items (+10 more)

### Community 48 - "fakeBidRepo"
Cohesion: 0.03
Nodes (18): PricingWorkspaceRow, BidChecklist, BidStageHistory, CompetitorInfo, CreateBidParams, IdentifierMatch, PendingApproval, RecordOutcomeRequest (+10 more)

### Community 49 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, lint, preview

### Community 50 - ".TransitionStage"
Cohesion: 0.31
Nodes (7): TransitionResult, TransitionStageRequest, getRoleForStage(), GetAllowedTransitions(), IsTerminalStage(), IsTransitionAllowed(), skipEMDStage()

### Community 51 - "TenderDetailPage.jsx"
Cohesion: 0.05
Nodes (67): applyAlertNote(), EditTenderDialog(), handleSubmit(), loadFullBid(), validate(), fieldDiffLabel(), inputCls(), parseRequestedProducts() (+59 more)

### Community 52 - "compilerOptions"
Cohesion: 0.50
Nodes (3): compilerOptions, baseUrl, paths

### Community 53 - "Test generation (plan → generate → heal)"
Cohesion: 0.12
Nodes (17): 0. How generation works, 1.1 Prerequisite: workspace, 1.2 Prerequisite: seed test, 1.3 Explore the app, 1.4 Write the spec file, 1. Planning, 2.1 Inputs, 2.2 Generate one scenario (+9 more)

### Community 54 - "Tracing"
Cohesion: 0.12
Nodes (16): 1. Start Tracing Before the Problem, 2. Clean Up Old Traces, Analyzing Performance, Basic Usage, Best Practices, Capturing Evidence, Debugging Failed Actions, Limitations (+8 more)

### Community 56 - "server/main.go"
Cohesion: 0.12
Nodes (24): main(), RegisterAlertRoutes(), RegisterAuthRoutes(), NewBulkImportHandler(), RegisterBidRoutes(), RegisterCalendarRoutes(), RegisterTicketRoutes(), RegisterLeadRoutes() (+16 more)

### Community 59 - "ledgerTheme.js"
Cohesion: 0.26
Nodes (7): Login(), LedgerStampMark(), ledger, ledgerFont, BUILDINGS, LoginSkyline(), authService

### Community 60 - "apiFetch"
Cohesion: 0.05
Nodes (58): RolesPermissionsDialog(), handleClose(), handleSave(), SettingsPage(), StageAccessDialog(), handleClose(), handleSave(), CATEGORY_CLASSES (+50 more)

### Community 61 - ".applyUpdate"
Cohesion: 0.10
Nodes (17): ApprovalLink(), StageLink(), TenderLink(), CreateBidRequest, UpdateBidRequest, alertNoteHTML(), diffRowsHTML(), fieldLabel() (+9 more)

### Community 62 - "config.go"
Cohesion: 0.15
Nodes (17): NewAlertService(), getEnv(), DatabaseConfig, EmailConfig, JWTConfig, RedisConfig, Load(), EmailService (+9 more)

### Community 63 - "PART 2 — TASK MANAGEMENT APIs"
Cohesion: 0.12
Nodes (16): Auto-Activity Logged, DELETE /api/v1/tasks/{id}, DELETE /api/v1/tasks/{id}/checklists/{checklist_id}, GET /api/v1/bids/{id}/tasks, GET /api/v1/tasks/{id}, GET /api/v1/tasks/{id}/activities, GET /api/v1/tasks/{id}/subtasks, PART 2 — TASK MANAGEMENT APIs (+8 more)

### Community 64 - "OneTrack GlobX — API Documentation"
Cohesion: 0.13
Nodes (14): 10.1 `GET /system/config`, 10.2 `GET /system/config/:key`, 10.3 `PUT /system/config/:key`, 10. System Configuration — `/api/v1/system/config`, 11.1 `GET /system-logs`, 11. System Logs — `/api/v1/system-logs`, 13. Appendix: endpoint index, 2.1 `GET /health` (+6 more)

### Community 65 - "Deployment Readiness & Runbook — Bulk Import Fix Release"
Cohesion: 0.13
Nodes (14): 0. Before you touch anything, 10. Rollback plan, 1. Back up the host database first, 2. Audit the host database, 3. Push and let the pipeline build, 4. Deploy to the host, 5. Verify migrations actually ran, 6. Confirm the service is healthy (+6 more)

### Community 67 - "6. Tenders (Bid Workspaces) — `/api/v1/bids`"
Cohesion: 0.13
Nodes (15): 6.10 Workspace members, 6.11 Checklists, 6.13 `PATCH /bids/:id/outcome` — record outcome, 6.14 Tender Bin, 6.15 `POST /bids/bulk-import` — Excel import, 6.1 Typical lifecycle (step by step), 6.2 `POST /bids` — create tender, 6.3 `GET /bids` — list tenders (+7 more)

### Community 69 - "BidWorkspace"
Cohesion: 0.24
Nodes (10): BidWorkspace, scanBid(), scanBidFields(), scanBidFromRows(), defaultEMD(), emdAmount(), emdView(), exemptEMDView() (+2 more)

### Community 70 - "PART 1 — BID WORKSPACE APIs"
Cohesion: 0.14
Nodes (14): Creation Mode Philosophy, DELETE /api/v1/bids/{id}, DELETE /api/v1/bids/{id}/members/{user_id}, Example Response, GET /api/v1/bids, GET /api/v1/bids/{id}, GET /api/v1/bids/{id}/stage-history, PART 1 — BID WORKSPACE APIs (+6 more)

### Community 71 - "Browser Automation with playwright-cli"
Cohesion: 0.14
Nodes (14): Browser Automation with playwright-cli, Browser Sessions, Example: Debugging with DevTools, Example: Form submission, Example: Interactive session, Example: Multi-tab workflow, Installation, Open parameters (+6 more)

### Community 73 - "Running Custom Playwright Code"
Cohesion: 0.15
Nodes (13): Clipboard, Complex Workflows, Error Handling, File Downloads, Frames and Iframes, Geolocation, JavaScript Execution, Media Emulation (+5 more)

### Community 74 - "PART 2B — TYPED TASK APIs"
Cohesion: 0.17
Nodes (12): Completion Guard, Completion Guard, GET /api/v1/me/tasks, PART 2B — TYPED TASK APIs, POST /api/v1/bids/{id}/tasks/approval, POST /api/v1/bids/{id}/tasks/oem, Query Parameters, Request (+4 more)

### Community 75 - "Product"
Cohesion: 0.17
Nodes (11): Accessibility & Inclusion, Brand Commitments, Capabilities and Constraints, Evidence on Hand, Operating Context, Platform, Positioning, Product (+3 more)

### Community 76 - "API_DOCS_BID.md"
Cohesion: 0.18
Nodes (10): Authentication, Base URL, Default Role Access, Error, OneTrack — Bid Workspace & Task Management API Documentation, PART 3 — PERMISSIONS REFERENCE, PART 4 — ERROR CODES REFERENCE, Required Permissions (+2 more)

### Community 77 - "4. Users & Profile — `/api/v1/users`"
Cohesion: 0.18
Nodes (11): 4.1 `GET /users/me`, 4.2 `POST /users`, 4.3 `GET /users`, 4.4 `GET /users/:id`, 4.5 `PATCH /users/:id`, 4.6 `PATCH /users/:id/status`, 4.7 `PATCH /users/:id/roles`, 4.8 `PATCH /users/:id/permissions` (+3 more)

### Community 78 - "SKILL.md"
Cohesion: 0.24
Nodes (4): Examples, Inspecting Element Attributes, Debugging Playwright Tests, Running Playwright Tests

### Community 79 - "9. Feedback Tickets — `/api/v1/tickets`"
Cohesion: 0.20
Nodes (10): 9.1 `POST /tickets` — submit feedback, 9.2 `GET /tickets/mine`, 9.3 `GET /tickets/:id`, 9.4 `GET /tickets/:id/history`, 9.5 `GET /tickets/:id/image`, 9.6 `GET /tickets` — all tickets (triage), 9.7 `GET /tickets/open-count`, 9.8 `PATCH /tickets/:id/status` (+2 more)

### Community 80 - "LeadDetailPage.jsx"
Cohesion: 0.07
Nodes (50): ForceResetDialog(), handleClose(), handleConfirm(), AddLeadPage(), buildPayload(), handleSubmit(), validate(), leadToForm() (+42 more)

### Community 81 - "7. Leads — `/api/v1/leads`"
Cohesion: 0.22
Nodes (9): 7.1 Typical flow (step by step), 7.2 `POST /leads` — create lead, 7.3 `GET /leads` — list leads, 7.4 `GET /leads/:id` — lead detail, 7.5 `POST /leads/:id/documents` — upload one document, 7.6 `GET /leads/:id/documents/:docId` — download, 7.7 `DELETE /leads/:id/documents/:docId`, 7. Leads — `/api/v1/leads` (+1 more)

### Community 82 - "1. Getting started"
Cohesion: 0.25
Nodes (8): 1.1 Base URL, 1.2 Authentication flow (step by step), 1.3 Response envelope, 1.4 Errors and status codes, 1.5 Pagination, 1.6 Data conventions, 1.7 Roles and permissions, 1. Getting started

### Community 83 - "AuditLogQuery"
Cohesion: 0.13
Nodes (12): AddMicroEventRequest, AuditLogPage, AuditLogQuery, GlobalAuditItem, StageHistoryPage, StageHistoryResponse, auditPageSize(), decodeAuditCursor() (+4 more)

### Community 84 - "3. Auth — `/api/v1/auth`"
Cohesion: 0.29
Nodes (7): 3.1 `POST /auth/login`, 3.2 `POST /auth/refresh`, 3.3 `POST /auth/logout`, 3.4 `PATCH /auth/change-password`, 3.5 `PATCH /auth/force-reset`, 3.6 Forgot-password flow (OTP by email), 3. Auth — `/api/v1/auth`

### Community 85 - "8. Alerts — `/api/v1/alerts`"
Cohesion: 0.29
Nodes (7): 8.1 `GET /alerts`, 8.2 `POST /alerts`, 8.3 `PUT /alerts/:id/read`, 8.4 `PUT /alerts/read-all`, 8.5 `DELETE /alerts/:id`, 8. Alerts — `/api/v1/alerts`, Alert object

### Community 86 - "Commands"
Cohesion: 0.20
Nodes (10): Commands, Core, DevTools, Keyboard, Mouse, Navigation, Network, Save as (+2 more)

### Community 87 - "12. Appendix: enums and reference values"
Cohesion: 0.33
Nodes (6): 12.1 Tender workflow stages, 12.2 Tender status values, 12.3 Lead values, 12.4 Preset dropdown values (free text also accepted), 12.5 Feedback categories, 12. Appendix: enums and reference values

### Community 89 - "6.7 Edit approvals"
Cohesion: 0.40
Nodes (5): 6.7 Edit approvals, `GET /bids/:id/pending-edit`, `GET /bids/my-approvals`, `POST /bids/pending-edits/:editId/approve`, `POST /bids/pending-edits/:editId/reject`

### Community 90 - "Cookies"
Cohesion: 0.22
Nodes (9): Advanced: Multiple Cookies or Custom Options, Clear All Cookies, Cookies, Delete a Cookie, Filter Cookies by Domain, Filter Cookies by Path, Get Specific Cookie, List All Cookies (+1 more)

### Community 91 - "Video Recording"
Cohesion: 0.22
Nodes (8): 1. Use Descriptive Filenames, 2. Record entire hero scripts., Basic Recording, Best Practices, Limitations, Overlay API Summary, Tracing vs Video, Video Recording

### Community 92 - "6.12 Helpers: Field Memory, pricing hint, performance matrix"
Cohesion: 0.50
Nodes (4): 6.12 Helpers: Field Memory, pricing hint, performance matrix, `GET /bids/field-suggestions?field=<key>`, `GET /bids/performance-matrix`, `GET /bids/pricing-suggestion?desc=<product description>`

### Community 93 - "6.9 History and audit"
Cohesion: 0.50
Nodes (4): 6.9 History and audit, `GET /bids/audit-history`, `GET /bids/:id/stage-history`, `POST /bids/:id/history`

### Community 94 - "Components"
Cohesion: 0.22
Nodes (9): Buttons, Cards / Containers, Components, Inputs / Fields, Navigation, The Ledger Row (signature component), The Ledger Stamp Mark (signature component), The Login Abstract Panel (signature component) (+1 more)

### Community 95 - "PipelineConstellation.jsx"
Cohesion: 0.25
Nodes (6): ledgerGlow, FLOW_SEGMENTS, NODES, PipelineConstellation(), pt(), TONES

### Community 96 - "Advanced Mocking with run-code"
Cohesion: 0.25
Nodes (8): Advanced Mocking with run-code, CLI Route Commands, Conditional Response Based on Request, Delayed Response, Modify Real Response, Request Mocking, Simulate Network Failures, URL Patterns

### Community 97 - "Local Storage"
Cohesion: 0.25
Nodes (8): Advanced: Multiple Operations, Clear All localStorage, Delete Single Item, Get Single Value, List All localStorage Items, Local Storage, Set JSON Value, Set Value

### Community 98 - "3. Heal"
Cohesion: 0.33
Nodes (6): 3.1 Find failing tests, 3.2 Debug one failure, 3.3 Apply the fix, 3.4 Reconcile with the spec, 3.5 Iteration and giving up, 3. Heal

### Community 99 - "POST /api/v1/bids/{id}/transition"
Cohesion: 0.40
Nodes (5): Allowed Transitions (Manual Mode), Error Codes, POST /api/v1/bids/{id}/transition, Request, Response

### Community 102 - "POST /api/v1/bids"
Cohesion: 0.40
Nodes (5): Error Codes, Example Request (Manual Mode), POST /api/v1/bids, Request Body, Response — 201 Created

### Community 103 - "POST /api/v1/tasks/{id}/activities"
Cohesion: 0.40
Nodes (5): Example — Call Logged, Example — Comment, POST /api/v1/tasks/{id}/activities, Request, Response — 201 Created

### Community 104 - "PrimaryButton"
Cohesion: 0.40
Nodes (3): BentoTile(), handleMove(), PrimaryButton()

### Community 105 - "vite.config.js"
Cohesion: 0.40
Nodes (4): path, @tailwindcss/vite, vite, @vitejs/plugin-react

### Community 106 - "POST /api/v1/tasks/{id}/approve"
Cohesion: 0.50
Nodes (4): Auto-Logged Activity, POST /api/v1/tasks/{id}/approve, Request, Response — 200 OK

### Community 107 - "POST /api/v1/tasks/{id}/oem-followup"
Cohesion: 0.50
Nodes (4): Auto-Logged Activity, POST /api/v1/tasks/{id}/oem-followup, Request, Response — 200 OK

### Community 108 - "POST /api/v1/bids/{id}/tasks/document"
Cohesion: 0.50
Nodes (4): Completion Guard, POST /api/v1/bids/{id}/tasks/document, Request, Response — 201 Created

### Community 109 - "POST /api/v1/bids/{id}/tasks"
Cohesion: 0.50
Nodes (4): Example Request, POST /api/v1/bids/{id}/tasks, Request Body, Response — 201 Created

### Community 110 - "React + Vite"
Cohesion: 0.50
Nodes (3): Expanding the ESLint configuration, React Compiler, React + Vite

## Knowledge Gaps
- **569 isolated node(s):** `github.com/onetrack/backend`, `createAlertReq`, `Permission`, `RefreshRequest`, `ForgotPasswordRequest` (+564 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 736 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **28 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `react` to `StageWorkspaces.jsx`, `BulkImportPage.jsx`, `cn`, `Landing.jsx`, `TendersPage.jsx`, `EditTenderDialog.jsx`, `EmdDetailsDialog.jsx`, `FeedbackPage.jsx`, `LeadDetailPage.jsx`, `App.jsx`, `TenderDetailPage.jsx`, `WorkingCalendarPage.jsx`, `ledgerTheme.js`, `apiFetch`, `package.json`, `PipelineConstellation.jsx`?**
  _High betweenness centrality (0.013) - this node is a cross-community bridge._
- **Why does `lucide-react` connect `react` to `StageWorkspaces.jsx`, `BulkImportPage.jsx`, `cn`, `Landing.jsx`, `TendersPage.jsx`, `EditTenderDialog.jsx`, `EmdDetailsDialog.jsx`, `FeedbackPage.jsx`, `LeadDetailPage.jsx`, `App.jsx`, `TenderDetailPage.jsx`, `WorkingCalendarPage.jsx`, `ledgerTheme.js`, `apiFetch`, `package.json`, `PipelineConstellation.jsx`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **Why does `framer-motion` connect `EditTenderDialog.jsx` to `StageWorkspaces.jsx`, `cn`, `Landing.jsx`, `EmdDetailsDialog.jsx`, `TendersPage.jsx`, `react`, `App.jsx`, `TenderDetailPage.jsx`, `WorkingCalendarPage.jsx`, `ledgerTheme.js`, `package.json`, `PipelineConstellation.jsx`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **What connects `github.com/onetrack/backend`, `createAlertReq`, `Permission` to the rest of the system?**
  _569 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `importer.go` be split into smaller, more focused modules?**
  _Cohesion score 0.050853548966756514 - nodes in this community are weakly interconnected._
- **Should `context.Context` be split into smaller, more focused modules?**
  _Cohesion score 0.03552960800667223 - nodes in this community are weakly interconnected._
- **Should `mockCalendarRepo` be split into smaller, more focused modules?**
  _Cohesion score 0.03226944101569388 - nodes in this community are weakly interconnected._