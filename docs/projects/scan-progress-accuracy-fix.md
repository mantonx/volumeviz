# Scan Progress Accuracy Fix - Project Plan

## Problem Statement

The scan progress calculation is confusing and inaccurate for end users. Multiple issues exist:

### Current Issues

1. **Inconsistent Overall Progress**: Database shows 98% overall but phases show:
   - Volume Scan: 100% (completed)
   - Filesystem Indexing: 30% (running)
   - Media Enrichment: 98% (running)

2. **Incorrect Weighting**: Backend uses fixed weights:
   - Volume scan: 10%
   - Filesystem indexing: 80%
   - Media enrichment: 10%

   This means even when media enrichment is 98% done, overall shows ~28% (10% + 24% + 9.8%)

3. **Multiple Sources of Truth**:
   - Backend calculates progress via `calculateOverallProgress()`
   - Database stores `progress_percent` in `scan_phases` table
   - Frontend receives progress via WebSocket
   - These don't always match!

4. **Phase Progress vs Phase Status**: Phases can show 100% items processed but status stays "running"

## Current Architecture

### Data Flow
```
Filesystem Indexer → Scanner (calculatePhaseProgress)
                  ↓
            Scanner (updatePhaseInDB)
                  ↓
            scan_phases table
                  ↓
      scan_progress_summary view
                  ↓
            WebSocket broadcast
                  ↓
            Frontend display
```

### Phase Weighting (Current)
```go
weights := map[string]float64{
    "volume_scan":         0.1,   // 10%
    "filesystem_indexing": 0.8,   // 80%
    "media_enrichment":    0.1,   // 10%
}
```

## Analysis

### What Each Phase Does

1. **Volume Scan** (Quick):
   - Queries Docker API for volume metadata
   - Gets mount point, driver, size estimate
   - Takes <1 second typically
   - **Should be: ~1% of total work**

2. **Filesystem Indexing** (Medium):
   - Walks entire directory tree
   - Counts files, measures sizes
   - Inserts file metadata into database
   - Takes minutes for large volumes
   - **Should be: ~40-50% of total work**

3. **Media Enrichment** (Slow):
   - Processes media files (videos, images, audio)
   - Extracts metadata (EXIF, ffprobe, etc.)
   - Generates thumbnails/previews
   - CPU/IO intensive
   - **Should be: ~40-50% of total work**

### Actual Time Distribution (from current scan)
- Volume scan: completed instantly (~0%)
- Filesystem indexing: 4,330 / 14,433 files (30%)
- Media enrichment: 9,000 / 9,152 files (98%)

## Proposed Solution

### Strategy 1: Dynamic Weighting Based on Item Counts

Instead of fixed weights, calculate based on actual work:

```go
func (vs *VolumeScanner) calculateOverallProgress(phases map[string]*interfaces.PhaseInfo) float64 {
    // Get total items across all phases
    var totalItems int64
    var processedItems int64

    for _, phase := range phases {
        totalItems += phase.ItemsTotal
        processedItems += phase.ItemsProcessed
    }

    if totalItems == 0 {
        return 0.0
    }

    return float64(processedItems) / float64(totalItems)
}
```

**Pros:**
- Accurate: reflects actual work done
- Self-adjusting: works for any volume size
- Simple to understand

