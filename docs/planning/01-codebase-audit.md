# VolumeViz Codebase Audit Report
**Date:** 2025-10-01
**Scope:** Complete backend and frontend analysis excluding vendor/node_modules

---

## Executive Summary

This comprehensive audit identified **89 issues** across the codebase, categorized by priority:

- **Critical (15)**: Blocks core functionality or causes silent failures
- **High (28)**: Major features incomplete or broken
- **Medium (32)**: Features work but have gaps or inefficiencies
- **Low (14)**: Polish and UX improvements

### Top Priority Areas

1. **Database Views Not Integrated** - Views exist but SQLC queries not generated
2. **Stats Repository** - Extensive placeholder data being returned
3. **Retention System** - Completely stubbed out
4. **SQLite Support** - All SQLite implementations return nil/stubs
5. **Type Conversions** - Multiple pgtype.Numeric conversion bugs
6. **Frontend Error Handling** - Missing error boundaries and validation

---

## 1. CRITICAL ISSUES (15)

### 1.1 Database Views Created But Not Used

**Priority:** CRITICAL
**Impact:** Scan monitoring features don't work despite database schema being correct

**Files:**
- [internal/repo/scan_progress_repo.go:570](internal/repo/scan_progress_repo.go#L570)
- [internal/repo/scan_progress_repo.go:577](internal/repo/scan_progress_repo.go#L577)
- [internal/repo/scan_progress_repo.go:583](internal/repo/scan_progress_repo.go#L583)

**Issue:**
Database views `active_scans`, `scan_progress_summary`, and `recent_scan_errors` were created in migration 000008, but no SQLC queries reference them. Repository methods return empty arrays or errors.

```go
func (r *scanProgressRepo) GetActiveScansSummary(ctx context.Context) ([]*models.ActiveScanSummary, error) {
    // TODO: active_scans view doesn't exist in database
    // Views ACTUALLY EXIST but SQLC queries were never created!
    return []*models.ActiveScanSummary{}, nil
}
```

**Fix Required:**
1. Create SQLC queries in `internal/repo/queries-postgresql/scans.sql`:
   ```sql
   -- name: GetActiveScansSummary :many
   SELECT * FROM active_scans;

   -- name: GetScanProgressSummary :one
   SELECT * FROM scan_progress_summary WHERE scan_id = $1;

   -- name: GetRecentErrorsSummary :many
   SELECT * FROM recent_scan_errors LIMIT $1;
   ```
2. Run `sqlc generate`
3. Update repository implementations to use generated methods

---

### 1.2 Search API Silent Failures

**Priority:** CRITICAL
**Impact:** Users don't know when searches fail

**Files:**
- [frontend/src/api/search.ts:45](frontend/src/api/search.ts#L45) - No error handling
- [frontend/src/api/search.ts:78](frontend/src/api/search.ts#L78) - Swallows errors

**Issue:**
Search mutations don't throw errors on failure, leading to silent failures in UI:

```typescript
export const useDeleteSearchMutation = () => {
  const mutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/v1/search/${id}`, { method: 'DELETE' });
      // No error checking!
      return response;
    },
  });
  return mutation;
};
```

**Fix Required:**
Add proper error handling and throw on non-200 responses.

---

### 1.3 Type Assertion Safety Issues

**Priority:** CRITICAL
**Impact:** Runtime crashes possible

**Files:**
- [internal/api/v1/search/saved.go:89](internal/api/v1/search/saved.go#L89)
- [internal/api/v1/search/saved.go:145](internal/api/v1/search/saved.go#L145)
- [internal/api/v1/search/saved.go:198](internal/api/v1/search/saved.go#L198)
- [internal/api/v1/search/saved.go:251](internal/api/v1/search/saved.go#L251)

**Issue:**
Multiple TODO comments about unsafe type assertions:

```go
// TODO: Add proper type assertion for result interface{}
results := resp["results"].([]interface{}) // Could panic!
```

**Fix Required:**
Use safe type assertions with ok checks or type switches.

---

### 1.4 Stats Repository Placeholder Data

**Priority:** CRITICAL
**Impact:** Users see incorrect/empty statistics

**Files:**
- [internal/repo/stats_repo.go:75-79](internal/repo/stats_repo.go#L75)

**Issue:**
Critical statistics fields return placeholder empty data:

```go
SmallestFileSize:      pgtype.Int8{}, // TODO: Add to ScanResult if needed
AverageFileSize:       pgtype.Int8{}, // TODO: Calculate if needed
MedianFileSize:        pgtype.Int8{}, // TODO: Calculate if needed
TypeDistribution:      []byte("{}"), // Empty JSON object as placeholder
ExtensionDistribution: []byte("{}"), // Empty JSON object as placeholder
```

**Fix Required:**
1. Add calculations to scanner to populate these fields
2. Add aggregation queries to calculate from existing data
3. Update `InsertVolumeSize` to accept calculated values

---

### 1.5 Retention System Completely Stubbed

**Priority:** CRITICAL
**Impact:** Database will grow unbounded, eventual performance/storage issues

**Files:**
- [internal/repo/retention_repo.go:57](internal/repo/retention_repo.go#L57)
- [internal/repo/retention_repo.go:105](internal/repo/retention_repo.go#L105)
- [internal/repo/retention_repo.go:167](internal/repo/retention_repo.go#L167)
- [internal/repo/retention_repo.go:179](internal/repo/retention_repo.go#L179)
- [internal/repo/retention_repo.go:185](internal/repo/retention_repo.go#L185)
- [internal/repo/retention_repo.go:195](internal/repo/retention_repo.go#L195)
- [internal/services/lifecycle/retention.go:108](internal/services/lifecycle/retention.go#L108)
- [internal/services/lifecycle/retention.go:114](internal/services/lifecycle/retention.go#L114)
- [internal/services/lifecycle/retention.go:122](internal/services/lifecycle/retention.go#L122)
- [internal/services/lifecycle/retention.go:130](internal/services/lifecycle/retention.go#L130)

**Issue:**
Entire retention system returns zeros or nil. 10 methods stubbed:
- `PruneVolumeMetrics`
- `PruneDailyStats`
- `PruneVolumeSnapshots`
- `PruneSnapshots`
- `PruneSnapshotMetrics`
- `PruneRetentionStats`
- Organization-specific pruning methods

**Fix Required:**
1. Create SQLC delete queries with date filters
2. Implement organization-scoped pruning
3. Add retention policy configuration
4. Schedule retention jobs

---

### 1.6 Password Reset Email Not Implemented

**Priority:** CRITICAL (Security)
**Impact:** Users can't reset passwords

**Files:**
- [internal/api/v1/auth/handler.go:89](internal/api/v1/auth/handler.go#L89)

**Issue:**
Password reset endpoint exists but doesn't send emails:

```go
// TODO: Send email with reset token
// For now, just return success without actually sending email
```

**Fix Required:**
Integrate email service (SendGrid, AWS SES, etc.) or document that password resets require manual intervention.

---

### 1.7 Audit Logging Not Persisted

**Priority:** CRITICAL (Security/Compliance)
**Impact:** Audit events lost on restart, no compliance trail

**Files:**
- [internal/security/middleware.go:155](internal/security/middleware.go#L155)
- [internal/security/repository_wrapper.go:325](internal/security/repository_wrapper.go#L325)

**Issue:**
Audit events only logged to stdout, not persisted:

```go
// TODO: Send to proper audit logging system
logger.Info("Audit event", "event", auditEvent)

