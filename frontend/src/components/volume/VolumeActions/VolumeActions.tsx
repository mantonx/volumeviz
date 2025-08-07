import React, { useState } from 'react';
import {
  MoreVertical,
  Eye,
  Download,
  Trash2,
  RefreshCw,
  Copy,
  Share2,
  Settings,
} from 'lucide-react';
import { clsx } from 'clsx';
import { Volume } from '../../../types/api';

export interface VolumeAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  variant?: 'default' | 'danger';
  disabled?: boolean;
}

export interface VolumeActionsProps {
  volume: Volume;
  actions?: VolumeAction[];
  onAction: (actionId: string, volume: Volume) => void;
  variant?: 'dropdown' | 'inline' | 'menu';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const defaultActions: VolumeAction[] = [
  { id: 'view', label: 'View Details', icon: <Eye className="w-4 h-4" /> },
  { id: 'scan', label: 'Scan Volume', icon: <RefreshCw className="w-4 h-4" /> },
  {
    id: 'download',
    label: 'Export Data',
    icon: <Download className="w-4 h-4" />,
  },
  { id: 'clone', label: 'Clone Volume', icon: <Copy className="w-4 h-4" /> },
  { id: 'share', label: 'Share', icon: <Share2 className="w-4 h-4" /> },
  { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
  {
    id: 'delete',
    label: 'Delete',
    icon: <Trash2 className="w-4 h-4" />,
    variant: 'danger',
  },
];

/**
 * Action menu component for Docker volumes in VolumeViz.
 *
 * Features:
 * - Multiple display variants (dropdown, inline, menu)
 * - Customizable action list
 * - Danger action styling
 * - Keyboard navigation support
 * - Click-outside handling
 * - Disabled state support
 *
 * @example
 * ```tsx
 * <VolumeActions
 *   volume={volume}
 *   onAction={(actionId) => {
 *     switch (actionId) {
 *       case 'view':
 *         navigate(`/volumes/${volume.id}`);
 *         break;
 *       case 'delete':
 *         confirmDelete(volume);
 *         break;
 *     }
 *   }}
 * />
 * ```
 */
export const VolumeActions: React.FC<VolumeActionsProps> = ({
  volume,
  actions = defaultActions,
  onAction,
  variant = 'dropdown',
  size = 'md',
  className,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

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

  const handleAction = (actionId: string) => {
    setIsOpen(false);
    onAction(actionId, volume);
  };

  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  };

  const buttonSizeClasses = {
    sm: 'p-1',
    md: 'p-1.5',
    lg: 'p-2',
  };

  const iconSizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  if (variant === 'inline') {
    return (
      <div className={clsx('flex items-center gap-1', className)}>
        {actions.map((action) => (
          <button
            key={action.id}
            onClick={() => handleAction(action.id)}
            disabled={action.disabled}
            className={clsx(
              'rounded p-1.5 transition-colors',
              'hover:bg-gray-100 dark:hover:bg-gray-800',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              action.variant === 'danger' &&
                'hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400',
            )}
            title={action.label}
          >
            {action.icon}
          </button>
        ))}
      </div>
    );
  }

  if (variant === 'menu') {
    return (
      <div className={clsx('space-y-1', className)}>
        {actions.map((action) => (
          <button
            key={action.id}
            onClick={() => handleAction(action.id)}
            disabled={action.disabled}
            className={clsx(
              'w-full flex items-center gap-3 px-3 py-2 rounded-lg',
              'text-left transition-colors',
              'hover:bg-gray-100 dark:hover:bg-gray-800',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              sizeClasses[size],
              action.variant === 'danger' && [
                'text-red-600 dark:text-red-400',
                'hover:bg-red-50 dark:hover:bg-red-900/20',
              ],
            )}
          >
            {action.icon}
            <span>{action.label}</span>
          </button>
        ))}
      </div>
    );
  }

  // Default dropdown variant
  return (
    <div className={clsx('relative', className)} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          'rounded-lg transition-colors',
          'hover:bg-gray-100 dark:hover:bg-gray-800',
          buttonSizeClasses[size],
        )}
        aria-label="Volume actions"
      >
        <MoreVertical className={iconSizeClasses[size]} />
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
          {actions.map((action, index) => (
            <React.Fragment key={action.id}>
              {index > 0 && action.variant === 'danger' && (
                <div className="my-1 border-t border-gray-200 dark:border-gray-700" />
              )}
              <button
                onClick={() => handleAction(action.id)}
                disabled={action.disabled}
                className={clsx(
                  'w-full flex items-center gap-3 px-4 py-2',
                  'text-left transition-colors',
                  'hover:bg-gray-100 dark:hover:bg-gray-800',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  sizeClasses[size],
                  action.variant === 'danger' && [
                    'text-red-600 dark:text-red-400',
                    'hover:bg-red-50 dark:hover:bg-red-900/20',
                  ],
                )}
              >
                {action.icon}
                <span>{action.label}</span>
              </button>
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
};
