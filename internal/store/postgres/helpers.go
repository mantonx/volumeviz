package postgres

import (
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/mantonx/volumeviz/internal/store/generated/postgres"
	"github.com/mantonx/volumeviz/internal/store/models"
)

// Helper functions for converting between PostgreSQL database types and domain models

// fromPostgresFileEntry converts a PostgreSQL FileEntries row to a domain FileEntry
func fromPostgresFileEntry(row *postgres.FileEntries) *models.FileEntry {
	return &models.FileEntry{
		ID:          row.ID,
		VolumeID:    row.VolumeID,
		Name:        row.Name,
		ParentDirID: int64PtrFromNullInt64(row.ParentDirID),
		Type:        row.Type,
		SizeBytes:   row.SizeBytes,
		Mtime:       row.Mtime,
		Ctime:       row.Ctime,
		Inode:       int64PtrFromNullInt64(row.Inode),
		UID:         int32PtrFromNullInt32(row.Uid),
		GID:         int32PtrFromNullInt32(row.Gid),
		PathHash:    row.PathHash,
		Hidden:      row.Hidden,
		CreatedAt:   row.CreatedAt,
		UpdatedAt:   row.UpdatedAt,
	}
}

// toPostgresCreateFileEntryParams converts a domain FileEntry to PostgreSQL create params
func toPostgresCreateFileEntryParams(entry *models.FileEntry) postgres.CreateFileEntryParams {
	return postgres.CreateFileEntryParams{
		VolumeID:    entry.VolumeID,
		Name:        entry.Name,
		ParentDirID: nullInt64FromInt64Ptr(entry.ParentDirID),
		Type:        entry.Type,
		SizeBytes:   entry.SizeBytes,
		Mtime:       entry.Mtime,
		Ctime:       entry.Ctime,
		Inode:       nullInt64FromInt64Ptr(entry.Inode),
		Uid:         nullInt32FromInt32Ptr(entry.UID),
		Gid:         nullInt32FromInt32Ptr(entry.GID),
		PathHash:    entry.PathHash,
		Hidden:      entry.Hidden,
	}
}

// fromPostgresDirNode converts a PostgreSQL DirNodes row to a domain DirNode
func fromPostgresDirNode(row *postgres.DirNodes) *models.DirNode {
	return &models.DirNode{
		ID:                row.ID,
		VolumeID:          row.VolumeID,
		Name:              row.Name,
		FullPath:          row.FullPath,
		ParentDirID:       int64PtrFromNullInt64(row.ParentDirID),
		Depth:             row.Depth,
		LatestSizeBytes:   row.LatestSizeBytes,
		LatestFileCount:   row.LatestFileCount,
		CreatedAt:         row.CreatedAt,
		UpdatedAt:         row.UpdatedAt,
	}
}

// toPostgresCreateDirNodeParams converts a domain DirNode to PostgreSQL create params
func toPostgresCreateDirNodeParams(node *models.DirNode) postgres.CreateDirNodeParams {
	return postgres.CreateDirNodeParams{
		VolumeID:          node.VolumeID,
		Name:              node.Name,
		FullPath:          node.FullPath,
		ParentDirID:       nullInt64FromInt64Ptr(node.ParentDirID),
		Depth:             node.Depth,
		LatestSizeBytes:   node.LatestSizeBytes,
		LatestFileCount:   node.LatestFileCount,
	}
}

// fromPostgresDirRollup converts a PostgreSQL DirRollups row to a domain DirRollup
func fromPostgresDirRollup(row *postgres.DirRollups) *models.DirRollup {
	return &models.DirRollup{
		ID:         row.ID,
		DirID:      row.DirID,
		SizeBytes:  row.SizeBytes,
		FileCount:  row.FileCount,
		ComputedAt: row.ComputedAt,
		CreatedAt:  row.CreatedAt,
	}
}

// fromPostgresVolume converts a PostgreSQL Volumes row to a domain Volume
func fromPostgresVolume(row *postgres.Volumes) *models.Volume {
	return &models.Volume{
		ID:        int64(row.ID),
		VolumeID:  row.VolumeID,
		Name:      row.Name,
		Driver:    row.Driver,
		Mountpoint: row.Mountpoint,
		IsActive:  boolFromNullBool(row.IsActive),
		CreatedAt: row.CreatedAt,
		UpdatedAt: row.UpdatedAt,
	}
}

// fromPostgresContainer converts a PostgreSQL Containers row to a domain Container
func fromPostgresContainer(row *postgres.Containers) *models.Container {
	return &models.Container{
		ID:          int64(row.ID),
		ContainerID: row.ContainerID,
		Name:        row.Name,
		Image:       row.Image,
		State:       row.State,
		IsActive:    boolFromNullBool(row.IsActive),
		CreatedAt:   row.CreatedAt,
		UpdatedAt:   row.UpdatedAt,
	}
}

// fromPostgresVolumeMount converts a PostgreSQL VolumeMounts row to a domain VolumeMount
func fromPostgresVolumeMount(row *postgres.VolumeMounts) *models.VolumeMount {
	return &models.VolumeMount{
		ID:          int64(row.ID),
		VolumeID:    row.VolumeID,
		ContainerID: row.ContainerID,
		MountPath:   row.MountPath,
		AccessMode:  row.AccessMode,
		IsActive:    boolFromNullBool(row.IsActive),
		CreatedAt:   row.CreatedAt,
		UpdatedAt:   row.UpdatedAt,
	}
}

// Utility functions for type conversions

func int64PtrFromNullInt64(n pgtype.Int8) *int64 {
	if !n.Valid {
		return nil
	}
	return &n.Int64
}

func nullInt64FromInt64Ptr(i *int64) pgtype.Int8 {
	if i == nil {
		return pgtype.Int8{Valid: false}
	}
	return pgtype.Int8{Int64: *i, Valid: true}
}

func int32PtrFromNullInt32(n pgtype.Int4) *int32 {
	if !n.Valid {
		return nil
	}
	return &n.Int32
}

func nullInt32FromInt32Ptr(i *int32) pgtype.Int4 {
	if i == nil {
		return pgtype.Int4{Valid: false}
	}
	return pgtype.Int4{Int32: *i, Valid: true}
}

func boolFromNullBool(n pgtype.Bool) bool {
	if !n.Valid {
		return false
	}
	return n.Bool
}

func nullBoolFromBool(b bool) pgtype.Bool {
	return pgtype.Bool{Bool: b, Valid: true}
}