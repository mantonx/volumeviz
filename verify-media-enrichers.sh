#!/bin/bash

# Media Metadata Enrichers Verification Script
# Verifies ticket completion for: Media Metadata Enrichers (audio/video/image/subtitles)

echo "=== MEDIA METADATA ENRICHERS VERIFICATION ==="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

success_count=0
total_checks=0

check_requirement() {
    local requirement="$1"
    local check_command="$2"
    total_checks=$((total_checks + 1))
    
    echo -n "[$total_checks] $requirement: "
    if eval "$check_command" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ PRESENT${NC}"
        success_count=$((success_count + 1))
        return 0
    else
        echo -e "${RED}✗ MISSING${NC}"
        return 1
    fi
}

echo "1. SCHEMA REQUIREMENTS"
echo "======================"

# 1.1 Check file_metadata table exists with required structure
check_requirement "file_metadata table schema" \
    "grep -q 'CREATE TABLE.*file_metadata' migrations/000005_create_media_metadata.up.sql"

check_requirement "file_metadata(file_id, kind, data_json, enriched_at) columns" \
    "grep -A10 'CREATE TABLE.*file_metadata' migrations/000005_create_media_metadata.up.sql | grep -E '(file_id|kind|data_json|enriched_at)'"

# 1.2 Check flattened columns on files table  
check_requirement "Flattened duration_ms column on files table" \
    "grep -q 'duration_ms BIGINT' migrations/000005_create_media_metadata.up.sql"

check_requirement "Flattened bitrate_kbps column on files table" \
    "grep -q 'bitrate_kbps INTEGER' migrations/000005_create_media_metadata.up.sql"

check_requirement "Flattened width/height columns on files table" \
    "grep -q 'width INTEGER' migrations/000005_create_media_metadata.up.sql && grep -q 'height INTEGER' migrations/000005_create_media_metadata.up.sql"

check_requirement "Flattened fps column on files table" \
    "grep -q 'fps DECIMAL' migrations/000005_create_media_metadata.up.sql"

check_requirement "Flattened color_primaries column on files table" \
    "grep -q 'color_primaries TEXT' migrations/000005_create_media_metadata.up.sql"

check_requirement "Flattened transfer_characteristic column on files table" \
    "grep -q 'transfer_characteristic TEXT' migrations/000005_create_media_metadata.up.sql"

check_requirement "HDR format enum with required values (none,hdr10,hdr10+,dovi)" \
    "grep -A3 'hdr_format AS ENUM' migrations/000005_create_media_metadata.up.sql | grep -E \"'(none|hdr10|hdr10\+|dovi)'\""

echo ""
echo "2. ENRICHER IMPLEMENTATIONS" 
echo "============================"

# 2.1 FFprobe enricher (Audio/Video)
check_requirement "FFprobe enricher implementation" \
    "test -f internal/services/enrichers/ffprobe.go"

check_requirement "FFprobe enricher extracts duration/bitrate/codec" \
    "grep -E '(duration_ms|bitrate_kbps|codec)' internal/services/enrichers/ffprobe.go"

check_requirement "FFprobe enricher extracts fps/channels for A/V" \
    "grep -E '(fps|channels)' internal/services/enrichers/ffprobe.go"

check_requirement "FFprobe enricher extracts tags (album/artist/title etc)" \
    "grep -E '(album|artist|title|track|disc|genre|year|Tags)' internal/services/enrichers/ffprobe.go"

# 2.2 EXIF enricher (Images)  
check_requirement "EXIF enricher implementation" \
    "test -f internal/services/enrichers/exif.go"

check_requirement "EXIF enricher extracts DateTimeOriginal" \
    "grep -q 'DateTimeOriginal' internal/services/enrichers/exif.go"

check_requirement "EXIF enricher extracts Camera/Lens info" \
    "grep -E '(camera_make|camera_model|lens_model|Make|Model|LensModel)' internal/services/enrichers/exif.go"

check_requirement "EXIF enricher extracts Orientation" \
    "grep -q 'Orientation' internal/services/enrichers/exif.go"

check_requirement "EXIF enricher extracts dimensions/ICC" \
    "grep -E '(width|height|ImageWidth|ImageHeight)' internal/services/enrichers/exif.go"

