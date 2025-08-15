package v1

import (
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/mantonx/volumeviz/internal/api/middleware"
	"github.com/mantonx/volumeviz/internal/api/v1/alerts"
	"github.com/mantonx/volumeviz/internal/api/v1/explorer"
	"github.com/mantonx/volumeviz/internal/api/v1/health"
	"github.com/mantonx/volumeviz/internal/api/v1/metadata"
	"github.com/mantonx/volumeviz/internal/api/v1/scan"
	"github.com/mantonx/volumeviz/internal/api/v1/stats"
	"github.com/mantonx/volumeviz/internal/api/v1/system"
	"github.com/mantonx/volumeviz/internal/api/v1/trends"
	"github.com/mantonx/volumeviz/internal/api/v1/volumes"
	"github.com/mantonx/volumeviz/internal/config"
	"github.com/mantonx/volumeviz/internal/core/interfaces"
	"github.com/mantonx/volumeviz/internal/events"
	oldInterfaces "github.com/mantonx/volumeviz/internal/interfaces"
	"github.com/mantonx/volumeviz/internal/models"
	"github.com/mantonx/volumeviz/internal/realtime"
	"github.com/mantonx/volumeviz/internal/scheduler"
	alertsService "github.com/mantonx/volumeviz/internal/services/alerts"
	"github.com/mantonx/volumeviz/internal/services/cache"
	dockerService "github.com/mantonx/volumeviz/internal/services/docker"
	coreMetrics "github.com/mantonx/volumeviz/internal/services/metrics"
	"github.com/mantonx/volumeviz/internal/services/scanner"
	statsService "github.com/mantonx/volumeviz/internal/services/stats"
	"github.com/mantonx/volumeviz/internal/store"
	"github.com/mantonx/volumeviz/internal/websocket"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
)

// Router manages all v1 API routes
type Router struct {
	engine            *gin.Engine
	dockerService     *dockerService.DockerService
	scanner           oldInterfaces.VolumeScanner
	store             store.Store // Modern store interface using sqlc
	websocketHub      *websocket.Hub
	realtimePublisher *realtime.Publisher
	scheduler         scheduler.ScanScheduler // Optional scan scheduler - using store façade
	eventsService     events.EventService     // Optional events service - using store façade
	alertsEngine      interfaces.AlertEngine  // Alerts engine for alert management
	healthRouter      *health.Router          // Health router for external access
}

// NewRouter creates a new v1 API router
func NewRouter(dockerSvc *dockerService.DockerService, storeInstance store.Store, config *config.Config) *Router {
	// Initialize WebSocket hub
	hub := websocket.NewHub()
	go hub.Run()

	// Initialize real-time publisher
	publisher := realtime.NewPublisher(hub)

	// Initialize the scanner with all dependencies
	logger := log.New(os.Stdout, "[SCANNER] ", log.LstdFlags)
	cache := cache.NewMemoryCache(1000)

	// Use Prometheus metrics for production monitoring
	metricsCollector := coreMetrics.NewPrometheusMetricsCollector(
		"volumeviz",
		"scanner",
		prometheus.Labels{"instance": "main"},
	)

	// Use default scanner config for now
	scannerConfig := models.DefaultConfig()

	volumeScanner := scanner.NewVolumeScanner(
		dockerSvc,
		cache,
		metricsCollector,
		logger,
		scannerConfig,
	)

	// Initialize scan scheduler if enabled - using store façade
	var scanScheduler scheduler.ScanScheduler
	if config.Scan.Enabled {
		// Create scheduler repository from store
		scanRepository := scheduler.NewScanRepository(storeInstance)
		if scanRepository == nil {
			log.Printf("Warning: Could not create scan repository, scan scheduler disabled")
		} else {
		
			// Create scheduler config
			schedulerConfig := scheduler.NewSchedulerConfig(&config.Scan)
			
			// Create volume provider
			volumeProvider := scheduler.NewDockerVolumeProvider(dockerSvc)
			
			// Create scheduler
			sch, err := scheduler.NewScheduler(
				schedulerConfig,
				volumeScanner,
				scanRepository,
				volumeProvider,
				metricsCollector,
				storeInstance,
			)
			if err != nil {
				log.Printf("[ERROR] Failed to create scan scheduler: %v", err)
			} else {
				scanScheduler = sch
				log.Printf("[INFO] Scan scheduler initialized successfully")
			}
		}
	}

	// Initialize events service if enabled - using store interface
	var eventsService events.EventService
	if config.Events.Enabled {
		// Get raw Docker client for events processing
		dockerClient := dockerSvc.GetDockerClient()
		
		// Create events metrics collector
		eventsMetrics := events.NewEventMetricsCollector(
			"volumeviz",
			"events",
			prometheus.Labels{"instance": "main"},
		)
		
		// Create event handler service (implements EventProcessor)
		// Use store-based repository implementation
		eventsRepo := events.NewStoreRepository(storeInstance)
		eventHandler := events.NewEventHandlerService(
			dockerClient,
			eventsRepo,
			eventsMetrics,
			publisher,
		)
		
		// Create reconciler service
		// Use store-based repository implementation
		reconciler := events.NewReconcilerService(
			dockerClient,
			eventsRepo,
			&config.Events,
			&events.EventMetrics{
				ProcessedTotal:    make(map[events.EventType]int64),
				ErrorsTotal:       make(map[string]int64),
				DroppedTotal:      0,
				ReconnectsTotal:   0,
				ReconcileRuns:     make(map[string]int64),
				LastEventTime:     nil,
				LastReconnectTime: nil,
				Connected:         false,
				QueueSize:         0,
			},
			eventsMetrics,
		)
		
		// Create events client (implements EventService)
		eventsClient := events.NewEventsClient(
			dockerClient,
			&config.Events,
			eventHandler, // EventProcessor
			reconciler,   // Reconciler
			eventsMetrics,
		)
		
		eventsService = eventsClient
		log.Printf("[INFO] Events service initialized successfully")
	}

	// Initialize alerts engine if enabled
	var alertsEngine interfaces.AlertEngine
	if config.Alerts.Enabled {
		// Create alerts engine config
		engineConfig := &alertsService.EngineConfig{
			EvaluationInterval: time.Duration(config.Alerts.EvaluationIntervalMinutes) * time.Minute,
			DeliveryWorkers:    config.Alerts.DeliveryWorkers,
			Enabled:           true,
		}

		// Create alerts engine
		alertsEngine = alertsService.NewAlertEngine(storeInstance, engineConfig)
		log.Printf("[INFO] Alerts engine initialized successfully")
	}

	router := &Router{
		engine:            gin.New(),
		dockerService:     dockerSvc,
		scanner:           volumeScanner,
		store:             storeInstance,
		websocketHub:      hub,
		realtimePublisher: publisher,
		scheduler:         scanScheduler,
		eventsService:     eventsService,
		alertsEngine:      alertsEngine,
	}

	router.setupMiddleware(config)
	router.setupRoutes()

	return router
}

