import { atom } from 'jotai';
import type { FileItem, TreeNode } from './explorer.types';

// Current volume atom
export const currentVolumeAtom = atom<string | null>(null);

// Current path atom
export const currentPathAtom = atom<string>('/');

// Explorer files atom
export const explorerFilesAtom = atom<FileItem[]>([]);

// Explorer tree atom
export const explorerTreeAtom = atom<TreeNode[]>([]);

// Explorer loading state
export const explorerLoadingAtom = atom<boolean>(false);

// Selected files atom
export const selectedFilesAtom = atom<string[]>([]);