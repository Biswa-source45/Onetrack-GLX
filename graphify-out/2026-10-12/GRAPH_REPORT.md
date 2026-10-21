# Graph Report - Onetrack-GlobX  (2026-10-12)

## Corpus Check
- 375 files · ~443,349 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 9 file(s) not represented in the graph (top: (none) 5, .css 2, .example 1)

## Summary
- 3119 nodes · 8878 edges · 157 communities (126 shown, 31 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 165 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `cdcafbca`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- importer.go
- cn
- context.Context
- WorkingCalendarRepository
- AddLeadPage.jsx
- Landing.jsx
- TicketResponse
- TendersPage.jsx
- react
- working_calendar_service.go
- Endpoints
- working_calendar_service_test.go
- FeedbackPage.jsx
- Alert
- BidWorkspace
- Endpoints
- github.com/gin-gonic/gin.Context
- Dashboard.jsx
- go_pkg_time
- go_pkg_encoding_json
- WorkingCalendarPage.jsx
- UserRepository
- Files Changed
- github.com/jackc/pgx/v5/pgxpool.Pool
- bidService
- bid_service_test.go
- authService
- StageWorkspaces.jsx
- dependencies
- go_pkg_errors
- package.json
- calendar/handler/handler_test.go
- components.json
- ChecklistTab.jsx
- JWTService
- docShortfall.js
- BulkImportPage
- CreateUserSheet
- EmdDetailsDialog.jsx
- emdfix/main.go
- go_pkg_context
- LedgerRow
- bid_service.go
- Browser Session Management
- Lead
- devDependencies
- tooltip.jsx
- Storage Management
- fakeBidRepo
- scripts
- .TransitionStage
- TenderDetailPage.jsx
- compilerOptions
- Test generation (plan → generate → heal)
- Tracing
- github.com/onetrack/backend
- main
- CLAUDE.md
- .claude/CLAUDE.md
- ledgerTheme.js
- apiFetch
- emd_service_test.go
- config.go
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
- LeadDetailPage.jsx
- 7. Leads — `/api/v1/leads`
- 1. Getting started
- AuditLogQuery
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
- go_pkg_github_com_onetrack_backend_internal_calendar_handler
- go_pkg_github_com_onetrack_backend_internal_calendar_repository
- POST /api/v1/bids
- POST /api/v1/tasks/{id}/activities
- alerts.js
- vite.config.js
- POST /api/v1/tasks/{id}/approve
- POST /api/v1/tasks/{id}/oem-followup
- POST /api/v1/bids/{id}/tasks/document
- POST /api/v1/bids/{id}/tasks
- React + Vite
- StageHistoryTab
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
- list_exports.js
- service_test.go
- AddTenderPage
- emdaudit/main.go
- updateBid
- BidService
- WorkingCalendarService
- RolesPermissionsDialog
- testing.T
- PrimaryButton
- usePermissions
- UserSummary
- postgresCalendarRepo
- github.com/onetrack/backend/internal/bid/domain.TenderEMDAuditLog
- github.com/onetrack/backend/internal/bid/domain.TenderEMDDetails
- .applyUpdate
- calendar/domain/models.go
- time.Time
- WorkingCalendar
- diffBidFields
- GoogleCalendarIntegration
- CreateUserDialog
- updateUserProfile
- emd_models.go
- fieldSuggestionEntries
- StageLink
- pgx.Row

## God Nodes (most connected - your core abstractions)
1. `cn()` - 95 edges
2. `Success()` - 88 edges
3. `apiFetch()` - 84 edges
4. `react` - 78 edges
5. `lucide-react` - 62 edges
6. `bidService` - 61 edges
7. `BadRequest()` - 59 edges
8. `fakeBidRepo` - 59 edges
9. `InternalError()` - 58 edges
10. `mockCalendarRepo` - 51 edges

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

## Communities (157 total, 31 thin omitted)

### Community 0 - "importer.go"
Cohesion: 0.05
Nodes (96): commit(), connect(), getEnv(), pgx.Conn, main(), printSummary(), summarise(), canonDashboardActivity() (+88 more)

### Community 1 - "cn"
Cohesion: 0.07
Nodes (41): getHue(), getInitials(), UserAvatar(), Accordion(), AccordionContent(), AccordionItem(), AccordionTrigger(), AlertDialog() (+33 more)

### Community 2 - "context.Context"
Cohesion: 0.04
Nodes (13): AuthRepository, Role, User, UserPermissionOverride, BidRepository, UserSummary, FieldSuggestion, ReorderChecklistItem (+5 more)

### Community 3 - "WorkingCalendarRepository"
Cohesion: 0.05
Nodes (16): WorkingCalendarRepository, CalendarException, DeadlineCoverage, GoogleSyncService, GoogleCalendarIntegration, GoogleCalendarSyncLog, stubRepo, Holiday (+8 more)

### Community 4 - "AddLeadPage.jsx"
Cohesion: 0.08
Nodes (40): CATEGORY_CLASSES, CATEGORY_FILTERS, CATEGORY_LABELS, STATUS_OPTIONS, UserSelect(), AddTenderDialog(), BID_TYPES, EMD_TYPES (+32 more)

### Community 5 - "Landing.jsx"
Cohesion: 0.09
Nodes (7): DEMO_SHEET_TENDERS, Landing(), MotionLink, ROLES, FaqSection(), InteractiveBoardDemo(), LEDGER_STAGES

### Community 6 - "TicketResponse"
Cohesion: 0.05
Nodes (18): FieldMemory, TicketRepository, TicketService, CreateTicketRequest, ListTicketsParams, Ticket, TicketListPage, TicketResponse (+10 more)

### Community 7 - "TendersPage.jsx"
Cohesion: 0.07
Nodes (56): ActivityLogDialog(), eventBadge(), ExportSuccessDialog(), ImportedPill(), InProgressPill(), COLUMNS, MasterSheetPage(), handleExport() (+48 more)

### Community 8 - "react"
Cohesion: 0.10
Nodes (41): FORMATS, STAGE_LABELS, STAGE_ORDER, INITIAL_FORM, backdropVariants, closeButtonVariants, INITIAL_FORM, panelVariants (+33 more)

### Community 9 - "working_calendar_service.go"
Cohesion: 0.16
Nodes (19): TriggerDays(), workingCalendarService, dayDesc(), dayHoursOf(), deref(), fmtNum(), workingCalendarService, ordinal() (+11 more)

### Community 10 - "Endpoints"
Cohesion: 0.04
Nodes (46): 1. Health Check, 2. Login, 3. Refresh Token, 4. Logout, 5. Change Password, 6. Force Password Reset, Access Token JWT Payload, Admin User (+38 more)

### Community 11 - "working_calendar_service_test.go"
Cohesion: 0.15
Nodes (43): NewBackgroundScheduler(), NewWorkingCalendarService(), escalationAlerts(), escalationRepo(), inWindowTender(), newMockCalendarRepo(), newSvc(), shortfallAlerts() (+35 more)

### Community 12 - "FeedbackPage.jsx"
Cohesion: 0.12
Nodes (27): ALLOWED_IMAGE_TYPES, FeedbackPage(), handleSubmit(), loadMyTickets(), removeImage(), formatDate(), formatWhen(), TicketDetailDialog() (+19 more)

### Community 13 - "Alert"
Cohesion: 0.06
Nodes (11): Alert, AlertRepository, AlertService, SafeLink(), TestSafeLink(), NewAlertHandler(), NewPostgresAlertRepository(), fakeAlertSvc (+3 more)

### Community 14 - "BidWorkspace"
Cohesion: 0.15
Nodes (22): MDDecisionRequest, SubmitMDApprovalRequest, TenderEMDResponse, UpdateBasicEMDRequest, UpdateEMDRefundRequest, VerifyEMDPaymentRequest, BidWorkspace, defaultEMD() (+14 more)

### Community 15 - "Endpoints"
Cohesion: 0.05
Nodes (39): 1. Create User, 2. List Users, 3. Get My Profile, 4. Get User by ID, 5. Update User Profile, 6. Update User Status (Activate/Deactivate), 7. Update User Roles, 8. Update Permission Overrides (+31 more)

### Community 16 - "github.com/gin-gonic/gin.Context"
Cohesion: 0.05
Nodes (40): extractTokenFromHeader(), actorRoles(), BidHandler, mapServiceError(), saveReceiptFile(), validateReceiptUpload(), parseIntQuery(), actorPtr() (+32 more)

### Community 17 - "Dashboard.jsx"
Cohesion: 0.09
Nodes (41): AnalyticsPage(), CATEGORY_COLORS, ROLE_BADGES, STAGE_COLORS, STAGE_LABELS, EmdProjectionBlock(), getTenderDeadline(), isActivePipeline() (+33 more)

### Community 18 - "go_pkg_time"
Cohesion: 0.14
Nodes (17): deref(), fmtDate(), fmtNum(), writeReport(), f64p(), intp(), strp(), TestUpdateCalendarRequestValidate() (+9 more)

### Community 19 - "go_pkg_encoding_json"
Cohesion: 0.16
Nodes (12): Repository, Service, EventItem, ListQuery, Page, Handler, NewHandler(), NewPostgresRepository() (+4 more)

### Community 20 - "WorkingCalendarPage.jsx"
Cohesion: 0.10
Nodes (45): COVERAGE_COLS, CURRENT_YEAR, DEADLINE_PRESETS, DEADLINE_UNITS, describeRun(), EMPTY_HOLIDAY_FORM, EngineStatusCard(), fmtTime() (+37 more)

### Community 21 - "UserRepository"
Cohesion: 0.07
Nodes (13): UserRepository, UserService, CreateUserRequest, ListUsersParams, UpdatePermissionsRequest, UpdateRolesRequest, UpdateStatusRequest, UpdateUserRequest (+5 more)

### Community 22 - "Files Changed"
Cohesion: 0.09
Nodes (22): 1. New column on `bid.bid_workspaces`, 2. New table `bid.bid_checklists`, API Changes Summary, Changes, Database Migration, Files Changed, `GET /api/v1/bids/:id/checklists`, `GET /api/v1/bids/:id` — updated response (+14 more)

### Community 23 - "github.com/jackc/pgx/v5/pgxpool.Pool"
Cohesion: 0.05
Nodes (27): NewPostgresAuthRepository(), NewBulkImportHandler(), NewPostgresBidRepository(), NewPostgresCalendarRepository(), CreateLeadRequest, Document, NewLeadHandler(), Repo (+19 more)

### Community 24 - "bidService"
Cohesion: 0.17
Nodes (7): approverDisplayName(), closeOrCancelWords(), needsRMApproval(), outcomeLogText(), parseCancelPayload(), bidService, cancelPayload

### Community 25 - "bid_service_test.go"
Cohesion: 0.16
Nodes (26): NewBidService(), boolPtr(), floatPtr(), hasAlertType(), intPtr(), lastEventType(), newLedgerTestBid(), TestAddRemoveMember_LogActions() (+18 more)

### Community 26 - "authService"
Cohesion: 0.12
Nodes (8): AuthService, ChangePasswordRequest, ForceResetRequest, LoginRequest, LoginResponse, NewAuthHandler(), UserInfo, authService

### Community 27 - "StageWorkspaces.jsx"
Cohesion: 0.07
Nodes (29): frontend_src_components_tenders_checklistreview, frontend_src_components_tenders_checklistreview_checklistreview, RaiseShortfallDialog(), frontend_src_components_tenders_postbidcontacts, frontend_src_components_tenders_postbidcontacts_postbidcontactsform, frontend_src_components_tenders_postbidcontacts_postbidcontactsview, buildPresalesCands(), checkStageState() (+21 more)

### Community 28 - "dependencies"
Cohesion: 0.08
Nodes (25): dependencies, canvas-confetti, class-variance-authority, clsx, exceljs, @fontsource-variable/instrument-sans, @fontsource-variable/inter, framer-motion (+17 more)

### Community 29 - "go_pkg_errors"
Cohesion: 0.11
Nodes (26): TestValidateImageUpload(), validateImageUpload(), FolderSlug(), safeName(), strp(), TestFolderSlugAndSafeName(), TestNormalize(), TestValidateDocument() (+18 more)

### Community 30 - "package.json"
Cohesion: 0.10
Nodes (22): name, private, type, version, canvas-confetti, clsx, eslint, @eslint/js (+14 more)

### Community 31 - "calendar/handler/handler_test.go"
Cohesion: 0.22
Nodes (13): isRealAPIKey(), call(), engineRouter(), TestEngineStatusIsAdminOnly(), TestEngineStatusShape(), TestIsRealAPIKeyRejectsPlaceholders(), TestManualEvaluationIsRecordedAsManual(), TestMaskIntegrationNeverExposesKey() (+5 more)

### Community 32 - "components.json"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 33 - "ChecklistTab.jsx"
Cohesion: 0.15
Nodes (23): ChecklistTab(), OEM_PILL_COLORS, addSection(), cellBorder, cleanTitle(), exportChecklistToExcel(), OEM_HEADER_BG, OEM_HEADER_FG (+15 more)

### Community 34 - "JWTService"
Cohesion: 0.15
Nodes (7): JWTService, TokenClaims, TokenPair, redis.Client, NewJWTService(), stubJWT, jwtService

### Community 35 - "docShortfall.js"
Cohesion: 0.18
Nodes (23): esc(), ShortfallHistory(), ShortfallPanel(), Stage10Workspace(), addRound(), approverChoices(), awaitingReeval(), docCounts() (+15 more)

### Community 36 - "BulkImportPage"
Cohesion: 0.38
Nodes (7): BulkImportPage(), handleCommit(), handleFile(), commitLines(), errorLines(), previewLines(), bulkImportTenders()

### Community 37 - "CreateUserSheet"
Cohesion: 0.29
Nodes (6): CreateUserSheet(), handleSubmit(), onKeyDown(), requestClose(), resetForm(), validate()

### Community 38 - "EmdDetailsDialog.jsx"
Cohesion: 0.10
Nodes (33): EmdApprovalDialog(), ACTION_STYLE, EmdAuditDialog(), fmtDate(), EmdDetailsDialog(), fmtDate(), SECTIONS, EmdLifecycleCard() (+25 more)

### Community 39 - "emdfix/main.go"
Cohesion: 0.15
Nodes (16): env(), main(), printSection(), queryRows(), truncate(), getEnv(), main(), extractVersion() (+8 more)

### Community 40 - "go_pkg_context"
Cohesion: 0.11
Nodes (21): ForgotPasswordRequest, Permission, RefreshRequest, ResetPasswordOTPRequest, VerifyOTPRequest, go_pkg_context, go_pkg_crypto_sha256, go_pkg_embed (+13 more)

### Community 41 - "LedgerRow"
Cohesion: 0.12
Nodes (20): Colors, Deep Panel (login left panel only), Design System: OneTrack — The Ledger, Do:, Do's and Don'ts, Don't:, Elevation & Depth, Hierarchy (+12 more)

### Community 42 - "bid_service.go"
Cohesion: 0.08
Nodes (23): CreateBidRequest, PricingSuggestion, alertNoteHTML(), money(), ownershipChangeSummaryHTML(), pickL1PricingQuote(), rowsToHTMLTable(), shortfallRounds() (+15 more)

### Community 43 - "Browser Session Management"
Cohesion: 0.10
Nodes (20): 1. Name Browser Sessions Semantically, 2. Always Clean Up, 3. Delete Stale Browser Data, A/B Testing Sessions, Attach by channel name, Attach via browser extension, Attach via CDP endpoint, Attaching to a Running Browser (+12 more)

### Community 44 - "Lead"
Cohesion: 0.19
Nodes (11): Lead, Actor, Lead, approverID(), detailsHTML(), LeadHandler, leadName(), managerID() (+3 more)

### Community 45 - "devDependencies"
Cohesion: 0.20
Nodes (10): devDependencies, eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals, @types/react, @types/react-dom (+2 more)

### Community 46 - "tooltip.jsx"
Cohesion: 0.27
Nodes (10): KPI_BAND_TONES, PipelineKpiBand(), fmtMoney(), PricingSuggestionHint(), suggestionCache, useSuggestion(), Tooltip(), TooltipContent() (+2 more)

### Community 47 - "Storage Management"
Cohesion: 0.11
Nodes (18): Authentication State Reuse, Clear sessionStorage, Common Patterns, Delete Database, Delete Single Item, Get Single Value, IndexedDB, List All sessionStorage Items (+10 more)

### Community 48 - "fakeBidRepo"
Cohesion: 0.03
Nodes (21): PricingWorkspaceRow, BidChecklist, BidStageHistory, CreateBidParams, IdentifierMatch, MemberResponse, PendingApproval, RecordOutcomeRequest (+13 more)

### Community 49 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, lint, preview

### Community 50 - ".TransitionStage"
Cohesion: 0.31
Nodes (7): TransitionResult, TransitionStageRequest, getRoleForStage(), GetAllowedTransitions(), IsTerminalStage(), IsTransitionAllowed(), skipEMDStage()

### Community 51 - "TenderDetailPage.jsx"
Cohesion: 0.06
Nodes (54): ShortfallHistoryCard(), applyAlertNote(), EditTenderDialog(), handleSubmit(), loadFullBid(), loadUsers(), validate(), FIELD_DIFF_LABELS (+46 more)

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
Cohesion: 0.13
Nodes (20): main(), RegisterAlertRoutes(), RegisterAuthRoutes(), NewAuthService(), RegisterBidRoutes(), RegisterCalendarRoutes(), NewGoogleSyncService(), RegisterTicketRoutes() (+12 more)

### Community 59 - "ledgerTheme.js"
Cohesion: 0.26
Nodes (7): Login(), LedgerStampMark(), ledger, ledgerFont, BUILDINGS, LoginSkyline(), authService

### Community 60 - "apiFetch"
Cohesion: 0.06
Nodes (46): App(), ForceResetDialog(), handleClose(), handleConfirm(), SettingsPage(), StageAccessDialog(), handleClose(), handleSave() (+38 more)

### Community 61 - "emd_service_test.go"
Cohesion: 0.28
Nodes (19): strPtr(), float64Ptr(), newEMDTestSetup(), onlinePayment(), TestChecklist_ToggleKeepsStatusInSync(), TestChecklist_ValidatesPriorityAndStatus(), TestEMD_BasicUpdateCannotTouchStatusAndLocksWhilePending(), TestEMD_ExemptedTenderRejectsEveryMutationAndGetIsReadOnly() (+11 more)

### Community 62 - "config.go"
Cohesion: 0.16
Nodes (16): NewAlertService(), getEnv(), DatabaseConfig, EmailConfig, JWTConfig, RedisConfig, Load(), EmailService (+8 more)

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
Cohesion: 0.11
Nodes (6): TenderEMDAuditLog, TenderEMDDetails, postgresBidRepo, scanEMD(), pgEMDTx, fakeEMDTx

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
Cohesion: 0.10
Nodes (39): AddLeadPage(), buildPayload(), handleSubmit(), validate(), leadToForm(), LeadStageBadge(), LeadStatusBadge(), LeadTypeBadge() (+31 more)

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

### Community 88 - "mockCalendarRepo"
Cohesion: 0.06
Nodes (9): ShortfallCandidate, CalendarException, GoogleCalendarSyncLog, NextActionableTask, TaskNotification, shortfallAlert(), notifKey(), failingBaselineRepo (+1 more)

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

### Community 104 - "alerts.js"
Cohesion: 0.29
Nodes (15): buildEmdDetailsTableHtml(), buildTenderDetailHtml(), fmtDate(), fmtMoney(), InternalApprovalDialog(), Stage1Workspace(), Stage2PrimaryReviewWorkspace(), Stage6Workspace() (+7 more)

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

### Community 111 - "StageHistoryTab"
Cohesion: 0.25
Nodes (15): ComplianceCard(), extractCommercialDetails(), fmt(), fmtMoney(), formatFullDateTime(), getBidEndDate(), getBidStartDate(), getEventTypeBadge() (+7 more)

### Community 131 - "service_test.go"
Cohesion: 0.33
Nodes (11): NewTicketService(), newFakeTicketRepo(), TestCreateTicket_NotifiesAndRemembers(), TestCreateTicket_StandardCategoryDoesNotTouchFieldMemory(), TestCreateTicket_Validation(), TestGetTicket_OwnershipEnforced(), TestGetTicketImagePath_OwnershipEnforced(), TestUpdateStatus_LogsAndNotifiesOnResolve() (+3 more)

### Community 132 - "AddTenderPage"
Cohesion: 0.22
Nodes (10): inputCls(), ManualForm(), handleSubmit(), loadUsers(), validate(), AddTenderPage(), handleSubmit(), nextStep() (+2 more)

### Community 133 - "emdaudit/main.go"
Cohesion: 0.60
Nodes (5): boolOr(), env(), fmtF(), main(), strOr()

### Community 134 - "updateBid"
Cohesion: 0.16
Nodes (19): logChecklistHistory(), AssignPresalesModal(), CompleteStageModal(), EmdDecisionModal(), EmdReturnWorkspace(), getOemFollowUps(), logStageInteraction(), NoGoModal() (+11 more)

### Community 135 - "BidService"
Cohesion: 0.07
Nodes (16): BidService, AddChecklistRequest, BidChecklistItem, BidListItem, BidListResponse, BidResponse, ListBidsParams, ReorderChecklistRequest (+8 more)

### Community 136 - "WorkingCalendarService"
Cohesion: 0.12
Nodes (9): WorkingCalendarService, NewCalendarHandler(), CalculateDeadlineResult, EngineRuntime, EvaluationSummary, sync.Mutex, sync.WaitGroup, RedZoneNotificationResult (+1 more)

### Community 137 - "RolesPermissionsDialog"
Cohesion: 0.38
Nodes (4): RolesPermissionsDialog(), handleClose(), handleSave(), updateUserRoles()

### Community 138 - "testing.T"
Cohesion: 0.13
Nodes (23): TestSchedulerIntervalCombinesValueAndUnit(), TestCandidateSelectExcludesSubmittedAndResolvedTenders(), TestCandidateSelectJoinsOnlyAnActiveReportingManager(), TestCoverageUsesTheEngineEligibilityRule(), isWorkingDay(), rules(), TestBadStoredTriggerFallsBackTo72Hours(), TestHolidaysAndExceptions() (+15 more)

### Community 139 - "PrimaryButton"
Cohesion: 0.40
Nodes (3): BentoTile(), handleMove(), PrimaryButton()

### Community 140 - "usePermissions"
Cohesion: 0.11
Nodes (24): ExcludeRoleGuard(), PermissionGuard(), RoleGuard(), Dashboard(), onKeyDown(), isChildActive(), buildRemarkCalloutHtml(), buildValuesAdjustedBannerHtml() (+16 more)

### Community 142 - "postgresCalendarRepo"
Cohesion: 0.11
Nodes (4): Holiday, SyncResult, UpdateHolidayRequest, postgresCalendarRepo

### Community 145 - ".applyUpdate"
Cohesion: 0.14
Nodes (18): AddMemberRequest, UpdateBidRequest, authorizeEditDecision(), checkDocShortfall(), checkPostBidContactsDone(), diffRowsHTML(), fieldLabel(), hasAnyRole() (+10 more)

### Community 146 - "calendar/domain/models.go"
Cohesion: 0.11
Nodes (13): CalculateDeadlineResult, DeadlineCoverage, EngineRuntime, EvaluationSummary, LastRun, RedZoneNotificationResult, TenderStakeholder, UpdateChecklistPriorityRequest (+5 more)

### Community 147 - "time.Time"
Cohesion: 0.20
Nodes (8): TenderDeadlineCandidate, pgx.Row, scanCandidate(), round2(), BidWorkspaceMember, UserRole, time.Time, calRules

### Community 148 - "WorkingCalendar"
Cohesion: 0.14
Nodes (9): UpdateCalendarRequest, WorkingCalendar, TestValidateIntervalNormalisesUnit(), TestValidateTriggerNormalisesUnit(), ValidateInterval(), ValidateTrigger(), calendarLocation(), time.Duration (+1 more)

### Community 149 - "diffBidFields"
Cohesion: 0.29
Nodes (9): FieldDiff, derefFloat(), derefInt(), derefStr(), diffBidFields(), diffDateField(), diffField(), diffRequestFields() (+1 more)

### Community 150 - "GoogleCalendarIntegration"
Cohesion: 0.31
Nodes (3): DefaultIntegration(), GoogleCalendarIntegration, googleSyncService

### Community 151 - "CreateUserDialog"
Cohesion: 0.36
Nodes (5): CreateUserDialog(), handleClose(), handleSubmit(), resetForm(), validate()

### Community 152 - "updateUserProfile"
Cohesion: 0.43
Nodes (6): EditUserDialog(), handleClose(), handleSubmit(), UserProfileModal(), handleSaveProfile(), updateUserProfile()

### Community 153 - "emd_models.go"
Cohesion: 0.60
Nodes (5): RecordEMDPaymentRequest, ChallanPaymentDetails, ChequePaymentDetails, DepositorDetailsDTO, OnlinePaymentDetails

### Community 154 - "fieldSuggestionEntries"
Cohesion: 0.33
Nodes (6): extractProductFields(), fieldSuggestionEntries(), TestExtractProductFields(), TestFieldSuggestionEntries(), orgName, title

### Community 155 - "StageLink"
Cohesion: 0.50
Nodes (3): ApprovalLink(), StageLink(), TenderLink()

## Knowledge Gaps
- **580 isolated node(s):** `STATUS_STYLE`, `DUE_STYLE`, `seenRow`, `Access Token JWT Payload`, `Admin User` (+575 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 785 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **31 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `react` to `cn`, `ChecklistTab.jsx`, `AddLeadPage.jsx`, `Landing.jsx`, `EmdDetailsDialog.jsx`, `TendersPage.jsx`, `StageWorkspaces.jsx`, `FeedbackPage.jsx`, `tooltip.jsx`, `LeadDetailPage.jsx`, `Dashboard.jsx`, `TenderDetailPage.jsx`, `WorkingCalendarPage.jsx`, `ledgerTheme.js`, `apiFetch`, `package.json`, `PipelineConstellation.jsx`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **Why does `lucide-react` connect `react` to `cn`, `list_exports.js`, `ChecklistTab.jsx`, `AddLeadPage.jsx`, `Landing.jsx`, `EmdDetailsDialog.jsx`, `TendersPage.jsx`, `StageWorkspaces.jsx`, `FeedbackPage.jsx`, `tooltip.jsx`, `LeadDetailPage.jsx`, `Dashboard.jsx`, `TenderDetailPage.jsx`, `WorkingCalendarPage.jsx`, `ledgerTheme.js`, `apiFetch`, `package.json`, `PipelineConstellation.jsx`?**
  _High betweenness centrality (0.013) - this node is a cross-community bridge._
- **Why does `framer-motion` connect `EmdDetailsDialog.jsx` to `ChecklistTab.jsx`, `AddLeadPage.jsx`, `Landing.jsx`, `TendersPage.jsx`, `react`, `StageWorkspaces.jsx`, `Dashboard.jsx`, `TenderDetailPage.jsx`, `ledgerTheme.js`, `package.json`, `PipelineConstellation.jsx`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **What connects `STATUS_STYLE`, `DUE_STYLE`, `seenRow` to the rest of the system?**
  _580 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `importer.go` be split into smaller, more focused modules?**
  _Cohesion score 0.05019037729318103 - nodes in this community are weakly interconnected._
- **Should `cn` be split into smaller, more focused modules?**
  _Cohesion score 0.07337526205450734 - nodes in this community are weakly interconnected._
- **Should `context.Context` be split into smaller, more focused modules?**
  _Cohesion score 0.039167182024324884 - nodes in this community are weakly interconnected._