/**
 * Explorer state atoms
 * 
 * Jotai atoms for managing file explorer state, navigation, and file data.
 */

import { atom } from 'jotai';

// File item interface for explorer components
export interface FileItem {
  id: string;
  name: string;
  path: string;
  size: number;
  type: 'file' | 'directory';
  modified: Date;
  permissions?: string;
  extension?: string;
  mimeType?: string;
  thumbnail?: string;
}

// Tree node interface for navigation tree
export interface TreeNode {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: TreeNode[];
  expanded?: boolean;
  hasChildren?: boolean;
}

// Current volume atom
export const currentVolumeAtom = atom<string | null>(null);

// Current path atom
export const currentPathAtom = atom<string>('/');

// Explorer files atom
export const explorerFilesAtom = atom<FileItem[]>([]);

// Explorer loading state
export const explorerLoadingAtom = atom<boolean>(false);

// Explorer error state
export const explorerErrorAtom = atom<string | null>(null);

// Tree nodes atom
export const treeNodesAtom = atom<TreeNode[]>([]);

// Selected files atom (for bulk operations)
export const selectedFilesAtom = atom<string[]>([]);

// File view mode atom (grid, list, table)
export const viewModeAtom = atom<'grid' | 'list' | 'table'>('table');

// Sort options atom
export interface SortOption {
  field: 'name' | 'size' | 'modified' | 'type';
  direction: 'asc' | 'desc';
}

export const sortOptionsAtom = atom<SortOption>({
  field: 'name',
  direction: 'asc',
});

// Search query atom for explorer
export const explorerSearchAtom = atom<string>('');

// File preview atom
export interface FilePreview {
  fileId: string;
  isOpen: boolean;
  content?: string;
  error?: string;
}

export const filePreviewAtom = atom<FilePreview | null>(null);

// Navigation history atoms
export const navigationHistoryAtom = atom<string[]>(['/']);
export const navigationIndexAtom = atom<number>(0);

// Computed atoms
export const canGoBackAtom = atom((get) => {
  const index = get(navigationIndexAtom);
  return index > 0;
});

export const canGoForwardAtom = atom((get) => {
  const index = get(navigationIndexAtom);
  const history = get(navigationHistoryAtom);
  return index < history.length - 1;
});

// Filtered and sorted files atom
export const filteredFilesAtom = atom((get) => {
  const files = get(explorerFilesAtom);
  const searchQuery = get(explorerSearchAtom);
  const sortOptions = get(sortOptionsAtom);
  
  let filtered = files;
  
  // Apply search filter
  if (searchQuery) {
    filtered = files.filter(file => 
      file.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }
  
  // Apply sorting
  filtered.sort((a, b) => {
    const { field, direction } = sortOptions;
    let comparison = 0;
    
    switch (field) {
      case 'name':
        comparison = a.name.localeCompare(b.name);
        break;
      case 'size':
        comparison = a.size - b.size;
        break;
      case 'modified':
        comparison = a.modified.getTime() - b.modified.getTime();
        break;
      case 'type':
        comparison = a.type.localeCompare(b.type);
        break;
    }
    
    return direction === 'asc' ? comparison : -comparison;
  });
  
  return filtered;
});