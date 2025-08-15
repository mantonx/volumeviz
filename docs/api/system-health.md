# System & Health API Reference

The System & Health APIs provide comprehensive monitoring of VolumeViz application health, system information, and infrastructure status. These endpoints are essential for monitoring, troubleshooting, and ensuring system reliability.

## 📋 Overview

**Authentication**: Health endpoints typically don't require authentication (for monitoring tools)
**System endpoints**: May require authentication depending on configuration
**Rate Limits**: Generous limits for monitoring use cases

## 🏥 Health Check Endpoints

Health endpoints provide detailed status information about all system components and dependencies.

### Application Health

Get overall application health including all dependencies and services.

```http
GET /api/v1/health
```

**Example Response:**
```json
{
  "status": "healthy",
  "timestamp": 1692021946,
  "version": "1.2.0",
  "checks": {
    "docker": {
      "status": "healthy",
      "version": "24.0.7",
      "api_version": "1.43"
    },
    "database": {
      "status": "healthy",
      "connection_pool": {
        "active": 5,
        "idle": 10,
        "max": 25
      },
      "last_migration": "20250814_add_metadata_indexes"
    },
    "events": {
      "status": "healthy",
      "connection": "connected",
      "last_event_timestamp": 1692021940,
      "processed_events": 1247,
      "event_buffer_size": 3
    },
    "scheduler": {
      "status": "healthy",
      "running": true,
      "queue_depth": 2,
      "active_scans": 1,
      "worker_count": 4,
      "completed_scans": 1842,
      "failed_scans": 12
    }
  }
}
```

**Status Codes:**
- `200 OK`: All systems healthy
- `206 Partial Content`: Some systems degraded but operational
- `503 Service Unavailable`: Critical systems unavailable

### Docker Health

Check Docker daemon connectivity and version information.

```http
GET /api/v1/health/docker
```

**Example Response:**
```json
{
  "status": "healthy",
  "message": "Docker daemon connected successfully",
  "version": "24.0.7",
  "api_version": "1.43",
  "go_version": "go1.20.10",
  "git_commit": "afdd53b4e3",
  "build_time": "2023-10-24T11:05:16.000000000+00:00",
  "server_info": {
    "containers": 12,
    "containers_running": 8,
    "containers_paused": 0,
    "containers_stopped": 4,
    "images": 25,
    "storage_driver": "overlay2",
    "volume_driver": "local",
    "memory_total": 8589934592,
    "cpu_count": 4
  }
}
```

### Database Health

Monitor database connection and performance metrics.

```http
GET /api/v1/health/database
```

**Example Response:**
```json
{
  "status": "healthy",
  "type": "sqlite",
  "database_file": "/app/data/volumeviz.db",
  "size_bytes": 2097152,
  "connection_status": "connected",
  "last_query_time": "2025-08-14T15:45:30Z",
  "connection_pool": {
    "active_connections": 3,
    "idle_connections": 7,
    "max_connections": 25,
    "total_connections_created": 156,
    "connection_lifetime_avg": "45m"
  },
  "performance_metrics": {
    "queries_per_second": 12.5,
    "avg_query_time": "15ms",
    "slow_queries": 2,
    "cache_hit_rate": 94.2
  },
  "migrations": {
    "status": "up_to_date",
    "current_version": "20250814_add_metadata_indexes",
    "pending_migrations": 0,
    "last_migration": "2025-08-14T10:30:00Z"
  }
}
```

### Docker Events Health

Monitor Docker events service status and metrics.

```http
GET /api/v1/health/events
```

**Example Response:**
```json
{
  "status": "healthy",
  "connection": "connected",
  "uptime_seconds": 86400,
  "last_event_timestamp": 1692021940,
  "last_event_age_seconds": 6,
  "processed_events_total": 15420,
  "processed_events_today": 284,
  "event_buffer_size": 50,
  "event_buffer_current": 3,
  "reconnection_count": 0,
  "last_reconnect_timestamp": null,
  "event_types_today": {
    "volume": 156,
    "container": 98,
    "image": 23,
    "network": 7
  },
  "processing_metrics": {
    "events_per_second": 0.18,
    "avg_processing_time": "5ms",
    "processing_errors": 0,
    "duplicate_events": 12
  }
}
```

### Scan Scheduler Health

Monitor volume scanning scheduler status and performance.

```http
GET /api/v1/health/scheduler
```

