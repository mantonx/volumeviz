import React from 'react';
import {
  useRealtimeConnectionStatus,
  useSystemHealth,
  useSystemStatistics,
  useRealtimeErrors,
  useCapacityAlerts,
  useHistoricalData,
  useRealtimeDashboardSummary,
} from '@/providers/realtime/hooks';
import { Alert, AlertDescription } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import {
  Activity,
  AlertTriangle,
  TrendingUp,
  Database,
  Wifi,
  WifiOff,
} from 'lucide-react';

interface RealtimeSystemMonitorProps {
  className?: string;
}

/**
 * Comprehensive Real-time System Monitor
 * Demonstrates the full power of the enhanced real-time system with Jotai state management
 * Shows historical data, statistics, health, and error updates in real-time
 */
export function RealtimeSystemMonitor({
  className,
}: RealtimeSystemMonitorProps) {
  // Use the clean Jotai-based hooks
  const connectionStatus = useRealtimeConnectionStatus();
  const { health, healthScore, isHealthy, isDegraded, isCritical } =
    useSystemHealth();
  const { stats, activeScans, performanceMetrics } = useSystemStatistics();
  const { recentErrors, criticalErrors, hasCriticalErrors } =
    useRealtimeErrors();
  const { criticalAlerts, warningAlerts, hasCriticalAlerts } =
    useCapacityAlerts();
  const { recentUpdates } = useHistoricalData();
  const dashboardSummary = useRealtimeDashboardSummary();

  const getHealthScoreColor = (score: number) => {
    if (score >= 0.8) return 'text-green-600';
    if (score >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getHealthStatusBadge = (status: string) => {
    const variants = {
      healthy: 'success',
      degraded: 'warning',
      critical: 'error',
    } as const;
    return variants[status as keyof typeof variants] || 'secondary';
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Connection Status */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            {connectionStatus.isConnected ? (
              <Wifi className="w-5 h-5 text-green-500" />
            ) : (
              <WifiOff className="w-5 h-5 text-red-500" />
            )}
            Real-time Connection Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 mb-3">
            <Badge variant={connectionStatus.isConnected ? 'success' : 'error'}>
              {connectionStatus.isConnected ? 'Connected' : 'Disconnected'}
            </Badge>
            {connectionStatus.connectedAt && (
              <span className="text-sm text-gray-600">
                Connected: {connectionStatus.connectedAt.toLocaleTimeString()}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-600">
            {connectionStatus.isConnected
              ? 'Receiving comprehensive real-time updates for scans, historical data, statistics, health, and errors.'
              : 'Connection lost. Real-time updates are paused.'}
          </p>
        </CardContent>
      </Card>

      {/* System Health */}
      {health && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              System Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 mb-4">
              <Badge variant={getHealthStatusBadge(health.overall_health)}>
                {health.overall_health.toUpperCase()}
              </Badge>
              <span
                className={`font-semibold ${getHealthScoreColor(healthScore)}`}
              >
                Score: {(healthScore * 100).toFixed(1)}%
              </span>
            </div>

            <div className="space-y-2">
              {health.components.slice(0, 3).map((component, index) => (
                <div key={index} className="flex justify-between items-center">
                  <span className="font-medium">
                    {component.component_name}
                  </span>
                  <Badge
                    variant={
                      component.status === 'healthy' ? 'success' : 'warning'
                    }
                  >
                    {component.status}
                  </Badge>
                </div>
              ))}
            </div>

            {health.recommendations && health.recommendations.length > 0 && (
              <div className="mt-4 p-3 bg-blue-50 rounded-md">
                <p className="text-sm font-medium text-blue-900">
                  Recommendations:
                </p>
                <ul className="text-sm text-blue-800 mt-1">
                  {health.recommendations.slice(0, 2).map((rec, index) => (
                    <li key={index}>• {rec}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* System Statistics */}
      {stats && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              System Statistics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              {stats.system_stats && (
                <>
                  <div>
                    <p className="text-sm text-gray-600">Active Scans</p>
                    <p className="text-2xl font-bold">{activeScans}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Total Volumes</p>
                    <p className="text-2xl font-bold">
                      {stats.system_stats.total_volumes}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Health Score</p>
                    <p
                      className={`text-2xl font-bold ${getHealthScoreColor(healthScore)}`}
                    >
                      {(healthScore * 100).toFixed(1)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Growth Rate</p>
                    <p className="text-2xl font-bold">
                      {stats.system_stats.average_growth_rate.toFixed(1)}%
                    </p>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Historical Updates */}
      {recentUpdates.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              Recent Historical Updates
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentUpdates.slice(0, 5).map((update, index) => (
                <div key={index} className="p-3 bg-gray-50 rounded-md">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">{update.volume_id}</p>
                      <p className="text-sm text-gray-600">
                        {update.update_type}
                      </p>
                    </div>
                    <Badge variant="info">{update.method}</Badge>
                  </div>
                  <div className="mt-2 text-sm text-gray-600">
                    <span>{update.file_count.toLocaleString()} files, </span>
                    <span>
                      {(update.total_size / (1024 * 1024 * 1024)).toFixed(2)} GB
                    </span>
                    {update.trend_data && (
                      <span className="ml-2">
                        • Trend: {update.trend_data.trend_direction}(
                        {update.trend_data.growth_rate_percent > 0 ? '+' : ''}
                        {update.trend_data.growth_rate_percent.toFixed(1)}%)
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Capacity Alerts */}
      {(criticalAlerts.length > 0 || warningAlerts.length > 0) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Capacity Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[...criticalAlerts, ...warningAlerts].slice(0, 5).map(
                (alert, index) =>
                  alert.alert_data && (
                    <Alert
                      key={index}
                      variant={
                        alert.alert_data.severity === 'critical'
                          ? 'destructive'
                          : 'default'
                      }
                    >
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium">
                              {alert.alert_data.title}
                            </p>
                            <p className="text-sm">
                              {alert.alert_data.message}
                            </p>
                            {alert.alert_data.volume_id && (
                              <p className="text-xs text-gray-600 mt-1">
                                Volume: {alert.alert_data.volume_id}
                              </p>
                            )}
                          </div>
                          <Badge
                            variant={
                              alert.alert_data.severity === 'critical'
                                ? 'error'
                                : 'warning'
                            }
                          >
                            {alert.alert_data.severity}
                          </Badge>
                        </div>
                      </AlertDescription>
                    </Alert>
                  ),
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Errors */}
      {recentErrors.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Recent Errors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentErrors.map((error, index) => (
                <Alert
                  key={index}
                  variant={
                    error.severity === 'critical' ? 'destructive' : 'default'
                  }
                >
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">{error.error_message}</p>
                        <p className="text-sm text-gray-600">
                          {error.component} • {error.error_type}
                        </p>
                        <p className="text-xs text-gray-500">
                          {error.user_impact}
                        </p>
                      </div>
                      <Badge
                        variant={
                          error.severity === 'critical' ? 'error' : 'warning'
                        }
                      >
                        {error.severity}
                      </Badge>
                    </div>
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dashboard Summary Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            System Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-sm text-gray-600">Status</p>
              <Badge
                variant={
                  dashboardSummary.overallStatus === 'healthy'
                    ? 'success'
                    : dashboardSummary.overallStatus === 'active'
                      ? 'info'
                      : dashboardSummary.overallStatus === 'degraded'
                        ? 'warning'
                        : 'error'
                }
              >
                {dashboardSummary.overallStatus}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-gray-600">Active Scans</p>
              <p className="text-xl font-bold">
                {dashboardSummary.activeScansCount}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Critical Issues</p>
              <p
                className={`text-xl font-bold ${dashboardSummary.hasCriticalIssues ? 'text-red-600' : 'text-green-600'}`}
              >
                {dashboardSummary.criticalErrorCount +
                  dashboardSummary.criticalAlertCount}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Volumes</p>
              <p className="text-xl font-bold">
                {dashboardSummary.totalVolumes}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
