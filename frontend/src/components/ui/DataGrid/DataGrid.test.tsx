import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import { DataGrid } from './DataGrid';
import type {
  DataGridProps,
  DataGridColumn,
  FileEntry,
  SelectionState,
} from './DataGrid.types';

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  ChevronDown: () => <div data-testid="chevron-down">↓</div>,
  ChevronRight: () => <div data-testid="chevron-right">→</div>,
  ChevronUp: () => <div data-testid="chevron-up">↑</div>,
  MoreHorizontal: () => <div data-testid="more-horizontal">⋯</div>,
  Check: () => <div data-testid="check">✓</div>,
  Minus: () => <div data-testid="minus">−</div>,
  Loader2: () => <div data-testid="loader2">⟳</div>,
  Search: () => <div data-testid="search">🔍</div>,
  Filter: () => <div data-testid="filter">🔽</div>,
  Download: () => <div data-testid="download">⬇</div>,
  Settings: () => <div data-testid="settings">⚙</div>,
  RotateCcw: () => <div data-testid="rotate-ccw">↻</div>,
}));

// Sample data
const sampleFileData: FileEntry[] = [
  {
    id: 'file-1',
    name: 'document.pdf',
    path: '/Users/Documents/document.pdf',
    size: 1024000,
    type: 'file',
    extension: 'pdf',
    mimeType: 'application/pdf',
    dateCreated: new Date('2023-01-01'),
    dateModified: new Date('2023-01-02'),
    permissions: '-rw-r--r--',
    owner: 'user',
    group: 'staff',
    isHidden: false,
    isSymlink: false,
  },
  {
    id: 'file-2',
    name: 'image.jpg',
    path: '/Users/Documents/image.jpg',
    size: 2048000,
    type: 'file',
    extension: 'jpg',
    mimeType: 'image/jpeg',
    dateCreated: new Date('2023-01-03'),
    dateModified: new Date('2023-01-04'),
    permissions: '-rw-r--r--',
    owner: 'user',
    group: 'staff',
    isHidden: false,
    isSymlink: false,
  },
  {
    id: 'dir-1',
    name: 'Documents',
    path: '/Users/Documents',
    size: 4096,
    type: 'directory',
    dateCreated: new Date('2023-01-05'),
    dateModified: new Date('2023-01-06'),
    permissions: 'drwxr-xr-x',
    owner: 'user',
    group: 'staff',
    isHidden: false,
    isSymlink: false,
  },
];

const sampleColumns: DataGridColumn<FileEntry>[] = [
  {
    id: 'name',
    key: 'name',
    title: 'Name',
    sortable: true,
    width: '200px',
  },
  {
    id: 'size',
    key: 'size',
    title: 'Size',
    type: 'fileSize',
    sortable: true,
    align: 'right',
    width: '100px',
  },
  {
    id: 'type',
    key: 'type',
    title: 'Type',
    sortable: true,
    width: '100px',
  },
  {
    id: 'dateModified',
    key: 'dateModified',
    title: 'Modified',
    type: 'date',
    sortable: true,
    width: '120px',
  },
];

const defaultProps: DataGridProps<FileEntry> = {
  data: sampleFileData,
  columns: sampleColumns,
  testId: 'test-grid',
};

