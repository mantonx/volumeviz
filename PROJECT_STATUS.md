# VolumeViz — Project Status (Reality Check)

**Date:** 2026-07-10
**Context:** Supersedes the 2026-06-30 version of this document, most of which is now stale — the tooling/trust problems it flagged (broken backend tests, frontend `tsc` errors, a fully-broken Alerts module, a hanging test suite) have since been fixed. This revision is a fresh, code-grounded re-audit (direct `grep`/read against HEAD, not inference from old docs) plus two corrections to work done *during* that fix pass, described below. Treat this as current; supersede it the next time a real audit is done.

## Bottom line

The toolchain is trustworthy again: backend builds/vets/tests clean, frontend has zero real `tsc` errors, and the test-suite hang is understood and fixed at the config level (see caveat below). What's left is genuine feature-completeness work, not tooling debt. It falls into three groups: (1) two newly-real features with zero test coverage, (2) small dishonest-UI spots where the app silently shows fake data or fake success instead of surfacing "not implemented," and (3) deeper backend gaps (pagination limits, SQLite parity, resume-after-restart) that are real but lower urgency since they don't mislead anyone.

## A note on how this document stays honest

While fixing the frontend test suite this session, two tests were initially deleted because they asserted against UI that didn't exist in the current component (`SearchPage.tsx`'s "Find Duplicates" button, `VolumesPage.tsx`'s "Add Volume" button). Deleting a failing test to make the suite pass is exactly the failure mode this project needs to avoid — so both were investigated via git history before being finalized:

- **Duplicate detection** was real, silently deleted by an unrelated commit (`66208e3`, ostensibly about enrichment progress), and *had* real backend support that was itself never wired into the router. Both sides are now fixed for real: the backend route is registered (`internal/api/v1/router.go`), and `SearchPage.tsx` has a working `DuplicateDetectionModal.tsx` calling the real endpoint. See the Group 1 table below — it now needs tests.
- **"Add Volume"** was also real, silently deleted by an unrelated commit (`43a0af8`, ostensibly about volume size display), but investigation showed it doesn't correspond to any real backend capability (VolumeViz discovers Docker volumes; there is no create-a-volume endpoint) — and the actual equivalent, tracking an already-discovered-but-untracked volume, already exists and works today via `VolumeTable.tsx`'s per-row "Track Volume" action. No restoration needed; confirmed correct as-is.

A broader history scan for more instances of this "unrelated commit message masks a silent feature deletion" pattern found no other cases (see audit conducted this session — grep for the two commit hashes above if repeating this check later, and consider adding a rule against `--no-verify` / large unrelated diffs in bugfix commits going forward).

## Toolchain health

| Check | Result |
|---|---|
| `go build ./...` | ✅ Passes |
| `go vet ./...` | ✅ Passes |
| `go test ./...` | ✅ 30 packages pass, 0 failures (45 packages have no test files — mostly thin API handler packages) |
| `npx tsc --noEmit -p .` (frontend) | ✅ 0 real (non-test/story) errors |
| `npm run build` (Vite) | ✅ Passes (note: does not run `tsc` — always confirm type-correctness with `tsc --noEmit` directly, not build success) |
| Frontend test suite (vitest) | ⚠️ See caveat below |

**Vitest caveat:** the original hang (suite stopped making progress after ~5 of 42 files) had three distinct causes, all fixed:
1. `Toast.test.tsx` mixed `vi.useFakeTimers()` with `@testing-library/user-event` v14 without `shouldAdvanceTime: true`, making `user.click()` await forever.
2. `SearchPage.test.tsx` and `VolumesPage.test.tsx` had stale assertions (missing providers, asserting on removed/changed UI) that threw errors cascading into a JS heap OOM crash under load.
3. The real root cause of the OOM: Node's default ~4GB worker heap ceiling is too small for this app's combined test-suite module graph (recharts, the large orval-generated API client, many providers) when a worker's assigned batch of files includes several heavy ones. Not a memory leak — confirmed via `--logHeapUsage` showing each individual test using tens of MB while the worker's *total* process heap tracked the configured ceiling exactly.

