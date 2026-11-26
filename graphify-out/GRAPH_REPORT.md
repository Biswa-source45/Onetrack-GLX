# Graph Report - Onetrack-GlobX  (2026-11-06)

## Corpus Check
- 471 files · ~395,059 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 10 file(s) not represented in the graph (top: (none) 5, .css 2, .example 1)

## Summary
- 3894 nodes · 13102 edges · 149 communities (135 shown, 14 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 438 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `f40eaaa8`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Service
- working_calendar_service.go
- BidService
- WorkingCalendarRepository
- TenderDetailPage.jsx
- Landing.jsx
- TicketResponse
- TendersPage.jsx
- context.Context
- time.Time
- Endpoints
- working_calendar_service_test.go
- lucide-react
- Alert
- bidService
- Endpoints
- Success
- Dashboard.jsx
- go_pkg_fmt
- EventItem
- WorkingCalendarPage.jsx
- userService
- Files Changed
- Repo
- with
- bid_service_test.go
- authService
- Stage4Workspace
- dependencies
- server/main.go
- package.json
- templates.go
- components.json
- Detail
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
- Button
- emd_service_test.go
- TenderContact
- PART 2 — TASK MANAGEMENT APIs
- OneTrack GlobX — API Documentation
- Deployment Readiness & Runbook — Bulk Import Fix Release
- fail
- 6. Tenders (Bid Workspaces) — `/api/v1/bids`
- backend
- TenderEMDDetails
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
- 3. Auth — `/api/v1/auth`
- 8. Alerts — `/api/v1/alerts`
- Commands
- 12. Appendix: enums and reference values
- mockCalendarRepo
- frontend
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
- oem.js
- TenderDeadlineCandidate
- POST /api/v1/bids
- POST /api/v1/tasks/{id}/activities
- main
- PrebidItem
- POST /api/v1/tasks/{id}/approve
- POST /api/v1/tasks/{id}/oem-followup
- POST /api/v1/bids/{id}/tasks/document
- POST /api/v1/bids/{id}/tasks
- React + Vite
- DirectoryPage.jsx
- healthcheck
- PublishLeadDialog.jsx
- StageWorkspaces.jsx
- FeedbackPage.jsx
- Handler
- normalize.go
- services
- adminer
- watchtower
- Forbidden
- redis
- InteractiveBoardDemo.jsx
- encoding/json.RawMessage
- testing.T
- ShortfallCandidate
- go_pkg_strings
- ChecklistTab.jsx
- build
- Repo
- service_test.go
- PricingSuggestionHint
- exceljs
- fail
- Actor
- TenderStakeholder
- diffBidFields
- InternalError
- @fontsource-variable/instrument-sans@^5.2.8
- html-to-image
- react-is@^19.2.6
- apiFetch
- BackgroundScheduler
- LeadHandler
- DocsRepo
- list_exports.js
- .UpdateDocument

## God Nodes (most connected - your core abstractions)
1. `Button()` - 164 edges
2. `Success()` - 113 edges
3. `apiFetch()` - 108 edges
4. `react` - 97 edges
5. `cn()` - 95 edges
6. `BadRequest()` - 83 edges
7. `lucide-react` - 82 edges
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

## Communities (149 total, 14 thin omitted)

### Community 0 - "Service"
Cohesion: 0.07
Nodes (18): NewService(), rowOf(), validEmail(), TestKindGate(), Batch, Candidate, FailedItem, fakeStore (+10 more)

### Community 1 - "working_calendar_service.go"
Cohesion: 0.19
Nodes (16): TenderLink(), TaskNotification, calendarLocation(), dayHoursOf(), deref(), fmtNum(), outcomeOf(), parseTimeHM() (+8 more)

### Community 2 - "BidService"
Cohesion: 0.04
Nodes (29): BidService, AddChecklistRequest, AddMemberRequest, BidChecklistItem, BidListItem, BidListResponse, BidResponse, CreateBidRequest (+21 more)

### Community 3 - "WorkingCalendarRepository"
Cohesion: 0.07
Nodes (8): GoogleSyncService, WorkingCalendarRepository, Holiday, SyncResult, UpdateHolidayRequest, NewCalendarHandler(), NewGoogleSyncService(), stubRepo

### Community 4 - "TenderDetailPage.jsx"
Cohesion: 0.07
Nodes (59): StatusPill(), ArchiveConfirmDialog(), handleConfirm(), ComplianceCard(), EXIT_HINTS, EXIT_OPTIONS, ExitedBanner(), extractCommercialDetails() (+51 more)

### Community 5 - "Landing.jsx"
Cohesion: 0.15
Nodes (24): BentoTile(), CapabilitiesSection(), CountUp(), DEMO_SHEET_TENDERS, FadedCheckBackground(), FloatingChip(), Footer(), GhostButton() (+16 more)

### Community 6 - "TicketResponse"
Cohesion: 0.05
Nodes (20): FieldMemory, TicketRepository, TicketService, CreateTicketRequest, ListTicketsParams, Ticket, TicketListPage, TicketResponse (+12 more)

### Community 7 - "TendersPage.jsx"
Cohesion: 0.06
Nodes (74): exportExcel(), CopyButton(), EmdDetailsPage(), handleExportExcel(), getDeadlineDate(), isActivePipeline(), isEmdRequired(), isPreSubmission() (+66 more)

### Community 8 - "context.Context"
Cohesion: 0.03
Nodes (13): AuthRepository, Role, User, UserPermissionOverride, BidRepository, ReorderChecklistItem, UpdateChecklistPriorityRequest, UserRepository (+5 more)

### Community 9 - "time.Time"
Cohesion: 0.08
Nodes (16): WorkingCalendarService, CalculateDeadlineResult, DeadlineCoverage, EngineRuntime, EvaluationSummary, LastRun, dayDesc(), ordinal() (+8 more)

### Community 10 - "Endpoints"
Cohesion: 0.04
Nodes (46): 1. Health Check, 2. Login, 3. Refresh Token, 4. Logout, 5. Change Password, 6. Force Password Reset, Access Token JWT Payload, Admin User (+38 more)

### Community 11 - "working_calendar_service_test.go"
Cohesion: 0.11
Nodes (54): NewBackgroundScheduler(), NewWorkingCalendarService(), escalationAlerts(), escalationRepo(), inWindowTender(), isWorkingDay(), newMockCalendarRepo(), newSvc() (+46 more)

### Community 12 - "lucide-react"
Cohesion: 0.06
Nodes (85): useDebounce(), UsersTab(), ForcePasswordChangeGuard(), EntryFields(), Field(), AddLeadPage(), leadToForm(), Panel() (+77 more)

### Community 13 - "Alert"
Cohesion: 0.06
Nodes (11): Alert, AlertRepository, AlertService, SafeLink(), TestSafeLink(), NewAlertHandler(), NewAlertService(), fakeAlertSvc (+3 more)

### Community 14 - "bidService"
Cohesion: 0.05
Nodes (52): ApprovalLink(), StageLink(), MDDecisionRequest, SubmitMDApprovalRequest, TenderEMDResponse, UpdateBasicEMDRequest, UpdateEMDRefundRequest, VerifyEMDPaymentRequest (+44 more)

### Community 15 - "Endpoints"
Cohesion: 0.05
Nodes (39): 1. Create User, 2. List Users, 3. Get My Profile, 4. Get User by ID, 5. Update User Profile, 6. Update User Status (Activate/Deactivate), 7. Update User Roles, 8. Update Permission Overrides (+31 more)

### Community 16 - "Success"
Cohesion: 0.11
Nodes (10): contactError(), actorRoles(), mapServiceError(), parseIntQuery(), RegisterBidRoutes(), techEvalError(), BadRequest(), Conflict() (+2 more)

### Community 17 - "Dashboard.jsx"
Cohesion: 0.07
Nodes (78): AccountSettings(), saveProfile(), Fact(), Field(), fieldsOf(), PasswordInput(), PERMISSION_CATEGORIES, PERMISSION_METADATA (+70 more)

### Community 18 - "go_pkg_fmt"
Cohesion: 0.09
Nodes (12): getEnv(), main(), f64p(), intp(), strp(), TestUpdateCalendarRequestValidate(), PasswordMismatchError, ConfigureGoogleSyncRequest (+4 more)

### Community 19 - "EventItem"
Cohesion: 0.15
Nodes (10): Repository, Service, EventItem, ListQuery, Page, Handler, NewHandler(), service (+2 more)

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
Cohesion: 0.14
Nodes (12): TestContactNormalize(), TestEntryNormalize(), digitCount(), invalid(), tooLong(), affected(), mapErr(), Contact (+4 more)

### Community 24 - "with"
Cohesion: 0.09
Nodes (21): permissions, runs-on, steps, jobs, build-and-push, name, on, workflow_dispatch (+13 more)

### Community 25 - "bid_service_test.go"
Cohesion: 0.12
Nodes (34): extractProductFields(), fieldSuggestionEntries(), NewBidService(), boolPtr(), floatPtr(), hasAlertType(), intPtr(), lastEventType() (+26 more)

### Community 26 - "authService"
Cohesion: 0.12
Nodes (8): AuthService, ChangePasswordRequest, ForceResetRequest, LoginRequest, LoginResponse, NewAuthHandler(), UserInfo, authService

### Community 27 - "Stage4Workspace"
Cohesion: 0.24
Nodes (14): computeL1PricingSummary(), emdValue(), firstValid(), inr(), Section(), TenderPrintSheet(), buybackDraft(), buybackLines() (+6 more)

### Community 28 - "dependencies"
Cohesion: 0.11
Nodes (19): dependencies, class-variance-authority@^0.7.1, @fontsource-variable/inter@^5.2.8, framer-motion@^12.40.0, lucide-react@^1.16.0, radix-ui@^1.4.3, react@^19.2.6, react-dom@^19.2.6 (+11 more)

### Community 29 - "server/main.go"
Cohesion: 0.07
Nodes (24): isRealAPIKey(), call(), engineRouter(), TestEngineStatusIsAdminOnly(), TestEngineStatusShape(), TestIsRealAPIKeyRejectsPlaceholders(), TestManualEvaluationIsRecordedAsManual(), TestValidateImageUpload() (+16 more)

### Community 30 - "package.json"
Cohesion: 0.13
Nodes (14): canvas-confetti@^1.9.4, clsx@^2.1.1, docx-preview@^0.4.1, tailwindcss@^4.3.0, tw-animate-css@^1.4.0, name, private, type (+6 more)

### Community 31 - "templates.go"
Cohesion: 0.20
Nodes (18): TestHostileValuesAreEscaped(), TestNoteIsABoldHighlightedCallout(), TestResetConfirmationKeepsTheWelcomeFormatWithoutAPassword(), TestWelcomeMailFollowsTheTeamFormat(), AccessAlertMessage(), accessInfoTable(), callout(), credTable() (+10 more)

### Community 32 - "components.json"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 33 - "Detail"
Cohesion: 0.06
Nodes (49): setEmail(), Detail(), DirectoryPage(), errText(), fmtDate(), initials(), List(), Tags() (+41 more)

### Community 34 - "JWTService"
Cohesion: 0.10
Nodes (10): JWTService, TokenClaims, TokenPair, NewAuthService(), NewJWTService(), EmailService, uniqueNonEmpty(), stubJWT (+2 more)

### Community 35 - "cn"
Cohesion: 0.06
Nodes (50): backdropVariants, closeButtonVariants, CreateUserSheet(), handleSubmit(), onKeyDown(), requestClose(), resetForm(), validate() (+42 more)

### Community 36 - "AlertUsersPanel.jsx"
Cohesion: 0.18
Nodes (26): AccessAlertDialog(), handleSend(), AlertUsersPanel(), applySharedPassword(), changeInclude(), confirmSend(), setPassword(), fmt() (+18 more)

### Community 37 - ".SetTechEvalDate"
Cohesion: 0.21
Nodes (10): AddTechEvalNoteRequest, OpenTechEvalRequest, SetTechEvalDateRequest, TechEval, newTechEvalID(), parseTechEval(), techEvalDate(), techEvalLabel() (+2 more)

### Community 38 - "EmdDetailsDialog.jsx"
Cohesion: 0.12
Nodes (39): EmdApprovalDialog(), ACTION_STYLE, EmdAuditDialog(), fmtDate(), EmdDetailsDialog(), Field(), fmtDate(), ReceiptUpload() (+31 more)

### Community 39 - "emdfix/main.go"
Cohesion: 0.14
Nodes (13): env(), main(), strOr(), env(), main(), printSection(), queryRows(), truncate() (+5 more)

### Community 40 - "bid/domain/models.go"
Cohesion: 0.15
Nodes (10): RecordEMDPaymentRequest, techEvalChangeText(), techEvalPretty(), ChallanPaymentDetails, ChequePaymentDetails, DepositorDetailsDTO, OnlinePaymentDetails, PendingApprovalError (+2 more)

### Community 41 - "LedgerRow"
Cohesion: 0.13
Nodes (19): Colors, Deep Panel (login left panel only), Design System: OneTrack — The Ledger, Do:, Do's and Don'ts, Don't:, Elevation & Depth, Hierarchy (+11 more)

### Community 42 - "bid_service.go"
Cohesion: 0.13
Nodes (11): alertNoteHTML(), money(), ownershipChangeSummaryHTML(), rowsToHTMLTable(), shortfallRounds(), tenderSummaryHTML(), alertNoteFields, pricingItemJSON (+3 more)

### Community 43 - "Browser Session Management"
Cohesion: 0.10
Nodes (20): 1. Name Browser Sessions Semantically, 2. Always Clean Up, 3. Delete Stale Browser Data, A/B Testing Sessions, Attach by channel name, Attach via browser extension, Attach via CDP endpoint, Attaching to a Running Browser (+12 more)

### Community 44 - "App.jsx"
Cohesion: 0.07
Nodes (37): App(), AuthGuard(), ExcludeRoleGuard(), GuestGuard(), PermissionGuard(), RoleGuard(), BulkImportPage(), handleCommit() (+29 more)

### Community 45 - "devDependencies"
Cohesion: 0.16
Nodes (15): devDependencies, eslint@^10.3.0, @eslint/js@^10.0.1, eslint-plugin-react-hooks@^7.1.1, eslint-plugin-react-refresh@^0.5.2, globals@^17.6.0, @types/react@^19.2.14, @types/react-dom@^19.2.3 (+7 more)

### Community 46 - "config.go"
Cohesion: 0.13
Nodes (14): getEnv(), DatabaseConfig, EmailConfig, JWTConfig, RedisConfig, Load(), headerSafe(), NewEmailService() (+6 more)

### Community 47 - "Storage Management"
Cohesion: 0.11
Nodes (18): Authentication State Reuse, Clear sessionStorage, Common Patterns, Delete Database, Delete Single Item, Get Single Value, IndexedDB, List All sessionStorage Items (+10 more)

### Community 48 - "fakeBidRepo"
Cohesion: 0.03
Nodes (19): PricingWorkspaceRow, BidChecklist, BidStageHistory, CreateBidParams, FieldSuggestion, IdentifierMatch, MemberResponse, PendingApproval (+11 more)

### Community 49 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, lint, preview

### Community 50 - "GoogleCalendarIntegration"
Cohesion: 0.21
Nodes (9): DefaultIntegration(), GoogleCalendarIntegration, googleFixture(), syncRepo(), TestGoogleSyncFailsWhenUnreachable(), TestGoogleSyncFailsWithoutFabricatingHolidays(), TestGoogleSyncImportsPublicHolidaysOnly(), TestGoogleSyncKeySources() (+1 more)

### Community 51 - "credmail/service_test.go"
Cohesion: 0.34
Nodes (13): cand(), ids(), newSvc(), TestAlreadyAlertedSkippedUnlessIncluded(), TestFailedMailIsRecordedAndBatchStillFinishes(), TestLoginDetailsAreABorderedTableInEveryMail(), TestNotConfiguredSendsNothing(), TestPanicInSenderClosesBatchAndFreesTheGuard() (+5 more)

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
Cohesion: 0.19
Nodes (25): DUE_STYLE, esc(), ShortfallHistoryCard(), ShortfallPanel(), STATUS_STYLE, Stage10Workspace(), addRound(), approverChoices() (+17 more)

### Community 59 - "ledgerTheme.js"
Cohesion: 0.29
Nodes (9): AuthModal(), LedgerStampMark(), ledger, LEDGER_STAGES, ledgerFont, LoginHeroPanel(), BUILDINGS, LoginSkyline() (+1 more)

### Community 60 - "Button"
Cohesion: 0.06
Nodes (94): PasswordCard(), ActivityLogDialog(), eventBadge(), CreateUserDialog(), handleClose(), handleSubmit(), resetForm(), validate() (+86 more)

### Community 61 - "emd_service_test.go"
Cohesion: 0.20
Nodes (22): float64Ptr(), newEMDTestSetup(), onlinePayment(), TestChecklist_ToggleKeepsStatusInSync(), TestChecklist_ValidatesPriorityAndStatus(), TestEMD_AdminHoldingOtherRolesStillBlockedFromSelfDecision(), TestEMD_BasicUpdateCannotTouchStatusAndLocksWhilePending(), TestEMD_DecisionAlertsLinkToEMDStage() (+14 more)

### Community 62 - "TenderContact"
Cohesion: 0.10
Nodes (14): ReorderContactItem, ReorderContactsRequest, SaveContactRequest, TenderContact, UpdateContactRequest, contactErr(), scanContact(), cleanContact() (+6 more)

### Community 63 - "PART 2 — TASK MANAGEMENT APIs"
Cohesion: 0.12
Nodes (16): Auto-Activity Logged, DELETE /api/v1/tasks/{id}, DELETE /api/v1/tasks/{id}/checklists/{checklist_id}, GET /api/v1/bids/{id}/tasks, GET /api/v1/tasks/{id}, GET /api/v1/tasks/{id}/activities, GET /api/v1/tasks/{id}/subtasks, PART 2 — TASK MANAGEMENT APIs (+8 more)

### Community 64 - "OneTrack GlobX — API Documentation"
Cohesion: 0.13
Nodes (14): 10.1 `GET /system/config`, 10.2 `GET /system/config/:key`, 10.3 `PUT /system/config/:key`, 10. System Configuration — `/api/v1/system/config`, 11.1 `GET /system-logs`, 11. System Logs — `/api/v1/system-logs`, 13. Appendix: endpoint index, 2.1 `GET /health` (+6 more)

### Community 65 - "Deployment Readiness & Runbook — Bulk Import Fix Release"
Cohesion: 0.14
Nodes (13): 0. Before you touch anything, 10. Rollback plan, 1. Back up the host database first, 2. Audit the host database, 3. Push and let the pipeline build, 4. Deploy to the host, 6. Confirm the service is healthy, 7. Dry-run both workbooks before writing anything (+5 more)

### Community 66 - "fail"
Cohesion: 0.33
Nodes (5): fail(), NewHandler(), who(), UserMessage(), Handler

### Community 67 - "6. Tenders (Bid Workspaces) — `/api/v1/bids`"
Cohesion: 0.12
Nodes (16): 6.10 Workspace members, 6.11 Checklists, 6.13 `PATCH /bids/:id/outcome` — record outcome, 6.14 Tender Bin, 6.15 `POST /bids/bulk-import` — Excel import, 6.16 Tender documents (RFP, ATC, ...), 6.1 Typical lifecycle (step by step), 6.2 `POST /bids` — create tender (+8 more)

### Community 68 - "backend"
Cohesion: 0.15
Nodes (13): container_name, depends_on, environment, image, networks, ports, restart, volumes (+5 more)

### Community 69 - "TenderEMDDetails"
Cohesion: 0.07
Nodes (6): TenderEMDAuditLog, TenderEMDDetails, EMDTx, scanEMD(), pgEMDTx, fakeEMDTx

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
Cohesion: 0.15
Nodes (12): Accessibility & Inclusion, Brand Commitments, Capabilities and Constraints, Evidence on Hand, Operating Context, Platform, Positioning, Product (+4 more)

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
Cohesion: 0.07
Nodes (53): commit(), connect(), deref(), fmtDate(), fmtNum(), getEnv(), main(), printSummary() (+45 more)

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
Cohesion: 0.17
Nodes (12): 12.1 Tender workflow stages, 12.2 Tender status values, 12.3 Lead values, 12.4 Preset dropdown values (free text also accepted), 12.5 Feedback categories, 12. Appendix: enums and reference values, 6.7 Edit approvals, `GET /bids/:id/pending-edit` (+4 more)

### Community 88 - "mockCalendarRepo"
Cohesion: 0.06
Nodes (8): TechEvalDateCandidate, CalendarException, GoogleCalendarSyncLog, NextActionableTask, UpdateCalendarRequest, WorkingCalendar, failingBaselineRepo, mockCalendarRepo

### Community 89 - "frontend"
Cohesion: 0.22
Nodes (9): condition, backend, container_name, depends_on, image, networks, ports, restart (+1 more)

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

### Community 102 - "POST /api/v1/bids"
Cohesion: 0.40
Nodes (5): Error Codes, Example Request (Manual Mode), POST /api/v1/bids, Request Body, Response — 201 Created

### Community 103 - "POST /api/v1/tasks/{id}/activities"
Cohesion: 0.40
Nodes (5): Example — Call Logged, Example — Comment, POST /api/v1/tasks/{id}/activities, Request, Response — 201 Created

### Community 104 - "main"
Cohesion: 0.07
Nodes (33): main(), RegisterAlertRoutes(), NewPostgresAlertRepository(), NewPostgresAuthRepository(), NewBulkImportHandler(), NewDocsRepo(), NewPostgresBidRepository(), NewPostgresCalendarRepository() (+25 more)

### Community 105 - "PrebidItem"
Cohesion: 0.32
Nodes (3): PrebidItem, scanPrebidItem(), PrebidState

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

### Community 111 - "DirectoryPage.jsx"
Cohesion: 0.08
Nodes (52): ForceResetDialog(), handleClose(), handleConfirm(), getHue(), getInitials(), UserAvatar(), LeadStageBadge(), LeadStatusBadge() (+44 more)

### Community 112 - "healthcheck"
Cohesion: 0.50
Nodes (8): healthcheck, interval, retries, start_period, test, timeout, healthcheck, healthcheck

### Community 113 - "PublishLeadDialog.jsx"
Cohesion: 0.16
Nodes (27): buildPayload(), handleSubmit(), validate(), handleUpload(), CATEGORY_PRESETS, DropZone(), FileChip(), keepValid() (+19 more)

### Community 114 - "StageWorkspaces.jsx"
Cohesion: 0.13
Nodes (50): logChecklistHistory(), ContactsSummary(), AssignPresalesModal(), buildEmdDetailsTableHtml(), buildPresalesCands(), buildRemarkCalloutHtml(), buildTenderDetailHtml(), buildValuesAdjustedBannerHtml() (+42 more)

### Community 115 - "FeedbackPage.jsx"
Cohesion: 0.10
Nodes (35): CATEGORY_CLASSES, CATEGORY_FILTERS, CATEGORY_LABELS, formatTime(), SystemLogsPage(), ALLOWED_IMAGE_TYPES, FeedbackPage(), handleSubmit() (+27 more)

### Community 117 - "normalize.go"
Cohesion: 0.14
Nodes (40): CompetitorInfo, canonDashboardActivity(), canonDashboardPlatform(), deriveStageDashboard(), isOurName(), parseCompetitors(), ParseRowDashboard(), parseTimeFraction() (+32 more)

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
Cohesion: 0.27
Nodes (7): kindGate(), hasRole(), parseListParams(), RegisterTicketRoutes(), respondPage(), Forbidden(), TicketHandler

### Community 122 - "redis"
Cohesion: 0.33
Nodes (6): container_name, image, networks, ports, restart, redis

### Community 124 - "encoding/json.RawMessage"
Cohesion: 0.07
Nodes (20): AddMicroEventRequest, AuditLogPage, AuditLogQuery, GlobalAuditItem, StageHistoryPage, StageHistoryResponse, auditPageSize(), decodeAuditCursor() (+12 more)

### Community 125 - "testing.T"
Cohesion: 0.09
Nodes (30): add(), contactSvc(), no(), TestContactBanNeedsAReasonAndUnbanClearsIt(), TestContactDuplicatesAreRefusedAndNamed(), TestContactMoveReorderAndDelete(), TestContactUpdateKeepsOwnEmailButNotAnotherOnes(), TestContactValidation() (+22 more)

### Community 127 - "go_pkg_strings"
Cohesion: 0.11
Nodes (17): TestValidateTenderDoc(), validateTenderDoc(), FolderSlug(), NormalizePrebidEdit(), TestPrebidInputs(), checkPublished(), TestPublishRequestNormalize(), TestTransitionRequestNormalize() (+9 more)

### Community 128 - "ChecklistTab.jsx"
Cohesion: 0.14
Nodes (26): ChecklistReview(), isOem(), strip(), ChecklistTab(), OEM_PILL_COLORS, StageModificationWarningDialog(), getOemFollowUps(), Stage3Workspace() (+18 more)

### Community 129 - "build"
Cohesion: 0.67
Nodes (4): build, context, dockerfile, build

### Community 130 - "Repo"
Cohesion: 0.13
Nodes (5): CreateLeadRequest, Document, NewLeadHandler(), Repo, scanLead()

### Community 131 - "service_test.go"
Cohesion: 0.33
Nodes (11): NewTicketService(), newFakeTicketRepo(), TestCreateTicket_NotifiesAndRemembers(), TestCreateTicket_StandardCategoryDoesNotTouchFieldMemory(), TestCreateTicket_Validation(), TestGetTicket_OwnershipEnforced(), TestGetTicketImagePath_OwnershipEnforced(), TestUpdateStatus_LogsAndNotifiesOnResolve() (+3 more)

### Community 132 - "PricingSuggestionHint"
Cohesion: 0.50
Nodes (4): fmtMoney(), PricingSuggestionHint(), useSuggestion(), getPricingSuggestion()

### Community 134 - "fail"
Cohesion: 0.25
Nodes (9): actorPtr(), fail(), isAdmin(), maskIntegration(), oneOf(), TestMaskIntegrationNeverExposesKey(), RegisterCalendarRoutes(), Success() (+1 more)

### Community 136 - "TenderStakeholder"
Cohesion: 0.29
Nodes (3): RedZoneNotificationResult, TenderStakeholder, isTechEvalRecipient()

### Community 137 - "diffBidFields"
Cohesion: 0.33
Nodes (8): FieldDiff, derefFloat(), derefInt(), derefStr(), diffBidFields(), diffDateField(), diffField(), diffRequestFields()

### Community 138 - "InternalError"
Cohesion: 0.16
Nodes (10): extractTokenFromHeader(), RegisterAuthRoutes(), InternalError(), NotFound(), Unauthorized(), Handler, NewHandler(), RegisterUserRoutes() (+2 more)

### Community 146 - "apiFetch"
Cohesion: 0.07
Nodes (54): choose(), handleClose(), handleSave(), DeleteConfirmDialog(), formatDateTime(), RowActions(), SkeletonRow(), UserTable() (+46 more)

### Community 150 - "BackgroundScheduler"
Cohesion: 0.12
Nodes (8): TestSchedulerIntervalCombinesValueAndUnit(), TestValidateIntervalNormalisesUnit(), TestValidateTriggerNormalisesUnit(), TriggerDays(), ValidateInterval(), ValidateTrigger(), fakeMailer, BackgroundScheduler

### Community 151 - "LeadHandler"
Cohesion: 0.19
Nodes (14): Lead, UserSummary, RegisterLeadRoutes(), userMessage(), assigneeLabel(), eventActorName(), actorOf(), approverID() (+6 more)

### Community 156 - "DocsRepo"
Cohesion: 0.23
Nodes (4): TenderDocument, NewBidHandler(), DocsRepo, scanDoc()

### Community 165 - ".UpdateDocument"
Cohesion: 0.16
Nodes (9): cleanDocName(), folderSlug(), randomHex(), readTenderDoc(), safeName(), TestSafeNameAndSlug(), saveReceiptFile(), validateReceiptUpload() (+1 more)

## Knowledge Gaps
- **1 isolated node(s):** `github.com/onetrack/backend`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 744 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **14 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `OneTrack GlobX — API Documentation` connect `OneTrack GlobX — API Documentation` to `6. Tenders (Bid Workspaces) — `/api/v1/bids``, `4. Users & Profile — `/api/v1/users``, `9. Feedback Tickets — `/api/v1/tickets``, `7. Leads — `/api/v1/leads``, `1. Getting started`, `3. Auth — `/api/v1/auth``, `8. Alerts — `/api/v1/alerts``, `12. Appendix: enums and reference values`?**
  _High betweenness centrality (0.394) - this node is a cross-community bridge._
- **What connects `github.com/onetrack/backend` to the rest of the system?**
  _1 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Service` be split into smaller, more focused modules?**
  _Cohesion score 0.070578231292517 - nodes in this community are weakly interconnected._
- **Why does `kind` connect `12. Appendix: enums and reference values` to `bid_service.go`?**
  _High betweenness centrality (0.388) - this node is a cross-community bridge._
- **Should `BidService` be split into smaller, more focused modules?**
  _Cohesion score 0.04477611940298507 - nodes in this community are weakly interconnected._
- **Should `WorkingCalendarRepository` be split into smaller, more focused modules?**
  _Cohesion score 0.06756756756756757 - nodes in this community are weakly interconnected._
- **Should `TenderDetailPage.jsx` be split into smaller, more focused modules?**
  _Cohesion score 0.07117255504352278 - nodes in this community are weakly interconnected._