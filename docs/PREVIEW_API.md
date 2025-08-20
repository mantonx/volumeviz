# Preview API Documentation

The VolumeViz Preview API provides efficient on-disk preview generation for media files with content-addressed storage and WebP optimization.

## Overview

- **Content-addressed storage**: SHA256-based deduplication prevents duplicate preview generation
- **WebP format**: All previews are converted to WebP for optimal compression and web delivery
- **Multiple media types**: Supports images, videos, and audio files
- **Lazy generation**: Previews are generated on-demand and cached for future requests
- **ETag caching**: HTTP caching with ETag/304 responses for optimal performance

## Endpoints

### Generate Preview

**POST** `/api/v1/previews/{file_id}/generate`

Generates a preview for a file. If a preview already exists, returns cached metadata.

**Parameters:**
- `file_id` (path): File ID in the database
- `type` (query): Preview type - `thumbnail`, `poster`, or `cover`
- `size` (query): Preview size - `small` (256px), `medium` (512px), or `large` (1024px)
- `time_offset` (query, videos only): Time offset in seconds for video poster frames (default: 5.0)

**Response:**
```json
{
  "metadata": {
    "id": "123",
    "file_id": "456",
    "type": "thumbnail",
    "size": "medium",
    "format": "webp",
    "content_hash": "abc123...",
    "storage_path": "ab/cd/ef.../thumbnail/medium/12/34/56....webp",
    "processing_ms": 245,
    "created_at": "2025-08-17T10:30:00Z",
    "accessed_at": "2025-08-17T10:30:00Z"
  },
  "cache_hit": false,
  "processing_ms": 245
}
```

### Get Preview

**GET** `/api/v1/previews/{file_id}`

Retrieves the preview image file. Supports ETag caching and conditional requests.

**Parameters:**
- `file_id` (path): File ID in the database
- `size` (query): Preview size - `small`, `medium`, or `large` (default: medium)
- `time_offset` (query, videos only): Time offset in seconds for video poster frames

**Response:**
- **200**: WebP image data with appropriate headers
- **304**: Not Modified (when ETag matches)
- **404**: Preview not found

**Headers:**
- `Content-Type: image/webp`
- `ETag: W/"content-hash"`
- `Cache-Control: public, max-age=2592000`

### Check Preview Status

**HEAD** `/api/v1/previews/{file_id}`

Checks if a preview exists without downloading the content.

**Response:**
- **200**: Preview exists
- **404**: Preview not found

## Preview Types

### Image Thumbnails (`thumbnail`)
- **Input**: JPEG, PNG, GIF, WebP, TIFF, BMP, SVG, HEIC, HEIF, AVIF, JPEG XL
- **Output**: WebP format with quality=85
- **Processing**: libvips for high-performance thumbnail generation
- **Features**: Smart crop, aspect ratio preservation, downscaling only

### Video Posters (`poster`)
- **Input**: MP4, MPEG, QuickTime, AVI, Matroska, WebM, OGG, etc.
- **Output**: WebP format poster frame
- **Processing**: ffmpeg for frame extraction
- **Features**: Configurable time offset, automatic quality optimization

### Audio Cover Art (`cover`)
- **Input**: MP3, MP4, AAC, OGG, FLAC, WAV, WebM, WMA, AIFF, APE, WavPack
- **Output**: WebP format cover art or waveform visualization
- **Processing**: ffmpeg for cover art extraction
- **Features**: Embedded art extraction, fallback to waveform generation

## Preview Sizes

| Size   | Dimensions | Use Case              |
|--------|------------|-----------------------|
| small  | 256x256    | List views, thumbnails |
| medium | 512x512    | Grid views, details    |
| large  | 1024x1024  | Full preview, lightbox |

## Storage Structure

Previews are stored using content-addressed paths:
```
/var/lib/volumeviz/previews/
  ab/cd/source_hash_suffix/
    thumbnail/medium/
      12/34/content_hash_suffix.webp
```

This structure enables:
- **Deduplication**: Identical content shares the same storage
- **Efficient access**: Fast lookup by source and content hashes
- **Scalability**: Distributed across directory hierarchy

## Integration with File Scanning

Previews are automatically generated during filesystem indexing:

1. **File Discovery**: When a media file is discovered during volume scanning
2. **MIME Detection**: File type is detected for preview eligibility
3. **Async Generation**: Preview generation happens in background goroutines
4. **Error Tolerance**: Preview failures don't block filesystem indexing
5. **Deduplication**: Content-addressed storage prevents duplicate work

## Performance Considerations

- **Concurrent Generation**: Configurable concurrency limits prevent resource exhaustion
- **Size Limits**: Files larger than 500MB are skipped by default
- **Timeout Protection**: 30-second timeout prevents hanging processes
- **Cleanup**: Automatic cleanup of old previews (30-day default retention)
- **Streaming**: Large previews are streamed directly to reduce memory usage

## Error Handling

- **Missing Tools**: Graceful degradation when libvips/ffmpeg unavailable
- **Unsupported Formats**: Clear error messages for unsupported files
- **Storage Errors**: Atomic writes prevent corrupted previews
- **Processing Failures**: Non-blocking errors with detailed logging

## Configuration

Preview service configuration (via environment variables):

```bash
VV_PREVIEW_DIR="/var/lib/volumeviz/previews"
VV_PREVIEW_MAX_CONCURRENT=3
VV_PREVIEW_PROCESS_TIMEOUT=30s
VV_PREVIEW_MAX_SOURCE_SIZE_MB=500
VV_VIPS_PATH="vips"
VV_FFMPEG_PATH="ffmpeg"
VV_PREVIEW_SMART_CROP=true
VV_PREVIEW_CLEANUP_ENABLED=true
VV_PREVIEW_CLEANUP_INTERVAL=1h
VV_PREVIEW_MAX_AGE=720h
```

## Frontend Integration

The frontend includes responsive preview components:

- **PreviewImage**: React component with lazy loading and blur-up placeholders
- **FileGrid**: Gallery view with large previews
- **FileTable**: List view with small preview icons
- **Responsive srcset**: Automatic size selection based on viewport
- **Progressive loading**: Blur-up technique for smooth UX