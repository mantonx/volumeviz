# Volume Size Calculation Engine

## Overview

The Volume Size Calculation Engine provides high-performance, accurate disk usage calculation for Docker volumes with intelligent fallback mechanisms, comprehensive caching, and robust error handling.

## Architecture

### Multi-Method Scanning

The system implements a pluggable architecture with three scanning methods in order of preference:

1. **Diskus Method** (Primary)
   - Ultra-fast disk usage calculation using the `diskus` tool
   - Performance: ~1GB/second scanning speed
   - Best for: Large volumes requiring fast results
   - Fallback: Automatic if diskus not available

2. **Du Method** (Reliable)
   - Unix `du` command-based scanning
   - Performance: Medium speed, high reliability
   - Best for: Standard Unix environments
   - Fallback: Used when diskus unavailable

3. **Native Go Method** (Guaranteed)
   - Pure Go implementation with detailed metrics
   - Performance: Slower but provides file counts, directory counts
   - Best for: Detailed analysis and guaranteed compatibility
   - Fallback: Always available

### Performance Specifications

- **Target Performance**: 100GB volume scanned in under 30 seconds
- **Concurrent Scanning**: Up to 5 volumes simultaneously with resource limiting
- **Memory Usage**: Under 100MB during large volume scans
- **Timeout Handling**: Configurable timeouts with graceful cancellation (default: 5 minutes)

### Caching Strategy

- **Default TTL**: 5 minutes for scan results
- **Cache Backend**: In-memory (Redis support configured but not implemented)
- **Cache Size**: 1000 entries with LRU eviction
- **Invalidation**: Manual refresh capability
- **Modification Detection**: Planned feature for automatic invalidation

## API Endpoints

### Volume Size Operations

#### Get Volume Size
```http
GET /api/v1/volumes/{id}/size
```

Returns cached size or triggers new calculation.

**Response Example:**
```json
{
  "volume_id": "my-volume",
  "result": {
    "volume_id": "my-volume",
    "total_size": 1073741824,
    "file_count": 1250,
    "directory_count": 45,
    "largest_file": 104857600,
    "method": "diskus",
    "scanned_at": "2024-01-15T10:30:00Z",
    "duration": "1.5s",
    "cache_hit": false,
    "filesystem_type": "ext4"
  },
  "cached": false
}
```

#### Refresh Volume Size
```http
POST /api/v1/volumes/{id}/size/refresh
```

Forces recalculation with optional async mode.

**Request Body:**
```json
{
  "async": false,
  "method": "diskus"
}
```

**Async Response:**
```json
{
  "message": "Async scan started",
  "scan_id": "scan_my-volume_1673780400",
  "status_url": "/api/v1/volumes/my-volume/scan/status"
}
```

#### Get Scan Status
```http
GET /api/v1/volumes/{id}/scan/status
```

Returns progress of active scan for a volume.

**Response Example:**
```json
{
  "scan_id": "scan_my-volume_1673780400",
  "volume_id": "my-volume",
  "status": "running",
  "progress": 0.75,
  "files_scanned": 937,
  "current_path": "/mnt/volume/data/subdir",
  "estimated_remaining": "30s",
  "method": "native",
  "started_at": "2024-01-15T10:28:00Z"
}
```

### Bulk Operations

#### Bulk Scan
```http
POST /api/v1/volumes/bulk-scan
```

Scan multiple volumes simultaneously.

**Request Body:**
```json
{
  "volume_ids": ["vol1", "vol2", "vol3"],
  "async": false,
  "method": "diskus"
}
```

**Response Example:**
```json
{
  "results": {
    "vol1": { /* scan result */ },
    "vol2": { /* scan result */ }
  },
  "failed": {
    "vol3": "Volume not found"
  },
  "total": 3,
  "success": 2,
  "failures": 1
}
```

### Method Information

#### Get Available Methods
```http
GET /api/v1/scan-methods
```

Returns available scanning methods and their capabilities.

**Response Example:**
```json
{
  "methods": [
    {
      "name": "diskus",
      "available": true,
      "description": "Fast directory scanning using diskus",
      "performance": "fast",
      "accuracy": "high",
      "features": ["fast", "external_tool"]
    },
    {
      "name": "du",
      "available": true,
      "description": "Reliable du-based scanning",
      "performance": "medium", 
      "accuracy": "high",
      "features": ["reliable", "standard_tool"]
    },
    {
      "name": "native",
      "available": true,
      "description": "Native Go implementation with detailed metrics",
      "performance": "slow",
      "accuracy": "high", 
      "features": ["detailed_metrics", "file_counts", "always_available"]
    }
  ],
  "total": 3
}
```

