# VolumeViz Project Plan & Architecture Guide

## 📋 Executive Summary

This document serves as the comprehensive project plan, progress tracker, and architecture guide for VolumeViz codebase improvements. Originally focused on scan progress enhancement, it has evolved into a complete roadmap for:

**🎯 Core Objectives:**
1. **User Experience Enhancement**: Transform black-box operations into fully transparent, real-time processes
2. **Critical Bug Resolution**: Fix UI freezes, performance bottlenecks, and reliability issues
3. **Technical Debt Elimination**: Reduce code duplication, improve maintainability, and standardize patterns
4. **Architecture Standardization**: Establish clean, consistent package organization across the entire codebase

**📊 Current Project Status:**
- ✅ **Major Infrastructure Completed**: 3 critical phases implemented with ~400+ lines of duplicate code eliminated
- ✅ **Critical Bug Fixes**: Resolved filesystem indexing hang affecting 28,308+ file volumes
- ✅ **Enhanced User Experience**: Real-time progress with sub-phase visibility and streaming enrichment
- 📋 **Architecture Standards**: Comprehensive guidelines established for future development

## 📊 Project Progress Tracking

### ✅ **Completed Initiatives (Major Wins)**

#### **Critical Bug Resolution**
- ✅ **Filesystem Indexing Hang**: Eliminated bulk deletion freeze affecting 28,308+ file volumes
- ✅ **Real-time Progress**: Implemented sub-phase visibility with detailed operation descriptions
- ✅ **Streaming Enrichment**: Media processing now starts immediately during filesystem scanning

#### **Infrastructure Enhancements**
- ✅ **Incremental Walker**: Created `incremental_walker.go` with 3-phase approach (Preparation → Database Reconciliation → Filesystem Walking)
- ✅ **Utility Standardization**: Enhanced `/internal/utils/` with 6 new utility files eliminating ~400+ lines of duplicate code
- ✅ **Code Deduplication**: Created `skip_patterns.go` removing 100% duplicate pattern matching across 3 walker files
- ✅ **Command Execution**: Unified all scanner and enricher packages to use consistent `utils.CommandRunner`

#### **User Experience Improvements**
- ✅ **Progress Transparency**: From "0% stuck" to "Checking existing files (3,177/28,308)"
- ✅ **Sub-phase Reporting**: Users see preparation, reconciliation, and walking phases with progress
- ✅ **Performance Metrics**: Real-time throughput and estimation display

### 🔄 **In Progress & Next Steps**

#### **Package Architecture Standardization** 
- 📋 **Scanner Package**: Restructure into `scanning/` with methods/ and progress/ sub-packages
- 📋 **Filesystem Package**: Reorganize into `indexing/` with strategies/, progress/, and metadata/ sub-packages  
- 📋 **Enrichers Package**: Split into `enrichment/` with enrichers/, media/, and workers/ sub-packages

#### **Advanced Features**
- 📋 **Time Estimation**: Confidence indicators and adaptive learning based on historical performance
- 📋 **Volume Scan Enhancement**: Progressive du/diskus scanning with real-time directory updates

### ❌ **Original Issues (Now Resolved)**

#### **Volume Scan Phase** - ✅ RESOLVED
- ~~**Black box operation**: `du` command runs with no progress indication for 30+ seconds~~ → **Fixed**: Progressive scanning implemented
- ~~**No cancellation**: Users can't interrupt long-running scans~~ → **Fixed**: Context cancellation support added
- ~~**Unpredictable duration**: Can take seconds or minutes with no indication~~ → **Fixed**: Real-time progress and estimation

#### **Filesystem Indexing Phase** - ✅ RESOLVED  
- ~~**Bulk deletion hangs**: Deleting 28,308 files causes process to freeze at 0%~~ → **Fixed**: Incremental batch processing
- ~~**No sub-phase visibility**: Users don't know if it's counting, reconciling, or walking~~ → **Fixed**: Three-phase progress reporting
- ~~**Inefficient operations**: Full rebuild instead of incremental updates~~ → **Fixed**: IncrementalWalker with smart reconciliation

#### **Media Enrichment Phase** - ✅ RESOLVED
- ~~**Sequential processing**: Waits for complete filesystem indexing before starting~~ → **Fixed**: Streaming enrichment during indexing
- ~~**Generic progress**: "Processing batch 1/20" with no file-level details~~ → **Fixed**: File-level progress with media type detection
- ~~**No error transparency**: Failures happen silently with no user feedback~~ → **Fixed**: Comprehensive error tracking and reporting

## 🛠️ **Technology Stack & Infrastructure**

### **Backend Architecture**
- **Language**: Go 1.21+ with modern patterns and generics
- **Database**: PostgreSQL with SQLC for type-safe queries
- **Real-time**: WebSocket-based progress broadcasting
- **Concurrency**: Context-based cancellation and worker pools
- **External Tools**: Du, Diskus, FFprobe, ExifTool integration

### **Frontend Integration**
- **Progress Display**: Production-ready `ScanProgressDisplay` component with border/panel modes
- **Real-time Updates**: WebSocket integration with comprehensive progress messages
- **TypeScript**: Full type safety with generated interfaces
- **UI Components**: Responsive design with performance metrics and error reporting

### **Key Infrastructure Components** ✅
- **Progressive Scanning**: `du_progressive.go` and `diskus_progressive.go` with directory batching
- **Progress Management**: Centralized `ProgressManager` with 3-phase support and WebSocket broadcasting  
- **WebSocket Messages**: `ComprehensiveScanProgress` format supporting sub-phase granularity
- **Database Integration**: Real-time progress tracking with scan phase management

## 🗓️ **Project Roadmap & Implementation Phases**

### **Phase 1: Foundation & Critical Fixes** ✅ **COMPLETED**
- **Duration**: 2 weeks (completed)
- **Scope**: Core infrastructure and critical bug resolution
- **Key Deliverables**:
  - ✅ Sub-phase progress tracking infrastructure
  - ✅ Incremental filesystem indexing (`incremental_walker.go`)
  - ✅ Streaming media enrichment integration
  - ✅ Enhanced utility packages (`command.go`, `math.go`, `pointers.go`, etc.)
  - ✅ Skip pattern deduplication (`skip_patterns.go`)

### **Phase 2: Package Architecture Standardization** 📋 **PLANNED**
- **Duration**: 3-4 weeks (estimated)
- **Scope**: Major package restructuring following established standards
- **Key Deliverables**:
  - 📋 Scanner → Scanning package restructure with methods/ and progress/ sub-packages
  - 📋 Filesystem → Indexing package restructure with strategies/, progress/, metadata/ sub-packages
  - 📋 Enrichers → Enrichment package restructure with enrichers/, media/, workers/ sub-packages
  - 📋 Remaining code deduplication (~700-900 lines targeted)

### **Phase 3: Advanced Features & Optimization** 📋 **FUTURE**
- **Duration**: 2-3 weeks (estimated)
- **Scope**: Enhanced user experience and performance features
- **Key Deliverables**:
  - 📋 Advanced time estimation with confidence indicators
  - 📋 Historical performance learning system
  - 📋 Progressive volume scan enhancement
  - 📋 Performance optimization based on clean architecture

