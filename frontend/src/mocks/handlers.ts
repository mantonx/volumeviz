import { http, HttpResponse } from 'msw';

// Simplified mock types to avoid import issues
interface MockVolume {
  id: number;
  name: string;
  driver: 'local' | 'nfs' | 'cifs' | 'overlay2';
  mount_point: string;
  status: 'active' | 'inactive' | 'error';
  size_bytes?: number;
  used_bytes?: number;
  available_bytes?: number;
  created_at: string;
  last_scanned?: string;
  scan_progress?: number;
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

// Mock data
const mockVolumes: MockVolume[] = [
  {
    id: 1,
    name: 'Data Drive',
    driver: 'local',
    mount_point: '/mnt/data',
    status: 'active',
    size_bytes: 1000000000000, // 1TB
    used_bytes: 500000000000, // 500GB
    available_bytes: 500000000000, // 500GB
    created_at: '2024-01-01T00:00:00Z',
    last_scanned: '2024-01-15T10:30:00Z',
  },
  {
    id: 2,
    name: 'Backup Drive',
    driver: 'local',
    mount_point: '/mnt/backup',
    status: 'active',
    size_bytes: 2000000000000, // 2TB
    used_bytes: 800000000000, // 800GB
    available_bytes: 1200000000000, // 1.2TB
    created_at: '2024-01-01T00:00:00Z',
    last_scanned: '2024-01-14T08:00:00Z',
    scan_progress: 65,
  },
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

// API handlers
export const handlers = [
  // Health endpoints
  http.get('/api/v1/health', () => {
    const health: MockHealthStatus = {
      status: 'healthy',
      database: 'connected',
      websocket: 'connected',
      version: '1.2.0',
      timestamp: new Date().toISOString(),
    };
    return HttpResponse.json(health);
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

  // Volume endpoints
  http.get('/api/v1/volumes', ({ request }) => {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const status = url.searchParams.get('status');

    let filteredVolumes = mockVolumes;
    if (status) {
      filteredVolumes = mockVolumes.filter((v) => v.status === status);
    }

    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedVolumes = filteredVolumes.slice(startIndex, endIndex);

    return HttpResponse.json({
      data: paginatedVolumes,
      pagination: {
        page,
        limit,
        total: filteredVolumes.length,
        total_pages: Math.ceil(filteredVolumes.length / limit),
        has_next: endIndex < filteredVolumes.length,
        has_prev: page > 1,
      },
    });
  }),

  http.get('/api/v1/volumes/:id', ({ params }) => {
    const volumeId = parseInt(params.id as string);
    const volume = mockVolumes.find((v) => v.id === volumeId);
    if (!volume) {
      return HttpResponse.json({ error: 'Volume not found' }, { status: 404 });
    }

    const volumeDetails = {
      ...volume,
      file_count: 12450,
      directory_count: 890,
      largest_files: [
        {
          id: '1',
          name: 'backup.tar.gz',
          path: '/mnt/data/backup.tar.gz',
          size: 5000000000, // 5GB
          modified_time: '2024-01-14T15:30:00Z',
          file_type: 'archive',
          permissions: '644',
          is_directory: false,
        },
      ],
      recent_changes: [],
      scan_history: [],
    };

    return HttpResponse.json(volumeDetails);
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

  // Scan endpoints
  http.post('/api/v1/volumes/:id/scan', ({ params }) => {
    const volumeId = parseInt(params.id as string);
    const volume = mockVolumes.find((v) => v.id === volumeId);
    if (!volume) {
      return HttpResponse.json({ error: 'Volume not found' }, { status: 404 });
    }
    volume.scan_progress = 0;
    return HttpResponse.json({
      message: 'Scan started',
      scan_id: 'scan_123',
    });
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

  // Catch-all for unhandled requests
  http.all('*', ({ request }) => {
    console.warn(`Unhandled ${request.method} request to ${request.url}`);
    return HttpResponse.json(
      { error: 'API endpoint not mocked' },
      { status: 501 },
    );
  }),
];
