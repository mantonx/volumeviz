package middleware

import (
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	// HTTP request duration histogram
	httpDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name: "http_request_duration_seconds",
			Help: "Duration of HTTP requests in seconds",
			Buckets: []float64{
				0.001, // 1ms
				0.005, // 5ms
				0.01,  // 10ms
				0.025, // 25ms
				0.05,  // 50ms
				0.1,   // 100ms
				0.25,  // 250ms
				0.5,   // 500ms
				1.0,   // 1s
				2.5,   // 2.5s
				5.0,   // 5s
			},
		},
		[]string{"method", "path", "status"},
	)

	// HTTP request counter
	httpRequestsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "http_requests_total",
			Help: "Total number of HTTP requests",
		},
		[]string{"method", "path", "status"},
	)

	// HTTP request size histogram
	httpRequestSize = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "http_request_size_bytes",
			Help:    "Size of HTTP requests in bytes",
			Buckets: prometheus.ExponentialBuckets(100, 10, 7), // 100B to 100MB
		},
		[]string{"method", "path"},
	)

	// HTTP response size histogram
	httpResponseSize = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "http_response_size_bytes",
			Help:    "Size of HTTP responses in bytes",
			Buckets: prometheus.ExponentialBuckets(100, 10, 7), // 100B to 100MB
		},
		[]string{"method", "path", "status"},
	)

	// Active requests gauge
	httpRequestsInFlight = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "http_requests_in_flight",
			Help: "Number of HTTP requests currently being processed",
		},
		[]string{"method", "path"},
	)

	// Database query duration histogram
	dbQueryDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "database_query_duration_seconds",
			Help:    "Duration of database queries in seconds",
			Buckets: prometheus.DefBuckets,
		},
		[]string{"query_type", "table"},
	)

	// WebSocket connections gauge
	wsConnectionsActive = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "websocket_connections_active",
			Help: "Number of active WebSocket connections",
		},
	)

	// API-specific metrics
	volumeScanDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "volume_scan_duration_seconds",
			Help:    "Duration of volume scan operations in seconds",
			Buckets: []float64{1, 5, 10, 30, 60, 120, 300, 600}, // Up to 10 minutes
		},
		[]string{"volume_id", "scan_type"},
	)

	volumeScanErrors = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "volume_scan_errors_total",
			Help: "Total number of volume scan errors",
		},
		[]string{"volume_id", "error_type"},
	)
)

// MetricsMiddleware records HTTP metrics for Prometheus
func MetricsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Skip metrics endpoint to avoid recursion
		if c.Request.URL.Path == "/metrics" {
			c.Next()
			return
		}

		// Get normalized path for metrics (avoid high cardinality)
		path := normalizePath(c.FullPath())
		if path == "" {
			path = "unknown"
		}

		method := c.Request.Method

		// Track in-flight requests
		httpRequestsInFlight.WithLabelValues(method, path).Inc()
		defer httpRequestsInFlight.WithLabelValues(method, path).Dec()

		// Record request size
		requestSize := float64(c.Request.ContentLength)
		if requestSize > 0 {
			httpRequestSize.WithLabelValues(method, path).Observe(requestSize)
		}

		// Start timer
		start := time.Now()

		// Process request
		c.Next()

		// Calculate duration
		duration := time.Since(start).Seconds()
		status := strconv.Itoa(c.Writer.Status())

		// Record metrics
		httpDuration.WithLabelValues(method, path, status).Observe(duration)
		httpRequestsTotal.WithLabelValues(method, path, status).Inc()

		// Record response size
		responseSize := float64(c.Writer.Size())
		if responseSize > 0 {
			httpResponseSize.WithLabelValues(method, path, status).Observe(responseSize)
		}

		// Add custom headers for debugging (optional)
		c.Header("X-Response-Time", strconv.FormatFloat(duration*1000, 'f', 2, 64)+"ms")
		c.Header("X-Request-ID", c.GetString("RequestID"))
	}
}

// normalizePath normalizes the path to avoid high cardinality metrics
func normalizePath(path string) string {
	if path == "" {
		return ""
	}

	// Common patterns to normalize
	patterns := map[string]string{
		"/api/v1/volumes/:id":              "/api/v1/volumes/{id}",
		"/api/v1/volumes/:id/size":         "/api/v1/volumes/{id}/size",
		"/api/v1/volumes/:id/size/refresh": "/api/v1/volumes/{id}/size/refresh",
		"/api/v1/scans/:id":                "/api/v1/scans/{id}",
		"/api/v1/scans/:id/status":         "/api/v1/scans/{id}/status",
	}

	if normalized, ok := patterns[path]; ok {
		return normalized
	}

	return path
}

// RecordDatabaseQuery records database query metrics
func RecordDatabaseQuery(queryType, table string, duration time.Duration) {
	dbQueryDuration.WithLabelValues(queryType, table).Observe(duration.Seconds())
}

// RecordVolumeScan records volume scan metrics
func RecordVolumeScan(volumeID, scanType string, duration time.Duration, err error) {
	volumeScanDuration.WithLabelValues(volumeID, scanType).Observe(duration.Seconds())

	if err != nil {
		// Categorize errors for better insights
		var errorType string
		switch {
		case err.Error() == "volume not found":
			errorType = "not_found"
		case err.Error() == "permission denied":
			errorType = "permission_denied"
		case err.Error() == "timeout":
			errorType = "timeout"
		default:
			errorType = "other"
		}
		volumeScanErrors.WithLabelValues(volumeID, errorType).Inc()
	}
}

// UpdateWebSocketConnections updates the active WebSocket connections gauge
func UpdateWebSocketConnections(delta float64) {
	wsConnectionsActive.Add(delta)
}

// WebSocketMetrics provides WebSocket-specific metrics helpers
type WebSocketMetrics struct {
	messagesReceived *prometheus.CounterVec
	messagesSent     *prometheus.CounterVec
	messageErrors    *prometheus.CounterVec
}

// NewWebSocketMetrics creates WebSocket metrics
func NewWebSocketMetrics() *WebSocketMetrics {
	return &WebSocketMetrics{
		messagesReceived: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Name: "websocket_messages_received_total",
				Help: "Total number of WebSocket messages received",
			},
			[]string{"message_type"},
		),
		messagesSent: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Name: "websocket_messages_sent_total",
				Help: "Total number of WebSocket messages sent",
			},
			[]string{"message_type"},
		),
		messageErrors: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Name: "websocket_message_errors_total",
				Help: "Total number of WebSocket message errors",
			},
			[]string{"error_type"},
		),
	}
}

// RecordMessageReceived records a received WebSocket message
func (m *WebSocketMetrics) RecordMessageReceived(messageType string) {
	m.messagesReceived.WithLabelValues(messageType).Inc()
}

// RecordMessageSent records a sent WebSocket message
func (m *WebSocketMetrics) RecordMessageSent(messageType string) {
	m.messagesSent.WithLabelValues(messageType).Inc()
}

// RecordMessageError records a WebSocket message error
func (m *WebSocketMetrics) RecordMessageError(errorType string) {
	m.messageErrors.WithLabelValues(errorType).Inc()
}
