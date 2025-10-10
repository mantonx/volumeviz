package repo

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/mantonx/volumeviz/internal/db/sqlc"
)

// UsersRepository provides user management operations
type UsersRepository interface {
	// User CRUD operations
	CreateUser(ctx context.Context, params sqlc.CreateUserParams) (sqlc.Users, error)
	GetUserByID(ctx context.Context, id int64) (sqlc.Users, error)
	GetUserByIDAndOrg(ctx context.Context, id int64, orgID int64) (sqlc.Users, error)
	GetUserByUsername(ctx context.Context, username string) (sqlc.Users, error)
	GetUserByUsernameAndOrg(ctx context.Context, username string, orgID int64) (sqlc.Users, error)
	GetUserByEmail(ctx context.Context, email string) (sqlc.Users, error)
	GetUserByEmailAndOrg(ctx context.Context, email string, orgID int64) (sqlc.Users, error)
	UpdateUser(ctx context.Context, params sqlc.UpdateUserParams) (sqlc.Users, error)
	UpdateUserPassword(ctx context.Context, id int64, passwordHash string) error
	UpdateUserLastLogin(ctx context.Context, id int64) error
	SetUserActive(ctx context.Context, id int64, isActive bool) error
	ListUsersByOrg(ctx context.Context, orgID int64, limit int32, offset int32) ([]sqlc.Users, error)
	ListAllUsers(ctx context.Context, limit int32, offset int32) ([]sqlc.Users, error)
	CountUsersByOrg(ctx context.Context, orgID int64) (int64, error)
	DeleteUser(ctx context.Context, id int64) error
	DeleteUserByUsernameAndOrg(ctx context.Context, username string, orgID int64) error
}

// usersRepo implements UsersRepository for PostgreSQL
type usersRepo struct {
	pool    *pgxpool.Pool
	queries *sqlc.Queries
}

// NewUsersRepo creates a new users repository
func NewUsersRepo(pool *pgxpool.Pool) UsersRepository {
	return &usersRepo{
		pool:    pool,
		queries: sqlc.New(pool),
	}
}

// User CRUD operations
func (r *usersRepo) CreateUser(ctx context.Context, params sqlc.CreateUserParams) (sqlc.Users, error) {
	return r.queries.CreateUser(ctx, params)
}

func (r *usersRepo) GetUserByID(ctx context.Context, id int64) (sqlc.Users, error) {
	return r.queries.GetUserByID(ctx, id)
}

func (r *usersRepo) GetUserByIDAndOrg(ctx context.Context, id int64, orgID int64) (sqlc.Users, error) {
	return r.queries.GetUserByIDAndOrg(ctx, sqlc.GetUserByIDAndOrgParams{
		ID:             id,
		OrganizationID: orgID,
	})
}

func (r *usersRepo) GetUserByUsername(ctx context.Context, username string) (sqlc.Users, error) {
	return r.queries.GetUserByUsername(ctx, username)
}

func (r *usersRepo) GetUserByUsernameAndOrg(ctx context.Context, username string, orgID int64) (sqlc.Users, error) {
	return r.queries.GetUserByUsernameAndOrg(ctx, sqlc.GetUserByUsernameAndOrgParams{
		Username:       username,
		OrganizationID: orgID,
	})
}

func (r *usersRepo) GetUserByEmail(ctx context.Context, email string) (sqlc.Users, error) {
	return r.queries.GetUserByEmail(ctx, email)
}

func (r *usersRepo) GetUserByEmailAndOrg(ctx context.Context, email string, orgID int64) (sqlc.Users, error) {
	return r.queries.GetUserByEmailAndOrg(ctx, sqlc.GetUserByEmailAndOrgParams{
		Email:          email,
		OrganizationID: orgID,
	})
}

func (r *usersRepo) UpdateUser(ctx context.Context, params sqlc.UpdateUserParams) (sqlc.Users, error) {
	return r.queries.UpdateUser(ctx, params)
}

func (r *usersRepo) UpdateUserPassword(ctx context.Context, id int64, passwordHash string) error {
	return r.queries.UpdateUserPassword(ctx, sqlc.UpdateUserPasswordParams{
		ID:           id,
		PasswordHash: passwordHash,
	})
}

func (r *usersRepo) UpdateUserLastLogin(ctx context.Context, id int64) error {
	return r.queries.UpdateUserLastLogin(ctx, id)
}

func (r *usersRepo) SetUserActive(ctx context.Context, id int64, isActive bool) error {
	return r.queries.SetUserActive(ctx, sqlc.SetUserActiveParams{
		ID:       id,
		IsActive: isActive,
	})
}

func (r *usersRepo) ListUsersByOrg(ctx context.Context, orgID int64, limit int32, offset int32) ([]sqlc.Users, error) {
	return r.queries.ListUsersByOrg(ctx, sqlc.ListUsersByOrgParams{
		OrganizationID: orgID,
		Limit:          limit,
		Offset:         offset,
	})
}

func (r *usersRepo) ListAllUsers(ctx context.Context, limit int32, offset int32) ([]sqlc.Users, error) {
	return r.queries.ListAllUsers(ctx, sqlc.ListAllUsersParams{
		Limit:  limit,
		Offset: offset,
	})
}

func (r *usersRepo) CountUsersByOrg(ctx context.Context, orgID int64) (int64, error) {
	return r.queries.CountUsersByOrg(ctx, orgID)
}

func (r *usersRepo) DeleteUser(ctx context.Context, id int64) error {
	return r.queries.DeleteUser(ctx, id)
}

func (r *usersRepo) DeleteUserByUsernameAndOrg(ctx context.Context, username string, orgID int64) error {
	return r.queries.DeleteUserByUsernameAndOrg(ctx, sqlc.DeleteUserByUsernameAndOrgParams{
		Username:       username,
		OrganizationID: orgID,
	})
}
