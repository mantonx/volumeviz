# WebSocket API Reference

The WebSocket API provides real-time communication for volume updates, scan progress, and system events. This enables responsive user interfaces and real-time monitoring capabilities.

## 📋 Overview

**WebSocket URL**: `ws://localhost:8080/api/v1/ws` (Development)
**WebSocket URL**: `wss://api.volumeviz.io/api/v1/ws` (Production)
**Protocol**: WebSocket (RFC 6455)
**Authentication**: Bearer token via query parameter or Sec-WebSocket-Protocol header

## 🔌 Connection Management

### Establishing Connection

Connect to the WebSocket endpoint to receive real-time updates.

```javascript
// Basic connection
const ws = new WebSocket('ws://localhost:8080/api/v1/ws');

// Connection with authentication
const ws = new WebSocket('ws://localhost:8080/api/v1/ws?token=your_bearer_token');

// Alternative authentication via protocol header
const ws = new WebSocket('ws://localhost:8080/api/v1/ws', ['Bearer', 'your_bearer_token']);
```

### Connection States

```javascript
ws.onopen = function(event) {
  console.log('WebSocket connected');
  // Connection established successfully
};

ws.onclose = function(event) {
  console.log('WebSocket disconnected:', event.code, event.reason);
  // Handle reconnection logic
};

ws.onerror = function(error) {
  console.error('WebSocket error:', error);
  // Handle connection errors
};
```

### Heartbeat / Keep-Alive

The WebSocket connection supports ping/pong heartbeat messages to maintain connectivity.

```javascript
// Send ping to server
ws.send(JSON.stringify({
  type: 'ping',
  timestamp: new Date().toISOString()
}));

// Handle pong response
ws.onmessage = function(event) {
  const message = JSON.parse(event.data);
  if (message.type === 'pong') {
    console.log('Heartbeat acknowledged');
  }
};
```

## 📨 Message Format

All WebSocket messages follow a consistent envelope structure:

```typescript
interface EventEnvelope {
  type: string;           // Event type identifier
  ts: string;            // ISO 8601 timestamp (RFC 3339)
  data: any;             // Event-specific data payload
  volume_id?: string;    // Volume ID (when applicable)
}
```

## 📤 Client-to-Server Messages

### Ping (Heartbeat)

Send heartbeat to maintain connection and check server responsiveness.

```json
{
  "type": "ping",
  "timestamp": "2025-08-14T15:45:30Z"
}
```

**Server Response:**
```json
{
  "type": "pong",
  "ts": "2025-08-14T15:45:30Z",
  "data": {
    "server_time": "2025-08-14T15:45:30.123Z",
    "connection_duration": 3600
  }
}
```

### Subscribe to Volume Updates

Request to receive updates for specific volumes.

```json
{
  "type": "subscribe",
  "data": {
    "channels": ["volume_updates", "scan_progress"],
    "volume_filter": {
      "volume_ids": ["vol-abc123", "vol-def456"],
      "volume_patterns": ["app-*", "data-*"]
    }
  }
}
```

### Unsubscribe from Updates

Stop receiving updates for specific channels or volumes.

```json
{
  "type": "unsubscribe",
  "data": {
    "channels": ["scan_progress"],
    "volume_ids": ["vol-abc123"]
  }
}
```

## 📥 Server-to-Client Messages

### Volume Update Events

Receive real-time notifications when volume states change.

```json
{
  "type": "volume_update",
  "ts": "2025-08-14T15:45:30Z",
  "volume_id": "vol-abc123",
  "data": {
    "volume_id": "vol-abc123",
    "volume_name": "app-data",
    "action": "attached",
    "container_id": "container-def456",
    "details": {
      "mount_point": "/app/data",
      "mount_mode": "rw",
      "container_name": "web-server",
      "image": "nginx:latest"
    }
  }
}
```

**Volume Action Types:**
- `created`: New volume discovered
- `removed`: Volume deleted from system
- `attached`: Volume mounted to container
- `detached`: Volume unmounted from container
- `updated`: Volume metadata or configuration changed
- `scanned`: Volume scan completed with new size data

