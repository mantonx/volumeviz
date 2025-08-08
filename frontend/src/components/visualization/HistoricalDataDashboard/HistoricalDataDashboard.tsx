import React, { useState, useMemo } from 'react';
import { Calendar, TrendingUp, BarChart3, Target, Brain, Download } from 'lucide-react';
import { clsx } from 'clsx';
import { VolumeGrowthTimeline } from '../VolumeGrowthTimeline';
import { TrendAnalysisWidget } from '../TrendAnalysisWidget';
import { VolumeComparisonChart } from '../VolumeComparisonChart';
import { GrowthRateChart } from '../GrowthRateChart';
import { CapacityForecast } from '../CapacityForecast';
import { VisualizationErrorBoundary } from '../VisualizationErrorBoundary';
import type { HistoricalDataPoint } from '../VolumeGrowthTimeline/VolumeGrowthTimeline.types';
import type { TrendAnalysisData } from '../TrendAnalysisWidget/TrendAnalysisWidget.types';
import type { VolumeComparisonData } from '../VolumeComparisonChart/VolumeComparisonChart.types';
import type { GrowthRateDataPoint } from '../GrowthRateChart/GrowthRateChart.types';
import type { HistoricalForecastPoint } from '../CapacityForecast/CapacityForecast.types';

interface HistoricalDataDashboardProps {
  /** Historical data points for all analysis */
  data?: HistoricalDataPoint[];
  
  /** Dashboard layout mode */
  layout?: 'grid' | 'tabs' | 'stack';
  
  /** Whether to show export controls */
  showExport?: boolean;
  
  /** Custom CSS class */
  className?: string;
}

/**
 * Comprehensive historical data dashboard showcasing all Ticket #8 components.
 * 
 * Features:
 * - Volume Growth Timeline with multi-volume support
 * - Trend Analysis Widget with growth calculations
 * - Volume Comparison Chart for side-by-side analysis
 * - Growth Rate Chart with rate visualization
 * - Capacity Forecast with predictive analytics
 */
