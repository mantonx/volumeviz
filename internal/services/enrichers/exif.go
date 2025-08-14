package enrichers

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"
)

// EXIFEnricher extracts metadata from image files using exiftool
type EXIFEnricher struct {
	config       EnricherConfig
	exiftoolPath string
}

// NewEXIFEnricher creates a new EXIF enricher
func NewEXIFEnricher(config EnricherConfig) *EXIFEnricher {
	return &EXIFEnricher{
		config:       config,
		exiftoolPath: "exiftool", // Default, can be made configurable
	}
}

// Name returns the enricher name
func (e *EXIFEnricher) Name() string {
	return "exif"
}

// CanEnrich determines if this enricher can process the given file
func (e *EXIFEnricher) CanEnrich(fileInfo FileInfo) bool {
	if !e.config.EXIFEnabled {
		return false
	}
	
	// Check if it's an image file
	return strings.HasPrefix(fileInfo.MimeType, "image/")
}

// IsAvailable checks if exiftool is available on the system
func (e *EXIFEnricher) IsAvailable() bool {
	if !e.config.EXIFEnabled {
		return false
	}
	
	_, err := exec.LookPath(e.exiftoolPath)
	return err == nil
}

// GetCapabilities returns what this enricher can extract
func (e *EXIFEnricher) GetCapabilities() EnricherCapabilities {
	return EnricherCapabilities{
		Name: "exif",
		SupportedMimes: []string{
			"image/jpeg", "image/jpg", "image/tiff", "image/tif",
			"image/png", "image/bmp", "image/webp", "image/heic",
			"image/heif", "image/cr2", "image/nef", "image/arw",
		},
		ExtractedFields: []string{
			"width", "height", "capture_datetime", "camera_make", 
			"camera_model", "lens_model", "orientation", 
			"gps_latitude", "gps_longitude",
		},
		RequiredTools: []string{"exiftool"},
		Performance: "fast",
		Accuracy: "high",
		Features: []string{"gps_data", "camera_info", "datetime_extraction", "orientation"},
	}
}

// Enrich extracts metadata using exiftool
func (e *EXIFEnricher) Enrich(ctx context.Context, fileInfo FileInfo) (*MediaMetadata, error) {
	// Create context with timeout
	timeoutCtx, cancel := context.WithTimeout(ctx, e.config.TimeoutPerFile)
	defer cancel()
	
	// Run exiftool to get JSON metadata
	exifData, err := e.runExiftool(timeoutCtx, fileInfo.Path)
	if err != nil {
		return nil, fmt.Errorf("exiftool failed: %w", err)
	}
	
	// Parse and convert to our metadata format
	metadata, err := e.parseEXIFOutput(exifData, fileInfo)
	if err != nil {
		return nil, fmt.Errorf("failed to parse EXIF output: %w", err)
	}
	
	return metadata, nil
}

// EXIFOutput represents the structure of exiftool JSON output
type EXIFOutput struct {
	ImageWidth      int     `json:"ImageWidth,omitempty"`
	ImageHeight     int     `json:"ImageHeight,omitempty"`
	ExifImageWidth  int     `json:"ExifImageWidth,omitempty"`
	ExifImageHeight int     `json:"ExifImageHeight,omitempty"`
	
	// Date/time fields
	DateTimeOriginal string `json:"DateTimeOriginal,omitempty"`
	CreateDate       string `json:"CreateDate,omitempty"`
	ModifyDate       string `json:"ModifyDate,omitempty"`
	
	// Camera information
	Make     string `json:"Make,omitempty"`
	Model    string `json:"Model,omitempty"`
	LensModel string `json:"LensModel,omitempty"`
	LensInfo  string `json:"LensInfo,omitempty"`
	
	// Orientation
	Orientation int `json:"Orientation,omitempty"`
	
	// GPS data
	GPSLatitude      string `json:"GPSLatitude,omitempty"`
	GPSLongitude     string `json:"GPSLongitude,omitempty"`
	GPSLatitudeRef   string `json:"GPSLatitudeRef,omitempty"`
	GPSLongitudeRef  string `json:"GPSLongitudeRef,omitempty"`
	GPSAltitude      string `json:"GPSAltitude,omitempty"`
	GPSDateTime      string `json:"GPSDateTime,omitempty"`
	
	// Additional metadata for raw storage
	ExposureTime     string `json:"ExposureTime,omitempty"`
	FNumber          string `json:"FNumber,omitempty"`
	ISO              int    `json:"ISO,omitempty"`
	FocalLength      string `json:"FocalLength,omitempty"`
	Flash            string `json:"Flash,omitempty"`
	WhiteBalance     string `json:"WhiteBalance,omitempty"`
	ColorSpace       string `json:"ColorSpace,omitempty"`
}

