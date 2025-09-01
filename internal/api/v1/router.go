package v1

import (
	"context"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/mantonx/volumeviz/internal/api/middleware"
	"github.com/mantonx/volumeviz/internal/api/v1/alerts"
	"github.com/mantonx/volumeviz/internal/api/v1/auth"
	"github.com/mantonx/volumeviz/internal/api/v1/diag"
	"github.com/mantonx/volumeviz/internal/api/v1/explorer"
	"github.com/mantonx/volumeviz/internal/api/v1/health"
	"github.com/mantonx/volumeviz/internal/api/v1/metadata"
	"github.com/mantonx/volumeviz/internal/api/v1/mounts"
	"github.com/mantonx/volumeviz/internal/api/v1/organizations"
	previewsAPI "github.com/mantonx/volumeviz/internal/api/v1/previews"
	"github.com/mantonx/volumeviz/internal/api/v1/rules"
	"github.com/mantonx/volumeviz/internal/api/v1/scan"
	"github.com/mantonx/volumeviz/internal/api/v1/search"
	"github.com/mantonx/volumeviz/internal/api/v1/stats"
	"github.com/mantonx/volumeviz/internal/api/v1/system"
	"github.com/mantonx/volumeviz/internal/api/v1/trends"
	"github.com/mantonx/volumeviz/internal/api/v1/volumes"
	"github.com/mantonx/volumeviz/internal/config"
	volumeConfig "github.com/mantonx/volumeviz/internal/config"
	"github.com/mantonx/volumeviz/internal/core/interfaces"
	"github.com/mantonx/volumeviz/internal/db/sqlc"
	"github.com/mantonx/volumeviz/internal/events"
	oldInterfaces "github.com/mantonx/volumeviz/internal/interfaces"
	"github.com/mantonx/volumeviz/internal/models"
	"github.com/mantonx/volumeviz/internal/realtime"
	"github.com/mantonx/volumeviz/internal/repo"
	"github.com/mantonx/volumeviz/internal/scheduler"
	alertsService "github.com/mantonx/volumeviz/internal/services/alerts"
	"github.com/mantonx/volumeviz/internal/services/cache"
	dockerService "github.com/mantonx/volumeviz/internal/services/docker"
	"github.com/mantonx/volumeviz/internal/services/enrichers"
	"github.com/mantonx/volumeviz/internal/services/filesystem"
	coreMetrics "github.com/mantonx/volumeviz/internal/services/metrics"
	previewsService "github.com/mantonx/volumeviz/internal/services/previews"
	rulesService "github.com/mantonx/volumeviz/internal/services/rules"
	"github.com/mantonx/volumeviz/internal/services/scanner"
	statsService "github.com/mantonx/volumeviz/internal/services/stats"
	"github.com/mantonx/volumeviz/internal/store"
	"github.com/mantonx/volumeviz/internal/audit"
	authServices "github.com/mantonx/volumeviz/internal/auth"
	organizationsService "github.com/mantonx/volumeviz/internal/services/organizations"
	authUtils "github.com/mantonx/volumeviz/internal/utils/auth"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
)

// Router manages all v1 API routes
type Router struct {
	engine              *gin.Engine
	dockerService       *dockerService.DockerService
	mountCatalogService *dockerService.MountCatalogService // Docker mount catalog service
	scanner             oldInterfaces.VolumeScanner
	store               store.Store // Modern store interface using sqlc
	realtimeService     *realtime.RealtimeService
	scheduler           scheduler.ScanScheduler                // Optional scan scheduler - using store façade
	eventsService       events.EventService                    // Optional events service - using store façade
	alertsEngine        interfaces.AlertEngine                 // Alerts engine for alert management
	enrichmentManager   oldInterfaces.EnrichmentManager        // Media enrichment manager
	previewService      *previewsService.Service               // Preview service for file thumbnails
	healthRouter        *health.Router                         // Health router for external access
	rulesRepo           *repo.TrackingRulesRepository          // Rules repository
	mountsRepo          *repo.MountCatalogRepository           // Mount catalog repository
	rulesEngine         *rulesService.TrackingRulesEngine      // Rules engine
	rulesPreviewService *rulesService.EvaluationPreviewService // Rules preview service
	auditLogger         audit.Logger                           // Audit logging service
	permissionChecker   authServices.PermissionChecker        // Permission checking service
	organizationService organizationsService.Service          // Organization management service
	jwtManager          *authUtils.JWTManager                  // JWT manager for authentication
}

