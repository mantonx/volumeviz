/**
 * File Age Analysis Component
 *
 * Main component that provides comprehensive file age analysis with multiple visualizations:
 * - Age distribution bar chart (file count by age bucket)
 * - Storage by age bar chart (storage size by age bucket)
 * - Timeline area chart (modification activity over time)
 * - Summary statistics card
 */

import React, { useMemo, useState, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  Download,
  Info,
  Filter,
  X,
  Calendar,
  BarChart3,
  TrendingUp,
} from 'lucide-react';
import { cn } from '@/utils/class-names/cn';
import { AgeDistributionChart } from './AgeDistributionChart';
import { StorageByAgeChart } from './StorageByAgeChart';
import { AgeTimelineChart } from './AgeTimelineChart';
import { AgeSummaryCard } from './AgeSummaryCard';
import type {
  FileAgeAnalysisProps,
  AgeBucket,
  TimeRange,
} from './FileAgeAnalysis.types';
import {
  analyzeFilesByAge,
  generateTimelineData,
  calculateAgeSummary,
  exportToCSV,
  exportToJSON,
} from './fileAgeUtils';

export const FileAgeAnalysis: React.FC<FileAgeAnalysisProps> = ({
  files,
  volumeId,
  onFileClick,
  onFilterByAge,
  className = '',
}) => {
  const [isDarkMode] = useState(false); // TODO: Connect to theme context
  const [timeRange, setTimeRange] = useState<TimeRange>(30);
  const [activeFilter, setActiveFilter] = useState<AgeBucket | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Analyze files by age
  const analysisData = useMemo(() => {
    return analyzeFilesByAge(files);
  }, [files]);

  // Generate timeline data
  const timelineData = useMemo(() => {
    return generateTimelineData(files, timeRange);
  }, [files, timeRange]);

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    return calculateAgeSummary(analysisData);
  }, [analysisData]);

  // Handle bucket click (filter files by age)
  const handleBucketClick = useCallback(
    (bucket: AgeBucket) => {
      setActiveFilter(bucket);
      if (onFilterByAge) {
        onFilterByAge(bucket);
      }
    },
    [onFilterByAge],
  );

  // Clear filter
  const handleClearFilter = useCallback(() => {
    setActiveFilter(null);
    // TODO: Call parent to clear filter
  }, []);

  // Handle export
  const handleExport = useCallback(
    (format: 'csv' | 'json') => {
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `file-age-analysis-${volumeId || 'volume'}-${timestamp}`;

      let content: string;
      let mimeType: string;

      if (format === 'csv') {
        content = exportToCSV(analysisData, volumeId);
        mimeType = 'text/csv';
      } else {
        content = exportToJSON(analysisData, volumeId);
        mimeType = 'application/json';
      }

      // Create download
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${filename}.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setShowExportMenu(false);
    },
    [analysisData, volumeId],
  );

  // Empty state
  if (!files || files.length === 0) {
    return (
      <Card className={cn('p-8', className)}>
        <div className="text-center">
          <Calendar className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold text-primary mb-2">
            No Data Available
          </h3>
          <p className="text-secondary">
            No files available for age analysis.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
              <Calendar className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-primary">
                File Age Analysis
              </h2>
              <p className="text-sm text-secondary">
                Analyzing {analysisData.totalFiles.toLocaleString()} files
                {volumeId && ` from ${volumeId}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Export Button */}
            <div className="relative">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Export
              </Button>
              {showExportMenu && (
                <div className="absolute right-0 top-full mt-2 bg-surface border border-line rounded-lg shadow-lg p-2 z-10 min-w-[160px]">
                  <button
                    onClick={() => handleExport('csv')}
                    className="w-full text-left px-3 py-2 rounded hover:bg-surface-hover text-sm"
                  >
                    Export as CSV
                  </button>
                  <button
                    onClick={() => handleExport('json')}
                    className="w-full text-left px-3 py-2 rounded hover:bg-surface-hover text-sm"
                  >
                    Export as JSON
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Active Filter Badge */}
        {activeFilter && (
          <div className="mt-4 flex items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-100 dark:bg-blue-900/20 text-blue-900 dark:text-blue-100 rounded-full text-sm">
              <Filter className="w-3 h-3" />
              <span>Filtered: {activeFilter.label}</span>
              <button
                onClick={handleClearFilter}
                className="hover:bg-blue-200 dark:hover:bg-blue-800 rounded-full p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* Summary Card and Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Summary Statistics - Left Column */}
        <div className="lg:col-span-1">
          <AgeSummaryCard
            stats={summaryStats}
            onFileClick={onFileClick}
          />
        </div>

        {/* Charts - Right Columns */}
        <div className="lg:col-span-2 space-y-6">
          {/* Age Distribution Chart */}
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-5 h-5 text-blue-500" />
              <h3 className="font-semibold text-primary">
                File Count by Age
              </h3>
              <div className="ml-auto">
                <Info className="w-4 h-4 text-gray-400" />
              </div>
            </div>
            <p className="text-sm text-secondary mb-4">
              Distribution of files across age buckets
            </p>
            <AgeDistributionChart
              buckets={analysisData.buckets}
              isDarkMode={isDarkMode}
              onBucketClick={handleBucketClick}
              height={280}
            />
          </Card>

          {/* Storage by Age Chart */}
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-5 h-5 text-green-500" />
              <h3 className="font-semibold text-primary">
                Storage Size by Age
              </h3>
              <div className="ml-auto">
                <Info className="w-4 h-4 text-gray-400" />
              </div>
            </div>
            <p className="text-sm text-secondary mb-4">
              Total storage consumed by each age group
            </p>
            <StorageByAgeChart
              buckets={analysisData.buckets}
              isDarkMode={isDarkMode}
              onBucketClick={handleBucketClick}
              height={280}
            />
          </Card>
        </div>
      </div>

      {/* Timeline Chart - Full Width */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-purple-500" />
            <h3 className="font-semibold text-primary">
              Modification Activity Timeline
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={timeRange === 30 ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setTimeRange(30)}
            >
              30 Days
            </Button>
            <Button
              variant={timeRange === 90 ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setTimeRange(90)}
            >
              90 Days
            </Button>
            <Button
              variant={timeRange === 180 ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setTimeRange(180)}
            >
              6 Months
            </Button>
            <Button
              variant={timeRange === 365 ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setTimeRange(365)}
            >
              1 Year
            </Button>
          </div>
        </div>
        <p className="text-sm text-secondary mb-4">
          File modification activity over the selected time period
        </p>
        <AgeTimelineChart
          timelineData={timelineData}
          timeRange={timeRange}
          isDarkMode={isDarkMode}
          height={300}
        />
      </Card>

      {/* Usage Guide */}
      <Card className="p-4 bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">
              How to Use File Age Analysis
            </h4>
            <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
              <li>• Click on any age bucket in the charts to filter files by that age range</li>
              <li>• Use the timeline view to identify periods of high file activity</li>
              <li>• Review the "Ancient" files (1+ years) for potential cleanup candidates</li>
              <li>• Export analysis data for reporting or further analysis</li>
              <li>• Files without modification time are categorized as "Ancient"</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default FileAgeAnalysis;
