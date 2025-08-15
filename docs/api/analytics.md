# Analytics API Reference

The Analytics API provides comprehensive volume statistics, trends analysis, and storage insights. These endpoints enable data-driven decision making for storage optimization and capacity planning.

## 📋 Overview

**Base Path**: `/api/v1`
**Authentication**: Required (Bearer Token)
**Rate Limits**: Standard API limits apply

The Analytics API consists of several endpoint groups:

- **Volume Analytics**: `/volumes/{name}/stats` - Individual volume statistics
- **Daily Stats**: `/stats/daily` - Time-series volume metrics
- **Storage Analytics**: `/stats/storage`, `/stats/media` - Storage breakdown analysis
- **Trends Analysis**: `/trends/*` - Historical trend analysis
- **Reports**: `/reports/*` - Specialized reports and insights

## 📊 Volume Statistics

### Get Volume Statistics

Retrieve comprehensive statistics for a specific volume.

```http
GET /api/v1/volumes/{name}/stats
```

**Path Parameters:**
- `name` (string, required): Volume name or identifier

**Query Parameters:**
- `include_trends` (bool, optional): Include historical trend data (default: false)
- `period` (string, optional): Time period for trends (`1d`, `7d`, `30d`, `90d`) (default: `7d`)

**Example Request:**
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "/api/v1/volumes/data-volume/stats?include_trends=true&period=30d"
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "volume": {
      "name": "data-volume",
      "id": "vol-abc123",
      "status": "active"
    },
    "current_stats": {
      "total_size": 10737418240,
      "used_size": 8589934592,
      "available_size": 2147483648,
      "usage_percentage": 80.0,
      "total_files": 15420,
      "total_directories": 1250,
      "largest_file": {
        "name": "database.db",
        "size_bytes": 1073741824,
        "path": "/data/db/database.db"
      }
    },
    "file_type_breakdown": {
      "images": {
        "count": 5200,
        "total_size": 3221225472,
        "percentage": 30.0
      },
      "documents": {
        "count": 3100,
        "total_size": 1610612736,
        "percentage": 15.0
      },
      "videos": {
        "count": 150,
        "total_size": 2147483648,
        "percentage": 20.0
      },
      "other": {
        "count": 6970,
        "total_size": 1610612736,
        "percentage": 35.0
      }
    },
    "trends": {
      "size_growth": {
        "daily_average": 107374182,
        "weekly_growth": 751619276,
        "monthly_projection": 3221225472
      },
      "file_growth": {
        "daily_average": 25,
        "weekly_growth": 175,
        "monthly_projection": 750
      }
    },
    "last_updated": "2025-08-14T16:00:00Z"
  }
}
```

## 📈 Daily Statistics

### Get Daily Statistics

Retrieve daily statistics across all volumes or filtered by specific criteria.

```http
GET /api/v1/stats/daily
```

**Query Parameters:**
- `volume_id` (string, optional): Filter by specific volume
- `days` (int, optional): Number of days to include (default: 30, max: 365)
- `include_breakdown` (bool, optional): Include file type breakdown (default: false)

**Example Request:**
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "/api/v1/stats/daily?volume_id=vol-abc123&days=7&include_breakdown=true"
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "daily_stats": [
      {
        "date": "2025-08-14",
        "total_size": 10737418240,
        "file_count": 15420,
        "directory_count": 1250,
        "growth_bytes": 107374182,
        "growth_files": 25,
        "volumes_scanned": 5,
        "file_type_breakdown": {
          "images": 3221225472,
          "documents": 1610612736,
          "videos": 2147483648,
          "other": 1610612736
        }
      },
      {
        "date": "2025-08-13",
        "total_size": 10630043648,
        "file_count": 15395,
        "directory_count": 1248,
        "growth_bytes": 134217728,
        "growth_files": 32,
        "volumes_scanned": 5
      }
    ],
    "summary": {
      "period_start": "2025-08-08",
      "period_end": "2025-08-14",
      "total_days": 7,
      "average_daily_growth": 115343267,
      "total_growth": 807702656,
      "growth_trend": "increasing"
    }
  }
}
```

### Get Top Folders

Identify folders with the most storage usage across volumes.

```http
GET /api/v1/stats/top-folders
```

**Query Parameters:**
- `volume_id` (string, optional): Filter by specific volume
- `limit` (int, optional): Number of folders to return (default: 20, max: 100)
- `sort_by` (string, optional): Sort criteria (`size`, `file_count`, `growth`) (default: `size`)
- `min_size` (int, optional): Minimum folder size in bytes

