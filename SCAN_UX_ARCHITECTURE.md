# Volume Scan UX: Current Architecture, What's Broken, and What to Change

**Date:** 2026-07-12
**Scope:** How a user triggers a volume scan from `/volumes`, and how the system tells them what happened. Not a general `/volumes` page refactor — see `VOLUMES_PAGE_REFACTOR_PLAN.md` for component-organization concerns, which is a different, older effort.
**Origin:** Live Playwright walkthrough of scanning a real CIFS-mounted TV-shows volume, then traced to root cause in the actual code (file:line citations below, not guesses).

---

## 1. The three things a "scan" actually is

A single user action ("scan this volume") fans out into three independent backend phases, each with its own progress tracking, each capable of succeeding or failing independently:

1. **Volume size scan** (`internal/services/scanner/volume_scanner.go` → `Walker`, `internal/services/scanner/walker.go`) — parallel work-stealing tree walk, computes total size/file count/dir count. Fast (~11-18s on a real 93K-file CIFS share, per this session's own benchmarking).
2. **Filesystem indexing** (`internal/services/filesystem/incremental_walker.go` → `IncrementalWalker`) — a *separate* walk that persists per-file/per-folder rows to Postgres for search/browse/stats. Triggered *after* phase 1 completes, not part of it.
3. **Media enrichment** (`internal/services/enrichers/`) — ffprobe/exiftool/thumbnail generation, triggered after phase 2, operates on already-indexed rows.

The frontend surfaces this as one progress bar with three named sub-phases ("Filesystem Indexing", "Media Enrichment" visible in the expanded row), which is the right level of abstraction for a user — but the three phases are wired together by a chain of `SafeGo` fire-and-forget goroutines with no shared failure signal, which is where several of the bugs below come from: **a failure in phase 1 or a skip in the phase-1→phase-2 handoff produces no distinguishable symptom from a phase that's still running.**

---

## 2. How a scan actually gets triggered, and why one path is broken and one isn't

Two different UI actions exist, and they go through **two different code paths** with different bugs:

### Per-row "Scan Volume" — broken, silently

`frontend/src/hooks/api/useVolumeOperations.ts:88-95`:
```ts
scanVolume: {
  mutateAsync: async (volumeId: string) => {
    if (isOnline) {
      const response = await fetch(`/api/v1/volumes/${volumeId}/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
```
This is a **hand-written raw `fetch()`** with no `Authorization` header. Every other mutation in the same file (`filesystemIndexMutation`, `bulkScanMutation`, both a few lines above) is an Orval-generated hook that goes through `frontend/src/api/fetch-client.ts:58-63`, which reads `localStorage.getItem('auth_token')` and attaches `Authorization: Bearer <token>` automatically. This one call site simply never entered that path. Result, reproduced live: **every single-volume scan click returns 401 "Authorization header required."**

It gets worse silently: `VolumeCard.tsx:37-40` and `VolumeTable.tsx:261` both call `scanVolume.mutateAsync(volume.id)` with **no try/catch**. The 401 becomes an unhandled promise rejection. Nothing in the UI reacts to it — no toast, no row state change, no entry in the notification panel (which, when checked live right after the failure, said *"No firing alerts, active scans, or recent errors"*, actively contradicting what just happened).

### Bulk "Scan All" — actually works

`bulkScanMutation` (`useVolumeOperations.ts:70-76`) uses `usePostApiV1VolumesBulkScan`, the generated hook, correctly authenticated. Live-tested: `POST /api/v1/volumes/bulk-scan` → `202`, real `scan_ids` returned for all 14 volumes. This path also has a real UX nicety the single-scan path lacks entirely: a confirmation dialog (`"Confirm Bulk Scan"`) showing volume count, known size, and method before committing.

**The fix here is small and mechanical** — delete the hand-written `fetch()` and route single-volume scan through the same generated-hook pattern everything else uses (there's likely already a `usePostApiV1VolumesIdScan` generated hook sitting unused, given the Orval spec almost certainly covers this route the same way it covers bulk-scan and filesystem-index). This is not a design question, it's a one-file bug.

---

## 3. What happens after a scan starts, and where feedback dies

### 3a. Live progress: the intended design is right, the transport is what's broken

The intended architecture, and it's a good one:

- `ProgressManager` (size-scan side, `internal/services/scanner/progress_manager.go`) and `ProgressTracker`/`ProgressThrottler` (indexing side, `internal/services/filesystem/progress_tracker.go:45-126`) both compute a percentage and push it toward a WebSocket broadcaster.
- Both are **already throttled at the source** — `Walker.Scan`'s progress callback caps at 1/sec (`walker.go:225-241`, mutex-protected), and `ProgressTracker.QueueProgressUpdate` caps WebSocket broadcasts at 1/sec too, with an explicit comment marking it as a deliberate prior fix (`progress_tracker.go:102-110`: *"FIX: Throttle broadcasts to max 1 per second with mutex protection to prevent race condition spam"*).
- On the frontend, `RealtimeProvider`/`WebSocketProvider` relay these over `react-use-websocket`, and a component renders "Scanning X — N% — phase" from them.

**What's actually broken:** live-tested, the progress row froze at "0% Initializing scan..." for the entire scan duration, and the console logged **187 "Maximum update depth exceeded" React errors**, one per incoming message, traced to `webSocketInstance.onmessage → protectedSetLastMessage → flushSync` — entirely inside `react-use-websocket`'s own internals, not this app's message-handling code. This is not new: it's documented twice already as unresolved in `FIXES.md` (item 9b's follow-up note, and again at `FIXES.md:202`), both times flagged as "worth a dedicated investigation," never fixed. Since both progress sources are already throttled to ~1 message/sec each (≤2/sec combined), this isn't a burst problem — it's a sustained-connection problem that a short-lived test wouldn't reliably reproduce, and a real 14-volume bulk scan running for two minutes reliably does.

**This needs to be picked up as its own investigation**, not folded into a general scan-UX pass — it's a library-internals bug with two independent flags already on record asking for exactly that.

### 3b. Post-scan refetching: two triggers, no coordination, and it rate-limits itself

`VolumesList.tsx:60-69`, after a bulk scan starts:
```ts
let pollCount = 0;
const pollInterval = setInterval(() => {
  pollCount++;
  refetch();
  if (pollCount >= 15) clearInterval(pollInterval);
}, 2000);
```
A hardcoded, unconditional 2-second poll for 30 seconds, with **no backoff and no early-exit once all scans actually complete** — it just runs its full 15 iterations regardless.

Independently, `VolumesPage.tsx:35-53` invalidates the same `['/api/v1/volumes']` query on *every* WebSocket `onSizeUpdate`/`onMetadataUpdate` message, no debounce. Layered on top of the 2s poll during an active bulk scan, this reliably produces the **28+ straight `429 Too Many Requests`** observed live — the app's own scan-progress-refresh mechanism trips its own backend rate limiter. Like the auth bug, this produces zero visible symptom: the UI just... doesn't update, and nothing tells the user why.

This is a coordination gap, not a hard problem: there should be exactly one source of truth for "should I refetch the volumes list right now" during an active scan (ideally the WebSocket `scan.completed` event alone, since that's already the more precise signal — `onScanProgress`'s existing `event.status === 'completed'` handler at `VolumesPage.tsx:47-50` is *already correct* and makes the blind interval poll redundant, not complementary).

### 3c. The data itself can go stale with zero indication — the most serious bug found

`internal/services/scanner/volume_scanner.go:306-311`:
```go
func (vs *VolumeScanner) ScanVolume(ctx context.Context, volumeID string) (*interfaces.ScanResult, error) {
	// Check cache
	if result := vs.cache.Get(volumeID); result != nil {
		vs.metrics.CacheHit(volumeID)
		...
		return result, nil
	}
```
A cache hit returns **before** the code that triggers filesystem indexing (`performFilesystemIndexing`, called at lines 470-479 and 547-555, only reachable past this early return). Cache TTL (`scan_utilities.go:216-228`) scales **up** with volume size — over 100GB gets 2x the base TTL. So the largest, most CIFS-latency-costly volumes (exactly the ones where an accurate index matters most) get the longest window in which a "scan" request is a silent no-op for indexing purposes.

Reproduced live and confirmed in Postgres directly: after a real bulk-scan run where every log line indicated success (`Incremental scan complete ... files=93351`), the `tv_shows_dev` volume's `files` table row count was untouched — still 764, stale from a much earlier partial run — because this volume's cache was still warm from a scan moments earlier in the same test session. The size-scan result was cached and returned instantly; the indexing trigger, gated behind the cache-miss branch, never ran. No error, no log line resembling a skip, nothing in the UI.

**This is the one finding in this document that's a genuine data-correctness problem, not just a feedback gap** — a user can trigger a scan, see (once 3a is fixed) a completed progress bar, and still be looking at data that's a scan or two behind reality, with the system fully convinced everything worked.

---

## 4. What the notification/status surface should actually mean

Live-tested: the notification bell's panel text is `"Nothing to report right now" / "No firing alerts, active scans, or recent errors"`. This is a **static, hardcoded string** — it doesn't reflect real state, since it said this immediately after a real scan failure. Before building anything new on top of the existing progress pipeline, this panel needs to actually query real state (active scan jobs, recent scan-job failures from `scan_jobs`/`scan_phases` tables, which already exist and are already written to) rather than assert a fixed sentence regardless of what just happened. This is the single highest-leverage fix for "does the UI give enough feedback" — every other finding above is invisible specifically *because* this is the one surface a user would naturally check, and it's currently decorative.

---

## 5. Design principles for the fix, derived from the above (not a fresh proposal — these fall out directly of the actual breakage found)

1. **One trigger path, not two.** Single-volume and bulk scan must go through the same authenticated client mechanism. There is no reason for a hand-written `fetch()` to exist next to a working generated-hook pattern.
2. **Every mutation needs a user-visible failure path.** A `.catch()` that shows a toast is the floor, not a nice-to-have — right now a 401, a 429, and a silently-skipped indexing trigger are all equally invisible to the user, which is a worse experience than a scan that visibly fails.
3. **One refetch trigger, driven by the most precise signal available.** The WebSocket `scan.completed`/`scan.failed` events are already correct and already wired (`VolumesPage.tsx:47-50`); the blind interval poll is redundant defensive code that actively causes harm (rate-limiting) without adding coverage the WebSocket path doesn't already provide. Remove the poll, keep the event-driven refetch, and only add a *bounded* fallback poll (e.g., one retry at 10s if no completion event arrived) rather than a continuous one.
4. **Cache correctness must not be a silent tradeoff against indexing correctness.** A scan-result cache hit is a legitimate optimization for *size*, but it should never silently gate whether indexing runs. At minimum, the indexing-trigger check needs to be decoupled from the size-scan cache branch (e.g., check "is this volume's index stale" independently of "is this volume's size-scan result cached") rather than being downstream of a `return` that has nothing to do with indexing.
5. **Status surfaces must reflect real state or not exist.** A hardcoded "nothing to report" string is worse than no notification panel at all, because it actively tells the user the opposite of what's true.
6. **The `react-use-websocket` render-loop bug is a standalone blocker for #2's "visible failure" principle being fully realized**, since a live progress UI that can't render is functionally the same as no progress UI. It should be scheduled as its own fix, using the same live-instrumented-capture method that worked for the previous, similar bug in `FIXES.md` item 9b (a `WebSocket` constructor proxy logging real traffic, not just reading source).

---

## 6. Suggested order of attack

1. Fix single-scan auth (small, mechanical, unblocks real testing of everything downstream of it).
2. Make the notification panel real (highest leverage for "does the user know what's happening" across every other finding).
3. Decouple the indexing trigger from the size-scan cache hit (the one real data-correctness bug).
4. Collapse the two refetch triggers into one, event-driven, with a bounded fallback.
5. Dedicated investigation into the `react-use-websocket` infinite-render bug (already flagged twice; needs to actually get picked up rather than flagged a third time).

---

## 7. Live re-walk after the fixes (2026-07-12) — verification + what the re-walk newly surfaced

All six items above were implemented, then re-observed live with Playwright on a fresh page load (no reasoning from the pre-fix notes). The point of a *re*-walk was that unit tests can't prove the two hardest findings (§3a render loop, §3b refetch storm) — those are sustained-connection behaviors. Both were re-triggered under the exact conditions that reproduced them originally (a real 14-volume bulk scan).

### 7a. What the re-walk confirmed fixed (live, not just in unit tests)

- **§2 single-scan auth** — `POST /api/v1/volumes/volumeviz_tv_shows_dev/scan` now returns **202 Accepted** (was 401). The kebab-menu "Scan Volume" action, which used to fail silently, works end-to-end.
- **§4 notification panel** — the bell now reads *"Scanning volumeviz_tv_shows_dev"* — real active-scan state — where it previously showed the hardcoded *"No firing alerts, active scans, or recent errors"* immediately after a failure. Confirmed the panel is genuinely multi-source now (active-scans query + the client error/warning trace wired via the toast system).
- **§3a render loop** — **0 console errors** across a fresh single scan + a full 14-volume bulk scan + 14s of sustained WebSocket progress traffic. The 187 "Maximum update depth exceeded" errors visible in `all: true` console history are pre-fix residue from the *previous* session (they point at the old `useVolumeOperations.ts` raw fetch and an unrelated `AdminOrganizationsPage` ReferenceError); the since-navigation console is clean.
- **§3b refetch storm** — after bulk-scan (202), exactly **one** debounced pair of `/volumes` refetches fired (page_size=100 + page_size=25, the two mounted queries), and it stayed at one pair 14s later. **Zero 429s**, versus the original "28+ straight 429 Too Many Requests."

### 7b. New design findings the re-walk surfaced (independent of the six bugs — NOT yet addressed)

These are design/IA issues, not regressions from the fixes. They're the "is this the right thing?" layer the original forensics doc never reached:

1. **The size/files phase split leaks into the table.** Several rows show Size = "—" but a real file count (e.g. `volumeviz_tv_shows_dev`: "—" size, "2,044 files"; `volumeviz_movies_dev`: "—" size, "1,733 files"). This is §1's three-phase model bleeding through the UI: phase-2 indexing populated a file count while phase-1 size is absent. To a user it reads as "why does it know the file count but not the size?" — the phases' independence is a backend implementation detail that shouldn't be user-visible as an inconsistency.

2. **Two different volume counts on one screen.** The left nav + Quick Stats say **72** ("Volumes 72", "Total Volumes 72"), while the page's own stat strip says **14** ("Total Volumes 14 across all pages"). Same noun, two numbers, no explanation of the difference (system-volume filtering / org scoping is the likely cause, but it's invisible). This is a trust problem before it's a UX one.

3. **Per-row scan is buried in a kebab (⋮) menu.** The primary action on this page — scan a volume — is behind `MoreVertical` → "Scan Volume", one click deep and invisible until opened. The Actions column header exists (`sr-only`) but the column reads as empty at a glance. Contrast the bulk path, which has a prominent "Scan All" button *and* a genuinely good confirmation dialog (volume count, "Known size: 9.87 GB (10/14 volumes)" with honest coverage disclosure, method, background-scan reassurance). The single-scan path has neither affordance nor confirmation — inverted discoverability for what should be the more common action.

   **→ ADDRESSED (2026-07-12).** Scan is now a directly-visible icon button in the Actions cell, revealed on row `hover`/`focus-within` (kept mounted for keyboard/screen-reader reach); the kebab retains only secondary actions (track, details, delete). Confirmation for the *single*-scan path is still a possible follow-up — right now only bulk confirms.

   **→ Also addressed the deeper visibility gap you can't see the four findings above:** live scan progress was only visible after twirling a row open. Root cause was architectural, not cosmetic — progress is one global WebSocket atom (table-wide), but the only renderer was expanded-row-deep, AND the collapsed row's "Scanning…" was driven by the *stale* REST `scan_status` rather than the live atom. Fixed by `useVolumeScanState` (live atom authoritative, REST fallback) feeding both the Files cell (now shows live "Scanning N%") and a new full-width hairline `VolumeRowProgressBar` under each active row (blue while scanning → green flash on completion). No transport change — pure rendering + a single-source-of-truth cleanup.

---

## 8. Scan-progress backend unification (2026-07-12) — the bar was jumping

Once the bar was *visible* (§7), it was observed to **jump backward** mid-scan. Investigation (mapped exhaustively before touching code) found the cause was not a rendering glitch but deep fragmentation in how progress was reported:

- **8 different "overall progress" computations**: three different phase-weight tables (`0.1/0.8/0.1`, `0.15/0.70/0.15`, item-complexity `1/1/2`), two naive `sum/count` averages, a global item-ratio, and a SQL-view column. `progress_manager.go` even computed a weighted value then *overwrote* it with a naive average before broadcasting — a file disagreeing with itself.
- **2 broadcast trigger paths**: the size-scanner broadcast from its **in-memory** map (naive average); everything else (filesystem indexer, enrichers, scheduler) broadcast **DB-sourced** through a *different* naive average. Interleaving these for the same scan made the number oscillate and spammed the frontend's monotonic guard (146 warnings/scan).
- **3 different wire payload shapes** for the same `scan.progress` message.

**Fix (full unify, in one pass):**
1. **One canonical aggregation** — `internal/models/scan_progress_aggregate.go`: `OverallProgress(phases)` weighted by `models.PhaseWeights` (0.15/0.70/0.15, filesystem indexing is the long pole), status-aware, with unit tests including the exact regression (adding/handing-off a phase must not drop the bar). Every emitter — broadcaster, size-scanner, REST handler, repo `GetActiveScans` — now calls it. All duplicate weight tables and naive averages deleted.
2. **One broadcast path** — the size-scanner stopped broadcasting from its in-memory map (`ProgressManager.broadcastProgress` is now a deliberate no-op); all `scan.progress` messages originate from the single DB-sourced `VolumeScanner.broadcastComprehensive` → `BroadcastComprehensiveScanProgress`, giving one wire shape and one source of truth.
3. **Honest logging** — the frontend monotonic guard's per-message `console.warn` ("violation") is now `console.debug` ("out-of-order coalesced"), since absorbing out-of-order delivery is the guard working, not an error.

**Verified live (14-volume bulk scan, sampled per-volume every 400ms):** `0` backward drops across all volumes (was routinely 20–40-point drops), progress advances monotonically (e.g. a volume climbed 15→85), `0` console errors, and scan-progress warnings went **146 → 0**. Go build + full test suite green.

Known deliberate trade: `volume_scan` (the short 0.15-weight first phase) is broadcast at its lifecycle transitions rather than continuously, so the bar can step 0→15 rather than sweeping it — acceptable given it's brief and the 0.70-weight indexing phase (the long pole) retains fine DB-backed granularity. `GetScanSummary`'s item-ratio formula was left as-is because it is **dead code** (zero callers) — noted rather than "unified" to avoid touching unused paths.

4. **Success feedback is transient-only.** A successful scan trigger (202) fires a success toast that auto-dismisses; there's no durable trace of "you started a scan" the way errors now have one in the bell. Fine for a single scan; worth reconsidering once a user triggers several and wants to know which are in flight.

**Recommendation:** finding #1 (phase-split leak) and #2 (count mismatch) are the two worth a design decision, because they're *correctness-of-meaning* issues — the UI is telling the user something confusing or contradictory. #3 and #4 are affordance refinements. None are urgent regressions; the six original bugs are all confirmed fixed live.
