import React from 'react';
import { MoreHorizontal, X, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Dropdown, type DropdownItem } from '@/components/ui/Dropdown';
import { cn } from '@/utils';
import type {
  VolumeBulkActionsProps,
  BulkAction,
} from './VolumeBulkActions.types';

/**
 * Bulk actions bar for volume operations
 * Shows when items are selected and provides bulk operations
 */
export const VolumeBulkActions: React.FC<VolumeBulkActionsProps> = ({
  selectedCount,
  selectAllMode,
  onClearSelection,
  onSelectAll,
  onSelectPage,
  bulkActions,
  isProcessing = false,
  className,
}) => {
  if (selectedCount === 0) {
    return null;
  }

  const handleBulkAction = async (action: BulkAction) => {
    if (isProcessing) return;

    // Get selected IDs from parent component through the action
    await action.action([]);
  };

  const selectionDropdownItems: DropdownItem[] = [
    {
      id: 'select-all',
      label: 'Select all volumes',
      icon: ChevronDown,
      onClick: onSelectAll,
    },
    {
      id: 'select-page',
      label: 'Select current page',
      icon: ChevronDown,
      onClick: onSelectPage,
    },
    {
      id: 'clear-selection',
      label: 'Clear selection',
      icon: X,
      onClick: onClearSelection,
    },
  ];

  return (
    <div
      className={cn(
        'flex items-center justify-between px-4 py-3',
        'bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800',
        'animate-in slide-in-from-top-2 duration-200',
        className,
      )}
    >
      {/* Selection info */}
      <div className="flex items-center gap-3">
        <Badge variant="primary" size="lg">
          {selectedCount} selected
          {selectAllMode === 'all' && ' (all)'}
          {selectAllMode === 'page' && ' (page)'}
        </Badge>

        {/* Selection dropdown */}
        <Dropdown
          items={selectionDropdownItems}
          trigger={
            <Button variant="ghost" size="sm">
              <ChevronDown className="h-4 w-4" />
            </Button>
          }
        />

        <Button
          variant="ghost"
          size="sm"
          onClick={onClearSelection}
          className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
        >
          <X className="h-4 w-4 mr-1" />
          Clear
        </Button>
      </div>

      {/* Bulk actions */}
      <div className="flex items-center gap-2">
        {bulkActions.slice(0, 3).map((action) => {
          const Icon = action.icon;
          return (
            <Button
              key={action.id}
              variant={
                action.variant === 'destructive' ? 'destructive' : 'outline'
              }
              size="sm"
              onClick={() => handleBulkAction(action)}
              disabled={isProcessing}
            >
              <Icon className="h-4 w-4 mr-2" />
              {action.label}
            </Button>
          );
        })}

        {bulkActions.length > 3 && (
          <Dropdown
            items={bulkActions.slice(3).map((action) => ({
              id: action.id,
              label: action.label,
              icon: action.icon,
              onClick: () => handleBulkAction(action),
              destructive: action.variant === 'destructive',
            }))}
            trigger={
              <Button variant="outline" size="sm">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            }
          />
        )}
      </div>
    </div>
  );
};

export default VolumeBulkActions;
