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
	ScanProgress() repo.ScanProgressRepo
	Snapshots() repo.SnapshotRepo
	Retention() repo.RetentionRepo
	Stats() *repo.StatsRepo
	Files() *repo.FilesRepo
	Folders() *repo.FoldersRepo
	FileMetadata() *repo.FileMetadataRepo
	Alerts() repo.AlertsRepo
	Search() *repo.SearchRepo
	Users() repo.UsersRepository
	Organizations() repo.OrganizationsRepo

	// Health check
	Health(ctx context.Context) error

	// Raw SQLC queries access (for services that need direct query access)
	Queries() interface{}

	// Direct convenience methods for common operations
	GetUserByID(ctx context.Context, id int64) (User, error)
	GetOrganizationByID(ctx context.Context, id int64) (Organization, error)
}

// TxStore provides access to repositories within a transaction context
type TxStore interface {
	// Repository access (transactional)
	Volumes() repo.VolumesRepo
	Scans() repo.ScansRepo
	ScanProgress() repo.ScanProgressRepo
	Snapshots() repo.SnapshotRepo
	Retention() repo.RetentionRepo
	Stats() *repo.StatsRepo
	Files() *repo.FilesRepo
	Folders() *repo.FoldersRepo
	FileMetadata() *repo.FileMetadataRepo
	Alerts() repo.AlertsRepo
	Search() *repo.SearchRepo
	Users() repo.UsersRepository
	Organizations() repo.OrganizationsRepo
}
