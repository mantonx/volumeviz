package database

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestMigrationHistory_Structure(t *testing.T) {
	now := time.Now()
	rollbackSQL := "DROP TABLE test_table;"
	
	migration := &MigrationHistory{
		ID:            1,
		Version:       "001",
		Description:   "Initial schema",
		AppliedAt:     now,
		RollbackSQL:   &rollbackSQL,
		Checksum:      "abc123def456",
		ExecutionTime: 150, // milliseconds
	}

	assert.Equal(t, 1, migration.ID)
	assert.Equal(t, "001", migration.Version)
	assert.Equal(t, "Initial schema", migration.Description)
	assert.Equal(t, now, migration.AppliedAt)
	assert.NotNil(t, migration.RollbackSQL)
	assert.Equal(t, "DROP TABLE test_table;", *migration.RollbackSQL)
	assert.Equal(t, "abc123def456", migration.Checksum)
	assert.Equal(t, int64(150), migration.ExecutionTime)
}

func TestMigrationStatus_Structure(t *testing.T) {
	appliedMigration := MigrationHistory{
		ID:            1,
		Version:       "001",
		Description:   "Initial schema",
		AppliedAt:     time.Now(),
		Checksum:      "abc123",
		ExecutionTime: 100,
	}
	
	status := &MigrationStatus{
		TotalMigrations:   5,
		AppliedCount:      3,
		PendingCount:      2,
		AppliedMigrations: []MigrationHistory{appliedMigration},
		PendingMigrations: []string{"004_add_indexes.sql", "005_add_triggers.sql"},
		LastApplied:       &appliedMigration,
	}

	assert.Equal(t, 5, status.TotalMigrations)
	assert.Equal(t, 3, status.AppliedCount)
	assert.Equal(t, 2, status.PendingCount)
	assert.Len(t, status.AppliedMigrations, 1)
	assert.Len(t, status.PendingMigrations, 2)
	assert.NotNil(t, status.LastApplied)
	assert.Contains(t, status.PendingMigrations, "004_add_indexes.sql")
	assert.Contains(t, status.PendingMigrations, "005_add_triggers.sql")
}

func TestMigrationStatus_IsUpToDate(t *testing.T) {
	// Test up-to-date status
	upToDateStatus := &MigrationStatus{
		TotalMigrations:   3,
		AppliedCount:      3,
		PendingCount:      0,
		AppliedMigrations: []MigrationHistory{},
		PendingMigrations: []string{},
		LastApplied:       nil,
	}

	assert.True(t, upToDateStatus.IsUpToDate())

	// Test not up-to-date status
	pendingStatus := &MigrationStatus{
		TotalMigrations:   5,
		AppliedCount:      3,
		PendingCount:      2,
		AppliedMigrations: []MigrationHistory{},
		PendingMigrations: []string{"004_migration.sql", "005_migration.sql"},
		LastApplied:       nil,
	}

	assert.False(t, pendingStatus.IsUpToDate())
}

func TestMigration_Structure(t *testing.T) {
	upSQL := "CREATE TABLE test (id SERIAL PRIMARY KEY);"
	downSQL := "DROP TABLE test;"
	
	migration := &Migration{
		Version:     "001",
		Description: "Create test table",
		UpSQL:       upSQL,
		DownSQL:     downSQL,
	}

	assert.Equal(t, "001", migration.Version)
	assert.Equal(t, "Create test table", migration.Description)
	assert.Equal(t, upSQL, migration.UpSQL)
	assert.Equal(t, downSQL, migration.DownSQL)
}

func TestMigration_RequiredFields(t *testing.T) {
	upSQL := "ALTER TABLE test ADD COLUMN name VARCHAR(255);"
	
	migration := &Migration{
		Version:     "002",
		Description: "Add name column",
		UpSQL:       upSQL,
		DownSQL:     "", // Empty downSQL
	}

	assert.Equal(t, "002", migration.Version)
	assert.Equal(t, "Add name column", migration.Description)
	assert.Equal(t, upSQL, migration.UpSQL)
	assert.Equal(t, "", migration.DownSQL)
}

func TestMigrationValidation(t *testing.T) {
	tests := []struct {
		name        string
		migration   *Migration
		expectValid bool
	}{
		{
			name: "valid migration with down SQL",
			migration: &Migration{
				Version:     "001",
				Description: "Create table",
				UpSQL:       "CREATE TABLE test (id SERIAL);",
				DownSQL:     "DROP TABLE test;",
			},
			expectValid: true,
		},
		{
			name: "valid migration without down SQL",
			migration: &Migration{
				Version:     "002",
				Description: "Add data",
				UpSQL:       "INSERT INTO test VALUES (1);",
				DownSQL:     "",
			},
			expectValid: true,
		},
		{
			name: "invalid migration - no version",
			migration: &Migration{
				Version:     "",
				Description: "Invalid migration",
				UpSQL:       "CREATE TABLE test (id SERIAL);",
				DownSQL:     "",
			},
			expectValid: false,
		},
		{
			name: "invalid migration - no up SQL",
			migration: &Migration{
				Version:     "003",
				Description: "Invalid migration",
				UpSQL:       "",
				DownSQL:     "",
			},
			expectValid: false,
		},
		{
			name: "invalid migration - no description",
			migration: &Migration{
				Version:     "004",
				Description: "",
				UpSQL:       "CREATE TABLE test (id SERIAL);",
				DownSQL:     "",
			},
			expectValid: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Simple validation logic
			isValid := tt.migration.Version != "" && 
					 tt.migration.UpSQL != "" && 
					 tt.migration.Description != ""
			
			assert.Equal(t, tt.expectValid, isValid)
		})
	}
}

