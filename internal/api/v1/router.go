package v1

import (
	"log"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/mantonx/volumeviz/internal/api/middleware"
	"github.com/mantonx/volumeviz/internal/api/v1/database"
	"github.com/mantonx/volumeviz/internal/api/v1/health"
	"github.com/mantonx/volumeviz/internal/api/v1/scan"
	"github.com/mantonx/volumeviz/internal/api/v1/system"
	"github.com/mantonx/volumeviz/internal/api/v1/volumes"
	"github.com/mantonx/volumeviz/internal/core/interfaces"
	"github.com/mantonx/volumeviz/internal/core/models"
	"github.com/mantonx/volumeviz/internal/core/services/cache"
	"github.com/mantonx/volumeviz/internal/core/services/metrics"
	"github.com/mantonx/volumeviz/internal/core/services/scanner"
	databasePkg "github.com/mantonx/volumeviz/internal/database"
	"github.com/mantonx/volumeviz/internal/services"
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
}

// NewRouter creates a new v1 API router
func NewRouter(dockerService *services.DockerService, database *databasePkg.DB) *Router {
	// Initialize the scanner with all dependencies
	logger := log.New(os.Stdout, "[SCANNER] ", log.LstdFlags)
	cache := cache.NewMemoryCache(1000)

	// Use Prometheus metrics for production monitoring
	metricsCollector := metrics.NewPrometheusMetricsCollector(
		"volumeviz",
		"scanner",
		prometheus.Labels{"instance": "main"},
	)

	config := models.DefaultConfig()

	volumeScanner := scanner.NewVolumeScanner(
		dockerService,
		cache,
		metricsCollector,
		logger,
		config,
	)

	router := &Router{
		engine:        gin.New(),
		dockerService: dockerService,
		scanner:       volumeScanner,
		database:      database,
	}

	router.setupMiddleware()
	router.setupRoutes()

	return router
}

// Engine returns the underlying Gin engine
func (r *Router) Engine() *gin.Engine {
	return r.engine
}

// setupMiddleware configures all middleware for the router
func (r *Router) setupMiddleware() {
	// Core middleware
	r.engine.Use(gin.Logger())
	r.engine.Use(gin.Recovery())

	// Custom middleware
	r.engine.Use(middleware.ErrorHandler())
	r.engine.Use(middleware.DockerErrorHandler())

	// CORS middleware for development
	r.engine.Use(func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	})
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
		// Register sub-routers
		healthRouter := health.NewRouter(r.dockerService)
		healthRouter.RegisterRoutes(v1)

		volumesRouter := volumes.NewRouter(r.dockerService)
		volumesRouter.RegisterRoutes(v1)

		systemRouter := system.NewRouter(r.dockerService)
		systemRouter.RegisterRoutes(v1)

		scanRouter := scan.NewRouter(r.scanner)
		scanRouter.RegisterRoutes(v1)

		databaseRouter := database.NewRouter(r.database)
		databaseRouter.RegisterRoutes(v1)
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
