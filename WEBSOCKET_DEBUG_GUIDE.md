# WebSocket Real-time Updates Debugging Guide

## Overview
This guide helps debug the sporadic WebSocket real-time updates issue in the ScanProgressDisplay component.

## Debugging Tools Created

### 1. Enhanced WebSocket Test Page (`/websocket-test`)

**Features:**
- Side-by-side comparison of Provider WebSocket vs Raw WebSocket
- Real-time message statistics and counts
- Console logging with message numbers and timestamps
- Subscription testing
- Manual scan triggering

**How to Use:**
1. Start the development environment: `docker-compose -f docker-compose.dev.yml up`
2. Navigate to `http://localhost:3000/websocket-test`
3. Click "Subscribe (Provider)" and "Connect Raw WebSocket"
4. Click "Start Test Scan" to trigger a scan
5. Watch both message panels for updates
6. Compare message counts between Provider and Raw WebSocket

**What to Look For:**
- Are both connections receiving messages?
- Are message counts similar between Provider and Raw?
- Check browser console for detailed message logs
- Note any gaps in message sequences

### 2. Backend WebSocket Debug Script (`debug-websocket-backend.js`)

**Features:**
- Direct connection to backend WebSocket
- Color-coded console output
- Message statistics tracking
- Automatic scan triggering
- Periodic stats reporting

**How to Use:**
```bash
# Basic usage
node debug-websocket-backend.js

# Verbose mode (shows full message details)
VERBOSE=1 node debug-websocket-backend.js
```

**What to Look For:**
- Connection establishment
- Subscription acknowledgment
- Message frequency and timing
- Progress update patterns
- Any connection drops or errors

### 3. Cypress E2E Tests (`cypress/e2e/websocket-realtime-debug.cy.js`)

**Features:**
- Automated WebSocket connection testing
- Message reception verification
- Provider vs Raw WebSocket comparison
- Real-time scan progress testing
- Disconnection/reconnection handling

**How to Use:**
```bash
# Run Cypress tests
npx cypress open

# Or run headless
npx cypress run --spec "cypress/e2e/websocket-realtime-debug.cy.js"
```

**What to Look For:**
- Test failures indicating message reception issues
- Timing problems with message delivery
- Differences between Provider and Raw WebSocket behavior

## Common Issues and Solutions

### Issue 1: No Messages Received
**Symptoms:**
- WebSocket shows "Connected" but no messages appear
- Message count stays at 0

**Debug Steps:**
1. Check browser console for WebSocket connection errors
2. Verify backend WebSocket server is running on port 8080
3. Use Raw WebSocket connection to bypass provider issues
4. Check subscription message format

**Potential Causes:**
- WebSocket endpoint not available
- Subscription not properly sent
- Message routing issues in provider

### Issue 2: Intermittent Message Reception  
**Symptoms:**
- Messages appear sometimes but not consistently
- Provider and Raw WebSocket show different message counts

**Debug Steps:**
1. Compare Provider vs Raw message counts
2. Check for network connectivity issues
3. Monitor browser developer tools Network tab
4. Look for connection drops and reconnections

**Potential Causes:**
- WebSocket connection instability
- Message throttling or filtering
- Event handler registration issues

### Issue 3: ScanProgressDisplay Not Updating
**Symptoms:**
- WebSocket test page receives messages
- ScanProgressDisplay component doesn't update

**Debug Steps:**
1. Check if ScanProgressDisplay is properly subscribing
2. Verify volumeId and scanId matching
3. Look for console errors in ScanProgressDisplay
4. Check if progress data transformation is working

**Potential Causes:**
- Incorrect subscription filters
- Data transformation errors
- Component re-rendering issues
- Event handler cleanup problems

### Issue 4: Delayed Updates
**Symptoms:**  
- Messages eventually arrive but with significant delays
- Progress updates are batched rather than real-time

**Debug Steps:**
1. Check message timestamps in debug tools
2. Monitor backend heartbeat frequency
3. Look for throttling in ProgressThrottler
4. Check WebSocket message queuing

**Potential Causes:**
- Intentional throttling (2-second interval)
- Network latency
- Message queuing on client or server
- Database update delays

## Backend Debug Points

### Key Components to Check:

1. **Progress Throttler** (`internal/services/filesystem/progress_throttler.go:209`)
   - Heartbeat updates every 2 seconds
   - Database progress updates

2. **WebSocket Hub** (`internal/websocket/hub.go`)
   - Message broadcasting
   - Client connection management

3. **Scheduler Broadcaster** (`internal/scheduler/scheduler.go:578`)
   - Comprehensive progress broadcasting every 1 second

### Backend Logging Points:
```go
// Add these debug logs to identify issues
fmt.Printf("[DEBUG] WebSocket broadcast sent: %+v\n", message)
fmt.Printf("[DEBUG] Connected clients: %d\n", len(h.clients))  
fmt.Printf("[DEBUG] Progress update queued: %s\n", scanID)
```

## Testing Scenarios

### Scenario 1: Fresh Scan
1. Clear all messages in test page
2. Start new scan
3. Verify scan_started message received
4. Monitor progress updates frequency
5. Check for scan_complete message

### Scenario 2: Connection Recovery
1. Connect both Provider and Raw WebSocket
2. Disconnect Raw WebSocket mid-scan
3. Reconnect Raw WebSocket  
4. Verify message reception resumes

### Scenario 3: Multiple Volumes
1. Subscribe to all scan progress (no filters)
2. Start scans on multiple volumes
3. Verify messages are properly filtered by volume_id

### Scenario 4: Browser Tab Switching
1. Start scan with progress display visible
2. Switch to another tab for 30 seconds
3. Return to volume tab
4. Check if updates resumed properly

## Expected Message Flow

```
1. WebSocket Connection
   └── subscribe message sent

2. Scan Started  
   ├── scan_started message
   └── progress updates begin

3. Volume Scan Phase (0-15%)
   ├── progress updates every 2s
   └── phase completion

4. Filesystem Indexing (15-85%)
   ├── frequent progress updates  
   ├── current_item updates
   └── phase completion

5. Media Enrichment (85-100%)
   ├── progress updates
   └── phase completion

6. Scan Complete
   └── scan_complete message
```

## Performance Expectations

- **Message Frequency:** Every 1-2 seconds during active scanning
- **Connection Latency:** < 100ms for local development
- **Progress Update Granularity:** Every 10% or significant milestone
- **Heartbeat Interval:** Every 7 seconds from scheduler

## Next Steps

If issues persist after using these tools:

1. **Enable Verbose Logging:** Set debug flags in backend services
2. **Network Analysis:** Use Wireshark to monitor WebSocket traffic  
3. **Database Profiling:** Check for slow progress update queries
4. **Memory Profiling:** Look for memory leaks in WebSocket connections
5. **Load Testing:** Test with multiple concurrent scans

---

**Created:** August 26, 2025  
**Last Updated:** August 26, 2025