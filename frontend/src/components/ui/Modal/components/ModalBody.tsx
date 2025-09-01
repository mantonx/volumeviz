/**
 * Modal Body Component
 * Part of the compound Modal component system
 */

import React from 'react';
import { clsx } from 'clsx';
import type { BaseComponentProps } from '@/design-system/types/common';

export interface ModalBodyProps extends BaseComponentProps {
  /** Body content */
  children: React.ReactNode;
  /** Whether to add padding to the body */
  noPadding?: boolean;
  /** Whether to allow scrolling in the body */
  scrollable?: boolean;
}

export const ModalBody: React.FC<ModalBodyProps> = ({
  children,
  noPadding = false,
  scrollable = true,
  className,
  ...props
}) => {
  return (
    <div
      className={clsx(
        'flex-1',
        !noPadding && 'px-6 py-4',
        scrollable && 'overflow-y-auto',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};