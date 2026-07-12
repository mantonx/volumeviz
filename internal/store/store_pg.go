package store

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/mantonx/volumeviz/internal/db"
	"github.com/mantonx/volumeviz/internal/db/sqlc"
	"github.com/mantonx/volumeviz/internal/repo"
)

// pgStore implements Store using PostgreSQL
type pgStore struct {
	conn *db.PostgreSQLConnection
}

// PostgreSQLStore is a type alias for accessing PostgreSQL-specific methods
type PostgreSQLStore = pgStore

// NewPostgreSQLStore creates a new PostgreSQL store
func NewPostgreSQLStore(conn *db.PostgreSQLConnection) Store {
	return &pgStore{conn: conn}
}

// GetPool returns the underlying PostgreSQL connection pool
func (s *pgStore) GetPool() *pgxpool.Pool {
	return s.conn.Pool
}

// WithTx executes a function within a database transaction
func (s *pgStore) WithTx(ctx context.Context, fn func(TxStore) error) error {
	return pgx.BeginFunc(ctx, s.conn.Pool, func(tx pgx.Tx) error {
		txStore := &pgTxStore{
			tx:      tx,
			queries: s.conn.Queries.WithTx(tx),
		}
		return fn(txStore)
	})
}

// Volumes returns a volumes repository using the pool connection
func (s *pgStore) Volumes() repo.VolumesRepo {
	return repo.NewVolumesRepo(s.conn.Queries)
}

// Scans returns a scans repository using the pool connection
func (s *pgStore) Scans() repo.ScansRepo {
	return repo.NewScansRepo(s.conn.Queries)
}

// ScanProgress returns a scan progress repository using the pool connection
func (s *pgStore) ScanProgress() repo.ScanProgressRepo {
	return repo.NewScanProgressRepo(s.conn.Pool)
}

// Snapshots returns a snapshot repository using the pool connection
func (s *pgStore) Snapshots() repo.SnapshotRepo {
	return repo.NewSnapshotRepo(s.conn.Queries)
}

// Retention returns a retention repository using the pool connection
func (s *pgStore) Retention() repo.RetentionRepo {
	return repo.NewRetentionRepo(s.conn.Queries)
}

// Stats returns a stats repository using the pool connection
func (s *pgStore) Stats() *repo.StatsRepo {
	return repo.NewStatsRepo(s.conn.Queries)
}

// Files returns a files repository using the pool connection
func (s *pgStore) Files() *repo.FilesRepo {
	// Note: FilesRepo constructor expects sqlc.DBTX, not *sqlc.Queries
	return repo.NewFilesRepo(s.conn.Pool)
}

// Folders returns a folders repository using the pool connection
func (s *pgStore) Folders() *repo.FoldersRepo {
	// Note: FoldersRepo constructor expects sqlc.DBTX, not *sqlc.Queries
	return repo.NewFoldersRepo(s.conn.Pool)
}

// FileMetadata returns a file metadata repository using the pool connection
func (s *pgStore) FileMetadata() *repo.FileMetadataRepo {
	return repo.NewFileMetadataRepo(s.conn.Queries)
}

// Alerts returns an alerts repository using the pool connection
func (s *pgStore) Alerts() repo.AlertsRepo {
	return repo.NewAlertsRepo(s.conn.Queries)
}

// Search returns a search repository using the pool connection
func (s *pgStore) Search() *repo.SearchRepo {
	return repo.NewSearchRepo(s.conn.Queries)
}

// Organizations returns an organizations repository using the pool connection
func (s *pgStore) Organizations() repo.OrganizationsRepo {
	return repo.NewPostgreSQLOrganizationsRepo(s.conn.Queries, s.conn.Pool)
}

// Users returns a users repository using the pool connection
func (s *pgStore) Users() repo.UsersRepository {
	return repo.NewUsersRepo(s.conn.Pool)
}

// GetUserByID is a convenience method for getting a user by ID
func (s *pgStore) GetUserByID(ctx context.Context, id int64) (User, error) {
	return s.Users().GetUserByID(ctx, id)
}

// GetOrganizationByID is a convenience method for getting an organization by ID
func (s *pgStore) GetOrganizationByID(ctx context.Context, id int64) (Organization, error) {
	return s.conn.Queries.GetOrganizationByID(ctx, id)
}

