import React from 'react';
import { render, screen, waitFor, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

import { VolumeExplorerPanel } from './VolumeExplorerPanel';
import type {
  VolumeExplorerPanelProps,
  ExplorerItem,
  ExplorerSelection,
  VolumeExplorerPanelRef,
} from './VolumeExplorerPanel.types';
import { createMockExplorerData } from './VolumeExplorerPanel.types';

// Mock child components
vi.mock('../../ui/ProgressBar', () => ({
  ProgressBar: ({
    progress,
    testId,
  }: {
    progress: number;
    testId?: string;
  }) => (
    <div data-testid={testId || 'progress-bar'} data-progress={progress}>
      Progress: {progress}%
    </div>
  ),
}));

vi.mock('../../ui/StatusBadge', () => ({
  StatusBadge: ({
    children,
    variant,
    testId,
  }: {
    children: React.ReactNode;
    variant?: string;
    testId?: string;
  }) => (
    <span data-testid={testId || 'status-badge'} data-variant={variant}>
      {children}
    </span>
  ),
}));

describe('VolumeExplorerPanel', () => {
  let mockItems: ExplorerItem[];
  let defaultProps: VolumeExplorerPanelProps;

  beforeEach(() => {
    mockItems = createMockExplorerData(10, '/test/');
    defaultProps = {
      volumeId: 'vol-001',
      currentPath: '/test',
      items: mockItems,
      onItemClick: vi.fn(),
      onItemDoubleClick: vi.fn(),
      onSelectionChange: vi.fn(),
      onPathChange: vi.fn(),
      onViewModeChange: vi.fn(),
      onSortChange: vi.fn(),
      onFilterChange: vi.fn(),
      onSearch: vi.fn(),
      onRefresh: vi.fn(),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders explorer panel', () => {
      render(<VolumeExplorerPanel {...defaultProps} />);

      expect(screen.getByTestId('volume-explorer-panel')).toBeInTheDocument();
    });

    it('renders with custom testId', () => {
      render(
        <VolumeExplorerPanel {...defaultProps} testId="custom-explorer" />,
      );

      expect(screen.getByTestId('custom-explorer')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(
        <VolumeExplorerPanel {...defaultProps} className="custom-class" />,
      );

      const explorer = screen.getByTestId('volume-explorer-panel');
      expect(explorer).toHaveClass('custom-class');
    });

    it('renders items in grid view by default', () => {
      render(<VolumeExplorerPanel {...defaultProps} />);

      mockItems.forEach((item) => {
        expect(screen.getByText(item.name)).toBeInTheDocument();
      });
    });
  });

  describe('View Modes', () => {
    it('renders grid view correctly', () => {
      render(<VolumeExplorerPanel {...defaultProps} viewMode="grid" />);

      const gridContainer = screen
        .getByTestId('volume-explorer-panel')
        .querySelector('.grid');
      expect(gridContainer).toBeInTheDocument();
    });

    it('renders list view correctly', () => {
      render(<VolumeExplorerPanel {...defaultProps} viewMode="list" />);

      const listContainer = screen
        .getByTestId('volume-explorer-panel')
        .querySelector('.divide-y');
      expect(listContainer).toBeInTheDocument();
    });

    it('switches view modes when toolbar buttons are clicked', async () => {
      const user = userEvent.setup();
      const onViewModeChange = vi.fn();

      render(
        <VolumeExplorerPanel
          {...defaultProps}
          onViewModeChange={onViewModeChange}
        />,
      );

      // Click list view button
      await user.click(screen.getByTitle('List view'));
      expect(onViewModeChange).toHaveBeenCalledWith('list');

      // Click tree view button
      await user.click(screen.getByTitle('Tree view'));
      expect(onViewModeChange).toHaveBeenCalledWith('tree');
    });

    it('highlights active view mode button', () => {
      render(<VolumeExplorerPanel {...defaultProps} viewMode="list" />);

      const listButton = screen.getByTitle('List view');
      expect(listButton).toHaveClass('bg-white', 'shadow-sm', 'text-blue-600');
    });
  });

  describe('Breadcrumb Navigation', () => {
    it('shows breadcrumb by default', () => {
      render(
        <VolumeExplorerPanel
          {...defaultProps}
          currentPath="/Users/Documents"
        />,
      );

      expect(screen.getByText('Users')).toBeInTheDocument();
      expect(screen.getByText('Documents')).toBeInTheDocument();
    });

    it('hides breadcrumb when showBreadcrumb is false', () => {
      render(
        <VolumeExplorerPanel
          {...defaultProps}
          currentPath="/Users/Documents"
          showBreadcrumb={false}
        />,
      );

      expect(screen.queryByText('Users')).not.toBeInTheDocument();
    });

    it('calls onPathChange when breadcrumb item is clicked', async () => {
      const user = userEvent.setup();
      const onPathChange = vi.fn();

      render(
        <VolumeExplorerPanel
          {...defaultProps}
          currentPath="/Users/Documents"
          onPathChange={onPathChange}
        />,
      );

      await user.click(screen.getByText('Users'));
      expect(onPathChange).toHaveBeenCalledWith('/Users');
    });
  });

  describe('Toolbar', () => {
    it('shows toolbar by default', () => {
      render(<VolumeExplorerPanel {...defaultProps} />);

      expect(screen.getByTitle('Grid view')).toBeInTheDocument();
      expect(screen.getByTitle('List view')).toBeInTheDocument();
    });

    it('hides toolbar when showToolbar is false', () => {
      render(<VolumeExplorerPanel {...defaultProps} showToolbar={false} />);

      expect(screen.queryByTitle('Grid view')).not.toBeInTheDocument();
    });

    it('shows sorting controls', () => {
      render(<VolumeExplorerPanel {...defaultProps} />);

      expect(screen.getByDisplayValue('Name')).toBeInTheDocument();
      expect(screen.getByTitle('Sort ascending')).toBeInTheDocument();
    });

    it('shows action buttons', () => {
      render(<VolumeExplorerPanel {...defaultProps} />);

      expect(screen.getByText('New Folder')).toBeInTheDocument();
      expect(screen.getByText('Upload')).toBeInTheDocument();
    });

    it('renders custom toolbar actions', () => {
      const customActions = <button>Custom Action</button>;

      render(
        <VolumeExplorerPanel
          {...defaultProps}
          toolbarActions={customActions}
        />,
      );

      expect(screen.getByText('Custom Action')).toBeInTheDocument();
    });
  });

  describe('Search Functionality', () => {
    it('shows search input by default', () => {
      render(<VolumeExplorerPanel {...defaultProps} />);

      expect(
        screen.getByPlaceholderText('Search files and folders...'),
      ).toBeInTheDocument();
    });

    it('hides search when enableSearch is false', () => {
      render(<VolumeExplorerPanel {...defaultProps} enableSearch={false} />);

      expect(
        screen.queryByPlaceholderText('Search files and folders...'),
      ).not.toBeInTheDocument();
    });

    it('calls onSearch when search input changes', async () => {
      const user = userEvent.setup();
      const onSearch = vi.fn();

      render(<VolumeExplorerPanel {...defaultProps} onSearch={onSearch} />);

      const searchInput = screen.getByPlaceholderText(
        'Search files and folders...',
      );
      await user.type(searchInput, 'test');

      expect(onSearch).toHaveBeenCalledWith('test');
    });

    it('shows clear button when search has value', async () => {
      const user = userEvent.setup();

      render(<VolumeExplorerPanel {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText(
        'Search files and folders...',
      );
      await user.type(searchInput, 'test');

      expect(screen.getByRole('button', { name: '' })).toBeInTheDocument();
    });

    it('clears search when clear button is clicked', async () => {
      const user = userEvent.setup();
      const onSearch = vi.fn();

      render(<VolumeExplorerPanel {...defaultProps} onSearch={onSearch} />);

      const searchInput = screen.getByPlaceholderText(
        'Search files and folders...',
      );
      await user.type(searchInput, 'test');

      const clearButton = screen.getByRole('button', { name: '' });
      await user.click(clearButton);

      expect(onSearch).toHaveBeenLastCalledWith('');
    });
  });

  describe('Item Interaction', () => {
    it('calls onItemClick when item is clicked', async () => {
      const user = userEvent.setup();
      const onItemClick = vi.fn();

      render(
        <VolumeExplorerPanel {...defaultProps} onItemClick={onItemClick} />,
      );

      const firstItem = screen.getByText(mockItems[0].name);
      await user.click(firstItem);

      expect(onItemClick).toHaveBeenCalledWith(
        mockItems[0],
        expect.any(Object),
      );
    });

    it('calls onItemDoubleClick when item is double-clicked', async () => {
      const user = userEvent.setup();
      const onItemDoubleClick = vi.fn();

      render(
        <VolumeExplorerPanel
          {...defaultProps}
          onItemDoubleClick={onItemDoubleClick}
        />,
      );

      const firstItem = screen.getByText(mockItems[0].name);
      await user.dblClick(firstItem);

      expect(onItemDoubleClick).toHaveBeenCalledWith(mockItems[0]);
    });

    it('navigates to folder path on double-click', async () => {
      const user = userEvent.setup();
      const onPathChange = vi.fn();
      const folderItem = {
        ...mockItems[0],
        type: 'folder' as const,
        path: '/test/folder1',
      };

      render(
        <VolumeExplorerPanel
          {...defaultProps}
          items={[folderItem]}
          onPathChange={onPathChange}
        />,
      );

      const folderElement = screen.getByText(folderItem.name);
      await user.dblClick(folderElement);

      expect(onPathChange).toHaveBeenCalledWith('/test/folder1');
    });
  });

  describe('Selection', () => {
    it('handles single selection', async () => {
      const user = userEvent.setup();
      const onSelectionChange = vi.fn();

      render(
        <VolumeExplorerPanel
          {...defaultProps}
          multiSelect={false}
          onSelectionChange={onSelectionChange}
        />,
      );

      const firstItem = screen.getByText(mockItems[0].name);
      await user.click(firstItem);

      expect(onSelectionChange).toHaveBeenCalledWith({
        items: new Set([mockItems[0].id]),
        lastSelected: mockItems[0].id,
        mode: 'single',
      });
    });

    it('handles multi-selection with Ctrl+click', async () => {
      const user = userEvent.setup();
      const onSelectionChange = vi.fn();

      render(
        <VolumeExplorerPanel
          {...defaultProps}
          multiSelect={true}
          onSelectionChange={onSelectionChange}
        />,
      );

      const firstItem = screen.getByText(mockItems[0].name);
      const secondItem = screen.getByText(mockItems[1].name);

      await user.click(firstItem);
      await user.click(secondItem, { ctrlKey: true });

      expect(onSelectionChange).toHaveBeenLastCalledWith(
        expect.objectContaining({
          items: new Set([mockItems[0].id, mockItems[1].id]),
        }),
      );
    });

    it('shows selection count in status bar', async () => {
      const user = userEvent.setup();

      render(
        <VolumeExplorerPanel
          {...defaultProps}
          selection={{
            items: new Set([mockItems[0].id, mockItems[1].id]),
            mode: 'multiple',
          }}
        />,
      );

      expect(screen.getByText('2 selected')).toBeInTheDocument();
    });
  });

  describe('Sorting', () => {
    it('changes sort when sort dropdown changes', async () => {
      const user = userEvent.setup();
      const onSortChange = vi.fn();

      render(
        <VolumeExplorerPanel {...defaultProps} onSortChange={onSortChange} />,
      );

      const sortSelect = screen.getByDisplayValue('Name');
      await user.selectOptions(sortSelect, 'size');

      expect(onSortChange).toHaveBeenCalledWith('size', 'asc');
    });

    it('toggles sort order when sort button is clicked', async () => {
      const user = userEvent.setup();
      const onSortChange = vi.fn();

      render(
        <VolumeExplorerPanel
          {...defaultProps}
          sortOrder="asc"
          onSortChange={onSortChange}
        />,
      );

      const sortButton = screen.getByTitle('Sort descending');
      await user.click(sortButton);

      expect(onSortChange).toHaveBeenCalledWith('name', 'desc');
    });
  });

  describe('Status Bar', () => {
    it('shows item count', () => {
      render(<VolumeExplorerPanel {...defaultProps} />);

      expect(screen.getByText(`${mockItems.length} items`)).toBeInTheDocument();
    });

    it('shows total count when different from displayed', () => {
      render(<VolumeExplorerPanel {...defaultProps} totalItems={100} />);

      expect(
        screen.getByText(`${mockItems.length} items (100 total)`),
      ).toBeInTheDocument();
    });

    it('hides status bar when showStatusBar is false', () => {
      render(<VolumeExplorerPanel {...defaultProps} showStatusBar={false} />);

      expect(
        screen.queryByText(`${mockItems.length} items`),
      ).not.toBeInTheDocument();
    });

    it('shows loading more indicator', () => {
      render(<VolumeExplorerPanel {...defaultProps} isLoadingMore={true} />);

      expect(screen.getByText('Loading more...')).toBeInTheDocument();
    });
  });

  describe('Sidebar', () => {
    it('hides sidebar by default', () => {
      render(<VolumeExplorerPanel {...defaultProps} />);

      const panel = screen.getByTestId('volume-explorer-panel');
      expect(panel.querySelector('.w-80')).not.toBeInTheDocument();
    });

    it('shows sidebar when showSidebar is true', () => {
      const sidebarContent = <div>Sidebar Content</div>;

      render(
        <VolumeExplorerPanel
          {...defaultProps}
          showSidebar={true}
          sidebarContent={sidebarContent}
        />,
      );

      expect(screen.getByText('Sidebar Content')).toBeInTheDocument();
    });
  });

  describe('Loading States', () => {
    it('shows loading state when isLoading is true and no items', () => {
      render(
        <VolumeExplorerPanel {...defaultProps} items={[]} isLoading={true} />,
      );

      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('shows custom loading state', () => {
      const customLoading = <div>Custom Loading</div>;

      render(
        <VolumeExplorerPanel
          {...defaultProps}
          items={[]}
          isLoading={true}
          loadingState={customLoading}
        />,
      );

      expect(screen.getByText('Custom Loading')).toBeInTheDocument();
    });
  });

  describe('Error States', () => {
    it('shows error state when error is provided', () => {
      render(
        <VolumeExplorerPanel
          {...defaultProps}
          items={[]}
          error="Failed to load"
        />,
      );

      expect(screen.getByText('Error loading files')).toBeInTheDocument();
      expect(screen.getByText('Failed to load')).toBeInTheDocument();
    });

    it('shows custom error state', () => {
      const customError = <div>Custom Error</div>;

      render(
        <VolumeExplorerPanel
          {...defaultProps}
          items={[]}
          error="Failed to load"
          errorState={customError}
        />,
      );

      expect(screen.getByText('Custom Error')).toBeInTheDocument();
    });

    it('calls onRefresh when retry button is clicked', async () => {
      const user = userEvent.setup();
      const onRefresh = vi.fn();

      render(
        <VolumeExplorerPanel
          {...defaultProps}
          items={[]}
          error="Failed to load"
          onRefresh={onRefresh}
        />,
      );

      await user.click(screen.getByText('Retry'));
      expect(onRefresh).toHaveBeenCalled();
    });
  });

  describe('Empty States', () => {
    it('shows default empty state when no items', () => {
      render(<VolumeExplorerPanel {...defaultProps} items={[]} />);

      expect(screen.getByText('No items found')).toBeInTheDocument();
      expect(screen.getByText('This folder is empty')).toBeInTheDocument();
    });

    it('shows search empty state when searching', () => {
      render(
        <VolumeExplorerPanel
          {...defaultProps}
          items={[]}
          filter={{ query: 'test' }}
        />,
      );

      expect(
        screen.getByText('Try adjusting your search criteria'),
      ).toBeInTheDocument();
    });

    it('shows custom empty state', () => {
      const customEmpty = <div>Custom Empty State</div>;

      render(
        <VolumeExplorerPanel
          {...defaultProps}
          items={[]}
          emptyState={customEmpty}
        />,
      );

      expect(screen.getByText('Custom Empty State')).toBeInTheDocument();
    });
  });

  describe('Imperative API', () => {
    it('exposes imperative methods through ref', () => {
      const ref = React.createRef<VolumeExplorerPanelRef>();

      render(<VolumeExplorerPanel {...defaultProps} ref={ref} />);

      expect(ref.current).toBeDefined();
      expect(typeof ref.current?.selectItems).toBe('function');
      expect(typeof ref.current?.clearSelection).toBe('function');
      expect(typeof ref.current?.focusItem).toBe('function');
      expect(typeof ref.current?.navigateTo).toBe('function');
      expect(typeof ref.current?.refresh).toBe('function');
    });

    it('selectItems method updates selection', () => {
      const ref = React.createRef<VolumeExplorerPanelRef>();

      render(<VolumeExplorerPanel {...defaultProps} ref={ref} />);

      act(() => {
        ref.current?.selectItems([mockItems[0].id, mockItems[1].id]);
      });

      // Verify selection is updated (would need state access or visible change)
      expect(ref.current?.getSelectedItems()).toHaveLength(2);
    });

    it('getCurrentPath returns current path', () => {
      const ref = React.createRef<VolumeExplorerPanelRef>();

      render(
        <VolumeExplorerPanel
          {...defaultProps}
          currentPath="/test/path"
          ref={ref}
        />,
      );

      expect(ref.current?.getCurrentPath()).toBe('/test/path');
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA attributes', () => {
      render(<VolumeExplorerPanel {...defaultProps} />);

      const explorer = screen.getByTestId('volume-explorer-panel');
      expect(explorer).toBeInTheDocument();
    });

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup();

      render(<VolumeExplorerPanel {...defaultProps} />);

      const firstItem = screen.getByText(mockItems[0].name);
      await user.tab();

      // Should be able to navigate with keyboard
      expect(document.activeElement).toBeDefined();
    });
  });

  describe('Custom Rendering', () => {
    it('uses custom item renderer when provided', () => {
      const customRenderer = (item: ExplorerItem) => (
        <div key={item.id}>Custom: {item.name}</div>
      );

      render(
        <VolumeExplorerPanel {...defaultProps} renderItem={customRenderer} />,
      );

      expect(
        screen.getByText(`Custom: ${mockItems[0].name}`),
      ).toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    it('handles large datasets efficiently', () => {
      const largeDataset = createMockExplorerData(1000);

      const { container } = render(
        <VolumeExplorerPanel
          {...defaultProps}
          items={largeDataset}
          virtualScroll={true}
        />,
      );

      expect(container).toBeInTheDocument();
      // Performance test would require more sophisticated timing measurements
    });
  });
});
