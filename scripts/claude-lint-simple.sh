#!/bin/bash

# Simple Claude Auto-Lint for when Docker is available
echo "🔧 Claude Auto-Lint: Fixing code formatting..."

# Use the correct frontend service name
FRONTEND_SERVICE="frontend-postgres"

# Check if service exists, fallback to frontend-sqlite
if ! docker-compose ps $FRONTEND_SERVICE &>/dev/null; then
    FRONTEND_SERVICE="frontend-sqlite"
fi

# Lint specific file if provided, otherwise lint all
TARGET=${1:-""}

if [ -n "$TARGET" ]; then
    echo "🎯 Linting: $TARGET"
    docker-compose exec -T $FRONTEND_SERVICE npm run lint:fix -- "$TARGET"
else
    echo "🌟 Linting all frontend code..."
    docker-compose exec -T $FRONTEND_SERVICE npm run lint:fix
fi

echo "✅ Auto-lint complete!"