# Store Cleanup Decision & Implementation Plan

## Executive Summary

The store package has accumulated technical debt with stub analytics methods that are mostly unused. We need to clean this up to maintain a clean architecture.

## Current State Analysis

### What We Found

1. **Snapshot Functionality**:
   - ✅ API endpoint exists: `POST /trends/volumes/:volumeId/snapshots`
   - ❌ Not used by frontend
   - ❓ Purpose unclear - seems to be for manual snapshot creation

2. **Analytics Methods in Store**:
   - ❌ 5 methods are completely unused (Get7DayTrend, etc.)
   - ❌ All have stub implementations returning fake data
   - ✅ Real functionality is in StatsService using daily_stats table

3. **Architecture Issues**:
   - Store interface mixes repository access with business logic
   - Circular dependency: Services depend on Store which has service-like methods
   - Models are in wrong package (store instead of models)

## Recommendation: Incremental Cleanup

### Phase 1: Remove Dead Code (Do First) ✅

1. **Remove these methods from Store interface**:
   ```go
   // REMOVE THESE:
   Get7DayTrend(ctx context.Context, volumeID string) (*TrendData, error)
   Get30DayTrend(ctx context.Context, volumeID string) (*TrendData, error)
   GetVolumeStepSeries(ctx context.Context, params GetVolumeStepSeriesParams) ([]*StepSeriesPoint, error)
   GetTrendSlope(ctx context.Context, params GetTrendSlopeParams) (*TrendSlope, error)
   GetGrowthDeltas(ctx context.Context, params GetGrowthDeltasParams) (*GrowthDeltas, error)
   ```

2. **Remove stub implementations** from store_pg.go

3. **Remove unused models**:
   - TrendData
   - StepSeriesPoint  
   - TrendSlope
   - GrowthDeltas
   - GetVolumeStepSeriesParams
   - GetTrendSlopeParams
   - GetGrowthDeltasParams

### Phase 2: Evaluate Snapshot Feature (Do Second) 🤔

1. **Investigate**:
   - Is manual snapshot creation actually needed?
   - Can StatsService handle this use case?
   - Should we remove the endpoint entirely?

2. **If keeping snapshots**:
   - Create proper snapshots repository
   - Move models to models package
   - Update SnapshotService to use repository

3. **If removing snapshots**:
   - Remove CreateSnapshot endpoint
   - Remove SnapshotService
   - Remove remaining Store methods
   - Simplify to pure repository pattern

### Phase 3: Final Cleanup (Do Last) 🎯

1. **Store interface becomes**:
   ```go
   type Store interface {
       // Transaction support
       WithTx(ctx context.Context, fn func(TxStore) error) error
       
       // Repository access only
       Volumes() repo.VolumesRepo
       Scans() repo.ScansRepo
       Retention() repo.RetentionRepo
       Stats() *repo.StatsRepo
       Files() repo.FilesRepo        // When implemented
       Folders() repo.FoldersRepo    // When implemented
       FileMetadata() repo.FileMetadataRepo // When implemented
   }
   ```

2. **No business logic in store package**
3. **All models in models package**
4. **Clean separation of concerns**

## Benefits of This Approach

1. **Immediate Win**: Remove 200+ lines of dead code
2. **No Risk**: Removing unused methods can't break anything
3. **Incremental**: Can stop at any phase if needed
4. **Clean Architecture**: Store becomes pure repository orchestrator

## Implementation Steps

### Step 1: Remove Dead Analytics Methods (30 minutes)
```bash
# 1. Remove methods from store.go interface
# 2. Remove implementations from store_pg.go
# 3. Remove models from store.go
# 4. Fix any compilation errors (there shouldn't be any)
# 5. Run tests to verify
```

### Step 2: Decide on Snapshots (1 hour)
```bash
# 1. Check with product owner about snapshot feature
# 2. Search for any documentation about snapshots
# 3. Test the API endpoint manually
# 4. Make decision: keep or remove
```

### Step 3: Implement Decision (2-4 hours)
```bash
# If removing:
# 1. Remove endpoint from router
# 2. Delete SnapshotService
# 3. Remove remaining Store methods
# 4. Update tests

# If keeping:
# 1. Create snapshots repository
# 2. Write SQL queries
# 3. Move models
# 4. Update service
# 5. Update tests
```

## Risks & Mitigations

1. **Risk**: Hidden dependencies on analytics methods
   - **Mitigation**: Compiler will catch any usage we missed
   - **Status**: Already searched, found none

2. **Risk**: Snapshot feature might be important
   - **Mitigation**: Check with stakeholders first
   - **Status**: Need to investigate

3. **Risk**: Breaking changes for API clients
   - **Mitigation**: Only internal changes, API unchanged
   - **Status**: Low risk

## Next Action

Start with Phase 1 - it's safe and provides immediate value. Then investigate the snapshot feature to make an informed decision about Phase 2.