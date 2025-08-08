package database

import (
	"database/sql"
	"time"
)

// VolumeRepository handles volume-related database operations
// Provides CRUD operations and specialized queries for Docker volumes
type VolumeRepository struct {
	*BaseRepository
}

// NewVolumeRepository creates a new volume repository
// Pass in your database connection to get started
func NewVolumeRepository(db *DB) *VolumeRepository {
	return &VolumeRepository{
		BaseRepository: NewBaseRepository(db),
	}
}

// WithTx returns a new volume repository instance using the provided transaction
// Useful for atomic operations across multiple repositories
func (r *VolumeRepository) WithTx(tx *Tx) *VolumeRepository {
	return &VolumeRepository{
		BaseRepository: r.BaseRepository.WithTx(tx),
	}
}

// Create inserts a new volume into the database
// Automatically sets id, created_at, and updated_at fields
func (r *VolumeRepository) Create(volume *Volume) error {
	fields := StructToMap(volume, "id", "created_at", "updated_at")
	query, args := BuildInsertQuery(TableNames.Volumes, fields)
	query += " RETURNING id, created_at, updated_at"

	executor := r.getExecutor()
	err := executor.QueryRow(query, args...).Scan(
		&volume.ID,
		&volume.CreatedAt,
		&volume.UpdatedAt,
	)

	if err != nil {
		return err
	}

	return nil
}

// GetByID retrieves a volume by its database ID
// Returns nil if not found (check with err == sql.ErrNoRows)
func (r *VolumeRepository) GetByID(id int) (*Volume, error) {
	query := `
		SELECT id, volume_id, name, driver, mountpoint, labels, options, 
		       scope, status, last_scanned, is_active, created_at, updated_at
		FROM volumes 
		WHERE id = $1
	`

	executor := r.getExecutor()
	return r.scanVolume(executor.QueryRow(query, id))
}

// GetByVolumeID retrieves a volume by its volume_id (Docker volume name)
func (r *VolumeRepository) GetByVolumeID(volumeID string) (*Volume, error) {
	query := `
		SELECT id, volume_id, name, driver, mountpoint, labels, options, 
		       scope, status, last_scanned, is_active, created_at, updated_at
		FROM volumes 
		WHERE volume_id = $1
	`

	executor := r.getExecutor()
	return r.scanVolume(executor.QueryRow(query, volumeID))
}

// List retrieves volumes with optional filtering and pagination
func (r *VolumeRepository) List(options *FilterOptions) (*PaginatedResult[Volume], error) {
	selectFields := []string{"id", "volume_id", "name", "driver", "mountpoint", "labels", "options",
		"scope", "status", "last_scanned", "is_active", "created_at", "updated_at"}

	return ListWithPagination(
		r.getExecutor(),
		selectFields,
		TableNames.Volumes,
		options,
		r.scanVolumeRow,
		r.getVolumeCount,
	)
}

// GetByDriver retrieves volumes by driver type
func (r *VolumeRepository) GetByDriver(driver string) ([]*Volume, error) {
	query := `
		SELECT id, volume_id, name, driver, mountpoint, labels, options, 
		       scope, status, last_scanned, is_active, created_at, updated_at
		FROM volumes 
		WHERE driver = $1 AND is_active = true
		ORDER BY created_at DESC
	`

	executor := r.getExecutor()
	rows, err := executor.Query(query, driver)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return ScanRows(rows, r.scanVolumeRow)
}

// GetByLabel retrieves volumes by label key-value pair
func (r *VolumeRepository) GetByLabel(key, value string) ([]*Volume, error) {
	query := `
		SELECT id, volume_id, name, driver, mountpoint, labels, options, 
		       scope, status, last_scanned, is_active, created_at, updated_at
		FROM volumes 
		WHERE labels->$1 = $2 AND is_active = true
		ORDER BY created_at DESC
	`

	executor := r.getExecutor()
	rows, err := executor.Query(query, key, value)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return ScanRows(rows, r.scanVolumeRow)
}

// Update updates an existing volume
func (r *VolumeRepository) Update(volume *Volume) error {
	fields := StructToMap(volume, "id", "created_at", "updated_at")
	query, args := BuildUpdateQuery(TableNames.Volumes, fields, "id", volume.ID)
	query += " RETURNING updated_at"

	executor := r.getExecutor()
	err := executor.QueryRow(query, args...).Scan(&volume.UpdatedAt)

	return err
}

// UpdateLastScanned updates the last_scanned timestamp for a volume
func (r *VolumeRepository) UpdateLastScanned(volumeID string, scannedAt time.Time) error {
	query := `
		UPDATE volumes 
		SET last_scanned = $2, updated_at = CURRENT_TIMESTAMP 
		WHERE volume_id = $1
	`

	executor := r.getExecutor()
	_, err := executor.Exec(query, volumeID, scannedAt)
	return err
}

// Delete soft deletes a volume (sets is_active = false)
func (r *VolumeRepository) Delete(id int) error {
	query := `
		UPDATE volumes 
		SET is_active = false, updated_at = CURRENT_TIMESTAMP 
		WHERE id = $1
	`

	executor := r.getExecutor()
	result, err := executor.Exec(query, id)
	if err != nil {
		return err
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}

	if rowsAffected == 0 {
		return sql.ErrNoRows
	}

	return nil
}

