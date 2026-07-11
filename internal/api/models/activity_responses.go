package models

import "time"

// ActivityEventV1 is one audit-log entry as shown in the Recent Activity feed
type ActivityEventV1 struct {
	ID           int64     `json:"id" example:"42"`
	Action       string    `json:"action" example:"volume.delete"`
	ResourceType string    `json:"resource_type,omitempty" example:"volume"`
	ResourceID   string    `json:"resource_id,omitempty" example:"a1b2c3d4"`
	Status       string    `json:"status" example:"success" enums:"success,failure"`
	Timestamp    time.Time `json:"timestamp"`
} // @name ActivityEventV1

// RecentActivityResponse is the response body for GET /api/v1/activity/recent
type RecentActivityResponse struct {
	Events []ActivityEventV1 `json:"events"`
} // @name RecentActivityResponse
