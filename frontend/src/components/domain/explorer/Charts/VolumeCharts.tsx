/**
 * VolumeChart Component
 *
 * Charts for volume insights including trends, growth, and composition.
 * Supports both 30-day and 90-day trend analysis.
 */

import { useGetApiV1TrendsVolumesVolumeId } from '@/api/orval-generated/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
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

// The trends endpoint returns a raw Go map (see internal/models/stats.go),
// which orval types as {[key: string]: unknown}. These interfaces mirror
// the real backend response shape.
interface DailyStat {
  date: string;
  files_count: number;
  total_bytes: number;
  added_bytes: number;
  removed_bytes: number;
}

interface MediaKindComposition {
  media_kind?: string;
  total_bytes: number;
  percent_of_volume?: string;
}

interface TopGrowingFolder {
  folder_name: string;
  folder_path: string;
  total_added_bytes: number;
  total_added_files: number;
}

interface VolumeTrendsData {
  daily_stats?: DailyStat[];
  media_composition?: MediaKindComposition[] | null;
  top_growing_folders?: TopGrowingFolder[] | null;
}

const COMPOSITION_COLORS = [
  '#8b5cf6',
  '#06b6d4',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#6b7280',
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
  volumeId,
  className = '',
}) => {
  const [trendPeriod, setTrendPeriod] = useState<30 | 90>(30);

  const {
    data: trendsData,
    isLoading,
    error,
  } = useGetApiV1TrendsVolumesVolumeId(
    volumeId,
    { days: trendPeriod },
    { query: { enabled: !!volumeId } },
  );

  const trends =
    trendsData?.status === 200
      ? (trendsData.data as VolumeTrendsData)
      : undefined;

  const trendData = useMemo(() => {
    if (!trends?.daily_stats) return [];

    return trends.daily_stats
      .map((stat) => ({
        date: stat.date,
        size: stat.total_bytes,
        files: stat.files_count,
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [trends]);

  const growthData = useMemo(() => {
    if (!trends?.top_growing_folders) return [];

    return trends.top_growing_folders.slice(0, 7).map((folder) => ({
      folder: folder.folder_path,
      size: folder.total_added_bytes,
      files: folder.total_added_files,
    }));
  }, [trends]);

  const compositionData = useMemo(() => {
    if (!trends?.media_composition) return [];

    // Multiple rows per media_kind (one per date) — keep only the latest.
    const latestByKind = new Map<string, MediaKindComposition>();
    for (const entry of trends.media_composition) {
      const kind = entry.media_kind ?? 'unknown';
      latestByKind.set(kind, entry);
    }

    return Array.from(latestByKind.entries()).map(([kind, entry], index) => ({
      name: kind,
      size: entry.total_bytes,
      percent: entry.percent_of_volume
        ? parseFloat(entry.percent_of_volume)
        : 0,
      color: COMPOSITION_COLORS[index % COMPOSITION_COLORS.length],
    }));
  }, [trends]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-surface p-3 border border-line rounded-lg shadow-lg">
          <p className="text-sm font-medium text-primary">
            {formatDate(label)}
          </p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}:{' '}
              {entry.dataKey === 'size'
                ? formatFileSize(entry.value)
                : entry.value.toLocaleString()}
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
          <p className="text-red-500">
            Error loading volume insights: {String(error)}
          </p>
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
            <h3 className="text-lg font-semibold text-primary">
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
                <YAxis yAxisId="files" orientation="right" stroke="#6b7280" />
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
          <h3 className="text-lg font-semibold text-primary">
            Top Growing Folders
          </h3>
        </div>

        {growthData.length > 0 ? (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={growthData} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  type="number"
                  tickFormatter={(value) => formatFileSize(value)}
                />
                <YAxis type="category" dataKey="folder" width={120} />
                <Tooltip
                  formatter={(value: any, name: string) => [
                    name === 'size' ? formatFileSize(value) : value.toLocaleString(),
                    name === 'size' ? 'Size Added' : 'Files Added',
                  ]}
                />
                <Legend />
                <Bar dataKey="size" fill="#3b82f6" name="Size Added" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-80 flex items-center justify-center">
            <p className="text-gray-500">No folder growth data available</p>
          </div>
        )}
      </Card>

      {/* File Type Composition */}
      <Card className="p-6">
        <div className="flex items-center space-x-2 mb-6">
          <PieChartIcon className="w-5 h-5 text-purple-500" />
          <h3 className="text-lg font-semibold text-primary">
            File Type Composition
          </h3>
        </div>

        {compositionData.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={compositionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={120}
                    paddingAngle={2}
                    dataKey="size"
                  >
                    {compositionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: any) => [formatFileSize(value), 'Size']}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-3">
              {compositionData.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-surface-secondary rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-sm font-medium text-primary capitalize">
                      {item.name}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-primary">
                      {formatFileSize(item.size)}
                    </p>
                    <p className="text-xs text-tertiary">
                      {item.percent.toFixed(1)}%
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="h-80 flex items-center justify-center">
            <p className="text-gray-500">No composition data available</p>
          </div>
        )}
      </Card>
    </div>
  );
};
