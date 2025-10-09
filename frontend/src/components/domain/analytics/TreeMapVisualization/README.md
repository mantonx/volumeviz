# TreeMap Visualization Component

A WinDirStat-style treemap visualization for VolumeViz storage analytics platform. This component provides an intuitive visual representation of file and folder sizes using proportional rectangles.

## Features

### Core Functionality
- **Proportional Sizing**: Rectangle sizes are proportional to file/folder sizes
- **Hierarchical Display**: Nested rectangles represent directory structure
- **Interactive Drill-down**: Click on folders to navigate deeper
- **Breadcrumb Navigation**: Easy navigation back up the hierarchy
- **Color Schemes**: Three different color coding options:
  - File Type: Color by file category (images, videos, documents, etc.)
  - Age: Color by file modification date (gradient from new to old)
  - Size: Color by relative size (heat map)

### Interactivity
- **Hover Tooltips**: Detailed information on hover
- **Click Navigation**: Click folders to drill down
- **Zoom Controls**: Back button and Reset to root
- **Color Picker**: Toggle between color schemes
- **Responsive**: Adapts to container width

### Performance
- **Efficient Rendering**: Uses Recharts treemap algorithm
- **Large Dataset Support**: Handles 10,000+ files smoothly
- **Memoization**: Prevents unnecessary re-renders
- **Smart Aggregation**: Pre-calculates folder sizes

## Usage

### Basic Example

```tsx
import { TreeMapVisualization } from '@/components/domain/analytics/TreeMapVisualization';

function MyComponent() {
  const files = [
    { name: 'videos', path: '/data/videos', size: 52428800, is_directory: true },
    { name: 'movie.mp4', path: '/data/videos/movie.mp4', size: 20971520, is_directory: false },
    // ... more files
  ];

  return (
    <TreeMapVisualization
      volumeId="my-volume"
      files={files}
      currentPath="/data"
    />
  );
}
```

### With Custom Color Scheme

```tsx
<TreeMapVisualization
  volumeId="my-volume"
  files={files}
  currentPath="/data"
  colorScheme="age"
/>
```

### With Event Handlers

```tsx
<TreeMapVisualization
  volumeId="my-volume"
  files={files}
  currentPath="/data"
  onFileClick={(node) => console.log('Clicked:', node)}
  onNavigate={(path) => console.log('Navigating to:', path)}
/>
```

### Custom Dimensions

```tsx
<TreeMapVisualization
  volumeId="my-volume"
  files={files}
  currentPath="/data"
  width={1200}
  height={800}
/>
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `volumeId` | `string` | required | ID of the volume being visualized |
| `files` | `FileItem[]` | `[]` | Array of files to visualize |
| `currentPath` | `string` | `'/'` | Current path in the file system |
| `colorScheme` | `'fileType' \| 'age' \| 'size'` | `'fileType'` | Color coding scheme |
| `onFileClick` | `(node: TreeMapNode) => void` | - | Called when a file/folder is clicked |
| `onNavigate` | `(path: string) => void` | - | Called when navigating to a folder |
| `className` | `string` | - | Additional CSS classes |
| `width` | `number` | auto | Width of the treemap |
| `height` | `number` | `600` | Height of the treemap |

## Data Structure

### FileItem

```typescript
interface FileItem {
  name: string;
  path: string;
  size?: number;
  is_directory: boolean;
  modified_time?: string;
  extension?: string;
  media_type?: string;
}
```

### TreeMapNode

```typescript
interface TreeMapNode {
  name: string;
  value: number; // size in bytes
  path: string;
  type: 'file' | 'directory';
  extension?: string;
  modifiedTime?: string;
  children?: TreeMapNode[];
  parent?: string;
  depth?: number;
}
```

## Color Schemes

### File Type Colors

| File Type | Light Mode | Dark Mode | Example Extensions |
|-----------|------------|-----------|-------------------|
| Images/Directories | Blue (#3B82F6) | Blue (#60A5FA) | jpg, png, gif |
| Videos | Red (#EF4444) | Red (#F87171) | mp4, mkv, avi |
| Audio | Purple (#8B5CF6) | Purple (#A78BFA) | mp3, wav, flac |
| Documents | Green (#10B981) | Green (#34D399) | pdf, docx, txt |
| Archives | Amber (#F59E0B) | Amber (#FBBF24) | zip, tar, gz |
| Code | Indigo (#6366F1) | Indigo (#818CF8) | js, ts, py, java |
| Other | Gray (#6B7280) | Gray (#9CA3AF) | - |

### Age Gradient

- **Very Recent** (< 1 month): Dark Green (#059669)
- **Recent** (1-3 months): Light Green (#10B981)
- **Medium** (3-6 months): Yellow (#F59E0B)
- **Old** (6-12 months): Orange (#F97316)
- **Very Old** (> 1 year): Red (#EF4444)

### Size Heat Map

Size coloring shows relative size within the current view:
- **Smallest** (< 20%): Blue
- **Small** (20-40%): Green
- **Medium** (40-60%): Amber
- **Large** (60-80%): Orange
- **Largest** (> 80%): Red

## Utility Functions

The component includes several utility functions in `treeMapUtils.ts`:

- `transformToTreeMapData()`: Convert flat file list to hierarchical tree
- `getNodeColor()`: Get color for a node based on scheme
- `formatFileSize()`: Format bytes to human-readable string
- `formatPercentage()`: Format size as percentage of total
- `getFileTypeCategory()`: Get category label for file
- `getRelativeTime()`: Get relative time string (e.g., "2 days ago")
- `buildBreadcrumbs()`: Build breadcrumb navigation array

## Integration

### Explorer Page Integration

The TreeMap is integrated into the ExplorerPage with a view toggle:

```tsx
const [viewMode, setViewMode] = useState<'list' | 'treemap'>('list');

// View toggle buttons
<button onClick={() => setViewMode('list')}>List</button>
<button onClick={() => setViewMode('treemap')}>TreeMap</button>

// Conditional rendering
{viewMode === 'treemap' && (
  <TreeMapVisualization
    volumeId={volumeId}
    files={files}
    currentPath={currentPath}
  />
)}
```

## Performance Considerations

1. **Large Datasets**: The component can handle 10,000+ files efficiently
2. **Memoization**: Uses React.useMemo for expensive calculations
3. **Recharts**: Leverages Recharts' optimized treemap algorithm
4. **Tree Depth**: Displays full hierarchy without depth limits
5. **Size Aggregation**: Folder sizes are pre-calculated bottom-up

## Browser Compatibility

- Chrome/Edge: ✅ Full support
- Firefox: ✅ Full support
- Safari: ✅ Full support
- Mobile: ✅ Responsive design

## Dark Mode

The component supports dark mode theming:
- Automatically adjusts colors based on theme
- Color schemes optimized for both light and dark
- Maintains good contrast in all modes

## Accessibility

- ARIA labels for interactive elements
- Keyboard navigation support
- Screen reader friendly tooltips
- High contrast colors

## Future Enhancements

Potential improvements for future versions:

- [ ] Export treemap as PNG/SVG
- [ ] Search/filter within treemap
- [ ] Minimap for large datasets
- [ ] Compare multiple volumes side-by-side
- [ ] Custom color palettes
- [ ] Animation on data updates
- [ ] Zoom with mouse wheel
- [ ] Multi-select support
- [ ] Context menu on right-click

## Related Components

- `DirectoryTree`: Tree view of directories
- `VirtualizedFileTable`: Table view of files
- `Sunburst`: Alternative circular visualization
- `VolumeCharts`: Volume statistics charts

## License

Part of VolumeViz project. See main project license.
