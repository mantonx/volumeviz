import React from 'react';
import { HardDrive } from 'lucide-react';
import { Button } from '../Button';
import { Card } from '../Card';
import { cn } from '@/utils';
import type { EmptyStateProps } from './EmptyState.types';

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon = HardDrive,
  title,
  description,
  actionLabel,
  onAction,
  className,
  children,
}) => {
  return (
    <Card className={cn('p-8 text-center max-w-md mx-auto', className)}>
      <div className="text-gray-400 dark:text-gray-500 mb-4">
        <Icon className="h-12 w-12 mx-auto" />
      </div>
      
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        {title}
      </h3>
      
      {description && (
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          {description}
        </p>
      )}

      {children && (
        <div className="mb-6">
          {children}
        </div>
      )}

      {actionLabel && onAction && (
        <Button onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </Card>
  );
};