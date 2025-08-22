#!/bin/bash

# VolumeViz Database Migration Script
# Wrapper around golang-migrate/migrate for VolumeViz

set -euo pipefail

# Default configuration
MIGRATE_PATH="${MIGRATE_PATH:-migrations}"
DB_TYPE="${DB_TYPE:-postgres}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-volumeviz}"
DB_PASSWORD="${DB_PASSWORD:-volumeviz}"
DB_NAME="${DB_NAME:-volumeviz}"
DB_PATH="${DB_PATH:-./volumeviz.db}"
DB_SSLMODE="${DB_SSLMODE:-disable}"

# Construct database URL
if [ "$DB_TYPE" = "postgres" ]; then
    DB_URL="postgres://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME?sslmode=$DB_SSLMODE"
elif [ "$DB_TYPE" = "sqlite" ]; then
    DB_URL="sqlite3://$DB_PATH"
else
    echo "Error: Supported database types are 'postgres' and 'sqlite'"
    exit 1
fi

# Check if migrate is installed
MIGRATE_CMD=""
if command -v migrate > /dev/null 2>&1; then
    MIGRATE_CMD="migrate"
elif command -v "$HOME/go/bin/migrate" > /dev/null 2>&1; then
    MIGRATE_CMD="$HOME/go/bin/migrate"
else
    echo "Installing golang-migrate..."
    go install -tags 'postgres,sqlite3' github.com/golang-migrate/migrate/v4/cmd/migrate@latest
    MIGRATE_CMD="$HOME/go/bin/migrate"
fi

# Function to show usage
show_usage() {
    cat << EOF
VolumeViz Database Migration Script

Usage: $0 <command> [options]

Commands:
  up              Run all pending migrations
  down [N]        Roll back N migrations (default: 1)
  version         Show current migration version
  force <version> Force migration version (use with caution)
  create <name>   Create new migration files
  
Environment Variables:
  DB_TYPE         Database type: postgres or sqlite (default: postgres)
  DB_HOST         Database host (default: localhost) [postgres only]
  DB_PORT         Database port (default: 5432) [postgres only]
  DB_USER         Database user (default: volumeviz) [postgres only]
  DB_PASSWORD     Database password (default: volumeviz) [postgres only]
  DB_NAME         Database name (default: volumeviz) [postgres only]
  DB_PATH         Database file path (default: ./volumeviz.db) [sqlite only]
  DB_SSLMODE      SSL mode (default: disable) [postgres only]
  MIGRATE_PATH    Migration files path (default: migrations)

Examples:
  # PostgreSQL
  $0 up                           # Run all pending migrations
  $0 down                         # Roll back one migration
  $0 version                      # Show current version
  
  # SQLite
  DB_TYPE=sqlite DB_PATH=./test.db $0 up      # Run migrations on SQLite
  DB_TYPE=sqlite $0 create add_indexes        # Create migration for SQLite
  
  # Other operations  
  $0 down 3                       # Roll back 3 migrations
  $0 create add_user_preferences  # Create new migration
  $0 force 5                      # Force version to 5

EOF
}

# Main command handling
case "${1:-}" in
    "up")
        echo "Running database migrations..."
        echo "Database: $DB_URL"
        echo "Migration path: $MIGRATE_PATH"
        $MIGRATE_CMD -path "$MIGRATE_PATH" -database "$DB_URL" up
        echo "✅ Migrations complete"
        ;;
    "down")
        STEPS="${2:-1}"
        echo "Rolling back $STEPS migration(s)..."
        $MIGRATE_CMD -path "$MIGRATE_PATH" -database "$DB_URL" down "$STEPS"
        echo "✅ Rollback complete"
        ;;
    "version")
        echo "Current migration version:"
        $MIGRATE_CMD -path "$MIGRATE_PATH" -database "$DB_URL" version
        ;;
    "force")
        if [ -z "${2:-}" ]; then
            echo "Error: force command requires a version number"
            echo "Usage: $0 force <version>"
            exit 1
        fi
        echo "⚠️  Forcing migration version to $2..."
        $MIGRATE_CMD -path "$MIGRATE_PATH" -database "$DB_URL" force "$2"
        echo "✅ Version forced to $2"
        ;;
    "create")
        if [ -z "${2:-}" ]; then
            echo "Error: create command requires a migration name"
            echo "Usage: $0 create <migration_name>"
            exit 1
        fi
        echo "Creating new migration: $2"
        $MIGRATE_CMD create -ext sql -dir "$MIGRATE_PATH" -seq "$2"
        echo "✅ Migration files created in $MIGRATE_PATH/"
        ;;
    "help"|"-h"|"--help"|"")
        show_usage
        ;;
    *)
        echo "Error: Unknown command '$1'"
        echo ""
        show_usage
        exit 1
        ;;
esac