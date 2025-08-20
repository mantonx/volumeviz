/**
 * VolumeExplorerPanel - Comprehensive file browser with preview integration
 *
 * A sophisticated domain composition that combines file browsing, preview,
 * search, filtering, and management capabilities in a unified interface.
 *
 * @example
 * ```tsx
 * import { VolumeExplorerPanel } from '@/components/domain/VolumeExplorerPanel';
 *
 * function FileManager() {
 *   const [items, setItems] = useState<ExplorerItem[]>([]);
 *   const [currentPath, setCurrentPath] = useState('/');
 *
 *   return (
 *     <VolumeExplorerPanel
 *       volumeId="vol-001"
 *       currentPath={currentPath}
 *       items={items}
 *       viewMode="grid"
 *       onItemClick={(item) => console.log('Clicked:', item)}
 *       onPathChange={setCurrentPath}
 *       onRefresh={() => loadItems(currentPath)}
 *     />
 *   );
 * }
 * ```
 */

export { VolumeExplorerPanel } from './VolumeExplorerPanel';

export type {
  VolumeExplorerPanelProps,
  VolumeExplorerPanelState,
  VolumeExplorerPanelRef,
  ExplorerItem,
  ExplorerViewMode,
  ExplorerSortBy,
  ExplorerSortOrder,
  ExplorerSelection,
  ExplorerFilter,
  ExplorerContextAction,
  BreadcrumbItem,
  PreviewConfig,
  ExplorerUtils,
} from './VolumeExplorerPanel.types';

export {
  explorerUtils,
  createMockExplorerData,
} from './VolumeExplorerPanel.types';