# VolumeViz Scan Progress Enhancement Plan

## Executive Summary

Transform VolumeViz's current black-box scanning process into a fully transparent, real-time operation with second-by-second progress updates across all three scan phases:

1. **Volume Scan** (du/diskus/native methods) - Currently black box → Progressive with real-time directory updates
2. **Filesystem Indexing** - Currently hangs on bulk operations → Incremental with sub-phase transparency  
3. **Media Enrichment** - Currently generic batches → Streaming with per-file progress

**End Goal**: Users see exactly what's happening at all times with accurate time estimates and confidence indicators.

## Current Problems Summary

### Volume Scan Phase
- **Black box operation**: `du` command runs with no progress indication for 30+ seconds
- **No cancellation**: Users can't interrupt long-running scans
- **Unpredictable duration**: Can take seconds or minutes with no indication

### Filesystem Indexing Phase  
- **Bulk deletion hangs**: Deleting 28,308 files causes process to freeze at 0%
- **No sub-phase visibility**: Users don't know if it's counting, reconciling, or walking
- **Inefficient operations**: Full rebuild instead of incremental updates

### Media Enrichment Phase
- **Sequential processing**: Waits for complete filesystem indexing before starting
- **Generic progress**: "Processing batch 1/20" with no file-level details
- **No error transparency**: Failures happen silently with no user feedback

## Implementation Phases Overview

**Phase 1**: Filesystem Indexing - Replace bulk operations with incremental scanning
**Phase 2**: Media Enrichment - Implement streaming processing with file-level transparency  
**Phase 3**: UI/UX - Create comprehensive progress displays
**Phase 4**: Implementation Infrastructure - Refactor progress tracking systems
**Phase 5**: Advanced Time Estimation - Multi-factor time calculation with confidence indicators
**Phase 6**: Volume Scan Basic Enhancement - Add progressive directory scanning
**Phase 7**: Volume Scan Method Integration - Implement progressive du/diskus while preserving performance

## Detailed Implementation Plan

### Phase 1: Filesystem Indexing Enhancement

#### Sub-Phase Breakdown:
```
Filesystem Indexing: 67%
├── Phase: Preparation (0-10%)
│   ├── "Counting files and directories..." 
│   └── "Preparing database connections..."
├── Phase: Database Reconciliation (10-50%) 
│   ├── "Checking existing files (2,451/28,308)..."
│   ├── "Removing deleted files (127 removed)..."
│   └── "Cleaning up empty directories..."
└── Phase: Filesystem Walking (50-100%)
    ├── "Scanning new files (1,203/3,452)..."
    ├── "Processing directories (456/892)..."
    └── "Finalizing index..."

Currently: /movies/action/thriller/movie.mkv
Stats: +1,156 added, ~47 updated, -127 removed, !3 errors
```

#### Implementation Details:

**1. Preparation Phase (0-10%)**
- File/folder counting with progress: "Counting files... (estimated 5,000 so far)"
- Database connection preparation
- Skip pattern compilation

**2. Database Reconciliation (10-50%)**
- Instead of bulk deletion, implement incremental checking:
  ```
  for each existing file in database:
    if file no longer exists on filesystem:
      mark for deletion
    else if file modified time changed:
      mark for update
  ```
- Show progress: "Checking existing files (2,451/28,308)"
- Show actions: "Marking 127 files for removal..."
- Batch deletions with progress updates

**3. Filesystem Walking (50-100%)**
- Real-time file processing with current path display
- Progress based on actual file counts
- Show files added/updated/skipped
- Error tracking with details

#### WebSocket Message Structure:
```json
{
  "scan_id": "b0238a6a-6486-475b-b36b-beb28cd41630",
  "phase": "filesystem_indexing",
  "sub_phase": "database_reconciliation",
  "progress": 32,
  "current_operation": "Checking existing files",
  "current_item": "/movies/action/die_hard.mkv",
  "items_processed": 2451,
  "items_total": 28308,
  "stats": {
    "files_added": 0,
    "files_updated": 47,
    "files_removed": 127,
    "errors": 3
  },
  "sub_phase_progress": {
    "preparation": 100,
    "database_reconciliation": 60, 
    "filesystem_walking": 0
  }
}
```

### Phase 2: Media Enrichment Enhancement

#### Current Issues:
- Waits for entire filesystem indexing to complete
- Generic "Processing batch 1/20" messages
- No visibility into what types of files are being processed
- No indication of enrichment success/failure rates

#### Enhanced Approach:

**1. Streaming Enrichment**
- Start enriching files as soon as they're indexed (don't wait for complete filesystem scan)
- Process files in priority order (videos > images > audio > subtitles)

**2. Granular Progress Tracking**
```
Media Enrichment: 43%
├── Queue: 2,847 files pending enrichment
├── Processing: video_metadata_extractor 
├── Current: /movies/action/terminator.mkv (342MB)
├── Completed: 1,203/2,847 files
└── Stats:
    ├── Videos: 456 processed, 23 failed
    ├── Images: 721 processed, 8 failed  
    ├── Audio: 26 processed, 1 failed
    └── Errors: 32 total (view details)

Currently extracting: Video codec, resolution, duration
```

