package middleware

import (
	"compress/gzip"
	"io"
	"strings"

	"github.com/gin-gonic/gin"
)

const (
	BestCompression    = gzip.BestCompression
	BestSpeed          = gzip.BestSpeed
	DefaultCompression = gzip.DefaultCompression
	NoCompression      = gzip.NoCompression
)

func Gzip(level int) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Skip compression for already compressed content
		if strings.Contains(c.GetHeader("Content-Encoding"), "gzip") {
			c.Next()
			return
		}

		// Check if client accepts gzip
		if !strings.Contains(c.GetHeader("Accept-Encoding"), "gzip") {
			c.Next()
			return
		}

		// Skip compression for small responses
		if c.Writer.Size() > 0 && c.Writer.Size() < 1024 {
			c.Next()
			return
		}

		// Skip compression for certain content types that don't benefit
		contentType := c.Writer.Header().Get("Content-Type")
		if shouldSkipCompression(contentType) {
			c.Next()
			return
		}

		// Set gzip headers
		c.Writer.Header().Set("Content-Encoding", "gzip")
		c.Writer.Header().Set("Vary", "Accept-Encoding")

		// Create gzip writer
		gz, err := gzip.NewWriterLevel(c.Writer, level)
		if err != nil {
			c.Next()
			return
		}

		// Replace writer with gzip writer
		c.Writer = &gzipWriter{c.Writer, gz}

		defer func() {
			gz.Close()
		}()

		c.Next()
	}
}

type gzipWriter struct {
	gin.ResponseWriter
	writer io.Writer
}

func (g *gzipWriter) WriteString(s string) (int, error) {
	return g.writer.Write([]byte(s))
}

func (g *gzipWriter) Write(data []byte) (int, error) {
	return g.writer.Write(data)
}

func (g *gzipWriter) WriteHeader(code int) {
	g.ResponseWriter.WriteHeader(code)
}

// shouldSkipCompression returns true for content types that don't benefit from compression
func shouldSkipCompression(contentType string) bool {
	skipTypes := []string{
		"image/",
		"video/",
		"audio/",
		"application/zip",
		"application/gzip",
		"application/x-gzip",
		"application/x-7z-compressed",
		"application/x-rar-compressed",
		"application/pdf", // Already compressed
	}

	contentType = strings.ToLower(contentType)
	for _, skipType := range skipTypes {
		if strings.HasPrefix(contentType, skipType) {
			return true
		}
	}
	return false
}

// GzipBestCompression returns a Gzip middleware with best compression
func GzipBestCompression() gin.HandlerFunc {
	return Gzip(BestCompression)
}

// GzipBestSpeed returns a Gzip middleware with best speed
func GzipBestSpeed() gin.HandlerFunc {
	return Gzip(BestSpeed)
}

// GzipDefault returns a Gzip middleware with default compression
func GzipDefault() gin.HandlerFunc {
	return Gzip(DefaultCompression)
}
