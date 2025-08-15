# Metadata API Reference

The Metadata API provides detailed file metadata extraction, classification, and enrichment capabilities. These endpoints enable deep analysis of file properties, content classification, and media-specific metadata.

## 📋 Overview

**Base Path**: `/api/v1/metadata`
**Authentication**: Required (Bearer Token)
**Rate Limits**: Standard API limits apply

The Metadata API focuses on file-level analysis and classification:

- **File Metadata**: Detailed file properties and attributes
- **Media Classification**: Specialized metadata for images, videos, and audio
- **Content Analysis**: File content classification and enrichment
- **Bulk Operations**: Efficient processing of multiple files

## 🗃️ File Metadata Operations

### Get File Metadata

Retrieve comprehensive metadata for a specific file.

```http
GET /api/v1/metadata/files/{id}
```

**Path Parameters:**
- `id` (int, required): Unique file identifier

**Query Parameters:**
- `include_content_analysis` (bool, optional): Include content-based analysis (default: false)
- `include_media_metadata` (bool, optional): Include media-specific metadata (default: true)
- `include_hash` (bool, optional): Calculate and include file hash (default: false)

**Example Request:**
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "/api/v1/metadata/files/1001?include_content_analysis=true&include_media_metadata=true"
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "file_info": {
      "id": 1001,
      "name": "vacation_photo.jpg",
      "path": "/data/photos/vacation_photo.jpg",
      "volume_id": "vol-abc123",
      "folder_id": 456
    },
    "basic_metadata": {
      "size_bytes": 2048576,
      "disk_usage_bytes": 2052096,
      "extension": "jpg",
      "mime_type": "image/jpeg",
      "media_kind": "image",
      "encoding": "binary",
      "created_at": "2025-08-14T10:30:00Z",
      "modified_at": "2025-08-14T10:30:00Z",
      "accessed_at": "2025-08-14T15:45:00Z"
    },
    "filesystem_metadata": {
      "inode": 12345678,
      "device": "sda1",
      "uid": 1000,
      "gid": 1000,
      "mode": "0644",
      "permissions": "rw-r--r--",
      "is_symlink": false,
      "symlink_target": null
    },
    "media_metadata": {
      "image_properties": {
        "width": 1920,
        "height": 1080,
        "resolution": "1920x1080",
        "aspect_ratio": "16:9",
        "color_depth": 24,
        "has_transparency": false
      },
      "camera_info": {
        "make": "Canon",
        "model": "EOS R5",
        "lens": "RF 24-70mm F2.8 L IS USM"
      },
      "exif_data": {
        "date_taken": "2025-08-10T14:22:33Z",
        "gps_location": {
          "latitude": 37.7749,
          "longitude": -122.4194,
          "altitude": 56.7
        },
        "camera_settings": {
          "iso": 400,
          "aperture": "f/5.6",
          "shutter_speed": "1/125",
          "focal_length": "50mm"
        }
      }
    },
    "content_analysis": {
      "content_classification": "photograph",
      "detected_objects": ["person", "building", "sky"],
      "dominant_colors": ["#336699", "#99CCFF", "#FFCC99"],
      "content_hash": "sha256:a1b2c3d4e5f6...",
      "similarity_hash": "phash:abc123def456"
    },
    "duplicate_analysis": {
      "has_duplicates": true,
      "duplicate_count": 3,
      "duplicate_files": [
        {
          "id": 2001,
          "path": "/backup/photos/vacation_photo_copy.jpg",
          "similarity": 1.0
        }
      ]
    }
  }
}
```

## 🎨 Media-Specific Queries

### Get Files by Media Kind

Retrieve files filtered by their media classification.

```http
GET /api/v1/metadata/files/by-media-kind
```

**Query Parameters:**
- `volume_id` (string, optional): Filter by volume ID
- `media_kind` (string, required): Media type (`image`, `video`, `audio`, `document`, `archive`, `code`, `data`)
- `limit` (int, optional): Number of files to return (default: 50, max: 100)
- `offset` (int, optional): Number of files to skip (default: 0)
- `include_metadata` (bool, optional): Include detailed metadata (default: false)

**Example Request:**
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "/api/v1/metadata/files/by-media-kind?volume_id=vol-abc123&media_kind=image&limit=25&include_metadata=true"
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "files": [
      {
        "id": 1001,
        "name": "photo1.jpg",
        "path": "/data/photos/photo1.jpg",
        "size_bytes": 2048576,
        "media_kind": "image",
        "mime_type": "image/jpeg",
        "metadata": {
          "resolution": "1920x1080",
          "color_depth": 24,
          "date_taken": "2025-08-10T14:22:33Z"
        }
      }
    ],
    "summary": {
      "total_files": 156,
      "total_size": 418569216,
      "media_kind": "image",
      "average_file_size": 2682366
    }
  }
}
```

