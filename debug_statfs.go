package main

import (
	"fmt"
	"syscall"
)

func main() {
	path := "/var/lib/docker/volumes/volumeviz_go_modules/_data"

	var stat syscall.Statfs_t
	err := syscall.Statfs(path, &stat)
	if err != nil {
		fmt.Printf("Error calling Statfs on %s: %v\n", path, err)
		return
	}

	// Calculate sizes in bytes
	blockSize := int64(stat.Bsize)
	totalBytes := int64(stat.Blocks) * blockSize
	availableBytes := int64(stat.Bavail) * blockSize
	usedBytes := totalBytes - availableBytes

	// Calculate usage percentage
	var usagePercent float64
	if totalBytes > 0 {
		usagePercent = float64(usedBytes) / float64(totalBytes) * 100
	}

	fmt.Printf("✅ Filesystem capacity for %s:\n", path)
	fmt.Printf("  Total: %d bytes (%.1f GB)\n", totalBytes, float64(totalBytes)/(1024*1024*1024))
	fmt.Printf("  Used: %d bytes (%.1f GB)\n", usedBytes, float64(usedBytes)/(1024*1024*1024))
	fmt.Printf("  Available: %d bytes (%.1f GB)\n", availableBytes, float64(availableBytes)/(1024*1024*1024))
	fmt.Printf("  Usage: %.1f%%\n", usagePercent)
	fmt.Printf("  Block size: %d\n", blockSize)
}
