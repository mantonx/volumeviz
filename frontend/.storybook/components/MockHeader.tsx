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
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ReadyState } from 'react-use-websocket';
import {
  themeAtom,
  websocketEnabledAtom,
} from '@/store';
import { cn } from '@/utils';

interface HeaderProps {
  sidebarOpen?: boolean;
  setSidebarOpen?: (open: boolean) => void;
}

/**
 * Mock Header component for Storybook that doesn't use useRealtime hook
 * This provides the same visual behavior as the real Header without WebSocket dependencies
 */
export const MockHeader: React.FC<HeaderProps> = ({ 
  sidebarOpen = false, 
  setSidebarOpen = () => {} 
}) => {
  const [theme, setTheme] = useAtom(themeAtom);
  const websocketEnabled = useAtomValue(websocketEnabledAtom);
  
  // Mock the realtime values that would come from useRealtime hook
  const wsReadyState = ReadyState.OPEN; // Connected state
  const latency = 50; // Mock 50ms latency
  const reconnectAttempts = 0; // No reconnection attempts

  // Convert ReadyState to display format (copied from original Header)
  const wsStatus = React.useMemo(() => {
    switch (wsReadyState as ReadyState) {
      case ReadyState.CONNECTING:
        return { text: 'Connecting...', color: 'text-yellow-600', icon: RefreshCw, spinning: true };
      case ReadyState.OPEN:
        return { text: 'Connected', color: 'text-green-600', icon: Wifi, spinning: false };
      case ReadyState.CLOSING:
        return { text: 'Disconnecting...', color: 'text-orange-600', icon: RefreshCw, spinning: true };
      case ReadyState.CLOSED:
        return { text: 'Disconnected', color: 'text-red-600', icon: WifiOff, spinning: false };
      case ReadyState.UNINSTANTIATED:
        return { text: 'Not Connected', color: 'text-gray-600', icon: WifiOff, spinning: false };
      default:
        return { text: 'Unknown', color: 'text-gray-600', icon: AlertTriangle, spinning: false };
    }
  }, [wsReadyState]);

  const StatusIcon = wsStatus.icon;

  const toggleTheme = () => {
    const themes = ['light', 'dark', 'system'] as const;
    const currentIndex = themes.indexOf(theme);
    const nextTheme = themes[(currentIndex + 1) % themes.length];
    setTheme(nextTheme);
  };

  const getThemeIcon = () => {
    switch (theme) {
      case 'light':
        return Sun;
      case 'dark':
        return Moon;
      case 'system':
        return Monitor;
      default:
        return Monitor;
    }
  };

  const ThemeIcon = getThemeIcon();

  return (
    <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shadow-sm">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left side - Logo and hamburger menu */}
          <div className="flex items-center space-x-4">
            {/* Hamburger menu - only show on mobile */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2"
              aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
            >
              {sidebarOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </Button>

            {/* Logo */}
            <div className="flex-shrink-0 flex items-center">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                VolumeViz
              </h1>
            </div>
          </div>

          {/* Center - Connection Status */}
          <div className="flex items-center space-x-3">
            {websocketEnabled && (
              <div className="flex items-center space-x-2 px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-800">
                <StatusIcon 
                  className={cn(
                    "h-4 w-4",
                    wsStatus.color,
                    wsStatus.spinning && "animate-spin"
                  )}
                />
                <span className={cn("text-sm font-medium", wsStatus.color)}>
                  {wsStatus.text}
                </span>
                {latency !== null && wsReadyState === ReadyState.OPEN && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {latency}ms
                  </span>
                )}
                {reconnectAttempts > 0 && (
                  <span className="text-xs text-orange-600">
                    Retry #{reconnectAttempts}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Right side - Actions */}
          <div className="flex items-center space-x-2">
            {/* Theme toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleTheme}
              className="p-2"
              aria-label="Toggle theme"
            >
              <ThemeIcon className="h-5 w-5" />
            </Button>

            {/* Notifications */}
            <Button
              variant="ghost"
              size="sm"
              className="p-2 relative"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
              <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 text-white rounded-full text-xs flex items-center justify-center">
                3
              </span>
            </Button>

            {/* Settings */}
            <Button
              variant="ghost"
              size="sm"
              className="p-2"
              aria-label="Settings"
            >
              <Settings className="h-5 w-5" />
            </Button>

            {/* Help */}
            <Button
              variant="ghost"
              size="sm"
              className="p-2"
              aria-label="Help"
            >
              <HelpCircle className="h-5 w-5" />
            </Button>

            {/* User menu */}
            <Button
              variant="ghost"
              size="sm"
              className="p-2"
              aria-label="User menu"
            >
              <User className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};