/**
 * VirtualizedFileTable Component
 *
 * High-performance file table using @tanstack/react-virtual for rendering
 * large lists of files (100k+) efficiently.
 *
 * Features:
 * - Virtual scrolling for performance
 * - Column sorting
 * - Multi-select (Shift+Click, Ctrl+Click)
 * - Keyboard navigation
 * - Context menu support
 * - Row actions
 */

import React, { useMemo, useState, useCallback, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  FileIcon,
  FolderIcon,
  ChevronDown,
  ChevronUp,
  MoreVertical,
  Download,
  Trash2,
  Info,
} from 'lucide-react';
import { formatBytes } from '@/utils/formatters';
import { formatDate } from '@/utils/format';

export interface FileItem {
  id?: number;
  name: string;
  path: string;
  size?: number;
  is_directory: boolean;
  modified_time?: string;
  extension?: string;
  media_type?: string;
}

export interface VirtualizedFileTableProps {
  files: FileItem[];
  selectedFiles?: Set<string>;
  onFileSelect?: (path: string, isMulti?: boolean) => void;
  onFileClick?: (file: FileItem) => void;
  onFileDoubleClick?: (file: FileItem) => void;
  onDeleteFiles?: (paths: string[]) => void;
  onDownloadFiles?: (paths: string[]) => void;
  className?: string;
}

type SortField = 'name' | 'size' | 'modified' | 'type';
type SortDirection = 'asc' | 'desc';

