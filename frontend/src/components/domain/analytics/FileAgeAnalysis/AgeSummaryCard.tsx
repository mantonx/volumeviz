/**
 * Age Summary Card Component
 *
 * Displays key statistics and insights about file age distribution
 */

import React from 'react';
import { Card } from '@/components/ui/Card';
import { Clock, File, HardDrive, AlertTriangle } from 'lucide-react';
import type { AgeSummaryStats } from './FileAgeAnalysis.types';
import { formatFileSize, formatAge, formatPercentage } from './fileAgeUtils';

interface AgeSummaryCardProps {
  stats: AgeSummaryStats;
  onFileClick?: (file: any) => void;
  className?: string;
}

export const AgeSummaryCard: React.FC<AgeSummaryCardProps> = ({
  stats,
  onFileClick,
  className = '',
}) => {
  const handleFileClick = (file: any) => {
    if (onFileClick && file) {
      onFileClick(file);
    }
  };

  return (
    <Card className={`p-6 ${className}`}>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h3 className="text-lg font-semibold text-primary flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-500" />
            File Age Summary
          </h3>
          <p className="text-sm text-secondary mt-1">
            Key insights about your files' modification times
          </p>
        </div>

        {/* Overall Statistics */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <File className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span className="text-xs font-medium text-blue-900 dark:text-blue-100">
                Total Files
              </span>
            </div>
            <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
              {stats.totalFiles.toLocaleString()}
            </p>
          </div>

          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <HardDrive className="w-4 h-4 text-green-600 dark:text-green-400" />
              <span className="text-xs font-medium text-green-900 dark:text-green-100">
                Total Storage
              </span>
            </div>
            <p className="text-2xl font-bold text-green-900 dark:text-green-100">
              {formatFileSize(stats.totalSize)}
            </p>
          </div>
        </div>

        {/* Age Statistics */}
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-line">
            <span className="text-sm text-secondary">
              Average File Age
            </span>
            <span className="text-sm font-semibold text-primary">
              {formatAge(Math.floor(stats.averageAge))}
            </span>
          </div>

          <div className="flex items-center justify-between py-2 border-b border-line">
            <span className="text-sm text-secondary">
              Median File Age
            </span>
            <span className="text-sm font-semibold text-primary">
              {formatAge(Math.floor(stats.medianAge))}
            </span>
          </div>
        </div>

        {/* Old Files Warning */}
        {stats.oldFilesPercentage > 50 && (
          <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-orange-900 dark:text-orange-100 mb-1">
                  Many Old Files Detected
                </h4>
                <p className="text-xs text-orange-800 dark:text-orange-200 mb-2">
                  {formatPercentage(stats.oldFilesPercentage)} of your files ({stats.oldFilesCount.toLocaleString()})
                  haven't been modified in over 6 months, using {formatFileSize(stats.oldFilesSize)} of storage.
                </p>
                <p className="text-xs text-orange-700 dark:text-orange-300">
                  Consider reviewing these files for archival or deletion.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Oldest and Newest Files */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-primary">
            File Extremes
          </h4>

          {stats.oldestFile && (
            <div
              className="bg-surface-secondary rounded-lg p-3 hover:bg-surface-hover transition-colors cursor-pointer"
              onClick={() => handleFileClick(stats.oldestFile)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-tertiary mb-1">
                    Oldest File
                  </p>
                  <p className="text-sm font-medium text-primary truncate">
                    {stats.oldestFile.name}
                  </p>
                  <p className="text-xs text-tertiary truncate mt-1">
                    {stats.oldestFile.path}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-red-600 dark:text-red-400 font-medium">
                    {formatAge(Math.floor(stats.averageAge))}
                  </p>
                  <p className="text-xs text-tertiary mt-1">
                    {formatFileSize(stats.oldestFile.size || 0)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {stats.newestFile && (
            <div
              className="bg-surface-secondary rounded-lg p-3 hover:bg-surface-hover transition-colors cursor-pointer"
              onClick={() => handleFileClick(stats.newestFile)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-tertiary mb-1">
                    Newest File
                  </p>
                  <p className="text-sm font-medium text-primary truncate">
                    {stats.newestFile.name}
                  </p>
                  <p className="text-xs text-tertiary truncate mt-1">
                    {stats.newestFile.path}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-green-600 dark:text-green-400 font-medium">
                    Recently modified
                  </p>
                  <p className="text-xs text-tertiary mt-1">
                    {formatFileSize(stats.newestFile.size || 0)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Distribution Progress Bars */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-primary mb-3">
            Age Distribution
          </h4>

          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-secondary">Recent (0-30 days)</span>
              <span className="font-medium text-primary">
                {formatPercentage((stats.totalFiles > 0 ? ((stats.totalFiles - stats.oldFilesCount) / stats.totalFiles * 100) : 0))}
              </span>
            </div>
            <div className="w-full bg-surface-secondary rounded-full h-2">
              <div
                className="bg-green-500 h-2 rounded-full transition-all duration-300"
                style={{
                  width: `${stats.totalFiles > 0 ? ((stats.totalFiles - stats.oldFilesCount) / stats.totalFiles * 100) : 0}%`,
                }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-secondary">Old (6+ months)</span>
              <span className="font-medium text-primary">
                {formatPercentage(stats.oldFilesPercentage)}
              </span>
            </div>
            <div className="w-full bg-surface-secondary rounded-full h-2">
              <div
                className="bg-red-500 h-2 rounded-full transition-all duration-300"
                style={{
                  width: `${stats.oldFilesPercentage}%`,
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};