// Health performs a health check on the database connection
func (s *pgStore) Health(ctx context.Context) error {
	return s.conn.Pool.Ping(ctx)
}

// Queries returns the raw SQLC queries for direct access
func (s *pgStore) Queries() interface{} {
	return s.conn.Queries
}

// pgTxStore implements TxStore for PostgreSQL transactions
type pgTxStore struct {
	tx      pgx.Tx
	queries *sqlc.Queries
}

// Volumes returns a volumes repository using the transaction connection
func (s *pgTxStore) Volumes() repo.VolumesRepo {
	return repo.NewVolumesRepo(s.queries)
}

// Scans returns a scans repository using the transaction connection
func (s *pgTxStore) Scans() repo.ScansRepo {
	return repo.NewScansRepo(s.queries)
}

// ScanProgress returns a scan progress repository using the transaction connection
// Note: For now, scan progress uses a separate pool connection since it uses raw SQL
// This means scan progress operations won't be transactional with other operations
func (s *pgTxStore) ScanProgress() repo.ScanProgressRepo {
	// TODO: Adapt scan progress repo to properly support pgx transactions
	// For now, create a temporary pool from the connection (not ideal)
	config := s.tx.Conn().Config()
	// We'll use a simple approach: create a new pool with the same config
	// This is a workaround and not ideal for production
	poolConfig, _ := pgxpool.ParseConfig(config.ConnString())
	poolConfig.MaxConns = 1
	poolConfig.MinConns = 1
	tmpPool, _ := pgxpool.NewWithConfig(context.Background(), poolConfig)
	return repo.NewScanProgressRepo(tmpPool)
}

// Snapshots returns a snapshot repository using the transaction connection
func (s *pgTxStore) Snapshots() repo.SnapshotRepo {
	return repo.NewSnapshotRepo(s.queries)
}

// Retention returns a retention repository using the transaction connection
func (s *pgTxStore) Retention() repo.RetentionRepo {
	return repo.NewRetentionRepo(s.queries)
}

// Stats returns a stats repository using the transaction connection
func (s *pgTxStore) Stats() *repo.StatsRepo {
	return repo.NewStatsRepo(s.queries)
}

// Files returns a files repository using the transaction connection
func (s *pgTxStore) Files() *repo.FilesRepo {
	// Note: FilesRepo constructor expects sqlc.DBTX, use underlying transaction
	return repo.NewFilesRepo(s.tx)
}

// Folders returns a folders repository using the transaction connection
func (s *pgTxStore) Folders() *repo.FoldersRepo {
	// Note: FoldersRepo constructor expects sqlc.DBTX, use underlying transaction
	return repo.NewFoldersRepo(s.tx)
}

// FileMetadata returns a file metadata repository using the transaction connection
func (s *pgTxStore) FileMetadata() *repo.FileMetadataRepo {
	return repo.NewFileMetadataRepo(s.queries)
}

// Alerts returns an alerts repository using the transaction connection
func (s *pgTxStore) Alerts() repo.AlertsRepo {
	return repo.NewAlertsRepo(s.queries)
}

// Search returns a search repository using the transaction connection
func (s *pgTxStore) Search() *repo.SearchRepo {
	return repo.NewSearchRepo(s.queries)
}

// Users returns a users repository using the transaction connection
func (s *pgTxStore) Users() repo.UsersRepository {
	// Create a temporary pool from the transaction for the users repo
	// This is a workaround since NewUsersRepo expects *pgxpool.Pool
	// TODO: Update NewUsersRepo to accept sqlc.DBTX for proper transaction support
	config := s.tx.Conn().Config()
	poolConfig, _ := pgxpool.ParseConfig(config.ConnString())
	poolConfig.MaxConns = 1
	poolConfig.MinConns = 1
	tmpPool, _ := pgxpool.NewWithConfig(context.Background(), poolConfig)
	return repo.NewUsersRepo(tmpPool)
}

// Organizations returns an organizations repository using the transaction connection
func (s *pgTxStore) Organizations() repo.OrganizationsRepo {
	return repo.NewPostgreSQLOrganizationsRepo(s.queries, s.tx)
}
