package metrics

import (
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/username/volumeviz/internal/core/interfaces"
)

// PrometheusMetricsCollector implements metrics collection using Prometheus
type PrometheusMetricsCollector struct {
	// Cache metrics
	cacheHitsTotal   prometheus.Counter
	cacheMissesTotal prometheus.Counter
	cacheSize        prometheus.Gauge

	// Scan metrics
	scanDurationHistogram    prometheus.HistogramVec
	scanAttemptsTotal        prometheus.CounterVec
	scanSuccessTotal         prometheus.CounterVec
	scanFailuresTotal        prometheus.CounterVec
	scanQueueDepthGauge      prometheus.Gauge
	scanSizeHistogram        prometheus.HistogramVec
	scansInProgressGauge     prometheus.GaugeVec

	// Volume metrics
	volumeTotalSizeGauge     prometheus.GaugeVec
	volumeFileCountGauge     prometheus.GaugeVec
	volumeScanTimestampGauge prometheus.GaugeVec

	// System metrics
	dockerConnectionStatus prometheus.Gauge
	activeScanners          prometheus.Gauge
}

// NewPrometheusMetricsCollector creates a new Prometheus metrics collector
func NewPrometheusMetricsCollector(namespace, subsystem string, labels prometheus.Labels) interfaces.MetricsCollector {
	return &PrometheusMetricsCollector{
		// Cache metrics
		cacheHitsTotal: promauto.NewCounter(prometheus.CounterOpts{
			Namespace:   namespace,
			Subsystem:   subsystem,
			Name:        "cache_hits_total",
			Help:        "Total number of cache hits for volume scans",
			ConstLabels: labels,
		}),

		cacheMissesTotal: promauto.NewCounter(prometheus.CounterOpts{
			Namespace:   namespace,
			Subsystem:   subsystem,
			Name:        "cache_misses_total",
			Help:        "Total number of cache misses for volume scans",
			ConstLabels: labels,
		}),

		cacheSize: promauto.NewGauge(prometheus.GaugeOpts{
			Namespace:   namespace,
			Subsystem:   subsystem,
			Name:        "cache_size",
			Help:        "Current number of items in the scan cache",
			ConstLabels: labels,
		}),

		// Scan duration histogram with appropriate buckets for volume scanning
		scanDurationHistogram: *promauto.NewHistogramVec(prometheus.HistogramOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "scan_duration_seconds",
			Help:      "Duration of volume scans in seconds",
			Buckets:   []float64{0.1, 0.5, 1, 5, 10, 30, 60, 120, 300, 600, 1200}, // Up to 20 minutes
			ConstLabels: labels,
		}, []string{"method", "volume_id", "filesystem_type"}),

		scanAttemptsTotal: *promauto.NewCounterVec(prometheus.CounterOpts{
			Namespace:   namespace,
			Subsystem:   subsystem,
			Name:        "scan_attempts_total",
			Help:        "Total number of scan attempts",
			ConstLabels: labels,
		}, []string{"method"}),

		scanSuccessTotal: *promauto.NewCounterVec(prometheus.CounterOpts{
			Namespace:   namespace,
			Subsystem:   subsystem,
			Name:        "scan_success_total",
			Help:        "Total number of successful scans",
			ConstLabels: labels,
		}, []string{"method"}),

		scanFailuresTotal: *promauto.NewCounterVec(prometheus.CounterOpts{
			Namespace:   namespace,
			Subsystem:   subsystem,
			Name:        "scan_failures_total",
			Help:        "Total number of failed scans",
			ConstLabels: labels,
		}, []string{"method", "error_code"}),

		scanQueueDepthGauge: promauto.NewGauge(prometheus.GaugeOpts{
			Namespace:   namespace,
			Subsystem:   subsystem,
			Name:        "scan_queue_depth",
			Help:        "Current depth of the scan queue",
			ConstLabels: labels,
		}),

		// Size histogram with buckets appropriate for volume sizes
		scanSizeHistogram: *promauto.NewHistogramVec(prometheus.HistogramOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "volume_size_bytes",
			Help:      "Size of scanned volumes in bytes",
			Buckets: []float64{
				1024,           // 1KB
				1024 * 1024,    // 1MB
				100 * 1024 * 1024, // 100MB
				1024 * 1024 * 1024, // 1GB
				10 * 1024 * 1024 * 1024,  // 10GB
				100 * 1024 * 1024 * 1024, // 100GB
				1024 * 1024 * 1024 * 1024, // 1TB
				10 * 1024 * 1024 * 1024 * 1024, // 10TB
				100 * 1024 * 1024 * 1024 * 1024, // 100TB
			},
			ConstLabels: labels,
		}, []string{"volume_id", "method", "filesystem_type"}),

		scansInProgressGauge: *promauto.NewGaugeVec(prometheus.GaugeOpts{
			Namespace:   namespace,
			Subsystem:   subsystem,
			Name:        "scans_in_progress",
			Help:        "Number of scans currently in progress",
			ConstLabels: labels,
		}, []string{"method"}),

		// Volume-specific metrics
		volumeTotalSizeGauge: *promauto.NewGaugeVec(prometheus.GaugeOpts{
			Namespace:   namespace,
			Subsystem:   subsystem,
			Name:        "volume_total_size_bytes",
			Help:        "Total size of each volume in bytes",
			ConstLabels: labels,
		}, []string{"volume_id", "volume_name", "driver"}),

		volumeFileCountGauge: *promauto.NewGaugeVec(prometheus.GaugeOpts{
			Namespace:   namespace,
			Subsystem:   subsystem,
			Name:        "volume_file_count",
			Help:        "Number of files in each volume",
			ConstLabels: labels,
		}, []string{"volume_id", "volume_name"}),

		volumeScanTimestampGauge: *promauto.NewGaugeVec(prometheus.GaugeOpts{
			Namespace:   namespace,
			Subsystem:   subsystem,
			Name:        "volume_last_scan_timestamp",
			Help:        "Unix timestamp of last successful scan for each volume",
			ConstLabels: labels,
		}, []string{"volume_id", "method"}),

		// System health metrics
		dockerConnectionStatus: promauto.NewGauge(prometheus.GaugeOpts{
			Namespace:   namespace,
			Subsystem:   subsystem,
			Name:        "docker_connection_status",
			Help:        "Status of Docker daemon connection (1=connected, 0=disconnected)",
			ConstLabels: labels,
		}),

		activeScanners: promauto.NewGauge(prometheus.GaugeOpts{
			Namespace:   namespace,
			Subsystem:   subsystem,
			Name:        "active_scanners",
			Help:        "Number of active scanner goroutines",
			ConstLabels: labels,
		}),
	}
}