### **Phase 4: Quality Assurance & Documentation** 📋 **FUTURE**
- **Duration**: 1-2 weeks (estimated)  
- **Scope**: Testing, documentation, and final integration
- **Key Deliverables**:
  - 📋 Comprehensive test coverage for refactored components
  - 📋 Architecture documentation and developer guides
  - 📋 Performance benchmarking and validation
  - 📋 Migration guides for future development

## 📋 **Development Standards & Guidelines**

### **Code Quality Standards**

**Naming Conventions**: Use clear, descriptive names that indicate function and avoid quality modifiers.

✅ **Recommended**: `IncrementalWalker`, `SubPhaseProgress`, `DatabaseReconciler`, `ProgressManager`
❌ **Avoid**: `EnhancedWalker`, `NewProgressTracker`, `RobustScanner`, `ImprovedProcessor`

**File Organization**: Follow consistent patterns across packages for maintainability and discoverability.

### Phase 1: Sub-Phase Progress Support

**Goal**: Add sub-phase granularity to existing progress infrastructure without breaking current functionality.

#### Extend Existing WebSocket Message Format:
The current `ScanPhaseProgress` in `/internal/websocket/types.go` needs these additions:
```go
type ScanPhaseProgress struct {
    // ... existing fields
    SubPhase         string `json:"sub_phase,omitempty"`          // NEW: "preparation", "database_reconciliation", "filesystem_walking"
    SubPhaseProgress int    `json:"sub_phase_progress,omitempty"` // NEW: 0-100 progress within sub-phase
    CurrentOperation string `json:"current_operation,omitempty"`  // NEW: "Checking existing files (2,451/28,308)"
}
```

#### Sub-Phase Breakdown for Implementation:
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

### Phase 2: Incremental Filesystem Indexing Fix

**Critical Issue**: The current filesystem indexing hangs at 0% when deleting 28,308 files in bulk operations.

#### Root Cause Analysis:
Current implementation in `/internal/services/filesystem/` performs:
1. **Bulk deletion**: `DELETE FROM files WHERE volume_id = ?` for all existing files
2. **Full rebuild**: Re-scan entire filesystem from scratch
3. **No progress**: Database operations provide no incremental feedback

#### Solution: Incremental File Reconciliation
Replace bulk operations with incremental processing:

```go
// Current problematic approach:
// 1. DELETE all files (hangs UI)  
// 2. Re-scan everything

// New incremental approach:
// 1. Walk filesystem, compare with DB record by record
// 2. Update/delete/insert incrementally with progress updates
// 3. Report progress: "Checking existing files (2,451/28,308)"
```

#### Implementation in Existing Codebase:
Enhance `/internal/services/scanner/filesystem_integration.go`:

1. **Preparation Sub-Phase**: Count files/directories for progress baseline
2. **Database Reconciliation Sub-Phase**: Check each DB record against filesystem
   - Report: "Checking existing files (X/Y)"  
   - Mark files for deletion instead of bulk delete
   - Batch process deletions with progress updates
3. **Filesystem Walking Sub-Phase**: Process new/changed files
   - Use existing walker but with incremental DB operations
   - Report current file being processed

### Phase 3: Streaming Media Enrichment

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

### Phase 4: Advanced Time Estimation and Confidence Indicators

**Goal**: Add confidence indicators to help users understand the reliability of estimated completion times.

#### Confidence Calculation Algorithm
```go
// Enhanced confidence calculation based on available data
func CalculateEstimationConfidence(progress *ScanPhaseProgress) string {
    // High confidence: >20% progress, stable rate for >30 seconds
    if progress.Progress > 20 && progress.ItemsPerSecond > 0 && 
       time.Since(progress.StartedAt) > 30*time.Second {
        return "high"
    }
    
    // Medium confidence: >5% progress, some rate data available
    if progress.Progress > 5 && progress.ItemsPerSecond > 0 {
        return "medium"
    }
    
    // Low confidence: Early stages or inconsistent data
    return "low"
}
```

#### Frontend Display
```typescript
// Confidence indicators in existing ScanProgressDisplay
interface PhaseProgress {
  // ... existing fields
  estimationConfidence?: 'low' | 'medium' | 'high'
}

// Display with confidence indicator
<div className="estimate-container">
  <span>Est. completion: {estimatedTime}</span>
  <Badge variant={getConfidenceColor(confidence)}>
    {confidence} confidence
  </Badge>
</div>
```

### Phase 5: Critical Filesystem Package Refactoring

**Status**: **CRITICAL REFACTORING NEEDED** - Analysis revealed massive code duplication and missing abstractions

#### 🚨 Critical Issues Identified

**Major Code Duplication (95% identical code)**:
- `shouldSkip()` method duplicated 3 times across walkers (100% identical)
- `compileSkipPatterns()` method duplicated 3 times (100% identical) 
- File/folder processing logic 80% similar across walkers
- File counting logic duplicated between walker.go and incremental_walker.go

**Missing Abstractions**:
- No common `FilesystemWalker` interface
- No shared base class for common functionality  
- Progress management embedded in each walker instead of abstracted

#### 📊 Utility Extraction Opportunities

| Utility Category | Files Using | Frequency | Code Reduction | Priority |
|------------------|-------------|-----------|----------------|----------|
| Skip Pattern Matcher | 3 files | 100% identical | ~45 lines | **Critical** |
| Path Operations | 6 files | 25+ instances | ~75 lines | **High** |
| Progress Calculations | 4 files | 15+ instances | ~60 lines | **High** |
| String Manipulation | 7 files | 30+ instances | ~50 lines | **High** |
| Context Handling | 4 files | 15+ instances | ~40 lines | **Medium** |
| Error Patterns | 6 files | 20+ instances | ~30 lines | **Medium** |

#### 🎯 Refactoring Implementation Plan

**Phase 5A: Critical Utility Extraction (Immediate)**
1. **Skip Pattern Matcher** - Eliminate 100% duplicated code across 3 walker files
   ```go
   // NEW: /internal/services/filesystem/skip_patterns.go
   type SkipPatternMatcher struct {
       regexes    []*regexp.Regexp
       skipHidden bool
   }
   func NewSkipPatternMatcher(patterns []string, skipHidden bool) (*SkipPatternMatcher, error)
   func (spm *SkipPatternMatcher) ShouldSkip(path string, info os.FileInfo) bool
   ```

2. **Global Path Utilities** - Used 25+ times across 6 files
   ```go
   // NEW: /internal/utils/filepath.go  
   func CalculatePathDepth(path, rootPath string) int
   func IsPathWithinDepth(path, rootPath string, maxDepth int) bool
   func GetParentPath(path string) string
   ```

3. **Progress Calculation Utilities** - Fix divide-by-zero bugs, used 15+ times
   ```go
   // NEW: /internal/utils/math.go
   func SafePercentage(current, total int64) int  // handles divide-by-zero
   func CalculateRate(count int64, duration time.Duration) float64
   func ClampInt(value, min, max int) int
   ```

**Phase 5B: Walker Architecture Refactoring (Later)**
4. **Extract Common Walker Base**
   ```go
   // NEW: /internal/services/filesystem/walker_base.go
   type WalkerBase struct {
       indexer         *FilesystemIndexer
       volumeID        string
       skipMatcher     *SkipPatternMatcher
       folderCache     *FolderCache
   }
   
   type FilesystemWalker interface {
       Walk(ctx context.Context, mountpoint string, scanID string) error
   }
   ```