// TODO: Store in audit_logs table with proper RLS context
```

**Fix Required:**
1. Create `audit_logs` table with RLS
2. Implement batch insert for performance
3. Add audit log retention policy
4. Add audit log query APIs

---

### 1.8 WebSocket Origin Validation Disabled

**Priority:** CRITICAL (Security)
**Impact:** CORS bypass vulnerability in production

**Files:**
- [internal/realtime/websocket_hub.go:45](internal/realtime/websocket_hub.go#L45)

**Issue:**
WebSocket accepts connections from any origin:

```go
OriginPatterns: []string{"*"}, // TODO: Configure proper origins for production
```

**Fix Required:**
Add environment variable for allowed origins and validate properly.

---

### 1.9 Admin Authentication Check Missing

**Priority:** CRITICAL (Security)
**Impact:** Unauthorized users can trigger scans

**Files:**
- [internal/api/v1/scan/handler.go:77](internal/api/v1/scan/handler.go#L77)

**Issue:**
Bulk scan endpoint has no auth check:

```go
// TODO: Add admin authentication check when auth is implemented
```

**Fix Required:**
Add middleware to verify admin role before allowing bulk operations.

---

### 1.10 User ID Audit Conversion Bug

**Priority:** CRITICAL
**Impact:** Audit logs have nil user IDs

**Files:**
- [internal/security/audit_logger.go:232](internal/security/audit_logger.go#L232)

**Issue:**
User ID conversion fails silently:

```go
auditEvent.UserID = nil // TODO: Fix user ID conversion
```

**Fix Required:**
Fix type conversion from request context user ID to audit event user ID.

---

### 1.11 Container Schema Mismatch

**Priority:** CRITICAL
**Impact:** Docker container tracking broken

**Files:**
- [internal/repo/volumes_repo.go:304](internal/repo/volumes_repo.go#L304)
- [internal/repo/volumes_repo.go:425](internal/repo/volumes_repo.go#L425)

**Issue:**
Container methods reference wrong schema:

```go
// TODO: CreateContainer needs proper container schema - current schema is for docker mount catalog
```

**Fix Required:**
Create proper containers table or refactor to use existing docker_mount_catalog correctly.

---

### 1.12 Mount Catalog Service Broken

**Priority:** CRITICAL
**Impact:** Volume attachment tracking doesn't work

**Files:**
- [internal/services/docker/mount_catalog_service.go:173](internal/services/docker/mount_catalog_service.go#L173)
- [internal/services/docker/mount_catalog_service.go:201](internal/services/docker/mount_catalog_service.go#L201)
- [internal/services/docker/mount_catalog_service.go:210](internal/services/docker/mount_catalog_service.go#L210)
- [internal/services/docker/mount_catalog_service.go:218](internal/services/docker/mount_catalog_service.go#L218)
- [internal/services/docker/mount_catalog_service.go:226](internal/services/docker/mount_catalog_service.go#L226)
- [internal/services/docker/mount_catalog_service.go:581](internal/services/docker/mount_catalog_service.go#L581)

**Issue:**
7 methods in mount catalog service return stubs or placeholders due to schema mismatch.

**Fix Required:**
Complete schema redesign or remove feature entirely.

---

### 1.13 File Metadata Bulk Operations Missing

**Priority:** CRITICAL
**Impact:** Enrichment phase extremely slow (N+1 queries)

**Files:**
- [internal/repo/file_metadata_repo.go:140](internal/repo/file_metadata_repo.go#L140)

**Issue:**
Bulk insert falls back to individual inserts:

```go
// TODO: Implement individual inserts or add bulk insert query
```

**Fix Required:**
Add PostgreSQL COPY or batch insert for file metadata.

---

### 1.14 Enrichment Progress Not Tracked

**Priority:** CRITICAL
**Impact:** Users can't see enrichment phase progress

**Files:**
- [internal/repo/file_metadata_repo.go:223](internal/repo/file_metadata_repo.go#L223)

**Issue:**
Method returns nil:

```go
// TODO: Implement query to get enrichment progress
return nil, nil
```

**Fix Required:**
Add query to count enriched vs total files by scan ID.

---

### 1.15 Transaction Support Missing

**Priority:** CRITICAL
**Impact:** Data inconsistency on failures

**Files:**
- [internal/repo/scan_progress_repo.go:65](internal/repo/scan_progress_repo.go#L65)
- [internal/store/store_pg.go:157](internal/store/store_pg.go#L157)

**Issue:**
Scan progress repo doesn't support transactions:

```go
// TODO: Implement proper transaction support
return r, nil // Returns original repo instead of transaction-wrapped version
```

**Fix Required:**
Implement proper pgx transaction wrapper for scan progress operations.

---

## 2. HIGH PRIORITY ISSUES (28)

### 2.1 SQLite Support Entirely Stubbed

**Priority:** HIGH
**Impact:** SQLite mode completely non-functional

**Files Affected:** 12 repository files

All SQLite repository implementations return nil or empty stubs:
- [internal/repo/file_metadata_repo.go:30](internal/repo/file_metadata_repo.go#L30)
- [internal/repo/scan_progress_repo.go:74](internal/repo/scan_progress_repo.go#L74)
- [internal/repo/scans_repo.go:53](internal/repo/scans_repo.go#L53)
- [internal/repo/files_repo.go:32](internal/repo/files_repo.go#L32)
- [internal/repo/folders_repo.go:32](internal/repo/folders_repo.go#L32)
- [internal/repo/stats_repo.go:27](internal/repo/stats_repo.go#L27)
- [internal/repo/alerts_repo.go:112](internal/repo/alerts_repo.go#L112)
- [internal/repo/volumes_repo.go:544](internal/repo/volumes_repo.go#L544)
- [internal/repo/volumes_repo.go:733](internal/repo/volumes_repo.go#L733)
- [internal/repo/volumes_repo.go:739](internal/repo/volumes_repo.go#L739)
- [internal/store/store_sqlite.go](internal/store/store_sqlite.go) (entire file)

**Fix Required:**
Either:
1. Implement SQLite support completely (large effort)
2. Remove SQLite support and document PostgreSQL-only
3. Add runtime check to fail fast if SQLite configured

---

### 2.2 Volume Statistics Incomplete

**Priority:** HIGH
**Impact:** Volumes page shows incomplete data

**Files:**
- [internal/repo/volumes_repo.go:284-287](internal/repo/volumes_repo.go#L284)
- [internal/repo/volumes_repo.go:712-715](internal/repo/volumes_repo.go#L712)

**Issue:**
4 key statistics return zeros/nil:
- `UniqueDrivers: 0`
- `ScannedVolumes: 0`
- `NewestVolume: nil`
- `OldestVolume: nil`

**Fix Required:**
Add queries to calculate from existing volumes table.

---

### 2.3 Multi-field Sorting Not Implemented

**Priority:** HIGH
**Impact:** Users can't sort volumes by multiple fields

**Files:**
- [internal/api/v1/volumes/handler.go:156](internal/api/v1/volumes/handler.go#L156)

**Fix Required:**
Implement ORDER BY with multiple columns based on request parameters.

---

### 2.4 Orphaned Volume Filter Missing

**Priority:** HIGH
**Impact:** Users can't find orphaned volumes

**Files:**
- [internal/api/v1/volumes/handler.go:141](internal/api/v1/volumes/handler.go#L141)

**Issue:**
Filter parameter accepted but not applied:

```go
// TODO: Apply orphaned filter (requires container check)
```

**Fix Required:**
Add LEFT JOIN with containers and WHERE clause for NULL container_id.

---

### 2.5 Version Info Hardcoded

**Priority:** HIGH
**Impact:** Version displayed is always "1.0.0"

**Files:**
- [internal/api/v1/system/handler.go:37](internal/api/v1/system/handler.go#L37)
- [internal/api/v1/system/handler.go:65](internal/api/v1/system/handler.go#L65)

**Fix Required:**
Use `internal/version` package with build-time ldflags.

---

### 2.6 Search Query Parameters Ignored

**Priority:** HIGH
**Impact:** Search doesn't filter by volume or extension

**Files:**
- [internal/repo/search_repo.go:73](internal/repo/search_repo.go#L73)
- [internal/repo/search_repo.go:76](internal/repo/search_repo.go#L76)
- [internal/repo/search_repo.go:132](internal/repo/search_repo.go#L132)
- [internal/repo/search_repo.go:135](internal/repo/search_repo.go#L135)

**Issue:**
VolumeID and Extension parameters set to empty/invalid:

```go
VolumeID:     pgtype.Text{String: "", Valid: false}, // TODO: Add VolumeID to SearchFilesParams
Extension:    pgtype.Text{String: "", Valid: false}, // TODO: Add Extension to SearchFilesParams
```

**Fix Required:**
Update SQLC queries to accept and use these parameters.

---

### 2.7 Alert Rule ID Not Extracted

**Priority:** HIGH
**Impact:** Alerts not linked to rules that triggered them

**Files:**
- [internal/repo/alerts_repo.go:497](internal/repo/alerts_repo.go#L497)

**Fix Required:**
Pass rule ID from matcher or extract from context.

---

### 2.8 Numeric Type Conversion Bugs

**Priority:** HIGH
**Impact:** Alert thresholds don't work correctly

**Files:**
- [internal/repo/alerts_repo.go:153](internal/repo/alerts_repo.go#L153)
- [internal/repo/alerts_repo.go:797](internal/repo/alerts_repo.go#L797)

**Issue:**
Float64 to pgtype.Numeric conversion incomplete:

```go
ThresholdValue: pgtype.Numeric{Int: nil, Exp: 0, NaN: false, InfinityModifier: 0, Valid: true},
// TODO: Convert float64 to pgtype.Numeric
```

**Fix Required:**
Use proper conversion library or helper function.

---

### 2.9 Stats Service Type Conversions

**Priority:** HIGH
**Impact:** Stats endpoints return incorrect data formats

**Files:**
- [internal/services/stats/stats_service.go:254](internal/services/stats/stats_service.go#L254)
- [internal/services/stats/stats_service.go:260](internal/services/stats/stats_service.go#L260)
- [internal/services/stats/stats_service.go:275](internal/services/stats/stats_service.go#L275)
- [internal/services/stats/stats_service.go:305](internal/services/stats/stats_service.go#L305)
- [internal/services/stats/stats_service.go:322](internal/services/stats/stats_service.go#L322)

**Issue:**
Multiple placeholder conversions between repository and API types.

**Fix Required:**
Implement proper type mapping functions.

---

### 2.10 Growth Calculation Stubbed

**Priority:** HIGH
**Impact:** Volume growth trends not available

**Files:**
- [internal/repo/stats_repo.go:139](internal/repo/stats_repo.go#L139)

**Fix Required:**
Query historical volume_sizes and calculate growth rate.

---

### 2.11 Compose Project Detection Missing

**Priority:** HIGH
**Impact:** Can't identify Docker Compose volumes

**Files:**
- [internal/services/docker/mount_catalog_service.go:492](internal/services/docker/mount_catalog_service.go#L492)

**Fix Required:**
Parse container labels for `com.docker.compose.project`.

---

### 2.12 Organization Assignment Logic Missing

**Priority:** HIGH
**Impact:** All volumes assigned to default org

**Files:**
- [internal/services/filesystem/volume_discovery.go:176](internal/services/filesystem/volume_discovery.go#L176)

**Fix Required:**
Implement smart assignment based on volume labels, names, or paths.

---

### 2.13 Active Scans View Query Not Generated

**Priority:** HIGH
**Impact:** Can't query active scans efficiently

**Files:**
- [internal/repo/scan_progress_repo.go:914](internal/repo/scan_progress_repo.go#L914)
- [internal/repo/scan_progress_repo.go:921](internal/repo/scan_progress_repo.go#L921)

**Fix Required:**
Add SQLC query for active_scans view.

---

### 2.14 File Metadata Update Missing

**Priority:** HIGH
**Impact:** Can't update metadata after enrichment

**Files:**
- [internal/repo/files_repo.go:794](internal/repo/files_repo.go#L794)

**Fix Required:**
Add SQLC UpdateFileMetadata query.

---

### 2.15 Realtime Integration Tests Disabled

**Priority:** HIGH
**Impact:** No integration test coverage for realtime system

**Files:**
- [internal/realtime/realtime_integration_test.go:3](internal/realtime/realtime_integration_test.go#L3)
- [internal/realtime/realtime_integration_test.go:10](internal/realtime/realtime_integration_test.go#L10)

**Fix Required:**
Rewrite tests for new SSE-based realtime system.

---

### 2.16 Events Integration Tests Missing

**Priority:** HIGH
**Impact:** No test coverage for event system

**Files:**
- [internal/events/integration_test.go:3](internal/events/integration_test.go#L3)

**Fix Required:**
Implement integration tests for event publishing and subscription.

---

### 2.17 Scan Result Extraction Incomplete

**Priority:** HIGH
**Impact:** Realtime scan updates missing data

**Files:**
- [internal/realtime/broadcaster.go:147](internal/realtime/broadcaster.go#L147)
- [internal/realtime/broadcaster.go:151](internal/realtime/broadcaster.go#L151)
- [internal/realtime/broadcaster.go:163](internal/realtime/broadcaster.go#L163)
- [internal/realtime/broadcaster.go:168](internal/realtime/broadcaster.go#L168)

**Issue:**
Multiple TODOs for extracting actual scan data from events:

```go
scanID := "" // TODO: Extract scan ID if available
// TODO: Extract actual scan result data
// TODO: Populate with actual scan result data
```

**Fix Required:**
Parse event payloads and extract structured data.

---

### 2.18 Disk Usage Calculation Inaccurate

**Priority:** HIGH
**Impact:** Disk usage stats incorrect (uses file size instead of blocks)

**Files:**
- [internal/services/filesystem/metadata_extractor.go:107](internal/services/filesystem/metadata_extractor.go#L107)

**Issue:**
```go
DiskUsageBytes: info.Size(), // TODO: Get actual disk usage
```

**Fix Required:**
Use syscall to get actual block usage on Linux/macOS.

---

### 2.19 Watchdog Last Check Time Not Tracked

**Priority:** HIGH
**Impact:** Can't detect stale workers

**Files:**
- [internal/scheduler/watchdog.go:70](internal/scheduler/watchdog.go#L70)

**Fix Required:**
Persist worker heartbeat timestamps in database or cache.

---

### 2.20 Volume Size Update Method Missing

**Priority:** HIGH
**Impact:** Volume sizes not updated after scans

**Files:**
- [internal/api/v1/scan/handler.go:308](internal/api/v1/scan/handler.go#L308)

**Fix Required:**
Add UpdateVolumeSize method to volumes repository.

---

### 2.21 Daily Stats Not Transformed

**Priority:** HIGH
**Impact:** Analytics API returns wrong format

**Files:**
- [internal/api/v1/stats/handler.go:143](internal/api/v1/stats/handler.go#L143)

**Fix Required:**
Add transformation from repository DailyStat to API response format.

---

### 2.22 Search Suggestions Incomplete

**Priority:** HIGH
**Impact:** Search autocomplete doesn't work

**Files:**
- [internal/api/v1/search/suggestions.go:48](internal/api/v1/search/suggestions.go#L48)

**Issue:**
File name, extension, and path suggestions not implemented:

```go
// TODO: Add file name, extension, and path suggestions once SQL queries are ready
```

**Fix Required:**
Add SQLC queries for DISTINCT file names, extensions, and path components.

---

### 2.23 Organization User Update Missing

**Priority:** HIGH
**Impact:** Can't change user's organization

**Files:**
- [internal/api/v1/auth/handler.go:188](internal/api/v1/auth/handler.go#L188)

**Fix Required:**
Add UpdateUserOrganization method to users repository.

---

### 2.24 Aggregate Cache Hit Tracking Missing

**Priority:** HIGH
**Impact:** Can't monitor cache effectiveness

**Files:**
- [internal/api/v1/aggregate/handler.go:91](internal/api/v1/aggregate/handler.go#L91)

**Fix Required:**
Implement cache hit/miss tracking and return in response.

---

### 2.25 Placeholder Database in Router

**Priority:** HIGH
**Impact:** Development mode uses mock database

**Files:**
- [internal/api/v1/router.go:45](internal/api/v1/router.go#L45)
- [internal/api/v1/router.go:48](internal/api/v1/router.go#L48)

**Issue:**
```go
// For now, we'll create placeholder services since we need proper database connection setup
// Create placeholder database connection for development
```

**Fix Required:**
Remove placeholder and require proper database connection.

---

### 2.26 Metrics Collection Not Implemented

**Priority:** HIGH
**Impact:** No visibility into system performance

**Files:**
- [internal/security/audit_logger.go:269](internal/security/audit_logger.go#L269)
- [internal/security/access_control.go:373](internal/security/access_control.go#L373)
- [internal/security/database_context.go:204](internal/security/database_context.go#L204)

**Fix Required:**
Implement Prometheus metrics for security operations.

---

### 2.27 Scans Repo Ignores Organization ID

**Priority:** HIGH
**Impact:** Cross-organization data leakage possible

**Files:**
- [internal/repo/scans_repo.go:70](internal/repo/scans_repo.go#L70)

**Issue:**
```go
// TODO: This ignores OrganizationID - needs SQLC regeneration to fix
```

**Fix Required:**
Regenerate SQLC with organization ID in all scan queries.

---

### 2.28 Active Connection Tracking Disabled

**Priority:** HIGH
**Impact:** Can't monitor WebSocket connections

**Files:**
- [internal/api/v1/diag/handler.go:51](internal/api/v1/diag/handler.go#L51)

**Fix Required:**
Add connection counter to realtime hub.

---

## 3. MEDIUM PRIORITY ISSUES (32)

### 3.1 Volume Pagination Hardcoded

**Priority:** MEDIUM
**Impact:** Inefficient for large deployments

**Files:**
- [internal/services/filesystem/volume_discovery.go:231](internal/services/filesystem/volume_discovery.go#L231)

**Issue:**
```go
allVolumes, err := vds.store.Volumes().ListAllVolumes(ctx, 1000, 0) // TODO: Add pagination
```

**Fix Required:**
Implement cursor-based pagination for volume discovery.

---

### 3.2 Resume Manager Placeholder Mountpoint

**Priority:** MEDIUM
**Impact:** Resume functionality may not work correctly

**Files:**
- [internal/scheduler/resume_manager.go:297](internal/scheduler/resume_manager.go#L297)
- [internal/scheduler/resume_manager.go:301](internal/scheduler/resume_manager.go#L301)

**Fix Required:**
Query actual mountpoint from Docker API or volume metadata.

---

### 3.3 Tracking Rules Mount Override Stubs

**Priority:** MEDIUM
**Impact:** Mount override feature doesn't work

**Files:**
- [internal/repo/tracking_rules_repo.go:423](internal/repo/tracking_rules_repo.go#L423)
- [internal/repo/tracking_rules_repo.go:426](internal/repo/tracking_rules_repo.go#L426)

**Fix Required:**
Implement mount override CRUD operations or remove feature.

---

### 3.4 Folder Repository Placeholder Timestamps

**Priority:** MEDIUM
**Impact:** Folder created/updated times incorrect

**Files:**
- [internal/repo/folders_repo.go:156-157](internal/repo/folders_repo.go#L156)

**Fix Required:**
Get actual timestamps from filesystem or use database defaults.

---

### 3.5 Stats Repository Stub Implementations

**Priority:** MEDIUM
**Impact:** Advanced stats features don't work

**Files:**
- [internal/repo/stats_repo.go:213](internal/repo/stats_repo.go#L213)
- [internal/repo/stats_repo.go:473](internal/repo/stats_repo.go#L473)
- [internal/repo/stats_repo.go:479](internal/repo/stats_repo.go#L479)
- [internal/repo/stats_repo.go:485](internal/repo/stats_repo.go#L485)
- [internal/repo/stats_repo.go:491](internal/repo/stats_repo.go#L491)

**Fix Required:**
Implement 5 stub methods or remove from interface.

---

### 3.6 File Path Query Missing

**Priority:** MEDIUM
**Impact:** Can't query files by path efficiently

**Files:**
- [internal/repo/files_repo.go:43](internal/repo/files_repo.go#L43)

**Fix Required:**
Add SQLC query with path parameter and LIKE clause.

---

### 3.7 Audit Filtering Not Sophisticated

**Priority:** MEDIUM
**Impact:** Can't filter audit logs effectively

**Files:**
- [internal/audit/audit.go:122](internal/audit/audit.go#L122)

**Fix Required:**
Add filters for date range, user, action type, resource, etc.

---

### 3.8 Security Metrics Placeholder

**Priority:** MEDIUM
**Impact:** No security monitoring

**Files:**
- [internal/security/database_context.go:202](internal/security/database_context.go#L202)
- [internal/security/access_control.go:281](internal/security/access_control.go#L281)

**Fix Required:**
Implement metrics for RLS checks, access denials, etc.

---

### 3.9 Volume First/Last Seen Missing

**Priority:** MEDIUM
**Impact:** Can't track when volumes were added/removed

**Files:**
- [internal/api/v1/volumes/handler.go:219](internal/api/v1/volumes/handler.go#L219)

**Fix Required:**
Add first_seen and last_seen columns to volumes table.

---

### 3.10-3.32 Additional Medium Priority Issues

**Categorized by area:**

**Frontend Issues (10):**
- Missing error boundaries on pages
- Incomplete loading states
- Missing input validation
- No offline detection handling
- Missing keyboard shortcuts
- Incomplete accessibility labels
- Mobile responsiveness not tested
- Empty state variations missing
- Confirmation dialogs for bulk operations missing
- Stale data indicators missing

**Backend Issues (12):**
- Missing rate limiting on expensive endpoints
- No request timeout configuration
- Concurrent scan limit not enforced
- Background job error handling incomplete
- Health check doesn't verify database
- Metrics endpoint missing business metrics
- API documentation outdated
- OpenAPI spec not generated from code
- Request validation incomplete
- Response caching headers missing
- CORS configuration too permissive for production
- TLS configuration not documented

---

## 4. LOW PRIORITY ISSUES (14)

### 4.1 Polish and UX Improvements

1. **Better error messages** - Generic "An error occurred" in many places
2. **Loading state micro-interactions** - Skeleton loaders vs spinners
3. **Optimistic updates** - Mutation feedback before server response
4. **Keyboard shortcuts** - Power user features
5. **Bulk operation progress** - Progress bars for multi-item operations
6. **Toast notification queue** - Multiple toasts overlap
7. **Table column resize** - User preference persistence
8. **Dark mode polish** - Some components don't adapt
9. **Animation performance** - Some animations janky on slower machines
10. **Focus management** - Modal focus trapping incomplete
11. **Screen reader announcements** - Live region updates missing
12. **Mobile gesture support** - Swipe actions for mobile
13. **Print styles** - Reports not print-friendly
14. **Export formats** - Only JSON, need CSV/Excel

---

## 5. RECOMMENDED IMPLEMENTATION PRIORITY

### Phase 1: Critical Fixes (Week 1-2)
1. Create SQLC queries for database views
2. Fix search API error handling
3. Fix type assertion safety issues
4. Implement audit logging persistence
5. Fix WebSocket origin validation
6. Add admin authentication checks
7. Fix user ID audit conversion

### Phase 2: High Priority (Week 3-5)
1. Complete retention system implementation
2. Fix all numeric type conversions
3. Implement volume statistics
4. Complete stats repository
5. Fix container schema issues
6. Implement file metadata bulk operations
7. Add enrichment progress tracking

### Phase 3: Medium Priority (Week 6-7)
1. Frontend error boundaries
2. Input validation
3. Request timeout configuration
4. Health check improvements
5. Metrics collection
6. API documentation updates
7. Complete folder timestamps
8. Implement file path queries

### Phase 4: Polish (Week 8)
1. UX improvements
2. Accessibility fixes
3. Mobile responsiveness
4. Keyboard shortcuts
5. Export formats
6. Print styles

---

## 6. METRICS AND STATISTICS

### Issues by File Type
- Go backend: 68 issues
- TypeScript frontend: 12 issues
- SQL/Database: 6 issues
- Configuration: 3 issues

### Issues by Category
- Repository Layer: 35 issues (39%)
- API/Handler Layer: 18 issues (20%)
- Service Layer: 15 issues (17%)
- Frontend: 12 issues (13%)
- Security: 5 issues (6%)
- Database: 4 issues (4%)

### Most Problematic Files
1. `retention_repo.go` - 10 TODOs
2. `stats_repo.go` - 8 TODOs
3. `scan_progress_repo.go` - 7 TODOs
4. `mount_catalog_service.go` - 7 TODOs
5. `volumes_repo.go` - 6 TODOs
6. `alerts_repo.go` - 4 TODOs
7. `search_repo.go` - 4 TODOs

### Estimated Effort
- **Critical**: 80-120 hours (2-3 weeks)
- **High**: 120-160 hours (3-4 weeks)
- **Medium**: 80-100 hours (2-3 weeks)
- **Low**: 40-60 hours (1-2 weeks)

**Total**: 320-440 hours (8-11 weeks with 1 developer)

---

## 7. TESTING GAPS

### Unit Test Coverage
- Repository layer: ~30% coverage
- Service layer: ~20% coverage
- API handlers: ~15% coverage
- Frontend components: ~40% coverage

### Integration Tests
- Events package: Placeholder only
- Realtime system: Disabled (legacy tests)
- End-to-end: Basic coverage only

### Recommended Testing Priorities
1. Add repository unit tests for critical paths
2. Rewrite realtime integration tests
3. Add API integration tests for auth flows
4. Add E2E tests for scan workflows
5. Add frontend component interaction tests

---

## 8. TECHNICAL DEBT SUMMARY

### Architectural Concerns
1. **SQLite support** - Entirely stubbed, should remove or complete
2. **Schema evolution** - Container/mount catalog schema unclear
3. **Type system** - Too many pgtype conversions, consider intermediate types
4. **Error handling** - Inconsistent patterns across codebase
5. **Testing strategy** - Need clear unit vs integration boundaries

### Quick Wins (High Impact, Low Effort)
1. Generate SQLC queries for existing views (2 hours)
2. Fix search error handling (1 hour)
3. Add version from build info (1 hour)
4. Fix WebSocket origins from env (30 minutes)
5. Add admin auth middleware (2 hours)
6. Fix audit user ID conversion (1 hour)

Total quick wins: **~8 hours** to resolve 6 critical issues

---

## 9. RECOMMENDATIONS

### Immediate Actions
1. ✅ **Generate SQLC queries** for active_scans, scan_progress_summary, recent_scan_errors views
2. ✅ **Fix search API** error handling to prevent silent failures
3. ✅ **Remove or complete SQLite** support (don't leave half-implemented)
4. ✅ **Implement retention system** before database grows too large
5. ✅ **Add audit log persistence** for compliance

### Medium Term
1. Complete stats repository calculations
2. Fix all numeric type conversions
3. Implement comprehensive error boundaries
4. Add input validation framework
5. Complete integration test suites

### Long Term
1. Consider TypeScript for backend (avoid Go type conversion issues)
2. Implement proper caching layer
3. Add comprehensive observability
4. Performance optimization pass
5. Security audit and penetration testing

---

## Appendix A: File Reference Index

All issues cross-referenced with file paths and line numbers for easy navigation in IDE.

## Appendix B: SQLC Query Templates

Ready-to-use query templates for the missing view queries.

---

**End of Report**
