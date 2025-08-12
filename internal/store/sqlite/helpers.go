package sqlite

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	sqlite "github.com/mantonx/volumeviz/internal/store/generated/sqlite"
	"github.com/mantonx/volumeviz/internal/store/models"
)

// SQLite datetime formats
const (
	sqliteTimeFormat = "2006-01-02 15:04:05"
)

// parseSQLiteTime parses SQLite's datetime format into time.Time
// It handles both SQLite's native format and RFC3339
func parseSQLiteTime(timeStr string) (time.Time, error) {
	if timeStr == "" {
		return time.Time{}, nil
	}

	// Try RFC3339 first (what we insert from Go)
	if t, err := time.Parse(time.RFC3339, timeStr); err == nil {
		return t, nil
	}

	// Try SQLite's datetime format
	if t, err := time.Parse(sqliteTimeFormat, timeStr); err == nil {
		return t, nil
	}

	// Try RFC3339Nano as fallback
	if t, err := time.Parse(time.RFC3339Nano, timeStr); err == nil {
		return t, nil
	}

	return time.Time{}, fmt.Errorf("unable to parse time '%s' in any known format", timeStr)
}

// Type conversion helpers

func toSQLiteInt64(ptr *int64) sql.NullInt64 {
	if ptr == nil {
		return sql.NullInt64{Valid: false}
	}
	return sql.NullInt64{Int64: *ptr, Valid: true}
}

func fromSQLiteInt64(nullInt sql.NullInt64) *int64 {
	if !nullInt.Valid {
		return nil
	}
	return &nullInt.Int64
}

func int64ToPtr(val int64) *int64 {
	return &val
}

func int64PtrToInt32Ptr(ptr *int64) *int32 {
	if ptr == nil {
		return nil
	}
	val := int32(*ptr)
	return &val
}

func int32PtrToInt64Ptr(ptr *int32) *int64 {
	if ptr == nil {
		return nil
	}
	val := int64(*ptr)
	return &val
}

func boolToSQLiteInt(b bool) int64 {
	if b {
		return 1
	}
	return 0
}

func sqliteIntToBool(i int64) bool {
	return i != 0
}

// Data conversion functions

func fromSQLiteFileEntry(row sqlite.FileEntries) (*models.FileEntry, error) {
	mtime, err := parseSQLiteTime(row.Mtime)
	if err != nil {
		return nil, fmt.Errorf("failed to parse mtime: %w", err)
	}

	ctime, err := parseSQLiteTime(row.Ctime)
	if err != nil {
		return nil, fmt.Errorf("failed to parse ctime: %w", err)
	}

	// Convert created/updated timestamps
	createdAt, err := parseSQLiteTime(row.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to parse created_at: %w", err)
	}

	updatedAt, err := parseSQLiteTime(row.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to parse updated_at: %w", err)
	}

	return &models.FileEntry{
		ID:          row.ID,
		VolumeID:    row.VolumeID,
		ParentDirID: fromSQLiteInt64(row.ParentDirID),
		Name:        row.Name,
		SizeBytes:   row.SizeBytes,
		Mtime:       mtime,
		Ctime:       ctime,
		Inode:       fromSQLiteInt64(row.Inode),
		UID:         int64PtrToInt32Ptr(fromSQLiteInt64(row.Uid)),
		GID:         int64PtrToInt32Ptr(fromSQLiteInt64(row.Gid)),
		Type:        row.Type,
		Hidden:      sqliteIntToBool(row.Hidden),
		PathHash:    row.PathHash,
		CreatedAt:   createdAt,
		UpdatedAt:   updatedAt,
	}, nil
}

func fromSQLiteDirNode(row sqlite.DirNodes) (*models.DirNode, error) {
	// Convert created/updated timestamps
	createdAt, err := parseSQLiteTime(row.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to parse created_at: %w", err)
	}

	updatedAt, err := parseSQLiteTime(row.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to parse updated_at: %w", err)
	}

	return &models.DirNode{
		ID:              row.ID,
		VolumeID:        row.VolumeID,
		ParentDirID:     fromSQLiteInt64(row.ParentDirID),
		Name:            row.Name,
		FullPath:        row.FullPath,
		Depth:           int32(row.Depth),
		LatestSizeBytes: row.LatestSizeBytes,
		LatestFileCount: row.LatestFileCount,
		CreatedAt:       createdAt,
		UpdatedAt:       updatedAt,
	}, nil
}

