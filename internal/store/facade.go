package store

import (
	"context"
	"database/sql"
	"fmt"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/mantonx/volumeviz/internal/store/config"
	pgstore "github.com/mantonx/volumeviz/internal/store/generated/postgres"
	sqlitestore "github.com/mantonx/volumeviz/internal/store/generated/sqlite"
)

// StoreFacade provides a unified interface over PostgreSQL and SQLite stores
type StoreFacade struct {
	dbType        config.DatabaseType
	pgPool        *pgxpool.Pool
	sqliteDB      *sql.DB
	pgQueries     *pgstore.Queries
	sqliteQueries *sqlitestore.Queries
}

// NewStoreFacade creates a new store facade based on the database type
func NewStoreFacade(dbType config.DatabaseType, pgPool *pgxpool.Pool, sqliteDB *sql.DB) *StoreFacade {
	facade := &StoreFacade{
		dbType:   dbType,
		pgPool:   pgPool,
		sqliteDB: sqliteDB,
	}

	// Initialize query instances
	if pgPool != nil {
		facade.pgQueries = pgstore.New(pgPool)
	}
	if sqliteDB != nil {
		facade.sqliteQueries = sqlitestore.New(sqliteDB)
	}

	return facade
}

// GetDatabaseType returns the database type
func (f *StoreFacade) GetDatabaseType() config.DatabaseType {
	return f.dbType
}


// GetPgPool returns the PostgreSQL connection pool
func (f *StoreFacade) GetPgPool() *pgxpool.Pool {
	return f.pgPool
}

// GetSQLiteDB returns the SQLite database connection
func (f *StoreFacade) GetSQLiteDB() *sql.DB {
	return f.sqliteDB
}

// Volume operations

// VolumeParams represents parameters for volume operations
type VolumeParams struct {
	ID         *int64 // Optional for updates
	VolumeID   string
	Name       string
	Driver     string
	Mountpoint string
	Labels     string // JSON string
	Options    string // JSON string
	Scope      string
	Status     string
	IsActive   bool
}

