# Graph Report - Onetrack-GlobX  (2026-09-25)

## Corpus Check
- 282 files · ~342,762 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 11 file(s) not represented in the graph (top: (none) 5, .exe 2, .css 2)

## Summary
- 1763 nodes · 5416 edges · 67 communities (62 shown, 5 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 94 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `cb597bc9`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- context.Context
- Preview
- github.com/gin-gonic/gin.Context
- bidService
- cn
- Landing.jsx
- TicketResponse
- TendersPage.jsx
- react
- UserTable.jsx
- AuditLogQuery
- bid_service_test.go
- FeedbackPage.jsx
- Alert
- fakeBidRepo
- EditTenderDialog.jsx
- pgx.Row
- Dashboard.jsx
- StageWorkspaces.jsx
- emdfix/main.go
- github.com/jackc/pgx/v5/pgxpool.Pool
- userService
- systemlog/domain/models.go
- auth/domain/models.go
- BidChecklistItem
- AuthRepository
- authService
- TenderDetailPage.jsx
- dependencies
- bid/domain/models.go
- package.json
- App.jsx
- components.json
- checklistExport.js
- JWTService
- config.go
- BulkImportPage
- CreateUserSheet
- EnrichDuplicates
- server/main.go
- AddTenderPage
- xlsx.go
- StageHistoryTab
- normalize.go
- bid_service.go
- devDependencies
- updateUserProfile
- RolesPermissionsDialog
- BidWorkspace
- scripts
- .CreateBid
- .applyUpdate
- compilerOptions
- importer_test.go
- list_exports.js
- github.com/onetrack/backend
- .TransitionStage
- CLAUDE.md
- .claude/CLAUDE.md
- diffBidFields
- FeedbackPage
- computePipelineSummary
- jwt_service.go
- time.Time
- StageAccessDialog
- ForceResetDialog
- permissionMetaData.js

## God Nodes (most connected - your core abstractions)
1. `cn()` - 95 edges
2. `apiFetch()` - 66 edges
3. `react` - 65 edges
4. `Success()` - 55 edges
5. `fakeBidRepo` - 49 edges
6. `InternalError()` - 48 edges
7. `lucide-react` - 47 edges
8. `BidRepository` - 43 edges
9. `bidService` - 43 edges
10. `postgresBidRepo` - 41 edges

## Surprising Connections (you probably didn't know these)
- `CardAction()` --calls--> `cn()`  [EXTRACTED]
  frontend/src/components/ui/card.jsx → frontend/src/lib/utils.js
- `CardFooter()` --calls--> `cn()`  [EXTRACTED]
  frontend/src/components/ui/card.jsx → frontend/src/lib/utils.js
- `logChecklistHistory()` --calls--> `logStageMicroEvent()`  [EXTRACTED]
  frontend/src/components/tenders/ChecklistTab.jsx → frontend/src/services/auditLogger.js
- `createAlert()` --calls--> `apiFetch()`  [EXTRACTED]
  frontend/src/services/alerts.js → frontend/src/services/auth.js
- `getSystemConfig()` --calls--> `apiFetch()`  [EXTRACTED]
  frontend/src/services/systemConfig.js → frontend/src/services/auth.js

## Import Cycles
- None detected.

## Communities (67 total, 5 thin omitted)

### Community 0 - "context.Context"
Cohesion: 0.06
Nodes (8): BidRepository, BidService, UserSummary, FieldSuggestion, RecordOutcomeRequest, ReorderChecklistItem, TenderOwnerPerformanceStat, context.Context

### Community 1 - "Preview"
Cohesion: 0.14
Nodes (24): summarise(), buildPreview(), CheckHeaders(), checkHeadersAgainst(), dashboardRowParser(), derefStr(), findDuplicates(), Duplicate (+16 more)

### Community 2 - "github.com/gin-gonic/gin.Context"
Cohesion: 0.06
Nodes (48): main(), NewAlertHandler(), RegisterAlertRoutes(), extractTokenFromHeader(), NewAuthHandler(), RegisterAuthRoutes(), NewBidHandler(), parseIntQuery() (+40 more)

### Community 3 - "bidService"
Cohesion: 0.22
Nodes (3): approverDisplayName(), needsRMApproval(), bidService

### Community 4 - "cn"
Cohesion: 0.06
Nodes (47): getHue(), getInitials(), UserAvatar(), Accordion(), AccordionContent(), AccordionItem(), AccordionTrigger(), AlertDialog() (+39 more)

### Community 5 - "Landing.jsx"
Cohesion: 0.06
Nodes (24): BentoTile(), handleMove(), DEMO_SHEET_TENDERS, Landing(), MotionLink, PrimaryButton(), ROLES, FaqSection() (+16 more)

### Community 6 - "TicketResponse"
Cohesion: 0.06
Nodes (17): FieldMemory, TicketRepository, TicketService, CreateTicketRequest, ListTicketsParams, Ticket, TicketListPage, TicketResponse (+9 more)

### Community 7 - "TendersPage.jsx"
Cohesion: 0.10
Nodes (42): ExportSuccessDialog(), InProgressPill(), COLUMNS, MasterSheetPage(), handleExport(), PILLS, plainText(), StatusPill() (+34 more)

### Community 8 - "react"
Cohesion: 0.12
Nodes (35): ActivityLogDialog(), eventBadge(), FORMATS, STAGE_LABELS, STAGE_ORDER, INITIAL_FORM, backdropVariants, closeButtonVariants (+27 more)

### Community 9 - "UserTable.jsx"
Cohesion: 0.24
Nodes (8): RoleBadge(), formatDateTime(), UserTable(), handleDelete(), handleStatusChange(), deleteUser(), updateUserStatus(), framer-motion

### Community 10 - "AuditLogQuery"
Cohesion: 0.13
Nodes (11): AddMicroEventRequest, AuditLogPage, AuditLogQuery, GlobalAuditItem, StageHistoryPage, StageHistoryResponse, UserSummary, auditPageSize() (+3 more)

### Community 11 - "bid_service_test.go"
Cohesion: 0.12
Nodes (39): NewBidService(), floatPtr(), hasAlertType(), intPtr(), lastEventType(), newLedgerTestBid(), strPtr(), TestAddRemoveMember_LogActions() (+31 more)

### Community 12 - "FeedbackPage.jsx"
Cohesion: 0.10
Nodes (30): CATEGORY_CLASSES, CATEGORY_FILTERS, CATEGORY_LABELS, formatTime(), SystemLogsPage(), ALLOWED_IMAGE_TYPES, formatWhen(), TicketDetailDialog() (+22 more)

### Community 13 - "Alert"
Cohesion: 0.05
Nodes (9): Alert, AlertRepository, AlertService, NewPostgresAlertRepository(), fakeAlertSvc, fakeAlertSvc, UserRepository, postgresAlertRepo (+1 more)

### Community 14 - "fakeBidRepo"
Cohesion: 0.04
Nodes (12): PricingWorkspaceRow, BidChecklist, BidStageHistory, CreateBidParams, IdentifierMatch, MemberResponse, TenderEditApproval, scanPendingEdit() (+4 more)

### Community 15 - "EditTenderDialog.jsx"
Cohesion: 0.06
Nodes (45): AddTenderDialog(), BID_TYPES, EMD_TYPES, PORTAL_SOURCES, useMacOSDialog(), BID_TYPES, BIDDER_SUGGESTIONS, OEM_SUGGESTIONS (+37 more)

### Community 17 - "Dashboard.jsx"
Cohesion: 0.07
Nodes (52): SettingsPage(), AnalyticsPage(), CATEGORY_COLORS, ROLE_BADGES, STAGE_COLORS, STAGE_LABELS, EmdProjectionBlock(), getTenderDeadline() (+44 more)

### Community 18 - "StageWorkspaces.jsx"
Cohesion: 0.08
Nodes (59): AlertsPage(), AssignPresalesModal(), buildEmdDetailsTableHtml(), buildPresalesCands(), buildRemarkCalloutHtml(), buildTenderDetailHtml(), buildValuesAdjustedBannerHtml(), checkStageState() (+51 more)

### Community 19 - "emdfix/main.go"
Cohesion: 0.10
Nodes (26): boolOr(), env(), fmtF(), main(), strOr(), env(), main(), printSection() (+18 more)

### Community 20 - "github.com/jackc/pgx/v5/pgxpool.Pool"
Cohesion: 0.08
Nodes (21): NewPostgresAuthRepository(), NewAuthService(), NewBulkImportHandler(), NewPostgresBidRepository(), NewPostgresPool(), Repository, Service, SystemConfig (+13 more)

### Community 21 - "userService"
Cohesion: 0.11
Nodes (10): UserService, CreateUserRequest, UpdatePermissionsRequest, UpdateRolesRequest, UpdateStatusRequest, UpdateUserRequest, UserListResponse, UserResponse (+2 more)

### Community 22 - "systemlog/domain/models.go"
Cohesion: 0.13
Nodes (16): encodeAuditCursor(), Encode(), Repository, Service, Event, EventItem, ListQuery, Page (+8 more)

### Community 23 - "auth/domain/models.go"
Cohesion: 0.22
Nodes (8): ForgotPasswordRequest, Permission, RefreshRequest, ResetPasswordOTPRequest, VerifyOTPRequest, go_pkg_crypto_rand, go_pkg_math_big, go_pkg_strings

### Community 24 - "BidChecklistItem"
Cohesion: 0.20
Nodes (5): AddChecklistRequest, BidChecklistItem, ReorderChecklistRequest, UpdateChecklistRequest, UserSummary

### Community 25 - "AuthRepository"
Cohesion: 0.05
Nodes (8): AuthRepository, Role, User, UserPermissionOverride, ListUsersParams, mapKeys(), postgresAuthRepo, postgresUserRepo

### Community 26 - "authService"
Cohesion: 0.12
Nodes (7): AuthService, ChangePasswordRequest, ForceResetRequest, LoginRequest, LoginResponse, UserInfo, authService

### Community 27 - "TenderDetailPage.jsx"
Cohesion: 0.08
Nodes (49): ChecklistTab(), logChecklistHistory(), OEM_PILL_COLORS, ImportedPill(), RejectReasonDialog(), ArchiveConfirmDialog(), handleConfirm(), MembersTab() (+41 more)

### Community 28 - "dependencies"
Cohesion: 0.08
Nodes (25): dependencies, canvas-confetti, class-variance-authority, clsx, exceljs, @fontsource-variable/instrument-sans, @fontsource-variable/inter, framer-motion (+17 more)

### Community 29 - "bid/domain/models.go"
Cohesion: 0.11
Nodes (20): deref(), fmtDate(), fmtNum(), writeReport(), PricingSuggestion, PendingApprovalError, PricingDeal, SetStageRestrictionsRequest (+12 more)

### Community 30 - "package.json"
Cohesion: 0.09
Nodes (26): name, private, type, version, canvas-confetti, clsx, eslint, @eslint/js (+18 more)

### Community 31 - "App.jsx"
Cohesion: 0.12
Nodes (16): App(), ExcludeRoleGuard(), PermissionGuard(), RoleGuard(), useDebounce(), UserManagement(), Login(), usePermissions() (+8 more)

### Community 32 - "components.json"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 33 - "checklistExport.js"
Cohesion: 0.18
Nodes (13): addSection(), cellBorder, cleanTitle(), OEM_HEADER_BG, OEM_HEADER_FG, THIN, isMafItem(), readOemDoc() (+5 more)

### Community 34 - "JWTService"
Cohesion: 0.17
Nodes (7): JWTService, TokenClaims, TokenPair, redis.Client, NewJWTService(), time.Duration, jwtService

### Community 35 - "config.go"
Cohesion: 0.16
Nodes (16): NewAlertService(), getEnv(), DatabaseConfig, EmailConfig, JWTConfig, RedisConfig, Load(), EmailService (+8 more)

### Community 36 - "BulkImportPage"
Cohesion: 0.38
Nodes (7): BulkImportPage(), handleCommit(), handleFile(), commitLines(), errorLines(), previewLines(), bulkImportTenders()

### Community 37 - "CreateUserSheet"
Cohesion: 0.16
Nodes (12): CreateUserDialog(), handleClose(), handleSubmit(), resetForm(), validate(), CreateUserSheet(), handleSubmit(), onKeyDown() (+4 more)

### Community 38 - "EnrichDuplicates"
Cohesion: 0.18
Nodes (15): commit(), connect(), getEnv(), pgx.Conn, main(), printSummary(), blank(), EnrichDuplicates() (+7 more)

### Community 39 - "server/main.go"
Cohesion: 0.19
Nodes (9): go_pkg_bytes, go_pkg_context, go_pkg_encoding_json, go_pkg_fmt, go_pkg_github_com_jackc_pgx_v5_pgxpool, go_pkg_github_com_onetrack_backend_internal_bid_domain, go_pkg_net_http, go_pkg_os_signal (+1 more)

### Community 40 - "AddTenderPage"
Cohesion: 0.20
Nodes (11): inputCls(), ManualForm(), handleSubmit(), loadUsers(), validate(), AddTenderPage(), handleSubmit(), nextStep() (+3 more)

### Community 41 - "xlsx.go"
Cohesion: 0.22
Nodes (15): atoiSafe(), colIndex(), ReadSheet(), readSheetFromZip(), readZipEntry(), resolveSheetTarget(), go_pkg_archive_zip, go_pkg_encoding_xml (+7 more)

### Community 42 - "StageHistoryTab"
Cohesion: 0.24
Nodes (14): extractCommercialDetails(), fmt(), fmtMoney(), formatFullDateTime(), getBidEndDate(), getBidStartDate(), getEventTypeBadge(), getUserDisplayName() (+6 more)

### Community 43 - "normalize.go"
Cohesion: 0.20
Nodes (31): canonDashboardActivity(), canonDashboardPlatform(), deriveStageDashboard(), isOurName(), parseCompetitors(), ParseRowDashboard(), parseTimeFraction(), timeOfDay() (+23 more)

### Community 44 - "bid_service.go"
Cohesion: 0.15
Nodes (15): BidListItem, alertNoteHTML(), buildBidListItem(), buildBidResponse(), calcDaysRemaining(), isImportedBid(), money(), ownershipChangeSummaryHTML() (+7 more)

### Community 45 - "devDependencies"
Cohesion: 0.20
Nodes (10): devDependencies, eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals, @types/react, @types/react-dom (+2 more)

### Community 46 - "updateUserProfile"
Cohesion: 0.43
Nodes (6): EditUserDialog(), handleClose(), handleSubmit(), UserProfileModal(), handleSaveProfile(), updateUserProfile()

### Community 47 - "RolesPermissionsDialog"
Cohesion: 0.38
Nodes (4): RolesPermissionsDialog(), handleClose(), handleSave(), updateUserRoles()

### Community 48 - "BidWorkspace"
Cohesion: 0.22
Nodes (7): BidListResponse, BidWorkspace, ListBidsParams, scanBid(), scanBidFields(), scanBidFromRows(), scannable

### Community 49 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, lint, preview

### Community 50 - ".CreateBid"
Cohesion: 0.14
Nodes (10): AddMemberRequest, BidResponse, CreateBidRequest, extractProductFields(), fieldSuggestionEntries(), validateEMDDetails(), validateEMDExemption(), validateEMDMutualExclusivity() (+2 more)

### Community 51 - ".applyUpdate"
Cohesion: 0.23
Nodes (5): UpdateBidRequest, authorizeEditDecision(), diffRowsHTML(), fieldLabel(), hasAnyRole()

### Community 52 - "compilerOptions"
Cohesion: 0.50
Nodes (3): compilerOptions, baseUrl, paths

### Community 53 - "importer_test.go"
Cohesion: 0.29
Nodes (10): MarkDuplicates(), ParseWorkbook(), f64(), findRow(), TestDashboardDeterministicAcrossRuns(), TestDashboardUnrecordedResultsAreClosedNotLost(), TestExemptedRowsCarryAnExemptionType(), TestGBXDuplicateRowsAreSkippedNotSummed() (+2 more)

### Community 56 - ".TransitionStage"
Cohesion: 0.33
Nodes (6): TransitionResult, TransitionStageRequest, getRoleForStage(), GetAllowedTransitions(), IsTerminalStage(), IsTransitionAllowed()

### Community 59 - "diffBidFields"
Cohesion: 0.39
Nodes (9): FieldDiff, derefFloat(), derefInt(), derefStr(), diffBidFields(), diffDateField(), diffField(), diffRequestFields() (+1 more)

### Community 60 - "FeedbackPage"
Cohesion: 0.39
Nodes (7): FeedbackPage(), handleSubmit(), loadMyTickets(), removeImage(), formatDate(), createTicket(), listMyTickets()

### Community 61 - "computePipelineSummary"
Cohesion: 0.54
Nodes (7): AGING_BUCKET_DEFS, computePipelineSummary(), getEffectiveStage(), isActiveStage(), isParticipated(), isSubmitted(), tenderValue()

### Community 62 - "jwt_service.go"
Cohesion: 0.29
Nodes (6): go_pkg_crypto_sha256, go_pkg_encoding_hex, go_pkg_github_com_golang_jwt_jwt_v5, go_pkg_github_com_redis_go_redis_v9, jwt.RegisteredClaims, CustomClaims

### Community 63 - "time.Time"
Cohesion: 0.29
Nodes (5): CompetitorInfo, ImportedBid, BidWorkspaceMember, UserRole, time.Time

### Community 64 - "StageAccessDialog"
Cohesion: 0.60
Nodes (4): StageAccessDialog(), handleClose(), handleSave(), setStageRestrictions()

### Community 65 - "ForceResetDialog"
Cohesion: 0.83
Nodes (4): ForceResetDialog(), handleClose(), handleConfirm(), forcePasswordReset()

### Community 66 - "permissionMetaData.js"
Cohesion: 0.50
Nodes (3): PERMISSION_CATEGORIES, PERMISSION_METADATA, ROLE_DETAILS

## Knowledge Gaps
- **166 isolated node(s):** `PILLS`, `COLUMNS`, `STAGES_ORDER`, `TERMINAL_STAGES`, `STAGE_OPTIONS` (+161 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 287 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `react` to `cn`, `Landing.jsx`, `TendersPage.jsx`, `UserTable.jsx`, `FeedbackPage.jsx`, `EditTenderDialog.jsx`, `Dashboard.jsx`, `StageWorkspaces.jsx`, `TenderDetailPage.jsx`, `package.json`, `App.jsx`?**
  _High betweenness centrality (0.032) - this node is a cross-community bridge._
- **Why does `lucide-react` connect `react` to `cn`, `Landing.jsx`, `TendersPage.jsx`, `UserTable.jsx`, `FeedbackPage.jsx`, `EditTenderDialog.jsx`, `Dashboard.jsx`, `StageWorkspaces.jsx`, `list_exports.js`, `TenderDetailPage.jsx`, `package.json`, `App.jsx`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **Why does `cn()` connect `cn` to `react`, `UserTable.jsx`, `FeedbackPage.jsx`, `EditTenderDialog.jsx`, `Dashboard.jsx`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **What connects `PILLS`, `COLUMNS`, `STAGES_ORDER` to the rest of the system?**
  _166 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `context.Context` be split into smaller, more focused modules?**
  _Cohesion score 0.056189640035118525 - nodes in this community are weakly interconnected._
- **Should `Preview` be split into smaller, more focused modules?**
  _Cohesion score 0.14 - nodes in this community are weakly interconnected._
- **Should `github.com/gin-gonic/gin.Context` be split into smaller, more focused modules?**
  _Cohesion score 0.05704169944925256 - nodes in this community are weakly interconnected._