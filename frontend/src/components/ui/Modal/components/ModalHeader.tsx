/**
 * Modal Header Component
 * Part of the compound Modal component system
 */

import React from 'react';
import { X } from 'lucide-react';
import { clsx } from 'clsx';
import type { BaseComponentProps } from '@/design-system/types/common';

export interface ModalHeaderProps extends BaseComponentProps {
  /** Header title */
  title?: React.ReactNode;
  /** Whether to show the close button */
  showCloseButton?: boolean;
  /** Close button click handler */
  onClose?: () => void;
  /** Header content */
  children?: React.ReactNode;
}

export const ModalHeader: React.FC<ModalHeaderProps> = ({
  title,
  showCloseButton = true,
  onClose,
  children,
  className,
  ...props
}) => {
  return (
    <div
      className={clsx(
        'flex items-center justify-between',
        'px-6 py-4 border-b border-line',
        className,
      )}
      {...props}
    >
      <div className="flex items-center min-w-0 flex-1">
        {title && (
          <h2 className="text-lg font-semibold text-primary truncate">
            {title}
          </h2>
        )}
        {children}
      </div>

      {showCloseButton && (
        <button
          onClick={onClose}
          className={clsx(
            'ml-4 p-1 rounded-md',
            'text-tertiary hover:text-primary',
            'hover:bg-surface-hover',
            'transition-colors duration-200',
            'focus:outline-none focus:ring-2 focus:ring-brand-primary-500 focus:ring-offset-2',
          )}
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>
      )}
    </div>
  );
};
