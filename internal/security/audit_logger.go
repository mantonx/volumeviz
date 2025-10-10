package security

import (
	"context"
	"encoding/json"
	"log"
	"net/netip"
	"strconv"
	"time"

	"github.com/mantonx/volumeviz/internal/audit"
)

// SecurityAuditLogger handles security-specific audit logging with organization context
type SecurityAuditLogger struct {
	auditLogger audit.Logger
}

// NewSecurityAuditLogger creates a new security audit logger
func NewSecurityAuditLogger(auditLogger audit.Logger) *SecurityAuditLogger {
	return &SecurityAuditLogger{
		auditLogger: auditLogger,
	}
}

// SecurityEventType represents different types of security events
type SecurityEventType string

const (
	EventTypeAuthentication        SecurityEventType = "AUTHENTICATION"
	EventTypeAuthorization        SecurityEventType = "AUTHORIZATION"
	EventTypeCrossOrgAccess       SecurityEventType = "CROSS_ORG_ACCESS"
	EventTypeDataAccess           SecurityEventType = "DATA_ACCESS"
	EventTypeSystemAdminAccess    SecurityEventType = "SYSTEM_ADMIN_ACCESS"
	EventTypeRLSPolicyViolation   SecurityEventType = "RLS_POLICY_VIOLATION"
	EventTypeOrganizationSwitch   SecurityEventType = "ORGANIZATION_SWITCH"
	EventTypeSecurityConfigChange SecurityEventType = "SECURITY_CONFIG_CHANGE"
)

// SecurityEvent represents a security-related event for audit logging
type SecurityEvent struct {
	EventType      SecurityEventType      `json:"event_type"`
	UserID         *string                `json:"user_id,omitempty"`
	OrganizationID *int64                 `json:"organization_id,omitempty"`
	TargetOrgID    *int64                 `json:"target_org_id,omitempty"`
	ResourceType   string                 `json:"resource_type,omitempty"`
	ResourceID     string                 `json:"resource_id,omitempty"`
	Action         string                 `json:"action"`
	Result         SecurityEventResult    `json:"result"`
	Details        map[string]interface{} `json:"details,omitempty"`
	IPAddress      string                 `json:"ip_address,omitempty"`
	UserAgent      string                 `json:"user_agent,omitempty"`
	Timestamp      time.Time              `json:"timestamp"`
}

// SecurityEventResult represents the result of a security event
type SecurityEventResult string

const (
	ResultSuccess SecurityEventResult = "SUCCESS"
	ResultDenied  SecurityEventResult = "DENIED"
	ResultError   SecurityEventResult = "ERROR"
)

// LogAuthentication logs authentication events
func (sal *SecurityAuditLogger) LogAuthentication(ctx context.Context, userID string, result SecurityEventResult, details map[string]interface{}) {
	event := SecurityEvent{
		EventType: EventTypeAuthentication,
		UserID:    &userID,
		Action:    "LOGIN",
		Result:    result,
		Details:   details,
		Timestamp: time.Now(),
	}

	sal.logSecurityEvent(ctx, event)
}

// LogAuthorization logs authorization events
func (sal *SecurityAuditLogger) LogAuthorization(ctx context.Context, userID string, resource string, action string, result SecurityEventResult, details map[string]interface{}) {
	// Get organization context if available
	var orgID *int64
	if orgCtx, ok := GetOrganizationContext(ctx); ok && orgCtx.OrganizationID != nil {
		orgID = orgCtx.OrganizationID
	}

	event := SecurityEvent{
		EventType:      EventTypeAuthorization,
		UserID:         &userID,
		OrganizationID: orgID,
		ResourceType:   resource,
		Action:         action,
		Result:         result,
		Details:        details,
		Timestamp:      time.Now(),
	}

	sal.logSecurityEvent(ctx, event)
}

// LogCrossOrganizationAccess logs attempts to access data from different organizations
func (sal *SecurityAuditLogger) LogCrossOrganizationAccess(ctx context.Context, userID string, userOrgID int64, targetOrgID int64, resource string, result SecurityEventResult) {
	details := map[string]interface{}{
		"user_organization":   userOrgID,
		"target_organization": targetOrgID,
		"resource":           resource,
	}

	event := SecurityEvent{
		EventType:      EventTypeCrossOrgAccess,
		UserID:         &userID,
		OrganizationID: &userOrgID,
		TargetOrgID:    &targetOrgID,
		ResourceType:   resource,
		Action:         "ACCESS_ATTEMPT",
		Result:         result,
		Details:        details,
		Timestamp:      time.Now(),
	}

	sal.logSecurityEvent(ctx, event)
}

// LogDataAccess logs data access events
func (sal *SecurityAuditLogger) LogDataAccess(ctx context.Context, userID string, resourceType string, resourceID string, action string, result SecurityEventResult, details map[string]interface{}) {
	// Get organization context
	var orgID *int64
	if orgCtx, ok := GetOrganizationContext(ctx); ok && orgCtx.OrganizationID != nil {
		orgID = orgCtx.OrganizationID
	}

	event := SecurityEvent{
		EventType:      EventTypeDataAccess,
		UserID:         &userID,
		OrganizationID: orgID,
		ResourceType:   resourceType,
		ResourceID:     resourceID,
		Action:         action,
		Result:         result,
		Details:        details,
		Timestamp:      time.Now(),
	}

	sal.logSecurityEvent(ctx, event)
}

