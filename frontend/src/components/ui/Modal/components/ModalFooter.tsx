/**
 * Modal Footer Component
 * Part of the compound Modal component system
 */

import React from 'react';
import { clsx } from 'clsx';
import type { BaseComponentProps } from '@/design-system/types/common';

export interface ModalFooterProps extends BaseComponentProps {
  /** Footer content */
  children: React.ReactNode;
  /** Alignment of footer content */
  align?: 'left' | 'center' | 'right' | 'between';
}

export const ModalFooter: React.FC<ModalFooterProps> = ({
  children,
  align = 'right',
  className,
  ...props
}) => {
  const alignmentClasses = {
    left: 'justify-start',
    center: 'justify-center',
    right: 'justify-end',
    between: 'justify-between',
  };

  return (
    <div
      className={clsx(
        'flex items-center gap-3',
        'px-6 py-4 border-t border-line',
        'bg-surface-secondary',
        alignmentClasses[align],
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
};
