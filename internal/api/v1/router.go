package v1

import (
	"context"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/mantonx/volumeviz/internal/api/middleware"
	"github.com/mantonx/volumeviz/internal/api/v1/aggregate"
	"github.com/mantonx/volumeviz/internal/api/v1/alerts"
	authAPI "github.com/mantonx/volumeviz/internal/api/v1/auth"
	"github.com/mantonx/volumeviz/internal/api/v1/diag"
	"github.com/mantonx/volumeviz/internal/api/v1/explorer"
	"github.com/mantonx/volumeviz/internal/api/v1/health"
	"github.com/mantonx/volumeviz/internal/api/v1/metadata"
	"github.com/mantonx/volumeviz/internal/api/v1/mounts"
	"github.com/mantonx/volumeviz/internal/api/v1/organizations"
	previewsAPI "github.com/mantonx/volumeviz/internal/api/v1/previews"
	"github.com/mantonx/volumeviz/internal/api/v1/rules"
	"github.com/mantonx/volumeviz/internal/api/v1/scan"
	schedulerAPI "github.com/mantonx/volumeviz/internal/api/v1/scheduler"
	"github.com/mantonx/volumeviz/internal/api/v1/search"
	"github.com/mantonx/volumeviz/internal/api/v1/snapshots"
	"github.com/mantonx/volumeviz/internal/api/v1/stats"
	"github.com/mantonx/volumeviz/internal/api/v1/system"
	"github.com/mantonx/volumeviz/internal/api/v1/trends"
	"github.com/mantonx/volumeviz/internal/api/v1/users"
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
	"github.com/mantonx/volumeviz/internal/security"
	alertsService "github.com/mantonx/volumeviz/internal/services/alerts"
	"github.com/mantonx/volumeviz/internal/services/cache"
	dockerService "github.com/mantonx/volumeviz/internal/services/docker"
	"github.com/mantonx/volumeviz/internal/services/enrichers"
	"github.com/mantonx/volumeviz/internal/services/filesystem"
	coreMetrics "github.com/mantonx/volumeviz/internal/services/metrics"
	previewsService "github.com/mantonx/volumeviz/internal/services/previews"
	"github.com/mantonx/volumeviz/internal/services/retention"
	rulesService "github.com/mantonx/volumeviz/internal/services/rules"
	jobScheduler "github.com/mantonx/volumeviz/internal/services/scheduler"
	"github.com/mantonx/volumeviz/internal/services/scanner"
	statsService "github.com/mantonx/volumeviz/internal/services/stats"
	"github.com/mantonx/volumeviz/internal/store"
	"github.com/mantonx/volumeviz/internal/audit"
	authServices "github.com/mantonx/volumeviz/internal/auth"
	authServicePkg "github.com/mantonx/volumeviz/internal/services/auth"
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
	progressBroadcaster *realtime.Broadcaster                  // Progress broadcaster (Phase 3)
	volumesHandler      *volumes.Handler                       // Volumes handler (Phase 3)
	scheduler           scheduler.ScanScheduler                // Optional scan scheduler - using store façade
	jobScheduler        *jobScheduler.Scheduler                // Job scheduler for periodic tasks
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
	authService         *authServicePkg.Service                // Auth service for login/register
	organizationService organizationsService.Service           // Organization management service
	jwtManager          *authUtils.JWTManager                  // JWT manager for authentication
}

