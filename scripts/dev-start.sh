#!/bin/bash
# VolumeViz Development Environment Startup Script

set -e

echo "🚀 Starting VolumeViz Development Environment"
echo "============================================"

# Function to start specific services
start_services() {
    local profile=$1
    echo "📦 Starting services with profile: $profile"
    
    case $profile in
        "postgres")
            docker compose -f docker-compose.dev.yml up -d postgres pgadmin backend-postgres frontend-postgres prometheus grafana
            ;;
        "sqlite")
            docker compose -f docker-compose.dev.yml up -d backend-sqlite frontend-sqlite sqlite-web prometheus grafana
            ;;
        "both")
            docker compose -f docker-compose.dev.yml up -d
            ;;
        "minimal")
            docker compose -f docker-compose.dev.yml up -d postgres backend-postgres frontend-postgres
            ;;
        *)
            echo "❌ Unknown profile: $profile"
            echo "Available profiles: postgres, sqlite, both, minimal"
            exit 1
            ;;
    esac
}

# Parse command line arguments
PROFILE="both"
WAIT_FOR_READY="true"

while [[ $# -gt 0 ]]; do
    case $1 in
        --profile|-p)
            PROFILE="$2"
            shift 2
            ;;
        --no-wait)
            WAIT_FOR_READY="false"
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --profile, -p   Profile to start (postgres|sqlite|both|minimal) [default: both]"
            echo "  --no-wait       Don't wait for services to be ready"
            echo "  --help, -h      Show this help message"
            echo ""
            echo "Profiles:"
            echo "  postgres        PostgreSQL backend with pgAdmin and monitoring"
            echo "  sqlite          SQLite backend with SQLite Web and monitoring"
            echo "  both            Both PostgreSQL and SQLite backends"
            echo "  minimal         Just PostgreSQL backend and frontend (fastest startup)"
            exit 0
            ;;
        *)
            echo "❌ Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Check if Docker is running (after parsing help)
if ! docker info >/dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

# Start services
start_services "$PROFILE"

if [[ "$WAIT_FOR_READY" == "true" ]]; then
    echo "⏳ Waiting for services to be ready..."
    sleep 10
    
    # Check if services are healthy
    if [[ "$PROFILE" == "postgres" || "$PROFILE" == "both" || "$PROFILE" == "minimal" ]]; then
        echo "🔍 Checking PostgreSQL backend..."
        until curl -f http://localhost:8080/health >/dev/null 2>&1; do
            echo "   Waiting for PostgreSQL backend..."
            sleep 5
        done
        echo "   ✅ PostgreSQL backend is ready"
    fi
    
    if [[ "$PROFILE" == "sqlite" || "$PROFILE" == "both" ]]; then
        echo "🔍 Checking SQLite backend..."
        until curl -f http://localhost:8081/health >/dev/null 2>&1; do
            echo "   Waiting for SQLite backend..."
            sleep 5
        done
        echo "   ✅ SQLite backend is ready"
    fi
fi

echo ""
echo "🎉 VolumeViz Development Environment is ready!"
echo ""
echo "📋 Available Services:"
echo "====================="

if [[ "$PROFILE" == "postgres" || "$PROFILE" == "both" || "$PROFILE" == "minimal" ]]; then
    echo "🐘 PostgreSQL Services:"
    echo "   📊 VolumeViz (PostgreSQL): http://localhost:8080"
    echo "   🌐 Frontend (PostgreSQL):  http://localhost:5173"
    if [[ "$PROFILE" != "minimal" ]]; then
        echo "   🛠️  pgAdmin:                http://localhost:5050 (dev@volumeviz.com / volumeviz)"
    fi
fi

if [[ "$PROFILE" == "sqlite" || "$PROFILE" == "both" ]]; then
    echo ""
    echo "🗃️  SQLite Services:"
    echo "   📊 VolumeViz (SQLite):     http://localhost:8081"
    echo "   🌐 Frontend (SQLite):      http://localhost:5174"
    echo "   🛠️  SQLite Web Browser:    http://localhost:8082"
fi

if [[ "$PROFILE" != "minimal" ]]; then
    echo ""
    echo "📈 Monitoring Services:"
    echo "   🔥 Prometheus:             http://localhost:9090"
    echo "   📊 Grafana:                http://localhost:3000 (admin / volumeviz)"
fi

echo ""
echo "🔧 Management Commands:"
echo "   View logs:     docker compose -f docker compose.dev.yml logs -f [service]"
echo "   Stop all:      docker compose -f docker compose.dev.yml down"
echo "   Restart:       docker compose -f docker compose.dev.yml restart [service]"
echo ""
echo "💡 Tips:"
echo "   • Use different browser profiles/windows to test both databases simultaneously"
echo "   • Check the database performance comparison in Grafana"
echo "   • View real-time database operations in pgAdmin (PostgreSQL) and SQLite Web"
echo ""
echo "Happy developing! 🚀"