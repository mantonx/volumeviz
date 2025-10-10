# VolumeViz /volumes Endpoint Optimization Project

**Project Status:** Planning
**Start Date:** 2025-10-10
**Expected Duration:** 3 weeks
**Priority:** High
**Owner:** Engineering Team

---

## Executive Summary

### Problem Statement
The `/volumes` API endpoint currently experiences 2-4 second delays due to synchronous Docker API calls. Additionally, network-mounted volumes (NFS, CIFS) do not report size information, requiring manual scan triggers from users.

### Goals
1. Reduce `/volumes` endpoint response time from 2-4s to <100ms (95% improvement)
2. Automatically calculate and store volume sizes for ALL volumes (including network mounts)
3. Eliminate manual scan triggers - make size calculation fully automated and background-driven
4. Create seamless, real-time user experience with progressive data updates

### Success Metrics
- **Performance:** API response time <100ms (currently 2-4s)
- **Coverage:** 100% of volumes have size data (currently ~40%)
- **User Experience:** Zero manual scan triggers needed
- **Scalability:** Support 1000+ volumes without degradation

---

## Current State Analysis

### Architecture Issues

#### 1. Docker API Dependency
**Location:** `internal/api/v1/volumes/handler.go:180`
```go
// Every request hits Docker API - this is the bottleneck
volumes, err := h.dockerService.ListVolumes(ctx)
```

**Impact:**
- 2-4 second latency per request
- 30-second cache helps but still too slow
- Cache only covers disk usage, not full volume metadata

#### 2. Size Data Limitations
**Location:** `internal/api/v1/volumes/handler.go:296-329`
```go
// Synchronous scanning commented out to prevent timeouts
// Users must manually trigger scans
```

**Impact:**
- Network volumes show no size data
- Manual intervention required
- Poor user experience

#### 3. Database Underutilization
**Current Usage:**
- Database stores scan history only
- Docker API is source of truth for volume metadata
- No continuous synchronization

**Opportunity:**
- `volumes` table already has necessary fields
- Can become primary data source
- Background jobs can keep it synchronized

---

## Solution Architecture

### High-Level Design

```
┌─────────────────────────────────────────────────────────────────┐
│                     Background Services                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────────────────────────────────┐            │
│  │  Volume Reconciliation Service                 │            │
│  │  - Runs every 60 seconds                       │            │
│  │  - Syncs Docker → Database                     │            │
│  │  - Updates metadata (name, driver, containers) │            │
│  └────────────────────────────────────────────────┘            │
│                           ↓                                      │
│  ┌────────────────────────────────────────────────┐            │
│  │  Size Calculation Worker Pool                  │            │
│  │  - Queue-based processing                      │            │
│  │  - Prioritization (new volumes first)          │            │
│  │  - Local volumes: Docker API (fast)            │            │
│  │  - Network volumes: Filesystem walk (slower)   │            │
│  └────────────────────────────────────────────────┘            │
│                           ↓                                      │
│  ┌────────────────────────────────────────────────┐            │
│  │  Database (PostgreSQL)                         │            │
│  │  - volumes table (primary data source)         │            │
│  │  - Real-time updates                           │            │
│  └────────────────────────────────────────────────┘            │
│                           ↓                                      │
│  ┌────────────────────────────────────────────────┐            │
│  │  WebSocket Broadcaster                         │            │
│  │  - Real-time updates to frontend               │            │
│  │  - Progressive enhancement                     │            │
│  └────────────────────────────────────────────────┘            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      User-Facing API                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  GET /api/v1/volumes                                            │
│       ↓                                                          │
│  Read from Database (<100ms)                                    │
│       ↓                                                          │
│  Return Response (fast, always fresh)                           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow

**1. Background Reconciliation (Continuous)**
```
Timer (60s) → List Docker Volumes → Upsert to Database → Update Metadata
```

**2. Size Calculation (Prioritized Queue)**
```
Discover Volumes → Check Last Scan → Priority Queue → Calculate Size → Store in DB → Broadcast Update
```

**3. API Request (Fast)**
```
User Request → Query Database → Return Cached Data → Response
```

---

## Implementation Plan

### Phase 1: Database-First Architecture (Week 1)
**Goal:** Make database the primary source of truth
**Duration:** 3 days
**Impact:** 40-80x performance improvement

#### Task 1.1: Volume Reconciliation Service
**File:** `internal/services/volumes/reconciliation_service.go` (new)

**Features:**
- Background service running every 60 seconds
- Lists all Docker volumes
- Upserts to database with:
  - `volume_id`, `display_name`, `mount_point`
  - `container_names[]`, `container_count`
  - `is_active` (lifecycle tracking)
  - `driver`, `filesystem_type`
- Handles volume deletion (marks `is_active = false`)
- Organization-aware for multi-tenancy

**Dependencies:**
- Docker service (existing)
- Volume repository (existing)
- Store interface (existing)

**Acceptance Criteria:**
- [ ] Service starts with application
- [ ] Syncs volumes every 60 seconds
- [ ] Handles Docker API failures gracefully
- [ ] Updates organization associations
- [ ] Logs sync statistics

#### Task 1.2: Volume Sync Scheduler Job
**File:** `internal/scheduler/volume_sync_job.go` (new)

**Features:**
- Integrates with existing scheduler
- Configurable interval
- Metrics collection
- Error handling and retry logic

**Acceptance Criteria:**
- [ ] Integrated with scheduler service
- [ ] Configurable via config file
- [ ] Exposes Prometheus metrics
- [ ] Graceful shutdown support

#### Task 1.3: Refactor /volumes Endpoint
**File:** `internal/api/v1/volumes/handler.go` (modify)

**Changes:**
```go
// BEFORE (Line 180):
volumes, err := h.dockerService.ListVolumes(ctx)

