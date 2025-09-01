# Frontend WebSocket Cleanup Plan

## Current State Analysis

### Legacy WebSocketProvider Components Found:
1. **Header.tsx** - Connection status display, WebSocket status icon
2. **ExplorerPage.tsx** - File explorer real-time updates  
3. **ExplorerView.tsx** - Explorer view real-time updates
4. **SubtleProgressIndicator.tsx** - Progress tracking
5. **LiveVolumeChart.tsx** - Live chart updates
6. **WebSocketConnectionTest.tsx** - Dev/debug component
7. **WebSocketDevPanel.tsx** - Dev/debug component
8. **ScanProgressDisplay.stories.tsx** - Storybook stories
9. **ScanProgressDisplay.test.tsx** - Unit tests

### Key Differences Between Providers:

#### Legacy WebSocketProvider API:
```typescript
interface WebSocketState {
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  latency?: number;
  reconnectAttempts: number;
  isConnected: boolean;
  lastMessage?: any;
  messageHistory: any[];
  // ... other fields
}
```

#### New RealtimeProvider API:
```typescript
interface RealtimeContextValue {
  connectionStatus: ReadyState; // 0=connecting, 1=open, 2=closing, 3=closed
  isConnected: boolean;
  lastMessage: MessageEvent<any> | null;
  sendMessage: (message: any) => void;
  subscribe: (event: string, filters?: Record<string, any>) => void;
  unsubscribe: (event: string, filters?: Record<string, any>) => void;
  onScanProgress: (callback: (data: ScanProgressData) => void) => () => void;
  onScanEvent: (callback: (type: string, data: any) => void) => () => void;
  onVolumeUpdate: (callback: (data: any) => void) => () => void;
}
```

## Migration Strategy

**Core Principle: Clean Migration Without Legacy Adapters**

Instead of creating legacy compatibility layers, we will:
1. **Identify genuinely useful functionality** from the old provider
2. **Implement clean, modern versions** in the new RealtimeProvider
3. **Leverage backend capabilities** for any complex functionality
4. **Update components** to use the new, clean API patterns
5. **Remove all legacy code** without backwards compatibility

### Phase 1: Component Analysis & Backend Integration
For each component, document:
- What WebSocket functionality it actually needs (vs what it currently uses)
- Message types it listens for
- State it depends on
- Opportunities to move logic to backend

### Phase 2: RealtimeProvider Clean Enhancement
Add genuinely useful functionality with modern patterns:
1. **Connection metrics**: Simple latency tracking, reconnection attempts
2. **Backend-driven features**: Let server provide complex state/metrics
3. **Clean event system**: Modern subscription patterns
4. **Proper error handling**: Using React patterns, not legacy state machines

### Phase 3: Component Migration with Modern Patterns
Migrate components using clean, new patterns:

#### Priority 1 - Critical UI Components:
1. **Header.tsx** - Main navigation, affects entire app
2. **SubtleProgressIndicator.tsx** - Progress feedback

#### Priority 2 - Feature Components:
3. **LiveVolumeChart.tsx** - Data visualization
4. **ExplorerView.tsx** - File browsing
5. **ExplorerPage.tsx** - Page wrapper

#### Priority 3 - Development/Testing:
6. **WebSocketConnectionTest.tsx** - Dev tools
7. **WebSocketDevPanel.tsx** - Debug tools
8. **ScanProgressDisplay.stories.tsx** - Storybook
9. **ScanProgressDisplay.test.tsx** - Tests

### Phase 4: Legacy Provider Removal
1. Remove WebSocketProvider.tsx file
2. Update any remaining imports
3. Verify no broken references

## Component-Specific Migration Notes

### Header.tsx
**Current usage:**
- `ws.status` for connection icon
- `ws.latency` for latency display  
- `ws.reconnectAttempts` for reconnection status

**Clean migration approach:**
- Use `connectionStatus` (ReadyState) directly with proper UI mapping
- Implement simple latency tracking in RealtimeProvider
- Use reconnectAttempts from react-use-websocket or simple counter
- **NO status string mapping** - use ReadyState values directly

### LiveVolumeChart.tsx
**Current usage:**
- Listening for volume update messages
- Real-time chart data updates

**Clean migration approach:**
- Use `onVolumeUpdate` callback with clean data structure
- Let backend provide aggregated chart data
- Remove any frontend data processing - let server handle it

### Explorer Components
**Current usage:**  
- File system change notifications
- Directory update events

**Clean migration approach:**
- Use `onScanProgress` for file scanning updates
- Let backend provide structured file system events
- Remove complex frontend state management - use server state

## Implementation Steps

### Step 1: Clean RealtimeProvider Enhancement
```typescript
// Clean, minimal additions to RealtimeProvider:
interface RealtimeContextValue {
  // Connection state (use ReadyState directly)
  connectionStatus: ReadyState;
  isConnected: boolean;
  
  // Simple metrics (no complex legacy state)
  latency: number | null;
  reconnectAttempts: number;
  connectedAt?: Date;
  
  // Clean event system
  onScanProgress: (callback: (data: ScanProgressData) => void) => () => void;
  onScanEvent: (callback: (type: string, data: any) => void) => () => void;
  onVolumeUpdate: (callback: (data: any) => void) => () => void;
}
```

### Step 2: NO Migration Utilities
**We will NOT create mapping utilities or compatibility layers.**
Components will be updated to use modern patterns directly.

### Step 3: Component Migration Template
For each component:
1. Update import: `WebSocketProvider` → `RealtimeProvider`
2. Update hook usage: `useWebSocket()` → `useRealtime()`
3. Map API differences using utilities
4. Update message handling to use new callback system
5. Test functionality
6. Update tests and stories

### Step 4: Validation & Testing
- Unit tests pass
- Integration tests pass  
- Manual testing of WebSocket functionality
- Storybook stories work
- Dev tools functional

## Risk Mitigation

1. **Incremental migration** - Migrate one component at a time
2. **Feature flags** - Ability to toggle between old/new providers during transition
3. **Comprehensive testing** - Validate each component after migration
4. **Rollback plan** - Keep legacy provider until all components migrated
5. **Documentation** - Document API differences and migration patterns

## Success Criteria

✅ All components use RealtimeProvider  
✅ No references to legacy WebSocketProvider  
✅ WebSocket functionality works as before  
✅ Tests pass  
✅ No performance regressions  
✅ Dev tools still functional  

## Estimated Timeline

- **Phase 1**: 1 hour - Analysis & planning
- **Phase 2**: 2-3 hours - RealtimeProvider enhancements  
- **Phase 3**: 3-4 hours - Component migration
- **Phase 4**: 1 hour - Cleanup & validation

**Total**: 7-9 hours for complete migration