**Cons:**
- Assumes all items are equal weight (they're not - media files are heavier)
- Doesn't account for phase complexity

### Strategy 2: Time-Based Weighting

Weight phases based on historical average durations:

```go
weights := map[string]float64{
    "volume_scan":         0.01,  // 1% - typically <1s
    "filesystem_indexing": 0.49,  // 49% - file counting
    "media_enrichment":    0.50,  // 50% - media processing
}
```

**Pros:**
- Reflects real-world time distribution
- Simple implementation

**Cons:**
- Fixed weights may not fit all scenarios
- Doesn't adapt to volume characteristics

### Strategy 3: Hybrid Approach (RECOMMENDED)

Combine item counts with phase-specific weights:

```go
func (vs *VolumeScanner) calculateOverallProgress(phases map[string]*interfaces.PhaseInfo) float64 {
    // Phase weights based on typical complexity
    complexityWeights := map[string]float64{
        "volume_scan":         1.0,    // Simple
        "filesystem_indexing": 1.0,    // Medium
        "media_enrichment":    2.0,    // Heavy (2x more work per item)
    }

    var totalWeightedItems float64
    var processedWeightedItems float64

    for phaseName, phase := range phases {
        weight := complexityWeights[phaseName]
        if weight == 0 {
            weight = 1.0
        }

        totalWeightedItems += float64(phase.ItemsTotal) * weight
        processedWeightedItems += float64(phase.ItemsProcessed) * weight
    }

    if totalWeightedItems == 0 {
        return 0.0
    }

    return processedWeightedItems / totalWeightedItems
}
```

**Pros:**
- Adapts to actual item counts
- Accounts for per-item complexity
- Intuitive for users

**Cons:**
- Needs tuning of complexity weights

## Implementation Plan

### Phase 1: Fix Backend Calculation ✓ (Already Done)
- [x] Fix `calculatePhaseProgress()` to use actual item counts
- [x] Add `ItemsTotal` field to `PhaseInfo`
- [ ] Fix `calculateOverallProgress()` with hybrid approach

### Phase 2: Frontend Improvements
- [x] Remove flickering (WebSocket handler fix)
- [x] Hide completed phases from detail view
- [x] Better file path truncation
- [ ] Show phase percentages clearly
- [ ] Add overall progress explanation tooltip

### Phase 3: Database Consistency
- [ ] Ensure `progress_percent` in database matches calculation
- [ ] Add database trigger to auto-calculate overall progress
- [ ] Add validation to prevent inconsistent states

### Phase 4: User Experience
- [ ] Clear progress labels ("30% of files indexed, 98% of media processed")
- [ ] Show estimated time remaining per phase
- [ ] Add "What's happening now?" explanation text
- [ ] Consider showing both "items complete" and "estimated time" percentages

### Phase 5: Testing & Documentation
- [ ] Test with various volume sizes
- [ ] Document progress calculation in code comments
- [ ] Add user-facing documentation
- [ ] Create test cases for edge cases

## Recommended UX Design

```
Scanning volumeviz_movies_dev
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 75%
Overall: 75% complete • 5m 30s remaining

✓ Volume Scan - Complete
  Indexed volume metadata (instant)

⚙ Filesystem Indexing - 68% (9,822 / 14,433 files)
  Scanning directory structure...
  Current: .../Movies/Avatar/extras/scene12.mkv
  Speed: 156 files/sec • 3m 15s remaining

⚙ Media Enrichment - 98% (9,000 / 9,152 files)
  Extracting media metadata and generating thumbnails...
  Current: .../Matrix/poster.jpg
  Speed: 45 files/sec • 2m 15s remaining
```

## Testing Scenarios

1. **Small volume** (< 100 files)
2. **Large volume** (> 10,000 files)
3. **Media-heavy volume** (mostly videos/images)
4. **Mixed content volume**
5. **Scan failure/cancellation**
6. **Resume from checkpoint**

## Success Criteria

1. Overall progress percentage makes intuitive sense
2. Progress never goes backwards
3. When all phases show 100%, overall shows 100%
4. Time estimates are within 20% accuracy
5. Users can understand what's happening at a glance
6. No flickering or UI jumping

## Current State Analysis (2025-10-10)

### What User Sees Now
```
Scanning volumeviz_movies_dev
89%
Items Processed: 55,226
Elapsed Time: 14m 12s
Remaining: 1m 45s

Media Enrichment
98% (9,000 / 9,152 items)
6304 items/sec  ← WRONG!
.../Tom Jones (1963)/Tom Jones (1963) [imdbid-tt0057590] - [Remux-1080p][FLAC 1.0][AVC]-EPSiLON.mkv
1m 45s remaining
6304 items/sec avg

Phase Summary:
Filesystem Indexing - 70%  ← WRONG (should be 100%)
Media Enrichment - 98%
```

### Critical Issues Found

#### Issue #1: Impossible Throughput ⚠️ CRITICAL
- **Shows**: 6,304 items/sec for media enrichment
- **Expected**: 5-50 items/sec (realistic for ffprobe, EXIF, thumbnails)
- **Impact**: Destroys user trust in all metrics
- **Root Cause**: `phase_started_at` is NULL in database
- **Fix**: Set `started_at` when phase begins, calculate throughput as `items / elapsed_seconds`

#### Issue #2: Incorrect Overall Progress
- **Shows**: 89%
- **Should Be**: 80% with new hybrid calculation
- **Calculation**:
  - Volume scan: 31,793 / 34,949 × 1.0 = 31,793 weighted
  - Filesystem: 14,433 / 14,433 × 1.0 = 14,433 weighted
  - Media: 9,000 / 9,152 × 2.0 = 18,000 weighted
  - Total: 54,226 / 67,686 = 80%
- **Root Cause**: Old fixed-weight calculation still running OR backend not rebuilt
- **Fix**: Ensure new backend is deployed

#### Issue #3: Filesystem Indexing Shows 70%
- **Database**: 14,433 / 14,433 items (100% complete)
- **UI Bottom**: Shows "Filesystem Indexing 70%"
- **Root Cause**: Phase showing in summary even though complete
- **Fix**: Frontend should hide completed phases OR show with ✅ Complete status

#### Issue #4: Phase Timing Data Missing
- **Database**: `phase_started_at` = NULL for all phases except volume_scan
- **Impact**:
  - Cannot calculate per-phase elapsed time
  - Throughput calculations are wrong
  - Remaining time estimates are wrong
- **Root Cause**: CreateScanPhase not setting `started_at`
- **Fix**: Set `started_at = NOW()` when phase begins

#### Issue #5: Long File Paths
- **Shows**: `.../Tom Jones (1963)/Tom Jones (1963) [imdbid-tt0057590] - [Remux-1080p][FLAC 1.0][AVC]-EPSiLON.mkv`
- **Should Show**: `.../EPSiLON.mkv` or `.../Tom Jones (1963)/...mkv`
- **Root Cause**: Truncation function only removes 2 segments
- **Fix**: Smarter truncation (show just filename for very long paths)

#### Issue #6: Duplicate "Remaining" Time
- **Top Stats**: "Remaining: 1m 45s"
- **Phase Detail**: "1m 45s remaining"
- **Fix**: Only show once (either top or per-phase)

#### Issue #7: Confusing Phase Summary
- Shows incomplete phases at bottom without context
- No status icons (✓, ⚙️, ⏸)
- No clear indication of what's complete vs running
- **Fix**: Redesign phase summary with clear status

#### Issue #8: PhaseIndicator Has No Visual Progress Bar
- **Shows**: "Filesystem Indexing 75%" (just text)
- **Should Show**: Text + visual progress bar like the detailed phases
- **Root Cause**: PhaseIndicator component only renders icon + text, no bar
- **Fix**: Add mini progress bar to PhaseIndicator
- **Example**:
  ```
  🔵 Filesystem Indexing ▓▓▓▓▓▓▓▓░░ 75%
  ```

#### Issue #9: PhaseIndicator Shows Wrong Percentage
- **Shows**: 70% (from `progress_percent` database field)
- **Should Show**: 100% (from `phase_progress_percent` calculated field)
- **Database**:
  - `progress_percent`: 70 (old time-based calc, WRONG)
  - `phase_progress_percent`: 100.00 (items-based calc, CORRECT)
- **Root Cause**: Frontend using wrong field from database
- **Fix**: Use `phase_progress_percent` or calculate from `items_processed / items_total`

#### Issue #10: Progress Bars Jumping Around ⚠️ HIGH PRIORITY
- **Problem**: Overall progress and phase percentages jump up/down as updates come in
- **User Impact**: Creates perception of instability, hard to read changing numbers
- **Real Example**: Filesystem Indexing oscillates between **65% ↔ 70%** repeatedly
- **More Examples**:
  - Overall: 89% → 87% → 91% → 88%
  - Phase: 70% → 65% → 70% → 68% → 70%
- **Root Causes**:
  1. Different phases report at different rates (WebSocket updates)
  2. Race conditions between phase updates and overall calculation
  3. Phases completing and being removed from calculation
  4. Database vs in-memory calculations differ
- **Fixes Needed**:
  1. **Debounce progress updates** (max 1 update per second)
  2. **Smooth transitions** with CSS transitions
  3. **Ensure monotonic progress** (never decrease unless scan resets)
  4. **Atomic updates** (update all phases together, not individually)
  5. **Round to nearest 1%** to reduce visual jitter

### Remaining Time Accuracy Issue

**Calculation breakdown:**
- Total items remaining: 58,534 - 55,226 = 3,308
- Elapsed: 14m 12s = 852 seconds
- Overall rate: 55,226 ÷ 852 = 64.8 items/sec (blended across all phases)
- Estimated: 3,308 ÷ 64.8 = 51 seconds

**But shows**: 1m 45s (105 seconds) = 2× the estimate

This suggests the **real processing rate is ~31 items/sec**, which is realistic for media enrichment!
The system may be using a more conservative estimate or accounting for slowdown.

## Updated Implementation Plan

### Phase 1: Critical Fixes ⚠️ (DO FIRST)
- [ ] Fix `phase_started_at` being NULL
  - File: `internal/repo/scan_progress_repo.go`
  - Method: `CreateScanPhase`
  - Fix: Set `started_at = NOW()` when creating phase
- [ ] Fix enrichment manager throughput calculation
  - File: `internal/services/enrichers/manager.go`
  - Calculate: `items / elapsed_time_since_phase_start`
  - Add: Validation to reject values > 1000 items/sec
- [ ] Verify hybrid progress calculation is deployed
  - Rebuild backend
  - Restart service
  - Verify 80% not 89%

### Phase 2: UI Polish (HIGH PRIORITY)
- [ ] **FIX JUMPING PROGRESS BARS** ⚠️ HIGH PRIORITY
  - File: `frontend/src/components/domain/scan/ScanProgressDetail.tsx`
  - Add debouncing (update max once per second)
  - Add CSS transitions for smooth progress bar movement
  - Ensure monotonic progress (never decrease)
  - Round percentages to nearest 1%
- [ ] Hide completed phases from running section
  - File: `frontend/src/components/domain/scan/ScanProgressDetail.tsx`
  - Filter out phases where `items_processed >= items_total`
- [ ] Better file path truncation
  - Show just filename if path > 80 chars
  - Example: `.../EPSiLON.mkv` instead of full path
- [ ] Remove duplicate "remaining" time
  - Show per-phase remaining time only in detail
  - Show overall remaining in top stats only
- [ ] Fix phase summary at bottom
  - Add status icons: ✅ ⚙️ ⏸ ❌
  - Show all phases with clear status
  - Example: `✅ Filesystem Indexing - Complete (14,433 files)`

### Phase 3: Validation & Safety (MEDIUM PRIORITY)
- [ ] Add throughput validation
  - Reject values > 1000 items/sec
  - Log warning if > 500 items/sec
- [ ] Add progress bounds checking
  - Ensure progress never > 100%
  - Ensure progress never decreases
- [ ] Add database constraints
  - `throughput_items_per_sec` should have CHECK constraint
  - `progress_percent` should be 0-100

### Phase 4: Enhanced UX (LOW PRIORITY)
- [ ] Add tooltips explaining metrics
- [ ] Show confidence indicator for estimates
- [ ] Add "What's happening?" explanation
- [ ] Color-code phases by status (green=complete, blue=running, red=failed)
- [ ] Add mini progress bars in phase summary

### Phase 5: Testing & Documentation
- [ ] Test with fresh scan after fixes
- [ ] Verify metrics are accurate
- [ ] Document progress calculation
- [ ] Add inline code comments
- [ ] Update user documentation

## Next Immediate Actions

**RIGHT NOW:**
1. Fix `CreateScanPhase` to set `started_at`
2. Fix throughput calculation
3. Rebuild and restart backend
4. Observe if metrics improve

**THEN:**
5. Polish UI display issues
6. Add validation
7. Test thoroughly

## Success Criteria (Updated)

1. ✅ Overall progress matches intuition (80% = mostly done)
2. ❌ Throughput is realistic (5-50 items/sec, NOT 6000!)
3. ❌ Remaining time is accurate (within 50% margin)
4. ❌ Phase summary shows correct status
5. ✅ Progress never goes backwards
6. ✅ No flickering or UI jumping
7. ❌ Users trust the metrics
8. ❌ All timing data is present in database
