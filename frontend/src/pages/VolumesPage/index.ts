/**
 * Volumes page component for Docker volume management.
 *
 * Provides comprehensive interface for:
 * - Viewing all Docker volumes in grid/list format
 * - Real-time volume size scanning operations
 * - Filtering and searching volumes
 * - Bulk operations across multiple volumes
 * - Volume status monitoring and statistics
 * - Individual volume details and actions
 *
 * Integrates with Docker API for live data and supports both
 * synchronous and asynchronous scanning operations.
 */
export { VolumesPage } from './VolumesPage';
export type { VolumesPageProps, VolumeCardProps } from './VolumesPage.types';
