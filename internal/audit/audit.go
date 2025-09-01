package audit

import (
	"context"
	"encoding/json"
	"fmt"
	"net/netip"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/mantonx/volumeviz/internal/auth"
	"github.com/mantonx/volumeviz/internal/db/sqlc"
)

// Logger provides audit logging functionality
type Logger interface {
	// LogEvent logs an audit event
	LogEvent(ctx context.Context, event Event) error
	
	// GetEvents retrieves audit events with pagination and filtering
	GetEvents(ctx context.Context, filters EventFilters) ([]*Event, error)
}

// Event represents an audit log event
type Event struct {
	ID           int64                  `json:"id,omitempty"`
	UserID       *int64                 `json:"user_id,omitempty"`
	SessionID    *int64                 `json:"session_id,omitempty"`
	Action       string                 `json:"action"`
	ResourceType string                 `json:"resource_type"`
	ResourceID   string                 `json:"resource_id,omitempty"`
	Details      string                 `json:"details,omitempty"`
	Metadata     map[string]interface{} `json:"metadata,omitempty"`
	IPAddress    *netip.Addr            `json:"ip_address,omitempty"`
	UserAgent    *string                `json:"user_agent,omitempty"`
	Timestamp    time.Time              `json:"timestamp"`
}

// EventFilters provides filtering options for audit events
type EventFilters struct {
	UserID       *int64
	Action       *string
	ResourceType *string
	ResourceID   *string
	StartTime    *time.Time
	EndTime      *time.Time
	Limit        int32
	Offset       int32
}

// DefaultLogger implements the Logger interface
type DefaultLogger struct {
	queries *sqlc.Queries
}

// NewLogger creates a new audit logger
func NewLogger(queries *sqlc.Queries) Logger {
	return &DefaultLogger{
		queries: queries,
	}
}

// LogEvent logs an audit event to the database
func (l *DefaultLogger) LogEvent(ctx context.Context, event Event) error {
	// Get user ID and session ID from context
	var userID pgtype.Int8
	var sessionID pgtype.Int8
	
	if event.UserID != nil {
		userID = pgtype.Int8{Int64: *event.UserID, Valid: true}
	} else if contextUserID, ok := auth.GetUserIDFromContext(ctx); ok {
		userID = pgtype.Int8{Int64: contextUserID, Valid: true}
	}
	
	if event.SessionID != nil {
		sessionID = pgtype.Int8{Int64: *event.SessionID, Valid: true}
	}
	
	// Serialize metadata
	var metadataBytes []byte
	if event.Metadata != nil {
		var err error
		metadataBytes, err = json.Marshal(event.Metadata)
		if err != nil {
			return fmt.Errorf("failed to serialize metadata: %w", err)
		}
	} else {
		metadataBytes = []byte("{}")
	}
	
	// Log the event
	_, err := l.queries.LogUserActivity(ctx, sqlc.LogUserActivityParams{
		UserID:       userID,
		Action:       event.Action,
		ResourceType: pgtype.Text{String: event.ResourceType, Valid: event.ResourceType != ""},
		ResourceID:   pgtype.Text{String: event.ResourceID, Valid: event.ResourceID != ""},
		Details:      metadataBytes, // Store full event details including metadata
		IpAddress:    event.IPAddress,
		UserAgent:    pgtype.Text{String: getStringValue(event.UserAgent), Valid: event.UserAgent != nil},
		SessionID:    sessionID,
	})
	if err != nil {
		return fmt.Errorf("failed to log audit event: %w", err)
	}
	
	return nil
}

// GetEvents retrieves audit events with filtering and pagination
func (l *DefaultLogger) GetEvents(ctx context.Context, filters EventFilters) ([]*Event, error) {
	// Set default values
	limit := filters.Limit
	if limit <= 0 {
		limit = 50
	}
	offset := filters.Offset
	if offset < 0 {
		offset = 0
	}
	
	// For now, we'll implement a simple query by user ID
	// TODO: Implement more sophisticated filtering when needed
	var userID pgtype.Int8
	if filters.UserID != nil {
		userID = pgtype.Int8{Int64: *filters.UserID, Valid: true}
	} else {
		// If no user filter, get current user from context
		if contextUserID, ok := auth.GetUserIDFromContext(ctx); ok {
			userID = pgtype.Int8{Int64: contextUserID, Valid: true}
		} else {
			return []*Event{}, nil // No user context, return empty
		}
	}
	
	// Get user activity records
	activityRecords, err := l.queries.GetUserActivityLog(ctx, sqlc.GetUserActivityLogParams{
		UserID: userID,
		Limit:  limit,
		Offset: offset,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get audit events: %w", err)
	}
	
	// Convert to audit events
	events := make([]*Event, 0, len(activityRecords))
	for _, record := range activityRecords {
		event := &Event{
			ID:           record.ID,
			Action:       record.Action,
			ResourceType: record.ResourceType.String,
			ResourceID:   record.ResourceID.String,
			IPAddress:    record.IpAddress,
			UserAgent:    getOptionalString(record.UserAgent),
			Timestamp:    record.CreatedAt,
		}
		
		if record.UserID.Valid {
			event.UserID = &record.UserID.Int64
		}
		if record.SessionID.Valid {
			event.SessionID = &record.SessionID.Int64
		}
		
		// Parse details as JSON metadata
		if len(record.Details) > 0 {
			var metadata map[string]interface{}
			if err := json.Unmarshal(record.Details, &metadata); err == nil {
				event.Metadata = metadata
				// Extract details string if present
				if details, ok := metadata["details"].(string); ok {
					event.Details = details
				}
			}
		}
		
		events = append(events, event)
	}
	
	return events, nil
}

// Helper functions

// getStringValue safely gets the value from a string pointer
func getStringValue(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

// getOptionalString safely extracts a string from pgtype.Text
func getOptionalString(text pgtype.Text) *string {
	if !text.Valid {
		return nil
	}
	return &text.String
}