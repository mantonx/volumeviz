# VolumeViz

**Enterprise-Grade Docker Volume Analytics & Visualization Platform**

VolumeViz is a comprehensive solution for monitoring, analyzing, and visualizing Docker volume usage across your container infrastructure. Built with performance and scalability in mind, it provides real-time insights into volume utilization, file system analytics, and storage optimization opportunities.

## 🚀 Key Features

### 📊 **Volume Analytics**
- Real-time volume size monitoring and trending
- File system deep analysis with metadata extraction
- Duplicate file detection and deduplication recommendations
- Media type classification and statistics
- Directory tree visualization with size rollups

### 🔍 **Advanced Explorer**
- Interactive file browser with advanced filtering
- Search by name, size, type, or modification date
- Bulk operations and file management
- Real-time file system events tracking
- Comprehensive metadata display

### 📈 **Performance Monitoring**
- Volume I/O metrics and performance tracking
- Historical usage trends and forecasting
- Container volume mapping and usage correlation
- Alert system for storage thresholds
- Database performance optimization

### 🌐 **Modern Web Interface**
- Responsive React-based dashboard
- Real-time WebSocket updates
- Interactive charts and visualizations
- Dark/light theme support
- Mobile-friendly design

## 🏗️ Architecture

VolumeViz follows a modern, scalable architecture:

- **Backend**: High-performance Go API with SQLC for type-safe database operations
- **Database**: PostgreSQL with optimized indexing for large datasets
- **Frontend**: React with TypeScript, modern UI components, and real-time updates
- **Real-time**: WebSocket integration for live data streaming
- **API**: RESTful API v1.2 with comprehensive OpenAPI documentation

## 🚀 Quick Start

### Using Docker Compose (Recommended)

```bash
# Clone the repository
git clone https://github.com/mantonx/volumeviz.git
cd volumeviz

# Start with PostgreSQL (recommended for production)
docker compose -f docker-compose.dev.yml up -d postgres
make run-backend

# Or start with SQLite (quick development)
make run-sqlite

# Access the application
open http://localhost:3000
```

### Development Setup

```bash
# Install dependencies
make install-deps

# Run database migrations
make migrate-up

# Start development servers
make dev-start

# Run tests
make test
```

## 📋 Requirements

- **Runtime**: Docker & Docker Compose
- **Development**: Go 1.21+, Node.js 18+, PostgreSQL 15+ (optional)
- **Storage**: Minimum 1GB free space for database
- **Memory**: 512MB RAM minimum, 2GB recommended

## 🔧 Configuration

VolumeViz supports flexible configuration through environment variables:

```bash
# Database Configuration
DB_TYPE=postgres              # postgres or sqlite
DB_HOST=localhost
DB_PORT=5432
DB_USER=volumeviz
DB_PASSWORD=volumeviz
DB_NAME=volumeviz

# API Configuration  
API_PORT=8080
API_HOST=0.0.0.0
LOG_LEVEL=info

# Frontend Configuration
FRONTEND_PORT=3000
API_BASE_URL=http://localhost:8080
```

## 📊 API Documentation

VolumeViz provides a comprehensive REST API:

- **Explorer API**: File system browsing and search
- **Analytics API**: Volume statistics and metrics
- **Metadata API**: File metadata and classification
- **Alerts API**: Threshold monitoring and notifications

API documentation is available at `/docs` when the server is running.

## 🛠️ Development

### Project Structure

```
volumeviz/
├── cmd/                    # Application entrypoints
├── internal/               # Internal Go packages
│   ├── api/               # API handlers and middleware
│   ├── core/              # Business logic
│   ├── database/          # Database connections
│   └── services/          # Service implementations
├── frontend/              # React application
├── migrations/            # Database schema migrations
├── docs/                  # Documentation
└── scripts/               # Development and deployment scripts
```

### Available Commands

```bash
make build              # Build the application
make test               # Run tests
make lint               # Run linters
make dev-start          # Start development environment
make docker-build       # Build Docker images
make migrate-up         # Run database migrations
make migrate-down       # Rollback migrations
```

## 🚢 Deployment

### Docker Production Deployment

```bash
# Build production images
make docker-build

# Deploy with PostgreSQL
docker compose up -d

# Scale the application
docker compose up -d --scale backend=3
```

### Kubernetes Deployment

```bash
# Apply Kubernetes manifests
kubectl apply -f deployments/kubernetes/
```

## 🔒 Security

VolumeViz implements enterprise-grade security measures:

- **Authentication**: JWT-based authentication system
- **Authorization**: Role-based access control (RBAC)
- **Data Protection**: Encrypted connections and secure data handling
- **Audit Logging**: Comprehensive audit trail for all operations
- **Vulnerability Management**: Regular security updates and dependency scanning

See [SECURITY.md](SECURITY.md) for detailed security information.

## 🤝 Contributing

We welcome contributions from the community! Please see our [Contributing Guide](CONTRIBUTING.md) for details on:

- Development setup and workflow
- Code style and standards
- Testing requirements
- Pull request process

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: Comprehensive docs at `/docs`
- **Issues**: GitHub Issues for bug reports and feature requests
- **Discussions**: GitHub Discussions for questions and community support

---

**Built with ❤️ for the Docker community**
