# Changelog

All notable changes to VolumeViz will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Community infrastructure (ROADMAP.md, CODE_OF_CONDUCT.md)
- GitHub Discussions enabled for community Q&A
- Good first issues created for new contributors (#38-#42)
- Repository topics for better discoverability
- Streaming enrichment progress with real-time updates
- Enhanced scan progress visualization

### Changed
- README updated with OSS contribution pathways
- Improved documentation structure for contributors

## [0.5.0] - 2025-10-05

### 🎉 Open Source Release

This release marks VolumeViz's transition to an open source project with significant improvements to scanning performance, real-time progress tracking, and comprehensive analytics capabilities.

### ✨ Added

#### Scanning & Performance
- **Incremental Scanning**: 99% faster rescans for large volumes (1TB+)
  - Snapshot-based change detection with mtime comparison
  - Configurable retention (default: 90 days)
  - Automatic fallback to full scan when needed
- **Checkpoint & Resume**: Automatic resume of interrupted scans
  - Progress checkpoint every 5 minutes
  - Crash recovery with zero data loss
  - Resume from last successful checkpoint
- **Streaming Enrichment Progress**: Real-time transparency during enrichment
  - Live file count and processing speed metrics
  - Accurate ETA calculations
  - Phase-by-phase progress tracking

#### Analytics & Insights
- Complete stats/analytics backend with real data
- Volume growth forecasting and trend analysis
- File type distribution visualization
- Storage capacity planning tools
- Performance metrics and health monitoring

#### User Interface
- **OnboardingPage**: Guided setup wizard with progress tracking
- **TrendsPage**: Comprehensive analytics with interactive charts
- **SearchPage**: Advanced search with duplicate detection UI
- **VolumesPage**: Full CRUD interface with bulk operations
- Real-time scan progress visualization with WebSocket updates
- Enrichment phase transparency with streaming updates

#### Data Management
- Automated data retention system with scheduler
- Configurable retention periods for different data types:
  - Scan jobs: 30 days
  - Scan metrics: 90 days
  - File metadata: 180 days
  - Inactive files: 60 days
- Scheduler API for managing cleanup jobs
- Organization-scoped data isolation

#### Developer Experience
- Comprehensive Storybook component library
- Auto-generated TypeScript API client from OpenAPI (Orval)
- Jotai atomic state management
- TanStack Query v5 for server state
- Modern React 19 with concurrent features

### 🐛 Fixed
- Volume size display issues and data reconciliation
- Modal flash in delete confirmation dialogs
- React import order initialization errors
- Missing API barrel exports for search and metadata
- Incorrect file count display for unscanned volumes
- Scan reconciliation clearing volume data unexpectedly

### 📚 Documentation
- Added comprehensive project roadmap (ROADMAP.md)
- Added code of conduct (CODE_OF_CONDUCT.md)
- Enhanced contributing guidelines
- Architecture decision records (ADR)
- API documentation improvements
- WebSocket event documentation

### 🔒 Security
- Multi-tenant row-level security
- JWT authentication improvements
- Audit logging framework
- Secure WebSocket connections with validation

### ⚡ Performance
- 99% faster rescans with incremental scanning
- Streaming enrichment reduces perceived wait time
- Bulk database operations for file metadata
- Optimized queries with proper indexing
- Connection pooling and caching

## [1.0.0] - 2025-08-14

### 🎉 Initial Release

#### Added

**Core Features**
- Docker volume discovery and scanning engine
- File system analysis with metadata extraction
- Real-time volume size monitoring and trending
- Duplicate file detection and analysis
- Media type classification system
- Interactive file explorer with advanced filtering

**API Implementation**
- RESTful API v1.2 with 78 endpoints implemented
- SQLC-based type-safe database operations
- PostgreSQL and SQLite database support
- OpenAPI 3.0 specification and documentation
- WebSocket support for real-time updates

**Frontend Application**
- Modern React 18 with TypeScript
- Responsive design with dark/light theme support
- Interactive charts and data visualizations
- Real-time dashboard updates via WebSocket
- Advanced file browser and search capabilities
- Alert management system

**Performance & Scalability**
- Optimized database queries with comprehensive indexing
- Bulk file ingestion with 30K+ rows/second performance
- Lazy loading and pagination for large datasets
- Compression middleware for API responses
- Connection pooling and database optimization

**Developer Experience**
- Comprehensive development environment setup
- Docker Compose for local development
- Automated testing suite with >80% coverage
- Code generation for API clients
- Development scripts and automation tools

**Security & Reliability**
- JWT-based authentication system
- Role-based access control (RBAC)
- Input validation and sanitization
- Error handling and recovery mechanisms
- Audit logging and monitoring

**Documentation**
- Complete API documentation
- Development and deployment guides
- Architecture decision records (ADRs)
- Performance benchmarking documentation

#### Technical Specifications

**Backend Stack**
- Go 1.21+ with high-performance HTTP server
- SQLC for type-safe SQL query generation
- PostgreSQL 15+ with optimized schema design
- WebSocket integration for real-time features
- Structured logging with configurable levels

**Frontend Stack**
- React 18 with TypeScript 5+
- Vite for fast development and building
- Modern UI components with accessibility support
- State management with Jotai
- Chart.js for data visualization

**Database Schema**
- 15+ optimized tables with comprehensive relationships
- 50+ database indexes for query performance
- Migration system for schema versioning
- Support for both PostgreSQL and SQLite

**API Coverage**
- 78 REST endpoints across 4 major API groups
- Explorer API: 25 endpoints for file system operations
- Analytics API: 18 endpoints for volume statistics
- Metadata API: 20 endpoints for file metadata
- Alerts API: 15 endpoints for monitoring and notifications

**Performance Benchmarks**
- PostgreSQL: 30,000+ rows/second bulk ingestion
- SQLite: 10,000+ rows/second bulk ingestion
- API response times: <100ms for most operations
- Memory usage: <512MB for typical workloads
- Concurrent users: 100+ simultaneous connections

#### Infrastructure

**Container Support**
- Multi-architecture Docker images (amd64, arm64)
- Docker Compose for development and production
- Kubernetes manifests for cloud deployment
- Health checks and monitoring endpoints

**Development Tools**
- Comprehensive Makefile with 15+ commands
- Automated testing with coverage reporting
- Code linting and formatting enforcement
- Performance testing and benchmarking tools
- Database seeding and migration tools

#### Quality Assurance

**Testing Coverage**
- Unit tests for core business logic
- Integration tests for API endpoints
- End-to-end tests for critical user flows
- Performance tests for scalability validation
- Security tests for vulnerability assessment

**Code Quality**
- Comprehensive linting and formatting rules
- Type safety with TypeScript and Go generics
- Error handling and recovery patterns
- Performance optimization and profiling
- Security best practices implementation

### Changed
- N/A (Initial release)

### Deprecated
- N/A (Initial release)

### Removed
- N/A (Initial release)

### Fixed
- N/A (Initial release)

### Security
- Implemented JWT-based authentication system
- Added role-based access control (RBAC)
- Enabled secure database connections with SSL/TLS
- Implemented input validation and sanitization
- Added audit logging for security monitoring

---

## Release Notes Format

Starting with v1.0.0, releases will follow this format:

### 🎉 Major Release (X.0.0)
- Significant new features or breaking changes
- Architecture improvements
- Major API updates

### ✨ Minor Release (X.Y.0)
- New features and enhancements
- API additions (backwards compatible)
- Performance improvements

### 🐛 Patch Release (X.Y.Z)
- Bug fixes and patches
- Security updates
- Minor improvements

---

**For full details on any release, see the corresponding GitHub release page.**
