package events

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

// EventMetricsCollector provides Prometheus metrics for Docker events
type EventMetricsCollector struct {
	// Event processing metrics
	eventsProcessedTotal prometheus.CounterVec
	eventsFailedTotal    prometheus.CounterVec
	eventsDroppedTotal   prometheus.Counter
	eventQueueSize       prometheus.Gauge
	
	// Connection and streaming metrics
	eventsConnectionStatus   prometheus.Gauge
	eventsReconnectsTotal    prometheus.Counter
	eventsStreamDuration     prometheus.Histogram
	eventsLastEventTime      prometheus.Gauge
	eventsLastReconnectTime  prometheus.Gauge
	
	// Reconciliation metrics
	reconciliationRunsTotal    prometheus.CounterVec
	reconciliationDuration     prometheus.HistogramVec
	reconciliationFailuresTotal prometheus.CounterVec
	reconciliationLastRunTime   prometheus.GaugeVec
	
	// Volume/Container sync metrics
	volumesSyncedTotal      prometheus.CounterVec
	containersSyncedTotal   prometheus.CounterVec
	mountsSyncedTotal       prometheus.CounterVec
	resourcesRemovedTotal   prometheus.CounterVec
}

// NewEventMetricsCollector creates a new Prometheus metrics collector for events
func NewEventMetricsCollector(namespace, subsystem string, labels prometheus.Labels) *EventMetricsCollector {
	return &EventMetricsCollector{
		// Event processing metrics
		eventsProcessedTotal: *promauto.NewCounterVec(prometheus.CounterOpts{
			Namespace:   namespace,
			Subsystem:   subsystem,
			Name:        "docker_events_processed_total",
			Help:        "Total number of Docker events processed by type",
			ConstLabels: labels,
		}, []string{"event_type", "action"}),

		eventsFailedTotal: *promauto.NewCounterVec(prometheus.CounterOpts{
			Namespace:   namespace,
			Subsystem:   subsystem,
			Name:        "docker_events_failed_total", 
			Help:        "Total number of failed Docker event processing attempts",
			ConstLabels: labels,
		}, []string{"error_type", "event_type"}),

		eventsDroppedTotal: promauto.NewCounter(prometheus.CounterOpts{
			Namespace:   namespace,
			Subsystem:   subsystem,
			Name:        "docker_events_dropped_total",
			Help:        "Total number of dropped Docker events due to queue overflow",
			ConstLabels: labels,
		}),

		eventQueueSize: promauto.NewGauge(prometheus.GaugeOpts{
			Namespace:   namespace,
			Subsystem:   subsystem,
			Name:        "docker_events_queue_size",
			Help:        "Current number of events in the processing queue",
			ConstLabels: labels,
		}),

		// Connection and streaming metrics
		eventsConnectionStatus: promauto.NewGauge(prometheus.GaugeOpts{
			Namespace:   namespace,
			Subsystem:   subsystem,
			Name:        "docker_events_connection_status",
			Help:        "Status of Docker events stream connection (1=connected, 0=disconnected)",
			ConstLabels: labels,
		}),

		eventsReconnectsTotal: promauto.NewCounter(prometheus.CounterOpts{
			Namespace:   namespace,
			Subsystem:   subsystem,
			Name:        "docker_events_reconnects_total",
			Help:        "Total number of Docker events stream reconnections",
			ConstLabels: labels,
		}),

		eventsStreamDuration: promauto.NewHistogram(prometheus.HistogramOpts{
			Namespace:   namespace,
			Subsystem:   subsystem,
			Name:        "docker_events_stream_duration_seconds",
			Help:        "Duration of Docker events stream connections",
			Buckets:     []float64{1, 10, 60, 300, 900, 3600, 10800, 21600, 43200, 86400}, // 1s to 1 day
			ConstLabels: labels,
		}),

		eventsLastEventTime: promauto.NewGauge(prometheus.GaugeOpts{
			Namespace:   namespace,
			Subsystem:   subsystem,
			Name:        "docker_events_last_event_timestamp",
			Help:        "Unix timestamp of the last processed Docker event",
			ConstLabels: labels,
		}),

		eventsLastReconnectTime: promauto.NewGauge(prometheus.GaugeOpts{
			Namespace:   namespace,
			Subsystem:   subsystem,
			Name:        "docker_events_last_reconnect_timestamp",
			Help:        "Unix timestamp of the last Docker events stream reconnection",
			ConstLabels: labels,
		}),

		// Reconciliation metrics
		reconciliationRunsTotal: *promauto.NewCounterVec(prometheus.CounterOpts{
			Namespace:   namespace,
			Subsystem:   subsystem,
			Name:        "docker_reconciliation_runs_total",
			Help:        "Total number of reconciliation runs by type",
			ConstLabels: labels,
		}, []string{"reconciliation_type"}),

		reconciliationDuration: *promauto.NewHistogramVec(prometheus.HistogramOpts{
			Namespace:   namespace,
			Subsystem:   subsystem,
			Name:        "docker_reconciliation_duration_seconds",
			Help:        "Duration of reconciliation operations",
			Buckets:     []float64{0.1, 0.5, 1, 5, 10, 30, 60, 120, 300}, // 100ms to 5min
			ConstLabels: labels,
		}, []string{"reconciliation_type"}),

		reconciliationFailuresTotal: *promauto.NewCounterVec(prometheus.CounterOpts{
			Namespace:   namespace,
			Subsystem:   subsystem,
			Name:        "docker_reconciliation_failures_total",
			Help:        "Total number of failed reconciliation attempts",
			ConstLabels: labels,
		}, []string{"reconciliation_type", "error_type"}),

		reconciliationLastRunTime: *promauto.NewGaugeVec(prometheus.GaugeOpts{
			Namespace:   namespace,
			Subsystem:   subsystem,
			Name:        "docker_reconciliation_last_run_timestamp",
			Help:        "Unix timestamp of last reconciliation run by type",
			ConstLabels: labels,
		}, []string{"reconciliation_type"}),

		// Resource sync metrics
		volumesSyncedTotal: *promauto.NewCounterVec(prometheus.CounterOpts{
			Namespace:   namespace,
			Subsystem:   subsystem,
			Name:        "docker_volumes_synced_total",
			Help:        "Total number of volumes synced by operation type",
			ConstLabels: labels,
		}, []string{"operation", "source"}),

		containersSyncedTotal: *promauto.NewCounterVec(prometheus.CounterOpts{
			Namespace:   namespace,
			Subsystem:   subsystem,
			Name:        "docker_containers_synced_total",
			Help:        "Total number of containers synced by operation type",
			ConstLabels: labels,
		}, []string{"operation", "source"}),

		mountsSyncedTotal: *promauto.NewCounterVec(prometheus.CounterOpts{
			Namespace:   namespace,
			Subsystem:   subsystem,
			Name:        "docker_mounts_synced_total",
			Help:        "Total number of volume mounts synced by operation type",
			ConstLabels: labels,
		}, []string{"operation", "source"}),

		resourcesRemovedTotal: *promauto.NewCounterVec(prometheus.CounterOpts{
			Namespace:   namespace,
			Subsystem:   subsystem,
			Name:        "docker_resources_removed_total",
			Help:        "Total number of resources removed during sync operations",
			ConstLabels: labels,
		}, []string{"resource_type", "source"}),
	}
}