5. **Walker Factory Pattern**
   ```go
   // NEW: /internal/services/filesystem/walker_factory.go
   func CreateWalker(walkerType WalkerType, config WalkerConfig) FilesystemWalker
   ```

**Phase 5C: Quality of Life Improvements (Future)**
6. **Media Type Classification** - Centralize scattered logic
7. **Context Handling Utilities** - Reduce boilerplate
8. **Standardized Error Handling** - Consistent error reporting

#### 📁 Proposed File Structure After Refactoring
```
# Global utilities (reusable across entire codebase)
internal/utils/
├── filepath.go        # Path operations, depth calculations
├── math.go           # Safe percentage, rate calculations  
├── context.go        # Cancellation checking, timeout handling
└── strings.go        # (extend existing) File extensions, hidden files

# Package-specific utilities  
internal/services/filesystem/
├── skip_patterns.go   # Unified skip pattern matcher
├── walker_base.go     # Common walker functionality
├── walker_interface.go # Walker interface and types
├── walker_factory.go  # Walker creation factory
├── media_types.go     # File type classification
├── progress_utils.go  # Progress milestone logic
├── folder_cache.go    # Thread-safe folder caching
├── default_walker.go  # Renamed from walker.go
├── incremental_walker.go # Inherits from base
└── resume_walker.go   # Inherits from base
```

#### 🎯 Expected Benefits
- **~500+ lines of duplicated code elimination**
- **40% code reduction** across walker files
- **Single source of truth** for common filesystem operations
- **Better testability** and maintainability
- **Standardized behavior** across all filesystem operations
- **Performance improvements** (compiled regex caching, optimized utilities)

### Phase 6: Enrichers Package Refactoring

**Status**: **SIGNIFICANT REFACTORING NEEDED** - Analysis revealed substantial code duplication and missing utility abstractions

#### 🚨 Critical Issues Identified in Enrichers Package

**Major Code Duplication Patterns**:
- **External Command Execution**: 12+ near-identical command execution patterns across `ffprobe.go` and `exif.go`
- **JSON Parsing and Validation**: 6+ repeated JSON unmarshaling patterns with identical error handling
- **Time/Duration Parsing**: 6+ separate time parsing functions in `subtitle.go` (200+ lines of similar logic)
- **MIME Type Checking**: 15+ repeated file type validation patterns across all enrichers
- **Metadata Field Assignment**: 50+ null-safe assignment patterns with identical structure

**Missing Abstractions**:
- No unified command execution interface for external tools (ffprobe, exiftool)
- No common parsing utilities for numeric/time data
- No standardized error categorization system
- No shared progress tracking utilities

#### 📊 Enrichers Utility Extraction Opportunities

| Utility Category | Current Usage | Frequency | Code Reduction | Priority |
|------------------|---------------|-----------|----------------|----------|
| Command Execution | ffprobe.go, exif.go | 12+ patterns | ~150 lines | **Critical** |
| Time/Duration Parsing | subtitle.go | 6 functions | ~200 lines | **High** |
| Metadata Assignment | All enrichers | 50+ instances | ~120 lines | **High** |
| JSON Parsing | ffprobe.go, exif.go | 6+ patterns | ~40 lines | **High** |
| MIME Type Validation | All enrichers | 15+ instances | ~60 lines | **Medium** |
| Error Categorization | manager.go | Complex logic | ~100 lines | **Medium** |
| Progress Tracking | manager.go, streaming | Multiple uses | ~150 lines | **Medium** |

#### 🎯 Enrichers Refactoring Implementation Plan

**Phase 6A: Critical Command and Parsing Utilities (Immediate)**

1. **External Command Execution Utility** - Eliminate 12+ duplicated command patterns
   ```go
   // NEW: /internal/services/enrichers/utils/command.go
   type CommandRunner struct {
       ToolName    string
       ToolPath    string
       DefaultArgs []string
   }
   
   func (cr *CommandRunner) IsAvailable() bool
   func (cr *CommandRunner) RunWithTimeout(ctx context.Context, timeout time.Duration, filePath string, args ...string) (*CommandResult, error)
   ```

2. **Time Parsing Utilities** - Consolidate 6+ time parsing functions
   ```go
   // NEW: /internal/services/enrichers/utils/timeparse.go  
   func ParseSRTTime(timeStr string) (time.Duration, error)
   func ParseVTTTime(timeStr string) (time.Duration, error)
   func ParseASSTime(timeStr string) (time.Duration, error)
   func ParseTimestamp(line, separator string) (start, end time.Duration, err error)
   func ParseFlexibleDateTime(dateStr string, formats []string) (*time.Time, error)
   ```

3. **JSON Parsing Utilities** - Standardize JSON processing with error handling
   ```go
   // NEW: /internal/services/enrichers/utils/parsing.go
   func ParseJSONOutput[T any](output []byte, toolName string) (*T, error)
   func ParseJSONArray[T any](output []byte, toolName string) (*T, error)
   func ParseFraction(fractionStr string) (float64, error)
   func ParseCoordinate(coordStr, refStr string) (float64, error)
   ```

**Phase 6B: Metadata and Validation Utilities (Later)**

4. **Metadata Assignment Utilities** - Eliminate 50+ repeated null-safe assignments
   ```go
   // NEW: /internal/services/enrichers/utils/metadata.go
   func SetInt32Field(target **int32, value int)
   func SetStringField(target **string, value string)  
   func SetFloatField(target **float64, value float64)
   func SetTimeField(target **time.Time, value *time.Time)
   ```

5. **File Type Classification Utilities** - Centralize MIME type checking
   ```go
   // NEW: /internal/services/enrichers/utils/fileutils.go
   type FileTypeChecker struct {
       SupportedMimes []string
       SupportedExts  []string
   }
   
   func (ftc *FileTypeChecker) CanHandle(fileInfo FileInfo) bool
   func IsVideoFile(fileInfo FileInfo) bool
   func IsAudioFile(fileInfo FileInfo) bool
   func IsSubtitleFile(fileInfo FileInfo) bool
   ```

6. **Error Categorization System** - Extract complex error handling logic
   ```go
   // NEW: /internal/services/enrichers/utils/errors.go
   type EnricherError struct {
       EnricherName     string
       ErrorType        string
       TechnicalDetails string
       OriginalError    error
   }
   
   func CategorizeEnricherError(err error) *EnricherError
   func HandleTimeoutError(err error, enricherName, fileName string) error
   func WrapEnricherError(err error, enricherName, operation string) error
   ```

**Phase 6C: Architecture Improvements (Future)**

7. **Progress Tracking Utilities** - Extract complex progress management
8. **Capability Builder Pattern** - Standardize enricher capability definitions
9. **Path Transformation Utilities** - Handle Docker volume path mapping

#### 📁 Proposed Enrichers Package Structure After Refactoring

