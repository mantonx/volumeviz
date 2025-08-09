# VolumeViz Frontend

Modern React frontend for VolumeViz Docker volume management and monitoring platform.

## Application Scope

VolumeViz focuses exclusively on Docker volume management and monitoring. The application provides:

- **Dashboard**: System overview and volume statistics
- **Volumes**: Complete volume management with search, filtering, and pagination  
- **Real-time**: Live volume monitoring and scanning
- **Analytics**: Historical data analysis and trends
- **System Health**: API status and system diagnostics
- **Settings**: Application configuration

Container, network, and log management are not implemented in this volume-focused MVP.

## Architecture

- **Framework**: React 18 + TypeScript  
- **Build Tool**: Vite
- **State Management**: Jotai atoms
- **Styling**: TailwindCSS + Headless UI
- **API Client**: Auto-generated from OpenAPI specs
- **Testing**: Vitest + React Testing Library
- **Icons**: Lucide React

## API Integration

### Volume API v1

The frontend integrates with the VolumeViz v1 API using auto-generated TypeScript clients:

```typescript
// Generated API client with full type safety
import { Api } from '@/api/generated/volumeviz-api';

// Paginated volume listing with search, sorting, filtering
const response = await volumeVizApi.volumes.listVolumes({
  page: 1,
  page_size: 25,
  sort: 'name:asc',
  q: 'searchQuery',
  driver: 'local',
  orphaned: false,
  system: false
});
```

### Key Features

**Pagination & Sorting**: Full server-side pagination with multi-field sorting
```typescript
// Sort by multiple fields
sort: 'size_bytes:desc,name:asc'

// Supported sort fields
- name (volume name)  
- driver (volume driver type)
- created_at (creation date)
- size_bytes (volume size)
- attachments_count (container usage)
```

**Advanced Filtering**: Server-side filtering with multiple criteria
```typescript
// Filter parameters
q: string              // Search query (name & labels)
driver: string         // Exact driver match  
orphaned: boolean      // Volumes with no containers
system: boolean        // Include system volumes
created_after: string  // ISO date filter
created_before: string // ISO date filter
```

**Error Handling**: Uniform error responses with user-friendly messages
```typescript
// API error format
{
  error: {
    code: "VALIDATION_ERROR",
    message: "Invalid sort field",
    details: { allowed_fields: ["name", "driver"] },
    request_id: "req_123456"
  }
}
```

## State Management

### Jotai Atoms

The application uses Jotai for state management with focused atoms:

```typescript
// Volume state
export const volumesAtom = atom<Volume[]>([]);
export const volumesLoadingAtom = atom<boolean>(false);
export const volumesPaginationMetaAtom = atom<PaginationMeta>({
  page: 1,
  pageSize: 25, 
  total: 0
});

// Computed state
export const filteredVolumesAtom = atom((get) => {
  // Client-side filtering logic
});
```

### Service Hooks

Type-safe service hooks manage API interactions:

```typescript
// Volume management
const { volumes, loading, error, paginationMeta, fetchVolumes } = useVolumes();

// Volume scanning  
const { scanVolume, scanResults, scanLoading } = useVolumeScanning();

// Bulk operations
const { bulkScan } = useBulkOperations();
```

## Components

### Volume Management

- **VolumesPage**: Main volume listing with pagination/search/filters
- **VolumeCard**: Individual volume display with actions
- **VolumeList**: Reusable volume list component with layouts
- **VolumeSearch**: Search input with real-time filtering
- **FilterChips**: Active filter display and management

### UI Components

- **Button**: Consistent button styling with variants
- **Card**: Content containers with proper spacing
- **Badge**: Status indicators (active, orphaned, system)
- **ErrorBoundary**: Graceful error handling

## Development

### Setup

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run in development mode with backend
VITE_API_URL=http://localhost:8080/api/v1 npm run dev
```

### Code Generation

API clients are auto-generated from OpenAPI specs:

```bash
# Regenerate API client (run from project root)
npm run generate-client

# Generated files
src/api/generated/volumeviz-api.ts  # Full API client
```

### Testing

```bash
# Run tests
npm test

# Test with coverage
npm run test:coverage

# Type checking
npm run type-check
```

### Building

```bash
# Production build
npm run build

# Preview build
npm run preview
```

## Environment Variables

```bash
# API Configuration
VITE_API_URL=http://localhost:8080/api/v1

# Feature Flags
VITE_ENABLE_WEBSOCKET=false
VITE_ENABLE_POLLING=true
VITE_POLLING_INTERVAL=30000

# Development
VITE_ENABLE_DEBUG=false
```

## Performance

- **Pagination**: Server-side pagination reduces initial load
- **Lazy Loading**: Components loaded on demand
- **Memoization**: React.memo and useMemo for expensive operations  
- **Debounced Search**: Prevents excessive API calls
- **Error Boundaries**: Prevent cascading failures

## Browser Support

- Chrome 90+
- Firefox 88+  
- Safari 14+
- Edge 90+

## Contributing

1. Follow TypeScript best practices
2. Use Jotai atoms for state management  
3. Implement proper error handling
4. Add tests for new features
5. Follow existing component patterns

See [CONTRIBUTING.md](../CONTRIBUTING.md) for detailed guidelines.
