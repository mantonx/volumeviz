import type { ReactNode } from 'react';
import type {
  ExplorerItem,
  ExplorerFilter,
  ExplorerSortBy,
  ExplorerSortOrder,
  BreadcrumbItem,
} from '../components/explorer/VolumeExplorerPanel/VolumeExplorerPanel.types';

/**
 * Explorer utility functions interface
 */
export interface ExplorerUtils {
  /** Format file size */
  formatFileSize(bytes: number): string;
  /** Format date */
  formatDate(date: Date): string;
  /** Get file icon */
  getFileIcon(item: ExplorerItem): ReactNode;
  /** Get file type label */
  getFileType(item: ExplorerItem): string;
  /** Check if item matches filter */
  matchesFilter(item: ExplorerItem, filter: ExplorerFilter): boolean;
  /** Sort items */
  sortItems(
    items: ExplorerItem[],
    sortBy: ExplorerSortBy,
    sortOrder: ExplorerSortOrder,
  ): ExplorerItem[];
  /** Group items by type */
  groupItems(items: ExplorerItem[]): {
    folders: ExplorerItem[];
    files: ExplorerItem[];
  };
  /** Build breadcrumb from path */
  buildBreadcrumb(path: string): BreadcrumbItem[];
  /** Check if preview is supported */
  isPreviewSupported(item: ExplorerItem): boolean;
  /** Get preview component */
  getPreviewComponent(item: ExplorerItem): ReactNode;
}

export const explorerUtils: ExplorerUtils = {
  formatFileSize: (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  },

  formatDate: (date: Date): string => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      const hours = Math.floor(diff / (1000 * 60 * 60));
      if (hours === 0) {
        const minutes = Math.floor(diff / (1000 * 60));
        if (minutes === 0) return 'Just now';
        return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
      }
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return `${days} days ago`;
    } else if (days < 30) {
      const weeks = Math.floor(days / 7);
      return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
    } else if (days < 365) {
      const months = Math.floor(days / 30);
      return `${months} month${months > 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleDateString();
    }
  },

  getFileIcon: (_item: ExplorerItem): ReactNode => {
    // Implementation would return appropriate icon based on file type
    return null;
  },

  getFileType: (item: ExplorerItem): string => {
    if (item.type === 'folder') return 'Folder';
    const ext = item.extension?.toLowerCase();
    const typeMap: Record<string, string> = {
      jpg: 'Image',
      jpeg: 'Image',
      png: 'Image',
      gif: 'Image',
      svg: 'Image',
      pdf: 'PDF Document',
      doc: 'Word Document',
      docx: 'Word Document',
      xls: 'Spreadsheet',
      xlsx: 'Spreadsheet',
      ppt: 'Presentation',
      pptx: 'Presentation',
      txt: 'Text File',
      md: 'Markdown',
      js: 'JavaScript',
      ts: 'TypeScript',
      json: 'JSON',
      xml: 'XML',
      html: 'HTML',
      css: 'CSS',
      mp3: 'Audio',
      mp4: 'Video',
      avi: 'Video',
      mov: 'Video',
      zip: 'Archive',
      rar: 'Archive',
      tar: 'Archive',
      gz: 'Archive',
    };
    return typeMap[ext || ''] || 'File';
  },

  matchesFilter: (item: ExplorerItem, filter: ExplorerFilter): boolean => {
    if (filter.query) {
      const query = filter.query.toLowerCase();
      if (!item.name.toLowerCase().includes(query)) return false;
    }
    if (filter.types?.length && !filter.types.includes(item.type)) return false;
    if (filter.minSize && item.size && item.size < filter.minSize) return false;
    if (filter.maxSize && item.size && item.size > filter.maxSize) return false;
    if (!filter.showHidden && item.isHidden) return false;
    if (!filter.showSystem && item.isSystem) return false;
    if (filter.extensions?.length && item.extension) {
      if (!filter.extensions.includes(item.extension)) return false;
    }
    if (filter.starred !== undefined && item.starred !== filter.starred)
      return false;
    return true;
  },

  sortItems: (
    items: ExplorerItem[],
    sortBy: ExplorerSortBy,
    sortOrder: ExplorerSortOrder,
  ): ExplorerItem[] => {
    const sorted = [...items].sort((a, b) => {
      // Folders first
      if (a.type !== b.type) {
        return a.type === 'folder' ? -1 : 1;
      }

      let comparison = 0;
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'size':
          comparison = (a.size || 0) - (b.size || 0);
          break;
        case 'type':
          comparison = (a.extension || '').localeCompare(b.extension || '');
          break;
        case 'modified':
          comparison =
            (a.modifiedAt?.getTime() || 0) - (b.modifiedAt?.getTime() || 0);
          break;
        case 'created':
          comparison =
            (a.createdAt?.getTime() || 0) - (b.createdAt?.getTime() || 0);
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });
    return sorted;
  },

  groupItems: (
    items: ExplorerItem[],
  ): { folders: ExplorerItem[]; files: ExplorerItem[] } => {
    const folders = items.filter((item) => item.type === 'folder');
    const files = items.filter((item) => item.type === 'file');
    return { folders, files };
  },

  buildBreadcrumb: (path: string): BreadcrumbItem[] => {
    const parts = path.split('/').filter(Boolean);
    const breadcrumb: BreadcrumbItem[] = [
      { id: 'root', label: 'Root', path: '/' },
    ];

    let currentPath = '';
    parts.forEach((part, index) => {
      currentPath += `/${part}`;
      breadcrumb.push({
        id: `path-${index}`,
        label: part,
        path: currentPath,
      });
    });

    return breadcrumb;
  },

  isPreviewSupported: (item: ExplorerItem): boolean => {
    if (item.type === 'folder') return false;
    const supportedExtensions = [
      'jpg',
      'jpeg',
      'png',
      'gif',
      'svg',
      'pdf',
      'txt',
      'md',
      'json',
      'xml',
      'html',
      'css',
      'js',
      'ts',
      'mp3',
      'mp4',
      'webm',
    ];
    return supportedExtensions.includes(item.extension?.toLowerCase() || '');
  },

  getPreviewComponent: (_item: ExplorerItem): ReactNode => {
    // Implementation would return appropriate preview component
    return null;
  },
};
