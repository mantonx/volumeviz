// Package database provides metrics storage and retrieval
package database

import (
	"context"
	"fmt"
	"time"
)

// VolumeMetricsRepository handles historical volume metrics data
type VolumeMetricsRepository struct {
	db *DB
}

// NewVolumeMetricsRepository creates a new metrics repository
func NewVolumeMetricsRepository(db *DB) *VolumeMetricsRepository {
	return &VolumeMetricsRepository{db: db}
}

// SaveMetrics saves volume scan results as historical metrics using a transaction
func (r *VolumeMetricsRepository) SaveMetrics(ctx context.Context, volumeID string, totalSize, fileCount, directoryCount int64, scanMethod string) error {
	// Start transaction
	tx, err := r.db.BeginTx()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer func() {
		if err != nil {
			if rollbackErr := tx.Rollback(); rollbackErr != nil {
				// Log rollback error in production
				fmt.Printf("Transaction rollback failed: %v (original error: %v)\n", rollbackErr, err)
			}
		}
	}()
	
	now := time.Now()
	
	// Calculate growth rate from previous metric (within transaction)
	growthRate, err := r.calculateGrowthRateInTx(ctx, tx, volumeID, totalSize)
	if err != nil {
		return fmt.Errorf("failed to calculate growth rate: %w", err)
	}
	
	// Count containers using this volume (within transaction)
	containerCount, err := r.getContainerCountInTx(ctx, tx, volumeID)
	if err != nil {
		return fmt.Errorf("failed to get container count: %w", err)
	}
	
	// Insert the metrics record
	query := `
		INSERT INTO volume_metrics (
			volume_id, metric_timestamp, total_size, file_count, directory_count,
			growth_rate, access_frequency, container_count, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT (volume_id, metric_timestamp) 
		DO UPDATE SET
			total_size = EXCLUDED.total_size,
			file_count = EXCLUDED.file_count,
			directory_count = EXCLUDED.directory_count,
			growth_rate = EXCLUDED.growth_rate,
			access_frequency = volume_metrics.access_frequency + 1,
			container_count = EXCLUDED.container_count,
			updated_at = EXCLUDED.updated_at
	`
	
	_, err = tx.ExecContext(ctx, query,
		volumeID,
		now,
		totalSize,
		fileCount,
		directoryCount,
		growthRate,
		1, // access_frequency (incremented each scan)
		containerCount,
		now,
		now,
	)
	if err != nil {
		return fmt.Errorf("failed to insert metrics: %w", err)
	}
	
	// Commit transaction
	if err = tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}
	
	return nil
}

// GetMetrics retrieves historical metrics for a volume
func (r *VolumeMetricsRepository) GetMetrics(ctx context.Context, volumeID string, startTime, endTime time.Time, limit int) ([]VolumeMetrics, error) {
	query := `
		SELECT id, created_at, updated_at, volume_id, metric_timestamp,
		       total_size, file_count, directory_count, growth_rate,
		       access_frequency, container_count
		FROM volume_metrics
		WHERE volume_id = ? AND metric_timestamp BETWEEN ? AND ?
		ORDER BY metric_timestamp DESC
		LIMIT ?
	`
	
	rows, err := r.db.QueryContext(ctx, query, volumeID, startTime, endTime, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	
	var metrics []VolumeMetrics
	for rows.Next() {
		var m VolumeMetrics
		var growthRate *float64
		
		err := rows.Scan(
			&m.ID,
			&m.CreatedAt,
			&m.UpdatedAt,
			&m.VolumeID,
			&m.MetricTimestamp,
			&m.TotalSize,
			&m.FileCount,
			&m.DirectoryCount,
			&growthRate,
			&m.AccessFrequency,
			&m.ContainerCount,
		)
		if err != nil {
			return nil, err
		}
		
		m.GrowthRate = growthRate
		metrics = append(metrics, m)
	}
	
	return metrics, rows.Err()
}

// GetTrends calculates growth trends for one or more volumes
func (r *VolumeMetricsRepository) GetTrends(ctx context.Context, volumeIDs []string, days int) (map[string]TrendData, error) {
	if len(volumeIDs) == 0 {
		return map[string]TrendData{}, nil
	}
	
	// Build query with IN clause for multiple volume IDs
	placeholders := ""
	args := make([]interface{}, 0, len(volumeIDs)+1)
	
	for i, id := range volumeIDs {
		if i > 0 {
			placeholders += ","
		}
		placeholders += "?"
		args = append(args, id)
	}
	args = append(args, time.Now().Add(-time.Duration(days)*24*time.Hour))
	
	query := `
		SELECT volume_id,
		       AVG(growth_rate) as avg_growth_rate,
		       MIN(total_size) as min_size,
		       MAX(total_size) as max_size,
		       COUNT(*) as data_points
		FROM volume_metrics
		WHERE volume_id IN (` + placeholders + `) AND metric_timestamp >= ?
		GROUP BY volume_id
	`
	
	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	
	trends := make(map[string]TrendData)
	for rows.Next() {
		var volumeID string
		var trend TrendData
		
		err := rows.Scan(
			&volumeID,
			&trend.AvgGrowthRate,
			&trend.MinSize,
			&trend.MaxSize,
			&trend.DataPoints,
		)
		if err != nil {
			return nil, err
		}
		
		// Calculate additional trend metrics
		trend.VolumeID = volumeID
		trend.GrowthTrend = r.classifyTrend(trend.AvgGrowthRate)
		trend.TotalGrowth = trend.MaxSize - trend.MinSize
		
		trends[volumeID] = trend
	}
	
	return trends, rows.Err()
}

// GetAllActiveVolumeIDs returns all volume IDs that have recent metrics
func (r *VolumeMetricsRepository) GetAllActiveVolumeIDs(ctx context.Context) ([]string, error) {
	query := `
		SELECT DISTINCT volume_id
		FROM volume_metrics
		WHERE metric_timestamp >= ?
		ORDER BY volume_id
	`
	
	// Consider volumes active if they have metrics in the last 7 days
	since := time.Now().Add(-7 * 24 * time.Hour)
	
	rows, err := r.db.QueryContext(ctx, query, since)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	
	var volumeIDs []string
	for rows.Next() {
		var volumeID string
		if err := rows.Scan(&volumeID); err != nil {
			return nil, err
		}
		volumeIDs = append(volumeIDs, volumeID)
	}
	
	return volumeIDs, rows.Err()
}

// Helper functions

// Transaction-aware helper functions

func (r *VolumeMetricsRepository) calculateGrowthRateInTx(ctx context.Context, tx *Tx, volumeID string, currentSize int64) (*float64, error) {
	// Get the previous metric to calculate growth rate
	query := `
		SELECT total_size, metric_timestamp
		FROM volume_metrics
		WHERE volume_id = ?
		ORDER BY metric_timestamp DESC
		LIMIT 1
	`
	
	var prevSize int64
	var prevTime time.Time
	
	err := tx.QueryRowContext(ctx, query, volumeID).Scan(&prevSize, &prevTime)
	if err != nil {
		// No previous data, return nil (this is not an error)
		return nil, nil
	}
	
	// Calculate growth rate in bytes per day
	timeDiff := time.Since(prevTime)
	if timeDiff.Hours() < 1 {
		// Too soon to calculate meaningful growth rate
		return nil, nil
	}
	
	sizeDiff := currentSize - prevSize
	daysElapsed := timeDiff.Hours() / 24
	growthRate := float64(sizeDiff) / daysElapsed
	
	return &growthRate, nil
}

func (r *VolumeMetricsRepository) getContainerCountInTx(ctx context.Context, tx *Tx, volumeID string) (int, error) {
	// Query container count using this volume
	query := `
		SELECT COUNT(DISTINCT container_id)
		FROM volume_mounts
		WHERE volume_id = ? AND is_active = true
	`
	
	var count int
	err := tx.QueryRowContext(ctx, query, volumeID).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("failed to query container count: %w", err)
	}
	
	return count, nil
}