#### Sub-Phase Breakdown:

**1. Queue Management (5%)**
- "Building enrichment queue..."
- "Prioritizing media files..."
- "Videos: 1,200 | Images: 1,500 | Audio: 147"

**2. Batch Processing (10-95%)**
- "Processing video files (456/1,200)..."
- "Extracting metadata from: movie_title.mkv"
- "Current operation: Analyzing video streams"
- Real-time success/failure tracking

**3. Finalization (95-100%)**
- "Updating search indexes..."
- "Calculating volume statistics..."
- "Enrichment complete: 2,815 success, 32 failures"

#### WebSocket Message Structure:
```json
{
  "scan_id": "b0238a6a-6486-475b-b36b-beb28cd41630",
  "phase": "media_enrichment",
  "sub_phase": "batch_processing",
  "progress": 43,
  "current_operation": "Extracting video metadata",
  "current_item": "/movies/action/terminator.mkv",
  "current_file_info": {
    "size": "342MB",
    "type": "video/x-matroska",
    "operations": ["video_codec", "resolution", "duration"]
  },
  "queue_stats": {
    "total": 2847,
    "processed": 1203,
    "remaining": 1644,
    "failed": 32
  },
  "type_stats": {
    "videos": {"processed": 456, "failed": 23, "total": 1200},
    "images": {"processed": 721, "failed": 8, "total": 1500},
    "audio": {"processed": 26, "failed": 1, "total": 147}
  }
}
```

### Phase 3: UI/UX Enhancements

#### Frontend Display:
```
Scan Progress (b0238a6a) - 2m 34s elapsed

Volume Scan ✓ Completed
├── Found 70.2 TB across 14,190 files

Filesystem Indexing 🔄 67% (1m 12s remaining)
├── Database Reconciliation ✓ Complete
│   └── Checked 28,308 files, removed 127 deleted files
├── Filesystem Walking 🔄 45%
│   ├── Current: /movies/action/thriller/
│   ├── Progress: 6,425/14,190 files processed
│   └── Stats: +1,156 new, ~47 updated, 3 errors
└── Performance: 89 files/sec, 124MB/sec

Media Enrichment 🔄 23% (streaming) 
├── Queue: 2,847 files awaiting enrichment
├── Current: terminator2.mkv (extracting video metadata)
├── Progress: 1,203/2,847 files enriched
├── Success Rate: 97.3% (32 failures)
└── Performance: 12 files/sec, processing videos first

Performance Summary:
├── Elapsed: 2m 34s
├── Estimated remaining: 3m 45s  
├── Files/sec: 67 average
└── Errors: 35 total (view details)
```

#### Error Handling Display:
```
❌ 35 Errors Encountered (click to expand)
├── Permission denied: 12 files
├── Corrupt media files: 8 files  
├── Network timeout: 15 files
└── Unknown errors: 2 files
```

### Phase 4: Implementation Strategy

#### Step 1: Refactor Progress Tracking Infrastructure
- [ ] Create comprehensive progress data structures
- [ ] Implement sub-phase progress tracking
- [ ] Enhanced WebSocket message formats
- [ ] Frontend progress display components

#### Step 2: Filesystem Indexing Enhancement  
- [ ] Implement incremental scanning (no bulk deletion)
- [ ] Add database reconciliation progress
- [ ] Stream filesystem walking progress
- [ ] Enhanced error tracking and reporting

#### Step 3: Media Enrichment Enhancement
- [ ] Implement streaming enrichment (process as files are indexed)
- [ ] Priority-based processing (videos first)
- [ ] Granular operation tracking
- [ ] Enhanced batch processing with real-time stats

#### Step 4: UI/UX Implementation
- [ ] Enhanced progress display components
- [ ] Real-time sub-phase visualization  
- [ ] Error reporting and details
- [ ] Performance metrics display

### Benefits

1. **Transparency**: Users see exactly what's happening at all times
2. **Performance**: No more hanging on bulk operations
3. **Efficiency**: Incremental updates instead of full rebuilds
4. **Responsiveness**: Real-time progress updates every second
5. **User Experience**: Clear progress indication with time estimates
6. **Debugging**: Detailed error tracking and reporting
7. **Parallel Processing**: Media enrichment starts immediately as files are indexed

### Technical Implementation Notes

#### Database Changes:
- Add sub-phase tracking to scan_phases table
- Add operation tracking (current_operation, current_item)
- Enhanced error tracking with categories

#### Backend Changes:
- Refactor Walker for incremental scanning
- Implement streaming media enrichment
- Enhanced progress broadcasting with sub-phases
- Better error handling and categorization

#### Frontend Changes:
- Enhanced progress display components
- Real-time sub-phase visualization
- Error reporting interface
- Performance metrics dashboard

## Phase 5: Advanced Time Estimation System