Fix: `frontend/vitest.config.ts` now sets `maxWorkers` and `poolOptions.forks.execArgv` to raise the per-worker heap ceiling. This has needed adjusting more than once as different runs' worker/file assignment drew different worst-case combinations (4GB → 6GB → 10GB, `maxWorkers` 6 → 4) — the underlying module-graph weight is a real characteristic of this codebase, not fully eliminated, just given enough headroom. **If the suite OOMs again in the future, this is why — raise `execArgv`'s `--max-old-space-size` further or drop `maxWorkers`, don't assume a new leak.**

Separately, `src/test/integration/volume-management.test.tsx` fails 15/15 — unrelated to the hang. Uses `jest.fn()` (no `jest` global in vitest) and calls `http`/`HttpResponse` from `msw` without importing them, and several assertions target UI (bulk-scan dropdown, offline sync queue, an `org-stats` testid) that doesn't exist in the current app. This file tests an aspirational/legacy UI, not the current one — needs a rewrite, not a patch, if it's worth keeping.

## Group 1 — Real features, zero test coverage

Both of these are live, reachable, and working correctly by manual/code inspection — they just have no automated verification, which is a real risk given how easily this session found two *other* real features get silently deleted by unrelated commits with no test to catch it.

| Feature | Location | Note |
|---|---|---|
| Duplicate detection | `internal/services/duplicate_detector.go` (372 lines), `internal/api/v1/duplicates/handler.go` (340 lines) | Newly registered into the router this session. Zero `*_test.go` files for either. Content-hash and size-based detection, hash verification — real logic, untested. |
| Volume track/untrack UI | `frontend/src/components/domain/volumes/VolumeTable/` | Per-row dropdown "Track Volume"/"Untrack Volume", wired to real `usePostVolumesVolumeIdTrack`/`Untrack` mutations via `useVolumeRowActions.ts`. `find VolumeTable -name "*.test.*"` returns nothing. Also: `VolumeTableRow.types.ts:6` types `volume: any` with a TODO to use the real `VolumeV1` type. |

## Group 2 — Dishonest UI (shows fake data/success instead of "not implemented")

These don't crash anything, but they actively mislead a user into thinking something worked or is real when it isn't. Lowest engineering effort, highest trust cost — worth doing before the deeper backend work.

| Location | What it does now |
|---|---|
| `frontend/src/pages/LoginPage/LoginPage.tsx:203` | "Forgot password" click just does `console.log('Password reset not implemented')` — no error, no message, silent no-op from the user's perspective |
| `frontend/src/pages/UserProfilePage/UserProfilePage.tsx:15,49,54` | Change-password form submits to nothing; error message literally says "Change password feature is not yet implemented" — at least this one is honest, but the form shouldn't be there if so |
| `frontend/src/pages/admin/SystemSettingsPage/SystemSettingsPage.tsx:69` | Save button is `// TODO: Call API to save settings` — appears to save, doesn't |
| `frontend/src/pages/admin/AuditLogsPage/AuditLogsPage.tsx:18,77` | Renders a hardcoded `mockAuditLogs` array — every admin sees the same fake log entries regardless of real activity |
| `frontend/src/pages/admin/PermissionsPage/PermissionsPage.tsx:49,157` | Same pattern — hardcoded `mockRoles` array, not real permission data |
| `frontend/src/pages/OnboardingPage/OnboardingPage.tsx:272,352-353,359-360,472,482,488,497` | Silently substitutes a hardcoded 19-mount fake discovery result whenever real mount discovery returns zero results or errors (small yellow banner is the only hint); the "preview" step never calls a real API, always client-side arithmetic |
| `frontend/src/pages/TrendsPage/TrendsPage.tsx:145-147` | Export button does `console.log(...)` only |
| `frontend/src/components/domain/explorer/AlertCenter/AlertCenter.tsx:180,185` | Acknowledge/resolve buttons on live, reachable alerts are stubs — clicking them does nothing persistent |

## Group 3 — Deeper backend gaps (real, lower urgency)

These are genuine missing functionality but fail loudly/obviously (empty results, errors) rather than lying — lower priority than Group 2.

