/**
 * API Data State Management
 *
 * State management for API data using Jotai atoms for:
 * - Explorer tree state
 * - File metadata cache
 * - Search results
 * - Loading states
 * - Error handling
 */

import { atom } from 'jotai';

// Explorer state atoms for API
export const currentPathAtom = atom<string>('/');
export const selectedFileAtom = atom<any | null>(null);
export const searchQueryAtom = atom<string>('');
export const explorerLoadingAtom = atom<boolean>(false);

// File metadata cache atom for API
export const fileMetadataCacheAtom = atom<Record<string, any>>({});

// Tree state atoms for API
export const expandedNodesAtom = atom<Set<string>>(new Set(['/']));
export const treeDataAtom = atom<any | null>(null);

// Loading states for API
export const treeLoadingAtom = atom<boolean>(false);
export const filesLoadingAtom = atom<boolean>(false);

// Error states for API
export const explorerErrorAtom = atom<string | null>(null);

// Derived atoms for computed values
export const breadcrumbsAtom = atom((get) => {
  const currentPath = get(currentPathAtom);
  const parts = currentPath.split('/').filter(Boolean);
  const crumbs = [{ path: '/', name: 'Home' }];

  let buildPath = '';
  for (const part of parts) {
    buildPath += `/${part}`;
    crumbs.push({ path: buildPath, name: part });
  }

  return crumbs;
});

// Store API data state management implemented
export const apiDataStateAtom = atom({
  explorer: {
    currentPath: '/',
    selectedFile: null,
    loading: false,
    error: null,
  },
  files: {
    data: [],
    loading: false,
    error: null,
  },
  metadata: {
    cache: {},
    loading: false,
    error: null,
  },
});
