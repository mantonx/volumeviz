# API Overview

VolumeViz provides a comprehensive RESTful API for programmatic access to all volume analytics and management functionality. The API is designed for high performance, type safety, and ease of integration.

## 🌟 API Features

### Core Capabilities
- **Volume Management**: Complete CRUD operations for Docker volumes
- **File System Analytics**: Deep analysis of file systems and directory structures
- **Real-time Monitoring**: Live data streaming via WebSocket connections
- **Advanced Search**: Powerful query capabilities with filtering and pagination
- **Alert Management**: Threshold monitoring and notification systems

### Technical Highlights
- **RESTful Design**: Clean, predictable endpoints following REST principles
- **OpenAPI 3.0**: Complete API specification with interactive documentation
- **Type Safety**: Generated clients with full type definitions
- **High Performance**: Optimized for large-scale volume analysis
- **Real-time Updates**: WebSocket integration for live data streaming

## 🏗️ API Architecture

### API Version: v1.2

The current API version is v1.2, providing 78 endpoints across 4 major functional areas:

#### Explorer API (25 endpoints)
File system browsing and navigation capabilities
```
GET    /api/v1/explorer/volumes
GET    /api/v1/explorer/volumes/{id}/tree
GET    /api/v1/explorer/files/{id}
POST   /api/v1/explorer/search
```

#### Analytics API (18 endpoints)
Volume statistics, metrics, and performance data
```
GET    /api/v1/analytics/volumes/{id}/stats
GET    /api/v1/analytics/volumes/{id}/trends
GET    /api/v1/analytics/volumes/{id}/breakdown
POST   /api/v1/analytics/reports/generate
```

#### Metadata API (20 endpoints)
File metadata, classification, and enrichment
```
GET    /api/v1/metadata/files/{id}
PUT    /api/v1/metadata/files/{id}
GET    /api/v1/metadata/files/{id}/duplicates
POST   /api/v1/metadata/bulk-update
```

#### Alerts API (15 endpoints)
Monitoring, thresholds, and notification management
```
GET    /api/v1/alerts
POST   /api/v1/alerts
PUT    /api/v1/alerts/{id}
DELETE /api/v1/alerts/{id}
```

## 🔐 Authentication & Authorization

### JWT-Based Authentication

VolumeViz uses JSON Web Tokens (JWT) for secure API access:

```bash
# Obtain access token
curl -X POST /api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "user", "password": "password"}'

# Use token in subsequent requests
curl -H "Authorization: Bearer <jwt_token>" \
  /api/v1/volumes
```

### Role-Based Access Control

Four access levels provide granular permissions:

- **Admin**: Full system access including user management
- **User**: Standard volume analysis and management
- **Viewer**: Read-only access to data and reports
- **API**: Programmatic access with configurable scope

## 📊 Request/Response Format

### Standard Request Format

```json
{
  "method": "GET|POST|PUT|DELETE",
  "headers": {
    "Authorization": "Bearer <jwt_token>",
    "Content-Type": "application/json",
    "Accept": "application/json"
  },
  "body": {
    // Request payload (for POST/PUT requests)
  }
}
```

### Standard Response Format

```json
{
  "success": true,
  "data": {
    // Response data
  },
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 1000,
    "pages": 20
  },
  "meta": {
    "request_id": "req-123",
    "timestamp": "2025-08-14T20:00:00Z",
    "version": "v1.2"
  }
}
```

### Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "VOLUME_NOT_FOUND",
    "message": "Volume with ID 'vol-123' not found",
    "details": {
      "volume_id": "vol-123",
      "suggestions": ["Check volume ID", "Verify permissions"]
    }
  },
  "meta": {
    "request_id": "req-123",
    "timestamp": "2025-08-14T20:00:00Z"
  }
}
```

## 🚀 Getting Started

### 1. Obtain API Credentials

```bash
# Create API user (admin required)
curl -X POST /api/v1/users \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "api_user",
    "password": "secure_password",
    "role": "api"
  }'
```

### 2. Authenticate and Get Token

```bash
# Login to get JWT token
TOKEN=$(curl -s -X POST /api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "api_user", "password": "secure_password"}' \
  | jq -r '.data.token')

echo "API Token: $TOKEN"
```

### 3. Make Your First API Call

```bash
# List all volumes
curl -H "Authorization: Bearer $TOKEN" \
  /api/v1/explorer/volumes

# Get volume details
curl -H "Authorization: Bearer $TOKEN" \
  /api/v1/explorer/volumes/vol-123

# Search files
curl -X POST /api/v1/explorer/search \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "*.log",
    "volume_id": "vol-123",
    "limit": 10
  }'
```

## 📝 Common Use Cases

### Volume Analysis Workflow

```bash
# 1. Discover volumes
volumes=$(curl -s -H "Authorization: Bearer $TOKEN" /api/v1/explorer/volumes)

