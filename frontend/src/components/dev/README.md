# WebSocket Development Components

This directory contains development-only components for testing and debugging WebSocket functionality.

## Components

### WebSocketDevPanel

**File**: `WebSocketDevPanel.tsx`

A comprehensive development panel for testing WebSocket connections:

- **Access**: Press `Ctrl+Shift+W` in development mode
- **Features**:
  - Real-time connection status display
  - Send test messages (ping, custom JSON)
  - View message log with timestamps
  - Connection metrics (latency, attempts)
  - Manual connection controls (connect/disconnect/reconnect)
  - Auto-scrolling message log with manual override

**Usage**:
```tsx
import { WebSocketDevPanel, useWebSocketDevPanel } from '@/components/dev/WebSocketDevPanel';

const MyComponent = () => {
  const devPanel = useWebSocketDevPanel();
  
  return (
    <>
      {/* Your component */}
      <WebSocketDevPanel isOpen={devPanel.isOpen} onClose={devPanel.closePanel} />
    </>
  );
};
```

### WebSocketConnectionTest

**File**: `WebSocketConnectionTest.tsx`

A testing component for automated WebSocket behavior validation:

- **Features**:
  - Automated reconnection testing
  - Error handling verification
  - Heartbeat mechanism testing
  - Connection history logging
  - Manual controls for edge case testing

**Usage**:
```tsx
import { WebSocketConnectionTest } from '@/components/dev/WebSocketConnectionTest';

// Add to any page for testing
<WebSocketConnectionTest />
```

## Environment Variables

The WebSocket system respects these environment variables:

```bash
# Enable/disable WebSocket functionality
VITE_ENABLE_WEBSOCKET=true

# WebSocket server URL
VITE_WS_URL=ws://localhost:8080/api/v1/ws

# Development mode (enables dev panel)
VITE_DEV_MODE=true
```

## Testing

### Manual Testing

1. **Dev Panel**: Press `Ctrl+Shift+W` to open the WebSocket dev panel
2. **Connection Test**: Add `<WebSocketConnectionTest />` to any page
3. **Status Pill**: Monitor the header status pill for real-time connection state

### Automated Testing

Cypress tests are available in `/cypress/e2e/websocket-status.cy.ts`:

```bash
# Run WebSocket tests
npm run cypress:run -- --spec "cypress/e2e/websocket-status.cy.ts"
```

### Test Scenarios

The dev components help test these scenarios:

1. **Connection States**:
   - Initial connection
   - Successful reconnection after network loss
   - Error handling for invalid messages
   - Heartbeat/latency measurement

2. **Edge Cases**:
   - Server unavailable on startup
   - Network interruption during active session
   - Rapid connect/disconnect cycles
   - Invalid WebSocket URL configuration

3. **Performance**:
   - Connection latency measurement
   - Message throughput
   - Memory leaks during long sessions
   - Cleanup on component unmount

## Development Notes

- Components are only rendered in development mode (`import.meta.env.DEV`)
- WebSocket provider is globally available via `useWebSocket()` hook
- Status updates are debounced (200ms) to prevent UI flicker
- Connection attempts use exponential backoff with jitter (1-5 seconds)
- Maximum reconnection attempts: 10 (configurable)

## Troubleshooting

### Common Issues

1. **"WebSocket client not initialized"**
   - Ensure `WebSocketProvider` wraps your app
   - Check that `VITE_ENABLE_WEBSOCKET=true`

2. **Dev panel not opening**
   - Verify you're in development mode
   - Try the keyboard shortcut `Ctrl+Shift+W`
   - Check browser console for errors

3. **Connection never succeeds**
   - Verify backend WebSocket server is running on correct port
   - Check `VITE_WS_URL` configuration
   - Ensure no proxy/firewall blocking WebSocket connections

4. **Status pill not updating**
   - Check that `websocketEnabledAtom` is set correctly
   - Verify WebSocket provider is properly connected to Jotai atoms
   - Look for React rendering issues in console

### Debug Tips

- Enable WebSocket debugging: `localStorage.setItem('debug-websocket', 'true')`
- Monitor network tab in browser DevTools for WebSocket frames
- Use the dev panel message log to trace connection events
- Check the connection test component for automated validation