**Example Request:**
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "/api/v1/stats/top-folders?volume_id=vol-abc123&limit=10&sort_by=size"
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "top_folders": [
      {
        "id": 456,
        "name": "media",
        "path": "/data/media",
        "volume_id": "vol-abc123",
        "volume_name": "data-volume",
        "total_size": 5368709120,
        "file_count": 2840,
        "subdirectory_count": 125,
        "percentage_of_volume": 50.0,
        "last_modified": "2025-08-14T14:30:00Z",
        "growth_last_7days": 268435456
      },
      {
        "id": 789,
        "name": "logs",
        "path": "/var/log",
        "volume_id": "vol-def456",
        "volume_name": "system-volume",
        "total_size": 2147483648,
        "file_count": 1200,
        "subdirectory_count": 15,
        "percentage_of_volume": 35.0,
        "last_modified": "2025-08-14T16:00:00Z",
        "growth_last_7days": 134217728
      }
    ],
    "metadata": {
      "total_folders_analyzed": 2500,
      "total_size_represented": 8589934592,
      "analysis_timestamp": "2025-08-14T16:00:00Z"
    }
  }
}
```

## 🗂️ Media and Storage Analytics

### Get Media Statistics

Analyze media file distribution and storage usage patterns.

```http
GET /api/v1/stats/media
```

**Query Parameters:**
- `volume_id` (string, optional): Filter by specific volume
- `media_types` (string[], optional): Filter by media types (comma-separated)
- `include_metadata` (bool, optional): Include detailed media metadata (default: false)

**Example Request:**
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "/api/v1/stats/media?volume_id=vol-abc123&media_types=image,video&include_metadata=true"
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "media_breakdown": {
      "images": {
        "total_files": 5200,
        "total_size": 3221225472,
        "average_size": 619661,
        "formats": {
          "jpeg": { "count": 3200, "size": 2147483648 },
          "png": { "count": 1500, "size": 805306368 },
          "gif": { "count": 500, "size": 268435456 }
        },
        "resolution_distribution": {
          "hd_1080p": 2100,
          "4k": 850,
          "other": 2250
        }
      },
      "videos": {
        "total_files": 150,
        "total_size": 2147483648,
        "average_size": 14316557,
        "formats": {
          "mp4": { "count": 120, "size": 1879048192 },
          "avi": { "count": 20, "size": 214748365 },
          "mkv": { "count": 10, "size": 53687091 }
        },
        "duration_distribution": {
          "short_0_5min": 45,
          "medium_5_30min": 85,
          "long_30min_plus": 20
        }
      }
    },
    "storage_efficiency": {
      "duplicate_media_files": 340,
      "potential_savings": 536870912,
      "compression_opportunities": [
        {
          "type": "uncompressed_images",
          "count": 1200,
          "current_size": 805306368,
          "estimated_compressed_size": 322122547,
          "savings_percentage": 60
        }
      ]
    },
    "metadata": {
      "scan_timestamp": "2025-08-14T16:00:00Z",
      "volumes_analyzed": ["vol-abc123"],
      "analysis_duration_ms": 2340
    }
  }
}
```

### Get Storage Statistics

Get comprehensive storage analysis and optimization insights.

```http
GET /api/v1/stats/storage
```

**Query Parameters:**
- `volume_id` (string, optional): Filter by specific volume
- `include_optimization` (bool, optional): Include optimization recommendations (default: true)
- `threshold_size` (int, optional): Minimum file size for analysis in bytes (default: 1048576)

