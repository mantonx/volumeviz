package repo

import (
	"context"
	"fmt"

	"github.com/mantonx/volumeviz/internal/db/sqlc"
	sqlcSQLite "github.com/mantonx/volumeviz/internal/db/sqlc-sqlite"
)

// UsersRepo provides user management operations
type UsersRepo interface {
	// User CRUD operations
	CreateUser(ctx context.Context, params sqlc.CreateUserParams) (sqlc.Users, error)
	GetUserByID(ctx context.Context, id int64) (sqlc.Users, error)
	GetUserByUsername(ctx context.Context, username string) (sqlc.Users, error)
	GetUserByEmail(ctx context.Context, email string) (sqlc.Users, error)
	UpdateUser(ctx context.Context, params sqlc.UpdateUserParams) (sqlc.Users, error)
	UpdateUserPassword(ctx context.Context, params sqlc.UpdateUserPasswordParams) error
	UpdateUserLastLogin(ctx context.Context, id int64) error
	IncrementLoginAttempts(ctx context.Context, id int64) error
	LockUser(ctx context.Context, params sqlc.LockUserParams) error
	SetPasswordResetToken(ctx context.Context, params sqlc.SetPasswordResetTokenParams) error
	VerifyEmail(ctx context.Context, id int64) error
	ListUsers(ctx context.Context, params sqlc.ListUsersParams) ([]sqlc.Users, error)
	DeleteUser(ctx context.Context, id int64) error

	// Session management
	CreateUserSession(ctx context.Context, params sqlc.CreateUserSessionParams) (sqlc.UserSessions, error)
	GetUserSession(ctx context.Context, sessionToken string) (sqlc.UserSessions, error)
	GetUserSessionByJTI(ctx context.Context, jwtTokenID string) (sqlc.UserSessions, error)
	UpdateSessionLastUsed(ctx context.Context, id int64) error
	RevokeUserSession(ctx context.Context, id int64) error
	RevokeAllUserSessions(ctx context.Context, userID int64) error
	CleanupExpiredSessions(ctx context.Context) error

	// Activity logging
	LogUserActivity(ctx context.Context, params sqlc.LogUserActivityParams) (sqlc.UserActivityLog, error)
	GetUserActivityLog(ctx context.Context, params sqlc.GetUserActivityLogParams) ([]sqlc.UserActivityLog, error)

	// User preferences
	SetUserPreference(ctx context.Context, params sqlc.SetUserPreferenceParams) (sqlc.UserPreferences, error)
	GetUserPreference(ctx context.Context, params sqlc.GetUserPreferenceParams) (sqlc.UserPreferences, error)
	GetAllUserPreferences(ctx context.Context, userID int64) ([]sqlc.UserPreferences, error)
	DeleteUserPreference(ctx context.Context, params sqlc.DeleteUserPreferenceParams) error
}

// PostgreSQLUsersRepo implements UsersRepo for PostgreSQL
type PostgreSQLUsersRepo struct {
	queries *sqlc.Queries
	db      sqlc.DBTX
}

// SQLiteUsersRepo implements UsersRepo for SQLite  
type SQLiteUsersRepo struct {
	queries *sqlcSQLite.Queries
	db      sqlcSQLite.DBTX
}

// NewPostgreSQLUsersRepo creates a new PostgreSQL users repository
func NewPostgreSQLUsersRepo(queries *sqlc.Queries, db sqlc.DBTX) *PostgreSQLUsersRepo {
	return &PostgreSQLUsersRepo{
		queries: queries,
		db:      db,
	}
}

// NewSQLiteUsersRepo creates a new SQLite users repository
func NewSQLiteUsersRepo(queries *sqlcSQLite.Queries, db sqlcSQLite.DBTX) *SQLiteUsersRepo {
	return &SQLiteUsersRepo{
		queries: queries,
		db:      db,
	}
}

// PostgreSQL Implementation
func (r *PostgreSQLUsersRepo) CreateUser(ctx context.Context, params sqlc.CreateUserParams) (sqlc.Users, error) {
	return r.queries.CreateUser(ctx, params)
}

func (r *PostgreSQLUsersRepo) GetUserByID(ctx context.Context, id int64) (sqlc.Users, error) {
	return r.queries.GetUserByID(ctx, id)
}

func (r *PostgreSQLUsersRepo) GetUserByUsername(ctx context.Context, username string) (sqlc.Users, error) {
	return r.queries.GetUserByUsername(ctx, username)
}

func (r *PostgreSQLUsersRepo) GetUserByEmail(ctx context.Context, email string) (sqlc.Users, error) {
	return r.queries.GetUserByEmail(ctx, email)
}

func (r *PostgreSQLUsersRepo) UpdateUser(ctx context.Context, params sqlc.UpdateUserParams) (sqlc.Users, error) {
	return r.queries.UpdateUser(ctx, params)
}

func (r *PostgreSQLUsersRepo) UpdateUserPassword(ctx context.Context, params sqlc.UpdateUserPasswordParams) error {
	return r.queries.UpdateUserPassword(ctx, params)
}

