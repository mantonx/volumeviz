import React from 'react';
import { Button } from '@/components/ui';

/**
 * Main dashboard overview page.
 */
export const Dashboard: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
          Dashboard
        </h2>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Welcome to VolumeViz - Your Docker container visualization and
          monitoring tool
        </p>
      </div>

      <div className="text-center py-20">
        <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-4">
          Dashboard Under Construction
        </h3>
        <p className="text-gray-500 dark:text-gray-400 mb-6">
          The dashboard is being built with our new component architecture.
        </p>
        <Button variant="primary">Get Started</Button>
      </div>
    </div>
  );
};
