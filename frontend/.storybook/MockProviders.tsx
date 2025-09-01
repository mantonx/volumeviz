import React, { createContext, useContext } from 'react';
import type { RealtimeContextValue } from '../src/providers/realtime/types';

// Create a mock RealtimeContext
const MockRealtimeContext = createContext<RealtimeContextValue | null>(null);

// Mock RealtimeProvider that provides a complete context value
export const MockRealtimeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Create a mock context value that matches RealtimeContextValue interface
  const mockContextValue: RealtimeContextValue = {
    // Connection state
    connectionStatus: 1, // WebSocket.OPEN
    isConnected: true,
    
    // Connection metrics
    latency: 50,
    reconnectAttempts: 0,
    connectedAt: new Date(),
    
    // Message handling
    lastMessage: null,
    sendMessage: () => console.log('Mock sendMessage called'),
    
    // Subscription management
    subscribe: (event: string) => console.log('Mock subscribe called for:', event),
    unsubscribe: (event: string) => console.log('Mock unsubscribe called for:', event),
    
    // Event listeners - Scan Events
    onScanProgress: () => () => {},
    onScanEvent: () => () => {},
    onVolumeUpdate: () => () => {},
    onVolumeState: () => () => {},
    onScanStatus: () => () => {},
    
    // Event listeners - Comprehensive Real-time Events
    onHistoricalDataUpdate: () => () => {},
    onStatisticsUpdate: () => () => {},
    onSystemHealthUpdate: () => () => {},
    onErrorEvent: () => () => {},
    
    // Event listeners - Specific Event Types (for convenience)
    onUsageSnapshot: () => () => {},
    onPerformanceMetrics: () => () => {},
    onCapacityAlert: () => () => {},
    onSystemAlert: () => () => {},
    onCriticalError: () => () => {},
  };
  
  return (
    <MockRealtimeContext.Provider value={mockContextValue}>
      {children}
    </MockRealtimeContext.Provider>
  );
};

// Hook that components can use - this will be imported instead of the real useRealtime
export const useMockRealtime = (): RealtimeContextValue => {
  const context = useContext(MockRealtimeContext);
  if (!context) {
    throw new Error('useMockRealtime must be used within a MockRealtimeProvider');
  }
  return context;
};

// Mock ToastProvider - simple implementation to avoid dependencies
export const MockToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <>{children}</>;
};