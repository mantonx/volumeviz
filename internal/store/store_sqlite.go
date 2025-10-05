package store

import (
	"context"
	"database/sql"
	"errors"

	"github.com/mantonx/volumeviz/internal/db"
	sqlcSQLite "github.com/mantonx/volumeviz/internal/db/sqlc-sqlite"
	"github.com/mantonx/volumeviz/internal/repo"
)

var ErrNotImplemented = errors.New("not implemented for SQLite")

// sqliteStore implements Store using SQLite
type sqliteStore struct {
	conn *db.SQLiteConnection
}

// NewSQLiteStore creates a new SQLite store
func NewSQLiteStore(conn *db.SQLiteConnection) Store {
	return &sqliteStore{conn: conn}
}

// WithTx executes a function within a database transaction
func (s *sqliteStore) WithTx(ctx context.Context, fn func(TxStore) error) error {
	tx, err := s.conn.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	
	defer func() {
		if p := recover(); p != nil {
			tx.Rollback()
			panic(p)
		} else if err != nil {
			tx.Rollback()
		} else {
			err = tx.Commit()
		}
	}()

	txStore := &sqliteTxStore{
		tx:      tx,
		queries: sqlcSQLite.New(tx),
	}
	err = fn(txStore)
	return err
}

// Volumes returns a volumes repository using the SQLite queries
func (s *sqliteStore) Volumes() repo.VolumesRepo {
	// TODO: Implement SQLite volumes repo when needed
	return nil
}

// Scans returns a scans repository using the SQLite queries
func (s *sqliteStore) Scans() repo.ScansRepo {
	return repo.NewSQLiteScansRepo(s.conn.Queries)
}

// ScanProgress returns a scan progress repository using the SQLite connection
func (s *sqliteStore) ScanProgress() repo.ScanProgressRepo {
	return repo.NewSQLiteScanProgressRepo(s.conn.DB)
}

// Checkpoints returns a checkpoint repository (not implemented for SQLite)
func (s *sqliteStore) Checkpoints() repo.CheckpointRepo {
	// Checkpointing is PostgreSQL-only for now
	return nil
}

// Snapshots returns a snapshot repository (not implemented for SQLite)
func (s *sqliteStore) Snapshots() repo.SnapshotRepo {
	// Snapshots are PostgreSQL-only for now
	return nil
}

// Retention returns a retention repository using the SQLite queries
func (s *sqliteStore) Retention() repo.RetentionRepo {
	return repo.NewSQLiteRetentionRepo(s.conn.Queries)
}

// Stats returns a stats repository using the SQLite queries
func (s *sqliteStore) Stats() *repo.StatsRepo {
	return repo.NewSQLiteStatsRepo(s.conn.Queries)
}

// Files returns a files repository using the SQLite queries
func (s *sqliteStore) Files() *repo.FilesRepo {
	return repo.NewSQLiteFilesRepo(s.conn.Queries)
}

// Folders returns a folders repository using the SQLite queries
func (s *sqliteStore) Folders() *repo.FoldersRepo {
	return repo.NewSQLiteFoldersRepo(s.conn.Queries)
}

// FileMetadata returns a file metadata repository using the SQLite queries
func (s *sqliteStore) FileMetadata() *repo.FileMetadataRepo {
	return repo.NewSQLiteFileMetadataRepo(s.conn.Queries)
}

// Alerts returns an alerts repository using the SQLite queries
func (s *sqliteStore) Alerts() repo.AlertsRepo {
	return repo.NewSQLiteAlertsRepo(s.conn.Queries)
}

// Search returns a search repository using the SQLite queries
func (s *sqliteStore) Search() *repo.SearchRepo {
	return repo.NewSQLiteSearchRepo(s.conn.Queries)
}

// Users returns a users repository using the SQLite queries
func (s *sqliteStore) Users() repo.UsersRepo {
	return repo.NewSQLiteUsersRepo(s.conn.Queries, s.conn.DB)
}