// Legacy helper functions (for backwards compatibility)

func (r *VolumeMetricsRepository) calculateGrowthRate(ctx context.Context, volumeID string, currentSize int64) *float64 {
	// Get the previous metric to calculate growth rate
	query := `
		SELECT total_size, metric_timestamp
		FROM volume_metrics
		WHERE volume_id = ?
		ORDER BY metric_timestamp DESC
		LIMIT 1
	`
	
	var prevSize int64
	var prevTime time.Time
	
	err := r.db.QueryRowContext(ctx, query, volumeID).Scan(&prevSize, &prevTime)
	if err != nil {
		// No previous data, return nil
		return nil
	}
	
	// Calculate growth rate in bytes per day
	timeDiff := time.Since(prevTime)
	if timeDiff.Hours() < 1 {
		// Too soon to calculate meaningful growth rate
		return nil
	}
	
	sizeDiff := currentSize - prevSize
	daysElapsed := timeDiff.Hours() / 24
	growthRate := float64(sizeDiff) / daysElapsed
	
	return &growthRate
}

func (r *VolumeMetricsRepository) getContainerCount(ctx context.Context, volumeID string) int {
	// Query container count using this volume (simplified)
	query := `
		SELECT COUNT(DISTINCT container_id)
		FROM volume_mounts
		WHERE volume_id = ? AND is_active = true
	`
	
	var count int
	err := r.db.QueryRowContext(ctx, query, volumeID).Scan(&count)
	if err != nil {
		return 0
	}
	
	return count
}

func (r *VolumeMetricsRepository) classifyTrend(avgGrowthRate *float64) string {
	if avgGrowthRate == nil {
		return "unknown"
	}
	
	rate := *avgGrowthRate
	
	if rate > 50*1024*1024 { // > 50MB per day
		return "rapidly_increasing"
	} else if rate > 10*1024*1024 { // > 10MB per day
		return "increasing"
	} else if rate > -10*1024*1024 && rate < 10*1024*1024 { // -10MB to +10MB per day
		return "stable"
	} else if rate < -50*1024*1024 { // < -50MB per day
		return "rapidly_decreasing"
	} else {
		return "decreasing"
	}
}

// TrendData represents calculated trend information
type TrendData struct {
	VolumeID      string   `json:"volume_id"`
	AvgGrowthRate *float64 `json:"avg_growth_rate"`
	MinSize       int64    `json:"min_size"`
	MaxSize       int64    `json:"max_size"`
	TotalGrowth   int64    `json:"total_growth"`
	DataPoints    int      `json:"data_points"`
	GrowthTrend   string   `json:"growth_trend"`
}