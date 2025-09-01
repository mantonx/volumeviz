package repo

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/mantonx/volumeviz/internal/db/sqlc"
	sqlcSQLite "github.com/mantonx/volumeviz/internal/db/sqlc-sqlite"
)

// SearchRepo handles search-related database operations
type SearchRepo struct {
	pgQueries     *sqlc.Queries
	sqliteQueries *sqlcSQLite.Queries
}

// NewSearchRepo creates a new PostgreSQL search repository
func NewSearchRepo(queries *sqlc.Queries) *SearchRepo {
	return &SearchRepo{
		pgQueries: queries,
	}
}

// NewSQLiteSearchRepo creates a new SQLite search repository
func NewSQLiteSearchRepo(queries *sqlcSQLite.Queries) *SearchRepo {
	return &SearchRepo{
		sqliteQueries: queries,
	}
}

// SearchFilesParams represents search parameters
type SearchFilesParams struct {
	SearchQuery  string
	PathPrefix   string
	MediaKind    string
	MimeType     string
	MinSize      int64
	MaxSize      int64
	MtimeFrom    *time.Time
	MtimeTo      *time.Time
	DurationFrom int64
	DurationTo   int64
	MinWidth     int32
	MaxWidth     int32
	MinHeight    int32
	MaxHeight    int32
	HasGPS       *bool
	HasSubs      *bool
	HasHash      *bool
	SortField    string
	SortOrder    string
	PageLimit    int32
	PageOffset   int32
}

// SearchFiles performs advanced file search
func (r *SearchRepo) SearchFiles(ctx context.Context, params SearchFilesParams) (interface{}, error) {
	if r.pgQueries != nil {
		// PostgreSQL version
		var mtimeFrom, mtimeTo, ctimeFrom, ctimeTo pgtype.Timestamptz
		if params.MtimeFrom != nil {
			mtimeFrom = pgtype.Timestamptz{Time: *params.MtimeFrom, Valid: true}
		}
		if params.MtimeTo != nil {
			mtimeTo = pgtype.Timestamptz{Time: *params.MtimeTo, Valid: true}
		}

		return r.pgQueries.SearchFiles(ctx, sqlc.SearchFilesParams{
			VolumeID:     pgtype.Text{String: "", Valid: false}, // TODO: Add VolumeID to SearchFilesParams
			SearchQuery:  pgtype.Text{String: params.SearchQuery, Valid: params.SearchQuery != ""},
			PathPrefix:   pgtype.Text{String: params.PathPrefix, Valid: params.PathPrefix != ""},
			Extension:    pgtype.Text{String: "", Valid: false}, // TODO: Add Extension to SearchFilesParams
			MimeType:     pgtype.Text{String: params.MimeType, Valid: params.MimeType != ""},
			MediaKind:    pgtype.Text{String: params.MediaKind, Valid: params.MediaKind != ""},
			MinSize:      pgtype.Int8{Int64: params.MinSize, Valid: params.MinSize > 0},
			MaxSize:      pgtype.Int8{Int64: params.MaxSize, Valid: params.MaxSize > 0},
			MtimeFrom:    mtimeFrom,
			MtimeTo:      mtimeTo,
			CtimeFrom:    ctimeFrom,
			CtimeTo:      ctimeTo,
			ResultOffset: params.PageOffset,
			ResultLimit:  params.PageLimit,
		})
	} else if r.sqliteQueries != nil {
		// SQLite version - different parameter handling
		var mtimeFromPtr, mtimeToPtr, ctimeFromPtr, ctimeToPtr interface{}
		if params.MtimeFrom != nil {
			mtimeFromPtr = *params.MtimeFrom
		}
		if params.MtimeTo != nil {
			mtimeToPtr = *params.MtimeTo
		}

		return r.sqliteQueries.SearchFiles(ctx, sqlcSQLite.SearchFilesParams{
			VolumeID:     "",
			SearchQuery:  params.SearchQuery,
			PathPrefix:   params.PathPrefix,
			Extension:    "",
			MimeType:     params.MimeType,
			MediaKind:    params.MediaKind,
			MinSize:      params.MinSize,
			MaxSize:      params.MaxSize,
			MtimeFrom:    mtimeFromPtr,
			MtimeTo:      mtimeToPtr,
			CtimeFrom:    ctimeFromPtr,
			CtimeTo:      ctimeToPtr,
			ResultOffset: int64(params.PageOffset),
			ResultLimit:  int64(params.PageLimit),
		})
	}
	
	return nil, fmt.Errorf("no database queries available")
}

