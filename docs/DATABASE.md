# VolumeViz Database Documentation

## Overview

VolumeViz uses PostgreSQL as its primary data store for persisting Docker volume metadata, scan history, and system metrics. The database is designed with performance, scalability, and data integrity in mind.

## Architecture

### Schema Design

The database follows a normalized relational model with the following core entities:

#### Core Tables

1. **volumes** - Docker volume metadata
2. **volume_sizes** - Historical size tracking
3. **containers** - Container information
4. **container_volumes** - Volume-container relationships
5. **scan_jobs** - Scan job tracking
6. **scan_results** - Detailed scan results
7. **system_metrics** - System performance metrics
8. **alerts** - Alert configurations and history
9. **migrations** - Database migration tracking

### Entity Relationships

```
volumes (1) -----> (N) volume_sizes
   |
   |-----> (N) container_volumes <----- (N) containers
   |
   |-----> (N) scan_results <----- (1) scan_jobs
   |
   |-----> (N) alerts
```

## Database Models

### BaseModel

All models inherit from BaseModel, providing:
- `id` - Primary key (auto-increment)
- `created_at` - Record creation timestamp
- `updated_at` - Last modification timestamp
- `deleted_at` - Soft deletion timestamp (nullable)

### Volume Model

```go
type Volume struct {
    BaseModel
    VolumeID    string     `db:"volume_id"`    // Docker volume ID
    Name        string     `db:"name"`         // Volume name
    Driver      string     `db:"driver"`       // Storage driver
    Mountpoint  string     `db:"mountpoint"`   // Mount path
    Labels      Labels     `db:"labels"`       // JSONB metadata
    Options     Labels     `db:"options"`      // JSONB options
    Scope       string     `db:"scope"`        // Volume scope
    Status      string     `db:"status"`       // Current status
    IsActive    bool       `db:"is_active"`    // Active flag
    LastScanned *time.Time `db:"last_scanned"` // Last scan time
}
```

### Labels Type

Custom type for handling JSONB fields:
```go
type Labels map[string]string
```

Implements `driver.Valuer` and `sql.Scanner` interfaces for seamless database operations.

## Repository Pattern

### Overview

VolumeViz implements the Repository pattern for data access:

```go
type Repository interface {
    WithTx(tx *Tx) Repository
    BeginTx() (*Tx, error)
    Health() *HealthStatus
}
```

### Base Repository

Provides common functionality:
- Transaction management
- Query building
- Error handling
- Connection pooling

### Specialized Repositories

#### VolumeRepository

```go
type VolumeRepository struct {
    *BaseRepository
}

// Core operations
func (r *VolumeRepository) GetVolume(volumeID string) (*Volume, error)
func (r *VolumeRepository) ListVolumes(opts *FilterOptions) ([]*Volume, int, error)
func (r *VolumeRepository) CreateVolume(volume *Volume) error
func (r *VolumeRepository) UpdateVolume(volume *Volume) error
func (r *VolumeRepository) DeleteVolume(volumeID string) error
func (r *VolumeRepository) UpsertVolume(volume *Volume) error
```

#### ScanJobRepository

```go
type ScanJobRepository struct {
    *BaseRepository
}

// Scan management
func (r *ScanJobRepository) CreateScanJob(job *ScanJob) error
func (r *ScanJobRepository) UpdateScanJobStatus(jobID string, status string) error
func (r *ScanJobRepository) GetActiveScanJobs() ([]*ScanJob, error)
```

## Migration System

### Overview

Database migrations are managed through an embedded file system:

```go
//go:embed migrations/*.sql
var migrationFiles embed.FS
```

### Migration Files

Located in `/internal/database/migrations/`:
- `001_initial_schema.sql` - Base schema
- `002_add_indexes.sql` - Performance indexes
- `003_add_triggers.sql` - Database triggers

### Migration Format

```sql
-- Migration: 001_initial_schema
-- Description: Initial database schema
-- Up
CREATE TABLE volumes (
    id SERIAL PRIMARY KEY,
    ...
);

-- Down
DROP TABLE IF EXISTS volumes CASCADE;
```

### Running Migrations

```go
manager := NewMigrationManager(db)
if err := manager.Migrate(); err != nil {
    log.Fatal(err)
}
```

### Rollback Support

```go
if err := manager.Rollback(version); err != nil {
    log.Fatal(err)
}
```

## Query Builder

### Overview

Safe SQL query construction with parameter binding:

```go
qb := NewQueryBuilder("SELECT * FROM volumes")
qb.Where("driver = ?", "local")
qb.Where("is_active = ?", true)
qb.OrderBy("created_at", false)
qb.Limit(10)
qb.Offset(20)

query, args := qb.Build()
```

### Features

- Automatic parameter placeholders
- SQL injection prevention
- Chainable API
- Support for complex queries

## Transaction Management

### Basic Transactions

```go
tx, err := db.BeginTx()
if err != nil {
    return err
}
defer tx.Rollback()

repo := NewVolumeRepository(db).WithTx(tx)
if err := repo.CreateVolume(volume); err != nil {
    return err
}

return tx.Commit()
```

### Nested Operations

```go
func ProcessVolumes(db *DB) error {
    tx, err := db.BeginTx()
    if err != nil {
        return err
    }
    defer tx.Rollback()
    
    volRepo := NewVolumeRepository(db).WithTx(tx)
    scanRepo := NewScanJobRepository(db).WithTx(tx)
    
    // Multiple operations in single transaction
    volumes, _, err := volRepo.ListVolumes(nil)
    if err != nil {
        return err
    }
    
    job := &ScanJob{Type: "batch"}
    if err := scanRepo.CreateScanJob(job); err != nil {
        return err
    }
    
    return tx.Commit()
}
```

