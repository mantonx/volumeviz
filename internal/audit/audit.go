package audit

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/mantonx/volumeviz/internal/db/sqlc"
)

// Logger provides audit logging functionality
type Logger interface {
	// LogEvent logs an audit event
	LogEvent(ctx context.Context, event Event) error

	// GetEvents retrieves audit events with pagination and filtering
	GetEvents(ctx context.Context, filters EventFilters) ([]*Event, error)

	// SearchEvents retrieves audit events (with the acting username/email
	// joined in) matching the given filters, plus the total matching count
	// for pagination
	SearchEvents(ctx context.Context, filters SearchFilters) ([]*Event, int64, error)
}

// Event represents an audit log event
type Event struct {
	ID             int64                  `json:"id,omitempty"`
	OrganizationID int64                  `json:"organization_id"`
	UserID         *int64                 `json:"user_id,omitempty"`
	Username       string                 `json:"username,omitempty"`
	Email          string                 `json:"email,omitempty"`
	Action         string                 `json:"action"`
	ResourceType   string                 `json:"resource_type,omitempty"`
	ResourceID     string                 `json:"resource_id,omitempty"`
	IPAddress      string                 `json:"ip_address,omitempty"`
	UserAgent      string                 `json:"user_agent,omitempty"`
	Status         string                 `json:"status"`
	Details        map[string]interface{} `json:"details,omitempty"`
	Timestamp      time.Time              `json:"timestamp"`
}

// EventFilters provides filtering options for audit events
type EventFilters struct {
	OrganizationID *int64
	UserID         *int64
	Action         *string
	ResourceType   *string
	StartTime      *time.Time
	EndTime        *time.Time
	Limit          int32
	Offset         int32
}

// SearchFilters provides filtering options for SearchEvents
type SearchFilters struct {
	OrganizationID int64
	Action         *string
	Status         *string
	Search         *string
	Limit          int32
	Offset         int32
}

// DefaultLogger implements the Logger interface
type DefaultLogger struct {
	pool    *pgxpool.Pool
	queries *sqlc.Queries
}

// NewLogger creates a new audit logger
func NewLogger(pool *pgxpool.Pool) Logger {
	return &DefaultLogger{
		pool:    pool,
		queries: sqlc.New(pool),
	}
}

// LogEvent logs an audit event to the database
func (l *DefaultLogger) LogEvent(ctx context.Context, event Event) error {
	// Serialize details to JSON
	var detailsJSON []byte
	if event.Details != nil {
		var err error
		detailsJSON, err = json.Marshal(event.Details)
		if err != nil {
			return fmt.Errorf("failed to serialize details: %w", err)
		}
	}

	// Prepare parameters
	var userID pgtype.Int8
	if event.UserID != nil {
		userID = pgtype.Int8{Int64: *event.UserID, Valid: true}
	}

	var ipAddress pgtype.Text
	if event.IPAddress != "" {
		ipAddress = pgtype.Text{String: event.IPAddress, Valid: true}
	}

	var userAgent pgtype.Text
	if event.UserAgent != "" {
		userAgent = pgtype.Text{String: event.UserAgent, Valid: true}
	}

	var resourceType pgtype.Text
	if event.ResourceType != "" {
		resourceType = pgtype.Text{String: event.ResourceType, Valid: true}
	}

	var resourceID pgtype.Text
	if event.ResourceID != "" {
		resourceID = pgtype.Text{String: event.ResourceID, Valid: true}
	}

	// Log the event
	_, err := l.queries.CreateAuditLog(ctx, sqlc.CreateAuditLogParams{
		OrganizationID: event.OrganizationID,
		UserID:         userID,
		Action:         event.Action,
		ResourceType:   resourceType,
		ResourceID:     resourceID,
		IpAddress:      ipAddress,
		UserAgent:      userAgent,
		Status:         event.Status,
		Details:        detailsJSON,
	})

	return err
}

