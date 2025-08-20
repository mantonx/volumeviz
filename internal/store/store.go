// Package store provides the transactional layer
// Store manages transactions and provides access to repositories
// No SQL or business logic here - only transaction orchestration
package store

import (
	"context"

	"github.com/mantonx/volumeviz/internal/repo"
)

// Store provides access to repositories with transaction support
type Store interface {
	// WithTx executes a function within a database transaction
	WithTx(ctx context.Context, fn func(TxStore) error) error

	// Repository access (non-transactional)
	Volumes() repo.VolumesRepo
	Scans() repo.ScansRepo
	Retention() repo.RetentionRepo
	Stats() *repo.StatsRepo
	Files() *repo.FilesRepo
	Folders() *repo.FoldersRepo
	FileMetadata() *repo.FileMetadataRepo
	Alerts() repo.AlertsRepo
	Search() *repo.SearchRepo

	// Health check
	Health(ctx context.Context) error
}

// TxStore provides access to repositories within a transaction context
type TxStore interface {
	// Repository access (transactional)
	Volumes() repo.VolumesRepo
	Scans() repo.ScansRepo
	Retention() repo.RetentionRepo
	Stats() *repo.StatsRepo
	Files() *repo.FilesRepo
	Folders() *repo.FoldersRepo
	FileMetadata() *repo.FileMetadataRepo
	Alerts() repo.AlertsRepo
}
