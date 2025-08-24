import React from 'react';
import { X } from 'lucide-react';
import { clsx } from 'clsx';

export interface FilterChip {
  id: string;
  type?: string;
  label: string;
  value: any;
}

export interface FilterChipsProps {
  chips: FilterChip[];
  onRemove: (chipId: string) => void;
  onClearAll?: () => void;
  formatLabel?: (chip: FilterChip) => string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'outlined' | 'solid';
  className?: string;
}

/**
 * Component for displaying active filter chips.
 *
 * Features:
 * - Visual representation of active filters
 * - Individual chip removal
 * - Clear all functionality
 * - Customizable styling
 * - Responsive layout
 * - Type-specific formatting
 *
 * @example
 * ```tsx
 * const chips: FilterChip[] = [
 *   { id: '1', type: 'driver', label: 'Driver', value: 'local' },
 *   { id: '2', type: 'size', label: 'Min Size', value: 1073741824 },
 * ];
 *
 * <FilterChips
 *   chips={chips}
 *   onRemove={(chipId) => removeFilter(chipId)}
 *   onClearAll={() => clearAllFilters()}
 * />
 * ```
 */
export const FilterChips: React.FC<FilterChipsProps> = ({
  chips,
  onRemove,
  onClearAll,
  formatLabel,
  size = 'md',
  variant = 'default',
  className,
}) => {
  if (chips.length === 0) {
    return null;
  }

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5',
  };

  const variantClasses = {
    default: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300',
    outlined:
      'border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300',
    solid: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  };

  const formatChipLabel = (chip: FilterChip): string => {
    if (formatLabel) {
      return formatLabel(chip);
    }
    // Default formatting
    return chip.value ? `${chip.label}: ${chip.value}` : chip.label;
  };

  return (
    <div className={clsx('flex flex-wrap items-center gap-2', className)}>
      {chips.map((chip) => (
        <div
          key={chip.id}
          className={clsx(
            'inline-flex items-center gap-1.5 rounded-full',
            sizeClasses[size],
            variantClasses[variant],
          )}
        >
          <span className="font-medium">{formatChipLabel(chip)}</span>
          <button
            onClick={() => onRemove(chip.id)}
            className={clsx(
              'rounded-full p-0.5 transition-colors',
              'hover:bg-gray-200 dark:hover:bg-gray-700',
              'focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500',
            )}
            aria-label={`Remove ${chip.label} filter`}
          >
            <X
              className={clsx(
                size === 'sm' && 'w-2.5 h-2.5',
                size === 'md' && 'w-3 h-3',
                size === 'lg' && 'w-3.5 h-3.5',
              )}
            />
          </button>
        </div>
      ))}

      {onClearAll && chips.length > 1 && (
        <button
          onClick={onClearAll}
          className={clsx(
            'text-blue-600 dark:text-blue-400',
            'hover:text-blue-700 dark:hover:text-blue-300',
            'transition-colors',
            sizeClasses[size],
          )}
        >
          Clear all
        </button>
      )}
    </div>
  );
};
