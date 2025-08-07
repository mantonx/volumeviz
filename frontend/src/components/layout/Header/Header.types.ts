/**
 * Available theme options for the application
 */
export type ThemeOption = 'light' | 'dark' | 'system';

/**
 * API connection status indicators
 */
export type ApiStatus = 'online' | 'offline' | 'connecting' | 'error';

/**
 * Props for the Header component
 */
export interface HeaderProps {
  /** Whether the mobile sidebar is currently open */
  sidebarOpen: boolean;
  /** Function to toggle the sidebar open/closed state */
  setSidebarOpen: (open: boolean) => void;
}
