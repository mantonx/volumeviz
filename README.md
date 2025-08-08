# VolumeViz

[![Backend CI](https://github.com/mantonx/volumeviz/actions/workflows/ci-backend.yml/badge.svg)](https://github.com/mantonx/volumeviz/actions/workflows/ci-backend.yml)
[![Frontend CI](https://github.com/mantonx/volumeviz/actions/workflows/ci-frontend.yml/badge.svg)](https://github.com/mantonx/volumeviz/actions/workflows/ci-frontend.yml)
[![Test](https://github.com/mantonx/volumeviz/actions/workflows/test.yml/badge.svg)](https://github.com/mantonx/volumeviz/actions/workflows/test.yml)
[![Lint](https://github.com/mantonx/volumeviz/actions/workflows/golangci-lint.yml/badge.svg)](https://github.com/mantonx/volumeviz/actions/workflows/golangci-lint.yml)
[![Security](https://github.com/mantonx/volumeviz/actions/workflows/security.yml/badge.svg)](https://github.com/mantonx/volumeviz/actions/workflows/security.yml)
[![CodeQL](https://github.com/mantonx/volumeviz/actions/workflows/codeql.yml/badge.svg)](https://github.com/mantonx/volumeviz/actions/workflows/codeql.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Go Version](https://img.shields.io/badge/Go-1.22+-blue.svg)](https://golang.org/)
[![Node Version](https://img.shields.io/badge/Node-20+-green.svg)](https://nodejs.org/)

VolumeViz is a Docker volume monitoring and management tool that provides real-time insights into your mounted volumes. Focus on the volumes that matter - your user-mounted data like media libraries, databases, and application storage.

## What is VolumeViz?

VolumeViz helps you monitor Docker volumes from a **volume-first perspective**. Instead of managing containers and networks, VolumeViz focuses exclusively on:

- **Volume Inventory**: Discover and catalog all your Docker volumes
- **Usage Tracking**: Monitor storage consumption with detailed size analytics  
- **Mount Analysis**: Track which containers are using each volume
- **Lifecycle Operations**: Scan, monitor, and manage volume data
- **Orphaned Volume Detection**: Identify unused volumes consuming storage

**VolumeViz does not manage containers, networks, or provide 3D visualization** - it's purpose-built for volume-centric monitoring.

## Key Features

### Volume Discovery & Inventory
- Automatic discovery of user-mounted volumes (excludes Docker infrastructure volumes)
- Real-time volume listing with driver, creation date, and mount point information
- Smart filtering to show only volumes that contain your actual data

### Storage Usage Monitoring  
- Multi-method volume size calculation (du, find, stat)
- Asynchronous scanning for large volumes with progress tracking
- Historical storage trends and growth analytics
- Automated size caching with TTL-based refresh

### Container Attachment Tracking
- View which containers are currently using each volume
- Mount point and access mode information (read-only, read-write)
- Container lifecycle impact on volume usage

### Performance & Reliability
- High-performance scanning supporting 1000+ volumes
- Circuit breaker patterns for resilience
- Prometheus metrics integration
- Memory-efficient operations (< 100MB during large scans)

## Quick Start

### Prerequisites

- Docker 20.10+ and Docker Compose 2.0+
- Access to Docker socket (`/var/run/docker.sock`)
- User-mounted volumes to monitor (e.g., media libraries, databases)

### Using Docker Compose (Recommended)

1. **Clone and configure**:
```bash
git clone https://github.com/mantonx/volumeviz.git
cd volumeviz

# Copy environment configuration
cp .env.example .env

# (Optional) Customize settings in .env for your environment
# Edit DOCKER_HOST, ALLOW_ORIGINS, or database settings as needed
```

2. **Start the application**:
```bash
# Using docker compose directly
docker compose up -d

# Or using the convenient Makefile
make up
```

3. **Verify services are healthy**:
```bash
# Check service status
docker compose ps
# or
make ps

# View logs if needed
docker compose logs -f
# or  
make logs
```

4. **Access VolumeViz**:
- **Web UI**: http://localhost:3000
- **API**: http://localhost:8080/api/v1  
- **API Health**: http://localhost:8080/api/v1/health
- **API Documentation**: http://localhost:8080/api/docs
- **Metrics** (if enabled): http://localhost:9090/metrics

**First-time setup**: The application will automatically run database migrations on startup. Services include health checks and will restart automatically if they become unhealthy.

### Development Setup

```bash
# Backend setup
go mod download
make run-backend

# Frontend setup (in another terminal)
cd frontend
npm install
npm run dev
```

The frontend will be available at http://localhost:5173 (Vite dev server).

### Docker Compose Management

VolumeViz includes convenient Makefile commands for managing the Docker Compose stack:

```bash
make up          # Start all services  
make down        # Stop all services
make restart     # Restart all services
make ps          # Show service status
make logs        # Follow logs from all services
make logs-api    # Follow API service logs only
make logs-web    # Follow web service logs only  
make rebuild     # Rebuild images and restart
```

### Troubleshooting

**Services not starting or failing health checks:**

```bash
# Check service status and logs
make ps
make logs

# Common issues:
# 1. Port conflicts - Change ports in .env file
# 2. Docker socket permission denied - Ensure Docker is running and accessible
# 3. Database connection issues - Check postgres service logs
```

**Remote Docker host setup:**

```bash
# In .env file, change DOCKER_HOST for remote Docker daemon
DOCKER_HOST=tcp://remote-host:2375

# Note: Only use TCP connections in secure development environments
# Production should use TLS-secured connections or socket proxy
```

## Environment Configuration

### Backend Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `DB_HOST` | PostgreSQL host | localhost | Yes |
| `DB_PORT` | PostgreSQL port | 5432 | Yes |
| `DB_USER` | Database username | volumeviz | Yes |
| `DB_PASSWORD` | Database password | - | Yes |
| `DB_NAME` | Database name | volumeviz | Yes |
| `SERVER_PORT` | API server port | 8080 | No |
| `SERVER_HOST` | API server bind address | 0.0.0.0 | No |
| `DOCKER_HOST` | Docker daemon socket | unix:///var/run/docker.sock | No |
| `GIN_MODE` | Gin framework mode | debug | No |
| `LOG_LEVEL` | Log level (debug, info, warn, error) | info | No |
| `LOG_FORMAT` | Log format (json, text) | json | No |
| `ENABLE_METRICS` | Enable Prometheus metrics | true | No |
| `METRICS_PORT` | Metrics server port | 9090 | No |

### Frontend Configuration  

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `VITE_API_URL` | Backend API URL | http://localhost:8080/api/v1 | Yes |
| `VITE_WS_URL` | WebSocket URL (future use) | ws://localhost:8080/api/v1/ws | No |
| `VITE_ENABLE_WEBSOCKET` | Enable WebSocket features | false | No |
| `VITE_ENABLE_POLLING` | Enable auto-refresh polling | true | No |
| `VITE_POLLING_INTERVAL` | Polling interval in ms | 30000 | No |
| `VITE_MAX_CONCURRENT_SCANS` | Max concurrent volume scans | 3 | No |
| `VITE_ENABLE_DEBUG` | Enable debug logging | false | No |

## Architecture

### Components
- **Backend**: Go-based API server using Gin framework
- **Frontend**: React application with TypeScript, Vite, and TailwindCSS
- **Database**: PostgreSQL for volume metadata and scan history
- **Docker Integration**: Direct Docker API integration for volume discovery

### Volume Scanning Methods
1. **du command**: Fast recursive directory size calculation
2. **find + stat**: Alternative method for restricted filesystems
3. **Direct filesystem access**: Fallback for bind-mounted volumes

### Volume Filtering
VolumeViz automatically filters volumes to show only user-mounted data:
- **Included**: Volumes with device paths (bind mounts, CIFS, NFS, etc.)
- **Excluded**: Docker infrastructure volumes (container filesystems, tmp volumes, etc.)

## API Endpoints

### Volume Management
- `GET /api/v1/volumes` - List volumes with optional filtering
- `GET /api/v1/volumes/{id}` - Get volume details
- `GET /api/v1/volumes/{id}/containers` - List containers using volume
- `GET /api/v1/volumes/{id}/size` - Get volume size (cached)
- `POST /api/v1/volumes/{id}/size/refresh` - Trigger size rescan

### Health & Monitoring  
- `GET /api/v1/health/app` - Application health status
- `GET /api/v1/health/docker` - Docker daemon connectivity
- `GET /api/v1/health/database` - Database connection status

### Bulk Operations
- `POST /api/v1/volumes/bulk-scan` - Scan multiple volumes

## Security

VolumeViz implements secure-by-default practices while acknowledging the inherent security considerations of Docker volume monitoring.

### Security Features

- **Strict CORS Policy**: Configurable origins, default deny-all for unknown origins
- **Rate Limiting**: Per-IP request limiting with configurable thresholds  
- **Security Headers**: Comprehensive HTTP security headers (X-Content-Type-Options, X-Frame-Options, CSP, etc.)
- **Request ID Correlation**: All requests tracked with unique IDs for audit trails
- **JWT Authentication**: Optional HS256 JWT-based authentication with role-based access
- **TLS Support**: Optional HTTPS with certificate-based encryption
- **Log Security**: Automatic scrubbing of sensitive data from logs

### Docker Socket Security

⚠️  **Critical Security Consideration**: VolumeViz requires Docker socket access

```yaml
# Docker socket access (required)
volumes:
  - /var/run/docker.sock:/var/run/docker.sock:ro
```

**Security Implications**:
- **Root-equivalent access**: Docker socket provides root privileges on host
- **Container escape risk**: Compromised VolumeViz could create privileged containers  
- **Full filesystem access**: Can access all mounted volumes and host directories

**Recommended Mitigations**:
1. **Use Docker Socket Proxy** (production):
   ```yaml
   # Use tecnativa/docker-socket-proxy to limit API access
   docker-socket-proxy:
     image: tecnativa/docker-socket-proxy
     environment:
       VOLUMES: 1
       CONTAINERS: 1
       # Disable dangerous endpoints
       POST: 0
       BUILD: 0
       COMMIT: 0
   ```

2. **Network Isolation**: Deploy on isolated Docker network
3. **Authentication**: Enable JWT authentication for production
4. **Access Controls**: Use reverse proxy with authentication
5. **Monitoring**: Enable audit logging and monitoring

### Authentication & Authorization

VolumeViz supports optional JWT-based authentication:

```bash
# Enable authentication
AUTH_ENABLED=true
AUTH_HS256_SECRET=your-super-secret-jwt-key-at-least-32-characters

# Generate development token
export AUTH_HS256_SECRET=your-super-secret-jwt-key-at-least-32-characters
make dev-token        # Generates operator token
make dev-token-admin  # Generates admin token
```

**User Roles**:
- `viewer`: Read-only access to volumes and scans
- `operator`: Can perform volume operations (scan, refresh)
- `admin`: Full administrative access

**Protected Operations**: POST/PUT/PATCH/DELETE requests require `operator` role or higher when authentication is enabled.

### HTTPS/TLS Configuration

Enable HTTPS for production deployments:

```bash
# Set certificate and key file paths
TLS_CERT_FILE=/path/to/certificate.pem
TLS_KEY_FILE=/path/to/private-key.pem
```

**Certificate Options**:
- **Let's Encrypt**: Automated certificate management
- **Self-signed**: For internal/development use
- **Corporate CA**: Organization-issued certificates
- **Reverse Proxy**: Terminate TLS at reverse proxy (recommended)

### Rate Limiting & DoS Protection

Built-in rate limiting protects against abuse:

```bash
# Rate limiting configuration
RATE_LIMIT_ENABLED=true
RATE_LIMIT_RPM=60          # Requests per minute per IP
RATE_LIMIT_BURST=30        # Burst capacity
```

Rate limiting can be disabled for development: `RATE_LIMIT_ENABLED=false`

### CORS Configuration  

Strict CORS policy prevents cross-origin abuse:

```bash
# Only allow specific origins (secure)
ALLOW_ORIGINS=https://volumeviz.company.com,https://dashboard.company.com

# Development mode (less secure)
ALLOW_ORIGINS=http://localhost:3000,http://localhost:5173
```

**Default**: `http://localhost:3000` (development only)
**Production**: Configure specific allowed origins, never use `*`

### Security Headers

VolumeViz automatically sets security headers:

```
X-Content-Type-Options: nosniff
X-Frame-Options: SAMEORIGIN  
Referrer-Policy: no-referrer
Content-Security-Policy: default-src 'none'; frame-ancestors 'self';
```

Headers can be customized via environment variables (see `.env.example`).

### Production Security Checklist

- [ ] Enable authentication: `AUTH_ENABLED=true`
- [ ] Set strong JWT secret: `AUTH_HS256_SECRET` (32+ characters)
- [ ] Configure specific CORS origins: `ALLOW_ORIGINS`
- [ ] Enable HTTPS: `TLS_CERT_FILE` and `TLS_KEY_FILE`
- [ ] Use Docker socket proxy
- [ ] Deploy behind authentication gateway  
- [ ] Enable rate limiting: `RATE_LIMIT_ENABLED=true`
- [ ] Configure monitoring and alerting
- [ ] Regular security updates via Dependabot
- [ ] Network isolation (internal Docker network)
- [ ] Resource limits in Docker Compose

See [SECURITY.md](SECURITY.md) for detailed security guidelines and vulnerability reporting.

## Development

### Project Structure

```
volumeviz/
├── cmd/server/           # Application entrypoint
├── internal/             # Private Go packages
│   ├── api/v1/          # HTTP API handlers
│   ├── core/            # Business logic and services
│   ├── database/        # Database layer
│   └── config/          # Configuration management
├── frontend/            # React frontend application  
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── pages/       # Page components
│   │   ├── api/         # API client services
│   │   ├── store/       # State management (Jotai)
│   │   └── utils/       # Utility functions
│   └── public/          # Static assets
├── docs/                # API documentation (OpenAPI)
├── deployments/         # Docker and deployment configs
└── scripts/             # Development and deployment scripts
```

### Building

```bash
# Build backend binary
make build

# Build frontend  
cd frontend && npm run build

# Build Docker images
docker compose build
```

### Testing

```bash
# Backend tests
make test

# Frontend tests  
cd frontend && npm test

# Integration tests
make test-integration
```

## Planned Features

The following features are planned for future releases:

- **Multi-host Support**: Monitor volumes across multiple Docker hosts
- **Advanced Analytics**: Historical trends, growth prediction, capacity planning  
- **Alerting System**: Custom alerts for storage thresholds and volume events
- **Backup Integration**: Track backup status and retention policies
- **Volume Lifecycle Automation**: Automated cleanup of orphaned volumes
- **Performance Benchmarking**: I/O performance testing for volumes
- **Compliance Reporting**: Storage usage reports for capacity planning

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- **Documentation**: API docs available at `/api/docs` when running
- **Issues**: Report bugs and feature requests on [GitHub Issues](https://github.com/mantonx/volumeviz/issues)
- **Discussions**: Join the discussion on [GitHub Discussions](https://github.com/mantonx/volumeviz/discussions)