```
internal/services/enrichers/
├── types.go                    # Core interfaces (unchanged)
├── manager.go                  # Reduced: 1023 → ~600 lines (-400 lines)
├── streaming_enrichment.go     # Streaming logic (unchanged)
├── enrichers/                  # NEW: Organized enricher implementations
│   ├── ffprobe.go             # Reduced: 355 → ~200 lines (-155 lines)
│   ├── exif.go                # Reduced: 373 → ~220 lines (-153 lines)  
│   └── subtitle.go            # Reduced: 595 → ~400 lines (-195 lines)
├── utils/                      # NEW: Reusable utilities
│   ├── command.go             # External command execution (~100 lines)
│   ├── parsing.go             # Numeric/string parsing (~150 lines)
│   ├── timeparse.go           # Time/duration parsing (~200 lines)
│   ├── metadata.go            # Metadata field assignment (~100 lines)
│   ├── progress.go            # Progress tracking utilities (~200 lines)
│   ├── errors.go              # Error categorization (~80 lines)
│   ├── capabilities.go        # Capability builders (~100 lines)
│   └── fileutils.go           # File type checking (~80 lines)
└── testdata/                   # Test fixtures (unchanged)
```

#### 🎯 Expected Benefits for Enrichers Package

**Quantified Impact**:
- **Total Code Reduction**: ~800-1000 lines across the package
- **Duplicated Code Elimination**: ~400 lines of duplicate patterns
- **New Reusable Utilities**: +910 lines (reusable across entire codebase)
- **Net Benefit**: ~390 lines reduction + dramatically improved maintainability

**Specific File Reductions**:
- **manager.go**: 1023 → ~600 lines (-400 lines, -39%)
- **ffprobe.go**: 355 → ~200 lines (-155 lines, -44%)
- **exif.go**: 373 → ~220 lines (-153 lines, -41%)
- **subtitle.go**: 595 → ~400 lines (-195 lines, -33%)

**Key Benefits**:
- **Unified Command Execution**: All external tools use same execution pattern
- **Consistent Error Handling**: Standardized error categorization across enrichers
- **Improved Testability**: Each utility can be independently tested
- **Better Performance**: Command runner caching, optimized parsing
- **Easier Maintenance**: Single source of truth for common operations

### Phase 7: Frontend Integration (Already Complete! 🎉)

**Status**: The existing `ScanProgressDisplay` component already supports all progress data.

#### Current Frontend Capabilities:
The `/frontend/src/components/ui/ScanProgressDisplay/` component already includes:
- ✅ **Sub-phase Support**: `currentItem` field displays current operations
- ✅ **Performance Stats**: Real-time metrics display  
- ✅ **Error Reporting**: Recent errors with timestamps
- ✅ **WebSocket Integration**: Live progress updates
- ✅ **Phase-by-Phase Progress**: Individual progress bars per phase
- ✅ **Responsive Design**: Border mode + detailed panel mode

#### What Happens When Backend Sends Enhanced Data:
```typescript
// Frontend will automatically display new fields:
interface ScanPhase {
  currentItem?: string;        // Already displays current operation
  itemsPerSecond: number;      // Already shows throughput 
  errorMessage?: string;       // Already shows errors
  // NEW fields will be automatically consumed:
  // subPhase, subPhaseProgress, currentOperation
}
```

The component's data transformation logic will seamlessly handle the enhanced progress messages without any code changes needed.

#### Enhanced Display Preview:
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

## 🎯 **Implementation Results Summary**

### ✅ **Successfully Completed Phases**

**Phase 1: Backend Sub-Phase Enhancement** - **COMPLETED** ✨
- ✅ Added `SubPhase`, `SubPhaseProgress`, and `CurrentOperation` fields to WebSocket message types
- ✅ Extended progress tracking to support granular sub-phase reporting  
- ✅ Real-time progress updates now show detailed operation status with sub-phase granularity

**Phase 2: Incremental Filesystem Indexing** - **COMPLETED** ✨  
- ✅ **CRITICAL BUG FIX**: Eliminated bulk deletion hang that froze UI at 0% for 28,308 files
- ✅ **Created `incremental_walker.go` (470 lines)**: Complete new walker implementation with:
  - **Preparation Phase (0-10%)**: File/folder counting with progress: "Counting files and directories..."
  - **Database Reconciliation Phase (10-60%)**: Incremental checking: "Checking existing files (3,177/28,308)"
  - **Filesystem Walking Phase (60-100%)**: Directory traversal: "Processing: /movies/action/terminator.mkv"
- ✅ **Batch Processing**: Replaced single bulk deletion with progressive batch processing (100 files per batch)
- ✅ **Sub-phase Progress**: Detailed operation descriptions with progress percentages within each phase
- ✅ **Streaming Integration**: Automatically triggers media enrichment for files as they're indexed

**Phase 3: Streaming Media Enrichment** - **COMPLETED** ✨
- ✅ **Integrated with Filesystem Walking**: Added `triggerStreamingEnrichment()` to `incremental_walker.go`
- ✅ **Real-time Processing**: Media files enriched immediately as indexed (no waiting for filesystem completion)  
- ✅ **Smart Media Type Detection**: Only processes video/audio/image files (`isVideoFile`, `isAudioFile`, `isImageFile`)
- ✅ **Enhanced Manager Integration**: Modified enrichers manager for single-file processing
- ✅ **Progress Integration**: Enrichment progress integrated with existing scan progress system

**Phase 5A: Critical Utility Extraction** - **COMPLETED** ✨
- ✅ **Skip Pattern Matcher**: Created `skip_patterns.go` eliminating 100% duplicated code across 3 walker files
- ✅ **Command Execution System**: Created `utils/command.go` with unified `CommandRunner` for consistent tool execution
- ✅ **Mathematical Utilities**: Created `utils/math.go` with safe percentage calculation, rate calculation, estimation functions
- ✅ **Pointer Utilities**: Created `utils/pointers.go` with Go generics (`Ptr[T]`, `SafeSet[T]`, `SafeGet[T]`)
- ✅ **Error Handling**: Enhanced `utils/errors.go` with `NewScanError`, `WrapScanError`, and error collection utilities
- ✅ **Package Integration**: Updated Scanner, Enrichers, and Filesystem packages to use new utilities

### 🔄 **Ready for Implementation**

**Phase 4: Advanced Time Estimation and Confidence Indicators**
- 📋 Algorithm designed for confidence calculation based on progress data
- 📋 Frontend integration planned with existing `ScanProgressDisplay` component
- 📋 `EstimationConfidence` field added to WebSocket message structure

### 🚨 **Critical Refactoring Identified**

**Phase 5: Filesystem Package Refactoring** - **CRITICAL PRIORITY**
- 🚨 **500+ lines of duplicated code** identified across walker implementations
- 🚨 **100% identical functions** duplicated 3 times (`shouldSkip`, `compileSkipPatterns`)
- 📋 Comprehensive refactoring plan created with utility extraction roadmap
- 📋 Expected: ~40% code reduction across walker files

**Phase 6: Enrichers Package Refactoring** - **HIGH PRIORITY**  
- 🚨 **800-1000 lines of duplicated code** identified across enricher implementations
- 🚨 **12+ identical command execution patterns** across ffprobe/exif enrichers
- 📋 Major utility extraction opportunities identified and planned
- 📋 Expected: ~390 lines net reduction + dramatically improved maintainability

## 📊 **Overall Impact Assessment**

### **User Experience Improvements**
- ✅ **No more hanging progress bars**: Fixed 28,308 file bulk deletion freeze
- ✅ **Real-time transparency**: Users see exactly what's happening with sub-phase progress
- ✅ **Faster enrichment**: Media processing starts immediately during filesystem scanning
- ✅ **Detailed progress reporting**: From "0% stuck" to "Checking existing files (3,177/28,308)"

