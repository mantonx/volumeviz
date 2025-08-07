import React, { useState } from 'react';
import { useAtomValue } from 'jotai';
import { Header } from '../Header';
import { Sidebar } from '../Sidebar';
import { resolvedThemeAtom } from '@/store';
import { cn } from '@/utils';
import type { LayoutProps } from './Layout.types';

/**
 * Main application layout component for VolumeViz.
 *
 * Provides the core shell structure including:
 * - Responsive sidebar navigation (collapsible on mobile)
 * - Top header with breadcrumbs and user actions
 * - Main content area with consistent padding and spacing
 * - Automatic dark/light theme application to document root
 * - Mobile-first responsive design with breakpoint-aware sidebar
 *
 * The layout automatically manages:
 * - Sidebar open/close state
 * - Theme class application to HTML root element
 * - Consistent spacing and typography across all pages
 * - Mobile menu overlays and desktop persistent sidebar
 *
 * Used as the root layout wrapper for all authenticated pages in VolumeViz.
 */
export const Layout: React.FC<LayoutProps> = ({ children, className }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const resolvedTheme = useAtomValue(resolvedThemeAtom);

  // Apply theme to document root for global dark mode support
  React.useEffect(() => {
    const root = document.documentElement;
    if (resolvedTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [resolvedTheme]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Collapsible sidebar navigation */}
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main content area with responsive left margin for sidebar */}
      <div className="lg:pl-72">
        {/* Top header with mobile menu toggle and navigation */}
        <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

        {/* Page content container with consistent padding */}
        <main className={cn('py-6', className)}>
          <div className="px-4 sm:px-6 lg:px-8">{children}</div>
        </main>
      </div>
    </div>
  );
};
