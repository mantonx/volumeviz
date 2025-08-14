# Store Package Cleanup Plan

## Current Architecture Analysis

### Problems Identified

1. **Mixed Responsibilities**: The Store interface has two distinct responsibilities:
   - Repository access pattern (good ✅)
   - Analytics/snapshot methods (should be in a repository ❌)

2. **Stub Implementations**: `store_pg.go` has 7 methods that are just TODO stubs returning fake data

3. **Duplication**: We have both:
   - Old snapshot/analytics methods in Store interface
   - New StatsService that handles daily stats properly

4. **Misplaced Models**: Analytics models (UsageSnapshot, TrendData, etc.) are in the store package but should be in models package

5. **Circular Architecture**: Services depend on Store which has business logic that should be in services

## Current Usage Analysis

### Who Uses the Analytics Methods?

1. **SnapshotService** (`internal/services/snapshots/snapshot_service.go`)
   - Uses: `CreateUsageSnapshot`, `GetLatestSnapshot`
   - This service is used by the trends handler for manual snapshot creation

2. **Tests** (various test files)
   - Mock implementations for testing

3. **No Production Usage** for:
   - `Get7DayTrend`
   - `Get30DayTrend`
   - `GetVolumeStepSeries`
   - `GetTrendSlope`
   - `GetGrowthDeltas`

### The Real Implementation
- We already have `StatsService` which properly handles daily stats
- The trends API is already using StatsService for all trend data
- The old analytics methods are effectively dead code

## Proposed Cleanup

### Phase 1: Remove Dead Analytics Methods

1. **Remove from Store interface**:
   - `Get7DayTrend`
   - `Get30DayTrend`
   - `GetVolumeStepSeries`
   - `GetTrendSlope`
   - `GetGrowthDeltas`

2. **Remove stub implementations** from `store_pg.go`

3. **Remove unused models**:
   - `TrendData`
   - `StepSeriesPoint`
   - `TrendSlope`
   - `GrowthDeltas`
   - Related params types

### Phase 2: Create Snapshots Repository

1. **Create `internal/repo/snapshots_repo.go`**:
   ```go
   type SnapshotsRepo interface {
       CreateSnapshot(ctx context.Context, params models.CreateSnapshotParams) (*models.Snapshot, error)
       GetLatestSnapshot(ctx context.Context, volumeID, snapshotType string) (*models.Snapshot, error)
       ListSnapshots(ctx context.Context, volumeID string, limit, offset int) ([]*models.Snapshot, error)
       DeleteOldSnapshots(ctx context.Context, cutoffDate time.Time) error
   }
   ```

2. **Move models to `internal/models/snapshot.go`**:
   - Rename `UsageSnapshot` → `Snapshot`
   - Move `CreateUsageSnapshotParams` → `CreateSnapshotParams`

3. **Add to Store interface**:
   ```go
   Snapshots() repo.SnapshotsRepo
   ```

### Phase 3: Update Services

1. **Update SnapshotService** to use the repository directly
2. **Remove CreateUsageSnapshot and GetLatestSnapshot from Store interface**

### Phase 4: Clean up store_pg.go

After all the above:
- `store_pg.go` will only have repository access methods
- No business logic or stub implementations
- Clean separation of concerns

## Benefits

1. **Clean Architecture**: Store only manages transactions and repository access
2. **No Stub Code**: Remove all TODO implementations
3. **Proper Separation**: Business logic in services, data access in repositories
4. **Consistent Pattern**: All data access through repositories
5. **Easier Testing**: Mock repositories instead of entire store

## Migration Path

### Step 1: Check Current Usage
- Verify no production code uses the dead analytics methods
- Check if SnapshotService is actually needed (or if StatsService handles everything)

### Step 2: Create Snapshots Repository
- Write SQL queries for snapshots
- Implement repository
- Add to Store interface

### Step 3: Update SnapshotService
- Use repository instead of store methods
- Update tests

### Step 4: Remove Dead Code
- Remove analytics methods from Store
- Remove stub implementations
- Remove unused models

### Step 5: Verify
- Run all tests
- Check trends API still works
- Ensure no broken imports

## Alternative: Complete Removal

If investigation shows SnapshotService is not actually used in production:
1. Remove entire snapshots functionality
2. Rely entirely on StatsService for all analytics
3. Much simpler architecture

## Next Steps

1. Investigate if SnapshotService is actually used
2. Check if any frontend or API endpoints depend on snapshots
3. Decide between migration or removal
4. Execute the plan