// CacheHit records a cache hit
func (p *PrometheusMetricsCollector) CacheHit(volumeID string) {
	p.cacheHitsTotal.Inc()
}

// CacheMiss records a cache miss
func (p *PrometheusMetricsCollector) CacheMiss(volumeID string) {
	p.cacheMissesTotal.Inc()
}

// ScanCompleted records a completed scan with comprehensive metrics
func (p *PrometheusMetricsCollector) ScanCompleted(volumeID, method string, duration time.Duration, size int64) {
	// Record scan success
	p.scanSuccessTotal.WithLabelValues(method).Inc()
	
	// Record scan duration
	p.scanDurationHistogram.WithLabelValues(method, volumeID, "unknown").Observe(duration.Seconds())
	
	// Record volume size distribution
	p.scanSizeHistogram.WithLabelValues(volumeID, method, "unknown").Observe(float64(size))
	
	// Update volume-specific metrics
	p.volumeTotalSizeGauge.WithLabelValues(volumeID, volumeID, "unknown").Set(float64(size))
	p.volumeScanTimestampGauge.WithLabelValues(volumeID, method).SetToCurrentTime()
}

// RecordScanAttempt records a scan attempt
func (p *PrometheusMetricsCollector) RecordScanAttempt(method string, duration time.Duration, success bool) {
	p.scanAttemptsTotal.WithLabelValues(method).Inc()
	
	if success {
		p.scanSuccessTotal.WithLabelValues(method).Inc()
	} else {
		p.scanFailuresTotal.WithLabelValues(method, "unknown").Inc()
	}
}

// ScanQueueDepth records the current scan queue depth
func (p *PrometheusMetricsCollector) ScanQueueDepth(depth int) {
	p.scanQueueDepthGauge.Set(float64(depth))
}

// RecordScanFailure records a scan failure with error context
func (p *PrometheusMetricsCollector) RecordScanFailure(method, errorCode string) {
	p.scanFailuresTotal.WithLabelValues(method, errorCode).Inc()
}

// UpdateVolumeMetrics updates comprehensive volume metrics
func (p *PrometheusMetricsCollector) UpdateVolumeMetrics(volumeID, volumeName, driver, filesystemType string, size int64, fileCount int, scanMethod string) {
	p.volumeTotalSizeGauge.WithLabelValues(volumeID, volumeName, driver).Set(float64(size))
	p.volumeFileCountGauge.WithLabelValues(volumeID, volumeName).Set(float64(fileCount))
	p.volumeScanTimestampGauge.WithLabelValues(volumeID, scanMethod).SetToCurrentTime()
}

// SetDockerConnectionStatus updates Docker connection health
func (p *PrometheusMetricsCollector) SetDockerConnectionStatus(connected bool) {
	if connected {
		p.dockerConnectionStatus.Set(1)
	} else {
		p.dockerConnectionStatus.Set(0)
	}
}

// SetCacheSize updates cache size metric
func (p *PrometheusMetricsCollector) SetCacheSize(size int) {
	p.cacheSize.Set(float64(size))
}

// SetActiveScanners updates active scanners count
func (p *PrometheusMetricsCollector) SetActiveScanners(count int) {
	p.activeScanners.Set(float64(count))
}

// ScanStarted records when a scan starts
func (p *PrometheusMetricsCollector) ScanStarted(method string) {
	p.scansInProgressGauge.WithLabelValues(method).Inc()
}

// ScanFinished records when a scan finishes (success or failure)
func (p *PrometheusMetricsCollector) ScanFinished(method string) {
	p.scansInProgressGauge.WithLabelValues(method).Dec()
}