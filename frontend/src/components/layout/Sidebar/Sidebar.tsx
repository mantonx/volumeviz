import { useGetVolumes, type VolumeV1 } from '@/api/orval-generated/api';
import { Button } from '@/components/ui/Button';
import { cn } from '@/utils';
import {
  Activity,
  Bell,
  FolderOpen,
  HardDrive,
  Home,
  Layers,
  Settings,
  TrendingUp,
  X,
} from 'lucide-react';
import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';

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
    description: 'Browse and manage Docker volumes',
  },
  {
    name: 'Files',
    href: '/files',
    icon: FolderOpen,
    description: 'Explore and search files across volumes',
  },
  {
    name: 'Trends',
    href: '/trends',
    icon: TrendingUp,
    description: 'Storage trends & capacity planning',
  },
  {
    name: 'Alerts',
    href: '/alerts',
    icon: Bell,
    description: 'Alert management & notifications',
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
    name: 'Settings',
    href: '/settings',
    icon: Settings,
    description: 'Application configuration',
  },
];

export const Sidebar: React.FC<SidebarProps> = ({ open, onClose }) => {
  const location = useLocation();
  const { data: volumesData } = useGetVolumes({ page: 1, page_size: 100 });
  const volumes = (
    volumesData?.status === 200 ? (volumesData.data.data as VolumeV1[]) : []
  ) ?? [];
  const volumeStats = {
    total: volumes.length,
    active: volumes.filter((v) => !v.is_orphaned).length,
    totalSize: volumes.reduce((sum, v) => sum + (v.size_bytes ?? 0), 0),
  };

  // Add badges to navigation items
  const enhancedNavigation = navigation.map((item) => {
    if (item.name === 'Volumes' && volumeStats.total > 0) {
      return { ...item, badge: volumeStats.total };
    }
    return item;
  });

  const NavItem = ({ item }: { item: NavigationItem }) => {
    const isActive = location.pathname === item.href;

    // Add data-tour attribute for specific navigation items
    const getTourAttribute = (name: string) => {
      switch (name) {
        case 'Volumes':
          return 'volumes-link';
        case 'Files':
          return 'files-link';
        case 'Trends':
          return 'trends-link';
        default:
          return undefined;
      }
    };

    return (
      <NavLink
        to={item.href}
        data-tour={getTourAttribute(item.name)}
        className={({ isActive }) =>
          cn(
            'group flex gap-x-3 rounded-md p-3 text-sm leading-6 font-medium transition-colors',
            isActive
              ? 'bg-blue-50 text-blue-600'
              : 'text-secondary hover:text-blue-600 hover:bg-gray-50',
          )
        }
        onClick={() => onClose()}
      >
        <item.icon
          className={cn(
            'h-5 w-5 shrink-0 transition-colors',
            isActive
              ? 'text-blue-600'
              : 'text-tertiary group-hover:text-blue-600',
          )}
          aria-hidden="true"
        />
        <span className="truncate">{item.name}</span>
        {item.badge && (
          <span className="ml-auto inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-surface-secondary text-primary">
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
        data-tour="sidebar"
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-72 overflow-y-auto bg-surface lg:z-40',
          'transition-transform duration-300 ease-in-out lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-16 shrink-0 items-center gap-x-4 border-b border-line px-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
            <Layers className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-lg font-semibold text-primary">
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
              <div className="text-xs font-semibold leading-6 text-tertiary uppercase tracking-wide mb-2">
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
              <div className="text-xs font-semibold leading-6 text-tertiary uppercase tracking-wide mb-2">
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
              <div className="rounded-lg bg-surface-secondary p-4">
                <div className="text-xs font-semibold leading-6 text-tertiary uppercase tracking-wide mb-3">
                  Quick Stats
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-secondary">
                      Total Volumes
                    </span>
                    <span className="font-medium text-primary">
                      {volumeStats.total}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-secondary">
                      Active Volumes
                    </span>
                    <span className="font-medium text-primary">
                      {volumeStats.active}
                    </span>
                  </div>
                  {volumeStats.totalSize > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-secondary">
                        Total Storage
                      </span>
                      <span className="font-medium text-primary">
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
