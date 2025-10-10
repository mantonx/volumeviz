# Scan Progress Throughput Fix

## Problem

Media enrichment shows **6,227 items/sec** throughput, which is impossible. Realistic rates for media processing:
- Video files: 2-10 items/sec (ffprobe extraction)
- Image files: 10-50 items/sec (EXIF extraction)
- Thumbnail generation: 5-20 items/sec

**Current reported**: 6,227 items/sec ❌
**Expected**: 5-50 items/sec ✓

## Root Cause Analysis

### Issue 1: Missing Timing Data
From database query:
```sql
phase_name: "filesystem_indexing"
items_processed: 14,433 / 14,433 (100% complete)
throughput_items_per_sec: null
phase_started_at: null  ← MISSING!
elapsed_seconds: null   ← MISSING!
```

**Problem**: Without `phase_started_at`, throughput cannot be calculated accurately.

### Issue 2: Incorrect Calculation Window
The throughput might be calculated using:
1. **Wrong time window** (e.g., last second instead of total elapsed)
2. **Batch updates** (e.g., 1000 items processed in 0.16 seconds = 6250 items/sec)
3. **Stale timestamps** from previous scans

## Investigation Tasks

1. **Check enrichment manager progress calculation**
   - File: `internal/services/enrichment/manager.go`
   - Look for: `ItemsPerSecond` calculation
   - Verify: Time window used for rate calculation

2. **Check phase timing initialization**
   - File: `internal/repo/scan_progress_repo.go`
   - Method: `CreateScanPhase`
   - Verify: `started_at` is set correctly

3. **Check progress update frequency**
   - How often are progress updates sent to database?
   - Is throughput calculated per-update or cumulative?

## Expected Behavior

### Throughput Calculation Should Be:
```go
elapsedSeconds := time.Since(phase.StartedAt).Seconds()
if elapsedSeconds > 0 {
    throughput := float64(phase.ItemsProcessed) / elapsedSeconds
} else {
    throughput := 0.0
}
```

### Display in UI:
```
Media Enrichment - 98% (9,000 / 9,152 files)
Speed: 45 files/sec avg
```

Not:
```
Media Enrichment - 98% (9,000 / 9,152 files)
Speed: 6,227 files/sec avg  ← WRONG!
```

## Fixes Needed

1. **Ensure phase_started_at is set** when phase begins
2. **Calculate throughput using total elapsed time**, not instantaneous rate
3. **Add validation** to cap unrealistic throughput values
4. **Separate instant vs average throughput** in UI
5. **Add unit tests** for throughput calculation

## Testing

Create test scenarios:
1. Small volume (100 files) - should show realistic rates
2. Large volume (10,000 files) - average should be stable
3. Mixed media types - rates should vary per file type
4. Compare reported throughput with actual scan duration

## Success Criteria

- Throughput values are realistic (5-50 items/sec for media)
- Throughput doesn't spike to impossible values
- Average throughput matches actual scan performance
- Users can understand scan performance at a glance
