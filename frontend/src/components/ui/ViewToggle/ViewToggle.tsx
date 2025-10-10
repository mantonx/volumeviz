import React from 'react';
import { Grid3X3, List, LayoutGrid, Table } from 'lucide-react';
import { clsx } from 'clsx';

export type ViewType = 'grid' | 'list' | 'table' | 'cards';

export interface ViewOption {
  id: ViewType;
  label: string;
  icon: React.ReactNode;
}

export interface ViewToggleProps {
  value: ViewType;
  onChange: (view: ViewType) => void;
  options?: ViewOption[];
  size?: 'sm' | 'md' | 'lg';
  variant?: 'buttons' | 'segmented' | 'dropdown';
  showLabels?: boolean;
  className?: string;
}

const defaultOptions: ViewOption[] = [
  { id: 'cards', label: 'Cards', icon: <LayoutGrid className="w-4 h-4" /> },
  { id: 'list', label: 'List', icon: <List className="w-4 h-4" /> },
  { id: 'table', label: 'Table', icon: <Table className="w-4 h-4" /> },
  { id: 'grid', label: 'Grid', icon: <Grid3X3 className="w-4 h-4" /> },
];

/**
 * View toggle component for switching between different volume display modes in VolumeViz.
 *
 * Features:
 * - Multiple view types (cards, list, table, grid)
 * - Customizable options
 * - Multiple variants (buttons, segmented, dropdown)
 * - Responsive design
 * - Keyboard navigation
 * - ARIA labels for accessibility
 *
 * @example
 * ```tsx
 * const [view, setView] = useState<ViewType>('cards');
 *
 * <ViewToggle
 *   value={view}
 *   onChange={setView}
 *   options={[
 *     { id: 'cards', label: 'Cards', icon: <LayoutGrid /> },
 *     { id: 'list', label: 'List', icon: <List /> },
 *     { id: 'table', label: 'Table', icon: <Table /> },
 *   ]}
 * />
 * ```
 */
export const ViewToggle: React.FC<ViewToggleProps> = ({
  value,
  onChange,
  options = defaultOptions,
  size = 'md',
  variant = 'segmented',
  showLabels = false,
  className,
}) => {
  // Hooks must be at top level - used for dropdown variant
  const [isOpen, setIsOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (variant !== 'dropdown') return;

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
  }, [isOpen, variant]);

  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  };

  const paddingClasses = {
    sm: 'p-1',
    md: 'p-1.5',
    lg: 'p-2',
  };

  const iconSizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  const buttonPaddingClasses = {
    sm: 'px-2 py-1',
    md: 'px-3 py-1.5',
    lg: 'px-4 py-2',
  };

  if (variant === 'buttons') {
    return (
      <div className={clsx('flex items-center gap-1', className)}>
        {options.map((option) => (
          <button
            key={option.id}
            onClick={() => onChange(option.id)}
            className={clsx(
              'inline-flex items-center gap-2 rounded-md transition-colors',
              buttonPaddingClasses[size],
              sizeClasses[size],
              value === option.id
                ? 'bg-blue-600 text-white'
                : 'hover:bg-surface-hover text-secondary',
            )}
            aria-label={`Switch to ${option.label} view`}
          >
            {React.cloneElement(option.icon as React.ReactElement, {
              className: iconSizeClasses[size],
            })}
            {showLabels && <span>{option.label}</span>}
          </button>
        ))}
      </div>
    );
  }

  if (variant === 'dropdown') {
    const selectedOption =
      options.find((opt) => opt.id === value) || options[0];

    return (
      <div className={clsx('relative', className)} ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={clsx(
            'inline-flex items-center gap-2 rounded-lg',
            'bg-surface',
            'border border-line',
            'hover:bg-surface-hover',
            'transition-colors',
            buttonPaddingClasses[size],
            sizeClasses[size],
          )}
        >
          {React.cloneElement(selectedOption.icon as React.ReactElement, {
            className: iconSizeClasses[size],
          })}
          <span>{selectedOption.label}</span>
        </button>

        {isOpen && (
          <div
            className={clsx(
              'absolute right-0 mt-2 w-32 rounded-lg shadow-lg z-10',
              'bg-surface',
              'border border-line',
              'py-1',
            )}
          >
            {options.map((option) => (
              <button
                key={option.id}
                onClick={() => {
                  onChange(option.id);
                  setIsOpen(false);
                }}
                className={clsx(
                  'w-full flex items-center gap-2 px-3 py-2',
                  'text-left transition-colors',
                  'hover:bg-surface-hover',
                  sizeClasses[size],
                  value === option.id
                    ? 'text-blue-600 font-medium'
                    : 'text-secondary',
                )}
              >
                {React.cloneElement(option.icon as React.ReactElement, {
                  className: iconSizeClasses[size],
                })}
                <span>{option.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Default segmented variant
  return (
    <div
      className={clsx(
        'inline-flex rounded-lg',
        'bg-surface-secondary',
        paddingClasses[size],
        className,
      )}
    >
      {options.map((option) => (
        <button
          key={option.id}
          onClick={() => onChange(option.id)}
          className={clsx(
            'inline-flex items-center gap-2 rounded-md transition-all duration-200',
            'relative',
            buttonPaddingClasses[size],
            sizeClasses[size],
            value === option.id
              ? 'bg-surface shadow-sm text-primary'
              : 'text-tertiary hover:text-primary',
          )}
          aria-label={`Switch to ${option.label} view`}
          aria-pressed={value === option.id}
        >
          {React.cloneElement(option.icon as React.ReactElement, {
            className: iconSizeClasses[size],
          })}
          {showLabels && <span>{option.label}</span>}
        </button>
      ))}
    </div>
  );
};
