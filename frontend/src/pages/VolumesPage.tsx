import React from 'react';
import { VolumesList } from '@/components/domain/VolumesList';

/**
 * VolumesPage - Main page component for displaying Docker volumes
 *
 * This page provides a comprehensive view of all Docker volumes with:
 * - Volume listing and filtering
 * - Real-time scan progress
 * - Volume management actions
 * - Search and sorting capabilities
 */
export const VolumesPage: React.FC = () => {
  return (
    <div className="volumes-page">
      <VolumesList />
    </div>
  );
};
