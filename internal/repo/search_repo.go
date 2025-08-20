package repo

import (
	"context"
	"encoding/json"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/mantonx/volumeviz/internal/db/sqlc"
)

// SearchRepo handles search-related database operations
type SearchRepo struct {
	queries *sqlc.Queries
}

// NewSearchRepo creates a new search repository
func NewSearchRepo(queries *sqlc.Queries) *SearchRepo {
	return &SearchRepo{
		queries: queries,
	}
}

// SearchFilesParams represents search parameters
type SearchFilesParams struct {
	SearchQuery   string
	PathPrefix    string
	MediaKind     string
	MimeType      string
	MinSize       int64
	MaxSize       int64
	MtimeFrom     *time.Time
	MtimeTo       *time.Time
	DurationFrom  int64
	DurationTo    int64
	MinWidth      int32
	MaxWidth      int32
	MinHeight     int32
	MaxHeight     int32
	HasGPS        *bool
	HasSubs       *bool
	HasHash       *bool
	SortField     string
	SortOrder     string
	PageLimit     int32
	PageOffset    int32
}

// SearchFiles performs advanced file search
func (r *SearchRepo) SearchFiles(ctx context.Context, params SearchFilesParams) ([]sqlc.SearchFilesRow, error) {
	// Convert time pointers to pgtype.Timestamptz
	var mtimeFrom, mtimeTo pgtype.Timestamptz
	if params.MtimeFrom != nil {
		mtimeFrom = pgtype.Timestamptz{Time: *params.MtimeFrom, Valid: true}
	}
	if params.MtimeTo != nil {
		mtimeTo = pgtype.Timestamptz{Time: *params.MtimeTo, Valid: true}
	}

	return r.queries.SearchFiles(ctx, sqlc.SearchFilesParams{
		SearchQuery:  params.SearchQuery,
		PathPrefix:   params.PathPrefix,
		MediaKind:    params.MediaKind,
		MimeType:     params.MimeType,
		MinSize:      params.MinSize,
		MaxSize:      params.MaxSize,
		MtimeFrom:    mtimeFrom,
		MtimeTo:      mtimeTo,
		DurationFrom: params.DurationFrom,
		DurationTo:   params.DurationTo,
		MinWidth:     params.MinWidth,
		MaxWidth:     params.MaxWidth,
		MinHeight:    params.MinHeight,
		MaxHeight:    params.MaxHeight,
		HasGps:       params.HasGPS != nil && *params.HasGPS,
		HasSubs:      params.HasSubs != nil && *params.HasSubs,
		HasHash:      params.HasHash != nil && *params.HasHash,
		SortField:    params.SortField,
		SortOrder:    params.SortOrder,
		PageLimit:    params.PageLimit,
		PageOffset:   params.PageOffset,
	})
}

// CountSearchFiles counts files matching search criteria
func (r *SearchRepo) CountSearchFiles(ctx context.Context, params SearchFilesParams) (int64, error) {
	// Convert time pointers to pgtype.Timestamptz
	var mtimeFrom, mtimeTo pgtype.Timestamptz
	if params.MtimeFrom != nil {
		mtimeFrom = pgtype.Timestamptz{Time: *params.MtimeFrom, Valid: true}
	}
	if params.MtimeTo != nil {
		mtimeTo = pgtype.Timestamptz{Time: *params.MtimeTo, Valid: true}
	}

	return r.queries.CountSearchFiles(ctx, sqlc.CountSearchFilesParams{
		SearchQuery:  params.SearchQuery,
		PathPrefix:   params.PathPrefix,
		MediaKind:    params.MediaKind,
		MimeType:     params.MimeType,
		MinSize:      params.MinSize,
		MaxSize:      params.MaxSize,
		MtimeFrom:    mtimeFrom,
		MtimeTo:      mtimeTo,
		DurationFrom: params.DurationFrom,
		DurationTo:   params.DurationTo,
		MinWidth:     params.MinWidth,
		MaxWidth:     params.MaxWidth,
		MinHeight:    params.MinHeight,
		MaxHeight:    params.MaxHeight,
		HasGps:       params.HasGPS != nil && *params.HasGPS,
		HasSubs:      params.HasSubs != nil && *params.HasSubs,
		HasHash:      params.HasHash != nil && *params.HasHash,
	})
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
func (r *SearchRepo) CreateSavedSearch(ctx context.Context, params SavedSearchParams) (*sqlc.SavedSearches, error) {
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

	result, err := r.queries.CreateSavedSearch(ctx, sqlc.CreateSavedSearchParams{
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
}

// ListSavedSearchesParams represents list parameters
type ListSavedSearchesParams struct {
	FilterTags []string
	PageLimit  int32
	PageOffset int32
}

// ListSavedSearches retrieves saved searches with optional filtering
func (r *SearchRepo) ListSavedSearches(ctx context.Context, params ListSavedSearchesParams) ([]sqlc.SavedSearches, error) {
	return r.queries.ListSavedSearches(ctx, sqlc.ListSavedSearchesParams{
		FilterTags: params.FilterTags,
		PageLimit:  params.PageLimit,
		PageOffset: params.PageOffset,
	})
}

// CountSavedSearches counts saved searches with optional filtering
func (r *SearchRepo) CountSavedSearches(ctx context.Context, filterTags []string) (int64, error) {
	return r.queries.CountSavedSearches(ctx, filterTags)
}

// GetSavedSearch retrieves a saved search by ID
func (r *SearchRepo) GetSavedSearch(ctx context.Context, id int64) (*sqlc.SavedSearches, error) {
	result, err := r.queries.GetSavedSearch(ctx, id)
	if err != nil {
		return nil, err
	}
	return &result, nil
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
func (r *SearchRepo) UpdateSavedSearch(ctx context.Context, params UpdateSavedSearchParams) (*sqlc.SavedSearches, error) {
	updateParams := sqlc.UpdateSavedSearchParams{
		ID: params.ID,
	}

	if params.Name != nil {
		updateParams.Name = *params.Name
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

	result, err := r.queries.UpdateSavedSearch(ctx, updateParams)
	if err != nil {
		return nil, err
	}

	return &result, nil
}

// DeleteSavedSearch deletes a saved search by ID
func (r *SearchRepo) DeleteSavedSearch(ctx context.Context, id int64) error {
	return r.queries.DeleteSavedSearch(ctx, id)
}

// UpdateSavedSearchStats updates the run statistics for a saved search
func (r *SearchRepo) UpdateSavedSearchStats(ctx context.Context, id int64) error {
	return r.queries.UpdateSavedSearchStats(ctx, id)
}

// GetSavedSearchQuery retrieves just the query JSON for a saved search
func (r *SearchRepo) GetSavedSearchQuery(ctx context.Context, id int64) ([]byte, error) {
	return r.queries.GetSavedSearchQuery(ctx, id)
}