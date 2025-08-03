# Database Performance Guide

VolumeViz supports both SQLite and PostgreSQL with comprehensive performance optimizations for each database type. This guide compares their performance characteristics and helps you choose the right database for your use case.

## Performance Optimizations Applied

### SQLite Optimizations (Automatic)

**Connection-Level:**
- **WAL Mode**: Write-Ahead Logging for better concurrency and crash recovery
- **Memory-Mapped I/O**: 256MB mmap for faster read operations
- **Page Size**: 4KB pages optimized for modern SSDs  
- **Cache Size**: 64MB in-memory cache for frequently accessed data
- **Temp Storage**: Memory-based temporary tables and indexes
- **Shared Cache**: Efficient memory usage across connections

**Runtime Settings:**
- `PRAGMA journal_mode=WAL` - Maximum concurrency
- `PRAGMA synchronous=NORMAL` - Balanced safety/performance
- `PRAGMA cache_size=-64000` - 64MB cache
- `PRAGMA temp_store=memory` - Memory-based temp storage
- `PRAGMA mmap_size=268435456` - 256MB memory-mapped I/O
- `PRAGMA foreign_keys=ON` - Data integrity
- `PRAGMA auto_vacuum=INCREMENTAL` - Prevent database bloat

**Maintenance Operations:**
- `ANALYZE` - Query planner statistics
- `PRAGMA incremental_vacuum` - Space reclamation
- `PRAGMA optimize` - Query planner optimization

### PostgreSQL Optimizations (Automatic)

**Connection-Level:**
- **Connection Pooling**: 100 max connections, 50 idle connections
- **Connection Lifetime**: 1 hour (vs 30 minutes for SQLite)
- **SSL**: Prefer secure connections
- **Application Name**: "volumeviz" for monitoring
- **Timeouts**: Statement, lock, and idle transaction timeouts

**Session-Level Settings:**
```sql
-- Memory Settings
SET work_mem = '64MB'                    -- Sorting/hashing operations
SET maintenance_work_mem = '256MB'       -- VACUUM, CREATE INDEX
SET temp_buffers = '32MB'               -- Temporary tables
SET effective_cache_size = '2GB'        -- OS cache hint

-- Query Planner (SSD-optimized)
SET random_page_cost = 1.1              -- SSD random access cost
SET seq_page_cost = 1.0                 -- Sequential access baseline
SET effective_io_concurrency = 200      -- SSD concurrent I/O

-- JIT Compilation (PostgreSQL 11+)
SET jit = on                            -- Just-In-Time compilation
SET jit_above_cost = 100000             -- JIT threshold
SET jit_optimize_above_cost = 500000    -- Optimization threshold

-- Parallel Queries (PostgreSQL 9.6+)
SET max_parallel_workers_per_gather = 4 -- Parallel workers
SET parallel_tuple_cost = 0.1           -- Tuple transfer cost
SET parallel_setup_cost = 1000.0        -- Setup cost

-- Safety & Timeouts
SET statement_timeout = '300s'          -- Prevent runaway queries
SET lock_timeout = '30s'                -- Lock acquisition timeout
SET idle_in_transaction_session_timeout = '60s' -- Idle transactions
```

**Advanced Features:**
- Extended statistics for correlated columns
- GIN indexes for JSONB optimization
- Hash, merge, and nested loop joins
- Bitmap and index-only scans

## Performance Benchmarks

### SQLite Performance Results

Based on VolumeViz benchmarks with optimizations:

- **Insert Throughput**: 90,000+ records/second
- **Query Throughput**: 98,000+ queries/second
- **Database Size**: Compact (304KB for 5,000 records)
- **Memory Usage**: 64MB cache + 256MB mmap = ~320MB
- **Optimization Time**: Sub-millisecond database optimization
- **Concurrent Reads**: Excellent (WAL mode)
- **Concurrent Writes**: Serialized (single writer)

### PostgreSQL Performance Expectations

Typical performance with VolumeViz optimizations:

- **Insert Throughput**: 10,000+ records/second (with ACID guarantees)
- **Query Throughput**: Excellent for complex queries with joins
- **Memory Usage**: Configurable (work_mem * connections + shared_buffers)
- **Concurrent Connections**: 100+ simultaneous connections
- **Complex Queries**: 5-10x performance improvement with JIT
- **Parallel Queries**: Automatic parallelization for large datasets
- **Index Performance**: Advanced indexing (B-tree, Hash, GIN, GiST)

## Use Case Decision Matrix

### Choose SQLite When:

**✅ Ideal Scenarios:**
- Development and testing environments
- Single-node deployments
- Small to medium datasets (< 10,000 volumes)
- Low concurrent write requirements
- Simple deployment requirements
- Resource-constrained environments
- CI/CD pipelines and testing
- Demonstrations and POCs
- Edge deployments

**Performance Profile:**
- Excellent single-threaded performance
- Minimal memory footprint
- Zero configuration overhead
- File-based portability

### Choose PostgreSQL When:

