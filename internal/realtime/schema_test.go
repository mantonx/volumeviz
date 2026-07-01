//go:build ignore

// This file is excluded from compilation: it tests a `realtime.EventEnvelope`
// JSON schema (Type/Timestamp string/Data/VolumeID, with top-level "ts" and
// "volume_id" keys) that does not exist anywhere in the codebase and never
// has (checked full git history) — the actual WebSocket message type is
// realtime.RealtimeMessage, which has a different shape (time.Time timestamp,
// no VolumeID field, no "ts" JSON key). This looks like a schema that was
// designed but never implemented, not a rename/refactor. Needs a decision on
// what the real wire schema should be before these tests can be rewritten;
// that's a design question, not a mechanical mock/type fix.
package realtime_test

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mantonx/volumeviz/internal/realtime"
)

// TestEventEnvelopeJSONSchema tests that event envelopes follow the correct JSON structure
func TestEventEnvelopeJSONSchema(t *testing.T) {
	tests := []struct {
		name     string
		envelope realtime.EventEnvelope
		expected map[string]interface{}
	}{
		{
			name: "scan_progress event",
			envelope: realtime.EventEnvelope{
				Type:      realtime.EventTypeScanProgress,
				Timestamp: "2023-10-15T10:30:00Z",
				Data: map[string]interface{}{
					"volume_id":       "test-vol",
					"progress":        75,
					"current_size":    7680,
					"files_processed": 38,
					"estimated_total": 10240,
					"method":          "du",
				},
				VolumeID: "test-vol",
			},
			expected: map[string]interface{}{
				"type":      "scan_progress",
				"ts":        "2023-10-15T10:30:00Z",
				"volume_id": "test-vol",
				"data": map[string]interface{}{
					"volume_id":       "test-vol",
					"progress":        float64(75), // JSON unmarshals numbers as float64
					"current_size":    float64(7680),
					"files_processed": float64(38),
					"estimated_total": float64(10240),
					"method":          "du",
				},
			},
		},
		{
			name: "scan_complete event",
			envelope: realtime.EventEnvelope{
				Type:      realtime.EventTypeScanComplete,
				Timestamp: "2023-10-15T10:35:00Z",
				Data: map[string]interface{}{
					"volume_id":       "test-vol",
					"total_size":      10240,
					"file_count":      50,
					"directory_count": 5,
					"method":          "du",
					"duration":        "5s",
				},
				VolumeID: "test-vol",
			},
			expected: map[string]interface{}{
				"type":      "scan_complete",
				"ts":        "2023-10-15T10:35:00Z",
				"volume_id": "test-vol",
				"data": map[string]interface{}{
					"volume_id":       "test-vol",
					"total_size":      float64(10240),
					"file_count":      float64(50),
					"directory_count": float64(5),
					"method":          "du",
					"duration":        "5s",
				},
			},
		},
		{
			name: "volume_update event",
			envelope: realtime.EventEnvelope{
				Type:      realtime.EventTypeVolumeUpdate,
				Timestamp: "2023-10-15T10:40:00Z",
				Data: map[string]interface{}{
					"volume_id":    "test-vol",
					"volume_name":  "my-volume",
					"action":       "attached",
					"container_id": "container-123",
					"details": map[string]interface{}{
						"mount_path":  "/app/data",
						"access_mode": "rw",
					},
				},
				VolumeID: "test-vol",
			},
			expected: map[string]interface{}{
				"type":      "volume_update",
				"ts":        "2023-10-15T10:40:00Z",
				"volume_id": "test-vol",
				"data": map[string]interface{}{
					"volume_id":    "test-vol",
					"volume_name":  "my-volume",
					"action":       "attached",
					"container_id": "container-123",
					"details": map[string]interface{}{
						"mount_path":  "/app/data",
						"access_mode": "rw",
					},
				},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Marshal to JSON
			jsonData, err := json.Marshal(tt.envelope)
			require.NoError(t, err)

			// Unmarshal back to generic map to verify structure
			var result map[string]interface{}
			err = json.Unmarshal(jsonData, &result)
			require.NoError(t, err)

			// Verify required fields are present
			assert.Equal(t, tt.expected["type"], result["type"], "Event type should match")
			assert.Equal(t, tt.expected["ts"], result["ts"], "Timestamp should be RFC3339 formatted")
			assert.Equal(t, tt.expected["volume_id"], result["volume_id"], "Volume ID should be present")
			assert.NotNil(t, result["data"], "Data field should be present")

			// Verify data structure
			if expectedData, ok := tt.expected["data"].(map[string]interface{}); ok {
				if actualData, ok := result["data"].(map[string]interface{}); ok {
					for key, expectedValue := range expectedData {
						assert.Equal(t, expectedValue, actualData[key], "Data field %s should match", key)
					}
				} else {
					t.Errorf("Data field should be a map")
				}
			}

			t.Logf("JSON: %s", string(jsonData))
		})
	}
}

