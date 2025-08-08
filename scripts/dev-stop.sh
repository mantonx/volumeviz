#!/bin/bash
# VolumeViz Development Environment Shutdown Script

set -e

echo "🛑 Stopping VolumeViz Development Environment"
echo "============================================="

# Parse command line arguments
REMOVE_VOLUMES="false"
REMOVE_IMAGES="false"

while [[ $# -gt 0 ]]; do
    case $1 in
        --volumes|-v)
            REMOVE_VOLUMES="true"
            shift
            ;;
        --images|-i)
            REMOVE_IMAGES="true"
            shift
            ;;
        --clean|-c)
            REMOVE_VOLUMES="true"
            REMOVE_IMAGES="true"
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --volumes, -v   Remove data volumes (PostgreSQL, SQLite, etc.)"
            echo "  --images, -i    Remove downloaded Docker images"
            echo "  --clean, -c     Remove both volumes and images (full cleanup)"
            echo "  --help, -h      Show this help message"
            echo ""
            echo "Warning: --volumes will delete all database data!"
            exit 0
            ;;
        *)
            echo "❌ Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Stop and remove containers
echo "📦 Stopping Docker containers..."
docker compose -f docker compose.dev.yml down

if [[ "$REMOVE_VOLUMES" == "true" ]]; then
    echo "⚠️  Removing data volumes (this will delete all data)..."
    docker compose -f docker compose.dev.yml down -v
    
    # Remove named volumes explicitly
    docker volume rm -f volumeviz_postgres_data_dev 2>/dev/null || true
    docker volume rm -f volumeviz_pgadmin_data_dev 2>/dev/null || true
    docker volume rm -f volumeviz_sqlite_data_dev 2>/dev/null || true
    docker volume rm -f volumeviz_prometheus_data_dev 2>/dev/null || true
    docker volume rm -f volumeviz_grafana_data_dev 2>/dev/null || true
    docker volume rm -f volumeviz_go_modules 2>/dev/null || true
fi

if [[ "$REMOVE_IMAGES" == "true" ]]; then
    echo "🗑️  Removing Docker images..."
    
    # Get list of images used by the compose file
    IMAGES=$(docker compose -f docker compose.dev.yml config | grep 'image:' | awk '{print $2}' | sort | uniq)
    
    for image in $IMAGES; do
        echo "   Removing image: $image"
        docker rmi "$image" 2>/dev/null || true
    done
    
    # Clean up any dangling images
    docker image prune -f >/dev/null 2>&1 || true
fi

# Clean up any orphaned containers
echo "🧹 Cleaning up orphaned containers..."
docker container prune -f >/dev/null 2>&1 || true

# Clean up networks
echo "🔗 Cleaning up networks..."
docker network prune -f >/dev/null 2>&1 || true

echo ""
echo "✅ VolumeViz Development Environment stopped successfully!"

if [[ "$REMOVE_VOLUMES" == "true" ]]; then
    echo ""
    echo "⚠️  Database volumes have been removed. All data has been deleted."
    echo "   Next startup will create fresh databases."
fi

if [[ "$REMOVE_IMAGES" == "true" ]]; then
    echo ""
    echo "🗑️  Docker images have been removed."
    echo "   Next startup will re-download images (may take longer)."
fi

echo ""
echo "💡 To start the environment again, run: ./scripts/dev-start.sh"