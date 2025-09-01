// Mock implementation of the realtime provider for Storybook
import React from 'react';
import type { RealtimeContextValue } from '../../src/providers/realtime/types';

console.log('🔥 MOCK REALTIME MODULE LOADED - alias is working!');

// Mock useRealtime hook that provides the expected interface
export const useRealtime = (): RealtimeContextValue => {
  return {
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
};

// Mock RealtimeProvider - just passes through children since we're mocking the hook directly
export const RealtimeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <>{children}</>;
};

// Export types (re-export from the real types file)
export * from '../../src/providers/realtime/types';

// Mock all the atoms that the real provider exports
export const historicalUpdatesAtom = null;
export const recentHistoricalUpdatesAtom = null;
export const systemStatisticsAtom = null;
export const systemHealthAtom = null;
export const systemHealthScoreAtom = null;
export const errorEventsAtom = null;
export const recentErrorsAtom = null;
export const criticalErrorsAtom = null;
export const scanProgressAtom = null;
export const activeScansCountAtom = null;
export const capacityAlertsAtom = null;
export const performanceMetricsAtom = null;

// Mock action atoms
export const addHistoricalUpdateAtom = null;
export const updateSystemStatisticsAtom = null;
export const updateSystemHealthAtom = null;
export const addErrorEventAtom = null;
export const updateScanProgressAtom = null;
export const addCapacityAlertAtom = null;
export const clearVolumeVizDataAtom = null;

// Mock selector atoms
export const getScanProgressForVolumeAtom = null;
export const getAlertsForVolumeAtom = null;
export const getErrorsForVolumeAtom = null;
export const getHistoricalUpdatesForVolumeAtom = null;

// Mock hooks - add simple implementations
export const useRealtimeConnectionStatus = () => ({ isConnected: true, status: 'Connected' });
export const useRealtimeErrors = () => ([]);
export const useRealtimeDashboardSummary = () => ({});
export const useRealtimeActions = () => ({});