package database

import (
	"testing"
	"os"
	"path/filepath"
)

func TestSQLiteIntegration(t *testing.T) {
	// Create temporary database file
	tempDir := t.TempDir()
	dbPath := filepath.Join(tempDir, "test.db")
	
	// Create SQLite configuration
	config := &Config{
		Type:         DatabaseTypeSQLite,
		Path:         dbPath,
		MaxOpenConns: 1,
		MaxIdleConns: 1,
	}
	
	// Test database connection
	db, err := NewDB(config)
	if err != nil {
		t.Fatalf("Failed to create SQLite database: %v", err)
	}
	defer db.Close()
	
	// Test ping
	if err := db.Ping(); err != nil {
		t.Fatalf("Failed to ping SQLite database: %v", err)
	}
	
	// Verify database type detection
	if !db.IsSQLite() {
		t.Error("Database should be detected as SQLite")
	}
	
	if db.IsPostgreSQL() {
		t.Error("Database should not be detected as PostgreSQL")
	}
	
	if db.GetDatabaseType() != DatabaseTypeSQLite {
		t.Errorf("Expected database type %v, got %v", DatabaseTypeSQLite, db.GetDatabaseType())
	}
	
	// Test migration manager
	mm := NewMigrationManager(db)
	
	// Test creating migration table
	if err := mm.EnsureMigrationTable(); err != nil {
		t.Fatalf("Failed to create migration table: %v", err)
	}
	
	// Test health check
	health := db.Health()
	if health.Status != "healthy" {
		t.Errorf("Expected healthy status, got %s", health.Status)
	}
	
	// Verify database file was created
	if _, err := os.Stat(dbPath); os.IsNotExist(err) {
		t.Error("SQLite database file was not created")
	}
}

func TestPostgreSQLConnection(t *testing.T) {
	// Test PostgreSQL configuration defaults
	config := DefaultConfig()
	
	if config.Type != DatabaseTypePostgreSQL {
		t.Errorf("Expected default type %v, got %v", DatabaseTypePostgreSQL, config.Type)
	}
	
	// Test DSN generation
	dsn := config.DSN()
	if dsn == "" {
		t.Error("DSN should not be empty")
	}
	
	// Should contain PostgreSQL-specific elements
	if !contains(dsn, "host=") || !contains(dsn, "port=") {
		t.Error("PostgreSQL DSN should contain host and port")
	}
}

func TestSQLiteConfiguration(t *testing.T) {
	config := DefaultSQLiteConfig()
	
	if config.Type != DatabaseTypeSQLite {
		t.Errorf("Expected SQLite type, got %v", config.Type)
	}
	
	if config.MaxOpenConns != 1 {
		t.Errorf("Expected MaxOpenConns=1 for SQLite, got %d", config.MaxOpenConns)
	}
	
	// Test DSN generation
	dsn := config.DSN()
	if dsn == "" {
		t.Error("SQLite DSN should not be empty")
	}
	
	// Should contain SQLite-specific elements
	if !contains(dsn, "file:") || !contains(dsn, "_journal_mode=WAL") {
		t.Error("SQLite DSN should contain file: prefix and WAL mode")
	}
}

func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || 
		(len(s) > len(substr) && 
			(findSubstring(s, substr) != -1)))
}

func findSubstring(s, substr string) int {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return i
		}
	}
	return -1
}