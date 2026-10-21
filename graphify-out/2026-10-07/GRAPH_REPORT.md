# Graph Report - Onetrack-GlobX  (2026-10-07)

## Corpus Check
- 349 files · ~422,300 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 9 file(s) not represented in the graph (top: (none) 5, .css 2, .example 1)

## Summary
- 2494 nodes · 7807 edges · 99 communities (85 shown, 14 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 125 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `97d59ed1`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- importer.go
- ImportedBid
- InternalError
- WorkingCalendarRepository
- cn
- Landing.jsx
- TicketResponse
- TendersPage.jsx
- react
- workingCalendarService
- AuditLogQuery
- bid_service_test.go
- FeedbackPage.jsx
- Alert
- TenderEMDResponse
- testing.T
- github.com/gin-gonic/gin.Context
- AnalyticsPage.jsx
- StageWorkspaces.jsx
- emdfix/main.go
- github.com/jackc/pgx/v5/pgxpool.Pool
- userService
- BidRepository
- Success
- BidWorkspace
- context.Context
- authService
- postgresCalendarRepo
- dependencies
- bid/domain/models.go
- package.json
- Actor
- components.json
- ChecklistTab.jsx
- JWTService
- mockCalendarRepo
- App.jsx
- CreateUserSheet
- EmdDetailsDialog.jsx
- go_pkg_context
- time.Time
- emdaudit/main.go
- bid_service.go
- normalize.go
- Lead
- devDependencies
- updateUserProfile
- RolesPermissionsDialog
- fakeBidRepo
- scripts
- bids.js
- systemlog/domain/models.go
- compilerOptions
- xlsx.go
- LeadHandler
- github.com/onetrack/backend
- main
- CLAUDE.md
- .claude/CLAUDE.md
- go_pkg_errors
- apiFetch
- service_test.go
- server/main.go
- EditTenderDialog.jsx
- OneTrack GlobX — API Documentation
- list_exports.js
- go_pkg_github_com_onetrack_backend_internal_bid_domain
- 6. Tenders (Bid Workspaces) — `/api/v1/bids`
- vite.config.js
- Dashboard.jsx
- UserSummary
- UserSummary
- go_pkg_github_com_onetrack_backend_internal_bid_repository
- EditTenderDialog
- SystemLogsPage.jsx
- TenderDetailPage.jsx
- emd_service_test.go
- 4. Users & Profile — `/api/v1/users`
- UserTable.jsx
- 9. Feedback Tickets — `/api/v1/tickets`
- LeadDetailPage
- 7. Leads — `/api/v1/leads`
- 1. Getting started
- AuthHandler
- 3. Auth — `/api/v1/auth`
- 8. Alerts — `/api/v1/alerts`
- BulkImportPage
- 12. Appendix: enums and reference values
- TenderDeadlineCandidate
- 6.7 Edit approvals
- BackgroundScheduler
- GoogleCalendarIntegration
- 6.12 Helpers: Field Memory, pricing hint, performance matrix
- 6.9 History and audit
- StageAccessDialog
- AlertHandler
- UpdateChecklistPriorityRequest
- connect
- pgx.Row

## God Nodes (most connected - your core abstractions)
1. `apiFetch()` - 106 edges
2. `Success()` - 97 edges
3. `cn()` - 95 edges
4. `react` - 76 edges
5. `InternalError()` - 66 edges
6. `BadRequest()` - 60 edges
7. `lucide-react` - 60 edges
8. `fakeBidRepo` - 57 edges
9. `BidRepository` - 49 edges
10. `Button()` - 46 edges

## Surprising Connections (you probably didn't know these)
- `TestMaskIntegrationNeverExposesKey()` --calls--> `maskIntegration()`  [INFERRED]
  backend/internal/calendar/handler/handler_test.go → backend/internal/calendar/handler/handler.go
- `TestIsRealAPIKeyRejectsPlaceholders()` --calls--> `isRealAPIKey()`  [INFERRED]
  backend/internal/calendar/handler/handler_test.go → backend/internal/calendar/handler/handler.go
- `TestParseClosingUsesCalendarZoneForNaiveValues()` --calls--> `parseClosing()`  [INFERRED]
  backend/internal/calendar/handler/handler_test.go → backend/internal/calendar/handler/handler.go
- `googleFixture()` --calls--> `NewGoogleSyncService()`  [INFERRED]
  backend/internal/calendar/service/google_sync_service_test.go → backend/internal/calendar/service/google_sync_service.go
- `newSvc()` --calls--> `NewWorkingCalendarService()`  [INFERRED]
  backend/internal/calendar/service/working_calendar_service_test.go → backend/internal/calendar/service/working_calendar_service.go

## Import Cycles
- None detected.

## Communities (99 total, 14 thin omitted)

### Community 0 - "importer.go"
Cohesion: 0.12
Nodes (35): commit(), main(), printSummary(), summarise(), blank(), buildPreview(), CheckHeaders(), checkHeadersAgainst() (+27 more)

### Community 1 - "ImportedBid"
Cohesion: 0.25
Nodes (6): deref(), fmtDate(), fmtNum(), writeReport(), ImportedBid, dashboardRowParser()

### Community 2 - "InternalError"
Cohesion: 0.13
Nodes (6): parseIntQuery(), BadRequest(), Conflict(), Forbidden(), InternalError(), BidHandler

### Community 3 - "WorkingCalendarRepository"
Cohesion: 0.09
Nodes (6): WorkingCalendarRepository, Holiday, SyncResult, UpdateHolidayRequest, net/http.Client, googleSyncService

### Community 4 - "cn"
Cohesion: 0.06
Nodes (53): ForceResetDialog(), handleClose(), handleConfirm(), getHue(), getInitials(), UserAvatar(), Accordion(), AccordionContent() (+45 more)

### Community 5 - "Landing.jsx"
Cohesion: 0.05
Nodes (24): BentoTile(), handleMove(), DEMO_SHEET_TENDERS, MotionLink, PrimaryButton(), ROLES, FaqSection(), DEMO_BOARDS (+16 more)

### Community 6 - "TicketResponse"
Cohesion: 0.05
Nodes (20): FieldMemory, TicketRepository, TicketService, CreateTicketRequest, ListTicketsParams, Ticket, TicketListPage, TicketResponse (+12 more)

### Community 7 - "TendersPage.jsx"
Cohesion: 0.08
Nodes (48): OverviewPanel(), ExportSuccessDialog(), ImportedPill(), InProgressPill(), COLUMNS, MasterSheetPage(), handleExport(), PILLS (+40 more)

### Community 8 - "react"
Cohesion: 0.12
Nodes (36): FORMATS, STAGE_LABELS, STAGE_ORDER, INITIAL_FORM, backdropVariants, closeButtonVariants, INITIAL_FORM, panelVariants (+28 more)

### Community 9 - "workingCalendarService"
Cohesion: 0.13
Nodes (15): TriggerDays(), calendarLocation(), dayDesc(), deref(), fmtNum(), ordinal(), parseTimeHM(), redZoneAlert() (+7 more)

### Community 10 - "AuditLogQuery"
Cohesion: 0.15
Nodes (9): AddMicroEventRequest, AuditLogPage, AuditLogQuery, GlobalAuditItem, StageHistoryPage, StageHistoryResponse, auditPageSize(), decodeAuditCursor() (+1 more)

### Community 11 - "bid_service_test.go"
Cohesion: 0.11
Nodes (30): extractProductFields(), fieldSuggestionEntries(), NewBidService(), boolPtr(), floatPtr(), hasAlertType(), intPtr(), lastEventType() (+22 more)

### Community 12 - "FeedbackPage.jsx"
Cohesion: 0.12
Nodes (26): ALLOWED_IMAGE_TYPES, FeedbackPage(), handleSubmit(), loadMyTickets(), removeImage(), formatDate(), formatWhen(), TicketDetailDialog() (+18 more)

### Community 13 - "Alert"
Cohesion: 0.06
Nodes (11): Alert, AlertRepository, SafeLink(), TestSafeLink(), NewPostgresAlertRepository(), fakeAlertSvc, AlertService, postgresAlertRepo (+3 more)

### Community 14 - "TenderEMDResponse"
Cohesion: 0.22
Nodes (11): MDDecisionRequest, SubmitMDApprovalRequest, TenderEMDResponse, UpdateBasicEMDRequest, UpdateEMDRefundRequest, VerifyEMDPaymentRequest, hasAnyRole(), bidService (+3 more)

### Community 15 - "testing.T"
Cohesion: 0.12
Nodes (45): f64p(), intp(), strp(), TestUpdateCalendarRequestValidate(), TestIsRealAPIKeyRejectsPlaceholders(), TestMaskIntegrationNeverExposesKey(), TestParseClosingUsesCalendarZoneForNaiveValues(), TestCandidateSelectExcludesSubmittedAndResolvedTenders() (+37 more)

### Community 16 - "github.com/gin-gonic/gin.Context"
Cohesion: 0.12
Nodes (8): hasRole(), NewTicketHandler(), parseListParams(), respondPage(), NotFound(), github.com/gin-gonic/gin.Context, TicketHandler, UserHandler

### Community 17 - "AnalyticsPage.jsx"
Cohesion: 0.12
Nodes (27): AnalyticsPage(), CATEGORY_COLORS, ROLE_BADGES, STAGE_COLORS, STAGE_LABELS, KPI_BAND_TONES, PipelineKpiBand(), Card() (+19 more)

### Community 18 - "StageWorkspaces.jsx"
Cohesion: 0.11
Nodes (49): AssignPresalesModal(), buildEmdDetailsTableHtml(), buildPresalesCands(), buildRemarkCalloutHtml(), buildTenderDetailHtml(), buildValuesAdjustedBannerHtml(), CompleteStageModal(), computeL1PricingSummary() (+41 more)

### Community 19 - "emdfix/main.go"
Cohesion: 0.16
Nodes (15): env(), main(), printSection(), queryRows(), truncate(), extractVersion(), getEnv(), pgx.Conn (+7 more)

### Community 20 - "github.com/jackc/pgx/v5/pgxpool.Pool"
Cohesion: 0.08
Nodes (22): NewPostgresAuthRepository(), NewBulkImportHandler(), NewPostgresBidRepository(), NewPostgresCalendarRepository(), NewWorkingCalendarService(), NewPostgresPool(), Repository, Service (+14 more)

### Community 21 - "userService"
Cohesion: 0.11
Nodes (11): UserService, CreateUserRequest, ListUsersParams, UpdatePermissionsRequest, UpdateRolesRequest, UpdateStatusRequest, UpdateUserRequest, UserListResponse (+3 more)

### Community 22 - "BidRepository"
Cohesion: 0.06
Nodes (5): TenderEMDAuditLog, TenderEMDDetails, BidRepository, ReorderChecklistItem, postgresBidRepo

### Community 23 - "Success"
Cohesion: 0.16
Nodes (12): GoogleSyncService, actorPtr(), fail(), isAdmin(), isRealAPIKey(), maskIntegration(), NewCalendarHandler(), oneOf() (+4 more)

### Community 24 - "BidWorkspace"
Cohesion: 0.15
Nodes (11): BidListItem, BidListResponse, BidWorkspace, ListBidsParams, scanBid(), scanBidFields(), scanBidFromRows(), buildBidListItem() (+3 more)

### Community 25 - "context.Context"
Cohesion: 0.04
Nodes (13): AuthRepository, Role, User, UserPermissionOverride, BidService, FieldSuggestion, TenderOwnerPerformanceStat, UpdateChecklistRequest (+5 more)

### Community 26 - "authService"
Cohesion: 0.09
Nodes (12): NewAlertService(), AuthService, ChangePasswordRequest, ForceResetRequest, LoginRequest, LoginResponse, NewAuthService(), EmailService (+4 more)

### Community 27 - "postgresCalendarRepo"
Cohesion: 0.09
Nodes (6): UpdateCalendarRequest, WorkingCalendar, TestValidateTriggerNormalisesUnit(), ValidateTrigger(), pgx.Row, postgresCalendarRepo

### Community 28 - "dependencies"
Cohesion: 0.08
Nodes (25): dependencies, canvas-confetti, class-variance-authority, clsx, exceljs, @fontsource-variable/instrument-sans, @fontsource-variable/inter, framer-motion (+17 more)

### Community 29 - "bid/domain/models.go"
Cohesion: 0.10
Nodes (19): RecordEMDPaymentRequest, GetAllowedTransitions(), IsTerminalStage(), IsTransitionAllowed(), skipEMDStage(), ChallanPaymentDetails, ChequePaymentDetails, DepositorDetailsDTO (+11 more)

### Community 30 - "package.json"
Cohesion: 0.10
Nodes (22): name, private, type, version, canvas-confetti, clsx, eslint, @eslint/js (+14 more)

### Community 32 - "components.json"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 33 - "ChecklistTab.jsx"
Cohesion: 0.14
Nodes (25): ChecklistTab(), logChecklistHistory(), OEM_PILL_COLORS, addSection(), cellBorder, cleanTitle(), exportChecklistToExcel(), OEM_HEADER_BG (+17 more)

### Community 34 - "JWTService"
Cohesion: 0.17
Nodes (7): JWTService, TokenClaims, TokenPair, redis.Client, NewJWTService(), time.Duration, jwtService

### Community 35 - "mockCalendarRepo"
Cohesion: 0.08
Nodes (6): CalendarException, GoogleCalendarSyncLog, NextActionableTask, TaskNotification, notifKey(), mockCalendarRepo

### Community 36 - "App.jsx"
Cohesion: 0.11
Nodes (19): App(), ExcludeRoleGuard(), PermissionGuard(), RoleGuard(), useDebounce(), UserManagement(), LeadStageBadge(), LeadStatusBadge() (+11 more)

### Community 37 - "CreateUserSheet"
Cohesion: 0.16
Nodes (12): CreateUserDialog(), handleClose(), handleSubmit(), resetForm(), validate(), CreateUserSheet(), handleSubmit(), onKeyDown() (+4 more)

### Community 38 - "EmdDetailsDialog.jsx"
Cohesion: 0.15
Nodes (25): EmdApprovalDialog(), fmtMoney(), ACTION_COLORS, ACTION_ICONS, EmdAuditDialog(), fmtDate(), EmdDetailsDialog(), fmtDate() (+17 more)

### Community 39 - "go_pkg_context"
Cohesion: 0.08
Nodes (29): getEnv(), main(), ConfigureGoogleSyncRequest, CreateExceptionRequest, CreateHolidayRequest, ForgotPasswordRequest, Permission, RefreshRequest (+21 more)

### Community 40 - "time.Time"
Cohesion: 0.12
Nodes (11): WorkingCalendarService, CalculateDeadlineResult, EvaluationSummary, RedZoneNotificationResult, TenderStakeholder, saturdayNumber(), BidWorkspaceMember, SkippedDateInfo (+3 more)

### Community 41 - "emdaudit/main.go"
Cohesion: 0.60
Nodes (5): boolOr(), env(), fmtF(), main(), strOr()

### Community 42 - "bid_service.go"
Cohesion: 0.04
Nodes (52): ApprovalLink(), StageLink(), TenderLink(), TransitionResult, AddChecklistRequest, AddMemberRequest, BidChecklistItem, BidResponse (+44 more)

### Community 43 - "normalize.go"
Cohesion: 0.18
Nodes (33): canonDashboardActivity(), canonDashboardPlatform(), deriveStageDashboard(), isOurName(), parseCompetitors(), ParseRowDashboard(), parseTimeFraction(), timeOfDay() (+25 more)

### Community 44 - "Lead"
Cohesion: 0.12
Nodes (12): CreateLeadRequest, Document, Lead, approverID(), detailsHTML(), leadName(), managerID(), Repo (+4 more)

### Community 45 - "devDependencies"
Cohesion: 0.20
Nodes (10): devDependencies, eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals, @types/react, @types/react-dom (+2 more)

### Community 46 - "updateUserProfile"
Cohesion: 0.38
Nodes (6): EditUserDialog(), handleClose(), handleSubmit(), UserProfileModal(), handleSaveProfile(), updateUserProfile()

### Community 47 - "RolesPermissionsDialog"
Cohesion: 0.38
Nodes (4): RolesPermissionsDialog(), handleClose(), handleSave(), updateUserRoles()

### Community 48 - "fakeBidRepo"
Cohesion: 0.03
Nodes (17): PricingWorkspaceRow, BidChecklist, BidStageHistory, CreateBidParams, IdentifierMatch, MemberResponse, PendingApproval, RecordOutcomeRequest (+9 more)

### Community 49 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, lint, preview

### Community 50 - "bids.js"
Cohesion: 0.12
Nodes (19): fmtMoney(), PricingSuggestionHint(), suggestionCache, useSuggestion(), ArchiveConfirmDialog(), handleConfirm(), handleRemove(), addBidMember() (+11 more)

### Community 51 - "systemlog/domain/models.go"
Cohesion: 0.14
Nodes (13): Repository, Service, Event, EventItem, ListQuery, NewHandler(), NewPostgresRepository(), service (+5 more)

### Community 52 - "compilerOptions"
Cohesion: 0.50
Nodes (3): compilerOptions, baseUrl, paths

### Community 53 - "xlsx.go"
Cohesion: 0.15
Nodes (24): isEmptyRow(), minInt(), otherSheets(), ParseUploadDashboard(), atoiSafe(), colIndex(), ListSheetNames(), ReadNamedSheet() (+16 more)

### Community 54 - "LeadHandler"
Cohesion: 0.20
Nodes (8): LeadHandler, NewLeadHandler(), randomHex(), userMessage(), actorOf(), fail(), LeadHandler, mime/multipart.FileHeader

### Community 56 - "main"
Cohesion: 0.08
Nodes (32): main(), NewAlertHandler(), RegisterAlertRoutes(), RegisterAuthRoutes(), NewBidHandler(), RegisterBidRoutes(), RegisterCalendarRoutes(), RegisterTicketRoutes() (+24 more)

### Community 59 - "go_pkg_errors"
Cohesion: 0.14
Nodes (21): saveReceiptFile(), validateReceiptUpload(), FolderSlug(), TestLeadWorkflow(), TestTransitionRequestNormalize(), safeName(), strp(), TestFolderSlugAndSafeName() (+13 more)

### Community 60 - "apiFetch"
Cohesion: 0.16
Nodes (30): CURRENT_YEAR, WorkingCalendarPage(), YEAR_OPTIONS, AlertsPage(), deleteAlert(), getAlerts(), markAlertRead(), markAllAlertsRead() (+22 more)

### Community 61 - "service_test.go"
Cohesion: 0.33
Nodes (11): NewTicketService(), newFakeTicketRepo(), TestCreateTicket_NotifiesAndRemembers(), TestCreateTicket_StandardCategoryDoesNotTouchFieldMemory(), TestCreateTicket_Validation(), TestGetTicket_OwnershipEnforced(), TestGetTicketImagePath_OwnershipEnforced(), TestUpdateStatus_LogsAndNotifiesOnResolve() (+3 more)

### Community 62 - "server/main.go"
Cohesion: 0.07
Nodes (33): getEnv(), Load(), Config, DatabaseConfig, EmailConfig, JWTConfig, RedisConfig, ServerConfig (+25 more)

### Community 63 - "EditTenderDialog.jsx"
Cohesion: 0.07
Nodes (53): SettingsPage(), STATUS_OPTIONS, UserSelect(), AddTenderDialog(), BID_TYPES, EMD_TYPES, inputCls(), ManualForm() (+45 more)

### Community 64 - "OneTrack GlobX — API Documentation"
Cohesion: 0.13
Nodes (14): 10.1 `GET /system/config`, 10.2 `GET /system/config/:key`, 10.3 `PUT /system/config/:key`, 10. System Configuration — `/api/v1/system/config`, 11.1 `GET /system-logs`, 11. System Logs — `/api/v1/system-logs`, 13. Appendix: endpoint index, 2.1 `GET /health` (+6 more)

### Community 67 - "6. Tenders (Bid Workspaces) — `/api/v1/bids`"
Cohesion: 0.13
Nodes (15): 6.10 Workspace members, 6.11 Checklists, 6.13 `PATCH /bids/:id/outcome` — record outcome, 6.14 Tender Bin, 6.15 `POST /bids/bulk-import` — Excel import, 6.1 Typical lifecycle (step by step), 6.2 `POST /bids` — create tender, 6.3 `GET /bids` — list tenders (+7 more)

### Community 68 - "vite.config.js"
Cohesion: 0.40
Nodes (4): path, @tailwindcss/vite, vite, @vitejs/plugin-react

### Community 69 - "Dashboard.jsx"
Cohesion: 0.09
Nodes (28): EmdProjectionBlock(), getTenderDeadline(), isActivePipeline(), isEmdRequired(), Dashboard(), onKeyDown(), ForcePasswordChangeGuard(), isChildActive() (+20 more)

### Community 73 - "EditTenderDialog"
Cohesion: 0.21
Nodes (13): applyAlertNote(), EditTenderDialog(), handleSubmit(), loadFullBid(), loadUsers(), validate(), fieldDiffLabel(), inputCls() (+5 more)

### Community 74 - "SystemLogsPage.jsx"
Cohesion: 0.24
Nodes (9): ActivityLogDialog(), eventBadge(), CATEGORY_CLASSES, CATEGORY_FILTERS, CATEGORY_LABELS, formatTime(), SystemLogsPage(), dateGroupLabel() (+1 more)

### Community 75 - "TenderDetailPage.jsx"
Cohesion: 0.07
Nodes (46): StatusPill(), checkStageState(), DynamicStageWorkspace(), StageHeaderActions(), useInternalApprovals(), EXIT_HINTS, EXIT_OPTIONS, ExitedBanner() (+38 more)

### Community 76 - "emd_service_test.go"
Cohesion: 0.42
Nodes (10): float64Ptr(), newEMDTestSetup(), TestEMD_RoleRestrictions(), TestMDApprovalAndRejection(), TestRecordEMDPayment_AmountValidation(), TestRecordEMDPayment_OnlineAndCheque(), TestSubmitEMDForMDApproval(), TestUpdateBasicEMD_Validation() (+2 more)

### Community 77 - "4. Users & Profile — `/api/v1/users`"
Cohesion: 0.18
Nodes (11): 4.1 `GET /users/me`, 4.2 `POST /users`, 4.3 `GET /users`, 4.4 `GET /users/:id`, 4.5 `PATCH /users/:id`, 4.6 `PATCH /users/:id/status`, 4.7 `PATCH /users/:id/roles`, 4.8 `PATCH /users/:id/permissions` (+3 more)

### Community 78 - "UserTable.jsx"
Cohesion: 0.27
Nodes (7): RoleBadge(), formatDateTime(), UserTable(), handleDelete(), handleStatusChange(), deleteUser(), updateUserStatus()

### Community 79 - "9. Feedback Tickets — `/api/v1/tickets`"
Cohesion: 0.20
Nodes (10): 9.1 `POST /tickets` — submit feedback, 9.2 `GET /tickets/mine`, 9.3 `GET /tickets/:id`, 9.4 `GET /tickets/:id/history`, 9.5 `GET /tickets/:id/image`, 9.6 `GET /tickets` — all tickets (triage), 9.7 `GET /tickets/open-count`, 9.8 `PATCH /tickets/:id/status` (+2 more)

### Community 80 - "LeadDetailPage"
Cohesion: 0.10
Nodes (37): AddLeadPage(), buildPayload(), handleSubmit(), validate(), leadToForm(), emdSummary(), LeadDetailPage(), handleDelete() (+29 more)

### Community 81 - "7. Leads — `/api/v1/leads`"
Cohesion: 0.22
Nodes (9): 7.1 Typical flow (step by step), 7.2 `POST /leads` — create lead, 7.3 `GET /leads` — list leads, 7.4 `GET /leads/:id` — lead detail, 7.5 `POST /leads/:id/documents` — upload one document, 7.6 `GET /leads/:id/documents/:docId` — download, 7.7 `DELETE /leads/:id/documents/:docId`, 7. Leads — `/api/v1/leads` (+1 more)

### Community 82 - "1. Getting started"
Cohesion: 0.25
Nodes (8): 1.1 Base URL, 1.2 Authentication flow (step by step), 1.3 Response envelope, 1.4 Errors and status codes, 1.5 Pagination, 1.6 Data conventions, 1.7 Roles and permissions, 1. Getting started

### Community 83 - "AuthHandler"
Cohesion: 0.27
Nodes (4): extractTokenFromHeader(), NewAuthHandler(), Unauthorized(), AuthHandler

### Community 84 - "3. Auth — `/api/v1/auth`"
Cohesion: 0.29
Nodes (7): 3.1 `POST /auth/login`, 3.2 `POST /auth/refresh`, 3.3 `POST /auth/logout`, 3.4 `PATCH /auth/change-password`, 3.5 `PATCH /auth/force-reset`, 3.6 Forgot-password flow (OTP by email), 3. Auth — `/api/v1/auth`

### Community 85 - "8. Alerts — `/api/v1/alerts`"
Cohesion: 0.29
Nodes (7): 8.1 `GET /alerts`, 8.2 `POST /alerts`, 8.3 `PUT /alerts/:id/read`, 8.4 `PUT /alerts/read-all`, 8.5 `DELETE /alerts/:id`, 8. Alerts — `/api/v1/alerts`, Alert object

### Community 86 - "BulkImportPage"
Cohesion: 0.38
Nodes (7): BulkImportPage(), handleCommit(), handleFile(), commitLines(), errorLines(), previewLines(), bulkImportTenders()

### Community 87 - "12. Appendix: enums and reference values"
Cohesion: 0.33
Nodes (6): 12.1 Tender workflow stages, 12.2 Tender status values, 12.3 Lead values, 12.4 Preset dropdown values (free text also accepted), 12.5 Feedback categories, 12. Appendix: enums and reference values

### Community 89 - "6.7 Edit approvals"
Cohesion: 0.40
Nodes (5): 6.7 Edit approvals, `GET /bids/:id/pending-edit`, `GET /bids/my-approvals`, `POST /bids/pending-edits/:editId/approve`, `POST /bids/pending-edits/:editId/reject`

### Community 90 - "BackgroundScheduler"
Cohesion: 0.36
Nodes (4): NewBackgroundScheduler(), sync.Mutex, sync.WaitGroup, BackgroundScheduler

### Community 92 - "6.12 Helpers: Field Memory, pricing hint, performance matrix"
Cohesion: 0.50
Nodes (4): 6.12 Helpers: Field Memory, pricing hint, performance matrix, `GET /bids/field-suggestions?field=<key>`, `GET /bids/performance-matrix`, `GET /bids/pricing-suggestion?desc=<product description>`

### Community 93 - "6.9 History and audit"
Cohesion: 0.50
Nodes (4): 6.9 History and audit, `GET /bids/audit-history`, `GET /bids/:id/stage-history`, `POST /bids/:id/history`

### Community 94 - "StageAccessDialog"
Cohesion: 0.60
Nodes (4): StageAccessDialog(), handleClose(), handleSave(), setStageRestrictions()

### Community 97 - "connect"
Cohesion: 0.67
Nodes (3): connect(), getEnv(), pgx.Conn

## Knowledge Gaps
- **264 isolated node(s):** `CreateHolidayRequest`, `CreateExceptionRequest`, `ConfigureGoogleSyncRequest`, `googleEventsResponse`, `CURRENT_YEAR` (+259 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 426 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **14 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `react` to `ChecklistTab.jsx`, `App.jsx`, `cn`, `Dashboard.jsx`, `Landing.jsx`, `EmdDetailsDialog.jsx`, `TendersPage.jsx`, `SystemLogsPage.jsx`, `TenderDetailPage.jsx`, `FeedbackPage.jsx`, `UserTable.jsx`, `LeadDetailPage`, `AnalyticsPage.jsx`, `bids.js`, `StageWorkspaces.jsx`, `apiFetch`, `package.json`, `EditTenderDialog.jsx`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **Why does `apiFetch()` connect `apiFetch` to `cn`, `TendersPage.jsx`, `react`, `FeedbackPage.jsx`, `StageWorkspaces.jsx`, `ChecklistTab.jsx`, `CreateUserSheet`, `EmdDetailsDialog.jsx`, `updateUserProfile`, `RolesPermissionsDialog`, `bids.js`, `EditTenderDialog.jsx`, `Dashboard.jsx`, `EditTenderDialog`, `SystemLogsPage.jsx`, `TenderDetailPage.jsx`, `UserTable.jsx`, `LeadDetailPage`, `BulkImportPage`, `StageAccessDialog`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `package.json`?**
  _High betweenness centrality (0.013) - this node is a cross-community bridge._
- **What connects `CreateHolidayRequest`, `CreateExceptionRequest`, `ConfigureGoogleSyncRequest` to the rest of the system?**
  _264 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `importer.go` be split into smaller, more focused modules?**
  _Cohesion score 0.11538461538461539 - nodes in this community are weakly interconnected._
- **Should `InternalError` be split into smaller, more focused modules?**
  _Cohesion score 0.13008130081300814 - nodes in this community are weakly interconnected._
- **Should `WorkingCalendarRepository` be split into smaller, more focused modules?**
  _Cohesion score 0.08522727272727272 - nodes in this community are weakly interconnected._