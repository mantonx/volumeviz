// Package database provides migration management for schema evolution
// Supports up/down migrations with embedded SQL files
package database

import (
	"crypto/md5"
	"database/sql"
	"embed"
	"fmt"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/mantonx/volumeviz/internal/utils"
)

//go:embed migrations/*.sql
var migrationFiles embed.FS

// Migration represents a database migration
type Migration struct {
	Version     string
	Description string
	UpSQL       string
	DownSQL     string
}

// MigrationManager handles database migrations
type MigrationManager struct {
	db     *sql.DB
	dbType DatabaseType
}

// NewMigrationManager creates a new migration manager
func NewMigrationManager(db *DB) *MigrationManager {
	return &MigrationManager{
		db:     db.DB,
		dbType: db.GetDatabaseType(),
	}
}

// LoadMigrationsFromFiles reads migration files from embedded filesystem
func (mm *MigrationManager) LoadMigrationsFromFiles() ([]Migration, error) {
	entries, err := migrationFiles.ReadDir("migrations")
	if err != nil {
		return nil, utils.WrapError(err, "failed to read migrations directory")
	}

	// Group files by version
	migrationMap := make(map[string]*Migration)

	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}

		filename := entry.Name()
		if filepath.Ext(filename) != ".sql" {
			continue
		}

		// Parse filename: 001_initial_schema.sql, 001_initial_schema_down.sql, or 001_initial_schema_sqlite.sql
		var version, description string
		var isDown, isDBSpecific bool
		var dbSuffix string

		// Extract version number (first 3 digits)
		if len(filename) >= 4 && filename[3] == '_' {
			version = filename[:3]
			remaining := filename[4:]

			// Check for database-specific suffix first
			if strings.Contains(remaining, "_sqlite") {
				isDBSpecific = true
				dbSuffix = "sqlite"
				if mm.dbType != DatabaseTypeSQLite {
					continue // Skip SQLite-specific files for PostgreSQL
				}
			} else if strings.Contains(remaining, "_postgres") {
				isDBSpecific = true
				dbSuffix = "postgres"
				if mm.dbType != DatabaseTypePostgreSQL {
					continue // Skip PostgreSQL-specific files for SQLite
				}
			} else if mm.dbType == DatabaseTypeSQLite {
				// For SQLite, prefer database-specific files if they exist
				sqliteVariant := strings.Replace(filename, ".sql", "_sqlite.sql", 1)
				if _, err := migrationFiles.Open("migrations/" + sqliteVariant); err == nil {
					continue // Skip generic file in favor of SQLite-specific one
				}
			}

			// Check if it's a down migration
			if strings.HasSuffix(remaining, "_down.sql") {
				isDown = true
				if isDBSpecific {
					// Remove "_sqlite_down.sql" or "_postgres_down.sql"
					description = remaining[:len(remaining)-(len(dbSuffix)+10)]
				} else {
					// Remove "_down.sql"
					description = remaining[:len(remaining)-9]
				}
			} else if strings.HasSuffix(remaining, ".sql") {
				isDown = false
				if isDBSpecific {
					// Remove "_sqlite.sql" or "_postgres.sql"
					description = remaining[:len(remaining)-(len(dbSuffix)+5)]
				} else {
					// Remove ".sql"
					description = remaining[:len(remaining)-4]
				}
			} else {
				continue // Skip invalid filename
			}

			// Clean up description (replace underscores with spaces)
			description = cleanDescription(description)
		} else {
			continue // Skip invalid filename format
		}

		// Read file content
		content, err := migrationFiles.ReadFile("migrations/" + filename)
		if err != nil {
			return nil, utils.WrapErrorf(err, "failed to read migration file %s", filename)
		}

		// Get or create migration
		if migrationMap[version] == nil {
			migrationMap[version] = &Migration{
				Version:     version,
				Description: description,
			}
		}

		// Set appropriate SQL
		if isDown {
			migrationMap[version].DownSQL = string(content)
		} else {
			migrationMap[version].UpSQL = string(content)
		}
	}

	// Convert map to slice and sort by version
	var migrations []Migration
	for _, migration := range migrationMap {
		// Skip incomplete migrations (missing up or down SQL)
		if migration.UpSQL == "" {
			continue // Down-only migrations are allowed for some cases
		}
		migrations = append(migrations, *migration)
	}

	// Sort by version number
	sort.Slice(migrations, func(i, j int) bool {
		vi, _ := strconv.Atoi(migrations[i].Version)
		vj, _ := strconv.Atoi(migrations[j].Version)
		return vi < vj
	})

	return migrations, nil
}