// HardDelete permanently removes a volume from the database
func (r *VolumeRepository) HardDelete(id int) error {
	query := `DELETE FROM volumes WHERE id = $1`

	executor := r.getExecutor()
	result, err := executor.Exec(query, id)
	if err != nil {
		return err
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}

	if rowsAffected == 0 {
		return sql.ErrNoRows
	}

	return nil
}

// GetActiveCount returns the count of active volumes
func (r *VolumeRepository) GetActiveCount() (int, error) {
	query := `SELECT COUNT(*) FROM volumes WHERE is_active = true`

	executor := r.getExecutor()
	var count int
	err := executor.QueryRow(query).Scan(&count)
	return count, err
}

// GetVolumeStats returns volume statistics
func (r *VolumeRepository) GetVolumeStats() (*VolumeStats, error) {
	query := `
		SELECT 
			COUNT(*) as total_volumes,
			COUNT(*) FILTER (WHERE is_active = true) as active_volumes,
			COUNT(DISTINCT driver) as unique_drivers,
			COUNT(*) FILTER (WHERE last_scanned IS NOT NULL) as scanned_volumes,
			MAX(created_at) as newest_volume,
			MIN(created_at) as oldest_volume
		FROM volumes
	`

	executor := r.getExecutor()
	stats := &VolumeStats{}
	var newestVolume, oldestVolume sql.NullTime

	err := executor.QueryRow(query).Scan(
		&stats.TotalVolumes,
		&stats.ActiveVolumes,
		&stats.UniqueDrivers,
		&stats.ScannedVolumes,
		&newestVolume,
		&oldestVolume,
	)

	if err != nil {
		return nil, err
	}

	if newestVolume.Valid {
		stats.NewestVolume = &newestVolume.Time
	}
	if oldestVolume.Valid {
		stats.OldestVolume = &oldestVolume.Time
	}

	return stats, nil
}

// UpsertVolume creates or updates a volume based on volume_id
func (r *VolumeRepository) UpsertVolume(volume *Volume) error {
	query := `
		INSERT INTO volumes (volume_id, name, driver, mountpoint, labels, options, scope, status, is_active)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		ON CONFLICT (volume_id) 
		DO UPDATE SET 
			name = EXCLUDED.name,
			driver = EXCLUDED.driver,
			mountpoint = EXCLUDED.mountpoint,
			labels = EXCLUDED.labels,
			options = EXCLUDED.options,
			scope = EXCLUDED.scope,
			status = EXCLUDED.status,
			is_active = EXCLUDED.is_active,
			updated_at = CURRENT_TIMESTAMP
		RETURNING id, created_at, updated_at
	`

	executor := r.getExecutor()
	err := executor.QueryRow(query,
		volume.VolumeID,
		volume.Name,
		volume.Driver,
		volume.Mountpoint,
		volume.Labels,
		volume.Options,
		volume.Scope,
		volume.Status,
		volume.IsActive,
	).Scan(&volume.ID, &volume.CreatedAt, &volume.UpdatedAt)

	return err
}

// volumeScanner contains unified scanning functions for Volume entities
var volumeScanner = UnifiedScanFunc[Volume](func(scanner RowScanner) (*Volume, error) {
	volume := &Volume{}
	var lastScanned sql.NullTime

	err := scanner.Scan(
		&volume.ID,
		&volume.VolumeID,
		&volume.Name,
		&volume.Driver,
		&volume.Mountpoint,
		&volume.Labels,
		&volume.Options,
		&volume.Scope,
		&volume.Status,
		&lastScanned,
		&volume.IsActive,
		&volume.CreatedAt,
		&volume.UpdatedAt,
	)

	if err != nil {
		return nil, err
	}

	if lastScanned.Valid {
		volume.LastScanned = &lastScanned.Time
	}

	return volume, nil
})

// scanVolume scans a single volume from a row
func (r *VolumeRepository) scanVolume(row *sql.Row) (*Volume, error) {
	return volumeScanner.FromRow(row)
}

// scanVolumeRow scans a volume from a rows result set
func (r *VolumeRepository) scanVolumeRow(rows *sql.Rows) (*Volume, error) {
	return volumeScanner.FromRows(rows)
}

// getVolumeCount returns the total count of volumes matching the filter
func (r *VolumeRepository) getVolumeCount(options *FilterOptions) (int, error) {
	qb := NewQueryBuilder().
		Select("COUNT(*)").
		From(TableNames.Volumes)

	if options != nil {
		// Apply filters but not pagination
		filterOptions := *options
		filterOptions.Limit = nil
		filterOptions.Offset = nil
		filterOptions.OrderBy = nil
		filterOptions.ApplyToQuery(qb, "")
	}

	query, args := qb.Build()

	executor := r.getExecutor()
	var count int
	err := executor.QueryRow(query, args...).Scan(&count)
	return count, err
}

// VolumeStats represents volume statistics
type VolumeStats struct {
	TotalVolumes   int        `json:"total_volumes"`
	ActiveVolumes  int        `json:"active_volumes"`
	UniqueDrivers  int        `json:"unique_drivers"`
	ScannedVolumes int        `json:"scanned_volumes"`
	NewestVolume   *time.Time `json:"newest_volume,omitempty"`
	OldestVolume   *time.Time `json:"oldest_volume,omitempty"`
}
