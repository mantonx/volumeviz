/**
 * AdminLayout - Layout component for admin pages
 *
 * Features:
 * - Sidebar navigation for admin sections
 * - Header with admin title
 * - Responsive design
 * - Active link highlighting
 */

import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Users,
  FileText,
  Settings,
  Shield,
  Menu,
  X,
  ChevronLeft,
  LayoutDashboard,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/utils';

interface AdminLayoutProps {
  children: React.ReactNode;
}

interface NavItem {
  name: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const navItems: NavItem[] = [
  {
    name: 'Dashboard',
    path: '/admin',
    icon: LayoutDashboard,
    description: 'Admin overview',
  },
  {
    name: 'Users',
    path: '/admin/users',
    icon: Users,
    description: 'Manage user accounts',
  },
  {
    name: 'Audit Logs',
    path: '/admin/audit',
    icon: FileText,
    description: 'View system audit logs',
  },
  {
    name: 'Permissions',
    path: '/admin/permissions',
    icon: Shield,
    description: 'Manage roles & permissions',
  },
  {
    name: 'System Settings',
    path: '/admin/settings',
    icon: Settings,
    description: 'Configure system settings',
  },
];

export const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 bg-surface">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-gray-600 bg-opacity-75 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 bg-surface border-r border-line transform transition-transform duration-300 ease-in-out lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Sidebar header */}
        <div className="flex items-center justify-between h-16 px-6 border-b border-line">
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            <h1 className="text-lg font-bold text-primary">Admin Panel</h1>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-gray-500 hover:text-secondary hover:text-primary"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');

            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
                  isActive
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                    : 'text-gray-700 text-secondary hover:bg-surface-hover'
                )}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.name}</p>
                  <p className={cn(
                    "text-xs truncate",
                    isActive
                      ? "text-blue-500 dark:text-blue-400"
                      : "text-gray-500 text-tertiary"
                  )}>
                    {item.description}
                  </p>
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Sidebar footer */}
        <div className="p-4 border-t border-line">
          <Link
            to="/"
            className="flex items-center gap-2 px-3 py-2 text-sm text-secondary hover:text-primary hover:bg-surface-hover rounded-lg transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar for mobile */}
        <div className="sticky top-0 z-30 lg:hidden bg-surface border-b border-line">
          <div className="flex items-center justify-between h-16 px-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(true)}
              className="text-gray-500 hover:text-secondary hover:text-primary"
            >
              <Menu className="h-6 w-6" />
            </Button>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <h1 className="text-base font-bold text-primary">Admin</h1>
            </div>
            <div className="w-10" /> {/* Spacer for centering */}
          </div>
        </div>

        {/* Page content */}
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