# 2. Analyze specific volume
volume_id="vol-123"
stats=$(curl -s -H "Authorization: Bearer $TOKEN" /api/v1/analytics/volumes/$volume_id/stats)

# 3. Find large files
large_files=$(curl -s -X POST /api/v1/explorer/search \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"volume_id\": \"$volume_id\", \"size_min\": 1000000}")

# 4. Generate report
report=$(curl -s -X POST /api/v1/analytics/reports/generate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"volume_id\": \"$volume_id\", \"type\": \"storage_analysis\"}")
```

### Monitoring Setup

```bash
# Create storage alert
alert=$(curl -s -X POST /api/v1/alerts \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Volume Storage Warning",
    "type": "storage_threshold",
    "volume_id": "vol-123",
    "threshold": 80,
    "threshold_unit": "percent",
    "notification_channels": ["email", "webhook"]
  }')

# List active alerts
curl -H "Authorization: Bearer $TOKEN" /api/v1/alerts?status=active
```

## 🔌 Client Libraries

### Official Clients

Generated TypeScript client with full type safety:

```typescript
import { DefaultApi, Configuration } from '@volumeviz/client';

const config = new Configuration({
  basePath: 'https://your-volumeviz-instance.com/api/v1',
  accessToken: 'your-jwt-token'
});

const client = new DefaultApi(config);

// Type-safe API calls
const volumes = await client.getVolumes();
const volumeStats = await client.getVolumeStats({ id: 'vol-123' });
```

### Community Clients

- **Go Client**: Full-featured Go SDK
- **Python Client**: Python SDK with async support
- **CLI Tool**: Command-line interface for shell scripting

## 📊 Performance & Limits

### Rate Limiting

API requests are rate-limited to ensure system stability:

- **Authenticated Users**: 1000 requests/hour
- **API Users**: 5000 requests/hour
- **Admin Users**: 10000 requests/hour

### Pagination

Large result sets are automatically paginated:

```bash
# Default pagination (50 items per page)
curl "/api/v1/explorer/files?volume_id=vol-123"

# Custom pagination
curl "/api/v1/explorer/files?volume_id=vol-123&page=2&limit=100"
```

### Performance Tips

- **Use Pagination**: Always paginate large result sets
- **Filter Early**: Apply filters to reduce data transfer
- **Cache Results**: Cache frequently accessed data
- **Batch Operations**: Use bulk endpoints for multiple operations

## 🔍 WebSocket API

For real-time updates, connect to the WebSocket endpoint:

```javascript
const ws = new WebSocket('ws://localhost:8080/api/v1/ws?token=' + jwt_token);

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Real-time update:', data);
};

// Subscribe to volume updates
ws.send(JSON.stringify({
  action: 'subscribe',
  topic: 'volume_updates',
  volume_id: 'vol-123'
}));
```

## 📚 Interactive Documentation

### OpenAPI Specification

Complete API documentation is available at:
- **Interactive Docs**: http://your-instance/docs
- **OpenAPI JSON**: http://your-instance/api/v1/openapi.json
- **Swagger UI**: http://your-instance/swagger-ui

### Testing API Endpoints

Use the interactive documentation to:
- Explore available endpoints
- Test API calls with real data
- Generate code examples
- Understand request/response schemas

## 🛠️ Development Tools

### Postman Collection

Import the VolumeViz Postman collection for easy API testing:

```bash
# Download collection
curl -o volumeviz-api.json \
  http://your-instance/api/v1/postman-collection

# Import into Postman
# File -> Import -> volumeviz-api.json
```

### curl Examples

Complete curl examples for all endpoints:

```bash
# Health check
curl /health

# API info
curl /api/v1/info

# Volume operations
curl -H "Authorization: Bearer $TOKEN" /api/v1/explorer/volumes
curl -H "Authorization: Bearer $TOKEN" /api/v1/explorer/volumes/vol-123
```

## 🚨 Error Handling

### HTTP Status Codes

- **200 OK**: Successful request
- **201 Created**: Resource created successfully
- **400 Bad Request**: Invalid request parameters
- **401 Unauthorized**: Authentication required
- **403 Forbidden**: Insufficient permissions
- **404 Not Found**: Resource not found
- **429 Too Many Requests**: Rate limit exceeded
- **500 Internal Server Error**: Server error

### Error Response Structure

All errors follow a consistent format for easy handling:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      "field": "Additional context",
      "suggestions": ["How to fix"]
    }
  }
}
```

---

## 🎯 Next Steps

1. **Explore Endpoints**: Browse specific API sections for detailed documentation
2. **Try Examples**: Test API calls using the interactive documentation
3. **Build Integration**: Create your first integration using the client libraries
4. **Join Community**: Get help and share experiences with other developers

For detailed endpoint documentation, see:
- [Explorer API](explorer.md)
- [Analytics API](analytics.md)
- [Metadata API](metadata.md)
- [Alerts API](alerts.md)