// Engine returns the underlying Gin engine
func (r *Router) Engine() *gin.Engine {
	return r.engine
}

// GetWebSocketHub returns the WebSocket hub for broadcasting messages
func (r *Router) GetWebSocketHub() *websocket.Hub {
	return r.websocketHub
}

// GetRealtimePublisher returns the real-time event publisher
func (r *Router) GetRealtimePublisher() *realtime.Publisher {
	return r.realtimePublisher
}

// EventsService returns the events service if configured
func (r *Router) EventsService() events.EventService {
	return r.eventsService
}

// Scheduler returns the scan scheduler if configured
func (r *Router) Scheduler() scheduler.ScanScheduler {
	return r.scheduler
}

// setupMiddleware configures all middleware for the router
func (r *Router) setupMiddleware(config *config.Config) {
	// Core middleware
	r.engine.Use(gin.Logger())
	r.engine.Use(gin.Recovery())

	// Metrics middleware (should be early in the chain)
	r.engine.Use(middleware.MetricsMiddleware())

	// Custom middleware
	r.engine.Use(middleware.ErrorHandler())
	r.engine.Use(middleware.DockerErrorHandler())

	// Performance middleware
	r.engine.Use(middleware.GzipDefault()) // Add response compression
	r.engine.Use(middleware.CacheControl()) // Add smart caching headers

	// Security middleware
	r.engine.Use(middleware.RequestIDMiddleware())
	r.engine.Use(middleware.SecurityHeadersMiddleware(nil)) // Use defaults

	// CORS middleware with configuration
	corsConfig := &middleware.CORSConfig{
		AllowedOrigins:   config.CORS.AllowedOrigins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-Requested-With"},
		ExposedHeaders:   []string{"X-Request-ID"},
		AllowCredentials: false,
		MaxAge:           300,
		SkipPaths:        []string{"/api/v1/health", "/health", "/metrics"},
	}
	r.engine.Use(middleware.CORSMiddleware(corsConfig))

	// Rate limiting with tiered limits for heavy operations
	tieredRateLimitConfig := &middleware.TieredRateLimitConfig{
		Enabled:   config.RateLimit.Enabled,
		KeyFunc:   middleware.DefaultKeyFunc,
		SkipPaths: []string{"/api/v1/health", "/health", "/metrics"},

		// Standard endpoints: 120 RPM, 60 burst
		DefaultRPM:   config.RateLimit.RPM,
		DefaultBurst: config.RateLimit.Burst,

		// Heavy operations: 30 RPM, 10 burst (scans, refreshes)
		HeavyRPM:   30,
		HeavyBurst: 10,

		// Admin operations: 10 RPM, 5 burst (migrations)
		AdminRPM:   10,
		AdminBurst: 5,

		// Critical operations: 2 RPM, 1 burst (bulk scan all)
		CriticalRPM:   2,
		CriticalBurst: 1,
	}
	r.engine.Use(middleware.TieredRateLimitMiddleware(tieredRateLimitConfig))

	// Error budget tracking for 5xx errors with circuit breaker
	errorBudgetConfig := &middleware.ErrorBudgetConfig{
		Enabled:        true,
		WindowDuration: time.Hour,        // 1 hour window
		ErrorThreshold: 100,              // 100 5xx errors per hour max
		CircuitBreaker: true,             // Enable circuit breaker
		RecoveryTime:   time.Minute * 10, // 10 minute recovery
	}
	r.engine.Use(middleware.ErrorBudgetMiddleware(errorBudgetConfig))

	// Authentication middleware (if enabled)
	authConfig := &middleware.AuthConfig{
		Enabled:      config.Auth.Enabled,
		Secret:       config.Auth.Secret,
		RequiredRole: middleware.RoleViewer,
		SkipPaths: []string{
			"/api/v1/health",
			"/health",
			"/metrics",
			"/api/docs",
			"/openapi",
		},
	}
	r.engine.Use(middleware.AuthMiddleware(authConfig))
}