// LogSystemAdminAccess logs system admin access events
func (sal *SecurityAuditLogger) LogSystemAdminAccess(ctx context.Context, userID string, action string, details map[string]interface{}) {
	event := SecurityEvent{
		EventType: EventTypeSystemAdminAccess,
		UserID:    &userID,
		Action:    action,
		Result:    ResultSuccess,
		Details:   details,
		Timestamp: time.Now(),
	}

	sal.logSecurityEvent(ctx, event)
}

// LogRLSPolicyViolation logs RLS policy violations
func (sal *SecurityAuditLogger) LogRLSPolicyViolation(ctx context.Context, userID string, table string, details map[string]interface{}) {
	if details == nil {
		details = make(map[string]interface{})
	}
	details["table"] = table
	details["violation_type"] = "RLS_POLICY_BYPASS_ATTEMPT"

	event := SecurityEvent{
		EventType: EventTypeRLSPolicyViolation,
		UserID:    &userID,
		Action:    "POLICY_VIOLATION",
		Result:    ResultDenied,
		Details:   details,
		Timestamp: time.Now(),
	}

	sal.logSecurityEvent(ctx, event)
}

// LogOrganizationSwitch logs organization context switches
func (sal *SecurityAuditLogger) LogOrganizationSwitch(ctx context.Context, userID string, fromOrgID *int64, toOrgID int64, result SecurityEventResult) {
	details := map[string]interface{}{
		"from_organization": fromOrgID,
		"to_organization":   toOrgID,
	}

	event := SecurityEvent{
		EventType:      EventTypeOrganizationSwitch,
		UserID:         &userID,
		OrganizationID: fromOrgID,
		TargetOrgID:    &toOrgID,
		Action:         "ORGANIZATION_SWITCH",
		Result:         result,
		Details:        details,
		Timestamp:      time.Now(),
	}

	sal.logSecurityEvent(ctx, event)
}

// logSecurityEvent logs a security event using the audit logger
func (sal *SecurityAuditLogger) logSecurityEvent(ctx context.Context, event SecurityEvent) {
	// Convert security event to audit log entry
	_, err := json.Marshal(event)
	if err != nil {
		log.Printf("[SECURITY-AUDIT] Failed to marshal security event: %v", err)
		return
	}

	// Parse IP address if present
	var ipAddr *netip.Addr
	if event.IPAddress != "" {
		if addr, err := netip.ParseAddr(event.IPAddress); err == nil {
			ipAddr = &addr
		}
	}

	// Create audit log event
	ipAddrStr := ""
	if ipAddr != nil {
		ipAddrStr = ipAddr.String()
	}
	auditEvent := audit.Event{
		Action:       string(event.EventType),
		ResourceType: event.ResourceType,
		ResourceID:   event.ResourceID,
		IPAddress:    ipAddrStr,
		UserAgent:    event.UserAgent,
		Details:      event.Details,
		Timestamp:    event.Timestamp,
		Status:       "success", // Default to success
	}

	// Add user and organization context if available
	if event.UserID != nil {
		// Convert string to int64 for audit event
		if userID, err := strconv.ParseInt(*event.UserID, 10, 64); err == nil {
			auditEvent.UserID = &userID
		}
	}

	// Log using audit logger
	err = sal.auditLogger.LogEvent(ctx, auditEvent)
	if err != nil {
		log.Printf("[SECURITY-AUDIT] Failed to log security event: %v", err)
		// Fallback to regular logging
		log.Printf("[SECURITY-AUDIT] %s: %+v", event.EventType, event)
	}
}

// GetSecurityAuditLogs retrieves security audit logs with organization filtering
func (sal *SecurityAuditLogger) GetSecurityAuditLogs(ctx context.Context, limit int32, offset int32) ([]*audit.Event, error) {
	// Use audit logger to get events
	filters := audit.EventFilters{
		Limit:  limit,
		Offset: offset,
	}

	return sal.auditLogger.GetEvents(ctx, filters)
}

// SecurityAuditMetrics represents security audit metrics
type SecurityAuditMetrics struct {
	TotalEvents              int64                            `json:"total_events"`
	EventsByType             map[SecurityEventType]int64      `json:"events_by_type"`
	EventsByResult           map[SecurityEventResult]int64    `json:"events_by_result"`
	EventsByOrganization     map[int64]int64                  `json:"events_by_organization"`
	CrossOrgAccessAttempts   int64                            `json:"cross_org_access_attempts"`
	RLSPolicyViolations      int64                            `json:"rls_policy_violations"`
	SystemAdminActions       int64                            `json:"system_admin_actions"`
	LastEventTimestamp       *time.Time                       `json:"last_event_timestamp"`
}

// GetSecurityAuditMetrics returns security audit metrics
func (sal *SecurityAuditLogger) GetSecurityAuditMetrics(ctx context.Context) (*SecurityAuditMetrics, error) {
	// TODO: Implement metrics collection from audit logs
	// This would query the audit_logs table and aggregate security events
	
	return &SecurityAuditMetrics{
		EventsByType:   make(map[SecurityEventType]int64),
		EventsByResult: make(map[SecurityEventResult]int64),
		EventsByOrganization: make(map[int64]int64),
	}, nil
}

// InitializeSecurityAuditLogger initializes security audit logging for the application
func InitializeSecurityAuditLogger(auditLogger audit.Logger) *SecurityAuditLogger {
	sal := NewSecurityAuditLogger(auditLogger)
	
	log.Printf("[SECURITY-AUDIT] Security audit logger initialized")
	
	return sal
}