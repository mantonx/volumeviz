# VolumeViz TODO List

## Overview
This document lists all TODO items found in the codebase, organized by category and priority.

## Categories

### 1. Store/Repository Integration (High Priority)
These TODOs relate to completing the store pattern implementation:

#### Events Repository Adapter
- **Location**: `internal/api/v1/router.go:126, 135`
- **Task**: Create proper adapter between store.Store and events.Repository
- **Details**: The events system needs an adapter to work with the new store pattern

#### Analytics Repository
- **Multiple locations**: `internal/store/store_pg.go`, `internal/scheduler/repository.go`
- **Task**: Implement analytics repository methods in store
- **Methods needed**:
  - CreateUsageSnapshot
  - GetLatestSnapshot
  - Get7DayTrend
  - Get30DayTrend
  - GetVolumeStepSeries
  - GetTrendSlope
  - GetGrowthDeltas

#### Retention Repository
- **Location**: `internal/repo/retention_repo.go:43-63`
- **Task**: Implement retention queries in sqlc
- **Methods needed**:
  - CreateRetentionPolicy
  - GetRetentionPolicy
  - UpdateRetentionPolicy
  - DeleteRetentionPolicy
  - ListRetentionPolicies

### 2. Health Checks (Medium Priority)
- **Locations**: 
  - `cmd/server/main.go:56`
  - `internal/api/v1/health/handler.go:121, 394`
- **Task**: Implement proper health check when store interface supports it
- **Details**: Need to add health check method to store interface

### 3. Version Management (Low Priority)
- **Location**: `internal/api/v1/system/handler.go:32, 55`
- **Task**: Get version from build info instead of hardcoding "1.0.0"
- **Details**: Should use build-time variables or version package

### 4. Volume Features (Medium Priority)

#### Orphaned Volume Detection
- **Location**: `internal/api/v1/volumes/handler.go:141`
- **Task**: Apply orphaned filter (requires container check)
- **Details**: Need to cross-reference volumes with container mounts

#### Multi-field Sorting
- **Location**: `internal/api/v1/volumes/handler.go:301`
- **Task**: Implement multi-field sorting for volume list
- **Details**: Currently only supports single field sorting

#### Volume Timestamps
- **Location**: `internal/api/v1/volumes/handler.go:483`
- **Task**: Add first_seen and last_seen from database
- **Details**: Need to track when volumes are first discovered and last seen

### 5. Admin/Security Features (Medium Priority)
- **Location**: `internal/api/v1/scan/handler.go:544`
- **Task**: Add admin authentication check when auth is implemented
- **Details**: Dangerous operations should require admin privileges

### 6. Metrics and Analytics (Low Priority)
- **Location**: `internal/api/v1/scan/handler.go:97`
- **Task**: Save historical metrics using store when analytics repository is available
- **Details**: Currently metrics are calculated but not persisted

### 7. Filesystem Operations (Low Priority)

#### Disk Usage Calculation
- **Location**: `internal/services/filesystem/filesystem_indexer.go:393`
- **Task**: Get actual disk usage instead of file size
- **Details**: Should calculate actual blocks used on disk

#### Volume Pagination
- **Location**: `internal/services/filesystem/volume_discovery.go:219`
- **Task**: Add pagination for large volume counts
- **Details**: Currently hardcoded to 1000 volumes limit

### 8. Snapshot Service (Low Priority)
- **Locations**: `internal/services/snapshots/retention_service.go:54, 63, 72`
- **Tasks**:
  - Implement compaction logic when Store interface is updated
  - Implement cleanup logic for old snapshots
  - Implement cleanup for orphaned snapshots

### 9. Scheduler Features (Low Priority)

#### Volume Creation Tracking
- **Location**: `internal/scheduler/repository.go:72`
- **Task**: Implement when volume creation method is available in store

#### Watchdog Last Check Time
- **Location**: `internal/scheduler/watchdog.go:69`
- **Task**: Track actual last check time instead of using current time

## Priority Summary

### High Priority (Blocking Features)
1. Create events repository adapter
2. Implement analytics repository in store
3. Add retention queries to sqlc

### Medium Priority (Important Features)
1. Add health check support to store interface
2. Implement orphaned volume detection
3. Add admin authentication framework
4. Implement multi-field sorting
5. Track volume timestamps (first_seen, last_seen)

### Low Priority (Nice to Have)
1. Version management from build info
2. Historical metrics persistence
3. Actual disk usage calculation
4. Volume listing pagination
5. Snapshot retention/compaction logic
6. Scheduler improvements

## Implementation Notes

Most of these TODOs fall into a few patterns:
1. **Store pattern completion**: Many TODOs are waiting for the store/repository pattern to be fully implemented
2. **Feature extensions**: Some are enhancements to existing features
3. **Technical debt**: A few represent shortcuts taken that should be addressed

The highest impact would come from completing the store pattern implementation, particularly:
- Analytics repository (enables trends/metrics persistence)
- Events repository adapter (enables proper event handling)
- Retention repository (enables data lifecycle management)