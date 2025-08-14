# VolumeViz TODO List (Updated After Store Cleanup)

## Overview
This document lists the remaining TODO items in the codebase after completing the store package cleanup. Many previous TODOs related to analytics and snapshots have been resolved.

## Categories

### 1. Store Interface Improvements (High Priority)

#### Health Check Support
- **Locations**: 
  - `cmd/server/main.go:56`
  - `internal/api/v1/health/handler.go:121, 394`
- **Task**: Add health check method to Store interface
- **Details**: Currently using adapter with placeholder health check
- **Impact**: Enable proper database health monitoring

#### Events Repository Adapter  
- **Location**: `internal/api/v1/router.go:126, 135`
- **Task**: Create proper adapter between store.Store and events.Repository
- **Details**: Events system needs integration with store pattern
- **Impact**: Enable proper event handling with new architecture

### 2. Repository Implementations (Medium Priority)

#### Retention Repository
- **Location**: `internal/repo/retention_repo.go:43-63`
- **Task**: Implement retention queries in sqlc
- **Methods needed**:
  - CreateRetentionPolicy
  - GetRetentionPolicy
  - UpdateRetentionPolicy
  - DeleteRetentionPolicy
  - ListRetentionPolicies
- **Impact**: Enable data lifecycle management

#### Scheduler Repository Integration
- **Location**: `internal/scheduler/repository.go:47-62`
- **Task**: Update scheduler to use store.Scans() repository
- **Details**: Currently has placeholder implementations
- **Impact**: Proper scan management integration

### 3. Volume Features (Medium Priority)

#### Orphaned Volume Detection
- **Location**: `internal/api/v1/volumes/handler.go:141`
- **Task**: Apply orphaned filter (requires container check)
- **Details**: Cross-reference volumes with container mounts
- **Impact**: Identify unused volumes for cleanup

#### Multi-field Sorting
- **Location**: `internal/api/v1/volumes/handler.go:301`
- **Task**: Implement multi-field sorting for volume list
- **Details**: Currently only supports single field sorting
- **Impact**: Better user experience for large volume lists

#### Volume Timestamps
- **Location**: `internal/api/v1/volumes/handler.go:483`
- **Task**: Add first_seen and last_seen from database
- **Details**: Track when volumes are discovered and last accessed
- **Impact**: Better volume lifecycle management

### 4. Admin/Security Features (Medium Priority)
- **Location**: `internal/api/v1/scan/handler.go:544`
- **Task**: Add admin authentication check when auth is implemented
- **Details**: Dangerous operations should require admin privileges
- **Impact**: Security for administrative operations

### 5. Version Management (Low Priority)
- **Location**: `internal/api/v1/system/handler.go:32, 55`
- **Task**: Get version from build info instead of hardcoding "1.0.0"
- **Details**: Should use build-time variables or version package
- **Impact**: Proper version reporting

### 6. Performance Optimizations (Low Priority)

#### Disk Usage Calculation
- **Location**: `internal/services/filesystem/filesystem_indexer.go:393`
- **Task**: Get actual disk usage instead of file size
- **Details**: Calculate actual blocks used on disk
- **Impact**: More accurate storage reporting

#### Volume Pagination
- **Location**: `internal/services/filesystem/volume_discovery.go:219`
- **Task**: Add pagination for large volume counts
- **Details**: Currently hardcoded to 1000 volumes limit
- **Impact**: Better performance with many volumes

#### Watchdog Improvements
- **Location**: `internal/scheduler/watchdog.go:69`
- **Task**: Track actual last check time
- **Details**: Currently uses current time instead of actual last check
- **Impact**: More accurate monitoring

### 7. Removed Categories

#### ~~Analytics Repository~~ ✅ RESOLVED
- **Status**: No longer needed - DailyStats/StatsService provides all required functionality
- **Resolution**: Removed snapshot system in favor of superior DailyStats architecture

#### ~~Snapshot Service~~ ✅ RESOLVED  
- **Status**: Completely removed as unused
- **Resolution**: DailyStats provides all snapshot functionality with better data model

## Priority Ranking

### High Priority (Should Do Next)
1. **Add health check support to Store interface** - Critical for production monitoring
2. **Create events repository adapter** - Needed for proper event handling

### Medium Priority (Important Improvements)
1. **Implement retention repository** - Data lifecycle management
2. **Update scheduler to use store repositories** - Architecture consistency
3. **Orphaned volume detection** - Operational value
4. **Admin authentication framework** - Security
5. **Volume timestamps tracking** - Operational insights

### Low Priority (Nice to Have)
1. **Version management from build info** - Proper versioning
2. **Multi-field volume sorting** - UX improvement  
3. **Actual disk usage calculation** - More accurate metrics
4. **Volume listing pagination** - Performance for scale
5. **Watchdog improvements** - Better monitoring

## Impact Assessment

### Completed ✅
- **Store package cleanup** - Achieved pure repository pattern
- **Analytics system unification** - Single source of truth via DailyStats
- **Dead code removal** - Eliminated 300+ lines of unused/stub code

### Remaining High-Impact Work
1. **Health checks** - Enable production readiness
2. **Events integration** - Complete store pattern adoption
3. **Retention policies** - Data management capabilities

### Architecture State
- ✅ **Pure repository pattern achieved** in store layer
- ✅ **Clean separation of concerns** between layers  
- ✅ **Unified statistics architecture** via StatsService
- ⚠️ **Some services still need store integration** (events, scheduler)
- ⚠️ **Missing operational features** (health checks, retention)

The codebase is now in a much cleaner state with a solid foundation for future development.