# Scan Progress Display - Critical Issues Summary

**Date**: 2025-10-10
**Status**: 🔴 Multiple critical issues identified
**Impact**: User trust in metrics is severely damaged

---

## 🚨 Critical Issues (Fix Immediately)

### 1. Impossible Throughput Values
- **Shows**: 6,304 items/sec
- **Reality**: Should be 5-50 items/sec
- **Impact**: **Destroys user trust**
- **Root Cause**: `phase_started_at` is NULL in database

### 2. Progress Oscillating/Jumping
- **Example**: Filesystem Indexing jumps **65% ↔ 70%** repeatedly
- **Impact**: Creates perception of broken/unstable system
- **Root Causes**: Race conditions, multiple update sources, no debouncing

### 3. Phase Timing Data Missing
- **Database**: `phase_started_at` = NULL for most phases
- **Impact**: All time-based metrics are wrong (throughput, remaining time, elapsed)

---

## ⚠️ High Priority Issues

### 4. Wrong Overall Progress
- **Shows**: 89%
- **Should Be**: 80%
- **Cause**: Old backend calculation not deployed

### 5. PhaseIndicator Shows Wrong Percentage
- **Shows**: 70% (from stale `progress_percent` field)
- **Should Show**: 100% (14,433/14,433 items complete)
- **Cause**: Using wrong database field

### 6. No Visual Progress Bar in Phase Summary
- **Shows**: Just "Filesystem Indexing 75%" (text only)
- **Should Show**: Text + visual mini progress bar

---

## 📝 Medium Priority Issues

### 7. Long File Paths Not Truncated
- **Shows**: `.../Tom Jones (1963)/Tom Jones (1963) [imdbid-tt0057590] - [Remux-1080p][FLAC 1.0][AVC]-EPSiLON.mkv`
- **Should Show**: `.../EPSiLON.mkv`

### 8. Duplicate "Remaining" Time
- Shows in two places (top stats + phase detail)

### 9. Confusing Phase Summary
- No status icons (✅ ⚙️ ❌)
- Shows incomplete phases without context

### 10. Remaining Time May Be Off
- Shows 1m 45s, calculation suggests should be ~40-90s
- Hard to verify until throughput is fixed

---

## 🎯 Quick Wins (Easy Fixes)

1. **Hide filesystem indexing from phase summary** (it's 100% done)
2. **Add progress bar to PhaseIndicator component**
3. **Use `phase_progress_percent` instead of `progress_percent`**
4. **Truncate file paths better**
5. **Remove one of the duplicate "remaining" times**

---

## 🔧 Root Cause Fix (Solves Multiple Issues)

**Fix `phase_started_at` being NULL**:
- File: `internal/repo/scan_progress_repo.go`
- Method: `CreateScanPhase`
- Change: Set `started_at = NOW()` when phase begins

This single fix will solve:
- ✅ Impossible throughput values
- ✅ Missing elapsed time
- ✅ Wrong remaining time estimates
- ✅ Better per-phase metrics

---

## 📊 Current vs Expected State

| Metric | Current (Wrong) | Expected (Right) |
|--------|----------------|------------------|
| Overall Progress | 89% | 80% |
| Filesystem Progress | 70% (oscillating) | 100% (complete) |
| Media Throughput | 6,304 items/sec | 30-50 items/sec |
| Remaining Time | 1m 45s | ~40-90s (TBD) |
| Progress Stability | Jumping constantly | Smooth, monotonic |

---

## 📋 Implementation Priority

**Phase 1 (Critical):**
1. Fix `phase_started_at` NULL issue
2. Fix throughput calculation
3. Add progress debouncing/smoothing
4. Deploy new backend with hybrid calculation

**Phase 2 (High):**
5. Fix PhaseIndicator to show correct percentage
6. Add visual progress bars
7. Hide completed phases
8. Better file path truncation

**Phase 3 (Polish):**
9. Remove duplicate times
10. Add status icons
11. Add validation
12. Comprehensive testing

---

## 🔍 Edge Cases & Missing Scenarios

### Scan Lifecycle States
- ✅ **Running**: Currently showing (with issues)
- ❓ **Completed**: What does UI show? Does it auto-dismiss?
- ❓ **Failed**: How are failures displayed? (DB shows "Scan job marked as stale")
- ❓ **Paused**: Can users resume? Is pause state clear?
- ❓ **Cancelled**: Can users cancel? What feedback is shown?

### User Actions Missing
- ❌ **No Cancel button** - Users stuck watching a scan they want to stop
- ❌ **No Pause button** - Can't pause a long-running scan
- ❌ **No "View Details" expand/collapse** - Always showing full detail
- ❌ **No "Copy current file path" button** - Useful for debugging
- ❌ **No error log viewer** - When files fail, users can't see why

### System State Issues
- ❓ **Stale scan detection**: Previous scan failed due to "no heartbeat" - does UI show this?
- ❓ **Backend restart recovery**: Paused scan says "Scheduler restart" - does scan resume?
- ❓ **Multiple scans**: What if user triggers scan on another volume?
- ❓ **Network disconnection**: What if WebSocket drops? Does UI show "Disconnected"?

### Performance & Polish
- ❓ **Memory leak check**: Are old scan progress updates cleaned up?
- ❓ **Update frequency**: Getting updates too fast? Should throttle?
- ❓ **Mobile view**: Does this layout work on phones/tablets?
- ❓ **Dark mode**: Are all colors/contrasts good in dark mode?

### Data Persistence
- ❓ **Page refresh**: If user refreshes, does scan progress restore?
- ❓ **Browser back/forward**: Does progress state survive navigation?
- ❓ **Multiple tabs**: If user opens 2 tabs, do both show progress?

### Error Recovery
- ❓ **Partial failures**: If 10 files fail out of 10,000, is that shown?
- ❓ **Retry logic**: Can users retry failed items?
- ❓ **Error details**: Are technical errors hidden from non-admin users?

### Notifications
- ❓ **Browser notifications**: When scan completes, does browser notify?
- ❓ **Sound/visual cue**: Any feedback when scan finishes?
- ❓ **Email notification**: For long scans, send email when done?

## ✅ What's Working Well

1. **Visual hierarchy** - Clear separation of sections
2. **Status icons** - Good use of icons for phases (✓, ⚙️)
3. **Real-time updates** - WebSocket connection is working
4. **Item counts** - Showing processed/total is helpful
5. **File currently processing** - Users can see activity

## 🎯 Minimum Viable Fix (MVP)

To restore user trust quickly, fix just these 3 things:

1. **Fix phase_started_at** → Fixes throughput, elapsed, remaining time
2. **Stop progress oscillation** → Add debouncing/smoothing
3. **Hide completed phases** → Show only what's actually running

These 3 fixes will make the display **functional and trustworthy** again.

## 📖 Full Documentation

See: [scan-progress-accuracy-fix.md](./scan-progress-accuracy-fix.md)