### Scan Progress Events

Real-time updates during volume scanning operations.

```json
{
  "type": "scan_progress",
  "ts": "2025-08-14T15:45:30Z",
  "volume_id": "vol-abc123",
  "data": {
    "volume_id": "vol-abc123",
    "progress": 45,
    "current_size": 4831838208,
    "files_processed": 15420,
    "estimated_total": 10737418240,
    "method": "filesystem_walk",
    "started_at": "2025-08-14T15:44:00Z",
    "rate": {
      "files_per_second": 1250,
      "bytes_per_second": 52428800,
      "eta_seconds": 180
    },
    "current_path": "/app/data/logs/2025/08/14"
  }
}
```

**Progress Fields:**
- `progress`: Completion percentage (0-100)
- `current_size`: Bytes processed so far
- `files_processed`: Number of files scanned
- `estimated_total`: Estimated total bytes (if available)
- `method`: Scan method being used
- `started_at`: Scan start timestamp
- `rate`: Processing rate statistics
- `current_path`: Current directory being scanned

### Scan Complete Events

Notification when volume scanning finishes.

```json
{
  "type": "scan_complete",
  "ts": "2025-08-14T15:47:30Z",
  "volume_id": "vol-abc123",
  "data": {
    "volume_id": "vol-abc123",
    "total_size": 10737418240,
    "file_count": 28456,
    "directory_count": 1245,
    "method": "filesystem_walk",
    "duration": 210000,
    "scanned_at": "2025-08-14T15:47:30Z",
    "statistics": {
      "largest_file": {
        "path": "/app/data/database/main.db",
        "size": 1073741824
      },
      "file_types": {
        "documents": 12456,
        "images": 8920,
        "logs": 6543,
        "databases": 3,
        "other": 534
      },
      "size_distribution": {
        "small_files": 25420,
        "medium_files": 2856,
        "large_files": 180
      }
    }
  }
}
```

### Scan Error Events

Notification when volume scanning encounters errors.

```json
{
  "type": "scan_error",
  "ts": "2025-08-14T15:46:15Z",
  "volume_id": "vol-abc123",
  "data": {
    "volume_id": "vol-abc123",
    "error": "Permission denied accessing /app/data/secure",
    "error_code": "PERMISSION_DENIED",
    "partial_results": {
      "progress": 65,
      "files_processed": 18240,
      "current_size": 7123456789
    },
    "method": "filesystem_walk",
    "started_at": "2025-08-14T15:44:00Z",
    "failed_at": "2025-08-14T15:46:15Z",
    "recovery_options": [
      "retry_with_elevated_permissions",
      "skip_inaccessible_paths",
      "partial_scan_complete"
    ]
  }
}
```

### System Events

General system and application events.

```json
{
  "type": "system_event",
  "ts": "2025-08-14T15:45:30Z",
  "data": {
    "event_type": "docker_reconnected",
    "severity": "info",
    "message": "Docker daemon connection restored",
    "details": {
      "downtime_duration": 30000,
      "volumes_affected": 12,
      "auto_recovery": true
    }
  }
}
```

### Alert Notifications

Real-time alert notifications from the alerts system.

```json
{
  "type": "alert_triggered",
  "ts": "2025-08-14T15:45:30Z",
  "data": {
    "alert_id": "alert-20250814154530-001",
    "rule_id": "rule-001",
    "rule_name": "High Volume Usage",
    "severity": "warning",
    "volume_id": "vol-abc123",
    "volume_name": "app-data",
    "current_value": 92.5,
    "threshold_value": 90.0,
    "message": "Volume app-data usage is 92.5%, exceeding threshold of 90%"
  }
}
```

## 🔄 Event Subscription Management

### Channel-Based Subscriptions

Subscribe to specific event channels to receive targeted updates.

