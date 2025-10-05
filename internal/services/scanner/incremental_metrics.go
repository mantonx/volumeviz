package scanner

import (
	"time"
)

// IncrementalScanMetrics tracks performance metrics for incremental scanning
type IncrementalScanMetrics struct {
	VolumeID           string
	ScanMethod         string // "full" or "incremental"
	PrevSnapshotID     int64
	PrevSnapshotAge    time.Duration
	DetectionDuration  time.Duration
	ChangedDirectories int
	AddedDirectories   int
	DeletedDirectories int
	UnchangedDirs      int
	TotalDirectories   int
	SnapshotDuration   time.Duration
	TimeSaved          time.Duration // Estimated time saved vs full scan
	SpaceSavings       float64       // Percentage of volume not rescanned
}

// CalculateTimeSavings estimates time saved by incremental scan
func (m *IncrementalScanMetrics) CalculateTimeSavings(estimatedFullScanTime time.Duration) {
	if m.ScanMethod == "incremental" && m.TotalDirectories > 0 {
		unchangedRatio := float64(m.UnchangedDirs) / float64(m.TotalDirectories)
		m.TimeSaved = time.Duration(float64(estimatedFullScanTime) * unchangedRatio)
		m.SpaceSavings = unchangedRatio * 100
	}
}

// IncrementalMetricsCollector collects and aggregates incremental scan metrics
type IncrementalMetricsCollector struct {
	totalIncrementalScans int64
	totalFullScans        int64
	totalTimeSaved        time.Duration
	totalChangesDetected  int64
	avgChangedRatio       float64
}

// NewIncrementalMetricsCollector creates a new metrics collector
func NewIncrementalMetricsCollector() *IncrementalMetricsCollector {
	return &IncrementalMetricsCollector{}
}

// RecordScan records metrics from a scan
func (c *IncrementalMetricsCollector) RecordScan(metrics IncrementalScanMetrics) {
	if metrics.ScanMethod == "incremental" {
		c.totalIncrementalScans++
		c.totalTimeSaved += metrics.TimeSaved
		c.totalChangesDetected += int64(metrics.ChangedDirectories)

		if metrics.TotalDirectories > 0 {
			changeRatio := float64(metrics.ChangedDirectories) / float64(metrics.TotalDirectories)
			// Running average
			c.avgChangedRatio = (c.avgChangedRatio*float64(c.totalIncrementalScans-1) + changeRatio) / float64(c.totalIncrementalScans)
		}
	} else {
		c.totalFullScans++
	}
}

// GetStats returns aggregate statistics
func (c *IncrementalMetricsCollector) GetStats() map[string]interface{} {
	return map[string]interface{}{
		"total_incremental_scans": c.totalIncrementalScans,
		"total_full_scans":        c.totalFullScans,
		"total_time_saved":        c.totalTimeSaved.String(),
		"total_changes_detected":  c.totalChangesDetected,
		"avg_changed_ratio":       c.avgChangedRatio,
		"incremental_usage_pct":   c.getIncrementalUsagePercent(),
	}
}

func (c *IncrementalMetricsCollector) getIncrementalUsagePercent() float64 {
	total := c.totalIncrementalScans + c.totalFullScans
	if total == 0 {
		return 0
	}
	return (float64(c.totalIncrementalScans) / float64(total)) * 100
}
