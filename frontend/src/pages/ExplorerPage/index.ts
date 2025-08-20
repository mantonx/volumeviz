/**
 * Explorer page component for VolumeViz file system exploration.
 *
 * Provides comprehensive file system browsing with:
 * - Lazy-loading directory tree navigation
 * - Virtualized file table for performance
 * - File metadata and raw JSON viewer
 * - Real-time updates via WebSocket
 * - URL-based navigation state
 * - Search and filtering capabilities
 *
 * The explorer integrates with the volume scanning system
 * to display discovered files and their metadata.
 */
export { ExplorerPage } from './ExplorerPage';
export type {
  ExplorerPageProps,
  FileItem,
  TreeNode,
  FileMetadata,
} from './ExplorerPage.types';