### Current Time Estimation Problems:
- **Inaccurate linear estimates**: Simple "items processed / total items" doesn't account for varying operation complexity
- **No phase weighting**: Database cleanup vs filesystem walking take vastly different amounts of time per item
- **No learning**: System doesn't improve estimates based on historical performance
- **No confidence indicators**: Users don't know if "3m 45s remaining" is reliable or a wild guess
- **Parallel operation confusion**: Can't estimate time when multiple phases run concurrently

### Enhanced Time Estimation Strategy:

#### 1. Multi-Factor Time Calculation

**Phase-Weighted Progress:**
```javascript
// Empirically-derived weights based on typical scan performance
const phaseWeights = {
  filesystem_indexing: {
    preparation: 0.05,           // 5% - File counting, setup
    database_reconciliation: 0.25, // 25% - Checking existing files  
    filesystem_walking: 0.70     // 70% - Processing new/changed files
  },
  media_enrichment: {
    queue_building: 0.05,        // 5% - Building enrichment queue
    video_processing: 0.60,      // 60% - Video analysis (slowest)
    image_processing: 0.25,      // 25% - Image EXIF extraction
    audio_processing: 0.10       // 10% - Audio metadata
  }
}
```

**Rate-Based Estimation:**
```javascript
const operationRates = {
  // Filesystem operations (files/second)
  file_counting: 850,           // Fast filesystem reads
  existing_file_check: 420,     // Database lookups + filesystem stat
  new_file_scanning: 89,        // Full file processing + database insert
  
  // Media enrichment (files/second) 
  video_metadata: 2.3,          // FFprobe analysis
  image_exif: 15.7,            // Fast EXIF extraction
  audio_metadata: 8.2,         // Audio stream analysis
  subtitle_parsing: 45.1       // Text file processing
}
```

#### 2. Adaptive Learning System

**Historical Performance Tracking:**
```json
{
  "volume_performance_history": {
    "volumeviz_movies_dev": {
      "filesystem_stats": {
        "avg_file_check_rate": 420,
        "avg_new_file_rate": 92,
        "typical_change_ratio": 0.15,  // 15% of files typically change
        "last_scan_duration": 487
      },
      "media_enrichment_stats": {
        "video_analysis_rate": 2.1,
        "image_processing_rate": 15.3,
        "typical_video_ratio": 0.45,    // 45% of media files are videos
        "avg_file_size_mb": 1250
      },
      "network_performance": {
        "avg_throughput_mbps": 125,
        "latency_ms": 12,
        "reliability_score": 0.94
      }
    }
  }
}
```

**Real-Time Rate Adaptation:**
```javascript
class AdaptiveRateTracker {
  constructor(operation) {
    this.operation = operation
    this.samples = []
    this.windowSize = 30000  // 30-second rolling window
    this.confidence = 'low'
  }
  
  addSample(itemsProcessed, timeElapsed, metadata = {}) {
    const rate = itemsProcessed / timeElapsed
    const sample = {
      rate,
      timestamp: Date.now(),
      metadata: metadata  // file sizes, types, etc.
    }
    
    this.samples.push(sample)
    this.cleanOldSamples()
    this.updateConfidence()
  }
  
  getCurrentRate() {
    if (this.samples.length < 3) {
      return this.getHistoricalRate() // Fall back to historical data
    }
    
    // Weighted average favoring recent samples
    return this.calculateWeightedRate()
  }
  
  updateConfidence() {
    const sampleCount = this.samples.length
    const variance = this.calculateVariance()
    
    if (sampleCount >= 10 && variance < 0.2) {
      this.confidence = 'high'
    } else if (sampleCount >= 5 && variance < 0.4) {
      this.confidence = 'medium'  
    } else {
      this.confidence = 'low'
    }
  }
}
```

#### 3. Parallel Operation Time Estimation

**Concurrent Phase Handling:**
```javascript
function calculateOverallRemainingTime(scanState) {
  const phaseEstimates = []
  
  // Filesystem indexing estimate
  if (scanState.filesystem_indexing.active) {
    const fsTime = calculateFilesystemRemainingTime(scanState.filesystem_indexing)
    phaseEstimates.push({
      phase: 'filesystem_indexing',
      time: fsTime.seconds,
      confidence: fsTime.confidence
    })
  }
  
  // Media enrichment estimate (runs in parallel after initial files are indexed)
  if (scanState.media_enrichment.active) {
    const mediaTime = calculateMediaEnrichmentTime(scanState.media_enrichment)
    phaseEstimates.push({
      phase: 'media_enrichment', 
      time: mediaTime.seconds,
      confidence: mediaTime.confidence
    })
  }
  
  // Overall time is the maximum (limiting phase)
  const limitingPhase = phaseEstimates.reduce((max, current) => 
    current.time > max.time ? current : max
  )
  
  return {
    total_remaining_seconds: limitingPhase.time,
    limiting_phase: limitingPhase.phase,
    confidence: calculateOverallConfidence(phaseEstimates),
    phase_breakdown: phaseEstimates
  }
}
```

