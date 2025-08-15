# Explorer API Reference

The Explorer API provides comprehensive file system browsing and navigation capabilities for Docker volumes. These endpoints enable deep analysis of volume contents, file searching, and directory tree exploration.

## 📋 Overview

**Base Path**: `/api/v1/explorer`
**Authentication**: Required (Bearer Token)
**Rate Limits**: Standard API limits apply

The Explorer API includes 9 core endpoints for file system operations:

- **File Operations**: File listing, searching, and filtering
- **Directory Navigation**: Tree browsing and folder exploration
- **Content Analysis**: File type and metadata filtering

## 🗂️ File Operations

### List Files by Folder

List all files within a specific folder with pagination.

```http
GET /api/v1/explorer/files
```

**Query Parameters:**
- `folder_id` (int, required): ID of the folder to list files from
- `limit` (int, optional): Number of files to return (default: 50, max: 100)
- `offset` (int, optional): Number of files to skip (default: 0)

**Example Request:**
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "/api/v1/explorer/files?folder_id=123&limit=25"
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "files": [
      {
        "id": 1001,
        "folder_id": 123,
        "volume_id": "vol-abc123",
        "name": "document.pdf",
        "path": "/data/docs/document.pdf",
        "extension": "pdf",
        "size_bytes": 2048576,
        "disk_usage_bytes": 2052096,
        "mime": "application/pdf",
        "media_kind": "document",
        "mtime": "2025-08-14T10:30:00Z",
        "created_at": "2025-08-14T08:15:00Z"
      }
    ]
  },
  "pagination": {
    "limit": 25,
    "offset": 0,
    "total": 150,
    "pages": 6
  }
}
```

### Get Files with Pagination

Retrieve files with advanced pagination and sorting options.

```http
GET /api/v1/explorer/files/paginated
```

**Query Parameters:**
- `volume_id` (string, optional): Filter by volume ID
- `folder_id` (int, optional): Filter by folder ID
- `limit` (int, optional): Number of files to return (default: 50, max: 100)
- `offset` (int, optional): Number of files to skip (default: 0)
- `sort` (string, optional): Sort field (`name`, `size`, `mtime`) (default: `name`)
- `order` (string, optional): Sort order (`asc`, `desc`) (default: `asc`)

**Example Request:**
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "/api/v1/explorer/files/paginated?volume_id=vol-abc123&sort=size&order=desc&limit=20"
```

### Get Files by Media Type

Filter files by their media type classification.

```http
GET /api/v1/explorer/files/by-media-type
```

**Query Parameters:**
- `volume_id` (string, required): Volume to search in
- `media_type` (string, required): Media type to filter by (`image`, `video`, `audio`, `document`, `archive`, etc.)
- `limit` (int, optional): Number of files to return (default: 50)
- `offset` (int, optional): Number of files to skip (default: 0)

**Example Request:**
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "/api/v1/explorer/files/by-media-type?volume_id=vol-abc123&media_type=image&limit=30"
```

### Get Files by Extension

Filter files by their file extension.

```http
GET /api/v1/explorer/files/by-extension
```

**Query Parameters:**
- `volume_id` (string, required): Volume to search in
- `extension` (string, required): File extension to filter by (without dot, e.g., `pdf`, `jpg`)
- `limit` (int, optional): Number of files to return (default: 50)
- `offset` (int, optional): Number of files to skip (default: 0)

**Example Request:**
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "/api/v1/explorer/files/by-extension?volume_id=vol-abc123&extension=log"
```

### Get Recent Files

List recently modified files in a volume.

```http
GET /api/v1/explorer/files/recent
```

**Query Parameters:**
- `volume_id` (string, required): Volume to search in
- `hours` (int, optional): Number of hours to look back (default: 24)
- `limit` (int, optional): Number of files to return (default: 50)

**Example Request:**
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "/api/v1/explorer/files/recent?volume_id=vol-abc123&hours=48&limit=25"
```

### Search Files

Search for files by name patterns or content criteria.

```http
GET /api/v1/explorer/files/search
```

**Query Parameters:**
- `volume_id` (string, required): Volume to search in
- `query` (string, required): Search pattern (supports wildcards: `*`, `?`)
- `case_sensitive` (bool, optional): Whether search should be case sensitive (default: false)
- `limit` (int, optional): Number of results to return (default: 50)

**Example Request:**
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "/api/v1/explorer/files/search?volume_id=vol-abc123&query=*.log&limit=100"
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "files": [
      {
        "id": 2001,
        "name": "application.log",
        "path": "/var/log/application.log",
        "size_bytes": 1024000,
        "mtime": "2025-08-14T12:00:00Z",
        "match_type": "filename",
        "match_score": 1.0
      }
    ],
    "search_metadata": {
      "query": "*.log",
      "total_matches": 25,
      "search_time_ms": 45
    }
  }
}
```

## 🌳 Directory Navigation

### Get Folder Tree

