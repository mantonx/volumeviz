package database

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

// TestStructToMap tests the StructToMap function with embedded structs
func TestStructToMap(t *testing.T) {
	now := time.Now()

	tests := []struct {
		name          string
		input         interface{}
		excludeFields []string
		expected      map[string]interface{}
	}{
		{
			name: "simple struct",
			input: struct {
				Name string `db:"name"`
				Age  int    `db:"age"`
			}{
				Name: "John",
				Age:  30,
			},
			expected: map[string]interface{}{
				"name": "John",
				"age":  30,
			},
		},
		{
			name: "struct with embedded BaseModel",
			input: &Volume{
				BaseModel: BaseModel{
					ID:        1,
					CreatedAt: now,
					UpdatedAt: now,
				},
				VolumeID:   "vol-123",
				Name:       "test-volume",
				Driver:     "local",
				Mountpoint: "/var/lib/docker/volumes/test",
				Labels:     Labels{"env": "test"},
				Options:    Labels{},
				Scope:      "local",
				Status:     "active",
				IsActive:   true,
			},
			expected: map[string]interface{}{
				"id":         1,
				"created_at": now,
				"updated_at": now,
				"volume_id":  "vol-123",
				"name":       "test-volume",
				"driver":     "local",
				"mountpoint": "/var/lib/docker/volumes/test",
				"labels":     Labels{"env": "test"},
				"options":    Labels{},
				"scope":      "local",
				"status":     "active",
				"is_active":  true,
			},
		},
		{
			name: "struct with exclusions",
			input: &Volume{
				BaseModel: BaseModel{
					ID:        1,
					CreatedAt: now,
					UpdatedAt: now,
				},
				VolumeID:   "vol-456",
				Name:       "excluded-volume",
				Driver:     "overlay",
				Mountpoint: "/mnt/volumes/test",
				IsActive:   false,
			},
			excludeFields: []string{"id", "created_at", "updated_at"},
			expected: map[string]interface{}{
				"volume_id":  "vol-456",
				"name":       "excluded-volume",
				"driver":     "overlay",
				"mountpoint": "/mnt/volumes/test",
				"labels":     Labels(nil),
				"options":    Labels(nil),
				"scope":      "",
				"status":     "",
				"is_active":  false,
			},
		},
		{
			name: "struct with nil pointer fields",
			input: &Volume{
				BaseModel: BaseModel{
					ID: 2,
				},
				VolumeID:    "vol-789",
				Name:        "nil-fields",
				Driver:      "local",
				Mountpoint:  "/tmp",
				LastScanned: nil, // nil pointer field
			},
			expected: map[string]interface{}{
				"id":         2,
				"volume_id":  "vol-789",
				"name":       "nil-fields",
				"driver":     "local",
				"mountpoint": "/tmp",
				"labels":     Labels(nil),
				"options":    Labels(nil),
				"scope":      "",
				"status":     "",
				"is_active":  false,
			},
		},
		{
			name: "struct with db tag '-'",
			input: struct {
				Name     string `db:"name"`
				Internal string `db:"-"`
				Age      int    `db:"age"`
			}{
				Name:     "Jane",
				Internal: "should be skipped",
				Age:      25,
			},
			expected: map[string]interface{}{
				"name": "Jane",
				"age":  25,
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := StructToMap(tt.input, tt.excludeFields...)

			// Check that all expected fields are present
			for key, expectedValue := range tt.expected {
				actualValue, exists := result[key]
				assert.True(t, exists, "expected key %s to exist", key)

				// For time values, compare with precision
				if expectedTime, ok := expectedValue.(time.Time); ok {
					if actualTime, ok := actualValue.(time.Time); ok {
						assert.WithinDuration(t, expectedTime, actualTime, time.Microsecond,
							"time values for key %s should be equal", key)
					} else {
						assert.Equal(t, expectedValue, actualValue, "values for key %s should be equal", key)
					}
				} else {
					assert.Equal(t, expectedValue, actualValue, "values for key %s should be equal", key)
				}
			}

			// Check that no unexpected fields are present
			assert.Equal(t, len(tt.expected), len(result),
				"result should have exactly %d fields", len(tt.expected))
		})
	}
}

// TestProcessStruct tests the processStruct helper function
func TestProcessStruct(t *testing.T) {
	type EmbeddedStruct struct {
		Field1 string `db:"field1"`
		Field2 int    `db:"field2"`
	}

	type TestStruct struct {
		EmbeddedStruct
		Field3 string `db:"field3"`
		Field4 bool   `db:"field4"`
	}

	input := TestStruct{
		EmbeddedStruct: EmbeddedStruct{
			Field1: "value1",
			Field2: 42,
		},
		Field3: "value3",
		Field4: true,
	}

	result := StructToMap(input)

	expected := map[string]interface{}{
		"field1": "value1",
		"field2": 42,
		"field3": "value3",
		"field4": true,
	}

	assert.Equal(t, expected, result)
}

// BenchmarkStructToMap benchmarks the StructToMap function
func BenchmarkStructToMap(b *testing.B) {
	v := &Volume{
		BaseModel: BaseModel{
			ID:        1,
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		},
		VolumeID:   "vol-bench",
		Name:       "benchmark-volume",
		Driver:     "local",
		Mountpoint: "/var/lib/docker/volumes/bench",
		Labels:     Labels{"env": "prod", "app": "test"},
		Options:    Labels{"type": "tmpfs"},
		Scope:      "local",
		Status:     "active",
		IsActive:   true,
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = StructToMap(v)
	}
}

// BenchmarkStructToMapWithExclusions benchmarks StructToMap with exclusions
func BenchmarkStructToMapWithExclusions(b *testing.B) {
	v := &Volume{
		BaseModel: BaseModel{
			ID:        1,
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		},
		VolumeID:   "vol-bench",
		Name:       "benchmark-volume",
		Driver:     "local",
		Mountpoint: "/var/lib/docker/volumes/bench",
		IsActive:   true,
	}

	excludeFields := []string{"id", "created_at", "updated_at"}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = StructToMap(v, excludeFields...)
	}
}
