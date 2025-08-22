# VolumeViz

[![Go Version](https://img.shields.io/badge/Go-1.24.3-00ADD8.svg)](https://go.dev/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED.svg)](docker-compose.yml)

**VolumeViz** is a comprehensive Docker volume analytics and filesystem monitoring platform that provides real-time insights into storage usage, file organization, and media content across your containerized infrastructure.

## 🚀 Core Features

### Docker Volume Analytics
- **Real-time Monitoring**: Track volume sizes, growth rates, and usage patterns
- **Container Integration**: Monitor volume mounts and container relationships
- **Performance Metrics**: Analyze I/O patterns and access frequencies
- **Capacity Planning**: Forecast storage needs with trend analysis

### Filesystem Indexing
- **Deep Scanning**: Recursive indexing of volume contents with configurable depth
- **File Categorization**: Automatic classification by type, size, and age
- **Duplicate Detection**: Identify redundant files across volumes
- **Change Tracking**: Monitor file modifications and deletions

### Scan Orchestration
- **Intelligent Scheduling**: Adaptive scanning based on volume activity
- **Parallel Processing**: Multi-worker architecture for efficient scanning
- **Priority Queuing**: Smart prioritization of active volumes
- **Resource Management**: Configurable CPU and memory limits

### Metadata Enrichers
- **Media Analysis**: Extract metadata from images, videos, and audio files
- **EXIF Processing**: Parse camera settings and location data from photos
- **Video Transcoding**: Generate previews and extract frame information
- **Subtitle Extraction**: Process embedded and external subtitle tracks

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

VolumeViz follows a clean architecture pattern with clear separation of concerns:

- **Frontend**: React/TypeScript with real-time WebSocket updates
- **Backend**: Go API server with gin framework
- **Storage**: PostgreSQL or SQLite with SQLC for type-safe queries
- **Monitoring**: Prometheus metrics and Grafana dashboards
- **Processing**: Background workers for scanning and enrichment

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

The VolumeViz API provides comprehensive endpoints for all functionality:

- **Volumes**: CRUD operations and analytics
- **Files**: Browse, search, and analyze file systems
- **Scans**: Trigger and monitor scan operations
- **Metadata**: Access enriched file information
- **Alerts**: Configure monitoring and notifications
- **WebSocket**: Real-time updates and events

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

```bash
# Start development environment with hot reload
docker-compose -f docker-compose.dev.yml up

# Run database migrations
./vendor/bin/migrate -path migrations -database "$DATABASE_URL" up

# Generate SQLC models
sqlc generate

# Run linters
./scripts/lint.sh
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