import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAtomValue } from 'jotai';
import {
  Home,
  Database,
  HardDrive,
  BarChart3,
  Settings,
  Shield,
  Activity,
  FileText,
  Layers,
  Network,
  X,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { volumeStatsAtom, containerStatsAtom } from '@/store';
import { cn } from '@/utils';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

interface NavigationItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string | number;
  description?: string;
}

const navigation: NavigationItem[] = [
  {
    name: 'Dashboard',
    href: '/',
    icon: Home,
    description: 'Overview and system status',
  },
  {
    name: 'Volumes',
    href: '/volumes',
    icon: HardDrive,
    description: 'Docker volume management',
  },
  {
    name: 'Containers',
    href: '/containers',
    icon: Database,
    description: 'Container monitoring',
  },
  {
    name: 'Networks',
    href: '/networks',
    icon: Network,
    description: 'Network configurations',
  },
  {
    name: 'Real-time',
    href: '/realtime',
    icon: Zap,
    description: 'Live volume monitoring',
  },
  {
    name: 'Analytics',
    href: '/historical',
    icon: TrendingUp,
    description: 'Historical data & trends',
  },
  {
    name: 'Logs',
    href: '/logs',
    icon: FileText,
    description: 'System and container logs',
  },
];

const secondaryNavigation: NavigationItem[] = [
  {
    name: 'System Health',
    href: '/health',
    icon: Activity,
    description: 'API and service status',
  },
  {
    name: 'Security',
    href: '/security',
    icon: Shield,
    description: 'Security monitoring',
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: Settings,
    description: 'Application configuration',
  },
];

export const Sidebar: React.FC<SidebarProps> = ({ open, onClose }) => {
  const location = useLocation();
  const volumeStats = useAtomValue(volumeStatsAtom);
  const containerStats = useAtomValue(containerStatsAtom);

  // Add badges to navigation items
  const enhancedNavigation = navigation.map((item) => {
    if (item.name === 'Volumes' && volumeStats.total > 0) {
      return { ...item, badge: volumeStats.total };
    }
    if (item.name === 'Containers' && containerStats.total > 0) {
      return { ...item, badge: containerStats.total };
    }
    return item;
  });

  const NavItem = ({ item }: { item: NavigationItem }) => {
    const isActive = location.pathname === item.href;

    return (
      <NavLink
        to={item.href}
        className={({ isActive }) =>
          cn(
            'group flex gap-x-3 rounded-md p-3 text-sm leading-6 font-medium transition-colors',
            isActive
              ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400'
              : 'text-gray-700 hover:text-blue-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:text-blue-400 dark:hover:bg-gray-800',
          )
        }
        onClick={() => onClose()}
      >
        <item.icon
          className={cn(
            'h-5 w-5 shrink-0 transition-colors',
            isActive
              ? 'text-blue-600 dark:text-blue-400'
              : 'text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400',
          )}
          aria-hidden="true"
        />
        <span className="truncate">{item.name}</span>
        {item.badge && (
          <span className="ml-auto inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
            {item.badge}
          </span>
        )}
      </NavLink>
    );
  };

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-gray-900/80 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-72 overflow-y-auto bg-white dark:bg-gray-900 lg:z-40',
          'transition-transform duration-300 ease-in-out lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 dark:border-gray-700 px-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
            <Layers className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
            VolumeViz
          </h1>
          {/* Close button for mobile */}
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto lg:hidden"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <nav className="flex flex-1 flex-col px-6 py-4">
          <ul className="flex flex-1 flex-col gap-y-7">
            {/* Primary navigation */}
            <li>
              <div className="text-xs font-semibold leading-6 text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">
                Main
              </div>
              <ul className="-mx-2 space-y-1">
                {enhancedNavigation.map((item) => (
                  <li key={item.name}>
                    <NavItem item={item} />
                  </li>
                ))}
              </ul>
            </li>

            {/* Secondary navigation */}
            <li>
              <div className="text-xs font-semibold leading-6 text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">
                System
              </div>
              <ul className="-mx-2 space-y-1">
                {secondaryNavigation.map((item) => (
                  <li key={item.name}>
                    <NavItem item={item} />
                  </li>
                ))}
              </ul>
            </li>

            {/* System stats */}
            <li className="mt-auto">
              <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-4">
                <div className="text-xs font-semibold leading-6 text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-3">
                  Quick Stats
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">
                      Volumes
                    </span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {volumeStats.active}/{volumeStats.total}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">
                      Containers
                    </span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {containerStats.running}/{containerStats.total}
                    </span>
                  </div>
                  {volumeStats.totalSize > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">
                        Storage
                      </span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {(volumeStats.totalSize / (1024 * 1024 * 1024)).toFixed(
                          1,
                        )}
                        GB
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </li>
          </ul>
        </nav>
      </div>
    </>
  );
};
