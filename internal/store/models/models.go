package models

import (
	"time"

	"github.com/mantonx/volumeviz/internal/store/interfaces"
)

// Re-export all model types from interfaces for convenience
// This allows users to import models separately from interfaces

// File-related models
type (
	FileEntry       = interfaces.FileEntry
	VolumeFileStats = interfaces.VolumeFileStats
)

// Directory-related models
type (
	DirNode     = interfaces.DirNode
	DirRollup   = interfaces.DirRollup
	RollupStats = interfaces.RollupStats
)

// Docker-related models
type (
	Volume      = interfaces.Volume
	Container   = interfaces.Container
	VolumeMount = interfaces.VolumeMount
)

// Analytics-related models
type (
	UsageSnapshot             = interfaces.UsageSnapshot
	CreateUsageSnapshotParams = interfaces.CreateUsageSnapshotParams
	TrendData                 = interfaces.TrendData
	GrowthDeltasResult        = interfaces.GrowthDeltasResult
	StepSeriesPoint           = interfaces.StepSeriesPoint
	TrendSlopeResult          = interfaces.TrendSlopeResult
	RollupOptions             = interfaces.RollupOptions
	RollupResult              = interfaces.RollupResult
)

// Parameters
type (
	BulkInsertParams            = interfaces.BulkInsertParams
	GetGrowthDeltasParams       = interfaces.GetGrowthDeltasParams
	GetVolumeStepSeriesParams   = interfaces.GetVolumeStepSeriesParams
	GetTrendSlopeParams         = interfaces.GetTrendSlopeParams
)

// Helper functions for working with model data

// NewFileEntry creates a new FileEntry with default values
func NewFileEntry(volumeID, name string) *FileEntry {
	now := time.Now()
	return &FileEntry{
		VolumeID:  volumeID,
		Name:      name,
		Type:      "file",
		Hidden:    false,
		CreatedAt: now,
		UpdatedAt: now,
	}
}

// NewDirNode creates a new DirNode with default values
func NewDirNode(volumeID, name, fullPath string, depth int32) *DirNode {
	now := time.Now()
	return &DirNode{
		VolumeID:  volumeID,
		Name:      name,
		FullPath:  fullPath,
		Depth:     depth,
		CreatedAt: now,
		UpdatedAt: now,
	}
}

// NewVolume creates a new Volume with default values
func NewVolume(volumeID, name, driver string) *Volume {
	now := time.Now()
	return &Volume{
		VolumeID:  volumeID,
		Name:      name,
		Driver:    driver,
		IsActive:  true,
		CreatedAt: now,
		UpdatedAt: now,
	}
}

// NewContainer creates a new Container with default values
func NewContainer(containerID, name, image string) *Container {
	now := time.Now()
	return &Container{
		ContainerID: containerID,
		Name:        name,
		Image:       image,
		State:       "created",
		IsActive:    false,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
}

// NewVolumeMount creates a new VolumeMount with default values
func NewVolumeMount(volumeID, containerID, mountPath string) *VolumeMount {
	now := time.Now()
	return &VolumeMount{
		VolumeID:    volumeID,
		ContainerID: containerID,
		MountPath:   mountPath,
		AccessMode:  "rw",
		IsActive:    true,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
}