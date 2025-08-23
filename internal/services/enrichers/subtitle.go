package enrichers

import (
	"bufio"
	"context"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"
)

// SubtitleEnricher extracts metadata from subtitle files
type SubtitleEnricher struct {
	config EnricherConfig
}

// NewSubtitleEnricher creates a new subtitle enricher
func NewSubtitleEnricher(config EnricherConfig) *SubtitleEnricher {
	return &SubtitleEnricher{
		config: config,
	}
}

// Name returns the enricher name
func (s *SubtitleEnricher) Name() string {
	return "subtitle"
}

// CanEnrich determines if this enricher can process the given file
func (s *SubtitleEnricher) CanEnrich(fileInfo FileInfo) bool {
	if !s.config.SubtitleEnabled {
		return false
	}

	// Check file extension and mime type
	ext := strings.ToLower(filepath.Ext(fileInfo.Path))
	return ext == ".srt" || ext == ".vtt" || ext == ".ass" || ext == ".ssa" ||
		fileInfo.MimeType == "text/vtt" ||
		fileInfo.MimeType == "application/x-subrip" ||
		fileInfo.MimeType == "text/x-ssa" ||
		fileInfo.MimeType == "text/x-ass"
}

// IsAvailable checks if the enricher is available (no external dependencies)
func (s *SubtitleEnricher) IsAvailable() bool {
	return s.config.SubtitleEnabled
}

// GetCapabilities returns what this enricher can extract
func (s *SubtitleEnricher) GetCapabilities() EnricherCapabilities {
	return EnricherCapabilities{
		Name: "subtitle",
		SupportedMimes: []string{
			"text/vtt", "application/x-subrip", "text/x-ssa", "text/x-ass",
		},
		ExtractedFields: []string{
			"language", "format", "cue_count", "coverage_percent",
		},
		RequiredTools: []string{}, // No external tools required
		Performance:   "fast",
		Accuracy:      "high",
		Features:      []string{"language_detection", "format_detection", "timing_analysis", "coverage_calculation"},
	}
}

// Enrich extracts metadata from subtitle files
func (s *SubtitleEnricher) Enrich(ctx context.Context, fileInfo FileInfo) (*MediaMetadata, error) {
	// Create context with timeout
	timeoutCtx, cancel := context.WithTimeout(ctx, s.config.TimeoutPerFile)
	defer cancel()

	// Parse the subtitle file
	subtitleData, err := s.parseSubtitleFile(timeoutCtx, fileInfo.Path)
	if err != nil {
		return nil, fmt.Errorf("failed to parse subtitle file: %w", err)
	}

	// Convert to metadata format
	metadata := s.convertToMetadata(subtitleData, fileInfo)

	return metadata, nil
}

// SubtitleData represents parsed subtitle information
type SubtitleData struct {
	Format          string        `json:"format"`
	Language        string        `json:"language"`
	Cues            []SubtitleCue `json:"cues"`
	TotalDuration   time.Duration `json:"total_duration"`
	CoveragePercent float64       `json:"coverage_percent"`
	Encoding        string        `json:"encoding"`
}

// SubtitleCue represents a single subtitle entry
type SubtitleCue struct {
	Index     int           `json:"index"`
	StartTime time.Duration `json:"start_time"`
	EndTime   time.Duration `json:"end_time"`
	Text      string        `json:"text"`
	Duration  time.Duration `json:"duration"`
}

// parseSubtitleFile parses various subtitle formats
func (s *SubtitleEnricher) parseSubtitleFile(ctx context.Context, filePath string) (*SubtitleData, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to open subtitle file: %w", err)
	}
	defer file.Close()

	// Detect format from extension and content
	ext := strings.ToLower(filepath.Ext(filePath))

	var subtitleData *SubtitleData

	switch ext {
	case ".srt":
		subtitleData, err = s.parseSRT(file)
	case ".vtt":
		subtitleData, err = s.parseVTT(file)
	case ".ass", ".ssa":
		subtitleData, err = s.parseASS(file)
	default:
		// Try to detect format from content
		subtitleData, err = s.parseAutoDetect(file)
	}

	if err != nil {
		return nil, err
	}

	// Post-process the data
	s.calculateCoverage(subtitleData)
	s.detectLanguage(subtitleData, filePath)

	return subtitleData, nil
}

