# VolumeViz Development Guide

## 🚀 Quick Start

VolumeViz uses Docker for consistent development across all platforms. This guide covers the complete development workflow, tech stack integration, and best practices.

### Prerequisites

- **Docker Desktop** 4.20+ with Docker Compose v2
- **Git** for version control
- **VS Code** (recommended) with suggested extensions

### First Time Setup

```bash
# Clone the repository
git clone https://github.com/your-org/volumeviz.git
cd volumeviz

# Start all services
docker-compose -f docker-compose.dev.yml up --build

# Verify services are running
docker-compose -f docker-compose.dev.yml ps
```

### Service Access Points

- **Frontend**: http://localhost:3000 (React development server)
- **Backend API**: http://localhost:8080 (Go server with hot reload)
- **API Documentation**: http://localhost:8080/swagger/index.html
- **Storybook**: http://localhost:6006 (Component library)
- **Database**: localhost:5432 (PostgreSQL with pgAdmin at http://localhost:5050)
- **Monitoring**: Grafana at http://localhost:3001, Prometheus at http://localhost:9090

---

## 🎨 Frontend Development

### Tech Stack Overview

- **React 19** - Modern UI library with concurrent features
- **TypeScript** - Type-safe development with strict configuration
- **Jotai** - Atomic state management for reactive data flow
- **TanStack Query** - Server state management with intelligent caching
- **Orval** - Auto-generated API client from OpenAPI specs
- **Tailwind CSS** - Utility-first styling with design system
- **Vite** - Lightning-fast development and optimized builds
- **Storybook** - Component development and documentation
- **Vitest** - Unit testing with Vue ecosystem tools

### Development Workflow

```bash
# Start frontend development server
docker-compose -f docker-compose.dev.yml up frontend

# Generate API client from backend OpenAPI spec
docker-compose exec frontend npm run generate:api

# Run tests
docker-compose exec frontend npm test

# Run tests in watch mode
docker-compose exec frontend npm run test:watch

# Type checking
docker-compose exec frontend npm run type-check

# Linting and fixing
docker-compose exec frontend npm run lint
docker-compose exec frontend npm run lint:fix

# Start Storybook for component development
docker-compose exec frontend npm run storybook
```

### Component Development

VolumeViz follows a domain-driven component architecture:

```
src/components/
├── common/          # Shared business components
├── domain/          # Feature-specific components
│   ├── onboarding/
│   ├── dashboard/
│   ├── volumes/
│   ├── explorer/
│   ├── search/
│   ├── trends/
│   └── alerts/
├── layout/          # Layout components
├── ui/              # Design system components
└── visualization/   # Chart components
```

#### Creating New Components

Every component follows this structure:

```typescript
// ComponentName/ComponentName.tsx
import { ComponentNameProps } from './ComponentName.types';

export const ComponentName = ({ prop1, prop2 }: ComponentNameProps) => {
  return (
    <div className="component-name">
      {/* Component content */}
    </div>
  );
};

// ComponentName/ComponentName.types.ts
export interface ComponentNameProps {
  prop1: string;
  prop2?: number;
}

// ComponentName/index.ts
export { ComponentName } from './ComponentName';
export type { ComponentNameProps } from './ComponentName.types';
```

### State Management with Jotai

VolumeViz uses atomic state management for reactive, composable state:

```typescript
// atoms/volumes.ts
import { atom } from 'jotai';
import { VolumeResponse } from '@/api/client';

export const selectedVolumeAtom = atom<VolumeResponse | null>(null);
export const volumeFiltersAtom = atom({
  search: '',
  status: 'all' as const,
  sortBy: 'name' as const
});

// Derived atom
export const filteredVolumesAtom = atom((get) => {
  const filters = get(volumeFiltersAtom);
  // Filter logic here
});
```

### API Integration with TanStack Query + Orval

API integration is handled automatically through Orval-generated hooks:

```typescript
// Generated automatically from OpenAPI spec
import { useGetApiV1Volumes } from '@/api/orval-generated/api';

export const VolumesList = () => {
  const { 
    data: volumes, 
    isLoading, 
    error 
  } = useGetApiV1Volumes({
    page: 1,
    limit: 50
  });

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;

  return (
    <div>
      {volumes?.data.map(volume => (
        <VolumeCard key={volume.id} volume={volume} />
      ))}
    </div>
  );
};
```

### Styling with Tailwind CSS

VolumeViz uses a custom design system built on Tailwind:

```typescript
// Using design system classes
<Button 
  variant="primary" 
  size="lg"
  className="btn-primary-lg custom-spacing"
>
  Create Volume
</Button>

// Custom utility classes in globals.css
@layer components {
  .btn-primary-lg {
    @apply bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold;
  }
}
```

---

## ⚙️ Backend Development

### Tech Stack Overview

- **Go 1.24** - High-performance server with excellent concurrency
- **Gin** - Fast HTTP web framework with middleware support
- **PostgreSQL** - Primary database with advanced features
- **SQLC** - Type-safe SQL with compile-time code generation
- **golang-migrate** - Database migrations with version control
- **Swagger/OpenAPI** - API-first development with documentation
- **WebSocket** - Real-time updates via Gorilla WebSocket
- **Docker SDK** - Native container integration
- **Prometheus** - Metrics and monitoring

### Development Workflow

```bash
# Start backend development server
docker-compose -f docker-compose.dev.yml up backend

# Run tests
docker-compose exec backend go test ./...

# Run tests with coverage
docker-compose exec backend go test -cover ./...

# Generate SQLC models after database changes
docker-compose exec backend sqlc generate

# Run database migrations
docker-compose exec backend migrate -path ./migrations -database "$DATABASE_URL" up

# Generate Swagger docs
docker-compose exec backend swag init -g cmd/server/main.go -o ./docs/swagger

# Run linter
docker-compose exec backend golangci-lint run
```

### Project Structure

```
internal/
├── api/
│   └── v1/              # API handlers organized by version
├── auth/                # Authentication and authorization
├── config/              # Configuration management
├── db/
│   ├── migrations/      # Database migrations
│   ├── queries/         # SQLC query definitions
│   └── sqlc/           # Generated SQLC code
├── middleware/          # HTTP middleware
├── models/             # Data models and DTOs
├── services/           # Business logic services
├── store/              # Database repository layer
└── websocket/          # WebSocket handlers
```

### Database Development with SQLC

VolumeViz uses SQLC for type-safe database operations:

```sql
-- queries/volumes.sql
-- name: GetVolume :one
SELECT * FROM volumes WHERE id = $1;

-- name: ListVolumes :many
SELECT * FROM volumes 
WHERE organization_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: CreateVolume :one
INSERT INTO volumes (name, path, organization_id)
VALUES ($1, $2, $3)
RETURNING *;
```

Generated Go code:

```go
// Generated by SQLC
func (q *Queries) GetVolume(ctx context.Context, id string) (Volume, error) {
    row := q.db.QueryRowContext(ctx, getVolume, id)
    // ...
}

// Usage in service layer
func (s *VolumeService) GetVolume(ctx context.Context, id string) (*models.Volume, error) {
    volume, err := s.store.GetVolume(ctx, id)
    if err != nil {
        return nil, fmt.Errorf("failed to get volume: %w", err)
    }
    return &models.Volume{
        ID:   volume.ID,
        Name: volume.Name,
        // Map other fields
    }, nil
}
```

### API Development with Swagger

All endpoints are documented with Swagger annotations:

```go
// @Summary Get volume details
// @Description Retrieve detailed information about a specific volume
// @Tags volumes
// @Accept json
// @Produce json
// @Param id path string true "Volume ID"
// @Success 200 {object} models.VolumeResponse
// @Failure 404 {object} models.ErrorResponse
// @Router /api/v1/volumes/{id} [get]
func (h *VolumeHandler) GetVolume(c *gin.Context) {
    id := c.Param("id")
    
    volume, err := h.service.GetVolume(c.Request.Context(), id)
    if err != nil {
        c.JSON(http.StatusNotFound, models.ErrorResponse{
            Error: "Volume not found",
        })
        return
    }
    
    c.JSON(http.StatusOK, volume)
}
```

### Real-time Updates with WebSocket

WebSocket connections provide real-time updates:

```go
// WebSocket handler for volume updates
func (h *WebSocketHandler) HandleVolumeUpdates(conn *websocket.Conn) {
    defer conn.Close()
    
    // Subscribe to volume events
    events := h.eventService.Subscribe("volume_events")
    defer h.eventService.Unsubscribe(events)
    
    for event := range events {
        if err := conn.WriteJSON(event); err != nil {
            log.Printf("WebSocket write error: %v", err)
            break
        }
    }
}
```

---

## 🗄️ Database Development

### Migration Management

VolumeViz uses golang-migrate for database versioning:

```bash
# Create new migration
docker-compose exec backend migrate create -ext sql -dir migrations add_volume_tags

# Apply migrations
docker-compose exec backend migrate -path ./migrations -database "$DATABASE_URL" up

# Rollback migrations
docker-compose exec backend migrate -path ./migrations -database "$DATABASE_URL" down 1
```

### Multi-tenancy Support

All tables support organization-level data isolation:

```sql
-- Example table with multi-tenancy
CREATE TABLE volumes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    path TEXT NOT NULL,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Row Level Security (RLS) for data isolation
ALTER TABLE volumes ENABLE ROW LEVEL SECURITY;
CREATE POLICY volumes_org_policy ON volumes 
FOR ALL USING (organization_id = current_setting('app.current_org_id')::UUID);
```

---

## 🧪 Testing Strategy

### Frontend Testing

```bash
# Unit tests with Vitest
docker-compose exec frontend npm run test

# Coverage report
docker-compose exec frontend npm run test:coverage

# E2E tests with Cypress
docker-compose exec frontend npm run cypress:run
```

### Backend Testing

```bash
# Unit tests
docker-compose exec backend go test ./...

# Integration tests
docker-compose exec backend go test -tags=integration ./...

# Test with race detection
docker-compose exec backend go test -race ./...
```

### Testing Patterns

```go
// Table-driven tests
func TestVolumeService_GetVolume(t *testing.T) {
    tests := []struct {
        name    string
        volumeID string
        want    *models.Volume
        wantErr bool
    }{
        {
            name:     "existing volume",
            volumeID: "vol-123",
            want:     &models.Volume{ID: "vol-123", Name: "test-volume"},
            wantErr:  false,
        },
        {
            name:     "non-existent volume",
            volumeID: "vol-404",
            want:     nil,
            wantErr:  true,
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            got, err := svc.GetVolume(ctx, tt.volumeID)
            if (err != nil) != tt.wantErr {
                t.Errorf("GetVolume() error = %v, wantErr %v", err, tt.wantErr)
            }
            if !reflect.DeepEqual(got, tt.want) {
                t.Errorf("GetVolume() = %v, want %v", got, tt.want)
            }
        })
    }
}
```

---

## 📚 Documentation

### Storybook for Component Documentation

```bash
# Start Storybook
docker-compose exec frontend npm run storybook

# Build static Storybook
docker-compose exec frontend npm run build-storybook
```

Example story:

```typescript
// VolumeCard.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { VolumeCard } from './VolumeCard';

const meta: Meta<typeof VolumeCard> = {
  title: 'Domain/Volumes/VolumeCard',
  component: VolumeCard,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    volume: {
      id: 'vol-123',
      name: 'app-data',
      size: 1073741824, // 1GB
      status: 'active',
    },
  },
};
```

### API Documentation

The API is automatically documented via Swagger/OpenAPI:

- Interactive docs: http://localhost:8080/swagger/index.html
- OpenAPI spec: http://localhost:8080/swagger/doc.json
- Auto-generated frontend client via Orval

---

## 🔧 Development Tools

### VS Code Extensions

Recommended extensions for optimal development experience:

```json
{
  "recommendations": [
    "golang.go",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-typescript-next",
    "esbenp.prettier-vscode",
    "ms-vscode-remote.remote-containers",
    "github.copilot"
  ]
}
```

### Pre-commit Hooks

Quality gates enforced before commits:

```yaml
# .pre-commit-config.yaml
repos:
  - repo: local
    hooks:
      - id: go-test
        name: go test
        entry: docker-compose exec backend go test ./...
        language: system
        pass_filenames: false
      
      - id: frontend-typecheck
        name: TypeScript check
        entry: docker-compose exec frontend npm run type-check
        language: system
        pass_filenames: false
```

---

## 🚀 Production Deployment

### Environment Configuration

```bash
# Production environment variables
export DB_TYPE=postgres
export DB_HOST=prod-db.example.com
export DB_SSL_MODE=require
export REDIS_URL=redis://prod-redis.example.com
export API_BASE_URL=https://api.volumeviz.com
export FRONTEND_URL=https://volumeviz.com
```

### Docker Production Builds

```bash
# Build production images
docker-compose -f docker-compose.prod.yml build

# Deploy with production configuration
docker-compose -f docker-compose.prod.yml up -d
```

### Health Checks

Built-in health endpoints for monitoring:

```bash
# Backend health
curl http://localhost:8080/health

# Database health
curl http://localhost:8080/health/db

# System status
curl http://localhost:8080/health/system
```

---

## 🤝 Contributing

### Code Standards

- **Go**: Follow effective Go principles, use gofmt and golangci-lint
- **TypeScript**: Strict mode enabled, ESLint + Prettier for consistency
- **Git**: Conventional commits with semantic versioning
- **Testing**: All new features require tests with >80% coverage
- **Documentation**: Update relevant docs for API/component changes

### Pull Request Process

1. Fork and create feature branch from `main`
2. Make changes following code standards
3. Add/update tests for new functionality
4. Update documentation if needed
5. Ensure all CI checks pass
6. Submit PR with clear description

### Getting Help

- **Documentation**: Check [docs/](../README.md) for detailed guides
- **API Questions**: Review Swagger docs at `/swagger/index.html`
- **Component Questions**: Check Storybook at http://localhost:6006
- **Issues**: Create GitHub issues for bugs or feature requests

---

## 📈 Performance Optimization

### Frontend Performance

- **Code Splitting**: Route-level lazy loading implemented
- **Bundle Analysis**: `npm run build:analyze` for size optimization
- **Caching**: TanStack Query provides intelligent server state caching
- **Virtualization**: Large lists use react-window for performance

### Backend Performance

- **Database**: Connection pooling and query optimization
- **Caching**: Redis for session and frequently accessed data
- **Monitoring**: Prometheus metrics for performance tracking
- **Profiling**: pprof endpoints available for performance analysis

---

This development guide provides a comprehensive overview of the VolumeViz tech stack and development workflow. For specific implementation details, refer to the [Architecture Documentation](../ARCHITECTURE.md) and individual component documentation in Storybook.