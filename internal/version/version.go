package version

import (
	"runtime"
)

// Build information. These will be set via ldflags during build
var (
	Version   = "dev"     // The version of the application
	GitCommit = "unknown" // Git commit hash
	GitBranch = "unknown" // Git branch
	BuildDate = "unknown" // Build date
	GoVersion = runtime.Version() // Go version used to build
)

// Info holds version information
type Info struct {
	Version   string `json:"version"`
	GitCommit string `json:"git_commit"`
	GitBranch string `json:"git_branch"`
	BuildDate string `json:"build_date"`
	GoVersion string `json:"go_version"`
	Platform  string `json:"platform"`
}

// Get returns version information
func Get() Info {
	return Info{
		Version:   Version,
		GitCommit: GitCommit,
		GitBranch: GitBranch,
		BuildDate: BuildDate,
		GoVersion: GoVersion,
		Platform:  runtime.GOOS + "/" + runtime.GOARCH,
	}
}

// GetVersionString returns a formatted version string
func GetVersionString() string {
	if Version == "dev" {
		return "volumeviz-dev"
	}
	return "volumeviz-" + Version
}