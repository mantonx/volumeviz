package v1

import (
	"context"
	"log"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/mantonx/volumeviz/internal/api/middleware"
	"github.com/mantonx/volumeviz/internal/api/v1/database"
	"github.com/mantonx/volumeviz/internal/api/v1/health"
	"github.com/mantonx/volumeviz/internal/api/v1/metrics"
	"github.com/mantonx/volumeviz/internal/api/v1/scan"
	"github.com/mantonx/volumeviz/internal/api/v1/system"
	"github.com/mantonx/volumeviz/internal/api/v1/volumes"
	"github.com/mantonx/volumeviz/internal/config"
	"github.com/mantonx/volumeviz/internal/core/interfaces"
	"github.com/mantonx/volumeviz/internal/core/models"
	"github.com/mantonx/volumeviz/internal/core/services/cache"
	coreMetrics "github.com/mantonx/volumeviz/internal/core/services/metrics"
	"github.com/mantonx/volumeviz/internal/core/services/scanner"
	databasePkg "github.com/mantonx/volumeviz/internal/database"
	"github.com/mantonx/volumeviz/internal/events"
	"github.com/mantonx/volumeviz/internal/scheduler"
	"github.com/mantonx/volumeviz/internal/services"
	"github.com/mantonx/volumeviz/internal/websocket"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
)

// Router manages all v1 API routes
type Router struct {
	engine        *gin.Engine
	dockerService *services.DockerService
	scanner       interfaces.VolumeScanner
	database      *databasePkg.DB
	websocketHub  *websocket.Hub
	scheduler     scheduler.ScanScheduler // Optional scan scheduler
	eventsService events.EventService    // Optional events service
}

// NewRouter creates a new v1 API router
func NewRouter(dockerService *services.DockerService, database *databasePkg.DB, config *config.Config) *Router {
	// Initialize WebSocket hub
	hub := websocket.NewHub()
	go hub.Run()

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
		dockerService,
		cache,
		metricsCollector,
		logger,
		scannerConfig,
	)

	// Initialize scan scheduler if enabled
	var scanScheduler scheduler.ScanScheduler
	if config.Scan.Enabled {
		schedulerConfig := scheduler.NewSchedulerConfig(&config.Scan)
		
		// Create repository and volume provider for the scheduler
		repository := scheduler.NewRepository(database)
		volumeProvider := scheduler.NewVolumeProvider(repository)
		
		schedulerInstance, err := scheduler.NewScheduler(
			schedulerConfig,
			volumeScanner,
			repository,
			volumeProvider,
			metricsCollector,
		)
		if err != nil {
			log.Printf("[WARN] Failed to initialize scan scheduler: %v", err)
		} else {
			scanScheduler = schedulerInstance
			// Start the scheduler
			if err := scanScheduler.Start(context.Background()); err != nil {
				log.Printf("[ERROR] Failed to start scan scheduler: %v", err)
			} else {
				log.Printf("[INFO] Scan scheduler started")
			}
		}
	}

	// Initialize events service if enabled
	var eventsService events.EventService
	if config.Events.Enabled {
		// Create event repository
		eventRepo := databasePkg.NewEventRepository(database)
		
		// Create event metrics collector
		eventMetrics := events.NewEventMetricsCollector(
			"volumeviz",
			"events",
			prometheus.Labels{"instance": "main"},
		)
		
		// Create Docker client adapter for events service
		dockerClient := services.NewDockerClientAdapter(dockerService)
		
		// Create event handler service
		eventHandler := events.NewEventHandlerService(dockerClient, eventRepo, eventMetrics)
		
		// Create event reconciler
		eventReconcileMetrics := &events.EventMetrics{
			ProcessedTotal: make(map[events.EventType]int64),
			ErrorsTotal:    make(map[string]int64),
			ReconcileRuns:  make(map[string]int64),
		}
		eventReconciler := events.NewReconcilerService(dockerClient, eventRepo, &config.Events, eventReconcileMetrics, eventMetrics)
		
		// Create events client
		eventsClient := events.NewEventsClient(dockerClient, &config.Events, eventHandler, eventReconciler, eventMetrics)
		eventsService = eventsClient
		
		log.Printf("[INFO] Docker events integration initialized")
	}

	router := &Router{
		engine:        gin.New(),
		dockerService: dockerService,
		scanner:       volumeScanner,
		database:      database,
		websocketHub:  hub,
		scheduler:     scanScheduler,
		eventsService: eventsService,
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

	// Custom middleware
	r.engine.Use(middleware.ErrorHandler())
	r.engine.Use(middleware.DockerErrorHandler())

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
	}
	r.engine.Use(middleware.CORSMiddleware(corsConfig))

	// Rate limiting
	rateLimitConfig := &middleware.RateLimitConfig{
		Enabled:   config.RateLimit.Enabled,
		RPM:       config.RateLimit.RPM,
		Burst:     config.RateLimit.Burst,
		SkipPaths: []string{"/api/v1/health", "/health", "/metrics"},
		KeyFunc:   middleware.DefaultKeyFunc,
	}
	r.engine.Use(middleware.RateLimitMiddleware(rateLimitConfig))

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

		// Register sub-routers
		healthRouter := health.NewRouter(r.dockerService, r.database, r.eventsService, r.scheduler)
		healthRouter.RegisterRoutes(v1)

		volumesRouter := volumes.NewRouter(r.dockerService, r.websocketHub, r.database)
		volumesRouter.RegisterRoutes(v1)

		systemRouter := system.NewRouter(r.dockerService)
		systemRouter.RegisterRoutes(v1)

		scanRouter := scan.NewRouter(r.scanner, r.websocketHub, r.database, r.scheduler)
		scanRouter.RegisterRoutes(v1)

		databaseRouter := database.NewRouter(r.database)
		databaseRouter.RegisterRoutes(v1)

		// Initialize metrics router with database access
		metricsRouter := metrics.New(r.database)
		metricsRouter.RegisterRoutes(v1)
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
