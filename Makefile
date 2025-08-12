.PHONY: help build run test clean docker-build docker-run lint format migrate up down restart logs logs-api logs-web ps rebuild dev-token dev-token-admin security-check db-seed db-prune smoke-test sqlc

# Variables
BINARY_NAME=volumeviz
DOCKER_IMAGE=volumeviz:latest
GO_FILES=$(shell find . -name '*.go' -type f)
MAIN_PACKAGE=./cmd/server

# Version information
VERSION ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo "dev")
GIT_COMMIT ?= $(shell git rev-parse HEAD 2>/dev/null || echo "unknown")
GIT_BRANCH ?= $(shell git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
BUILD_DATE ?= $(shell date -u +"%Y-%m-%dT%H:%M:%SZ")

# Build flags
LDFLAGS=-ldflags "-X github.com/mantonx/volumeviz/internal/version.Version=$(VERSION) \
	-X github.com/mantonx/volumeviz/internal/version.GitCommit=$(GIT_COMMIT) \
	-X github.com/mantonx/volumeviz/internal/version.GitBranch=$(GIT_BRANCH) \
	-X github.com/mantonx/volumeviz/internal/version.BuildDate=$(BUILD_DATE)"

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
	@echo "  smoke-test    - Run API smoke tests against running server"
	@echo "  clean         - Clean build artifacts"
	@echo "  docker-build  - Build Docker image"
	@echo "  docker-run    - Run Docker container"
	@echo "  lint          - Run Go linter"
	@echo "  format        - Format Go code"
	@echo "  migrate       - Show migration info (migrations run automatically on startup)"
	@echo "  migrate-test  - Test migrations on both PostgreSQL and SQLite"
	@echo "  migrate-status - Show current migration files"
	@echo "  sqlc          - Generate Go code from SQL queries"
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
	@echo "  db-seed       - Seed the database with sample data"
	@echo "  db-prune      - Prune the database"

# Show version information
version:
	@echo "Version: $(VERSION)"
	@echo "Git commit: $(GIT_COMMIT)"
	@echo "Git branch: $(GIT_BRANCH)"
	@echo "Build date: $(BUILD_DATE)"

# Build the binary
build:
	@echo "Building $(BINARY_NAME) version $(VERSION)..."
	go build $(LDFLAGS) -o $(BINARY_NAME) $(MAIN_PACKAGE)
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

# Run API smoke tests against running server
smoke-test:
	@echo "Running smoke tests..."
	./scripts/smoke-test.sh

# Lint transaction usage patterns
lint-transactions:
	@echo "Linting transaction patterns..."
	go run cmd/lint-transactions/main.go ./internal/
	@echo "Transaction linting complete"

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
	@echo "Using golangci-lint via go run to avoid global install requirements"
	@GOFLAGS=-buildvcs=false go run github.com/golangci/golangci-lint/cmd/golangci-lint@latest run --timeout=5m --verbose

# Format code
format:
	@echo "Formatting code..."
	go fmt ./...
	@echo "Formatting complete"

# Run database migrations
migrate:
	@echo "Running database migrations..."
	@echo "Applying migrations for configured database type..."
	@echo "Note: The server applies migrations automatically on startup"
	@echo "To test migrations, use migrate-test-postgres or migrate-test-sqlite"

migrate-test-postgres:
	@echo "Testing PostgreSQL migrations in a container..."
	@docker run --rm -d --name volumeviz-migrate-pg \
		-e POSTGRES_USER=test \
		-e POSTGRES_PASSWORD=test \
		-e POSTGRES_DB=volumeviz_test \
		-p 15432:5432 \
		postgres:15-alpine
	@echo "Waiting for PostgreSQL to start..."
	@sleep 3
	@echo "Applying PostgreSQL schemas..."
	@docker exec volumeviz-migrate-pg sh -c "PGPASSWORD=test psql -U test -d volumeviz_test -f -" < internal/store/migrations/postgres/001_core_schema.sql
	@docker exec volumeviz-migrate-pg sh -c "PGPASSWORD=test psql -U test -d volumeviz_test -f -" < internal/store/migrations/postgres/002_file_analytics_schema.sql
	@echo "PostgreSQL migration test completed"
	@docker stop volumeviz-migrate-pg
	@echo "Container cleaned up"

migrate-test-sqlite:
	@echo "Testing SQLite migrations..."
	@rm -f /tmp/volumeviz_migrate_test.db
	@sqlite3 /tmp/volumeviz_migrate_test.db < internal/store/migrations/sqlite/001_core_schema.sql
	@sqlite3 /tmp/volumeviz_migrate_test.db < internal/store/migrations/sqlite/002_file_analytics_schema.sql
	@echo "SQLite migration test completed"
	@echo "Test database at: /tmp/volumeviz_migrate_test.db"

migrate-test: migrate-test-postgres migrate-test-sqlite
	@echo "All migration tests completed"

migrate-status:
	@echo "Checking migration status..."
	@echo "Migrations are now idempotent SQL files in internal/store/migrations/postgres and internal/store/migrations/sqlite"
	@echo "PostgreSQL schemas:"
	@ls -1 internal/store/migrations/postgres/*.sql 2>/dev/null || echo "  No PostgreSQL schemas found"
	@echo ""
	@echo "SQLite schemas:"
	@ls -1 internal/store/migrations/sqlite/*.sql 2>/dev/null || echo "  No SQLite schemas found"

# Generate Go code from SQL queries
sqlc:
	@echo "Generating Go code from SQL queries..."
	@if command -v sqlc > /dev/null 2>&1; then \
		sqlc generate; \
		echo "sqlc generation complete"; \
	else \
		echo "sqlc not installed. Installing..."; \
		go install github.com/sqlc-dev/sqlc/cmd/sqlc@latest; \
		PATH="$$PATH:$$(go env GOPATH)/bin" sqlc generate; \
		echo "sqlc generation complete"; \
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
	go install github.com/sqlc-dev/sqlc/cmd/sqlc@latest
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

# Seed database with sample data
# Usage: make db-seed DB_TYPE=postgres DB_HOST=localhost DB_PORT=5432 DB_USER=volumeviz DB_PASSWORD=volumeviz DB_NAME=volumeviz
#        make db-seed DB_TYPE=sqlite DB_PATH=./volumeviz.db
DB_TYPE ?= postgres
DB_HOST ?= localhost
DB_PORT ?= 5432
DB_USER ?= volumeviz
DB_PASSWORD ?= volumeviz
DB_NAME ?= volumeviz
DB_PATH ?= ./volumeviz.db

ifeq ($(DB_TYPE),postgres)
DB_PSQL = PGPASSWORD=$(DB_PASSWORD) psql "host=$(DB_HOST) port=$(DB_PORT) user=$(DB_USER) dbname=$(DB_NAME) sslmode=disable"
else
DB_PSQL = sqlite3 $(DB_PATH)
endif

db-seed:
	@echo "Seeding database ($(DB_TYPE))..."
ifeq ($(DB_TYPE),postgres)
	@$(DB_PSQL) -v ON_ERROR_STOP=1 -f scripts/seed.sql
else
	@$(DB_PSQL) < scripts/seed_sqlite.sql
endif
	@echo "Seed complete"

# Manually trigger prune (uses app retention settings by executing a short-lived run)
db-prune:
	@echo "Starting app transiently to run a prune cycle..."
	@LIFECYCLE_ENABLED=true LIFECYCLE_INTERVAL=5s LIFECYCLE_INITIAL_DELAY=0s SERVER_PORT=18080 go run ./cmd/server & PID=$$!; \
	sleep 7; \
	kill $$PID; \
	echo "Prune triggered"