Retrieve the complete directory tree structure for a volume.

```http
GET /api/v1/explorer/tree
```

**Query Parameters:**
- `volume_id` (string, required): Volume to generate tree for
- `max_depth` (int, optional): Maximum depth to traverse (default: 10)
- `include_files` (bool, optional): Include files in tree structure (default: false)
- `include_hidden` (bool, optional): Include hidden directories (default: false)

**Example Request:**
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "/api/v1/explorer/tree?volume_id=vol-abc123&max_depth=5&include_files=true"
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "tree": {
      "id": 1,
      "name": "/",
      "path": "/",
      "type": "directory",
      "size_bytes": 10240000,
      "file_count": 150,
      "children": [
        {
          "id": 2,
          "name": "data",
          "path": "/data",
          "type": "directory",
          "size_bytes": 8192000,
          "file_count": 120,
          "children": [
            {
              "id": 1001,
              "name": "document.pdf",
              "path": "/data/document.pdf",
              "type": "file",
              "size_bytes": 2048576,
              "mime": "application/pdf"
            }
          ]
        }
      ]
    },
    "metadata": {
      "volume_id": "vol-abc123",
      "total_directories": 15,
      "total_files": 150,
      "max_depth_reached": 3
    }
  }
}
```

### Get Tree Children

Get immediate children of a specific directory node.

```http
GET /api/v1/explorer/tree/children
```

**Query Parameters:**
- `parent_id` (int, required): ID of the parent directory
- `include_files` (bool, optional): Include files in results (default: true)
- `sort` (string, optional): Sort field (`name`, `size`, `mtime`) (default: `name`)

**Example Request:**
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "/api/v1/explorer/tree/children?parent_id=2&include_files=true&sort=size"
```

### Browse Folder

Get detailed folder information including contents summary.

```http
GET /api/v1/explorer/browse
```

**Query Parameters:**
- `folder_id` (int, required): ID of the folder to browse
- `include_summary` (bool, optional): Include content summary statistics (default: true)

**Example Request:**
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "/api/v1/explorer/browse?folder_id=123&include_summary=true"
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "folder": {
      "id": 123,
      "name": "documents",
      "path": "/data/documents",
      "parent_id": 2,
      "volume_id": "vol-abc123",
      "created_at": "2025-08-01T09:00:00Z",
      "updated_at": "2025-08-14T15:30:00Z"
    },
    "summary": {
      "total_files": 45,
      "total_size": 104857600,
      "file_types": {
        "pdf": 20,
        "docx": 15,
        "txt": 10
      },
      "largest_file": {
        "name": "presentation.pdf",
        "size_bytes": 15728640
      },
      "newest_file": {
        "name": "notes.txt",
        "mtime": "2025-08-14T14:22:00Z"
      }
    }
  }
}
```

## 🔍 Advanced Filtering

### Multi-criteria Search

Combine multiple search criteria for complex file discovery.

**Example: Find large image files modified in last week:**
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "/api/v1/explorer/files/search" \
  -G -d "volume_id=vol-abc123" \
  -d "query=*.{jpg,png,gif}" \
  -d "min_size=1048576" \
  -d "max_age_hours=168"
```

### Batch Operations

**Get multiple file types in one request:**
```bash
# Search for multiple extensions
curl -H "Authorization: Bearer $TOKEN" \
  "/api/v1/explorer/files/search?volume_id=vol-abc123&query=*.{log,txt,json}"
```

## ⚠️ Error Responses

### Common Error Codes

- `400 Bad Request`: Invalid parameters or malformed request
- `404 Not Found`: Volume, folder, or file not found
- `403 Forbidden`: Insufficient permissions to access resource
- `413 Payload Too Large`: Search query too broad (returns too many results)
- `429 Too Many Requests`: Rate limit exceeded

### Example Error Response

```json
{
  "success": false,
  "error": {
    "code": "VOLUME_NOT_FOUND",
    "message": "Volume with ID 'vol-invalid' not found",
    "details": {
      "volume_id": "vol-invalid",
      "suggestions": [
        "Check volume ID format",
        "Verify volume exists and is accessible",
        "Ensure proper authentication"
      ]
    }
  },
  "meta": {
    "request_id": "req-123456",
    "timestamp": "2025-08-14T16:00:00Z"
  }
}
```

## 🚀 Performance Tips

### Optimize File Listing
- Use pagination with reasonable limits (≤ 100 items)
- Filter by folder or volume to reduce result sets
- Sort by indexed fields (`name`, `size`, `mtime`) for better performance

### Efficient Searching
- Use specific file extensions rather than broad wildcards
- Combine filters to narrow results early
- Cache frequently accessed directory structures

### Tree Navigation
- Limit tree depth for large volumes
- Use `include_files=false` for directory-only navigation
- Request children on-demand rather than full tree

---

**Next**: [Metadata API Reference](metadata.md) | [Analytics API Reference](analytics.md)