**Available Channels:**
- `volume_updates`: Volume state changes
- `scan_progress`: Scan progress events
- `scan_complete`: Scan completion events
- `scan_errors`: Scan error events
- `system_events`: System-level events
- `alerts`: Alert notifications
- `metrics`: Performance metrics updates

```javascript
// Subscribe to multiple channels
ws.send(JSON.stringify({
  type: 'subscribe',
  data: {
    channels: ['volume_updates', 'scan_progress', 'alerts'],
    volume_filter: {
      volume_ids: ['vol-abc123', 'vol-def456']
    }
  }
}));
```

### Volume-Specific Subscriptions

Filter events to specific volumes or volume patterns.

```javascript
// Subscribe to specific volumes
ws.send(JSON.stringify({
  type: 'subscribe',
  data: {
    channels: ['volume_updates'],
    volume_filter: {
      volume_ids: ['vol-abc123'],
      volume_patterns: ['prod-*', 'data-*'],
      exclude_patterns: ['temp-*', 'cache-*']
    }
  }
}));
```

## 📊 Real-Time Metrics

### Connection Metrics

Monitor WebSocket connection health and performance.

```http
GET /api/v1/ws/metrics
```

**Example Response:**
```json
{
  "total_clients": 15,
  "clients": [
    {
      "id": "client-001",
      "connected_at": "2025-08-14T15:30:00Z",
      "ip_address": "192.168.1.100",
      "user_agent": "Mozilla/5.0...",
      "subscriptions": ["volume_updates", "scan_progress"],
      "messages_sent": 245,
      "messages_received": 12,
      "last_ping": "2025-08-14T15:45:00Z"
    }
  ],
  "statistics": {
    "total_connections": 1247,
    "active_connections": 15,
    "messages_per_second": 12.5,
    "average_connection_duration": 1800,
    "reconnection_rate": 0.02
  }
}
```

## 🔧 Client Implementation Examples

### React Hook for WebSocket

```typescript
import { useEffect, useState, useRef } from 'react';

interface WebSocketEvent {
  type: string;
  ts: string;
  data: any;
  volume_id?: string;
}

export function useVolumeVizWebSocket(url: string, token: string) {
  const [isConnected, setIsConnected] = useState(false);
  const [events, setEvents] = useState<WebSocketEvent[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const ws = new WebSocket(`${url}?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      console.log('VolumeViz WebSocket connected');
    };

    ws.onmessage = (event) => {
      const message: WebSocketEvent = JSON.parse(event.data);
      setEvents(prev => [...prev, message]);
    };

    ws.onclose = () => {
      setIsConnected(false);
      console.log('VolumeViz WebSocket disconnected');
    };

    ws.onerror = (error) => {
      console.error('VolumeViz WebSocket error:', error);
    };

    return () => {
      ws.close();
    };
  }, [url, token]);

  const sendMessage = (message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  };

  return { isConnected, events, sendMessage };
}
```

### Vue.js Composition API

```typescript
import { ref, onMounted, onUnmounted } from 'vue';

export function useWebSocket(url: string) {
  const isConnected = ref(false);
  const events = ref<any[]>([]);
  let ws: WebSocket | null = null;

  onMounted(() => {
    ws = new WebSocket(url);

    ws.onopen = () => {
      isConnected.value = true;
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      events.value.push(message);

      // Handle specific event types
      switch (message.type) {
        case 'volume_update':
          handleVolumeUpdate(message.data);
          break;
        case 'scan_progress':
          handleScanProgress(message.data);
          break;
        case 'scan_complete':
          handleScanComplete(message.data);
          break;
      }
    };

    ws.onclose = () => {
      isConnected.value = false;
    };
  });

  onUnmounted(() => {
    ws?.close();
  });

  return { isConnected, events };
}
```

### Vanilla JavaScript

```javascript
class VolumeVizWebSocket {
  constructor(url, options = {}) {
    this.url = url;
    this.options = options;
    this.ws = null;
    this.isConnected = false;
    this.eventHandlers = {};
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;

    this.connect();
  }

