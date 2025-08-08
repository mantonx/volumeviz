package database

import (
	"testing"

	"github.com/mantonx/volumeviz/internal/database"
	"github.com/stretchr/testify/assert"
)

func TestConnectionTestResult_Structure(t *testing.T) {
	result := &ConnectionTestResult{
		Success:            true,
		Message:            "Database connection is healthy",
		Error:              "",
		OpenConnections:    5,
		IdleConnections:    3,
		MaxOpenConnections: 25,
	}

	assert.True(t, result.Success)
	assert.Equal(t, "Database connection is healthy", result.Message)
	assert.Empty(t, result.Error)
	assert.Equal(t, 5, result.OpenConnections)
	assert.Equal(t, 3, result.IdleConnections)
	assert.Equal(t, 25, result.MaxOpenConnections)
}

func TestConnectionTestResult_Failure(t *testing.T) {
	result := &ConnectionTestResult{
		Success: false,
		Message: "Database connection failed",
		Error:   "connection timeout",
	}

	assert.False(t, result.Success)
	assert.Equal(t, "Database connection failed", result.Message)
	assert.Equal(t, "connection timeout", result.Error)
	assert.Equal(t, 0, result.OpenConnections) // Default zero values
}

func TestDatabaseStats_Structure(t *testing.T) {
	volumeStats := &database.VolumeStats{
		TotalVolumes:   10,
		ActiveVolumes:  8,
		UniqueDrivers:  2,
		ScannedVolumes: 6,
	}

	scanJobStats := &database.ScanJobStats{
		TotalJobs:     100,
		QueuedJobs:    5,
		RunningJobs:   2,
		CompletedJobs: 85,
		FailedJobs:    8,
		CancelledJobs: 0,
	}

	healthStatus := &database.HealthStatus{
		Status:       "healthy",
		ResponseTime: 10,
		OpenConns:    5,
		IdleConns:    3,
		MaxOpenConns: 25,
	}

	migrationStatus := &database.MigrationStatus{
		TotalMigrations: 5,
		AppliedCount:    3,
		PendingCount:    2,
	}

	stats := &DatabaseStats{
		VolumeStats:     volumeStats,
		ScanJobStats:    scanJobStats,
		DatabaseHealth:  healthStatus,
		MigrationStatus: migrationStatus,
	}

	assert.NotNil(t, stats.VolumeStats)
	assert.NotNil(t, stats.ScanJobStats)
	assert.NotNil(t, stats.DatabaseHealth)
	assert.NotNil(t, stats.MigrationStatus)

	// Verify volume stats
	assert.Equal(t, 10, stats.VolumeStats.TotalVolumes)
	assert.Equal(t, 8, stats.VolumeStats.ActiveVolumes)

	// Verify scan job stats
	assert.Equal(t, 100, stats.ScanJobStats.TotalJobs)
	assert.Equal(t, 85, stats.ScanJobStats.CompletedJobs)

	// Verify health status
	assert.Equal(t, "healthy", stats.DatabaseHealth.Status)
	assert.Equal(t, 5, stats.DatabaseHealth.OpenConns)

	// Verify migration status
	assert.Equal(t, 5, stats.MigrationStatus.TotalMigrations)
	assert.Equal(t, 3, stats.MigrationStatus.AppliedCount)
}

func TestTableSizeInfo_Structure(t *testing.T) {
	distinctValues := int64(1000)
	correlation := 0.95

	info := &TableSizeInfo{
		SchemaName:     "public",
		TableName:      "volumes",
		ColumnName:     "volume_id",
		DistinctValues: &distinctValues,
		Correlation:    &correlation,
	}

	assert.Equal(t, "public", info.SchemaName)
	assert.Equal(t, "volumes", info.TableName)
	assert.Equal(t, "volume_id", info.ColumnName)
	assert.NotNil(t, info.DistinctValues)
	assert.Equal(t, int64(1000), *info.DistinctValues)
	assert.NotNil(t, info.Correlation)
	assert.Equal(t, 0.95, *info.Correlation)
}

func TestSlowQueryInfo_Structure(t *testing.T) {
	hitPercent := 95.5

	info := &SlowQueryInfo{
		Query:      "SELECT * FROM volumes WHERE status = $1",
		Calls:      1000,
		TotalTime:  5000.0,
		MeanTime:   5.0,
		MinTime:    1.0,
		MaxTime:    100.0,
		StddevTime: 2.5,
		Rows:       10000,
		HitPercent: &hitPercent,
	}

	assert.Equal(t, "SELECT * FROM volumes WHERE status = $1", info.Query)
	assert.Equal(t, int64(1000), info.Calls)
	assert.Equal(t, 5000.0, info.TotalTime)
	assert.Equal(t, 5.0, info.MeanTime)
	assert.Equal(t, 1.0, info.MinTime)
	assert.Equal(t, 100.0, info.MaxTime)
	assert.Equal(t, 2.5, info.StddevTime)
	assert.Equal(t, int64(10000), info.Rows)
	assert.NotNil(t, info.HitPercent)
	assert.Equal(t, 95.5, *info.HitPercent)
}

func TestErrorResponse_Structure(t *testing.T) {
	err := &ErrorResponse{
		Error:   "Database connection failed",
		Code:    "DB_CONNECTION_ERROR",
		Details: "Connection timeout after 30 seconds",
	}

	assert.Equal(t, "Database connection failed", err.Error)
	assert.Equal(t, "DB_CONNECTION_ERROR", err.Code)
	assert.Equal(t, "Connection timeout after 30 seconds", err.Details)
}

