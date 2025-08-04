import React from 'react';
import { useAtom, useAtomValue } from 'jotai';
import {
  Menu,
  X,
  Bell,
  Settings,
  User,
  HelpCircle,
  Sun,
  Moon,
  Monitor,
  Wifi,
  WifiOff,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { themeAtom, apiStatusAtom, requestCountAtom } from '@/store';
import { cn } from '@/utils';

interface HeaderProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

const ThemeIcon = ({ theme }: { theme: 'light' | 'dark' | 'system' }) => {
  switch (theme) {
    case 'light':
      return <Sun className="h-4 w-4" />;
    case 'dark':
      return <Moon className="h-4 w-4" />;
    default:
      return <Monitor className="h-4 w-4" />;
  }
};

const StatusIcon = ({
  status,
}: {
  status: 'online' | 'offline' | 'connecting' | 'error';
}) => {
  switch (status) {
    case 'online':
      return <Wifi className="h-4 w-4 text-green-500" />;
    case 'offline':
      return <WifiOff className="h-4 w-4 text-red-500" />;
    case 'connecting':
      return <Wifi className="h-4 w-4 text-yellow-500 animate-pulse" />;
    case 'error':
      return <AlertTriangle className="h-4 w-4 text-orange-500" />;
    default:
      return <WifiOff className="h-4 w-4 text-gray-400" />;
  }
};

export const Header: React.FC<HeaderProps> = ({
  sidebarOpen,
  setSidebarOpen,
}) => {
  const [theme, setTheme] = useAtom(themeAtom);
  const apiStatus = useAtomValue(apiStatusAtom);
  const activeRequests = useAtomValue(requestCountAtom);

  const toggleTheme = () => {
    const themes: Array<'light' | 'dark' | 'system'> = [
      'light',
      'dark',
      'system',
    ];
    const currentIndex = themes.indexOf(theme);
    const nextIndex = (currentIndex + 1) % themes.length;
    setTheme(themes[nextIndex]);
  };

  return (
    <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-sm border-b border-gray-200 dark:bg-gray-900/80 dark:border-gray-700">
      <div className="flex h-16 items-center gap-x-4 px-4 sm:gap-x-6 sm:px-6 lg:px-8">
        {/* Mobile menu button */}
        <Button
          variant="ghost"
          size="sm"
          className="lg:hidden"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          <span className="sr-only">Open sidebar</span>
          {sidebarOpen ? (
            <X className="h-6 w-6" aria-hidden="true" />
          ) : (
            <Menu className="h-6 w-6" aria-hidden="true" />
          )}
        </Button>

        {/* Logo - Hidden on mobile when sidebar is open */}
        <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
          <div
            className={cn(
              'flex items-center gap-x-3',
              sidebarOpen && 'hidden lg:flex',
            )}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
              <span className="text-sm font-bold text-white">VV</span>
            </div>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
              VolumeViz
            </h1>
          </div>

          {/* Search bar placeholder - for future implementation */}
          <div className="flex flex-1 justify-center lg:justify-end">
            <div className="w-full max-w-lg lg:max-w-xs">
              {/* Search will go here */}
            </div>
          </div>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-x-4 lg:gap-x-6">
          {/* API Status */}
          <div className="flex items-center gap-x-2">
            <StatusIcon status={apiStatus} />
            {activeRequests > 0 && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {activeRequests}
              </span>
            )}
          </div>

          {/* Theme toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleTheme}
            className="p-2"
          >
            <ThemeIcon theme={theme} />
            <span className="sr-only">Toggle theme</span>
          </Button>

          {/* Notifications */}
          <Button variant="ghost" size="sm" className="p-2 relative">
            <Bell className="h-5 w-5" />
            <span className="sr-only">View notifications</span>
            {/* Notification dot */}
            <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500"></span>
          </Button>

          {/* Settings */}
          <Button variant="ghost" size="sm" className="p-2">
            <Settings className="h-5 w-5" />
            <span className="sr-only">Settings</span>
          </Button>

          {/* Help */}
          <Button variant="ghost" size="sm" className="p-2">
            <HelpCircle className="h-5 w-5" />
            <span className="sr-only">Help</span>
          </Button>

          {/* User menu */}
          <Button variant="ghost" size="sm" className="p-2">
            <User className="h-5 w-5" />
            <span className="sr-only">Your profile</span>
          </Button>
        </div>
      </div>

      {/* Loading bar for active requests */}
      {activeRequests > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 animate-pulse"></div>
      )}
    </header>
  );
};
