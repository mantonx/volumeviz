/**
 * TrendsPage - Historical analysis and predictive capacity planning
 *
 * Provides comprehensive trends analysis including:
 * - Historical storage growth visualization
 * - File type distribution analysis
 * - Access pattern analytics
 * - Predictive capacity planning with 90-day forecasts
 * - Comparative volume analysis
 * - Interactive time range selection
 * - Export functionality for trend data
 *
 * The trends page uses Recharts for data visualization and
 * integrates with backend analytics APIs for historical data.
 */
export { TrendsPage } from './TrendsPage';
export { TrendsPage as default } from './TrendsPage';
export type {
  TrendsPageProps,
  StorageGrowthDataPoint,
  FileTypeDistribution,
  VolumeGrowthTrend,
  CapacityForecast,
  TrendFilters,
  TrendStats,
  AccessPatternData,
  ComparativeAnalysis,
} from './TrendsPage.types';