#### 4. Context-Aware Estimation

**File Type Impact Analysis:**
```javascript
function calculateMediaEnrichmentTime(enrichmentState) {
  const queue = enrichmentState.queue
  let totalTime = 0
  
  // Account for different processing times by file type and size
  queue.videos.forEach(video => {
    const baseTime = 1 / operationRates.video_metadata
    const sizeFactor = Math.log(video.size_mb) / Math.log(1000) // Larger files take longer
    const codecComplexity = getCodecComplexity(video.codec) // H.265 slower than H.264
    totalTime += baseTime * sizeFactor * codecComplexity
  })
  
  queue.images.forEach(image => {
    const baseTime = 1 / operationRates.image_exif
    const resolutionFactor = (image.width * image.height) / (1920 * 1080) // Higher res = more processing
    totalTime += baseTime * Math.sqrt(resolutionFactor)
  })
  
  return {
    seconds: totalTime,
    confidence: calculateConfidence(enrichmentState),
    breakdown: {
      video_time: calculateVideoTime(queue.videos),
      image_time: calculateImageTime(queue.images),
      audio_time: calculateAudioTime(queue.audio)
    }
  }
}
```

#### 5. Enhanced WebSocket Message Format

**Comprehensive Time Information:**
```json
{
  "scan_id": "b0238a6a-6486-475b-b36b-beb28cd41630",
  "time_estimation": {
    "elapsed_seconds": 154,
    "remaining_seconds": 267,
    "total_estimated_seconds": 421,
    "limiting_phase": "media_enrichment",
    "overall_confidence": "medium",
    "last_updated": "2025-08-24T23:15:32Z"
  },
  "performance_metrics": {
    "current_rate": {
      "value": 89.2,
      "unit": "files_per_second",
      "operation": "new_file_scanning"
    },
    "rate_trend": "increasing",
    "efficiency_vs_historical": 1.03,
    "throughput_mbps": 145.7
  },
  "phase_estimates": {
    "filesystem_indexing": {
      "remaining_seconds": 145,
      "confidence": "high",
      "current_sub_phase": "filesystem_walking",
      "bottleneck": "network_latency"
    },
    "media_enrichment": {
      "remaining_seconds": 267,
      "confidence": "medium", 
      "current_operation": "video_analysis",
      "queue_breakdown": {
        "videos_remaining": 234,
        "avg_video_processing_time": 0.43,
        "images_remaining": 1205,
        "avg_image_processing_time": 0.064
      }
    }
  },
  "confidence_factors": {
    "sample_size": "adequate",
    "rate_stability": "stable",
    "historical_data": "available",
    "workload_predictability": "mixed_file_types"
  }
}
```

#### 6. UI/UX Time Display

**Enhanced Progress Display:**
```
⏱️ Time Remaining: 4m 27s ⚠️ Medium Confidence
├── Limiting factor: Media enrichment (video analysis)
├── Current rate: 89 files/sec ↗️ Increasing  
├── Efficiency: 103% of historical average
└── Network: 145 Mbps throughput, 12ms latency

Phase Breakdown:
├── Filesystem Indexing: 2m 25s remaining (high confidence)
│   ├── Rate: 89 files/sec (stable)  
│   └── Bottleneck: Network latency to /cifs/movies
└── Media Enrichment: 4m 27s remaining (medium confidence) 
    ├── Videos: 234 remaining (~3m 40s at 2.1/sec)
    ├── Images: 1,205 remaining (~1m 20s at 15/sec) 
    └── Note: Large video files may extend estimate
```

**Confidence Indicators:**
- 🟢 **High Confidence** (±30s): Stable rates, good historical data, predictable workload
- 🟡 **Medium Confidence** (±2m): Some variation expected, mixed file types  
- 🔴 **Low Confidence** (±5m): Initial scan, no historical data, unpredictable network

#### 7. Learning and Optimization

**Post-Scan Analysis:**
```javascript
function recordScanCompletion(scanId, actualDuration, estimates) {
  const accuracy = calculateEstimateAccuracy(estimates, actualDuration)
  
  // Update historical performance data
  updateVolumePerformanceHistory(scanId, {
    actual_duration: actualDuration,
    estimate_accuracy: accuracy,
    performance_metrics: extractPerformanceMetrics(scanId)
  })
  
  // Adjust future estimation parameters based on accuracy
  if (accuracy.filesystem_indexing < 0.8) {
    adjustFilesystemEstimationWeights(accuracy.filesystem_indexing)
  }
  
  if (accuracy.media_enrichment < 0.8) {
    adjustMediaEstimationRates(accuracy.media_enrichment) 
  }
}
```

### Implementation Phases:

#### Phase 5A: Basic Rate-Based Estimation
- [ ] Implement operation-specific rate tracking
- [ ] Add phase-weighted progress calculation
- [ ] Basic confidence indicators based on sample size

#### Phase 5B: Historical Learning System  
- [ ] Database schema for performance history
- [ ] Post-scan accuracy analysis and learning
- [ ] Volume-specific performance profiles

