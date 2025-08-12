# VolumeViz Documentation

Welcome to the VolumeViz documentation! This directory contains all technical documentation for the VolumeViz Docker volume visualization and management tool.

## Documentation Structure

### 📁 [Architecture](./architecture/)
System design and architectural decisions
- [Docker Events Architecture](./architecture/DOCKER_EVENTS.md) - Event handling system design

### 📁 [Development](./development/)
Developer guides and setup instructions
- [Development Environment](./DEVELOPMENT_ENVIRONMENT.md) - Setting up your dev environment
- [Dev Environment Summary](./DEV_ENVIRONMENT_SUMMARY.md) - Quick setup reference
- [Branch Protection](./BRANCH_PROTECTION.md) - Git branch policies
- [Dependabot Auto-merge](./development/DEPENDABOT_AUTOMERGE.md) - Automated dependency management

### 📁 [Implementation](./implementation/)
Technical implementation details and decisions
- [Store Package Refactor](./implementation/STORE_REFACTOR.md) - Domain-driven store architecture
- [Docker Events Implementation](./implementation/DOCKER_EVENTS_IMPLEMENTATION.md) - Event system implementation
- [SQLC Implementation](./implementation/SQLC_IMPLEMENTATION.md) - SQL code generation setup
- [SQLC Phase 1 Summary](./implementation/SQLC_PHASE1_READS_SUMMARY.md) - Initial SQLC migration
- [Snapshots Implementation](./implementation/SNAPSHOTS_IMPLEMENTATION_SUMMARY.md) - Usage snapshots system
- [Rollup Compute](./implementation/ROLLUP_COMPUTE_IMPLEMENTATION.md) - Directory rollup computation
- [Scan Scheduler](./implementation/SCAN_SCHEDULER.md) - Volume scanning scheduler
- [Bulk Ingest Performance](./implementation/BULK_INGEST_PERFORMANCE.md) - Optimized bulk operations

### 📁 [API](./api/)
API documentation and specifications
- OpenAPI specification available at `/docs/openapi.yaml`

### 📁 [Database](./database/)
Database design and operations
- [Database Overview](./DATABASE.md) - Schema and design decisions
- [Database Performance](./DATABASE_PERFORMANCE.md) - Performance optimization guide
- [SQLite Setup](./SQLITE_SETUP.md) - SQLite configuration
- [Transactions Policy](./TRANSACTIONS_POLICY.md) - Transaction handling guidelines
- [Bulk Ingestion](./BULK_INGESTION.md) - Bulk data import strategies

### 📁 [Deployment](./deployment/)
Deployment and operational guides
- [Docker API Setup](./DOCKER_API_SETUP.md) - Configuring Docker API access
- [Performance Monitoring](./PERFORMANCE_MONITORING.md) - Monitoring and metrics

### 📁 [Features](./features/)
Feature-specific documentation
- [Volume Scanning](./VOLUME_SCANNING.md) - Volume scanning functionality
- [Backend WebSocket Requirements](./BACKEND_WEBSOCKET_REQUIREMENTS.md) - Real-time updates

### 📁 [ADR](./adr/)
Architecture Decision Records
- [ADR-0001: Persistence with sqlc and pgx](./adr/0001-persistence-sqlc-pgx.md)

## Quick Links

- [Main README](../README.md) - Project overview
- [Contributing Guide](../CONTRIBUTING.md) - How to contribute
- [Changelog](../CHANGELOG.md) - Release history
- [Security Policy](../SECURITY.md) - Security guidelines
- [Claude.md](../CLAUDE.md) - AI assistant context

## Recent Updates

- **Store Package Refactoring** - Complete domain-driven design refactor with split stores
- **Container/Volume Mount Support** - Added full CRUD operations for containers and mounts
- **golang-migrate Integration** - Professional migration management system
- **JSON Serialization** - Proper handling of Labels/Options fields
- **Interface Standardization** - All constructors return interface types

## Getting Started

1. Start with the [Development Environment](./DEVELOPMENT_ENVIRONMENT.md) guide
2. Review the [Architecture](./architecture/) documentation
3. Check implementation details in [Implementation](./implementation/)
4. Follow the [Contributing Guide](../CONTRIBUTING.md) for making changes