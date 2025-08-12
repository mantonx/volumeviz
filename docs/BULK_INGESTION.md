# VolumeViz Bulk File Ingestion

High-performance bulk ingestion system for file/directory analytics, designed to efficiently handle millions of file system entries.

## Overview

VolumeViz's bulk ingestion system provides database-specific optimizations for inserting large amounts of file system scan data:

- **PostgreSQL**: Uses `CopyFrom` with staging tables for maximum throughput (50k-100k rows/sec)
- **SQLite**: Uses adaptive batch sizing with prepared statements (20k-40k rows/sec)
- **Unified API**: Database-agnostic interface with automatic optimization selection

## Quick Start

```go
import "github.com/mantonx/volumeviz/internal/store"

// Get bulk ingestion facade from store integration
bulkFacade := storeIntegration.GetBulkIngestFacade()

// Prepare file data
fileRows := []store.FileRow{
    {
        VolumeID:  "my-volume",
        Name:      "example.txt",
        FullPath:  "/path/to/example.txt",
        Type:      "file",
        SizeBytes: 1024,
        MTime:     time.Now(),
        CTime:     time.Now(),
        Depth:     2,
    },
    // ... more files
}

// Bulk ingest
result, err := bulkFacade.IngestFiles(ctx, "my-volume", fileRows)
if err != nil {
    log.Fatalf("Ingestion failed: %v", err)
}

log.Printf("Processed %d files in %v (%.0f files/sec)",
    result.ProcessedRows, result.Duration, result.RowsPerSecond)
```

## FileRow Structure

The `FileRow` struct represents a normalized file or directory entry:

```go
type FileRow struct {
    VolumeID     string    `json:"volume_id"`        // Required: Volume identifier
    ParentDirID  *uint64   `json:"parent_dir_id"`    // Optional: Parent directory ID
    Name         string    `json:"name"`             // Required: File/directory name
    FullPath     string    `json:"full_path"`        // Required for directories
    SizeBytes    int64     `json:"size_bytes"`       // File size in bytes
    MTime        time.Time `json:"mtime"`            // Modification time
    CTime        time.Time `json:"ctime"`            // Creation time
    Inode        *uint64   `json:"inode,omitempty"`  // Optional: Inode number
    UID          *uint32   `json:"uid,omitempty"`    // Optional: User ID
    GID          *uint32   `json:"gid,omitempty"`    // Optional: Group ID
    Type         string    `json:"type"`             // "file", "dir", "symlink"
    Hidden       bool      `json:"hidden"`           // Hidden file flag
    Depth        int       `json:"depth"`            // Directory depth (0 = root)
    PathHash     []byte    `json:"-"`                // Auto-computed path hash
}
```

## Performance Targets

| Database   | Target Throughput | 1M Row Duration | Method |
|------------|------------------|-----------------|--------|
| PostgreSQL | 50k-100k/sec     | < 20 seconds    | CopyFrom + Staging |
| SQLite     | 20k-40k/sec      | < 50 seconds    | Prepared Statements |

## Configuration Options

### Default Options
```go
opts := store.DefaultBulkIngestOptions()
// BatchSize: 10000
// ConflictStrategy: "ignore"
// Adaptive: true
```

### PostgreSQL Optimized
```go
opts := store.PostgreSQLOptimizedOptions()
// BatchSize: 25000
// UseStaging: true
// ConflictStrategy: "replace"
```

### SQLite Optimized
```go
opts := store.SQLiteOptimizedOptions()
// BatchSize: 5000
// Adaptive: true (adjusts based on performance)
// ConflictStrategy: "ignore"
```

### Custom Options
```go
opts := store.BulkIngestOptions{
    BatchSize:        15000,
    UseStaging:       true,
    ConflictStrategy: "replace", // "ignore" or "replace"
    Adaptive:         true,
}
```

## Database-Specific Optimizations

### PostgreSQL

Uses a two-stage approach for maximum performance:

1. **Staging Tables**: Temporary tables for bulk data loading
2. **CopyFrom**: PostgreSQL's fastest bulk insert method
3. **Merge Operations**: Efficient `INSERT ... ON CONFLICT` handling

```go
// PostgreSQL automatically uses staging tables
result, err := bulkFacade.IngestFiles(ctx, volumeID, fileRows)
```

Performance characteristics:
- Optimal batch size: 25,000+ rows
- Memory usage: ~64MB for large batches
- Supports transaction rollback
- Handles conflicts efficiently

### SQLite

Uses adaptive batch sizing for optimal performance:

1. **Multi-row Inserts**: Single INSERT with multiple VALUE sets
2. **Adaptive Sizing**: Adjusts batch size based on performance
3. **Pragma Optimization**: Temporary performance settings

```go
// SQLite automatically uses adaptive batching
result, err := bulkFacade.IngestFiles(ctx, volumeID, fileRows)
```

