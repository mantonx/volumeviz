import React, { useState } from 'react';
import { ChevronDown, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { clsx } from 'clsx';

export interface SortOption {
  id: string;
  label: string;
  field: string;
}

export interface SortSelectorProps {
  options: SortOption[];
  value: string;
  order: 'asc' | 'desc';
  onChange: (sortBy: string, order: 'asc' | 'desc') => void;
  variant?: 'dropdown' | 'inline' | 'button';
  size?: 'sm' | 'md' | 'lg';
  showOrderToggle?: boolean;
  className?: string;
}

/**
 * Sort selector component for volume lists in VolumeViz.
 *
 * Features:
 * - Multiple display variants
 * - Order toggle (asc/desc)
 * - Keyboard navigation
 * - Customizable options
 * - Visual indicators
 * - Responsive design
 *
 * @example
 * ```tsx
 * const sortOptions: SortOption[] = [
 *   { id: 'name', label: 'Name', field: 'name' },
 *   { id: 'size', label: 'Size', field: 'size' },
 *   { id: 'created', label: 'Date Created', field: 'created_at' },
 * ];
 *
 * <SortSelector
 *   options={sortOptions}
 *   value="name"
 *   order="asc"
 *   onChange={(sortBy, order) => {
 *     setSortBy(sortBy);
 *     setSortOrder(order);
 *   }}
 * />
 * ```
 */
export const SortSelector: React.FC<SortSelectorProps> = ({
  options,
  value,
  order,
  onChange,
  variant = 'dropdown',
  size = 'md',
  showOrderToggle = true,
  className,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.id === value) || options[0];

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () =>
        document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleSelect = (optionId: string) => {
    if (optionId === value) {
      // Toggle order if selecting the same option
      onChange(value, order === 'asc' ? 'desc' : 'asc');
    } else {
      // Change to new option with default ascending order
      onChange(optionId, 'asc');
    }
    setIsOpen(false);
  };

  const _toggleOrder = () => {
    onChange(value, order === 'asc' ? 'desc' : 'asc');
  };

  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  };

  const paddingClasses = {
    sm: 'px-2 py-1',
    md: 'px-3 py-1.5',
    lg: 'px-4 py-2',
  };

  const iconSizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  const OrderIcon = () => {
    if (order === 'asc') {
      return <ArrowUp className={iconSizeClasses[size]} />;
    }
    return <ArrowDown className={iconSizeClasses[size]} />;
  };

  if (variant === 'inline') {
    return (
      <div className={clsx('flex items-center gap-2', className)}>
        {options.map((option) => (
          <button
            key={option.id}
            onClick={() => handleSelect(option.id)}
            className={clsx(
              'inline-flex items-center gap-1.5 rounded-md transition-colors',
              paddingClasses[size],
              sizeClasses[size],
              value === option.id
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300',
            )}
          >
            <span>{option.label}</span>
            {value === option.id && showOrderToggle && <OrderIcon />}
          </button>
        ))}
      </div>
    );
  }

  if (variant === 'button') {
    return (
      <button
        onClick={() => onChange(value, order === 'asc' ? 'desc' : 'asc')}
        className={clsx(
          'inline-flex items-center gap-2 rounded-lg',
          'bg-white dark:bg-gray-800',
          'border border-gray-300 dark:border-gray-600',
          'hover:bg-gray-50 dark:hover:bg-gray-700',
          'transition-colors',
          paddingClasses[size],
          sizeClasses[size],
          className,
        )}
      >
        <ArrowUpDown className={iconSizeClasses[size]} />
        <span>Sort: {selectedOption.label}</span>
        {showOrderToggle && <OrderIcon />}
      </button>
    );
  }

  // Default dropdown variant
  return (
    <div className={clsx('relative', className)} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          'inline-flex items-center gap-2 rounded-lg',
          'bg-white dark:bg-gray-800',
          'border border-gray-300 dark:border-gray-600',
          'hover:bg-gray-50 dark:hover:bg-gray-700',
          'transition-colors',
          paddingClasses[size],
          sizeClasses[size],
        )}
      >
        <span className="text-gray-600 dark:text-gray-400">Sort by:</span>
        <span className="font-medium">{selectedOption.label}</span>
        {showOrderToggle && <OrderIcon />}
        <ChevronDown
          className={clsx(
            iconSizeClasses[size],
            'transition-transform',
            isOpen && 'rotate-180',
          )}
        />
      </button>

      {isOpen && (
        <div
          className={clsx(
            'absolute right-0 mt-2 w-48 rounded-lg shadow-lg z-10',
            'bg-white dark:bg-gray-900',
            'border border-gray-200 dark:border-gray-700',
            'py-1',
          )}
        >
          {options.map((option) => (
            <button
              key={option.id}
              onClick={() => handleSelect(option.id)}
              className={clsx(
                'w-full flex items-center justify-between px-4 py-2',
                'text-left transition-colors',
                'hover:bg-gray-100 dark:hover:bg-gray-800',
                sizeClasses[size],
                value === option.id
                  ? 'text-blue-600 dark:text-blue-400 font-medium'
                  : 'text-gray-700 dark:text-gray-300',
              )}
            >
              <span>{option.label}</span>
              {value === option.id && showOrderToggle && <OrderIcon />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
