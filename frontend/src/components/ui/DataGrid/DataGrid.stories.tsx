import type { Meta, StoryObj } from '@storybook/react';
import { useState, useMemo } from 'react';
import { action } from '@storybook/addon-actions';
import {
  File,
  Folder,
  Image,
  FileText,
  Music,
  Video,
  Archive,
  Code,
  Database,
  Trash2,
  Download,
  Share,
  Edit3,
  Eye,
  MoreHorizontal,
  Search,
  Filter,
  Calendar,
  HardDrive,
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Users,
} from 'lucide-react';

import { DataGrid } from './DataGrid';
import { Button } from '../Button';
import type {
  DataGridProps,
  DataGridColumn,
  FileEntry,
  ScanResult,
  SelectionState,
  SortConfig,
} from './DataGrid.types';

const meta: Meta<typeof DataGrid> = {
  title: 'UI/DataGrid',
  component: DataGrid,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'A comprehensive data grid component with advanced features for displaying and managing tabular data, specifically optimized for scan monitoring and file management systems.',
      },
    },
  },
  argTypes: {
    size: {
      control: 'radio',
      options: ['sm', 'md', 'lg'],
    },
    variant: {
      control: 'radio',
      options: ['default', 'striped', 'bordered', 'minimal'],
    },
    selectionMode: {
      control: 'radio',
      options: ['none', 'single', 'multiple'],
    },
    sortable: {
      control: 'boolean',
    },
    hoverable: {
      control: 'boolean',
    },
  },
};

export default meta;
type Story = StoryObj<typeof DataGrid>;

// Sample data generators
const generateFileData = (count: number): FileEntry[] => {
  const fileTypes = [
    { type: 'file', extension: 'jpg', mimeType: 'image/jpeg', icon: Image },
    { type: 'file', extension: 'png', mimeType: 'image/png', icon: Image },
    {
      type: 'file',
      extension: 'pdf',
      mimeType: 'application/pdf',
      icon: FileText,
    },
    {
      type: 'file',
      extension: 'docx',
      mimeType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      icon: FileText,
    },
    { type: 'file', extension: 'mp3', mimeType: 'audio/mpeg', icon: Music },
    { type: 'file', extension: 'mp4', mimeType: 'video/mp4', icon: Video },
    {
      type: 'file',
      extension: 'zip',
      mimeType: 'application/zip',
      icon: Archive,
    },
    {
      type: 'file',
      extension: 'js',
      mimeType: 'application/javascript',
      icon: Code,
    },
    {
      type: 'directory',
      extension: undefined,
      mimeType: undefined,
      icon: Folder,
    },
  ];

  const names = [
    'Documents',
    'Photos',
    'Downloads',
    'Desktop',
    'Music',
    'Videos',
    'important_document',
    'vacation_photos',
    'project_files',
    'backup',
    'presentation',
    'spreadsheet',
    'notes',
    'contracts',
    'invoices',
    'family_photos',
    'work_files',
    'personal',
    'archive',
    'temp',
  ];

  return Array.from({ length: count }, (_, i) => {
    const fileType = fileTypes[Math.floor(Math.random() * fileTypes.length)];
    const baseName = names[Math.floor(Math.random() * names.length)];
    const name =
      fileType.type === 'directory'
        ? baseName
        : `${baseName}.${fileType.extension}`;

    const size =
      fileType.type === 'directory'
        ? Math.floor(Math.random() * 1000000000) // Up to 1GB for directories
        : Math.floor(Math.random() * 50000000); // Up to 50MB for files

    const baseDate = new Date(2023, 0, 1);
    const randomDays = Math.floor(Math.random() * 365);
    const dateCreated = new Date(
      baseDate.getTime() + randomDays * 24 * 60 * 60 * 1000,
    );
    const dateModified = new Date(
      dateCreated.getTime() + Math.random() * 30 * 24 * 60 * 60 * 1000,
    );

    return {
      id: `file-${i}`,
      name,
      path: `/Users/Documents/${name}`,
      size,
      type: fileType.type as 'file' | 'directory',
      extension: fileType.extension,
      mimeType: fileType.mimeType,
      dateCreated,
      dateModified,
      dateAccessed: new Date(),
      permissions: fileType.type === 'directory' ? 'drwxr-xr-x' : '-rw-r--r--',
      owner: 'user',
      group: 'staff',
      isHidden: Math.random() < 0.1,
      isSymlink: Math.random() < 0.05,
      checksum:
        fileType.type === 'file'
          ? `md5:${Math.random().toString(36).substr(2, 32)}`
          : undefined,
      scanId: `scan-${Math.floor(Math.random() * 10)}`,
    };
  });
};