// AFTER:
volumes, err := h.store.Volumes().ListVolumes(ctx, sqlc.ListVolumesParams{
    OrganizationID: pgtype.Int8{Int64: orgID, Valid: true},
    Limit:          int32(pagination.Limit),
    Offset:         int32(pagination.Offset),
})
```

**Benefits:**
- No Docker API calls during user requests
- <100ms response time
- Proper pagination support
- Filter/sort on database side

**Acceptance Criteria:**
- [ ] Endpoint reads from database
- [ ] Response time <100ms
- [ ] All filters work correctly
- [ ] Pagination works
- [ ] Backward compatible response format

#### Task 1.4: Database Query Optimization
**File:** `internal/repo/queries-postgresql/volumes.sql` (enhance)

**Enhancements:**
- Add indexes for common queries
- Optimize JOIN operations
- Add filtered list queries

**Acceptance Criteria:**
- [ ] Queries execute in <50ms
- [ ] Proper indexes created
- [ ] Query plan analyzed

---

### Phase 2: Background Size Calculation (Week 2)
**Goal:** Automatically calculate sizes for all volumes
**Duration:** 4 days
**Impact:** 100% size coverage

#### Task 2.1: Size Calculator Service
**File:** `internal/services/volumes/size_calculator.go` (new)

**Features:**
- Dual-mode calculation:
  - **Local volumes:** Use Docker API `UsageData` (fast, <1s)
  - **Network volumes:** Filesystem walk (slower, 10s-5m)
- Rate limiting to prevent system overload
- Timeout handling
- Progress tracking

**Algorithm:**
```go
func CalculateVolumeSize(volumeID string, driver string, mountpoint string) {
    if driver == "local" {
        // Fast path: Docker API
        size = dockerAPI.GetDiskUsage(volumeID)
    } else {
        // Slow path: Filesystem walk
        size = filepath.Walk(mountpoint, calculateSize)
    }

    // Store in database
    UpdateVolumeStats(volumeID, size)

    // Broadcast to WebSocket
    BroadcastSizeUpdate(volumeID, size)
}
```

**Acceptance Criteria:**
- [ ] Handles local volumes (<1s)
- [ ] Handles network volumes (with timeout)
- [ ] Updates database atomically
- [ ] Respects rate limits
- [ ] Handles errors gracefully

#### Task 2.2: Size Worker Pool
**File:** `internal/services/volumes/size_worker.go` (new)

**Features:**
- Worker pool (configurable, default: 2-3 workers)
- Priority queue:
  1. **High:** New volumes (never scanned)
  2. **Medium:** Volumes with containers attached
  3. **Low:** Orphaned volumes
  4. **Maintenance:** Volumes >30 days since scan
- Intelligent scheduling (avoid peak hours)
- Backoff on errors

**Acceptance Criteria:**
- [ ] Processes volumes in priority order
- [ ] Configurable worker count
- [ ] Handles concurrent scans safely
- [ ] Reschedules on failure
- [ ] Emits metrics

#### Task 2.3: Integration with Existing Scanner
**File:** `internal/services/scanner/volume_scanner.go` (enhance)

**Changes:**
- Add size-only scan mode (skip file indexing)
- Optimize for quick size calculation
- Return results for database storage

**Acceptance Criteria:**
- [ ] Fast size-only mode available
- [ ] Compatible with existing scan jobs
- [ ] Results stored in volumes table

#### Task 2.4: Scheduler Integration
**File:** `internal/scheduler/scheduler.go` (modify)

**Features:**
- Register size calculation jobs
- Prevent duplicate scans
- Track job status

**Acceptance Criteria:**
- [ ] Size jobs integrated with scheduler
- [ ] No conflicts with full scans
- [ ] Proper job deduplication

---

### Phase 3: Smart Caching & Optimization (Week 3)
**Goal:** Further optimize and add polish
**Duration:** 3 days
**Impact:** Reduced database load, better UX

#### Task 3.1: In-Memory Cache Layer
**File:** `internal/services/volumes/cache_service.go` (new)

**Features:**
- LRU cache for frequently accessed volumes
- TTL-based invalidation (30s)
- Event-based invalidation (Docker events)
- Cache statistics

**Acceptance Criteria:**
- [ ] Cache hit rate >80%
- [ ] Invalidation works correctly
- [ ] Memory usage bounded
- [ ] Thread-safe

#### Task 3.2: Real-Time WebSocket Updates
**File:** `internal/realtime/websocket_hub.go` (enhance)

**Features:**
- Broadcast size updates as they're calculated
- Volume metadata change notifications
- Progressive enhancement UI support

**Acceptance Criteria:**
- [ ] Size updates broadcast in real-time
- [ ] Frontend receives updates
- [ ] Connection handling robust

#### Task 3.3: Metrics & Monitoring
**Files:**
- `internal/services/volumes/metrics.go` (new)
- Enhance existing Prometheus metrics

**Metrics to track:**
- Reconciliation cycle time
- Size calculation queue depth
- Size calculation duration (p50, p95, p99)
- Cache hit rate
- API response time

**Acceptance Criteria:**
- [ ] All metrics exposed
- [ ] Grafana dashboard created
- [ ] Alerts configured

#### Task 3.4: Configuration Management
**File:** `internal/config/volumes_config.go` (new)

**Configuration options:**
```yaml
volumes:
  reconciliation:
    enabled: true
    interval: 60s

  size_calculation:
    enabled: true
    workers: 3
    queue_size: 100
    scan_interval: 24h
    timeout: 10m

  cache:
    enabled: true
    ttl: 30s
    max_size: 1000
