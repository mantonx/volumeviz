import { http, HttpResponse } from 'msw';
import type { 
  Volume, 
  Organization, 
  VolumeSize,
  ScanStatus,
  FileListResponse,
  HealthCheckResponse 
} from '@/api/orval-generated/api';

// Mock volume data using modern Orval types
interface MockVolume extends Volume {
  // Extend with any additional mock-specific fields if needed
}

interface MockAlert {
  id: number;
  rule_id: number;
  volume_id: number;
  message: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  status: 'active' | 'resolved' | 'acknowledged';
  created_at: string;
  updated_at: string;
  resolved_at?: string;
}

interface MockSystemInfo {
  version: string;
  build: string;
  uptime: string;
  total_volumes: number;
  total_scanned_size: number;
  last_scan: string;
  database_size: string;
  cache_size: string;
}

interface MockHealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  database: 'connected' | 'disconnected';
  websocket: 'connected' | 'disconnected';
  version: string;
  timestamp: string;
}

interface MockScanResult {
  id: string;
  volume_id: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  files_processed: number;
  bytes_processed: number;
  started_at: string;
  completed_at?: string;
  error_message?: string;
}

interface MockFileMetadata {
  id: string;
  name: string;
  path: string;
  size: number;
  is_directory: boolean;
  modified_time: string;
  permissions: string;
  file_type: string;
}

// Mock data using modern API structure
const mockVolumes: Volume[] = [
  {
    name: 'production-db-data',
    driver: 'local',
    mountpoint: '/var/lib/docker/volumes/production-db-data/_data',
    created_at: '2024-01-15T10:30:00Z',
    size_bytes: 2147483648, // 2GB
    attachments_count: 1,
    is_orphaned: false,
    is_system: false,
    labels: {
      'com.docker.compose.project': 'production',
      'com.docker.compose.service': 'database'
    },
    last_scan_at: '2024-12-15T14:20:00Z',
    scan_status: 'completed',
    filesystem_capacity: {
      total: 107374182400, // 100GB
      used: 21474836480,   // 20GB
      available: 85899345920, // 80GB
      percentage: 20
    }
  },
  {
    name: 'redis-cache-vol',
    driver: 'local',
    mountpoint: '/var/lib/docker/volumes/redis-cache-vol/_data',
    created_at: '2024-02-20T09:15:00Z',
    size_bytes: 524288000, // 500MB
    attachments_count: 1,
    is_orphaned: false,
    is_system: false,
    labels: {
      'com.docker.compose.project': 'cache',
      'com.docker.compose.service': 'redis'
    },
    last_scan_at: '2024-12-15T13:45:00Z',
    scan_status: 'completed'
  },
  {
    name: 'orphaned-volume',
    driver: 'local',
    mountpoint: '/var/lib/docker/volumes/orphaned-volume/_data',
    created_at: '2024-01-01T00:00:00Z',
    size_bytes: 1048576, // 1MB
    attachments_count: 0,
    is_orphaned: true,
    is_system: false,
    labels: {},
    scan_status: 'pending'
  }
];

const mockOrganization: Organization = {
  id: 1,
  name: 'VolumeViz Demo Organization',
  description: 'Demo organization for VolumeViz testing and development',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-12-15T12:00:00Z'
};

const mockFiles = [
  {
    name: 'config.json',
    path: '/config.json',
    type: 'file' as const,
    size: 1024,
    modified_at: '2024-12-15T10:00:00Z',
    is_directory: false
  },
  {
    name: 'logs',
    path: '/logs',
    type: 'directory' as const,
    size: 0,
    modified_at: '2024-12-15T11:30:00Z',
    is_directory: true,
    children_count: 15
  },
  {
    name: 'data.db',
    path: '/data.db',
    type: 'file' as const,
    size: 2147483648, // 2GB
    modified_at: '2024-12-15T14:20:00Z',
    is_directory: false
  }
];

const mockAlerts: MockAlert[] = [
  {
    id: 1,
    rule_id: 1,
    volume_id: 1,
    message: 'Volume usage above 80%',
    severity: 'warning',
    status: 'active',
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:00:00Z',
  },
];

const mockSystemInfo: MockSystemInfo = {
  version: '1.2.0',
  build: 'dev-build',
  uptime: '2 days, 14 hours',
  total_volumes: 2,
  total_scanned_size: 1300000000000, // 1.3TB
  last_scan: '2024-01-15T10:30:00Z',
  database_size: '45MB',
  cache_size: '128MB',
};