**Example Request:**
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "/api/v1/stats/storage?include_optimization=true&threshold_size=5242880"
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "overall_stats": {
      "total_volumes": 12,
      "total_size": 107374182400,
      "total_files": 184500,
      "average_file_size": 582542,
      "largest_volumes": [
        {
          "name": "data-volume",
          "size": 21474836480,
          "percentage": 20.0
        }
      ]
    },
    "file_size_distribution": {
      "tiny_0_1kb": { "count": 45000, "total_size": 23068672 },
      "small_1kb_1mb": { "count": 95000, "total_size": 10737418240 },
      "medium_1mb_100mb": { "count": 35000, "total_size": 53687091200 },
      "large_100mb_1gb": { "count": 8000, "total_size": 32212254720 },
      "huge_1gb_plus": { "count": 1500, "total_size": 10737418240 }
    },
    "optimization_recommendations": [
      {
        "type": "duplicate_files",
        "description": "Found 2,340 duplicate files across volumes",
        "potential_savings": 5368709120,
        "action": "Review and remove duplicates",
        "priority": "high",
        "affected_files": [
          {
            "name": "backup.tar.gz",
            "occurrences": 8,
            "size_per_copy": 1073741824,
            "total_waste": 7516192768
          }
        ]
      },
      {
        "type": "old_temp_files",
        "description": "Temporary files older than 30 days",
        "potential_savings": 1073741824,
        "action": "Clean up temporary files",
        "priority": "medium",
        "file_count": 1200
      },
      {
        "type": "log_rotation",
        "description": "Log files without rotation consuming excessive space",
        "potential_savings": 2147483648,
        "action": "Implement log rotation",
        "priority": "high",
        "affected_paths": ["/var/log", "/app/logs"]
      }
    ],
    "growth_analysis": {
      "daily_growth_rate": 2.5,
      "projected_30_day_growth": 2684354560,
      "capacity_warning": {
        "volumes_near_full": [
          {
            "name": "cache-volume",
            "current_usage": 85.2,
            "estimated_full_date": "2025-09-15"
          }
        ]
      }
    }
  }
}
```

## 📉 Trends Analysis

### Get Volume Trends

Analyze historical trends for a specific volume.

```http
GET /api/v1/trends/volumes/{volumeId}
```

**Path Parameters:**
- `volumeId` (string, required): Volume identifier

**Query Parameters:**
- `period` (string, optional): Analysis period (`7d`, `30d`, `90d`, `1y`) (default: `30d`)
- `metrics` (string[], optional): Specific metrics to include (comma-separated)
- `granularity` (string, optional): Data granularity (`hourly`, `daily`, `weekly`) (default: `daily`)

**Example Request:**
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "/api/v1/trends/volumes/vol-abc123?period=30d&metrics=size,files&granularity=daily"
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "volume_info": {
      "id": "vol-abc123",
      "name": "data-volume",
      "current_size": 10737418240
    },
    "trends": {
      "size_trend": {
        "trend_direction": "increasing",
        "growth_rate": 2.1,
        "data_points": [
          {
            "timestamp": "2025-08-14T00:00:00Z",
            "value": 10737418240
          },
          {
            "timestamp": "2025-08-13T00:00:00Z",
            "value": 10630043648
          }
        ]
      },
      "file_count_trend": {
        "trend_direction": "increasing",
        "growth_rate": 1.8,
        "data_points": [
          {
            "timestamp": "2025-08-14T00:00:00Z",
            "value": 15420
          },
          {
            "timestamp": "2025-08-13T00:00:00Z",
            "value": 15395
          }
        ]
      }
    },
    "analysis": {
      "period_summary": {
        "start_date": "2025-07-15",
        "end_date": "2025-08-14",
        "total_growth": 2147483648,
        "growth_percentage": 25.0
      },
      "predictions": {
        "next_30_days": {
          "estimated_size": 13421772800,
          "confidence": 0.85
        },
        "capacity_alert": null
      }
    }
  }
}
```

### Get All Volumes Trends Summary

Get a summarized view of trends across all volumes.

```http
GET /api/v1/trends/summary
```

**Query Parameters:**
- `period` (string, optional): Analysis period (default: `30d`)
- `include_predictions` (bool, optional): Include future predictions (default: false)
- `top_n` (int, optional): Include top N fastest growing volumes (default: 10)

**Example Request:**
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "/api/v1/trends/summary?period=30d&include_predictions=true&top_n=5"
```

## 📋 Reports

### Get Orphaned Volumes Report

Identify volumes that are not currently attached to any running containers.

```http
GET /api/v1/reports/orphaned
```

**Query Parameters:**
- `include_stats` (bool, optional): Include storage statistics for orphaned volumes (default: true)
- `min_age_days` (int, optional): Minimum age in days for a volume to be considered orphaned (default: 7)

**Example Request:**
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "/api/v1/reports/orphaned?include_stats=true&min_age_days=14"
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "orphaned_volumes": [
      {
        "id": "vol-orphan123",
        "name": "old-cache-volume",
        "created_at": "2025-06-01T10:00:00Z",
        "last_attached": "2025-07-15T14:30:00Z",
        "days_orphaned": 30,
        "size_bytes": 2147483648,
        "file_count": 1200,
        "potential_savings": 2147483648,
        "risk_level": "low"
      }
    ],
    "summary": {
      "total_orphaned": 3,
      "total_wasted_space": 5368709120,
      "oldest_orphan_days": 45,
      "recommendation": "Consider removing volumes orphaned for more than 30 days"
    }
  }
}
```

## ⚠️ Error Handling

### Common Error Codes

- `400 Bad Request`: Invalid parameters or date ranges
- `404 Not Found`: Volume or resource not found
- `413 Payload Too Large`: Analysis period too broad
- `422 Unprocessable Entity`: Invalid metrics or granularity combination
- `500 Internal Server Error`: Analysis engine failure

### Example Error Response

```json
{
  "success": false,
  "error": {
    "code": "INVALID_TIME_PERIOD",
    "message": "Analysis period '2y' exceeds maximum allowed period of 1 year",
    "details": {
      "requested_period": "2y",
      "max_allowed": "1y",
      "suggested_periods": ["7d", "30d", "90d", "1y"]
    }
  }
}
```

## 🚀 Performance Optimization

### Efficient Analytics Queries
- Use appropriate time periods to balance detail vs. performance
- Cache frequently accessed statistics
- Use specific volume filters to reduce processing time
- Request only needed metrics to minimize response size

### Best Practices
- Combine related analytics calls where possible
- Use trends API for time-series data rather than multiple daily stats calls
- Enable pagination for large result sets
- Consider using background jobs for complex analyses

---

**Next**: [Metadata API Reference](metadata.md) | [Alerts API Reference](alerts.md)
