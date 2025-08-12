// Package store provides the new organized store interfaces and backward compatibility
package store

// Re-export interfaces for backward compatibility
import (
	"github.com/mantonx/volumeviz/internal/store/interfaces"
	"github.com/mantonx/volumeviz/internal/store/models"
)

// Re-export all interfaces for backward compatibility
type (
	// Main store interface
	Store = interfaces.Store
	
	// Individual store interfaces
	FileStore          = interfaces.FileStore
	DirectoryStore     = interfaces.DirectoryStore
	RollupStore        = interfaces.RollupStore
	DockerStore        = interfaces.DockerStore
	AnalyticsStore     = interfaces.AnalyticsStore
	InfrastructureStore = interfaces.InfrastructureStore
	TransactionalStore  = interfaces.TransactionalStore
	
	// Transaction function type
	TxFunc = interfaces.TxFunc
)

// Re-export all model types for backward compatibility
type (
	// File models
	FileEntry       = models.FileEntry
	VolumeFileStats = models.VolumeFileStats
	
	// Directory models
	DirNode     = models.DirNode
	DirRollup   = models.DirRollup
	RollupStats = models.RollupStats
	
	// Docker models
	Volume      = models.Volume
	Container   = models.Container
	VolumeMount = models.VolumeMount
	
	// Analytics models
	UsageSnapshot             = models.UsageSnapshot
	CreateUsageSnapshotParams = models.CreateUsageSnapshotParams
	TrendData                 = models.TrendData
	GrowthDeltasResult        = models.GrowthDeltasResult
	StepSeriesPoint           = models.StepSeriesPoint
	TrendSlopeResult          = models.TrendSlopeResult
	RollupOptions             = models.RollupOptions
	RollupResult              = models.RollupResult
	
	// Parameter types
	BulkInsertParams            = models.BulkInsertParams
	GetGrowthDeltasParams       = models.GetGrowthDeltasParams
	GetVolumeStepSeriesParams   = models.GetVolumeStepSeriesParams
	GetTrendSlopeParams         = models.GetTrendSlopeParams
)

// Re-export model constructors for convenience
var (
	NewFileEntry   = models.NewFileEntry
	NewDirNode     = models.NewDirNode
	NewVolume      = models.NewVolume
	NewContainer   = models.NewContainer
	NewVolumeMount = models.NewVolumeMount
)

// Legacy compatibility - keep the StoreFacade reference for existing code
// This will be populated by the facade.go file to maintain backward compatibility
var LegacyStoreFacade interface{}