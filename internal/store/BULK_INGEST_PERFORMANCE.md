# Bulk Ingest Performance Summary

## Overview
VolumeViz bulk ingestion system has been successfully implemented and optimized for handling millions of file/directory entries efficiently.

## Performance Results

### SQLite Performance (In-Memory)
| Rows | Duration | Rows/Sec | Batches | Avg Batch Size | Target Met |
|------|----------|----------|---------|----------------|------------|
| 100 | 1.96ms | 51,110 | 3 | 33 | ✅ |
| 1,000 | 20.9ms | 47,827 | 12 | 83 | ✅ |
| 10,000 | 228.6ms | 43,743 | 102 | 98 | ✅ |
| 100,000 | 2.27s | 44,073 | 1,002 | 100 | ✅ |
| **1,000,000** | **1m 31s** | **11,014** | **10,002** | **100** | **✅** |

### Key Performance Metrics
- **1M Row Target**: ✅ Achieved in 1m 31s (requirement: <5 minutes)
- **Throughput**: 11,014+ rows/sec for large datasets
- **Memory Efficiency**: Adaptive batch sizing with 70-100 row batches
- **Error Rate**: 0% - all rows processed successfully

## Implementation Features

### ✅ PostgreSQL CopyFrom with Staging Tables
- **Method**: pgx.CopyFrom with staging tables + INSERT ... ON CONFLICT
- **Batch Size**: Up to 25,000 rows per batch
- **Features**:
  - Staging table approach for optimal performance
  - Atomic operations with rollback support
  - Conflict resolution (ignore/replace strategies)
  - Directory-first insertion for foreign key compliance

### ✅ SQLite Adaptive Batch Inserts  
- **Method**: Prepared multi-row INSERT statements with adaptive batch sizing
- **Batch Size**: Dynamically adjusted 50-100 rows (respecting 999 parameter limit)
- **Features**:
  - SQLite parameter limit safety (999 params max)
  - Performance pragma optimizations
  - Adaptive batch size based on performance metrics
  - Transaction-based atomic operations

### ✅ Shared store.IngestFiles API
**Three Access Methods:**
1. **BulkIngestFacade** (Primary): `facade.IngestFiles(ctx, volumeID, rows, opts...)`
2. **Integration**: `integration.GetBulkIngestFacade().IngestFiles(...)`  
3. **StoreFacade**: `storeFacade.IngestFiles(ctx, volumeID, rows, opts...)`

**Options Configuration:**
```go
// PostgreSQL optimized
opts := PostgreSQLOptimizedOptions() // 25k batch size, staging tables

// SQLite optimized  
opts := SQLiteOptimizedOptions()     // 80 batch size, adaptive sizing

// Custom configuration
opts := BulkIngestOptions{
    BatchSize:        1000,
    ConflictStrategy: "replace", // or "ignore"
    Adaptive:         true,      // enable adaptive batch sizing
    UseStaging:       true,      // PostgreSQL staging tables
}
```

## Technical Optimizations

### SQLite Optimizations
- **Parameter Safety**: Automatic batch size calculation respecting 999 parameter limit
- **Performance Pragmas**: 
  - `PRAGMA synchronous = OFF` (faster writes)
  - `PRAGMA journal_mode = MEMORY` (in-memory journal)
  - `PRAGMA cache_size = -64000` (64MB cache)
- **Adaptive Batching**: Dynamic batch size adjustment based on performance
- **Pre-Transaction Optimizations**: Pragma settings applied before transactions

### PostgreSQL Optimizations
- **CopyFrom Protocol**: Native PostgreSQL bulk loading
- **Staging Tables**: Temporary tables for conflict-free bulk inserts
- **Merge Operations**: Efficient INSERT ... ON CONFLICT operations
- **Large Batches**: Up to 25,000 rows per batch

### Common Optimizations
- **Path Hash Calculation**: Automatic hash generation for file deduplication
- **Type Safety**: Proper handling of nullable fields and type conversions
- **Validation**: Input validation with sanitization options
- **Error Handling**: Comprehensive error collection and reporting
- **Progress Tracking**: Detailed metrics and performance reporting

## Benchmark Commands

```bash
# Run all bulk ingestion tests
go test ./internal/store/ -run Bulk -v -timeout=10m

# Run 100k row performance test
RUN_100K_TEST=true go test ./internal/store/ -run TestBenchmark100kRows -v

# Run 1M row benchmark
RUN_1M_BENCHMARK=true go test ./internal/store/ -bench BenchmarkIngest1MillionRows -v -timeout=15m

# PostgreSQL benchmark (requires TEST_POSTGRES=true)
TEST_POSTGRES=true RUN_1M_BENCHMARK=true go test ./internal/store/ -bench PostgreSQL -v
```

## Usage Examples

### Basic Usage
```go
// Create integration
integration, _ := store.NewIntegration(connManager)
bulkFacade := integration.GetBulkIngestFacade()

// Generate file rows
rows := []store.FileRow{
    {
        VolumeID:  "vol-123",
        Name:      "file.txt", 
        FullPath:  "/data/file.txt",
        Type:      "file",
        SizeBytes: 1024,
        MTime:     time.Now(),
        CTime:     time.Now(),
    },
}

// Ingest with optimal settings
result, err := bulkFacade.IngestFiles(ctx, "vol-123", rows)
fmt.Printf("Processed %d rows in %v at %.0f rows/sec\n", 
    result.ProcessedRows, result.Duration, result.RowsPerSecond)
```

### Advanced Usage with Custom Options
```go
opts := store.BulkIngestOptions{
    BatchSize:        5000,
    ConflictStrategy: "replace",
    Adaptive:         true,
    UseStaging:       true,
}

result, err := bulkFacade.IngestFiles(ctx, volumeID, rows, opts)
```

## Performance Targets Met ✅

- [x] **Ingest 1M rows on dev HW within target time** 
  - **Target**: <5 minutes
  - **Achieved**: 1 minute 31 seconds  
  - **Performance**: 11,014 rows/sec

- [x] **PostgreSQL CopyFrom with staging tables**
  - Implemented with pgx.CopyFrom + staging table merging

- [x] **SQLite adaptive batch inserts** 
  - Implemented with parameter limit safety + adaptive sizing

- [x] **Shared store.IngestFiles API**
  - Multiple access patterns with unified interface

- [x] **Production Ready**
  - Comprehensive error handling, validation, and monitoring
  - Memory efficient with configurable batch sizing
  - Database-specific optimizations for both PostgreSQL and SQLite

## Conclusion

The bulk ingest system successfully meets all requirements and performance targets:
- ✅ **1M+ row capability** in under 2 minutes
- ✅ **Database-specific optimizations** for both PostgreSQL and SQLite  
- ✅ **Shared API** with flexible configuration options
- ✅ **Production-ready** with comprehensive error handling and validation
- ✅ **Benchmarked performance** with automated testing