**Example Response:**
```json
{
  "status": "healthy",
  "running": true,
  "uptime_seconds": 86400,
  "queue_depth": 2,
  "active_scans": 1,
  "worker_count": 4,
  "worker_utilization": 25.0,
  "total_completed": 1842,
  "total_failed": 12,
  "completed_by_status": {
    "success": 1830,
    "partial": 12,
    "error": 12
  },
  "error_counts": {
    "permission_denied": 5,
    "volume_not_found": 3,
    "timeout": 4
  },
  "last_run_timestamp": 1692021940,
  "last_run_age_seconds": 6,
  "next_run_timestamp": 1692022000,
  "next_run_in_seconds": 54,
  "scan_durations_avg": {
    "small_volumes": "2.3s",
    "medium_volumes": "15.7s",
    "large_volumes": "2m45s"
  },
  "performance_metrics": {
    "scans_per_hour": 4.2,
    "avg_scan_duration": "25s",
    "success_rate": 99.3,
    "queue_wait_time": "1.2s"
  }
}
```

### Kubernetes Readiness Probe

Kubernetes readiness probe endpoint for container orchestration.

```http
GET /api/v1/health/ready
```

**Example Response:**
```json
{
  "status": "ready"
}
```

**Status Codes:**
- `200 OK`: Service is ready to receive traffic
- `503 Service Unavailable`: Service is not ready (remove from load balancer)

### Kubernetes Liveness Probe

Kubernetes liveness probe endpoint for container health checks.

```http
GET /api/v1/health/live
```

**Example Response:**
```json
{
  "status": "alive"
}
```

**Status Codes:**
- `200 OK`: Service is alive (always returns 200 unless process is dead)

## 💻 System Information Endpoints

System endpoints provide information about VolumeViz version, configuration, and system capabilities.

### System Information

Get comprehensive system and environment information.

```http
GET /api/v1/system/info
```

**Example Response:**
```json
{
  "service": "volumeviz",
  "version": "1.2.0",
  "build_info": {
    "version": "1.2.0",
    "commit": "abc123def456",
    "build_date": "2025-08-14T10:30:00Z",
    "go_version": "go1.21.0",
    "built_by": "goreleaser"
  },
  "docker": {
    "available": true,
    "version": "24.0.7",
    "api_version": "1.43",
    "server_info": {
      "containers": 12,
      "images": 25,
      "storage_driver": "overlay2",
      "volume_driver": "local"
    }
  },
  "system": {
    "hostname": "volumeviz-server-01",
    "platform": "linux/amd64",
    "uptime_seconds": 86400,
    "memory": {
      "total_bytes": 8589934592,
      "available_bytes": 4294967296,
      "used_bytes": 4294967296,
      "usage_percent": 50.0
    },
    "disk": {
      "total_bytes": 107374182400,
      "available_bytes": 53687091200,
      "used_bytes": 53687091200,
      "usage_percent": 50.0
    },
    "cpu": {
      "cores": 4,
      "usage_percent": 15.2,
      "load_average": [0.5, 0.7, 0.8]
    }
  },
  "configuration": {
    "database_type": "sqlite",
    "scan_scheduler_enabled": true,
    "events_monitoring": true,
    "alerts_engine": true,
    "metrics_collection": true,
    "log_level": "info"
  }
}
```

### API Version Information

Get API version details and available endpoints.

```http
GET /api/v1/system/version
```

**Example Response:**
```json
{
  "service": "volumeviz",
  "version": "1.2.0",
  "api_version": "v1",
  "api_compatibility": {
    "min_supported": "v1.0",
    "max_supported": "v1.2",
    "deprecated_versions": [],
    "sunset_date": null
  },
  "endpoints": {
    "health": "/api/v1/health",
    "volumes": "/api/v1/volumes",
    "explorer": "/api/v1/explorer",
    "metadata": "/api/v1/metadata",
    "analytics": "/api/v1/stats",
    "trends": "/api/v1/trends",
    "alerts": "/api/v1/alerts",
    "scan": "/api/v1/scans",
    "system": "/api/v1/system",
    "websocket": "/api/v1/ws"
  },
  "features": {
    "real_time_updates": true,
    "bulk_operations": true,
    "advanced_search": true,
    "alert_management": true,
    "metadata_extraction": true,
    "trend_analysis": true,
    "file_content_analysis": false
  },
  "documentation": {
    "openapi_spec": "/openapi/openapi.yaml",
    "swagger_ui": "/api/docs",
    "readme": "/openapi/README.md"
  }
}
```

## 📊 System Metrics & Monitoring

### Application Metrics

VolumeViz exposes Prometheus-compatible metrics for monitoring and alerting.

```http
GET /metrics
```

**Key Metrics:**
- `volumeviz_volumes_total`: Total number of volumes discovered
- `volumeviz_scans_total`: Total number of scans performed
- `volumeviz_scan_duration_seconds`: Scan duration histogram
- `volumeviz_api_requests_total`: Total API requests by endpoint and status
- `volumeviz_api_request_duration_seconds`: API request duration histogram
- `volumeviz_database_queries_total`: Total database queries
- `volumeviz_docker_events_total`: Total Docker events processed
- `volumeviz_alerts_triggered_total`: Total alerts triggered
- `volumeviz_notification_deliveries_total`: Total notifications delivered

