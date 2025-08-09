# Changelog

All notable changes to VolumeViz will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [v0.1.0] - 2025-08-09

### 🚀 Features

- **Volume Discovery & Inventory**: Automatic discovery of user-mounted volumes with smart filtering to exclude Docker infrastructure volumes
- **Storage Usage Monitoring**: Multi-method volume size calculation (du, find, stat) with asynchronous scanning and progress tracking
- **Container Attachment Tracking**: Real-time tracking of which containers are using each volume with mount point and access mode information
- **High-Performance Architecture**: Circuit breaker patterns, Prometheus metrics integration, and memory-efficient operations supporting 1000+ volumes
- **REST API**: Comprehensive API with pagination, sorting, filtering, and bulk operations for volume management
- **Web Interface**: React-based frontend with real-time updates and responsive design
- **Multi-Architecture Support**: Docker images built for amd64 and arm64 platforms
- **Version Reporting**: Integrated version information in health endpoint and application logs
- **Security Features**: JWT authentication, rate limiting, CORS protection, and comprehensive security headers
- **Database Support**: Both SQLite (lightweight) and PostgreSQL (production) database backends
- **Docker Integration**: Direct Docker API integration with support for remote Docker hosts

### 🔧 Infrastructure

- **GitHub Actions CI/CD**: Multi-arch Docker builds with SBOM generation and automated releases
- **Development Tools**: Comprehensive Makefile with development, testing, and deployment commands
- **Documentation**: Complete API documentation with OpenAPI/Swagger specifications
- **Testing**: Unit tests, integration tests, and end-to-end test suites
- **Security**: Automated security scanning with Dependabot and CodeQL analysis

### 📖 Documentation

- **Installation Guide**: Docker Compose and single container deployment instructions
- **API Reference**: Complete REST API documentation with examples
- **Security Guide**: Comprehensive security configuration and best practices
- **Development Setup**: Local development environment setup and contribution guidelines

### 🐳 Docker

- **Multi-stage Builds**: Optimized Docker images with separate frontend and backend build stages
- **Version Injection**: Build-time version information injection via ldflags
- **Health Checks**: Container health checks for reliable deployments
- **Environment Configuration**: Comprehensive environment variable support for Docker deployments

### Initial Release Notes

This is the first stable release of VolumeViz, providing a complete solution for Docker volume monitoring and management. The application focuses exclusively on volume-centric operations, offering real-time insights into mounted volumes, storage usage analytics, and container attachment tracking.

**Key Highlights:**
- Production-ready with comprehensive security features
- Scalable architecture supporting large-scale deployments
- Multi-platform support (amd64/arm64)
- Easy deployment with Docker Compose or single container setups
- Comprehensive API for integration with existing tools

[v0.1.0]: https://github.com/mantonx/volumeviz/releases/tag/v0.1.0