// CountSearchFiles counts files matching search criteria
func (r *SearchRepo) CountSearchFiles(ctx context.Context, params SearchFilesParams) (int64, error) {
	if r.pgQueries != nil {
		// PostgreSQL version
		var mtimeFrom, mtimeTo, ctimeFrom, ctimeTo pgtype.Timestamptz
		if params.MtimeFrom != nil {
			mtimeFrom = pgtype.Timestamptz{Time: *params.MtimeFrom, Valid: true}
		}
		if params.MtimeTo != nil {
			mtimeTo = pgtype.Timestamptz{Time: *params.MtimeTo, Valid: true}
		}

		return r.pgQueries.CountSearchFiles(ctx, sqlc.CountSearchFilesParams{
			VolumeID:    pgtype.Text{String: "", Valid: false}, // TODO: Add VolumeID to SearchFilesParams
			SearchQuery: pgtype.Text{String: params.SearchQuery, Valid: params.SearchQuery != ""},
			PathPrefix:  pgtype.Text{String: params.PathPrefix, Valid: params.PathPrefix != ""},
			Extension:   pgtype.Text{String: "", Valid: false}, // TODO: Add Extension to SearchFilesParams
			MimeType:    pgtype.Text{String: params.MimeType, Valid: params.MimeType != ""},
			MediaKind:   pgtype.Text{String: params.MediaKind, Valid: params.MediaKind != ""},
			MinSize:     pgtype.Int8{Int64: params.MinSize, Valid: params.MinSize > 0},
			MaxSize:     pgtype.Int8{Int64: params.MaxSize, Valid: params.MaxSize > 0},
			MtimeFrom:   mtimeFrom,
			MtimeTo:     mtimeTo,
			CtimeFrom:   ctimeFrom,
			CtimeTo:     ctimeTo,
		})
	} else if r.sqliteQueries != nil {
		// SQLite version
		var mtimeFromPtr, mtimeToPtr, ctimeFromPtr, ctimeToPtr interface{}
		if params.MtimeFrom != nil {
			mtimeFromPtr = *params.MtimeFrom
		}
		if params.MtimeTo != nil {
			mtimeToPtr = *params.MtimeTo
		}

		return r.sqliteQueries.CountSearchFiles(ctx, sqlcSQLite.CountSearchFilesParams{
			VolumeID:     "",
			SearchQuery:  params.SearchQuery,
			PathPrefix:   params.PathPrefix,
			Extension:    "",
			MimeType:     params.MimeType,
			MediaKind:    params.MediaKind,
			MinSize:      params.MinSize,
			MaxSize:      params.MaxSize,
			MtimeFrom:    mtimeFromPtr,
			MtimeTo:      mtimeToPtr,
			CtimeFrom:    ctimeFromPtr,
			CtimeTo:      ctimeToPtr,
		})
	}
	
	return 0, fmt.Errorf("no database queries available")
}

// SavedSearchParams represents saved search creation parameters
type SavedSearchParams struct {
	Name        string
	Description string
	Query       map[string]interface{}
	Tags        []string
	IsPublic    bool
	Metadata    map[string]interface{}
}

// CreateSavedSearch creates a new saved search
func (r *SearchRepo) CreateSavedSearch(ctx context.Context, params SavedSearchParams) (interface{}, error) {
	queryJSON, err := json.Marshal(params.Query)
	if err != nil {
		return nil, err
	}

	var metadataJSON []byte
	if params.Metadata != nil {
		metadataJSON, err = json.Marshal(params.Metadata)
		if err != nil {
			return nil, err
		}
	}

	if r.pgQueries != nil {
		// PostgreSQL version
		result, err := r.pgQueries.CreateSavedSearch(ctx, sqlc.CreateSavedSearchParams{
			Name:        params.Name,
			Description: pgtype.Text{String: params.Description, Valid: params.Description != ""},
			Query:       queryJSON,
			Tags:        params.Tags,
			IsPublic:    pgtype.Bool{Bool: params.IsPublic, Valid: true},
			Metadata:    metadataJSON,
		})

		if err != nil {
			return nil, err
		}

		return &result, nil
	} else if r.sqliteQueries != nil {
		// SQLite version - convert tags to JSON if needed
		var tagsSQL sql.NullString
		if len(params.Tags) > 0 {
			tagsJSONBytes, err := json.Marshal(params.Tags)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal tags: %w", err)
			}
			tagsSQL = sql.NullString{String: string(tagsJSONBytes), Valid: true}
		}

		var descriptionSQL sql.NullString
		if params.Description != "" {
			descriptionSQL = sql.NullString{String: params.Description, Valid: true}
		}

		var isPublicSQL sql.NullInt64
		if params.IsPublic {
			isPublicSQL = sql.NullInt64{Int64: 1, Valid: true}
		}

		var metadataSQL sql.NullString
		if len(metadataJSON) > 0 {
			metadataSQL = sql.NullString{String: string(metadataJSON), Valid: true}
		}

		result, err := r.sqliteQueries.CreateSavedSearch(ctx, sqlcSQLite.CreateSavedSearchParams{
			Name:        params.Name,
			Description: descriptionSQL,
			Query:       string(queryJSON),
			Tags:        tagsSQL,
			IsPublic:    isPublicSQL,
			Metadata:    metadataSQL,
		})

		if err != nil {
			return nil, err
		}

		return &result, nil
	}
	
	return nil, fmt.Errorf("no database queries available")
}

