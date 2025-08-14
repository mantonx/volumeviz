# Current Structure Analysis

## Conflicting Directories

### Models (`/internal/models` vs `/internal/core/models`)
- **`/internal/models/`**: Contains domain models (Volume, Stats, Enrichment)
- **`/internal/core/models/`**: Contains only Scan model
- **Recommendation**: Consolidate all domain models in one place

### Interfaces (`/internal/interfaces` vs `/internal/core/interfaces`)
- **`/internal/interfaces/`**: Docker and general service interfaces
- **`/internal/core/interfaces/`**: Scanner, Stats, and Enricher interfaces
- **Issue**: No clear distinction between what goes where

### Services (`/internal/services` vs `/internal/core/services`)
- **`/internal/services/`**: Mix of implementations (Docker, Stats, Filesystem)
- **`/internal/core/services/`**: Infrastructure services (Cache, Metrics, Scanner)
- **Issue**: Unclear separation - Scanner is "core" but Stats is not?

## Other Observations

1. **API Structure**: Well organized under `/internal/api/v1/`
2. **Database Layer**: Clean separation with `db/sqlc` and `repo/`
3. **Store Pattern**: Good transaction abstraction in `/internal/store/`
4. **Mixed Concerns**: 
   - Docker client is in `pkg/` but adapter is in `internal/services/`
   - Some interfaces define contracts, others define implementations

## Quick Wins (Minimal Changes)

If we want to clean up with minimal disruption:

1. **Consolidate Models**: Move all models to `/internal/models/`
   - Move `internal/core/models/scan.go` → `internal/models/scan.go`
   - Delete empty `internal/core/models/`

2. **Consolidate Interfaces**: Move all interfaces to `/internal/interfaces/`
   - Move `internal/core/interfaces/*` → `internal/interfaces/`
   - Delete empty `internal/core/interfaces/`

3. **Organize Services**: Create clear subdirectories
   ```
   internal/services/
   ├── scanner/        # From core/services/scanner
   ├── metrics/        # From core/services/metrics
   ├── cache/          # From core/services/cache
   ├── stats/          # Stats service files
   ├── docker/         # Docker service files
   ├── filesystem/     # Filesystem indexer
   ├── enrichers/      # Already exists
   ├── lifecycle/      # Already exists
   └── snapshots/      # Already exists
   ```

4. **Delete Empty Core**: Remove `/internal/core/` after moving everything

This approach:
- Requires fewer import changes
- Maintains current patterns
- Can be done incrementally
- Still improves organization

## Recommended Approach

I recommend the **Quick Wins** approach first, then consider the full reorganization later if needed. This will:
- Fix the immediate confusion
- Not disrupt ongoing work
- Allow gradual migration to cleaner architecture
- Maintain working code throughout