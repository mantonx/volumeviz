/**
 * Explorer atoms for managing file system navigation state
 */

import { atom } from 'jotai';

// Types for explorer data
export interface TreeNode {
  id: string;
  name: string;
  path: string;
  type: 'folder' | 'file';
  children?: TreeNode[];
  isExpanded?: boolean;
  isLoading?: boolean;
  hasChildren?: boolean;
}

export interface FileItem {
  id: string;
  name: string;
  path: string;
  type: 'folder' | 'file';
  size: number;
  modified: string;
  extension?: string;
  mediaType?: string;
  permissions?: string;
  owner?: string;
  group?: string;
}

export interface FileDetails extends FileItem {
  created: string;
  accessed: string;
  rawMetadata?: Record<string, any>;
}

export interface VolumeStats {
  volume_id: string;
  date: string;
  total_size: number;
  file_count: number;
  folder_count: number;
  growth_bytes: number;
  growth_files: number;
}

export interface TopFolder {
  path: string;
  name: string;
  size: number;
  file_count: number;
  growth_bytes: number;
  growth_percentage: number;
}

export interface FileTypeComposition {
  extension: string;
  count: number;
  total_size: number;
  percentage: number;
}

// Tree state atoms
export const treeNodesAtom = atom<Record<string, TreeNode[]>>({});
export const expandedNodesAtom = atom<Set<string>>(new Set<string>());
export const treeLoadingAtom = atom<boolean>(false);
export const treeErrorAtom = atom<string | null>(null);

// File list state atoms
export const currentPathAtom = atom<string>('/');
export const filesAtom = atom<FileItem[]>([]);
export const filesLoadingAtom = atom<boolean>(false);
export const filesErrorAtom = atom<string | null>(null);
export const filesTotalAtom = atom<number>(0);
export const filesPageAtom = atom<number>(1);
export const filesPageSizeAtom = atom<number>(50);

// File details state atoms
export const selectedFileAtom = atom<FileItem | null>(null);
export const fileDetailsAtom = atom<FileDetails | null>(null);
export const fileDetailsLoadingAtom = atom<boolean>(false);
export const fileDetailsErrorAtom = atom<string | null>(null);

// Search state atoms
export const searchQueryAtom = atom<string>('');
export const searchFiltersAtom = atom<{
  extension?: string;
  mimeType?: string;
  minSize?: number;
  maxSize?: number;
}>({});

// Volume insights state atoms
export const volumeStatsAtom = atom<VolumeStats[]>([]);
export const volumeStatsLoadingAtom = atom<boolean>(false);
export const volumeStatsErrorAtom = atom<string | null>(null);

export const topFoldersAtom = atom<TopFolder[]>([]);
export const topFoldersLoadingAtom = atom<boolean>(false);
export const topFoldersErrorAtom = atom<string | null>(null);

export const fileCompositionAtom = atom<FileTypeComposition[]>([]);
export const fileCompositionLoadingAtom = atom<boolean>(false);
export const fileCompositionErrorAtom = atom<string | null>(null);

// Current volume atom
export const currentVolumeAtom = atom<string>('');

// Derived atoms
export const currentFilesAtom = atom((get) => {
  const files = get(filesAtom);
  const query = get(searchQueryAtom);
  const filters = get(searchFiltersAtom);

  if (!query && Object.keys(filters).length === 0) {
    return files;
  }

  return files.filter((file) => {
    // Text search
    if (query && !file.name.toLowerCase().includes(query.toLowerCase())) {
      return false;
    }

    // Extension filter
    if (filters.extension && file.extension !== filters.extension) {
      return false;
    }

    // MIME type filter
    if (filters.mimeType && file.mediaType !== filters.mimeType) {
      return false;
    }

    // Size filters
    if (filters.minSize && file.size < filters.minSize) {
      return false;
    }

    if (filters.maxSize && file.size > filters.maxSize) {
      return false;
    }

    return true;
  });
});

export const isDrawerOpenAtom = atom<boolean>(false);