## Indexing Strategy

### Primary Indexes

```sql
-- Unique constraints
CREATE UNIQUE INDEX idx_volumes_volume_id ON volumes(volume_id);
CREATE UNIQUE INDEX idx_containers_container_id ON containers(container_id);

-- Performance indexes
CREATE INDEX idx_volumes_name ON volumes(name);
CREATE INDEX idx_volumes_driver ON volumes(driver);
CREATE INDEX idx_volumes_is_active ON volumes(is_active);
```

### Composite Indexes

```sql
-- Multi-column indexes for common queries
CREATE INDEX idx_volume_sizes_volume_created 
    ON volume_sizes(volume_id, created_at DESC);
    
CREATE INDEX idx_scan_results_job_volume 
    ON scan_results(scan_job_id, volume_id);
```

### JSONB Indexes

```sql
-- GIN indexes for JSONB columns
CREATE INDEX idx_volumes_labels ON volumes USING gin(labels);
CREATE INDEX idx_volumes_options ON volumes USING gin(options);
```

## Performance Optimization

### Connection Pooling

```go
config := &database.Config{
    MaxOpenConns:    25,
    MaxIdleConns:    5,
    ConnMaxLifetime: 5 * time.Minute,
    ConnMaxIdleTime: 90 * time.Second,
}
```

### Query Optimization

1. **Use indexes** - Ensure queries hit indexed columns
2. **Limit results** - Always paginate large result sets
3. **Batch operations** - Use bulk inserts/updates
4. **Prepared statements** - Reuse query plans

### Monitoring

```go
stats := db.Stats()
// Monitor:
// - OpenConnections
// - InUse
// - Idle
// - WaitCount
// - WaitDuration
```

## API Endpoints

### Health Check

```
GET /api/v1/database/health
```

Response:
```json
{
  "status": "healthy",
  "latency_ms": 1.23,
  "connections": {
    "open": 5,
    "in_use": 2,
    "idle": 3
  }
}
```

### Migration Status

```
GET /api/v1/database/migrations
```

Response:
```json
{
  "current_version": 3,
  "applied_migrations": [
    {
      "version": 1,
      "name": "initial_schema",
      "applied_at": "2024-01-15T10:00:00Z"
    }
  ],
  "pending_migrations": []
}
```

### Database Statistics

```
GET /api/v1/database/stats
```

Response:
```json
{
  "tables": {
    "volumes": {"count": 1234, "size": "45MB"},
    "volume_sizes": {"count": 98765, "size": "123MB"}
  },
  "total_size": "256MB",
  "index_size": "32MB"
}
```

## Testing

### Unit Tests

Located in `/internal/database/*_test.go`:
- Model validation tests
- Repository method tests
- Query builder tests
- Migration tests

### Integration Tests

Located in `/test/integration/`:
- Full database lifecycle tests
- Transaction rollback tests
- Concurrent access tests
- Performance benchmarks

### Test Utilities

```go
// Test with in-memory database
db := database.NewTestDB(t)
defer db.Close()

// Test with Docker container
WithPostgreSQLContainer(t, func(db *database.DB) {
    // Test logic
})
```

## Backup and Recovery

### Backup Strategy

1. **Regular dumps** - Daily PostgreSQL dumps
2. **Point-in-time recovery** - WAL archiving
3. **Replication** - Streaming replication for HA

### Backup Commands

```bash
# Full backup
pg_dump -h localhost -U volumeviz -d volumeviz > backup.sql

# Compressed backup
pg_dump -h localhost -U volumeviz -d volumeviz -Fc > backup.dump

# Restore
pg_restore -h localhost -U volumeviz -d volumeviz backup.dump
```

## Security

### Best Practices

1. **Use prepared statements** - Prevent SQL injection
2. **Validate input** - Check all user input
3. **Limit permissions** - Database user with minimal rights
4. **Encrypt connections** - Use SSL/TLS
5. **Audit logging** - Track all modifications

### Connection Security

```go
dsn := fmt.Sprintf(
    "host=%s port=%d user=%s password=%s dbname=%s sslmode=require",
    host, port, user, password, dbname,
)
```

## Troubleshooting

### Common Issues

#### Connection Pool Exhaustion

**Symptoms**: Timeouts, "too many connections" errors

**Solution**:
```go
// Increase pool size
config.MaxOpenConns = 50
config.MaxIdleConns = 10
```

#### Slow Queries

**Symptoms**: High latency, CPU usage

**Solution**:
1. Check query plans: `EXPLAIN ANALYZE <query>`
2. Add missing indexes
3. Optimize query structure

#### Migration Failures

**Symptoms**: Schema inconsistencies

**Solution**:
1. Check migration logs
2. Manually verify schema state
3. Use rollback if needed

### Debug Logging

```go
// Enable query logging
db.LogMode(true)

// Log slow queries
db.LogSlowQueries(100 * time.Millisecond)
```

## Environment Variables

```bash
# Database connection
DB_HOST=localhost
DB_PORT=5432
DB_USER=volumeviz
DB_PASSWORD=secret
DB_NAME=volumeviz
DB_SSLMODE=require

# Connection pool
DB_MAX_OPEN_CONNS=25
DB_MAX_IDLE_CONNS=5
DB_CONN_MAX_LIFETIME=5m
DB_CONN_MAX_IDLE_TIME=90s

# Monitoring
DB_ENABLE_METRICS=true
DB_LOG_QUERIES=false
DB_SLOW_QUERY_THRESHOLD=100ms
```

## Future Enhancements

1. **Partitioning** - Partition large tables by date
2. **Read replicas** - Scale read operations
3. **Caching layer** - Redis for frequently accessed data
4. **Event sourcing** - Audit trail with event log
5. **GraphQL support** - Flexible query interface