  connect() {
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.emit('connected');
      console.log('VolumeViz WebSocket connected');
    };

    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.emit(message.type, message);
      this.emit('message', message);
    };

    this.ws.onclose = () => {
      this.isConnected = false;
      this.emit('disconnected');
      this.attemptReconnect();
    };

    this.ws.onerror = (error) => {
      console.error('VolumeViz WebSocket error:', error);
      this.emit('error', error);
    };
  }

  attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.pow(2, this.reconnectAttempts) * 1000; // Exponential backoff

      console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
      setTimeout(() => this.connect(), delay);
    }
  }

  send(message) {
    if (this.isConnected && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  on(eventType, handler) {
    if (!this.eventHandlers[eventType]) {
      this.eventHandlers[eventType] = [];
    }
    this.eventHandlers[eventType].push(handler);
  }

  off(eventType, handler) {
    if (this.eventHandlers[eventType]) {
      this.eventHandlers[eventType] = this.eventHandlers[eventType]
        .filter(h => h !== handler);
    }
  }

  emit(eventType, data) {
    if (this.eventHandlers[eventType]) {
      this.eventHandlers[eventType].forEach(handler => handler(data));
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

// Usage
const ws = new VolumeVizWebSocket('ws://localhost:8080/api/v1/ws');

ws.on('volume_update', (message) => {
  console.log('Volume updated:', message.data);
});

ws.on('scan_progress', (message) => {
  updateProgressBar(message.data.volume_id, message.data.progress);
});

ws.on('scan_complete', (message) => {
  showScanCompleteNotification(message.data);
});
```

## ⚠️ Error Handling

### Connection Errors

WebSocket connections can fail for various reasons. Implement robust error handling:

```javascript
ws.onerror = function(error) {
  console.error('WebSocket error:', error);

  // Common error scenarios:
  // - Network connectivity issues
  // - Authentication failures
  // - Server unavailable
  // - Invalid URL or protocol
};

ws.onclose = function(event) {
  console.log(`WebSocket closed: ${event.code} - ${event.reason}`);

  // Handle different close codes:
  switch(event.code) {
    case 1000: // Normal closure
      console.log('Connection closed normally');
      break;
    case 1001: // Going away
      console.log('Server going away, reconnecting...');
      break;
    case 1006: // Abnormal closure
      console.log('Connection lost, attempting reconnect...');
      break;
    case 4001: // Authentication failed
      console.log('Authentication failed, check token');
      break;
    default:
      console.log('Unexpected close code:', event.code);
  }
};
```

### Message Validation

Always validate incoming WebSocket messages:

```javascript
ws.onmessage = function(event) {
  try {
    const message = JSON.parse(event.data);

    // Validate message structure
    if (!message.type || !message.ts) {
      console.warn('Invalid message format:', message);
      return;
    }

    // Handle message by type
    switch(message.type) {
      case 'volume_update':
        if (message.data && message.data.volume_id) {
          handleVolumeUpdate(message.data);
        }
        break;
      default:
        console.log('Unknown message type:', message.type);
    }
  } catch (error) {
    console.error('Failed to parse WebSocket message:', error);
  }
};
```

## 🚀 Best Practices

### Connection Management
- Implement exponential backoff for reconnection attempts
- Handle authentication token expiration gracefully
- Monitor connection health with ping/pong heartbeats
- Close connections properly when application shuts down

### Event Handling
- Filter events to reduce unnecessary processing
- Implement event queuing for high-frequency updates
- Use event aggregation for progress updates
- Handle out-of-order message delivery

### Performance Optimization
- Subscribe only to needed channels and volumes
- Implement client-side rate limiting for UI updates
- Use message batching for bulk operations
- Monitor memory usage with long-running connections

### Security Considerations
- Always use WSS (secure WebSocket) in production
- Validate authentication tokens on connection
- Implement proper CORS policies
- Monitor connection patterns for abuse

---

**Next**: [Authentication Guide](../user-guide/authentication.md) | [Error Handling](../development/error-handling.md)
