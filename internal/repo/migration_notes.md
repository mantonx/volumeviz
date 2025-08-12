# sqlc Migration Status and Next Steps

## Completed ✅

1. **Domain-Organized Queries**: Consolidated all queries into domain-specific files:
   - `internal/db/queries/postgres/volumes.sql` - Docker volume, container, and mount operations
   - `internal/db/queries/postgres/scans.sql` - File entries, directory nodes, rollups, and explorer queries  
   - `internal/db/queries/postgres/stats.sql` - Usage snapshots, metrics, and volume size operations
   - `internal/db/queries/postgres/offsets.sql` - Scan job and health/diagnostic operations

2. **sqlc Configuration**: Updated `sqlc.yaml` to use new query organization:
   - PostgreSQL queries generate to `internal/db/sqlc/`
   - SQLite queries would generate to `internal/db/sqlc_sqlite/` (needs debugging)

3. **Makefile Integration**: Added `make db-generate` target and CI check:
   - `make db-generate` - Generates Go code from SQL queries
   - `make db-generate-check` - CI-friendly check for idempotent generation

4. **Repository Interface Layer**: Created clean interfaces in `internal/repo/`:
   - `interfaces.go` - Complete repository interfaces that hide sqlc types
   - `postgres.go` - PostgreSQL implementation (volume operations implemented as example)
   - `repository_test.go` - Test structure for repository operations

## In Progress 🚧

1. **Repository Implementation**: Only volume operations are fully implemented in `postgres.go`
   - Container operations - stub implementations exist
   - VolumeMount operations - stub implementations exist  
   - Scan operations - stub implementations exist
   - Stats operations - stub implementations exist
   - Offset operations - stub implementations exist

2. **SQLite Query Issues**: SQLite query conversion has some syntax issues that need debugging:
   - CTE (WITH clause) parsing issues in `stats.sql`
   - Table alias issues in `scans.sql`

## Remaining Work 📋

### High Priority

1. **Fix SQLite Queries**: Debug and fix the SQLite query syntax issues
   - Fix CTE syntax in `CompactDailyToWeekly` query
   - Fix table alias issues in subqueries
   - Test SQLite query generation

2. **Complete Repository Implementation**: Implement all the stub methods in `postgres.go`
   - Container operations (13 methods)
   - VolumeMount operations (13 methods)
   - Scan operations (file entries, dir nodes, rollups, explorer - ~35 methods)
   - Stats operations (usage snapshots, metrics, volume sizes - ~25 methods)
   - Offset operations (scan jobs, health - ~17 methods)

3. **Remove Ad-Hoc SQL**: Replace raw SQL in application code with sqlc queries
   - `internal/services/lifecycle/retention.go` - Has DELETE statements and CREATE TABLE
   - Move these operations to proper sqlc queries

### Medium Priority

1. **SQLite Repository Implementation**: Create `sqlite.go` with SQLite-specific implementation
   - Similar structure to `postgres.go` but using SQLite-generated code
   - Handle SQLite-specific type conversions

2. **Repository Factory**: Create factory function to choose between PostgreSQL/SQLite implementations
   ```go
   func NewRepository(dbType string, db interface{}) Repository {
       switch dbType {
       case "postgres":
           return NewPostgreSQLRepository(db.(*pgxpool.Pool))
       case "sqlite":
           return NewSQLiteRepository(db.(*sql.DB))
       default:
           panic("unsupported database type")
       }
   }
   ```

3. **Integration Tests**: Add real database integration tests
   - Use testcontainers for PostgreSQL tests
   - Use in-memory SQLite for SQLite tests
   - Test transaction behavior
   - Test bulk operations

### Low Priority

1. **Performance Testing**: Benchmark repository operations
   - Compare performance vs. current store implementation
   - Optimize type conversions if needed

2. **Migration Guide**: Document how to migrate from old store to new repo
   - Update service layers to use Repository interface
   - Replace direct store dependencies

## Example Usage

```go
// Service layer should depend only on the interface
type VolumeService struct {
    repo repo.Repository
}

func (s *VolumeService) CreateVolume(ctx context.Context, req CreateVolumeRequest) (*Volume, error) {
    params := repo.CreateVolumeParams{
        VolumeID:   req.VolumeID,
        Name:       req.Name,
        Driver:     req.Driver,
        // ... other fields
    }
    
    return s.repo.CreateVolume(ctx, params)
}
```

## Benefits of This Architecture

1. **Clean Separation**: Services depend only on interfaces, not sqlc types
2. **Database Agnostic**: Same interface works for PostgreSQL and SQLite
3. **Type Safety**: sqlc generates type-safe Go code from SQL
4. **Maintainable**: SQL is organized by domain and easy to find
5. **Testable**: Easy to mock the Repository interface for unit tests
6. **CI Integration**: Ensures generated code is always up-to-date

## Files Modified/Created

- ✅ `sqlc.yaml` - Updated configuration
- ✅ `Makefile` - Added db-generate targets  
- ✅ `internal/db/queries/postgres/*.sql` - Organized query files
- ✅ `internal/db/queries/sqlite/*.sql` - SQLite query files (needs debugging)
- ✅ `internal/repo/interfaces.go` - Repository interfaces
- ✅ `internal/repo/postgres.go` - PostgreSQL implementation (partial)
- ✅ `internal/repo/repository_test.go` - Test structure
- 🚧 `internal/repo/sqlite.go` - SQLite implementation (not created)
- 🚧 Service layer updates (not started)