// NewRouter creates a new v1 API router
func NewRouter(dockerSvc *dockerService.DockerService, storeInstance store.Store, config *config.Config) *Router {
	// Create realtime service
	realtimeService := realtime.NewRealtimeService(storeInstance)
	
	// Create progress broadcaster for real-time updates
	progressBroadcaster := realtime.NewBroadcaster(realtimeService, storeInstance)

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

	// Set up filesystem indexing repositories and config
	foldersRepo := storeInstance.Folders()
	filesRepo := storeInstance.Files()

	// Create filesystem indexing config from main config
	indexerConfig := filesystem.IndexerConfig{
		EnableHashing:       config.FilesystemIndexing.EnableHashing,
		MaxFileBytesForHash: config.FilesystemIndexing.MaxFileBytesForHash,
		HashAlgorithm:       config.FilesystemIndexing.HashAlgorithm,
		SkipPatterns:        config.FilesystemIndexing.SkipPatterns,
		SkipHidden:          config.FilesystemIndexing.SkipHidden,
		MaxDepth:            config.FilesystemIndexing.MaxDepth,
		DetectMimeTypes:     config.FilesystemIndexing.DetectMimeTypes,
	}

	// Create preview service for generating file previews during scanning
	previewsDir := config.Previews.RootDir
	if previewsDir == "" {
		previewsDir = "./data/previews" // Default for development
	}

	previewConfig := &previewsService.PreviewConfig{
		RootDir:         previewsDir,
		MaxConcurrent:   3,
		ProcessTimeout:  30 * time.Second,
		MaxSourceSizeMB: 500,
		VipsPath:        "vips",
		FFmpegPath:      "ffmpeg",
		SmartCrop:       true,
		CleanupEnabled:  true,
		CleanupInterval: time.Hour,
		MaxAge:          30 * 24 * time.Hour, // 30 days
	}

	previewService, err := previewsService.NewService(previewConfig)
	if err != nil {
		// Log error but don't fail - previews are optional
		log.Printf("Failed to initialize preview service: %v", err)
		previewService = nil
	}

	volumeScannerConcrete := scanner.NewVolumeScannerWithIndexing(
		dockerSvc,
		cache,
		metricsCollector,
		logger,
		scannerConfig,
		foldersRepo,
		filesRepo,
		indexerConfig,
		storeInstance,
		previewService,
	)

	// Set comprehensive progress broadcaster for real-time updates
	if volumeScannerImpl, ok := volumeScannerConcrete.(*scanner.VolumeScanner); ok {
		volumeScannerImpl.SetProgressBroadcaster(progressBroadcaster)
	}

	// Initialize media enrichment manager if enabled
	var enrichmentManager oldInterfaces.EnrichmentManager
	if config.MediaEnrichment.Enabled {
		// Convert config to enricher config
		enricherConfig := enrichers.EnricherConfig{
			Enabled:              config.MediaEnrichment.Enabled,
			MaxConcurrentWorkers: config.MediaEnrichment.MaxConcurrentWorkers,
			TimeoutPerFile:       config.MediaEnrichment.TimeoutPerFile,
			FFprobeEnabled:       config.MediaEnrichment.FFprobeEnabled,
			FFprobePath:          config.MediaEnrichment.FFprobePath,
			FFprobeTimeout:       config.MediaEnrichment.FFprobeTimeout,
			EXIFEnabled:          config.MediaEnrichment.EXIFEnabled,
			EnableGPS:            config.MediaEnrichment.EnableGPS,
			RedactGPS:            config.MediaEnrichment.RedactGPS,
			GPSPrecision:         config.MediaEnrichment.GPSPrecision,
			SubtitleEnabled:      config.MediaEnrichment.SubtitleEnabled,
		}

		// Create enrichment repository
		enrichmentRepo := storeInstance.FileMetadata()

		// Create enrichment manager with logger and volume mapping
		enrichmentLogger := log.New(os.Stdout, "[ENRICHMENT] ", log.LstdFlags)
		volumeMapping := volumeConfig.NewVolumeMappingConfig()
		enrichmentManager = enrichers.NewManagerWithVolumeMapping(enricherConfig, enrichmentRepo, enrichmentLogger, storeInstance, volumeMapping)

		// Set enrichment manager on volume scanner for automatic enrichment after filesystem indexing
		if volumeScannerImpl, ok := volumeScannerConcrete.(*scanner.VolumeScanner); ok {
			volumeScannerImpl.SetEnrichmentManager(enrichmentManager)
			log.Printf("[INFO] Media enrichment manager integrated with volume scanner")
		} else {
			log.Printf("[WARNING] Could not cast volume scanner to concrete type for enrichment integration")
		}

		// Set progress broadcaster on enrichment manager for real-time updates
		if enrichmentManagerImpl, ok := enrichmentManager.(*enrichers.Manager); ok {
			enrichmentManagerImpl.SetProgressBroadcaster(progressBroadcaster)
			log.Printf("[INFO] Progress broadcaster set on enrichment manager")
		}

		log.Printf("[INFO] Media enrichment manager initialized successfully")
	} else {
		log.Printf("[INFO] Media enrichment disabled")
	}

	// Use the concrete scanner as the interface
	volumeScanner := volumeScannerConcrete

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

			// Use the main progress broadcaster created earlier

			// Create scheduler
			sch, err := scheduler.NewScheduler(
				schedulerConfig,
				volumeScanner,
				scanRepository,
				volumeProvider,
				metricsCollector,
				storeInstance,
				progressBroadcaster,
			)
			if err != nil {
				log.Printf("[ERROR] Failed to create scan scheduler: %v", err)
			} else {
				scanScheduler = sch
				log.Printf("[INFO] Scan scheduler initialized successfully")

				// Auto-start the scheduler
				ctx := context.Background()
				if err := sch.Start(ctx); err != nil {
					log.Printf("[ERROR] Failed to start scan scheduler: %v", err)
				} else {
					log.Printf("[INFO] Scan scheduler started successfully")
				}
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
			nil, // Legacy publisher removed
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

	// Initialize Docker mount catalog service
	queries := storeInstance.Queries().(*sqlc.Queries)
	dockerClient := dockerSvc.GetDockerClient()
	mountCatalogService := dockerService.NewMountCatalogService(dockerClient, queries)

	// Initialize audit logger
	auditLogger := audit.NewLogger(queries)
	log.Printf("[INFO] Audit logger initialized successfully")

	// Initialize permission checker
	permissionChecker := authServices.NewPermissionChecker(queries)
	log.Printf("[INFO] Permission checker initialized successfully")

	// Initialize organization service
	organizationService := organizationsService.NewService(queries, auditLogger)
	log.Printf("[INFO] Organization service initialized successfully")

	// Initialize JWT manager if auth is enabled
	var jwtManager *authUtils.JWTManager
	if config.Auth.Enabled && config.Auth.Secret != "" {
		jwtConfig := &authUtils.JWTConfig{
			AccessSecret:      config.Auth.Secret,
			RefreshSecret:     "", // Will use access secret
			AccessExpiration:  15 * time.Minute,
			RefreshExpiration: 7 * 24 * time.Hour,
			Issuer:            "volumeviz",
		}
		jwtManager = authUtils.NewJWTManager(jwtConfig)
		log.Printf("[INFO] JWT manager initialized successfully")
	}

	// Initialize tracking rules repository and services
	// For now, we'll create placeholder services since we need proper database connection setup
	var rulesRepo *repo.TrackingRulesRepository
	var mountsRepo *repo.MountCatalogRepository
	var rulesEngine *rulesService.TrackingRulesEngine
	var rulesPreviewService *rulesService.EvaluationPreviewService

	// These would be properly initialized with a real database connection
	// For development, we'll create minimal instances
	if queries != nil {
		// Create placeholder database connection for development
		// In production, this would use a proper connection pool
		rulesRepo = repo.NewTrackingRulesRepository(queries, nil)
		mountsRepo = repo.NewMountCatalogRepository(queries, nil)
		rulesEngine = rulesService.NewTrackingRulesEngine(rulesRepo, mountsRepo)
		rulesPreviewService = rulesService.NewEvaluationPreviewService(rulesEngine, rulesRepo, mountsRepo)
	}

	// Initialize alerts engine if enabled
	var alertsEngine interfaces.AlertEngine
	if config.Alerts.Enabled {
		// Create alerts engine config
		engineConfig := &alertsService.EngineConfig{
			EvaluationInterval: time.Duration(config.Alerts.EvaluationIntervalMinutes) * time.Minute,
			DeliveryWorkers:    config.Alerts.DeliveryWorkers,
			Enabled:            true,
		}

		// Create alerts engine
		alertsEngine = alertsService.NewAlertEngine(storeInstance, engineConfig)
		log.Printf("[INFO] Alerts engine initialized successfully")
	}

	router := &Router{
		engine:              gin.New(),
		dockerService:       dockerSvc,
		mountCatalogService: mountCatalogService,
		scanner:             volumeScanner,
		store:               storeInstance,
		realtimeService:     realtimeService,
		scheduler:           scanScheduler,
		eventsService:       eventsService,
		alertsEngine:        alertsEngine,
		enrichmentManager:   enrichmentManager,
		previewService:      previewService,
		rulesRepo:           rulesRepo,
		mountsRepo:          mountsRepo,
		rulesEngine:         rulesEngine,
		rulesPreviewService: rulesPreviewService,
		auditLogger:         auditLogger,
		permissionChecker:   permissionChecker,
		organizationService: organizationService,
		jwtManager:          jwtManager,
	}

	router.setupMiddleware(config)
	router.setupRoutes(config)

	return router
}

// Engine returns the underlying Gin engine
func (r *Router) Engine() *gin.Engine {
	return r.engine
}

// GetRealtimeService returns the realtime service for broadcasting messages
func (r *Router) GetRealtimeService() *realtime.RealtimeService {
	return r.realtimeService
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
	r.engine.Use(middleware.GzipDefault())  // Add response compression
	r.engine.Use(middleware.CacheControl()) // Add smart caching headers

	// Security middleware
	r.engine.Use(middleware.RequestIDMiddleware())
	
	// HTTPS redirect middleware (only in production when TLS is enabled)
	r.engine.Use(middleware.HTTPSRedirectMiddleware(config.TLS.Enabled))
	
	// Enhanced security headers with HSTS if TLS is enabled
	securityConfig := &middleware.SecurityConfig{
		ContentTypeOptions:           "nosniff",
		FrameOptions:                 "SAMEORIGIN",
		ReferrerPolicy:               "strict-origin-when-cross-origin",
		ContentSecurityPolicy:        "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' ws: wss:; font-src 'self'; object-src 'none'; media-src 'self'; frame-src 'none';",
		PermittedCrossDomainPolicies: "none",
		HideServerHeader:             true,
	}
	// Add HSTS header if TLS is enabled
	if config.TLS.Enabled {
		securityConfig.StrictTransportSecurity = "max-age=31536000; includeSubDomains; preload"
	}
	r.engine.Use(middleware.SecurityHeadersMiddleware(securityConfig))

	// CORS middleware with configuration
	corsConfig := &middleware.CORSConfig{
		AllowedOrigins:   config.CORS.AllowedOrigins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-Requested-With"},
		ExposedHeaders:   []string{"X-Request-ID"},
		AllowCredentials: false,
		MaxAge:           300,
		SkipPaths:        []string{"/metrics"}, // Only skip metrics, not health endpoints
	}
	r.engine.Use(middleware.CORSMiddleware(corsConfig))

	// Rate limiting with tiered limits for heavy operations
	tieredRateLimitConfig := &middleware.TieredRateLimitConfig{
		Enabled:   config.RateLimit.Enabled,
		KeyFunc:   middleware.DefaultKeyFunc,
		SkipPaths: []string{"/api/v1/health", "/health", "/metrics", "/api/v1/ws", "/api/v1/ws/metrics"},

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
	authConfig := middleware.NewAuthConfig(r.jwtManager, config.Auth.Enabled)
	authConfig.RequiredRole = middleware.RoleViewer
	authConfig.SkipPaths = []string{
		"/api/v1/health",
		"/health",
		"/metrics",
		"/api/docs",
		"/openapi",
		"/api/v1/auth/login",
		"/api/v1/auth/register",
		"/api/v1/auth/password/reset",
		"/api/v1/auth/refresh",
		"/api/v1/auth/csrf",
	}
	r.engine.Use(middleware.AuthMiddleware(authConfig))
}

// setupRoutes configures all API routes
func (r *Router) setupRoutes(config *config.Config) {
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
		if r.realtimeService != nil {
			realtimeHandler := realtime.NewAPIHandler(r.realtimeService)
			realtimeHandler.RegisterRoutes(v1)
		}

		// Diagnostics endpoint
		diagHandler := diag.NewHandler(config)
		diagHandler.RegisterRoutes(v1)

		// Authentication routes (must come before other protected routes)
		authConfig := &middleware.AuthConfig{
			Enabled:      config.Auth.Enabled,
			JWTManager:   r.jwtManager,
			RequiredRole: middleware.RoleViewer,
		}
		auth.RegisterRoutes(v1, r.store, r.jwtManager, authConfig)

		// Organization middleware setup
		orgMiddleware := middleware.NewOrganizationMiddleware(r.store)

		// Organization routes
		organizationHandler := organizations.NewHandler(r.store, r.organizationService)
		orgRoutes := v1.Group("/organizations")
		orgRoutes.Use(orgMiddleware.RequireOrganization())
		{
			orgRoutes.GET("/me", organizationHandler.GetMyOrganization)
			orgRoutes.PUT("/me", organizationHandler.UpdateMyOrganization)
		}

		// Register sub-routers with store interface
		r.healthRouter = health.NewRouter(r.dockerService, r.store, r.eventsService, r.scheduler)
		r.healthRouter.RegisterRoutes(v1)

		// System router (no organization scoping needed)
		systemRouter := system.NewRouter(r.dockerService)
		systemRouter.RegisterRoutes(v1)

		// Organization-scoped routes that require organization context
		orgScopedRoutes := v1.Group("/")
		orgScopedRoutes.Use(orgMiddleware.RequireOrganization())
		{
			// Volumes router - organization scoped
			volumesRouter := volumes.NewRouterWithScanner(r.dockerService, r.store, nil, r.scanner)
			volumesRouter.RegisterRoutes(orgScopedRoutes)

			// Explorer router for directory browsing and file operations - organization scoped
			explorer.RegisterRoutes(orgScopedRoutes, r.store)

			// File metadata router for detailed file information - organization scoped
			metadata.RegisterRoutes(orgScopedRoutes, r.store)

			// Scan router - organization scoped
			scanRouter := scan.NewRouter(r.scanner, r.store, r.scheduler, nil)
			// Set enrichment manager on scan router if available
			if r.enrichmentManager != nil {
				scanRouter.SetEnrichmentManager(r.enrichmentManager)
				log.Printf("[INFO] Enrichment manager set on scan router")
			}
			scanRouter.RegisterRoutes(orgScopedRoutes)

			// Initialize StatsService for trends API
			statsRepo := r.store.Stats()
			logger := log.New(os.Stdout, "[STATS] ", log.LstdFlags)
			metricsCollector := coreMetrics.NewPrometheusMetricsCollector(
				"volumeviz",
				"stats",
				prometheus.Labels{"instance": "main"},
			)
			statsSvc := statsService.NewStatsService(statsRepo, metricsCollector, logger)

			// Trends router with Store interface and StatsService - organization scoped
			trendsRouter := trends.NewRouter(r.store, statsSvc)
			trendsRouter.RegisterRoutes(orgScopedRoutes)

			// Stats router with StatsService integration - organization scoped
			statsRouter := stats.NewStatsRouter(r.store, statsSvc)
			statsRouter.RegisterRoutes(orgScopedRoutes)

			// Search router for advanced file search and saved searches - organization scoped
			searchRouter := search.NewRouter(r.store)
			searchRouter.RegisterRoutes(orgScopedRoutes)

			// Preview router if preview service is available - organization scoped
			if r.previewService != nil {
				previewHandler := previewsAPI.NewHandler(r.previewService, r.store)
				previewsAPI.RegisterRoutes(orgScopedRoutes, previewHandler)
				log.Printf("[INFO] Preview API routes registered successfully (organization-scoped)")
			} else {
				log.Printf("[WARNING] Preview service unavailable - preview routes not registered")
			}

			// Alerts router if alerts engine is available - organization scoped
			if r.alertsEngine != nil {
				alertsRouter := alerts.NewRouter(r.store, r.alertsEngine)
				alertsRouter.RegisterRoutes(orgScopedRoutes)
				log.Printf("[INFO] Alerts API routes registered successfully (organization-scoped)")
			}

			// Tracking rules router for mount tracking rules management - organization scoped
			if r.rulesRepo != nil && r.rulesEngine != nil && r.rulesPreviewService != nil {
				rulesHandler := rules.NewHandler(r.rulesRepo, r.mountsRepo, r.rulesEngine, r.rulesPreviewService)
				rules.SetupRoutes(orgScopedRoutes, rulesHandler)
				log.Printf("[INFO] Tracking rules API routes registered successfully (organization-scoped)")
			} else {
				log.Printf("[WARNING] Tracking rules services unavailable - rules routes not registered")
			}
		}

		// Note: Database admin API removed as part of database cleanup
		// Database operations now handled through store facade

		// Note: Metrics API temporarily removed during database cleanup

		// Mount catalog router for Docker mount discovery and management (global scope - not per organization)
		mountsHandler := mounts.NewHandler(r.mountCatalogService)
		mounts.RegisterRoutes(v1, mountsHandler)
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
