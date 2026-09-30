# Graph Report - Onetrack-GlobX  (2026-09-23)

## Corpus Check
- 280 files · ~342,266 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 11 file(s) not represented in the graph (top: (none) 5, .exe 2, .css 2)

## Summary
- 1754 nodes · 5387 edges · 59 communities (55 shown, 4 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 96 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `68d6713b`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- context.Context
- xlsx.go
- github.com/gin-gonic/gin.Context
- bidService
- cn
- Landing.jsx
- TicketResponse
- TendersPage.jsx
- lucide-react
- UserManagement.jsx
- AuditLogQuery
- bid_service_test.go
- FeedbackPage.jsx
- Alert
- postgresBidRepo
- Dashboard.jsx
- fakeBidRepo
- App.jsx
- StageWorkspaces.jsx
- emdfix/main.go
- encoding/json.RawMessage
- userService
- systemlog/domain/models.go
- go_pkg_context
- BidService
- main
- authService
- apiFetch
- dependencies
- bid/domain/models.go
- package.json
- usePermissions
- components.json
- ChecklistTab.jsx
- jwt_service.go
- config.go
- BulkImportPage
- CreateUserSheet
- TenderDetailPage.jsx
- server/main.go
- AddTenderPage
- EditTenderDialog
- StageHistoryTab
- time.Time
- bid_service.go
- devDependencies
- updateUserProfile
- RolesPermissionsDialog
- ListBidsParams
- scripts
- transitionBidStage
- vite.config.js
- compilerOptions
- PricingSuggestionHint.jsx
- list_exports.js
- github.com/onetrack/backend
- transitions.go
- CLAUDE.md
- .claude/CLAUDE.md

## God Nodes (most connected - your core abstractions)
1. `cn()` - 95 edges
2. `apiFetch()` - 66 edges
3. `react` - 65 edges
4. `Success()` - 55 edges
5. `fakeBidRepo` - 49 edges
6. `InternalError()` - 48 edges
7. `lucide-react` - 46 edges
8. `BidRepository` - 43 edges
9. `bidService` - 43 edges
10. `postgresBidRepo` - 41 edges

## Surprising Connections (you probably didn't know these)
- `CardAction()` --calls--> `cn()`  [EXTRACTED]
  frontend/src/components/ui/card.jsx → frontend/src/lib/utils.js
- `CardFooter()` --calls--> `cn()`  [EXTRACTED]
  frontend/src/components/ui/card.jsx → frontend/src/lib/utils.js
- `loadUsers()` --calls--> `listUsers()`  [EXTRACTED]
  frontend/src/components/tenders/AddTenderDialog.jsx → frontend/src/services/users.js
- `loadUsers()` --calls--> `listUsers()`  [EXTRACTED]
  frontend/src/components/tenders/EditTenderDialog.jsx → frontend/src/services/users.js
- `TestDashboardDeterministicAcrossRuns()` --calls--> `ParseRowDashboard()`  [INFERRED]
  backend/internal/bid/importer/importer_test.go → backend/internal/bid/importer/dashboard.go

## Import Cycles
- None detected.

## Communities (59 total, 4 thin omitted)

### Community 0 - "context.Context"
Cohesion: 0.04
Nodes (16): AuthRepository, Role, User, UserPermissionOverride, BidRepository, UserSummary, FieldSuggestion, ReorderChecklistItem (+8 more)

### Community 1 - "xlsx.go"
Cohesion: 0.07
Nodes (53): commit(), connect(), getEnv(), pgx.Conn, main(), printSummary(), summarise(), blank() (+45 more)

### Community 2 - "github.com/gin-gonic/gin.Context"
Cohesion: 0.08
Nodes (24): extractTokenFromHeader(), parseIntQuery(), hasRole(), parseListParams(), respondPage(), extractBearerToken(), hasPermission(), BadRequest() (+16 more)

### Community 3 - "bidService"
Cohesion: 0.13
Nodes (10): TransitionResult, TransitionStageRequest, approverDisplayName(), authorizeEditDecision(), hasAnyRole(), needsRMApproval(), validateEMDDetails(), validateEMDExemption() (+2 more)

### Community 4 - "cn"
Cohesion: 0.06
Nodes (52): getHue(), getInitials(), UserAvatar(), Accordion(), AccordionContent(), AccordionItem(), AccordionTrigger(), AlertDialog() (+44 more)

### Community 5 - "Landing.jsx"
Cohesion: 0.05
Nodes (24): BentoTile(), handleMove(), DEMO_SHEET_TENDERS, Landing(), MotionLink, PrimaryButton(), ROLES, Login() (+16 more)

### Community 6 - "TicketResponse"
Cohesion: 0.05
Nodes (18): FieldMemory, TicketRepository, TicketService, CreateTicketRequest, ListTicketsParams, Ticket, TicketListPage, TicketResponse (+10 more)

### Community 7 - "TendersPage.jsx"
Cohesion: 0.08
Nodes (50): RFC-4180, ImportedPill(), InProgressPill(), COLUMNS, MasterSheetPage(), handleExport(), PILLS, plainText() (+42 more)

### Community 8 - "lucide-react"
Cohesion: 0.12
Nodes (30): ActivityLogDialog(), eventBadge(), FORMATS, STAGE_LABELS, STAGE_ORDER, INITIAL_FORM, backdropVariants, closeButtonVariants (+22 more)

### Community 9 - "UserManagement.jsx"
Cohesion: 0.12
Nodes (20): ForceResetDialog(), handleClose(), handleConfirm(), StageAccessDialog(), handleClose(), handleSave(), useDebounce(), UserManagement() (+12 more)

### Community 10 - "AuditLogQuery"
Cohesion: 0.18
Nodes (7): AddMicroEventRequest, AuditLogPage, AuditLogQuery, GlobalAuditItem, StageHistoryPage, StageHistoryResponse, decodeAuditCursor()

### Community 11 - "bid_service_test.go"
Cohesion: 0.10
Nodes (46): f64(), findRow(), TestDashboardDeterministicAcrossRuns(), TestDashboardUnrecordedResultsAreClosedNotLost(), TestGBXDuplicateRowsAreSkippedNotSummed(), TestGBXInconclusiveOutcomeIsClosedNotLost(), TestGBXNoIdentifierRowsStillImport(), NewBidService() (+38 more)

### Community 12 - "FeedbackPage.jsx"
Cohesion: 0.09
Nodes (38): CATEGORY_CLASSES, CATEGORY_FILTERS, CATEGORY_LABELS, formatTime(), SystemLogsPage(), ALLOWED_IMAGE_TYPES, FeedbackPage(), handleSubmit() (+30 more)

### Community 13 - "Alert"
Cohesion: 0.06
Nodes (9): Alert, AlertRepository, AlertService, NewAlertHandler(), NewPostgresAlertRepository(), fakeAlertSvc, fakeAlertSvc, postgresAlertRepo (+1 more)

### Community 14 - "postgresBidRepo"
Cohesion: 0.07
Nodes (9): BidChecklist, BidWorkspace, CreateBidParams, IdentifierMatch, scanBid(), scanBidFields(), scanBidFromRows(), postgresBidRepo (+1 more)

### Community 15 - "Dashboard.jsx"
Cohesion: 0.09
Nodes (37): AnalyticsPage(), EmdProjectionBlock(), getTenderDeadline(), isActivePipeline(), isEmdRequired(), ForcePasswordChangeGuard(), NAV_ITEMS, OverviewPanel() (+29 more)

### Community 16 - "fakeBidRepo"
Cohesion: 0.06
Nodes (9): PricingWorkspaceRow, BidStageHistory, RecordOutcomeRequest, TenderEditApproval, UserSummary, pgx.Row, scanPendingEdit(), fakeBidRepo (+1 more)

### Community 17 - "App.jsx"
Cohesion: 0.08
Nodes (34): App(), SettingsPage(), CATEGORY_COLORS, ROLE_BADGES, STAGE_COLORS, STAGE_LABELS, KPI_BAND_TONES, PipelineKpiBand() (+26 more)

### Community 18 - "StageWorkspaces.jsx"
Cohesion: 0.11
Nodes (46): logChecklistHistory(), AssignPresalesModal(), buildEmdDetailsTableHtml(), buildPresalesCands(), buildRemarkCalloutHtml(), buildTenderDetailHtml(), buildValuesAdjustedBannerHtml(), CompleteStageModal() (+38 more)

### Community 19 - "emdfix/main.go"
Cohesion: 0.10
Nodes (25): boolOr(), env(), fmtF(), main(), strOr(), env(), main(), printSection() (+17 more)

### Community 20 - "encoding/json.RawMessage"
Cohesion: 0.11
Nodes (14): NewAuthService(), Repository, Service, SystemConfig, NewHandler(), postgresRepo, NewPostgresRepository(), service (+6 more)

### Community 21 - "userService"
Cohesion: 0.11
Nodes (11): UserService, CreateUserRequest, UpdatePermissionsRequest, UpdateRolesRequest, UpdateStatusRequest, UpdateUserRequest, UserListResponse, UserResponse (+3 more)

### Community 22 - "systemlog/domain/models.go"
Cohesion: 0.14
Nodes (15): Decode(), Repository, Service, Event, EventItem, ListQuery, Page, Handler (+7 more)

### Community 23 - "go_pkg_context"
Cohesion: 0.17
Nodes (10): ForgotPasswordRequest, Permission, RefreshRequest, ResetPasswordOTPRequest, VerifyOTPRequest, go_pkg_context, go_pkg_crypto_rand, go_pkg_fmt (+2 more)

### Community 24 - "BidService"
Cohesion: 0.06
Nodes (15): BidService, AddChecklistRequest, AddMemberRequest, BidChecklistItem, BidResponse, CreateBidRequest, MemberResponse, PricingSuggestion (+7 more)

### Community 25 - "main"
Cohesion: 0.15
Nodes (23): main(), RegisterAlertRoutes(), RegisterAuthRoutes(), NewPostgresAuthRepository(), NewBulkImportHandler(), RegisterBidRoutes(), NewPostgresBidRepository(), RegisterTicketRoutes() (+15 more)

### Community 26 - "authService"
Cohesion: 0.12
Nodes (8): AuthService, ChangePasswordRequest, ForceResetRequest, LoginRequest, LoginResponse, NewAuthHandler(), UserInfo, authService

### Community 27 - "apiFetch"
Cohesion: 0.11
Nodes (28): AlertsPage(), ArchiveConfirmDialog(), handleConfirm(), TenderDetailPage(), createAlert(), deleteAlert(), getAlerts(), markAlertRead() (+20 more)

### Community 28 - "dependencies"
Cohesion: 0.08
Nodes (25): dependencies, canvas-confetti, class-variance-authority, clsx, exceljs, @fontsource-variable/instrument-sans, @fontsource-variable/inter, framer-motion (+17 more)

### Community 29 - "bid/domain/models.go"
Cohesion: 0.13
Nodes (22): deref(), fmtDate(), fmtNum(), writeReport(), CheckHeaders(), checkHeadersAgainst(), auditPageSize(), PageSize() (+14 more)

### Community 30 - "package.json"
Cohesion: 0.10
Nodes (22): name, private, type, version, canvas-confetti, clsx, eslint, @eslint/js (+14 more)

### Community 31 - "usePermissions"
Cohesion: 0.12
Nodes (20): ExcludeRoleGuard(), PermissionGuard(), RoleGuard(), Dashboard(), onKeyDown(), isChildActive(), Stage8Workspace(), useInternalApprovals() (+12 more)

### Community 32 - "components.json"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 33 - "ChecklistTab.jsx"
Cohesion: 0.18
Nodes (20): ChecklistTab(), OEM_PILL_COLORS, addSection(), cellBorder, cleanTitle(), exportChecklistToExcel(), OEM_HEADER_BG, OEM_HEADER_FG (+12 more)

### Community 34 - "jwt_service.go"
Cohesion: 0.13
Nodes (11): JWTService, TokenClaims, TokenPair, redis.Client, NewJWTService(), go_pkg_crypto_sha256, go_pkg_encoding_hex, go_pkg_github_com_golang_jwt_jwt_v5 (+3 more)

### Community 35 - "config.go"
Cohesion: 0.15
Nodes (17): NewAlertService(), getEnv(), DatabaseConfig, EmailConfig, JWTConfig, RedisConfig, Load(), EmailService (+9 more)

### Community 36 - "BulkImportPage"
Cohesion: 0.38
Nodes (7): BulkImportPage(), handleCommit(), handleFile(), commitLines(), errorLines(), previewLines(), bulkImportTenders()

### Community 37 - "CreateUserSheet"
Cohesion: 0.16
Nodes (12): CreateUserDialog(), handleClose(), handleSubmit(), resetForm(), validate(), CreateUserSheet(), handleSubmit(), onKeyDown() (+4 more)

### Community 38 - "TenderDetailPage.jsx"
Cohesion: 0.13
Nodes (14): ImportConsole(), PREFIX, TONE, RejectReasonDialog(), STAGE_GUIDE, STAGE_ICONS, TAB_IDS, TABS (+6 more)

### Community 39 - "server/main.go"
Cohesion: 0.21
Nodes (10): go_pkg_github_com_gin_gonic_gin, go_pkg_io, go_pkg_mime_multipart, go_pkg_net_http, go_pkg_os_signal, go_pkg_syscall, createAlertReq, APIResponse (+2 more)

### Community 40 - "AddTenderPage"
Cohesion: 0.20
Nodes (11): inputCls(), ManualForm(), handleSubmit(), loadUsers(), validate(), AddTenderPage(), handleSubmit(), nextStep() (+3 more)

### Community 41 - "EditTenderDialog"
Cohesion: 0.20
Nodes (14): applyAlertNote(), EditTenderDialog(), handleSubmit(), loadFullBid(), loadUsers(), validate(), fieldDiffLabel(), inputCls() (+6 more)

### Community 42 - "StageHistoryTab"
Cohesion: 0.24
Nodes (14): extractCommercialDetails(), fmt(), fmtMoney(), formatFullDateTime(), getBidEndDate(), getBidStartDate(), getEventTypeBadge(), getUserDisplayName() (+6 more)

### Community 43 - "time.Time"
Cohesion: 0.13
Nodes (40): CompetitorInfo, canonDashboardActivity(), canonDashboardPlatform(), deriveStageDashboard(), isOurName(), parseCompetitors(), ParseRowDashboard(), parseTimeFraction() (+32 more)

### Community 44 - "bid_service.go"
Cohesion: 0.09
Nodes (29): FieldDiff, alertNoteHTML(), buildBidListItem(), calcDaysRemaining(), derefFloat(), derefInt(), derefStr(), diffBidFields() (+21 more)

### Community 45 - "devDependencies"
Cohesion: 0.20
Nodes (10): devDependencies, eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals, @types/react, @types/react-dom (+2 more)

### Community 46 - "updateUserProfile"
Cohesion: 0.43
Nodes (6): EditUserDialog(), handleClose(), handleSubmit(), UserProfileModal(), handleSaveProfile(), updateUserProfile()

### Community 47 - "RolesPermissionsDialog"
Cohesion: 0.38
Nodes (4): RolesPermissionsDialog(), handleClose(), handleSave(), updateUserRoles()

### Community 48 - "ListBidsParams"
Cohesion: 0.40
Nodes (3): BidListItem, BidListResponse, ListBidsParams

### Community 49 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, lint, preview

### Community 50 - "transitionBidStage"
Cohesion: 0.32
Nodes (8): checkStageState(), StageHeaderActions(), StageActionPanel(), StageSectionsTab(), handleSetCurrentStage(), TransitionDialog(), submit(), transitionBidStage()

### Community 51 - "vite.config.js"
Cohesion: 0.40
Nodes (4): path, @tailwindcss/vite, vite, @vitejs/plugin-react

### Community 52 - "compilerOptions"
Cohesion: 0.50
Nodes (3): compilerOptions, baseUrl, paths

### Community 53 - "PricingSuggestionHint.jsx"
Cohesion: 0.53
Nodes (5): fmtMoney(), PricingSuggestionHint(), suggestionCache, useSuggestion(), getPricingSuggestion()

### Community 56 - "transitions.go"
Cohesion: 0.83
Nodes (3): GetAllowedTransitions(), IsTerminalStage(), IsTransitionAllowed()

## Knowledge Gaps
- **165 isolated node(s):** `graphify`, `graphify`, `name`, `private`, `version` (+160 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 284 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `TenderDetailPage.jsx` to `ChecklistTab.jsx`, `cn`, `Landing.jsx`, `TendersPage.jsx`, `lucide-react`, `UserManagement.jsx`, `FeedbackPage.jsx`, `Dashboard.jsx`, `App.jsx`, `StageWorkspaces.jsx`, `PricingSuggestionHint.jsx`, `package.json`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._
- **Why does `lucide-react` connect `lucide-react` to `ChecklistTab.jsx`, `cn`, `Landing.jsx`, `TenderDetailPage.jsx`, `TendersPage.jsx`, `UserManagement.jsx`, `FeedbackPage.jsx`, `Dashboard.jsx`, `App.jsx`, `StageWorkspaces.jsx`, `PricingSuggestionHint.jsx`, `list_exports.js`, `package.json`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **Why does `cn()` connect `cn` to `TenderDetailPage.jsx`, `lucide-react`, `UserManagement.jsx`, `FeedbackPage.jsx`, `Dashboard.jsx`, `App.jsx`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **What connects `graphify`, `graphify`, `name` to the rest of the system?**
  _165 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `context.Context` be split into smaller, more focused modules?**
  _Cohesion score 0.03521703521703522 - nodes in this community are weakly interconnected._
- **Should `xlsx.go` be split into smaller, more focused modules?**
  _Cohesion score 0.06836055656382335 - nodes in this community are weakly interconnected._
- **Should `github.com/gin-gonic/gin.Context` be split into smaller, more focused modules?**
  _Cohesion score 0.08313425704730053 - nodes in this community are weakly interconnected._