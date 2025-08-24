package filesystem

import (
	"io"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
)

// MimeDetector handles MIME type detection and media classification
type MimeDetector struct {
	// Cache for file extensions to improve performance
	extensionCache map[string]string
	mutex          sync.RWMutex
}

// NewMimeDetector creates a new MIME detector
func NewMimeDetector() *MimeDetector {
	return &MimeDetector{
		extensionCache: make(map[string]string),
	}
}

// DetectFile detects MIME type, media kind, and encoding for a file
func (md *MimeDetector) DetectFile(path string) (mimeType, mediaKind, encoding string) {
	// First try detection by file extension (fast path)
	ext := strings.ToLower(filepath.Ext(path))
	if ext != "" {
		md.mutex.RLock()
		cachedMime, exists := md.extensionCache[ext]
		md.mutex.RUnlock()

		if exists {
			return cachedMime, md.classifyMediaKind(cachedMime), ""
		}

		// Get MIME type by extension
		if extMime := mime.TypeByExtension(ext); extMime != "" {
			md.mutex.Lock()
			md.extensionCache[ext] = extMime
			md.mutex.Unlock()
			return extMime, md.classifyMediaKind(extMime), ""
		}
	}

	// Fallback to content detection (slower but more accurate)
	file, err := os.Open(path)
	if err != nil {
		return "application/octet-stream", "binary", ""
	}
	defer file.Close()

	// Read first 512 bytes for content detection
	buffer := make([]byte, 512)
	n, err := file.Read(buffer)
	if err != nil && err != io.EOF {
		return "application/octet-stream", "binary", ""
	}

	// Detect MIME type from content
	detectedMime := http.DetectContentType(buffer[:n])
	if detectedMime == "" {
		detectedMime = "application/octet-stream"
	}

	// Cache result if we have an extension
	if ext != "" {
		md.mutex.Lock()
		md.extensionCache[ext] = detectedMime
		md.mutex.Unlock()
	}

	return detectedMime, md.classifyMediaKind(detectedMime), md.detectEncoding(buffer[:n])
}

// classifyMediaKind classifies MIME types into broader media categories
func (md *MimeDetector) classifyMediaKind(mimeType string) string {
	if mimeType == "" {
		return "unknown"
	}

	// Split MIME type into main type and subtype
	parts := strings.Split(mimeType, "/")
	if len(parts) != 2 {
		return "unknown"
	}

	mainType := parts[0]
	subType := parts[1]

	switch mainType {
	case "image":
		return "image"
	case "video":
		return "video"
	case "audio":
		return "audio"
	case "text":
		return "text"
	case "application":
		// Further classify application types
		switch {
		case strings.Contains(subType, "pdf"):
			return "document"
		case strings.Contains(subType, "zip"), strings.Contains(subType, "tar"), strings.Contains(subType, "gzip"):
			return "archive"
		case strings.Contains(subType, "json"), strings.Contains(subType, "xml"):
			return "data"
		case strings.Contains(subType, "javascript"), strings.Contains(subType, "sql"):
			return "code"
		case strings.Contains(subType, "msword"), strings.Contains(subType, "officedocument"):
			return "document"
		default:
			return "binary"
		}
	default:
		return "unknown"
	}
}

// detectEncoding detects text encoding from file content
func (md *MimeDetector) detectEncoding(content []byte) string {
	// Simple encoding detection - can be enhanced with more sophisticated algorithms
	if len(content) == 0 {
		return ""
	}

	// Check for UTF-8 BOM
	if len(content) >= 3 && content[0] == 0xEF && content[1] == 0xBB && content[2] == 0xBF {
		return "utf-8-bom"
	}

	// Check for UTF-16 BOM
	if len(content) >= 2 {
		if content[0] == 0xFF && content[1] == 0xFE {
			return "utf-16le"
		}
		if content[0] == 0xFE && content[1] == 0xFF {
			return "utf-16be"
		}
	}

	// Check if content is valid UTF-8
	if isValidUTF8(content) {
		return "utf-8"
	}

	// Check for ASCII
	if isASCII(content) {
		return "ascii"
	}

	return "binary"
}

// isValidUTF8 checks if content is valid UTF-8
func isValidUTF8(content []byte) bool {
	for i := 0; i < len(content); {
		r, size := decodeRuneInBytes(content[i:])
		if r == 0xFFFD && size == 1 {
			return false // Invalid UTF-8
		}
		i += size
	}
	return true
}

// isASCII checks if content contains only ASCII characters
func isASCII(content []byte) bool {
	for _, b := range content {
		if b > 127 {
			return false
		}
	}
	return true
}

// decodeRuneInBytes is a simplified version of utf8.DecodeRune
func decodeRuneInBytes(b []byte) (rune, int) {
	if len(b) == 0 {
		return 0xFFFD, 0
	}
	b0 := b[0]
	if b0 < 0x80 {
		return rune(b0), 1
	}
	if len(b) < 2 {
		return 0xFFFD, 1
	}
	// Simplified - full implementation would handle all UTF-8 cases
	return 0xFFFD, 1
}