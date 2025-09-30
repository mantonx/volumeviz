/**
 * TrendsPage - Historical analysis and predictive capacity planning
 *
 * Features:
 * - Historical storage growth visualization
 * - File type distribution analysis
 * - Access pattern analytics
 * - Predictive capacity planning
 * - Comparative volume analysis
 * - Interactive time range selection
 * - Export functionality for trend data
 */

import React, { useState, useMemo } from 'react';
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
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
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
import type {
  TrendsPageProps,
  TrendFilters,
  StorageGrowthDataPoint,
  FileTypeDistribution,
  CapacityForecast,
  TrendStats,
} from './TrendsPage.types';

// Chart colors
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

export const TrendsPage: React.FC<TrendsPageProps> = ({ className = '' }) => {
  const [filters, setFilters] = useState<TrendFilters>({
    timeRange: 'month',
    aggregation: 'day',
  });

  const [isLoading, setIsLoading] = useState(false);

  // Mock data - TODO: Replace with actual API calls
  const storageGrowthData: StorageGrowthDataPoint[] = useMemo(() => {
    const now = new Date();
    const data: StorageGrowthDataPoint[] = [];

    for (let i = 30; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);

      data.push({
        timestamp: date,
        totalSize: 1000000000 + i * 50000000 + Math.random() * 100000000,
        volumeCount: 10 + Math.floor(i / 5),
        fileCount: 5000 + i * 200,
      });
    }

    return data;
  }, []);

  const fileTypeData: FileTypeDistribution[] = useMemo(
    () => [
      { type: 'Video', count: 1250, totalSize: 5000000000, percentage: 45, color: COLORS.primary },
      { type: 'Images', count: 3500, totalSize: 2500000000, percentage: 22, color: COLORS.success },
      { type: 'Documents', count: 2800, totalSize: 1500000000, percentage: 13, color: COLORS.warning },
      { type: 'Audio', count: 950, totalSize: 1000000000, percentage: 9, color: COLORS.purple },
      { type: 'Archives', count: 420, totalSize: 800000000, percentage: 7, color: COLORS.pink },
      { type: 'Other', count: 1890, totalSize: 400000000, percentage: 4, color: '#94a3b8' },
    ],
    []
  );

  const capacityForecast: CapacityForecast[] = useMemo(() => {
    const now = new Date();
    const forecast: CapacityForecast[] = [];

    for (let i = 0; i <= 90; i += 7) {
      const date = new Date(now);
      date.setDate(date.getDate() + i);

      const predicted = 5000000000 + i * 80000000;
      forecast.push({
        date,
        predictedSize: predicted,
        confidenceInterval: {
          lower: predicted * 0.9,
          upper: predicted * 1.1,
        },
        capacityThreshold: 15000000000,
      });
    }

    return forecast;
  }, []);

  const trendStats: TrendStats = useMemo(() => {
    if (storageGrowthData.length < 2) {
      return {
        totalGrowth: 0,
        growthRate: 0,
        averageSize: 0,
        topGrowingVolumes: [],
      };
    }

    const firstPoint = storageGrowthData[0];
    const lastPoint = storageGrowthData[storageGrowthData.length - 1];
    const totalGrowth = lastPoint.totalSize - firstPoint.totalSize;
    const growthRate = (totalGrowth / firstPoint.totalSize) * 100;
    const averageSize =
      storageGrowthData.reduce((sum, point) => sum + point.totalSize, 0) /
      storageGrowthData.length;

    return {
      totalGrowth,
      growthRate,
      averageSize,
      topGrowingVolumes: [
        { id: '1', name: 'media-storage', growthRate: 45.2 },
        { id: '2', name: 'database-backups', growthRate: 32.8 },
        { id: '3', name: 'logs', growthRate: 28.5 },
      ],
    };
  }, [storageGrowthData]);

  const handleExport = (format: 'csv' | 'json') => {
    console.log(`Exporting trends data as ${format}`);
    // TODO: Implement export functionality
  };

  const handleRefresh = () => {
    setIsLoading(true);
    // TODO: Implement data refresh
    setTimeout(() => setIsLoading(false), 1000);
  };

  // Format data for charts
  const chartData = storageGrowthData.map((point) => ({
    date: point.timestamp.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    size: point.totalSize / 1000000000, // Convert to GB
    volumes: point.volumeCount,
    files: point.fileCount / 1000, // Convert to thousands
  }));

  const forecastChartData = capacityForecast.map((point) => ({
    date: point.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    predicted: point.predictedSize / 1000000000,
    lower: point.confidenceInterval.lower / 1000000000,
    upper: point.confidenceInterval.upper / 1000000000,
    threshold: point.capacityThreshold ? point.capacityThreshold / 1000000000 : null,
  }));

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

        {/* Time Range Selector */}
        <Card className="p-4 mb-6">
          <div className="flex items-center gap-4">
            <Calendar className="w-5 h-5 text-gray-500" />
            <div className="flex gap-2">
              {(['day', 'week', 'month', 'quarter', 'year'] as const).map((range) => (
                <Button
                  key={range}
                  variant={filters.timeRange === range ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setFilters({ ...filters, timeRange: range })}
                >
                  {range.charAt(0).toUpperCase() + range.slice(1)}
                </Button>
              ))}
            </div>
            <div className="ml-auto flex items-center gap-2">
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
                <option value="hour">Hourly</option>
                <option value="day">Daily</option>
                <option value="week">Weekly</option>
                <option value="month">Monthly</option>
              </select>
            </div>
          </div>
        </Card>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Growth</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {formatBytes(trendStats.totalGrowth)}
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-500" />
            </div>
            <div className="mt-3 flex items-center text-sm">
              <span
                className={`font-medium ${trendStats.growthRate > 0 ? 'text-green-600' : 'text-red-600'}`}
              >
                {trendStats.growthRate > 0 ? '+' : ''}
                {trendStats.growthRate.toFixed(1)}%
              </span>
              <span className="text-gray-500 ml-1">from previous period</span>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Average Size</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {formatBytes(trendStats.averageSize)}
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
                  {trendStats.topGrowingVolumes[0]?.growthRate.toFixed(1)}%
                </p>
              </div>
              <BarChart3 className="w-8 h-8 text-purple-500" />
            </div>
            <div className="mt-3 text-sm text-gray-500">
              {trendStats.topGrowingVolumes[0]?.name}
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Forecast Alert
                </p>
                <p className="text-2xl font-bold text-gray-900 mt-1">42 days</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-orange-500" />
            </div>
            <div className="mt-3 text-sm text-gray-500">
              Until capacity threshold
            </div>
          </Card>
        </div>

        {/* Storage Growth Chart */}
        <Card className="p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-600" />
            Historical Storage Growth
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorSize" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" stroke="#6b7280" style={{ fontSize: '12px' }} />
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
        </Card>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* File Type Distribution */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <PieChartIcon className="w-5 h-5 text-green-600" />
              File Type Distribution
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={fileTypeData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ type, percentage }) => `${type} (${percentage}%)`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="totalSize"
                >
                  {fileTypeData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.color || FILE_TYPE_COLORS[index % FILE_TYPE_COLORS.length]}
                    />
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
          </Card>

          {/* Volume Comparison */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-purple-600" />
              Volume Growth Comparison
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData.slice(-7)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" stroke="#6b7280" style={{ fontSize: '12px' }} />
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
                <Bar dataKey="volumes" fill={COLORS.success} name="Volumes" />
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
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={forecastChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" stroke="#6b7280" style={{ fontSize: '12px' }} />
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
                name="Predicted Size (GB)"
              />
              <Line
                type="monotone"
                dataKey="upper"
                stroke={COLORS.warning}
                strokeWidth={1}
                strokeDasharray="5 5"
                dot={false}
                name="Upper Bound"
              />
              <Line
                type="monotone"
                dataKey="lower"
                stroke={COLORS.success}
                strokeWidth={1}
                strokeDasharray="5 5"
                dot={false}
                name="Lower Bound"
              />
              {forecastChartData[0]?.threshold && (
                <Line
                  type="monotone"
                  dataKey="threshold"
                  stroke={COLORS.danger}
                  strokeWidth={2}
                  strokeDasharray="3 3"
                  dot={false}
                  name="Capacity Threshold"
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
};

export default TrendsPage;
