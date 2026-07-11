/**
 * TrendsPage - Historical analysis and predictive capacity planning
 *
 * File-type composition and capacity forecasting are per-volume concepts (each
 * volume has its own disk and file mix), so those two panels only populate
 * once a specific volume is selected. Storage growth / top-growing-volume
 * stats are drawn from the system-wide summary across all volumes.
 */

import React, { useState } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
  ReferenceLine,
} from 'recharts';
import {
  TrendingUp,
  Calendar,
  Download,
  Filter,
  RefreshCw,
  AlertTriangle,
  BarChart3,
  PieChartIcon,
  Activity,
  Database,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { formatBytes } from '@/utils/formatters';
import { useTrends } from '@/hooks/useTrends';
import { useGetApiV1Volumes } from '@/api/orval-generated/api';
import type { TrendsPageProps, TrendFilters } from './TrendsPage.types';

const COLORS = {
  primary: '#3b82f6',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  purple: '#8b5cf6',
  pink: '#ec4899',
};

const FILE_TYPE_COLORS = [
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#84cc16',
];

function downloadFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export const TrendsPage: React.FC<TrendsPageProps> = ({ className = '' }) => {
  const [filters, setFilters] = useState<TrendFilters>({
    timeRange: 'month',
    aggregation: 'day',
  });
  const [selectedVolumeId, setSelectedVolumeId] = useState<string>('');

  const { data: volumesResponse, isLoading: volumesLoading } = useGetApiV1Volumes({
    system: false,
    page_size: 100,
  });
  const volumes =
    (volumesResponse?.status === 200 ? volumesResponse.data.data : []) ?? [];

  const { volumeTrends, allVolumesSummary, isLoading, refresh } = useTrends(
    selectedVolumeId || undefined,
    filters,
  );

  const handleRefresh = () => refresh();

  const handleExport = (format: 'csv' | 'json') => {
    const timestamp = new Date().toISOString().split('T')[0];

    if (format === 'json') {
      const payload = selectedVolumeId ? volumeTrends : allVolumesSummary;
      downloadFile(
        `trends-${selectedVolumeId || 'all-volumes'}-${timestamp}.json`,
        JSON.stringify(payload ?? {}, null, 2),
        'application/json',
      );
      return;
    }

    // CSV export: daily_stats for a selected volume, or the per-volume
    // summary rows when viewing all volumes
    if (selectedVolumeId && volumeTrends?.daily_stats) {
      const rows = volumeTrends.daily_stats;
      const header = 'date,total_bytes,files_count,added_bytes,removed_bytes';
      const lines = rows.map(
        (r) =>
          `${r.date},${r.total_bytes ?? 0},${r.files_count ?? 0},${r.added_bytes ?? 0},${r.removed_bytes ?? 0}`,
      );
      downloadFile(
        `trends-${selectedVolumeId}-${timestamp}.csv`,
        [header, ...lines].join('\n'),
        'text/csv',
      );
    } else if (allVolumesSummary?.volumes) {
      const header = 'volume_id,current_size,total_growth,growth_rate_percent';
      const lines = allVolumesSummary.volumes.map(
        (v) =>
          `${v.volume_id},${v.statistics?.current_size ?? 0},${v.statistics?.total_growth ?? 0},${v.statistics?.growth_rate_percent ?? 0}`,
      );
      downloadFile(
        `trends-all-volumes-${timestamp}.csv`,
        [header, ...lines].join('\n'),
        'text/csv',
      );
    }
  };

  // Storage growth chart: the selected volume's daily stats, or (all
  // volumes) each summary volume's most recent data point plotted as a
  // per-volume bar comparison further down - this chart itself shows the
  // selected volume's real history, and is empty until one is chosen
  const chartData = (volumeTrends?.daily_stats ?? [])
    .slice()
    .reverse()
    .map((point) => ({
      date: new Date(point.date ?? '').toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }),
      size: (point.total_bytes ?? 0) / 1_000_000_000,
      files: (point.files_count ?? 0) / 1000,
    }));

  const fileTypeData = (volumeTrends?.media_composition ?? []).map(
    (entry, index) => ({
      type: entry.media_kind ?? 'unknown',
      totalSize: entry.total_bytes ?? 0,
      filesCount: entry.files_count ?? 0,
      color: FILE_TYPE_COLORS[index % FILE_TYPE_COLORS.length],
    }),
  );

  const forecast = volumeTrends?.capacity_forecast;
  const forecastChartData = (forecast?.series ?? []).map((point) => ({
    date: new Date(point.date ?? '').toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    }),
    predicted: (point.projected_size_bytes ?? 0) / 1_000_000_000,
  }));
  const diskAvailableGB = forecast?.disk_available_bytes
    ? forecast.disk_available_bytes / 1_000_000_000
    : undefined;

  const topGrowingVolume = allVolumesSummary?.volumes
    ?.slice()
    .sort(
      (a, b) =>
        (b.statistics?.growth_rate_percent ?? 0) -
        (a.statistics?.growth_rate_percent ?? 0),
    )[0];

  const volumeComparisonData = (allVolumesSummary?.volumes ?? []).map((v) => ({
    volumeId: v.volume_id ?? '',
    size: (v.statistics?.current_size ?? 0) / 1_000_000_000,
    growth: (v.statistics?.total_growth ?? 0) / 1_000_000_000,
  }));

  const totalGrowth = allVolumesSummary?.total_storage_growth ?? 0;
  const averageGrowthRate = allVolumesSummary?.average_growth_rate ?? 0;
  const averageSize =
    allVolumesSummary?.volumes && allVolumesSummary.volumes.length > 0
      ? allVolumesSummary.volumes.reduce(
          (sum, v) => sum + (v.statistics?.current_size ?? 0),
          0,
        ) / allVolumesSummary.volumes.length
      : 0;

  return (
    <div className={`min-h-screen bg-gray-50 ${className}`}>
      <div className="p-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <TrendingUp className="w-8 h-8 text-blue-600" />
                Storage Trends & Analytics
              </h1>
              <p className="mt-2 text-gray-600">
                Historical analysis and capacity planning for your volumes
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={handleRefresh}
                disabled={isLoading}
              >
                <RefreshCw
                  className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`}
                />
                Refresh
              </Button>
              <Button variant="outline" onClick={() => handleExport('csv')}>
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
              <Button variant="outline" onClick={() => handleExport('json')}>
                <Download className="w-4 h-4 mr-2" />
                Export JSON
              </Button>
            </div>
          </div>
        </div>

        {/* Filters */}
        <Card className="p-4 mb-6">
          <div className="flex items-center gap-4 flex-wrap">
            <Calendar className="w-5 h-5 text-gray-500" />
            <div className="flex gap-2">
              {(['day', 'week', 'month', 'quarter', 'year'] as const).map(
                (range) => (
                  <Button
                    key={range}
                    variant={
                      filters.timeRange === range ? 'primary' : 'outline'
                    }
                    size="sm"
                    onClick={() => setFilters({ ...filters, timeRange: range })}
                  >
                    {range.charAt(0).toUpperCase() + range.slice(1)}
                  </Button>
                ),
              )}
            </div>

            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <select
                className="px-3 py-1.5 border border-gray-300 rounded-md text-sm"
                value={filters.aggregation}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    aggregation: e.target.value as TrendFilters['aggregation'],
                  })
                }
              >
                <option value="day">Daily</option>
                <option value="week">Weekly</option>
                <option value="month">Monthly</option>
              </select>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <select
                className="px-3 py-1.5 border border-gray-300 rounded-md text-sm min-w-[220px]"
                value={selectedVolumeId}
                onChange={(e) => setSelectedVolumeId(e.target.value)}
                disabled={volumesLoading}
              >
                <option value="">All volumes (growth summary only)</option>
                {volumes.map((volume: any) => (
                  <option key={volume.name} value={volume.name}>
                    {volume.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </Card>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Total Growth
                </p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {formatBytes(totalGrowth)}
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-500" />
            </div>
            <div className="mt-3 flex items-center text-sm">
              <span
                className={`font-medium ${averageGrowthRate > 0 ? 'text-green-600' : 'text-red-600'}`}
              >
                {averageGrowthRate > 0 ? '+' : ''}
                {averageGrowthRate.toFixed(1)}%
              </span>
              <span className="text-gray-500 ml-1">average growth rate</span>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Average Size
                </p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {formatBytes(averageSize)}
                </p>
              </div>
              <Database className="w-8 h-8 text-blue-500" />
            </div>
            <div className="mt-3 text-sm text-gray-500">
              Across all tracked volumes
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Top Growing Volume
                </p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {topGrowingVolume
                    ? `${topGrowingVolume.statistics?.growth_rate_percent?.toFixed(1)}%`
                    : '—'}
                </p>
              </div>
              <BarChart3 className="w-8 h-8 text-purple-500" />
            </div>
            <div className="mt-3 text-sm text-gray-500">
              {topGrowingVolume?.volume_id ?? 'No data yet'}
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Forecast Alert
                </p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {!selectedVolumeId
                    ? '—'
                    : forecast?.days_until_capacity != null
                      ? `${forecast.days_until_capacity} days`
                      : 'Stable'}
                </p>
              </div>
              <AlertTriangle className="w-8 h-8 text-orange-500" />
            </div>
            <div className="mt-3 text-sm text-gray-500">
              {!selectedVolumeId
                ? 'Select a volume to forecast'
                : forecast?.disk_available_bytes == null
                  ? 'No disk capacity data yet'
                  : 'Until host disk capacity'}
            </div>
          </Card>
        </div>

        {/* Storage Growth Chart */}
        <Card className="p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-600" />
            Historical Storage Growth
          </h2>
          {!selectedVolumeId ? (
            <div className="h-[300px] flex items-center justify-center text-gray-500 text-sm">
              Select a volume above to see its storage history
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorSize" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor={COLORS.primary}
                      stopOpacity={0.3}
                    />
                    <stop
                      offset="95%"
                      stopColor={COLORS.primary}
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="date"
                  stroke="#6b7280"
                  style={{ fontSize: '12px' }}
                />
                <YAxis stroke="#6b7280" style={{ fontSize: '12px' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                  }}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="size"
                  stroke={COLORS.primary}
                  fillOpacity={1}
                  fill="url(#colorSize)"
                  name="Storage (GB)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* File Type Distribution */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <PieChartIcon className="w-5 h-5 text-green-600" />
              File Type Distribution
            </h2>
            {!selectedVolumeId ? (
              <div className="h-[300px] flex items-center justify-center text-gray-500 text-sm">
                Select a volume above to see its file type breakdown
              </div>
            ) : fileTypeData.length === 0 ? (
              <div className="h-[300px] flex items-center justify-center text-gray-500 text-sm">
                No file type data yet for this volume
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={fileTypeData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ type }) => type}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="totalSize"
                  >
                    {fileTypeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => formatBytes(value)}
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '6px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </Card>

          {/* Volume Comparison */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-purple-600" />
              Volume Growth Comparison
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={volumeComparisonData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="volumeId"
                  stroke="#6b7280"
                  style={{ fontSize: '12px' }}
                  hide
                />
                <YAxis stroke="#6b7280" style={{ fontSize: '12px' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                  }}
                />
                <Legend />
                <Bar dataKey="size" fill={COLORS.primary} name="Size (GB)" />
                <Bar dataKey="growth" fill={COLORS.success} name="Growth (GB)" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* Capacity Forecast */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-orange-600" />
            Predictive Capacity Planning (90-Day Forecast)
          </h2>
          {!selectedVolumeId ? (
            <div className="h-[300px] flex items-center justify-center text-gray-500 text-sm">
              Select a volume above to see its capacity forecast
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={forecastChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="date"
                  stroke="#6b7280"
                  style={{ fontSize: '12px' }}
                />
                <YAxis stroke="#6b7280" style={{ fontSize: '12px' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="predicted"
                  stroke={COLORS.primary}
                  strokeWidth={2}
                  dot={false}
                  name="Projected Size (GB)"
                />
                {diskAvailableGB != null && (
                  <ReferenceLine
                    y={diskAvailableGB}
                    stroke={COLORS.danger}
                    strokeDasharray="3 3"
                    label="Disk capacity"
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>
    </div>
  );
};

export default TrendsPage;