const generateScanData = (count: number): ScanResult[] => {
  const statuses = [
    'completed',
    'running',
    'failed',
    'cancelled',
    'pending',
  ] as const;
  const phases = [
    'volume_scan',
    'filesystem_indexing',
    'media_enrichment',
  ] as const;

  return Array.from({ length: count }, (_, i) => {
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const phase = phases[Math.floor(Math.random() * phases.length)];
    const startTime = new Date(
      Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000,
    );
    const duration = Math.random() * 2 * 60 * 60 * 1000; // Up to 2 hours
    const endTime =
      status === 'completed'
        ? new Date(startTime.getTime() + duration)
        : undefined;

    const filesFound = Math.floor(Math.random() * 10000);
    const filesProcessed =
      status === 'completed'
        ? filesFound
        : Math.floor(Math.random() * filesFound);
    const progress =
      status === 'completed'
        ? 100
        : Math.floor((filesProcessed / filesFound) * 100);

    return {
      id: `scan-${i}`,
      volumeId: `volume-${Math.floor(Math.random() * 5)}`,
      scanId: `scan-${i}`,
      status,
      phase,
      progress,
      startTime,
      endTime,
      filesFound,
      filesProcessed,
      errorsCount: Math.floor(Math.random() * 10),
      warnings: ['Permission denied for some files'],
      errors: status === 'failed' ? ['Network timeout', 'Disk full'] : [],
      totalSize: Math.floor(Math.random() * 1000000000000), // Up to 1TB
      processedSize: Math.floor(Math.random() * 1000000000000),
      speed: Math.floor(Math.random() * 1000), // Files per second
      estimatedCompletion:
        status === 'running'
          ? new Date(Date.now() + Math.random() * 60 * 60 * 1000)
          : undefined,
    };
  });
};

// File icon renderer
const FileIcon: React.FC<{ file: FileEntry }> = ({ file }) => {
  const getIcon = () => {
    if (file.type === 'directory') return Folder;

    switch (file.extension) {
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'bmp':
      case 'svg':
        return Image;
      case 'mp3':
      case 'wav':
      case 'flac':
      case 'aac':
        return Music;
      case 'mp4':
      case 'avi':
      case 'mkv':
      case 'mov':
        return Video;
      case 'pdf':
      case 'doc':
      case 'docx':
      case 'txt':
        return FileText;
      case 'zip':
      case 'rar':
      case '7z':
      case 'tar':
        return Archive;
      case 'js':
      case 'ts':
      case 'jsx':
      case 'tsx':
      case 'py':
      case 'java':
      case 'cpp':
        return Code;
      default:
        return File;
    }
  };

  const Icon = getIcon();
  return <Icon className="w-4 h-4 text-gray-500" />;
};

