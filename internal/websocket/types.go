package websocket

import (
	"time"
)

// MessageType defines the type of WebSocket message
type MessageType string

const (
	// Client to Server
	MessageTypePing MessageType = "ping"

	// Server to Client
	MessageTypePong         MessageType = "pong"
	MessageTypeVolumeUpdate MessageType = "volume_update"
	MessageTypeScanProgress MessageType = "scan_progress"
	MessageTypeScanComplete MessageType = "scan_complete"
	MessageTypeScanError    MessageType = "scan_error"
)

// Message represents a WebSocket message
type Message struct {
	Type      MessageType `json:"type"`
	Data      any         `json:"data,omitempty"`
	VolumeID  string      `json:"volume_id,omitempty"`
	Timestamp time.Time   `json:"timestamp"`
}

// VolumeData represents volume information for updates
type VolumeData struct {
	ID         string    `json:"id"`
	Name       string    `json:"name"`
	Driver     string    `json:"driver"`
	Mountpoint string    `json:"mountpoint"`
	CreatedAt  time.Time `json:"created_at"`
}

// ScanProgressData represents scan progress information
type ScanProgressData struct {
	Progress       int   `json:"progress"`
	CurrentSize    int64 `json:"current_size"`
	FilesProcessed int   `json:"files_processed"`
}

// ScanCompleteData represents scan completion information
type ScanCompleteData struct {
	VolumeID string     `json:"volume_id"`
	Result   ScanResult `json:"result"`
}

// ScanResult represents the result of a volume scan
type ScanResult struct {
	TotalSize      int64         `json:"total_size"`
	FileCount      int           `json:"file_count"`
	DirectoryCount int           `json:"directory_count"`
	ScannedAt      time.Time     `json:"scanned_at"`
	Method         string        `json:"method"`
	Duration       time.Duration `json:"duration"`
}

// ScanErrorData represents scan error information
type ScanErrorData struct {
	Error string `json:"error"`
	Code  string `json:"code"`
}
