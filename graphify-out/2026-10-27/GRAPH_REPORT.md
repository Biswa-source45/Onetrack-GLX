# Graph Report - Onetrack-GlobX  (2026-10-21)

## Corpus Check
- 452 files · ~492,201 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 10 file(s) not represented in the graph (top: (none) 5, .css 2, .example 1)

## Summary
- 3424 nodes · 9861 edges · 153 communities (134 shown, 19 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 179 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `d50be3b8`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- templates.go
- DocsTab.jsx
- context.Context
- WorkingCalendarRepository
- TenderDetailPage.jsx
- Landing.jsx
- TicketResponse
- TendersPage.jsx
- LeadWorkflow.jsx
- time.Time
- Endpoints
- working_calendar_service_test.go
- lucide-react
- Alert
- emd_service.go
- Endpoints
- BadRequest
- Dashboard.jsx
- go_pkg_fmt
- EventItem
- WorkingCalendarPage.jsx
- userService
- Files Changed
- encoding/json.RawMessage
- BidWorkspace
- bid_service_test.go
- authService
- Stage4Workspace
- dependencies
- response.go
- package.json
- calendar/handler/handler_test.go
- components.json
- ContactsTab.jsx
- JWTService
- cn
- AlertUsersPanel.jsx
- CreateUserSheet
- EmdDetailsDialog.jsx
- emdfix/main.go
- go_pkg_time
- LedgerRow
- bid_service.go
- Browser Session Management
- App.jsx
- devDependencies
- main
- Storage Management
- fakeBidRepo
- scripts
- .TransitionStage
- server/main.go
- compilerOptions
- Test generation (plan → generate → heal)
- Tracing
- github.com/onetrack/backend
- DocShortfall.jsx
- CLAUDE.md
- .claude/CLAUDE.md
- ledgerTheme.js
- react
- testing.T
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
- LeadDetailPage
- 7. Leads — `/api/v1/leads`
- 1. Getting started
- normalize.go
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
- Components
- PipelineConstellation.jsx
- Advanced Mocking with run-code
- Local Storage
- 3. Heal
- POST /api/v1/bids/{id}/transition
- Stage2PrimaryReviewWorkspace
- go_pkg_github_com_onetrack_backend_internal_calendar_repository
- POST /api/v1/bids
- POST /api/v1/tasks/{id}/activities
- AuthMiddleware
- bidService
- POST /api/v1/tasks/{id}/approve
- POST /api/v1/tasks/{id}/oem-followup
- POST /api/v1/bids/{id}/tasks/document
- POST /api/v1/bids/{id}/tasks
- React + Vite
- LeadDetailPage.jsx
- BidChecklistItem
- LeadDocumentPicker.jsx
- StageWorkspaces.jsx
- bid/domain/models.go
- engineRouter
- contactError
- Recorder
- LeadWorkflow
- CreateUserDialog
- sheetColumns.test.js
- ForceResetDialog
- InteractiveBoardDemo.jsx
- vite.config.js
- service_test.go
- xlsx.go
- github.com/gin-gonic/gin.Context
- Success
- BidService
- WorkingCalendarService
- Repo
- NotFound
- bidService
- UserSummary
- github.com/onetrack/backend/internal/bid/domain.TenderEMDAuditLog
- github.com/onetrack/backend/internal/bid/domain.TenderEMDDetails
- .applyUpdate
- apiFetch
- Lead
- PrimaryButton
- InternalError
- DocsRepo
- importer.go
- .UpdateDocument
- UserSummary
- frontend_src_components_tenders_postbidcontacts
- frontend_src_components_tenders_postbidcontacts_postbidcontactscard
- frontend_src_components_tenders_postbidcontacts_postbidcontactsform
- frontend_src_components_tenders_postbidcontacts_postbidcontactsview
- frontend_src_lib_postbid
- frontend_src_lib_postbid_postbidstatus
- github.com/onetrack/backend/internal/bid/domain.EMDTx

## God Nodes (most connected - your core abstractions)
1. `Success()` - 101 edges
2. `apiFetch()` - 96 edges
3. `cn()` - 95 edges
4. `react` - 82 edges
5. `BadRequest()` - 68 edges
6. `InternalError()` - 65 edges
7. `lucide-react` - 65 edges
8. `fakeBidRepo` - 58 edges
9. `BidRepository` - 54 edges
10. `mockCalendarRepo` - 51 edges

## Surprising Connections (you probably didn't know these)
- `The Ledger Stamp Mark (signature component)` --references--> `LedgerStampMark()`  [INFERRED]
  frontend/DESIGN.md → frontend/src/lib/ledgerMarks.jsx
- `1.7 Roles and permissions` --references--> `bid()`  [INFERRED]
  API_DOCUMENTATION.md → frontend/src/lib/oem.test.js
- `Do:` --references--> `LedgerRow()`  [INFERRED]
  frontend/DESIGN.md → frontend/src/lib/LedgerRow.jsx
- `Hierarchy` --references--> `LedgerRow()`  [INFERRED]
  frontend/DESIGN.md → frontend/src/lib/LedgerRow.jsx
- `Layout` --references--> `LedgerRow()`  [INFERRED]
  frontend/DESIGN.md → frontend/src/lib/LedgerRow.jsx

## Import Cycles
- None detected.

## Communities (153 total, 19 thin omitted)

### Community 0 - "templates.go"
Cohesion: 0.09
Nodes (31): NewHandler(), Item, NewService(), rowOf(), validEmail(), AccessAlertMessage(), accessInfoTable(), callout() (+23 more)

### Community 1 - "DocsTab.jsx"
Cohesion: 0.10
Nodes (29): inputCls(), ManualForm(), handleSubmit(), loadUsers(), validate(), AddTenderPage(), handleSubmit(), nextStep() (+21 more)

### Community 2 - "context.Context"
Cohesion: 0.03
Nodes (16): AuthRepository, Role, User, UserPermissionOverride, BidRepository, EMDTx, FieldSuggestion, TenderOwnerPerformanceStat (+8 more)

### Community 3 - "WorkingCalendarRepository"
Cohesion: 0.04
Nodes (18): WorkingCalendarRepository, CalendarException, DeadlineCoverage, GoogleSyncService, sync.Mutex, sync.WaitGroup, GoogleCalendarIntegration, GoogleCalendarSyncLog (+10 more)

### Community 4 - "TenderDetailPage.jsx"
Cohesion: 0.07
Nodes (49): ArchiveConfirmDialog(), handleConfirm(), ComplianceCard(), EXIT_HINTS, EXIT_OPTIONS, ExitedBanner(), extractCommercialDetails(), fmt() (+41 more)

### Community 5 - "Landing.jsx"
Cohesion: 0.09
Nodes (6): DEMO_SHEET_TENDERS, Landing(), MotionLink, ROLES, FaqSection(), LEDGER_STAGES

### Community 6 - "TicketResponse"
Cohesion: 0.05
Nodes (20): FieldMemory, TicketRepository, TicketService, CreateTicketRequest, ListTicketsParams, Ticket, TicketListPage, TicketResponse (+12 more)

### Community 7 - "TendersPage.jsx"
Cohesion: 0.07
Nodes (57): ImportedPill(), InProgressPill(), COLUMNS, MasterSheetPage(), handleExport(), PILLS, plainText(), RENDER (+49 more)

### Community 8 - "LeadWorkflow.jsx"
Cohesion: 0.12
Nodes (26): ActivityLogDialog(), eventBadge(), StageAccessDialog(), handleClose(), handleSave(), AlertsPage(), ACTIONS, APPROVER_ROLES (+18 more)

### Community 9 - "time.Time"
Cohesion: 0.07
Nodes (39): StageLink(), TenderLink(), TenderDeadlineCandidate, CalculateDeadlineResult, EngineRuntime, EvaluationSummary, LastRun, RedZoneNotificationResult (+31 more)

### Community 10 - "Endpoints"
Cohesion: 0.04
Nodes (46): 1. Health Check, 2. Login, 3. Refresh Token, 4. Logout, 5. Change Password, 6. Force Password Reset, Access Token JWT Payload, Admin User (+38 more)

### Community 11 - "working_calendar_service_test.go"
Cohesion: 0.14
Nodes (50): escalationAlerts(), escalationRepo(), inWindowTender(), isWorkingDay(), newMockCalendarRepo(), newSvc(), rules(), shortfallAlerts() (+42 more)

### Community 12 - "lucide-react"
Cohesion: 0.06
Nodes (60): brands, keys, CATEGORY_CLASSES, CATEGORY_FILTERS, CATEGORY_LABELS, ALLOWED_IMAGE_TYPES, FeedbackPage(), handleSubmit() (+52 more)

### Community 13 - "Alert"
Cohesion: 0.06
Nodes (10): Alert, AlertRepository, AlertService, SafeLink(), TestSafeLink(), NewAlertHandler(), fakeAlertSvc, postgresAlertRepo (+2 more)

### Community 14 - "emd_service.go"
Cohesion: 0.17
Nodes (20): MDDecisionRequest, SubmitMDApprovalRequest, TenderEMDResponse, UpdateBasicEMDRequest, UpdateEMDRefundRequest, VerifyEMDPaymentRequest, defaultEMD(), emdAmount() (+12 more)

### Community 15 - "Endpoints"
Cohesion: 0.05
Nodes (39): 1. Create User, 2. List Users, 3. Get My Profile, 4. Get User by ID, 5. Update User Profile, 6. Update User Status (Activate/Deactivate), 7. Update User Roles, 8. Update Permission Overrides (+31 more)

### Community 16 - "BadRequest"
Cohesion: 0.12
Nodes (7): BidHandler, parseIntQuery(), hasPermission(), BadRequest(), Conflict(), Forbidden(), github.com/gin-gonic/gin.HandlerFunc

### Community 17 - "Dashboard.jsx"
Cohesion: 0.07
Nodes (37): EditUserDialog(), handleClose(), handleSubmit(), RoleBadge(), AnalyticsPage(), EmdProjectionBlock(), getTenderDeadline(), isActivePipeline() (+29 more)

### Community 18 - "go_pkg_fmt"
Cohesion: 0.09
Nodes (27): getEnv(), main(), PasswordMismatchError, ForgotPasswordRequest, Permission, RefreshRequest, ResetPasswordOTPRequest, VerifyOTPRequest (+19 more)

### Community 19 - "EventItem"
Cohesion: 0.14
Nodes (12): Repository, Service, Event, EventItem, ListQuery, Page, Handler, NewHandler() (+4 more)

### Community 20 - "WorkingCalendarPage.jsx"
Cohesion: 0.07
Nodes (60): COVERAGE_COLS, CURRENT_YEAR, DEADLINE_PRESETS, DEADLINE_UNITS, describeRun(), EMPTY_HOLIDAY_FORM, EngineStatusCard(), fmtTime() (+52 more)

### Community 21 - "userService"
Cohesion: 0.10
Nodes (12): UserService, CreateUserRequest, ListUsersParams, UpdatePermissionsRequest, UpdateRolesRequest, UpdateStatusRequest, UpdateUserRequest, UserListResponse (+4 more)

### Community 22 - "Files Changed"
Cohesion: 0.09
Nodes (22): 1. New column on `bid.bid_workspaces`, 2. New table `bid.bid_checklists`, API Changes Summary, Changes, Database Migration, Files Changed, `GET /api/v1/bids/:id/checklists`, `GET /api/v1/bids/:id` — updated response (+14 more)

### Community 23 - "encoding/json.RawMessage"
Cohesion: 0.13
Nodes (10): Repository, Service, SystemConfig, NewHandler(), postgresRepo, service, NewService(), BidStageHistory (+2 more)

### Community 24 - "BidWorkspace"
Cohesion: 0.43
Nodes (4): BidWorkspace, scanBid(), scanBidFields(), scannable

### Community 25 - "bid_service_test.go"
Cohesion: 0.12
Nodes (30): extractProductFields(), fieldSuggestionEntries(), NewBidService(), floatPtr(), hasAlertType(), intPtr(), lastEventType(), newLedgerTestBid() (+22 more)

### Community 26 - "authService"
Cohesion: 0.12
Nodes (8): AuthService, ChangePasswordRequest, ForceResetRequest, LoginRequest, LoginResponse, NewAuthHandler(), UserInfo, authService

### Community 27 - "Stage4Workspace"
Cohesion: 0.25
Nodes (15): buildRemarkCalloutHtml(), buildValuesAdjustedBannerHtml(), computeL1PricingSummary(), escHtml(), fmtMoneyFull(), Stage4Workspace(), buybackDraft(), buybackLines() (+7 more)

### Community 28 - "dependencies"
Cohesion: 0.08
Nodes (26): dependencies, canvas-confetti, class-variance-authority, clsx, docx-preview, exceljs, @fontsource-variable/instrument-sans, @fontsource-variable/inter (+18 more)

### Community 29 - "response.go"
Cohesion: 0.14
Nodes (16): TestValidateTenderDoc(), validateTenderDoc(), go_pkg_bytes, go_pkg_crypto_rand, go_pkg_encoding_hex, go_pkg_github_com_gin_gonic_gin, go_pkg_io, go_pkg_mime_multipart (+8 more)

### Community 30 - "package.json"
Cohesion: 0.10
Nodes (22): name, private, type, version, canvas-confetti, clsx, eslint, @eslint/js (+14 more)

### Community 31 - "calendar/handler/handler_test.go"
Cohesion: 0.13
Nodes (15): f64p(), intp(), strp(), TestUpdateCalendarRequestValidate(), TestValidateIntervalNormalisesUnit(), ValidateInterval(), isRealAPIKey(), TestIsRealAPIKeyRejectsPlaceholders() (+7 more)

### Community 32 - "components.json"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 33 - "ContactsTab.jsx"
Cohesion: 0.16
Nodes (28): ContactDialog(), ContactsSummary(), ContactsTab(), FIELDS, OemContactCell(), applyPlan(), blankContact(), cleanContact() (+20 more)

### Community 34 - "JWTService"
Cohesion: 0.14
Nodes (8): JWTService, TokenClaims, TokenPair, redis.Client, NewJWTService(), NewAuthMiddleware(), stubJWT, jwtService

### Community 35 - "cn"
Cohesion: 0.06
Nodes (63): getHue(), getInitials(), UserAvatar(), applyAlertNote(), EditTenderDialog(), handleSubmit(), loadFullBid(), loadUsers() (+55 more)

### Community 36 - "AlertUsersPanel.jsx"
Cohesion: 0.12
Nodes (24): AccessAlertDialog(), handleSend(), AlertUsersPanel(), applySharedPassword(), confirmSend(), setPassword(), fmt(), roleText() (+16 more)

### Community 37 - "CreateUserSheet"
Cohesion: 0.29
Nodes (6): CreateUserSheet(), handleSubmit(), onKeyDown(), requestClose(), resetForm(), validate()

### Community 38 - "EmdDetailsDialog.jsx"
Cohesion: 0.13
Nodes (30): EmdApprovalDialog(), ACTION_STYLE, EmdAuditDialog(), fmtDate(), EmdDetailsDialog(), fmtDate(), SECTIONS, EmdLifecycleCard() (+22 more)

### Community 39 - "emdfix/main.go"
Cohesion: 0.13
Nodes (19): boolOr(), env(), fmtF(), main(), strOr(), env(), main(), printSection() (+11 more)

### Community 40 - "go_pkg_time"
Cohesion: 0.10
Nodes (24): RecordEMDPaymentRequest, FolderSlug(), safeName(), strp(), TestFolderSlugAndSafeName(), TestNormalize(), TestValidateDocument(), validateDocument() (+16 more)

### Community 41 - "LedgerRow"
Cohesion: 0.12
Nodes (20): Colors, Deep Panel (login left panel only), Design System: OneTrack — The Ledger, Do:, Do's and Don'ts, Don't:, Elevation & Depth, Hierarchy (+12 more)

### Community 42 - "bid_service.go"
Cohesion: 0.09
Nodes (34): FieldDiff, alertNoteHTML(), buildBidListItem(), calcDaysRemaining(), checkDocShortfall(), derefFloat(), derefInt(), derefStr() (+26 more)

### Community 43 - "Browser Session Management"
Cohesion: 0.10
Nodes (20): 1. Name Browser Sessions Semantically, 2. Always Clean Up, 3. Delete Stale Browser Data, A/B Testing Sessions, Attach by channel name, Attach via browser extension, Attach via CDP endpoint, Attaching to a Running Browser (+12 more)

### Community 44 - "App.jsx"
Cohesion: 0.09
Nodes (24): App(), ExcludeRoleGuard(), PermissionGuard(), RoleGuard(), BulkImportPage(), handleCommit(), handleFile(), commitLines() (+16 more)

### Community 45 - "devDependencies"
Cohesion: 0.20
Nodes (10): devDependencies, eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals, @types/react, @types/react-dom (+2 more)

### Community 46 - "main"
Cohesion: 0.19
Nodes (19): main(), NewPostgresAlertRepository(), NewPostgresAuthRepository(), NewBulkImportHandler(), NewDocsRepo(), NewPostgresBidRepository(), NewPostgresCalendarRepository(), NewPostgresTicketRepository() (+11 more)

### Community 47 - "Storage Management"
Cohesion: 0.11
Nodes (18): Authentication State Reuse, Clear sessionStorage, Common Patterns, Delete Database, Delete Single Item, Get Single Value, IndexedDB, List All sessionStorage Items (+10 more)

### Community 48 - "fakeBidRepo"
Cohesion: 0.03
Nodes (27): PricingWorkspaceRow, AddMicroEventRequest, AuditLogPage, AuditLogQuery, BidChecklist, BidListItem, BidListResponse, ListBidsParams (+19 more)

### Community 49 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, lint, preview

### Community 50 - ".TransitionStage"
Cohesion: 0.26
Nodes (8): TransitionResult, TransitionStageRequest, getRoleForStage(), emdNotRequired(), GetAllowedTransitions(), IsTerminalStage(), IsTransitionAllowed(), skipEMDStage()

### Community 51 - "server/main.go"
Cohesion: 0.06
Nodes (35): getEnv(), Load(), Config, DatabaseConfig, EmailConfig, JWTConfig, RedisConfig, ServerConfig (+27 more)

### Community 52 - "compilerOptions"
Cohesion: 0.50
Nodes (3): compilerOptions, baseUrl, paths

### Community 53 - "Test generation (plan → generate → heal)"
Cohesion: 0.12
Nodes (17): 0. How generation works, 1.1 Prerequisite: workspace, 1.2 Prerequisite: seed test, 1.3 Explore the app, 1.4 Write the spec file, 1. Planning, 2.1 Inputs, 2.2 Generate one scenario (+9 more)

### Community 54 - "Tracing"
Cohesion: 0.12
Nodes (16): 1. Start Tracing Before the Problem, 2. Clean Up Old Traces, Analyzing Performance, Basic Usage, Best Practices, Capturing Evidence, Debugging Failed Actions, Limitations (+8 more)

### Community 56 - "DocShortfall.jsx"
Cohesion: 0.17
Nodes (28): DUE_STYLE, esc(), RaiseShortfallDialog(), ReasonDialog(), ShortfallHistory(), ShortfallHistoryCard(), ShortfallPanel(), STATUS_STYLE (+20 more)

### Community 59 - "ledgerTheme.js"
Cohesion: 0.35
Nodes (5): LedgerStampMark(), ledger, ledgerFont, BUILDINGS, LoginSkyline()

### Community 60 - "react"
Cohesion: 0.08
Nodes (47): FORMATS, STAGE_LABELS, STAGE_ORDER, INITIAL_FORM, backdropVariants, closeButtonVariants, INITIAL_FORM, panelVariants (+39 more)

### Community 61 - "testing.T"
Cohesion: 0.15
Nodes (31): boolPtr(), strPtr(), float64Ptr(), newEMDTestSetup(), onlinePayment(), TestChecklist_ToggleKeepsStatusInSync(), TestChecklist_ValidatesPriorityAndStatus(), TestEMD_BasicUpdateCannotTouchStatusAndLocksWhilePending() (+23 more)

### Community 62 - "TenderContact"
Cohesion: 0.07
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
Cohesion: 0.12
Nodes (16): 6.10 Workspace members, 6.11 Checklists, 6.13 `PATCH /bids/:id/outcome` — record outcome, 6.14 Tender Bin, 6.15 `POST /bids/bulk-import` — Excel import, 6.16 Tender documents (RFP, ATC, ...), 6.1 Typical lifecycle (step by step), 6.2 `POST /bids` — create tender (+8 more)

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

### Community 80 - "LeadDetailPage"
Cohesion: 0.18
Nodes (23): AddLeadPage(), buildPayload(), handleSubmit(), validate(), leadToForm(), emdSummary(), LeadDetailPage(), handleDelete() (+15 more)

### Community 81 - "7. Leads — `/api/v1/leads`"
Cohesion: 0.22
Nodes (9): 7.1 Typical flow (step by step), 7.2 `POST /leads` — create lead, 7.3 `GET /leads` — list leads, 7.4 `GET /leads/:id` — lead detail, 7.5 `POST /leads/:id/documents` — upload one document, 7.6 `GET /leads/:id/documents/:docId` — download, 7.7 `DELETE /leads/:id/documents/:docId`, 7. Leads — `/api/v1/leads` (+1 more)

### Community 82 - "1. Getting started"
Cohesion: 0.22
Nodes (9): 1.1 Base URL, 1.2 Authentication flow (step by step), 1.3 Response envelope, 1.4 Errors and status codes, 1.5 Pagination, 1.6 Data conventions, 1.7 Roles and permissions, 1. Getting started (+1 more)

### Community 83 - "normalize.go"
Cohesion: 0.14
Nodes (38): canonDashboardActivity(), canonDashboardPlatform(), deriveStageDashboard(), isOurName(), parseCompetitors(), ParseRowDashboard(), parseTimeFraction(), timeOfDay() (+30 more)

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
Cohesion: 0.03
Nodes (23): ShortfallCandidate, DefaultIntegration(), CalendarException, DeadlineCoverage, GoogleCalendarIntegration, GoogleCalendarSyncLog, Holiday, NextActionableTask (+15 more)

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

### Community 100 - "Stage2PrimaryReviewWorkspace"
Cohesion: 0.22
Nodes (16): buildPresalesCands(), makeOemRow(), nextLocalId(), Stage2PrimaryReviewWorkspace(), Stage3Workspace(), ScopeProductsCard(), oemRowIds(), confirmedOems() (+8 more)

### Community 102 - "POST /api/v1/bids"
Cohesion: 0.40
Nodes (5): Error Codes, Example Request (Manual Mode), POST /api/v1/bids, Request Body, Response — 201 Created

### Community 103 - "POST /api/v1/tasks/{id}/activities"
Cohesion: 0.40
Nodes (5): Example — Call Logged, Example — Comment, POST /api/v1/tasks/{id}/activities, Request, Response — 201 Created

### Community 104 - "AuthMiddleware"
Cohesion: 0.20
Nodes (16): RegisterAlertRoutes(), RegisterAuthRoutes(), RegisterBidRoutes(), RegisterCalendarRoutes(), RegisterRoutes(), RegisterTicketRoutes(), RegisterLeadRoutes(), AuthMiddleware (+8 more)

### Community 105 - "bidService"
Cohesion: 0.15
Nodes (7): ApprovalLink(), approverDisplayName(), authorizeEditDecision(), closeOrCancelWords(), needsRMApproval(), outcomeLogText(), bidService

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

### Community 111 - "LeadDetailPage.jsx"
Cohesion: 0.17
Nodes (14): LeadStageBadge(), LeadStatusBadge(), LeadTypeBadge(), STAGES, AlertDialog(), AlertDialogAction(), AlertDialogCancel(), AlertDialogContent() (+6 more)

### Community 112 - "BidChecklistItem"
Cohesion: 0.23
Nodes (8): AddChecklistRequest, BidChecklistItem, BidResponse, ReorderChecklistRequest, buildBidResponse(), validateChecklistFields(), ReorderChecklistItem, TenderContact

### Community 113 - "LeadDocumentPicker.jsx"
Cohesion: 0.29
Nodes (10): CATEGORY_PRESETS, DropZone(), FileChip(), keepValid(), LeadDocumentPicker(), ACCEPTED_DOC_TYPES, emptyDocs(), formatBytes() (+2 more)

### Community 114 - "StageWorkspaces.jsx"
Cohesion: 0.08
Nodes (48): frontend_src_components_tenders_checklistreview, frontend_src_components_tenders_checklistreview_checklistreview, logChecklistHistory(), AssignPresalesModal(), buildEmdDetailsTableHtml(), buildTenderDetailHtml(), checkStageState(), CompleteStageModal() (+40 more)

### Community 115 - "bid/domain/models.go"
Cohesion: 0.22
Nodes (6): PricingSuggestion, IdentifierMatch, PendingApprovalError, PricingDeal, SetStageRestrictionsRequest, StageRestrictionsResponse

### Community 116 - "engineRouter"
Cohesion: 0.36
Nodes (8): NewCalendarHandler(), call(), engineRouter(), TestEngineStatusIsAdminOnly(), TestEngineStatusShape(), TestManualEvaluationIsRecordedAsManual(), github.com/gin-gonic/gin.Engine, net/http/httptest.ResponseRecorder

### Community 117 - "contactError"
Cohesion: 0.26
Nodes (4): contactError(), saveReceiptFile(), validateReceiptUpload(), BidHandler

### Community 118 - "Recorder"
Cohesion: 0.20
Nodes (8): NewAlertService(), NewAuthService(), NewGoogleSyncService(), EmailService, NewEmailService(), uniqueNonEmpty(), NewUserService(), Recorder

### Community 119 - "LeadWorkflow"
Cohesion: 0.50
Nodes (4): LeadWorkflow(), submit(), statusLine(), transitionLead()

### Community 120 - "CreateUserDialog"
Cohesion: 0.36
Nodes (5): CreateUserDialog(), handleClose(), handleSubmit(), resetForm(), validate()

### Community 121 - "sheetColumns.test.js"
Cohesion: 0.38
Nodes (3): EDITABLE_SHEET_COLUMNS, SHEET_COLUMNS, ref_node_test

### Community 122 - "ForceResetDialog"
Cohesion: 0.83
Nodes (4): ForceResetDialog(), handleClose(), handleConfirm(), forcePasswordReset()

### Community 123 - "InteractiveBoardDemo.jsx"
Cohesion: 0.33
Nodes (3): DEMO_BOARDS, InteractiveBoardDemo(), frontend_src_components_ui_skipersvgbeam_skipersvgbeam

### Community 125 - "vite.config.js"
Cohesion: 0.40
Nodes (4): path, @tailwindcss/vite, vite, @vitejs/plugin-react

### Community 131 - "service_test.go"
Cohesion: 0.33
Nodes (11): NewTicketService(), newFakeTicketRepo(), TestCreateTicket_NotifiesAndRemembers(), TestCreateTicket_StandardCategoryDoesNotTouchFieldMemory(), TestCreateTicket_Validation(), TestGetTicket_OwnershipEnforced(), TestGetTicketImagePath_OwnershipEnforced(), TestUpdateStatus_LogsAndNotifiesOnResolve() (+3 more)

### Community 132 - "xlsx.go"
Cohesion: 0.20
Nodes (17): atoiSafe(), colIndex(), ReadNamedSheet(), ReadSheet(), ReadSheetFrom(), readSheetFromZip(), readZipEntry(), resolveSheetTarget() (+9 more)

### Community 133 - "github.com/gin-gonic/gin.Context"
Cohesion: 0.16
Nodes (9): actorRoles(), BidHandler, mapServiceError(), hasRole(), parseListParams(), respondPage(), Error(), github.com/gin-gonic/gin.Context (+1 more)

### Community 134 - "Success"
Cohesion: 0.17
Nodes (8): actorPtr(), fail(), isAdmin(), maskIntegration(), oneOf(), Success(), Handler, CalendarHandler

### Community 135 - "BidService"
Cohesion: 0.07
Nodes (10): BidService, AddMemberRequest, UpdateBidRequest, MDDecisionRequest, RecordEMDPaymentRequest, SubmitMDApprovalRequest, TenderEMDResponse, UpdateBasicEMDRequest (+2 more)

### Community 136 - "WorkingCalendarService"
Cohesion: 0.12
Nodes (11): WorkingCalendarService, NewBackgroundScheduler(), NewWorkingCalendarService(), TestSchedulerIntervalUsesUnit(), TestSchedulerPicksUpCadenceChange(), CalculateDeadlineResult, EngineRuntime, EvaluationSummary (+3 more)

### Community 137 - "Repo"
Cohesion: 0.16
Nodes (4): CreateLeadRequest, Document, NewLeadHandler(), Repo

### Community 138 - "NotFound"
Cohesion: 0.13
Nodes (7): LeadHandler, randomHex(), userMessage(), actorOf(), fail(), NotFound(), UserHandler

### Community 145 - ".applyUpdate"
Cohesion: 0.21
Nodes (9): CreateBidRequest, hasAnyRole(), TestValidateTenderLink(), validateEMDDetails(), validateEMDExemption(), validateEMDMutualExclusivity(), validateTenderLink(), emdAwaitingApproval() (+1 more)

### Community 146 - "apiFetch"
Cohesion: 0.09
Nodes (36): RolesPermissionsDialog(), handleClose(), handleSave(), SettingsPage(), formatTime(), SystemLogsPage(), formatDateTime(), UserTable() (+28 more)

### Community 151 - "Lead"
Cohesion: 0.19
Nodes (11): Lead, Actor, Lead, approverID(), detailsHTML(), LeadHandler, leadName(), managerID() (+3 more)

### Community 153 - "PrimaryButton"
Cohesion: 0.40
Nodes (3): BentoTile(), handleMove(), PrimaryButton()

### Community 155 - "InternalError"
Cohesion: 0.09
Nodes (7): extractTokenFromHeader(), extractBearerToken(), InternalError(), Unauthorized(), Handler, AlertHandler, AuthHandler

### Community 156 - "DocsRepo"
Cohesion: 0.23
Nodes (5): TenderDocument, NewBidHandler(), DocsRepo, scanDoc(), pgx.Row

### Community 160 - "importer.go"
Cohesion: 0.09
Nodes (45): commit(), connect(), deref(), fmtDate(), fmtNum(), getEnv(), pgx.Conn, main() (+37 more)

### Community 165 - ".UpdateDocument"
Cohesion: 0.20
Nodes (10): cleanDocName(), folderSlug(), BidHandler, randomHex(), readTenderDoc(), safeName(), TestSafeNameAndSlug(), io.ReadSeeker (+2 more)

## Knowledge Gaps
- **585 isolated node(s):** `BIDDER_SUGGESTIONS`, `OEM_SUGGESTIONS`, `MAX_TENDER_DOC_BYTES`, `Access Token JWT Payload`, `Admin User` (+580 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 816 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **19 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `react` to `DocsTab.jsx`, `TenderDetailPage.jsx`, `Landing.jsx`, `TendersPage.jsx`, `LeadWorkflow.jsx`, `lucide-react`, `Dashboard.jsx`, `apiFetch`, `WorkingCalendarPage.jsx`, `package.json`, `ContactsTab.jsx`, `cn`, `AlertUsersPanel.jsx`, `EmdDetailsDialog.jsx`, `App.jsx`, `DocShortfall.jsx`, `ledgerTheme.js`, `PipelineConstellation.jsx`, `LeadDetailPage.jsx`, `LeadDocumentPicker.jsx`, `StageWorkspaces.jsx`, `InteractiveBoardDemo.jsx`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **Why does `1. Getting started` connect `1. Getting started` to `OneTrack GlobX — API Documentation`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **Why does `bid()` connect `1. Getting started` to `Stage2PrimaryReviewWorkspace`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **What connects `BIDDER_SUGGESTIONS`, `OEM_SUGGESTIONS`, `MAX_TENDER_DOC_BYTES` to the rest of the system?**
  _585 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `templates.go` be split into smaller, more focused modules?**
  _Cohesion score 0.08943089430894309 - nodes in this community are weakly interconnected._
- **Should `DocsTab.jsx` be split into smaller, more focused modules?**
  _Cohesion score 0.10420168067226891 - nodes in this community are weakly interconnected._
- **Should `context.Context` be split into smaller, more focused modules?**
  _Cohesion score 0.031853925096628016 - nodes in this community are weakly interconnected._