func fromSQLiteDirRollup(row sqlite.DirRollups) (*models.DirRollup, error) {
	createdAt, err := parseSQLiteTime(row.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to parse created_at: %w", err)
	}

	return &models.DirRollup{
		ID:        row.ID,
		DirID:     row.DirID,
		SizeBytes: row.SizeBytes,
		FileCount: row.FileCount,
		CreatedAt: createdAt,
	}, nil
}

func fromSQLiteGetDirectoryTreeRow(row sqlite.GetDirectoryTreeRow) (*models.DirNode, error) {
	// Convert created/updated timestamps
	createdAt, err := parseSQLiteTime(row.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to parse created_at: %w", err)
	}

	updatedAt, err := parseSQLiteTime(row.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to parse updated_at: %w", err)
	}

	return &models.DirNode{
		ID:          row.ID,
		VolumeID:    row.VolumeID,
		ParentDirID: fromSQLiteInt64(row.ParentDirID),
		Name:        row.Name,
		FullPath:    row.FullPath,
		Depth:       int32(row.Depth),
		CreatedAt:   createdAt,
		UpdatedAt:   updatedAt,
	}, nil
}

func fromSQLiteUsageSnapshot(row sqlite.UsageSnapshots) (*models.UsageSnapshot, error) {
	createdAt, err := parseSQLiteTime(row.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to parse created_at: %w", err)
	}

	updatedAt, err := parseSQLiteTime(row.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to parse updated_at: %w", err)
	}

	snapshotDate, err := parseSQLiteTime(row.SnapshotDate)
	if err != nil {
		return nil, fmt.Errorf("failed to parse snapshot_date: %w", err)
	}

	return &models.UsageSnapshot{
		ID:                    row.ID,
		VolumeID:              row.VolumeID,
		SnapshotDate:          snapshotDate,
		SnapshotType:          row.SnapshotType,
		TotalSize:             row.TotalSize,
		FileCount:             row.FileCount,
		DirectoryCount:        row.DirectoryCount,
		LargestFile:           row.LargestFile,
		GrowthBytes:           nullInt64ToInt64(row.GrowthBytes),
		GrowthFiles:           nullInt64ToInt64(row.GrowthFiles),
		GrowthRateBytesPerDay: nullFloat64ToFloat64(row.GrowthRateBytesPerDay),
		ScanMethod:            row.ScanMethod,
		ScanDurationMs:        nullInt64ToInt64(row.ScanDurationMs),
		CreatedAt:             createdAt,
		UpdatedAt:             updatedAt,
	}, nil
}

// Helper functions for nullable types
func nullInt64ToInt64(nullInt sql.NullInt64) int64 {
	if nullInt.Valid {
		return nullInt.Int64
	}
	return 0
}

func nullFloat64ToFloat64(nullFloat sql.NullFloat64) float64 {
	if nullFloat.Valid {
		return nullFloat.Float64
	}
	return 0.0
}

func int64ToNullInt64(val int64) sql.NullInt64 {
	return sql.NullInt64{Int64: val, Valid: true}
}

func float64ToNullFloat64(val float64) sql.NullFloat64 {
	return sql.NullFloat64{Float64: val, Valid: true}
}

// Helper functions for converting maps to JSON strings and back
func mapStringToNullString(m map[string]string) sql.NullString {
	if len(m) == 0 {
		return sql.NullString{Valid: false}
	}
	
	jsonBytes, err := json.Marshal(m)
	if err != nil {
		// Log error and return empty map as fallback
		return sql.NullString{String: "{}", Valid: true}
	}
	
	return sql.NullString{String: string(jsonBytes), Valid: true}
}