Performance characteristics:
- Dynamic batch size: 1,000 - 10,000 rows
- Memory usage: ~16-32MB per batch
- Adjusts to system performance
- Handles conflicts with ON CONFLICT clauses

## Error Handling

The bulk ingestion system provides detailed error reporting:

```go
result, err := bulkFacade.IngestFiles(ctx, volumeID, fileRows)
if err != nil {
    log.Fatalf("Ingestion failed: %v", err)
}

// Check for partial failures
if result.ErrorRows > 0 {
    log.Printf("Warning: %d rows failed to process", result.ErrorRows)
    for _, errMsg := range result.Errors {
        log.Printf("Error: %s", errMsg)
    }
}
```

### Common Error Scenarios

1. **Constraint Violations**: Path hash conflicts, foreign key errors
2. **Data Validation**: Invalid file types, oversized fields
3. **System Resources**: Memory limits, disk space
4. **Network Issues**: Database connection problems (PostgreSQL)

## Performance Monitoring

### Built-in Metrics

All ingestion operations return detailed performance metrics:

```go
type BulkIngestResult struct {
    TotalRows       int64         `json:"total_rows"`
    ProcessedRows   int64         `json:"processed_rows"`
    SkippedRows     int64         `json:"skipped_rows"`
    ErrorRows       int64         `json:"error_rows"`
    FileEntries     int64         `json:"file_entries"`
    DirEntries      int64         `json:"dir_entries"`
    Duration        time.Duration `json:"duration"`
    RowsPerSecond   float64       `json:"rows_per_second"`
    BatchCount      int           `json:"batch_count"`
    AvgBatchSize    float64       `json:"avg_batch_size"`
    Errors          []string      `json:"errors,omitempty"`
}
```

### Performance Estimation

Estimate ingestion time before processing:

```go
estimate := bulkFacade.EstimateIngestionTime(1000000) // 1M rows
fmt.Printf("Estimated duration: %.1f seconds\n", estimate.EstimatedDuration)
fmt.Printf("Expected throughput: %.0f rows/sec\n", estimate.RowsPerSecond)
fmt.Printf("Memory requirement: %dMB\n", estimate.MemoryEstimateMB)
```

## Best Practices

### Data Preparation

1. **Pre-compute Path Hashes**: Set `SkipHashCalculation: true` if you calculate hashes yourself
2. **Sort by Depth**: Directories should be inserted before their children
3. **Validate Data**: Use `ValidateFileRows()` before ingestion
4. **Sanitize Fields**: Use `SanitizeFileRows()` to handle edge cases

```go
// Validate before ingesting
errors := bulkFacade.ValidateFileRows(fileRows)
if len(errors) > 0 {
    log.Printf("Validation errors: %v", errors)
}

// Sanitize to fix common issues
fileRows = bulkFacade.SanitizeFileRows(fileRows)
```

### Memory Management

For very large datasets (millions of files):

```go
// Process in chunks to manage memory
chunkSize := 100000
for i := 0; i < len(allFiles); i += chunkSize {
    end := i + chunkSize
    if end > len(allFiles) {
        end = len(allFiles)
    }
    
    chunk := allFiles[i:end]
    result, err := bulkFacade.IngestFiles(ctx, volumeID, chunk)
    if err != nil {
        log.Printf("Chunk %d failed: %v", i/chunkSize, err)
        continue
    }
    
    log.Printf("Processed chunk %d: %d rows in %v",
        i/chunkSize, result.ProcessedRows, result.Duration)
}
```

### Context and Timeouts

Always use contexts with appropriate timeouts:

```go
// For large datasets, use generous timeouts
ctx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
defer cancel()

result, err := bulkFacade.IngestFiles(ctx, volumeID, fileRows)
```

### Monitoring System Resources

Monitor system resources during large ingestions:

```go
// Check available memory before starting
if availableMB := getAvailableMemory(); availableMB < 512 {
    // Reduce batch size or process in smaller chunks
    opts.BatchSize = 2000
}
```

## Integration Examples

### Volume Scanner Integration

```go
type VolumeScanner struct {
    storeIntegration *store.Integration
}

func (s *VolumeScanner) ScanVolume(ctx context.Context, volumeID string) error {
    // 1. Discover files
    files, err := s.discoverFiles(volumeID)
    if err != nil {
        return err
    }
    
    // 2. Convert to FileRow format
    fileRows := s.convertToFileRows(files)
    
    // 3. Bulk ingest
    bulkFacade := s.storeIntegration.GetBulkIngestFacade()
    result, err := bulkFacade.IngestFiles(ctx, volumeID, fileRows)
    if err != nil {
        return fmt.Errorf("bulk ingestion failed: %w", err)
    }
    
    log.Printf("Scanned %d files in %v (%.0f files/sec)",
        result.ProcessedRows, result.Duration, result.RowsPerSecond)
    
    return nil
}
```