func (r *PostgreSQLUsersRepo) UpdateUserLastLogin(ctx context.Context, id int64) error {
	return r.queries.UpdateUserLastLogin(ctx, id)
}

func (r *PostgreSQLUsersRepo) IncrementLoginAttempts(ctx context.Context, id int64) error {
	return r.queries.IncrementLoginAttempts(ctx, id)
}

func (r *PostgreSQLUsersRepo) LockUser(ctx context.Context, params sqlc.LockUserParams) error {
	return r.queries.LockUser(ctx, params)
}

func (r *PostgreSQLUsersRepo) SetPasswordResetToken(ctx context.Context, params sqlc.SetPasswordResetTokenParams) error {
	return r.queries.SetPasswordResetToken(ctx, params)
}

func (r *PostgreSQLUsersRepo) VerifyEmail(ctx context.Context, id int64) error {
	return r.queries.VerifyEmail(ctx, id)
}

func (r *PostgreSQLUsersRepo) ListUsers(ctx context.Context, params sqlc.ListUsersParams) ([]sqlc.Users, error) {
	return r.queries.ListUsers(ctx, params)
}

func (r *PostgreSQLUsersRepo) DeleteUser(ctx context.Context, id int64) error {
	return r.queries.DeleteUser(ctx, id)
}

func (r *PostgreSQLUsersRepo) CreateUserSession(ctx context.Context, params sqlc.CreateUserSessionParams) (sqlc.UserSessions, error) {
	return r.queries.CreateUserSession(ctx, params)
}

func (r *PostgreSQLUsersRepo) GetUserSession(ctx context.Context, sessionToken string) (sqlc.UserSessions, error) {
	return r.queries.GetUserSession(ctx, sessionToken)
}

func (r *PostgreSQLUsersRepo) GetUserSessionByJTI(ctx context.Context, jwtTokenID string) (sqlc.UserSessions, error) {
	return r.queries.GetUserSessionByJTI(ctx, jwtTokenID)
}

func (r *PostgreSQLUsersRepo) UpdateSessionLastUsed(ctx context.Context, id int64) error {
	return r.queries.UpdateSessionLastUsed(ctx, id)
}

func (r *PostgreSQLUsersRepo) RevokeUserSession(ctx context.Context, id int64) error {
	return r.queries.RevokeUserSession(ctx, id)
}

func (r *PostgreSQLUsersRepo) RevokeAllUserSessions(ctx context.Context, userID int64) error {
	return r.queries.RevokeAllUserSessions(ctx, userID)
}

func (r *PostgreSQLUsersRepo) CleanupExpiredSessions(ctx context.Context) error {
	return r.queries.CleanupExpiredSessions(ctx)
}

func (r *PostgreSQLUsersRepo) LogUserActivity(ctx context.Context, params sqlc.LogUserActivityParams) (sqlc.UserActivityLog, error) {
	return r.queries.LogUserActivity(ctx, params)
}

func (r *PostgreSQLUsersRepo) GetUserActivityLog(ctx context.Context, params sqlc.GetUserActivityLogParams) ([]sqlc.UserActivityLog, error) {
	return r.queries.GetUserActivityLog(ctx, params)
}

func (r *PostgreSQLUsersRepo) SetUserPreference(ctx context.Context, params sqlc.SetUserPreferenceParams) (sqlc.UserPreferences, error) {
	return r.queries.SetUserPreference(ctx, params)
}

func (r *PostgreSQLUsersRepo) GetUserPreference(ctx context.Context, params sqlc.GetUserPreferenceParams) (sqlc.UserPreferences, error) {
	return r.queries.GetUserPreference(ctx, params)
}

func (r *PostgreSQLUsersRepo) GetAllUserPreferences(ctx context.Context, userID int64) ([]sqlc.UserPreferences, error) {
	return r.queries.GetAllUserPreferences(ctx, userID)
}

func (r *PostgreSQLUsersRepo) DeleteUserPreference(ctx context.Context, params sqlc.DeleteUserPreferenceParams) error {
	return r.queries.DeleteUserPreference(ctx, params)
}

// SQLite Implementation
func (r *SQLiteUsersRepo) CreateUser(ctx context.Context, params sqlc.CreateUserParams) (sqlc.Users, error) {
	// For SQLite, we need to cast the queries interface
	// This is a simplified approach - in production, you'd want proper type handling
	return sqlc.Users{}, fmt.Errorf("SQLite users repository not yet implemented")
}

func (r *SQLiteUsersRepo) GetUserByID(ctx context.Context, id int64) (sqlc.Users, error) {
	return sqlc.Users{}, fmt.Errorf("SQLite users repository not yet implemented")
}

func (r *SQLiteUsersRepo) GetUserByUsername(ctx context.Context, username string) (sqlc.Users, error) {
	return sqlc.Users{}, fmt.Errorf("SQLite users repository not yet implemented")
}

