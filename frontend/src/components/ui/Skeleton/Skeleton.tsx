/**
 * Skeleton Component
 * Provides loading skeleton animations for better loading states
 */

import React from 'react';
import { cn } from '@/utils';

interface SkeletonProps {
  className?: string;
  children?: React.ReactNode;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className,
  children,
  ...props
}) => {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-gray-200',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
};

// Specialized skeleton components for common patterns
interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  className?: string;
}

export const TableSkeleton: React.FC<TableSkeletonProps> = ({
  rows = 8,
  columns = 6,
  className,
}) => {
  return (
    <div className={cn('overflow-hidden', className)}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-surface-secondary border-b border-line">
            <tr>
              <th className="p-3 w-10">
                <Skeleton className="h-4 w-4" />
              </th>
              {[...Array(columns - 1)].map((_, i) => (
                <th key={i} className="p-3 text-left">
                  <Skeleton
                    className={cn(
                      'h-4',
                      i === 0
                        ? 'w-24'
                        : i === 1
                          ? 'w-16'
                          : i === 2
                            ? 'w-20'
                            : 'w-24',
                    )}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-y border-line">
            {[...Array(rows)].map((_, i) => (
              <tr key={i}>
                <td className="p-3">
                  <Skeleton className="h-4 w-4" />
                </td>
                <td className="p-3">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48 bg-surface-secondary" />
                  </div>
                </td>
                <td className="p-3">
                  <Skeleton className="h-6 w-16 rounded-full" />
                </td>
                <td className="p-3">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-2 w-full bg-surface-secondary rounded-full" />
                  </div>
                </td>
                {columns > 4 && (
                  <td className="p-3">
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-3 w-12 bg-surface-secondary" />
                    </div>
                  </td>
                )}
                {columns > 5 && (
                  <td className="p-3">
                    <Skeleton className="h-4 w-20" />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

interface CardSkeletonProps {
  lines?: number;
  className?: string;
}

export const CardSkeleton: React.FC<CardSkeletonProps> = ({
  lines = 3,
  className,
}) => {
  return (
    <div className={cn('space-y-3 p-4', className)}>
      <div className="flex items-center space-x-2">
        <Skeleton className="h-8 w-8 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-24 bg-surface-secondary" />
        </div>
      </div>
      <div className="space-y-2">
        {[...Array(lines)].map((_, i) => (
          <Skeleton
            key={i}
            className={cn('h-4', i === lines - 1 ? 'w-3/4' : 'w-full')}
          />
        ))}
      </div>
    </div>
  );
};

interface ListSkeletonProps {
  items?: number;
  showAvatar?: boolean;
  showSubtitle?: boolean;
  className?: string;
}

export const ListSkeleton: React.FC<ListSkeletonProps> = ({
  items = 5,
  showAvatar = true,
  showSubtitle = true,
  className,
}) => {
  return (
    <div className={cn('space-y-3', className)}>
      {[...Array(items)].map((_, i) => (
        <div key={i} className="flex items-center space-x-3">
          {showAvatar && <Skeleton className="h-10 w-10 rounded-full" />}
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            {showSubtitle && (
              <Skeleton className="h-3 w-1/2 bg-surface-secondary" />
            )}
          </div>
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
};

// Pre-configured skeletons for specific components
export const VolumeListSkeleton: React.FC<{ rows?: number }> = ({
  rows = 8,
}) => <TableSkeleton rows={rows} columns={6} />;

export const VolumeCardSkeleton: React.FC = () => <CardSkeleton lines={4} />;

export const DashboardSkeleton: React.FC = () => (
  <div className="space-y-6">
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <div
          key={i}
          className="p-4 border border-line rounded-lg"
        >
          <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-8 rounded" />
            <Skeleton className="h-4 w-12" />
          </div>
          <div className="mt-4">
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-3 w-24 mt-1 bg-surface-secondary" />
          </div>
        </div>
      ))}
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="p-6 border border-line rounded-lg">
        <Skeleton className="h-6 w-32 mb-4" />
        <ListSkeleton items={6} />
      </div>
      <div className="p-6 border border-line rounded-lg">
        <Skeleton className="h-6 w-40 mb-4" />
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i}>
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);
