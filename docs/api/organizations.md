# Organization Management API

The Organization Management API provides complete multi-tenant functionality for VolumeViz, enabling secure data isolation and organization-scoped operations.

## Overview

VolumeViz's multi-tenancy implementation ensures:

- **Complete Data Isolation**: Organizations cannot access each other's data
- **Row-Level Security**: Database-level protection with PostgreSQL RLS policies
- **JWT-Based Context**: Organization context propagated through JWT tokens
- **Service-Level Scoping**: All services respect organization boundaries
- **Audit Logging**: Comprehensive logging of organization operations

## Authentication & Authorization

All organization endpoints require JWT authentication with organization context:

```bash
curl -H "Authorization: Bearer $JWT_TOKEN" \
  "http://localhost:8080/api/v1/organizations"
```

### Organization Context

The JWT token includes organization context that is automatically validated:

```json
{
  "user_id": 123,
  "email": "user@company.com", 
  "organization_id": 456,
  "role": "admin",
  "exp": 1692022800
}
```

## Core Endpoints

### List Organizations

**GET** `/api/v1/organizations`

Lists organizations accessible to the authenticated user. System administrators can see all organizations; regular users see only their own.

**Query Parameters:**
- `limit` (int): Maximum number of organizations to return (default: 20, max: 100)
- `offset` (int): Number of organizations to skip (default: 0)
- `sort` (string): Sort field - `name`, `created_at`, `plan` (default: `name`)
- `order` (string): Sort order - `asc` or `desc` (default: `asc`)
- `plan` (string): Filter by plan type - `basic`, `premium`, `enterprise`

**Example Request:**
```bash
curl -H "Authorization: Bearer $JWT_TOKEN" \
  "http://localhost:8080/api/v1/organizations?limit=10&sort=created_at&order=desc"
```

**Example Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 123,
      "name": "Acme Corporation",
      "description": "Digital transformation company",
      "plan": "enterprise",
      "created_at": "2025-08-01T10:00:00Z",
      "updated_at": "2025-08-15T14:30:00Z",
      "total_users": 25,
      "total_volumes": 12,
      "total_size_bytes": 1073741824000,
      "settings": {
        "max_volumes": 100,
        "max_users": 50,
        "retention_days": 90
      }
    }
  ],
  "pagination": {
    "total": 1,
    "limit": 10,
    "offset": 0,
    "has_more": false
  }
}
```

### Get Organization

**GET** `/api/v1/organizations/{id}`

Retrieves detailed information about a specific organization.

**Path Parameters:**
- `id` (int): Organization ID

**Example Request:**
```bash
curl -H "Authorization: Bearer $JWT_TOKEN" \
  "http://localhost:8080/api/v1/organizations/123"
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "id": 123,
    "name": "Acme Corporation",
    "description": "Digital transformation company",
    "plan": "enterprise",
    "created_at": "2025-08-01T10:00:00Z",
    "updated_at": "2025-08-15T14:30:00Z",
    "total_users": 25,
    "total_volumes": 12,
    "total_size_bytes": 1073741824000,
    "settings": {
      "max_volumes": 100,
      "max_users": 50,
      "retention_days": 90,
      "features": ["advanced_analytics", "priority_support", "custom_retention"]
    },
    "quotas": {
      "storage_limit_bytes": 10737418240000,
      "storage_used_bytes": 1073741824000,
      "storage_usage_percent": 10.0
    }
  }
}
```

### Create Organization

**POST** `/api/v1/organizations`

Creates a new organization. Requires system administrator privileges.

**Request Body:**
```json
{
  "name": "New Company Ltd",
  "description": "Technology startup focused on innovation",
  "plan": "premium"
}
```

**Example Request:**
```bash
curl -X POST -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  "http://localhost:8080/api/v1/organizations" \
  -d '{
    "name": "New Company Ltd",
    "description": "Technology startup",
    "plan": "premium"
  }'
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "id": 456,
    "name": "New Company Ltd", 
    "description": "Technology startup",
    "plan": "premium",
    "created_at": "2025-08-31T15:00:00Z",
    "updated_at": "2025-08-31T15:00:00Z",
    "total_users": 0,
    "total_volumes": 0,
    "total_size_bytes": 0,
    "settings": {
      "max_volumes": 50,
      "max_users": 25,
      "retention_days": 60
    }
  }
}
```

### Update Organization

**PUT** `/api/v1/organizations/{id}`

Updates organization information. Requires organization administrator privileges.

**Path Parameters:**
- `id` (int): Organization ID

**Request Body:**
```json
{
  "name": "Updated Company Name",
  "description": "Updated description",
  "plan": "enterprise"
}
```

**Example Request:**
```bash
curl -X PUT -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  "http://localhost:8080/api/v1/organizations/456" \
  -d '{
    "name": "Updated Company Name",
    "plan": "enterprise"
  }'
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "id": 456,
    "name": "Updated Company Name",
    "description": "Technology startup",
    "plan": "enterprise",
    "updated_at": "2025-08-31T15:30:00Z",
    "settings": {
      "max_volumes": 100,
      "max_users": 50,
      "retention_days": 90
    }
  }
}
```

### Delete Organization

**DELETE** `/api/v1/organizations/{id}`

Deletes an organization and all associated data. Requires system administrator privileges.

**Path Parameters:**
- `id` (int): Organization ID

**Example Request:**
```bash
curl -X DELETE -H "Authorization: Bearer $JWT_TOKEN" \
  "http://localhost:8080/api/v1/organizations/456"
