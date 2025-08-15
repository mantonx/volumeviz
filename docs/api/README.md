# VolumeViz API v1.2 - Complete Reference

Welcome to the VolumeViz API documentation. This comprehensive reference covers all 78 endpoints across our REST API and real-time WebSocket interface.

## 📋 API Overview

**Current Version**: v1.2
**Base URL**: `http://localhost:8080/api/v1` (Development)
**Base URL**: `https://api.volumeviz.io/api/v1` (Production)
**Documentation**: OpenAPI 3.0 specification available at `/openapi/openapi.yaml`
**Interactive Docs**: Swagger UI at `/api/docs`

### API Capabilities

VolumeViz provides a complete Docker volume management and monitoring solution with:

- 🔍 **Comprehensive Volume Discovery**: Automatic detection and cataloging of all Docker volumes
- 📊 **Advanced Analytics**: Detailed statistics, trends, and usage patterns
- 🗂️ **File System Explorer**: Browse volume contents with metadata extraction
- 🚨 **Intelligent Alerting**: Rule-based monitoring with multi-channel notifications
- ⚡ **Real-Time Updates**: WebSocket-based live updates for responsive UIs
- 📈 **Performance Monitoring**: Built-in metrics collection and health monitoring

## 🚀 Quick Start

### Authentication

Most endpoints require Bearer token authentication:

```bash
curl -H "Authorization: Bearer $API_TOKEN" \
  "http://localhost:8080/api/v1/volumes"
```

### Basic Volume Operations

```bash
# List all volumes
curl "http://localhost:8080/api/v1/volumes"

# Get specific volume details
curl "http://localhost:8080/api/v1/volumes/my-volume"

# Get volume statistics
curl "http://localhost:8080/api/v1/volumes/my-volume/stats"

# Trigger volume scan
curl -X POST "http://localhost:8080/api/v1/volumes/my-volume/scan"
```

### Real-Time Updates

```javascript
const ws = new WebSocket('ws://localhost:8080/api/v1/ws');

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('Real-time update:', message.type, message.data);
};
```

## 🗺️ API Structure

### Core APIs

| API Category | Base Path | Description | Endpoints |
|-------------|-----------|-------------|-----------|
| **[Volumes](volumes.md)** | `/volumes` | Volume discovery, management, and operations | 4 |
| **[Explorer](explorer.md)** | `/explorer` | File system browsing and file operations | 9 |
| **[Metadata](metadata.md)** | `/metadata` | File metadata extraction and classification | 5 |
| **[Analytics](analytics.md)** | `/stats`, `/trends` | Statistics, analytics, and trend analysis | 6 |
| **[Alerts](alerts.md)** | `/alerts` | Monitoring, alerting, and notifications | 30+ |
| **[System & Health](system-health.md)** | `/system`, `/health` | System info, health checks, diagnostics | 10 |
| **[WebSocket](websocket.md)** | `/ws` | Real-time updates and live data streaming | - |

### Scanning & Processing

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/scans/{id}/status` | GET | Get scan operation status |
| `/volumes/{name}/scan` | POST | Trigger volume scan |
| `/volumes/bulk-scan` | POST | Scan multiple volumes |
| `/scan-methods` | GET | Get available scan methods |
| `/scheduler/status` | GET | Get scan scheduler status |

## 🔧 Common Patterns

### Pagination

Most list endpoints support cursor-based pagination:

```bash
curl "http://localhost:8080/api/v1/volumes?limit=20&offset=0"
```

### Filtering

Filter results using query parameters:

```bash
# Filter volumes by driver
curl "http://localhost:8080/api/v1/volumes?driver=local"

# Filter files by media type
curl "http://localhost:8080/api/v1/metadata/files/by-media-kind?media_kind=image"

# Filter alerts by severity
curl "http://localhost:8080/api/v1/alerts?severity=critical"
```

### Sorting

Sort results using the `sort` parameter:

```bash
curl "http://localhost:8080/api/v1/volumes?sort=name&order=asc"
```

### Response Format

All API responses follow a consistent envelope structure:

```json
{
  "success": true,
  "data": {
    // Response data here
  },
  "pagination": {
    "total": 100,
    "limit": 20,
    "offset": 0,
    "has_more": true
  }
}
```

### Error Responses

Error responses include detailed information for troubleshooting:

```json
{
  "success": false,
  "error": {
    "code": "VOLUME_NOT_FOUND",
    "message": "Volume 'my-volume' not found",
    "details": {
      "volume_name": "my-volume",
      "suggestions": [
        "Check volume name spelling",
        "Ensure volume exists in Docker"
      ]
    }
  }
}
```

## 📊 Rate Limiting

API rate limits protect system performance:

- **Standard Endpoints**: 1000 requests per minute per API key
- **Scanning Operations**: 10 concurrent scans per API key
- **WebSocket Connections**: 50 concurrent connections per API key
- **Bulk Operations**: 100 resources per request

Rate limit headers are included in responses:

```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1692022800
```

## 🔐 Security

### Authentication Methods

1. **Bearer Token**: Include token in Authorization header
2. **API Key**: Pass as `X-API-Key` header
3. **Session**: Use session cookies (web UI)

### Authorization Levels

- **Read**: Access to GET endpoints
- **Write**: Access to POST/PUT/DELETE endpoints
- **Admin**: Access to system management endpoints
- **Scanner**: Permission to trigger scan operations

### Security Headers

All API responses include security headers:

```http
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
```

## 📈 Metrics & Monitoring

### Health Check Endpoints

Monitor system health with dedicated endpoints:

```bash
# Overall application health
curl "http://localhost:8080/api/v1/health"