// NewRouter creates a new v1 API router
func NewRouter(dockerSvc *dockerService.DockerService, storeInstance store.Store, config *config.Config) *Router {
	// Initialize JWT manager if secret is provided (needed for auth endpoints and WebSocket authentication)
	var jwtManager *authUtils.JWTManager
	if config.Auth.Secret != "" {
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

	// Create realtime service with JWT manager and configured allowed origins for WebSockets
	realtimeService := realtime.NewRealtimeServiceWithOrigins(storeInstance, jwtManager, config.CORS.AllowedOrigins)

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

	// Create scanner config from main config with resilience settings
	scannerConfig := models.DefaultConfig()
	scannerConfig.Scanning.RetryEnabled = config.Scan.RetryEnabled
	scannerConfig.Scanning.RetryMaxAttempts = config.Scan.RetryMaxAttempts
	scannerConfig.Scanning.RetryInitialBackoff = config.Scan.RetryInitialBackoff
	scannerConfig.Scanning.RetryMaxBackoff = config.Scan.RetryMaxBackoff
	scannerConfig.Scanning.PerMethodTimeout = config.Scan.PerMethodTimeout
	scannerConfig.Scanning.OverallTimeout = config.Scan.OverallTimeout
	scannerConfig.Scanning.IndexingTimeout = config.Scan.IndexingTimeout
	scannerConfig.Scanning.CircuitBreakerEnabled = config.Scan.CircuitBreakerEnabled

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

				// Set enrichment manager on scheduler if available
				if enrichmentManager != nil {
					sch.SetEnrichmentManager(enrichmentManager)
					log.Printf("[INFO] Media enrichment manager integrated with scan scheduler")
				}

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
	mountCatalogService := dockerService.NewMountCatalogService(dockerClient, queries, storeInstance)

	// Get PostgreSQL pool for services that need it
	pgStore := storeInstance.(*store.PostgreSQLStore)
	pool := pgStore.GetPool()

	// Initialize audit logger
	auditLogger := audit.NewLogger(pool)
	log.Printf("[INFO] Audit logger initialized successfully")

	// Initialize permission checker
	permissionChecker := authServices.NewPermissionChecker(pool)
	log.Printf("[INFO] Permission checker initialized successfully")

	// Initialize auth service
	authService := authServicePkg.NewService(storeInstance.Users(), config.Auth.Secret)
	log.Printf("[INFO] Auth service initialized successfully")

	// Initialize organization service
	organizationService := organizationsService.NewService(queries, auditLogger)
	log.Printf("[INFO] Organization service initialized successfully")

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

	// Initialize job scheduler for periodic tasks
	var sched *jobScheduler.Scheduler
	if config.Retention.Enabled || config.Scan.IncrementalEnabled {
		sched = jobScheduler.New()
		log.Printf("[INFO] Job scheduler initialized")

		// Create and register retention job
		if config.Retention.Enabled {
			retentionRepo := storeInstance.Retention()
			retentionJob := retention.NewJob(retentionRepo, &config.Retention)

			if err := sched.Register(
				retentionJob,
				config.Retention.CleanupInterval,
				config.Retention.RunOnStartup,
			); err != nil {
				log.Printf("[ERROR] Failed to register retention job: %v", err)
			} else {
				log.Printf("[INFO] Retention job registered (interval: %v, run on startup: %v)",
					config.Retention.CleanupInterval, config.Retention.RunOnStartup)
			}
		}

		// Create and register snapshot cleanup job
		if config.Scan.IncrementalEnabled {
			snapshotJob := scanner.NewSnapshotCleanupJob(storeInstance, config.Scan.SnapshotRetentionDays)

			// Use the same cleanup interval as retention (daily by default)
			cleanupInterval := 24 * time.Hour
			if config.Retention.Enabled {
				cleanupInterval = config.Retention.CleanupInterval
			}

			if err := sched.Register(
				snapshotJob,
				cleanupInterval,
				config.Retention.RunOnStartup, // Use same setting as retention
			); err != nil {
				log.Printf("[ERROR] Failed to register snapshot cleanup job: %v", err)
			} else {
				log.Printf("[INFO] Snapshot cleanup job registered (retention: %d days, interval: %v)",
					config.Scan.SnapshotRetentionDays, cleanupInterval)
			}
		}

		// Start the scheduler
		sched.Start()
		log.Printf("[INFO] Job scheduler started")
	}

	router := &Router{
		engine:              gin.New(),
		dockerService:       dockerSvc,
		mountCatalogService: mountCatalogService,
		scanner:             volumeScanner,
		store:               storeInstance,
		realtimeService:     realtimeService,
		progressBroadcaster: progressBroadcaster, // Phase 3
		scheduler:           scanScheduler,
		jobScheduler:        sched,
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
		authService:         authService,
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

// JobScheduler returns the job scheduler if configured
func (r *Router) JobScheduler() *jobScheduler.Scheduler {
	return r.jobScheduler
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
		SkipPaths:        []string{"/metrics", "/", "/api/v1/health", "/api/v1/health/database", "/health"}, // Skip health and metrics endpoints
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
		"/api/v1/ws", // WebSocket endpoint handles its own authentication
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
		// Auth routes (only enable if JWT manager is available)
		if r.jwtManager != nil {
			authRouter := authAPI.NewRouter(r.store, r.authService)
			// Auth endpoints always require JWT validation (independent of global AUTH_ENABLED)
			authConfig := middleware.NewAuthConfig(r.jwtManager, true)
			authConfig.SkipPaths = []string{} // No skip paths - let the router handle public vs protected
			authMiddleware := middleware.AuthMiddleware(authConfig)
			authRouter.RegisterRoutes(v1, authMiddleware)
			log.Printf("[INFO] Auth routes registered")
		} else {
			log.Printf("[WARNING] Auth routes not registered - JWT manager not initialized (set AUTH_HS256_SECRET env var)")
		}

		// Organization middleware setup
		orgMiddleware := middleware.NewOrganizationMiddlewareWithAuth(r.store, config.Auth.Enabled)

		// Security middleware for admin-only routes
		// Note: RequireSystemAdmin() only checks user_role from context, so DB is not needed
		_ = security.NewSecurityMiddleware(nil, r.store) // unused for now

		// Organization routes
		if r.jwtManager != nil {
			organizationRouter := organizations.NewRouter(r.store, r.organizationService)
			authConfig := middleware.NewAuthConfig(r.jwtManager, true)
			authMiddleware := middleware.AuthMiddleware(authConfig)
			organizationRouter.RegisterRoutes(v1, authMiddleware)
			log.Printf("[INFO] Organization routes registered")

			// Users management routes (admin only)
			usersRouter := users.NewRouter(r.store)
			usersRouter.RegisterRoutes(v1, authMiddleware)
			log.Printf("[INFO] Users management routes registered")
		} else {
			log.Printf("[WARNING] Organization routes not registered - JWT manager not initialized")
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
			volumesRouter := volumes.NewRouterWithScanner(r.dockerService, r.store, r.progressBroadcaster, r.scanner)
			volumesRouter.RegisterRoutes(orgScopedRoutes)

			// Store volumes handler for Phase 3 integration
			r.volumesHandler = volumesRouter.Handler()

			// Explorer router for directory browsing and file operations - organization scoped
			explorer.RegisterRoutes(orgScopedRoutes, r.store)

			// Aggregate router for visualization data - organization scoped
			aggregateHandler := aggregate.NewHandler(r.store)
			aggregateHandler.RegisterRoutes(orgScopedRoutes)

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
			statsSvc := statsService.NewStatsService(statsRepo, r.store, metricsCollector, logger)

			// Trends router with Store interface and StatsService - organization scoped
			trendsRouter := trends.NewRouter(r.store, statsSvc)
			trendsRouter.RegisterRoutes(orgScopedRoutes)

			// Stats router with StatsService integration - organization scoped
			statsRouter := stats.NewStatsRouter(r.store, statsSvc)
			statsRouter.RegisterRoutes(orgScopedRoutes)

			// Search router for advanced file search and saved searches - organization scoped
			searchRouter := search.NewRouter(r.store)
			searchRouter.RegisterRoutes(orgScopedRoutes)

			// Snapshots router for incremental scanning snapshot management - organization scoped
			if config.Scan.IncrementalEnabled {
				snapshotsHandler := snapshots.NewHandler(r.store)
				snapshotsHandler.RegisterRoutes(orgScopedRoutes)
				log.Printf("[INFO] Snapshots API routes registered successfully (organization-scoped)")
			}

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

			// Scheduler routes for job management
			if r.jobScheduler != nil {
				schedulerHandler := schedulerAPI.NewHandler(r.jobScheduler)
				schedulerHandler.RegisterRoutes(orgScopedRoutes)
				log.Printf("[INFO] Scheduler API routes registered successfully (organization-scoped)")
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

// VolumesHandler returns the volumes handler (Phase 3)
func (r *Router) VolumesHandler() *volumes.Handler {
	return r.volumesHandler
}

// RealtimePublisher returns the progress broadcaster (Phase 3)
func (r *Router) RealtimePublisher() *realtime.Broadcaster {
	return r.progressBroadcaster
}

// createStoreInstance is no longer needed - using store directly
// Store instance is now passed in during router construction