// runExiftool executes exiftool and returns the JSON output
func (e *EXIFEnricher) runExiftool(ctx context.Context, filePath string) (*EXIFOutput, error) {
	// Construct exiftool command
	args := []string{
		"-json",
		"-coordFormat", "%.8f", // High precision for GPS coordinates
		"-dateFormat", "%Y:%m:%d %H:%M:%S",
		"-ignoreMinorErrors",
		filePath,
	}
	
	cmd := exec.CommandContext(ctx, e.exiftoolPath, args...)
	
	output, err := cmd.Output()
	if err != nil {
		if ctx.Err() == context.DeadlineExceeded {
			return nil, fmt.Errorf("exiftool timeout for file %s", filepath.Base(filePath))
		}
		return nil, fmt.Errorf("exiftool execution failed: %w", err)
	}
	
	// exiftool returns an array, we want the first element
	var exifArray []EXIFOutput
	if err := json.Unmarshal(output, &exifArray); err != nil {
		return nil, fmt.Errorf("failed to parse exiftool JSON: %w", err)
	}
	
	if len(exifArray) == 0 {
		return nil, fmt.Errorf("no EXIF data found")
	}
	
	return &exifArray[0], nil
}

// parseEXIFOutput converts exiftool output to our MediaMetadata format
func (e *EXIFEnricher) parseEXIFOutput(exifData *EXIFOutput, fileInfo FileInfo) (*MediaMetadata, error) {
	metadata := &MediaMetadata{
		Kind:        EnrichmentKindImage,
		RawMetadata: make(map[string]any),
	}
	
	// Image dimensions - prefer EXIF dimensions over image dimensions
	width := exifData.ExifImageWidth
	if width == 0 {
		width = exifData.ImageWidth
	}
	if width > 0 {
		w := int32(width)
		metadata.Width = &w
	}
	
	height := exifData.ExifImageHeight
	if height == 0 {
		height = exifData.ImageHeight
	}
	if height > 0 {
		h := int32(height)
		metadata.Height = &h
	}
	
	// Date/time - prefer DateTimeOriginal, then CreateDate, then ModifyDate
	dateTime := e.parseDateTime(exifData.DateTimeOriginal)
	if dateTime == nil {
		dateTime = e.parseDateTime(exifData.CreateDate)
	}
	if dateTime == nil {
		dateTime = e.parseDateTime(exifData.ModifyDate)
	}
	if dateTime != nil {
		metadata.CaptureDateTime = dateTime
	}
	
	// Camera information
	if exifData.Make != "" {
		make := strings.TrimSpace(exifData.Make)
		metadata.CameraMake = &make
	}
	if exifData.Model != "" {
		model := strings.TrimSpace(exifData.Model)
		metadata.CameraModel = &model
	}
	
	// Lens information
	lensModel := exifData.LensModel
	if lensModel == "" && exifData.LensInfo != "" {
		lensModel = exifData.LensInfo
	}
	if lensModel != "" {
		lens := strings.TrimSpace(lensModel)
		metadata.LensModel = &lens
	}
	
	// Orientation
	if exifData.Orientation > 0 {
		orientation := int32(exifData.Orientation)
		metadata.Orientation = &orientation
	}
	
	// GPS data (with privacy options)
	if e.config.EnableGPS && exifData.GPSLatitude != "" && exifData.GPSLongitude != "" {
		lat, lon, err := e.parseGPSCoordinates(exifData)
		if err == nil {
			// Apply GPS redaction/rounding if configured
			if e.config.RedactGPS {
				lat = e.roundGPSCoordinate(lat, e.config.GPSPrecision)
				lon = e.roundGPSCoordinate(lon, e.config.GPSPrecision)
			}
			metadata.GPSLatitude = &lat
			metadata.GPSLongitude = &lon
		}
	}
	
	// Store raw EXIF data for advanced queries
	metadata.RawMetadata["exif"] = exifData
	
	return metadata, nil
}

