# Graph Report - Onetrack-GlobX  (2026-09-30)

## Corpus Check
- 287 files · ~345,218 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 11 file(s) not represented in the graph (top: (none) 5, .exe 2, .css 2)

## Summary
- 1799 nodes · 5477 edges · 73 communities (64 shown, 9 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 99 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `f23c88be`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- context.Context
- importer.go
- github.com/gin-gonic/gin.Context
- bidService
- cn
- Landing.jsx
- TicketResponse
- TendersPage.jsx
- StageWorkspaces.jsx
- bids.js
- time.Time
- bid_service_test.go
- EditTenderDialog.jsx
- Alert
- postgresBidRepo
- AddTenderDialog.jsx
- pgx.Row
- AnalyticsPage.jsx
- usePermissions
- emdfix/main.go
- encoding/json.RawMessage
- userService
- Repository
- auth/domain/models.go
- BidChecklistItem
- UserRepository
- authService
- TenderDetailPage.jsx
- dependencies
- bid/domain/models.go
- package.json
- Dashboard.jsx
- components.json
- ChecklistTab.jsx
- JWTService
- EmailService
- BulkImportPage.jsx
- CreateUserSheet
- importtracker/main.go
- go_pkg_context
- listUsers
- xlsx.go
- main
- normalize.go
- bid_service.go
- devDependencies
- updateUserProfile
- RolesPermissionsDialog
- fakeBidRepo
- scripts
- UserSummary
- BidWorkspace
- compilerOptions
- EditTenderDialog
- list_exports.js
- github.com/onetrack/backend
- .TransitionStage
- CLAUDE.md
- .claude/CLAUDE.md
- diffBidFields
- apiFetch
- updateBid
- server/main.go
- github.com/jackc/pgx/v5/pgxpool.Pool
- Dashboard
- config.go
- CreateUserDialog
- AddTenderPage
- vite.config.js
- MembersTab
- UserSummary
- UserSummary
- go_pkg_github_com_onetrack_backend_internal_bid_domain

## God Nodes (most connected - your core abstractions)
1. `cn()` - 95 edges
2. `apiFetch()` - 67 edges
3. `react` - 65 edges
4. `Success()` - 56 edges
5. `fakeBidRepo` - 50 edges
6. `InternalError()` - 49 edges
7. `lucide-react` - 47 edges
8. `BidRepository` - 44 edges
9. `bidService` - 44 edges
10. `postgresBidRepo` - 42 edges

## Surprising Connections (you probably didn't know these)
- `TestFieldSuggestionEntries()` --calls--> `fieldSuggestionEntries()`  [INFERRED]
  backend/internal/bid/service/bid_service_test.go → backend/internal/bid/service/bid_service.go
- `TestExtractProductFields()` --calls--> `extractProductFields()`  [INFERRED]
  backend/internal/bid/service/bid_service_test.go → backend/internal/bid/service/bid_service.go
- `TestDiffBidFields()` --calls--> `diffBidFields()`  [INFERRED]
  backend/internal/bid/service/bid_service_test.go → backend/internal/bid/service/bid_service.go
- `addBidMember()` --calls--> `apiFetch()`  [EXTRACTED]
  frontend/src/services/bids.js → frontend/src/services/auth.js
- `getSystemConfig()` --calls--> `apiFetch()`  [EXTRACTED]
  frontend/src/services/systemConfig.js → frontend/src/services/auth.js

## Import Cycles
- None detected.

## Communities (73 total, 9 thin omitted)

### Community 0 - "context.Context"
Cohesion: 0.05
Nodes (12): BidRepository, BidService, AddMemberRequest, FieldSuggestion, PricingSuggestion, ReorderChecklistItem, ReorderChecklistRequest, TenderOwnerPerformanceStat (+4 more)

### Community 1 - "importer.go"
Cohesion: 0.11
Nodes (37): commit(), summarise(), blank(), buildPreview(), CheckHeaders(), checkHeadersAgainst(), dashboardRowParser(), derefStr() (+29 more)

### Community 2 - "github.com/gin-gonic/gin.Context"
Cohesion: 0.08
Nodes (24): extractTokenFromHeader(), parseIntQuery(), hasRole(), parseListParams(), respondPage(), extractBearerToken(), hasPermission(), BadRequest() (+16 more)

### Community 3 - "bidService"
Cohesion: 0.19
Nodes (7): approverDisplayName(), authorizeEditDecision(), hasAnyRole(), validateEMDDetails(), validateEMDExemption(), validateEMDMutualExclusivity(), bidService

### Community 4 - "cn"
Cohesion: 0.07
Nodes (46): getHue(), getInitials(), UserAvatar(), Accordion(), AccordionContent(), AccordionItem(), AccordionTrigger(), AlertDialog() (+38 more)

### Community 5 - "Landing.jsx"
Cohesion: 0.06
Nodes (26): BentoTile(), handleMove(), DEMO_SHEET_TENDERS, MotionLink, PrimaryButton(), ROLES, Login(), FaqSection() (+18 more)

### Community 6 - "TicketResponse"
Cohesion: 0.05
Nodes (18): FieldMemory, TicketRepository, TicketService, CreateTicketRequest, ListTicketsParams, Ticket, TicketListPage, TicketResponse (+10 more)

### Community 7 - "TendersPage.jsx"
Cohesion: 0.08
Nodes (48): ActivityLogDialog(), eventBadge(), ExportSuccessDialog(), ImportedPill(), InProgressPill(), COLUMNS, MasterSheetPage(), handleExport() (+40 more)

### Community 8 - "StageWorkspaces.jsx"
Cohesion: 0.12
Nodes (31): INITIAL_FORM, backdropVariants, closeButtonVariants, INITIAL_FORM, panelVariants, PERMISSION_CATEGORIES, PERMISSION_METADATA, ROLE_DETAILS (+23 more)

### Community 9 - "bids.js"
Cohesion: 0.12
Nodes (21): fmtMoney(), PricingSuggestionHint(), suggestionCache, useSuggestion(), ArchiveConfirmDialog(), handleConfirm(), STATUS_DISPLAY_LABELS, StatusBadge() (+13 more)

### Community 10 - "time.Time"
Cohesion: 0.10
Nodes (19): AddMicroEventRequest, AuditLogPage, AuditLogQuery, GlobalAuditItem, ListBidsParams, StageHistoryPage, StageHistoryResponse, auditPageSize() (+11 more)

### Community 11 - "bid_service_test.go"
Cohesion: 0.09
Nodes (52): ParseWorkbook(), f64(), findRow(), TestDashboardDeterministicAcrossRuns(), TestDashboardUnrecordedResultsAreClosedNotLost(), TestExemptedRowsCarryAnExemptionType(), TestGBXDuplicateRowsAreSkippedNotSummed(), TestGBXInconclusiveOutcomeIsClosedNotLost() (+44 more)

### Community 12 - "EditTenderDialog.jsx"
Cohesion: 0.08
Nodes (43): CATEGORY_CLASSES, CATEGORY_FILTERS, CATEGORY_LABELS, formatTime(), SystemLogsPage(), formatDateTime(), UserTable(), handleDelete() (+35 more)

### Community 13 - "Alert"
Cohesion: 0.06
Nodes (11): Alert, AlertRepository, AlertService, SafeLink(), TestSafeLink(), NewAlertHandler(), NewPostgresAlertRepository(), fakeAlertSvc (+3 more)

### Community 14 - "postgresBidRepo"
Cohesion: 0.06
Nodes (6): BidChecklist, CreateBidParams, IdentifierMatch, MemberResponse, PendingApproval, postgresBidRepo

### Community 15 - "AddTenderDialog.jsx"
Cohesion: 0.10
Nodes (22): ForceResetDialog(), handleClose(), handleConfirm(), StageAccessDialog(), handleClose(), handleSave(), AddTenderDialog(), BID_TYPES (+14 more)

### Community 17 - "AnalyticsPage.jsx"
Cohesion: 0.10
Nodes (33): App(), SettingsPage(), AnalyticsPage(), CATEGORY_COLORS, ROLE_BADGES, STAGE_COLORS, STAGE_LABELS, KPI_BAND_TONES (+25 more)

### Community 18 - "usePermissions"
Cohesion: 0.10
Nodes (39): ExcludeRoleGuard(), PermissionGuard(), RoleGuard(), logChecklistHistory(), buildEmdDetailsTableHtml(), buildPresalesCands(), buildRemarkCalloutHtml(), buildTenderDetailHtml() (+31 more)

### Community 19 - "emdfix/main.go"
Cohesion: 0.09
Nodes (28): boolOr(), env(), fmtF(), main(), strOr(), env(), main(), printSection() (+20 more)

### Community 20 - "encoding/json.RawMessage"
Cohesion: 0.12
Nodes (12): Repository, Service, SystemConfig, NewHandler(), postgresRepo, NewPostgresRepository(), service, NewService() (+4 more)

### Community 21 - "userService"
Cohesion: 0.11
Nodes (11): UserService, CreateUserRequest, UpdatePermissionsRequest, UpdateRolesRequest, UpdateStatusRequest, UpdateUserRequest, UserListResponse, UserResponse (+3 more)

### Community 22 - "Repository"
Cohesion: 0.21
Nodes (9): Repository, Service, ListQuery, Page, Handler, NewHandler(), NewPostgresRepository(), service (+1 more)

### Community 23 - "auth/domain/models.go"
Cohesion: 0.11
Nodes (20): ForgotPasswordRequest, Permission, RefreshRequest, ResetPasswordOTPRequest, VerifyOTPRequest, go_pkg_crypto_rand, go_pkg_crypto_tls, go_pkg_errors (+12 more)

### Community 24 - "BidChecklistItem"
Cohesion: 0.33
Nodes (3): AddChecklistRequest, BidChecklistItem, UpdateChecklistRequest

### Community 25 - "UserRepository"
Cohesion: 0.04
Nodes (11): AuthRepository, Role, User, UserPermissionOverride, NewPostgresAuthRepository(), UserRepository, ListUsersParams, mapKeys() (+3 more)

### Community 26 - "authService"
Cohesion: 0.12
Nodes (8): AuthService, ChangePasswordRequest, ForceResetRequest, LoginRequest, LoginResponse, NewAuthHandler(), UserInfo, authService

### Community 27 - "TenderDetailPage.jsx"
Cohesion: 0.10
Nodes (36): StatusPill(), checkStageState(), DynamicStageWorkspace(), StageHeaderActions(), useInternalApprovals(), extractCommercialDetails(), fmt(), fmtMoney() (+28 more)

### Community 28 - "dependencies"
Cohesion: 0.08
Nodes (25): dependencies, canvas-confetti, class-variance-authority, clsx, exceljs, @fontsource-variable/instrument-sans, @fontsource-variable/inter, framer-motion (+17 more)

### Community 29 - "bid/domain/models.go"
Cohesion: 0.19
Nodes (9): scanBid(), scanBidFields(), scanBidFromRows(), PendingApprovalError, SetStageRestrictionsRequest, StageRestrictionsResponse, go_pkg_math, go_pkg_time (+1 more)

### Community 30 - "package.json"
Cohesion: 0.09
Nodes (23): name, private, type, version, canvas-confetti, clsx, eslint, @eslint/js (+15 more)

### Community 31 - "Dashboard.jsx"
Cohesion: 0.13
Nodes (23): EmdProjectionBlock(), getTenderDeadline(), isActivePipeline(), isEmdRequired(), ForcePasswordChangeGuard(), NAV_ITEMS, BID_TYPES, BIDDER_SUGGESTIONS (+15 more)

### Community 32 - "components.json"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 33 - "ChecklistTab.jsx"
Cohesion: 0.15
Nodes (23): ChecklistTab(), OEM_PILL_COLORS, addSection(), cellBorder, cleanTitle(), exportChecklistToExcel(), OEM_HEADER_BG, OEM_HEADER_FG (+15 more)

### Community 34 - "JWTService"
Cohesion: 0.17
Nodes (7): JWTService, TokenClaims, TokenPair, redis.Client, NewJWTService(), time.Duration, jwtService

### Community 35 - "EmailService"
Cohesion: 0.33
Nodes (5): NewAlertService(), NewAuthService(), EmailService, NewEmailService(), uniqueNonEmpty()

### Community 36 - "BulkImportPage.jsx"
Cohesion: 0.19
Nodes (13): BulkImportPage(), handleCommit(), handleFile(), FORMATS, STAGE_LABELS, STAGE_ORDER, ImportConsole(), PREFIX (+5 more)

### Community 37 - "CreateUserSheet"
Cohesion: 0.29
Nodes (6): CreateUserSheet(), handleSubmit(), onKeyDown(), requestClose(), resetForm(), validate()

### Community 38 - "importtracker/main.go"
Cohesion: 0.31
Nodes (10): connect(), deref(), fmtDate(), fmtNum(), getEnv(), pgx.Conn, main(), printSummary() (+2 more)

### Community 39 - "go_pkg_context"
Cohesion: 0.18
Nodes (7): go_pkg_context, go_pkg_encoding_base64, go_pkg_encoding_json, go_pkg_fmt, go_pkg_github_com_jackc_pgx_v5_pgxpool, go_pkg_github_com_onetrack_backend_internal_user_domain, go_pkg_html

### Community 40 - "listUsers"
Cohesion: 0.19
Nodes (10): useDebounce(), UserManagement(), inputCls(), ManualForm(), handleSubmit(), loadUsers(), validate(), loadUsers() (+2 more)

### Community 41 - "xlsx.go"
Cohesion: 0.21
Nodes (16): atoiSafe(), colIndex(), ReadSheet(), ReadSheetFrom(), readSheetFromZip(), readZipEntry(), resolveSheetTarget(), go_pkg_archive_zip (+8 more)

### Community 42 - "main"
Cohesion: 0.23
Nodes (16): main(), RegisterAlertRoutes(), RegisterAuthRoutes(), RegisterBidRoutes(), RegisterTicketRoutes(), AuthMiddleware, NewAuthMiddleware(), redis.Client (+8 more)

### Community 43 - "normalize.go"
Cohesion: 0.18
Nodes (31): canonDashboardActivity(), canonDashboardPlatform(), deriveStageDashboard(), isOurName(), parseCompetitors(), ParseRowDashboard(), parseTimeFraction(), timeOfDay() (+23 more)

### Community 44 - "bid_service.go"
Cohesion: 0.14
Nodes (16): alertNoteHTML(), diffRowsHTML(), extractProductFields(), fieldLabel(), fieldSuggestionEntries(), money(), ownershipChangeSummaryHTML(), pickL1PricingQuote() (+8 more)

### Community 45 - "devDependencies"
Cohesion: 0.20
Nodes (10): devDependencies, eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals, @types/react, @types/react-dom (+2 more)

### Community 46 - "updateUserProfile"
Cohesion: 0.43
Nodes (6): EditUserDialog(), handleClose(), handleSubmit(), UserProfileModal(), handleSaveProfile(), updateUserProfile()

### Community 47 - "RolesPermissionsDialog"
Cohesion: 0.38
Nodes (4): RolesPermissionsDialog(), handleClose(), handleSave(), updateUserRoles()

### Community 48 - "fakeBidRepo"
Cohesion: 0.06
Nodes (9): PricingWorkspaceRow, BidStageHistory, RecordOutcomeRequest, TenderEditApproval, scanPendingEdit(), CompetitorInfo, pgx.Row, fakeBidRepo (+1 more)

### Community 49 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, lint, preview

### Community 50 - "UserSummary"
Cohesion: 0.26
Nodes (9): BidListItem, BidListResponse, BidResponse, CreateBidRequest, UserSummary, buildBidListItem(), buildBidResponse(), calcDaysRemaining() (+1 more)

### Community 52 - "compilerOptions"
Cohesion: 0.50
Nodes (3): compilerOptions, baseUrl, paths

### Community 53 - "EditTenderDialog"
Cohesion: 0.22
Nodes (13): applyAlertNote(), EditTenderDialog(), handleSubmit(), loadFullBid(), validate(), fieldDiffLabel(), inputCls(), parseRequestedProducts() (+5 more)

### Community 56 - ".TransitionStage"
Cohesion: 0.21
Nodes (10): ApprovalLink(), StageLink(), TenderLink(), TransitionResult, TransitionStageRequest, getRoleForStage(), GetAllowedTransitions(), IsTerminalStage() (+2 more)

### Community 59 - "diffBidFields"
Cohesion: 0.29
Nodes (9): FieldDiff, derefFloat(), derefInt(), derefStr(), diffBidFields(), diffDateField(), diffField(), diffRequestFields() (+1 more)

### Community 60 - "apiFetch"
Cohesion: 0.14
Nodes (24): AlertsPage(), FeedbackPage(), handleSubmit(), loadMyTickets(), removeImage(), formatDate(), formatWhen(), TicketDetailDialog() (+16 more)

### Community 61 - "updateBid"
Cohesion: 0.26
Nodes (13): AssignPresalesModal(), CompleteStageModal(), EmdDecisionModal(), logStageInteraction(), NoGoModal(), ReVerificationModal(), Stage10Workspace(), Stage11Workspace() (+5 more)

### Community 62 - "server/main.go"
Cohesion: 0.09
Nodes (20): go_pkg_crypto_sha256, go_pkg_encoding_hex, go_pkg_github_com_golang_jwt_jwt_v5, go_pkg_github_com_onetrack_backend_internal_auth_handler, go_pkg_github_com_onetrack_backend_internal_auth_repository, go_pkg_github_com_onetrack_backend_internal_feedback_repository, go_pkg_github_com_onetrack_backend_internal_platform_database, go_pkg_github_com_onetrack_backend_internal_systemconfig_handler (+12 more)

### Community 63 - "github.com/jackc/pgx/v5/pgxpool.Pool"
Cohesion: 0.22
Nodes (9): NewBulkImportHandler(), NewPostgresBidRepository(), NewPostgresPool(), Event, postgresRepo, EnsureDefaultAdmin(), RunAutoMigrations(), github.com/jackc/pgx/v5/pgxpool.Pool (+1 more)

### Community 64 - "Dashboard"
Cohesion: 0.22
Nodes (7): Dashboard(), onKeyDown(), isChildActive(), guessFeedbackCategory(), PATH_CATEGORY_MAP, STAGE_CATEGORY_MAP, getOpenTicketCount()

### Community 65 - "config.go"
Cohesion: 0.42
Nodes (8): getEnv(), Load(), Config, DatabaseConfig, EmailConfig, JWTConfig, RedisConfig, ServerConfig

### Community 66 - "CreateUserDialog"
Cohesion: 0.36
Nodes (5): CreateUserDialog(), handleClose(), handleSubmit(), resetForm(), validate()

### Community 67 - "AddTenderPage"
Cohesion: 0.38
Nodes (5): AddTenderPage(), handleSubmit(), nextStep(), validateStep(), inputCls()

### Community 68 - "vite.config.js"
Cohesion: 0.40
Nodes (4): path, @tailwindcss/vite, vite, @vitejs/plugin-react

### Community 69 - "MembersTab"
Cohesion: 1.00
Nodes (3): MembersTab(), handleRemove(), removeBidMember()

## Knowledge Gaps
- **167 isolated node(s):** `createAlertReq`, `StageRestrictionsResponse`, `SetStageRestrictionsRequest`, `alertNoteFields`, `STANDARD_PORTAL_SOURCES` (+162 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 305 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `StageWorkspaces.jsx` to `ChecklistTab.jsx`, `BulkImportPage.jsx`, `cn`, `Landing.jsx`, `TendersPage.jsx`, `bids.js`, `EditTenderDialog.jsx`, `AddTenderDialog.jsx`, `AnalyticsPage.jsx`, `TenderDetailPage.jsx`, `package.json`, `Dashboard.jsx`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **Why does `BidHandler` connect `github.com/gin-gonic/gin.Context` to `context.Context`, `main`, `bid/domain/models.go`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **Why does `cn()` connect `cn` to `StageWorkspaces.jsx`, `EditTenderDialog.jsx`, `AddTenderDialog.jsx`, `AnalyticsPage.jsx`, `Dashboard.jsx`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **What connects `createAlertReq`, `StageRestrictionsResponse`, `SetStageRestrictionsRequest` to the rest of the system?**
  _167 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `context.Context` be split into smaller, more focused modules?**
  _Cohesion score 0.04803635183382019 - nodes in this community are weakly interconnected._
- **Should `importer.go` be split into smaller, more focused modules?**
  _Cohesion score 0.11295681063122924 - nodes in this community are weakly interconnected._
- **Should `github.com/gin-gonic/gin.Context` be split into smaller, more focused modules?**
  _Cohesion score 0.08313425704730053 - nodes in this community are weakly interconnected._