func TestMigrationVersionComparison(t *testing.T) {
	versions := []string{"001", "002", "010", "011", "100"}
	
	// Test that versions can be compared (as strings they sort correctly)
	for i := 0; i < len(versions)-1; i++ {
		current := versions[i]
		next := versions[i+1]
		
		// String comparison should work for zero-padded versions
		assert.True(t, current < next, "Version %s should be less than %s", current, next)
	}
}

func TestMigrationFileNaming(t *testing.T) {
	tests := []struct {
		filename string
		version  string
		valid    bool
	}{
		{"001_initial_schema.sql", "001", true},
		{"002_add_users_table.sql", "002", true},
		{"010_add_indexes.sql", "010", true},
		{"invalid_name.sql", "", false},
		{"001_initial.up.sql", "001", true},
		{"001_initial.down.sql", "001", true},
	}

	for _, tt := range tests {
		t.Run(tt.filename, func(t *testing.T) {
			// Simple filename parsing logic
			if len(tt.filename) >= 3 {
				extractedVersion := tt.filename[:3]
				if tt.valid {
					assert.Equal(t, tt.version, extractedVersion)
				}
			}
		})
	}
}

func TestMigrationStatus_Calculations(t *testing.T) {
	status := &MigrationStatus{
		TotalMigrations: 10,
		AppliedCount:    7,
		PendingCount:    3,
	}

	// Verify calculations are consistent
	assert.Equal(t, status.TotalMigrations, status.AppliedCount+status.PendingCount)
	
	// Test percentages
	appliedPercent := float64(status.AppliedCount) / float64(status.TotalMigrations) * 100
	pendingPercent := float64(status.PendingCount) / float64(status.TotalMigrations) * 100
	
	assert.Equal(t, 70.0, appliedPercent)
	assert.Equal(t, 30.0, pendingPercent)
	assert.Equal(t, 100.0, appliedPercent+pendingPercent)
}

func TestMigrationHistory_ExecutionTime(t *testing.T) {
	// Test various execution times
	tests := []struct {
		name          string
		executionTime int64
		description   string
	}{
		{"fast migration", 50, "under 100ms"},
		{"normal migration", 500, "under 1 second"},
		{"slow migration", 5000, "over 5 seconds"},
		{"very slow migration", 30000, "over 30 seconds"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			migration := &MigrationHistory{
				ID:            1,
				Version:       "001",
				Description:   tt.name,
				AppliedAt:     time.Now(),
				ExecutionTime: tt.executionTime,
			}

			assert.Equal(t, tt.executionTime, migration.ExecutionTime)
			
			// Convert to duration for readability
			duration := time.Duration(migration.ExecutionTime) * time.Millisecond
			
			switch {
			case tt.executionTime < 100:
				assert.Less(t, duration, 100*time.Millisecond)
			case tt.executionTime < 1000:
				assert.Less(t, duration, 1*time.Second)
			case tt.executionTime >= 5000:
				assert.GreaterOrEqual(t, duration, 5*time.Second)
			}
		})
	}
}

// Benchmark tests
func BenchmarkMigrationHistory_Creation(b *testing.B) {
	now := time.Now()
	rollbackSQL := "DROP TABLE test;"
	
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = &MigrationHistory{
			ID:            i,
			Version:       "001",
			Description:   "Benchmark migration",
			AppliedAt:     now,
			RollbackSQL:   &rollbackSQL,
			Checksum:      "benchmark_checksum",
			ExecutionTime: 100,
		}
	}
}

func BenchmarkMigrationStatus_Creation(b *testing.B) {
	appliedMigrations := []MigrationHistory{{ID: 1, Version: "001"}}
	pendingMigrations := []string{"002_migration.sql", "003_migration.sql"}
	
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = &MigrationStatus{
			TotalMigrations:   3,
			AppliedCount:      1,
			PendingCount:      2,
			AppliedMigrations: appliedMigrations,
			PendingMigrations: pendingMigrations,
		}
	}
}

func BenchmarkMigrationStatus_IsUpToDate(b *testing.B) {
	status := &MigrationStatus{
		PendingCount: 0,
	}
	
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = status.IsUpToDate()
	}
}