# Graph Report - Onetrack-GlobX  (2026-09-23)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 1734 nodes · 5352 edges · 56 communities (54 shown, 2 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 96 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `1c71698e`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5
- Community 6
- Community 7
- Community 8
- Community 9
- Community 10
- Community 11
- Community 12
- Community 13
- Community 14
- Community 15
- Community 16
- Community 17
- Community 18
- Community 19
- Community 20
- Community 21
- Community 22
- Community 23
- Community 24
- Community 25
- Community 26
- Community 27
- Community 28
- Community 29
- Community 30
- Community 31
- Community 32
- Community 33
- Community 34
- Community 35
- Community 36
- Community 37
- Community 38
- Community 39
- Community 40
- Community 41
- Community 42
- Community 43
- Community 44
- Community 45
- Community 46
- Community 47
- Community 48
- Community 49
- Community 50
- Community 51
- Community 52
- Community 53
- Community 54
- Community 55

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
- `checkHeadersAgainst()` --calls--> `cell()`  [INFERRED]
  backend/internal/bid/importer/importer.go → backend/internal/bid/importer/derive.go

## Import Cycles
- None detected.

## Communities (56 total, 2 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.04
Nodes (14): AuthRepository, Role, User, UserPermissionOverride, BidRepository, UserSummary, FieldSuggestion, TenderOwnerPerformanceStat (+6 more)

### Community 1 - "Community 1"
Cohesion: 0.05
Nodes (85): commit(), connect(), getEnv(), pgx.Conn, main(), printSummary(), canonDashboardActivity(), canonDashboardPlatform() (+77 more)

### Community 2 - "Community 2"
Cohesion: 0.08
Nodes (24): extractTokenFromHeader(), parseIntQuery(), hasRole(), parseListParams(), respondPage(), extractBearerToken(), hasPermission(), BadRequest() (+16 more)

### Community 3 - "Community 3"
Cohesion: 0.06
Nodes (41): TransitionResult, CreateBidRequest, FieldDiff, TransitionStageRequest, UpdateBidRequest, alertNoteHTML(), approverDisplayName(), authorizeEditDecision() (+33 more)

### Community 4 - "Community 4"
Cohesion: 0.06
Nodes (53): ForceResetDialog(), handleClose(), handleConfirm(), getHue(), getInitials(), UserAvatar(), Accordion(), AccordionContent() (+45 more)

### Community 5 - "Community 5"
Cohesion: 0.05
Nodes (26): BentoTile(), handleMove(), DEMO_SHEET_TENDERS, Landing(), MotionLink, PrimaryButton(), ROLES, Login() (+18 more)

### Community 6 - "Community 6"
Cohesion: 0.06
Nodes (17): TicketRepository, TicketService, CreateTicketRequest, ListTicketsParams, Ticket, TicketListPage, TicketResponse, TicketStatusEvent (+9 more)

### Community 7 - "Community 7"
Cohesion: 0.08
Nodes (46): RFC-4180, ImportedPill(), InProgressPill(), COLUMNS, MasterSheetPage(), handleExport(), PILLS, plainText() (+38 more)

### Community 8 - "Community 8"
Cohesion: 0.16
Nodes (27): INITIAL_FORM, backdropVariants, closeButtonVariants, INITIAL_FORM, panelVariants, PERMISSION_CATEGORIES, PERMISSION_METADATA, ROLE_DETAILS (+19 more)

### Community 9 - "Community 9"
Cohesion: 0.07
Nodes (33): RoleBadge(), StageAccessDialog(), handleClose(), handleSave(), useDebounce(), UserManagement(), formatDateTime(), UserTable() (+25 more)

### Community 10 - "Community 10"
Cohesion: 0.07
Nodes (27): AddMicroEventRequest, AuditLogPage, AuditLogQuery, BidListItem, BidListResponse, BidResponse, GlobalAuditItem, ListBidsParams (+19 more)

### Community 11 - "Community 11"
Cohesion: 0.11
Nodes (40): NewBidService(), floatPtr(), hasAlertType(), intPtr(), lastEventType(), newLedgerTestBid(), strPtr(), TestAddRemoveMember_LogActions() (+32 more)

### Community 12 - "Community 12"
Cohesion: 0.08
Nodes (39): ActivityLogDialog(), eventBadge(), CATEGORY_CLASSES, CATEGORY_FILTERS, CATEGORY_LABELS, formatTime(), SystemLogsPage(), ALLOWED_IMAGE_TYPES (+31 more)

### Community 13 - "Community 13"
Cohesion: 0.06
Nodes (9): Alert, AlertRepository, AlertService, NewAlertHandler(), NewPostgresAlertRepository(), fakeAlertSvc, fakeAlertSvc, postgresAlertRepo (+1 more)

### Community 14 - "Community 14"
Cohesion: 0.07
Nodes (9): BidChecklist, BidWorkspace, CreateBidParams, IdentifierMatch, scanBid(), scanBidFields(), scanBidFromRows(), postgresBidRepo (+1 more)

