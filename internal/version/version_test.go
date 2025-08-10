package version

import (
	"runtime"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestGet(t *testing.T) {
	info := Get()

	// Test that all fields are populated
	assert.NotEmpty(t, info.Version)
	assert.NotEmpty(t, info.GitCommit)
	assert.NotEmpty(t, info.GitBranch)
	assert.NotEmpty(t, info.BuildDate)
	assert.NotEmpty(t, info.GoVersion)
	assert.NotEmpty(t, info.Platform)

	// Test default values
	assert.Equal(t, Version, info.Version)
	assert.Equal(t, GitCommit, info.GitCommit)
	assert.Equal(t, GitBranch, info.GitBranch)
	assert.Equal(t, BuildDate, info.BuildDate)
	assert.Equal(t, GoVersion, info.GoVersion)
	
	// Test platform format
	expectedPlatform := runtime.GOOS + "/" + runtime.GOARCH
	assert.Equal(t, expectedPlatform, info.Platform)

	// Test Go version comes from runtime
	assert.Equal(t, runtime.Version(), info.GoVersion)
}

func TestGetVersionString(t *testing.T) {
	// Store original version
	originalVersion := Version

	// Test development version
	Version = "dev"
	versionString := GetVersionString()
	assert.Equal(t, "volumeviz-dev", versionString)

	// Test release version
	Version = "1.2.3"
	versionString = GetVersionString()
	assert.Equal(t, "volumeviz-1.2.3", versionString)

	// Test version with pre-release
	Version = "2.0.0-rc1"
	versionString = GetVersionString()
	assert.Equal(t, "volumeviz-2.0.0-rc1", versionString)

	// Test empty version (should not happen but test edge case)
	Version = ""
	versionString = GetVersionString()
	assert.Equal(t, "volumeviz-", versionString)

	// Restore original version
	Version = originalVersion
}

func TestDefaultValues(t *testing.T) {
	// Test that default values are set as expected
	assert.Equal(t, "dev", Version)
	assert.Equal(t, "unknown", GitCommit)
	assert.Equal(t, "unknown", GitBranch)
	assert.Equal(t, "unknown", BuildDate)
	assert.Equal(t, runtime.Version(), GoVersion)
}

func TestInfoStruct(t *testing.T) {
	info := Info{
		Version:   "test-version",
		GitCommit: "abc123",
		GitBranch: "main",
		BuildDate: "2023-01-01T00:00:00Z",
		GoVersion: "go1.20.0",
		Platform:  "linux/amd64",
	}

	assert.Equal(t, "test-version", info.Version)
	assert.Equal(t, "abc123", info.GitCommit)
	assert.Equal(t, "main", info.GitBranch)
	assert.Equal(t, "2023-01-01T00:00:00Z", info.BuildDate)
	assert.Equal(t, "go1.20.0", info.GoVersion)
	assert.Equal(t, "linux/amd64", info.Platform)
}

func TestPlatformFormat(t *testing.T) {
	info := Get()
	
	// Platform should be in format OS/ARCH
	parts := strings.Split(info.Platform, "/")
	assert.Len(t, parts, 2, "Platform should be in format OS/ARCH")
	
	// First part should be the OS
	assert.Contains(t, []string{"linux", "darwin", "windows", "freebsd"}, parts[0])
	
	// Second part should be the architecture
	assert.Contains(t, []string{"amd64", "386", "arm64", "arm"}, parts[1])
}

func TestGoVersionFormat(t *testing.T) {
	info := Get()
	
	// GoVersion should start with "go"
	assert.True(t, strings.HasPrefix(info.GoVersion, "go"), "Go version should start with 'go'")
	
	// Should match runtime.Version()
	assert.Equal(t, runtime.Version(), info.GoVersion)
}

func TestVersionStringVariants(t *testing.T) {
	testCases := []struct {
		version  string
		expected string
	}{
		{"dev", "volumeviz-dev"},
		{"1.0.0", "volumeviz-1.0.0"},
		{"2.1.0-beta", "volumeviz-2.1.0-beta"},
		{"3.0.0-alpha.1", "volumeviz-3.0.0-alpha.1"},
		{"latest", "volumeviz-latest"},
	}

	originalVersion := Version
	defer func() {
		Version = originalVersion
	}()

	for _, tc := range testCases {
		t.Run(tc.version, func(t *testing.T) {
			Version = tc.version
			result := GetVersionString()
			assert.Equal(t, tc.expected, result)
		})
	}
}