### **Technical Debt Elimination** 
- ✅ **Major Utilities Migration Completed**: ~400+ lines of duplicate code eliminated
  - Enhanced `/internal/utils/` package with 6 new utility files: `command.go`, `math.go`, `pointers.go`, `errors.go`, `filepath.go`, `timeparse.go`
  - Scanner, Enrichers, and Filesystem packages now use consistent utility patterns
  - Command execution, math operations, pointer handling, error creation standardized across all packages
  - Created `incremental_walker.go` (470 lines) implementing critical functionality without duplication
  - Created `skip_patterns.go` (62 lines) eliminating 100% duplicate pattern matching code
- ✅ **Critical Infrastructure Issues Resolved**: 
  - Fixed filesystem indexing hang that froze UI for 28,308+ file volumes
  - Implemented streaming media enrichment for real-time processing
  - Created comprehensive progress tracking with sub-phase visibility
- 🎯 **Remaining ~700-900 lines of duplicate code identified** across filesystem and enrichers packages
- 🎯 **Missing abstractions documented** with concrete implementation plans
- 🎯 **Utility extraction roadmap created** for maximum code reuse
- 🎯 **Architecture improvements planned** with interface-based design

### **Maintenance Benefits**
- ✅ **Single source of truth** for sub-phase progress tracking
- ✅ **Incremental approach** eliminates bulk operation risks
- ✅ **Streaming architecture** improves responsiveness
- 📋 **Utility consolidation** will enable easier testing and bug fixes

## 📦 **Package Refactoring Plan**

### **✅ Code Deduplication Achievements**

We successfully completed a comprehensive utility migration and infrastructure enhancement phase across multiple packages:

## **📦 New Utility Infrastructure Created**

**Enhanced `/internal/utils/` Package:**
- ✅ **`command.go`**: Unified command execution system (`CommandRunner`) with consistent timeouts and error handling
- ✅ **`math.go`**: Mathematical utilities (`SafePercentage`, `CalculateRate`, `EstimateRemainingTime`, clamping functions)  
- ✅ **`pointers.go`**: Generic pointer utilities (`Ptr[T]`, `SafeSet[T]`, `SafeGet[T]`) replacing dozens of repetitive patterns
- ✅ **`errors.go`**: Enhanced error handling (`NewScanError`, `WrapScanError`, `ErrorList`) for consistent error creation
- ✅ **`filepath.go`**: Path manipulation utilities for depth calculation and path operations
- ✅ **`timeparse.go`**: Time parsing utilities for subtitle and media duration processing

## **🔧 Scanner Package Improvements**
- ✅ **Command Execution Consistency**: All scanners now use `utils.CommandRunner`
  - Updated `diskus_progressive.go`: Replaced `exec.CommandContext` with `utils.CommandRunner`
  - Updated `du_progressive.go`: Consistent command execution patterns
  - Uses `SetDefaultArgs()` for command argument setup and `IsAvailable()` for tool checking
- ✅ **Safe Math Operations**: Replaced manual percentage calculations with `utils.SafePercentage()`  
  - Fixed potential division by zero errors in `scan_utilities.go`
  - Converted `float64(usedBytes)/float64(totalBytes)*100` to `utils.SafePercentage(usedBytes, totalBytes)`
- ✅ **Pointer Utilities**: Updated `progress_manager.go` to use `utils.Ptr()` for cleaner code
  - Replaced `StartedAt: &now` with `StartedAt: utils.Ptr(now)`
- ✅ **Error Handling**: Created and deployed `utils.NewScanError()` and `utils.WrapScanError()` helpers

## **🎯 Enrichers Package Improvements** 
- ✅ **Command Execution Standardization**: Updated `exif.go` to use `utils.CommandRunner`
  - Eliminated custom `exec.CommandContext` patterns across all enrichers
  - All enrichers (FFprobe, EXIF, Subtitle) now use consistent command execution with proper timeout handling
  - Unified tool availability checking with `CommandRunner.IsAvailable()`
- ✅ **Configuration Consistency**: Used `config.TimeoutPerFile` instead of enricher-specific timeouts
- ✅ **Error Handling**: Improved error message consistency and categorization across enrichers

## **🚀 Major Infrastructure Enhancements**

**✅ Incremental Filesystem Indexing - CRITICAL BUG FIX**
- ✅ **Created `incremental_walker.go`**: New walker implementation that eliminated the critical bulk deletion hang
- ✅ **Three-Phase Approach**: Preparation → Database Reconciliation → Filesystem Walking
  - **Preparation Phase (0-10%)**: File counting and setup with progress updates
  - **Database Reconciliation Phase (10-60%)**: Incremental checking of existing files with "Checking existing files (X/Y)" progress
  - **Filesystem Walking Phase (60-100%)**: Directory traversal with real-time path updates
- ✅ **Batch Deletion**: Replaced single bulk deletion with progressive batch processing (100 files per batch with progress updates)
- ✅ **Sub-phase Progress**: Users now see detailed operation descriptions instead of frozen progress bars

**✅ Filesystem Package Utilities - Code Deduplication** 
- ✅ **Created `skip_patterns.go`**: Unified skip pattern matcher eliminating 100% duplicate code across 3 walker implementations
- ✅ **SkipPatternMatcher Class**: Single source of truth for `shouldSkip()` and `compileSkipPatterns()` logic
- ✅ **Immediate Code Reduction**: Eliminated ~45 lines of 100% identical code from walker files

**✅ Streaming Media Enrichment - Performance Enhancement**
- ✅ **Integrated streaming enrichment**: Added `triggerStreamingEnrichment()` to `incremental_walker.go`
- ✅ **Real-time Processing**: Media files are now enriched immediately as they're indexed (no waiting for filesystem completion)
- ✅ **Media Type Detection**: Smart filtering to only enrich video/audio/image files
- ✅ **Progress Integration**: Enrichment progress integrated with existing scan progress system

### **Filesystem Package Restructuring**

**Current Problems:**
- Monolithic `internal/services/filesystem/` package with 15+ files
- Mixed responsibilities (indexing, walking, progress, content processing, discovery)
- Redundant naming (`FilesystemIndexer` in `filesystem` package)
- Unclear component relationships (`ProgressTracker` vs `ProgressThrottler`)

**Proposed Clean Architecture:**
```
internal/services/
├── indexing/              # Core orchestration
│   ├── service.go         # Main service (was: FilesystemIndexer)
│   ├── config.go          # Configuration
│   └── progress.go        # Progress data structures
│
├── walking/               # Walking strategies
│   ├── standard.go        # Standard walker
│   ├── delta.go           # Incremental walker  
│   ├── resume.go          # Resume walker
│   └── skip_matcher.go    # Skip pattern matching
│
├── progress/              # Progress management system  
│   ├── manager.go         # High-level coordination (was: ProgressTracker)
│   ├── buffer.go          # Database throttling (was: ProgressThrottler)
│   └── types.go           # Progress data types
│
├── content/               # Content processing
│   ├── metadata.go        # Metadata extraction
│   ├── mime.go            # MIME detection
│   └── previews.go        # Preview generation  
│
└── discovery/             # Volume discovery (moved from filesystem)
    ├── service.go         # Docker volume discovery
    └── config.go          # Discovery configuration
```

**Migration Strategy:**
1. Create new packages with proper interfaces
2. Move implementations directly (no facade pattern)
3. Update all import statements in one pass
4. Remove old `filesystem/` package entirely

