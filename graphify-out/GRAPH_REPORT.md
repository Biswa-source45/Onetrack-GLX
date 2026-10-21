# Graph Report - Onetrack-GlobX  (2026-10-15)

## Corpus Check
- 405 files · ~462,303 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 10 file(s) not represented in the graph (top: (none) 5, .css 2, .example 1)

## Summary
- 3345 nodes · 9650 edges · 159 communities (135 shown, 24 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 176 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `273f9f11`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- .BulkImport
- AddTenderPage.jsx
- context.Context
- WorkingCalendarRepository
- TenderDetailPage.jsx
- Landing.jsx
- fakeTicketRepo
- TendersPage.jsx
- StageWorkspaces.jsx
- time.Time
- Endpoints
- working_calendar_service_test.go
- FeedbackPage.jsx
- Alert
- BidWorkspace
- Endpoints
- Success
- Dashboard.jsx
- go_pkg_context
- go_pkg_encoding_json
- WorkingCalendarPage.jsx
- userService
- Files Changed
- encoding/json.RawMessage
- buildBidListItem
- testing.T
- authService
- Stage4Workspace
- dependencies
- go_pkg_fmt
- package.json
- calendar/handler/handler_test.go
- components.json
- ContactsTab.jsx
- JWTService
- cn
- BulkImportPage
- CreateUserSheet
- EmdDetailsDialog.jsx
- emdfix/main.go
- bid/domain/models.go
- LedgerRow
- bid_service.go
- Browser Session Management
- App.jsx
- devDependencies
- UserRepository
- Storage Management
- fakeBidRepo
- scripts
- .TransitionStage
- server/main.go
- compilerOptions
- Test generation (plan → generate → heal)
- Tracing
- github.com/onetrack/backend
- docShortfall.js
- CLAUDE.md
- .claude/CLAUDE.md
- ledgerTheme.js
- UserManagement.jsx
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
- apiFetch
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
- main
- bidService
- POST /api/v1/tasks/{id}/approve
- POST /api/v1/tasks/{id}/oem-followup
- POST /api/v1/bids/{id}/tasks/document
- POST /api/v1/bids/{id}/tasks
- React + Vite
- ChecklistTab.jsx
- alerts.js
- TicketResponse
- updateBid
- ticketService
- contacts_test.go
- contactError
- email.go
- TicketService
- CreateUserDialog
- sheetColumns.test.js
- TicketRepository
- InteractiveBoardDemo.jsx
- TicketStatusEvent
- vite.config.js
- list_exports.js
- service_test.go
- xlsx.go
- github.com/gin-gonic/gin.Context
- fail
- BidService
- WorkingCalendarService
- Lead
- LeadHandler
- bidService
- Forbidden
- UserSummary
- StageHistoryTab
- github.com/onetrack/backend/internal/bid/domain.TenderEMDAuditLog
- github.com/onetrack/backend/internal/bid/domain.TenderEMDDetails
- .applyUpdate
- AddTenderDialog.jsx
- ImportedBid
- Actor
- PrimaryButton
- BadRequest
- github.com/jackc/pgx/v5/pgxpool.Pool
- Preview
- importer_test.go
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
1. `Success()` - 97 edges
2. `cn()` - 95 edges
3. `apiFetch()` - 91 edges
4. `react` - 81 edges
5. `BadRequest()` - 66 edges
6. `lucide-react` - 64 edges
7. `InternalError()` - 62 edges
8. `fakeBidRepo` - 58 edges
9. `BidRepository` - 54 edges
10. `mockCalendarRepo` - 51 edges

## Surprising Connections (you probably didn't know these)
- `1.7 Roles and permissions` --references--> `bid()`  [INFERRED]
  API_DOCUMENTATION.md → frontend/src/lib/oem.test.js
- `The Ledger Stamp Mark (signature component)` --references--> `LedgerStampMark()`  [INFERRED]
  frontend/DESIGN.md → frontend/src/lib/ledgerMarks.jsx
- `Do:` --references--> `LedgerRow()`  [INFERRED]
  frontend/DESIGN.md → frontend/src/lib/LedgerRow.jsx
- `Hierarchy` --references--> `LedgerRow()`  [INFERRED]
  frontend/DESIGN.md → frontend/src/lib/LedgerRow.jsx
- `Layout` --references--> `LedgerRow()`  [INFERRED]
  frontend/DESIGN.md → frontend/src/lib/LedgerRow.jsx

## Import Cycles
- None detected.

## Communities (159 total, 24 thin omitted)

### Community 0 - ".BulkImport"
Cohesion: 0.20
Nodes (15): commit(), connect(), getEnv(), pgx.Conn, main(), blank(), EnrichDuplicates(), pgx.Row (+7 more)

### Community 1 - "AddTenderPage.jsx"
Cohesion: 0.12
Nodes (27): AddTenderPage(), handleSubmit(), nextStep(), validateStep(), BIDDER_SUGGESTIONS, OEM_SUGGESTIONS, FilePick(), EmdBgSection() (+19 more)

### Community 2 - "context.Context"
Cohesion: 0.06
Nodes (6): BidRepository, EMDTx, UpdateChecklistRequest, context.Context, TenderEMDAuditLog, TenderEMDDetails

### Community 3 - "WorkingCalendarRepository"
Cohesion: 0.05
Nodes (16): WorkingCalendarRepository, CalendarException, DeadlineCoverage, GoogleSyncService, GoogleCalendarIntegration, GoogleCalendarSyncLog, stubRepo, Holiday (+8 more)

### Community 4 - "TenderDetailPage.jsx"
Cohesion: 0.05
Nodes (69): ShortfallHistoryCard(), DocsTab(), fmtDate(), PreviewDialog(), saveBlob(), applyAlertNote(), EditTenderDialog(), handleSubmit() (+61 more)

### Community 5 - "Landing.jsx"
Cohesion: 0.09
Nodes (6): DEMO_SHEET_TENDERS, Landing(), MotionLink, ROLES, FaqSection(), LEDGER_STAGES

### Community 6 - "fakeTicketRepo"
Cohesion: 0.15
Nodes (4): Ticket, TicketStatusHistoryInsert, postgresTicketRepo, fakeTicketRepo

### Community 7 - "TendersPage.jsx"
Cohesion: 0.06
Nodes (60): ActivityLogDialog(), eventBadge(), ShortfallHistory(), ExportSuccessDialog(), ImportedPill(), InProgressPill(), COLUMNS, MasterSheetPage() (+52 more)

### Community 8 - "StageWorkspaces.jsx"
Cohesion: 0.11
Nodes (38): INITIAL_FORM, PERMISSION_CATEGORIES, PERMISSION_METADATA, ROLE_DETAILS, ACTIONS, APPROVER_ROLES, EVENT_LABELS, STEPS (+30 more)

### Community 9 - "time.Time"
Cohesion: 0.06
Nodes (53): TenderDeadlineCandidate, CalculateDeadlineResult, DeadlineCoverage, EngineRuntime, EvaluationSummary, LastRun, NextActionableTask, RedZoneNotificationResult (+45 more)

### Community 10 - "Endpoints"
Cohesion: 0.04
Nodes (46): 1. Health Check, 2. Login, 3. Refresh Token, 4. Logout, 5. Change Password, 6. Force Password Reset, Access Token JWT Payload, Admin User (+38 more)

### Community 11 - "working_calendar_service_test.go"
Cohesion: 0.15
Nodes (44): escalationAlerts(), escalationRepo(), inWindowTender(), isWorkingDay(), newMockCalendarRepo(), newSvc(), notifKey(), shortfallAlerts() (+36 more)

### Community 12 - "FeedbackPage.jsx"
Cohesion: 0.09
Nodes (37): CATEGORY_CLASSES, CATEGORY_FILTERS, CATEGORY_LABELS, formatTime(), SystemLogsPage(), ALLOWED_IMAGE_TYPES, FeedbackPage(), handleSubmit() (+29 more)

### Community 13 - "Alert"
Cohesion: 0.06
Nodes (11): Alert, AlertRepository, AlertService, SafeLink(), TestSafeLink(), NewAlertHandler(), NewPostgresAlertRepository(), fakeAlertSvc (+3 more)

### Community 14 - "BidWorkspace"
Cohesion: 0.16
Nodes (23): MDDecisionRequest, SubmitMDApprovalRequest, TenderEMDResponse, UpdateBasicEMDRequest, UpdateEMDRefundRequest, VerifyEMDPaymentRequest, BidWorkspace, defaultEMD() (+15 more)

### Community 15 - "Endpoints"
Cohesion: 0.05
Nodes (39): 1. Create User, 2. List Users, 3. Get My Profile, 4. Get User by ID, 5. Update User Profile, 6. Update User Status (Activate/Deactivate), 7. Update User Roles, 8. Update Permission Overrides (+31 more)

### Community 16 - "Success"
Cohesion: 0.11
Nodes (8): BidHandler, parseIntQuery(), Conflict(), InternalError(), NotFound(), Success(), AlertHandler, UserHandler

### Community 17 - "Dashboard.jsx"
Cohesion: 0.06
Nodes (58): AnalyticsPage(), CATEGORY_COLORS, ROLE_BADGES, STAGE_COLORS, STAGE_LABELS, EmdProjectionBlock(), getTenderDeadline(), isActivePipeline() (+50 more)

### Community 18 - "go_pkg_context"
Cohesion: 0.12
Nodes (13): TestValidateImageUpload(), validateImageUpload(), ForgotPasswordRequest, Permission, RefreshRequest, ResetPasswordOTPRequest, VerifyOTPRequest, go_pkg_context (+5 more)

### Community 19 - "go_pkg_encoding_json"
Cohesion: 0.13
Nodes (14): Repository, Service, Event, EventItem, ListQuery, Page, Handler, NewHandler() (+6 more)

### Community 20 - "WorkingCalendarPage.jsx"
Cohesion: 0.10
Nodes (45): COVERAGE_COLS, CURRENT_YEAR, DEADLINE_PRESETS, DEADLINE_UNITS, describeRun(), EMPTY_HOLIDAY_FORM, EngineStatusCard(), fmtTime() (+37 more)

### Community 21 - "userService"
Cohesion: 0.11
Nodes (11): UserService, CreateUserRequest, UpdatePermissionsRequest, UpdateRolesRequest, UpdateStatusRequest, UpdateUserRequest, UserListResponse, UserResponse (+3 more)

### Community 22 - "Files Changed"
Cohesion: 0.09
Nodes (22): 1. New column on `bid.bid_workspaces`, 2. New table `bid.bid_checklists`, API Changes Summary, Changes, Database Migration, Files Changed, `GET /api/v1/bids/:id/checklists`, `GET /api/v1/bids/:id` — updated response (+14 more)

### Community 23 - "encoding/json.RawMessage"
Cohesion: 0.07
Nodes (20): AddMicroEventRequest, AuditLogPage, AuditLogQuery, StageHistoryPage, StageHistoryResponse, auditPageSize(), decodeAuditCursor(), encodeAuditCursor() (+12 more)

### Community 24 - "buildBidListItem"
Cohesion: 0.14
Nodes (11): BidListItem, BidListResponse, ListBidsParams, scanBid(), scanBidFields(), scanBidFromRows(), buildBidListItem(), calcDaysRemaining() (+3 more)

### Community 25 - "testing.T"
Cohesion: 0.10
Nodes (36): NewBidService(), floatPtr(), hasAlertType(), intPtr(), lastEventType(), newLedgerTestBid(), TestAddRemoveMember_LogActions(), TestArchiveRestoreDeleteBid_LogActions() (+28 more)

### Community 26 - "authService"
Cohesion: 0.12
Nodes (8): AuthService, ChangePasswordRequest, ForceResetRequest, LoginRequest, LoginResponse, NewAuthHandler(), UserInfo, authService

### Community 27 - "Stage4Workspace"
Cohesion: 0.28
Nodes (14): buildRemarkCalloutHtml(), buildValuesAdjustedBannerHtml(), computeL1PricingSummary(), escHtml(), fmtMoneyFull(), Stage4Workspace(), buybackDraft(), buybackLines() (+6 more)

### Community 28 - "dependencies"
Cohesion: 0.08
Nodes (26): dependencies, canvas-confetti, class-variance-authority, clsx, docx-preview, exceljs, @fontsource-variable/instrument-sans, @fontsource-variable/inter (+18 more)

### Community 29 - "go_pkg_fmt"
Cohesion: 0.12
Nodes (27): FolderSlug(), safeName(), strp(), TestFolderSlugAndSafeName(), TestNormalize(), TestValidateDocument(), validateDocument(), TransitionRequest (+19 more)

### Community 30 - "package.json"
Cohesion: 0.09
Nodes (23): name, private, type, version, canvas-confetti, clsx, docx-preview, eslint (+15 more)

### Community 31 - "calendar/handler/handler_test.go"
Cohesion: 0.11
Nodes (22): f64p(), intp(), strp(), TestUpdateCalendarRequestValidate(), isRealAPIKey(), call(), engineRouter(), TestEngineStatusIsAdminOnly() (+14 more)

### Community 32 - "components.json"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 33 - "ContactsTab.jsx"
Cohesion: 0.15
Nodes (29): ContactDialog(), ContactsSummary(), ContactsTab(), FIELDS, OemContactCell(), ReasonDialog(), applyPlan(), blankContact() (+21 more)

### Community 34 - "JWTService"
Cohesion: 0.15
Nodes (7): JWTService, TokenClaims, TokenPair, redis.Client, NewJWTService(), stubJWT, jwtService

### Community 35 - "cn"
Cohesion: 0.06
Nodes (53): getHue(), getInitials(), UserAvatar(), emdSummary(), Accordion(), AccordionContent(), AccordionItem(), AccordionTrigger() (+45 more)

### Community 36 - "BulkImportPage"
Cohesion: 0.38
Nodes (7): BulkImportPage(), handleCommit(), handleFile(), commitLines(), errorLines(), previewLines(), bulkImportTenders()

### Community 37 - "CreateUserSheet"
Cohesion: 0.29
Nodes (6): CreateUserSheet(), handleSubmit(), onKeyDown(), requestClose(), resetForm(), validate()

### Community 38 - "EmdDetailsDialog.jsx"
Cohesion: 0.12
Nodes (30): EmdApprovalDialog(), ACTION_STYLE, EmdAuditDialog(), fmtDate(), EmdDetailsDialog(), fmtDate(), SECTIONS, EmdLifecycleCard() (+22 more)

### Community 39 - "emdfix/main.go"
Cohesion: 0.12
Nodes (20): boolOr(), env(), fmtF(), main(), strOr(), env(), main(), printSection() (+12 more)

### Community 40 - "bid/domain/models.go"
Cohesion: 0.09
Nodes (25): RecordEMDPaymentRequest, PricingSuggestion, digitsOnly(), phoneKey(), ChallanPaymentDetails, ChequePaymentDetails, DepositorDetailsDTO, IdentifierMatch (+17 more)

### Community 41 - "LedgerRow"
Cohesion: 0.12
Nodes (20): Colors, Deep Panel (login left panel only), Design System: OneTrack — The Ledger, Do:, Do's and Don'ts, Don't:, Elevation & Depth, Hierarchy (+12 more)

### Community 42 - "bid_service.go"
Cohesion: 0.08
Nodes (28): CreateBidRequest, alertNoteHTML(), extractProductFields(), fieldLabel(), fieldSuggestionEntries(), money(), ownershipChangeSummaryHTML(), pickL1PricingQuote() (+20 more)

### Community 43 - "Browser Session Management"
Cohesion: 0.10
Nodes (20): 1. Name Browser Sessions Semantically, 2. Always Clean Up, 3. Delete Stale Browser Data, A/B Testing Sessions, Attach by channel name, Attach via browser extension, Attach via CDP endpoint, Attaching to a Running Browser (+12 more)

### Community 44 - "App.jsx"
Cohesion: 0.11
Nodes (20): App(), ExcludeRoleGuard(), PermissionGuard(), RoleGuard(), useDebounce(), UserManagement(), LeadStageBadge(), LeadStatusBadge() (+12 more)

### Community 45 - "devDependencies"
Cohesion: 0.20
Nodes (10): devDependencies, eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals, @types/react, @types/react-dom (+2 more)

### Community 46 - "UserRepository"
Cohesion: 0.04
Nodes (11): AuthRepository, Role, User, UserPermissionOverride, NewPostgresAuthRepository(), UserRepository, ListUsersParams, mapKeys() (+3 more)

### Community 47 - "Storage Management"
Cohesion: 0.11
Nodes (18): Authentication State Reuse, Clear sessionStorage, Common Patterns, Delete Database, Delete Single Item, Get Single Value, IndexedDB, List All sessionStorage Items (+10 more)

### Community 48 - "fakeBidRepo"
Cohesion: 0.03
Nodes (15): PricingWorkspaceRow, BidChecklist, FieldSuggestion, MemberResponse, PendingApproval, RecordOutcomeRequest, TenderEditApproval, TenderOwnerPerformanceStat (+7 more)

### Community 49 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, lint, preview

### Community 50 - ".TransitionStage"
Cohesion: 0.31
Nodes (7): TransitionResult, TransitionStageRequest, getRoleForStage(), GetAllowedTransitions(), IsTerminalStage(), IsTransitionAllowed(), skipEMDStage()

### Community 51 - "server/main.go"
Cohesion: 0.06
Nodes (39): TestValidateTenderDoc(), validateTenderDoc(), getEnv(), Load(), redis.Client, NewRedisClient(), Config, DatabaseConfig (+31 more)

### Community 52 - "compilerOptions"
Cohesion: 0.50
Nodes (3): compilerOptions, baseUrl, paths

### Community 53 - "Test generation (plan → generate → heal)"
Cohesion: 0.12
Nodes (17): 0. How generation works, 1.1 Prerequisite: workspace, 1.2 Prerequisite: seed test, 1.3 Explore the app, 1.4 Write the spec file, 1. Planning, 2.1 Inputs, 2.2 Generate one scenario (+9 more)

### Community 54 - "Tracing"
Cohesion: 0.12
Nodes (16): 1. Start Tracing Before the Problem, 2. Clean Up Old Traces, Analyzing Performance, Basic Usage, Best Practices, Capturing Evidence, Debugging Failed Actions, Limitations (+8 more)

### Community 56 - "docShortfall.js"
Cohesion: 0.22
Nodes (20): esc(), ShortfallPanel(), Stage10Workspace(), addRound(), approverChoices(), awaitingReeval(), docCounts(), docId() (+12 more)

### Community 59 - "ledgerTheme.js"
Cohesion: 0.35
Nodes (5): LedgerStampMark(), ledger, ledgerFont, BUILDINGS, LoginSkyline()

### Community 60 - "UserManagement.jsx"
Cohesion: 0.06
Nodes (45): FORMATS, STAGE_LABELS, STAGE_ORDER, backdropVariants, closeButtonVariants, INITIAL_FORM, panelVariants, EditUserDialog() (+37 more)

### Community 61 - "emd_service_test.go"
Cohesion: 0.26
Nodes (20): boolPtr(), strPtr(), float64Ptr(), newEMDTestSetup(), onlinePayment(), TestChecklist_ToggleKeepsStatusInSync(), TestChecklist_ValidatesPriorityAndStatus(), TestEMD_BasicUpdateCannotTouchStatusAndLocksWhilePending() (+12 more)

### Community 62 - "TenderContact"
Cohesion: 0.10
Nodes (15): ReorderContactItem, ReorderContactsRequest, SaveContactRequest, TenderContact, UpdateContactRequest, contactErr(), pgx.Row, postgresBidRepo (+7 more)

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

### Community 80 - "apiFetch"
Cohesion: 0.08
Nodes (53): SettingsPage(), AlertsPage(), AddLeadPage(), buildPayload(), handleSubmit(), validate(), leadToForm(), STATUS_OPTIONS (+45 more)

### Community 81 - "7. Leads — `/api/v1/leads`"
Cohesion: 0.22
Nodes (9): 7.1 Typical flow (step by step), 7.2 `POST /leads` — create lead, 7.3 `GET /leads` — list leads, 7.4 `GET /leads/:id` — lead detail, 7.5 `POST /leads/:id/documents` — upload one document, 7.6 `GET /leads/:id/documents/:docId` — download, 7.7 `DELETE /leads/:id/documents/:docId`, 7. Leads — `/api/v1/leads` (+1 more)

### Community 82 - "1. Getting started"
Cohesion: 0.22
Nodes (9): 1.1 Base URL, 1.2 Authentication flow (step by step), 1.3 Response envelope, 1.4 Errors and status codes, 1.5 Pagination, 1.6 Data conventions, 1.7 Roles and permissions, 1. Getting started (+1 more)

### Community 83 - "normalize.go"
Cohesion: 0.23
Nodes (29): canonDashboardActivity(), canonDashboardPlatform(), deriveStageDashboard(), isOurName(), parseCompetitors(), ParseRowDashboard(), parseTimeFraction(), timeOfDay() (+21 more)

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
Cohesion: 0.04
Nodes (14): ShortfallCandidate, DefaultIntegration(), CalendarException, GoogleCalendarIntegration, GoogleCalendarSyncLog, Holiday, SyncResult, UpdateChecklistPriorityRequest (+6 more)

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
Cohesion: 0.20
Nodes (17): buildPresalesCands(), fmtEmdSummary(), makeOemRow(), nextLocalId(), Stage2PrimaryReviewWorkspace(), Stage3Workspace(), ScopeProductsCard(), oemRowIds() (+9 more)

### Community 102 - "POST /api/v1/bids"
Cohesion: 0.40
Nodes (5): Error Codes, Example Request (Manual Mode), POST /api/v1/bids, Request Body, Response — 201 Created

### Community 103 - "POST /api/v1/tasks/{id}/activities"
Cohesion: 0.40
Nodes (5): Example — Call Logged, Example — Comment, POST /api/v1/tasks/{id}/activities, Request, Response — 201 Created

### Community 104 - "main"
Cohesion: 0.13
Nodes (23): main(), RegisterAlertRoutes(), RegisterAuthRoutes(), NewAuthService(), RegisterBidRoutes(), RegisterCalendarRoutes(), NewGoogleSyncService(), RegisterTicketRoutes() (+15 more)

### Community 105 - "bidService"
Cohesion: 0.10
Nodes (16): AddChecklistRequest, BidChecklistItem, BidResponse, ReorderChecklistRequest, UserSummary, approverDisplayName(), buildBidResponse(), closeOrCancelWords() (+8 more)

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
Cohesion: 0.13
Nodes (26): ChecklistTab(), logChecklistHistory(), OEM_PILL_COLORS, getOemFollowUps(), OEMFollowUpModal(), addSection(), cellBorder, cleanTitle() (+18 more)

### Community 112 - "alerts.js"
Cohesion: 0.28
Nodes (15): buildEmdDetailsTableHtml(), buildTenderDetailHtml(), fmtDate(), fmtDateTime(), fmtMoney(), InternalApprovalDialog(), Stage1Workspace(), Stage6Workspace() (+7 more)

### Community 113 - "TicketResponse"
Cohesion: 0.20
Nodes (6): CreateTicketRequest, TicketResponse, scanTicket(), Decode(), Encode(), PageSize()

### Community 114 - "updateBid"
Cohesion: 0.22
Nodes (14): AssignPresalesModal(), CompleteStageModal(), EmdDecisionModal(), EmdReturnWorkspace(), logStageInteraction(), NoGoModal(), ReVerificationModal(), Stage11Workspace() (+6 more)

### Community 115 - "ticketService"
Cohesion: 0.29
Nodes (4): FieldMemory, ListTicketsParams, TicketListPage, ticketService

### Community 116 - "contacts_test.go"
Cohesion: 0.42
Nodes (9): add(), contactSvc(), no(), TestContactBanNeedsAReasonAndUnbanClearsIt(), TestContactDuplicatesAreRefusedAndNamed(), TestContactMoveReorderAndDelete(), TestContactUpdateKeepsOwnEmailButNotAnotherOnes(), TestContactValidation() (+1 more)

### Community 118 - "email.go"
Cohesion: 0.31
Nodes (6): NewAlertService(), EmailService, NewEmailService(), uniqueNonEmpty(), go_pkg_crypto_tls, go_pkg_net_smtp

### Community 119 - "TicketService"
Cohesion: 0.25
Nodes (3): TicketService, UpdateTicketStatusRequest, NewTicketHandler()

### Community 120 - "CreateUserDialog"
Cohesion: 0.36
Nodes (5): CreateUserDialog(), handleClose(), handleSubmit(), resetForm(), validate()

### Community 121 - "sheetColumns.test.js"
Cohesion: 0.32
Nodes (4): EDITABLE_SHEET_COLUMNS, SHEET_COLUMNS, ref_node_assert, ref_node_test

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
Cohesion: 0.18
Nodes (8): actorRoles(), BidHandler, mapServiceError(), parseListParams(), respondPage(), Error(), Handler, github.com/gin-gonic/gin.Context

### Community 134 - "fail"
Cohesion: 0.18
Nodes (6): actorPtr(), fail(), isAdmin(), maskIntegration(), oneOf(), CalendarHandler

### Community 135 - "BidService"
Cohesion: 0.07
Nodes (9): BidService, AddMemberRequest, MDDecisionRequest, RecordEMDPaymentRequest, SubmitMDApprovalRequest, TenderEMDResponse, UpdateBasicEMDRequest, UpdateEMDRefundRequest (+1 more)

### Community 136 - "WorkingCalendarService"
Cohesion: 0.11
Nodes (12): WorkingCalendarService, NewCalendarHandler(), NewBackgroundScheduler(), NewWorkingCalendarService(), TestSchedulerIntervalUsesUnit(), TestSchedulerPicksUpCadenceChange(), CalculateDeadlineResult, EngineRuntime (+4 more)

### Community 137 - "Lead"
Cohesion: 0.11
Nodes (13): CreateLeadRequest, Document, Lead, NewLeadHandler(), approverID(), detailsHTML(), leadName(), managerID() (+5 more)

### Community 138 - "LeadHandler"
Cohesion: 0.20
Nodes (6): LeadHandler, randomHex(), userMessage(), actorOf(), fail(), LeadHandler

### Community 140 - "Forbidden"
Cohesion: 0.16
Nodes (6): hasRole(), extractBearerToken(), hasPermission(), Forbidden(), github.com/gin-gonic/gin.HandlerFunc, TicketHandler

### Community 142 - "StageHistoryTab"
Cohesion: 0.25
Nodes (15): ComplianceCard(), extractCommercialDetails(), fmt(), fmtMoney(), formatFullDateTime(), getBidEndDate(), getBidStartDate(), getEventTypeBadge() (+7 more)

### Community 145 - ".applyUpdate"
Cohesion: 0.15
Nodes (19): ApprovalLink(), StageLink(), TenderLink(), FieldDiff, UpdateBidRequest, authorizeEditDecision(), checkDocShortfall(), derefFloat() (+11 more)

### Community 146 - "AddTenderDialog.jsx"
Cohesion: 0.15
Nodes (12): AddTenderDialog(), BID_TYPES, EMD_TYPES, inputCls(), ManualForm(), handleSubmit(), loadUsers(), validate() (+4 more)

### Community 147 - "ImportedBid"
Cohesion: 0.25
Nodes (5): deref(), fmtDate(), fmtNum(), writeReport(), ImportedBid

### Community 153 - "PrimaryButton"
Cohesion: 0.40
Nodes (3): BentoTile(), handleMove(), PrimaryButton()

### Community 155 - "BadRequest"
Cohesion: 0.27
Nodes (4): extractTokenFromHeader(), BadRequest(), Unauthorized(), AuthHandler

### Community 156 - "github.com/jackc/pgx/v5/pgxpool.Pool"
Cohesion: 0.10
Nodes (16): TenderDocument, NewBidHandler(), NewBulkImportHandler(), DocsRepo, NewDocsRepo(), scanDoc(), NewPostgresBidRepository(), NewPostgresCalendarRepository() (+8 more)

### Community 160 - "Preview"
Cohesion: 0.14
Nodes (23): printSummary(), summarise(), buildPreview(), CheckHeaders(), checkHeadersAgainst(), dashboardRowParser(), derefStr(), findDuplicates() (+15 more)

### Community 161 - "importer_test.go"
Cohesion: 0.31
Nodes (9): ParseWorkbook(), f64(), findRow(), TestDashboardDeterministicAcrossRuns(), TestDashboardUnrecordedResultsAreClosedNotLost(), TestExemptedRowsCarryAnExemptionType(), TestGBXDuplicateRowsAreSkippedNotSummed(), TestGBXInconclusiveOutcomeIsClosedNotLost() (+1 more)

### Community 165 - ".UpdateDocument"
Cohesion: 0.18
Nodes (12): cleanDocName(), folderSlug(), BidHandler, randomHex(), readTenderDoc(), safeName(), TestSafeNameAndSlug(), saveReceiptFile() (+4 more)

## Knowledge Gaps
- **585 isolated node(s):** `Contents`, `1.1 Base URL`, `1.2 Authentication flow (step by step)`, `1.3 Response envelope`, `1.4 Errors and status codes` (+580 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 800 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **24 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `main()` connect `main` to `JWTService`, `service_test.go`, `TicketRepository`, `WorkingCalendarService`, `Lead`, `Alert`, `UserRepository`, `server/main.go`, `encoding/json.RawMessage`, `go_pkg_encoding_json`, `email.go`, `TicketService`, `userService`, `testing.T`, `authService`, `github.com/jackc/pgx/v5/pgxpool.Pool`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **Why does `bid()` connect `1. Getting started` to `Stage2PrimaryReviewWorkspace`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **What connects `Contents`, `1.1 Base URL`, `1.2 Authentication flow (step by step)` to the rest of the system?**
  _585 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `AddTenderPage.jsx` be split into smaller, more focused modules?**
  _Cohesion score 0.12121212121212122 - nodes in this community are weakly interconnected._
- **Should `context.Context` be split into smaller, more focused modules?**
  _Cohesion score 0.05834464043419267 - nodes in this community are weakly interconnected._
- **Should `WorkingCalendarRepository` be split into smaller, more focused modules?**
  _Cohesion score 0.047058823529411764 - nodes in this community are weakly interconnected._
- **Should `TenderDetailPage.jsx` be split into smaller, more focused modules?**
  _Cohesion score 0.0483609217786433 - nodes in this community are weakly interconnected._