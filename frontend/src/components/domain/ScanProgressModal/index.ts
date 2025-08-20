/**
 * ScanProgressModal - Tier 3 Domain-Specific Composition
 *
 * A comprehensive scan monitoring interface that combines all Tier 1 and Tier 2
 * components into a sophisticated domain-specific composition for real-time
 * scan progress tracking.
 */

// Main component
export { ScanProgressModal } from './ScanProgressModal';
export type { ScanProgressModalRef } from './ScanProgressModal';

// Types and interfaces
export type {
  ScanProgressModalProps,
  ScanProgressModalState,
  ScanStatus,
  ScanProgressTab,
  ScanPhase,
  ScanStatistics,
  ScanContext,
  ScanData,
  WebSocketState,
  ScanProgressActions,
  TabConfig,
  UseScanProgressReturn,
  ScanDataUtils,
} from './ScanProgressModal.types';

// Utility functions
export { scanDataUtils, createMockScanData } from './ScanProgressModal.types';
