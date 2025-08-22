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

## Migration Files

Migration files are stored in the `/migrations` directory:

```
migrations/
├── 000001_create_core_schema.up.sql
├── 000001_create_core_schema.down.sql
├── 000002_create_file_analytics.up.sql
├── 000002_create_file_analytics.down.sql
├── 000013_add_filesystem_capacity.up.sql
├── 000013_add_filesystem_capacity.down.sql
└── ...
```

Each migration consists of two files:
- **`.up.sql`**: Contains the forward migration (apply changes)
- **`.down.sql`**: Contains the rollback migration (undo changes)

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

### Using Make Commands

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

### 1. Run Migrations Before App Deployment

```bash
# In production deployment script
./scripts/migrate.sh up
```

### 2. Backup Before Major Changes

```bash
# Backup database before running migrations
pg_dump "postgres://user:pass@host:port/db" > backup_$(date +%Y%m%d_%H%M%S).sql

# Run migrations
./scripts/migrate.sh up
```

### 3. Monitor Migration Progress

For large migrations, monitor progress:

```bash
# Check current version during deployment
./scripts/migrate.sh version

# View migration history in database
psql -c "SELECT * FROM schema_migrations ORDER BY version;"
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