// parseSRT parses SubRip (.srt) format
func (s *SubtitleEnricher) parseSRT(file *os.File) (*SubtitleData, error) {
	data := &SubtitleData{
		Format: "srt",
		Cues:   make([]SubtitleCue, 0),
	}

	scanner := bufio.NewScanner(file)
	var currentCue *SubtitleCue
	var textLines []string

	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())

		if line == "" {
			// End of current cue
			if currentCue != nil {
				currentCue.Text = strings.Join(textLines, "\n")
				currentCue.Duration = currentCue.EndTime - currentCue.StartTime
				data.Cues = append(data.Cues, *currentCue)
				currentCue = nil
				textLines = nil
			}
			continue
		}

		// Check if it's an index line (just numbers)
		if index, err := strconv.Atoi(line); err == nil {
			currentCue = &SubtitleCue{Index: index}
			continue
		}

		// Check if it's a timestamp line
		if strings.Contains(line, "-->") && currentCue != nil {
			start, end, err := s.parseSRTTimestamp(line)
			if err != nil {
				continue // Skip malformed timestamps
			}
			currentCue.StartTime = start
			currentCue.EndTime = end
			continue
		}

		// Otherwise, it's subtitle text
		if currentCue != nil {
			textLines = append(textLines, line)
		}
	}

	// Handle last cue if file doesn't end with empty line
	if currentCue != nil {
		currentCue.Text = strings.Join(textLines, "\n")
		currentCue.Duration = currentCue.EndTime - currentCue.StartTime
		data.Cues = append(data.Cues, *currentCue)
	}

	return data, scanner.Err()
}

// parseVTT parses WebVTT (.vtt) format
func (s *SubtitleEnricher) parseVTT(file *os.File) (*SubtitleData, error) {
	data := &SubtitleData{
		Format: "vtt",
		Cues:   make([]SubtitleCue, 0),
	}

	scanner := bufio.NewScanner(file)
	var currentCue *SubtitleCue
	var textLines []string
	index := 1

	// Skip WEBVTT header
	if scanner.Scan() {
		firstLine := strings.TrimSpace(scanner.Text())
		if !strings.HasPrefix(firstLine, "WEBVTT") {
			file.Seek(0, 0) // Reset if not WEBVTT
			scanner = bufio.NewScanner(file)
		}
	}

	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())

		if line == "" {
			// End of current cue
			if currentCue != nil {
				currentCue.Text = strings.Join(textLines, "\n")
				currentCue.Duration = currentCue.EndTime - currentCue.StartTime
				data.Cues = append(data.Cues, *currentCue)
				currentCue = nil
				textLines = nil
				index++
			}
			continue
		}

		// Check if it's a timestamp line
		if strings.Contains(line, "-->") {
			start, end, err := s.parseVTTTimestamp(line)
			if err != nil {
				continue // Skip malformed timestamps
			}
			currentCue = &SubtitleCue{
				Index:     index,
				StartTime: start,
				EndTime:   end,
			}
			continue
		}

		// Otherwise, it's subtitle text (skip cue identifiers)
		if currentCue != nil && !strings.Contains(line, "-->") {
			textLines = append(textLines, line)
		}
	}

	// Handle last cue
	if currentCue != nil {
		currentCue.Text = strings.Join(textLines, "\n")
		currentCue.Duration = currentCue.EndTime - currentCue.StartTime
		data.Cues = append(data.Cues, *currentCue)
	}

	return data, scanner.Err()
}

// parseASS parses Advanced SubStation Alpha (.ass/.ssa) format
func (s *SubtitleEnricher) parseASS(file *os.File) (*SubtitleData, error) {
	data := &SubtitleData{
		Format: "ass",
		Cues:   make([]SubtitleCue, 0),
	}

	scanner := bufio.NewScanner(file)
	inEventsSection := false
	index := 1

	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())

		if line == "" || strings.HasPrefix(line, "!") {
			continue
		}

		if strings.HasPrefix(line, "[Events]") {
			inEventsSection = true
			continue
		}

		if strings.HasPrefix(line, "[") && line != "[Events]" {
			inEventsSection = false
			continue
		}

		if inEventsSection && strings.HasPrefix(line, "Dialogue:") {
			cue, err := s.parseASSDialogue(line, index)
			if err == nil {
				data.Cues = append(data.Cues, *cue)
				index++
			}
		}
	}

	return data, scanner.Err()
}

// parseAutoDetect attempts to detect and parse subtitle format
func (s *SubtitleEnricher) parseAutoDetect(file *os.File) (*SubtitleData, error) {
	// Read first few lines to detect format
	scanner := bufio.NewScanner(file)
	var firstLines []string
	for i := 0; i < 10 && scanner.Scan(); i++ {
		firstLines = append(firstLines, scanner.Text())
	}

	// Reset file pointer
	file.Seek(0, 0)

	// Detect format based on content
	content := strings.Join(firstLines, "\n")

	if strings.Contains(content, "WEBVTT") {
		return s.parseVTT(file)
	}

	if strings.Contains(content, "[Script Info]") || strings.Contains(content, "[Events]") {
		return s.parseASS(file)
	}

	if regexp.MustCompile(`\d+\s*\n\d{2}:\d{2}:\d{2},\d{3}\s*-->\s*\d{2}:\d{2}:\d{2},\d{3}`).MatchString(content) {
		return s.parseSRT(file)
	}

	return nil, fmt.Errorf("unknown subtitle format")
}

