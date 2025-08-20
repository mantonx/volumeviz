/**
 * ViewToggle Component
 *
 * Toggle between list (table) and grid views for file explorer
 */

import { Button } from '@/components/ui/Button';
import { cn } from '@/utils';
import { LayoutGridIcon, ListIcon } from 'lucide-react';
import React from 'react';

export type ViewMode = 'list' | 'grid';

interface ViewToggleProps {
  view: ViewMode;
  onViewChange: (view: ViewMode) => void;
  className?: string;
}

export const ViewToggle: React.FC<ViewToggleProps> = ({
  view,
  onViewChange,
  className = '',
}) => {
  return (
    <div className={cn('flex items-center space-x-1', className)}>
      <Button
        variant={view === 'list' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => onViewChange('list')}
        className="px-2"
      >
        <ListIcon className="w-4 h-4" />
      </Button>
      <Button
        variant={view === 'grid' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => onViewChange('grid')}
        className="px-2"
      >
        <LayoutGridIcon className="w-4 h-4" />
      </Button>
    </div>
  );
};
