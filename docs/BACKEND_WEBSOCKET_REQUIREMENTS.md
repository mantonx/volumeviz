# Backend WebSocket Implementation Requirements

## Overview
The frontend is fully prepared for real-time updates via WebSocket. The backend needs to implement the WebSocket endpoint to complete the integration.

## Required WebSocket Endpoint
**URL:** `ws://localhost:8080/api/v1/ws`

## Message Protocol

### Message Format
All messages are JSON with this structure:
```json
{
  "type": "message_type",
  "data": {...},
  "volume_id": "volume_id_if_applicable", 
  "timestamp": "2024-01-15T12:00:00Z"
}
```

### Client to Server Messages

#### 1. Heartbeat
```json
{
  "type": "ping",
  "timestamp": "2024-01-15T12:00:00Z"
}
```

### Server to Client Messages

#### 1. Heartbeat Response
```json
{
  "type": "pong",
  "timestamp": "2024-01-15T12:00:00Z"
}
```

#### 2. Volume Updates (when volumes list changes)
```json
{
  "type": "volume_update",
  "data": [
    {
      "id": "volume-id",
      "name": "volume-name",
      "driver": "local",
      "mountpoint": "/path",
      "created_at": "2024-01-15T12:00:00Z"
    }
  ],
  "timestamp": "2024-01-15T12:00:00Z"
}
```

#### 3. Scan Progress (during async scans)
```json
{
  "type": "scan_progress",
  "volume_id": "volume-id",
  "data": {
    "progress": 65,
    "current_size": 1024000000,
    "files_processed": 1500
  },
  "timestamp": "2024-01-15T12:00:00Z"
}
```

#### 4. Scan Complete
```json
{
  "type": "scan_complete",
  "volume_id": "volume-id", 
  "data": {
    "volume_id": "volume-id",
    "result": {
      "total_size": 2048000000,
      "file_count": 2500,
      "directory_count": 150,
      "scanned_at": "2024-01-15T12:00:00Z",
      "method": "du",
      "duration": 5000000000
    }
  },
  "timestamp": "2024-01-15T12:00:00Z"
}
```

#### 5. Scan Error
```json
{
  "type": "scan_error",
  "volume_id": "volume-id",
  "data": {
    "error": "Permission denied accessing /path",
    "code": "SCAN_PERMISSION_ERROR"
  },
  "timestamp": "2024-01-15T12:00:00Z"
}
```

## When to Send Messages

### Volume Updates
- When new volumes are created
- When volumes are removed
- When volume metadata changes
- After any Docker volume operation

### Scan Messages
- Send `scan_progress` during long-running async scans
- Send `scan_complete` when any scan finishes (sync or async)
- Send `scan_error` when any scan fails

## Connection Management

### Heartbeat
- Client sends `ping` every 30 seconds
- Server should respond with `pong`
- Server should close connection if no ping received for 90 seconds

### Reconnection
- Frontend handles automatic reconnection
- Backend should allow reconnection at any time

## Integration Points

### Existing API Integration
The WebSocket should broadcast updates when these existing endpoints are called:

1. **GET /volumes** - Broadcast volume_update when list changes
2. **POST /volumes/{id}/size/refresh** - Broadcast scan_progress/scan_complete/scan_error
3. **GET /volumes/{id}/size** - Broadcast scan_complete if new scan performed

### Example Backend Implementation (Go with Gorilla WebSocket)
```go
package websocket

type Message struct {
    Type      string      `json:"type"`
    Data      interface{} `json:"data,omitempty"`
    VolumeID  string      `json:"volume_id,omitempty"`
    Timestamp time.Time   `json:"timestamp"`
}

type Hub struct {
    clients    map[*Client]bool
    broadcast  chan []byte
    register   chan *Client
    unregister chan *Client
}

func (h *Hub) BroadcastVolumeUpdate(volumes []Volume) {
    message := Message{
        Type: "volume_update",
        Data: volumes,
        Timestamp: time.Now(),
    }
    h.broadcastMessage(message)
}

func (h *Hub) BroadcastScanComplete(volumeID string, result ScanResult) {
    message := Message{
        Type: "scan_complete",
        VolumeID: volumeID,
        Data: result,
        Timestamp: time.Now(),
    }
    h.broadcastMessage(message)
}
```

## Testing

### Frontend Testing
1. Set `VITE_ENABLE_WEBSOCKET=true` in `.env.local`
2. Start the backend with WebSocket endpoint
3. Open the VolumeViz dashboard
4. Verify real-time status shows "Connected (WebSocket)"
5. Trigger volume scans and verify real-time updates

### Manual Testing
Use a WebSocket client to connect to `ws://localhost:8080/api/v1/ws` and verify message format.

## Current Status
- ✅ Frontend WebSocket client implemented
- ✅ Message protocol defined
- ✅ Integration points identified
- ⏸️  Backend WebSocket endpoint needs implementation
- ⏸️  Message broadcasting needs implementation
- ⏸️  Integration with existing scan/volume endpoints needed