### Community 15 - "Community 15"
Cohesion: 0.11
Nodes (32): AnalyticsPage(), EmdProjectionBlock(), getTenderDeadline(), isActivePipeline(), isEmdRequired(), ForcePasswordChangeGuard(), NAV_ITEMS, OverviewPanel() (+24 more)

### Community 16 - "Community 16"
Cohesion: 0.06
Nodes (10): PricingWorkspaceRow, BidStageHistory, CompetitorInfo, RecordOutcomeRequest, TenderEditApproval, UserSummary, pgx.Row, scanPendingEdit() (+2 more)

### Community 17 - "Community 17"
Cohesion: 0.11
Nodes (24): App(), SettingsPage(), CATEGORY_COLORS, ROLE_BADGES, STAGE_COLORS, STAGE_LABELS, KPI_BAND_TONES, PipelineKpiBand() (+16 more)

### Community 18 - "Community 18"
Cohesion: 0.12
Nodes (34): buildEmdDetailsTableHtml(), buildPresalesCands(), buildRemarkCalloutHtml(), buildTenderDetailHtml(), buildValuesAdjustedBannerHtml(), checkStageState(), computeL1PricingSummary(), DynamicStageWorkspace() (+26 more)

### Community 19 - "Community 19"
Cohesion: 0.10
Nodes (26): env(), main(), printSection(), queryRows(), truncate(), deref(), fmtDate(), fmtNum() (+18 more)

### Community 20 - "Community 20"
Cohesion: 0.09
Nodes (19): NewPostgresAuthRepository(), NewPostgresBidRepository(), NewPostgresPool(), Repository, Service, SystemConfig, NewHandler(), postgresRepo (+11 more)

### Community 21 - "Community 21"
Cohesion: 0.11
Nodes (11): UserService, CreateUserRequest, UpdatePermissionsRequest, UpdateRolesRequest, UpdateStatusRequest, UpdateUserRequest, UserListResponse, UserResponse (+3 more)

### Community 22 - "Community 22"
Cohesion: 0.14
Nodes (15): Repository, Service, EventItem, ListQuery, Page, Handler, NewHandler(), NewPostgresRepository() (+7 more)

### Community 23 - "Community 23"
Cohesion: 0.17
Nodes (13): ForgotPasswordRequest, Permission, RefreshRequest, ResetPasswordOTPRequest, VerifyOTPRequest, go_pkg_fmt, go_pkg_github_com_jackc_pgx_v5_pgxpool, go_pkg_golang_org_x_crypto_bcrypt (+5 more)

### Community 24 - "Community 24"
Cohesion: 0.10
Nodes (8): BidService, AddChecklistRequest, AddMemberRequest, BidChecklistItem, ReorderChecklistItem, ReorderChecklistRequest, UpdateChecklistRequest, NewBidHandler()

### Community 25 - "Community 25"
Cohesion: 0.15
Nodes (20): main(), RegisterAlertRoutes(), RegisterAuthRoutes(), NewBulkImportHandler(), RegisterBidRoutes(), RegisterTicketRoutes(), AuthMiddleware, NewAuthMiddleware() (+12 more)

### Community 26 - "Community 26"
Cohesion: 0.12
Nodes (8): AuthService, ChangePasswordRequest, ForceResetRequest, LoginRequest, LoginResponse, NewAuthHandler(), UserInfo, authService

### Community 27 - "Community 27"
Cohesion: 0.13
Nodes (22): AlertsPage(), TenderDetailPage(), createAlert(), deleteAlert(), getAlerts(), markAlertRead(), markAllAlertsRead(), acquireRefreshLockOrWaitForCompletion() (+14 more)

### Community 28 - "Community 28"
Cohesion: 0.08
Nodes (24): dependencies, canvas-confetti, class-variance-authority, clsx, @fontsource-variable/instrument-sans, @fontsource-variable/inter, framer-motion, html-to-image (+16 more)

### Community 29 - "Community 29"
Cohesion: 0.15
Nodes (10): PendingApprovalError, SetStageRestrictionsRequest, StageRestrictionsResponse, go_pkg_crypto_rand, go_pkg_encoding_base64, go_pkg_errors, go_pkg_github_com_jackc_pgx_v5, go_pkg_math (+2 more)

### Community 30 - "Community 30"
Cohesion: 0.10
Nodes (21): name, private, type, version, canvas-confetti, clsx, eslint, @eslint/js (+13 more)

### Community 31 - "Community 31"
Cohesion: 0.13
Nodes (19): ExcludeRoleGuard(), PermissionGuard(), RoleGuard(), Dashboard(), onKeyDown(), isChildActive(), Stage8Workspace(), useInternalApprovals() (+11 more)

### Community 32 - "Community 32"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 33 - "Community 33"
Cohesion: 0.18
Nodes (19): ChecklistTab(), logChecklistHistory(), OEM_PILL_COLORS, InternalApprovalDialog(), ArchiveConfirmDialog(), handleConfirm(), logStageMicroEvent(), addBidMicroEvent() (+11 more)

### Community 34 - "Community 34"
Cohesion: 0.17
Nodes (7): JWTService, TokenClaims, TokenPair, redis.Client, NewJWTService(), time.Duration, jwtService

