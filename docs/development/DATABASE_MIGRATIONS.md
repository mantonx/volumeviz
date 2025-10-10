# Database Migrations

VolumeViz uses [golang-migrate/migrate](https://github.com/golang-migrate/migrate) for database schema management. This document explains how to create and run migrations.

**Current Support**: PostgreSQL (primary production database)
**Future Enhancement**: SQLite migration support can be added by creating separate migration files or database-agnostic SQL.

## Overview

The migration system provides:
- **Version control** for database schema changes
- **Forward migrations** to apply new schema changes
- **Rollback capability** to undo migrations if needed
- **Consistency** across development, staging, and production environments
- **Automatic migrations** on application startup (configurable)
- **Migration init container** in docker-compose for production deployments

## Migration Files

Migration files are stored in the `/migrations/postgresql/` directory:

```
migrations/postgresql/
├── 000001_initial_schema.up.sql
├── 000001_initial_schema.down.sql
├── 000002_add_stats_jobs_table.up.sql
├── 000002_add_stats_jobs_table.down.sql
├── 000003_fix_scanning_constraints.up.sql
├── 000003_fix_scanning_constraints.down.sql
└── ... (additional migrations)
```

**Note**: Migrations are numbered sequentially and applied in order. Each migration consists of two files:
- **`.up.sql`**: Contains the forward migration (apply changes)
- **`.down.sql`**: Contains the rollback migration (undo changes)

**Important**: Never modify existing migrations that have been applied to production. Always create new migrations for schema changes.

## Installation

Install golang-migrate and other development tools:

```bash
make install-tools
```

Or install manually:

```bash
go install -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest
```

## Running Migrations

### Automatic Migrations (Recommended for Development)

VolumeViz can automatically run migrations on startup:

**Using docker-compose:**
```bash
# Migrations run automatically via init container
docker compose up -d

# The migrate service runs first, then API starts
# Check migration logs:
docker compose logs migrate
```

**Using environment variable:**
```bash
# Enable AUTO_MIGRATE in .env or set as environment variable
export AUTO_MIGRATE=true
go run cmd/server/main.go
```

**Configuration:**
- Set `AUTO_MIGRATE=true` in `.env` file (enabled by default)
- Application will run migrations on startup before accepting requests
- Migrations are embedded in the binary (no external files needed)
- Safe to run multiple times - already-applied migrations are skipped

### Manual Migrations

#### Using Make Commands

```bash
# Run all pending migrations
make migrate

# Check current migration version
make migrate-version

# Roll back one migration
make migrate-down

# Create new migration files
make migrate-create NAME=add_user_preferences

# Force migration version (use with caution)
make migrate-force VERSION=5
```

### Using the Migration Script

```bash
# Run all pending migrations
./scripts/migrate.sh up

# Roll back one migration
./scripts/migrate.sh down

# Roll back 3 migrations
./scripts/migrate.sh down 3

# Check current version
./scripts/migrate.sh version

# Create new migration
./scripts/migrate.sh create add_user_preferences
```

### Using migrate CLI Directly

```bash
# Run migrations
migrate -path migrations -database "postgres://volumeviz:volumeviz@localhost:5432/volumeviz?sslmode=disable" up

# Check version
migrate -path migrations -database "postgres://volumeviz:volumeviz@localhost:5432/volumeviz?sslmode=disable" version
```

## Creating New Migrations

### 1. Generate Migration Files

```bash
make migrate-create NAME=add_user_preferences
```

This creates two files:
- `migrations/000014_add_user_preferences.up.sql`
- `migrations/000014_add_user_preferences.down.sql`

### 2. Write the Forward Migration (up.sql)

```sql
-- 000014_add_user_preferences.up.sql
CREATE TABLE user_preferences (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    theme VARCHAR(50) DEFAULT 'light',
    language VARCHAR(10) DEFAULT 'en',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_preferences_user_id ON user_preferences(user_id);
```

### 3. Write the Rollback Migration (down.sql)

```sql
-- 000014_add_user_preferences.down.sql
DROP INDEX IF EXISTS idx_user_preferences_user_id;
DROP TABLE IF EXISTS user_preferences;
```

### 4. Test the Migration

```bash
# Apply the migration
make migrate

# Verify it worked
make migrate-version

# Test rollback
make migrate-down

# Apply again
make migrate
```

## Migration Best Practices

### 1. Make Migrations Idempotent

Use `IF EXISTS` and `IF NOT EXISTS` clauses:

```sql
-- Safe to run multiple times
CREATE TABLE IF NOT EXISTS new_table (...);
ALTER TABLE existing_table ADD COLUMN IF NOT EXISTS new_column TEXT;
DROP INDEX IF EXISTS old_index;
```

### 2. Handle Data Migrations Carefully

For data changes, include both schema and data operations:

```sql
-- Add new column with default
ALTER TABLE users ADD COLUMN status VARCHAR(20) DEFAULT 'active';

-- Update existing data
UPDATE users SET status = 'active' WHERE status IS NULL;

-- Add constraint after data is clean
ALTER TABLE users ALTER COLUMN status SET NOT NULL;
```

### 3. Test Rollbacks

Always test that your down migration works:

```sql
-- If up migration adds a column
ALTER TABLE users ADD COLUMN new_field TEXT;

-- Down migration should remove it
ALTER TABLE users DROP COLUMN IF EXISTS new_field;
```

### 4. Use Transactions When Appropriate

Wrap related changes in transactions:

```sql
BEGIN;

CREATE TABLE new_table (...);
CREATE INDEX idx_new_table_id ON new_table(id);
INSERT INTO new_table SELECT ... FROM old_table;

COMMIT;
```

## Environment Configuration

The migration system supports environment variables:

```bash
# Database connection
export DB_TYPE=postgres
export DB_HOST=localhost
export DB_PORT=5432
export DB_USER=volumeviz
export DB_PASSWORD=volumeviz
export DB_NAME=volumeviz
export DB_SSLMODE=disable

# Migration settings
export MIGRATE_PATH=migrations

# Run migrations
./scripts/migrate.sh up
```

## Production Deployment

### Recommended Production Workflow

VolumeViz provides multiple approaches for production migrations:

#### Option 1: Docker Compose with Init Container (Recommended)

```yaml
# docker-compose.yml includes a migration init service
# It runs automatically before API starts
services:
  migrate:
    # Runs migrations then exits
    depends_on:
      postgres:
        condition: service_healthy
    restart: "no"

  api:
    # Waits for migrations to complete
    depends_on:
      migrate:
        condition: service_completed_successfully
```

**Deployment:**
```bash
# Start all services - migrations run first
docker compose up -d

# Check migration status
docker compose logs migrate

# Verify API started after migrations
docker compose logs api
```

#### Option 2: AUTO_MIGRATE in Application

```bash
# Set environment variable in production
export AUTO_MIGRATE=true

# Migrations run on application startup
./volumeviz
```

**Benefits:**
- Migrations embedded in binary
- No external migration files needed
- Safe for rolling deployments
- Idempotent - safe to run multiple times

#### Option 3: Manual Pre-Deployment Migrations

```bash
# Run migrations before deploying new application version
./scripts/migrate.sh up

# Deploy application
docker compose up -d api
```

### Production Best Practices

#### 1. Always Backup Before Migrations

```bash
# Backup database before running migrations
BACKUP_FILE="backup_$(date +%Y%m%d_%H%M%S).sql"
pg_dump "$DATABASE_URL" > "$BACKUP_FILE"
echo "Backup saved to: $BACKUP_FILE"

# Run migrations
docker compose up migrate
```

#### 2. Test Migrations in Staging First

```bash
# Apply to staging environment first
docker compose -f docker-compose.staging.yml up migrate

# Verify application works correctly
curl https://staging.example.com/api/v1/health

# Then apply to production
docker compose -f docker-compose.prod.yml up migrate
```

#### 3. Monitor Migration Progress

```bash
# Check current version during deployment
docker compose exec postgres psql -U volumeviz -d volumeviz -c "SELECT * FROM schema_migrations ORDER BY version;"

# Watch migration logs in real-time
docker compose logs -f migrate
```

#### 4. Zero-Downtime Migrations

For zero-downtime deployments:

1. **Make migrations backward-compatible** - New code works with old schema
2. **Deploy migration** - Schema changes applied
3. **Deploy new application code** - Uses new schema features
4. **Clean up old schema** (optional) - Remove deprecated columns/tables

**Example backward-compatible migration:**
```sql
-- Phase 1: Add new column (nullable, no constraint)
ALTER TABLE users ADD COLUMN email VARCHAR(255);

-- Deploy new code that uses email column

-- Phase 2 (later): Make column required
UPDATE users SET email = username || '@example.com' WHERE email IS NULL;
ALTER TABLE users ALTER COLUMN email SET NOT NULL;
```

## Troubleshooting

### Migration Failed Midway

If a migration fails partway through:

```bash
# Check current version
./scripts/migrate.sh version

# If migration is partially applied, you may need to force the version
./scripts/migrate.sh force <previous_version>

# Fix the migration file and try again
./scripts/migrate.sh up
```

### Dirty Migration State

If migrations are in a "dirty" state:

```bash
# Check migration status
./scripts/migrate.sh version
# Output: 5/d (dirty)

# Fix the database manually, then force clean state
./scripts/migrate.sh force 5

# Continue with migrations
./scripts/migrate.sh up
```

### Development Database Reset

To reset your development database:

```bash
# Drop and recreate database
dropdb volumeviz && createdb volumeviz

# Run all migrations from scratch
./scripts/migrate.sh up
```

## Integration with VolumeViz

### Automatic Migrations on Startup

VolumeViz can be configured to run migrations automatically on startup by setting:

```bash
export AUTO_MIGRATE=true
```

### Migration Status API

Check migration status via API:

```bash
curl http://localhost:8080/api/v1/health
# Returns migration version in response
```

## Examples

### Adding Filesystem Capacity Support

The recent addition of filesystem capacity support demonstrates a complete migration:

**000013_add_filesystem_capacity.up.sql:**
```sql
-- Add filesystem capacity columns
ALTER TABLE volume_sizes ADD COLUMN fs_total_bytes BIGINT;
ALTER TABLE volume_sizes ADD COLUMN fs_available_bytes BIGINT;  
ALTER TABLE volume_sizes ADD COLUMN fs_used_bytes BIGINT;
ALTER TABLE volume_sizes ADD COLUMN fs_usage_percent DECIMAL(5,2);
-- ... additional columns and indexes
```

**000013_add_filesystem_capacity.down.sql:**
```sql
-- Remove filesystem capacity columns
DROP INDEX IF EXISTS idx_volume_sizes_fs_total_bytes;
-- ... remove other indexes
ALTER TABLE volume_sizes DROP COLUMN IF EXISTS fs_total_bytes;
-- ... remove other columns
```

This migration enables VolumeViz to store filesystem capacity information for both network and regular Docker volumes.