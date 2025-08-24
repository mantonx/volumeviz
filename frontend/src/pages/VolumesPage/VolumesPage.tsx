import React from 'react';
import { VolumesList } from '@/components/domain/VolumesList';
import type { VolumesPageProps } from './VolumesPage.types';

/**
 * Main Volumes page component.
 *
 * Features:
 * - Table view with all required columns (name/path, type, driver, compose project/service, containers, RO/RW, status, last seen, size/growth)
 * - Filter chips and fuzzy search functionality
 * - Multi-column sorting with saved configurations
 * - Named views with shareable URLs
 * - Bulk actions (track/untrack/hide)
 * - Proper loading states, error handling, and empty states
 */
export const VolumesPage: React.FC<VolumesPageProps> = () => {
  return <VolumesList />;
};
