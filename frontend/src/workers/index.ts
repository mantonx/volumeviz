// Worker files - these are loaded dynamically
// Export worker message types for TypeScript

export type {
  TreemapWorkerMessage as TreemapMessage,
  TreemapWorkerResponse as TreemapResponse,
} from './treemap.worker';
export type {
  AggregationWorkerMessage as AggregationMessage,
  AggregationWorkerResponse as AggregationResponse,
} from './aggregation.worker';
