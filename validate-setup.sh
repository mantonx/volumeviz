#!/bin/bash

# VolumeViz Setup Validation Script
# This script validates the Docker Compose and environment configuration
# without actually starting the services.

set -e

echo "🔍 VolumeViz Setup Validation"
echo "============================="

# Check if .env file exists
if [[ ! -f .env ]]; then
    echo "❌ .env file not found. Please run: cp .env.example .env"
    exit 1
fi
echo "✅ .env file found"

# Validate docker compose.yml
echo "🐳 Validating Docker Compose configuration..."
if docker compose config --quiet; then
    echo "✅ docker compose.yml is valid"
else
    echo "❌ docker compose.yml has configuration errors"
    exit 1
fi

# Check required environment variables
echo "🔧 Checking environment variables..."
source .env

required_vars=(
    "API_PORT"
    "FRONTEND_PORT" 
    "VITE_API_URL"
    "DOCKER_HOST"
    "DB_TYPE"
    "ALLOW_ORIGINS"
)

for var in "${required_vars[@]}"; do
    if [[ -z "${!var}" ]]; then
        echo "❌ Required environment variable $var is not set"
        exit 1
    else
        echo "✅ $var=${!var}"
    fi
done

# Test Makefile commands (dry run)
echo "🛠️  Testing Makefile commands..."
if make help >/dev/null 2>&1; then
    echo "✅ Makefile commands available"
else
    echo "❌ Makefile has issues"
    exit 1
fi

# Check Docker daemon connectivity
echo "🐋 Testing Docker daemon connectivity..."
if docker info >/dev/null 2>&1; then
    echo "✅ Docker daemon is accessible"
else
    echo "❌ Docker daemon is not accessible"
    echo "   Make sure Docker is running and you have permission to access it"
    exit 1
fi

# Validate service configuration
echo "📋 Validating service configuration..."
services=$(docker compose config --services)
expected_services=("postgres" "api" "web")

for service in "${expected_services[@]}"; do
    if echo "$services" | grep -q "^$service$"; then
        echo "✅ Service '$service' configured"
    else
        echo "❌ Service '$service' missing from configuration"
        exit 1
    fi
done

# Check if ports are available
echo "🔌 Checking port availability..."
ports=($API_PORT $FRONTEND_PORT 5432)

for port in "${ports[@]}"; do
    if netstat -tuln 2>/dev/null | grep -q ":$port "; then
        echo "⚠️  Port $port is already in use - you may need to stop other services"
    else
        echo "✅ Port $port is available"
    fi
done

echo ""
echo "🎉 Setup validation completed successfully!"
echo ""
echo "Next steps:"
echo "  1. Start services: docker compose up -d (or make up)"
echo "  2. Check status:   docker compose ps (or make ps)"
echo "  3. View logs:      docker compose logs -f (or make logs)"
echo "  4. Access web UI:  http://localhost:$FRONTEND_PORT"
echo "  5. Access API:     http://localhost:$API_PORT/api/v1/health"
echo ""
echo "For help: make help"