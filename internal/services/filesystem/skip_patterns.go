package filesystem

import (
	"os"
	"regexp"
	"strings"
)

// SkipPatternMatcher handles file and directory skip pattern matching
// This eliminates duplicate skip logic across walker implementations
type SkipPatternMatcher struct {
	regexes    []*regexp.Regexp
	skipHidden bool
}

// NewSkipPatternMatcher creates a new skip pattern matcher
func NewSkipPatternMatcher(patterns []string, skipHidden bool) (*SkipPatternMatcher, error) {
	matcher := &SkipPatternMatcher{
		skipHidden: skipHidden,
		regexes:    make([]*regexp.Regexp, 0, len(patterns)),
	}

	// Compile all skip patterns
	for _, pattern := range patterns {
		regex, err := regexp.Compile(pattern)
		if err != nil {
			return nil, err
		}
		matcher.regexes = append(matcher.regexes, regex)
	}

	return matcher, nil
}

// ShouldSkip determines if a path should be skipped based on patterns
func (spm *SkipPatternMatcher) ShouldSkip(path string, info os.FileInfo) bool {
	name := info.Name()

	// Check hidden files
	if spm.skipHidden && strings.HasPrefix(name, ".") {
		return true
	}

	// Check regex patterns
	for _, regex := range spm.regexes {
		if regex.MatchString(path) || regex.MatchString(name) {
			return true
		}
	}

	return false
}

// Patterns returns the compiled regex patterns
func (spm *SkipPatternMatcher) Patterns() []*regexp.Regexp {
	return spm.regexes
}

// SkipHidden returns whether hidden files are being skipped
func (spm *SkipPatternMatcher) SkipHidden() bool {
	return spm.skipHidden
}