func TestHandler_Creation(t *testing.T) {
	mockDB := &database.DB{}
	handler := NewHandler(mockDB)

	assert.NotNil(t, handler)
	assert.NotNil(t, handler.db)
	assert.NotNil(t, handler.migrationMgr)
	assert.NotNil(t, handler.volumeRepo)
	assert.NotNil(t, handler.scanJobRepo)
}

func TestSlowQueryInfo_Performance(t *testing.T) {
	// Test query performance analysis
	tests := []struct {
		name         string
		query        SlowQueryInfo
		expectedPerf string
	}{
		{
			name: "fast query",
			query: SlowQueryInfo{
				Query:     "SELECT id FROM volumes LIMIT 1",
				Calls:     1000,
				MeanTime:  0.5,
				TotalTime: 500,
			},
			expectedPerf: "fast",
		},
		{
			name: "slow query",
			query: SlowQueryInfo{
				Query:     "SELECT * FROM volumes JOIN scan_jobs ON volumes.volume_id = scan_jobs.volume_id",
				Calls:     100,
				MeanTime:  50.0,
				TotalTime: 5000,
			},
			expectedPerf: "slow",
		},
		{
			name: "very slow query",
			query: SlowQueryInfo{
				Query:     "SELECT * FROM volumes WHERE mountpoint LIKE '%data%'",
				Calls:     50,
				MeanTime:  200.0,
				TotalTime: 10000,
			},
			expectedPerf: "very_slow",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Classify query performance based on mean time
			var performance string
			switch {
			case tt.query.MeanTime < 1.0:
				performance = "fast"
			case tt.query.MeanTime < 10.0:
				performance = "moderate"
			case tt.query.MeanTime < 100.0:
				performance = "slow"
			default:
				performance = "very_slow"
			}

			assert.Equal(t, tt.expectedPerf, performance)

			// Verify total time calculation
			expectedTotal := float64(tt.query.Calls) * tt.query.MeanTime
			assert.Equal(t, expectedTotal, tt.query.TotalTime)
		})
	}
}

func TestTableSizeInfo_Analysis(t *testing.T) {
	// Test table analysis scenarios
	tests := []struct {
		name           string
		info           TableSizeInfo
		expectedStatus string
	}{
		{
			name: "highly correlated column",
			info: TableSizeInfo{
				SchemaName:     "public",
				TableName:      "volumes",
				ColumnName:     "created_at",
				DistinctValues: &[]int64{1000}[0],
				Correlation:    &[]float64{0.95}[0],
			},
			expectedStatus: "high_correlation",
		},
		{
			name: "low correlation column",
			info: TableSizeInfo{
				SchemaName:     "public",
				TableName:      "volumes",
				ColumnName:     "volume_id",
				DistinctValues: &[]int64{10000}[0],
				Correlation:    &[]float64{0.1}[0],
			},
			expectedStatus: "low_correlation",
		},
		{
			name: "unique column",
			info: TableSizeInfo{
				SchemaName:     "public",
				TableName:      "volumes",
				ColumnName:     "id",
				DistinctValues: &[]int64{10000}[0],
				Correlation:    &[]float64{1.0}[0],
			},
			expectedStatus: "unique",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Analyze correlation status
			var status string
			if tt.info.Correlation != nil {
				switch {
				case *tt.info.Correlation >= 0.9:
					if *tt.info.Correlation == 1.0 {
						status = "unique"
					} else {
						status = "high_correlation"
					}
				case *tt.info.Correlation <= 0.3:
					status = "low_correlation"
				default:
					status = "moderate_correlation"
				}
			}

			assert.Equal(t, tt.expectedStatus, status)
			assert.NotNil(t, tt.info.Correlation)
			assert.NotNil(t, tt.info.DistinctValues)
		})
	}
}

// Benchmark tests
func BenchmarkConnectionTestResult_Creation(b *testing.B) {
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = &ConnectionTestResult{
			Success:            true,
			Message:            "Database connection is healthy",
			OpenConnections:    5,
			IdleConnections:    3,
			MaxOpenConnections: 25,
		}
	}
}

func BenchmarkDatabaseStats_Creation(b *testing.B) {
	volumeStats := &database.VolumeStats{TotalVolumes: 10}
	scanJobStats := &database.ScanJobStats{TotalJobs: 100}
	healthStatus := &database.HealthStatus{Status: "healthy"}
	migrationStatus := &database.MigrationStatus{TotalMigrations: 5}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = &DatabaseStats{
			VolumeStats:     volumeStats,
			ScanJobStats:    scanJobStats,
			DatabaseHealth:  healthStatus,
			MigrationStatus: migrationStatus,
		}
	}
}

func BenchmarkSlowQueryInfo_Analysis(b *testing.B) {
	query := &SlowQueryInfo{
		Query:      "SELECT * FROM volumes WHERE status = $1",
		Calls:      1000,
		TotalTime:  5000.0,
		MeanTime:   5.0,
		MinTime:    1.0,
		MaxTime:    100.0,
		StddevTime: 2.5,
		Rows:       10000,
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		// Simulate query analysis
		performanceScore := query.TotalTime / float64(query.Calls)
		_ = performanceScore > 10.0 // Slow query threshold
	}
}
