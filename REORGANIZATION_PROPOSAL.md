# VolumeViz Code Reorganization Proposal

## Current Issues

1. **Duplicate Namespaces**: We have both `/internal/core/*` and `/internal/*` directories with similar purposes
2. **Unclear Boundaries**: It's not clear when to use `core` vs root `internal` directories
3. **Mixed Concerns**: Business logic, infrastructure, and API concerns are intermingled
4. **Inconsistent Patterns**: Some services are in `core/services`, others in `services`

## Proposed Structure

```
internal/
├── domain/           # Core business logic (pure, no external dependencies)
│   ├── models/       # Domain models (Volume, Scan, Stats, etc.)
│   ├── interfaces/   # Domain interfaces (repository contracts, service contracts)
│   └── errors/       # Domain-specific errors
│
├── application/      # Application services (orchestration, use cases)
│   ├── scanner/      # Volume scanning service
│   ├── stats/        # Statistics service
│   ├── enrichers/    # Media enrichment services
│   ├── lifecycle/    # Volume lifecycle management
│   └── snapshots/    # Snapshot management
│
├── infrastructure/   # External concerns and implementations
│   ├── database/     # Database layer
│   │   ├── sqlc/     # Generated SQLC code
│   │   ├── migrations/ # Migration files
│   │   └── connect.go # Connection management
│   ├── repository/   # Repository implementations
│   │   ├── postgres/ # PostgreSQL implementations
│   │   └── queries/  # SQL query files
│   ├── store/        # Transaction orchestration layer
│   ├── docker/       # Docker client implementation
│   ├── cache/        # Caching implementations
│   ├── metrics/      # Metrics collectors (Prometheus, etc.)
│   └── events/       # Event system implementation
│
├── interfaces/       # Delivery mechanisms (HTTP, WebSocket, etc.)
│   ├── http/         # HTTP API
│   │   ├── v1/       # API v1 handlers
│   │   │   ├── health/
│   │   │   ├── scan/
│   │   │   ├── trends/
│   │   │   └── volumes/
│   │   ├── middleware/
│   │   ├── models/   # API-specific models (requests/responses)
│   │   └── utils/    # API utilities
│   ├── websocket/    # WebSocket handlers
│   └── realtime/     # Real-time updates
│
├── scheduler/        # Background job scheduling
├── config/           # Configuration management
├── utils/            # Shared utilities
└── version/          # Version information
```

## Migration Plan

### Phase 1: Create New Structure
```bash
# Create domain layer
mkdir -p internal/domain/{models,interfaces,errors}

# Create application layer
mkdir -p internal/application/{scanner,stats,enrichers,lifecycle,snapshots}

# Create infrastructure layer
mkdir -p internal/infrastructure/{database,repository,store,docker,cache,metrics,events}
mkdir -p internal/infrastructure/database/{sqlc,migrations}
mkdir -p internal/infrastructure/repository/{postgres,queries}

# Rename interfaces to be clearer about HTTP
mkdir -p internal/interfaces/http
```

### Phase 2: Move Files (Proposed Mapping)

#### Domain Layer
- `internal/models/*` → `internal/domain/models/`
- `internal/core/interfaces/*` → `internal/domain/interfaces/`
- Create domain-specific error types in `internal/domain/errors/`

#### Application Layer
- `internal/core/services/scanner/*` → `internal/application/scanner/`
- `internal/services/stats_service.go` → `internal/application/stats/`
- `internal/services/enrichers/*` → `internal/application/enrichers/`
- `internal/services/lifecycle/*` → `internal/application/lifecycle/`
- `internal/services/snapshots/*` → `internal/application/snapshots/`

#### Infrastructure Layer
- `internal/db/*` → `internal/infrastructure/database/`
- `internal/repo/*` → `internal/infrastructure/repository/postgres/`
- `internal/repo/queries/*` → `internal/infrastructure/repository/queries/`
- `internal/store/*` → `internal/infrastructure/store/`
- `internal/core/services/cache/*` → `internal/infrastructure/cache/`
- `internal/core/services/metrics/*` → `internal/infrastructure/metrics/`
- `internal/events/*` → `internal/infrastructure/events/`
- `pkg/docker/*` → `internal/infrastructure/docker/`

#### Interfaces Layer
- `internal/api/*` → `internal/interfaces/http/`
- `internal/websocket/*` → `internal/interfaces/websocket/`
- `internal/realtime/*` → `internal/interfaces/realtime/`

### Phase 3: Update Imports
Update all import paths throughout the codebase to reflect the new structure.

### Phase 4: Clean Up
- Remove empty `internal/core` directory
- Remove duplicate `internal/interfaces` directory
- Update documentation to reflect new structure

## Benefits

1. **Clear Separation of Concerns**: Each layer has a specific responsibility
2. **Dependency Rule**: Dependencies only point inward (interfaces → application → domain)
3. **Testability**: Domain logic is pure and easily testable
4. **Maintainability**: Easy to find where specific functionality lives
5. **Scalability**: Easy to add new delivery mechanisms or infrastructure implementations

## Implementation Order

1. Start with domain models (least dependencies)
2. Move infrastructure components
3. Move application services
4. Move interface/API layers
5. Update configuration and utilities

## Notes

- This follows Clean Architecture/Hexagonal Architecture principles
- The `domain` layer has no external dependencies
- The `application` layer orchestrates domain logic
- The `infrastructure` layer handles all external concerns
- The `interfaces` layer handles all delivery mechanisms

## Alternative Considerations

If this seems too drastic, a simpler approach would be:

```
internal/
├── models/        # All models
├── services/      # All services
├── repository/    # All repositories
├── api/          # All API handlers
├── infrastructure/ # Database, cache, metrics, etc.
├── scheduler/    # Background jobs
└── config/       # Configuration
```

But this loses some of the benefits of the layered architecture.