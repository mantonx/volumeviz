.PHONY: help build run test clean docker-build docker-run lint format migrate up down restart logs logs-api logs-web ps rebuild dev-token dev-token-admin security-check

# Variables
BINARY_NAME=volumeviz
DOCKER_IMAGE=volumeviz:latest
GO_FILES=$(shell find . -name '*.go' -type f)
MAIN_PACKAGE=./cmd/server

# Default target
help:
	@echo "Available targets:"
	@echo "  build         - Build the Go binary"
	@echo "  run           - Run the application"
	@echo "  run-backend   - Run the backend server"
	@echo "  test          - Run unit tests"
	@echo "  test-integration - Run integration tests"
	@echo "  test-e2e      - Run end-to-end tests"
	@echo "  test-all      - Run all tests"
	@echo "  clean         - Clean build artifacts"
	@echo "  docker-build  - Build Docker image"
	@echo "  docker-run    - Run Docker container"
	@echo "  lint          - Run Go linter"
	@echo "  format        - Format Go code"
	@echo "  migrate       - Run database migrations"
	@echo "  deps          - Download Go dependencies"
	@echo "  dev           - Run in development mode with hot reload"
	@echo "  up            - Start services with docker compose up -d"
	@echo "  down          - Stop services with docker compose down"
	@echo "  restart       - Restart services (down + up)"
	@echo "  logs          - Show logs from all services"
	@echo "  logs-api      - Show logs from API service"
	@echo "  logs-web      - Show logs from web service"
	@echo "  ps            - Show running containers"
	@echo "  rebuild       - Rebuild and restart services"
	@echo "  dev-token     - Generate JWT token for development (operator role)"
	@echo "  dev-token-admin - Generate JWT token for development (admin role)"
	@echo "  security-check - Run basic security checks"

# Build the binary
build:
	@echo "Building..."
	go build -o $(BINARY_NAME) $(MAIN_PACKAGE)
	@echo "Build complete: $(BINARY_NAME)"

# Run the application
run: build
	./$(BINARY_NAME)

# Run backend server
run-backend:
	go run $(MAIN_PACKAGE)

# Run tests
test:
	@echo "Running unit tests..."
	go test -v -cover ./...

# Run integration tests
test-integration:
	@echo "Running integration tests..."
	go test -v -tags=integration ./test/integration/...

# Run E2E tests
test-e2e:
	@echo "Running E2E tests..."
	cd frontend && npm test:e2e
	go test -v -tags=e2e ./test/e2e/...

# Run all tests
test-all: test test-integration test-e2e

# Clean build artifacts
clean:
	@echo "Cleaning..."
	go clean
	rm -f $(BINARY_NAME)
	rm -rf dist/
	@echo "Clean complete"

# Build Docker image
docker-build:
	@echo "Building Docker image..."
	docker build -t $(DOCKER_IMAGE) .
	@echo "Docker build complete: $(DOCKER_IMAGE)"

# Run Docker container
docker-run:
	@echo "Running Docker container..."
	docker run -p 8080:8080 $(DOCKER_IMAGE)

# Run linter
lint:
	@echo "Running linter..."
	@if command -v golangci-lint > /dev/null 2>&1; then \
		golangci-lint run; \
	else \
		echo "golangci-lint not installed. Installing..."; \
		go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest; \
		golangci-lint run; \
	fi

# Format code
format:
	@echo "Formatting code..."
	go fmt ./...
	@echo "Formatting complete"

# Run database migrations
migrate:
	@echo "Running database migrations..."
	@if [ -f ./scripts/migrate.sh ]; then \
		./scripts/migrate.sh up; \
	else \
		echo "Migration script not found"; \
	fi

# Download dependencies
deps:
	@echo "Downloading dependencies..."
	go mod download
	go mod tidy
	@echo "Dependencies downloaded"

# Development mode with hot reload
dev:
	@echo "Starting development server with hot reload..."
	@if command -v air > /dev/null 2>&1; then \
		air; \
	else \
		echo "air not installed. Installing..."; \
		go install github.com/air-verse/air@latest; \
		air; \
	fi

# Install all development tools
install-tools:
	@echo "Installing development tools..."
	go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest
	go install github.com/air-verse/air@latest
	@echo "Tools installed"

# Docker Compose convenience commands
up:
	@echo "Starting VolumeViz services..."
	docker compose up -d

down:
	@echo "Stopping VolumeViz services..."
	docker compose down

restart: down up
	@echo "VolumeViz services restarted"

logs:
	@echo "Showing logs from all services..."
	docker compose logs -f

logs-api:
	@echo "Showing API service logs..."
	docker compose logs -f api

logs-web:
	@echo "Showing web service logs..."
	docker compose logs -f web

ps:
	@echo "VolumeViz service status:"
	docker compose ps

rebuild:
	@echo "Rebuilding and restarting VolumeViz services..."
	docker compose down
	docker compose build --no-cache
	docker compose up -d

# Security and development tools
dev-token:
	@echo "Generating JWT token for development..."
	@if [ -z "$$AUTH_HS256_SECRET" ]; then \
		echo "ERROR: AUTH_HS256_SECRET environment variable not set"; \
		echo "Set it with: export AUTH_HS256_SECRET=your-secret-key-at-least-32-characters"; \
		exit 1; \
	fi
	go run cmd/jwt-gen/main.go -user dev-user -role operator -duration 24h

dev-token-admin:
	@echo "Generating admin JWT token for development..."
	@if [ -z "$$AUTH_HS256_SECRET" ]; then \
		echo "ERROR: AUTH_HS256_SECRET environment variable not set"; \
		echo "Set it with: export AUTH_HS256_SECRET=your-secret-key-at-least-32-characters"; \
		exit 1; \
	fi
	go run cmd/jwt-gen/main.go -user admin-user -role admin -duration 24h

security-check:
	@echo "Running security checks..."
	@echo "Checking for secrets in code..."
	@if grep -r "password\|secret\|key" --include="*.go" --include="*.js" --include="*.ts" .; then \
		echo "⚠️  Found potential secrets in code"; \
	else \
		echo "✅ No obvious secrets found"; \
	fi