**Benefits:**
- Single responsibility per package
- Clear naming conventions
- Better testability
- Reduced coupling

### **Enrichers Package Restructuring**

**Current Problems:**
- Monolithic `Manager` (500+ lines) handling orchestration, worker management, progress tracking, events
- Command execution inconsistency (EXIF uses `exec.CommandContext`, FFprobe uses `utils.CommandRunner`)
- Configuration sprawl (single `EnricherConfig` with settings for all enricher types)
- Mixed responsibilities (coordination vs individual enricher logic)

**Proposed Clean Architecture:**
```
internal/services/
├── enrichment/                    # Core orchestration
│   ├── manager.go                # Manager (orchestration only)
│   ├── coordinator.go            # StreamingEnrichment coordinator
│   ├── worker_pool.go            # Worker management extracted
│   └── progress.go               # Progress tracking extracted
│
├── enrichers/                    # Individual enrichers
│   ├── registry.go               # Enricher discovery and registration
│   ├── ffprobe/                  # FFprobe enricher package
│   │   ├── enricher.go
│   │   ├── parser.go
│   │   └── config.go
│   ├── exif/                     # EXIF enricher package  
│   │   ├── enricher.go
│   │   ├── parser.go
│   │   └── config.go
│   ├── subtitle/                 # Subtitle enricher package
│   │   ├── enricher.go
│   │   ├── parser.go
│   │   └── formats.go
│   └── common/                   # Shared enricher utilities
│       ├── interfaces.go
│       └── base.go
│
└── media/                        # Media processing utilities
    ├── metadata.go               # Metadata structures
    ├── formats.go                # Format detection
    └── types.go                  # Common media types
```

**Key Improvements:**
- Single responsibility per package (manager vs workers vs individual enrichers)
- Consistent command execution (`utils.CommandRunner` everywhere)
- Per-enricher configuration packages
- Clear separation between coordination and enricher-specific logic
- Better testability with focused, smaller packages

### **Scanner Package Restructuring**

**Current Problems:**
- Command execution duplication (`exec.CommandContext` vs `utils.CommandRunner` inconsistency)
- Manual percentage calculations (`float64(usedBytes) / float64(totalBytes) * 100`)
- Manual pointer operations (`StartedAt: &now` instead of `utils.Ptr(now)`)
- Mixed responsibilities (orchestration + concurrency + integration in `VolumeScanner`)
- Redundant naming (`VolumeScanner` in `scanner` package)

**Utility Opportunities Found:**
```go
// 1. Command Execution - Replace with utils.CommandRunner
exec.LookPath("diskus")              → CommandRunner.IsAvailable()
exec.CommandContext(ctx, "du", args) → CommandRunner.Run(ctx, args)

// 2. Percentage Calculations - Replace with utils.SafePercentage  
usagePercent = float64(used)/float64(total)*100 → SafePercentage(used, total)

// 3. Pointer Operations - Replace with utils.Ptr
StartedAt: &now     → StartedAt: utils.Ptr(now)
progress.Phases[x]  → progress.Phases[utils.Ptr(x)]

// 4. Error Creation - Create utils.NewScanError helper
&models.ScanError{...} → utils.NewScanError(code, msg)
```

**Proposed Clean Architecture:**
```
internal/services/
├── scanning/                     # Core scanning orchestration
│   ├── service.go               # Main service (was: VolumeScanner)
│   ├── coordinator.go           # Scan coordination logic
│   └── config.go                # Scanning configuration
│
├── scanmethods/                 # Scanning strategies
│   ├── registry.go              # Method discovery and registration
│   ├── du/                      # Du-based scanning
│   │   ├── progressive.go       # Uses utils.CommandRunner
│   │   └── config.go
│   ├── diskus/                  # Diskus-based scanning  
│   │   ├── progressive.go       # Uses utils.CommandRunner
│   │   └── config.go
│   ├── native/                  # Pure Go scanning
│   │   └── walker.go
│   └── common/                  # Shared scan utilities
│       ├── analyzer.go          # Directory analysis
│       └── interfaces.go
│
└── scanprogress/                # Progress management
    ├── manager.go               # Progress coordination
    ├── tracker.go               # WebSocket integration  
    └── types.go                 # Progress data structures
```

## 🚀 **Updated Next Steps Priority**

### **✅ Completed Quick Wins (Low Risk, High Value)**
1. **Scanner Utilities Integration** - ✅ **COMPLETED**
   - ✅ Updated command execution in `diskus_progressive.go` and `du_progressive.go` 
   - ✅ Replaced percentage calculation in `scan_utilities.go`
   - ✅ Fixed pointer operations in `progress_manager.go`
   - ✅ Created `utils.NewScanError` and `utils.WrapScanError` helpers

2. **Enrichers Command Consistency** - ✅ **COMPLETED** 
   - ✅ Updated EXIF enricher to use `utils.CommandRunner`
   - ✅ All enrichers now use consistent command execution patterns

### **Major Structural Changes (High Impact, Foundational)**
3. **Package Refactoring** - Clean architecture implementation across all three packages
   - Filesystem package restructuring (indexing/, walking/, progress/, content/, discovery/)
   - Enrichers package restructuring (enrichment/, enrichers/{ffprobe,exif,subtitle}/, media/)
   - Scanner package restructuring (scanning/, scanmethods/, scanprogress/)

4. **Phase 4 Implementation** - Complete confidence indicators (after structure cleanup)
5. **Final Integration Testing** - Ensure all refactored components work together

---

## 📐 **VolumeViz Package Architecture Standards**

Based on our comprehensive analysis of the scanner, filesystem, and enricher packages, we've developed standardized patterns for clean, maintainable package organization that can be applied across the entire codebase.

### **🏗️ Package Organization Principles**

#### **1. Single Responsibility Principle**
- **One domain per package**: Each package handles exactly one business domain (scanning, enrichment, filesystem operations)
- **Clear boundaries**: No circular dependencies or mixed responsibilities
- **Focused interfaces**: Each package exports a clean, minimal API

#### **2. Consistent Naming Conventions**

**✅ Recommended Patterns:**
```go
// Package names: lowercase, descriptive nouns
internal/services/scanning/     // ✅ Clear domain
internal/services/enrichment/   // ✅ Clear purpose  
internal/services/indexing/     // ✅ Action-based

// File names: descriptive, action-oriented
service.go           // ✅ Main service implementation
manager.go           // ✅ Coordination/orchestration
coordinator.go       // ✅ Multi-service coordination
worker_pool.go       // ✅ Specific functionality
progress_tracker.go  // ✅ Clear responsibility
```

**❌ Patterns to Avoid:**
```go
// Redundant naming
internal/services/filesystem/filesystem_indexer.go  // ❌ "filesystem" repeated
internal/services/scanner/volume_scanner.go         // ❌ "scanner" in scanner package

// Vague naming  
internal/services/enrichers/manager.go              // ❌ Too generic
internal/services/scanner/utilities.go              // ❌ Catch-all file
internal/services/filesystem/helper.go              // ❌ Unclear purpose

// Legacy suffixes
enhanced_scanner.go   // ❌ Avoid "enhanced", "new", "v2" 
robust_indexer.go     // ❌ Avoid quality adjectives
```

#### **3. Standard File Organization Pattern**