```

**Example Response:**
```json
{
  "success": true,
  "message": "Organization deleted successfully"
}
```

## User Management Endpoints

### List Organization Users

**GET** `/api/v1/organizations/{id}/users`

Lists users within an organization. Requires organization administrator privileges.

**Path Parameters:**
- `id` (int): Organization ID

**Query Parameters:**
- `limit` (int): Maximum users to return (default: 20)
- `offset` (int): Number of users to skip (default: 0) 
- `role` (string): Filter by role - `admin`, `member`, `viewer`
- `status` (string): Filter by status - `active`, `inactive`, `pending`

**Example Request:**
```bash
curl -H "Authorization: Bearer $JWT_TOKEN" \
  "http://localhost:8080/api/v1/organizations/123/users?role=admin"
```

**Example Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 789,
      "email": "admin@acme.com",
      "first_name": "John",
      "last_name": "Doe",
      "role": "admin",
      "status": "active",
      "created_at": "2025-08-01T10:00:00Z",
      "last_login": "2025-08-31T09:15:00Z"
    }
  ]
}
```

### Invite User to Organization

**POST** `/api/v1/organizations/{id}/invitations`

Invites a user to join an organization. Requires organization administrator privileges.

**Path Parameters:**
- `id` (int): Organization ID

**Request Body:**
```json
{
  "email": "newuser@company.com",
  "role": "member",
  "message": "Welcome to our team!"
}
```

**Example Request:**
```bash
curl -X POST -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  "http://localhost:8080/api/v1/organizations/123/invitations" \
  -d '{
    "email": "newuser@company.com",
    "role": "member"
  }'
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "id": 999,
    "organization_id": 123,
    "email": "newuser@company.com",
    "role": "member",
    "status": "pending",
    "token": "inv_abc123def456",
    "expires_at": "2025-09-07T15:00:00Z",
    "created_at": "2025-08-31T15:00:00Z"
  }
}
```

### List Organization Invitations

**GET** `/api/v1/organizations/{id}/invitations`

Lists pending invitations for an organization.

**Path Parameters:**
- `id` (int): Organization ID

**Query Parameters:**
- `status` (string): Filter by status - `pending`, `accepted`, `expired`
- `limit` (int): Maximum invitations to return (default: 20)
- `offset` (int): Number of invitations to skip (default: 0)

