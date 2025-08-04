import React, { useState } from 'react';
import { useAtomValue } from 'jotai';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { resolvedThemeAtom } from '@/store';
import { BaseComponentProps } from '@/types';
import { cn } from '@/utils';

export interface LayoutProps extends BaseComponentProps {
  className?: string;
}

export const Layout: React.FC<LayoutProps> = ({ children, className }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const resolvedTheme = useAtomValue(resolvedThemeAtom);

  // Apply theme to document root
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
      {/* Sidebar */}
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main content area */}
      <div className="lg:pl-72">
        {/* Header */}
        <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

        {/* Page content */}
        <main className={cn('py-6', className)}>
          <div className="px-4 sm:px-6 lg:px-8">{children}</div>
        </main>
      </div>
    </div>
  );
};
