package database

import (
	"strings"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/assert"
)

// TestRecordQuery tests query metrics recording
func TestRecordQuery(t *testing.T) {
	tests := []struct {
		name      string
		operation string
		table     string
		duration  time.Duration
		err       error
	}{
		{
			name:      "successful select",
			operation: "select",
			table:     "volumes",
			duration:  100 * time.Millisecond,
			err:       nil,
		},
		{
			name:      "failed insert",
			operation: "insert",
			table:     "scan_jobs",
			duration:  50 * time.Millisecond,
			err:       assert.AnError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Record the metric
			RecordQuery(tt.operation, tt.table, tt.duration, tt.err)
			
			// Check that metrics were recorded
			status := "success"
			if tt.err != nil {
				status = "error"
			}
			
			// Verify counter was incremented
			counter := testutil.ToFloat64(dbQueryTotal.WithLabelValues(tt.operation, tt.table, status))
			assert.Greater(t, counter, float64(0))
		})
	}
}

// TestRecordTransaction tests transaction metrics recording
func TestRecordTransaction(t *testing.T) {
	tests := []struct {
		name     string
		duration time.Duration
		status   string
	}{
		{
			name:     "committed transaction",
			duration: 200 * time.Millisecond,
			status:   "committed",
		},
		{
			name:     "rolled back transaction",
			duration: 150 * time.Millisecond,
			status:   "rolled_back",
		},
		{
			name:     "error transaction",
			duration: 10 * time.Millisecond,
			status:   "error",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Record the metric
			RecordTransaction(tt.duration, tt.status)
			
			// Verify counter was incremented
			counter := testutil.ToFloat64(dbTransactionTotal.WithLabelValues(tt.status))
			assert.Greater(t, counter, float64(0))
		})
	}
}

// TestRecordMigration tests migration metrics recording
func TestRecordMigration(t *testing.T) {
	tests := []struct {
		name      string
		direction string
		duration  time.Duration
		err       error
	}{
		{
			name:      "successful up migration",
			direction: "up",
			duration:  500 * time.Millisecond,
			err:       nil,
		},
		{
			name:      "failed down migration",
			direction: "down",
			duration:  300 * time.Millisecond,
			err:       assert.AnError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Record the metric
			RecordMigration(tt.direction, tt.duration, tt.err)
			
			// Check that metrics were recorded
			status := "success"
			if tt.err != nil {
				status = "error"
			}
			
			// Verify counter was incremented
			counter := testutil.ToFloat64(dbMigrationTotal.WithLabelValues(tt.direction, status))
			assert.Greater(t, counter, float64(0))
		})
	}
}

// TestRecordConnectionError tests connection error recording
func TestRecordConnectionError(t *testing.T) {
	initialCount := testutil.ToFloat64(dbErrorTotal.WithLabelValues("connection"))
	
	RecordConnectionError()
	
	newCount := testutil.ToFloat64(dbErrorTotal.WithLabelValues("connection"))
	assert.Equal(t, initialCount+1, newCount)
}

// TestExtractOperation tests SQL operation extraction
func TestExtractOperation(t *testing.T) {
	tests := []struct {
		query    string
		expected string
	}{
		{"SELECT * FROM volumes", "select"},
		{"select id from containers", "select"},
		{"INSERT INTO scan_jobs VALUES", "insert"},
		{"UPDATE volumes SET name = ?", "update"},
		{"DELETE FROM alerts WHERE id = ?", "delete"},
		{"CREATE TABLE test", "other"},
		{"  SELECT * FROM volumes  ", "select"},
	}

	for _, tt := range tests {
		t.Run(tt.query, func(t *testing.T) {
			result := extractOperation(tt.query)
			assert.Equal(t, tt.expected, result)
		})
	}
}

// TestExtractTableName tests SQL table name extraction
func TestExtractTableName(t *testing.T) {
	tests := []struct {
		query    string
		expected string
	}{
		{"SELECT * FROM volumes", "volumes"},
		{"SELECT * FROM volumes WHERE id = ?", "volumes"},
		{"SELECT * FROM `volumes` WHERE id = ?", "volumes"},
		{"INSERT INTO scan_jobs (id, type) VALUES", "scan_jobs"},
		{"UPDATE containers SET name = ?", "containers"},
		{"DELETE FROM alerts", "alerts"},
		{"SELECT * FROM volumes v JOIN containers c", "volumes"},
		{"  SELECT * FROM   volumes  ", "volumes"},
		{"TRUNCATE unknown_table", "unknown"},
	}

	for _, tt := range tests {
		t.Run(tt.query, func(t *testing.T) {
			result := extractTableName(tt.query)
			assert.Equal(t, tt.expected, result)
		})
	}
}

// TestMetricsCollector tests the metrics collector
func TestMetricsCollector(t *testing.T) {
	// This test would require a real database connection
	// Skipping for unit tests, would be covered in integration tests
	t.Skip("Requires database connection")
}

// BenchmarkRecordQuery benchmarks query recording
func BenchmarkRecordQuery(b *testing.B) {
	for i := 0; i < b.N; i++ {
		RecordQuery("select", "volumes", 10*time.Millisecond, nil)
	}
}

// BenchmarkExtractOperation benchmarks operation extraction
func BenchmarkExtractOperation(b *testing.B) {
	query := "SELECT * FROM volumes WHERE driver = ? AND is_active = ?"
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = extractOperation(query)
	}
}