**✅ Ideal Scenarios:**
- Production environments with high concurrency
- Large datasets (10,000+ volumes)
- Complex analytical queries
- Multi-node deployments
- High availability requirements
- Advanced features needed (triggers, stored procedures)
- Compliance requirements (SOX, HIPAA)
- Horizontal scaling needs

**Performance Profile:**
- Excellent concurrent performance
- Advanced query optimization
- Horizontal and vertical scaling
- Enterprise-grade features

## Performance Comparison Summary

| Metric | SQLite | PostgreSQL |
|--------|--------|------------|
| **Insert Rate** | 90,000/sec | 10,000/sec (ACID) |
| **Query Rate** | 98,000/sec | Variable (complex queries excel) |
| **Memory Base** | ~320MB | ~500MB+ (configurable) |
| **Concurrent Writes** | 1 writer | 100+ writers |
| **Concurrent Reads** | Unlimited | 100+ readers |
| **Setup Time** | Instant | Minutes |
| **File Size** | Single file | Multiple files + WAL |
| **Backup** | File copy | pg_dump/pg_basebackup |
| **Monitoring** | Basic | Advanced (pg_stat_*) |
| **Extensions** | Limited | Extensive ecosystem |

## Workload-Specific Recommendations

### High-Frequency Writes (> 1000 writes/sec)
- **SQLite**: Excellent for single-threaded writes
- **PostgreSQL**: Better for concurrent writes

### Complex Analytics (JOINs, aggregations)  
- **SQLite**: Good for simple queries
- **PostgreSQL**: Excellent with query optimization

### Large Datasets (> 100GB)
- **SQLite**: Practical limit ~100GB
- **PostgreSQL**: Scales to multi-TB

### High Availability
- **SQLite**: File-level backups
- **PostgreSQL**: Streaming replication, failover

### Compliance & Auditing
- **SQLite**: Basic transaction logging
- **PostgreSQL**: Advanced auditing, row-level security

## Migration Path

### SQLite → PostgreSQL Migration

When you outgrow SQLite:

1. **Export SQLite Data**:
   ```bash
   sqlite3 volumeviz.db ".dump" > volumeviz_data.sql
   ```

2. **Modify for PostgreSQL**:
   - Change `AUTOINCREMENT` to `SERIAL`
   - Update data types (TEXT → VARCHAR, etc.)
   - Adjust constraint syntax

3. **Import to PostgreSQL**:
   ```bash
   psql volumeviz < volumeviz_data.sql
   ```

### PostgreSQL → SQLite Migration

For simplification or edge deployment:

1. **Export PostgreSQL Data**:
   ```bash
   pg_dump --data-only --inserts volumeviz > data_export.sql
   ```

2. **Create SQLite Schema**:
   ```bash
   DB_TYPE=sqlite ./volumeviz --migrate
   ```

3. **Import Data** (after adapting SQL syntax)

## Monitoring & Maintenance

### SQLite Monitoring
- File size growth
- Query performance logs
- WAL file size
- Pragma statistics

### PostgreSQL Monitoring  
- Connection pool utilization
- Query performance (pg_stat_statements)
- Index usage (pg_stat_user_indexes)
- Vacuum and analyze frequency
- WAL generation rate

### Automated Optimization

Both databases support automatic optimization:

```go
// Optimize database performance (runs appropriate optimizations)
if err := db.OptimizeDatabase(); err != nil {
    log.Printf("Database optimization failed: %v", err)
}
```

**SQLite**: ANALYZE, incremental vacuum, query planner optimization
**PostgreSQL**: Table-specific ANALYZE, extended statistics, materialized view refresh

## Configuration Examples

### High-Performance SQLite
```bash
DB_TYPE=sqlite
DB_PATH=/fast-ssd/volumeviz.db
```

### High-Performance PostgreSQL
```bash
DB_TYPE=postgres
DB_HOST=postgres-primary
DB_PORT=5432
DB_NAME=volumeviz
DB_MAX_OPEN_CONNS=100
DB_MAX_IDLE_CONNS=50
```

### Development (SQLite)
```bash
DB_TYPE=sqlite
DB_PATH=./dev.db
```

### Production (PostgreSQL)
```bash
DB_TYPE=postgres
DB_HOST=pg-cluster.local
DB_SSL_MODE=require
DB_MAX_OPEN_CONNS=200
```

## Performance Tuning Tips

### SQLite Performance Tips
1. Use WAL mode (automatically enabled)
2. Increase cache size for large datasets
3. Use ANALYZE regularly
4. Consider PRAGMA optimize
5. Monitor database file size growth

### PostgreSQL Performance Tips
1. Tune shared_buffers (server-level)
2. Monitor query performance with pg_stat_statements
3. Use EXPLAIN ANALYZE for slow queries
4. Regular VACUUM and ANALYZE
5. Consider connection pooling (pgbouncer)

Both database configurations are automatically optimized by VolumeViz, providing excellent performance out of the box for their respective use cases.