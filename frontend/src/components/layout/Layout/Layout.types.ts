import { BaseComponentProps } from '@/types';

/**
 * Props for the main Layout component.
 *
 * The Layout component serves as the root shell for all authenticated
 * pages in VolumeViz, providing consistent navigation and content structure.
 */
export interface LayoutProps extends BaseComponentProps {
  /**
   * Additional CSS classes to apply to the main content area.
   * Useful for page-specific spacing or styling adjustments.
   */
  className?: string;
}