// cleanDescription converts underscore-separated description to title case
func cleanDescription(desc string) string {
	// Simple replacement for this example - in production, use proper string processing
	result := ""
	words := []string{}
	current := ""

	for _, char := range desc {
		if char == '_' {
			if current != "" {
				words = append(words, current)
				current = ""
			}
		} else {
			current += string(char)
		}
	}
	if current != "" {
		words = append(words, current)
	}

	for i, word := range words {
		if i > 0 {
			result += " "
		}
		if len(word) > 0 {
			result += string(word[0]-32) + word[1:] // Simple title case
		}
	}

	return result
}

// EnsureMigrationTable creates the migration history table if it doesn't exist
func (mm *MigrationManager) EnsureMigrationTable() error {
	var query string

	if mm.dbType == DatabaseTypeSQLite {
		query = `
			CREATE TABLE IF NOT EXISTS migration_history (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				version TEXT NOT NULL UNIQUE,
				description TEXT NOT NULL,
				applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
				rollback_sql TEXT,
				checksum TEXT NOT NULL,
				execution_time INTEGER NOT NULL DEFAULT 0
			);
			
			CREATE INDEX IF NOT EXISTS idx_migration_history_version ON migration_history(version);
			CREATE INDEX IF NOT EXISTS idx_migration_history_applied_at ON migration_history(applied_at);
		`
	} else {
		query = `
			CREATE TABLE IF NOT EXISTS migration_history (
				id SERIAL PRIMARY KEY,
				version VARCHAR(255) NOT NULL UNIQUE,
				description TEXT NOT NULL,
				applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
				rollback_sql TEXT,
				checksum VARCHAR(32) NOT NULL,
				execution_time BIGINT NOT NULL DEFAULT 0
			);
			
			CREATE INDEX IF NOT EXISTS idx_migration_history_version ON migration_history(version);
			CREATE INDEX IF NOT EXISTS idx_migration_history_applied_at ON migration_history(applied_at);
		`
	}

	_, err := mm.db.Exec(query)
	return err
}

// GetAppliedMigrations returns all applied migrations
func (mm *MigrationManager) GetAppliedMigrations() ([]MigrationHistory, error) {
	query := `
		SELECT id, version, description, applied_at, rollback_sql, checksum, execution_time
		FROM migration_history 
		ORDER BY applied_at ASC
	`

	rows, err := mm.db.Query(query)
	if err != nil {
		return nil, utils.WrapError(err, "failed to query applied migrations")
	}
	defer rows.Close()

	var migrations []MigrationHistory
	for rows.Next() {
		var m MigrationHistory
		err := rows.Scan(&m.ID, &m.Version, &m.Description, &m.AppliedAt,
			&m.RollbackSQL, &m.Checksum, &m.ExecutionTime)
		if err != nil {
			return nil, utils.WrapError(err, "failed to scan migration")
		}
		migrations = append(migrations, m)
	}

	return migrations, nil
}

// GetPendingMigrations returns migrations that haven't been applied yet
func (mm *MigrationManager) GetPendingMigrations() ([]Migration, error) {
	applied, err := mm.GetAppliedMigrations()
	if err != nil {
		return nil, err
	}

	appliedMap := make(map[string]bool)
	for _, m := range applied {
		appliedMap[m.Version] = true
	}

	allMigrations, err := mm.LoadMigrationsFromFiles()
	if err != nil {
		return nil, utils.WrapError(err, "failed to load migrations")
	}

	var pending []Migration
	for _, m := range allMigrations {
		if !appliedMap[m.Version] {
			pending = append(pending, m)
		}
	}

	return pending, nil
}

// ApplyMigration applies a single migration
func (mm *MigrationManager) ApplyMigration(migration Migration) error {
	start := time.Now()

	// Begin transaction
	tx, err := mm.db.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Execute migration SQL
	_, err = tx.Exec(migration.UpSQL)
	if err != nil {
		return utils.WrapErrorf(err, "failed to execute migration %s", migration.Version)
	}

	// Calculate checksum
	checksum := fmt.Sprintf("%x", md5.Sum([]byte(migration.UpSQL)))

	// Record migration in history
	_, err = tx.Exec(`
		INSERT INTO migration_history (version, description, rollback_sql, checksum, execution_time)
		VALUES ($1, $2, $3, $4, $5)
	`, migration.Version, migration.Description, migration.DownSQL, checksum, time.Since(start).Nanoseconds()/1e6)

	if err != nil {
		return utils.WrapErrorf(err, "failed to record migration %s", migration.Version)
	}

	// Commit transaction
	if err = tx.Commit(); err != nil {
		return utils.WrapErrorf(err, "failed to commit migration %s", migration.Version)
	}

	return nil
}