func (r *SQLiteUsersRepo) GetUserByEmail(ctx context.Context, email string) (sqlc.Users, error) {
	return sqlc.Users{}, fmt.Errorf("SQLite users repository not yet implemented")
}

func (r *SQLiteUsersRepo) UpdateUser(ctx context.Context, params sqlc.UpdateUserParams) (sqlc.Users, error) {
	return sqlc.Users{}, fmt.Errorf("SQLite users repository not yet implemented")
}

func (r *SQLiteUsersRepo) UpdateUserPassword(ctx context.Context, params sqlc.UpdateUserPasswordParams) error {
	return fmt.Errorf("SQLite users repository not yet implemented")
}

func (r *SQLiteUsersRepo) UpdateUserLastLogin(ctx context.Context, id int64) error {
	return fmt.Errorf("SQLite users repository not yet implemented")
}

func (r *SQLiteUsersRepo) IncrementLoginAttempts(ctx context.Context, id int64) error {
	return fmt.Errorf("SQLite users repository not yet implemented")
}

func (r *SQLiteUsersRepo) LockUser(ctx context.Context, params sqlc.LockUserParams) error {
	return fmt.Errorf("SQLite users repository not yet implemented")
}

func (r *SQLiteUsersRepo) SetPasswordResetToken(ctx context.Context, params sqlc.SetPasswordResetTokenParams) error {
	return fmt.Errorf("SQLite users repository not yet implemented")
}

func (r *SQLiteUsersRepo) VerifyEmail(ctx context.Context, id int64) error {
	return fmt.Errorf("SQLite users repository not yet implemented")
}

func (r *SQLiteUsersRepo) ListUsers(ctx context.Context, params sqlc.ListUsersParams) ([]sqlc.Users, error) {
	return nil, fmt.Errorf("SQLite users repository not yet implemented")
}

func (r *SQLiteUsersRepo) DeleteUser(ctx context.Context, id int64) error {
	return fmt.Errorf("SQLite users repository not yet implemented")
}

func (r *SQLiteUsersRepo) CreateUserSession(ctx context.Context, params sqlc.CreateUserSessionParams) (sqlc.UserSessions, error) {
	return sqlc.UserSessions{}, fmt.Errorf("SQLite users repository not yet implemented")
}

func (r *SQLiteUsersRepo) GetUserSession(ctx context.Context, sessionToken string) (sqlc.UserSessions, error) {
	return sqlc.UserSessions{}, fmt.Errorf("SQLite users repository not yet implemented")
}

func (r *SQLiteUsersRepo) GetUserSessionByJTI(ctx context.Context, jwtTokenID string) (sqlc.UserSessions, error) {
	return sqlc.UserSessions{}, fmt.Errorf("SQLite users repository not yet implemented")
}

func (r *SQLiteUsersRepo) UpdateSessionLastUsed(ctx context.Context, id int64) error {
	return fmt.Errorf("SQLite users repository not yet implemented")
}

func (r *SQLiteUsersRepo) RevokeUserSession(ctx context.Context, id int64) error {
	return fmt.Errorf("SQLite users repository not yet implemented")
}

func (r *SQLiteUsersRepo) RevokeAllUserSessions(ctx context.Context, userID int64) error {
	return fmt.Errorf("SQLite users repository not yet implemented")
}

func (r *SQLiteUsersRepo) CleanupExpiredSessions(ctx context.Context) error {
	return fmt.Errorf("SQLite users repository not yet implemented")
}

func (r *SQLiteUsersRepo) LogUserActivity(ctx context.Context, params sqlc.LogUserActivityParams) (sqlc.UserActivityLog, error) {
	return sqlc.UserActivityLog{}, fmt.Errorf("SQLite users repository not yet implemented")
}

func (r *SQLiteUsersRepo) GetUserActivityLog(ctx context.Context, params sqlc.GetUserActivityLogParams) ([]sqlc.UserActivityLog, error) {
	return nil, fmt.Errorf("SQLite users repository not yet implemented")
}

func (r *SQLiteUsersRepo) SetUserPreference(ctx context.Context, params sqlc.SetUserPreferenceParams) (sqlc.UserPreferences, error) {
	return sqlc.UserPreferences{}, fmt.Errorf("SQLite users repository not yet implemented")
}

func (r *SQLiteUsersRepo) GetUserPreference(ctx context.Context, params sqlc.GetUserPreferenceParams) (sqlc.UserPreferences, error) {
	return sqlc.UserPreferences{}, fmt.Errorf("SQLite users repository not yet implemented")
}

func (r *SQLiteUsersRepo) GetAllUserPreferences(ctx context.Context, userID int64) ([]sqlc.UserPreferences, error) {
	return nil, fmt.Errorf("SQLite users repository not yet implemented")
}

func (r *SQLiteUsersRepo) DeleteUserPreference(ctx context.Context, params sqlc.DeleteUserPreferenceParams) error {
	return fmt.Errorf("SQLite users repository not yet implemented")
}