## Error Handling

### Error Codes

| Code | Description | HTTP Status | Action |
|------|-------------|-------------|---------|
| `VOLUME_NOT_FOUND` | Volume doesn't exist | 404 | Check volume ID |
| `PERMISSION_DENIED` | Access denied to volume path | 403 | Check VolumeViz permissions |
| `ALL_METHODS_FAILED` | All scan methods failed | 500 | Check system and permissions |
| `SCAN_TIMEOUT` | Scan exceeded timeout | 408 | Retry with longer timeout |
| `SCAN_CANCELLED` | Scan was cancelled | 408 | Try again or reduce scope |
| `METHOD_UNAVAILABLE` | Requested method not available | 400 | Use different method |

### Error Response Format

```json
{
  "error": "Volume not found",
  "code": "VOLUME_NOT_FOUND",
  "context": {
    "volume_id": "missing-volume",
    "checked_path": "/var/lib/docker/volumes/missing-volume"
  },
  "suggestion": "Check that the volume ID is correct"
}
```

## Configuration

### Scanning Configuration

```yaml
scanning:
  default_timeout: "5m"
  max_concurrent: 5
  preferred_methods: ["diskus", "du", "native"]
  progress_reporting: true
```

### Cache Configuration

```yaml
cache:
  type: "memory"  # or "redis"
  ttl: "5m"
  max_size: 1000
  redis_url: "redis://localhost:6379"  # if type: redis
```

## Metrics and Observability

### Prometheus Metrics

- `volumeviz_scan_duration_seconds` - Scan duration by method
- `volumeviz_scan_total` - Total scans by method and status
- `volumeviz_cache_hits_total` - Cache hit rate
- `volumeviz_cache_size` - Current cache size
- `volumeviz_active_scans` - Current active scan count
- `volumeviz_volume_size_bytes` - Latest volume sizes

### Structured Logging

All scan operations include structured logs with:
- Volume ID and path
- Method used and duration
- Success/failure status
- Error details and context
- Performance metrics

## Best Practices

### Performance Optimization

1. **Use Diskus**: Install `diskus` for maximum performance
2. **Appropriate Timeouts**: Set realistic timeouts based on volume sizes
3. **Concurrent Limits**: Don't exceed 5 concurrent scans
4. **Cache Utilization**: Leverage caching for frequently accessed volumes

### Error Recovery

1. **Method Fallback**: System automatically tries fallback methods
2. **Retry Logic**: Implement client-side retry for transient errors
3. **Timeout Adjustment**: Increase timeouts for very large volumes
4. **Permission Checks**: Ensure VolumeViz has proper volume access

### Monitoring

1. **Track Performance**: Monitor scan durations and success rates
2. **Cache Effectiveness**: Monitor cache hit rates
3. **Resource Usage**: Monitor memory and CPU during large scans
4. **Error Patterns**: Watch for recurring error patterns

## Future Enhancements

### Planned Features

- **Redis Caching**: Persistent cache backend for clusters
- **Modification Detection**: Automatic cache invalidation based on volume changes
- **Progressive Scanning**: Incremental scans for large volumes
- **Custom Scan Methods**: Plugin architecture for additional methods
- **Scan Scheduling**: Background periodic scanning
- **Volume Comparison**: Compare sizes across time periods

### Performance Improvements

- **Parallel Directory Traversal**: For native method optimization
- **Compression-Aware Scanning**: Account for filesystem compression
- **Network Volume Optimization**: Special handling for network filesystems
- **Memory Mapped Files**: Optimize scanning of large single files

## Troubleshooting

### Common Issues

#### Slow Scanning Performance
- **Symptom**: Scans taking longer than expected
- **Solutions**: 
  - Install diskus for faster scanning
  - Check filesystem type (network filesystems are slower)
  - Increase concurrent scan limits if system can handle it

#### Permission Errors
- **Symptom**: PERMISSION_DENIED errors
- **Solutions**:
  - Check VolumeViz container has proper volume mounts
  - Verify Docker socket permissions
  - Check SELinux/AppArmor policies

#### Memory Usage High
- **Symptom**: High memory usage during scans
- **Solutions**:
  - Reduce concurrent scan limits
  - Use diskus method (lower memory usage)
  - Check for memory leaks in long-running scans

#### Cache Not Working
- **Symptom**: Every request triggers new scan
- **Solutions**:
  - Check cache TTL configuration
  - Verify cache size limits
  - Monitor cache eviction patterns