// parseSRTTimestamp parses SRT timestamp format "00:00:20,000 --> 00:00:24,400"
func (s *SubtitleEnricher) parseSRTTimestamp(line string) (start, end time.Duration, err error) {
	parts := strings.Split(line, "-->")
	if len(parts) != 2 {
		return 0, 0, fmt.Errorf("invalid timestamp format")
	}

	start, err = s.parseSRTTime(strings.TrimSpace(parts[0]))
	if err != nil {
		return 0, 0, err
	}

	end, err = s.parseSRTTime(strings.TrimSpace(parts[1]))
	if err != nil {
		return 0, 0, err
	}

	return start, end, nil
}

// parseSRTTime parses individual SRT time "00:00:20,000"
func (s *SubtitleEnricher) parseSRTTime(timeStr string) (time.Duration, error) {
	re := regexp.MustCompile(`(\d{2}):(\d{2}):(\d{2}),(\d{3})`)
	matches := re.FindStringSubmatch(timeStr)
	if len(matches) != 5 {
		return 0, fmt.Errorf("invalid time format: %s", timeStr)
	}

	hours, _ := strconv.Atoi(matches[1])
	minutes, _ := strconv.Atoi(matches[2])
	seconds, _ := strconv.Atoi(matches[3])
	milliseconds, _ := strconv.Atoi(matches[4])

	duration := time.Duration(hours)*time.Hour +
		time.Duration(minutes)*time.Minute +
		time.Duration(seconds)*time.Second +
		time.Duration(milliseconds)*time.Millisecond

	return duration, nil
}

// parseVTTTimestamp parses VTT timestamp format "00:00:20.000 --> 00:00:24.400"
func (s *SubtitleEnricher) parseVTTTimestamp(line string) (start, end time.Duration, err error) {
	parts := strings.Split(line, "-->")
	if len(parts) != 2 {
		return 0, 0, fmt.Errorf("invalid timestamp format")
	}

	start, err = s.parseVTTTime(strings.TrimSpace(parts[0]))
	if err != nil {
		return 0, 0, err
	}

	end, err = s.parseVTTTime(strings.TrimSpace(parts[1]))
	if err != nil {
		return 0, 0, err
	}

	return start, end, nil
}

// parseVTTTime parses individual VTT time "00:00:20.000"
func (s *SubtitleEnricher) parseVTTTime(timeStr string) (time.Duration, error) {
	// Remove any settings (e.g., "00:00:20.000 align:start")
	timeStr = strings.Fields(timeStr)[0]

	re := regexp.MustCompile(`(?:(\d{2}):)?(\d{2}):(\d{2})\.(\d{3})`)
	matches := re.FindStringSubmatch(timeStr)
	if len(matches) < 4 {
		return 0, fmt.Errorf("invalid time format: %s", timeStr)
	}

	var hours, minutes, seconds, milliseconds int

	if matches[1] != "" {
		hours, _ = strconv.Atoi(matches[1])
		minutes, _ = strconv.Atoi(matches[2])
		seconds, _ = strconv.Atoi(matches[3])
		milliseconds, _ = strconv.Atoi(matches[4])
	} else {
		minutes, _ = strconv.Atoi(matches[2])
		seconds, _ = strconv.Atoi(matches[3])
		milliseconds, _ = strconv.Atoi(matches[4])
	}

	duration := time.Duration(hours)*time.Hour +
		time.Duration(minutes)*time.Minute +
		time.Duration(seconds)*time.Second +
		time.Duration(milliseconds)*time.Millisecond

	return duration, nil
}

// parseASSDialogue parses ASS dialogue line
func (s *SubtitleEnricher) parseASSDialogue(line string, index int) (*SubtitleCue, error) {
	// Format: Dialogue: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text
	line = strings.TrimPrefix(line, "Dialogue: ")
	parts := strings.SplitN(line, ",", 10)
	if len(parts) < 10 {
		return nil, fmt.Errorf("invalid dialogue format")
	}

	start, err := s.parseASSTime(parts[1])
	if err != nil {
		return nil, err
	}

	end, err := s.parseASSTime(parts[2])
	if err != nil {
		return nil, err
	}

	// Clean up text (remove ASS formatting)
	text := s.cleanASSText(parts[9])

	return &SubtitleCue{
		Index:     index,
		StartTime: start,
		EndTime:   end,
		Text:      text,
		Duration:  end - start,
	}, nil
}

