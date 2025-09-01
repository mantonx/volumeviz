/**
 * SearchPage Component
 *
 * Full-page search interface with comprehensive functionality
 */

import React from 'react';
import { SearchInterface } from '@/components/domain/search';
import type { SearchPageProps } from './SearchPage.types';

export const SearchPage: React.FC<SearchPageProps> = ({ className = '' }) => {
  const handleFileSelect = (fileId: number) => {
    // Navigate to file details or open file explorer
    console.log('Selected file:', fileId);
    // TODO: Integrate with existing file navigation
  };

  return (
    <div className={`search-page space-y-8 ${className}`}>
      <SearchInterface onFileSelect={handleFileSelect} className="max-w-none" />
    </div>
  );
};