// GetEvents retrieves audit events with pagination and filtering
func (l *DefaultLogger) GetEvents(ctx context.Context, filters EventFilters) ([]*Event, error) {
	// Set defaults
	limit := filters.Limit
	if limit <= 0 {
		limit = 100
	}
	offset := filters.Offset
	if offset < 0 {
		offset = 0
	}

	var logs []sqlc.AuditLogs
	var err error

	// Query based on filters
	if filters.OrganizationID != nil {
		logs, err = l.queries.ListAuditLogsByOrg(ctx, sqlc.ListAuditLogsByOrgParams{
			OrganizationID: *filters.OrganizationID,
			Limit:          limit,
			Offset:         offset,
		})
	} else if filters.UserID != nil {
		logs, err = l.queries.ListAuditLogsByUser(ctx, sqlc.ListAuditLogsByUserParams{
			UserID: pgtype.Int8{Int64: *filters.UserID, Valid: true},
			Limit:  limit,
			Offset: offset,
		})
	} else {
		// No filters - this shouldn't happen in production, but handle it
		return nil, fmt.Errorf("organization_id or user_id filter is required")
	}

	if err != nil {
		return nil, fmt.Errorf("failed to retrieve audit logs: %w", err)
	}

	// Convert to Event objects
	events := make([]*Event, len(logs))
	for i, log := range logs {
		var details map[string]interface{}
		if len(log.Details) > 0 {
			if err := json.Unmarshal(log.Details, &details); err != nil {
				// Log error but don't fail the entire operation
				details = map[string]interface{}{"error": "failed to parse details"}
			}
		}

		var userID *int64
		if log.UserID.Valid {
			userID = &log.UserID.Int64
		}

		events[i] = &Event{
			ID:             log.ID,
			OrganizationID: log.OrganizationID,
			UserID:         userID,
			Action:         log.Action,
			ResourceType:   log.ResourceType.String,
			ResourceID:     log.ResourceID.String,
			IPAddress:      log.IpAddress.String,
			UserAgent:      log.UserAgent.String,
			Status:         log.Status,
			Details:        details,
			Timestamp:      log.CreatedAt,
		}
	}

	return events, nil
}

// SearchEvents retrieves audit events (with the acting username/email joined
// in) matching the given filters, plus the total matching count for
// pagination
func (l *DefaultLogger) SearchEvents(ctx context.Context, filters SearchFilters) ([]*Event, int64, error) {
	limit := filters.Limit
	if limit <= 0 {
		limit = 50
	}
	offset := filters.Offset
	if offset < 0 {
		offset = 0
	}

	action := textOrNull(filters.Action)
	status := textOrNull(filters.Status)
	search := textOrNull(filters.Search)

	rows, err := l.queries.SearchAuditLogsByOrg(ctx, sqlc.SearchAuditLogsByOrgParams{
		OrganizationID: filters.OrganizationID,
		Action:         action,
		Status:         status,
		Search:         search,
		RowLimit:       limit,
		RowOffset:      offset,
	})
	if err != nil {
		return nil, 0, fmt.Errorf("failed to search audit logs: %w", err)
	}

	total, err := l.queries.CountSearchAuditLogsByOrg(ctx, sqlc.CountSearchAuditLogsByOrgParams{
		OrganizationID: filters.OrganizationID,
		Action:         action,
		Status:         status,
		Search:         search,
	})
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count audit logs: %w", err)
	}

	events := make([]*Event, len(rows))
	for i, row := range rows {
		var details map[string]interface{}
		if len(row.Details) > 0 {
			if err := json.Unmarshal(row.Details, &details); err != nil {
				details = map[string]interface{}{"error": "failed to parse details"}
			}
		}

		var userID *int64
		if row.UserID.Valid {
			userID = &row.UserID.Int64
		}

		events[i] = &Event{
			ID:             row.ID,
			OrganizationID: row.OrganizationID,
			UserID:         userID,
			Username:       row.Username.String,
			Email:          row.Email.String,
			Action:         row.Action,
			ResourceType:   row.ResourceType.String,
			ResourceID:     row.ResourceID.String,
			IPAddress:      row.IpAddress.String,
			Status:         row.Status,
			Details:        details,
			Timestamp:      row.CreatedAt,
		}
	}

	return events, total, nil
}

func textOrNull(s *string) pgtype.Text {
	if s == nil || *s == "" {
		return pgtype.Text{}
	}
	return pgtype.Text{String: *s, Valid: true}
}

// NoopLogger is a no-op implementation for when audit logging is disabled
type NoopLogger struct{}

// NewNoopLogger creates a new no-op audit logger
func NewNoopLogger() Logger {
	return &NoopLogger{}
}

// LogEvent does nothing
func (l *NoopLogger) LogEvent(ctx context.Context, event Event) error {
	return nil
}

// GetEvents returns an empty slice
func (l *NoopLogger) GetEvents(ctx context.Context, filters EventFilters) ([]*Event, error) {
	return []*Event{}, nil
}

// SearchEvents returns an empty slice with a zero total
func (l *NoopLogger) SearchEvents(ctx context.Context, filters SearchFilters) ([]*Event, int64, error) {
	return []*Event{}, 0, nil
}