### Community 35 - "Community 35"
Cohesion: 0.16
Nodes (16): getEnv(), DatabaseConfig, EmailConfig, JWTConfig, RedisConfig, Load(), redis.Client, NewRedisClient() (+8 more)

### Community 36 - "Community 36"
Cohesion: 0.19
Nodes (13): BulkImportPage(), handleCommit(), handleFile(), FORMATS, STAGE_LABELS, STAGE_ORDER, ImportConsole(), PREFIX (+5 more)

### Community 37 - "Community 37"
Cohesion: 0.16
Nodes (12): CreateUserDialog(), handleClose(), handleSubmit(), resetForm(), validate(), CreateUserSheet(), handleSubmit(), onKeyDown() (+4 more)

### Community 38 - "Community 38"
Cohesion: 0.15
Nodes (13): RejectReasonDialog(), STAGE_GUIDE, STAGE_ICONS, TAB_IDS, TABS, Textarea, STATUS_DISPLAY_LABELS, StatusBadge() (+5 more)

### Community 39 - "Community 39"
Cohesion: 0.19
Nodes (14): summarise(), CheckHeaders(), checkHeadersAgainst(), derefStr(), findDuplicates(), Duplicate, SkippedRow, SkippedSheet (+6 more)

### Community 40 - "Community 40"
Cohesion: 0.20
Nodes (11): inputCls(), ManualForm(), handleSubmit(), loadUsers(), validate(), AddTenderPage(), handleSubmit(), nextStep() (+3 more)

### Community 41 - "Community 41"
Cohesion: 0.21
Nodes (13): applyAlertNote(), EditTenderDialog(), handleSubmit(), loadFullBid(), loadUsers(), validate(), fieldDiffLabel(), inputCls() (+5 more)

### Community 42 - "Community 42"
Cohesion: 0.24
Nodes (14): extractCommercialDetails(), fmt(), fmtMoney(), formatFullDateTime(), getBidEndDate(), getBidStartDate(), getEventTypeBadge(), getUserDisplayName() (+6 more)

### Community 43 - "Community 43"
Cohesion: 0.19
Nodes (9): NewAlertService(), NewAuthService(), EmailService, NewEmailService(), uniqueNonEmpty(), NewUserService(), Recorder, go_pkg_crypto_tls (+1 more)

### Community 44 - "Community 44"
Cohesion: 0.26
Nodes (13): AssignPresalesModal(), CompleteStageModal(), EmdDecisionModal(), logStageInteraction(), NoGoModal(), ReVerificationModal(), Stage10Workspace(), Stage11Workspace() (+5 more)

### Community 45 - "Community 45"
Cohesion: 0.20
Nodes (10): devDependencies, eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals, @types/react, @types/react-dom (+2 more)

### Community 46 - "Community 46"
Cohesion: 0.43
Nodes (6): EditUserDialog(), handleClose(), handleSubmit(), UserProfileModal(), handleSaveProfile(), updateUserProfile()

### Community 47 - "Community 47"
Cohesion: 0.38
Nodes (4): RolesPermissionsDialog(), handleClose(), handleSave(), updateUserRoles()

### Community 48 - "Community 48"
Cohesion: 0.60
Nodes (5): boolOr(), env(), fmtF(), main(), strOr()

### Community 49 - "Community 49"
Cohesion: 0.40
Nodes (5): scripts, build, dev, lint, preview

### Community 50 - "Community 50"
Cohesion: 0.60
Nodes (5): StageSectionsTab(), handleSetCurrentStage(), TransitionDialog(), submit(), transitionBidStage()

### Community 51 - "Community 51"
Cohesion: 0.40
Nodes (4): path, @tailwindcss/vite, vite, @vitejs/plugin-react

### Community 52 - "Community 52"
Cohesion: 0.50
Nodes (3): compilerOptions, baseUrl, paths

### Community 53 - "Community 53"
Cohesion: 0.50
Nodes (4): fmtMoney(), PricingSuggestionHint(), useSuggestion(), getPricingSuggestion()

## Knowledge Gaps
- **157 isolated node(s):** `CATEGORY_CLASSES`, `CATEGORY_FILTERS`, `CATEGORY_LABELS`, `ALLOWED_IMAGE_TYPES`, `STATUS_FILTERS` (+152 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 274 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `Community 8` to `Community 33`, `Community 36`, `Community 4`, `Community 5`, `Community 7`, `Community 38`, `Community 9`, `Community 12`, `Community 15`, `Community 17`, `Community 18`, `Community 30`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._
- **Why does `lucide-react` connect `Community 8` to `Community 33`, `Community 36`, `Community 4`, `Community 5`, `Community 7`, `Community 38`, `Community 9`, `Community 12`, `Community 15`, `Community 17`, `Community 18`, `Community 54`, `Community 30`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **Why does `dependencies` connect `Community 28` to `Community 30`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **What connects `CATEGORY_CLASSES`, `CATEGORY_FILTERS`, `CATEGORY_LABELS` to the rest of the system?**
  _157 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.03685417034032799 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.05416666666666667 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.08313425704730053 - nodes in this community are weakly interconnected._