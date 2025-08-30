package store

import (
	"github.com/mantonx/volumeviz/internal/db/sqlc"
)

// Type aliases for SQLC-generated types to provide a stable store API
// This bridges the gap between the store interface and SQLC implementation

// Table model aliases
type UsageSnapshot = sqlc.UsageSnapshots
type Volume = sqlc.Volumes
type Container = sqlc.Containers
type VolumeMount = sqlc.VolumeMounts

// Query parameter aliases
type CreateUsageSnapshotParams = sqlc.CreateUsageSnapshotParams
type GetVolumeStepSeriesParams = sqlc.GetVolumeStepSeriesParams
type GetTrendSlopeParams = sqlc.GetTrendSlopeParams
type GetGrowthDeltasParams = sqlc.GetGrowthDeltasParams

// Query result aliases
type TrendData = sqlc.GetVolumeGrowthTrendRow
type StepSeriesPoint = sqlc.GetVolumeStepSeriesRow
type TrendSlope = sqlc.GetTrendSlopeRow
type GrowthDeltas = sqlc.GetGrowthDeltasRow

// Additional commonly used table models  
type StatsDailyRow = sqlc.StatsDaily
type StatsDailyTrendsRow = sqlc.StatsDailyTrends
type StatsJobsRow = sqlc.StatsJobs