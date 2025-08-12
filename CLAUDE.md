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
- `/internal/store/` - **Refactored store package with split architecture:**
  - `postgres/` - PostgreSQL-specific store implementations
  - `sqlite/` - SQLite-specific store implementations  
  - `interfaces/` - Store interfaces and contracts
  - `models/` - Data models and transfer objects
  - `config/` - Database configuration management
  - `migration/` - golang-migrate integration
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

## Database Migration Commands
```bash
# Run migrations (SQLite)
DB_TYPE=sqlite DB_PATH=/path/to/database.db go run ./cmd/migrate up

# Run migrations (PostgreSQL) 
DB_TYPE=postgres DB_HOST=localhost DB_PORT=5432 DB_USER=user DB_PASSWORD=pass DB_NAME=volumeviz go run ./cmd/migrate up

# Check migration status
go run ./cmd/migrate version

# Create new migration
go run ./cmd/migrate create migration_name
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
- **Store Architecture**: Fully refactored with domain-driven design - use interface-based dependency injection
- **Database Migrations**: Use `cmd/migrate` for all migration operations (professional golang-migrate integration)  
- **Performance Optimized**: Bulk operations are highly optimized for large datasets
- **Testing**: All store tests pass - use them as examples for proper store usage
- **Multi-DB Support**: Code works identically with PostgreSQL and SQLite
- API responses follow a consistent structure defined in internal/api/models/
- Docker events are handled asynchronously for real-time updates
- Test coverage is enforced at ≥60% in CI