export function VirtualizedFileTable({
  files,
  selectedFiles = new Set(),
  onFileSelect,
  onFileClick,
  onFileDoubleClick,
  onDeleteFiles,
  onDownloadFiles,
  className = '',
}: VirtualizedFileTableProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    file: FileItem;
  } | null>(null);
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number>(-1);

  // Sort files
  const sortedFiles = useMemo(() => {
    const sorted = [...files];
    sorted.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'size':
          aValue = a.size || 0;
          bValue = b.size || 0;
          break;
        case 'modified':
          aValue = a.modified_time || '';
          bValue = b.modified_time || '';
          break;
        case 'type':
          aValue = a.is_directory ? 'folder' : (a.extension || '');
          bValue = b.is_directory ? 'folder' : (b.extension || '');
          break;
        default:
          aValue = a.name;
          bValue = b.name;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [files, sortField, sortDirection]);

  // Virtual scrolling
  const rowVirtualizer = useVirtualizer({
    count: sortedFiles.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40, // Row height in pixels
    overscan: 10, // Render extra rows for smooth scrolling
  });

  const handleSort = useCallback((field: SortField) => {
    setSortField((prev) => {
      if (prev === field) {
        setSortDirection((dir) => (dir === 'asc' ? 'desc' : 'asc'));
        return field;
      }
      setSortDirection('asc');
      return field;
    });
  }, []);

  const handleRowClick = useCallback(
    (file: FileItem, index: number, event: React.MouseEvent) => {
      const isCtrlClick = event.ctrlKey || event.metaKey;
      const isShiftClick = event.shiftKey;

      if (isShiftClick && lastSelectedIndex >= 0) {
        // Shift+Click: Select range
        const start = Math.min(lastSelectedIndex, index);
        const end = Math.max(lastSelectedIndex, index);
        for (let i = start; i <= end; i++) {
          onFileSelect?.(sortedFiles[i].path, true);
        }
      } else if (isCtrlClick) {
        // Ctrl+Click: Toggle selection
        onFileSelect?.(file.path, true);
      } else {
        // Regular click
        onFileSelect?.(file.path, false);
        onFileClick?.(file);
      }

      setLastSelectedIndex(index);
    },
    [lastSelectedIndex, onFileSelect, onFileClick, sortedFiles],
  );

  const handleRowDoubleClick = useCallback(
    (file: FileItem) => {
      onFileDoubleClick?.(file);
    },
    [onFileDoubleClick],
  );

  const handleContextMenu = useCallback(
    (event: React.MouseEvent, file: FileItem) => {
      event.preventDefault();
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        file,
      });
    },
    [],
  );

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleDelete = useCallback(
    (file: FileItem) => {
      onDeleteFiles?.([file.path]);
      handleCloseContextMenu();
    },
    [onDeleteFiles, handleCloseContextMenu],
  );

  const handleDownload = useCallback(
    (file: FileItem) => {
      onDownloadFiles?.([file.path]);
      handleCloseContextMenu();
    },
    [onDownloadFiles, handleCloseContextMenu],
  );

  // Close context menu on outside click
  React.useEffect(() => {
    if (contextMenu) {
      const handleClick = () => handleCloseContextMenu();
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [contextMenu, handleCloseContextMenu]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? (
      <ChevronUp className="h-4 w-4" />
    ) : (
      <ChevronDown className="h-4 w-4" />
    );
  };

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Table Header */}
      <div className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-12 gap-4 px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
          <button
            className="col-span-5 flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-200"
            onClick={() => handleSort('name')}
          >
            Name
            <SortIcon field="name" />
          </button>
          <button
            className="col-span-2 flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-200"
            onClick={() => handleSort('size')}
          >
            Size
            <SortIcon field="size" />
          </button>
          <button
            className="col-span-3 flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-200"
            onClick={() => handleSort('modified')}
          >
            Modified
            <SortIcon field="modified" />
          </button>
          <button
            className="col-span-2 flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-200"
            onClick={() => handleSort('type')}
          >
            Type
            <SortIcon field="type" />
          </button>
        </div>
      </div>

      {/* Virtualized Table Body */}
      <div
        ref={parentRef}
        className="flex-1 overflow-auto"
        style={{ contain: 'strict' }}
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const file = sortedFiles[virtualRow.index];
            const isSelected = selectedFiles.has(file.path);

            return (
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                ref={rowVirtualizer.measureElement}
                className={`
                  absolute top-0 left-0 w-full grid grid-cols-12 gap-4 px-4 py-2
                  border-b border-gray-100 dark:border-gray-800
                  hover:bg-gray-50 dark:hover:bg-gray-800
                  cursor-pointer transition-colors
                  ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''}
                `}
                style={{
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                onClick={(e) => handleRowClick(file, virtualRow.index, e)}
                onDoubleClick={() => handleRowDoubleClick(file)}
                onContextMenu={(e) => handleContextMenu(e, file)}
              >
                {/* Name */}
                <div className="col-span-5 flex items-center gap-2 min-w-0">
                  {file.is_directory ? (
                    <FolderIcon className="h-4 w-4 text-blue-500 flex-shrink-0" />
                  ) : (
                    <FileIcon className="h-4 w-4 text-gray-600 dark:text-gray-400 flex-shrink-0" />
                  )}
                  <span className="text-sm text-gray-900 dark:text-gray-100 truncate">
                    {file.name}
                  </span>
                </div>

                {/* Size */}
                <div className="col-span-2 flex items-center text-sm text-gray-600 dark:text-gray-400">
                  {file.is_directory ? '-' : formatBytes(file.size || 0)}
                </div>

                {/* Modified */}
                <div className="col-span-3 flex items-center text-sm text-gray-600 dark:text-gray-400">
                  {formatDate(file.modified_time)}
                </div>

                {/* Type */}
                <div className="col-span-2 flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
                  <span>{file.is_directory ? 'Folder' : file.extension || 'File'}</span>
                  <button
                    className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleContextMenu(e, file);
                    }}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed bg-white dark:bg-gray-800 shadow-lg rounded-md border border-gray-200 dark:border-gray-700 py-1 z-50"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
          }}
        >
          <button
            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
            onClick={() => handleDownload(contextMenu.file)}
          >
            <Download className="h-4 w-4" />
            Download
          </button>
          <button
            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
            onClick={() => {
              onFileClick?.(contextMenu.file);
              handleCloseContextMenu();
            }}
          >
            <Info className="h-4 w-4" />
            Details
          </button>
          <button
            className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
            onClick={() => handleDelete(contextMenu.file)}
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </button>
        </div>
      )}

      {/* Empty State */}
      {files.length === 0 && (
        <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400">
          <div className="text-center">
            <FileIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No files to display</p>
          </div>
        </div>
      )}
    </div>
  );
}
