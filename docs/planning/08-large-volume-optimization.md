# Large Volume (1TB+) Scanner Optimization

**Date**: October 5, 2025
**Goal**: Transform scanner from 8.5/10 to 10/10 for production-grade 1TB+ volume scanning
**Priority**: Critical - Required for enterprise deployments
**Timeline**: 4-5 weeks (60-80 hours)
**Status**: Phase 1 Complete, Ready for Phase 2

---

## Executive Summary

Phase 1 (Resilience) is **complete** ✅:
- Retry logic with exponential backoff
- Timeout handling with smart estimation
- Panic recovery
- Circuit breaker
- Configuration system

**Current Rating**: 8.5/10

This document outlines the path to **10/10** for large volumes, focusing on:
1. **Checkpoint & Recovery** - Resume multi-hour scans after crashes
2. **Incremental Scanning** - Only rescan changed data
3. **Memory Management** - Handle 1TB+ without exhausting resources
4. **Graceful Shutdown** - Save state on SIGTERM
5. **Transaction Safety** - Database consistency guarantees

---

## Gap Analysis for 1TB+ Volumes

### Current State (8.5/10)

**What Works**:
- ✅ Handles transient failures (retry)
- ✅ Prevents infinite hangs (timeouts)
- ✅ Survives panics (recovery)
- ✅ Prevents cascading failures (circuit breaker)

**What's Missing for Large Volumes**:

| Issue | Impact on 1TB Volume | Example |
|-------|---------------------|---------|
| No checkpointing | 6hr scan crashes at hour 5 → restart from 0% | Lost 5 hours of work |
| No incremental scan | Full rescan every time, even if 99% unchanged | 6hr scan for 1% change |
| Memory not bounded | Could OOM on 10M files | Scanner crashes |
| No graceful shutdown | SIGTERM during scan → corrupted state | Kubernetes kills pod |
| No transaction safety | Crash during DB writes → partial data | Inconsistent database |