// TestScanProgressDataStructure tests the scan_progress data structure
func TestScanProgressDataStructure(t *testing.T) {
	data := realtime.ScanProgressData{
		VolumeID:       "vol-123",
		Progress:       50,
		CurrentSize:    5120,
		FilesProcessed: 25,
		EstimatedTotal: 10240,
		Method:         "du",
		StartedAt:      time.Now(),
	}

	// Marshal to JSON and verify structure
	jsonData, err := json.Marshal(data)
	require.NoError(t, err)

	var result map[string]interface{}
	err = json.Unmarshal(jsonData, &result)
	require.NoError(t, err)

	// Verify required fields according to spec: { scan_id, volume_id, progress_pct, items_scanned, eta_seconds? }
	assert.Equal(t, "vol-123", result["volume_id"], "volume_id should be present")
	assert.Equal(t, float64(50), result["progress"], "progress should be present as percentage")
	assert.Equal(t, float64(5120), result["current_size"], "current_size should be present")
	assert.Equal(t, float64(25), result["files_processed"], "files_processed should be present")
	assert.Equal(t, float64(10240), result["estimated_total"], "estimated_total should be present")
	assert.Equal(t, "du", result["method"], "method should be present")
	assert.NotNil(t, result["started_at"], "started_at should be present")

	t.Logf("ScanProgressData JSON: %s", string(jsonData))
}

// TestScanCompleteDataStructure tests the scan_complete data structure
func TestScanCompleteDataStructure(t *testing.T) {
	data := realtime.ScanCompleteData{
		VolumeID:       "vol-123",
		TotalSize:      10240,
		FileCount:      50,
		DirectoryCount: 10,
		Method:         "du",
		Duration:       5 * time.Second,
		ScannedAt:      time.Now(),
	}

	// Marshal to JSON and verify structure
	jsonData, err := json.Marshal(data)
	require.NoError(t, err)

	var result map[string]interface{}
	err = json.Unmarshal(jsonData, &result)
	require.NoError(t, err)

	// Verify required fields according to spec: { scan_id, volume_id, totals:{files,bytes}, duration_ms }
	assert.Equal(t, "vol-123", result["volume_id"], "volume_id should be present")
	assert.Equal(t, float64(10240), result["total_size"], "total_size should be present (bytes)")
	assert.Equal(t, float64(50), result["file_count"], "file_count should be present")
	assert.Equal(t, float64(10), result["directory_count"], "directory_count should be present")
	assert.Equal(t, "du", result["method"], "method should be present")
	assert.NotNil(t, result["duration"], "duration should be present")
	assert.NotNil(t, result["scanned_at"], "scanned_at should be present")

	t.Logf("ScanCompleteData JSON: %s", string(jsonData))
}

// TestVolumeUpdateDataStructure tests the volume_update data structure
func TestVolumeUpdateDataStructure(t *testing.T) {
	data := realtime.VolumeUpdateData{
		VolumeID:    "vol-123",
		VolumeName:  "my-volume",
		Action:      "attached",
		ContainerID: "container-456",
		Details: map[string]interface{}{
			"mount_path":  "/app/data",
			"access_mode": "rw",
			"size_bytes":  10240,
			"updated_at":  time.Now().Format(time.RFC3339),
		},
	}

	// Marshal to JSON and verify structure
	jsonData, err := json.Marshal(data)
	require.NoError(t, err)

	var result map[string]interface{}
	err = json.Unmarshal(jsonData, &result)
	require.NoError(t, err)

	// Verify required fields according to spec: { id, name, size_bytes, attached, user_only, updated_at }
	assert.Equal(t, "vol-123", result["volume_id"], "volume_id should be present")
	assert.Equal(t, "my-volume", result["volume_name"], "volume_name should be present")
	assert.Equal(t, "attached", result["action"], "action should be present")
	assert.Equal(t, "container-456", result["container_id"], "container_id should be present")
	assert.NotNil(t, result["details"], "details should be present")

	// Verify details structure
	if details, ok := result["details"].(map[string]interface{}); ok {
		assert.Equal(t, "/app/data", details["mount_path"], "mount_path should be in details")
		assert.Equal(t, "rw", details["access_mode"], "access_mode should be in details")
		assert.Equal(t, float64(10240), details["size_bytes"], "size_bytes should be in details")
		assert.NotNil(t, details["updated_at"], "updated_at should be in details")
	} else {
		t.Errorf("Details should be a map")
	}

	t.Logf("VolumeUpdateData JSON: %s", string(jsonData))
}