// ListSavedSearchesParams represents list parameters
type ListSavedSearchesParams struct {
	OrganizationID int64
	FilterTags     []string
	PageLimit      int32
	PageOffset     int32
}

// ListSavedSearches retrieves saved searches with optional filtering
func (r *SearchRepo) ListSavedSearches(ctx context.Context, params ListSavedSearchesParams) (interface{}, error) {
	if r.pgQueries != nil {
		// PostgreSQL version
		return r.pgQueries.ListSavedSearches(ctx, sqlc.ListSavedSearchesParams{
			OrganizationID: pgtype.Int8{Int64: params.OrganizationID, Valid: true},
			FilterTags:     params.FilterTags,
			ResultLimit:    params.PageLimit,
			ResultOffset:   params.PageOffset,
		})
	} else if r.sqliteQueries != nil {
		// SQLite version - convert string array to JSON for filtering
		var filterTagsJSON interface{}
		if len(params.FilterTags) > 0 {
			tagsJSON, err := json.Marshal(params.FilterTags)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal filter tags: %w", err)
			}
			filterTagsJSON = string(tagsJSON)
		}

		return r.sqliteQueries.ListSavedSearches(ctx, sqlcSQLite.ListSavedSearchesParams{
			FilterTagsJson: filterTagsJSON,
			ResultLimit:    int64(params.PageLimit),
			ResultOffset:   int64(params.PageOffset),
		})
	}
	
	return nil, fmt.Errorf("no database queries available")
}

// CountSavedSearches counts saved searches with optional filtering
func (r *SearchRepo) CountSavedSearches(ctx context.Context, organizationID int64, filterTags []string) (int64, error) {
	if r.pgQueries != nil {
		// PostgreSQL version
		return r.pgQueries.CountSavedSearches(ctx, sqlc.CountSavedSearchesParams{
			OrganizationID: pgtype.Int8{Int64: organizationID, Valid: true},
			FilterTags:     filterTags,
		})
	} else if r.sqliteQueries != nil {
		// SQLite version - convert string array to JSON for filtering
		var filterTagsJSON interface{}
		if len(filterTags) > 0 {
			tagsJSON, err := json.Marshal(filterTags)
			if err != nil {
				return 0, fmt.Errorf("failed to marshal filter tags: %w", err)
			}
			filterTagsJSON = string(tagsJSON)
		}

		return r.sqliteQueries.CountSavedSearches(ctx, filterTagsJSON)
	}
	
	return 0, fmt.Errorf("no database queries available")
}

// GetSavedSearch retrieves a saved search by ID
func (r *SearchRepo) GetSavedSearch(ctx context.Context, organizationID int64, id int64) (interface{}, error) {
	if r.pgQueries != nil {
		// PostgreSQL version
		result, err := r.pgQueries.GetSavedSearch(ctx, sqlc.GetSavedSearchParams{
			ID:             id,
			OrganizationID: pgtype.Int8{Int64: organizationID, Valid: true},
		})
		if err != nil {
			return nil, err
		}
		return &result, nil
	} else if r.sqliteQueries != nil {
		// SQLite version
		result, err := r.sqliteQueries.GetSavedSearch(ctx, id)
		if err != nil {
			return nil, err
		}
		return &result, nil
	}
	
	return nil, fmt.Errorf("no database queries available")
}

// UpdateSavedSearchParams represents update parameters
type UpdateSavedSearchParams struct {
	ID          int64
	Name        *string
	Description *string
	Query       map[string]interface{}
	Tags        []string
	IsPublic    *bool
	Metadata    map[string]interface{}
}

