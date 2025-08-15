package models

import "time"

// ErrorResponse represents an API error response
type ErrorResponse struct {
	Error   string         `json:"error" example:"Volume not found"`
	Message string         `json:"message,omitempty" example:"Additional error details"`
	Code    string         `json:"code,omitempty" example:"VOLUME_NOT_FOUND"`
	Details map[string]any `json:"details,omitempty"`
} // @name ErrorResponse

// HealthResponse represents a health check response
type HealthResponse struct {
	Status     string                 `json:"status" example:"ok"`
	Service    string                 `json:"service" example:"volumeviz"`
	Version    string                 `json:"version" example:"v1"`
	Timestamp  time.Time              `json:"timestamp"`
	Components map[string]interface{} `json:"components,omitempty"`
} // @name HealthResponse

// DockerHealth represents Docker daemon health status
type DockerHealth struct {
	Status     string `json:"status" example:"healthy"`
	Message    string `json:"message,omitempty" example:"Docker daemon is responsive"`
	Version    string `json:"version,omitempty" example:"20.10.8"`
	APIVersion string `json:"api_version,omitempty" example:"1.41"`
	GoVersion  string `json:"go_version,omitempty" example:"go1.16.6"`
	GitCommit  string `json:"git_commit,omitempty" example:"75249d8"`
	BuildTime  string `json:"build_time,omitempty" example:"2021-07-30T19:52:10.000000000+00:00"`
} // @name DockerHealth