// Organizations returns an organizations repository using the SQLite queries
func (s *sqliteStore) Organizations() repo.OrganizationsRepo {
	// TODO: Implement SQLite organizations repo when needed
	return nil
}

// GetUserByID is a convenience method for getting a user by ID
func (s *sqliteStore) GetUserByID(ctx context.Context, id int64) (User, error) {
	// TODO: Implement when SQLite support is needed
	return User{}, ErrNotImplemented
}

// GetOrganizationByID is a convenience method for getting an organization by ID
func (s *sqliteStore) GetOrganizationByID(ctx context.Context, id int64) (Organization, error) {
	// TODO: Implement when SQLite support is needed
	return Organization{}, ErrNotImplemented
}

// Health performs a health check on the database connection
func (s *sqliteStore) Health(ctx context.Context) error {
	return s.conn.Health(ctx)
}

// Queries returns the raw SQLite SQLC queries for direct access
func (s *sqliteStore) Queries() interface{} {
	return s.conn.Queries
}

// sqliteTxStore implements TxStore for SQLite transactions
type sqliteTxStore struct {
	tx      *sql.Tx
	queries *sqlcSQLite.Queries
}

// Volumes returns a volumes repository using the transaction connection
func (s *sqliteTxStore) Volumes() repo.VolumesRepo {
	return repo.NewSQLiteVolumesRepo(s.queries)
}

// Scans returns a scans repository using the transaction connection
func (s *sqliteTxStore) Scans() repo.ScansRepo {
	return repo.NewSQLiteScansRepo(s.queries)
}

// ScanProgress returns a scan progress repository using the transaction connection
func (s *sqliteTxStore) ScanProgress() repo.ScanProgressRepo {
	// TODO: Implement SQLite transaction support for scan progress
	return nil
}

// Checkpoints returns a checkpoint repository (not implemented for SQLite)
func (s *sqliteTxStore) Checkpoints() repo.CheckpointRepo {
	// Checkpointing is PostgreSQL-only for now
	return nil
}

// Snapshots returns a snapshot repository (not implemented for SQLite)
func (s *sqliteTxStore) Snapshots() repo.SnapshotRepo {
	// Snapshots are PostgreSQL-only for now
	return nil
}

// Retention returns a retention repository using the transaction connection
func (s *sqliteTxStore) Retention() repo.RetentionRepo {
	return repo.NewSQLiteRetentionRepo(s.queries)
}

// Stats returns a stats repository using the transaction connection
func (s *sqliteTxStore) Stats() *repo.StatsRepo {
	return repo.NewSQLiteStatsRepo(s.queries)
}

// Files returns a files repository using the transaction connection
func (s *sqliteTxStore) Files() *repo.FilesRepo {
	return repo.NewSQLiteFilesRepo(s.queries)
}

// Folders returns a folders repository using the transaction connection
func (s *sqliteTxStore) Folders() *repo.FoldersRepo {
	return repo.NewSQLiteFoldersRepo(s.queries)
}

// FileMetadata returns a file metadata repository using the transaction connection
func (s *sqliteTxStore) FileMetadata() *repo.FileMetadataRepo {
	return repo.NewSQLiteFileMetadataRepo(s.queries)
}

// Alerts returns an alerts repository using the transaction connection
func (s *sqliteTxStore) Alerts() repo.AlertsRepo {
	return repo.NewSQLiteAlertsRepo(s.queries)
}

// Search returns a search repository using the transaction connection
func (s *sqliteTxStore) Search() *repo.SearchRepo {
	return repo.NewSQLiteSearchRepo(s.queries)
}

// Users returns a users repository using the transaction connection
func (s *sqliteTxStore) Users() repo.UsersRepo {
	return repo.NewSQLiteUsersRepo(s.queries, s.tx)
}

// Organizations returns an organizations repository using the transaction connection
func (s *sqliteTxStore) Organizations() repo.OrganizationsRepo {
	// TODO: Implement SQLite transaction support for organizations
	return nil
}