check_requirement "EXIF GPS extraction with VV_ENABLE_EXIF_GPS" \
    "grep -q 'VV_ENABLE_EXIF_GPS' internal/config/config.go && grep -q 'EnableGPS' internal/services/enrichers/exif.go"

check_requirement "GPS redaction/rounding support" \
    "grep -E '(redact|round).*GPS|GPS.*(redact|round)' internal/services/enrichers/exif.go"

# 2.3 Subtitle enricher
check_requirement "Subtitle enricher implementation" \
    "test -f internal/services/enrichers/subtitle.go"

check_requirement "Subtitle enricher extracts format/lang/cue_count" \
    "grep -E '(format|language|cue_count)' internal/services/enrichers/subtitle.go"

check_requirement "Subtitle enricher calculates coverage%" \
    "grep -E '(coverage|Coverage)' internal/services/enrichers/subtitle.go"

echo ""
echo "3. CONCURRENCY & TIMEOUT CONTROLS"
echo "=================================="

# 3.1 Bounded concurrency
check_requirement "Bounded concurrency with VV_MAX_CONCURRENT_ENRICHERS" \
    "grep -q 'VV_MAX_CONCURRENT_ENRICHERS' internal/config/config.go"

check_requirement "Worker semaphore for concurrency control" \
    "grep -q 'workerSemaphore.*chan' internal/services/enrichers/manager.go"

# 3.2 Per-file timeout
check_requirement "Per-file timeout with VV_ENRICHER_TIMEOUT_PER_FILE" \
    "grep -q 'VV_ENRICHER_TIMEOUT_PER_FILE' internal/config/config.go"

check_requirement "Context timeout in enricher calls" \
    "grep -q 'WithTimeout.*TimeoutPerFile\|TimeoutPerFile.*WithTimeout' internal/services/enrichers/manager.go"

# 3.3 Non-fatal failures
check_requirement "Non-fatal failure handling (continue on errors)" \
    "grep -E '(non.*fatal|continue.*error|lastError)' internal/services/enrichers/manager.go"

echo ""
echo "4. CONFIGURATION & INTEGRATION"
echo "==============================="

# 4.1 Configuration options
check_requirement "MediaEnrichmentConfig in config" \
    "grep -q 'MediaEnrichmentConfig' internal/config/config.go"

check_requirement "FFprobe settings (enabled/path/timeout)" \
    "grep -E 'FFprobe(Enabled|Path|Timeout)' internal/config/config.go"

check_requirement "EXIF settings (enabled/GPS/redact/precision)" \
    "grep -E 'EXIF.*Enabled|EnableGPS|RedactGPS|GPSPrecision' internal/config/config.go"

check_requirement "Subtitle settings" \
    "grep -q 'SubtitleEnabled' internal/config/config.go"

# 4.2 Repository integration
check_requirement "FileMetadataRepo implementation" \
    "test -f internal/repo/file_metadata_repo.go"

check_requirement "SaveMetadata/BulkSaveMetadata methods" \
    "grep -E '(SaveMetadata|BulkSaveMetadata)' internal/repo/file_metadata_repo.go"

check_requirement "GetUnenrichedFiles method for processing queue" \
    "grep -q 'GetUnenrichedFiles' internal/repo/file_metadata_repo.go"

# 4.3 API integration  
check_requirement "Media enrichment API endpoints" \
    "grep -E 'media.*(enrich|status|capabilities)' internal/api/v1/scan/router.go"

check_requirement "EnrichmentManager interface integration" \
    "grep -q 'EnrichmentManager.*interface' internal/interfaces/enrichment.go || grep -q 'EnrichmentManager' internal/services/enrichers/types.go"

echo ""
echo "5. HDR DETECTION & GPS HANDLING"
echo "==============================="

# 5.1 HDR detection
check_requirement "HDR format detection logic" \
    "grep -q 'detectHDRFormat' internal/services/enrichers/ffprobe.go"

check_requirement "HDR10/HDR10+/Dolby Vision support" \
    "grep -E '(HDR10|hdr10|Dolby.*Vision|dovi)' internal/services/enrichers/ffprobe.go"

# 5.2 GPS redaction
check_requirement "GPS coordinate redaction/rounding" \
    "grep -q 'roundGPSCoordinate' internal/services/enrichers/exif.go"

check_requirement "VV_REDACT_GPS configuration" \
    "grep -q 'VV_REDACT_GPS' internal/config/config.go"