// UpdateSavedSearch updates an existing saved search
func (r *SearchRepo) UpdateSavedSearch(ctx context.Context, params UpdateSavedSearchParams) (interface{}, error) {
	if r.pgQueries != nil {
		// PostgreSQL version
		updateParams := sqlc.UpdateSavedSearchParams{
			ID: params.ID,
		}

		if params.Name != nil {
			updateParams.Name = pgtype.Text{String: *params.Name, Valid: true}
		}

		if params.Description != nil {
			updateParams.Description = pgtype.Text{String: *params.Description, Valid: true}
		}

		if params.Query != nil {
			queryJSON, err := json.Marshal(params.Query)
			if err != nil {
				return nil, err
			}
			updateParams.Query = queryJSON
		}

		if len(params.Tags) > 0 {
			updateParams.Tags = params.Tags
		}

		if params.IsPublic != nil {
			updateParams.IsPublic = pgtype.Bool{Bool: *params.IsPublic, Valid: true}
		}

		if params.Metadata != nil {
			metadataJSON, err := json.Marshal(params.Metadata)
			if err != nil {
				return nil, err
			}
			updateParams.Metadata = metadataJSON
		}

		result, err := r.pgQueries.UpdateSavedSearch(ctx, updateParams)
		if err != nil {
			return nil, err
		}

		return &result, nil
	} else if r.sqliteQueries != nil {
		// SQLite version
		updateParams := sqlcSQLite.UpdateSavedSearchParams{
			ID: params.ID,
		}

		if params.Name != nil {
			updateParams.Name = sql.NullString{String: *params.Name, Valid: true}
		}

		if params.Description != nil {
			updateParams.Description = sql.NullString{String: *params.Description, Valid: true}
		}

		if params.Query != nil {
			queryJSON, err := json.Marshal(params.Query)
			if err != nil {
				return nil, err
			}
			updateParams.Query = sql.NullString{String: string(queryJSON), Valid: true}
		}

		if len(params.Tags) > 0 {
			tagsJSON, err := json.Marshal(params.Tags)
			if err != nil {
				return nil, err
			}
			updateParams.Tags = sql.NullString{String: string(tagsJSON), Valid: true}
		}

		if params.IsPublic != nil {
			val := int64(0)
			if *params.IsPublic {
				val = 1
			}
			updateParams.IsPublic = sql.NullInt64{Int64: val, Valid: true}
		}

		if params.Metadata != nil {
			metadataJSON, err := json.Marshal(params.Metadata)
			if err != nil {
				return nil, err
			}
			updateParams.Metadata = sql.NullString{String: string(metadataJSON), Valid: true}
		}

		result, err := r.sqliteQueries.UpdateSavedSearch(ctx, updateParams)
		if err != nil {
			return nil, err
		}

		return &result, nil
	}
	
	return nil, fmt.Errorf("no database queries available")
}

// DeleteSavedSearch deletes a saved search by ID
func (r *SearchRepo) DeleteSavedSearch(ctx context.Context, organizationID int64, id int64) error {
	if r.pgQueries != nil {
		return r.pgQueries.DeleteSavedSearch(ctx, sqlc.DeleteSavedSearchParams{
			ID:             id,
			OrganizationID: pgtype.Int8{Int64: organizationID, Valid: true},
		})
	} else if r.sqliteQueries != nil {
		return r.sqliteQueries.DeleteSavedSearch(ctx, id)
	}
	return fmt.Errorf("no database queries available")
}

// UpdateSavedSearchStats updates the run statistics for a saved search
func (r *SearchRepo) UpdateSavedSearchStats(ctx context.Context, organizationID int64, id int64) error {
	if r.pgQueries != nil {
		return r.pgQueries.UpdateSavedSearchStats(ctx, sqlc.UpdateSavedSearchStatsParams{
			ID:             id,
			OrganizationID: pgtype.Int8{Int64: organizationID, Valid: true},
		})
	} else if r.sqliteQueries != nil {
		return r.sqliteQueries.UpdateSavedSearchStats(ctx, id)
	}
	return fmt.Errorf("no database queries available")
}

// GetSavedSearchQuery retrieves just the query JSON for a saved search
func (r *SearchRepo) GetSavedSearchQuery(ctx context.Context, organizationID int64, id int64) ([]byte, error) {
	if r.pgQueries != nil {
		return r.pgQueries.GetSavedSearchQuery(ctx, sqlc.GetSavedSearchQueryParams{
			ID:             id,
			OrganizationID: pgtype.Int8{Int64: organizationID, Valid: true},
		})
	} else if r.sqliteQueries != nil {
		data, err := r.sqliteQueries.GetSavedSearchQuery(ctx, id)
		if err != nil {
			return nil, err
		}
		return []byte(data), nil
	}
	return nil, fmt.Errorf("no database queries available")
}