#### Phase 5C: Advanced Context Awareness
- [ ] File type/size impact on processing time
- [ ] Network performance impact modeling
- [ ] Parallel operation time calculation

#### Phase 5D: Predictive Optimization
- [ ] Machine learning for estimate refinement
- [ ] Seasonal/time-based performance patterns
- [ ] Resource utilization impact modeling

### Benefits:

1. **Accurate Estimates**: Multi-factor calculation considering operation complexity
2. **Learning System**: Estimates improve over time based on actual performance
3. **Confidence Indicators**: Users know how reliable the estimate is
4. **Transparency**: Clear explanation of what's driving the time estimate
5. **Parallel Awareness**: Correct handling of concurrent operations
6. **Context Sensitivity**: File types, sizes, and network conditions affect estimates
7. **Performance Optimization**: Historical data helps optimize scanning strategies

## Phase 6: Volume Scan Progress Enhancement

### Current Volume Scan Problems:
- **Black box operation**: `du` command runs with no progress indication
- **Unpredictable duration**: Can take seconds or minutes depending on volume size
- **No cancellation**: Users can't interrupt long-running scans
- **No transparency**: No indication of what directories are being processed

### Enhanced Volume Scan Strategy:

#### 1. Progressive Directory Scanning

**Instead of single `du` command:**
```bash
# Current approach (black box)
du -sb /cifs/movies  # Could take 30 seconds with no progress
```

**New approach (progressive):**
```go
func (vs *VolumeScanner) ScanVolumeWithProgress(ctx context.Context, volumePath string, scanID string) (*VolumeStats, error) {
    // First pass: Quick directory enumeration for progress baseline
    dirCount, err := vs.countDirectories(ctx, volumePath)
    if err != nil {
        // Fallback to estimated based on depth
        dirCount = vs.estimateDirectoryCount(volumePath)
    }
    
    stats := &VolumeStats{
        TotalDirectories: dirCount,
        ProcessedDirectories: 0,
    }
    
    // Second pass: Progressive size calculation
    return vs.walkDirectoriesWithProgress(ctx, volumePath, scanID, stats)
}
```

#### 2. Directory-by-Directory Progress

**Granular Progress Tracking:**
```go
func (vs *VolumeScanner) walkDirectoriesWithProgress(ctx context.Context, rootPath string, scanID string, stats *VolumeStats) error {
    return filepath.Walk(rootPath, func(path string, info os.FileInfo, err error) error {
        if err != nil {
            return nil // Skip inaccessible directories
        }
        
        if info.IsDir() {
            // Update current directory being processed
            vs.updateProgress(scanID, "volume_scan", &VolumeProgress{
                CurrentDirectory: path,
                DirectoriesProcessed: stats.ProcessedDirectories,
                TotalDirectories: stats.TotalDirectories,
                Progress: int((stats.ProcessedDirectories * 100) / stats.TotalDirectories),
                TotalSizeBytes: stats.TotalSizeBytes,
            })
            
            // Calculate directory size
            dirSize := vs.calculateDirectorySize(ctx, path)
            stats.TotalSizeBytes += dirSize
            stats.ProcessedDirectories++
            
            // Send progress update every 10 directories or 1 second
            if stats.ProcessedDirectories%10 == 0 || vs.shouldSendUpdate() {
                vs.broadcastProgress(scanID, stats)
            }
        }
        
        return nil
    })
}
```

#### 3. Smart Time Estimation for Volume Scan

**Rate-Based Estimation:**
```go
type VolumePerformanceTracker struct {
    directoriesPerSecond float64
    bytesPerSecond       int64
    startTime           time.Time
    samples             []PerformanceSample
}

func (vpt *VolumePerformanceTracker) estimateRemainingTime(processed, total int, currentRate float64) time.Duration {
    remaining := total - processed
    
    if currentRate > 0 {
        remainingSeconds := float64(remaining) / currentRate
        return time.Duration(remainingSeconds) * time.Second
    }
    
    // Fallback to historical data
    if vpt.directoriesPerSecond > 0 {
        remainingSeconds := float64(remaining) / vpt.directoriesPerSecond
        return time.Duration(remainingSeconds) * time.Second
    }
    
    return 0 // No estimate available
}
```

#### 4. Enhanced WebSocket Messages for Volume Scan

**Detailed Volume Scan Progress:**
```json
{
  "scan_id": "b0238a6a-6486-475b-b36b-beb28cd41630",
  "phase": "volume_scan",
  "sub_phase": "directory_analysis",
  "progress": 67,
  "current_operation": "Analyzing directory sizes",
  "current_item": "/cifs/movies/action/marvel",
  "directories": {
    "processed": 1547,
    "total": 2314,
    "current_path": "/cifs/movies/action/marvel",
    "depth": 3
  },
  "size_analysis": {
    "total_bytes": 15420891234567,
    "total_formatted": "14.2 TB",
    "directories_with_size": 1547,
    "average_directory_size": 9969832145
  },
  "performance": {
    "directories_per_second": 89.3,
    "bytes_per_second": 8234567890,
    "elapsed_seconds": 17,
    "estimated_remaining_seconds": 8
  },
  "confidence": "high"
}
```