```

**Acceptance Criteria:**
- [ ] All features configurable
- [ ] Sensible defaults
- [ ] Runtime configuration reload
- [ ] Validation on startup

---

## Database Schema

### Existing Schema (No changes needed!)
```sql
CREATE TABLE volumes (
    volume_id TEXT PRIMARY KEY,
    display_name TEXT,
    mount_point TEXT NOT NULL,
    container_names TEXT[],
    is_active BOOLEAN DEFAULT TRUE,

    -- Size fields (we'll populate these)
    total_size_bytes BIGINT DEFAULT 0,
    used_size_bytes BIGINT DEFAULT 0,
    free_size_bytes BIGINT DEFAULT 0,
    filesystem_type TEXT,

    container_count INTEGER DEFAULT 0,

    -- Timestamps
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_scan_at TIMESTAMPTZ,
    last_modified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    -- Multi-tenancy
    organization_id BIGINT REFERENCES organizations(id)
);
```

### Optional Enhancements
```sql
-- Index for faster queries on active volumes
CREATE INDEX IF NOT EXISTS idx_volumes_active_org
    ON volumes(organization_id, is_active)
    WHERE is_active = true;

-- Index for size calculation scheduling
CREATE INDEX IF NOT EXISTS idx_volumes_last_scan
    ON volumes(last_scan_at NULLS FIRST)
    WHERE is_active = true;

-- Index for driver-based queries
CREATE INDEX IF NOT EXISTS idx_volumes_driver
    ON volumes(driver)
    WHERE is_active = true;
```

---

## Configuration

### New Config Section
**File:** `internal/config/config.go`

```go
type Config struct {
    // ... existing fields ...

    Volumes VolumeServiceConfig `mapstructure:"volumes"`
}

type VolumeServiceConfig struct {
    // Reconciliation
    ReconcileEnabled  bool          `mapstructure:"reconcile_enabled" default:"true"`
    ReconcileInterval time.Duration `mapstructure:"reconcile_interval" default:"60s"`

    // Size calculation
    SizeEnabled        bool          `mapstructure:"size_enabled" default:"true"`
    SizeWorkerCount    int           `mapstructure:"size_worker_count" default:"3"`
    SizeQueueSize      int           `mapstructure:"size_queue_size" default:"100"`
    SizeScanInterval   time.Duration `mapstructure:"size_scan_interval" default:"24h"`
    SizeTimeout        time.Duration `mapstructure:"size_timeout" default:"10m"`
    MaxConcurrentScans int           `mapstructure:"max_concurrent_scans" default:"3"`

    // Cache
    CacheEnabled bool          `mapstructure:"cache_enabled" default:"true"`
    CacheTTL     time.Duration `mapstructure:"cache_ttl" default:"30s"`
    CacheMaxSize int           `mapstructure:"cache_max_size" default:"1000"`
}
```

---

## Testing Strategy

### Unit Tests
**Coverage target:** >80%

**Key test files:**
- `internal/services/volumes/reconciliation_service_test.go`
- `internal/services/volumes/size_calculator_test.go`
- `internal/services/volumes/size_worker_test.go`
- `internal/services/volumes/cache_service_test.go`

**Test cases:**
- Volume reconciliation with Docker API changes
- Size calculation for local vs network volumes
- Priority queue ordering
- Cache invalidation logic
- Error handling and retries

### Integration Tests
**File:** `internal/services/volumes/integration_test.go`

**Scenarios:**
- Full reconciliation cycle
- Size calculation end-to-end
- Database consistency
- WebSocket notifications

### Performance Tests
**File:** `internal/api/v1/volumes/performance_test.go`

**Benchmarks:**
- `/volumes` endpoint response time
- Database query performance
- Cache effectiveness
- Concurrent request handling

**Targets:**
- `/volumes` response time: <100ms (p95)
- Database queries: <50ms (p95)
- Cache hit rate: >80%
- Support 100 concurrent requests

### Load Tests
**Tool:** k6 or vegeta

**Scenarios:**
- 1000 volumes in database
- 50 concurrent users
- Sustained load for 10 minutes

**Acceptance criteria:**
- Response time <100ms maintained
- No memory leaks
- No database connection exhaustion

---

## Deployment Plan

### Phase 1 Deployment (Week 1)
**Components:**
- Reconciliation service
- Database schema indexes
- Updated `/volumes` endpoint

**Steps:**
1. Deploy database migrations (indexes)
2. Deploy new reconciliation service
3. Monitor for 24h with old endpoint still active
4. Switch `/volumes` endpoint to database-first
5. Monitor metrics

**Rollback plan:**
- Revert endpoint to Docker API if issues
- Reconciliation service can be stopped safely

### Phase 2 Deployment (Week 2)
**Components:**
- Size calculation worker
- Scheduler integration

**Steps:**
1. Deploy size calculator service
2. Enable for 10% of volumes (canary)
3. Monitor queue depth and performance
4. Gradually increase to 100%

**Rollback plan:**
- Disable size workers via config
- Existing scans unaffected

### Phase 3 Deployment (Week 3)
**Components:**
- Cache layer
- WebSocket enhancements
- Metrics

**Steps:**
1. Enable cache with monitoring
2. Deploy WebSocket updates
3. Set up Grafana dashboards
4. Configure alerts

---

## Monitoring & Metrics

### Key Metrics

#### Performance
- `volumeviz_volumes_api_duration_seconds{endpoint="/volumes"}` - API response time
- `volumeviz_volume_reconcile_duration_seconds` - Reconciliation cycle time
- `volumeviz_volume_size_calc_duration_seconds` - Size calculation time
- `volumeviz_volume_cache_hit_rate` - Cache effectiveness

#### Queue Health
- `volumeviz_volume_size_queue_depth` - Pending size calculations
- `volumeviz_volume_size_queue_processing_rate` - Throughput
- `volumeviz_volume_size_queue_age_seconds` - Oldest item in queue

#### System Health
- `volumeviz_volume_reconcile_errors_total` - Reconciliation failures
- `volumeviz_volume_size_calc_errors_total` - Size calculation failures
- `volumeviz_volume_size_calc_timeouts_total` - Timeout count

### Alerts

**Critical:**
- API response time >500ms for 5 minutes
- Reconciliation failing for >5 minutes
- Size queue depth >500 items

**Warning:**
- API response time >200ms
- Cache hit rate <70%
- Size calculation timeout rate >10%

### Dashboards

**Dashboard 1: Volume API Performance**
- API response time (p50, p95, p99)
- Request rate
- Error rate
- Cache hit rate

**Dashboard 2: Background Services**
- Reconciliation cycle time
- Size calculation throughput
- Queue depth over time
- Worker utilization

**Dashboard 3: Volume Statistics**
- Total volumes
- Volumes with size data (%)
- Size calculation coverage by driver
- Age of oldest un-scanned volume

---

## Risk Assessment

### Technical Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Database becomes bottleneck | High | Low | Proper indexing, query optimization, caching |
| Network volume scans timeout | Medium | Medium | Configurable timeouts, retry logic, skip on failure |
| Memory usage from cache | Medium | Low | LRU with max size, monitoring |
| Docker API rate limiting | Low | Low | Reconciliation uses single API call per cycle |
| Migration breaks existing functionality | High | Low | Feature flags, gradual rollout, comprehensive testing |

### Operational Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Increased CPU from background jobs | Medium | Medium | Rate limiting, configurable worker count |
| Disk I/O from size calculations | Medium | Medium | Throttling, schedule during off-peak |
| Database connection pool exhaustion | High | Low | Connection pooling config, monitoring |

---

## Success Criteria

### Must Have (Phase 1)
- [x] `/volumes` endpoint response time <100ms
- [x] Database as primary source of truth
- [x] Background reconciliation working
- [x] Zero breaking changes to API contract

### Should Have (Phase 2)
- [ ] 100% of volumes have size data
- [ ] Automatic size calculation without user triggers
- [ ] Network volumes supported
- [ ] Prioritized scanning queue

### Nice to Have (Phase 3)
- [ ] Real-time WebSocket updates
- [ ] In-memory caching
- [ ] Grafana dashboards
- [ ] <50ms API response time

---

## Timeline

```
Week 1: Database-First Architecture
├─ Day 1-2: Reconciliation service
├─ Day 3:   Scheduler integration
├─ Day 4:   Refactor endpoint
└─ Day 5:   Testing & deployment

Week 2: Background Size Calculation
├─ Day 1:   Size calculator service
├─ Day 2-3: Worker pool & prioritization
├─ Day 4:   Scheduler integration
└─ Day 5:   Testing & deployment

Week 3: Optimization & Polish
├─ Day 1:   Cache layer
├─ Day 2:   WebSocket updates
├─ Day 3:   Metrics & monitoring
└─ Day 4-5: Load testing & docs
```

---

## Dependencies

### Internal
- Existing Docker service
- Volume repository
- Scheduler service
- WebSocket broadcaster
- Store interface

### External
- Docker Engine API
- PostgreSQL database
- Prometheus (metrics)
- Grafana (dashboards)

---

## Future Enhancements

### Post-MVP Features
1. **Incremental size updates** - Only re-scan changed files
2. **Predictive scheduling** - Learn usage patterns, scan during low traffic
3. **Size estimation** - Use historical data to estimate before full scan
4. **Compression analysis** - Identify compressible data
5. **Duplicate detection** - Find duplicate files across volumes
6. **Smart pruning** - Suggest volumes for cleanup based on usage

### API Enhancements
1. **Batch operations** - Bulk size refresh
2. **Webhooks** - Notify external systems of size changes
3. **GraphQL** - More flexible querying
4. **Export** - CSV/JSON export of volume data

---

## References

### Related Documents
- [Architecture Decision Record: Database-First Volumes](./ADR-VOLUMES-DB-FIRST.md) (to be created)
- [API Documentation](../docs/openapi-3.0.yaml)
- [Database Schema](../migrations/postgresql/current_schema.sql)

### Code References
- Volume Handler: `internal/api/v1/volumes/handler.go`
- Docker Service: `internal/services/docker/docker_service.go`
- Scheduler: `internal/scheduler/scheduler.go`
- Volume Repository: `internal/repo/volumes_repo.go`

---

## Appendix A: File Structure

```
internal/
├── services/
│   └── volumes/
│       ├── reconciliation_service.go      [NEW] Phase 1
│       ├── reconciliation_service_test.go [NEW] Phase 1
│       ├── size_calculator.go             [NEW] Phase 2
│       ├── size_calculator_test.go        [NEW] Phase 2
│       ├── size_worker.go                 [NEW] Phase 2
│       ├── size_worker_test.go            [NEW] Phase 2
│       ├── cache_service.go               [NEW] Phase 3
│       ├── cache_service_test.go          [NEW] Phase 3
│       ├── metrics.go                     [NEW] Phase 3
│       └── integration_test.go            [NEW] Phase 3
├── scheduler/
│   ├── volume_sync_job.go                 [NEW] Phase 1
│   └── volume_sync_job_test.go            [NEW] Phase 1
├── api/v1/volumes/
│   ├── handler.go                         [MODIFY] Phase 1
│   └── performance_test.go                [NEW] Phase 1
├── config/
│   └── volumes_config.go                  [NEW] Phase 3
└── repo/queries-postgresql/
    └── volumes.sql                        [ENHANCE] Phase 1
```

---

## Appendix B: API Contract Changes

**No breaking changes!** All existing endpoints remain compatible.

### Enhanced Response (Progressive)
```json
{
  "data": [
    {
      "name": "volumeviz_movies_dev",
      "driver": "local",
      "size_bytes": 1234567890,
      "last_scan_at": "2025-10-10T10:30:00Z",
      "scan_status": "completed",  // NEW: real-time status
      "size_source": "background"  // NEW: "docker_api" | "background" | "manual"
    }
  ]
}
```

### New WebSocket Events
```json
{
  "type": "volume.size.updated",
  "volume_id": "volumeviz_movies_dev",
  "size_bytes": 1234567890,
  "timestamp": "2025-10-10T10:30:00Z"
}
```

---

**Document Version:** 1.0
**Last Updated:** 2025-10-10
**Next Review:** After Phase 1 completion