### Progress Tracking

```go
func ingestWithProgress(ctx context.Context, bulkFacade *store.BulkIngestFacade, 
                      volumeID string, allFiles []store.FileRow) error {
    
    chunkSize := 50000
    totalChunks := (len(allFiles) + chunkSize - 1) / chunkSize
    
    for i := 0; i < len(allFiles); i += chunkSize {
        end := i + chunkSize
        if end > len(allFiles) {
            end = len(allFiles)
        }
        
        chunk := allFiles[i:end]
        chunkNum := i/chunkSize + 1
        
        log.Printf("Processing chunk %d/%d (%d files)...", chunkNum, totalChunks, len(chunk))
        
        result, err := bulkFacade.IngestFiles(ctx, volumeID, chunk)
        if err != nil {
            return fmt.Errorf("chunk %d failed: %w", chunkNum, err)
        }
        
        progress := float64(end) / float64(len(allFiles)) * 100
        log.Printf("Progress: %.1f%% - Processed %d files (%.0f files/sec)",
            progress, result.ProcessedRows, result.RowsPerSecond)
    }
    
    return nil
}
```

## Testing and Benchmarking

### Running Performance Tests

```bash
# Basic tests
go test -v ./internal/store/ -run TestBulkIngester

# Benchmarks
go test -bench=BenchmarkBulkIngest -benchmem ./internal/store/

# Million row test (requires RUN_MILLION_ROW_TEST=true)
RUN_MILLION_ROW_TEST=true go test -v ./internal/store/ -run TestMillionRowIngestion

# Performance benchmark script
./scripts/bulk-ingest-benchmark.sh --million-row
```

### Custom Benchmarks

```go
func BenchmarkCustomIngestion(b *testing.B) {
    // Setup
    bulkFacade := setupBulkFacade(b)
    fileRows := generateTestData(10000)
    
    b.ResetTimer()
    b.ReportAllocs()
    
    for i := 0; i < b.N; i++ {
        result, err := bulkFacade.IngestFiles(context.Background(), 
                                           "benchmark-volume", fileRows)
        if err != nil {
            b.Fatalf("Benchmark failed: %v", err)
        }
        
        b.ReportMetric(result.RowsPerSecond, "rows/sec")
    }
}
```

## Troubleshooting

### Common Issues

1. **Slow Performance**
   - Check available memory and disk space
   - Reduce batch size if memory-constrained
   - Enable adaptive sizing for SQLite
   - Verify database connection performance

2. **Memory Usage**
   - Process data in smaller chunks
   - Use streaming approach for very large datasets
   - Monitor system resources during ingestion

3. **Constraint Violations**
   - Check for duplicate path hashes
   - Ensure parent directories exist before children
   - Validate required fields before ingestion

4. **Transaction Timeouts**
   - Increase context timeout
   - Reduce batch size
   - Check database connection settings

### Debug Logging

Enable detailed logging for troubleshooting:

```go
// Enable debug logging (implementation-specific)
log.SetLevel(log.DebugLevel)

result, err := bulkFacade.IngestFiles(ctx, volumeID, fileRows)
```

## Advanced Usage

### Custom Conflict Handling

```go
opts := store.BulkIngestOptions{
    ConflictStrategy: "replace", // Update existing entries
    BatchSize:        20000,
}

result, err := bulkFacade.IngestFiles(ctx, volumeID, fileRows, opts)
```

### Directory Rollup Ingestion

```go
rollups := []store.DirRollupRow{
    {
        DirID:      123,
        SizeBytes:  1048576,
        FileCount:  100,
        ComputedAt: time.Now(),
    },
}

result, err := bulkFacade.IngestDirectoryRollups(ctx, rollups)
```

### Performance Profiling

```go
import _ "net/http/pprof"

// Enable pprof endpoint for performance analysis
go func() {
    log.Println(http.ListenAndServe("localhost:6060", nil))
}()

// Run ingestion and analyze with:
// go tool pprof http://localhost:6060/debug/pprof/profile
```

## API Reference

For complete API documentation, see the generated GoDoc:

```bash
godoc -http=:8080
# Navigate to http://localhost:8080/pkg/github.com/mantonx/volumeviz/internal/store/
```

## Performance Results

Typical performance on modern hardware:

| Database   | Dataset Size | Duration | Throughput | Method |
|------------|-------------|----------|------------|---------|
| PostgreSQL | 100K files  | 2.1s     | 47K/sec    | CopyFrom + Staging |
| PostgreSQL | 1M files    | 18.5s    | 54K/sec    | CopyFrom + Staging |
| SQLite     | 100K files  | 3.8s     | 26K/sec    | Adaptive Batching |
| SQLite     | 1M files    | 42.1s    | 24K/sec    | Adaptive Batching |

*Results may vary based on hardware, data patterns, and system configuration.*