// setupRoutes configures all API routes
func (r *Router) setupRoutes() {
	// Root health endpoint for load balancers
	r.engine.GET("/", r.getRootHealth)

	// Prometheus metrics endpoint
	r.engine.GET("/metrics", gin.WrapH(promhttp.Handler()))

	// Serve OpenAPI specification directly at /openapi route
	r.engine.Static("/openapi", "./docs")

	// Swagger documentation endpoint at /api/docs as per requirements
	// Configure to use our OpenAPI 3.0 specification
	r.engine.GET("/api/docs/*any", ginSwagger.WrapHandler(
		swaggerFiles.Handler,
		ginSwagger.URL("/openapi/openapi.yaml"),
	))

	// API v1 routes
	v1 := r.engine.Group("/api/v1")
	{
		// WebSocket endpoint
		websocketHandler := websocket.NewHandler(r.websocketHub)
		websocketHandler.RegisterRoutes(v1)

		// Register sub-routers with store interface
		r.healthRouter = health.NewRouter(r.dockerService, r.store, r.eventsService, r.scheduler)
		r.healthRouter.RegisterRoutes(v1)

		volumesRouter := volumes.NewRouter(r.dockerService, r.websocketHub, r.store, r.realtimePublisher)
		volumesRouter.RegisterRoutes(v1)

		// Explorer router for directory browsing and file operations
		explorer.RegisterRoutes(v1, r.store)

		// File metadata router for detailed file information
		metadata.RegisterRoutes(v1, r.store)

		systemRouter := system.NewRouter(r.dockerService)
		systemRouter.RegisterRoutes(v1)

		scanRouter := scan.NewRouter(r.scanner, r.websocketHub, r.store, r.scheduler, r.realtimePublisher)
		scanRouter.RegisterRoutes(v1)

		// Note: Database admin API removed as part of database cleanup
		// Database operations now handled through store facade

		// Note: Metrics API temporarily removed during database cleanup

		// Initialize StatsService for trends API
		statsRepo := r.store.Stats()
		logger := log.New(os.Stdout, "[STATS] ", log.LstdFlags)
		metricsCollector := coreMetrics.NewPrometheusMetricsCollector(
			"volumeviz",
			"stats", 
			prometheus.Labels{"instance": "main"},
		)
		statsSvc := statsService.NewStatsService(statsRepo, metricsCollector, logger)

		// Trends router with Store interface and StatsService
		trendsRouter := trends.NewRouter(r.store, statsSvc)
		trendsRouter.RegisterRoutes(v1)

		// Stats router with StatsService integration
		statsRouter := stats.NewStatsRouter(r.store, statsSvc)
		stats.RegisterRoutes(v1, r.store, statsSvc)
		statsRouter.RegisterRoutes(v1)

		// Alerts router if alerts engine is available
		if r.alertsEngine != nil {
			alertsRouter := alerts.NewRouter(r.store, r.alertsEngine)
			alertsRouter.RegisterRoutes(v1)
		}
	}
}

// getRootHealth provides a simple health check for load balancers
func (r *Router) getRootHealth(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":  "ok",
		"service": "volumeviz",
		"version": "v1",
	})
}

// GetHealthHandler returns the health handler for external configuration
func (r *Router) GetHealthHandler() *health.Handler {
	if r.healthRouter != nil {
		return r.healthRouter.GetHandler()
	}
	return nil
}

// createStoreInstance is no longer needed - using store directly
// Store instance is now passed in during router construction