#### 5. Optimized Directory Size Calculation

**Faster Size Calculation:**
```go
func (vs *VolumeScanner) calculateDirectorySize(ctx context.Context, dirPath string) int64 {
    // Use optimized approach based on filesystem type
    if vs.isNetworkPath(dirPath) {
        return vs.calculateNetworkDirectorySize(ctx, dirPath)
    }
    
    return vs.calculateLocalDirectorySize(ctx, dirPath)
}

func (vs *VolumeScanner) calculateNetworkDirectorySize(ctx context.Context, dirPath string) int64 {
    // For network mounts, use readdir + stat (faster than du)
    entries, err := os.ReadDir(dirPath)
    if err != nil {
        return 0
    }
    
    var totalSize int64
    for _, entry := range entries {
        if ctx.Err() != nil {
            return totalSize // Early cancellation
        }
        
        fullPath := filepath.Join(dirPath, entry.Name())
        if info, err := entry.Info(); err == nil {
            if info.IsDir() {
                // Recursively calculate subdirectory sizes
                totalSize += vs.calculateNetworkDirectorySize(ctx, fullPath)
            } else {
                totalSize += info.Size()
            }
        }
    }
    
    return totalSize
}
```

#### 6. Historical Performance Learning

**Volume-Specific Performance Data:**
```json
{
  "volume_scan_performance": {
    "volumeviz_movies_dev": {
      "filesystem_type": "cifs",
      "network_mount": true,
      "historical_rates": {
        "directories_per_second": 92.4,
        "bytes_analyzed_per_second": 8500000000,
        "typical_directory_count": 2314,
        "typical_scan_duration": 26
      },
      "performance_factors": {
        "network_latency_impact": 0.15,
        "directory_depth_factor": 1.23,
        "avg_files_per_directory": 8.7
      }
    }
  }
}
```

#### 7. UI Display for Volume Scan

**Enhanced Volume Scan Display:**
```
Volume Scan 🔄 67% (8s remaining)
├── Current: /cifs/movies/action/marvel/
├── Progress: 1,547/2,314 directories analyzed
├── Size found: 14.2 TB (growing...)
├── Rate: 89 directories/sec (stable)
└── Network: 145 Mbps, 12ms latency

Breakdown by depth:
├── Level 1: 12 directories (movies/)
├── Level 2: 234 directories (genres)  
├── Level 3: 1,301 directories (titles) ← Currently processing
└── Level 4+: Processing subdirectories...
```

#### 8. Cancellation and Error Handling

**Interruptible Volume Scan:**
```go
func (vs *VolumeScanner) ScanVolumeWithProgress(ctx context.Context, volumePath string, scanID string) (*VolumeStats, error) {
    // Create cancellable context with timeout
    scanCtx, cancel := context.WithTimeout(ctx, 10*time.Minute)
    defer cancel()
    
    // Check for cancellation every directory
    return vs.walkDirectoriesWithProgress(scanCtx, volumePath, scanID)
}

func (vs *VolumeScanner) walkDirectoriesWithProgress(ctx context.Context, rootPath string, scanID string) error {
    return filepath.Walk(rootPath, func(path string, info os.FileInfo, err error) error {
        // Check for cancellation
        select {
        case <-ctx.Done():
            vs.broadcastCancellation(scanID, "Volume scan cancelled by user")
            return ctx.Err()
        default:
        }
        
        // Handle errors gracefully
        if err != nil {
            vs.recordError(scanID, fmt.Sprintf("Cannot access %s: %v", path, err))
            return nil // Continue scanning other directories
        }
        
        // Process directory...
        return nil
    })
}
```

#### 9. Smart Directory Estimation

**Initial Directory Count Estimation:**
```go
func (vs *VolumeScanner) estimateDirectoryCount(volumePath string) int64 {
    // Sample first few levels to estimate total
    sampleSize := vs.sampleDirectories(volumePath, 3) // Sample 3 levels deep
    
    // Use sampling to extrapolate total count
    avgBranchingFactor := sampleSize.avgChildDirectories
    maxDepth := sampleSize.maxDepth
    
    // Exponential estimation: level1 * branching^depth
    estimated := int64(float64(sampleSize.level1Count) * math.Pow(avgBranchingFactor, float64(maxDepth)))
    
    // Cap at reasonable limits
    if estimated > 50000 {
        estimated = 50000 // Very large directory structure
    }
    
    return estimated
}
```

### Benefits of Enhanced Volume Scan:

1. **Real-time Progress**: Users see exactly which directory is being processed
2. **Accurate Time Estimates**: Based on actual directory processing rates  
3. **Cancellable Operations**: Users can interrupt long-running scans
4. **Network Optimization**: Smart handling of network mounts vs local filesystems
5. **Error Resilience**: Continues scanning even if some directories are inaccessible
6. **Historical Learning**: Improves estimates based on previous scans
7. **Granular Feedback**: Shows progress by directory depth and size accumulation

