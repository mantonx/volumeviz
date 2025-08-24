import React from 'react';
import { Columns } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Checkbox } from '@/components/ui/Checkbox';
import { cn } from '@/utils';
import type { ColumnConfigProps } from './ColumnConfig.types';

/**
 * Column configuration component for data tables
 * Allows users to show/hide table columns
 */
export const ColumnConfig: React.FC<ColumnConfigProps> = ({
  show,
  onToggle,
  availableColumns,
  visibleColumns,
  onToggleColumn,
  className,
}) => {
  return (
    <div className={cn('relative', className)}>
      <Button
        variant="outline"
        size="sm"
        onClick={onToggle}
        aria-label="Configure column visibility"
        aria-expanded={show}
      >
        <Columns className="h-4 w-4 mr-2" aria-hidden="true" />
        <span className="hidden sm:inline">Columns</span>
      </Button>

      {show && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={onToggle} />

          {/* Config panel */}
          <Card
            className="absolute top-full mt-1 right-0 z-50 w-64"
            role="dialog"
            aria-label="Column visibility configuration"
          >
            <div className="p-3 border-b">
              <h3
                className="font-medium text-gray-900 dark:text-white text-sm"
                id="column-config-title"
              >
                Column Visibility
              </h3>
            </div>
            <div
              className="p-2 max-h-64 overflow-y-auto"
              role="group"
              aria-labelledby="column-config-title"
            >
              {availableColumns.map((column) => (
                <label
                  key={column.key}
                  className="flex items-center gap-2 px-2 py-1 hover:bg-gray-50 dark:hover:bg-gray-800 rounded cursor-pointer"
                >
                  <Checkbox
                    checked={visibleColumns.has(column.key)}
                    onChange={() => onToggleColumn(column.key)}
                    aria-describedby={`column-${column.key}-desc`}
                  />
                  <span className="text-sm flex-1">{column.label}</span>
                  {column.description && (
                    <span
                      id={`column-${column.key}-desc`}
                      className="text-xs text-gray-500 sr-only"
                    >
                      {column.description}
                    </span>
                  )}
                </label>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
};

export default ColumnConfig;
