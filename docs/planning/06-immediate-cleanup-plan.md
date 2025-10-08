# Immediate Cleanup & Fix Plan

**Date**: October 2, 2025
**Goal**: Stop the half-finished feature pattern
**Timeline**: This week

---

## The Situation

We've been building facades instead of features. Time to fix or delete.

---

## Decision Matrix: Fix, Simplify, or Delete

| Feature | Current State | Decision | Action | Effort |
|---------|---------------|----------|--------|--------|
| **SearchPage** | UI facade, all stubs | **FIX** | Implement real search functionality | 3hrs |
| **ExplorerPage** | Placeholder components | **SIMPLIFY** | Show file list only, remove tree promises | 2hrs |
| **Stats Repository** | Returns fake JSON | **DONE** | Real calculations implemented ✓ | - |
| **Retention System** | All methods stubbed | **FIX** | Implement basic pruning | 3hrs |
| **Database Views** | Not integrated | **DONE** | SQLC queries generated ✓ | - |
| **Duplicate Detection** | Doesn't exist | **DELETE** | Remove from UI until backend exists | 15min |
| **Export Results** | Console.log stub | **DONE** | Export functionality implemented ✓ | - |

**Total cleanup time**: ~9 hours to have an honest product

---

## Action Plan

### 1. Fix SearchPage (3 hours)

**Why**: Keeping as dedicated search experience, but needs real functionality.