### Implementation Priority:

#### Phase 6A: Basic Progressive Scanning
- [ ] Replace single `du` command with directory-by-directory walking
- [ ] Add real-time progress updates with current directory
- [ ] Implement cancellation support

#### Phase 6B: Performance Optimization  
- [ ] Smart directory counting for initial estimation
- [ ] Network vs local filesystem optimization
- [ ] Error handling and resilience

#### Phase 6C: Advanced Features
- [ ] Historical performance learning
- [ ] Directory depth analysis and visualization
- [ ] Performance factor modeling (network latency impact)

This enhancement transforms volume scanning from a black box operation into a fully transparent, predictable, and user-controlled process.

## Phase 7: Volume Scan Method Analysis & Progressive Implementation

### Current Volume Scan Methods Analysis

After examining the three existing scan methods in `/internal/services/scanner/`, here's the current state:

#### 1. Du Method (`du_method.go`)
- **Current**: Executes single `du -s -B1` command (black box)
- **Performance**: ~500 files/sec estimated, moderate speed
- **Progress**: No progress reporting (`SupportsProgress() = false`)
- **Accuracy**: High - uses standard Unix du command
- **Reliability**: High - standard system tool

#### 2. Diskus Method (`diskus_method.go`) 
- **Current**: Executes single `diskus` command (black box)
- **Performance**: Very fast (~1GB/sec estimated)
- **Progress**: No progress reporting (`SupportsProgress() = false`)
- **Accuracy**: High - optimized Rust-based tool
- **Reliability**: Requires external tool installation

#### 3. Native Method (`native_method.go`)
- **Current**: Uses `filepath.Walk` with progress callbacks
- **Performance**: Slowest (~100 files/sec estimated) 
- **Progress**: Full progress reporting (`SupportsProgress() = true`)
- **Accuracy**: High - provides detailed file/directory counts
- **Reliability**: Always available (pure Go)

### Strategy: Keep Du Performance + Add Transparency

Instead of replacing du entirely, we'll implement **progressive du scanning** that maintains performance while adding transparency:

#### Core Approach: Smart Directory Batching
```go
// Current (black box): Single command for entire volume
du -s -B1 /cifs/movies  // Takes 30 seconds, no progress

// New (progressive): Batch directories intelligently  
du -s -B1 /cifs/movies/action /cifs/movies/comedy /cifs/movies/drama
// Process in batches, show progress for each batch
```

#### Implementation Strategy:

**Step 1: Directory Structure Analysis**
- Quick `find` or `filepath.Walk` to enumerate top-level directories
- Group directories into logical batches (by depth, size estimates)
- Estimate total progress baseline

**Step 2: Batched Du Execution**
- Execute `du` on directory batches instead of single command
- Update progress after each batch completion
- Accumulate total size from batch results

**Step 3: Progress Integration**
- Integrate with existing WebSocket progress broadcasting
- Report current directory being processed
- Show percentage completion and time estimates

### Refactoring Principles

Before implementation, establish clean code standards:

#### Code Quality Standards
- **No "Enhanced/Hardened" naming** - use clear, descriptive names
- **Clean refactoring** - consolidate duplicate code, improve structure
- **Modern Go patterns** - no legacy compatibility concerns
- **Consistent error handling** - structured error types with context
- **Clear separation of concerns** - scanner logic vs progress reporting

#### File Organization
```
internal/services/scanner/
├── volume_scanner.go          # Main scanner orchestration
├── du_progressive.go          # Progressive du implementation  
├── diskus_progressive.go      # Progressive diskus implementation
├── native_method.go           # Keep existing (already progressive)
├── progress_manager.go        # Centralized progress handling
└── directory_analyzer.go     # Smart directory enumeration
```

#### Method Selection Logic
```go
// Preferred order with progressive implementations
methods := []ScanMethod{
    NewProgressiveDiskus(config),  // Fastest + progress
    NewProgressiveDu(config),      // Good balance + progress  
    NewNativeMethod(config),       // Fallback + full progress
}
```

### Progressive Du Implementation Plan

#### Phase 7A: Smart Directory Batching
```go
type ProgressiveDuScanner struct {
    batchSize     int           // Directories per batch
    maxDepth      int           // Limit directory traversal depth
    progressFunc  func(update)  // Progress callback
    estimator     *TimeEstimator
}

func (p *ProgressiveDuScanner) ScanWithProgress(ctx context.Context, path string) (*ScanResult, error) {
    // 1. Quick directory enumeration (5-10 seconds max)
    dirs, err := p.enumerateDirectoryBatches(ctx, path)
    
    // 2. Process batches with du commands
    var totalSize int64
    for i, batch := range dirs {
        batchSize, err := p.scanDirectoryBatch(ctx, batch)
        totalSize += batchSize
        
        // Progress update after each batch
        progress := ProgressUpdate{
            CurrentPath: batch[0], // First dir in batch
            Progress:    float64(i+1) / float64(len(dirs)),
            ElapsedTime: time.Since(start),
        }
        p.progressFunc(progress)
    }
    
    return &ScanResult{TotalSize: totalSize, Method: "progressive_du"}
}
```

