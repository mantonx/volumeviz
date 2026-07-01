# VolumeViz — Project Status (Reality Check)

**Date:** 2026-06-30
**Context:** Repo was dormant since the last commit (2025-10-10, ~8.5 months) with a large pile of uncommitted work still sitting in the working tree. This document is a ground-truth assessment of what's actually true right now — verified directly (build/typecheck/grep against the live files), not inferred from ROADMAP.md, ARCHITECTURE.md, or planning-doc claims. Treat this as the current source of truth; supersede it the next time a real audit is done, don't let it go stale the way `FILES_PAGE_ASSESSMENT.md` did.

## Bottom line

The uncommitted work from the last session is mostly real and close to landable — not abandoned half-measures. But the build/test tooling itself is currently unreliable: a backend interface refactor was never propagated to ~14 test packages, the frontend has real (non-test) TypeScript errors, the frontend test suite hangs, and one frontend feature (Alerts) is fully broken due to a missing module. Fix the tooling and the broken module before building anything new on top — otherwise you're building on a foundation you can't verify.

## Uncommitted work — is it safe to build on?

**Yes, mostly.** Three independent threads of work from the last session, none coordinated by a master plan, but each internally coherent:

- **Volumes page refactor** (`VolumesList`, `VolumeTable`, new `VolumesListHeader`/`Filters`/`Stats`, `VolumeTableRow`, export/selection hooks) — genuinely finished, matches its own plan doc, real line-count reductions, all new components actually imported and used.
- **Volume tracking feature** (migration `000016_add_volume_tracking`, track/untrack replacing delete) — fully wired end-to-end on the Postgres path: migration → `current_schema.sql` → SQLC models/queries → repo → handlers → frontend hooks. The SQLite path is explicitly stubbed (`"tracking not yet implemented for SQLite"`) — a known, intentional gap, not a bug.
- **Directory tree pagination fix** — the critical bug `FILES_PAGE_ASSESSMENT.md` flagged (hardcoded `limit=100`, only 4.6% of a large volume browsable) was fixed the same evening, before the doc was even finalized. `DirectoryTree.tsx` now has real infinite scroll, load-more, and server-side search. **That assessment doc is stale — archive it, don't read it as current state.**

Packaging-only gap: the `docs/openapi.yaml`/`openapi-3.0.yaml` diffs are huge (thousands of lines) but mostly catch-up drift from being uncommitted since August, not solely from this session's changes — regenerate cleanly before committing rather than trusting the diff at face value.

## Backend

| Check | Result |
|---|---|
| `go build ./...` | ✅ Passes |
| `go vet ./...` | ❌ 14 of ~24 internal packages fail |
| `go test ./...` | 10 packages pass; 14 won't compile; 1 confirmed **panic** |

**Root cause of the test breakage:** an interface refactor (`interfaces.DockerService` gained a method, `store.Store` gained `Checkpoints()`/`Alerts()`, sqlc types changed shape) was never propagated to tests/mocks. This is mechanical cleanup, not redesign — but until it's fixed, `go test` results can't be trusted for anything.

Two real (non-test) bugs found:
- **Panic**: `internal/services/docker/docker_service.go:220` — nil pointer dereference in `GetVolumeContainers`.
- **Dead code path**: `internal/api/v1/scan/handler.go:1311` — an impossible type assertion means `GetMediaEnrichmentStatus` can never succeed; it silently always falls through to a placeholder response instead of erroring.

Per-area verdicts (Working / Partial / Stubbed/Broken):

| Area | Verdict | Note |
|---|---|---|
| Docker volume discovery | Partial | Hardcoded `ListAllVolumes(ctx, 1000, 0)`, no pagination past 1000 volumes (`volume_discovery.go:231`, TODO) |
| Full scan | Working-ish | Substantial scheduler/handler code, but zero test coverage on the handler with the broken type assertion |
| Incremental scan | Partial | Logic present, but `internal/scheduler` package test build fails — can't verify behavior |
| Checkpoint/resume | Partial | Can't list recent checkpoints (`resume.go:140`, TODO) |
| File/directory indexing | Partial | `DeleteFilesByFolder`/bulk insert not implemented on at least one path; SQLite largely stubbed |
| Search | Stubbed | Saved-search result handling incomplete (4 TODOs in `search/saved.go`); suggestions not implemented |
| Alerts (backend) | Partial | Engine/evaluator/delivery real, but `alerts_repo.go:492` hardcodes `RuleID: 0` — a correctness bug |
| Multi-tenant orgs | Partial/Broken | User counts hardcoded to 0 (`organizations_repo.go:76-77`, "Users table not implemented yet"); integration test won't compile |
| Scheduler/retention | Partial/Stubbed | 5+ TODOs in `lifecycle/retention.go`, several SQLite-specific paths explicitly not implemented |
| WebSocket events | Partial | Broadcaster real, but two event types fire with **empty payloads** (`broadcaster.go:676-697`, explicit TODOs) |
| Preview generation | Broken (per failing tests) | `CanGeneratePreview`/`GetSupportedTypes` behavior contradicts its own tests |

**SQLite is a facade, not a supported backend.** `store/store_sqlite.go` returns `ErrNotImplemented` for organizations, users, checkpoints, snapshots, and the volumes repo. If SQLite support is claimed anywhere in docs, that claim is false today.

Other structural gaps: `CreateContainer`/`CreateVolumeMount` are unimplemented even on the Postgres path (`volumes_repo.go:347,468`); audit logging doesn't actually persist anything (`security/audit_logger.go:277` and others); auth session tracking is fake (`auth_service.go:231`, hardcoded `SessionID: "jwt-gen"`).

## Frontend