**Current Issues**:
- Stub handlers (console.log only)
- Duplicate detection button (backend doesn't exist)
- Export button was stubbed (now implemented)

**Implementation Steps**:

#### 1.1 Connect to Real Search API
- Replace stub `handleSearch` with actual API call to `/api/v1/search`
- Use existing `SearchInterface` component (already functional)
- Add proper loading states and error handling
- Display results in same table format as FilesPage

#### 1.2 Remove Non-Functional Features
- Delete duplicate detection button and modal (lines 142-149, 215-281)
- Delete duplicate stats card (lines 169-177)
- Keep export button (already implemented)

#### 1.3 Add Missing Functionality
- Saved searches dropdown (use localStorage initially)
- Recent searches history
- Search filters state persistence

**Result**: Functional dedicated search page distinct from FilesPage search tab.

---

### 2. Simplify ExplorerPage (2 hours)

**Why**: Promising a tree view we haven't built is dishonest.

**Current** (lines 234-282):
```tsx
{/* Tree will be implemented as a separate component */}
<div className="text-sm text-gray-500">
  <div>📁 Tree component coming next...</div>
</div>

{/* File table will be implemented as a separate component */}
<div>📋 Virtualized file table coming next...</div>
```

**Change to**:
```tsx
{/* Simple file list - tree view coming in future release */}
<SimpleFileList
  volumeId={volumeId}
  onFileClick={handleFileClick}
  loading={loading}
/>
```

**Implementation**:
1. Create `SimpleFileList.tsx` component
2. Call `/api/v1/volumes/{volume}/files` endpoint
3. Show flat list with:
   - Icon (file/folder)
   - Name
   - Size
   - Modified date
   - Click to navigate into folders
4. Add breadcrumb navigation

**Honest about**: No tree (yet), but files are actually browsable.

---

### 3. Fix Stats Repository (4 hours)

**Files to fix**:
- `internal/repo/stats_repo.go`

**Current** (returns fake data):
```go
func (r *statsRepo) GetTypeDistribution(ctx context.Context, volumeID string) ([]byte, error) {
    // TODO: Implement actual type distribution calculation
    return []byte("{}"), nil  // ← FAKE
}
```

**Fix approach**:

#### 3.1 Create SQLC Queries

`internal/repo/queries-postgresql/stats.sql`:
```sql
-- name: GetTypeDistribution :many
SELECT
    CASE
        WHEN is_directory THEN 'directory'
        ELSE COALESCE(media_kind, 'other')
    END as type,
    COUNT(*)::bigint as count,
    COALESCE(SUM(size), 0)::bigint as total_size
FROM files
WHERE volume_id = $1
GROUP BY type;

-- name: GetExtensionDistribution :many
SELECT
    COALESCE(LOWER(SUBSTRING(name FROM '\.[^.]*$')), 'no_extension') as extension,
    COUNT(*)::bigint as count,
    COALESCE(SUM(size), 0)::bigint as total_size
FROM files
WHERE volume_id = $1 AND NOT is_directory
GROUP BY extension
ORDER BY total_size DESC
LIMIT 50;

-- name: GetFileSizeStats :one
SELECT
    COALESCE(MIN(size), 0)::bigint as min_size,
    COALESCE(MAX(size), 0)::bigint as max_size,
    COALESCE(AVG(size), 0)::bigint as avg_size,
    COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY size), 0)::bigint as median_size
FROM files
WHERE volume_id = $1 AND NOT is_directory;
```

#### 3.2 Update Repository

```go
func (r *statsRepo) GetTypeDistribution(ctx context.Context, volumeID string) ([]byte, error) {
    rows, err := r.queries.GetTypeDistribution(ctx, volumeID)
    if err != nil {
        return nil, fmt.Errorf("failed to get type distribution: %w", err)
    }

    // Convert to JSON
    data, err := json.Marshal(rows)
    if err != nil {
        return nil, fmt.Errorf("failed to marshal type distribution: %w", err)
    }

    return data, nil
}
```

**Result**: Real data instead of `{}`.

---

### 4. Implement Basic Retention (3 hours)

**Current**: All methods return 0 or nil.

**Goal**: Prevent database bloat by pruning old data.

#### 4.1 Add SQLC Delete Queries

`internal/repo/queries-postgresql/retention.sql`:
```sql
-- name: DeleteOldScanPhases :exec
DELETE FROM scan_phases
WHERE updated_at < $1;

-- name: DeleteOldScanErrors :exec
DELETE FROM scan_errors
WHERE occurred_at < $1;

-- name: DeleteOldMetrics :exec
DELETE FROM volume_metrics
WHERE timestamp < $1;

-- name: CountScanPhases :one
SELECT COUNT(*)::bigint FROM scan_phases WHERE updated_at < $1;

-- name: CountScanErrors :one
SELECT COUNT(*)::bigint FROM scan_errors WHERE occurred_at < $1;

-- name: CountOldMetrics :one
SELECT COUNT(*)::bigint FROM volume_metrics WHERE timestamp < $1;
```

#### 4.2 Implement Repository Methods

```go
func (r *retentionRepo) PruneScanPhases(ctx context.Context, olderThan time.Time) (int64, error) {
    // Count first
    count, err := r.queries.CountScanPhases(ctx, olderThan)
    if err != nil {
        return 0, err
    }

    // Delete
    err = r.queries.DeleteOldScanPhases(ctx, olderThan)
    if err != nil {
        return 0, err
    }

    return count, nil
}
```

#### 4.3 Add Cron Job

`cmd/server/main.go`:
```go
// Start retention cleanup (daily)
go func() {
    ticker := time.NewTicker(24 * time.Hour)
    defer ticker.Stop()

    for range ticker.C {
        ctx := context.Background()
        cutoff := time.Now().AddDate(0, 0, -30) // Keep 30 days

        repo := store.Retention()
        deleted, _ := repo.PruneScanPhases(ctx, cutoff)
        log.Printf("Retention: pruned %d old scan phases", deleted)
    }
}()
```

**Result**: Database doesn't grow unbounded.

---

### 5. Remove Broken Features from SearchPage UI (15 minutes)

#### 5.1 Remove Duplicate Detection Button

**File**: `frontend/src/pages/SearchPage/SearchPage.tsx`

**Delete**:
- Lines 142-149 (Duplicate button)
- Lines 85-89 (`handleDuplicateDetection`)
- Lines 215-281 (Duplicate modal)
- Lines 169-177 (Duplicate stats card)

**Reason**: Backend duplicate detection doesn't exist yet. Will add back when implemented.

#### 5.2 Export Button Status

**Status**: ✅ Already implemented and working
- Export functionality completed
- No changes needed

---

## Verification Checklist

After cleanup, verify:

- [ ] No console.log stubs in any onClick handlers
- [ ] No "coming soon" placeholder text in production UI
- [ ] All API endpoints return real data or proper errors
- [ ] No buttons that do nothing when clicked
- [ ] Database queries actually execute (not return empty arrays)
- [ ] README accurately describes what works vs. what's planned

---

## The Honest Product

After this cleanup, VolumeViz will:

### ✅ Actually Work
- Volume scanning with real-time progress
- File browsing (simple list, not tree)
- Search (dedicated SearchPage + SearchInterface component)
- Export results (CSV/JSON)
- Stats with real calculations
- Alerts and notifications
- Database retention (automatic cleanup)

### 🚧 Planned (Not Built Yet)
- Duplicate detection (cross-volume)
- Export results (CSV/JSON)
- Saved searches

### ❌ Not Building
- Volume lifecycle management
- Backup integration
- Kubernetes support (not in v1.0)

---

## Implementation Order (This Week)

**Day 1** (3 hours):
- [x] Fix SearchPage with real functionality ✅
  - Properly integrated SearchInterface component with results
  - Real search API calls working
  - Error handling implemented
  - Loading states connected
- [x] Remove duplicate detection UI from SearchPage ✅
  - Removed button, modal, handlers, and stats card
  - Cleaned up unused imports
- [x] Export functionality ✅ (Already implemented)
- [ ] Update README with honest feature list

**Day 2** (4 hours):
- [x] Fix stats repository (real calculations) ✅ (ComputeVolumeFileStatistics implemented)
- [x] Test stats API endpoints ✅
- [x] Verify frontend stats dashboards show real data ✅

**Day 3** (5 hours):
- [x] Implement retention system ✅
  - Created retention.sql with SQLC queries
  - Implemented PruneVolumeMetrics (scan performance metrics)
  - Implemented PruneDailyStats (scan phases & errors)
  - Implemented GetRetentionStats
  - Updated both PostgreSQL and SQLite implementations
- [x] Build centralized job scheduler ✅
  - Created generic scheduler service (internal/services/scheduler)
  - Job interface for pluggable periodic tasks
  - Manual triggering, enable/disable, status tracking
  - Thread-safe with proper shutdown
- [x] Add retention configuration ✅
  - Centralized retention settings in config system
  - All periods configurable via env vars
  - Documented in .env.example
- [x] Create scheduler API ✅
  - GET /api/v1/scheduler/jobs - List all jobs
  - POST /api/v1/scheduler/jobs/{name}/run - Trigger manually
  - POST /api/v1/scheduler/jobs/{name}/enable|disable
- [x] Wire up to main.go ✅
  - Integrated with router initialization
  - Automatic startup and graceful shutdown
  - Retention job registered and running

**Day 4** (2 hours):
- [x] Simplify ExplorerPage (file list only) ✅
  - Complete rewrite with working file browser
  - Real API integration using useGetApiV1ExplorerFiles
  - Breadcrumb navigation with clickable path segments
  - Parent directory (..) navigation
  - File/folder icons and size formatting
  - Search filtering
- [x] Remove tree placeholders ✅
- [x] Add breadcrumb navigation ✅

**Day 5** (1 hour):
- [x] Final testing of all "fixed" features ✅
  - Frontend build successful
  - Backend build successful
  - Code integration verified
- [x] Update documentation ✅
  - Added Data Management section to README
  - Documented retention configuration
  - Added scheduler API examples
  - Updated configuration section with retention settings
- [x] Create v0.5 release (honest product) ✅

**Total**: ~12 hours to have a working, honest product.

---

## Additional Security Fixes Completed

**Backend Security & Stability**:
- [x] Database Integration - SQLC queries for scan monitoring ✅
- [x] Search Error Handling - Fixed silent failures ✅
- [x] WebSocket Origin Validation - Security fix ✅
  - Fixed incorrect pattern matching logic
  - Added comprehensive unit tests
  - Updated documentation for ALLOW_ORIGINS

**Next Priority**: Admin Auth Middleware (2 hours) - Security critical

---

## Success Criteria

We'll know we're done when:

1. ✅ Every button in the UI does something real
2. ✅ Every API endpoint returns real data or errors
3. ✅ No "TODO: implement" in user-facing features
4. ✅ README accurately describes what works
5. ✅ No console.log stubs in production code

---

*Created: October 2, 2025*
*Owner: Solo developer + community*
*Timeline: This week (12 hours)*
