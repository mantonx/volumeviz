# VolumeViz Transactions & Timeouts Policy

This document outlines the comprehensive transaction management and timeout policy implemented in VolumeViz to ensure consistent, reliable database operations.

## Overview

VolumeViz implements a standardized transaction pattern using helper methods that provide:
- ✅ Automatic rollback/commit handling
- ✅ Context-aware timeout management  
- ✅ Consistent error handling
- ✅ Prevention of common transaction pitfalls
- ✅ Database-specific optimizations

## Transaction Helpers

### Database Layer (`internal/database`)

#### Core Transaction Methods

```go
// General transaction with default 30s timeout
db.Tx(ctx, opts, func(ctx context.Context, tx *sql.Tx) error {
    // Your transaction logic here
    return nil
})

// Transaction with custom timeout
db.TxWithTimeout(ctx, 10*time.Second, func(ctx context.Context, tx *sql.Tx) error {
    // Your transaction logic here
    return nil
})

// Read-only transaction (15s timeout, optimizations enabled)
db.ReadOnlyTx(ctx, func(ctx context.Context, tx *sql.Tx) error {
    // Read-only operations
    return nil
})

// Fast transaction for simple operations (5s timeout)
db.FastTx(ctx, func(ctx context.Context, tx *sql.Tx) error {
    // Quick writes
    return nil
})

// Bulk transaction for complex operations (5min timeout)
db.BulkTx(ctx, func(ctx context.Context, tx *sql.Tx) error {
    // Bulk operations
    return nil
})
```

### Store Layer (`internal/store`)

```go
// Store-level transaction helpers
store.Tx(ctx, func(ctx context.Context, txStore Store) error {
    // Use txStore for all operations within transaction
    return nil
})

store.FastTx(ctx, func(ctx context.Context, txStore Store) error {
    // Quick store operations
    return nil
})

store.BulkTx(ctx, func(ctx context.Context, txStore Store) error {
    // Bulk store operations  
    return nil
})
```

## Default Timeouts

| Operation Type | Timeout | Use Case |
|---------------|---------|----------|
| `DefaultQueryTimeout` | 15s | SELECT queries |
| `DefaultWriteTimeout` | 10s | INSERT/UPDATE/DELETE |
| `DefaultBulkTimeout` | 2min | Bulk operations |
| `DefaultTxTimeout` | 30s | General transactions |
| `DefaultStatementTimeout` | 30s | Individual statements |

## Usage Guidelines

### ✅ Preferred Patterns

```go
// ✅ Use transaction helpers
func (r *Repository) SaveData(ctx context.Context, data *Data) error {
    return r.db.FastTx(ctx, func(ctx context.Context, tx *sql.Tx) error {
        _, err := tx.ExecContext(ctx, "INSERT INTO data (value) VALUES (?)", data.Value)
        return err
    })
}

// ✅ Use appropriate timeouts
func (r *Repository) BulkImport(ctx context.Context, items []Item) error {
    return r.db.BulkTx(ctx, func(ctx context.Context, tx *sql.Tx) error {
        for _, item := range items {
            _, err := tx.ExecContext(ctx, "INSERT INTO items (name) VALUES (?)", item.Name)
            if err != nil {
                return err
            }
        }
        return nil
    })
}

// ✅ Store-level transactions
func (s *Service) CreateSnapshot(ctx context.Context, params CreateParams) error {
    return s.store.Tx(ctx, func(ctx context.Context, txStore Store) error {
        snapshot, err := txStore.CreateUsageSnapshot(ctx, params.ToSnapshot())
        if err != nil {
            return err
        }
        
        return txStore.UpdateVolumeStats(ctx, params.VolumeID, snapshot.TotalSize)
    })
}
```

### ❌ Anti-patterns (Will be caught by linter)

```go
// ❌ BAD: Bare transaction usage
func (r *Repository) BadSaveData(ctx context.Context, data *Data) error {
    tx, err := r.db.Begin() // ⚠️ Linter will flag this
    if err != nil {
        return err
    }
    defer func() {
        if err != nil {
            tx.Rollback() // ⚠️ Error-prone pattern
        }
    }()
    
    _, err = tx.ExecContext(ctx, "INSERT INTO data (value) VALUES (?)", data.Value)
    if err != nil {
        return err
    }
    
    return tx.Commit() // ⚠️ Can forget this
}

// ❌ BAD: No timeout handling
func (r *Repository) BadQuery(ctx context.Context) error {
    rows, err := r.db.Query("SELECT * FROM large_table") // ⚠️ No timeout
    // ...
}
```

## Timeout Configuration

### Database-Specific Timeouts

**PostgreSQL:**
```sql
SET statement_timeout = 30000;        -- 30s per statement
SET lock_timeout = 15000;             -- 15s for lock acquisition  
SET idle_in_transaction_session_timeout = 60000; -- 60s idle limit
```

**SQLite:**
```sql  
PRAGMA busy_timeout = 30000;          -- 30s busy timeout
```

### Context Timeouts

All database operations should use context-aware methods:

```go
// Query with timeout
rows, err := db.QueryContextWithTimeout(ctx, 15*time.Second, query, args...)

// Execute with timeout  
result, err := db.ExecContextWithTimeout(ctx, 10*time.Second, query, args...)

// Single row with timeout
row := db.QueryRowContextWithTimeout(ctx, 5*time.Second, query, args...)
```

