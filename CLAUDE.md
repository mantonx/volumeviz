# VolumeViz Project

## Overview
VolumeViz is a Docker volume visualization and management tool with a Go backend and React frontend. The project provides APIs for scanning, analyzing, and managing Docker volumes with real-time updates and metrics collection.

## Recent Changes Summary

### Store Package Refactoring (COMPLETED)
- **Split Architecture**: Migrated from monolithic stores to domain-specific stores (FileStore, DirectoryStore, etc.)
- **Database Support**: Full PostgreSQL and SQLite support with optimized implementations  
- **Migration System**: Integrated golang-migrate for professional database migration management
- **Performance**: Significant improvements - 52K+ file entries/sec, 34K+ directory nodes/sec
- **Testing**: All store integration tests now pass (6/6) with comprehensive coverage
- **Clean Architecture**: Interface-based design with dependency injection and clean separation of concerns

### API Enhancements  
- Added GET /scans/{id}/status endpoint for checking scan status
- Improved volume API with better indexes and response models
- Enhanced error handling with structured API utilities
- Added OpenAPI documentation with swagger.json generation

### Frontend Updates
- Removed container-related pages (focusing on volumes)
- Enhanced volume page functionality
- Improved error handling utilities
- Added comprehensive API tests
- Updated generated TypeScript API client

### Backend Improvements
- Added Docker event handling system
- Implemented scheduler for background tasks
- Enhanced metrics collection (Prometheus and simple collectors)
- Added mock services for testing
- Improved database migrations with API-specific indexes
- Enhanced health check endpoints

### Infrastructure
- Added CI coverage enforcement (≥60%)
- Created client drift checking script
- Improved test coverage with handler benchmarks

## Project Structure

### Frontend (React + TypeScript)
- `/frontend/src/api/` - API client and services
- `/frontend/src/pages/` - Page components (now volume-focused)
- `/frontend/src/store/` - State management with atoms
- `/frontend/src/components/` - Reusable UI components
- `/frontend/src/utils/` - Utility functions including error handling

### Backend (Go)
- `/internal/api/` - API handlers, routers, and models
- `/internal/core/` - Core business logic and interfaces
- `/internal/db/` - **Clean database layer:**
  - `connect.go` - Database connections (PostgreSQL)
  - `sqlc/` - Generated code from SQL queries (no business logic)
- `/internal/repo/` - **Repository layer:**
  - `queries/` - Domain-organized SQL queries (volumes.sql, scans.sql, etc.)
  - `*_repo.go` - Repository implementations returning domain models
- `/internal/store/` - **Transaction orchestration layer:**
  - `store.go` - Store interfaces for transaction management
  - `store_pg.go` - PostgreSQL store implementation
- `/internal/models/` - **Domain models independent of database**
- `/internal/events/` - Docker event handling
- `/internal/scheduler/` - Task scheduling
- `/pkg/docker/` - Docker client implementation

### Documentation
- `/docs/openapi.yaml` - OpenAPI specification
- `/docs/swagger.json` - Bundled API documentation
- `/DOCKER_EVENTS.md` - Docker events documentation
- `/migrations/` - **New golang-migrate migration files (replaces old system)**

## Key Features
1. Volume scanning and analysis
2. Real-time Docker event monitoring
3. Metrics collection and monitoring
4. RESTful API with OpenAPI documentation
5. Comprehensive test coverage
6. CI/CD with coverage gates

## Testing Commands
```bash
# Backend tests
go test ./...

# Frontend tests
cd frontend && npm test

# Check client drift
./scripts/check-client-drift.sh
```

## Build Commands
```bash
# Backend
go build -o volumeviz cmd/server/main.go

# Frontend
cd frontend && npm run build
```

## Database Setup
The new architecture uses PostgreSQL with sqlc-generated code. Database schema is defined in SQL files:
```bash
# SQL schema files are in migrations/ directory
# Application automatically applies schema on startup
# No manual migration commands needed with the new architecture
```

## API Client Generation
```bash
# Generate TypeScript client from local OpenAPI spec
cd frontend && npm run api:gen

# Bundle YAML spec to JSON
cd frontend && npm run api:bundle

# Alternative: generate from running server
cd frontend && npm run api:generate:local

# Alternative: generate from GitHub
cd frontend && npm run api:generate:remote
```

## Development Notes
- **Three-Layer Architecture**: Clean separation between db/ (connections + sqlc), repo/ (SQL + domain models), store/ (transactions)
- **sqlc Integration**: All SQL queries in `internal/repo/queries/*.sql` with type-safe generated code
- **Import Boundaries**: CI enforces layer separation - services only import store + models
- **PostgreSQL Focus**: Optimized for PostgreSQL with pgx/v5 driver and connection pooling
- **Context-First**: All methods accept context.Context for proper cancellation and tracing
- **Performance Optimized**: Bulk operations are highly optimized for large datasets
- **Testing**: Comprehensive test coverage with architecture compliance verification
- API responses follow a consistent structure defined in internal/api/models/
- Docker events are handled asynchronously for real-time updates
- Test coverage is enforced at ≥60% in CI