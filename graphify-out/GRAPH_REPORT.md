# Graph Report - Onetrack-GlobX  (2026-11-26)

## Corpus Check
- 501 files · ~426,829 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 12 file(s) not represented in the graph (top: (none) 7, .css 2, .example 1)

## Summary
- 3892 nodes · 13100 edges · 155 communities (144 shown, 11 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 438 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `24f23ed3`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Service
- useBidStore
- BidService
- ContactsTab.jsx
- TenderDetailPage.jsx
- Landing.jsx
- TicketResponse
- TendersPage.jsx
- context.Context
- time.Time
- Endpoints
- working_calendar_service_test.go
- Input
- Alert
- TenderEMDResponse
- Endpoints
- Success
- Dashboard.jsx
- go_pkg_time
- go_pkg_context
- WorkingCalendarPage.jsx
- userService
- Files Changed
- Repo
- with
- bid_service_test.go
- authService
- bidService
- dependencies
- server/main.go
- package.json
- templates.go
- components.json
- DirectoryPage.jsx
- JWTService
- cn
- AlertUsersPanel.jsx
- .SetTechEvalDate
- EmdDetailsDialog.jsx
- emdfix/main.go
- bid/domain/models.go
- LedgerRow
- bid_service.go
- Browser Session Management
- App.jsx
- devDependencies
- config.go
- Storage Management
- fakeBidRepo
- scripts
- GoogleCalendarIntegration
- credmail/service_test.go
- compilerOptions
- Test generation (plan → generate → heal)
- Tracing
- github.com/onetrack/backend
- docShortfall.js
- CLAUDE.md
- .claude/CLAUDE.md
- ledgerTheme.js
- DialogContent
- emd_service_test.go
- TenderContact
- PART 2 — TASK MANAGEMENT APIs
- OneTrack GlobX — API Documentation
- Deployment Readiness & Runbook — Bulk Import Fix Release
- fail
- 6. Tenders (Bid Workspaces) — `/api/v1/bids`
- backend
- Textarea
- PART 1 — BID WORKSPACE APIs
- Browser Automation with playwright-cli
- postgres
- Running Custom Playwright Code
- PART 2B — TYPED TASK APIs
- Product
- API_DOCS_BID.md
- 4. Users & Profile — `/api/v1/users`
- SKILL.md
- 9. Feedback Tickets — `/api/v1/tickets`
- vite.config.js
- 7. Leads — `/api/v1/leads`
- 1. Getting started
- importer.go
- .applyUpdate
- 8. Alerts — `/api/v1/alerts`
- Commands
- 12. Appendix: enums and reference values
- mockCalendarRepo
- frontend
- Cookies
- Video Recording
- EnrichDuplicates
- xlsx.go
- Components
- PipelineConstellation.jsx
- Advanced Mocking with run-code
- Local Storage
- 3. Heal
- POST /api/v1/bids/{id}/transition
- oem.js
- ref_node_assert
- POST /api/v1/bids
- POST /api/v1/tasks/{id}/activities
- main
- Lead
- POST /api/v1/tasks/{id}/approve
- POST /api/v1/tasks/{id}/oem-followup
- POST /api/v1/bids/{id}/tasks/document
- POST /api/v1/bids/{id}/tasks
- React + Vite
- PrebidPanel.jsx
- healthcheck
- PublishLeadDialog.jsx
- StageWorkspaces.jsx
- FeedbackPage.jsx
- DocsTab.jsx
- normalize.go
- services
- adminer
- watchtower
- Forbidden
- redis
- react
- encoding/json.RawMessage
- testing.T
- model.go
- TestPrebidInputs
- ChecklistTab.jsx
- build
- github.com/jackc/pgx/v5/pgxpool.Pool
- service_test.go
- RolesPermissionsDialog
- exceljs
- fail
- Actor
- LeadsPage.jsx
- diffBidFields
- InternalError
- @fontsource-variable/instrument-sans@^5.2.8
- html-to-image
- react-is@^19.2.6
- credmail/service.go
- BidWorkspace
- calendar/handler/handler_test.go
- apiFetch
- CreateUserDialog
- RecordEMDPaymentRequest
- .TransitionStage
- transitions.go
- LeadHandler
- TestTransitionRequestNormalize
- PendingApprovalError
- .UpdateDocument

## God Nodes (most connected - your core abstractions)
1. `Button()` - 164 edges
2. `Success()` - 113 edges
3. `apiFetch()` - 108 edges
4. `react` - 97 edges
5. `cn()` - 95 edges
6. `BadRequest()` - 83 edges
7. `lucide-react` - 81 edges
8. `Input` - 79 edges
9. `bidService` - 75 edges
10. `BidHandler` - 69 edges

## Surprising Connections (you probably didn't know these)
- `5. Verify migrations actually ran` --references--> `RunAutoMigrations()`  [INFERRED]
  DEPLOYMENT.md → backend/migrations/migrations.go
- ``PATCH /api/v1/bids/:id` — newly updatable fields` --references--> `UpdateBidRequest`  [INFERRED]
  backend/V1_CHANGES.md → backend/internal/bid/domain/models.go
- `12.2 Tender status values` --references--> `kind`  [INFERRED]
  API_DOCUMENTATION.md → backend/internal/directory/model.go
- ``GET /bids/my-approvals`` --references--> `kind`  [INFERRED]
  API_DOCUMENTATION.md → backend/internal/directory/model.go
- `The Ledger Stamp Mark (signature component)` --references--> `LedgerStampMark()`  [INFERRED]
  frontend/DESIGN.md → frontend/src/lib/ledgerMarks.jsx

## Import Cycles
- 2-file cycle: `frontend/src/components/tenders/ChecklistTab.jsx -> frontend/src/components/tenders/StageWorkspaces.jsx -> frontend/src/components/tenders/ChecklistTab.jsx`

## Communities (155 total, 11 thin omitted)

### Community 0 - "Service"
Cohesion: 0.13
Nodes (9): NewService(), validEmail(), NewStore(), TestKindGate(), Candidate, Item, Mailer, Service (+1 more)

### Community 1 - "useBidStore"
Cohesion: 0.09
Nodes (26): Dashboard(), handleLogout(), onKeyDown(), runDeadlineChecksAndLogout(), ForcePasswordChangeGuard(), isChildActive(), RouteErrorBoundary, SignOutConfirmDialog() (+18 more)

### Community 2 - "BidService"
Cohesion: 0.08
Nodes (24): AddChecklistRequest, BidChecklistItem, BidListItem, BidListResponse, BidResponse, CreateBidRequest, ListBidsParams, ReorderChecklistRequest (+16 more)

### Community 3 - "ContactsTab.jsx"
Cohesion: 0.17
Nodes (29): ContactDialog(), ContactLines(), ContactsSummary(), ContactsTab(), FIELDS, OemContactCell(), applyPlan(), blankContact() (+21 more)

### Community 4 - "TenderDetailPage.jsx"
Cohesion: 0.06
Nodes (75): ShortfallHistoryCard(), applyAlertNote(), EditTenderDialog(), executeSave(), handleSubmit(), loadFullBid(), validate(), parseRequestedProducts() (+67 more)

### Community 5 - "Landing.jsx"
Cohesion: 0.15
Nodes (24): BentoTile(), CapabilitiesSection(), CountUp(), DEMO_SHEET_TENDERS, FadedCheckBackground(), FloatingChip(), Footer(), GhostButton() (+16 more)

### Community 6 - "TicketResponse"
Cohesion: 0.06
Nodes (17): FieldMemory, TicketRepository, TicketService, CreateTicketRequest, ListTicketsParams, Ticket, TicketListPage, TicketResponse (+9 more)

### Community 7 - "TendersPage.jsx"
Cohesion: 0.06
Nodes (67): CopyButton(), EmdDetailsPage(), handleExportExcel(), getDeadlineDate(), isActivePipeline(), isEmdRequired(), isPreSubmission(), ImportedPill() (+59 more)

### Community 8 - "context.Context"
Cohesion: 0.02
Nodes (19): AuthRepository, Role, User, UserPermissionOverride, BidRepository, BidService, AddMemberRequest, FieldSuggestion (+11 more)

### Community 9 - "time.Time"
Cohesion: 0.05
Nodes (39): TenderLink(), TenderDeadlineCandidate, WorkingCalendarService, CalculateDeadlineResult, EngineRuntime, EvaluationSummary, LastRun, RedZoneNotificationResult (+31 more)

### Community 10 - "Endpoints"
Cohesion: 0.04
Nodes (46): 1. Health Check, 2. Login, 3. Refresh Token, 4. Logout, 5. Change Password, 6. Force Password Reset, Access Token JWT Payload, Admin User (+38 more)

### Community 11 - "working_calendar_service_test.go"
Cohesion: 0.11
Nodes (54): NewBackgroundScheduler(), NewWorkingCalendarService(), escalationAlerts(), escalationRepo(), inWindowTender(), isWorkingDay(), newMockCalendarRepo(), newSvc() (+46 more)

### Community 12 - "Input"
Cohesion: 0.10
Nodes (44): STATUS_OPTIONS, TenderDetailsFields(), Field(), inputCls(), ManualForm(), handleSubmit(), loadUsers(), validate() (+36 more)

### Community 13 - "Alert"
Cohesion: 0.06
Nodes (11): Alert, AlertRepository, AlertService, SafeLink(), TestSafeLink(), NewPostgresAlertRepository(), NewAlertService(), fakeAlertSvc (+3 more)

### Community 14 - "TenderEMDResponse"
Cohesion: 0.12
Nodes (18): MDDecisionRequest, SubmitMDApprovalRequest, TenderEMDResponse, UpdateBasicEMDRequest, UpdateEMDRefundRequest, VerifyEMDPaymentRequest, hasAnyRole(), emdForbidden() (+10 more)

### Community 15 - "Endpoints"
Cohesion: 0.05
Nodes (39): 1. Create User, 2. List Users, 3. Get My Profile, 4. Get User by ID, 5. Update User Profile, 6. Update User Status (Activate/Deactivate), 7. Update User Roles, 8. Update Permission Overrides (+31 more)

### Community 16 - "Success"
Cohesion: 0.08
Nodes (13): contactError(), actorRoles(), mapServiceError(), saveReceiptFile(), validateReceiptUpload(), parseIntQuery(), RegisterBidRoutes(), techEvalError() (+5 more)

### Community 17 - "Dashboard.jsx"
Cohesion: 0.09
Nodes (60): AccountSettings(), saveProfile(), Fact(), fieldsOf(), PasswordCard(), PlatformSettings(), PreferencesSettings(), choose() (+52 more)

### Community 18 - "go_pkg_time"
Cohesion: 0.16
Nodes (8): f64p(), intp(), strp(), TestUpdateCalendarRequestValidate(), ConfigureGoogleSyncRequest, CreateExceptionRequest, CreateHolidayRequest, googleEventsResponse

### Community 19 - "go_pkg_context"
Cohesion: 0.08
Nodes (19): getEnv(), main(), Repository, Service, EventItem, ListQuery, Page, Handler (+11 more)

### Community 20 - "WorkingCalendarPage.jsx"
Cohesion: 0.15
Nodes (35): COVERAGE_COLS, CURRENT_YEAR, DEADLINE_PRESETS, DEADLINE_UNITS, describeRun(), EMPTY_HOLIDAY_FORM, fmtTime(), INTERVAL_LIMITS (+27 more)

### Community 21 - "userService"
Cohesion: 0.11
Nodes (11): UserService, CreateUserRequest, UpdatePermissionsRequest, UpdateRolesRequest, UpdateStatusRequest, UpdateUserRequest, UserListResponse, UserResponse (+3 more)

### Community 22 - "Files Changed"
Cohesion: 0.14
Nodes (13): 1. New column on `bid.bid_workspaces`, 2. New table `bid.bid_checklists`, API Changes Summary, Changes, Database Migration, `GET /api/v1/bids/:id/checklists`, `GET /api/v1/bids/:id` — updated response, Overview (+5 more)

### Community 23 - "Repo"
Cohesion: 0.22
Nodes (6): affected(), mapErr(), NewRepo(), Contact, Entry, Repo

### Community 24 - "with"
Cohesion: 0.09
Nodes (21): permissions, runs-on, steps, jobs, build-and-push, name, on, workflow_dispatch (+13 more)

### Community 25 - "bid_service_test.go"
Cohesion: 0.14
Nodes (30): extractProductFields(), fieldSuggestionEntries(), NewBidService(), boolPtr(), floatPtr(), hasAlertType(), intPtr(), lastEventType() (+22 more)

### Community 26 - "authService"
Cohesion: 0.12
Nodes (7): AuthService, ChangePasswordRequest, ForceResetRequest, LoginRequest, LoginResponse, UserInfo, authService

### Community 27 - "bidService"
Cohesion: 0.15
Nodes (9): ApprovalLink(), approverDisplayName(), authorizeEditDecision(), closeOrCancelWords(), needsRMApproval(), outcomeLogText(), parseCancelPayload(), bidService (+1 more)

### Community 28 - "dependencies"
Cohesion: 0.11
Nodes (19): dependencies, class-variance-authority@^0.7.1, @fontsource-variable/inter@^5.2.8, framer-motion@^12.40.0, lucide-react@^1.16.0, radix-ui@^1.4.3, react@^19.2.6, react-dom@^19.2.6 (+11 more)

### Community 29 - "server/main.go"
Cohesion: 0.12
Nodes (12): TestValidateTenderDoc(), validateTenderDoc(), TestValidateImageUpload(), validateImageUpload(), call(), TestOrganisationRoleGating(), Normalize(), TestNormalize() (+4 more)

### Community 30 - "package.json"
Cohesion: 0.13
Nodes (14): canvas-confetti@^1.9.4, clsx@^2.1.1, docx-preview@^0.4.1, tailwindcss@^4.3.0, tw-animate-css@^1.4.0, name, private, type (+6 more)

### Community 31 - "templates.go"
Cohesion: 0.19
Nodes (19): TestHostileValuesAreEscaped(), TestLoginDetailsAreABorderedTableInEveryMail(), TestNoteIsABoldHighlightedCallout(), TestResetConfirmationKeepsTheWelcomeFormatWithoutAPassword(), TestWelcomeMailFollowsTheTeamFormat(), AccessAlertMessage(), accessInfoTable(), callout() (+11 more)

### Community 32 - "components.json"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 33 - "DirectoryPage.jsx"
Cohesion: 0.18
Nodes (30): AddDialog(), Detail(), DirectoryPage(), EntryFields(), errText(), Field(), fmtDate(), initials() (+22 more)

### Community 34 - "JWTService"
Cohesion: 0.10
Nodes (9): JWTService, TokenClaims, TokenPair, NewAuthService(), EmailService, uniqueNonEmpty(), stubJWT, fakeJWT (+1 more)

### Community 35 - "cn"
Cohesion: 0.08
Nodes (38): getHue(), getInitials(), UserAvatar(), Person(), PrebidActivity(), prebidSteps(), ROLE, TONES (+30 more)

### Community 36 - "AlertUsersPanel.jsx"
Cohesion: 0.19
Nodes (25): AccessAlertDialog(), handleSend(), AlertUsersPanel(), applySharedPassword(), changeInclude(), confirmSend(), setPassword(), fmt() (+17 more)

### Community 37 - ".SetTechEvalDate"
Cohesion: 0.16
Nodes (13): StageLink(), AddTechEvalNoteRequest, OpenTechEvalRequest, SetTechEvalDateRequest, TechEval, newTechEvalID(), parseTechEval(), techEvalChangeText() (+5 more)

### Community 38 - "EmdDetailsDialog.jsx"
Cohesion: 0.13
Nodes (39): EmdApprovalDialog(), ACTION_STYLE, EmdAuditDialog(), fmtDate(), EmdDetailsDialog(), Field(), fmtDate(), ReceiptUpload() (+31 more)

### Community 39 - "emdfix/main.go"
Cohesion: 0.10
Nodes (17): env(), main(), strOr(), env(), main(), printSection(), queryRows(), truncate() (+9 more)

### Community 40 - "bid/domain/models.go"
Cohesion: 0.13
Nodes (12): digitsOnly(), phoneKey(), FolderSlug(), TestPublishRequestNormalize(), safeName(), strp(), TestFolderSlugAndSafeName(), TestNormalize() (+4 more)

### Community 41 - "LedgerRow"
Cohesion: 0.13
Nodes (19): Colors, Deep Panel (login left panel only), Design System: OneTrack — The Ledger, Do:, Do's and Don'ts, Don't:, Elevation & Depth, Hierarchy (+11 more)

### Community 42 - "bid_service.go"
Cohesion: 0.14
Nodes (9): PricingSuggestion, pickL1PricingQuote(), shortfallRounds(), PricingDeal, alertNoteFields, pricingItemJSON, pricingQuoteJSON, pricingWorkspaceJSON (+1 more)

### Community 43 - "Browser Session Management"
Cohesion: 0.10
Nodes (20): 1. Name Browser Sessions Semantically, 2. Always Clean Up, 3. Delete Stale Browser Data, A/B Testing Sessions, Attach by channel name, Attach via browser extension, Attach via CDP endpoint, Attaching to a Running Browser (+12 more)

### Community 44 - "App.jsx"
Cohesion: 0.12
Nodes (28): App(), AuthGuard(), ExcludeRoleGuard(), GuestGuard(), PermissionGuard(), RoleGuard(), BulkImportPage(), handleCommit() (+20 more)

### Community 45 - "devDependencies"
Cohesion: 0.16
Nodes (15): devDependencies, eslint@^10.3.0, @eslint/js@^10.0.1, eslint-plugin-react-hooks@^7.1.1, eslint-plugin-react-refresh@^0.5.2, globals@^17.6.0, @types/react@^19.2.14, @types/react-dom@^19.2.3 (+7 more)

### Community 46 - "config.go"
Cohesion: 0.09
Nodes (17): NewJWTService(), getEnv(), DatabaseConfig, EmailConfig, JWTConfig, RedisConfig, Load(), NewPostgresPool() (+9 more)

### Community 47 - "Storage Management"
Cohesion: 0.11
Nodes (18): Authentication State Reuse, Clear sessionStorage, Common Patterns, Delete Database, Delete Single Item, Get Single Value, IndexedDB, List All sessionStorage Items (+10 more)

### Community 48 - "fakeBidRepo"
Cohesion: 0.02
Nodes (23): TenderEMDAuditLog, TenderEMDDetails, EMDTx, PricingWorkspaceRow, BidChecklist, BidStageHistory, CreateBidParams, IdentifierMatch (+15 more)

### Community 49 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, lint, preview

### Community 50 - "GoogleCalendarIntegration"
Cohesion: 0.28
Nodes (9): NewGoogleSyncService(), googleFixture(), syncRepo(), TestGoogleSyncFailsWhenUnreachable(), TestGoogleSyncFailsWithoutFabricatingHolidays(), TestGoogleSyncImportsPublicHolidaysOnly(), TestGoogleSyncKeySources(), Recorder (+1 more)

### Community 51 - "credmail/service_test.go"
Cohesion: 0.19
Nodes (14): cand(), ids(), newSvc(), TestAlreadyAlertedSkippedUnlessIncluded(), TestFailedMailIsRecordedAndBatchStillFinishes(), TestNotConfiguredSendsNothing(), TestPanicInSenderClosesBatchAndFreesTheGuard(), TestPreviewBuckets() (+6 more)

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
Cohesion: 0.21
Nodes (23): DUE_STYLE, esc(), ShortfallPanel(), STATUS_STYLE, Stage10Workspace(), addRound(), approverChoices(), awaitingReeval() (+15 more)

### Community 59 - "ledgerTheme.js"
Cohesion: 0.29
Nodes (9): AuthModal(), LedgerStampMark(), ledger, LEDGER_STAGES, ledgerFont, LoginHeroPanel(), BUILDINGS, LoginSkyline() (+1 more)

### Community 60 - "DialogContent"
Cohesion: 0.12
Nodes (43): ActivityLogDialog(), eventBadge(), EditUserDialog(), handleClose(), handleSubmit(), StageAccessDialog(), handleClose(), handleSave() (+35 more)

### Community 61 - "emd_service_test.go"
Cohesion: 0.20
Nodes (22): float64Ptr(), newEMDTestSetup(), onlinePayment(), TestChecklist_ToggleKeepsStatusInSync(), TestChecklist_ValidatesPriorityAndStatus(), TestEMD_AdminHoldingOtherRolesStillBlockedFromSelfDecision(), TestEMD_BasicUpdateCannotTouchStatusAndLocksWhilePending(), TestEMD_DecisionAlertsLinkToEMDStage() (+14 more)

### Community 62 - "TenderContact"
Cohesion: 0.11
Nodes (12): ReorderContactItem, ReorderContactsRequest, SaveContactRequest, TenderContact, UpdateContactRequest, contactErr(), scanContact(), cleanContact() (+4 more)

### Community 63 - "PART 2 — TASK MANAGEMENT APIs"
Cohesion: 0.12
Nodes (16): Auto-Activity Logged, DELETE /api/v1/tasks/{id}, DELETE /api/v1/tasks/{id}/checklists/{checklist_id}, GET /api/v1/bids/{id}/tasks, GET /api/v1/tasks/{id}, GET /api/v1/tasks/{id}/activities, GET /api/v1/tasks/{id}/subtasks, PART 2 — TASK MANAGEMENT APIs (+8 more)

### Community 64 - "OneTrack GlobX — API Documentation"
Cohesion: 0.09
Nodes (21): 10.1 `GET /system/config`, 10.2 `GET /system/config/:key`, 10.3 `PUT /system/config/:key`, 10. System Configuration — `/api/v1/system/config`, 11.1 `GET /system-logs`, 11. System Logs — `/api/v1/system-logs`, 13. Appendix: endpoint index, 2.1 `GET /health` (+13 more)

### Community 65 - "Deployment Readiness & Runbook — Bulk Import Fix Release"
Cohesion: 0.14
Nodes (13): 0. Before you touch anything, 10. Rollback plan, 1. Back up the host database first, 2. Audit the host database, 3. Push and let the pipeline build, 4. Deploy to the host, 6. Confirm the service is healthy, 7. Dry-run both workbooks before writing anything (+5 more)

### Community 66 - "fail"
Cohesion: 0.26
Nodes (8): isAdmin(), fail(), NewHandler(), who(), Error(), fail(), respond(), Handler

### Community 67 - "6. Tenders (Bid Workspaces) — `/api/v1/bids`"
Cohesion: 0.08
Nodes (24): 6.10 Workspace members, 6.11 Checklists, 6.12 Helpers: Field Memory, pricing hint, performance matrix, 6.13 `PATCH /bids/:id/outcome` — record outcome, 6.14 Tender Bin, 6.15 `POST /bids/bulk-import` — Excel import, 6.16 Tender documents (RFP, ATC, ...), 6.1 Typical lifecycle (step by step) (+16 more)

### Community 68 - "backend"
Cohesion: 0.15
Nodes (13): container_name, depends_on, environment, image, networks, ports, restart, volumes (+5 more)

### Community 69 - "Textarea"
Cohesion: 0.19
Nodes (24): CHANGE_LABEL, CHANGE_STYLE, DateDialog(), DateHistory(), DUE_STYLE, dueChip(), fmtYmd(), initials() (+16 more)

### Community 70 - "PART 1 — BID WORKSPACE APIs"
Cohesion: 0.14
Nodes (14): Creation Mode Philosophy, DELETE /api/v1/bids/{id}, DELETE /api/v1/bids/{id}/members/{user_id}, Example Response, GET /api/v1/bids, GET /api/v1/bids/{id}, GET /api/v1/bids/{id}/stage-history, PART 1 — BID WORKSPACE APIs (+6 more)

### Community 71 - "Browser Automation with playwright-cli"
Cohesion: 0.14
Nodes (14): Browser Automation with playwright-cli, Browser Sessions, Example: Debugging with DevTools, Example: Form submission, Example: Interactive session, Example: Multi-tab workflow, Installation, Open parameters (+6 more)

### Community 72 - "postgres"
Cohesion: 0.18
Nodes (11): POSTGRES_DB, POSTGRES_PASSWORD, POSTGRES_USER, container_name, environment, image, networks, ports (+3 more)

### Community 73 - "Running Custom Playwright Code"
Cohesion: 0.15
Nodes (13): Clipboard, Complex Workflows, Error Handling, File Downloads, Frames and Iframes, Geolocation, JavaScript Execution, Media Emulation (+5 more)

### Community 74 - "PART 2B — TYPED TASK APIs"
Cohesion: 0.17
Nodes (12): Completion Guard, Completion Guard, GET /api/v1/me/tasks, PART 2B — TYPED TASK APIs, POST /api/v1/bids/{id}/tasks/approval, POST /api/v1/bids/{id}/tasks/oem, Query Parameters, Request (+4 more)

### Community 75 - "Product"
Cohesion: 0.14
Nodes (13): Accessibility & Inclusion, Brand Commitments, Capabilities and Constraints, Evidence on Hand, Operating Context, Platform, Positioning, Product (+5 more)

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

### Community 80 - "vite.config.js"
Cohesion: 0.18
Nodes (9): path@^0.12.7, @tailwindcss/vite@^4.3.0, vite@^8.0.12, @vitejs/plugin-react@^6.0.1, { version }, path, @tailwindcss/vite, vite (+1 more)

### Community 81 - "7. Leads — `/api/v1/leads`"
Cohesion: 0.22
Nodes (9): 7.1 Typical flow (step by step), 7.2 `POST /leads` — create lead, 7.3 `GET /leads` — list leads, 7.4 `GET /leads/:id` — lead detail, 7.5 `POST /leads/:id/documents` — upload one document, 7.6 `GET /leads/:id/documents/:docId` — download, 7.7 `DELETE /leads/:id/documents/:docId`, 7. Leads — `/api/v1/leads` (+1 more)

### Community 82 - "1. Getting started"
Cohesion: 0.22
Nodes (9): 1.1 Base URL, 1.2 Authentication flow (step by step), 1.3 Response envelope, 1.4 Errors and status codes, 1.5 Pagination, 1.6 Data conventions, 1.7 Roles and permissions, 1. Getting started (+1 more)

### Community 83 - "importer.go"
Cohesion: 0.20
Nodes (21): summarise(), buildPreview(), CheckHeaders(), checkHeadersAgainst(), dashboardRowParser(), derefStr(), findDuplicates(), Duplicate (+13 more)

### Community 84 - ".applyUpdate"
Cohesion: 0.14
Nodes (18): UpdateBidRequest, alertNoteHTML(), checkDocShortfall(), diffRowsHTML(), fieldLabel(), internalApprovalRecipients(), money(), ownershipChangeSummaryHTML() (+10 more)

### Community 85 - "8. Alerts — `/api/v1/alerts`"
Cohesion: 0.29
Nodes (7): 8.1 `GET /alerts`, 8.2 `POST /alerts`, 8.3 `PUT /alerts/:id/read`, 8.4 `PUT /alerts/read-all`, 8.5 `DELETE /alerts/:id`, 8. Alerts — `/api/v1/alerts`, Alert object

### Community 86 - "Commands"
Cohesion: 0.20
Nodes (10): Commands, Core, DevTools, Keyboard, Mouse, Navigation, Network, Save as (+2 more)

### Community 87 - "12. Appendix: enums and reference values"
Cohesion: 0.17
Nodes (12): 12.1 Tender workflow stages, 12.2 Tender status values, 12.3 Lead values, 12.4 Preset dropdown values (free text also accepted), 12.5 Feedback categories, 12. Appendix: enums and reference values, 6.7 Edit approvals, `GET /bids/:id/pending-edit` (+4 more)

### Community 88 - "mockCalendarRepo"
Cohesion: 0.02
Nodes (24): ShortfallCandidate, TechEvalDateCandidate, WorkingCalendarRepository, DefaultIntegration(), CalendarException, DeadlineCoverage, GoogleCalendarIntegration, GoogleCalendarSyncLog (+16 more)

### Community 89 - "frontend"
Cohesion: 0.22
Nodes (9): condition, backend, container_name, depends_on, image, networks, ports, restart (+1 more)

### Community 90 - "Cookies"
Cohesion: 0.22
Nodes (9): Advanced: Multiple Cookies or Custom Options, Clear All Cookies, Cookies, Delete a Cookie, Filter Cookies by Domain, Filter Cookies by Path, Get Specific Cookie, List All Cookies (+1 more)

### Community 91 - "Video Recording"
Cohesion: 0.22
Nodes (8): 1. Use Descriptive Filenames, 2. Record entire hero scripts., Basic Recording, Best Practices, Limitations, Overlay API Summary, Tracing vs Video, Video Recording

### Community 92 - "EnrichDuplicates"
Cohesion: 0.13
Nodes (18): commit(), connect(), getEnv(), main(), printSummary(), blank(), EnrichDuplicates(), InsertAll() (+10 more)

### Community 93 - "xlsx.go"
Cohesion: 0.18
Nodes (16): atoiSafe(), colIndex(), ListSheetNames(), ReadNamedSheet(), ReadNamedSheetFrom(), ReadSheet(), ReadSheetFrom(), readSheetFromZip() (+8 more)

### Community 94 - "Components"
Cohesion: 0.25
Nodes (8): Buttons, Cards / Containers, Components, Inputs / Fields, Navigation, The Ledger Row (signature component), The Ledger Stamp Mark (signature component), The Login Abstract Panel (signature component)

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

### Community 100 - "oem.js"
Cohesion: 0.38
Nodes (8): oemRowIds(), confirmedOems(), oemKey(), progressOf(), readOemRows(), reconcileOemRows(), makeRow(), row()

### Community 101 - "ref_node_assert"
Cohesion: 0.13
Nodes (9): setEmail(), EMD_EDIT_ROLES, JSON_FIELDS, PEOPLE, bid, EDITABLE_SHEET_COLUMNS, SHEET_COLUMNS, nextUsername() (+1 more)

### Community 102 - "POST /api/v1/bids"
Cohesion: 0.40
Nodes (5): Error Codes, Example Request (Manual Mode), POST /api/v1/bids, Request Body, Response — 201 Created

### Community 103 - "POST /api/v1/tasks/{id}/activities"
Cohesion: 0.40
Nodes (5): Example — Call Logged, Example — Comment, POST /api/v1/tasks/{id}/activities, Request, Response — 201 Created

### Community 104 - "main"
Cohesion: 0.10
Nodes (20): main(), NewAlertHandler(), RegisterAlertRoutes(), NewAuthHandler(), NewBidHandler(), RegisterRoutes(), RegisterRoutes(), NewTicketHandler() (+12 more)

### Community 105 - "Lead"
Cohesion: 0.15
Nodes (11): Lead, UserSummary, PrebidItem, eventActorName(), approverID(), detailsHTML(), leadName(), managerID() (+3 more)

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

### Community 111 - "PrebidPanel.jsx"
Cohesion: 0.14
Nodes (26): ForceResetDialog(), handleClose(), handleConfirm(), ACTIONS, ALL_FIELDS, blankItem(), EmptyRowRemover(), FIELD_GROUPS (+18 more)

### Community 112 - "healthcheck"
Cohesion: 0.50
Nodes (8): healthcheck, interval, retries, start_period, test, timeout, healthcheck, healthcheck

### Community 113 - "PublishLeadDialog.jsx"
Cohesion: 0.12
Nodes (39): AddLeadPage(), buildPayload(), handleSubmit(), validate(), leadToForm(), Panel(), Segmented(), emdSummary() (+31 more)

### Community 114 - "StageWorkspaces.jsx"
Cohesion: 0.10
Nodes (62): StageModificationWarningDialog(), AssignPresalesModal(), buildEmdDetailsTableHtml(), buildPresalesCands(), buildRemarkCalloutHtml(), buildTenderDetailHtml(), buildValuesAdjustedBannerHtml(), checkStageState() (+54 more)

### Community 115 - "FeedbackPage.jsx"
Cohesion: 0.08
Nodes (47): CATEGORY_CLASSES, CATEGORY_FILTERS, CATEGORY_LABELS, formatTime(), SystemLogsPage(), useDebounce(), UsersTab(), DeleteConfirmDialog() (+39 more)

### Community 116 - "DocsTab.jsx"
Cohesion: 0.20
Nodes (16): DocsTab(), FilePick(), fmtDate(), saveBlob(), ACCEPTED_TENDER_DOCS, DOC_NAME_PRESETS, docKind(), formatBytes() (+8 more)

### Community 117 - "normalize.go"
Cohesion: 0.17
Nodes (34): CompetitorInfo, canonDashboardActivity(), canonDashboardPlatform(), deriveStageDashboard(), isOurName(), parseCompetitors(), ParseRowDashboard(), parseTimeFraction() (+26 more)

### Community 118 - "services"
Cohesion: 0.29
Nodes (6): networks, onetrack-network, driver, services, volumes, postgres_data

### Community 119 - "adminer"
Cohesion: 0.29
Nodes (7): container_name, depends_on, image, networks, ports, restart, adminer

### Community 120 - "watchtower"
Cohesion: 0.29
Nodes (7): watchtower, container_name, environment, image, networks, restart, volumes

### Community 121 - "Forbidden"
Cohesion: 0.30
Nodes (5): hasRole(), parseListParams(), RegisterTicketRoutes(), respondPage(), TicketHandler

### Community 122 - "redis"
Cohesion: 0.33
Nodes (6): container_name, image, networks, ports, restart, redis

### Community 123 - "react"
Cohesion: 0.06
Nodes (47): Field(), PasswordInput(), FORMATS, STAGE_LABELS, STAGE_ORDER, INITIAL_FORM, backdropVariants, closeButtonVariants (+39 more)

### Community 124 - "encoding/json.RawMessage"
Cohesion: 0.06
Nodes (22): AddMicroEventRequest, AuditLogPage, AuditLogQuery, GlobalAuditItem, StageHistoryPage, StageHistoryResponse, auditPageSize(), decodeAuditCursor() (+14 more)

### Community 125 - "testing.T"
Cohesion: 0.09
Nodes (30): add(), contactSvc(), no(), TestContactBanNeedsAReasonAndUnbanClearsIt(), TestContactDuplicatesAreRefusedAndNamed(), TestContactMoveReorderAndDelete(), TestContactUpdateKeepsOwnEmailButNotAnotherOnes(), TestContactValidation() (+22 more)

### Community 126 - "model.go"
Cohesion: 0.23
Nodes (8): TestContactNormalize(), TestEntryNormalize(), digitCount(), invalid(), tooLong(), UserMessage(), ContactInput, EntryInput

### Community 127 - "TestPrebidInputs"
Cohesion: 0.50
Nodes (3): NormalizePrebidEdit(), TestPrebidInputs(), PrebidTransitionRequest

### Community 128 - "ChecklistTab.jsx"
Cohesion: 0.14
Nodes (25): ChecklistReview(), isOem(), strip(), ChecklistTab(), logChecklistHistory(), OEM_PILL_COLORS, addSection(), cellBorder (+17 more)

### Community 129 - "build"
Cohesion: 0.67
Nodes (4): build, context, dockerfile, build

### Community 130 - "github.com/jackc/pgx/v5/pgxpool.Pool"
Cohesion: 0.07
Nodes (19): NewPostgresAuthRepository(), TenderDocument, NewBulkImportHandler(), DocsRepo, NewDocsRepo(), scanDoc(), NewPostgresBidRepository(), NewPostgresCalendarRepository() (+11 more)

### Community 131 - "service_test.go"
Cohesion: 0.33
Nodes (11): NewTicketService(), newFakeTicketRepo(), TestCreateTicket_NotifiesAndRemembers(), TestCreateTicket_StandardCategoryDoesNotTouchFieldMemory(), TestCreateTicket_Validation(), TestGetTicket_OwnershipEnforced(), TestGetTicketImagePath_OwnershipEnforced(), TestUpdateStatus_LogsAndNotifiesOnResolve() (+3 more)

### Community 132 - "RolesPermissionsDialog"
Cohesion: 0.19
Nodes (16): RoleInfoButton(), RolesPermissionsDialog(), handleClose(), handleSave(), KPI_BAND_TONES, PipelineKpiBand(), fmtMoney(), PricingSuggestionHint() (+8 more)

### Community 134 - "fail"
Cohesion: 0.21
Nodes (12): GoogleSyncService, actorPtr(), fail(), isRealAPIKey(), maskIntegration(), NewCalendarHandler(), oneOf(), TestIsRealAPIKeyRejectsPlaceholders() (+4 more)

### Community 136 - "LeadsPage.jsx"
Cohesion: 0.30
Nodes (10): LeadStageBadge(), LeadStatusBadge(), LeadTypeBadge(), PREBID, PrebidBadge(), STAGES, FilterGroup(), LeadsPage() (+2 more)

### Community 137 - "diffBidFields"
Cohesion: 0.33
Nodes (8): FieldDiff, derefFloat(), derefInt(), derefStr(), diffBidFields(), diffDateField(), diffField(), diffRequestFields()

### Community 138 - "InternalError"
Cohesion: 0.13
Nodes (12): extractTokenFromHeader(), RegisterAuthRoutes(), NewHandler(), BadRequest(), InternalError(), Unauthorized(), Handler, NewHandler() (+4 more)

### Community 143 - "credmail/service.go"
Cohesion: 0.27
Nodes (8): rowOf(), FailedItem, Kind, PasswordMismatchError, Preview, Row, SendRequest, Skipped

### Community 144 - "BidWorkspace"
Cohesion: 0.42
Nodes (6): BidWorkspace, defaultEMD(), emdAmount(), emdView(), exemptEMDView(), emdNotRequired()

### Community 145 - "calendar/handler/handler_test.go"
Cohesion: 0.42
Nodes (5): call(), engineRouter(), TestEngineStatusIsAdminOnly(), TestEngineStatusShape(), TestManualEvaluationIsRecordedAsManual()

### Community 146 - "apiFetch"
Cohesion: 0.15
Nodes (26): handleDelete(), handleDeleteLead(), submit(), Cell(), save(), acquireRefreshLockOrWaitForCompletion(), apiFetch(), releaseRefreshLock() (+18 more)

### Community 147 - "CreateUserDialog"
Cohesion: 0.36
Nodes (5): CreateUserDialog(), handleClose(), handleSubmit(), resetForm(), validate()

### Community 148 - "RecordEMDPaymentRequest"
Cohesion: 0.33
Nodes (5): RecordEMDPaymentRequest, ChallanPaymentDetails, ChequePaymentDetails, DepositorDetailsDTO, OnlinePaymentDetails

### Community 149 - ".TransitionStage"
Cohesion: 0.40
Nodes (4): TransitionResult, TransitionStageRequest, getRoleForStage(), skipEMDStage()

### Community 150 - "transitions.go"
Cohesion: 0.83
Nodes (3): GetAllowedTransitions(), IsTerminalStage(), IsTransitionAllowed()

### Community 151 - "LeadHandler"
Cohesion: 0.23
Nodes (8): randomHex(), RegisterLeadRoutes(), userMessage(), assigneeLabel(), actorOf(), fail(), Holders(), LeadHandler

### Community 165 - ".UpdateDocument"
Cohesion: 0.18
Nodes (6): cleanDocName(), folderSlug(), randomHex(), readTenderDoc(), safeName(), TestSafeNameAndSlug()

## Knowledge Gaps
- **1 isolated node(s):** `github.com/onetrack/backend`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 743 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **11 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `OneTrack GlobX — API Documentation` connect `OneTrack GlobX — API Documentation` to `6. Tenders (Bid Workspaces) — `/api/v1/bids``, `4. Users & Profile — `/api/v1/users``, `9. Feedback Tickets — `/api/v1/tickets``, `7. Leads — `/api/v1/leads``, `1. Getting started`, `8. Alerts — `/api/v1/alerts``, `12. Appendix: enums and reference values`?**
  _High betweenness centrality (0.377) - this node is a cross-community bridge._
- **What connects `github.com/onetrack/backend` to the rest of the system?**
  _1 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Service` be split into smaller, more focused modules?**
  _Cohesion score 0.1339031339031339 - nodes in this community are weakly interconnected._
- **Why does `kind` connect `12. Appendix: enums and reference values` to `model.go`?**
  _High betweenness centrality (0.371) - this node is a cross-community bridge._
- **Should `useBidStore` be split into smaller, more focused modules?**
  _Cohesion score 0.09243697478991597 - nodes in this community are weakly interconnected._
- **Why does `12. Appendix: enums and reference values` connect `12. Appendix: enums and reference values` to `OneTrack GlobX — API Documentation`?**
  _High betweenness centrality (0.361) - this node is a cross-community bridge._
- **Should `BidService` be split into smaller, more focused modules?**
  _Cohesion score 0.07897793263646923 - nodes in this community are weakly interconnected._