## Linting & Enforcement

### Transaction Linter

Run the transaction linter to detect bare transaction usage:

```bash
# Lint entire codebase
make lint-transactions

# Lint specific directory
go run cmd/lint-transactions/main.go ./internal/api/

# Lint single file
go run cmd/lint-transactions/main.go ./internal/database/repository.go
```

### Common Violations Detected

The linter flags these patterns:
- `tx, err := db.Begin()`
- `tx, err := db.BeginTx(ctx, nil)`
- Assignment to variables named `tx`, `transaction`, etc.
- Manual `defer tx.Rollback()` patterns

### CI Integration

Add to CI pipeline:
```yaml
- name: Lint Transactions
  run: make lint-transactions
```

## Testing

### Transaction Helper Tests

```go
func TestTransactionHelper(t *testing.T) {
    db := setupTestDB(t)
    
    // Test successful transaction
    err := db.FastTx(context.Background(), func(ctx context.Context, tx *sql.Tx) error {
        _, err := tx.ExecContext(ctx, "INSERT INTO test (value) VALUES (?)", "test")
        return err
    })
    require.NoError(t, err)
    
    // Test rollback on error
    err = db.FastTx(context.Background(), func(ctx context.Context, tx *sql.Tx) error {
        _, err := tx.ExecContext(ctx, "INSERT INTO test (value) VALUES (?)", "test")
        if err != nil {
            return err
        }
        return fmt.Errorf("force rollback")
    })
    require.Error(t, err)
    // Data should be rolled back
}
```

## Best Practices

### 1. Choose Appropriate Transaction Type

- **FastTx**: Simple single-table operations (< 5s)
- **Tx/TxWithTimeout**: Standard multi-step operations (< 30s)  
- **BulkTx**: Complex operations, bulk imports (< 5min)
- **ReadOnlyTx**: Read-heavy operations with consistency needs

### 2. Error Handling

```go
return db.Tx(ctx, func(ctx context.Context, tx *sql.Tx) error {
    // Return errors immediately - transaction will auto-rollback
    if err := step1(tx); err != nil {
        return fmt.Errorf("step1 failed: %w", err)
    }
    
    if err := step2(tx); err != nil {
        return fmt.Errorf("step2 failed: %w", err)  
    }
    
    // Success - transaction will auto-commit
    return nil
})
```

### 3. Context Propagation

Always propagate context through transaction operations:

```go
func (s *Service) Operation(ctx context.Context) error {
    return s.db.Tx(ctx, func(ctx context.Context, tx *sql.Tx) error {
        // Use the context from transaction function parameter
        return s.doWork(ctx, tx)
    })
}
```

### 4. Nested Transactions

Store-level transactions can be nested when using the Store interface:

```go
return store.Tx(ctx, func(ctx context.Context, outerStore Store) error {
    // This works - inner transaction will reuse the outer transaction
    return outerStore.FastTx(ctx, func(ctx context.Context, innerStore Store) error {
        // Operations here are part of the same transaction
        return nil
    })
})
```

## Migration Guide

### From Bare Transactions

**Before:**
```go
tx, err := db.BeginTx()
if err != nil {
    return err
}
defer func() {
    if err != nil {
        tx.Rollback()
    }
}()
// ... operations ...
return tx.Commit()
```

**After:**
```go
return db.Tx(ctx, func(ctx context.Context, tx *sql.Tx) error {
    // ... operations ...
    return nil
})
```

### Integration Steps

1. **Replace bare transactions** with helper methods
2. **Add context parameters** to all database operations  
3. **Set appropriate timeouts** based on operation complexity
4. **Run transaction linter** to catch remaining issues
5. **Add tests** for transaction behavior
6. **Update CI pipeline** to enforce policy

## Monitoring & Observability

### Metrics to Track

- Transaction duration by type (FastTx, Tx, BulkTx)
- Transaction success/failure rates
- Timeout occurrences
- Lock wait times
- Connection pool utilization

### Logging

Transaction helpers automatically log:
- Transaction start/commit/rollback
- Timeout events  
- Error conditions with context

## Database-Specific Considerations

### PostgreSQL
- Uses connection pooling for better concurrent transaction handling
- Supports advanced isolation levels
- Has sophisticated lock management

### SQLite  
- Single-writer model requires careful transaction coordination
- WAL mode enabled for better concurrency
- Busy timeout configured for lock contention

## Troubleshooting

### Common Issues

1. **Context Deadline Exceeded**
   - Increase timeout for operation type
   - Check for long-running queries
   - Verify database performance

2. **Transaction Rollback**  
   - Check error logs for root cause
   - Verify constraint violations
   - Look for deadlock conditions

3. **Connection Pool Exhaustion**
   - Monitor active transaction count
   - Check for leaked transactions (shouldn't happen with helpers)
   - Verify connection pool configuration

### Debug Tools

```bash
# Check for transaction violations
make lint-transactions

# Run transaction tests
go test ./internal/database/... -run TestTransaction

# Profile database operations  
go test -bench=BenchmarkTransaction ./internal/database/...
```

---

This transaction policy ensures consistent, reliable database operations across VolumeViz while preventing common transaction management pitfalls through automated helpers and linting enforcement.