**Example Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 999,
      "email": "newuser@company.com",
      "role": "member", 
      "status": "pending",
      "invited_by": "admin@acme.com",
      "expires_at": "2025-09-07T15:00:00Z",
      "created_at": "2025-08-31T15:00:00Z"
    }
  ]
}
```

### Update Invitation Status

**PUT** `/api/v1/organizations/{id}/invitations/{invitation_id}`

Updates invitation status (accept/decline).

**Path Parameters:**
- `id` (int): Organization ID
- `invitation_id` (int): Invitation ID

**Request Body:**
```json
{
  "status": "accepted"
}
```

## Organization Statistics

### Get Organization Statistics

**GET** `/api/v1/organizations/{id}/stats`

Retrieves comprehensive statistics for an organization.

**Path Parameters:**
- `id` (int): Organization ID

**Query Parameters:**
- `start_date` (string): Start date for statistics (ISO 8601 format)
- `end_date` (string): End date for statistics (ISO 8601 format)
- `include_growth` (bool): Include growth trend data (default: false)

**Example Request:**
```bash
curl -H "Authorization: Bearer $JWT_TOKEN" \
  "http://localhost:8080/api/v1/organizations/123/stats?start_date=2025-08-01T00:00:00Z&end_date=2025-08-31T23:59:59Z&include_growth=true"
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "organization_id": 123,
    "total_volumes": 12,
    "total_size": 1073741824000,
    "total_files": 50000,
    "volume_stats": [
      {
        "volume_id": "prod-db",
        "volume_name": "Production Database",
        "total_size": 536870912000,
        "file_count": 25000,
        "last_scanned": "2025-08-31T12:00:00Z"
      }
    ],
    "growth_trends": [
      {
        "volume_id": "prod-db",
        "volume_name": "Production Database",
        "start_size": 500000000000,
        "end_size": 536870912000,
        "size_change": 36870912000,
        "growth_percent": 7.37,
        "days_period": 30
      }
    ],
    "computed_at": "2025-08-31T15:00:00Z"
  }
}
```

### Get Top Organization Files

**GET** `/api/v1/organizations/{id}/files/top`

Retrieves the largest files within an organization.

**Path Parameters:**
- `id` (int): Organization ID

**Query Parameters:**
- `limit` (int): Maximum files to return (default: 10, max: 100)
- `min_size` (int): Minimum file size in bytes

**Example Response:**
```json
{
  "success": true,
  "data": [
    {
      "volume_id": "prod-db",
      "volume_name": "Production Database",
      "file_path": "/data/database/large_table.db",
      "size": 107374182400,
      "mod_time": "2025-08-31T10:00:00Z"
    }
  ]
}
```

## Organization-Scoped Services

### Retention Policies

**GET** `/api/v1/organizations/{id}/retention/stats`

Gets retention statistics and policies for an organization.

**Example Response:**
```json
{
  "success": true,
  "data": {
    "organization_id": 123,
    "policy": {
      "organization_id": 123,
      "metrics_ttl_days": 90,
      "sizes_ttl_days": 14,
      "daily_stats_ttl_days": 365,
      "scan_jobs_ttl_days": 30,
      "enabled": true
    },
    "global_stats": {
      "volume_metrics": 150000,
      "scan_jobs": 500,
      "daily_stats": 10000,
      "file_metadata": 75000,
      "inactive_files": 5000
    },
    "organization_mode": true
  }
}
```

**PUT** `/api/v1/organizations/{id}/retention/policy`

Updates retention policy for an organization.

**Request Body:**
```json
{
  "metrics_ttl_days": 120,
  "sizes_ttl_days": 21,
  "daily_stats_ttl_days": 730,
  "scan_jobs_ttl_days": 45,
  "enabled": true
}
```

### Mount Catalog Summary

**GET** `/api/v1/organizations/{id}/mounts/summary`

Gets Docker mount catalog summary for an organization.

**Example Response:**
```json
{
  "success": true,
  "data": {
    "total_mounts": 15,
    "volume_mounts": 12,
    "bind_mounts": 2,
    "tmpfs_mounts": 1,
    "orphaned_mounts": 0,
    "tracked_mounts": 15,
    "compose_projects": 3
  }
}
```

**GET** `/api/v1/organizations/{id}/mounts`

Lists Docker mount catalog entries for an organization.

**Query Parameters:**
- `limit` (int): Maximum mounts to return (default: 20)
- `offset` (int): Number of mounts to skip (default: 0)

## Error Responses

The Organization API uses standard HTTP status codes and structured error responses:

### Common Error Codes

| Status Code | Error Code | Description |
|-------------|------------|-------------|
| 400 | `INVALID_REQUEST` | Invalid request parameters or body |
| 401 | `UNAUTHORIZED` | Missing or invalid authentication |
| 403 | `FORBIDDEN` | Insufficient permissions for operation |
| 404 | `ORGANIZATION_NOT_FOUND` | Requested organization does not exist |
| 409 | `ORGANIZATION_ALREADY_EXISTS` | Organization name already in use |
| 422 | `VALIDATION_ERROR` | Request validation failed |
| 429 | `RATE_LIMIT_EXCEEDED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Server error |

### Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "ORGANIZATION_NOT_FOUND",
    "message": "Organization with ID 999 not found",
    "details": {
      "organization_id": 999,
      "user_organization": 123,
      "suggestions": [
        "Verify organization ID is correct",
        "Ensure you have access to this organization"
      ]
    }
  }
}
```

## Security & Multi-Tenancy

### Data Isolation

VolumeViz implements comprehensive data isolation:

1. **Database Level**: PostgreSQL Row-Level Security (RLS) policies
2. **Application Level**: Repository-layer organization filtering
3. **API Level**: JWT-based organization context validation
4. **Service Level**: Organization-scoped operations

### Access Control

- **System Admin**: Can manage all organizations
- **Organization Admin**: Can manage their organization and users
- **Organization Member**: Can access organization data within role permissions
- **Organization Viewer**: Read-only access to organization data

### Audit Logging

All organization operations are logged with:

- User ID and organization context
- Operation type and resource affected
- Timestamp and request details
- Success/failure status

## Rate Limits

Organization endpoints have specific rate limits:

- **List/Read Operations**: 200 requests per minute
- **Create/Update Operations**: 50 requests per minute  
- **Delete Operations**: 10 requests per minute
- **Bulk Operations**: 5 requests per minute

## Examples

### Complete Organization Setup

```bash
# 1. Create organization (system admin)
ORG_RESPONSE=$(curl -s -X POST -H "Authorization: Bearer $ADMIN_JWT" \
  -H "Content-Type: application/json" \
  "http://localhost:8080/api/v1/organizations" \
  -d '{
    "name": "Tech Startup Inc",
    "description": "Innovative technology company",
    "plan": "premium"
  }')

ORG_ID=$(echo $ORG_RESPONSE | jq -r '.data.id')

# 2. Invite users to organization
curl -X POST -H "Authorization: Bearer $ADMIN_JWT" \
  -H "Content-Type: application/json" \
  "http://localhost:8080/api/v1/organizations/$ORG_ID/invitations" \
  -d '{
    "email": "cto@techstartup.com",
    "role": "admin"
  }'

# 3. Set custom retention policy
curl -X PUT -H "Authorization: Bearer $ORG_ADMIN_JWT" \
  -H "Content-Type: application/json" \
  "http://localhost:8080/api/v1/organizations/$ORG_ID/retention/policy" \
  -d '{
    "metrics_ttl_days": 120,
    "daily_stats_ttl_days": 730,
    "enabled": true
  }'

# 4. Get organization statistics
curl -H "Authorization: Bearer $ORG_ADMIN_JWT" \
  "http://localhost:8080/api/v1/organizations/$ORG_ID/stats?include_growth=true"
```

### User Invitation Flow

```bash
# Administrator invites user
INVITATION=$(curl -s -X POST -H "Authorization: Bearer $ORG_ADMIN_JWT" \
  -H "Content-Type: application/json" \
  "http://localhost:8080/api/v1/organizations/123/invitations" \
  -d '{
    "email": "newuser@company.com",
    "role": "member"
  }')

# User accepts invitation (via email link)
curl -X POST -H "Content-Type: application/json" \
  "http://localhost:8080/api/v1/auth/accept-invitation" \
  -d '{
    "token": "inv_abc123def456",
    "password": "securepassword123",
    "first_name": "Jane",
    "last_name": "Smith"
  }'
```

---

**Next Steps:**
- Explore [Volume Management](volumes.md) for organization-scoped volume operations
- Check [System Health](system-health.md) for organization monitoring
- Review [WebSocket API](websocket.md) for real-time organization updates