**Conclusion**: Current implementation works for <100GB volumes, but **fails for 1TB+** due to:
- Time cost (can't afford to restart 6-hour scans)
- Resource cost (can't buffer 10M files in memory)
- Operational cost (can't handle restarts/deployments during scans)

---

## Implementation Plan

### Phase 2A: Checkpointing & Resume (Week 2-3, 20 hours) 🎯 **HIGHEST PRIORITY**

**Goal**: Enable scans to resume after crashes or interruptions

#### Why This is Critical for 1TB+

A 2TB volume with 10M files might take:
- Volume scan (size only): 30 minutes
- Filesystem indexing: 4-6 hours
- Media enrichment: 2-3 hours
- **Total: 6-9 hours**

Without checkpointing:
- Server restart at hour 6 → **lose 6 hours of work**
- Network hiccup at hour 8 → **restart from 0%**
- Kubernetes pod eviction → **progress lost**

With checkpointing:
- Resume from hour 6 → **only lose 5 minutes**
- Network hiccup handled by retry → **no restart**
- Pod eviction → **resume on new pod**

#### Implementation Tasks

**Task 2A.1: Database Schema (2 hours)**

Add checkpoint table (already designed in plan 07):

```sql
-- migrations/postgresql/000009_add_scan_checkpoints.up.sql
CREATE TABLE scan_checkpoints (
    id BIGSERIAL PRIMARY KEY,
    scan_id TEXT NOT NULL,
    volume_id TEXT NOT NULL,
    checkpoint_type TEXT NOT NULL, -- 'volume_scan', 'filesystem_indexing', 'enrichment'

    -- Progress state
    phase TEXT NOT NULL,
    progress DOUBLE PRECISION NOT NULL DEFAULT 0.0,

    -- Counters
    items_processed BIGINT NOT NULL DEFAULT 0,
    bytes_processed BIGINT NOT NULL DEFAULT 0,
    errors_count BIGINT NOT NULL DEFAULT 0,

    -- Resume position
    last_path TEXT,
    last_depth INTEGER,
    last_folder_id BIGINT, -- For resuming filesystem indexing
    resume_data JSONB,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_scan_checkpoint UNIQUE (scan_id, checkpoint_type)
);

CREATE INDEX idx_scan_checkpoints_scan_id ON scan_checkpoints(scan_id);
CREATE INDEX idx_scan_checkpoints_volume_id ON scan_checkpoints(volume_id);
CREATE INDEX idx_scan_checkpoints_updated_at ON scan_checkpoints(updated_at);
```

**Task 2A.2: Checkpoint Repository (4 hours)**

File: `internal/repo/checkpoint_repo.go`

```go
package repo

type CheckpointRepo interface {
    SaveCheckpoint(ctx context.Context, checkpoint ScanCheckpoint) error
    LoadCheckpoint(ctx context.Context, scanID, checkpointType string) (*ScanCheckpoint, error)
    DeleteCheckpoint(ctx context.Context, scanID, checkpointType string) error
    CleanupOldCheckpoints(ctx context.Context, olderThan time.Time) error
}

type ScanCheckpoint struct {
    ScanID         string
    VolumeID       string
    CheckpointType string
    Phase          string
    Progress       float64
    ItemsProcessed int64
    BytesProcessed int64
    ErrorsCount    int64
    LastPath       string
    LastDepth      int
    LastFolderID   *int64 // Resume indexing from this folder
    ResumeData     map[string]interface{}
    CreatedAt      time.Time
    UpdatedAt      time.Time
}
```

**Task 2A.3: Periodic Checkpointing (6 hours)**

File: `internal/services/scanner/checkpointing.go`

```go
// Checkpoint every 5 minutes OR every 100k items
const (
    CheckpointInterval = 5 * time.Minute
    CheckpointItemThreshold = 100000
)

func (vs *VolumeScanner) startCheckpointing(ctx context.Context, scanID, volumeID string) {
    ticker := time.NewTicker(CheckpointInterval)
    defer ticker.Stop()

    lastItemCount := int64(0)

    for {
        select {
        case <-ticker.C:
            vs.saveCheckpoint(ctx, scanID, volumeID)
        case <-ctx.Done():
            // Final checkpoint before exit
            vs.saveCheckpoint(context.Background(), scanID, volumeID)
            return
        }

        // Also checkpoint on item threshold
        currentProgress := vs.progressManager.GetProgress(scanID)
        if currentProgress.FilesScanned - lastItemCount >= CheckpointItemThreshold {
            vs.saveCheckpoint(ctx, scanID, volumeID)
            lastItemCount = currentProgress.FilesScanned
        }
    }
}
```

**Task 2A.4: Resume Logic (6 hours)**

File: `internal/services/scanner/resume.go`

```go
func (vs *VolumeScanner) ResumeScan(ctx context.Context, scanID string) error {
    checkpoint, err := vs.store.Checkpoints().LoadCheckpoint(ctx, scanID, "filesystem_indexing")
    if err != nil {
        return fmt.Errorf("failed to load checkpoint: %w", err)
    }

    log.Printf("Resuming scan from checkpoint: scan_id=%s progress=%.1f%% last_path=%s",
        scanID, checkpoint.Progress*100, checkpoint.LastPath)

    // Resume filesystem indexing from last known folder
    if checkpoint.LastFolderID != nil {
        return vs.filesystemIndexer.ResumeFromFolder(ctx, volumeID, *checkpoint.LastFolderID)
    }

    // Fallback: resume from path
    return vs.filesystemIndexer.ResumeFromPath(ctx, volumeID, checkpoint.LastPath)
}
```

**Task 2A.5: Auto-Resume on Startup (2 hours)**

Detect incomplete scans on server startup and auto-resume them.

File: `cmd/server/main.go`

```go
// After initializing scanner, check for incomplete scans
func resumeIncompletScans(scanner *scanner.VolumeScanner, store store.Store) {
    ctx := context.Background()

    incompleteScans, err := store.Scans().GetIncompleteScans(ctx)
    if err != nil {
        log.Printf("Failed to get incomplete scans: %v", err)
        return
    }

    for _, scan := range incompleteScans {
        log.Printf("Auto-resuming incomplete scan: scan_id=%s volume=%s age=%v",
            scan.ScanID, scan.VolumeID, time.Since(scan.StartedAt))

        go func(scanID string) {
            if err := scanner.ResumeScan(ctx, scanID); err != nil {
                log.Printf("Failed to resume scan %s: %v", scanID, err)
            }
        }(scan.ScanID)
    }
}
```

---

### Phase 2B: Incremental Scanning (Week 4, 16 hours)

**Goal**: Only scan what changed since last scan

#### Why This is Critical for 1TB+

**Scenario**: 2TB volume with 10M files, daily scans

Without incremental:
- Full scan every day: **6 hours × 365 days = 2,190 hours/year**
- If 99% unchanged: **2,167 hours wasted** (99% of time)

With incremental:
- First scan: 6 hours
- Daily scans (1% changed): **~4 minutes each**
- **Annual savings: ~2,185 hours** (99.8% reduction)

#### Implementation Tasks

**Task 2B.1: Track Last Scan Metadata (4 hours)**

Add to schema:

```sql
-- Add to volumes table or create scan_snapshots table
CREATE TABLE volume_snapshots (
    id BIGSERIAL PRIMARY KEY,
    volume_id TEXT NOT NULL,
    scan_id TEXT NOT NULL,
    snapshot_time TIMESTAMPTZ NOT NULL,

    total_size BIGINT NOT NULL,
    file_count BIGINT NOT NULL,
    folder_count BIGINT NOT NULL,

    -- For incremental comparison
    root_mtime TIMESTAMPTZ,
    content_hash TEXT, -- Hash of directory tree

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_volume FOREIGN KEY (volume_id) REFERENCES volumes(id)
);

CREATE INDEX idx_volume_snapshots_volume ON volume_snapshots(volume_id);
CREATE INDEX idx_volume_snapshots_time ON volume_snapshots(snapshot_time DESC);
```

**Task 2B.2: Detect Changes (6 hours)**

File: `internal/services/scanner/incremental.go`

```go
type IncrementalScanner struct {
    store store.Store
}

// ScanIncrementally only scans changed portions
func (is *IncrementalScanner) ScanIncrementally(ctx context.Context, volumeID, volumePath string) ([]string, error) {
    // Get last snapshot
    lastSnapshot, err := is.store.Snapshots().GetLatest(ctx, volumeID)
    if err != nil || lastSnapshot == nil {
        // No previous scan, do full scan
        return []string{"/"}, nil
    }

    // Walk tree and detect changes by mtime
    changedPaths := []string{}

    err = filepath.WalkDir(volumePath, func(path string, d fs.DirEntry, err error) error {
        if err != nil {
            return err
        }

        info, err := d.Info()
        if err != nil {
            return err
        }

        // If directory modified after last scan, mark for rescan
        if info.IsDir() && info.ModTime().After(lastSnapshot.SnapshotTime) {
            relativePath := strings.TrimPrefix(path, volumePath)
            changedPaths = append(changedPaths, relativePath)
            return filepath.SkipDir // Don't descend, we'll scan this later
        }

        return nil
    })

    if len(changedPaths) == 0 {
        // No changes detected
        log.Printf("No changes detected for volume %s since %v", volumeID, lastSnapshot.SnapshotTime)
        return nil, nil
    }

    log.Printf("Incremental scan: %d changed paths out of %d total folders (%.1f%%)",
        len(changedPaths), lastSnapshot.FolderCount,
        float64(len(changedPaths))/float64(lastSnapshot.FolderCount)*100)

    return changedPaths, nil
}
```

**Task 2B.3: Integrate with Scanner (4 hours)**

Modify `ScanVolume` to support incremental mode:

```go
func (vs *VolumeScanner) ScanVolume(ctx context.Context, volumeID string, incremental bool) (*ScanResult, error) {
    if incremental && vs.incrementalScanner != nil {
        changedPaths, err := vs.incrementalScanner.ScanIncrementally(ctx, volumeID, volumePath)
        if err != nil {
            log.Printf("Incremental scan failed, falling back to full scan: %v", err)
        } else if len(changedPaths) == 0 {
            // No changes, return cached result
            return vs.getCachedResult(volumeID), nil
        } else {
            // Partial rescan
            return vs.scanPartial(ctx, volumeID, volumePath, changedPaths)
        }
    }

    // Full scan
    return vs.scanFull(ctx, volumeID, volumePath)
}
```

**Task 2B.4: Configuration (2 hours)**

Add environment variables:

```bash
# Enable incremental scanning
SCAN_INCREMENTAL_ENABLED=true

# Minimum time between full scans (force full scan every N days)
SCAN_FULL_SCAN_INTERVAL=7d

# Incremental threshold (if >50% changed, do full scan anyway)
SCAN_INCREMENTAL_THRESHOLD=0.5
```

---

### Phase 2C: Memory Management (Week 5, 12 hours)

**Goal**: Handle 10M+ files without exhausting memory

#### Why This is Critical for 1TB+

**Problem**: Filesystem indexing might load entire tree into memory

1TB volume with 10M files:
- Each file entry: ~500 bytes (path, size, mtime, etc.)
- Total memory: **10M × 500 bytes = 5 GB**
- Plus file metadata, previews, etc.: **~8-10 GB**

**Solution**: Stream processing + batching

#### Implementation Tasks

**Task 2C.1: Batch Database Inserts (4 hours)**

File: `internal/services/filesystem/batch_writer.go`

```go
type BatchWriter struct {
    store      store.Store
    batchSize  int

    fileBatch   []*models.File
    folderBatch []*models.Folder

    mu sync.Mutex
}

func NewBatchWriter(store store.Store, batchSize int) *BatchWriter {
    return &BatchWriter{
        store:      store,
        batchSize:  batchSize,
        fileBatch:  make([]*models.File, 0, batchSize),
        folderBatch: make([]*models.Folder, 0, batchSize),
    }
}

func (bw *BatchWriter) AddFile(file *models.File) error {
    bw.mu.Lock()
    defer bw.mu.Unlock()

    bw.fileBatch = append(bw.fileBatch, file)

    if len(bw.fileBatch) >= bw.batchSize {
        return bw.flushFiles()
    }

    return nil
}

func (bw *BatchWriter) flushFiles() error {
    if len(bw.fileBatch) == 0 {
        return nil
    }

    ctx := context.Background()
    if err := bw.store.Files().BulkInsert(ctx, bw.fileBatch); err != nil {
        return fmt.Errorf("failed to flush file batch: %w", err)
    }

    // Clear batch
    bw.fileBatch = bw.fileBatch[:0]
    return nil
}

func (bw *BatchWriter) Flush() error {
    bw.mu.Lock()
    defer bw.mu.Unlock()

    if err := bw.flushFiles(); err != nil {
        return err
    }

    return bw.flushFolders()
}
```

**Task 2C.2: Streaming Indexer (6 hours)**

Modify filesystem indexer to process one directory at a time:

```go
func (idx *Indexer) IndexStreaming(ctx context.Context, volumeID, rootPath string) error {
    batchWriter := NewBatchWriter(idx.store, 1000) // Batch 1000 files
    defer batchWriter.Flush()

    return filepath.WalkDir(rootPath, func(path string, d fs.DirEntry, err error) error {
        if err != nil {
            return err
        }

        // Process file immediately, don't buffer
        file := idx.processFile(volumeID, path, d)

        // Add to batch (auto-flushes at threshold)
        if err := batchWriter.AddFile(file); err != nil {
            return fmt.Errorf("failed to write file: %w", err)
        }

        // Explicitly release file from memory
        file = nil

        return nil
    })
}
```

**Task 2C.3: Memory Limits (2 hours)**

Add memory monitoring and backpressure:

```go
func (vs *VolumeScanner) checkMemoryPressure() bool {
    var m runtime.MemStats
    runtime.ReadMemStats(&m)

    // If using >80% of available memory, apply backpressure
    memoryUsagePercent := float64(m.Alloc) / float64(m.Sys)

    if memoryUsagePercent > 0.8 {
        log.Printf("High memory pressure: %.1f%%, pausing indexing", memoryUsagePercent*100)
        time.Sleep(5 * time.Second)
        runtime.GC() // Force garbage collection
        return true
    }

    return false
}
```

---

### Phase 2D: Graceful Shutdown (Week 5, 8 hours)

**Goal**: Save state on SIGTERM/SIGINT

#### Why This is Critical for 1TB+

**Scenario**: Kubernetes pod eviction during 6-hour scan

Without graceful shutdown:
- SIGTERM received
- 10 seconds later: SIGKILL
- Scan state lost
- **Result**: Wasted 3 hours of scanning

With graceful shutdown:
- SIGTERM received
- Save checkpoint (takes 2 seconds)
- Clean exit
- **Result**: Resume from 50% on next pod

#### Implementation Tasks

**Task 2D.1: Signal Handlers (4 hours)**

File: `cmd/server/graceful_shutdown.go`

```go
func setupGracefulShutdown(scanner *scanner.VolumeScanner) {
    sigChan := make(chan os.Signal, 1)
    signal.Notify(sigChan, syscall.SIGTERM, syscall.SIGINT)

    go func() {
        sig := <-sigChan
        log.Printf("Received signal %v, shutting down gracefully...", sig)

        // Create shutdown context with timeout
        ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
        defer cancel()

        // Signal scanner to save checkpoints and stop
        if err := scanner.GracefulShutdown(ctx); err != nil {
            log.Printf("Error during graceful shutdown: %v", err)
        }

        log.Println("Graceful shutdown complete")
        os.Exit(0)
    }()
}
```

**Task 2D.2: Scanner Shutdown Method (4 hours)**

```go
func (vs *VolumeScanner) GracefulShutdown(ctx context.Context) error {
    log.Println("Scanner graceful shutdown initiated")

    // Get all active scans
    activeScans := vs.progressManager.GetActiveScans()

    for _, scanID := range activeScans {
        log.Printf("Saving checkpoint for active scan: %s", scanID)

        // Save final checkpoint
        progress := vs.progressManager.GetProgress(scanID)
        if err := vs.saveCheckpoint(ctx, scanID, progress.VolumeID); err != nil {
            log.Printf("Failed to save checkpoint for %s: %v", scanID, err)
        }

        // Mark scan as interrupted
        if err := vs.store.Scans().UpdateStatus(ctx, scanID, "interrupted"); err != nil {
            log.Printf("Failed to update scan status: %v", err)
        }
    }

    // Cancel all ongoing scans
    vs.cancelAllScans()

    // Wait for goroutines to finish (with timeout)
    done := make(chan struct{})
    go func() {
        vs.wg.Wait()
        close(done)
    }()

    select {
    case <-done:
        log.Println("All scan goroutines completed")
    case <-ctx.Done():
        log.Println("Shutdown timeout, forcing exit")
    }

    return nil
}
```

---

### Phase 2E: Transaction Safety (Week 6, 12 hours)

**Goal**: ACID guarantees for database operations

(This is already well-documented in plan 07, Phase 3)

Key tasks:
1. Add transaction wrapper (4 hours)
2. Update scan initialization to use transactions (4 hours)
3. Add distributed locks to prevent duplicate scans (4 hours)

---

## Success Metrics

| Metric | Before | After Phase 2 | Target |
|--------|--------|---------------|--------|
| **Resume after crash** | ❌ Start over | ✅ Resume from checkpoint | 100% resume rate |
| **2TB rescan time** | 6 hours | 4 minutes (incremental) | <1% of full scan |
| **Memory usage (10M files)** | 8-10 GB | 500 MB - 1 GB | <1 GB |
| **Graceful shutdown** | ❌ State lost | ✅ Checkpoint saved | 100% success rate |
| **DB consistency** | ⚠️ Partial writes | ✅ Transactional | 100% consistent |
| **Overall Rating** | 8.5/10 | **10/10** | Production-grade |

---

## Configuration Summary

After Phase 2 completion:

```bash
# Phase 1 - Resilience (COMPLETE)
SCAN_RETRY_ENABLED=true
SCAN_RETRY_MAX_ATTEMPTS=3
SCAN_RETRY_INITIAL_BACKOFF=1s
SCAN_RETRY_MAX_BACKOFF=30s
SCAN_PER_METHOD_TIMEOUT=30m
SCAN_OVERALL_TIMEOUT=2h
SCAN_INDEXING_TIMEOUT=4h
SCAN_CIRCUIT_BREAKER_ENABLED=true

# Phase 2A - Checkpointing
SCAN_CHECKPOINT_ENABLED=true
SCAN_CHECKPOINT_INTERVAL=5m
SCAN_CHECKPOINT_ITEM_THRESHOLD=100000
SCAN_AUTO_RESUME=true

# Phase 2B - Incremental
SCAN_INCREMENTAL_ENABLED=true
SCAN_FULL_SCAN_INTERVAL=7d
SCAN_INCREMENTAL_THRESHOLD=0.5

# Phase 2C - Memory Management
SCAN_BATCH_SIZE=1000
SCAN_MEMORY_LIMIT_MB=1024
SCAN_BACKPRESSURE_THRESHOLD=0.8

# Phase 2D - Graceful Shutdown
SCAN_GRACEFUL_SHUTDOWN_TIMEOUT=30s
```

---

## Implementation Timeline

| Week | Phase | Hours | Deliverable |
|------|-------|-------|-------------|
| 1 | ✅ Phase 1 Complete | 20 | Retry, timeout, panic recovery, circuit breaker |
| 2-3 | **Phase 2A** | 20 | Checkpointing & resume |
| 4 | **Phase 2B** | 16 | Incremental scanning |
| 5 | **Phase 2C + 2D** | 20 | Memory management + graceful shutdown |
| 6 | **Phase 2E** | 12 | Transaction safety |
| 7 | **Testing** | 12 | Integration tests, load tests, 1TB+ validation |

**Total**: 7 weeks, 100 hours

**Milestones**:
- Week 3: Can resume 6-hour scans ✅
- Week 4: Can do incremental scans (99% faster) ✅
- Week 5: Can handle 10M files without OOM ✅
- Week 6: Production-ready for enterprise deployments ✅

---

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Checkpoint overhead | 1-2% performance penalty | Batch checkpoints, async writes |
| Incremental false negatives | Miss some changes | Force full scan every 7 days |
| Resume logic bugs | Scan restarts anyway | Extensive testing, fallback to full scan |
| Memory still too high | OOM on massive volumes | Add streaming compression, temp file spill |

---

## Testing Strategy

### Load Testing

**Scenario 1**: 2TB volume, 10M files
- Full scan: measure time, memory, checkpoint frequency
- Crash at 50%: verify resume works
- Incremental (1% changed): verify <5 minute rescan

**Scenario 2**: 10 concurrent scans
- Memory pooling
- No resource starvation
- All scans complete successfully

**Scenario 3**: Kubernetes pod eviction
- Send SIGTERM during scan
- Verify checkpoint saved
- Verify resume on new pod

### Chaos Testing

- Kill -9 during scan (no checkpoint)
- Network partition during DB write
- Disk full during checkpoint
- Memory pressure (OOM killer)

---

*Created: October 5, 2025*
*Owner: Engineering Team*
*Dependencies: Plan 07 Phase 1 (Complete)*
*Status: Ready to begin Phase 2A*