// Modern API handlers matching Orval-generated endpoints
export const handlers = [
  // Health Check
  http.get('/api/v1/health', () => {
    const healthResponse: HealthCheckResponse = {
      status: 'healthy',
      timestamp: Date.now(),
      checks: {
        database: { status: 'healthy' },
        filesystem: { status: 'healthy' },
        docker: { status: 'healthy' }
      }
    };
    
    return HttpResponse.json(healthResponse);
  }),

  http.get('/api/v1/health/ready', () => {
    return HttpResponse.json({ ready: true });
  }),

  http.get('/api/v1/health/live', () => {
    return HttpResponse.json({ alive: true });
  }),

  // System endpoints
  http.get('/api/v1/system/info', () => {
    return HttpResponse.json(mockSystemInfo);
  }),

  http.get('/api/v1/system/stats', () => {
    const stats = {
      total_volumes: mockVolumes.length,
      total_size: mockVolumes.reduce((acc, v) => acc + (v.size_bytes || 0), 0),
      total_used: mockVolumes.reduce((acc, v) => acc + (v.used_bytes || 0), 0),
      active_scans: mockVolumes.filter((v) => v.scan_progress !== undefined)
        .length,
      recent_alerts: mockAlerts.length,
    };
    return HttpResponse.json(stats);
  }),

  // Volumes List - Modern API format
  http.get('/api/v1/volumes', ({ request }) => {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const pageSize = parseInt(url.searchParams.get('page_size') || '25');
    const search = url.searchParams.get('q');
    const orphaned = url.searchParams.get('orphaned');

    let filteredVolumes = [...mockVolumes];

    // Apply search filter
    if (search) {
      filteredVolumes = filteredVolumes.filter(vol => 
        vol.name.toLowerCase().includes(search.toLowerCase())
      );
    }

    // Apply orphaned filter
    if (orphaned === 'true') {
      filteredVolumes = filteredVolumes.filter(vol => vol.is_orphaned);
    } else if (orphaned === 'false') {
      filteredVolumes = filteredVolumes.filter(vol => !vol.is_orphaned);
    }

    // Pagination
    const start = (page - 1) * pageSize;
    const paginatedVolumes = filteredVolumes.slice(start, start + pageSize);

    return HttpResponse.json({
      success: true,
      data: paginatedVolumes,
      pagination: {
        page,
        page_size: pageSize,
        total: filteredVolumes.length,
        has_more: start + pageSize < filteredVolumes.length
      }
    });
  }),

  // Volume Size
  http.get('/api/v1/volumes/:volumeId/size', ({ params }) => {
    const volumeId = params.volumeId as string;
    const volume = mockVolumes.find(v => v.name === volumeId);
    
    if (!volume) {
      return HttpResponse.json(
        { error: 'Volume not found' },
        { status: 404 }
      );
    }

    const sizeResponse: VolumeSize = {
      volume_id: volumeId,
      size_bytes: volume.size_bytes || 0,
      file_count: Math.floor((volume.size_bytes || 0) / 10000), // Mock file count
      last_updated: volume.last_scan_at || new Date().toISOString()
    };

    return HttpResponse.json(sizeResponse);
  }),

  http.post('/api/v1/volumes', async ({ request }) => {
    const body = (await request.json()) as Partial<MockVolume>;
    const newVolume: MockVolume = {
      id: mockVolumes.length + 1,
      status: 'active',
      created_at: new Date().toISOString(),
      size_bytes: 0,
      used_bytes: 0,
      available_bytes: 0,
      name: 'New Volume',
      driver: 'local',
      mount_point: '/mnt/new',
      ...body,
    };
    mockVolumes.push(newVolume);
    return HttpResponse.json(newVolume, { status: 201 });
  }),

  http.delete('/api/v1/volumes/:id', ({ params }) => {
    const volumeId = parseInt(params.id as string);
    const index = mockVolumes.findIndex((v) => v.id === volumeId);
    if (index === -1) {
      return HttpResponse.json({ error: 'Volume not found' }, { status: 404 });
    }
    mockVolumes.splice(index, 1);
    return HttpResponse.json({ message: 'Volume deleted successfully' });
  }),

  // Volume Scan
  http.post('/api/v1/volumes/:volumeId/scan', ({ params }) => {
    const volumeId = params.volumeId as string;
    const scanId = `scan_${volumeId}_${Date.now()}`;
    
    return HttpResponse.json({
      scan_id: scanId,
      status: 'started',
      volume_id: volumeId,
      started_at: new Date().toISOString()
    });
  }),

  // Volume Size Refresh
  http.post('/api/v1/volumes/:volumeId/size/refresh', ({ params }) => {
    const volumeId = params.volumeId as string;
    const volume = mockVolumes.find(v => v.name === volumeId);
    
    if (!volume) {
      return HttpResponse.json(
        { error: 'Volume not found' },
        { status: 404 }
      );
    }

    // Simulate slight size change
    const newSize = (volume.size_bytes || 0) + Math.floor(Math.random() * 1000000);
    
    return HttpResponse.json({
      volume_id: volumeId,
      size_bytes: newSize,
      file_count: Math.floor(newSize / 10000),
      last_updated: new Date().toISOString()
    });
  }),

  // Filesystem Index
  http.post('/api/v1/volumes/:volumeId/filesystem/index', ({ params }) => {
    const volumeId = params.volumeId as string;
    const indexId = `index_${volumeId}_${Date.now()}`;
    
    return HttpResponse.json({
      index_id: indexId,
      status: 'started',
      volume_id: volumeId,
      started_at: new Date().toISOString()
    });
  }),

  // Organization Info
  http.get('/api/v1/organizations/me', () => {
    return HttpResponse.json(mockOrganization);
  }),

  // File Explorer - Browse Files
  http.get('/api/v1/explorer/browse', ({ request }) => {
    const url = new URL(request.url);
    const path = url.searchParams.get('path') || '/';
    const volumeId = url.searchParams.get('volume_id');

    if (!volumeId) {
      return HttpResponse.json(
        { error: 'volume_id is required' },
        { status: 400 }
      );
    }

    // Return different files based on path
    let files = [...mockFiles];
    if (path === '/logs') {
      files = [
        {
          name: 'app.log',
          path: '/logs/app.log',
          type: 'file' as const,
          size: 1048576, // 1MB
          modified_at: '2024-12-15T14:00:00Z',
          is_directory: false
        },
        {
          name: 'error.log',
          path: '/logs/error.log', 
          type: 'file' as const,
          size: 524288, // 512KB
          modified_at: '2024-12-15T13:30:00Z',
          is_directory: false
        }
      ];
    }

    const response: FileListResponse = {
      path,
      volume_id: volumeId,
      files,
      total_count: files.length
    };

    return HttpResponse.json(response);
  }),

  // Scan Status
  http.get('/api/v1/scans/:scanId/status', ({ params }) => {
    const scanId = params.scanId as string;
    
    // Simulate different scan states
    const states = ['running', 'completed', 'failed'];
    const randomState = states[Math.floor(Math.random() * states.length)];
    
    const scanStatus: ScanStatus = {
      scan_id: scanId,
      status: randomState,
      progress: randomState === 'running' ? Math.floor(Math.random() * 90) + 10 : 100,
      started_at: new Date(Date.now() - 30000).toISOString(), // 30 seconds ago
      completed_at: randomState !== 'running' ? new Date().toISOString() : undefined
    };

    return HttpResponse.json(scanStatus);
  }),

  // Bulk Operations
  http.post('/api/v1/volumes/bulk-scan', async ({ request }) => {
    const body = await request.json() as { volume_ids: string[]; async?: boolean; method?: string };
    const { volume_ids, async = false } = body;
    
    if (async) {
      // Return scan IDs for async operations
      const scanIds = volume_ids.map(id => `bulk_scan_${id}_${Date.now()}`);
      return HttpResponse.json({
        scan_ids: scanIds,
        status: 'started',
        async: true
      });
    } else {
      // Return immediate results for sync operations
      const results = volume_ids.map(id => ({
        volume_id: id,
        size_bytes: Math.floor(Math.random() * 2147483648),
        file_count: Math.floor(Math.random() * 50000),
        last_updated: new Date().toISOString()
      }));
      
      return HttpResponse.json({ results });
    }
  }),

  http.get('/api/v1/scans', () => {
    const scans: MockScanResult[] = [
      {
        id: 'scan_123',
        volume_id: 1,
        status: 'completed',
        progress: 100,
        files_processed: 12450,
        bytes_processed: 500000000000,
        started_at: '2024-01-15T10:00:00Z',
        completed_at: '2024-01-15T10:30:00Z',
      },
    ];
    return HttpResponse.json({ data: scans });
  }),

  // Alert endpoints
  http.get('/api/v1/alerts', ({ request }) => {
    const url = new URL(request.url);
    const status = url.searchParams.get('status');

    let filteredAlerts = mockAlerts;
    if (status) {
      filteredAlerts = mockAlerts.filter((a) => a.status === status);
    }

    return HttpResponse.json({ data: filteredAlerts });
  }),

  http.get('/api/v1/alerts/rules', () => {
    const rules = [
      {
        id: 1,
        name: 'High Usage Warning',
        condition: 'volume_usage > 0.8',
      },
    ];
    return HttpResponse.json({ data: rules });
  }),

  http.get('/api/v1/alerts/destinations', () => {
    const destinations = [
      {
        id: 1,
        name: 'Email Notifications',
        type: 'email',
        config: 'admin@example.com',
      },
    ];
    return HttpResponse.json({ data: destinations });
  }),

  // File system endpoints
  http.get('/api/v1/volumes/:id/files', ({ request }) => {
    const url = new URL(request.url);
    const path = url.searchParams.get('path') || '/';

    const files: MockFileMetadata[] = [
      {
        id: '1',
        name: 'Documents',
        path: `${path}/Documents`,
        size: 0,
        is_directory: true,
        modified_time: '2024-01-15T09:00:00Z',
        permissions: '755',
        file_type: 'directory',
      },
      {
        id: '2',
        name: 'readme.txt',
        path: `${path}/readme.txt`,
        size: 1024,
        is_directory: false,
        modified_time: '2024-01-15T10:00:00Z',
        permissions: '644',
        file_type: 'text',
      },
    ];

    return HttpResponse.json({ data: files });
  }),

  // WebSocket endpoint (mock endpoint for testing)
  http.get('/api/v1/ws', () => {
    return HttpResponse.json({
      message: 'WebSocket endpoint available',
      protocols: ['volumeviz-v1'],
    });
  }),

  // Search endpoints
  http.get('/api/v1/search/files', ({ request }) => {
    const url = new URL(request.url);
    const q = url.searchParams.get('q') || '';
    const page = parseInt(url.searchParams.get('page') || '1');
    const perPage = parseInt(url.searchParams.get('perPage') || '20');

    // Mock search results
    const mockFiles = [
      {
        id: 1,
        volume_id: 'test-volume',
        path: '/test/signs.txt',
        name: 'signs.txt',
        size: 1024,
        disk_usage: 1024,
        extension: 'txt',
        mime_type: 'text/plain',
        media_kind: 'text',
        modified_time: '2024-01-15T10:00:00Z',
        created_time: '2024-01-15T10:00:00Z',
      },
      {
        id: 2,
        volume_id: 'test-volume',
        path: '/test/signs.pdf',
        name: 'signs.pdf',
        size: 2048,
        disk_usage: 2048,
        extension: 'pdf',
        mime_type: 'application/pdf',
        media_kind: 'document',
        modified_time: '2024-01-14T10:00:00Z',
        created_time: '2024-01-14T10:00:00Z',
      },
    ];

    // Filter by query if provided
    const filteredFiles = q
      ? mockFiles.filter(
          (file) =>
            file.name.toLowerCase().includes(q.toLowerCase()) ||
            file.path.toLowerCase().includes(q.toLowerCase()),
        )
      : mockFiles;

    return HttpResponse.json({
      files: filteredFiles,
      total_count: filteredFiles.length,
      page,
      per_page: perPage,
      total_pages: Math.ceil(filteredFiles.length / perPage),
      query_time_ms: 5,
      filters: { q },
    });
  }),

  // Saved searches endpoints
  http.get('/api/v1/search/saved', () => {
    return HttpResponse.json({
      searches: [],
      total_count: 0,
      page: 1,
      per_page: 20,
    });
  }),

  http.post('/api/v1/search/saved', () => {
    return HttpResponse.json({
      id: 1,
      name: 'Test Search',
      description: 'A test saved search',
      query: {},
      tags: [],
      is_public: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      run_count: 0,
      last_run_at: null,
    });
  }),

  // Error simulation for testing
  http.get('/api/v1/volumes/error-test', () => {
    return HttpResponse.json(
      { error: 'Simulated server error for testing' },
      { status: 500 }
    );
  }),

  // Catch-all for unhandled requests
  http.all('*', ({ request }) => {
    console.warn(`Unhandled ${request.method} request to ${request.url}`);
    return HttpResponse.json(
      { error: 'API endpoint not mocked' },
      { status: 501 },
    );
  }),
];

// Export for individual handler testing
export { mockVolumes, mockOrganization, mockFiles };