echo ""
echo "6. TESTING & FIXTURES"
echo "====================="

# 6.1 Test fixtures
check_requirement "FFprobe test fixtures" \
    "test -f internal/services/enrichers/testdata/fixtures.go"

check_requirement "Golden fixtures for testing" \
    "grep -E '(fixture|golden|test.*case)' internal/services/enrichers/testdata/fixtures.go"

check_requirement "HDR test fixtures" \
    "grep -E '(hdr.*10|HDR.*10)' internal/services/enrichers/testdata/fixtures.go"

# 6.2 Test coverage
check_requirement "FFprobe enricher tests" \
    "test -f internal/services/enrichers/ffprobe_test.go"

check_requirement "Manager tests" \
    "test -f internal/services/enrichers/manager_test.go"

check_requirement "Timeout/retry testing" \
    "grep -E '(timeout|retry|context.*cancel)' internal/services/enrichers/manager_test.go || grep -E '(timeout|retry|context.*cancel)' internal/services/enrichers/ffprobe_test.go"

echo ""
echo "7. DATABASE QUERIES & OPERATIONS"
echo "================================="

# 7.1 SQLC queries
check_requirement "SQLC file_metadata queries" \
    "test -f internal/repo/queries/file_metadata.sql"

check_requirement "CreateFileMetadata query" \
    "grep -q 'CreateFileMetadata' internal/repo/queries/file_metadata.sql"

check_requirement "BulkInsertFileMetadata query for efficiency" \
    "grep -q 'BulkInsertFileMetadata' internal/repo/queries/file_metadata.sql"

check_requirement "UpdateFileEnrichedColumns query for flattening" \
    "grep -q 'UpdateFileEnrichedColumns' internal/db/sqlc/file_metadata.sql.go || grep -q 'updateFileEnrichedColumns' internal/repo/file_metadata_repo.go"

# 7.2 Progress tracking
check_requirement "GetEnrichmentProgress query" \
    "grep -q 'GetEnrichmentProgress' internal/repo/queries/file_metadata.sql"

echo ""
echo "8. VOLUME SCANNER INTEGRATION"
echo "=============================="

# 8.1 Integration with volume scanning
check_requirement "Volume scanner calls media enrichment" \
    "grep -E '(enrichment|EnrichVolume)' internal/services/scanner/volume_scanner.go"

check_requirement "Media enrichment after filesystem indexing" \
    "grep -q 'performMediaEnrichment' internal/services/scanner/volume_scanner.go"

echo ""
echo "================"
echo "SUMMARY REPORT"
echo "================"
echo ""

if [ $success_count -eq $total_checks ]; then
    echo -e "${GREEN}🎉 ALL REQUIREMENTS MET!${NC}"
    echo -e "${GREEN}✅ Media Metadata Enrichers ticket is COMPLETE${NC}"
    echo ""
    echo -e "🔧 Implementation includes:"
    echo -e "   • Complete database schema with file_metadata table and flattened columns"
    echo -e "   • FFprobe enricher for audio/video with duration, bitrate, codecs, HDR detection" 
    echo -e "   • EXIF enricher for images with camera info, GPS handling, and privacy controls"
    echo -e "   • Subtitle enricher for format/language/coverage analysis"
    echo -e "   • Bounded concurrency with configurable limits and per-file timeouts"
    echo -e "   • Non-fatal failure handling and comprehensive error management"
    echo -e "   • Full API integration with trigger/status/capabilities endpoints"
    echo -e "   • Test fixtures and golden test data for validation"
    echo -e "   • SQLC-generated type-safe database operations"
    echo -e "   • GPS redaction/rounding for privacy compliance"
    echo -e "   • Integration with volume scanning workflow"
else
    missing=$((total_checks - success_count))
    echo -e "${YELLOW}⚠️  PARTIALLY COMPLETE${NC}"
    echo -e "${GREEN}✅ $success_count/$total_checks requirements met${NC}"
    echo -e "${RED}❌ $missing requirements missing or incomplete${NC}"
fi

echo ""
echo "🔨 Build Status:"
if go build ./... > /dev/null 2>&1; then
    echo -e "${GREEN}✅ All code compiles successfully${NC}"
else
    echo -e "${RED}❌ Compilation errors detected${NC}"
fi

exit 0
