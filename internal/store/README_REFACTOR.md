# Store Package Refactoring

This document describes the reorganization of the store package to improve maintainability and separation of concerns.

## Overview

The original store package had become unwieldy with:
- 8669 lines of code across 16 files
- A monolithic interface with 40+ methods
- Mixed concerns (file analytics, Docker metadata, usage snapshots)
- Massive implementation files (1200+ lines each)

## New Structure

### Organized by Domain

```
internal/store/
├── interfaces/           # Focused interfaces
│   ├── files.go         # FileStore - file entry operations
│   ├── directories.go   # DirectoryStore, RollupStore - directory operations
│   ├── docker.go        # DockerStore - volume/container/mount operations
│   ├── analytics.go     # AnalyticsStore - usage snapshots & trends
│   ├── infrastructure.go # InfrastructureStore - transactions, health
│   └── store.go         # Main Store interface (combines all)
├── models/              # Data models with constructors
│   └── models.go        # All model types and helper functions
├── composite/           # Backward-compatible composite implementation
│   └── store.go         # CompositeStore that implements Store interface
├── postgres/            # PostgreSQL-specific implementations
├── sqlite/              # SQLite-specific implementations
└── store_v2.go          # Backward compatibility exports
```

## Interface Separation

### Before (1 interface, 40+ methods)
```go
type Store interface {
    // File operations (10 methods)
    CreateFileEntry(...)
    GetFileEntry(...)
    // ... 8 more
    
    // Directory operations (12 methods)  
    CreateDirNode(...)
    GetDirNode(...)
    // ... 10 more
    
    // Docker operations (12 methods)
    UpsertVolume(...)
    UpsertContainer(...)
    // ... 10 more
    
    // Analytics operations (8 methods)
    Rollup(...)
    CreateUsageSnapshot(...)
    // ... 6 more
    
    // Infrastructure (6 methods)
    Tx(...)
    Health(...)
    // ... 4 more
}
```

### After (6 focused interfaces)
```go
type FileStore interface {
    // 10 focused file operations
}

type DirectoryStore interface {
    // 9 focused directory operations  
}

type RollupStore interface {
    // 9 focused rollup operations
}

type DockerStore interface {
    // 12 focused Docker operations
}

type AnalyticsStore interface {
    // 8 focused analytics operations
}

type InfrastructureStore interface {
    // 6 focused infrastructure operations
}

type Store interface {
    // Combines all interfaces for backward compatibility
    FileStore
    DirectoryStore  
    RollupStore
    DockerStore
    AnalyticsStore
    InfrastructureStore
}
```

## Backward Compatibility

### Existing Code Works Unchanged
```go
// This still works exactly the same
var store Store = NewSQLiteStore(config)
err := store.CreateFileEntry(ctx, entry)
```

### New Code Can Use Focused Interfaces
```go
// New code can use focused interfaces
var fileStore FileStore = getFileStore()
var dockerStore DockerStore = getDockerStore()

// Better testability - mock only what you need
func ProcessFiles(fs FileStore) {
    // Only needs file operations
}
```

## Migration Benefits

1. **Single Responsibility**: Each interface has one clear purpose
2. **Easier Testing**: Mock only the interface you need
3. **Better Composition**: Combine different implementations
4. **Reduced Coupling**: Dependencies are more explicit
5. **Maintainability**: Smaller, focused files
6. **Backward Compatible**: No breaking changes to existing code

## Implementation Strategy

The refactoring maintains full backward compatibility:
1. All existing imports continue to work
2. All existing method signatures unchanged  
3. CompositeStore provides the unified interface
4. Individual implementations can be optimized separately

## Next Steps

1. ✅ Create focused interfaces
2. ✅ Extract and organize models
3. ✅ Create composite store for compatibility
4. 🔄 Split implementation files by domain
5. 📋 Update specific store implementations
6. 📋 Add comprehensive tests for each interface

This refactoring makes the codebase more maintainable while preserving all existing functionality.