func nullStringToMapString(ns sql.NullString) map[string]string {
	if !ns.Valid || ns.String == "" {
		return make(map[string]string)
	}
	
	var result map[string]string
	if err := json.Unmarshal([]byte(ns.String), &result); err != nil {
		// Log error and return empty map as fallback
		return make(map[string]string)
	}
	
	if result == nil {
		return make(map[string]string)
	}
	
	return result
}

func nullStringToString(ns sql.NullString) string {
	if !ns.Valid {
		return ""
	}
	return ns.String
}

func fromSQLiteContainer(row sqlite.Containers) (*models.Container, error) {
	createdAt, err := parseSQLiteTime(row.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to parse created_at: %w", err)
	}

	updatedAt, err := parseSQLiteTime(row.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to parse updated_at: %w", err)
	}

	var startedAt, finishedAt *time.Time
	if row.StartedAt.Valid {
		startedAt = &row.StartedAt.Time
	}
	if row.FinishedAt.Valid {
		finishedAt = &row.FinishedAt.Time
	}

	return &models.Container{
		ID:          row.ID,
		ContainerID: row.ContainerID,
		Name:        row.Name,
		Image:       row.Image,
		State:       row.State,
		Status:      nullStringToString(row.Status),
		Labels:      nullStringToMapString(row.Labels),
		StartedAt:   startedAt,
		FinishedAt:  finishedAt,
		IsActive:    sqliteIntToBool(nullInt64ToInt64(row.IsActive)),
		CreatedAt:   createdAt,
		UpdatedAt:   updatedAt,
	}, nil
}

func fromSQLiteVolumeMount(row sqlite.VolumeMounts) (*models.VolumeMount, error) {
	createdAt, err := parseSQLiteTime(row.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to parse created_at: %w", err)
	}

	updatedAt, err := parseSQLiteTime(row.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to parse updated_at: %w", err)
	}

	return &models.VolumeMount{
		ID:          row.ID,
		VolumeID:    row.VolumeID,
		ContainerID: row.ContainerID,
		MountPath:   row.MountPath,
		AccessMode:  row.AccessMode,
		IsActive:    sqliteIntToBool(nullInt64ToInt64(row.IsActive)),
		CreatedAt:   createdAt,
		UpdatedAt:   updatedAt,
	}, nil
}

// Helper conversion functions

func int32PtrToInt64(ptr *int32) int64 {
	if ptr == nil {
		return 0
	}
	return int64(*ptr)
}

func float64PtrFromInterface(val interface{}) *float64 {
	if val == nil {
		return nil
	}
	if f, ok := val.(float64); ok {
		return &f
	}
	return nil
}

func timeToSQLiteString(t time.Time) string {
	if t.IsZero() {
		return ""
	}
	return t.Format(time.RFC3339)
}

func stringTimeToTime(s string) (time.Time, error) {
	if s == "" {
		return time.Time{}, nil
	}
	return parseSQLiteTime(s)
}

// Bulk operation helpers

func chunkSlice[T any](slice []T, chunkSize int) [][]T {
	var chunks [][]T
	for i := 0; i < len(slice); i += chunkSize {
		end := i + chunkSize
		if end > len(slice) {
			end = len(slice)
		}
		chunks = append(chunks, slice[i:end])
	}
	return chunks
}

func defaultChunkSize() int {
	return 1000 // Default chunk size for bulk operations
}

// Docker-related conversion helpers

func fromSQLiteVolume(row sqlite.Volumes) (*models.Volume, error) {
	createdAt, err := parseSQLiteTime(row.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to parse created_at: %w", err)
	}

	updatedAt, err := parseSQLiteTime(row.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to parse updated_at: %w", err)
	}

	return &models.Volume{
		ID:         row.ID,
		VolumeID:   row.VolumeID,
		Name:       row.Name,
		Driver:     row.Driver,
		Mountpoint: row.Mountpoint,
		Labels:     nullStringToMapString(row.Labels),
		Options:    nullStringToMapString(row.Options),
		Scope:      nullStringToString(row.Scope),
		Status:     nullStringToString(row.Status),
		IsActive:   sqliteIntToBool(nullInt64ToInt64(row.IsActive)),
		CreatedAt:  createdAt,
		UpdatedAt:  updatedAt,
	}, nil
}