# Docker daemon health
curl "http://localhost:8080/api/v1/health/docker"

# Database health
curl "http://localhost:8080/api/v1/health/database"

# Kubernetes probes
curl "http://localhost:8080/api/v1/health/ready"
curl "http://localhost:8080/api/v1/health/live"
```

### Prometheus Metrics

Application metrics available at `/metrics`:

- `volumeviz_api_requests_total`: Total API requests
- `volumeviz_scan_duration_seconds`: Scan duration histogram
- `volumeviz_volumes_total`: Total discovered volumes
- `volumeviz_alerts_triggered_total`: Total alerts triggered

## 🚨 Alert System

### Quick Alert Setup

```bash
# Create alert rule
curl -X POST -H "Content-Type: application/json" \
  "http://localhost:8080/api/v1/alerts/rules" \
  -d '{
    "name": "High Volume Usage",
    "conditions": {
      "metric": "volume.usage_percent",
      "operator": "greater_than",
      "threshold": 90
    },
    "severity": "warning"
  }'

# Create notification destination
curl -X POST -H "Content-Type: application/json" \
  "http://localhost:8080/api/v1/alerts/destinations" \
  -d '{
    "name": "Slack Alerts",
    "type": "slack",
    "configuration": {
      "webhook_url": "https://hooks.slack.com/services/...",
      "channel": "#alerts"
    }
  }'
```

## 🔄 Real-Time Features

### WebSocket Events

Subscribe to real-time events:

- `volume_update`: Volume state changes
- `scan_progress`: Live scan progress updates
- `scan_complete`: Scan completion notifications
- `alert_triggered`: Real-time alert notifications

### Event Filtering

Filter events by volume or event type:

```javascript
ws.send(JSON.stringify({
  type: 'subscribe',
  data: {
    channels: ['volume_updates', 'scan_progress'],
    volume_filter: {
      volume_ids: ['vol-abc123'],
      volume_patterns: ['prod-*']
    }
  }
}));
```

## 🛠️ Developer Tools

### OpenAPI Specification

Complete API specification available in multiple formats:

- **YAML**: `/openapi/openapi.yaml`
- **JSON**: `/openapi/swagger.json`
- **Interactive**: `/api/docs` (Swagger UI)

### Code Generation

Generate client libraries using OpenAPI generators:

```bash
# Generate TypeScript client
openapi-generator generate -i http://localhost:8080/openapi/openapi.yaml \
  -g typescript-axios -o ./src/api/generated

# Generate Python client
openapi-generator generate -i http://localhost:8080/openapi/openapi.yaml \
  -g python -o ./volumeviz-python-client
```

### Testing

Test API endpoints using included examples:

```bash
# Test volume discovery
curl "http://localhost:8080/api/v1/volumes" | jq '.'

# Test file browsing
curl "http://localhost:8080/api/v1/explorer/files?path=/data" | jq '.'

# Test health checks
curl "http://localhost:8080/api/v1/health" | jq '.checks'
```

## 📚 Detailed Documentation

| Document | Description |
|----------|-------------|
| **[Volume Management](volumes.md)** | Volume discovery, statistics, and operations |
| **[File Explorer](explorer.md)** | Browse volume contents and file operations |
| **[Metadata & Classification](metadata.md)** | File metadata extraction and analysis |
| **[Analytics & Trends](analytics.md)** | Usage statistics and trend analysis |
| **[Alerts & Monitoring](alerts.md)** | Comprehensive alerting system |
| **[System & Health](system-health.md)** | Health monitoring and system information |
| **[Real-Time Updates](websocket.md)** | WebSocket API for live updates |

## 🤝 Support

### Getting Help

- **Documentation**: Complete guides in `/docs`
- **API Reference**: Interactive docs at `/api/docs`
- **Examples**: Sample code in `/examples`
- **Issues**: Report bugs on GitHub

### Common Issues

1. **Authentication Errors**: Check token format and expiration
2. **Rate Limiting**: Implement exponential backoff
3. **WebSocket Disconnections**: Use proper reconnection logic
4. **Scan Timeouts**: Adjust timeout settings for large volumes

### Community

- **GitHub**: Submit issues and feature requests
- **Documentation**: Contribute to docs and examples
- **Discord**: Join community discussions

---

**Ready to get started?** Begin with [Volume Management](volumes.md) or explore the [Interactive API Documentation](/api/docs).
