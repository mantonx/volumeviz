import React from 'react';
import { BarChart3, TrendingUp, Activity } from 'lucide-react';
import { Card } from '@/components/ui/Card';

export const MetricsPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Metrics
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Performance metrics and analytics
        </p>
      </div>

      <Card className="p-12 text-center">
        <BarChart3 className="h-12 w-12 mx-auto text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          Metrics Dashboard Coming Soon
        </h3>
        <p className="text-gray-500 dark:text-gray-400">
          Comprehensive performance analytics and visualization tools are being
          developed.
        </p>
      </Card>
    </div>
  );
};