| Area | Gap | Location |
|---|---|---|
| Volume discovery | Hardcoded to first 1000 volumes, no pagination past that | `internal/services/filesystem/volume_discovery.go:231` |
| Scan resume | `FindResumableScans` always returns empty — scans can't resume after a restart | `internal/services/scanner/resume.go:129-146` |
| Volumes repo | `CreateContainer`/`CreateVolumeMount` unimplemented on both Postgres and SQLite | `internal/repo/volumes_repo.go:346-347,466-468,780-798` |
| Search | Saved-search result handling stubbed (4 spots); suggestion search unimplemented | `internal/api/v1/search/saved.go`, `suggestions.go:88` |
| Alerts | `RuleID` hardcoded to 0 when recording deliveries | `internal/repo/alerts_repo.go:492` |
| Orgs | User counts hardcoded to 0 | `internal/repo/organizations_repo.go:76-77` |
| Retention | 5 TODOs — pruning logic incomplete | `internal/services/lifecycle/retention.go` |
| WebSocket | Scan-result/snapshot events broadcast with empty payloads | `internal/realtime/broadcaster.go:440,678-697` |
| SQLite | Still a facade — no orgs/users/checkpoints/snapshots support, migrations unimplemented | `internal/store/store_sqlite.go`, `internal/migrate/migrate.go:45-46` |
| Auth | Session tracking is fake (`SessionID: "jwt-gen"`) | `internal/services/auth/auth_service.go:231` |
| Explorer | Hardcoded `limit: 1000` (no pagination past that); dead code (`if (false && loading)`); stray debug `console.log` in JSX | `frontend/src/pages/ExplorerPage/ExplorerPage.tsx:80,286,565` |
| Trends | File-type pie chart and capacity-forecast chart permanently empty; "42 days" forecast is a hardcoded literal | `frontend/src/hooks/useTrends.ts:71-72,143-144`, `TrendsPage.tsx:322` |
| Multi-tenant | No end-user org switcher exists anywhere — only an admin CRUD screen | n/a |
| Mount catalog | 7 TODOs — attachment/orphan-detection/search logic incomplete | `internal/services/docker/mount_catalog_service.go` |
| Scan handler | `recent_scan_errors`/`active_scans` DB views don't exist; feature disabled as a result | `internal/repo/scan_progress_repo.go:724,1111`, `internal/api/v1/scan/handler.go:1532` |
| Previews/Mounts APIs | Delete/update endpoints explicitly return "not yet implemented" | `internal/api/v1/previews/handler.go:352-355`, `internal/api/v1/mounts/handler.go:369-371` |

## Confirmed already fixed (no longer accurate to call these gaps)

- Alerts module — fully real now (was completely broken, missing `@/api/alerts` module)
- `VolumeStatusBadge`/`VolumeTrackingBadge` — wired into `VolumesListFilters`/`VolumesListStats`, no longer orphaned
- `ExplorerView`/`VolumeCharts` — rewired to real backend API, no longer dead/fake-stub components
- Audit logging — genuinely persists now via `internal/audit`'s `DefaultLogger`, wired in `router.go:363`
- Preview generation's `CanGeneratePreview`/`GetSupportedTypes` — no longer contradicts its own tests
- ~160 files of confirmed-dead frontend code (an abandoned visualization subsystem, duplicate/legacy components) — deleted

## Recommended order of work

1. **Group 1**: write tests for duplicate detection (backend) and volume track/untrack (frontend) — these are the highest-risk gap, since this session proved untested real features get silently deleted.
2. **Group 2**: either implement or explicitly gate off (disabled button + tooltip, not a working-looking no-op) each dishonest-UI spot — cheap fixes, high trust payoff.
3. **Group 3**: prioritize by what's actually blocking real usage — pagination limits and scan-resume-after-restart are probably more load-bearing than SQLite parity if Postgres is the only backend actually deployed.
4. Fix or rewrite `src/test/integration/volume-management.test.tsx` (currently 15/15 failing, tests a UI that no longer exists) once Group 1/2 work stabilizes what it should actually assert against.
