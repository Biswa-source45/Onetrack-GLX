# Graph Report - Onetrack-GlobX  (2026-10-15)

## Corpus Check
- 397 files · ~456,081 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 9 file(s) not represented in the graph (top: (none) 5, .css 2, .example 1)

## Summary
- 3345 nodes · 9624 edges · 148 communities (123 shown, 25 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 168 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e7d83e03`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- FeedbackPage.jsx
- cn
- BidWorkspace
- WorkingCalendarRepository
- TenderDetailPage.jsx
- Landing.jsx
- ticketService
- TendersPage.jsx
- react
- time.Time
- Endpoints
- working_calendar_service_test.go
- apiFetch
- Alert
- TenderEMDResponse
- Endpoints
- BadRequest
- Dashboard.jsx
- model.go
- systemlog/domain/models.go
- WorkingCalendarPage.jsx
- UserRepository
- Files Changed
- encoding/json.RawMessage
- Holiday
- testing.T
- authService
- StageWorkspaces.jsx
- dependencies
- emd_models.go
- package.json
- calendar/handler/handler_test.go
- components.json
- ContactsTab.jsx
- jwt_service.go
- WorkingCalendar
- App.jsx
- CreateUserSheet
- EmdDetailsDialog.jsx
- importtracker/main.go
- go_pkg_context
- LedgerRow
- bid_service.go
- Browser Session Management
- bid/domain/models.go
- devDependencies
- AuthRepository
- Storage Management
- context.Context
- scripts
- auth/domain/models.go
- server/main.go
- compilerOptions
- Test generation (plan → generate → heal)
- Tracing
- github.com/onetrack/backend
- main
- CLAUDE.md
- .claude/CLAUDE.md
- ledgerTheme.js
- Repo
- emd_service_test.go
- TenderContact
- PART 2 — TASK MANAGEMENT APIs
- OneTrack GlobX — API Documentation
- Deployment Readiness & Runbook — Bulk Import Fix Release
- go_pkg_github_com_onetrack_backend_internal_bid_domain
- 6. Tenders (Bid Workspaces) — `/api/v1/bids`
- go_pkg_github_com_onetrack_backend_internal_user_domain
- TenderEMDDetails
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
- DirectoryPage.jsx
- 7. Leads — `/api/v1/leads`
- 1. Getting started
- importer.go
- 3. Auth — `/api/v1/auth`
- 8. Alerts — `/api/v1/alerts`
- Commands
- 12. Appendix: enums and reference values
- mockCalendarRepo
- 6.7 Edit approvals
- Cookies
- Video Recording
- 6.12 Helpers: Field Memory, pricing hint, performance matrix
- 6.9 History and audit
- LedgerStampMark
- PipelineConstellation.jsx
- Advanced Mocking with run-code
- Local Storage
- 3. Heal
- POST /api/v1/bids/{id}/transition
- calendar/domain/models.go
- go_pkg_github_com_onetrack_backend_internal_calendar_repository
- POST /api/v1/bids
- POST /api/v1/tasks/{id}/activities
- response.go
- vite.config.js
- POST /api/v1/tasks/{id}/approve
- POST /api/v1/tasks/{id}/oem-followup
- POST /api/v1/bids/{id}/tasks/document
- POST /api/v1/bids/{id}/tasks
- React + Vite
- ChecklistTab.jsx
- models_test.go
- fakeTicketRepo
- AddTenderPage
- fail
- TicketResponse
- NotFound
- TenderDeadlineCandidate
- TicketService
- TicketRepository
- BackgroundScheduler
- migrate/main.go
- TicketStatusEvent
- list_exports.js
- service_test.go
- github.com/gin-gonic/gin.Context
- Success
- BidService
- WorkingCalendarService
- framer-motion
- LeadHandler
- bidService
- Forbidden
- UserSummary
- github.com/onetrack/backend/internal/bid/domain.TenderEMDAuditLog
- github.com/onetrack/backend/internal/bid/domain.TenderEMDDetails
- Lead
- InternalError
- pgx.Row
- UserSummary
- frontend_src_components_tenders_postbidcontacts
- frontend_src_components_tenders_postbidcontacts_postbidcontactscard
- frontend_src_components_tenders_postbidcontacts_postbidcontactsform
- frontend_src_components_tenders_postbidcontacts_postbidcontactsview
- frontend_src_lib_postbid
- frontend_src_lib_postbid_postbidstatus
- github.com/onetrack/backend/internal/bid/domain.EMDTx

## God Nodes (most connected - your core abstractions)
1. `Success()` - 96 edges
2. `cn()` - 95 edges
3. `apiFetch()` - 88 edges
4. `react` - 80 edges
5. `BadRequest()` - 68 edges
6. `lucide-react` - 64 edges
7. `InternalError()` - 60 edges
8. `fakeBidRepo` - 58 edges
9. `BidRepository` - 54 edges
10. `mockCalendarRepo` - 51 edges

## Surprising Connections (you probably didn't know these)
- `Do:` --references--> `LedgerRow()`  [INFERRED]
  frontend/DESIGN.md → frontend/src/lib/LedgerRow.jsx
- `Hierarchy` --references--> `LedgerRow()`  [INFERRED]
  frontend/DESIGN.md → frontend/src/lib/LedgerRow.jsx
- `Layout` --references--> `LedgerRow()`  [INFERRED]
  frontend/DESIGN.md → frontend/src/lib/LedgerRow.jsx
- `Named Rules` --references--> `LedgerRow()`  [INFERRED]
  frontend/DESIGN.md → frontend/src/lib/LedgerRow.jsx
- `Neutral` --references--> `LedgerRow()`  [INFERRED]
  frontend/DESIGN.md → frontend/src/lib/LedgerRow.jsx

## Import Cycles
- None detected.

## Communities (148 total, 25 thin omitted)

### Community 0 - "FeedbackPage.jsx"
Cohesion: 0.12
Nodes (27): ALLOWED_IMAGE_TYPES, FeedbackPage(), handleSubmit(), loadMyTickets(), removeImage(), formatDate(), formatWhen(), TicketDetailDialog() (+19 more)

### Community 1 - "cn"
Cohesion: 0.05
Nodes (87): CATEGORY_CLASSES, CATEGORY_FILTERS, CATEGORY_LABELS, formatTime(), SystemLogsPage(), getHue(), getInitials(), UserAvatar() (+79 more)

### Community 2 - "BidWorkspace"
Cohesion: 0.13
Nodes (14): BidListItem, BidListResponse, BidWorkspace, ListBidsParams, UserSummary, scanBid(), scanBidFields(), scanBidFromRows() (+6 more)

### Community 3 - "WorkingCalendarRepository"
Cohesion: 0.05
Nodes (15): WorkingCalendarRepository, CalendarException, DeadlineCoverage, GoogleSyncService, GoogleCalendarIntegration, GoogleCalendarSyncLog, Holiday, NextActionableTask (+7 more)

### Community 4 - "TenderDetailPage.jsx"
Cohesion: 0.05
Nodes (73): applyAlertNote(), EditTenderDialog(), handleSubmit(), loadFullBid(), loadUsers(), validate(), fieldDiffLabel(), inputCls() (+65 more)

### Community 5 - "Landing.jsx"
Cohesion: 0.08
Nodes (7): BentoTile(), handleMove(), DEMO_SHEET_TENDERS, MotionLink, PrimaryButton(), ROLES, LEDGER_STAGES

### Community 6 - "ticketService"
Cohesion: 0.26
Nodes (4): FieldMemory, ListTicketsParams, TicketListPage, ticketService

### Community 7 - "TendersPage.jsx"
Cohesion: 0.07
Nodes (51): ActivityLogDialog(), eventBadge(), ExportSuccessDialog(), ImportedPill(), InProgressPill(), COLUMNS, MasterSheetPage(), handleExport() (+43 more)

### Community 8 - "react"
Cohesion: 0.12
Nodes (32): INITIAL_FORM, backdropVariants, closeButtonVariants, INITIAL_FORM, panelVariants, PERMISSION_CATEGORIES, PERMISSION_METADATA, ROLE_DETAILS (+24 more)

### Community 9 - "time.Time"
Cohesion: 0.11
Nodes (28): CalculateDeadlineResult, RedZoneNotificationResult, TriggerDays(), workingCalendarService, shortfallAlert(), calendarLocation(), dayDesc(), dayHoursOf() (+20 more)

### Community 10 - "Endpoints"
Cohesion: 0.04
Nodes (46): 1. Health Check, 2. Login, 3. Refresh Token, 4. Logout, 5. Change Password, 6. Force Password Reset, Access Token JWT Payload, Admin User (+38 more)

### Community 11 - "working_calendar_service_test.go"
Cohesion: 0.12
Nodes (52): NewWorkingCalendarService(), escalationAlerts(), escalationRepo(), inWindowTender(), isWorkingDay(), newMockCalendarRepo(), newSvc(), notifKey() (+44 more)

### Community 12 - "apiFetch"
Cohesion: 0.07
Nodes (39): EditUserDialog(), handleClose(), handleSubmit(), ForceResetDialog(), handleClose(), handleConfirm(), RolesPermissionsDialog(), handleClose() (+31 more)

### Community 13 - "Alert"
Cohesion: 0.05
Nodes (15): ApprovalLink(), Alert, AlertRepository, AlertService, SafeLink(), StageLink(), TenderLink(), TestSafeLink() (+7 more)

### Community 14 - "TenderEMDResponse"
Cohesion: 0.16
Nodes (19): MDDecisionRequest, SubmitMDApprovalRequest, TenderEMDResponse, UpdateBasicEMDRequest, UpdateEMDRefundRequest, VerifyEMDPaymentRequest, defaultEMD(), emdAmount() (+11 more)

### Community 15 - "Endpoints"
Cohesion: 0.05
Nodes (39): 1. Create User, 2. List Users, 3. Get My Profile, 4. Get User by ID, 5. Update User Profile, 6. Update User Status (Activate/Deactivate), 7. Update User Roles, 8. Update Permission Overrides (+31 more)

### Community 16 - "BadRequest"
Cohesion: 0.12
Nodes (5): contactError(), parseIntQuery(), BadRequest(), Conflict(), BidHandler

### Community 17 - "Dashboard.jsx"
Cohesion: 0.07
Nodes (50): SettingsPage(), AnalyticsPage(), CATEGORY_COLORS, ROLE_BADGES, STAGE_COLORS, STAGE_LABELS, EmdProjectionBlock(), getTenderDeadline() (+42 more)

### Community 18 - "model.go"
Cohesion: 0.12
Nodes (17): NewHandler(), digitCount(), invalid(), tooLong(), UserMessage(), affected(), mapErr(), NewRepo() (+9 more)

### Community 19 - "systemlog/domain/models.go"
Cohesion: 0.10
Nodes (20): auditPageSize(), decodeAuditCursor(), encodeAuditCursor(), Decode(), Encode(), PageSize(), Repository, Service (+12 more)

### Community 20 - "WorkingCalendarPage.jsx"
Cohesion: 0.10
Nodes (46): COVERAGE_COLS, CURRENT_YEAR, DEADLINE_PRESETS, DEADLINE_UNITS, describeRun(), EMPTY_HOLIDAY_FORM, EngineStatusCard(), fmtTime() (+38 more)

### Community 21 - "UserRepository"
Cohesion: 0.07
Nodes (14): UserRepository, UserService, CreateUserRequest, ListUsersParams, UpdatePermissionsRequest, UpdateRolesRequest, UpdateStatusRequest, UpdateUserRequest (+6 more)

### Community 22 - "Files Changed"
Cohesion: 0.09
Nodes (22): 1. New column on `bid.bid_workspaces`, 2. New table `bid.bid_checklists`, API Changes Summary, Changes, Database Migration, Files Changed, `GET /api/v1/bids/:id/checklists`, `GET /api/v1/bids/:id` — updated response (+14 more)

### Community 23 - "encoding/json.RawMessage"
Cohesion: 0.13
Nodes (12): Repository, Service, SystemConfig, NewHandler(), postgresRepo, NewPostgresRepository(), service, NewService() (+4 more)

### Community 24 - "Holiday"
Cohesion: 0.15
Nodes (6): DefaultIntegration(), Holiday, SyncResult, UpdateHolidayRequest, pgx.Row, googleSyncService

### Community 25 - "testing.T"
Cohesion: 0.10
Nodes (40): extractProductFields(), fieldSuggestionEntries(), NewBidService(), boolPtr(), floatPtr(), hasAlertType(), intPtr(), lastEventType() (+32 more)

### Community 26 - "authService"
Cohesion: 0.12
Nodes (8): AuthService, ChangePasswordRequest, ForceResetRequest, LoginRequest, LoginResponse, NewAuthHandler(), UserInfo, authService

### Community 27 - "StageWorkspaces.jsx"
Cohesion: 0.06
Nodes (82): frontend_src_components_tenders_checklistreview, frontend_src_components_tenders_checklistreview_checklistreview, logChecklistHistory(), DUE_STYLE, esc(), RaiseShortfallDialog(), ShortfallHistory(), ShortfallHistoryCard() (+74 more)

### Community 28 - "dependencies"
Cohesion: 0.08
Nodes (25): dependencies, canvas-confetti, class-variance-authority, clsx, exceljs, @fontsource-variable/instrument-sans, @fontsource-variable/inter, framer-motion (+17 more)

### Community 29 - "emd_models.go"
Cohesion: 0.19
Nodes (12): RecordEMDPaymentRequest, FolderSlug(), safeName(), strp(), TestFolderSlugAndSafeName(), TestNormalize(), TestValidateDocument(), validateDocument() (+4 more)

### Community 30 - "package.json"
Cohesion: 0.09
Nodes (23): name, private, type, version, canvas-confetti, clsx, eslint, @eslint/js (+15 more)

### Community 31 - "calendar/handler/handler_test.go"
Cohesion: 0.11
Nodes (20): isRealAPIKey(), call(), engineRouter(), TestEngineStatusIsAdminOnly(), TestEngineStatusShape(), TestIsRealAPIKeyRejectsPlaceholders(), TestManualEvaluationIsRecordedAsManual(), TestMaskIntegrationNeverExposesKey() (+12 more)

### Community 32 - "components.json"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 33 - "ContactsTab.jsx"
Cohesion: 0.09
Nodes (42): ContactDialog(), ContactsSummary(), ContactsTab(), FIELDS, OemContactCell(), ReasonDialog(), Stage3Workspace(), applyPlan() (+34 more)

### Community 34 - "jwt_service.go"
Cohesion: 0.11
Nodes (12): JWTService, TokenClaims, TokenPair, redis.Client, NewJWTService(), go_pkg_crypto_sha256, go_pkg_github_com_golang_jwt_jwt_v5, time.Duration (+4 more)

### Community 35 - "WorkingCalendar"
Cohesion: 0.16
Nodes (5): UpdateCalendarRequest, WorkingCalendar, ValidateInterval(), ValidateTrigger(), stubRepo

### Community 36 - "App.jsx"
Cohesion: 0.07
Nodes (32): App(), ExcludeRoleGuard(), PermissionGuard(), RoleGuard(), BulkImportPage(), handleCommit(), handleFile(), FORMATS (+24 more)

### Community 37 - "CreateUserSheet"
Cohesion: 0.16
Nodes (12): CreateUserDialog(), handleClose(), handleSubmit(), resetForm(), validate(), CreateUserSheet(), handleSubmit(), onKeyDown() (+4 more)

### Community 38 - "EmdDetailsDialog.jsx"
Cohesion: 0.13
Nodes (30): EmdApprovalDialog(), ACTION_STYLE, EmdAuditDialog(), fmtDate(), EmdDetailsDialog(), fmtDate(), SECTIONS, EmdLifecycleCard() (+22 more)

### Community 39 - "importtracker/main.go"
Cohesion: 0.14
Nodes (18): boolOr(), env(), fmtF(), main(), strOr(), env(), main(), printSection() (+10 more)

### Community 40 - "go_pkg_context"
Cohesion: 0.12
Nodes (19): getEnv(), main(), TransitionRequest, go_pkg_context, go_pkg_database_sql, go_pkg_errors, go_pkg_fmt, go_pkg_github_com_jackc_pgx_v5 (+11 more)

### Community 41 - "LedgerRow"
Cohesion: 0.12
Nodes (20): Colors, Deep Panel (login left panel only), Design System: OneTrack — The Ledger, Do:, Do's and Don'ts, Don't:, Elevation & Depth, Hierarchy (+12 more)

### Community 42 - "bid_service.go"
Cohesion: 0.06
Nodes (43): FieldDiff, UpdateBidRequest, alertNoteHTML(), approverDisplayName(), authorizeEditDecision(), checkDocShortfall(), closeOrCancelWords(), derefFloat() (+35 more)

### Community 43 - "Browser Session Management"
Cohesion: 0.10
Nodes (20): 1. Name Browser Sessions Semantically, 2. Always Clean Up, 3. Delete Stale Browser Data, A/B Testing Sessions, Attach by channel name, Attach via browser extension, Attach via CDP endpoint, Attaching to a Running Browser (+12 more)

### Community 44 - "bid/domain/models.go"
Cohesion: 0.07
Nodes (24): TransitionResult, AddMicroEventRequest, AuditLogPage, AuditLogQuery, PricingSuggestion, RecordOutcomeRequest, StageHistoryPage, StageHistoryResponse (+16 more)

### Community 45 - "devDependencies"
Cohesion: 0.20
Nodes (10): devDependencies, eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals, @types/react, @types/react-dom (+2 more)

### Community 46 - "AuthRepository"
Cohesion: 0.05
Nodes (8): AuthRepository, Role, User, UserPermissionOverride, NewPostgresAuthRepository(), mapKeys(), postgresAuthRepo, postgresUserRepo

### Community 47 - "Storage Management"
Cohesion: 0.11
Nodes (18): Authentication State Reuse, Clear sessionStorage, Common Patterns, Delete Database, Delete Single Item, Get Single Value, IndexedDB, List All sessionStorage Items (+10 more)

### Community 48 - "context.Context"
Cohesion: 0.03
Nodes (17): BidRepository, EMDTx, PricingWorkspaceRow, BidChecklist, FieldSuggestion, MemberResponse, PendingApproval, TenderEditApproval (+9 more)

### Community 49 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, lint, preview

### Community 50 - "auth/domain/models.go"
Cohesion: 0.19
Nodes (7): ForgotPasswordRequest, Permission, RefreshRequest, ResetPasswordOTPRequest, VerifyOTPRequest, go_pkg_golang_org_x_crypto_bcrypt, go_pkg_math_big

### Community 51 - "server/main.go"
Cohesion: 0.06
Nodes (38): NewAlertService(), getEnv(), DatabaseConfig, EmailConfig, JWTConfig, RedisConfig, Load(), EmailService (+30 more)

### Community 52 - "compilerOptions"
Cohesion: 0.50
Nodes (3): compilerOptions, baseUrl, paths

### Community 53 - "Test generation (plan → generate → heal)"
Cohesion: 0.12
Nodes (17): 0. How generation works, 1.1 Prerequisite: workspace, 1.2 Prerequisite: seed test, 1.3 Explore the app, 1.4 Write the spec file, 1. Planning, 2.1 Inputs, 2.2 Generate one scenario (+9 more)

### Community 54 - "Tracing"
Cohesion: 0.12
Nodes (16): 1. Start Tracing Before the Problem, 2. Clean Up Old Traces, Analyzing Performance, Basic Usage, Best Practices, Capturing Evidence, Debugging Failed Actions, Limitations (+8 more)

### Community 56 - "main"
Cohesion: 0.11
Nodes (32): main(), RegisterAlertRoutes(), RegisterAuthRoutes(), NewAuthService(), NewBulkImportHandler(), RegisterBidRoutes(), NewPostgresBidRepository(), RegisterCalendarRoutes() (+24 more)

### Community 59 - "ledgerTheme.js"
Cohesion: 0.33
Nodes (5): FaqSection(), ledger, ledgerFont, BUILDINGS, LoginSkyline()

### Community 60 - "Repo"
Cohesion: 0.15
Nodes (5): CreateLeadRequest, Document, NewLeadHandler(), Repo, NewPostgresLeadRepository()

### Community 61 - "emd_service_test.go"
Cohesion: 0.28
Nodes (19): strPtr(), float64Ptr(), newEMDTestSetup(), onlinePayment(), TestChecklist_ToggleKeepsStatusInSync(), TestChecklist_ValidatesPriorityAndStatus(), TestEMD_BasicUpdateCannotTouchStatusAndLocksWhilePending(), TestEMD_ExemptedTenderRejectsEveryMutationAndGetIsReadOnly() (+11 more)

### Community 62 - "TenderContact"
Cohesion: 0.09
Nodes (26): ReorderContactItem, ReorderContactsRequest, SaveContactRequest, TenderContact, UpdateContactRequest, contactErr(), pgx.Row, postgresBidRepo (+18 more)

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

### Community 69 - "TenderEMDDetails"
Cohesion: 0.10
Nodes (7): TenderEMDAuditLog, TenderEMDDetails, postgresBidRepo, scanEMD(), pgx.Tx, pgEMDTx, fakeEMDTx

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

### Community 80 - "DirectoryPage.jsx"
Cohesion: 0.05
Nodes (77): AddDialog(), ContactDialog(), Detail(), DirectoryPage(), errText(), fmtDate(), initials(), List() (+69 more)

### Community 81 - "7. Leads — `/api/v1/leads`"
Cohesion: 0.22
Nodes (9): 7.1 Typical flow (step by step), 7.2 `POST /leads` — create lead, 7.3 `GET /leads` — list leads, 7.4 `GET /leads/:id` — lead detail, 7.5 `POST /leads/:id/documents` — upload one document, 7.6 `GET /leads/:id/documents/:docId` — download, 7.7 `DELETE /leads/:id/documents/:docId`, 7. Leads — `/api/v1/leads` (+1 more)

### Community 82 - "1. Getting started"
Cohesion: 0.25
Nodes (8): 1.1 Base URL, 1.2 Authentication flow (step by step), 1.3 Response envelope, 1.4 Errors and status codes, 1.5 Pagination, 1.6 Data conventions, 1.7 Roles and permissions, 1. Getting started

### Community 83 - "importer.go"
Cohesion: 0.05
Nodes (95): commit(), connect(), getEnv(), pgx.Conn, main(), printSummary(), summarise(), canonDashboardActivity() (+87 more)

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

### Community 88 - "mockCalendarRepo"
Cohesion: 0.05
Nodes (9): ShortfallCandidate, CalendarException, GoogleCalendarIntegration, GoogleCalendarSyncLog, NextActionableTask, TenderStakeholder, UpdateChecklistPriorityRequest, postgresCalendarRepo (+1 more)

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

### Community 94 - "LedgerStampMark"
Cohesion: 0.22
Nodes (10): Buttons, Cards / Containers, Components, Inputs / Fields, Navigation, The Ledger Row (signature component), The Ledger Stamp Mark (signature component), The Login Abstract Panel (signature component) (+2 more)

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

### Community 100 - "calendar/domain/models.go"
Cohesion: 0.19
Nodes (9): DeadlineCoverage, EngineRuntime, EvaluationSummary, LastRun, TaskNotification, ConfigureGoogleSyncRequest, CreateExceptionRequest, CreateHolidayRequest (+1 more)

### Community 102 - "POST /api/v1/bids"
Cohesion: 0.40
Nodes (5): Error Codes, Example Request (Manual Mode), POST /api/v1/bids, Request Body, Response — 201 Created

### Community 103 - "POST /api/v1/tasks/{id}/activities"
Cohesion: 0.40
Nodes (5): Example — Call Logged, Example — Comment, POST /api/v1/tasks/{id}/activities, Request, Response — 201 Created

### Community 104 - "response.go"
Cohesion: 0.18
Nodes (13): go_pkg_crypto_rand, go_pkg_encoding_hex, go_pkg_github_com_gin_gonic_gin, go_pkg_io, go_pkg_mime_multipart, go_pkg_net_http, go_pkg_os, go_pkg_path_filepath (+5 more)

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

### Community 111 - "ChecklistTab.jsx"
Cohesion: 0.15
Nodes (23): ChecklistTab(), OEM_PILL_COLORS, addSection(), cellBorder, cleanTitle(), exportChecklistToExcel(), OEM_HEADER_BG, OEM_HEADER_FG (+15 more)

### Community 112 - "models_test.go"
Cohesion: 0.19
Nodes (11): f64p(), intp(), strp(), TestSchedulerIntervalCombinesValueAndUnit(), TestUpdateCalendarRequestValidate(), TestValidateIntervalNormalisesUnit(), TestValidateTriggerNormalisesUnit(), TestCandidateSelectExcludesSubmittedAndResolvedTenders() (+3 more)

### Community 113 - "fakeTicketRepo"
Cohesion: 0.18
Nodes (3): Ticket, TicketStatusHistoryInsert, fakeTicketRepo

### Community 114 - "AddTenderPage"
Cohesion: 0.22
Nodes (10): inputCls(), ManualForm(), handleSubmit(), loadUsers(), validate(), AddTenderPage(), handleSubmit(), nextStep() (+2 more)

### Community 115 - "fail"
Cohesion: 0.47
Nodes (3): fail(), who(), Handler

### Community 116 - "TicketResponse"
Cohesion: 0.23
Nodes (4): CreateTicketRequest, TicketResponse, scanTicket(), postgresTicketRepo

### Community 119 - "TicketService"
Cohesion: 0.25
Nodes (3): TicketService, UpdateTicketStatusRequest, NewTicketHandler()

### Community 121 - "BackgroundScheduler"
Cohesion: 0.38
Nodes (3): sync.Mutex, sync.WaitGroup, BackgroundScheduler

### Community 122 - "migrate/main.go"
Cohesion: 0.53
Nodes (5): extractVersion(), getEnv(), pgx.Conn, main(), seedAppliedMigrations()

### Community 131 - "service_test.go"
Cohesion: 0.33
Nodes (11): NewTicketService(), newFakeTicketRepo(), TestCreateTicket_NotifiesAndRemembers(), TestCreateTicket_StandardCategoryDoesNotTouchFieldMemory(), TestCreateTicket_Validation(), TestGetTicket_OwnershipEnforced(), TestGetTicketImagePath_OwnershipEnforced(), TestUpdateStatus_LogsAndNotifiesOnResolve() (+3 more)

### Community 133 - "github.com/gin-gonic/gin.Context"
Cohesion: 0.21
Nodes (8): actorRoles(), BidHandler, mapServiceError(), isAdmin(), parseListParams(), respondPage(), Error(), github.com/gin-gonic/gin.Context

### Community 134 - "Success"
Cohesion: 0.24
Nodes (6): actorPtr(), fail(), maskIntegration(), oneOf(), Success(), CalendarHandler

### Community 135 - "BidService"
Cohesion: 0.05
Nodes (19): BidService, AddChecklistRequest, AddMemberRequest, BidChecklistItem, BidResponse, CreateBidRequest, ReorderChecklistRequest, UpdateChecklistRequest (+11 more)

### Community 136 - "WorkingCalendarService"
Cohesion: 0.12
Nodes (11): WorkingCalendarService, NewCalendarHandler(), NewBackgroundScheduler(), TestSchedulerIntervalUsesUnit(), TestSchedulerPicksUpCadenceChange(), CalculateDeadlineResult, EngineRuntime, EvaluationSummary (+3 more)

### Community 137 - "framer-motion"
Cohesion: 0.21
Nodes (5): DEMO_BOARDS, InteractiveBoardDemo(), frontend_src_components_ui_skipersvgbeam_skipersvgbeam, authService, framer-motion

### Community 138 - "LeadHandler"
Cohesion: 0.20
Nodes (5): LeadHandler, randomHex(), userMessage(), actorOf(), fail()

### Community 140 - "Forbidden"
Cohesion: 0.12
Nodes (9): saveReceiptFile(), validateReceiptUpload(), kindGate(), hasRole(), hasPermission(), Forbidden(), github.com/gin-gonic/gin.HandlerFunc, mime/multipart.FileHeader (+1 more)

### Community 151 - "Lead"
Cohesion: 0.19
Nodes (11): Lead, Actor, Lead, approverID(), detailsHTML(), LeadHandler, leadName(), managerID() (+3 more)

### Community 155 - "InternalError"
Cohesion: 0.09
Nodes (7): extractTokenFromHeader(), extractBearerToken(), InternalError(), Unauthorized(), Handler, AlertHandler, AuthHandler

## Knowledge Gaps
- **584 isolated node(s):** `kind`, `NAV_ITEMS`, `STATUS_OPTIONS`, `BIDDER_SUGGESTIONS`, `OEM_SUGGESTIONS` (+579 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 800 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **25 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `react` to `FeedbackPage.jsx`, `cn`, `ContactsTab.jsx`, `App.jsx`, `Landing.jsx`, `EmdDetailsDialog.jsx`, `TendersPage.jsx`, `TenderDetailPage.jsx`, `framer-motion`, `ledgerTheme.js`, `ChecklistTab.jsx`, `DirectoryPage.jsx`, `Dashboard.jsx`, `WorkingCalendarPage.jsx`, `StageWorkspaces.jsx`, `package.json`, `PipelineConstellation.jsx`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **Why does `lucide-react` connect `react` to `FeedbackPage.jsx`, `cn`, `list_exports.js`, `ContactsTab.jsx`, `App.jsx`, `Landing.jsx`, `EmdDetailsDialog.jsx`, `TendersPage.jsx`, `TenderDetailPage.jsx`, `framer-motion`, `ledgerTheme.js`, `ChecklistTab.jsx`, `DirectoryPage.jsx`, `Dashboard.jsx`, `WorkingCalendarPage.jsx`, `StageWorkspaces.jsx`, `package.json`, `PipelineConstellation.jsx`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **Why does `main()` connect `main` to `jwt_service.go`, `service_test.go`, `BidService`, `WorkingCalendarService`, `working_calendar_service_test.go`, `Alert`, `AuthRepository`, `model.go`, `server/main.go`, `encoding/json.RawMessage`, `systemlog/domain/models.go`, `UserRepository`, `TicketService`, `TicketRepository`, `testing.T`, `authService`, `Repo`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **What connects `kind`, `NAV_ITEMS`, `STATUS_OPTIONS` to the rest of the system?**
  _584 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `FeedbackPage.jsx` be split into smaller, more focused modules?**
  _Cohesion score 0.12121212121212122 - nodes in this community are weakly interconnected._
- **Should `cn` be split into smaller, more focused modules?**
  _Cohesion score 0.04759799587385794 - nodes in this community are weakly interconnected._
- **Should `BidWorkspace` be split into smaller, more focused modules?**
  _Cohesion score 0.13438735177865613 - nodes in this community are weakly interconnected._