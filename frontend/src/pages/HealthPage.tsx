import React from 'react';
import { Activity, Heart, CheckCircle } from 'lucide-react';
import { Card } from '@/components/ui/Card';

export const HealthPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          System Health
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          API and service health monitoring
        </p>
      </div>

      <Card className="p-12 text-center">
        <Activity className="h-12 w-12 mx-auto text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          Health Dashboard Coming Soon
        </h3>
        <p className="text-gray-500 dark:text-gray-400">
          Comprehensive health monitoring and alerting features are being built.
        </p>
      </Card>
    </div>
  );
};