export const HistoricalDataDashboard: React.FC<HistoricalDataDashboardProps> = ({
  data = [],
  layout = 'grid',
  showExport = true,
  className,
}) => {
  const [activeTab, setActiveTab] = useState('timeline');
  const [selectedVolumes, setSelectedVolumes] = useState<string[]>([]);

  // Generate sample data if none provided (for demo purposes)
  const sampleData = useMemo(() => {
    if (data.length > 0) return data;

    // Generate sample historical data for 3 volumes over 90 days
    const volumes = [
      { id: 'vol1', name: 'nginx-data', baseSize: 1000000000 },
      { id: 'vol2', name: 'postgres-data', baseSize: 5000000000 },
      { id: 'vol3', name: 'logs-volume', baseSize: 500000000 },
    ];

    const samplePoints: HistoricalDataPoint[] = [];
    const now = new Date();

    volumes.forEach(volume => {
      for (let day = 0; day < 90; day++) {
        const date = new Date(now.getTime() - (89 - day) * 24 * 60 * 60 * 1000);
        
        // Simulate different growth patterns
        let growthFactor = 1;
        if (volume.id === 'vol1') {
          growthFactor = 1 + (day * 0.01); // Linear growth
        } else if (volume.id === 'vol2') {
          growthFactor = Math.pow(1.008, day); // Exponential growth
        } else {
          growthFactor = 1 + (Math.sin(day * 0.1) * 0.05) + (day * 0.002); // Cyclical with trend
        }

        const size = Math.floor(volume.baseSize * growthFactor + Math.random() * 100000000);
        const growthRate = day > 0 ? (size - volume.baseSize) / day : 0;

        samplePoints.push({
          timestamp: date.toISOString(),
          date,
          totalSize: size,
          fileCount: Math.floor(size / 1000 + Math.random() * 1000),
          directoryCount: Math.floor(size / 100000 + Math.random() * 100),
          volumeId: volume.id,
          volumeName: volume.name,
          scanMethod: 'du',
          growthRate: growthRate / (24 * 60 * 60 * 1000), // Convert to bytes per day
          isAnomaly: Math.random() < 0.05, // 5% chance of anomaly
        });
      }
    });

    return samplePoints;
  }, [data]);

  // Transform data for different components
  const trendAnalysisData: TrendAnalysisData[] = useMemo(() => {
    const volumeMap = new Map<string, HistoricalDataPoint[]>();
    
    sampleData.forEach(point => {
      if (!volumeMap.has(point.volumeId)) {
        volumeMap.set(point.volumeId, []);
      }
      volumeMap.get(point.volumeId)!.push(point);
    });

    return Array.from(volumeMap.entries()).map(([volumeId, points]) => {
      const sortedPoints = points.sort((a, b) => a.date.getTime() - b.date.getTime());
      const firstPoint = sortedPoints[0];
      const lastPoint = sortedPoints[sortedPoints.length - 1];
      
      const totalGrowth = lastPoint.totalSize - firstPoint.totalSize;
      const timespan = (lastPoint.date.getTime() - firstPoint.date.getTime()) / (1000 * 60 * 60 * 24);
      const growthRate = totalGrowth / timespan; // bytes per day
      const growthPercentage = (totalGrowth / firstPoint.totalSize) * 100;

      return {
        volumeId,
        volumeName: firstPoint.volumeName,
        currentSize: lastPoint.totalSize,
        previousSize: firstPoint.totalSize,
        growthRate,
        growthPercentage,
        trend: growthRate > 0 ? 'increasing' as const : 'stable' as const,
        confidence: 0.85 + Math.random() * 0.1,
        timespan,
        projectedSize30d: lastPoint.totalSize + (growthRate * 30),
        projectedSize90d: lastPoint.totalSize + (growthRate * 90),
        anomalyScore: Math.random() * 0.3,
        lastUpdated: lastPoint.date,
      };
    });
  }, [sampleData]);

  const comparisonData: VolumeComparisonData[] = useMemo(() => {
    const volumeMap = new Map<string, HistoricalDataPoint[]>();
    
    sampleData.forEach(point => {
      if (!volumeMap.has(point.volumeId)) {
        volumeMap.set(point.volumeId, []);
      }
      volumeMap.get(point.volumeId)!.push(point);
    });

    return Array.from(volumeMap.entries()).map(([volumeId, points], index) => {
      const sortedPoints = points.sort((a, b) => a.date.getTime() - b.date.getTime());
      const firstPoint = sortedPoints[0];
      const lastPoint = sortedPoints[sortedPoints.length - 1];

      return {
        volumeId,
        volumeName: firstPoint.volumeName,
        historicalData: sortedPoints.map(point => ({
          timestamp: point.timestamp,
          date: point.date,
          size: point.totalSize,
          fileCount: point.fileCount,
          directoryCount: point.directoryCount,
          growthRate: point.growthRate,
        })),
        currentSize: lastPoint.totalSize,
        startSize: firstPoint.totalSize,
        totalGrowth: lastPoint.totalSize - firstPoint.totalSize,
        averageGrowthRate: (lastPoint.totalSize - firstPoint.totalSize) / sortedPoints.length,
        color: ['#3B82F6', '#10B981', '#F59E0B'][index % 3],
      };
    });
  }, [sampleData]);

  const growthRateData: GrowthRateDataPoint[] = useMemo(() => {
    return sampleData.map(point => ({
      timestamp: point.timestamp,
      date: point.date,
      volumeId: point.volumeId,
      volumeName: point.volumeName,
      size: point.totalSize,
      previousSize: point.totalSize * 0.98, // Simulate previous size
      growthRate: point.growthRate || 0,
      growthPercentage: ((point.growthRate || 0) / point.totalSize) * 100,
      timespan: 24, // 24 hours
      unit: 'day' as const,
    }));
  }, [sampleData]);

  const forecastData: HistoricalForecastPoint[] = useMemo(() => {
    return sampleData.map(point => ({
      timestamp: point.timestamp,
      date: point.date,
      volumeId: point.volumeId,
      volumeName: point.volumeName,
      size: point.totalSize,
      growthRate: point.growthRate || 0,
    }));
  }, [sampleData]);

  const renderGridLayout = () => (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Historical Data Analytics
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Comprehensive volume growth analysis and predictive insights
            </p>
          </div>
          {showExport && (
            <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
              <Download className="w-4 h-4" />
              Export Dashboard
            </button>
          )}
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* Volume Growth Timeline - Full Width */}
        <div className="xl:col-span-2">
          <VisualizationErrorBoundary 
            title="Growth Timeline Error"
            description="Unable to load historical growth data"
          >
            <VolumeGrowthTimeline
              data={sampleData}
              timeRange="3m"
              selectedVolumes={selectedVolumes}
              showGrowthRate={true}
              showAnomalies={true}
              enableBrushing={true}
              enableZoom={true}
              height={400}
              onVolumeSelectionChange={setSelectedVolumes}
            />
          </VisualizationErrorBoundary>
        </div>

        {/* Trend Analysis Widget */}
        <div>
          <VisualizationErrorBoundary 
            title="Trend Analysis Error"
            description="Unable to load trend analysis data"
          >
            <TrendAnalysisWidget
              data={trendAnalysisData}
              maxVolumes={10}
              sortBy="growthRate"
              showProjections={true}
              showAnomalies={true}
              showConfidence={true}
              analysisPeriod="90d"
              onExport={(format) => console.log(`Export trends as ${format}`)}
            />
          </VisualizationErrorBoundary>
        </div>

        {/* Capacity Forecast */}
        <div>
          <VisualizationErrorBoundary 
            title="Capacity Forecast Error"
            description="Unable to generate capacity forecasts"
          >
            <CapacityForecast
              historicalData={forecastData}
              forecastDays={90}
              model="auto"
              showConfidence={true}
              showThresholds={true}
              capacityLimits={{
                'vol1': 2000000000, // 2GB limit for nginx-data
                'vol2': 10000000000, // 10GB limit for postgres-data
                'vol3': 1000000000, // 1GB limit for logs-volume
              }}
              height={350}
              onCapacityAlert={(alert) => console.log('Capacity alert:', alert)}
            />
          </VisualizationErrorBoundary>
        </div>

        {/* Volume Comparison Chart */}
        <div>
          <VolumeComparisonChart
            data={comparisonData}
            chartType="line"
            timeRange="3m"
            metric="size"
            showLegend={true}
            height={300}
            onMetricChange={(metric) => console.log('Metric changed:', metric)}
          />
        </div>

        {/* Growth Rate Chart */}
        <div>
          <GrowthRateChart
            data={growthRateData}
            mode="absolute"
            rateUnit="day"
            chartType="line"
            showMovingAverage={true}
            movingAveragePeriod={7}
            colorByRate={true}
            height={300}
          />
        </div>
      </div>
    </div>
  );

  const renderTabLayout = () => (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="-mb-px flex space-x-8 px-6" aria-label="Tabs">
            {[
              { id: 'timeline', label: 'Growth Timeline', icon: Calendar },
              { id: 'trends', label: 'Trend Analysis', icon: TrendingUp },
              { id: 'comparison', label: 'Comparison', icon: BarChart3 },
              { id: 'rates', label: 'Growth Rates', icon: Target },
              { id: 'forecast', label: 'Capacity Forecast', icon: Brain },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={clsx(
                  'group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm',
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                )}
              >
                <tab.icon className="w-5 h-5 mr-2" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'timeline' && (
            <VolumeGrowthTimeline
              data={sampleData}
              timeRange="3m"
              height={500}
              enableBrushing={true}
              enableZoom={true}
            />
          )}

          {activeTab === 'trends' && (
            <TrendAnalysisWidget
              data={trendAnalysisData}
              showProjections={true}
              showAnomalies={true}
              showConfidence={true}
            />
          )}

          {activeTab === 'comparison' && (
            <VolumeComparisonChart
              data={comparisonData}
              chartType="line"
              metric="size"
              height={500}
            />
          )}

          {activeTab === 'rates' && (
            <GrowthRateChart
              data={growthRateData}
              mode="both"
              chartType="line"
              showMovingAverage={true}
              height={500}
            />
          )}

          {activeTab === 'forecast' && (
            <CapacityForecast
              historicalData={forecastData}
              forecastDays={180}
              showConfidence={true}
              showThresholds={true}
              height={500}
              capacityLimits={{
                'vol1': 2000000000,
                'vol2': 10000000000,
                'vol3': 1000000000,
              }}
            />
          )}
        </div>
      </div>
    </div>
  );

  const renderStackLayout = () => (
    <div className="space-y-8 max-w-6xl mx-auto">
      <VolumeGrowthTimeline data={sampleData} height={400} />
      <TrendAnalysisWidget data={trendAnalysisData} />
      <VolumeComparisonChart data={comparisonData} height={400} />
      <GrowthRateChart data={growthRateData} height={400} />
      <CapacityForecast historicalData={forecastData} height={400} />
    </div>
  );

  return (
    <div className={clsx('min-h-screen bg-gray-50 dark:bg-gray-900 p-6', className)}>
      {layout === 'grid' && renderGridLayout()}
      {layout === 'tabs' && renderTabLayout()}
      {layout === 'stack' && renderStackLayout()}
    </div>
  );
};

export default HistoricalDataDashboard;