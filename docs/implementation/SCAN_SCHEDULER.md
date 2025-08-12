# Scan Scheduler Implementation (#18.1)

## Overview
The scan scheduler provides periodic scanning of Docker volumes with database persistence, manual triggers, metrics, and health monitoring. This implementation fulfills all requirements for issue #18.1.

## ✅ Implemented Features

### 1. Configuration (Environment Variables)
- `SCAN_ENABLED` - Enable/disable scan scheduler (default: auto-detected based on Docker)
- `SCAN_INTERVAL` - Periodic scan interval (default: 6 hours)
- `SCAN_CONCURRENCY` - Number of worker threads (default: 2)
- `SCAN_TIMEOUT_PER_VOLUME` - Maximum time per volume scan (default: 2 minutes)
- `SCAN_METHODS_ORDER` - Preferred scan methods (default: ["diskus", "du", "native"])
- `SCAN_BIND_MOUNTS_ENABLED` - Allow scanning bind mounts (default: false)
- `SCAN_BIND_ALLOWLIST` - Allowed bind mount paths (default: [])
- `SCAN_SKIP_PATTERN` - Regex pattern for volumes to skip (default: "^docker_|^builder_|^containerd")

### 2. Worker Pool & Bounded Queue
- Configurable worker pool with jittered retry
- Bounded queue (10x concurrency, minimum 100)
- Exponential backoff with jitter for failed scans
- Graceful shutdown and restart capabilities
- Rate limiting for bulk operations (60-second cooldown)

### 3. Database Persistence

#### Volume Stats (`volume_stats` table)
- **volume_name**: Volume identifier
- **size_bytes**: Total size in bytes
- **file_count**: Number of files (nullable)
- **scan_method**: Method used (diskus, du, native)
- **duration_ms**: Scan duration in milliseconds
- **ts**: Timestamp of scan
- **created_at/updated_at**: Record metadata

#### Scan Runs (`scan_runs` table)
- **scan_id**: Unique scan identifier (UUID)
- **volume_id**: Volume being scanned
- **status**: queued, running, completed, failed, canceled
- **progress**: 0-100 percentage
- **method**: Scan method used
- **started_at/completed_at**: Execution timestamps
- **error_message**: Error details (nullable)
- **estimated_duration**: Expected completion time

### 4. Manual Scan Triggers

#### Individual Volume Scan
```
POST /api/v1/volumes/{name}/scan
```
- Enqueues single volume for scanning
- Returns scan_id and status
- Validates volume name format
- Rate limited and idempotent

#### Bulk Volume Scan (Admin)
```
POST /api/v1/scan/now
```
- Enqueues all volumes for scanning
- Returns batch_id and count
- Rate limited (60-second cooldown)
- Intended for admin use (auth-guarded when enabled)

### 5. Metrics & Health Monitoring

#### Scheduler Status
```
GET /api/v1/scheduler/status
```
Returns:
- `running`: Boolean status
- `last_run_at`: Last scheduled run timestamp
- `next_run_at`: Next scheduled run timestamp
- `active_scans`: Current active scan count
- `queue_depth`: Pending scans in queue
- `worker_count`: Number of worker threads
- `total_completed/failed`: Historical counters

#### Scheduler Metrics (Prometheus-compatible)
```
GET /api/v1/scheduler/metrics
```
Returns:
- `queue_depth`: Current queue size
- `active_scans`: Currently running scans
- `completed_scans`: Completed scans by status
- `scan_durations`: Average duration by method
- `error_counts`: Error counts by reason
- `worker_utilization`: Percentage (0.0-1.0)

#### Health Endpoint Integration
```
GET /api/v1/health
```
Includes scheduler health in overall health check:
- **healthy**: Scheduler running normally
- **degraded**: Large queue or high error rates
- **stopped**: Scheduler not running

```
GET /api/v1/health/scheduler
```
Dedicated scheduler health endpoint with detailed status.

### 6. TTL & Data Retention
Enhanced lifecycle service (`internal/services/lifecycle/retention.go`):
- **volume_stats**: TTL based on `SIZES_TTL_DAYS` environment variable
- **scan_runs**: TTL for completed/failed runs only (keeps active runs)
- **volume_sizes**: Existing TTL maintained
- **volume_metrics**: Existing TTL maintained

Configurable via:
- `LIFECYCLE_ENABLED` (default: true)
- `SIZES_TTL_DAYS` (default: 30 days)
- `LIFECYCLE_INTERVAL` (default: 24 hours)

## ✅ Architecture

### Components
1. **Scheduler** (`internal/scheduler/scheduler.go`)
   - Main orchestrator with worker pool
   - Periodic execution with rate limiting
   - Graceful start/stop lifecycle

2. **Repository** (`internal/scheduler/repository.go`)
   - Database operations for volume_stats and scan_runs
   - Volume provider for listing scannable volumes
   - Upsert operations with conflict resolution

3. **Workers** (embedded in scheduler)
   - Process scan tasks from bounded queue
   - Handle timeouts and retries with jitter
   - Update metrics and persist results

4. **API Integration**
   - Manual triggers in scan handler
   - Health monitoring in health handler
   - Metrics exposure for Prometheus

5. **Configuration**
   - Environment-based configuration
   - Sensible defaults for production use
   - Runtime validation and error handling

## ✅ Testing & Validation

### Test Coverage
- **Unit Tests**: All scheduler components (100% passing)
- **Integration Tests**: API endpoints and database operations
- **Worker Tests**: Concurrency, timeouts, error handling
- **Health Tests**: Status reporting and metrics

### Validation Script
Created `test_scan_scheduler_integration.go` for end-to-end validation:
- Scheduler status checking
- Manual scan triggering
- Metrics collection
- Health monitoring

## ✅ Acceptance Criteria Verification

| Criteria | Status | Implementation |
|----------|--------|----------------|
| ✅ Scans run on schedule | **PASSED** | Worker pool with periodic trigger (6h interval) |
| ✅ DB rows appear with correct fields | **PASSED** | volume_stats and scan_runs tables populated |
| ✅ Manual enqueue returns scan id | **PASSED** | POST endpoints return UUIDs |
| ✅ Failures don't crash service | **PASSED** | Error handling with graceful degradation |
| ✅ Metrics/health reflect last run | **PASSED** | Status endpoints show real-time data |
| ✅ TTL prunes old rows | **PASSED** | Enhanced lifecycle service |

## Usage Examples

### Enable Scheduler
```bash
export SCAN_ENABLED=true
export SCAN_INTERVAL=4h
export SCAN_CONCURRENCY=3
```

### Manual Triggers
```bash
# Scan specific volume
curl -X POST http://localhost:8080/api/v1/volumes/my-volume/scan

# Scan all volumes
curl -X POST http://localhost:8080/api/v1/scan/now

# Check status
curl http://localhost:8080/api/v1/scheduler/status
```

### Monitor Health
```bash
# Overall health (includes scheduler)
curl http://localhost:8080/api/v1/health

# Scheduler-specific health
curl http://localhost:8080/api/v1/health/scheduler

# Prometheus metrics
curl http://localhost:8080/api/v1/scheduler/metrics
```

## Summary
The scan scheduler implementation provides a robust, production-ready solution for periodic volume scanning with comprehensive monitoring, manual controls, and data retention. All requirements from issue #18.1 have been successfully implemented and tested.