import React from 'react';
import { Network, Globe, Wifi } from 'lucide-react';
import { Card } from '@/components/ui/Card';

export const NetworksPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Networks
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Docker network management and monitoring
        </p>
      </div>

      <Card className="p-12 text-center">
        <Network className="h-12 w-12 mx-auto text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          Networks Module Coming Soon
        </h3>
        <p className="text-gray-500 dark:text-gray-400">
          Network monitoring and management features are in development.
        </p>
      </Card>
    </div>
  );
};