// Status badge renderer
const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'completed':
        return {
          icon: CheckCircle,
          color: 'text-green-600 bg-green-100',
          label: 'Completed',
        };
      case 'running':
        return {
          icon: Activity,
          color: 'text-blue-600 bg-blue-100',
          label: 'Running',
        };
      case 'failed':
        return {
          icon: AlertTriangle,
          color: 'text-red-600 bg-red-100',
          label: 'Failed',
        };
      case 'cancelled':
        return {
          icon: Clock,
          color: 'text-gray-600 bg-gray-100',
          label: 'Cancelled',
        };
      case 'pending':
        return {
          icon: Clock,
          color: 'text-yellow-600 bg-yellow-100',
          label: 'Pending',
        };
      default:
        return {
          icon: Clock,
          color: 'text-gray-600 bg-gray-100',
          label: status,
        };
    }
  };

  const { icon: Icon, color, label } = getStatusConfig(status);

  return (
    <span
      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${color}`}
    >
      <Icon className="w-3 h-3 mr-1" />
      {label}
    </span>
  );
};

// Progress bar renderer
const ProgressBar: React.FC<{ progress: number }> = ({ progress }) => (
  <div className="flex items-center space-x-2 min-w-0">
    <div className="flex-1 bg-gray-200 rounded-full h-2">
      <div
        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
        style={{ width: `${Math.min(progress, 100)}%` }}
      />
    </div>
    <span className="text-xs text-gray-600 w-10 text-right">{progress}%</span>
  </div>
);

// Column definitions
const fileColumns: DataGridColumn<FileEntry>[] = [
  {
    id: 'name',
    key: 'name',
    title: 'Name',
    sortable: true,
    resizable: true,
    width: '300px',
    render: (value, row) => (
      <div className="flex items-center space-x-2 min-w-0">
        <FileIcon file={row} />
        <span className="truncate" title={value}>
          {value}
        </span>
        {row.isSymlink && <span className="text-xs text-blue-600">→</span>}
      </div>
    ),
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
    render: (value, row) =>
      row.type === 'directory'
        ? 'Folder'
        : row.extension?.toUpperCase() || 'File',
  },
  {
    id: 'dateModified',
    key: 'dateModified',
    title: 'Modified',
    type: 'date',
    sortable: true,
    width: '120px',
  },
  {
    id: 'permissions',
    key: 'permissions',
    title: 'Permissions',
    sortable: true,
    width: '120px',
    render: (value) => (
      <code className="text-xs bg-gray-100 px-1 rounded">{value}</code>
    ),
  },
  {
    id: 'actions',
    key: 'id',
    title: '',
    width: '60px',
    render: (value, row) => (
      <div className="flex items-center space-x-1">
        <button
          onClick={(e) => {
            e.stopPropagation();
            action('view')(row);
          }}
          className="p-1 text-gray-500 hover:text-blue-600 rounded"
          title="View"
        >
          <Eye className="w-4 h-4" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            action('download')(row);
          }}
          className="p-1 text-gray-500 hover:text-green-600 rounded"
          title="Download"
        >
          <Download className="w-4 h-4" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            action('more')(row);
          }}
          className="p-1 text-gray-500 hover:text-gray-700 rounded"
          title="More"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>
    ),
  },
];

const scanColumns: DataGridColumn<ScanResult>[] = [
  {
    id: 'scanId',
    key: 'scanId',
    title: 'Scan ID',
    sortable: true,
    width: '120px',
    render: (value) => (
      <code className="text-xs bg-gray-100 px-1 rounded">{value}</code>
    ),
  },
  {
    id: 'status',
    key: 'status',
    title: 'Status',
    sortable: true,
    width: '120px',
    render: (value) => <StatusBadge status={value} />,
  },
  {
    id: 'progress',
    key: 'progress',
    title: 'Progress',
    sortable: true,
    width: '200px',
    render: (value) => <ProgressBar progress={value} />,
  },
  {
    id: 'phase',
    key: 'phase',
    title: 'Phase',
    sortable: true,
    width: '150px',
    render: (value) => {
      const phaseLabels: Record<string, string> = {
        volume_scan: 'Volume Scan',
        filesystem_indexing: 'Indexing',
        media_enrichment: 'Enrichment',
      };
      return phaseLabels[value] || value;
    },
  },
  {
    id: 'filesFound',
    key: 'filesFound',
    title: 'Files Found',
    type: 'number',
    sortable: true,
    align: 'right',
    width: '120px',
  },
  {
    id: 'totalSize',
    key: 'totalSize',
    title: 'Total Size',
    type: 'fileSize',
    sortable: true,
    align: 'right',
    width: '120px',
  },
  {
    id: 'startTime',
    key: 'startTime',
    title: 'Started',
    type: 'date',
    sortable: true,
    width: '140px',
  },
  {
    id: 'duration',
    key: 'endTime',
    title: 'Duration',
    sortable: true,
    width: '100px',
    render: (value, row) => {
      if (!value || !row.endTime) return '-';
      const duration = row.endTime.getTime() - row.startTime.getTime();
      return `${Math.round(duration / 60000)}m`;
    },
  },
];

// Basic example
export const Default: Story = {
  render: () => {
    const data = useMemo(() => generateFileData(10), []);

    return (
      <div className="p-4">
        <DataGrid
          data={data}
          columns={fileColumns}
          size="md"
          variant="default"
          height="400px"
          sortable
          hoverable
          selectionMode="multiple"
          onRowClick={action('rowClick')}
          onSelectionChange={action('selectionChange')}
        />
      </div>
    );
  },
};

// Different sizes
export const Sizes: Story = {
  render: () => {
    const data = useMemo(() => generateFileData(5), []);

    return (
      <div className="p-4 space-y-6">
        <div>
          <h3 className="text-lg font-semibold mb-2">Small</h3>
          <DataGrid
            data={data}
            columns={fileColumns.slice(0, 4)}
            size="sm"
            height="200px"
          />
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-2">Medium</h3>
          <DataGrid
            data={data}
            columns={fileColumns.slice(0, 4)}
            size="md"
            height="200px"
          />
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-2">Large</h3>
          <DataGrid
            data={data}
            columns={fileColumns.slice(0, 4)}
            size="lg"
            height="200px"
          />
        </div>
      </div>
    );
  },
};

// Different variants
export const Variants: Story = {
  render: () => {
    const data = useMemo(() => generateFileData(8), []);

    return (
      <div className="p-4 space-y-6">
        <div>
          <h3 className="text-lg font-semibold mb-2">Default</h3>
          <DataGrid
            data={data}
            columns={fileColumns.slice(0, 4)}
            variant="default"
            height="200px"
          />
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-2">Striped</h3>
          <DataGrid
            data={data}
            columns={fileColumns.slice(0, 4)}
            variant="striped"
            height="200px"
          />
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-2">Bordered</h3>
          <DataGrid
            data={data}
            columns={fileColumns.slice(0, 4)}
            variant="bordered"
            height="200px"
          />
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-2">Minimal</h3>
          <DataGrid
            data={data}
            columns={fileColumns.slice(0, 4)}
            variant="minimal"
            height="200px"
          />
        </div>
      </div>
    );
  },
};

// Selection modes
export const Selection: Story = {
  render: () => {
    const data = useMemo(() => generateFileData(8), []);
    const [selection, setSelection] = useState<SelectionState>({
      selectedRows: new Set(),
      isAllSelected: false,
      isIndeterminate: false,
    });

    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Multiple Selection</h3>
          <div className="text-sm text-gray-600">
            Selected: {selection.selectedRows.size} of {data.length}
          </div>
        </div>

        <DataGrid
          data={data}
          columns={fileColumns}
          height="400px"
          selectionMode="multiple"
          selectedRows={selection.selectedRows}
          onSelectionChange={setSelection}
          onRowClick={action('rowClick')}
        />

        <div className="flex space-x-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              setSelection((prev) => ({ ...prev, selectedRows: new Set() }))
            }
          >
            Clear Selection
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => action('bulkAction')([...selection.selectedRows])}
            disabled={selection.selectedRows.size === 0}
          >
            Bulk Action ({selection.selectedRows.size})
          </Button>
        </div>
      </div>
    );
  },
};

// Sorting and filtering
export const SortingAndFiltering: Story = {
  render: () => {
    const data = useMemo(() => generateFileData(20), []);
    const [sortConfig, setSortConfig] = useState<SortConfig>({
      key: '',
      direction: null,
    });

    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Sorting Example</h3>
          <div className="text-sm text-gray-600">
            {sortConfig.direction && (
              <>
                Sort: {sortConfig.key} ({sortConfig.direction})
              </>
            )}
          </div>
        </div>

        <DataGrid
          data={data}
          columns={fileColumns}
          height="500px"
          sortable
          sortConfig={sortConfig}
          onSortChange={setSortConfig}
          selectionMode="multiple"
          onRowClick={action('rowClick')}
        />
      </div>
    );
  },
};

// Loading states
export const LoadingStates: Story = {
  render: () => {
    const [loadingState, setLoadingState] = useState<
      'idle' | 'loading' | 'error'
    >('idle');
    const data = useMemo(() => generateFileData(10), []);

    const simulateLoading = () => {
      setLoadingState('loading');
      setTimeout(() => setLoadingState('idle'), 2000);
    };

    const simulateError = () => {
      setLoadingState('error');
    };

    return (
      <div className="p-4 space-y-4">
        <div className="flex space-x-2">
          <Button onClick={simulateLoading}>Simulate Loading</Button>
          <Button onClick={simulateError} variant="destructive">
            Simulate Error
          </Button>
          <Button onClick={() => setLoadingState('idle')} variant="outline">
            Reset
          </Button>
        </div>

        <DataGrid
          data={loadingState === 'idle' ? data : []}
          columns={fileColumns}
          height="400px"
          loading={{
            state: loadingState,
            message:
              loadingState === 'loading'
                ? 'Loading files...'
                : 'Failed to load files',
          }}
          emptyState={{
            message: 'No files found',
            description: 'Try uploading some files or check your filters',
            action: {
              label: 'Upload Files',
              onClick: action('uploadFiles'),
            },
          }}
        />
      </div>
    );
  },
};

// Scan monitoring example
export const ScanMonitoring: Story = {
  render: () => {
    const scanData = useMemo(() => generateScanData(15), []);
    const [selectedScans, setSelectedScans] = useState<Set<string | number>>(
      new Set(),
    );

    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Volume Scan Monitoring</h3>
          <div className="flex space-x-2">
            <Button size="sm" variant="outline">
              <Filter className="w-4 h-4 mr-2" />
              Filter
            </Button>
            <Button size="sm" variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        <DataGrid
          data={scanData}
          columns={scanColumns}
          height="600px"
          variant="striped"
          selectionMode="multiple"
          selectedRows={selectedScans}
          onSelectionChange={(selection) =>
            setSelectedScans(selection.selectedRows)
          }
          sortable
          hoverable
          onRowClick={action('viewScanDetails')}
          onRowDoubleClick={action('openScanDetails')}
        />

        {selectedScans.size > 0 && (
          <div className="flex items-center space-x-2 p-3 bg-blue-50 rounded-lg">
            <span className="text-sm text-blue-700">
              {selectedScans.size} scan(s) selected
            </span>
            <Button size="sm" variant="outline">
              <Trash2 className="w-4 h-4 mr-2" />
              Cancel Selected
            </Button>
            <Button size="sm" variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Export Results
            </Button>
          </div>
        )}
      </div>
    );
  },
};

// File explorer example
export const FileExplorer: Story = {
  render: () => {
    const fileData = useMemo(() => generateFileData(50), []);
    const [selectedFiles, setSelectedFiles] = useState<Set<string | number>>(
      new Set(),
    );
    const [expandedRows, setExpandedRows] = useState<Set<string | number>>(
      new Set(),
    );

    const expandableColumns: DataGridColumn<FileEntry>[] = [
      ...fileColumns.slice(0, -1), // Remove actions column
      {
        id: 'owner',
        key: 'owner',
        title: 'Owner',
        width: '80px',
      },
      {
        id: 'actions',
        key: 'id',
        title: '',
        width: '120px',
        render: (value, row) => (
          <div className="flex items-center space-x-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                action('view')(row);
              }}
              className="p-1 text-gray-500 hover:text-blue-600 rounded"
              title="View"
            >
              <Eye className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                action('edit')(row);
              }}
              className="p-1 text-gray-500 hover:text-green-600 rounded"
              title="Edit"
            >
              <Edit3 className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                action('share')(row);
              }}
              className="p-1 text-gray-500 hover:text-purple-600 rounded"
              title="Share"
            >
              <Share className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                action('download')(row);
              }}
              className="p-1 text-gray-500 hover:text-blue-600 rounded"
              title="Download"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        ),
      },
    ];

    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">File Explorer</h3>
            <p className="text-sm text-gray-600">/Users/Documents</p>
          </div>
          <div className="flex space-x-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search files..."
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <Button size="sm" variant="outline">
              <Filter className="w-4 h-4 mr-2" />
              Filter
            </Button>
          </div>
        </div>

        <DataGrid
          data={fileData}
          columns={expandableColumns}
          height="700px"
          variant="default"
          selectionMode="multiple"
          selectedRows={selectedFiles}
          onSelectionChange={(selection) =>
            setSelectedFiles(selection.selectedRows)
          }
          expandableRows
          rowExpansion={{
            render: (file) => (
              <div className="p-4 bg-gray-50 border-t">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <strong>Full Path:</strong> {file.path}
                  </div>
                  <div>
                    <strong>Checksum:</strong> {file.checksum || 'N/A'}
                  </div>
                  <div>
                    <strong>MIME Type:</strong> {file.mimeType || 'N/A'}
                  </div>
                  <div>
                    <strong>Scan ID:</strong> {file.scanId}
                  </div>
                  <div>
                    <strong>Created:</strong>{' '}
                    {file.dateCreated.toLocaleString()}
                  </div>
                  <div>
                    <strong>Accessed:</strong>{' '}
                    {file.dateAccessed?.toLocaleString() || 'N/A'}
                  </div>
                </div>
              </div>
            ),
            expandedRowKeys: expandedRows,
            onExpansionChange: setExpandedRows,
          }}
          sortable
          hoverable
          onRowClick={action('selectFile')}
          onRowDoubleClick={action('openFile')}
          onRowContextMenu={action('contextMenu')}
        />

        {selectedFiles.size > 0 && (
          <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
            <span className="text-sm text-blue-700">
              {selectedFiles.size} file(s) selected
            </span>
            <div className="flex space-x-2">
              <Button size="sm" variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
              <Button size="sm" variant="outline">
                <Share className="w-4 h-4 mr-2" />
                Share
              </Button>
              <Button size="sm" variant="destructive">
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  },
};

// Performance with large dataset
export const LargeDataset: Story = {
  render: () => {
    const [dataSize, setDataSize] = useState(100);
    const data = useMemo(() => generateFileData(dataSize), [dataSize]);

    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Performance Test</h3>
          <div className="flex items-center space-x-2">
            <label className="text-sm">Rows:</label>
            <select
              value={dataSize}
              onChange={(e) => setDataSize(Number(e.target.value))}
              className="border border-gray-300 rounded px-2 py-1 text-sm"
            >
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={500}>500</option>
              <option value={1000}>1,000</option>
              <option value={5000}>5,000</option>
            </select>
          </div>
        </div>

        <DataGrid
          data={data}
          columns={fileColumns}
          height="600px"
          variant="minimal"
          selectionMode="multiple"
          sortable
          hoverable
        />

        <div className="text-sm text-gray-600">
          Rendering {data.length.toLocaleString()} rows
        </div>
      </div>
    );
  },
};

// Interactive playground
export const Interactive: Story = {
  render: () => {
    const [config, setConfig] = useState({
      size: 'md' as const,
      variant: 'default' as const,
      selectionMode: 'multiple' as const,
      sortable: true,
      hoverable: true,
      striped: false,
      bordered: false,
      dataSize: 20,
    });

    const data = useMemo(
      () => generateFileData(config.dataSize),
      [config.dataSize],
    );

    return (
      <div className="p-4 space-y-6">
        {/* Controls */}
        <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
          <div>
            <label className="block text-sm font-medium mb-1">Size</label>
            <select
              value={config.size}
              onChange={(e) =>
                setConfig((prev) => ({ ...prev, size: e.target.value as any }))
              }
              className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
            >
              <option value="sm">Small</option>
              <option value="md">Medium</option>
              <option value="lg">Large</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Variant</label>
            <select
              value={config.variant}
              onChange={(e) =>
                setConfig((prev) => ({
                  ...prev,
                  variant: e.target.value as any,
                }))
              }
              className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
            >
              <option value="default">Default</option>
              <option value="striped">Striped</option>
              <option value="bordered">Bordered</option>
              <option value="minimal">Minimal</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Selection</label>
            <select
              value={config.selectionMode}
              onChange={(e) =>
                setConfig((prev) => ({
                  ...prev,
                  selectionMode: e.target.value as any,
                }))
              }
              className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
            >
              <option value="none">None</option>
              <option value="single">Single</option>
              <option value="multiple">Multiple</option>
            </select>
          </div>

          <div className="flex items-center space-x-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={config.sortable}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, sortable: e.target.checked }))
                }
                className="mr-2"
              />
              Sortable
            </label>

            <label className="flex items-center">
              <input
                type="checkbox"
                checked={config.hoverable}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    hoverable: e.target.checked,
                  }))
                }
                className="mr-2"
              />
              Hoverable
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Data Size</label>
            <input
              type="number"
              min="5"
              max="100"
              value={config.dataSize}
              onChange={(e) =>
                setConfig((prev) => ({
                  ...prev,
                  dataSize: Number(e.target.value),
                }))
              }
              className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
            />
          </div>
        </div>

        {/* DataGrid */}
        <DataGrid
          data={data}
          columns={fileColumns}
          height="500px"
          size={config.size}
          variant={config.variant}
          selectionMode={config.selectionMode}
          sortable={config.sortable}
          hoverable={config.hoverable}
          striped={config.striped}
          bordered={config.bordered}
          onRowClick={action('rowClick')}
          onSelectionChange={action('selectionChange')}
          onSortChange={action('sortChange')}
        />

        <div className="text-sm text-gray-600">
          Configuration: {config.size} • {config.variant} •{' '}
          {config.selectionMode} selection • {data.length} rows
        </div>
      </div>
    );
  },
};