| Check | Result |
|---|---|
| `npm run build` (Vite) | ✅ Passes |
| `npx tsc --noEmit -p .` | ❌ Fails — including real, non-test files |
| Test suite (vitest) | ❌ Hangs after 5 of 42 files — broken tooling, not flakiness |

**Important methodology note:** Vite's build does not run the TypeScript checker, so "build passes" is not evidence the code typechecks. Confirm with `tsc --noEmit` directly — this distinction caused at least one wrong verdict during this audit (see Alerts below).

Real (non-test) `tsc` failures include: `src/utils/visualization/data-transformations.ts` referencing a `VolumeV1.id` field that no longer exists on the type; `src/utils/monitoring/error-tracking.ts` importing `@sentry/react`/`@sentry/tracing`, neither installed; TanStack Query API drift in `query-persistence.ts`.

**MSW mocking is disabled app-wide** (`main.tsx:24`, "disabled for now to fix HMR stalling issues"). `mocks/handlers.ts` has zero effect on dev or prod behavior currently — any prior concern about mock-vs-real coverage gaps is moot unless/until MSW is re-enabled. If it is re-enabled, note one confirmed contract drift: `handlers.ts:257-262` nests pagination under a `pagination: {...}` object while `useVolumesList.ts:97-99` reads `total`/`page`/`page_size` from the response root — the volumes-list mock would silently return zero results.

Per-page verdicts:

| Page | Verdict | Note |
|---|---|---|
| Dashboard | Working | Real hooks, real computed metrics |
| VolumesPage / VolumesList | Working | Refactor genuinely finished and wired; two orphaned components (`VolumeStatusBadge`, `VolumeTrackingBadge`) built but never imported |
| ExplorerPage / DirectoryTree | Working (was Broken, now fixed) | Real infinite scroll/search; but `ExplorerPage.tsx:80` has a **second, unaddressed hardcoded limit** (`limit: 1000`, no pagination) — same bug class as the fixed one, just a different code path. Also: dead `if (false && loading)` and an inline `{console.log(...)}` running every render |
| TreeMapVisualization | Working | Pure presentational, fed real data; minor `// TODO: Connect to theme context`, debug `console.log` litter |
| SearchPage | Working | Genuinely calls real backend search; only flaw is 3 dead view-toggle buttons in shared `SearchInterface` (`onClick={() => {}}`) |
| **AlertsPage** | **Broken** | **Verified directly via `tsc`**: `import ... from '@/api/alerts'` — this module does not exist anywhere in the repo. Breaks compilation across 9 files (`AlertDestinations`, `AlertRules`, `AlertHistory`, and all their Create/Edit/Test modals). Where hooks are real, their return shape doesn't match what components destructure (e.g. `loading`/`fetchDestinations` expected, hook returns `isLoading`/`refetch`). The "Engine Status: Active" badge is also a static string, not derived from anything. |
| TrendsPage | Partial | Storage-growth chart and growth stats are real. File-type pie chart and capacity-forecast chart are permanently zeroed/empty (`useTrends.ts:71-72,143-144`, explicit TODOs). "42 days" forecast figure is a hardcoded literal. Export button is `console.log` + TODO, fully non-functional |
| OnboardingPage | Partial, silently so | Real wizard, real state machine, real POSTs to `/mounts`, `/rules`, `/tracking/apply`. Silently substitutes a hardcoded 19-mount `mockDiscovery` object whenever real discovery returns zero results or errors, with only a small yellow banner as a hint. The "preview" step never calls a real preview API — always client-side arithmetic guesswork, with a second hardcoded fallback if even that throws |
| Organizations / multi-tenant | Partial | Admin CRUD page is fully real. No end-user org-switcher exists anywhere — multi-tenancy today is "the one org your JWT says you're in," plus an admin-only management screen |

**Dead/orphaned components** (built, sometimes with their own internal `mockXxx` data, never imported by any live page): `AlertCenter`, `ExplorerView`, `ExplorerWithExport`, `VolumeCharts`, `DuplicateOverlay`, `AdaptiveExplorer`, `PrefetchedExplorer`, `CleanupWorkflow`, `TopNAnalysis`, `TimelineOverlay`, `UndoRollback`, plus the explicitly-deprecated `FileBrowser` (comment says so, and its import is broken if ever rendered). These aren't lying to users — they're not reachable — but they're dead weight worth deleting rather than fixing.

**Smaller confirmed gaps, not yet prioritized:** `HealthPage` has a literal "Coming Soon" badge; `LoginPage`'s password reset is a no-op (`console.log`); `UserProfilePage` has an unimplemented change-password TODO; admin `SystemSettingsPage`'s save button is a no-op; admin `AuditLogsPage` and `PermissionsPage` both render hardcoded mock arrays.

## Recommended order of work

None of this is new feature work — it's restoring the ability to trust the toolchain before building on it:

1. **Backend**: fix the 14 broken test packages (update mocks/signatures to match the refactored interfaces — mechanical) and the `docker_service.go:220` panic.
2. **Frontend**: fix the real `tsc` errors (`VolumeV1.id`, missing Sentry deps, TanStack Query drift) and diagnose why vitest hangs past file 5.
3. **Alerts**: create the missing `@/api/alerts` module (or fix the imports to point at wherever the types actually live now) and reconcile the hook/component contract mismatch across all 9 affected files.
4. **Decide on the silent-mock-fallback pattern** in OnboardingPage and TrendsPage — at minimum, surface to the user when they're looking at fake data instead of hiding it.
5. **Only then**: land the uncommitted Volumes/tracking work, delete the confirmed-dead Explorer components, and resume the README/docs credibility pass from earlier.