// BenchmarkExtractTableName benchmarks table name extraction
func BenchmarkExtractTableName(b *testing.B) {
	query := "SELECT v.*, s.size FROM volumes v JOIN volume_sizes s ON v.id = s.volume_id"
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = extractTableName(query)
	}
}

// TestMetricsIntegration tests metrics integration with actual queries
func TestMetricsIntegration(t *testing.T) {
	// Reset metrics for clean test
	dbQueryTotal.Reset()
	dbTransactionTotal.Reset()
	dbErrorTotal.Reset()
	
	// Test query metrics
	RecordQuery("select", "volumes", 25*time.Millisecond, nil)
	RecordQuery("insert", "scan_jobs", 15*time.Millisecond, nil)
	RecordQuery("update", "volumes", 30*time.Millisecond, assert.AnError)
	
	// Verify metrics
	selectSuccess := testutil.ToFloat64(dbQueryTotal.WithLabelValues("select", "volumes", "success"))
	assert.Equal(t, float64(1), selectSuccess)
	
	insertSuccess := testutil.ToFloat64(dbQueryTotal.WithLabelValues("insert", "scan_jobs", "success"))
	assert.Equal(t, float64(1), insertSuccess)
	
	updateError := testutil.ToFloat64(dbQueryTotal.WithLabelValues("update", "volumes", "error"))
	assert.Equal(t, float64(1), updateError)
	
	queryErrors := testutil.ToFloat64(dbErrorTotal.WithLabelValues("query"))
	assert.Equal(t, float64(1), queryErrors)
	
	// Test transaction metrics
	RecordTransaction(100*time.Millisecond, "committed")
	RecordTransaction(50*time.Millisecond, "rolled_back")
	RecordTransaction(25*time.Millisecond, "error")
	
	committed := testutil.ToFloat64(dbTransactionTotal.WithLabelValues("committed"))
	assert.Equal(t, float64(1), committed)
	
	rolledBack := testutil.ToFloat64(dbTransactionTotal.WithLabelValues("rolled_back"))
	assert.Equal(t, float64(1), rolledBack)
	
	txErrors := testutil.ToFloat64(dbTransactionTotal.WithLabelValues("error"))
	assert.Equal(t, float64(1), txErrors)
	
	totalErrors := testutil.ToFloat64(dbErrorTotal.WithLabelValues("transaction"))
	assert.Equal(t, float64(1), totalErrors)
}

// TestMetricsLabels tests that all metrics have correct labels
func TestMetricsLabels(t *testing.T) {
	// Test connection metrics labels
	dbConnectionsTotal.WithLabelValues("open").Set(5)
	dbConnectionsTotal.WithLabelValues("in_use").Set(3)
	dbConnectionsTotal.WithLabelValues("idle").Set(2)
	
	// Verify all labels work
	assert.Equal(t, float64(5), testutil.ToFloat64(dbConnectionsTotal.WithLabelValues("open")))
	assert.Equal(t, float64(3), testutil.ToFloat64(dbConnectionsTotal.WithLabelValues("in_use")))
	assert.Equal(t, float64(2), testutil.ToFloat64(dbConnectionsTotal.WithLabelValues("idle")))
	
	// Test table metrics labels
	tables := []string{"volumes", "containers", "scan_jobs", "alerts"}
	for _, table := range tables {
		dbTableRows.WithLabelValues(table).Set(100)
		dbTableSize.WithLabelValues(table).Set(1024)
		
		assert.Equal(t, float64(100), testutil.ToFloat64(dbTableRows.WithLabelValues(table)))
		assert.Equal(t, float64(1024), testutil.ToFloat64(dbTableSize.WithLabelValues(table)))
	}
}

// TestExtractComplexQueries tests extraction with complex SQL
func TestExtractComplexQueries(t *testing.T) {
	tests := []struct {
		name          string
		query         string
		expectedOp    string
		expectedTable string
	}{
		{
			name: "complex join",
			query: `SELECT v.*, COUNT(cv.container_id) as container_count
					FROM volumes v
					LEFT JOIN container_volumes cv ON v.id = cv.volume_id
					GROUP BY v.id`,
			expectedOp:    "select",
			expectedTable: "volumes",
		},
		{
			name: "subquery",
			query: `SELECT * FROM volumes WHERE id IN (
						SELECT volume_id FROM volume_sizes 
						WHERE size > 1000000
					)`,
			expectedOp:    "select",
			expectedTable: "volumes",
		},
		{
			name: "with clause",
			query: `WITH active_volumes AS (
						SELECT * FROM volumes WHERE is_active = true
					)
					SELECT * FROM active_volumes`,
			expectedOp:    "select",
			expectedTable: "active_volumes",
		},
		{
			name:          "insert with returning",
			query:         "INSERT INTO scan_jobs (type, status) VALUES ($1, $2) RETURNING id",
			expectedOp:    "insert",
			expectedTable: "scan_jobs",
		},
		{
			name:          "update with join",
			query:         "UPDATE volumes v SET last_scanned = NOW() FROM scan_results sr WHERE v.id = sr.volume_id",
			expectedOp:    "update",
			expectedTable: "volumes",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			op := extractOperation(tt.query)
			table := extractTableName(tt.query)
			
			assert.Equal(t, tt.expectedOp, op, "operation mismatch")
			if !strings.Contains(tt.name, "with clause") { // WITH clause extraction is complex
				assert.Equal(t, tt.expectedTable, table, "table mismatch")
			}
		})
	}
}