### Get Files by Resolution

Find image and video files by their resolution characteristics.

```http
GET /api/v1/metadata/files/by-resolution
```

**Query Parameters:**
- `volume_id` (string, optional): Filter by volume ID
- `min_width` (int, optional): Minimum width in pixels
- `min_height` (int, optional): Minimum height in pixels
- `max_width` (int, optional): Maximum width in pixels
- `max_height` (int, optional): Maximum height in pixels
- `aspect_ratio` (string, optional): Aspect ratio filter (`16:9`, `4:3`, `1:1`, etc.)
- `quality_category` (string, optional): Quality category (`sd`, `hd`, `fhd`, `4k`, `8k`)
- `limit` (int, optional): Number of files to return (default: 50)

**Example Request:**
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "/api/v1/metadata/files/by-resolution?volume_id=vol-abc123&quality_category=4k&aspect_ratio=16:9&limit=20"
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "files": [
      {
        "id": 2001,
        "name": "4k_video.mp4",
        "path": "/data/videos/4k_video.mp4",
        "media_kind": "video",
        "resolution": "3840x2160",
        "aspect_ratio": "16:9",
        "quality_category": "4k",
        "size_bytes": 1073741824,
        "duration_seconds": 180,
        "video_metadata": {
          "codec": "H.265/HEVC",
          "bitrate": 50000000,
          "frame_rate": 60
        }
      }
    ],
    "summary": {
      "matching_files": 12,
      "total_size": 15032385536,
      "average_resolution": "3840x2160",
      "size_distribution": {
        "under_1gb": 3,
        "1gb_to_5gb": 7,
        "over_5gb": 2
      }
    }
  }
}
```

### Get Files by Duration

Find audio and video files by their playback duration.

```http
GET /api/v1/metadata/files/by-duration
```

**Query Parameters:**
- `volume_id` (string, optional): Filter by volume ID
- `min_duration` (int, optional): Minimum duration in seconds
- `max_duration` (int, optional): Maximum duration in seconds
- `duration_category` (string, optional): Duration category (`short`, `medium`, `long`)
- `media_types` (string[], optional): Media types to include (default: `video,audio`)
- `include_metadata` (bool, optional): Include detailed metadata (default: false)

**Duration Categories:**
- `short`: 0-300 seconds (5 minutes)
- `medium`: 300-1800 seconds (5-30 minutes)
- `long`: 1800+ seconds (30+ minutes)

**Example Request:**
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "/api/v1/metadata/files/by-duration?volume_id=vol-abc123&duration_category=long&media_types=video&include_metadata=true"
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "files": [
      {
        "id": 3001,
        "name": "movie.mkv",
        "path": "/data/movies/movie.mkv",
        "media_kind": "video",
        "duration_seconds": 7200,
        "duration_formatted": "2h 0m 0s",
        "size_bytes": 4294967296,
        "metadata": {
          "video_codec": "H.264",
          "audio_codec": "DTS",
          "resolution": "1920x1080",
          "bitrate": 4780000,
          "subtitle_tracks": 3,
          "audio_tracks": 2
        }
      }
    ],
    "summary": {
      "matching_files": 8,
      "total_duration": 64800,
      "total_duration_formatted": "18h 0m 0s",
      "average_duration": 8100,
      "total_size": 25769803776
    }
  }
}
```

### Get Files by Location

Find files with embedded GPS/location metadata.

```http
GET /api/v1/metadata/files/by-location
```

**Query Parameters:**
- `volume_id` (string, optional): Filter by volume ID
- `latitude` (float, optional): Center latitude for geographic search
- `longitude` (float, optional): Center longitude for geographic search
- `radius_km` (float, optional): Search radius in kilometers (requires lat/lng)
- `has_location` (bool, optional): Filter files that have or don't have location data
- `country` (string, optional): Filter by country (if available in metadata)
- `city` (string, optional): Filter by city (if available in metadata)

