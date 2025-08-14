# Store Cleanup Phase 2: Snapshot Analysis & Decision

## Analysis Results

After investigating the snapshot functionality, here are the key findings:

### 🔍 Current State

**UsageSnapshot vs DailyStat Comparison:**

| Feature | UsageSnapshot (Store) | DailyStat (Models) |
|---------|----------------------|-------------------|
| **Purpose** | Manual snapshots + nightly automation | Automatic daily stats from scans |
| **Data Source** | Manual input or basic scan | Rich filesystem scan data |
| **Storage** | Stub implementation (fake data) | Real PostgreSQL tables |
| **Usage** | Not used in production | Used by trends API |
| **Fields** | Basic: size, files, directories | Rich: added/removed bytes/files, scan metadata |
| **API Integration** | Manual endpoint only | Powers all real trends functionality |

### 📊 Key Findings

1. **Snapshots are NOT used in production:**
   - NightlyScheduler exists but is NOT initialized in main.go
   - Manual snapshot API endpoint exists but frontend doesn't call it
   - All snapshot store methods return fake/stub data
   - No real database tables for snapshots

2. **DailyStats IS the real implementation:**
   - Powers all working trends functionality
   - Has real database tables and data
   - Automatically created when scans complete
   - Rich data model with delta tracking

3. **Functional overlap with better implementation:**
   - Both track volume size and file counts over time
   - DailyStats provides everything snapshots do, plus much more
   - DailyStats has proper repository pattern already

## 💡 Decision: Migrate to DailyStats Architecture

### Why Remove Snapshots

1. **Redundant functionality** - DailyStats already does everything snapshots were meant to do
2. **Better data model** - DailyStats tracks deltas (added/removed bytes/files), snapshots only track totals
3. **No production usage** - Snapshots are not actually being created or used
4. **Stub implementation** - Snapshot store methods return fake data
5. **Proper architecture** - DailyStats already uses repository pattern

### Migration Strategy

Instead of implementing a snapshots repository, **migrate the manual snapshot creation to use the DailyStats/StatsService architecture**.

## 📋 Phase 2 Action Plan

### Option 1: Remove Snapshots Entirely ✅ (Recommended)
Since snapshots aren't used and DailyStats provides better functionality:

1. **Remove snapshot functionality:**
   - Remove `CreateUsageSnapshot` and `GetLatestSnapshot` from Store interface
   - Remove UsageSnapshot model and related types
   - Remove SnapshotService entirely
   - Remove manual snapshot API endpoint
   - Remove NightlyScheduler (not used anyway)

2. **Update manual snapshot creation:**
   - Replace `POST /trends/volumes/:volumeId/snapshots` with trigger for stats computation
   - Use StatsService.ComputeHistoricalStats for manual statistics generation
   - Leverage existing scan infrastructure instead of manual data input

### Option 2: Keep Manual Snapshots (NOT Recommended)
If we really need manual data entry:

1. Create proper snapshots repository with real database tables
2. Migrate UsageSnapshot model to models package
3. Update SnapshotService to use repository
4. Add snapshots repository to Store interface

## ✅ Recommendation: Choose Option 1

**Reasons:**
- **Simpler architecture** - One way to track volume statistics (DailyStats)
- **Better functionality** - DailyStats tracks deltas, not just totals
- **Real implementation** - DailyStats has working database integration
- **No functionality lost** - Nothing is actually using snapshots in production
- **Consistent pattern** - Everything uses the same StatsService architecture

## 🎯 Benefits of Removing Snapshots

1. **Cleaner Store interface** - Only repository access, no business logic
2. **Unified statistics architecture** - Everything goes through StatsService
3. **Remove stub/fake code** - No more TODO implementations
4. **Simpler maintenance** - One statistics system instead of two overlapping ones
5. **Better data quality** - DailyStats come from real scans, not manual entry

## 📝 Implementation Steps

1. Remove snapshot-related methods from Store interface
2. Remove snapshot models from store package
3. Remove SnapshotService and related files
4. Remove manual snapshot API endpoint
5. Update documentation to reflect DailyStats as the only statistics mechanism
6. Test that trends functionality still works (it will, since it uses StatsService)

This decision aligns with the goal of creating a clean repository pattern while eliminating redundant functionality.