// parseASSTime parses ASS time format "0:00:20.00"
func (s *SubtitleEnricher) parseASSTime(timeStr string) (time.Duration, error) {
	re := regexp.MustCompile(`(\d+):(\d{2}):(\d{2})\.(\d{2})`)
	matches := re.FindStringSubmatch(timeStr)
	if len(matches) != 5 {
		return 0, fmt.Errorf("invalid time format: %s", timeStr)
	}

	hours, _ := strconv.Atoi(matches[1])
	minutes, _ := strconv.Atoi(matches[2])
	seconds, _ := strconv.Atoi(matches[3])
	centiseconds, _ := strconv.Atoi(matches[4])

	duration := time.Duration(hours)*time.Hour +
		time.Duration(minutes)*time.Minute +
		time.Duration(seconds)*time.Second +
		time.Duration(centiseconds)*10*time.Millisecond

	return duration, nil
}

// cleanASSText removes ASS formatting tags
func (s *SubtitleEnricher) cleanASSText(text string) string {
	// Remove ASS tags like {\i1}, {\b1}, etc.
	re := regexp.MustCompile(`\{[^}]*\}`)
	text = re.ReplaceAllString(text, "")

	// Replace \N with newline
	text = strings.ReplaceAll(text, "\\N", "\n")

	return strings.TrimSpace(text)
}

// calculateCoverage calculates what percentage of time has subtitles
func (s *SubtitleEnricher) calculateCoverage(data *SubtitleData) {
	if len(data.Cues) == 0 {
		data.CoveragePercent = 0
		return
	}

	// Find total duration from first to last subtitle
	var totalCoveredTime time.Duration
	var maxEndTime time.Duration

	for _, cue := range data.Cues {
		totalCoveredTime += cue.Duration
		if cue.EndTime > maxEndTime {
			maxEndTime = cue.EndTime
		}
	}

	data.TotalDuration = maxEndTime

	if maxEndTime > 0 {
		data.CoveragePercent = float64(totalCoveredTime) / float64(maxEndTime) * 100
		if data.CoveragePercent > 100 {
			data.CoveragePercent = 100 // Cap at 100% for overlapping subtitles
		}
	}
}

// detectLanguage attempts to detect language from filename or content
func (s *SubtitleEnricher) detectLanguage(data *SubtitleData, filePath string) {
	// Try to extract language from filename
	fileName := filepath.Base(filePath)

	// Common language patterns in filenames
	languagePatterns := map[string]string{
		"en":  "English",
		"eng": "English",
		"es":  "Spanish",
		"spa": "Spanish",
		"fr":  "French",
		"fre": "French",
		"de":  "German",
		"ger": "German",
		"it":  "Italian",
		"ita": "Italian",
		"pt":  "Portuguese",
		"por": "Portuguese",
		"ru":  "Russian",
		"rus": "Russian",
		"zh":  "Chinese",
		"chi": "Chinese",
		"ja":  "Japanese",
		"jpn": "Japanese",
		"ko":  "Korean",
		"kor": "Korean",
	}

	lowerFileName := strings.ToLower(fileName)
	for code, language := range languagePatterns {
		if strings.Contains(lowerFileName, "."+code+".") ||
			strings.Contains(lowerFileName, "_"+code+"_") ||
			strings.Contains(lowerFileName, "-"+code+"-") ||
			strings.HasSuffix(lowerFileName, "."+code+".srt") ||
			strings.HasSuffix(lowerFileName, "."+code+".vtt") {
			data.Language = language
			return
		}
	}

	// Default to unknown
	data.Language = "unknown"
}

// convertToMetadata converts SubtitleData to MediaMetadata
func (s *SubtitleEnricher) convertToMetadata(data *SubtitleData, fileInfo FileInfo) *MediaMetadata {
	metadata := &MediaMetadata{
		Kind:        EnrichmentKindSubtitle,
		RawMetadata: make(map[string]any),
	}

	// Set subtitle-specific fields
	if data.Language != "" {
		metadata.Language = &data.Language
	}

	if data.Format != "" {
		metadata.Format = &data.Format
	}

	cueCount := int32(len(data.Cues))
	metadata.CueCount = &cueCount

	if data.CoveragePercent > 0 {
		metadata.CoveragePercent = &data.CoveragePercent
	}

	// Store raw subtitle data for advanced queries
	metadata.RawMetadata["subtitle_data"] = data

	return metadata
}
