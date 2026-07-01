# VolumeViz

[![Go Version](https://img.shields.io/badge/Go-1.24.3-00ADD8.svg)](https://go.dev/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED.svg)](docker-compose.yml)

**VolumeViz** is a read-only Docker volume explorer for understanding disk usage across containerized services.

It scans mounted Docker volumes, builds a searchable file index, visualizes size distribution, and tracks growth over time — without modifying the data it inspects.

> **🔒 Safe by design**: VolumeViz mounts volumes read-only and does not provide file deletion, move, or modification actions. It only reads and reports.

## 🎯 Feature Status

VolumeViz is under active, pre-1.0 development. This table reflects what actually works today, not the long-term vision (see [ROADMAP.md](ROADMAP.md) for what's planned).

| Area | Status |
| --- | --- |
| Docker volume discovery | ✅ Working |
| Full volume scan | ✅ Working |
| Incremental scan (snapshot diff) | ✅ Working |
| Checkpoint & resume on crash | ✅ Working |
| Volume dashboard (size, count, scan status) | ✅ Working |
| File explorer / directory tree | ⚠️ Partial — placeholder components, being reworked |
| TreeMap / sunburst visualization | ⚠️ Partial |
| Search | ⚠️ Stubbed — UI exists, backend not wired up |
| Preview generation (images/video/audio) | ⚠️ Partial |
| Alerts (webhook/Slack) | ⚠️ Basic, early |
| Multi-tenant organizations | 🗺️ Roadmap |
| SSO/SAML, MFA | 🗺️ Roadmap |
| Kubernetes deployment manifests | 🗺️ Roadmap |
| Growth forecasting | 🗺️ Roadmap |

## 🚄 Scanning Large Volumes

VolumeViz is built to handle large, slow-changing volumes (1TB+) without re-scanning everything on every run:

### **Incremental Scanning**
- Tracks volume state over time using directory-level snapshots
- Only rescans directories that changed (mtime + content hash verification)
- On a large, mostly-stable volume, this can substantially reduce rescan time compared to a full rescan — actual savings depend on how much has changed
- Configurable snapshot retention (default: 90 days)

### **Checkpoint & Resume**
- Saves scan progress periodically (default: every 5 minutes, configurable)
- Automatically resumes interrupted scans from the last checkpoint after a crash or restart

### **Resilience Features**
- Retry with exponential backoff for transient failures
- Circuit breaker to prevent cascading failures after repeated errors
- Per-method and overall timeouts to prevent hung scans
- Automatic fallback between scan methods: diskus → du → native

## 📦 Installation

### Quick Start with Docker Compose

```bash
# Clone the repository
git clone https://github.com/mantonx/volumeviz.git
cd volumeviz

# Start the development environment
docker-compose -f docker-compose.dev.yml up -d

# Access the application
# Frontend: http://localhost:5173 (PostgreSQL) or http://localhost:5174 (SQLite)
# Backend API: http://localhost:8080 (PostgreSQL) or http://localhost:8081 (SQLite)
```

### Self-Hosted Deployment

```bash
# Use the base compose file
docker-compose up -d
```

Kubernetes manifests are on the [roadmap](ROADMAP.md) but not yet available.

> **Security note**: VolumeViz needs read access to Docker volumes, and read access to the Docker socket if you want automatic volume discovery. Run it only on machines you control — see [SECURITY.md](SECURITY.md). It does not modify scanned files.

## 🏗️ Architecture

VolumeViz follows a modern, scalable architecture designed for performance and maintainability:

### 🎨 **Frontend Stack**
- **React 19**: Modern component-based UI with concurrent features
- **TypeScript**: Full type safety with strict configuration
- **Jotai**: Atomic state management for reactive data flow
- **TanStack Query**: Server state management with intelligent caching
- **Tailwind CSS**: Utility-first styling with design system integration
- **Vite**: Lightning-fast development and optimized production builds
- **Storybook**: Component development and documentation platform

### ⚙️ **Backend Stack** 
- **Go 1.24**: High-performance API server with gin framework
- **PostgreSQL**: Primary database with advanced query capabilities
- **SQLC**: Type-safe SQL with code generation
- **WebSocket**: Real-time updates using Gorilla WebSocket
- **Docker SDK**: Native container integration and monitoring
- **Prometheus**: Metrics collection and monitoring

### 🔧 **Development Tools**
- **OpenAPI/Swagger**: API-first development with automated client generation
- **Orval**: TypeScript client generation from OpenAPI specs
- **Docker Compose**: Consistent development environment
- **Testing**: Comprehensive test suites with Vitest (frontend) and Go testing (backend)
- **CI/CD**: Automated quality gates and deployment pipelines

For detailed architectural decisions and implementation details, see [ARCHITECTURE.md](ARCHITECTURE.md).

## 🔧 Configuration

### Environment Variables

```bash
# Database Configuration
DB_TYPE=postgres           # postgres or sqlite
DB_HOST=localhost
DB_PORT=5432
DB_NAME=volumeviz
DB_USER=volumeviz
DB_PASSWORD=volumeviz

# Server Configuration
SERVER_PORT=8080
API_BASE_URL=/api/v1

# Scanning Configuration
SCAN_INTERVAL=6h
SCAN_WORKERS=4
SCAN_METHOD=diskus        # diskus, du, or native

# Incremental Scanning (only rescans changed directories)
SCAN_INCREMENTAL_ENABLED=true
SCAN_SNAPSHOT_RETENTION_DAYS=90
SCAN_INCREMENTAL_MAX_SNAPSHOT_AGE=168h
SCAN_INCREMENTAL_FORCE_FULL=false

# Scan Resilience for Large Volumes
SCAN_CHECKPOINT_ENABLED=true
SCAN_CHECKPOINT_INTERVAL=5m
SCAN_AUTO_RESUME_ENABLED=true

# Preview Generation
PREVIEW_ENABLED=true
PREVIEW_ROOT_DIR=/data/previews

# Data Retention & Cleanup
RETENTION_ENABLED=true
RETENTION_CLEANUP_INTERVAL=24h      # How often to run cleanup
RETENTION_RUN_ON_STARTUP=true       # Run cleanup on startup
RETENTION_SCAN_JOBS_DAYS=30         # Keep completed scans for 30 days
RETENTION_SCAN_METRICS_DAYS=90      # Keep scan metrics for 90 days
RETENTION_SCAN_PHASES_DAYS=7        # Keep phase data for 7 days
RETENTION_FILE_METADATA_DAYS=180    # Keep file metadata for 180 days
RETENTION_INACTIVE_FILES_DAYS=60    # Remove files not seen for 60 days
```

## 📊 API Documentation

The VolumeViz API exposes RESTful endpoints organized around volume scanning and inspection:

- **Volumes**: Registration, scanning, and analytics
- **Explorer**: File system navigation and metadata
- **Snapshots**: Volume snapshot history and incremental scan statistics
- **Scheduler**: Job scheduling for periodic tasks (retention, cleanup, etc.)
- **System Health**: Service status, metrics, and diagnostic information
- **WebSocket**: Real-time scan progress updates

See the [Feature Status](#-feature-status) table above for what's production-quality versus early/in-progress (organizations, alerts, and search are still maturing).

The API is fully documented with OpenAPI/Swagger specifications and includes:
- Interactive API explorer at `/swagger/index.html`
- Auto-generated TypeScript clients via Orval
- Comprehensive request/response examples
- Authentication and error handling details

See the [API Documentation](docs/api/README.md) for detailed endpoint information.

## 🛠️ Development

### Prerequisites

- Go 1.24.3+
- Node.js 20+
- Docker & Docker Compose
- PostgreSQL 15+ (optional)

### Building from Source

```bash
# Backend
go mod download
go build -o volumeviz cmd/server/main.go

# Frontend
cd frontend
npm install
npm run build

# Run tests
go test ./...
cd frontend && npm test
```

### Development Workflow

VolumeViz uses Docker for consistent development across all platforms:

```bash
# Start all services (backend, frontend, database)
docker-compose -f docker-compose.dev.yml up --build

# Start individual services
docker-compose -f docker-compose.dev.yml up frontend  # React dev server
docker-compose -f docker-compose.dev.yml up backend   # Go API server

# Generate API client from OpenAPI spec
cd frontend && npm run generate:api

# Run database migrations (handled automatically by backend)
# Manual migration: docker-compose exec backend migrate up

# Generate SQLC models (backend)
docker-compose exec backend sqlc generate

# Run tests
docker-compose exec backend go test ./...
docker-compose exec frontend npm test

# Run linters
docker-compose exec backend golangci-lint run
docker-compose exec frontend npm run lint
```

### Service Access
- **Frontend**: http://localhost:3000 (React development server)
- **Backend API**: http://localhost:8080 (Go server with hot reload)
- **API Documentation**: http://localhost:8080/swagger/index.html
- **Database**: localhost:5432 (PostgreSQL with pgAdmin at http://localhost:5050)

## 🗄️ Data Management

VolumeViz includes an intelligent data retention system to prevent database bloat and maintain optimal performance:

### Automatic Cleanup

The retention system runs on a configurable schedule (default: daily) and removes:
- **Old Scan Jobs** (30 days): Completed, failed, and cancelled scan records
- **Scan Metrics** (90 days): Performance metrics and statistics
- **Scan Phases** (7 days): Detailed phase-by-phase scan progress data
- **File Metadata** (180 days): Extended file metadata and enrichment data
- **Inactive Files** (60 days): Files not seen in recent scans

### Scheduler API

Manage scheduled jobs via REST API:
```bash
# List all scheduled jobs
GET /api/v1/scheduler/jobs

# Get job status
GET /api/v1/scheduler/jobs/retention-cleanup

# Trigger manual run
POST /api/v1/scheduler/jobs/retention-cleanup/run

# Enable/disable job
POST /api/v1/scheduler/jobs/retention-cleanup/enable
POST /api/v1/scheduler/jobs/retention-cleanup/disable
```

### Configuration

Customize retention periods in your environment configuration:
```bash
RETENTION_ENABLED=true                    # Enable/disable retention
RETENTION_CLEANUP_INTERVAL=24h            # Run daily
RETENTION_SCAN_JOBS_DAYS=30               # Adjust retention periods as needed
```

## 📈 Monitoring

VolumeViz includes comprehensive monitoring capabilities:

- **Prometheus Metrics**: Export metrics at `/metrics`
- **Grafana Dashboards**: Pre-configured visualizations
- **Health Checks**: Liveness and readiness probes
- **Performance Profiling**: pprof endpoints for debugging

Access monitoring tools:
- Grafana: http://localhost:3000
- Prometheus: http://localhost:9090
- pgAdmin: http://localhost:5050

## 🤝 Contributing

We welcome contributions from developers of all skill levels! Whether you're fixing bugs, adding features, or improving documentation, we'd love your help.

**Quick Start:**
1. Check out [good first issues](https://github.com/mantonx/volumeviz/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22)
2. Read the [Contributing Guide](CONTRIBUTING.md)
3. Join [GitHub Discussions](https://github.com/mantonx/volumeviz/discussions) to ask questions

See our [ROADMAP.md](ROADMAP.md) for planned features and areas where we need help.

## 📄 License

VolumeViz is licensed under the MIT License. See [LICENSE](LICENSE) for details.

## 🔗 Links

- [Documentation](docs/README.md)
- [Roadmap](ROADMAP.md)
- [Architecture](ARCHITECTURE.md)
- [Contributing Guide](CONTRIBUTING.md)
- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Security Policy](SECURITY.md)
- [GitHub Discussions](https://github.com/mantonx/volumeviz/discussions)
- [Issue Tracker](https://github.com/mantonx/volumeviz/issues)

## 🙏 Acknowledgments

VolumeViz uses several excellent open-source projects:

- [golang-migrate](https://github.com/golang-migrate/migrate) for database migrations
- [Docker SDK](https://github.com/docker/docker) for container integration
- [SQLC](https://sqlc.dev) for type-safe SQL
- [Gin](https://gin-gonic.com) for HTTP routing
- [React](https://react.dev) for the user interface

---

**Note**: This project is under active development. For production use, please review the [security considerations](SECURITY.md) and [deployment guide](docs/deployment/README.md).