### Health Summary for Monitoring

Simplified health check for monitoring tools and load balancers.

```http
GET /
```

**Example Response:**
```json
{
  "status": "ok",
  "service": "volumeviz",
  "version": "v1"
}
```

## 🔧 Administrative Operations

### Trigger System Maintenance

Perform system maintenance operations (requires admin privileges).

```http
POST /api/v1/system/maintenance
```

**Request Body:**
```json
{
  "operations": [
    "cleanup_old_scans",
    "optimize_database",
    "clear_cache",
    "refresh_docker_info"
  ],
  "dry_run": false,
  "notify_completion": true
}
```

### System Configuration

Get current system configuration (sensitive values masked).

```http
GET /api/v1/system/config
```

**Example Response:**
```json
{
  "database": {
    "type": "sqlite",
    "path": "/app/data/volumeviz.db",
    "max_connections": 25,
    "migration_enabled": true
  },
  "docker": {
    "socket_path": "/var/run/docker.sock",
    "connection_timeout": "30s",
    "api_version": "auto"
  },
  "scanner": {
    "max_workers": 4,
    "scan_timeout": "5m",
    "default_schedule": "0 2 * * *",
    "enable_metadata_extraction": true
  },
  "server": {
    "port": 8080,
    "log_level": "info",
    "enable_cors": true,
    "cors_origins": ["*"]
  },
  "features": {
    "alerts_enabled": true,
    "events_monitoring": true,
    "metrics_collection": true,
    "websocket_enabled": true
  }
}
```

## 🔍 Troubleshooting Endpoints

### System Diagnostics

Run comprehensive system diagnostics for troubleshooting.

```http
POST /api/v1/system/diagnostics
```

**Request Body:**
```json
{
  "include_sections": [
    "connectivity",
    "permissions",
    "performance",
    "configuration"
  ],
  "verbose": true
}
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "diagnostics": {
      "connectivity": {
        "docker_socket": "accessible",
        "database_connection": "healthy",
        "disk_access": "read_write",
        "network_ports": {
          "8080": "listening",
          "9090": "not_used"
        }
      },
      "permissions": {
        "docker_socket": "read_write",
        "database_file": "read_write",
        "log_directory": "read_write",
        "data_directory": "read_write"
      },
      "performance": {
        "memory_usage": "normal",
        "cpu_usage": "normal",
        "disk_io": "normal",
        "network_io": "low"
      },
      "configuration": {
        "environment_variables": "valid",
        "config_files": "present",
        "database_schema": "up_to_date",
        "feature_flags": "consistent"
      }
    },
    "recommendations": [
      "Consider increasing worker count for better scan performance",
      "Database could benefit from periodic optimization"
    ],
    "warnings": [],
    "errors": []
  }
}
```

## ⚠️ Error Responses

### Health Check Errors

When health checks fail, detailed error information is provided:

```json
{
  "status": "unhealthy",
  "timestamp": 1692021946,
  "version": "1.2.0",
  "checks": {
    "docker": {
      "status": "unhealthy",
      "error": "Cannot connect to the Docker daemon at unix:///var/run/docker.sock",
      "details": {
        "socket_path": "/var/run/docker.sock",
        "connection_timeout": "30s",
        "last_successful_connection": "2025-08-14T14:30:00Z"
      }
    }
  },
  "overall_status": "degraded",
  "recommendations": [
    "Check if Docker daemon is running",
    "Verify socket permissions",
    "Check network connectivity"
  ]
}
```

### System Information Errors

```json
{
  "success": false,
  "error": {
    "code": "SYSTEM_INFO_UNAVAILABLE",
    "message": "Unable to gather complete system information",
    "details": {
      "failed_components": ["docker_info", "disk_metrics"],
      "available_components": ["basic_info", "memory_info"],
      "retry_recommended": true
    }
  }
}
```

## 🚀 Monitoring Best Practices

### Health Check Strategy
- Use `/health/ready` for Kubernetes readiness probes
- Use `/health/live` for Kubernetes liveness probes
- Monitor `/api/v1/health` for comprehensive health status
- Set up alerts on specific component health checks

### Metrics Collection
- Scrape `/metrics` endpoint with Prometheus
- Monitor key performance indicators (scan duration, API latency)
- Set up alerts for error rates and resource usage
- Track trends in volume discovery and scanning metrics

### Performance Monitoring
- Monitor system resource usage (CPU, memory, disk)
- Track database query performance
- Monitor Docker API response times
- Watch for scan queue depth and processing times

---

**Next**: [WebSocket API Reference](websocket.md) | [Authentication Guide](../user-guide/authentication.md)