// RollbackMigration rolls back a specific migration
func (mm *MigrationManager) RollbackMigration(version string) error {
	// Get migration details
	var m MigrationHistory
	err := mm.db.QueryRow(`
		SELECT id, version, description, rollback_sql, checksum
		FROM migration_history 
		WHERE version = $1
	`, version).Scan(&m.ID, &m.Version, &m.Description, &m.RollbackSQL, &m.Checksum)

	if err != nil {
		if err == sql.ErrNoRows {
			return fmt.Errorf("migration %s not found", version)
		}
		return fmt.Errorf("failed to get migration %s: %w", version, err)
	}

	if m.RollbackSQL == nil {
		return fmt.Errorf("migration %s has no rollback SQL", version)
	}

	// Begin transaction
	tx, err := mm.db.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Execute rollback SQL
	_, err = tx.Exec(*m.RollbackSQL)
	if err != nil {
		return fmt.Errorf("failed to execute rollback for %s: %w", version, err)
	}

	// Remove from migration history
	_, err = tx.Exec(`DELETE FROM migration_history WHERE version = $1`, version)
	if err != nil {
		return fmt.Errorf("failed to remove migration %s from history: %w", version, err)
	}

	// Commit transaction
	if err = tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit rollback for %s: %w", version, err)
	}

	return nil
}

// ApplyAllPending applies all pending migrations
func (mm *MigrationManager) ApplyAllPending() error {
	if err := mm.EnsureMigrationTable(); err != nil {
		return fmt.Errorf("failed to ensure migration table: %w", err)
	}

	pending, err := mm.GetPendingMigrations()
	if err != nil {
		return fmt.Errorf("failed to get pending migrations: %w", err)
	}

	if len(pending) == 0 {
		return nil // No migrations to apply
	}

	for _, migration := range pending {
		if err := mm.ApplyMigration(migration); err != nil {
			return fmt.Errorf("failed to apply migration %s: %w", migration.Version, err)
		}
	}

	return nil
}

// GetMigrationStatus returns the current migration status
func (mm *MigrationManager) GetMigrationStatus() (*MigrationStatus, error) {
	applied, err := mm.GetAppliedMigrations()
	if err != nil {
		return nil, err
	}

	pending, err := mm.GetPendingMigrations()
	if err != nil {
		return nil, err
	}

	allMigrations, err := mm.LoadMigrationsFromFiles()
	if err != nil {
		return nil, fmt.Errorf("failed to load all migrations: %w", err)
	}

	status := &MigrationStatus{
		TotalMigrations:   len(allMigrations),
		AppliedCount:      len(applied),
		PendingCount:      len(pending),
		AppliedMigrations: applied,
		PendingMigrations: make([]string, len(pending)),
	}

	for i, m := range pending {
		status.PendingMigrations[i] = m.Version
	}

	if len(applied) > 0 {
		status.LastApplied = &applied[len(applied)-1]
	}

	return status, nil
}

// MigrationStatus represents the current state of database migrations
type MigrationStatus struct {
	TotalMigrations   int                `json:"total_migrations"`
	AppliedCount      int                `json:"applied_count"`
	PendingCount      int                `json:"pending_count"`
	AppliedMigrations []MigrationHistory `json:"applied_migrations"`
	PendingMigrations []string           `json:"pending_migrations"`
	LastApplied       *MigrationHistory  `json:"last_applied,omitempty"`
}

// IsUpToDate returns true if all migrations are applied
func (ms *MigrationStatus) IsUpToDate() bool {
	return ms.PendingCount == 0
}

// GetCompletionPercentage returns migration completion as percentage
func (ms *MigrationStatus) GetCompletionPercentage() float64 {
	if ms.TotalMigrations == 0 {
		return 100.0
	}
	return float64(ms.AppliedCount) / float64(ms.TotalMigrations) * 100.0
}
