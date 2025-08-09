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
import { themeAtom, apiStatusAtom, requestCountAtom, connectionStatusAtom } from '@/store';
import { cn } from '@/utils';
import type { HeaderProps, ThemeOption, ApiStatus } from './Header.types';
import type { ConnectionStatus, WebSocketStatus } from '@/store/atoms/websocket';

/**
 * Theme icon component mapping theme names to appropriate icons
 */
const ThemeIcon = ({ theme }: { theme: ThemeOption }) => {
  switch (theme) {
    case 'light':
      return <Sun className="h-4 w-4" />;
    case 'dark':
      return <Moon className="h-4 w-4" />;
    default:
      return <Monitor className="h-4 w-4" />;
  }
};

/**
 * API status icon component with visual feedback for connection state
 */
const StatusIcon = ({ status }: { status: ApiStatus }) => {
  const baseClasses = 'h-4 w-4';

  switch (status) {
    case 'online':
      return <Wifi className={cn(baseClasses, 'text-green-500')} />;
    case 'offline':
      return <WifiOff className={cn(baseClasses, 'text-red-500')} />;
    case 'connecting':
      return (
        <Wifi className={cn(baseClasses, 'text-yellow-500 animate-pulse')} />
      );
    case 'error':
      return <AlertTriangle className={cn(baseClasses, 'text-red-500')} />;
    default:
      return <WifiOff className={cn(baseClasses, 'text-gray-400')} />;
  }
};

/**
 * WebSocket status icon component
 */
const WebSocketIcon = ({ status }: { status: WebSocketStatus }) => {
  const baseClasses = 'h-3 w-3';

  switch (status) {
    case 'connected':
      return <div className={cn(baseClasses, 'rounded-full bg-green-500')} />;
    case 'connecting':
    case 'reconnecting':
      return <div className={cn(baseClasses, 'rounded-full bg-yellow-500 animate-pulse')} />;
    case 'disconnected':
      return <div className={cn(baseClasses, 'rounded-full bg-gray-400')} />;
    case 'error':
      return <div className={cn(baseClasses, 'rounded-full bg-red-500')} />;
    default:
      return <div className={cn(baseClasses, 'rounded-full bg-gray-400')} />;
  }
};

/**
 * Application header component providing navigation and system status.
 *
 * Features:
 * - Mobile sidebar toggle (hamburger menu)
 * - Real-time API connection status indicator
 * - Active request counter with loading animation
 * - Theme switcher (light/dark/system)
 * - User menu with settings and help links
 * - Notification bell (future feature)
 *
 * The header is responsive and adapts its layout for mobile and desktop views.
 * Connection status updates automatically based on API health checks.
 * Theme changes are applied immediately to the entire application.
 */
export const Header: React.FC<HeaderProps> = ({
  sidebarOpen,
  setSidebarOpen,
}) => {
  const [theme, setTheme] = useAtom(themeAtom);
  const apiStatus = useAtomValue(apiStatusAtom);
  const requestCount = useAtomValue(requestCountAtom);
  const connectionStatus = useAtomValue(connectionStatusAtom);

  /**
   * Cycle through available themes: system -> light -> dark -> system
   */
  const handleThemeToggle = () => {
    const themes: ThemeOption[] = ['system', 'light', 'dark'];
    const currentIndex = themes.indexOf(theme);
    const nextIndex = (currentIndex + 1) % themes.length;
    setTheme(themes[nextIndex]);
  };

  /**
   * Get human-readable status text for accessibility
   */
  const getStatusText = (status: ApiStatus): string => {
    switch (status) {
      case 'online':
        return 'Connected to API';
      case 'offline':
        return 'Disconnected from API';
      case 'connecting':
        return 'Connecting to API';
      case 'error':
        return 'API connection error';
      default:
        return 'Unknown API status';
    }
  };

  /**
   * Get WebSocket status text for accessibility
   */
  const getWebSocketStatusText = (status: WebSocketStatus): string => {
    switch (status) {
      case 'connected':
        return 'WebSocket connected';
      case 'connecting':
        return 'WebSocket connecting';
      case 'reconnecting':
        return 'WebSocket reconnecting';
      case 'disconnected':
        return 'WebSocket disconnected';
      case 'error':
        return 'WebSocket connection error';
      default:
        return 'Unknown WebSocket status';
    }
  };

  /**
   * Get combined status text for tooltip
   */
  const getCombinedStatusText = (conn: ConnectionStatus): string => {
    let text = getStatusText(conn.api);
    if (conn.websocketEnabled) {
      text += ` | ${getWebSocketStatusText(conn.websocket)}`;
    }
    return text;
  };

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-gray-200 dark:bg-gray-800 dark:border-gray-700">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Left side: Mobile menu button */}
        <div className="flex items-center lg:hidden">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
          >
            {sidebarOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </Button>
        </div>

        {/* Center: Page title and breadcrumbs (future enhancement) */}
        <div className="flex-1 lg:flex-none">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white lg:hidden">
            VolumeViz
          </h1>
        </div>

        {/* Right side: Status indicators and user menu */}
        <div className="flex items-center space-x-4">
          {/* Combined API and WebSocket Status */}
          <div className="flex items-center space-x-2">
            <div
              className="flex items-center space-x-2 px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-700"
              title={getCombinedStatusText(connectionStatus)}
            >
              {/* API Status Icon */}
              <div className="flex items-center space-x-1">
                <StatusIcon status={connectionStatus.api} />
                <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                  API
                </span>
              </div>
              
              {/* WebSocket Status (if enabled) */}
              {connectionStatus.websocketEnabled && (
                <div className="flex items-center space-x-1">
                  <WebSocketIcon status={connectionStatus.websocket} />
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                    RT
                  </span>
                </div>
              )}
              
              {/* Request counter */}
              {requestCount > 0 && (
                <span className="text-xs text-gray-500 dark:text-gray-400 animate-pulse">
                  {requestCount}
                </span>
              )}
            </div>
          </div>

          {/* Theme Toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleThemeToggle}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            title={`Current theme: ${theme}`}
            aria-label="Toggle theme"
          >
            <ThemeIcon theme={theme} />
          </Button>

          {/* Notifications (future feature) */}
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            title="Notifications"
            aria-label="View notifications"
          >
            <Bell className="h-4 w-4" />
          </Button>

          {/* Settings Menu */}
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            title="Settings"
            aria-label="Open settings"
          >
            <Settings className="h-4 w-4" />
          </Button>

          {/* User Menu */}
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            title="User menu"
            aria-label="Open user menu"
          >
            <User className="h-4 w-4" />
          </Button>

          {/* Help */}
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            title="Help"
            aria-label="Get help"
          >
            <HelpCircle className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
};