// parseDateTime parses various datetime formats from EXIF data
func (e *EXIFEnricher) parseDateTime(dateStr string) *time.Time {
	if dateStr == "" {
		return nil
	}
	
	// Common EXIF datetime formats
	formats := []string{
		"2006:01:02 15:04:05",
		"2006-01-02 15:04:05",
		"2006:01:02 15:04:05-07:00",
		"2006-01-02T15:04:05Z",
		"2006-01-02T15:04:05-07:00",
	}
	
	for _, format := range formats {
		if t, err := time.Parse(format, dateStr); err == nil {
			return &t
		}
	}
	
	return nil
}

// parseGPSCoordinates parses GPS coordinates from EXIF data
func (e *EXIFEnricher) parseGPSCoordinates(exifData *EXIFOutput) (lat, lon float64, err error) {
	// Parse latitude
	lat, err = e.parseGPSCoordinate(exifData.GPSLatitude, exifData.GPSLatitudeRef)
	if err != nil {
		return 0, 0, fmt.Errorf("failed to parse latitude: %w", err)
	}
	
	// Parse longitude
	lon, err = e.parseGPSCoordinate(exifData.GPSLongitude, exifData.GPSLongitudeRef)
	if err != nil {
		return 0, 0, fmt.Errorf("failed to parse longitude: %w", err)
	}
	
	return lat, lon, nil
}

// parseGPSCoordinate parses a single GPS coordinate with reference
func (e *EXIFEnricher) parseGPSCoordinate(coordStr, refStr string) (float64, error) {
	if coordStr == "" {
		return 0, fmt.Errorf("empty coordinate string")
	}
	
	// Try parsing as decimal degrees first
	if coord, err := strconv.ParseFloat(coordStr, 64); err == nil {
		// Apply hemisphere reference
		if refStr == "S" || refStr == "W" {
			coord = -coord
		}
		return coord, nil
	}
	
	// Try parsing as degrees/minutes/seconds format
	// Formats like "40 deg 44' 54.36\" N" or "40°44'54.36\"N"
	coord, err := e.parseDMSCoordinate(coordStr)
	if err != nil {
		return 0, err
	}
	
	// Apply hemisphere reference
	if refStr == "S" || refStr == "W" {
		coord = -coord
	}
	
	return coord, nil
}

// parseDMSCoordinate parses degrees/minutes/seconds format
func (e *EXIFEnricher) parseDMSCoordinate(dmsStr string) (float64, error) {
	// Regex to match various DMS formats
	// Examples: "40 deg 44' 54.36\" N", "40°44'54.36\"N", "40d44m54.36s"
	re := regexp.MustCompile(`(\d+(?:\.\d+)?)[°d\s]?\s*(\d+(?:\.\d+)?)['\s]?\s*(\d+(?:\.\d+)?)["\s]?`)
	matches := re.FindStringSubmatch(dmsStr)
	
	if len(matches) < 4 {
		return 0, fmt.Errorf("invalid DMS format: %s", dmsStr)
	}
	
	degrees, err := strconv.ParseFloat(matches[1], 64)
	if err != nil {
		return 0, fmt.Errorf("invalid degrees: %s", matches[1])
	}
	
	minutes, err := strconv.ParseFloat(matches[2], 64)
	if err != nil {
		return 0, fmt.Errorf("invalid minutes: %s", matches[2])
	}
	
	seconds, err := strconv.ParseFloat(matches[3], 64)
	if err != nil {
		return 0, fmt.Errorf("invalid seconds: %s", matches[3])
	}
	
	// Convert to decimal degrees
	decimal := degrees + (minutes / 60.0) + (seconds / 3600.0)
	return decimal, nil
}

// roundGPSCoordinate rounds GPS coordinates to specified decimal places for privacy
func (e *EXIFEnricher) roundGPSCoordinate(coord float64, precision int) float64 {
	multiplier := math.Pow(10, float64(precision))
	return math.Round(coord*multiplier) / multiplier
}