// Event Processing Metrics

func (m *EventMetricsCollector) RecordEventProcessed(eventType EventType, action string) {
	m.eventsProcessedTotal.WithLabelValues(string(eventType), action).Inc()
}

func (m *EventMetricsCollector) RecordEventFailed(errorType string, eventType EventType) {
	m.eventsFailedTotal.WithLabelValues(errorType, string(eventType)).Inc()
}

func (m *EventMetricsCollector) RecordEventDropped() {
	m.eventsDroppedTotal.Inc()
}

func (m *EventMetricsCollector) SetEventQueueSize(size int) {
	m.eventQueueSize.Set(float64(size))
}

func (m *EventMetricsCollector) SetLastEventTime(timestamp float64) {
	m.eventsLastEventTime.Set(timestamp)
}

// Connection Metrics

func (m *EventMetricsCollector) SetConnectionStatus(connected bool) {
	if connected {
		m.eventsConnectionStatus.Set(1)
	} else {
		m.eventsConnectionStatus.Set(0)
	}
}

func (m *EventMetricsCollector) RecordReconnect() {
	m.eventsReconnectsTotal.Inc()
	m.eventsLastReconnectTime.SetToCurrentTime()
}

func (m *EventMetricsCollector) RecordStreamDuration(durationSeconds float64) {
	m.eventsStreamDuration.Observe(durationSeconds)
}

// Reconciliation Metrics

func (m *EventMetricsCollector) RecordReconciliationRun(reconciliationType string, durationSeconds float64) {
	m.reconciliationRunsTotal.WithLabelValues(reconciliationType).Inc()
	m.reconciliationDuration.WithLabelValues(reconciliationType).Observe(durationSeconds)
	m.reconciliationLastRunTime.WithLabelValues(reconciliationType).SetToCurrentTime()
}

func (m *EventMetricsCollector) RecordReconciliationFailure(reconciliationType, errorType string) {
	m.reconciliationFailuresTotal.WithLabelValues(reconciliationType, errorType).Inc()
}

// Resource Sync Metrics

func (m *EventMetricsCollector) RecordVolumeSync(operation, source string) {
	m.volumesSyncedTotal.WithLabelValues(operation, source).Inc()
}

func (m *EventMetricsCollector) RecordContainerSync(operation, source string) {
	m.containersSyncedTotal.WithLabelValues(operation, source).Inc()
}

func (m *EventMetricsCollector) RecordMountSync(operation, source string) {
	m.mountsSyncedTotal.WithLabelValues(operation, source).Inc()
}

func (m *EventMetricsCollector) RecordResourceRemoved(resourceType, source string) {
	m.resourcesRemovedTotal.WithLabelValues(resourceType, source).Inc()
}