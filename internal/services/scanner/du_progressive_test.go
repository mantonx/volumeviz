package scanner

import (
	"testing"
	"time"

	"github.com/mantonx/volumeviz/internal/interfaces"
	"github.com/mantonx/volumeviz/internal/models"
	"github.com/stretchr/testify/assert"
)

func TestDuMethodSetProgressCallback(t *testing.T) {
	config := models.ScanConfig{
		DefaultTimeout: 30 * time.Second,
	}
	
	progressManager := NewProgressManager(nil)
	method := NewDuMethod(config, progressManager)

	// Test SetProgressCallback - cast to the specific type to access the method
	if duMethod, ok := method.(*ProgressiveDu); ok {
		callback := func(update interfaces.ProgressUpdate) {
			// This is a no-op callback but exercises the code path
		}
		duMethod.SetProgressCallback(callback)
		
		// Verify the method still works after setting callback
		assert.NotNil(t, duMethod)
		assert.Equal(t, "progressive_du", duMethod.Name())
		assert.True(t, duMethod.SupportsProgress())
		assert.True(t, duMethod.Available()) // du should always be available on Unix systems
	} else {
		t.Skip("Could not cast to ProgressiveDu type")
	}
}

func TestDuMethodBasics(t *testing.T) {
	config := models.ScanConfig{
		DefaultTimeout: 30 * time.Second,
	}
	
	progressManager := NewProgressManager(nil)
	method := NewDuMethod(config, progressManager)

	// Basic method tests
	assert.Equal(t, "progressive_du", method.Name())
	assert.True(t, method.SupportsProgress())
	assert.True(t, method.Available())
	
	// Test EstimatedDuration
	duration := method.EstimatedDuration("/tmp")
	assert.Greater(t, duration, time.Duration(0))
}