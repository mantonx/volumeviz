import React, { useState, useEffect, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
} from 'recharts';
import {
  Activity,
  TrendingUp,
  TrendingDown,
  Cpu,
  HardDrive,
  Clock,
  AlertTriangle,
  Download,
  RefreshCw,
} from 'lucide-react';
import { Card } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { Badge } from '../../ui/Badge';
import { MetricCard } from '../../ui/MetricCard';
import { formatBytes, formatNumber } from '../../../utils';
import type {
  ScanPerformanceMetricsProps,
  MetricChartProps,
  PerformanceSummaryProps,
  PerformanceComparisonProps,
} from './ScanPerformanceMetrics.types';

const MetricChart: React.FC<MetricChartProps> = ({
  title,
  data,
  unit,
  color = '#3B82F6',
  height = 200,
  showGrid = true,
  showTooltip = true,
  yAxisFormatter,
  xAxisFormatter,
  className = '',
}) => {
  const chartData = useMemo(() => {
    return data.map((point) => ({
      timestamp: new Date(point.timestamp).getTime(),
      value: point.value,
      formattedTime: new Date(point.timestamp).toLocaleTimeString(),
    }));
  }, [data]);

  return (
    <Card className={`p-4 ${className}`}>
      <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
        {title}
      </h4>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={chartData}>
          {showGrid && (
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
          )}
          <XAxis
            dataKey="timestamp"
            type="number"
            scale="time"
            domain={['dataMin', 'dataMax']}
            tickFormatter={
              xAxisFormatter ||
              ((value) => new Date(value).toLocaleTimeString())
            }
          />
          <YAxis
            tickFormatter={yAxisFormatter || ((value) => `${value} ${unit}`)}
          />
          {showTooltip && (
            <Tooltip
              labelFormatter={(value) =>
                new Date(value as number).toLocaleString()
              }
              formatter={(value: number) => [
                `${yAxisFormatter ? yAxisFormatter(value) : `${value} ${unit}`}`,
                title,
              ]}
            />
          )}
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
};

const PerformanceSummary: React.FC<PerformanceSummaryProps> = ({
  data,
  timeRange,
  className = '',
}) => {
  const summary = useMemo(() => {
    const latestFiles =
      data.filesPerSecond[data.filesPerSecond.length - 1]?.value || 0;
    const latestBytes =
      data.bytesPerSecond[data.bytesPerSecond.length - 1]?.value || 0;
    const avgCpu =
      data.cpuUsage.reduce((sum, p) => sum + p.value, 0) /
        data.cpuUsage.length || 0;
    const avgMemory =
      data.memoryUsage.reduce((sum, p) => sum + p.value, 0) /
        data.memoryUsage.length || 0;
    const currentErrors = data.errorRate[data.errorRate.length - 1]?.value || 0;

    return {
      throughputFiles: latestFiles,
      throughputBytes: latestBytes,
      cpuUsage: avgCpu,
      memoryUsage: avgMemory,
      errorRate: currentErrors,
    };
  }, [data]);

  return (
    <Card className={`p-6 ${className}`}>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Current Performance ({timeRange})
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <MetricCard
          title="Files/sec"
          value={formatNumber(summary.throughputFiles)}
          icon={<Activity className="h-4 w-4" />}
          trend={
            summary.throughputFiles > 100
              ? 'up'
              : summary.throughputFiles < 50
                ? 'down'
                : undefined
          }
          variant={
            summary.throughputFiles > 100
              ? 'success'
              : summary.throughputFiles < 50
                ? 'warning'
                : 'default'
          }
        />
        <MetricCard
          title="Throughput"
          value={formatBytes(summary.throughputBytes) + '/s'}
          icon={<TrendingUp className="h-4 w-4" />}
          trend={summary.throughputBytes > 1024 * 1024 ? 'up' : 'down'}
        />
        <MetricCard
          title="CPU Usage"
          value={`${summary.cpuUsage.toFixed(1)}%`}
          icon={<Cpu className="h-4 w-4" />}
          variant={
            summary.cpuUsage > 80
              ? 'error'
              : summary.cpuUsage > 60
                ? 'warning'
                : 'success'
          }
        />
        <MetricCard
          title="Memory"
          value={`${summary.memoryUsage.toFixed(1)}%`}
          icon={<HardDrive className="h-4 w-4" />}
          variant={
            summary.memoryUsage > 80
              ? 'error'
              : summary.memoryUsage > 60
                ? 'warning'
                : 'success'
          }
        />
        <MetricCard
          title="Error Rate"
          value={`${summary.errorRate.toFixed(2)}%`}
          icon={<AlertTriangle className="h-4 w-4" />}
          variant={
            summary.errorRate > 5
              ? 'error'
              : summary.errorRate > 1
                ? 'warning'
                : 'success'
          }
        />
      </div>
    </Card>
  );
};

const PerformanceComparison: React.FC<PerformanceComparisonProps> = ({
  comparison,
  className = '',
}) => {
  return (
    <Card className={`p-6 ${className}`}>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Performance Comparison
      </h3>
      <div className="grid grid-cols-3 gap-6">
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {formatNumber(comparison.currentScan.avgFilesPerSecond)} files/s
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Current Scan
          </div>
          <div
            className={`flex items-center justify-center mt-2 ${
              comparison.improvement.throughput > 0
                ? 'text-green-600'
                : 'text-red-600'
            }`}
          >
            {comparison.improvement.throughput > 0 ? (
              <TrendingUp className="h-4 w-4 mr-1" />
            ) : (
              <TrendingDown className="h-4 w-4 mr-1" />
            )}
            <span className="text-sm font-medium">
              {Math.abs(comparison.improvement.throughput).toFixed(1)}%
            </span>
          </div>
        </div>

        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {(comparison.currentScan.avgDuration / 1000).toFixed(1)}s
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Avg Duration
          </div>
          <div
            className={`flex items-center justify-center mt-2 ${
              comparison.improvement.duration < 0
                ? 'text-green-600'
                : 'text-red-600'
            }`}
          >
            {comparison.improvement.duration < 0 ? (
              <TrendingUp className="h-4 w-4 mr-1" />
            ) : (
              <TrendingDown className="h-4 w-4 mr-1" />
            )}
            <span className="text-sm font-medium">
              {Math.abs(comparison.improvement.duration).toFixed(1)}%
            </span>
          </div>
        </div>

        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {comparison.currentScan.errorRate.toFixed(2)}%
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Error Rate
          </div>
          <div
            className={`flex items-center justify-center mt-2 ${
              comparison.improvement.errorRate < 0
                ? 'text-green-600'
                : 'text-red-600'
            }`}
          >
            {comparison.improvement.errorRate < 0 ? (
              <TrendingUp className="h-4 w-4 mr-1" />
            ) : (
              <TrendingDown className="h-4 w-4 mr-1" />
            )}
            <span className="text-sm font-medium">
              {Math.abs(comparison.improvement.errorRate).toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      <div className="mt-4 text-center text-sm text-gray-600 dark:text-gray-400">
        Compared to previous{' '}
        {formatNumber(comparison.previousScans.avgFilesPerSecond)} files/s
        average
      </div>
    </Card>
  );
};

export const ScanPerformanceMetrics: React.FC<ScanPerformanceMetricsProps> = ({
  scanId,
  volumeId,
  data,
  realTime = false,
  timeRange = '15m',
  showComparison = true,
  showCharts = true,
  chartHeight = 200,
  updateInterval = 5000,
  onTimeRangeChange,
  onExportMetrics,
  className = '',
  testId = 'scan-performance-metrics',
}) => {
  const [selectedTimeRange, setSelectedTimeRange] = useState(timeRange);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Mock data for demonstration - in real app this would come from props or API
  const mockData = useMemo(() => {
    if (data) return data;

    const now = Date.now();
    const generateMetrics = (
      count: number,
      baseValue: number,
      variance: number,
    ) => {
      return Array.from({ length: count }, (_, i) => ({
        timestamp: new Date(now - (count - i) * 30000).toISOString(),
        value: baseValue + Math.random() * variance - variance / 2,
        unit: 'files/s',
        label: 'Files per second',
      }));
    };

    return {
      filesPerSecond: generateMetrics(20, 150, 50),
      foldersPerSecond: generateMetrics(20, 15, 5),
      bytesPerSecond: generateMetrics(20, 1024 * 1024 * 10, 1024 * 1024 * 5),
      cpuUsage: generateMetrics(20, 45, 20),
      memoryUsage: generateMetrics(20, 35, 15),
      diskIORead: generateMetrics(20, 50, 20),
      diskIOWrite: generateMetrics(20, 30, 15),
      errorRate: generateMetrics(20, 0.5, 1),
      retryRate: generateMetrics(20, 0.1, 0.2),
      systemLoad: generateMetrics(20, 1.5, 0.8),
      queueDepth: generateMetrics(20, 5, 3),
      averageFileSize: generateMetrics(20, 1024 * 512, 1024 * 256),
      largestFiles: [
        {
          path: '/data/videos/large_video.mp4',
          size: 1024 * 1024 * 500,
          processingTime: 2500,
        },
        {
          path: '/data/archives/backup.tar.gz',
          size: 1024 * 1024 * 300,
          processingTime: 1800,
        },
        {
          path: '/data/images/high_res.psd',
          size: 1024 * 1024 * 150,
          processingTime: 900,
        },
      ],
      phaseDistribution: [
        { phase: 'Volume Scan', duration: 15000, percentage: 25 },
        { phase: 'Filesystem Indexing', duration: 35000, percentage: 58 },
        { phase: 'Media Enrichment', duration: 10000, percentage: 17 },
      ],
      historicalComparison: {
        currentScan: {
          avgFilesPerSecond: 145,
          avgDuration: 60000,
          errorRate: 0.8,
        },
        previousScans: {
          avgFilesPerSecond: 120,
          avgDuration: 75000,
          errorRate: 1.2,
        },
        improvement: { throughput: 20.8, duration: -20.0, errorRate: -33.3 },
      },
    };
  }, [data]);

  // Real-time updates
  useEffect(() => {
    if (!realTime || !scanId) return;

    const interval = setInterval(() => {
      setIsRefreshing(true);
      // In real app, this would trigger data refresh
      setTimeout(() => setIsRefreshing(false), 500);
    }, updateInterval);

    return () => clearInterval(interval);
  }, [realTime, scanId, updateInterval]);

  const handleTimeRangeChange = (range: string) => {
    setSelectedTimeRange(range);
    onTimeRangeChange?.(range);
  };

  return (
    <div className={className} data-testid={testId}>
      {/* Header */}
      <Card className="p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Performance Metrics
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {scanId
                ? `Scan ID: ${scanId}`
                : 'Real-time scan performance monitoring'}
              {realTime && (
                <Badge variant="primary" size="sm" className="ml-2">
                  Live
                </Badge>
              )}
            </p>
          </div>

          <div className="flex items-center space-x-3">
            {/* Time range selector */}
            <div className="flex space-x-1">
              {['5m', '15m', '1h', '6h', '24h'].map((range) => (
                <Button
                  key={range}
                  variant={selectedTimeRange === range ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => handleTimeRangeChange(range)}
                >
                  {range}
                </Button>
              ))}
            </div>

            {/* Export options */}
            {onExportMetrics && (
              <div className="flex space-x-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onExportMetrics('csv')}
                >
                  <Download className="h-4 w-4 mr-1" />
                  CSV
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onExportMetrics('png')}
                >
                  <Download className="h-4 w-4 mr-1" />
                  PNG
                </Button>
              </div>
            )}

            {realTime && (
              <Button variant="ghost" size="sm" disabled={isRefreshing}>
                <RefreshCw
                  className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`}
                />
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Performance Summary */}
      <PerformanceSummary
        data={mockData}
        timeRange={selectedTimeRange}
        className="mb-6"
      />

      {/* Comparison */}
      {showComparison && (
        <PerformanceComparison
          comparison={mockData.historicalComparison}
          className="mb-6"
        />
      )}

      {/* Charts */}
      {showCharts && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <MetricChart
            title="Files per Second"
            data={mockData.filesPerSecond}
            unit="files/s"
            height={chartHeight}
            color="#3B82F6"
            yAxisFormatter={(value) => formatNumber(value)}
          />
          <MetricChart
            title="Throughput"
            data={mockData.bytesPerSecond}
            unit="bytes/s"
            height={chartHeight}
            color="#10B981"
            yAxisFormatter={(value) => formatBytes(value) + '/s'}
          />
          <MetricChart
            title="CPU Usage"
            data={mockData.cpuUsage}
            unit="%"
            height={chartHeight}
            color="#F59E0B"
            yAxisFormatter={(value) => `${value.toFixed(1)}%`}
          />
          <MetricChart
            title="Memory Usage"
            data={mockData.memoryUsage}
            unit="%"
            height={chartHeight}
            color="#EF4444"
            yAxisFormatter={(value) => `${value.toFixed(1)}%`}
          />
        </div>
      )}

      {/* Phase Distribution */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Scan Phase Distribution
        </h3>
        <div className="space-y-3">
          {mockData.phaseDistribution.map((phase, index) => (
            <div key={index} className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="font-medium text-gray-900 dark:text-white">
                  {phase.phase}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {(phase.duration / 1000).toFixed(1)}s
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-32 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full"
                    style={{ width: `${phase.percentage}%` }}
                  />
                </div>
                <div className="text-sm font-medium text-gray-900 dark:text-white w-12 text-right">
                  {phase.percentage}%
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
