/**
 * VolumeChart Component
 *
 * Charts for volume insights including trends, growth, and composition.
 * Supports both 30-day and 90-day trend analysis.
 */

import { useVolumeInsights } from '@/api/explorer';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import {
    BarChart3Icon,
    LoaderIcon,
    PieChartIcon,
    TrendingUpIcon,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Legend,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';

interface VolumeChartsProps {
  volumeId: string;
  className?: string;
}

// Mock data for file type composition (since we don't have this endpoint yet)
const mockCompositionData = [
  { name: 'Videos', value: 45.3, size: 23.2, color: '#8b5cf6' },
  { name: 'Images', value: 22.8, size: 11.7, color: '#06b6d4' },
  { name: 'Documents', value: 18.7, size: 9.6, color: '#10b981' },
  { name: 'Audio', value: 8.2, size: 4.2, color: '#f59e0b' },
  { name: 'Archives', value: 3.4, size: 1.7, color: '#ef4444' },
  { name: 'Other', value: 1.6, size: 0.8, color: '#6b7280' },
];

const formatFileSize = (bytes: number): string => {
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb < 1) return `${(gb * 1024).toFixed(0)} MB`;
  return `${gb.toFixed(1)} GB`;
};

const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
};

export const VolumeCharts: React.FC<VolumeChartsProps> = ({
  className = '',
}) => {
  const [trendPeriod, setTrendPeriod] = useState<30 | 90>(30);

  const {
    volumeStats,
    topFolders,
    isLoading,
    statsError,
    foldersError,
  } = useVolumeInsights();

  const error = statsError || foldersError;

  // Transform daily stats for chart display
  const trendData = useMemo(() => {
    if (!volumeStats || volumeStats.length === 0) return [];

    // Filter data based on selected period
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - trendPeriod);

    return volumeStats
      .filter((stat) => new Date(stat.date) >= cutoffDate)
      .map((stat) => ({
        date: stat.date,
        size: stat.total_size,
        files: stat.file_count,
        growth: stat.growth_bytes,
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [volumeStats, trendPeriod]);

  // Transform top folders for growth chart
  const growthData = useMemo(() => {
    if (!topFolders || topFolders.length === 0) return [];

    return topFolders
      .slice(0, 7) // Show top 7 folders
      .map((folder) => ({
        folder: folder.path,
        size: folder.size,
        files: folder.file_count,
        // Calculate mock growth percentage (since we don't have historical data)
        growth: Math.random() * 15 - 2, // Random between -2% and 13%
        trend: Math.random() > 0.3 ? 'up' : 'down',
      }));
  }, [topFolders]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {formatDate(label)}
          </p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {
                entry.dataKey === 'size'
                  ? formatFileSize(entry.value)
                  : entry.dataKey === 'growth'
                  ? `${entry.value.toFixed(1)}%`
                  : entry.value.toLocaleString()
              }
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (error) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <div className="text-center">
          <p className="text-red-500">Error loading volume insights: {error}</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <div className="text-center">
          <LoaderIcon className="w-8 h-8 animate-spin mx-auto mb-2" />
          <p className="text-gray-500">Loading volume insights...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Volume Trend Chart */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-2">
            <TrendingUpIcon className="w-5 h-5 text-blue-500" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Volume Trend
            </h3>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant={trendPeriod === 30 ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setTrendPeriod(30)}
            >
              30 Days
            </Button>
            <Button
              variant={trendPeriod === 90 ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setTrendPeriod(90)}
            >
              90 Days
            </Button>
          </div>
        </div>

        {trendData.length > 0 ? (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDate}
                  stroke="#6b7280"
                />
                <YAxis
                  yAxisId="size"
                  orientation="left"
                  tickFormatter={(value) => formatFileSize(value)}
                  stroke="#6b7280"
                />
                <YAxis
                  yAxisId="files"
                  orientation="right"
                  stroke="#6b7280"
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Area
                  yAxisId="size"
                  type="monotone"
                  dataKey="size"
                  stackId="1"
                  stroke="#3b82f6"
                  fill="#3b82f6"
                  fillOpacity={0.6}
                  name="Storage Size"
                />
                <Area
                  yAxisId="files"
                  type="monotone"
                  dataKey="files"
                  stackId="2"
                  stroke="#10b981"
                  fill="#10b981"
                  fillOpacity={0.6}
                  name="File Count"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-80 flex items-center justify-center">
            <p className="text-gray-500">No trend data available</p>
          </div>
        )}
      </Card>

      {/* Growth by Folder Chart */}
      <Card className="p-6">
        <div className="flex items-center space-x-2 mb-6">
          <BarChart3Icon className="w-5 h-5 text-green-500" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Top Folders by Size
          </h3>
        </div>

        {growthData.length > 0 ? (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={growthData} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" tickFormatter={(value) => formatFileSize(value)} />
                <YAxis type="category" dataKey="folder" width={120} />
                <Tooltip
                  formatter={(value: any, name: string) => [
                    name === 'size' ? formatFileSize(value) : value.toLocaleString(),
                    name === 'size' ? 'Size' : 'Files'
                  ]}
                />
                <Legend />
                <Bar dataKey="size" fill="#3b82f6" name="Size" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-80 flex items-center justify-center">
            <p className="text-gray-500">No folder data available</p>
          </div>
        )}
      </Card>

      {/* File Type Composition */}
      <Card className="p-6">
        <div className="flex items-center space-x-2 mb-6">
          <PieChartIcon className="w-5 h-5 text-purple-500" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            File Type Composition
          </h3>
          <Badge variant="outline" className="ml-auto">
            Mock Data
          </Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={mockCompositionData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={120}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {mockCompositionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: any) => [`${value.toFixed(1)} GB`, 'Size']}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-3">
            {mockCompositionData.map((item, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {item.name}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {item.size.toFixed(1)} GB
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {item.value.toFixed(1)}%
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
};
