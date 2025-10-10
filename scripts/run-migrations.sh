#!/bin/bash
# Migration runner script for container initialization
# This script runs before the API service starts to ensure database schema is up to date

set -euo pipefail

echo "==================================="
echo "VolumeViz Migration Runner"
echo "==================================="

# Configuration from environment variables
DB_TYPE="${DB_TYPE:-postgres}"
DB_HOST="${DB_HOST:-postgres}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-volumeviz}"
DB_PASSWORD="${DB_PASSWORD:-volumeviz}"
DB_NAME="${DB_NAME:-volumeviz}"
DB_SSLMODE="${DB_SSLMODE:-disable}"
MIGRATE_PATH="${MIGRATE_PATH:-/app/migrations/postgresql}"

# Construct database URL
if [ "$DB_TYPE" = "postgres" ] || [ "$DB_TYPE" = "postgresql" ]; then
    DB_URL="postgres://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME?sslmode=$DB_SSLMODE"
else
    echo "Error: Only PostgreSQL is currently supported in container migrations"
    exit 1
fi

echo "Database: $DB_HOST:$DB_PORT/$DB_NAME"
echo "Migration path: $MIGRATE_PATH"
echo ""

# Wait for database to be ready
echo "Waiting for database to be ready..."
max_attempts=30
attempt=0
while [ $attempt -lt $max_attempts ]; do
    if pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" > /dev/null 2>&1; then
        echo "✅ Database is ready"
        break
    fi
    attempt=$((attempt + 1))
    echo "⏳ Waiting for database... (attempt $attempt/$max_attempts)"
    sleep 2
done

if [ $attempt -eq $max_attempts ]; then
    echo "❌ Database did not become ready in time"
    exit 1
fi

# Check if migrate binary exists
if ! command -v migrate > /dev/null 2>&1; then
    echo "❌ golang-migrate not found in container"
    echo "Make sure migrate binary is installed in the Docker image"
    exit 1
fi

# Check current migration version
echo ""
echo "Checking current migration version..."
VERSION_OUTPUT=$(migrate -path "$MIGRATE_PATH" -database "$DB_URL" version 2>&1 || true)
if echo "$VERSION_OUTPUT" | grep -q "no migration"; then
    echo "📝 No migrations applied yet (fresh database)"
elif echo "$VERSION_OUTPUT" | grep -q "dirty"; then
    echo "⚠️  WARNING: Database is in dirty state"
    echo "Manual intervention may be required"
    exit 1
else
    CURRENT_VERSION=$(echo "$VERSION_OUTPUT" | grep -o '[0-9][0-9]*' | head -1)
    if [ -n "$CURRENT_VERSION" ]; then
        echo "📊 Current version: $CURRENT_VERSION"
    else
        echo "📊 Current version: unknown"
    fi
fi

# Run migrations
echo ""
echo "Running migrations..."
if migrate -path "$MIGRATE_PATH" -database "$DB_URL" up; then
    echo "✅ Migrations completed successfully"

    # Show final version
    FINAL_VERSION_OUTPUT=$(migrate -path "$MIGRATE_PATH" -database "$DB_URL" version 2>&1 || true)
    NEW_VERSION=$(echo "$FINAL_VERSION_OUTPUT" | grep -o '[0-9][0-9]*' | head -1)
    if [ -n "$NEW_VERSION" ]; then
        echo "📊 Final version: $NEW_VERSION"
    else
        echo "📊 Final version: up to date"
    fi
else
    echo "❌ Migration failed"
    exit 1
fi

echo ""
echo "==================================="
echo "Migration runner completed"
echo "==================================="