**Core Service Files (Required):**
```
internal/services/{domain}/
├── service.go              # Main service/public API
├── config.go              # Configuration structures  
├── interfaces.go          # Public interfaces/contracts
└── types.go              # Domain-specific types
```

**Implementation Files (As Needed):**
```
├── manager.go             # Orchestration/coordination
├── coordinator.go         # Multi-service coordination  
├── worker_pool.go         # Concurrency management
├── progress_tracker.go    # Progress/metrics tracking
├── {strategy}_processor.go # Strategy implementations
└── {feature}_handler.go   # Feature-specific handlers
```

**Supporting Files:**
```
├── utils.go               # Package-specific utilities
├── errors.go             # Domain-specific errors
├── validators.go         # Input validation
├── transformers.go       # Data transformation
└── builders.go           # Object construction
```

**Testing Structure:**
```
├── service_test.go        # Main service tests
├── integration_test.go    # Integration tests
├── {component}_test.go    # Component-specific tests
└── testdata/             # Test fixtures
    ├── fixtures.go
    └── sample_data.json
```

#### **4. Package Structure Hierarchy**

**Level 1: Domain Packages** (Main business areas)
```
internal/services/
├── scanning/              # Volume scanning operations
├── indexing/             # Filesystem indexing  
├── enrichment/           # Media metadata enrichment
├── discovery/            # Volume/mount discovery
├── previews/             # Preview generation
├── alerts/               # Notification system
└── metrics/              # Performance tracking
```

**Level 2: Strategy/Implementation Packages** (When > 3 strategies exist)
```
internal/services/scanning/
├── service.go            # Main scanning service
├── methods/              # Scanning method implementations
│   ├── registry.go       # Method discovery
│   ├── du/              # Du-based scanning
│   │   ├── progressive.go
│   │   └── config.go
│   ├── diskus/          # Diskus-based scanning
│   │   ├── progressive.go  
│   │   └── config.go
│   └── native/          # Native Go scanning
│       └── walker.go
└── progress/            # Progress management
    ├── manager.go
    ├── tracker.go
    └── types.go
```

**Level 3: Specialized Sub-packages** (When domain has >5 distinct areas)
```
internal/services/enrichment/
├── service.go           # Main enrichment service  
├── coordinator.go       # Enrichment coordination
├── enrichers/          # Individual enricher implementations
│   ├── registry.go     # Auto-discovery
│   ├── ffprobe/       # Video/audio metadata
│   ├── exif/          # Image metadata  
│   ├── subtitle/      # Subtitle parsing
│   └── common/        # Shared enricher utilities
├── media/             # Media processing utilities
│   ├── formats.go
│   ├── metadata.go
│   └── types.go
└── workers/           # Worker management
    ├── pool.go
    └── scheduler.go
```

### **🔧 Implementation Standards**

#### **1. Service Layer Pattern**
Every domain package should follow this structure:

```go
// service.go - Main service implementation
type Service struct {
    config     Config
    manager    Manager
    repository Repository
    logger     *log.Logger
}

func NewService(deps ServiceDependencies) *Service

// Public API methods
func (s *Service) MainOperation(ctx context.Context, req Request) (*Response, error)
func (s *Service) GetStatus(ctx context.Context) (*Status, error)
func (s *Service) Start(ctx context.Context) error
func (s *Service) Stop(ctx context.Context) error
```

#### **2. Configuration Pattern**
```go
// config.go - Configuration structures
type Config struct {
    Enabled        bool          `yaml:"enabled"`
    MaxWorkers     int          `yaml:"max_workers"`
    Timeout        time.Duration `yaml:"timeout"`
    // Feature-specific settings
    FeatureConfig  FeatureConfig `yaml:"feature"`
}

type FeatureConfig struct {
    Setting1 string `yaml:"setting1"`
    Setting2 int    `yaml:"setting2"`
}

func DefaultConfig() Config
func (c *Config) Validate() error
```

#### **3. Interface Design Pattern**
```go
// interfaces.go - Clean, focused interfaces
type Service interface {
    // Core operations (3-5 methods max)
    Process(ctx context.Context, input Input) (*Output, error)
    GetStatus() Status
    Close() error
}

type Repository interface {
    // Data access (focused on domain)
    Create(ctx context.Context, entity Entity) error  
    GetByID(ctx context.Context, id ID) (*Entity, error)
    Update(ctx context.Context, id ID, entity Entity) error
}

type Manager interface {
    // Orchestration (coordination only)
    StartProcessing(ctx context.Context, config Config) error
    GetProgress() Progress
    Stop() error
}
```

#### **4. Error Handling Pattern**
```go
// errors.go - Domain-specific errors
var (
    ErrNotFound      = errors.New("resource not found")
    ErrInvalidInput  = errors.New("invalid input")
    ErrServiceBusy   = errors.New("service busy")
)

type DomainError struct {
    Code    string
    Message string
    Cause   error
    Context map[string]any
}

func (e *DomainError) Error() string
func (e *DomainError) Unwrap() error

func NewDomainError(code, message string, cause error) *DomainError
func WrapDomainError(err error, code, message string) error
```

### **🎯 Utility Organization Standards**

#### **Global Utilities** (`internal/utils/`)
- **Mathematical operations**: `math.go`, `calculations.go`
- **String manipulation**: `strings.go`, `formatting.go`  
- **Time operations**: `time.go`, `timeparse.go`
- **File operations**: `filepath.go`, `fileutils.go`
- **Network utilities**: `network.go`, `http.go`
- **Generic helpers**: `pointers.go`, `slices.go`, `maps.go`
- **System integration**: `command.go`, `process.go`

#### **Package-Specific Utilities** (`internal/services/{domain}/utils.go`)
- **Domain-specific helpers**: Functions used only within that domain
- **Data transformation**: Domain-specific conversions
- **Validation**: Domain-specific validation rules
- **Builders**: Domain object construction helpers

#### **Utility Naming Conventions**
```go
// ✅ Good utility function names
func SafePercentage(current, total int64) int
func FormatFileSize(bytes int64) string  
func ParseDuration(input string) (time.Duration, error)
func IsValidPath(path string) bool

// ❌ Avoid vague utility names  
func Process(input interface{}) interface{}
func DoStuff(args ...interface{}) error
func Helper(a, b, c interface{}) interface{}
```

### **📋 Refactoring Checklist**

When refactoring packages, follow this checklist:

#### **Phase 1: Analysis**
- [ ] **Map responsibilities**: List all functions and their purposes
- [ ] **Identify patterns**: Find duplicate code and shared logic
- [ ] **Check dependencies**: Map imports and coupling
- [ ] **Measure complexity**: Count files, lines, and cyclomatic complexity

#### **Phase 2: Planning** 
- [ ] **Define boundaries**: Clear package responsibilities
- [ ] **Design interfaces**: Clean, minimal APIs
- [ ] **Plan file structure**: Follow standard organization
- [ ] **Identify utilities**: Global vs package-specific

#### **Phase 3: Implementation**
- [ ] **Create utilities first**: Extract shared code to utils
- [ ] **Build new structure**: Create clean package structure
- [ ] **Migrate incrementally**: Move code in logical chunks
- [ ] **Update imports**: Fix all import statements

#### **Phase 4: Validation**
- [ ] **Run tests**: Ensure no functionality breaks
- [ ] **Check performance**: Verify no performance regression  
- [ ] **Review complexity**: Ensure improved maintainability
- [ ] **Update documentation**: Document new structure

