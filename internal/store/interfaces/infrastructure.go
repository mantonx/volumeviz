package interfaces

import (
	"context"
	"time"
)

// TxFunc is a function that executes within a transaction
type TxFunc func(ctx context.Context, tx TransactionalStore) error

// TransactionalStore represents a store that can participate in transactions
type TransactionalStore interface {
	FileStore
	DirectoryStore
	RollupStore
	DockerStore
	AnalyticsStore
}

// InfrastructureStore handles connection, transaction, and health operations
type InfrastructureStore interface {
	// Transaction management
	Tx(ctx context.Context, fn TxFunc) error
	TxWithTimeout(ctx context.Context, timeout time.Duration, fn TxFunc) error
	ReadOnlyTx(ctx context.Context, fn TxFunc) error
	FastTx(ctx context.Context, fn TxFunc) error
	BulkTx(ctx context.Context, fn TxFunc) error

	// Connection management
	Close() error
	Health(ctx context.Context) error
}