#### Phase 7B: Progressive Diskus Implementation
- Similar batching approach for diskus command
- Leverage diskus speed while adding transparency
- Smart batch sizing based on directory structure

#### Phase 7C: Progress Integration
- Integrate with existing WebSocket broadcasting
- Update database progress tracking
- Add to scheduler's periodic progress updates

### WebSocket Message Format

Update volume scan progress messages to match other phases:

```json
{
  "scan_id": "b0238a6a-6486-475b-b36b-beb28cd41630",
  "phase": "volume_scan", 
  "sub_phase": "directory_analysis",
  "progress": 67,
  "current_operation": "Analyzing directory sizes",
  "current_item": "/cifs/movies/action/marvel/",
  "method": "progressive_du",
  "directories": {
    "processed": 12,
    "total": 18,
    "current_batch": ["/movies/action", "/movies/comedy"] 
  },
  "performance": {
    "directories_per_second": 2.1,
    "bytes_analyzed": 15420891234567,
    "estimated_remaining_seconds": 8
  },
  "confidence": "high"
}
```

### Implementation Benefits

1. **Preserve Performance**: Du and diskus remain fast, just batched
2. **Add Transparency**: Real-time progress like filesystem_indexing 
3. **Maintain Reliability**: Same underlying tools, just orchestrated differently
4. **Enable Cancellation**: Context cancellation between batches
5. **Smart Estimation**: Historical data improves batch sizing
6. **Clean Architecture**: No legacy cruft, modern Go patterns

### Implementation Priority

#### Phase 7A: Foundation (Week 1)
- [ ] Refactor existing scanner code for cleanliness
- [ ] Implement directory enumeration and batching logic
- [ ] Create progress manager for centralized updates

#### Phase 7B: Progressive Du (Week 1-2)  
- [ ] Implement batched du execution
- [ ] Add progress callbacks and WebSocket integration
- [ ] Test with various directory structures

#### Phase 7C: Progressive Diskus (Week 2)
- [ ] Implement batched diskus execution  
- [ ] Optimize batch sizes for diskus performance
- [ ] Add method fallback logic

#### Phase 7D: Integration & Polish (Week 2-3)
- [ ] Integrate with scheduler progress broadcasting
- [ ] Add time estimation and confidence indicators
- [ ] Performance testing and optimization

This approach gives us the transparency of the native method with the performance benefits of du/diskus, creating a unified progressive scanning experience across all three phases.

## Session Context & Current Status

### What We Discovered
- User reported scan progress showing stale data ("Updated 6:53:06 PM, 21%")
- Real-time updates were implemented successfully (timestamps now update every second)
- **Critical Issue Found**: Filesystem indexing hanging at 0% due to bulk deletion of 28,308 files
- User wants incremental scanning instead of bulk deletion: "we should actually be checking the files against what's actually in the db, not redoing everything"

### Volume Scan Methods Analysis (Completed)
1. **Du Method** (`du_method.go`): Single `du -s -B1` command, no progress, ~500 files/sec
2. **Diskus Method** (`diskus_method.go`): Single `diskus` command, no progress, ~1GB/sec  
3. **Native Method** (`native_method.go`): `filepath.Walk` with progress, ~100 files/sec

### Key User Requirements
- **Preserve du performance**: "I still want to use the du command as it's the most performant, right?"
- **Make everything transparent**: "should be made 100% transparent to the FE during the filesystem indexing"
- **Show progress for all phases**: "I should see updates for three phases and performance metrics every second"
- **Clean code standards**: "keep things tidy, not call things enhanced or hardened, and not worry about supporting legacy systems"

### Implementation Strategy Agreed Upon
**Smart Directory Batching**: Keep du/diskus tools but batch directories instead of single command
```bash
# Current (black box)
du -s -B1 /cifs/movies  # 30 seconds, no progress

# New (progressive)  
du -s -B1 /movies/action /movies/comedy /movies/drama  # Progress between batches
```

### Next Steps
- **Phase 7A**: Clean up existing code and implement directory batching foundation
- Focus on modern Go patterns, clear naming, no legacy compatibility
- Preserve performance while adding transparency

### Files Modified in This Session
- `/home/fictional/Projects/volumeviz/internal/scheduler/scheduler.go` - Added 1-second periodic WebSocket broadcaster
- `/home/fictional/Projects/volumeviz/internal/services/filesystem/progress_tracker.go` - Added WebSocket broadcasts on milestone updates
- `/home/fictional/Projects/volumeviz/SCAN_PROGRESS_ENHANCEMENT_PLAN.md` - Comprehensive plan with Phase 7 volume scan analysis

This plan transforms the scanning process from a black box into a fully transparent, efficient, and user-friendly operation with intelligent time estimation.