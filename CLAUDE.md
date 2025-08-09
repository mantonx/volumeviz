# VolumeViz Project

## Overview
VolumeViz is a Docker volume visualization and management tool with a Go backend and React frontend. The project provides APIs for scanning, analyzing, and managing Docker volumes with real-time updates and metrics collection.

## Recent Changes Summary

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
- `/internal/database/` - Database models and migrations
- `/internal/events/` - Docker event handling
- `/internal/scheduler/` - Task scheduling
- `/pkg/docker/` - Docker client implementation

### Documentation
- `/docs/openapi.yaml` - OpenAPI specification
- `/docs/swagger.json` - Bundled API documentation
- `/DOCKER_EVENTS.md` - Docker events documentation

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

## Development Notes
- The project has shifted focus from general container management to specialized volume management
- API responses follow a consistent structure defined in internal/api/models/
- Docker events are handled asynchronously for real-time updates
- Test coverage is enforced at ≥60% in CI