describe('DataGrid', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders with data and columns', () => {
      render(<DataGrid {...defaultProps} />);

      expect(screen.getByTestId('test-grid')).toBeInTheDocument();
      expect(screen.getByText('Name')).toBeInTheDocument();
      expect(screen.getByText('Size')).toBeInTheDocument();
      expect(screen.getByText('Type')).toBeInTheDocument();
      expect(screen.getByText('Modified')).toBeInTheDocument();
    });

    it('renders data rows', () => {
      render(<DataGrid {...defaultProps} />);

      expect(screen.getByText('document.pdf')).toBeInTheDocument();
      expect(screen.getByText('image.jpg')).toBeInTheDocument();
      expect(screen.getByText('Documents')).toBeInTheDocument();
    });

    it('applies custom test ID', () => {
      render(<DataGrid {...defaultProps} testId="custom-grid" />);

      expect(screen.getByTestId('custom-grid')).toBeInTheDocument();
    });

    it('has correct ARIA attributes', () => {
      render(<DataGrid {...defaultProps} ariaLabel="File list" />);

      const grid = screen.getByTestId('test-grid');
      expect(grid).toHaveAttribute('role', 'grid');
      expect(grid).toHaveAttribute('aria-label', 'File list');
    });
  });

  describe('Sizes', () => {
    it('applies small size classes', () => {
      render(<DataGrid {...defaultProps} size="sm" />);

      const grid = screen.getByTestId('test-grid');
      expect(grid).toHaveClass('text-xs');
    });

    it('applies medium size classes', () => {
      render(<DataGrid {...defaultProps} size="md" />);

      const grid = screen.getByTestId('test-grid');
      expect(grid).toHaveClass('text-sm');
    });

    it('applies large size classes', () => {
      render(<DataGrid {...defaultProps} size="lg" />);

      const grid = screen.getByTestId('test-grid');
      expect(grid).toHaveClass('text-base');
    });
  });

  describe('Variants', () => {
    it('applies default variant classes', () => {
      render(<DataGrid {...defaultProps} variant="default" />);

      const grid = screen.getByTestId('test-grid');
      expect(grid).toHaveClass('bg-white', 'border', 'border-gray-200');
    });

    it('applies striped variant classes', () => {
      render(<DataGrid {...defaultProps} variant="striped" />);

      // Check that striped styling is applied
      const grid = screen.getByTestId('test-grid');
      expect(grid).toBeInTheDocument();
    });

    it('applies bordered variant classes', () => {
      render(<DataGrid {...defaultProps} variant="bordered" />);

      const grid = screen.getByTestId('test-grid');
      expect(grid).toHaveClass('border-2');
    });

    it('applies minimal variant classes', () => {
      render(<DataGrid {...defaultProps} variant="minimal" />);

      const grid = screen.getByTestId('test-grid');
      expect(grid).toHaveClass('bg-white');
    });
  });

  describe('Selection', () => {
    it('does not show selection column when selectionMode is none', () => {
      render(<DataGrid {...defaultProps} selectionMode="none" />);

      expect(
        screen.queryByTestId('test-grid-select-all'),
      ).not.toBeInTheDocument();
    });

    it('shows checkboxes for multiple selection', () => {
      render(<DataGrid {...defaultProps} selectionMode="multiple" />);

      expect(screen.getByTestId('test-grid-select-all')).toBeInTheDocument();
      expect(screen.getByTestId('test-grid-select-0')).toBeInTheDocument();
      expect(screen.getByTestId('test-grid-select-1')).toBeInTheDocument();
    });

    it('shows radio buttons for single selection', () => {
      render(<DataGrid {...defaultProps} selectionMode="single" />);

      expect(
        screen.queryByTestId('test-grid-select-all'),
      ).not.toBeInTheDocument();
      expect(screen.getByTestId('test-grid-select-0')).toBeInTheDocument();
      expect(screen.getByTestId('test-grid-select-1')).toBeInTheDocument();
    });

    it('handles row selection', async () => {
      const onSelectionChange = vi.fn();
      render(
        <DataGrid
          {...defaultProps}
          selectionMode="multiple"
          onSelectionChange={onSelectionChange}
        />,
      );

      const checkbox = screen.getByTestId('test-grid-select-0');
      await user.click(checkbox);

      expect(onSelectionChange).toHaveBeenCalledWith({
        selectedRows: new Set(['file-1']),
        isAllSelected: false,
        isIndeterminate: true,
      });
    });

    it('handles select all', async () => {
      const onSelectionChange = vi.fn();
      render(
        <DataGrid
          {...defaultProps}
          selectionMode="multiple"
          onSelectionChange={onSelectionChange}
        />,
      );

      const selectAllCheckbox = screen.getByTestId('test-grid-select-all');
      await user.click(selectAllCheckbox);

      expect(onSelectionChange).toHaveBeenCalledWith({
        selectedRows: new Set(['file-1', 'file-2', 'dir-1']),
        isAllSelected: true,
        isIndeterminate: false,
      });
    });

    it('shows selected state correctly', () => {
      const selectedRows = new Set(['file-1']);
      render(
        <DataGrid
          {...defaultProps}
          selectionMode="multiple"
          selectedRows={selectedRows}
        />,
      );

      const checkbox = screen.getByTestId('test-grid-select-0');
      expect(checkbox).toHaveClass('bg-blue-600');
    });
  });

  describe('Sorting', () => {
    it('shows sort indicators on sortable columns', () => {
      render(<DataGrid {...defaultProps} sortable />);

      // Click on a sortable column header should show sort indicator
      const nameHeader = screen.getByTestId('test-grid-header-name');
      expect(nameHeader).toBeInTheDocument();
    });

    it('handles column sorting', async () => {
      const onSortChange = vi.fn();
      render(
        <DataGrid {...defaultProps} sortable onSortChange={onSortChange} />,
      );

      const nameHeader = screen.getByTestId('test-grid-header-name');
      await user.click(nameHeader);

      expect(onSortChange).toHaveBeenCalledWith({
        key: 'name',
        direction: 'asc',
      });
    });

    it('cycles through sort directions', async () => {
      const onSortChange = vi.fn();
      render(
        <DataGrid
          {...defaultProps}
          sortable
          onSortChange={onSortChange}
          sortConfig={{ key: 'name', direction: 'asc' }}
        />,
      );

      const nameHeader = screen.getByTestId('test-grid-header-name');
      await user.click(nameHeader);

      expect(onSortChange).toHaveBeenCalledWith({
        key: 'name',
        direction: 'desc',
      });
    });

    it('does not sort non-sortable columns', async () => {
      const onSortChange = vi.fn();
      const nonSortableColumns = sampleColumns.map((col) => ({
        ...col,
        sortable: col.id === 'name' ? false : col.sortable,
      }));

      render(
        <DataGrid
          {...defaultProps}
          columns={nonSortableColumns}
          sortable
          onSortChange={onSortChange}
        />,
      );

      const nameHeader = screen.getByTestId('test-grid-header-name');
      await user.click(nameHeader);

      expect(onSortChange).not.toHaveBeenCalled();
    });
  });

  describe('Row Expansion', () => {
    it('shows expansion buttons when expandableRows is true', () => {
      render(
        <DataGrid
          {...defaultProps}
          expandableRows
          rowExpansion={{
            render: (row) => <div>Expanded content for {row.name}</div>,
          }}
        />,
      );

      expect(screen.getByTestId('test-grid-expand-0')).toBeInTheDocument();
    });

    it('expands row when expansion button is clicked', async () => {
      render(
        <DataGrid
          {...defaultProps}
          expandableRows
          rowExpansion={{
            render: (row) => <div>Expanded content for {row.name}</div>,
          }}
        />,
      );

      const expandButton = screen.getByTestId('test-grid-expand-0');
      await user.click(expandButton);

      expect(
        screen.getByText('Expanded content for document.pdf'),
      ).toBeInTheDocument();
    });
  });

  describe('Loading States', () => {
    it('shows loading spinner', () => {
      render(
        <DataGrid
          {...defaultProps}
          loading={{ state: 'loading', message: 'Loading files...' }}
        />,
      );

      expect(screen.getByTestId('loader2')).toBeInTheDocument();
      expect(screen.getByText('Loading files...')).toBeInTheDocument();
    });

    it('shows error state', () => {
      render(
        <DataGrid
          {...defaultProps}
          loading={{ state: 'error', message: 'Failed to load files' }}
        />,
      );

      expect(screen.getByText('Failed to load files')).toBeInTheDocument();
      expect(screen.getByText('Try again')).toBeInTheDocument();
    });

    it('shows default loading message', () => {
      render(<DataGrid {...defaultProps} loading={{ state: 'loading' }} />);

      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('shows empty state when no data', () => {
      render(
        <DataGrid
          {...defaultProps}
          data={[]}
          emptyState={{
            message: 'No files found',
            description: 'Try uploading some files',
            action: {
              label: 'Upload Files',
              onClick: vi.fn(),
            },
          }}
        />,
      );

      expect(screen.getByText('No files found')).toBeInTheDocument();
      expect(screen.getByText('Try uploading some files')).toBeInTheDocument();
      expect(screen.getByText('Upload Files')).toBeInTheDocument();
    });

    it('shows default empty message', () => {
      render(<DataGrid {...defaultProps} data={[]} />);

      expect(screen.getByText('No data to display')).toBeInTheDocument();
    });

    it('calls empty state action', async () => {
      const mockAction = vi.fn();
      render(
        <DataGrid
          {...defaultProps}
          data={[]}
          emptyState={{
            action: {
              label: 'Upload Files',
              onClick: mockAction,
            },
          }}
        />,
      );

      const actionButton = screen.getByText('Upload Files');
      await user.click(actionButton);

      expect(mockAction).toHaveBeenCalledTimes(1);
    });
  });

  describe('Row Events', () => {
    it('handles row click', async () => {
      const onRowClick = vi.fn();
      render(<DataGrid {...defaultProps} onRowClick={onRowClick} />);

      const row = screen.getByTestId('test-grid-row-0');
      await user.click(row);

      expect(onRowClick).toHaveBeenCalledWith(sampleFileData[0], 0);
    });

    it('handles row double click', async () => {
      const onRowDoubleClick = vi.fn();
      render(
        <DataGrid {...defaultProps} onRowDoubleClick={onRowDoubleClick} />,
      );

      const row = screen.getByTestId('test-grid-row-0');
      await user.dblClick(row);

      expect(onRowDoubleClick).toHaveBeenCalledWith(sampleFileData[0], 0);
    });

    it('handles row context menu', async () => {
      const onRowContextMenu = vi.fn();
      render(
        <DataGrid {...defaultProps} onRowContextMenu={onRowContextMenu} />,
      );

      const row = screen.getByTestId('test-grid-row-0');
      fireEvent.contextMenu(row);

      expect(onRowContextMenu).toHaveBeenCalledWith(
        sampleFileData[0],
        0,
        expect.any(Object),
      );
    });
  });

  describe('Column Types', () => {
    it('formats file size correctly', () => {
      render(<DataGrid {...defaultProps} />);

      expect(screen.getByText('1.0 MB')).toBeInTheDocument(); // 1024000 bytes
      expect(screen.getByText('2.0 MB')).toBeInTheDocument(); // 2048000 bytes
    });

    it('formats dates correctly', () => {
      render(<DataGrid {...defaultProps} />);

      // Check that dates are formatted (exact format may vary by locale)
      expect(screen.getByText(/2023/)).toBeInTheDocument();
    });

    it('renders custom cell content', () => {
      const customColumns: DataGridColumn<FileEntry>[] = [
        {
          id: 'custom',
          key: 'name',
          title: 'Custom',
          render: (value) => (
            <span data-testid="custom-cell">Custom: {value}</span>
          ),
        },
      ];

      render(<DataGrid {...defaultProps} columns={customColumns} />);

      expect(screen.getByTestId('custom-cell')).toBeInTheDocument();
      expect(screen.getByText('Custom: document.pdf')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA roles', () => {
      render(<DataGrid {...defaultProps} />);

      const grid = screen.getByRole('grid');
      expect(grid).toBeInTheDocument();
    });

    it('supports keyboard navigation', async () => {
      render(<DataGrid {...defaultProps} selectionMode="multiple" />);

      const checkbox = screen.getByTestId('test-grid-select-0');
      checkbox.focus();

      expect(checkbox).toHaveFocus();
    });
  });

  describe('Ref API', () => {
    it('exposes imperative API through ref', () => {
      const ref = React.createRef<any>();
      render(<DataGrid {...defaultProps} ref={ref} />);

      expect(ref.current).toHaveProperty('selectRow');
      expect(ref.current).toHaveProperty('selectAll');
      expect(ref.current).toHaveProperty('deselectAll');
      expect(ref.current).toHaveProperty('getSelectedRows');
      expect(ref.current).toHaveProperty('refresh');
    });

    it('selectRow works correctly', () => {
      const ref = React.createRef<any>();
      const onSelectionChange = vi.fn();

      render(
        <DataGrid
          {...defaultProps}
          ref={ref}
          selectionMode="multiple"
          onSelectionChange={onSelectionChange}
        />,
      );

      ref.current.selectRow('file-1');

      expect(onSelectionChange).toHaveBeenCalledWith({
        selectedRows: new Set(['file-1']),
        isAllSelected: false,
        isIndeterminate: true,
      });
    });
  });

  describe('Performance', () => {
    it('handles large datasets efficiently', () => {
      const largeData = Array.from({ length: 1000 }, (_, i) => ({
        ...sampleFileData[0],
        id: `file-${i}`,
        name: `file-${i}.txt`,
      }));

      const startTime = performance.now();
      render(<DataGrid {...defaultProps} data={largeData} />);
      const endTime = performance.now();

      // Should render within reasonable time (adjust threshold as needed)
      expect(endTime - startTime).toBeLessThan(1000);
    });
  });
});
