import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Bell, Settings, History, Send } from 'lucide-react';
import { cn } from '@/utils';
import { AlertDestinations } from '@/components/domain/alerts';
import { AlertRules } from '@/components/domain/alerts';
import { AlertHistory } from '@/components/domain/alerts';

export interface AlertsPageProps {
  className?: string;
}

type TabType = 'destinations' | 'rules' | 'history';

export const AlertsPage: React.FC<AlertsPageProps> = ({ className }) => {
  const [activeTab, setActiveTab] = useState<TabType>('destinations');

  const tabs = [
    {
      id: 'destinations' as const,
      label: 'Destinations',
      icon: Send,
      description: 'Manage notification destinations',
    },
    {
      id: 'rules' as const,
      label: 'Rules & Routes',
      icon: Settings,
      description: 'Configure alert rules and routing',
    },
    {
      id: 'history' as const,
      label: 'Delivery History',
      icon: History,
      description: 'View alert delivery logs',
    },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'destinations':
        return <AlertDestinations />;
      case 'rules':
        return <AlertRules />;
      case 'history':
        return <AlertHistory />;
      default:
        return null;
    }
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">
            Alerts Management
          </h1>
          <p className="text-secondary">
            Configure alert rules, destinations, and monitor delivery status
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="flex items-center gap-1">
            <Bell className="h-3 w-3" />
            Engine Status: Active
          </Badge>
        </div>
      </div>

      {/* Tab Navigation */}
      <Card className="p-0">
        <div className="border-b border-line">
          <nav className="-mb-px flex space-x-8 px-6">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm',
                    isActive
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 text-tertiary hover:text-secondary',
                  )}
                >
                  <Icon
                    className={cn(
                      'mr-2 h-4 w-4',
                      isActive
                        ? 'text-blue-500 dark:text-blue-400'
                        : 'text-gray-400 group-hover:text-gray-500 group-hover:text-secondary',
                    )}
                  />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">{renderTabContent()}</div>
      </Card>
    </div>
  );
};

export default AlertsPage;