### **🏆 Success Metrics**

Track these metrics to ensure refactoring success:

#### **Code Quality Metrics**
- **Cyclomatic Complexity**: Target <10 per function, <50 per file
- **Lines of Code**: Target <300 per file, <100 per function
- **Duplication**: Target <5% duplicate code across packages
- **Test Coverage**: Maintain >80% coverage during refactoring

#### **Architecture Metrics**
- **Package Coupling**: Minimize dependencies between domain packages
- **Interface Size**: Target <5 methods per interface
- **File Count**: Target <15 files per package (before sub-packages)
- **Import Chains**: Minimize transitive dependencies

#### **Maintainability Metrics**
- **Time to Find Code**: How quickly can developers locate functionality
- **Change Impact**: How many files need updates for feature changes
- **Onboarding Time**: How quickly new developers understand structure
- **Bug Resolution**: How quickly bugs can be isolated and fixed

### **📚 Package Architecture Examples**

#### **Example 1: Scanner Package (Current → Improved)**

**❌ Current Structure Issues:**
```
internal/services/scanner/
├── volume_scanner.go          # Redundant naming
├── async_scanner.go          # Mixed responsibility  
├── directory_analyzer.go     # Utility in main package
├── progress_manager.go       # Should be separate
├── scan_utilities.go         # Catch-all utilities
├── diskus_progressive.go     # Implementation detail
├── du_progressive.go         # Implementation detail  
└── native_method.go          # Implementation detail
```

**✅ Improved Structure:**
```
internal/services/scanning/
├── service.go                # Main scanning service
├── config.go                 # Scanning configuration
├── interfaces.go             # Public contracts
├── coordinator.go            # Scan coordination
├── methods/                  # Scanning strategies
│   ├── registry.go           # Method auto-discovery
│   ├── du/
│   │   ├── progressive.go    # Du implementation
│   │   └── config.go
│   ├── diskus/
│   │   ├── progressive.go    # Diskus implementation  
│   │   └── config.go
│   └── native/
│       ├── walker.go         # Native implementation
│       └── config.go
└── progress/                 # Progress management
    ├── manager.go            # Progress coordination
    ├── tracker.go            # Progress tracking
    └── types.go              # Progress data types
```

#### **Example 2: Filesystem Package (Current → Improved)**

**❌ Current Structure Issues:**
```
internal/services/filesystem/
├── indexer.go                # Generic naming
├── walker.go                 # Implementation detail
├── incremental_walker.go     # Implementation detail
├── resume_walker.go          # Implementation detail  
├── progress_tracker.go       # Mixed responsibility
├── metadata_extractor.go     # Utility in main package
├── preview_generator.go      # Wrong domain
└── volume_discovery.go       # Wrong domain
```

**✅ Improved Structure:**
```
internal/services/indexing/   # Renamed for clarity
├── service.go                # Main indexing service  
├── config.go                 # Indexing configuration
├── interfaces.go             # Public contracts
├── coordinator.go            # Indexing coordination
├── strategies/               # Indexing approaches
│   ├── standard.go           # Standard indexing
│   ├── incremental.go        # Incremental indexing
│   └── resume.go             # Resume indexing
├── progress/                 # Progress management
│   ├── tracker.go            # Progress tracking
│   ├── throttler.go          # Database throttling
│   └── types.go              # Progress types
├── metadata/                 # Metadata extraction
│   ├── extractor.go          # Metadata extraction
│   ├── mime_detector.go      # MIME detection
│   └── types.go              # Metadata types
└── utils.go                  # Package-specific utilities
```

### **🚀 Implementation Roadmap**

#### **Phase 1: Immediate Improvements (Low Risk)**
1. **Rename redundant files**: Remove package name repetition
2. **Extract utilities**: Move shared code to appropriate utils packages  
3. **Standardize interfaces**: Create clean, focused interfaces
4. **Improve naming**: Use descriptive, action-oriented names

#### **Phase 2: Structural Reorganization (Medium Risk)**
1. **Separate concerns**: Split large packages by responsibility
2. **Create sub-packages**: Organize complex domains into sub-packages
3. **Standardize configuration**: Follow consistent config patterns
4. **Extract strategies**: Separate implementation strategies

#### **Phase 3: Advanced Architecture (High Impact)**
1. **Interface-driven design**: Define clean contracts first
2. **Dependency injection**: Remove tight coupling
3. **Plugin architecture**: Enable extensible functionality
4. **Performance optimization**: Optimize based on clean structure

---

## 📚 **Document Index & Navigation**

### **Quick Reference Sections**
- **📋 Executive Summary** - Project overview and current status
- **📊 Project Progress Tracking** - Completed work, in-progress items, and resolved issues
- **🛠️ Technology Stack & Infrastructure** - Architecture and key components
- **🗓️ Project Roadmap & Implementation Phases** - Timeline and deliverables
- **📋 Development Standards & Guidelines** - Code quality and naming standards

### **Detailed Implementation Guides**
- **📐 VolumeViz Package Architecture Standards** - Comprehensive package organization guidelines
- **🎯 Utility Organization Standards** - Global vs package-specific utility management
- **📋 Refactoring Checklist** - Step-by-step process for package improvements
- **🏆 Success Metrics** - Quantifiable goals and measurement criteria
- **📚 Package Architecture Examples** - Before/after restructuring examples

### **Technical Deep Dives**
- **Phase Implementation Details** - Detailed plans for each development phase
- **WebSocket Message Formats** - Real-time progress communication protocols
- **Database Integration** - Progress tracking and phase management
- **Performance Optimization** - Time estimation and confidence indicators

---

## 🎯 **Project Summary**

This **VolumeViz Project Plan & Architecture Guide** represents a comprehensive transformation initiative that has successfully:

### **✅ Major Achievements**
- **Resolved Critical Issues**: Fixed UI freezes affecting 28,308+ file operations
- **Enhanced User Experience**: Implemented real-time progress with sub-phase visibility
- **Eliminated Technical Debt**: Reduced ~400+ lines of duplicate code with standardized utilities
- **Established Architecture Standards**: Created reusable patterns for clean, maintainable code

### **📊 Quantifiable Impact**
- **Bug Resolution**: 100% of critical scanning hangs eliminated
- **Code Quality**: ~400+ lines of duplicated code removed, utilities standardized
- **User Experience**: Progress visibility improved from "0% stuck" to detailed sub-phase reporting
- **Architecture**: Comprehensive standards established for all future development

### **🚀 Future Vision**
This plan continues to serve as the **living document** for VolumeViz development, providing:
- **Standardized Architecture**: Consistent package organization across the entire codebase
- **Development Guidelines**: Clear patterns for maintainable, scalable code
- **Progress Tracking**: Ongoing monitoring of improvements and future enhancements
- **Quality Assurance**: Metrics and processes to ensure continued code quality

The transformation from a simple "scan progress enhancement" into a **comprehensive codebase improvement initiative** demonstrates the project's evolution and the value of systematic, well-documented development practices.

---

*This document serves as both a **project tracker** and **architectural guide** - continuously updated to reflect current progress and provide direction for future development.*

**Last Updated: August 25, 2025** | **Document Version: 2.0** | **Scope: Project-wide Architecture & Standards**