**Example Request:**
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "/api/v1/metadata/files/by-location?volume_id=vol-abc123&latitude=37.7749&longitude=-122.4194&radius_km=10"
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "files": [
      {
        "id": 4001,
        "name": "golden_gate.jpg",
        "path": "/data/photos/golden_gate.jpg",
        "media_kind": "image",
        "location_data": {
          "latitude": 37.8199,
          "longitude": -122.4783,
          "altitude": 67.0,
          "distance_from_center_km": 8.2,
          "estimated_location": "Golden Gate Bridge, San Francisco, CA"
        },
        "photo_metadata": {
          "date_taken": "2025-07-15T16:30:00Z",
          "camera_make": "iPhone",
          "camera_model": "14 Pro"
        }
      }
    ],
    "summary": {
      "files_with_location": 45,
      "geographic_spread": {
        "min_latitude": 37.7049,
        "max_latitude": 37.8349,
        "min_longitude": -122.5194,
        "max_longitude": -122.3694
      },
      "location_clusters": [
        {
          "location": "San Francisco, CA",
          "file_count": 32
        },
        {
          "location": "Berkeley, CA",
          "file_count": 13
        }
      ]
    }
  }
}
```

## 🔍 Advanced Metadata Analysis

### Content-Based File Analysis

For supported file types, VolumeViz can perform advanced content analysis:

**Image Analysis:**
- Object detection and classification
- Color palette extraction
- Face detection (privacy-respecting)
- Scene classification
- Quality assessment

**Video Analysis:**
- Scene detection
- Motion analysis
- Content categorization
- Thumbnail extraction

**Document Analysis:**
- Text extraction (OCR)
- Language detection
- Document type classification
- Page count extraction

**Audio Analysis:**
- Waveform analysis
- Genre classification
- Audio quality metrics
- Silent period detection

### Bulk Metadata Operations

Process metadata for multiple files efficiently:

```bash
# Batch metadata extraction
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  "/api/v1/metadata/bulk-analyze" \
  -d '{
    "file_ids": [1001, 1002, 1003],
    "analysis_types": ["basic", "media", "content"],
    "options": {
      "include_thumbnails": true,
      "extract_text": false
    }
  }'
```

### Metadata Search and Filtering

Combine multiple metadata criteria for complex searches:

```bash
# Find high-resolution images with GPS data taken in the last month
curl -H "Authorization: Bearer $TOKEN" \
  "/api/v1/metadata/files/search" \
  -G -d "media_kind=image" \
  -d "min_width=1920" \
  -d "min_height=1080" \
  -d "has_location=true" \
  -d "date_taken_after=2025-07-14" \
  -d "limit=50"
```

## ⚠️ Error Handling

### Common Error Codes

- `400 Bad Request`: Invalid metadata parameters or filters
- `404 Not Found`: File not found or inaccessible
- `413 Payload Too Large`: Too many files requested for batch processing
- `422 Unprocessable Entity`: File type not supported for requested analysis
- `503 Service Unavailable`: Metadata extraction service temporarily unavailable

### Example Error Response

```json
{
  "success": false,
  "error": {
    "code": "UNSUPPORTED_FILE_TYPE",
    "message": "Media metadata extraction not supported for file type 'application/octet-stream'",
    "details": {
      "file_id": 1001,
      "detected_mime": "application/octet-stream",
      "supported_types": ["image/*", "video/*", "audio/*"],
      "suggestions": [
        "Use basic metadata endpoint for file system properties",
        "Check file extension and content"
      ]
    }
  }
}
```

## 🚀 Performance Considerations

### Efficient Metadata Queries
- Use specific filters to reduce result sets
- Request only needed metadata fields
- Cache frequently accessed metadata
- Use batch operations for multiple files

### Metadata Processing
- Content analysis may take longer for large files
- GPU-accelerated analysis available for supported file types
- Consider using async processing for large batches
- Thumbnail generation can be cached for repeated access

### Best Practices
- Balance detail level with response time needs
- Use pagination for large result sets
- Consider file size limits for content analysis
- Monitor API usage for metadata-heavy operations

---

**Next**: [Alerts API Reference](alerts.md) | [WebSocket API Reference](websocket.md)
