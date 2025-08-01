# VolumeViz

VolumeViz is a real-time Docker container visualization and monitoring tool that provides interactive 3D network topology views, resource usage monitoring, and container management capabilities.

## Features

- **Real-time Container Monitoring**: Track CPU, memory, network, and disk usage
- **Interactive 3D Network Visualization**: Visualize container networks and connections
- **Container Management**: Start, stop, restart, and remove containers
- **Multi-host Support**: Monitor containers across multiple Docker hosts
- **Historical Metrics**: View and analyze historical performance data
- **Alerts and Notifications**: Set up custom alerts for resource thresholds
- **Dark/Light Theme**: Modern UI with theme support

## Architecture

VolumeViz consists of:
- **Backend**: Go-based API server using Gin framework
- **Frontend**: React application with Vite, TailwindCSS, and Recharts
- **Database**: PostgreSQL for storing metrics and configuration
- **Docker Integration**: Direct integration with Docker API

## Prerequisites

- Docker 20.10+ and Docker Compose 2.0+
- Go 1.21+ (for development)
- Node.js 18+ and npm 9+ (for development)
- PostgreSQL 15+ (or use Docker)

## Quick Start

### Using Docker Compose

```bash
# Clone the repository
git clone https://github.com/mantonx/volumeviz.git
cd volumeviz

# Start the application
docker-compose up -d

# Access the application at http://localhost:3000
```

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

## Configuration

Create a `.env` file in the root directory:

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USER=volumeviz
DB_PASSWORD=your-secure-password
DB_NAME=volumeviz

# Server
SERVER_PORT=8080
SERVER_HOST=0.0.0.0

# Docker
DOCKER_HOST=unix:///var/run/docker.sock

# Frontend
VITE_API_URL=http://localhost:8080
```

## Development

### Project Structure

```
volumeviz/
├── cmd/server/          # Application entrypoint
├── internal/            # Private application code
│   ├── api/            # HTTP handlers and middleware
│   ├── services/       # Business logic
│   ├── models/         # Data models
│   ├── database/       # Database interactions
│   └── config/         # Configuration
├── pkg/                # Public packages
│   ├── docker/         # Docker client wrapper
│   └── metrics/        # Metrics collection
├── frontend/           # React frontend
│   ├── src/
│   │   ├── components/ # React components
│   │   ├── pages/      # Page components
│   │   ├── services/   # API services
│   │   └── utils/      # Utilities
│   └── public/         # Static assets
├── scripts/            # Utility scripts
├── deployments/        # Deployment configurations
├── docs/               # Documentation
└── test/               # Test files
```

### Running Tests

```bash
# Backend tests
make test

# Frontend tests
cd frontend && npm test

# Integration tests
make test-integration

# E2E tests
make test-e2e
```

### Building

```bash
# Build backend
make build

# Build frontend
cd frontend && npm run build

# Build Docker image
make docker-build
```

## API Documentation

The API documentation is available at `http://localhost:8080/swagger` when running in development mode.

### Key Endpoints

- `GET /api/v1/containers` - List all containers
- `GET /api/v1/containers/:id` - Get container details
- `GET /api/v1/containers/:id/stats` - Get container statistics
- `POST /api/v1/containers/:id/start` - Start a container
- `POST /api/v1/containers/:id/stop` - Stop a container
- `GET /api/v1/networks` - List Docker networks
- `GET /api/v1/metrics` - Get historical metrics

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## Security

For security concerns, please email security@volumeviz.example.com

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Docker team for the excellent Docker API
- The Go community for amazing tools and libraries
- React and Vite teams for the frontend tooling