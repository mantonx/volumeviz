# ADR-0001: Persistence Strategy - Adopt sqlc + pgx (No ORM)

**Status:** Accepted  
**Date:** 2025-08-11  
**Author:** VolumeViz Team  

## Context

VolumeViz requires high-throughput data ingestion for file system analytics and precise queries for rollups and top-N operations across both PostgreSQL and SQLite databases. The application needs to:

- Insert millions of file entries and directory nodes efficiently
- Execute complex analytical queries with predictable performance
- Support both PostgreSQL (production) and SQLite (development/embedded) databases
- Maintain type safety between SQL queries and Go code
- Minimize abstraction overhead for performance-critical operations

The repository already uses database environments and runs migrations on startup. We need a standardized approach that maximizes performance while maintaining code quality and developer experience.

## Decision

We will adopt **sqlc** for SQL code generation and **pgx v5** for PostgreSQL connection pooling, avoiding traditional ORMs entirely.

### Key Components

1. **sqlc** - SQL compiler that generates type-safe Go code from SQL queries
2. **pgx v5** - High-performance PostgreSQL driver with native support for COPY operations
3. **modernc.org/sqlite** - Pure Go SQLite driver for development and embedded deployments
4. **Raw SQL migrations** - Direct SQL files for schema management

## Drivers

### PostgreSQL
- **Driver:** `github.com/jackc/pgx/v5`
- **Pool:** `github.com/jackc/pgx/v5/pgxpool`
- **Rationale:** Native PostgreSQL protocol implementation, superior performance for bulk operations via COPY, built-in connection pooling

### SQLite
- **Driver:** `modernc.org/sqlite`
- **Rationale:** Pure Go implementation (no CGO), good performance, compatible with standard database/sql interface

## Code Generation Layout

```
internal/store/
├── store.go                    # Store interface definition
├── postgres_store.go           # PostgreSQL implementation
├── sqlite_store.go             # SQLite implementation
├── sqlc/
│   ├── postgres/              # Generated PostgreSQL code
│   │   ├── db.go
│   │   ├── models.go
│   │   └── queries.sql.go
│   └── sqlite/                # Generated SQLite code
│       ├── db.go
│       ├── models.go
│       └── queries.sql.go
├── queries/
│   ├── postgres/              # PostgreSQL SQL files
│   │   ├── file_entries.sql
│   │   ├── dir_nodes.sql
│   │   └── analytics.sql
│   └── sqlite/                # SQLite SQL files
│       ├── file_entries.sql
│       ├── dir_nodes.sql
│       └── analytics.sql
└── migrations/
    ├── schema_postgres.sql    # PostgreSQL schema
    └── schema_sqlite.sql      # SQLite schema
```

## COPY Usage Policy

### PostgreSQL Bulk Operations
For bulk inserts exceeding 1000 rows, use `pgx.CopyFrom`:

```go
func (s *PostgresStore) BulkInsertFileEntries(ctx context.Context, entries []*FileEntry) error {
    return s.pool.CopyFrom(ctx,
        pgx.Identifier{"file_entries"},
        []string{"volume_id", "parent_dir_id", "name", "size_bytes", ...},
        pgx.CopyFromSlice(len(entries), copySource),
    )
}
```

### SQLite Bulk Operations
Use prepared statements with multi-row INSERT:

```go
INSERT INTO file_entries (volume_id, parent_dir_id, name, ...) 
VALUES (?, ?, ?, ...), (?, ?, ?, ...), ...
```

Batch size should respect SQLite's variable limit (999 parameters).

## Dialect Strategy

### Shared Queries
When queries are identical between PostgreSQL and SQLite, maintain a single version to reduce duplication.

### Dialect-Specific Queries
Maintain separate query files when:
- Using database-specific functions (e.g., PostgreSQL arrays, CTEs with different syntax)
- Optimization requires different approaches (e.g., indexes, query hints)
- Parameter placeholders differ (`$1` for PostgreSQL, `?` for SQLite)

### Type Mapping
Configure sqlc.yaml to handle type differences:
- PostgreSQL: `BIGINT` → `int64`
- SQLite: `INTEGER` → `int64`
- Both: `TEXT/VARCHAR` → `string`
- Timestamps: Use TEXT in SQLite, TIMESTAMPTZ in PostgreSQL

## Consequences

### Positive
- **Performance:** Direct SQL execution without ORM overhead
- **Type Safety:** Compile-time verification of SQL queries
- **Transparency:** SQL queries are explicit and optimizable
- **Bulk Operations:** Native support for high-performance bulk inserts
- **Debugging:** Easy to profile and optimize actual SQL

### Negative
- **Code Generation:** Requires running `sqlc generate` after query changes
- **Duplication:** Some SQL may be duplicated between dialects
- **Learning Curve:** Developers need to understand SQL deeply
- **Manual Mapping:** Complex nested structures require manual assembly

### Neutral
- **Migration Tooling:** Continue using existing migration approach
- **Testing:** Requires both PostgreSQL and SQLite test environments
- **Query Complexity:** Complex queries remain complex in SQL

## Implementation Guidelines

1. **Query Organization:** Group related queries in the same SQL file
2. **Naming Convention:** Use consistent naming for queries across dialects
3. **Comments:** Document complex queries and performance considerations
4. **Transactions:** Implement at the Store interface level, not in SQL
5. **Error Handling:** Wrap sqlc errors with context at the Store layer

## References

- [sqlc Documentation](https://docs.sqlc.dev/)
- [pgx v5 Documentation](https://github.com/jackc/pgx)
- [VolumeViz Performance Requirements](../requirements/performance.md)