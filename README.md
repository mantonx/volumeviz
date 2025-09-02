# VolumeViz

[![Go Version](https://img.shields.io/badge/Go-1.24.3-00ADD8.svg)](https://go.dev/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED.svg)](docker-compose.yml)

**VolumeViz** is a modern Docker volume analytics platform with an intuitive web interface that provides comprehensive insights into storage usage, file organization, and media content across your containerized infrastructure.

## 🎯 Core Features

VolumeViz is built around 7 core features designed to provide a complete storage management experience:

### 🚀 **Onboarding**
- **Smart Setup**: Guided first-time configuration with intelligent defaults
- **Volume Discovery**: Automatic Docker volume detection and registration
- **Organization Setup**: Multi-tenant account configuration with role-based access
- **Quick Start**: Interactive tutorials and sample data for immediate value

### 📊 **Dashboard** 
- **Real-time Metrics**: Live storage analytics with WebSocket updates
- **Visual Insights**: Interactive charts showing usage patterns and trends
- **System Health**: Container status, scan progress, and performance indicators
- **Customizable Views**: User-configurable widgets and layout preferences

### 💾 **Volumes**
- **Volume Management**: CRUD operations with detailed metadata and relationships
- **Container Integration**: Track volume mounts and container dependencies
- **Capacity Planning**: Growth forecasting with trend analysis and alerts
- **Performance Metrics**: I/O patterns, access frequencies, and bottleneck identification

### 🗂️ **Explorer**
- **Visual Navigation**: Interactive treemap and sunburst visualizations for space usage
- **File Browser**: Virtualized file/folder views with search and filtering
- **Preview System**: Thumbnail generation and metadata extraction for media files
- **Cleanup Tools**: Duplicate detection and bulk operations for storage optimization

### 🔍 **Search**
- **Advanced Queries**: Multi-criteria search across files, metadata, and content
- **Real-time Results**: Instant search with intelligent ranking and relevance
- **Saved Searches**: Bookmark complex queries for recurring analysis
- **Export Capabilities**: CSV/JSON export of search results and analytics

### 📈 **Trends**
- **Growth Analysis**: Historical storage trends with predictive modeling
- **Usage Patterns**: File type distribution, access patterns, and seasonal variations
- **Performance Analytics**: Scan duration, error rates, and system efficiency metrics
- **Comparative Views**: Cross-volume analysis and benchmark comparisons

### ⚠️ **Alerts**
- **Smart Notifications**: Configurable alerts for capacity, performance, and anomalies
- **Multi-channel Delivery**: Email, Slack, webhook integrations with customizable templates
- **Escalation Policies**: Tiered alerting with automatic escalation and acknowledgment workflows
- **Alert Analytics**: Trending and analysis of alert patterns for proactive management

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

### Production Deployment

```bash
# Use the production compose file
docker-compose up -d

# Or deploy to Kubernetes
kubectl apply -f deployments/kubernetes/
```

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

# Preview Generation
PREVIEW_ENABLED=true
PREVIEW_ROOT_DIR=/data/previews
```

## 📊 API Documentation

The VolumeViz API provides comprehensive RESTful endpoints organized around our core features:

- **Organizations**: Multi-tenant account management and user access control
- **Volumes**: CRUD operations, analytics, and container relationships  
- **Explorer**: File system navigation, metadata, and visualization data
- **Analytics**: Statistical insights, trends, and performance metrics
- **Alerts**: Notification management and escalation policies
- **System Health**: Service status, metrics, and diagnostic information
- **WebSocket**: Real-time updates and event streaming

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

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details on:

- Code style and standards
- Testing requirements
- Pull request process
- Development setup

## 📄 License

VolumeViz is licensed under the MIT License. See [LICENSE](LICENSE) for details.

## 🔗 Links

- [Documentation](docs/README.md)
- [Changelog](CHANGELOG.md)
- [Security Policy](SECURITY.md)
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