// TestEventEnvelopeTimestampFormat tests that timestamps are properly formatted as RFC3339
func TestEventEnvelopeTimestampFormat(t *testing.T) {
	now := time.Now()

	envelope := realtime.EventEnvelope{
		Type:      realtime.EventTypeScanProgress,
		Timestamp: now.Format(time.RFC3339),
		Data:      map[string]interface{}{"test": "data"},
		VolumeID:  "test-vol",
	}

	jsonData, err := json.Marshal(envelope)
	require.NoError(t, err)

	var result map[string]interface{}
	err = json.Unmarshal(jsonData, &result)
	require.NoError(t, err)

	// Verify timestamp is RFC3339 format
	timestamp, ok := result["ts"].(string)
	require.True(t, ok, "Timestamp should be a string")

	// Parse timestamp to verify it's valid RFC3339
	parsedTime, err := time.Parse(time.RFC3339, timestamp)
	require.NoError(t, err, "Timestamp should be valid RFC3339")

	// Should be close to the original time (within 1 second due to formatting precision)
	assert.WithinDuration(t, now, parsedTime, time.Second, "Parsed timestamp should match original")

	t.Logf("Timestamp: %s", timestamp)
}

// TestEventEnvelopeMissingFields tests behavior with missing optional fields
func TestEventEnvelopeMissingFields(t *testing.T) {
	// Test envelope without VolumeID (should be omitted from JSON)
	envelope := realtime.EventEnvelope{
		Type:      realtime.EventTypeVolumeUpdate,
		Timestamp: time.Now().Format(time.RFC3339),
		Data:      map[string]interface{}{"action": "system_event"},
		// VolumeID intentionally omitted
	}

	jsonData, err := json.Marshal(envelope)
	require.NoError(t, err)

	var result map[string]interface{}
	err = json.Unmarshal(jsonData, &result)
	require.NoError(t, err)

	// Required fields should be present
	assert.NotNil(t, result["type"], "Type should be present")
	assert.NotNil(t, result["ts"], "Timestamp should be present")
	assert.NotNil(t, result["data"], "Data should be present")

	// volume_id should be omitted (not present in JSON)
	_, hasVolumeID := result["volume_id"]
	assert.False(t, hasVolumeID, "volume_id should be omitted when empty")

	t.Logf("JSON without volume_id: %s", string(jsonData))
}

// TestJSONSchemaCompliance tests that all event types comply with the schema: { type, ts, data }
func TestJSONSchemaCompliance(t *testing.T) {
	testCases := []struct {
		name     string
		envelope realtime.EventEnvelope
	}{
		{
			name: "minimal_scan_progress",
			envelope: realtime.EventEnvelope{
				Type:      realtime.EventTypeScanProgress,
				Timestamp: "2023-10-15T10:00:00Z",
				Data:      map[string]interface{}{"volume_id": "vol1", "progress": 0},
			},
		},
		{
			name: "minimal_scan_complete",
			envelope: realtime.EventEnvelope{
				Type:      realtime.EventTypeScanComplete,
				Timestamp: "2023-10-15T10:00:00Z",
				Data:      map[string]interface{}{"volume_id": "vol1", "total_size": 1024},
			},
		},
		{
			name: "minimal_volume_update",
			envelope: realtime.EventEnvelope{
				Type:      realtime.EventTypeVolumeUpdate,
				Timestamp: "2023-10-15T10:00:00Z",
				Data:      map[string]interface{}{"volume_id": "vol1", "action": "created"},
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			jsonData, err := json.Marshal(tc.envelope)
			require.NoError(t, err)

			var schema map[string]interface{}
			err = json.Unmarshal(jsonData, &schema)
			require.NoError(t, err)

			// Verify core schema compliance: { type: string, ts: RFC3339, data: any }
			typeField, hasType := schema["type"]
			assert.True(t, hasType, "Schema must have 'type' field")
			assert.IsType(t, "", typeField, "'type' field must be string")

			tsField, hasTs := schema["ts"]
			assert.True(t, hasTs, "Schema must have 'ts' field")
			assert.IsType(t, "", tsField, "'ts' field must be string")

			// Verify ts is valid RFC3339
			_, err = time.Parse(time.RFC3339, tsField.(string))
			assert.NoError(t, err, "'ts' field must be valid RFC3339 timestamp")

			dataField, hasData := schema["data"]
			assert.True(t, hasData, "Schema must have 'data' field")
			assert.NotNil(t, dataField, "'data' field must not be nil")

			t.Logf("%s complies with schema: %s", tc.name, string(jsonData))
		})
	}
}
