package models

import "time"

// AuditLogEntryV1 is one audit-log entry as shown in the Admin Audit Logs page
type AuditLogEntryV1 struct {
	ID           int64                  `json:"id" example:"42"`
	UserID       int64                  `json:"user_id,omitempty" example:"7"`
	Username     string                 `json:"username,omitempty" example:"admin"`
	Email        string                 `json:"email,omitempty" example:"admin@example.com"`
	Action       string                 `json:"action" example:"volume.delete"`
	ResourceType string                 `json:"resource_type,omitempty" example:"volume"`
	ResourceID   string                 `json:"resource_id,omitempty" example:"a1b2c3d4"`
	IPAddress    string                 `json:"ip_address,omitempty" example:"192.168.1.100"`
	Status       string                 `json:"status" example:"success" enums:"success,failure"`
	Details      map[string]interface{} `json:"details,omitempty"`
	Timestamp    time.Time              `json:"timestamp"`
} // @name AuditLogEntryV1

// AuditLogSearchResponse is the response body for GET /api/v1/audit-logs
type AuditLogSearchResponse struct {
	Logs   []AuditLogEntryV1 `json:"logs"`
	Total  int64             `json:"total" example:"128"`
	Limit  int32             `json:"limit" example:"25"`
	Offset int32             `json:"offset" example:"0"`
} // @name AuditLogSearchResponse