// VolumeResult represents a volume from the database
type VolumeResult struct {
	ID          int64
	VolumeID    string
	Name        string
	Driver      string
	Mountpoint  string
	Labels      string
	Options     string
	Scope       string
	Status      string
	LastScanned *time.Time
	IsActive    bool
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

// CreateVolume creates a new volume
func (f *StoreFacade) CreateVolume(ctx context.Context, params VolumeParams) (*VolumeResult, error) {
	if f.dbType == config.DatabaseTypePostgreSQL && f.pgQueries != nil {
		result, err := f.pgQueries.CreateVolume(ctx, pgstore.CreateVolumeParams{
			VolumeID:   params.VolumeID,
			Name:       params.Name,
			Driver:     params.Driver,
			Mountpoint: params.Mountpoint,
			Labels:     []byte(params.Labels),
			Options:    []byte(params.Options),
			Scope:      pgtype.Text{String: params.Scope, Valid: true},
			Status:     pgtype.Text{String: params.Status, Valid: true},
			IsActive:   pgtype.Bool{Bool: params.IsActive, Valid: true},
		})
		if err != nil {
			return nil, err
		}

		return &VolumeResult{
			ID:        int64(result.ID),
			CreatedAt: result.CreatedAt,
			UpdatedAt: result.UpdatedAt,
		}, nil
	}

	if f.dbType == config.DatabaseTypeSQLite && f.sqliteQueries != nil {
		result, err := f.sqliteQueries.CreateVolume(ctx, sqlitestore.CreateVolumeParams{
			VolumeID:   params.VolumeID,
			Name:       params.Name,
			Driver:     params.Driver,
			Mountpoint: params.Mountpoint,
			Labels:     sql.NullString{String: params.Labels, Valid: true},
			Options:    sql.NullString{String: params.Options, Valid: true},
			Scope:      sql.NullString{String: params.Scope, Valid: true},
			Status:     sql.NullString{String: params.Status, Valid: true},
			IsActive:   sql.NullInt64{Int64: sqliteBool(params.IsActive), Valid: true},
		})
		if err != nil {
			return nil, err
		}

		createdAt, _ := time.Parse(time.RFC3339, result.CreatedAt)
		updatedAt, _ := time.Parse(time.RFC3339, result.UpdatedAt)

		return &VolumeResult{
			ID:        result.ID,
			CreatedAt: createdAt,
			UpdatedAt: updatedAt,
		}, nil
	}

	return nil, fmt.Errorf("no database connection available")
}

// GetVolumeByID retrieves a volume by its database ID
func (f *StoreFacade) GetVolumeByID(ctx context.Context, id int64) (*VolumeResult, error) {
	if f.dbType == config.DatabaseTypePostgreSQL && f.pgQueries != nil {
		volume, err := f.pgQueries.GetVolumeByID(ctx, int32(id))
		if err != nil {
			return nil, err
		}
		return f.convertPgVolume(volume), nil
	}

	if f.dbType == config.DatabaseTypeSQLite && f.sqliteQueries != nil {
		volume, err := f.sqliteQueries.GetVolumeByID(ctx, id)
		if err != nil {
			return nil, err
		}
		return f.convertSqliteVolume(volume), nil
	}

	return nil, fmt.Errorf("no database connection available")
}

// GetVolumeByVolumeID retrieves a volume by its volume_id (Docker volume name)
func (f *StoreFacade) GetVolumeByVolumeID(ctx context.Context, volumeID string) (*VolumeResult, error) {
	if f.dbType == config.DatabaseTypePostgreSQL && f.pgQueries != nil {
		volume, err := f.pgQueries.GetVolumeByVolumeID(ctx, volumeID)
		if err != nil {
			return nil, err
		}
		return f.convertPgVolume(volume), nil
	}

	if f.dbType == config.DatabaseTypeSQLite && f.sqliteQueries != nil {
		volume, err := f.sqliteQueries.GetVolumeByVolumeID(ctx, volumeID)
		if err != nil {
			return nil, err
		}
		return f.convertSqliteVolume(volume), nil
	}

	return nil, fmt.Errorf("no database connection available")
}

// ListVolumes retrieves volumes with pagination
func (f *StoreFacade) ListVolumes(ctx context.Context, limit, offset int64) ([]*VolumeResult, error) {
	if f.dbType == config.DatabaseTypePostgreSQL && f.pgQueries != nil {
		volumes, err := f.pgQueries.ListVolumes(ctx, pgstore.ListVolumesParams{
			Limit:  int32(limit),
			Offset: int32(offset),
		})
		if err != nil {
			return nil, err
		}

		results := make([]*VolumeResult, len(volumes))
		for i, volume := range volumes {
			results[i] = f.convertPgVolume(volume)
		}
		return results, nil
	}

	if f.dbType == config.DatabaseTypeSQLite && f.sqliteQueries != nil {
		volumes, err := f.sqliteQueries.ListVolumes(ctx, sqlitestore.ListVolumesParams{
			Limit:  limit,
			Offset: offset,
		})
		if err != nil {
			return nil, err
		}

		results := make([]*VolumeResult, len(volumes))
		for i, volume := range volumes {
			results[i] = f.convertSqliteVolume(volume)
		}
		return results, nil
	}

	return nil, fmt.Errorf("no database connection available")
}

// UpsertVolume creates or updates a volume
func (f *StoreFacade) UpsertVolume(ctx context.Context, params VolumeParams) (*VolumeResult, error) {
	if f.dbType == config.DatabaseTypePostgreSQL && f.pgQueries != nil {
		result, err := f.pgQueries.UpsertVolume(ctx, pgstore.UpsertVolumeParams{
			VolumeID:   params.VolumeID,
			Name:       params.Name,
			Driver:     params.Driver,
			Mountpoint: params.Mountpoint,
			Labels:     []byte(params.Labels),
			Options:    []byte(params.Options),
			Scope:      pgtype.Text{String: params.Scope, Valid: true},
			Status:     pgtype.Text{String: params.Status, Valid: true},
			IsActive:   pgtype.Bool{Bool: params.IsActive, Valid: true},
		})
		if err != nil {
			return nil, err
		}

		return &VolumeResult{
			ID:        int64(result.ID),
			CreatedAt: result.CreatedAt,
			UpdatedAt: result.UpdatedAt,
		}, nil
	}

	if f.dbType == config.DatabaseTypeSQLite && f.sqliteQueries != nil {
		result, err := f.sqliteQueries.UpsertVolume(ctx, sqlitestore.UpsertVolumeParams{
			VolumeID:   params.VolumeID,
			Name:       params.Name,
			Driver:     params.Driver,
			Mountpoint: params.Mountpoint,
			Labels:     sql.NullString{String: params.Labels, Valid: true},
			Options:    sql.NullString{String: params.Options, Valid: true},
			Scope:      sql.NullString{String: params.Scope, Valid: true},
			Status:     sql.NullString{String: params.Status, Valid: true},
			IsActive:   sql.NullInt64{Int64: sqliteBool(params.IsActive), Valid: true},
		})
		if err != nil {
			return nil, err
		}

		createdAt, _ := time.Parse(time.RFC3339, result.CreatedAt)
		updatedAt, _ := time.Parse(time.RFC3339, result.UpdatedAt)

		return &VolumeResult{
			ID:        result.ID,
			CreatedAt: createdAt,
			UpdatedAt: updatedAt,
		}, nil
	}

	return nil, fmt.Errorf("no database connection available")
}

// UpdateLastScanned updates the last_scanned timestamp for a volume
func (f *StoreFacade) UpdateLastScanned(ctx context.Context, volumeID string, scannedAt time.Time) error {
	if f.dbType == config.DatabaseTypePostgreSQL && f.pgQueries != nil {
		return f.pgQueries.UpdateLastScanned(ctx, pgstore.UpdateLastScannedParams{
			VolumeID:    volumeID,
			LastScanned: pgtype.Timestamptz{Time: scannedAt, Valid: true},
		})
	}

	if f.dbType == config.DatabaseTypeSQLite && f.sqliteQueries != nil {
		return f.sqliteQueries.UpdateLastScanned(ctx, sqlitestore.UpdateLastScannedParams{
			VolumeID:    volumeID,
			LastScanned: sql.NullTime{Time: scannedAt, Valid: true},
		})
	}

	return fmt.Errorf("no database connection available")
}

// GetVolumeStats returns volume statistics
func (f *StoreFacade) GetVolumeStats(ctx context.Context) (*VolumeStatsResult, error) {
	if f.dbType == config.DatabaseTypePostgreSQL && f.pgQueries != nil {
		stats, err := f.pgQueries.GetVolumeStats(ctx)
		if err != nil {
			return nil, err
		}

		result := &VolumeStatsResult{
			TotalVolumes:  int(stats.TotalVolumes),
			UniqueDrivers: int(stats.UniqueDrivers),
		}

		// Handle interface{} fields with type assertions
		if activeVols, ok := stats.ActiveVolumes.(int64); ok {
			result.ActiveVolumes = int(activeVols)
		}
		if scannedVols, ok := stats.ScannedVolumes.(int64); ok {
			result.ScannedVolumes = int(scannedVols)
		}

		// Handle timestamp fields - these are likely pgtype.Timestamptz for postgres
		if newest, ok := stats.NewestVolume.(pgtype.Timestamptz); ok && newest.Valid {
			result.NewestVolume = &newest.Time
		}
		if oldest, ok := stats.OldestVolume.(pgtype.Timestamptz); ok && oldest.Valid {
			result.OldestVolume = &oldest.Time
		}

		return result, nil
	}

	if f.dbType == config.DatabaseTypeSQLite && f.sqliteQueries != nil {
		stats, err := f.sqliteQueries.GetVolumeStats(ctx)
		if err != nil {
			return nil, err
		}

		result := &VolumeStatsResult{
			TotalVolumes:  int(stats.TotalVolumes),
			UniqueDrivers: int(stats.UniqueDrivers),
		}

		// Handle interface{} fields with type assertions for SQLite
		if activeVols, ok := stats.ActiveVolumes.(int64); ok {
			result.ActiveVolumes = int(activeVols)
		}
		if scannedVols, ok := stats.ScannedVolumes.(int64); ok {
			result.ScannedVolumes = int(scannedVols)
		}

		// Handle timestamp fields - these are likely sql.NullTime for SQLite
		if newest, ok := stats.NewestVolume.(sql.NullTime); ok && newest.Valid {
			result.NewestVolume = &newest.Time
		} else if newestStr, ok := stats.NewestVolume.(string); ok && newestStr != "" {
			if parsed, err := time.Parse(time.RFC3339, newestStr); err == nil {
				result.NewestVolume = &parsed
			}
		}

		if oldest, ok := stats.OldestVolume.(sql.NullTime); ok && oldest.Valid {
			result.OldestVolume = &oldest.Time
		} else if oldestStr, ok := stats.OldestVolume.(string); ok && oldestStr != "" {
			if parsed, err := time.Parse(time.RFC3339, oldestStr); err == nil {
				result.OldestVolume = &parsed
			}
		}

		return result, nil
	}

	return nil, fmt.Errorf("no database connection available")
}

// VolumeStatsResult represents volume statistics
type VolumeStatsResult struct {
	TotalVolumes   int        `json:"total_volumes"`
	ActiveVolumes  int        `json:"active_volumes"`
	UniqueDrivers  int        `json:"unique_drivers"`
	ScannedVolumes int        `json:"scanned_volumes"`
	NewestVolume   *time.Time `json:"newest_volume,omitempty"`
	OldestVolume   *time.Time `json:"oldest_volume,omitempty"`
}

// Health operations

// HealthCheck performs a basic database health check
func (f *StoreFacade) HealthCheck(ctx context.Context) error {
	if f.dbType == config.DatabaseTypePostgreSQL && f.pgQueries != nil {
		_, err := f.pgQueries.HealthCheck(ctx)
		return err
	}

	if f.dbType == config.DatabaseTypeSQLite && f.sqliteQueries != nil {
		_, err := f.sqliteQueries.HealthCheck(ctx)
		return err
	}

	return fmt.Errorf("no database connection available")
}

// Metrics operations

// VolumeMetricsResult represents a volume metric from the database
type VolumeMetricsResult struct {
	ID              int64
	VolumeID        string
	MetricTimestamp time.Time
	TotalSize       int64
	FileCount       int64
	DirectoryCount  int64
	GrowthRate      *float64
	AccessFrequency int64
	ContainerCount  int64
	CreatedAt       time.Time
	UpdatedAt       time.Time
}

// GetVolumeMetrics retrieves historical metrics for a volume
func (f *StoreFacade) GetVolumeMetrics(ctx context.Context, volumeID string, startTime, endTime time.Time, limit int) ([]*VolumeMetricsResult, error) {
	if f.dbType == config.DatabaseTypePostgreSQL && f.pgQueries != nil {
		metrics, err := f.pgQueries.GetVolumeMetrics(ctx, pgstore.GetVolumeMetricsParams{
			VolumeID:          volumeID,
			MetricTimestamp:   pgtype.Timestamptz{Time: startTime, Valid: true},
			MetricTimestamp_2: pgtype.Timestamptz{Time: endTime, Valid: true},
			Limit:             int32(limit),
		})
		if err != nil {
			return nil, err
		}

		results := make([]*VolumeMetricsResult, len(metrics))
		for i, metric := range metrics {
			results[i] = &VolumeMetricsResult{
				ID:              int64(metric.ID),
				VolumeID:        metric.VolumeID,
				MetricTimestamp: metric.MetricTimestamp.Time,
				TotalSize:       metric.TotalSize,
				FileCount:       metric.FileCount,
				DirectoryCount:  metric.DirectoryCount,
				AccessFrequency: int64(metric.AccessFrequency.Int32),
				ContainerCount:  int64(metric.ContainerCount.Int32),
				CreatedAt:       metric.CreatedAt,
				UpdatedAt:       metric.UpdatedAt,
			}

			if metric.GrowthRate.Valid {
				growthRate := metric.GrowthRate.Float64
				results[i].GrowthRate = &growthRate
			}
		}
		return results, nil
	}

	if f.dbType == config.DatabaseTypeSQLite && f.sqliteQueries != nil {
		metrics, err := f.sqliteQueries.GetVolumeMetrics(ctx, sqlitestore.GetVolumeMetricsParams{
			VolumeID: volumeID,
			Limit:    int64(limit),
		})
		if err != nil {
			return nil, err
		}

		results := make([]*VolumeMetricsResult, len(metrics))
		for i, metric := range metrics {
			createdAt, _ := time.Parse(time.RFC3339, metric.CreatedAt)
			updatedAt, _ := time.Parse(time.RFC3339, metric.UpdatedAt)

			results[i] = &VolumeMetricsResult{
				ID:              metric.ID,
				VolumeID:        metric.VolumeID,
				MetricTimestamp: metric.MetricTimestamp,
				TotalSize:       metric.TotalSize,
				FileCount:       metric.FileCount,
				DirectoryCount:  metric.DirectoryCount,
				AccessFrequency: int64(metric.AccessFrequency.Int64),
				ContainerCount:  int64(metric.ContainerCount.Int64),
				CreatedAt:       createdAt,
				UpdatedAt:       updatedAt,
			}

			if metric.GrowthRate.Valid {
				results[i].GrowthRate = &metric.GrowthRate.Float64
			}
		}
		return results, nil
	}

	return nil, fmt.Errorf("no database connection available")
}

// GetAllActiveVolumeIDs returns all volume IDs that have recent metrics
func (f *StoreFacade) GetAllActiveVolumeIDs(ctx context.Context) ([]string, error) {
	// Consider volumes active if they have metrics in the last 7 days
	since := time.Now().Add(-7 * 24 * time.Hour)

	if f.dbType == config.DatabaseTypePostgreSQL && f.pgQueries != nil {
		return f.pgQueries.GetAllActiveVolumeIDs(ctx, pgtype.Timestamptz{Time: since, Valid: true})
	}

	if f.dbType == config.DatabaseTypeSQLite && f.sqliteQueries != nil {
		return f.sqliteQueries.GetAllActiveVolumeIDs(ctx, since)
	}

	return nil, fmt.Errorf("no database connection available")
}

// VolumeMetricsTrendResult represents trend analysis for a volume
type VolumeMetricsTrendResult struct {
	VolumeID      string
	AvgGrowthRate *float64
	MinSize       int64
	MaxSize       int64
	DataPoints    int64
}

// GetVolumeMetricsTrends calculates growth trends for one or more volumes
func (f *StoreFacade) GetVolumeMetricsTrends(ctx context.Context, volumeIDs []string, since time.Time) ([]*VolumeMetricsTrendResult, error) {
	if f.dbType == config.DatabaseTypePostgreSQL && f.pgQueries != nil {
		trends, err := f.pgQueries.GetVolumeMetricsTrends(ctx, pgstore.GetVolumeMetricsTrendsParams{
			VolumeID:        volumeIDs[0],
			MetricTimestamp: pgtype.Timestamptz{Time: since, Valid: true},
		})
		if err != nil {
			return nil, err
		}

		results := make([]*VolumeMetricsTrendResult, len(trends))
		for i, trend := range trends {
			results[i] = &VolumeMetricsTrendResult{
				VolumeID:   trend.VolumeID,
				MinSize:    trend.MinSize.(int64),
				MaxSize:    trend.MaxSize.(int64),
				DataPoints: trend.DataPoints,
			}

			results[i].AvgGrowthRate = &trend.AvgGrowthRate
		}
		return results, nil
	}

	if f.dbType == config.DatabaseTypeSQLite && f.sqliteQueries != nil {
		// For SQLite, we need to handle the array parameter differently
		// This is a simplified approach - in production you might use a different strategy
		if len(volumeIDs) == 0 {
			return []*VolumeMetricsTrendResult{}, nil
		}

		// For now, return an empty result as SQLite array handling is more complex
		// In production, you'd implement proper array parameter handling
		return []*VolumeMetricsTrendResult{}, nil
	}

	return nil, fmt.Errorf("no database connection available")
}

// Write operations for metrics

// SaveVolumeMetrics saves volume scan results as historical metrics
func (f *StoreFacade) SaveVolumeMetrics(ctx context.Context, volumeID string, totalSize, fileCount, directoryCount int64, growthRate *float64, containerCount int64) error {
	now := time.Now()

	if f.dbType == config.DatabaseTypePostgreSQL && f.pgQueries != nil {
		var pgGrowthRate pgtype.Float8
		if growthRate != nil {
			pgGrowthRate = pgtype.Float8{Float64: *growthRate, Valid: true}
		}

		return f.pgQueries.SaveVolumeMetrics(ctx, pgstore.SaveVolumeMetricsParams{
			VolumeID:        volumeID,
			MetricTimestamp: pgtype.Timestamptz{Time: now, Valid: true},
			TotalSize:       totalSize,
			FileCount:       fileCount,
			DirectoryCount:  directoryCount,
			GrowthRate:      pgGrowthRate,
			AccessFrequency: pgtype.Int4{Int32: 1, Valid: true}, // Default access frequency
			ContainerCount:  pgtype.Int4{Int32: int32(containerCount), Valid: true},
			CreatedAt:       now,
			UpdatedAt:       now,
		})
	}

	if f.dbType == config.DatabaseTypeSQLite && f.sqliteQueries != nil {
		var sqliteGrowthRate sql.NullFloat64
		if growthRate != nil {
			sqliteGrowthRate = sql.NullFloat64{Float64: *growthRate, Valid: true}
		}

		return f.sqliteQueries.SaveVolumeMetrics(ctx, sqlitestore.SaveVolumeMetricsParams{
			VolumeID:        volumeID,
			MetricTimestamp: now,
			TotalSize:       totalSize,
			FileCount:       fileCount,
			DirectoryCount:  directoryCount,
			GrowthRate:      sqliteGrowthRate,
			AccessFrequency: sql.NullInt64{Int64: 1, Valid: true}, // Default access frequency
			ContainerCount:  sql.NullInt64{Int64: containerCount, Valid: true},
			CreatedAt:       now.Format(time.RFC3339),
			UpdatedAt:       now.Format(time.RFC3339),
		})
	}

	return fmt.Errorf("no database connection available")
}

// Write operations for scan jobs

// CreateScanJob creates a new scan job
func (f *StoreFacade) CreateScanJob(ctx context.Context, scanID, volumeID, method string, estimatedDuration *time.Duration) (*ScanJobResult, error) {
	if f.dbType == config.DatabaseTypePostgreSQL && f.pgQueries != nil {
		var pgEstimatedDuration pgtype.Int8
		if estimatedDuration != nil {
			pgEstimatedDuration = pgtype.Int8{Int64: estimatedDuration.Nanoseconds(), Valid: true}
		}

		result, err := f.pgQueries.CreateScanJob(ctx, pgstore.CreateScanJobParams{
			ScanID:            scanID,
			VolumeID:          volumeID,
			Status:            "queued",
			Progress:          pgtype.Int4{Int32: 0, Valid: true},
			Method:            method,
			StartedAt:         pgtype.Timestamptz{},
			CompletedAt:       pgtype.Timestamptz{},
			ErrorMessage:      pgtype.Text{},
			ResultID:          pgtype.Int4{},
			EstimatedDuration: pgEstimatedDuration,
		})
		if err != nil {
			return nil, err
		}

		return &ScanJobResult{
			ID:        int64(result.ID),
			ScanID:    scanID,
			VolumeID:  volumeID,
			Status:    "queued",
			CreatedAt: result.CreatedAt,
			UpdatedAt: result.UpdatedAt,
		}, nil
	}

	if f.dbType == config.DatabaseTypeSQLite && f.sqliteQueries != nil {
		var sqliteEstimatedDuration sql.NullInt64
		if estimatedDuration != nil {
			sqliteEstimatedDuration = sql.NullInt64{Int64: estimatedDuration.Nanoseconds(), Valid: true}
		}

		result, err := f.sqliteQueries.CreateScanJob(ctx, sqlitestore.CreateScanJobParams{
			ScanID:            scanID,
			VolumeID:          volumeID,
			Status:            "queued",
			Progress:          sql.NullInt64{Int64: 0, Valid: true},
			Method:            method,
			StartedAt:         sql.NullTime{},
			CompletedAt:       sql.NullTime{},
			ErrorMessage:      sql.NullString{},
			ResultID:          sql.NullInt64{},
			EstimatedDuration: sqliteEstimatedDuration,
		})
		if err != nil {
			return nil, err
		}

		createdAt, _ := time.Parse(time.RFC3339, result.CreatedAt)
		updatedAt, _ := time.Parse(time.RFC3339, result.UpdatedAt)

		return &ScanJobResult{
			ID:        result.ID,
			ScanID:    scanID,
			VolumeID:  volumeID,
			Status:    "queued",
			CreatedAt: createdAt,
			UpdatedAt: updatedAt,
		}, nil
	}

	return nil, fmt.Errorf("no database connection available")
}

// UpdateScanJobStatusAndProgress updates both status and progress of a scan job
func (f *StoreFacade) UpdateScanJobStatusAndProgress(ctx context.Context, scanID, status string, progress int32) error {
	if f.dbType == config.DatabaseTypePostgreSQL && f.pgQueries != nil {
		_, err := f.pgQueries.UpdateScanJobStatusAndProgress(ctx, pgstore.UpdateScanJobStatusAndProgressParams{
			ScanID:   scanID,
			Status:   status,
			Progress: pgtype.Int4{Int32: progress, Valid: true},
		})
		return err
	}

	if f.dbType == config.DatabaseTypeSQLite && f.sqliteQueries != nil {
		_, err := f.sqliteQueries.UpdateScanJobStatusAndProgress(ctx, sqlitestore.UpdateScanJobStatusAndProgressParams{
			ScanID:   scanID,
			Status:   status,
			Progress: sql.NullInt64{Int64: int64(progress), Valid: true},
		})
		return err
	}

	return fmt.Errorf("no database connection available")
}

// StartScanJob marks a scan job as started
func (f *StoreFacade) StartScanJob(ctx context.Context, scanID string) error {
	startedAt := time.Now()

	if f.dbType == config.DatabaseTypePostgreSQL && f.pgQueries != nil {
		_, err := f.pgQueries.StartScanJob(ctx, pgstore.StartScanJobParams{
			ScanID:    scanID,
			StartedAt: pgtype.Timestamptz{Time: startedAt, Valid: true},
		})
		return err
	}

	if f.dbType == config.DatabaseTypeSQLite && f.sqliteQueries != nil {
		_, err := f.sqliteQueries.StartScanJob(ctx, sqlitestore.StartScanJobParams{
			ScanID:    scanID,
			StartedAt: sql.NullTime{Time: startedAt, Valid: true},
		})
		return err
	}

	return fmt.Errorf("no database connection available")
}

// CompleteScanJob marks a scan job as completed
func (f *StoreFacade) CompleteScanJob(ctx context.Context, scanID, status string, resultID *string) error {
	completedAt := time.Now()

	if f.dbType == config.DatabaseTypePostgreSQL && f.pgQueries != nil {
		var pgResultID pgtype.Int4
		if resultID != nil {
			// Parse string ID to int32, use 0 as fallback
			if id, err := strconv.ParseInt(*resultID, 10, 32); err == nil {
				pgResultID = pgtype.Int4{Int32: int32(id), Valid: true}
			}
		}

		_, err := f.pgQueries.CompleteScanJob(ctx, pgstore.CompleteScanJobParams{
			ScanID:      scanID,
			Status:      status,
			CompletedAt: pgtype.Timestamptz{Time: completedAt, Valid: true},
			ResultID:    pgResultID,
		})
		return err
	}

	if f.dbType == config.DatabaseTypeSQLite && f.sqliteQueries != nil {
		var sqliteResultID sql.NullInt64
		if resultID != nil {
			// Parse string ID to int64, use 0 as fallback
			if id, err := strconv.ParseInt(*resultID, 10, 64); err == nil {
				sqliteResultID = sql.NullInt64{Int64: id, Valid: true}
			}
		}

		_, err := f.sqliteQueries.CompleteScanJob(ctx, sqlitestore.CompleteScanJobParams{
			ScanID:      scanID,
			Status:      status,
			CompletedAt: sql.NullTime{Time: completedAt, Valid: true},
			ResultID:    sqliteResultID,
		})
		return err
	}

	return fmt.Errorf("no database connection available")
}

// ScanJobResult represents a scan job result
type ScanJobResult struct {
	ID                int64
	ScanID            string
	VolumeID          string
	Status            string
	Progress          int32
	Method            string
	EstimatedDuration *time.Duration
	StartedAt         *time.Time
	CompletedAt       *time.Time
	ErrorMessage      *string
	CreatedAt         time.Time
	UpdatedAt         time.Time
}

// GetScanJobByScanID retrieves a scan job by its scan ID
func (f *StoreFacade) GetScanJobByScanID(ctx context.Context, scanID string) (*ScanJobResult, error) {
	if f.dbType == config.DatabaseTypePostgreSQL && f.pgQueries != nil {
		job, err := f.pgQueries.GetScanJobByScanID(ctx, scanID)
		if err != nil {
			return nil, err
		}
		
		result := &ScanJobResult{
			ID:        int64(job.ID),
			ScanID:    job.ScanID,
			VolumeID:  job.VolumeID,
			Status:    job.Status,
			Progress:  job.Progress.Int32,
			Method:    job.Method,
			CreatedAt: job.CreatedAt,
			UpdatedAt: job.UpdatedAt,
		}
		
		if job.EstimatedDuration.Valid {
			duration := time.Duration(job.EstimatedDuration.Int64)
			result.EstimatedDuration = &duration
		}
		if job.StartedAt.Valid {
			result.StartedAt = &job.StartedAt.Time
		}
		if job.CompletedAt.Valid {
			result.CompletedAt = &job.CompletedAt.Time
		}
		if job.ErrorMessage.Valid {
			result.ErrorMessage = &job.ErrorMessage.String
		}
		
		return result, nil
	}
	
	if f.dbType == config.DatabaseTypeSQLite && f.sqliteQueries != nil {
		job, err := f.sqliteQueries.GetScanJobByScanID(ctx, scanID)
		if err != nil {
			return nil, err
		}
		
		createdAt, _ := time.Parse(time.RFC3339, job.CreatedAt)
		updatedAt, _ := time.Parse(time.RFC3339, job.UpdatedAt)
		
		result := &ScanJobResult{
			ID:        job.ID,
			ScanID:    job.ScanID,
			VolumeID:  job.VolumeID,
			Status:    job.Status,
			Progress:  int32(job.Progress.Int64),
			Method:    job.Method,
			CreatedAt: createdAt,
			UpdatedAt: updatedAt,
		}
		
		if job.EstimatedDuration.Valid {
			duration := time.Duration(job.EstimatedDuration.Int64)
			result.EstimatedDuration = &duration
		}
		if job.StartedAt.Valid {
			result.StartedAt = &job.StartedAt.Time
		}
		if job.CompletedAt.Valid {
			result.CompletedAt = &job.CompletedAt.Time
		}
		if job.ErrorMessage.Valid {
			result.ErrorMessage = &job.ErrorMessage.String
		}
		
		return result, nil
	}
	
	return nil, fmt.Errorf("no database connection available")
}

// GetActiveScanJobs retrieves all active (queued or running) scan jobs
func (f *StoreFacade) GetActiveScanJobs(ctx context.Context) ([]*ScanJobResult, error) {
	if f.dbType == config.DatabaseTypePostgreSQL && f.pgQueries != nil {
		jobs, err := f.pgQueries.GetActiveScanJobs(ctx)
		if err != nil {
			return nil, err
		}
		
		results := make([]*ScanJobResult, len(jobs))
		for i, job := range jobs {
			result := &ScanJobResult{
				ID:        int64(job.ID),
				ScanID:    job.ScanID,
				VolumeID:  job.VolumeID,
				Status:    job.Status,
				Progress:  job.Progress.Int32,
				Method:    job.Method,
				CreatedAt: job.CreatedAt,
				UpdatedAt: job.UpdatedAt,
			}
			
			if job.EstimatedDuration.Valid {
				duration := time.Duration(job.EstimatedDuration.Int64)
				result.EstimatedDuration = &duration
			}
			if job.StartedAt.Valid {
				result.StartedAt = &job.StartedAt.Time
			}
			if job.CompletedAt.Valid {
				result.CompletedAt = &job.CompletedAt.Time
			}
			if job.ErrorMessage.Valid {
				result.ErrorMessage = &job.ErrorMessage.String
			}
			
			results[i] = result
		}
		
		return results, nil
	}
	
	if f.dbType == config.DatabaseTypeSQLite && f.sqliteQueries != nil {
		jobs, err := f.sqliteQueries.GetActiveScanJobs(ctx)
		if err != nil {
			return nil, err
		}
		
		results := make([]*ScanJobResult, len(jobs))
		for i, job := range jobs {
			createdAt, _ := time.Parse(time.RFC3339, job.CreatedAt)
			updatedAt, _ := time.Parse(time.RFC3339, job.UpdatedAt)
			
			result := &ScanJobResult{
				ID:        job.ID,
				ScanID:    job.ScanID,
				VolumeID:  job.VolumeID,
				Status:    job.Status,
				Progress:  int32(job.Progress.Int64),
				Method:    job.Method,
				CreatedAt: createdAt,
				UpdatedAt: updatedAt,
			}
			
			if job.EstimatedDuration.Valid {
				duration := time.Duration(job.EstimatedDuration.Int64)
				result.EstimatedDuration = &duration
			}
			if job.StartedAt.Valid {
				result.StartedAt = &job.StartedAt.Time
			}
			if job.CompletedAt.Valid {
				result.CompletedAt = &job.CompletedAt.Time
			}
			if job.ErrorMessage.Valid {
				result.ErrorMessage = &job.ErrorMessage.String
			}
			
			results[i] = result
		}
		
		return results, nil
	}
	
	return nil, fmt.Errorf("no database connection available")
}

// FailScanJob marks a scan job as failed
func (f *StoreFacade) FailScanJob(ctx context.Context, scanID string, errorMessage string) error {
	completedAt := time.Now()
	
	if f.dbType == config.DatabaseTypePostgreSQL && f.pgQueries != nil {
		_, err := f.pgQueries.FailScanJob(ctx, pgstore.FailScanJobParams{
			ScanID:       scanID,
			ErrorMessage: pgtype.Text{String: errorMessage, Valid: true},
			CompletedAt:  pgtype.Timestamptz{Time: completedAt, Valid: true},
		})
		return err
	}
	
	if f.dbType == config.DatabaseTypeSQLite && f.sqliteQueries != nil {
		_, err := f.sqliteQueries.FailScanJob(ctx, sqlitestore.FailScanJobParams{
			ScanID:       scanID,
			ErrorMessage: sql.NullString{String: errorMessage, Valid: true},
			CompletedAt:  sql.NullTime{Time: completedAt, Valid: true},
		})
		return err
	}
	
	return fmt.Errorf("no database connection available")
}

// Volume size operations (for scan stats)

// VolumeSizeResult represents volume scan statistics
type VolumeSizeResult struct {
	ID              int64
	VolumeID        string
	TotalSize       int64
	FileCount       int64
	DirectoryCount  int64
	LargestFile     int64
	ScanMethod      string
	ScanDuration    int64
	FilesystemType  *string
	ChecksumMD5     *string
	IsValid         bool
	ErrorMessage    *string
	CreatedAt       time.Time
	UpdatedAt       time.Time
}

// InsertVolumeSize inserts new volume scan statistics
func (f *StoreFacade) InsertVolumeSize(ctx context.Context, stats VolumeSizeResult) error {
	if f.dbType == config.DatabaseTypePostgreSQL && f.pgQueries != nil {
		var pgFilesystemType pgtype.Text
		if stats.FilesystemType != nil {
			pgFilesystemType = pgtype.Text{String: *stats.FilesystemType, Valid: true}
		}
		
		var pgChecksumMD5 pgtype.Text
		if stats.ChecksumMD5 != nil {
			pgChecksumMD5 = pgtype.Text{String: *stats.ChecksumMD5, Valid: true}
		}
		
		var pgErrorMessage pgtype.Text
		if stats.ErrorMessage != nil {
			pgErrorMessage = pgtype.Text{String: *stats.ErrorMessage, Valid: true}
		}
		
		_, err := f.pgQueries.InsertVolumeSize(ctx, pgstore.InsertVolumeSizeParams{
			VolumeID:       stats.VolumeID,
			TotalSize:      stats.TotalSize,
			FileCount:      stats.FileCount,
			DirectoryCount: stats.DirectoryCount,
			LargestFile:    stats.LargestFile,
			ScanMethod:     stats.ScanMethod,
			ScanDuration:   stats.ScanDuration,
			FilesystemType: pgFilesystemType,
			ChecksumMd5:    pgChecksumMD5,
			IsValid:        pgtype.Bool{Bool: stats.IsValid, Valid: true},
			ErrorMessage:   pgErrorMessage,
		})
		return err
	}
	
	if f.dbType == config.DatabaseTypeSQLite && f.sqliteQueries != nil {
		var sqliteFilesystemType sql.NullString
		if stats.FilesystemType != nil {
			sqliteFilesystemType = sql.NullString{String: *stats.FilesystemType, Valid: true}
		}
		
		var sqliteChecksumMD5 sql.NullString
		if stats.ChecksumMD5 != nil {
			sqliteChecksumMD5 = sql.NullString{String: *stats.ChecksumMD5, Valid: true}
		}
		
		var sqliteErrorMessage sql.NullString
		if stats.ErrorMessage != nil {
			sqliteErrorMessage = sql.NullString{String: *stats.ErrorMessage, Valid: true}
		}
		
		_, err := f.sqliteQueries.InsertVolumeSize(ctx, sqlitestore.InsertVolumeSizeParams{
			VolumeID:       stats.VolumeID,
			TotalSize:      stats.TotalSize,
			FileCount:      stats.FileCount,
			DirectoryCount: stats.DirectoryCount,
			LargestFile:    stats.LargestFile,
			ScanMethod:     stats.ScanMethod,
			ScanDuration:   stats.ScanDuration,
			FilesystemType: sqliteFilesystemType,
			ChecksumMd5:    sqliteChecksumMD5,
			IsValid:        sql.NullInt64{Int64: sqliteBool(stats.IsValid), Valid: true},
			ErrorMessage:   sqliteErrorMessage,
		})
		return err
	}
	
	return fmt.Errorf("no database connection available")
}

// GetLatestVolumeSize gets the latest volume size stats for a volume
func (f *StoreFacade) GetLatestVolumeSize(ctx context.Context, volumeID string) (*VolumeSizeResult, error) {
	if f.dbType == config.DatabaseTypePostgreSQL && f.pgQueries != nil {
		size, err := f.pgQueries.GetLatestVolumeSize(ctx, volumeID)
		if err != nil {
			return nil, err
		}
		
		result := &VolumeSizeResult{
			ID:             int64(size.ID),
			VolumeID:       size.VolumeID,
			TotalSize:      size.TotalSize,
			FileCount:      size.FileCount,
			DirectoryCount: size.DirectoryCount,
			LargestFile:    size.LargestFile,
			ScanMethod:     size.ScanMethod,
			ScanDuration:   size.ScanDuration,
			IsValid:        size.IsValid.Bool,
			CreatedAt:      size.CreatedAt,
			UpdatedAt:      size.UpdatedAt,
		}
		
		if size.FilesystemType.Valid {
			result.FilesystemType = &size.FilesystemType.String
		}
		if size.ChecksumMd5.Valid {
			result.ChecksumMD5 = &size.ChecksumMd5.String
		}
		if size.ErrorMessage.Valid {
			result.ErrorMessage = &size.ErrorMessage.String
		}
		
		return result, nil
	}
	
	if f.dbType == config.DatabaseTypeSQLite && f.sqliteQueries != nil {
		size, err := f.sqliteQueries.GetLatestVolumeSize(ctx, volumeID)
		if err != nil {
			return nil, err
		}
		
		createdAt, _ := time.Parse(time.RFC3339, size.CreatedAt)
		updatedAt, _ := time.Parse(time.RFC3339, size.UpdatedAt)
		
		result := &VolumeSizeResult{
			ID:             size.ID,
			VolumeID:       size.VolumeID,
			TotalSize:      size.TotalSize,
			FileCount:      size.FileCount,
			DirectoryCount: size.DirectoryCount,
			LargestFile:    size.LargestFile,
			ScanMethod:     size.ScanMethod,
			ScanDuration:   size.ScanDuration,
			IsValid:        size.IsValid.Valid && size.IsValid.Int64 == 1,
			CreatedAt:      createdAt,
			UpdatedAt:      updatedAt,
		}
		
		if size.FilesystemType.Valid {
			result.FilesystemType = &size.FilesystemType.String
		}
		if size.ChecksumMd5.Valid {
			result.ChecksumMD5 = &size.ChecksumMd5.String
		}
		if size.ErrorMessage.Valid {
			result.ErrorMessage = &size.ErrorMessage.String
		}
		
		return result, nil
	}
	
	return nil, fmt.Errorf("no database connection available")
}

// GetVolumeSizesByName gets volume sizes for a specific volume name
func (f *StoreFacade) GetVolumeSizesByName(ctx context.Context, volumeName string, limit int32) ([]*VolumeSizeResult, error) {
	// First get the volume ID by name
	// Use a large limit to get all volumes
	volumes, err := f.ListVolumes(ctx, 1000, 0)
	if err != nil {
		return nil, err
	}
	
	var volumeID string
	for _, v := range volumes {
		if v.Name == volumeName {
			volumeID = v.VolumeID
			break
		}
	}
	
	if volumeID == "" {
		return nil, fmt.Errorf("volume not found: %s", volumeName)
	}
	
	if f.dbType == config.DatabaseTypePostgreSQL && f.pgQueries != nil {
		sizes, err := f.pgQueries.GetVolumeSizesByVolumeID(ctx, pgstore.GetVolumeSizesByVolumeIDParams{
			VolumeID: volumeID,
			Limit:    limit,
		})
		if err != nil {
			return nil, err
		}
		
		results := make([]*VolumeSizeResult, len(sizes))
		for i, size := range sizes {
			result := &VolumeSizeResult{
				ID:             int64(size.ID),
				VolumeID:       size.VolumeID,
				TotalSize:      size.TotalSize,
				FileCount:      size.FileCount,
				DirectoryCount: size.DirectoryCount,
				LargestFile:    size.LargestFile,
				ScanMethod:     size.ScanMethod,
				ScanDuration:   size.ScanDuration,
				IsValid:        size.IsValid.Bool,
				CreatedAt:      size.CreatedAt,
				UpdatedAt:      size.UpdatedAt,
			}
			
			if size.FilesystemType.Valid {
				result.FilesystemType = &size.FilesystemType.String
			}
			if size.ChecksumMd5.Valid {
				result.ChecksumMD5 = &size.ChecksumMd5.String
			}
			if size.ErrorMessage.Valid {
				result.ErrorMessage = &size.ErrorMessage.String
			}
			
			results[i] = result
		}
		
		return results, nil
	}
	
	if f.dbType == config.DatabaseTypeSQLite && f.sqliteQueries != nil {
		sizes, err := f.sqliteQueries.GetVolumeSizesByVolumeID(ctx, sqlitestore.GetVolumeSizesByVolumeIDParams{
			VolumeID: volumeID,
			Limit:    int64(limit),
		})
		if err != nil {
			return nil, err
		}
		
		results := make([]*VolumeSizeResult, len(sizes))
		for i, size := range sizes {
			createdAt, _ := time.Parse(time.RFC3339, size.CreatedAt)
			updatedAt, _ := time.Parse(time.RFC3339, size.UpdatedAt)
			
			result := &VolumeSizeResult{
				ID:             size.ID,
				VolumeID:       size.VolumeID,
				TotalSize:      size.TotalSize,
				FileCount:      size.FileCount,
				DirectoryCount: size.DirectoryCount,
				LargestFile:    size.LargestFile,
				ScanMethod:     size.ScanMethod,
				ScanDuration:   size.ScanDuration,
				IsValid:        size.IsValid.Valid && size.IsValid.Int64 == 1,
				CreatedAt:      createdAt,
				UpdatedAt:      updatedAt,
			}
			
			if size.FilesystemType.Valid {
				result.FilesystemType = &size.FilesystemType.String
			}
			if size.ChecksumMd5.Valid {
				result.ChecksumMD5 = &size.ChecksumMd5.String
			}
			if size.ErrorMessage.Valid {
				result.ErrorMessage = &size.ErrorMessage.String
			}
			
			results[i] = result
		}
		
		return results, nil
	}
	
	return nil, fmt.Errorf("no database connection available")
}

// Helper functions

// convertPgVolume converts PostgreSQL volume to VolumeResult
func (f *StoreFacade) convertPgVolume(volume pgstore.Volumes) *VolumeResult {
	result := &VolumeResult{
		ID:         int64(volume.ID),
		VolumeID:   volume.VolumeID,
		Name:       volume.Name,
		Driver:     volume.Driver,
		Mountpoint: volume.Mountpoint,
		Labels:     string(volume.Labels),
		Options:    string(volume.Options),
		Scope:      volume.Scope.String,
		Status:     volume.Status.String,
		IsActive:   volume.IsActive.Bool,
		CreatedAt:  volume.CreatedAt,
		UpdatedAt:  volume.UpdatedAt,
	}

	if volume.LastScanned.Valid {
		result.LastScanned = &volume.LastScanned.Time
	}

	return result
}

// convertSqliteVolume converts SQLite volume to VolumeResult
func (f *StoreFacade) convertSqliteVolume(volume sqlitestore.Volumes) *VolumeResult {
	createdAt, _ := time.Parse(time.RFC3339, volume.CreatedAt)
	updatedAt, _ := time.Parse(time.RFC3339, volume.UpdatedAt)

	result := &VolumeResult{
		ID:         volume.ID,
		VolumeID:   volume.VolumeID,
		Name:       volume.Name,
		Driver:     volume.Driver,
		Mountpoint: volume.Mountpoint,
		Labels:     volume.Labels.String,
		Options:    volume.Options.String,
		Scope:      volume.Scope.String,
		Status:     volume.Status.String,
		IsActive:   volume.IsActive.Valid && volume.IsActive.Int64 == 1,
		CreatedAt:  createdAt,
		UpdatedAt:  updatedAt,
	}

	if volume.LastScanned.Valid {
		result.LastScanned = &volume.LastScanned.Time
	}

	return result
}

// sqliteBool converts bool to SQLite integer representation
func sqliteBool(b bool) int64 {
	if b {
		return 1
	}
	return 0
}

// =============================================================================
// EXPLORER QUERIES - File and Directory Navigation
// =============================================================================

// Explorer result types
type ExplorerEntryResult struct {
	EntryType    string    `json:"entry_type"` // "dir" or "file"
	EntryID      int64     `json:"entry_id"`
	Name         string    `json:"name"`
	FullPath     string    `json:"full_path,omitempty"`
	SizeBytes    int64     `json:"size_bytes"`
	FileCount    int64     `json:"file_count,omitempty"`
	Depth        int32     `json:"depth,omitempty"`
	LastModified time.Time `json:"last_modified"`
	Hidden       *bool     `json:"hidden,omitempty"`
}

type DirectoryResult struct {
	ID              int64     `json:"id"`
	Name            string    `json:"name"`
	FullPath        string    `json:"full_path"`
	ParentDirID     *int64    `json:"parent_dir_id,omitempty"`
	Depth           int32     `json:"depth"`
	LatestSizeBytes int64     `json:"latest_size_bytes"`
	LatestFileCount int64     `json:"latest_file_count"`
	UpdatedAt       time.Time `json:"updated_at"`
}

// GetDirectoryChildren gets immediate children (directories and files) of a directory
func (f *StoreFacade) GetDirectoryChildren(ctx context.Context, volumeID string, parentDirID *int64, minSizeBytes *int64, includeHidden *bool) ([]ExplorerEntryResult, error) {
	if f.dbType == config.DatabaseTypePostgreSQL && f.pgQueries != nil {
		var pgParentDirID pgtype.Int8
		if parentDirID != nil {
			pgParentDirID = pgtype.Int8{Int64: *parentDirID, Valid: true}
		}

		var pgMinSize pgtype.Int8
		if minSizeBytes != nil {
			pgMinSize = pgtype.Int8{Int64: *minSizeBytes, Valid: true}
		}

		var pgIncludeHidden pgtype.Bool
		if includeHidden != nil {
			pgIncludeHidden = pgtype.Bool{Bool: *includeHidden, Valid: true}
		}

		entries, err := f.pgQueries.GetDirectoryChildren(ctx, pgstore.GetDirectoryChildrenParams{
			VolumeID:      volumeID,
			ParentDirID:   pgParentDirID,
			MinSizeBytes:  pgMinSize.Int64,
			IncludeHidden: pgIncludeHidden.Bool,
		})
		if err != nil {
			return nil, err
		}

		results := make([]ExplorerEntryResult, len(entries))
		for i, entry := range entries {
			results[i] = ExplorerEntryResult{
				EntryType:    entry.EntryType,
				EntryID:      entry.EntryID,
				Name:         entry.Name,
				FullPath:     entry.FullPath,
				SizeBytes:    entry.SizeBytes,
				FileCount:    entry.FileCount,
				Depth:        entry.Depth,
				LastModified: entry.LastModified,
			}
			results[i].Hidden = &entry.Hidden
		}
		return results, nil
	}

	if f.dbType == config.DatabaseTypeSQLite && f.sqliteQueries != nil {
		// SQLite has separate queries for directories and files
		var results []ExplorerEntryResult

		// Get directories and files (unified query)
		var sqliteParentDirID sql.NullInt64
		if parentDirID != nil {
			sqliteParentDirID = sql.NullInt64{Int64: *parentDirID, Valid: true}
		}

		entries, err := f.sqliteQueries.GetDirectoryChildren(ctx, sqlitestore.GetDirectoryChildrenParams{
			VolumeID:      volumeID,
			ParentDirID:   sqliteParentDirID,
			MinSizeBytes:  nil, // No minimum size filter for basic listing
			IncludeHidden: nil, // Use default hidden file handling
		})
		if err != nil {
			return nil, err
		}

		for _, entry := range entries {
			lastModified, _ := time.Parse(time.RFC3339, entry.LastModified)
			results = append(results, ExplorerEntryResult{
				EntryType:    entry.EntryType,
				EntryID:      entry.EntryID,
				Name:         entry.Name,
				FullPath:     entry.FullPath,
				SizeBytes:    entry.SizeBytes,
				FileCount:    entry.FileCount,
				Depth:        int32(entry.Depth),
				LastModified: lastModified,
			})
		}

		return results, nil
	}

	return nil, fmt.Errorf("no database connection available")
}

// GetTopDirectoriesBySize gets the top N largest directories in a volume
func (f *StoreFacade) GetTopDirectoriesBySize(ctx context.Context, volumeID string, pathPrefix *string, minSizeBytes *int64, limit int32) ([]DirectoryResult, error) {
	if f.dbType == config.DatabaseTypePostgreSQL && f.pgQueries != nil {
		var pgPathPrefix pgtype.Text
		if pathPrefix != nil {
			pgPathPrefix = pgtype.Text{String: *pathPrefix, Valid: true}
		}

		var pgMinSize pgtype.Int8
		if minSizeBytes != nil {
			pgMinSize = pgtype.Int8{Int64: *minSizeBytes, Valid: true}
		}

		dirs, err := f.pgQueries.GetTopDirectoriesBySize(ctx, pgstore.GetTopDirectoriesBySizeParams{
			VolumeID:     volumeID,
			PathPrefix:   pgPathPrefix.String,
			MinSizeBytes: pgMinSize.Int64,
			LimitCount:   limit,
		})
		if err != nil {
			return nil, err
		}

		results := make([]DirectoryResult, len(dirs))
		for i, dir := range dirs {
			results[i] = DirectoryResult{
				ID:              dir.ID,
				Name:            dir.Name,
				FullPath:        dir.FullPath,
				Depth:           dir.Depth,
				LatestSizeBytes: dir.SizeBytes,
				LatestFileCount: dir.FileCount,
				UpdatedAt:       dir.LastUpdated,
			}
		}
		return results, nil
	}

	if f.dbType == config.DatabaseTypeSQLite && f.sqliteQueries != nil {
		var sqlitePathPrefix sql.NullString
		if pathPrefix != nil {
			sqlitePathPrefix = sql.NullString{String: *pathPrefix, Valid: true}
		}

		var sqliteMinSize sql.NullInt64
		if minSizeBytes != nil {
			sqliteMinSize = sql.NullInt64{Int64: *minSizeBytes, Valid: true}
		}

		dirs, err := f.sqliteQueries.GetTopDirectoriesBySize(ctx, sqlitestore.GetTopDirectoriesBySizeParams{
			VolumeID:     volumeID,
			PathPrefix:   sqlitePathPrefix.String,
			MinSizeBytes: sqliteMinSize.Int64,
			LimitCount:   int64(limit),
		})
		if err != nil {
			return nil, err
		}

		results := make([]DirectoryResult, len(dirs))
		for i, dir := range dirs {
			updatedAt, _ := time.Parse(time.RFC3339, dir.LastUpdated)
			results[i] = DirectoryResult{
				ID:              dir.ID,
				Name:            dir.Name,
				FullPath:        dir.FullPath,
				Depth:           int32(dir.Depth),
				LatestSizeBytes: dir.SizeBytes,
				LatestFileCount: dir.FileCount,
				UpdatedAt:       updatedAt,
			}
		}
		return results, nil
	}

	return nil, fmt.Errorf("no database connection available")
}

// FileResult represents a file entry result
type FileResult struct {
	ID           int64     `json:"id"`
	Name         string    `json:"name"`
	ParentDirID  *int64    `json:"parent_dir_id,omitempty"`
	SizeBytes    int64     `json:"size_bytes"`
	Type         string    `json:"type"`
	LastModified time.Time `json:"last_modified"`
	Hidden       bool      `json:"hidden"`
	UID          *int32    `json:"uid,omitempty"`
	GID          *int32    `json:"gid,omitempty"`
	ParentPath   string    `json:"parent_path"`
}

// GetTopFilesBySize gets the top N largest files in a volume
func (f *StoreFacade) GetTopFilesBySize(ctx context.Context, volumeID string, pathPrefix *string, minSizeBytes *int64, limit int32) ([]FileResult, error) {
	if f.dbType == config.DatabaseTypePostgreSQL && f.pgQueries != nil {
		var pgPathPrefix pgtype.Text
		if pathPrefix != nil {
			pgPathPrefix = pgtype.Text{String: *pathPrefix, Valid: true}
		}

		var pgMinSize pgtype.Int8
		if minSizeBytes != nil {
			pgMinSize = pgtype.Int8{Int64: *minSizeBytes, Valid: true}
		}

		files, err := f.pgQueries.GetTopFilesBySize(ctx, pgstore.GetTopFilesBySizeParams{
			VolumeID:      volumeID,
			PathPrefix:    pgPathPrefix.String,
			MinSizeBytes:  pgMinSize.Int64,
			IncludeHidden: false, // Not filtering by hidden for now
			LimitCount:    limit,
		})
		if err != nil {
			return nil, err
		}

		results := make([]FileResult, len(files))
		for i, file := range files {
			results[i] = FileResult{
				ID:           file.ID,
				Name:         file.Name,
				SizeBytes:    file.SizeBytes,
				Type:         file.Type,
				LastModified: file.LastModified,
				Hidden:       file.Hidden,
				ParentPath:   file.ParentPath.String,
			}

			if file.ParentDirID.Valid {
				parentDirID := file.ParentDirID.Int64
				results[i].ParentDirID = &parentDirID
			}

			if file.Uid.Valid {
				uid := file.Uid.Int32
				results[i].UID = &uid
			}

			if file.Gid.Valid {
				gid := file.Gid.Int32
				results[i].GID = &gid
			}
		}
		return results, nil
	}

	if f.dbType == config.DatabaseTypeSQLite && f.sqliteQueries != nil {
		var sqlitePathPrefix sql.NullString
		if pathPrefix != nil {
			sqlitePathPrefix = sql.NullString{String: *pathPrefix, Valid: true}
		}

		var sqliteMinSize sql.NullInt64
		if minSizeBytes != nil {
			sqliteMinSize = sql.NullInt64{Int64: *minSizeBytes, Valid: true}
		}

		files, err := f.sqliteQueries.GetTopFilesBySize(ctx, sqlitestore.GetTopFilesBySizeParams{
			VolumeID:     volumeID,
			PathPrefix:   sqlitePathPrefix.String,
			MinSizeBytes: sqliteMinSize.Int64,
			LimitCount:   int64(limit),
		})
		if err != nil {
			return nil, err
		}

		results := make([]FileResult, len(files))
		for i, file := range files {
			lastModified, _ := time.Parse(time.RFC3339, file.LastModified)
			results[i] = FileResult{
				ID:           file.ID,
				Name:         file.Name,
				SizeBytes:    file.SizeBytes,
				Type:         file.Type,
				LastModified: lastModified,
				Hidden:       file.Hidden == 1,
				ParentPath:   file.ParentPath.String,
			}

			if file.ParentDirID.Valid {
				parentDirID := file.ParentDirID.Int64
				results[i].ParentDirID = &parentDirID
			}

			if file.Uid.Valid {
				uid := int32(file.Uid.Int64)
				results[i].UID = &uid
			}

			if file.Gid.Valid {
				gid := int32(file.Gid.Int64)
				results[i].GID = &gid
			}
		}
		return results, nil
	}

	return nil, fmt.Errorf("no database connection available")
}

// GetDirectoryByPath finds a directory by its full path
func (f *StoreFacade) GetDirectoryByPath(ctx context.Context, volumeID, fullPath string) (*DirectoryResult, error) {
	if f.dbType == config.DatabaseTypePostgreSQL && f.pgQueries != nil {
		dir, err := f.pgQueries.GetDirectoryByPath(ctx, pgstore.GetDirectoryByPathParams{
			VolumeID: volumeID,
			FullPath: fullPath,
		})
		if err != nil {
			return nil, err
		}

		result := &DirectoryResult{
			ID:              dir.ID,
			Name:            dir.Name,
			FullPath:        dir.FullPath,
			Depth:           dir.Depth,
			LatestSizeBytes: dir.LatestSizeBytes,
			LatestFileCount: dir.LatestFileCount,
			UpdatedAt:       dir.UpdatedAt,
		}

		if dir.ParentDirID.Valid {
			parentDirID := dir.ParentDirID.Int64
			result.ParentDirID = &parentDirID
		}

		return result, nil
	}

	if f.dbType == config.DatabaseTypeSQLite && f.sqliteQueries != nil {
		dir, err := f.sqliteQueries.GetDirectoryByPath(ctx, sqlitestore.GetDirectoryByPathParams{
			VolumeID: volumeID,
			FullPath: fullPath,
		})
		if err != nil {
			return nil, err
		}

		updatedAt, _ := time.Parse(time.RFC3339, dir.UpdatedAt)
		result := &DirectoryResult{
			ID:              dir.ID,
			Name:            dir.Name,
			FullPath:        dir.FullPath,
			Depth:           int32(dir.Depth),
			LatestSizeBytes: dir.LatestSizeBytes,
			LatestFileCount: dir.LatestFileCount,
			UpdatedAt:       updatedAt,
		}

		if dir.ParentDirID.Valid {
			parentDirID := dir.ParentDirID.Int64
			result.ParentDirID = &parentDirID
		}

		return result, nil
	}

	return nil, fmt.Errorf("no database connection available")
}

// SearchResult represents a search result for files
type SearchResult struct {
	ID           int64     `json:"id"`
	Name         string    `json:"name"`
	SizeBytes    int64     `json:"size_bytes"`
	Type         string    `json:"type"`
	LastModified time.Time `json:"last_modified"`
	Hidden       bool      `json:"hidden"`
	ParentPath   string    `json:"parent_path"`
	ParentName   string    `json:"parent_name"`
}

// SearchFilesByName searches for files by name pattern
func (f *StoreFacade) SearchFilesByName(ctx context.Context, volumeID, namePattern string, fileType *string, minSizeBytes *int64, limit int32) ([]SearchResult, error) {
	if f.dbType == config.DatabaseTypePostgreSQL && f.pgQueries != nil {
		var pgFileType pgtype.Text
		if fileType != nil {
			pgFileType = pgtype.Text{String: *fileType, Valid: true}
		}

		var pgMinSize pgtype.Int8
		if minSizeBytes != nil {
			pgMinSize = pgtype.Int8{Int64: *minSizeBytes, Valid: true}
		}

		files, err := f.pgQueries.SearchFilesByName(ctx, pgstore.SearchFilesByNameParams{
			VolumeID:     volumeID,
			NamePattern:  namePattern,
			FileType:     pgFileType.String,
			MinSizeBytes: pgMinSize.Int64,
			LimitCount:   limit,
		})
		if err != nil {
			return nil, err
		}

		results := make([]SearchResult, len(files))
		for i, file := range files {
			results[i] = SearchResult{
				ID:           file.ID,
				Name:         file.Name,
				SizeBytes:    file.SizeBytes,
				Type:         file.Type,
				LastModified: file.LastModified,
				Hidden:       file.Hidden,
				ParentPath:   file.ParentPath.String,
				ParentName:   file.ParentName.String,
			}
		}
		return results, nil
	}

	if f.dbType == config.DatabaseTypeSQLite && f.sqliteQueries != nil {
		var sqliteFileType sql.NullString
		if fileType != nil {
			sqliteFileType = sql.NullString{String: *fileType, Valid: true}
		}

		var sqliteMinSize sql.NullInt64
		if minSizeBytes != nil {
			sqliteMinSize = sql.NullInt64{Int64: *minSizeBytes, Valid: true}
		}

		files, err := f.sqliteQueries.SearchFilesByName(ctx, sqlitestore.SearchFilesByNameParams{
			VolumeID:     volumeID,
			NamePattern:  namePattern,
			FileType:     sqliteFileType.String,
			MinSizeBytes: sqliteMinSize.Int64,
			LimitCount:   int64(limit),
		})
		if err != nil {
			return nil, err
		}

		results := make([]SearchResult, len(files))
		for i, file := range files {
			lastModified, _ := time.Parse(time.RFC3339, file.LastModified)
			results[i] = SearchResult{
				ID:           file.ID,
				Name:         file.Name,
				SizeBytes:    file.SizeBytes,
				Type:         file.Type,
				LastModified: lastModified,
				Hidden:       file.Hidden == 1,
				ParentPath:   file.ParentPath.String,
				ParentName:   file.ParentName.String,
			}
		}
		return results, nil
	}

	return nil, fmt.Errorf("no database connection available")
}

// IngestFiles provides a simplified API for bulk file ingestion
// This is a convenience method that directly accesses the bulk ingestion system
func (f *StoreFacade) IngestFiles(ctx context.Context, volumeID string, rows []FileRow, opts ...BulkIngestOptions) (*BulkIngestResult, error) {
	// Create a temporary integration for bulk ingestion
	integration := &Integration{
		storeFacade: f,
		pgPool:      f.pgPool,
		sqliteDB:    f.sqliteDB,
	}
	integration.connManager = &ConnectionManager{
		dbType:   f.dbType,
		pgPool:   f.pgPool,
		sqliteDB: f.sqliteDB,
	}

	// Create bulk ingestion facade
	bulkFacade, err := NewBulkIngestFacade(integration)
	if err != nil {
		return nil, fmt.Errorf("failed to create bulk ingest facade: %w", err)
	}

	return bulkFacade.IngestFiles(ctx, volumeID, rows, opts...)
}
