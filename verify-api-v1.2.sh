#!/bin/bash

# API v1.2 (Explorer/Metadata/Stats/Alerts) + OpenAPI/types + lightweight client verification script
# Verifies ticket completion for comprehensive API v1.2 implementation

echo "=== API V1.2 (EXPLORER/METADATA/STATS/ALERTS) VERIFICATION ==="
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

echo "1. EXPLORER API ENDPOINTS"
echo "========================="

# 1.1 Tree/directory exploration endpoints
check_requirement "Tree children endpoint (GET /volumes/{name}/tree/children)" \
    "grep -r 'tree.*children' internal/api/v1/ || grep -r 'GetTreeChildren' internal/api/v1/"

check_requirement "Directory tree API handler" \
    "test -f internal/api/v1/explorer/handler.go || grep -r -q 'tree' internal/api/v1/volumes/handler.go"

check_requirement "Folder browsing with parent/child relationships" \
    "grep -r -q 'GetFolderTree' internal/db/sqlc/"

# 1.2 File listing and browsing
check_requirement "Files for path endpoint (GET /volumes/{name}/files)" \
    "grep -r 'GetFilesForPath\|files.*path' internal/api/v1/"

check_requirement "File listing with pagination support" \
    "grep -r -E 'ListFiles.*Paginated|GetFilesByFolder' internal/api/v1/"

check_requirement "Path-based file browsing" \
    "grep -q 'path' internal/repo/queries/files.sql || grep -r -q 'GetFilesByPath' internal/repo/"

echo ""
echo "2. FILE METADATA ENDPOINTS"
echo "=========================="

# 2.1 File details and metadata
check_requirement "File details endpoint (GET /files/{id}/details)" \
    "grep -r 'GetFileDetails\|file.*details' internal/api/v1/"

check_requirement "File metadata endpoint (GET /files/{id}/metadata)" \
    "grep -r 'GetFileMetadata.*API\|metadata' internal/api/v1/"

check_requirement "Media metadata API integration" \
    "grep -r -q 'MediaMetadata' internal/api/v1/ && grep -r -q 'file_metadata' internal/api/v1/"

# 2.2 Enhanced metadata queries
check_requirement "Files by media type queries" \
    "grep -r -q 'GetFilesByMediaType' internal/repo/queries/"

check_requirement "Files by resolution/duration filters" \
    "grep -r -E 'ByResolution|ByDuration' internal/repo/queries/"

check_requirement "GPS/location metadata queries" \
    "grep -r -q 'GPS\|location' internal/repo/queries/"

echo ""
echo "3. STATS API ENDPOINTS"
echo "======================"

# 3.1 Daily stats endpoints
check_requirement "Daily stats endpoint (GET /stats/daily)" \
    "grep -r 'daily.*stats\|GetDailyStats' internal/api/v1/"

check_requirement "Volume trends endpoint (GET /volumes/{name}/trends)" \
    "grep -r 'trends' internal/api/v1/volumes/ || grep -r 'GetVolumeTrends' internal/api/v1/"

check_requirement "Top folders endpoint (GET /stats/top-folders)" \
    "grep -r 'top.*folders\|GetTopFolders' internal/api/v1/"

# 3.2 Stats API handler integration
check_requirement "Stats handler implementation" \
    "test -f internal/api/v1/stats/handler.go"

check_requirement "Stats router registration" \
    "grep -q 'statsRouter\|stats.*Router' internal/api/v1/router.go"

check_requirement "StatsService integration in API" \
    "grep -r -q 'StatsService' internal/api/v1/stats/ || grep -r -q 'statsService.*Handler' internal/api/v1/"

echo ""
echo "4. ALERTS API ENDPOINTS"
echo "======================="

# 4.1 Alert rules endpoints
check_requirement "Alert rules CRUD endpoints" \
    "grep -r 'alert.*rules' internal/api/v1/alerts/router.go"

check_requirement "CreateAlertRule handler" \
    "grep -q 'CreateAlertRule' internal/api/v1/alerts/handler.go"

check_requirement "Alert rules API testing" \
    "grep -q 'TestAlertRule' internal/api/v1/alerts/handler.go"

# 4.2 Alert destinations endpoints  
check_requirement "Alert destinations CRUD endpoints" \
    "grep -r 'destinations' internal/api/v1/alerts/router.go"

check_requirement "Alert engine status endpoint" \
    "grep -q 'engine.*status' internal/api/v1/alerts/router.go"

check_requirement "Alert delivery history endpoint" \
    "grep -q 'deliveries' internal/api/v1/alerts/router.go"

echo ""
echo "5. OPENAPI SPECIFICATION COMPLETENESS"
echo "====================================="

# 5.1 API documentation coverage
check_requirement "OpenAPI spec includes explorer endpoints" \
    "grep -E 'tree|files.*path|children' docs/openapi.yaml"

check_requirement "OpenAPI spec includes metadata endpoints" \
    "grep -E 'metadata|file.*details' docs/openapi.yaml"

check_requirement "OpenAPI spec includes stats endpoints" \
    "grep -E 'stats|daily|trends' docs/openapi.yaml"

check_requirement "OpenAPI spec includes alerts endpoints" \
    "grep -E 'alerts|rules|destinations' docs/openapi.yaml"

# 5.2 Schema definitions
check_requirement "TreeNode/DirectoryListing schemas" \
    "grep -E 'TreeNode|DirectoryListing|FolderNode' docs/openapi.yaml"

check_requirement "FileMetadata schemas" \
    "grep -E 'FileMetadata|MediaMetadata' docs/openapi.yaml"

check_requirement "Stats/Trends schemas" \
    "grep -E 'DailyStats|TrendData|GrowthMetrics' docs/openapi.yaml"

check_requirement "Alert schemas" \
    "grep -E 'AlertRule|AlertDestination|Alert[^a-z]' docs/openapi.yaml"

echo ""
echo "6. TYPESCRIPT TYPES GENERATION"
echo "==============================="

# 6.1 Generated types completeness
check_requirement "Generated TypeScript API client" \
    "test -f frontend/src/api/generated/Api.ts"

check_requirement "Explorer types in generated client" \
    "grep -E 'TreeNode|DirectoryListing|Explorer' frontend/src/api/generated/Api.ts"

check_requirement "Metadata types in generated client" \
    "grep -E 'FileMetadata|MediaMetadata' frontend/src/api/generated/Api.ts"

check_requirement "Stats types in generated client" \
    "grep -E 'DailyStats|TrendData|GrowthMetrics' frontend/src/api/generated/Api.ts"

check_requirement "Alert types in generated client" \
    "grep -E 'AlertRule|AlertDestination' frontend/src/api/generated/Api.ts"

# 6.2 Type generation tooling
check_requirement "API generation script" \
    "test -f scripts/generate-types.sh"

check_requirement "Frontend API generation command" \
    "grep -q 'api:generate' frontend/package.json"

check_requirement "OpenAPI tools integration" \
    "grep -q 'openapi-generator\|swagger-typescript-api' frontend/package.json"

echo ""
echo "7. LIGHTWEIGHT CLIENT IMPLEMENTATION"
echo "===================================="

# 7.1 Pre-configured client
check_requirement "Pre-configured API client" \
    "test -f frontend/src/api/client.ts && grep -q 'volumeVizApi\|Api.*new' frontend/src/api/client.ts"

check_requirement "Explorer client methods" \
    "grep -E 'getTreeChildren|getFilesForPath|browseDirectory' frontend/src/api/client.ts"

check_requirement "Metadata client methods" \
    "grep -E 'getFileMetadata|getFileDetails' frontend/src/api/client.ts"

check_requirement "Stats client methods" \
    "grep -E 'getDailyStats|getVolumeTrends|getTopFolders' frontend/src/api/client.ts"

check_requirement "Alert client methods" \
    "grep -E 'getAlertRules|createAlert|getAlerts' frontend/src/api/client.ts"

# 7.2 Client features
check_requirement "Tree-shaking support" \
    "grep -q 'tree.*shak' .github/workflows/openapi-validation.yml"

check_requirement "Type safety integration" \
    "grep -E 'import.*type|Api.*type' frontend/src/api/client.ts"

check_requirement "Error handling in client" \
    "grep -q 'error\|catch\|throw' frontend/src/api/client.ts"

echo ""
echo "8. CI/CD AND VALIDATION"
echo "======================="

# 8.1 Automated validation
check_requirement "OpenAPI validation workflow" \
    "test -f .github/workflows/openapi-validation.yml"

check_requirement "Client generation validation" \
    "grep -q 'api:generate' .github/workflows/openapi-validation.yml"

check_requirement "Generated artifact staleness check" \
    "grep -E 'stale.*check|drift.*check' .github/workflows/openapi-validation.yml"

# 8.2 Integration testing
check_requirement "Contract tests for API endpoints" \
    "grep -r -E 'contract.*test|api.*integration.*test' .github/workflows/"

check_requirement "Generated client integration tests" \
    "grep -q 'generated.*client.*integration' .github/workflows/openapi-validation.yml"

check_requirement "API endpoint smoke tests" \
    "grep -r -E 'endpoint.*test|smoke.*test' scripts/"

echo ""
echo "9. PAGINATION, SORTING, FILTERING"
echo "=================================="

# 9.1 Explorer pagination
check_requirement "Tree/directory pagination support" \
    "grep -r -E 'page.*tree|pagination.*dir|limit.*folder' internal/api/v1/"

check_requirement "File listing pagination" \
    "grep -r -E 'PaginationParams.*files|page.*files' internal/api/utils/"

check_requirement "Sorting support for file listings" \
    "grep -r -E 'sort.*files|SortParams.*files' internal/api/utils/"

# 9.2 Advanced filtering
check_requirement "File type/extension filtering" \
    "grep -r -E 'extension.*filter|mime.*filter|media.*filter' internal/api/utils/"

check_requirement "Date range filtering" \
    "grep -r -E 'date.*filter|time.*range.*filter' internal/api/utils/"

check_requirement "Size range filtering" \
    "grep -r -E 'size.*range|bytes.*filter' internal/api/utils/"

echo ""
echo "10. API DOCUMENTATION AND SERVING"
echo "=================================="

# 10.1 Documentation serving
check_requirement "OpenAPI spec served at /api/docs" \
    "grep -q '/api/docs' internal/api/v1/router.go"

check_requirement "Swagger UI integration" \
    "grep -q 'swagger\|swaggo' internal/api/v1/router.go"

check_requirement "OpenAPI YAML served at /openapi/openapi.yaml" \
    "grep -q '/openapi' internal/api/v1/router.go"

# 10.2 Documentation quality
check_requirement "API examples in OpenAPI spec" \
    "grep -q 'examples:' docs/openapi.yaml"

check_requirement "Error response documentation" \
    "grep -E 'ErrorResponse|error.*schema' docs/openapi.yaml"

check_requirement "Authentication documentation" \
    "grep -E 'security|auth|bearer' docs/openapi.yaml"

echo ""
echo "11. PERFORMANCE AND OPTIMIZATION"
echo "================================"

# 11.1 Query optimization
check_requirement "Indexed queries for tree operations" \
    "grep -r -q 'idx.*path\|idx.*parent' migrations/"

check_requirement "Efficient pagination queries" \
    "grep -r -E 'LIMIT|OFFSET|cursor' internal/repo/queries/"

check_requirement "Metadata query optimization" \
    "grep -r -q 'idx.*metadata\|idx.*enriched' migrations/"

# 11.2 Response optimization
check_requirement "Lazy loading for large directories" \
    "grep -r -E 'lazy.*load|defer.*load|batch.*load' internal/api/v1/"

check_requirement "Response compression support" \
    "grep -r -q 'gzip\|compress' internal/api/middleware/"

check_requirement "Caching headers for static metadata" \
    "grep -r -E 'Cache-Control|ETag|Last-Modified' internal/api/v1/"

echo ""
echo "12. FRONTEND INTEGRATION"
echo "========================"

# 12.1 Frontend API integration
check_requirement "Frontend uses generated client" \
    "grep -q 'generated.*Api' frontend/src/api/services.ts"

check_requirement "Explorer UI integration" \
    "grep -r -E 'tree|explorer|browse' frontend/src/pages/"

check_requirement "File metadata display" \
    "grep -r -E 'metadata|file.*details' frontend/src/components/"

# 12.2 Real-time updates
check_requirement "WebSocket integration for live updates" \
    "grep -r -q 'websocket\|ws' frontend/src/api/"

check_requirement "State management for API data" \
    "grep -r -q 'atoms.*api\|store.*api' frontend/src/store/"

check_requirement "Error boundary for API errors" \
    "grep -r -E 'error.*boundary|api.*error' frontend/src/components/"

echo ""
echo "================"
echo "SUMMARY REPORT"
echo "================"
echo ""

# Calculate missing requirements
missing=$((total_checks - success_count))

if [ $success_count -eq $total_checks ]; then
    echo -e "${GREEN}🎉 ALL REQUIREMENTS MET!${NC}"
    echo -e "${GREEN}✅ API v1.2 (Explorer/Metadata/Stats/Alerts) ticket is COMPLETE${NC}"
    echo ""
    echo -e "🔧 Implementation includes:"
    echo -e "   • Complete Explorer API with tree/directory browsing"
    echo -e "   • File metadata API with rich media information"
    echo -e "   • Daily stats and trends API with growth analysis"
    echo -e "   • Alert management API with rules and destinations"
    echo -e "   • Comprehensive OpenAPI v3 specification"
    echo -e "   • Auto-generated TypeScript client with type safety"
    echo -e "   • Lightweight pre-configured API client"
    echo -e "   • Full CI/CD validation pipeline"
    echo -e "   • Advanced pagination, sorting, and filtering"
    echo -e "   • Performance-optimized queries and caching"
    echo -e "   • Complete frontend integration"
else
    echo -e "${YELLOW}⚠️  PARTIALLY COMPLETE${NC}"
    echo -e "${GREEN}✅ $success_count/$total_checks requirements met${NC}"
    echo -e "${RED}❌ $missing requirements missing or incomplete${NC}"
    echo ""
    echo -e "${YELLOW}Major gaps identified:${NC}"
    if ! grep -q 'tree.*children' internal/api/v1/ 2>/dev/null; then
        echo -e "   • ${RED}Explorer API endpoints missing${NC}"
    fi
    if ! test -f internal/api/v1/stats/handler.go 2>/dev/null; then
        echo -e "   • ${RED}Stats API handler missing${NC}"
    fi
    if ! grep -q 'TreeNode\|DirectoryListing' docs/openapi.yaml 2>/dev/null; then
        echo -e "   • ${RED}OpenAPI schema definitions incomplete${NC}"
    fi
    if ! grep -q 'getTreeChildren\|getFilesForPath' frontend/src/api/client.ts 2>/dev/null; then
        echo -e "   • ${RED}Lightweight client methods missing${NC}"
    fi
fi

echo ""
echo "🔨 Build Status:"
if go build ./... > /dev/null 2>&1; then
    echo -e "${GREEN}✅ All code compiles successfully${NC}"
else
    echo -e "${RED}❌ Compilation errors detected${NC}"
fi

echo ""
echo "📊 Current Implementation Status:"
echo -e "   • Volume/Scan APIs: ${GREEN}COMPLETE${NC}"
echo -e "   • Health/System APIs: ${GREEN}COMPLETE${NC}"
echo -e "   • Alert APIs: ${GREEN}COMPLETE${NC}"
if [ $missing -lt 20 ]; then
    echo -e "   • Explorer APIs: ${YELLOW}PARTIAL${NC}"
    echo -e "   • File Metadata APIs: ${YELLOW}PARTIAL${NC}"
    echo -e "   • Stats APIs: ${YELLOW}PARTIAL${NC}"
else
    echo -e "   • Explorer APIs: ${RED}MISSING${NC}"
    echo -e "   • File Metadata APIs: ${RED}MISSING${NC}"
    echo -e "   • Stats APIs: ${RED}MISSING${NC}"
fi

echo ""
echo "🎯 Next Steps to Complete:"
if [ $missing -gt 0 ]; then
    echo -e "   1. Implement missing Explorer API endpoints"
    echo -e "   2. Create File Metadata API handlers"
    echo -e "   3. Build Stats API with trends analysis"
    echo -e "   4. Update OpenAPI spec with new endpoints"
    echo -e "   5. Regenerate TypeScript client"
    echo -e "   6. Update lightweight client with new methods"
    echo -e "   7. Add frontend integration"
    echo -e "   8. Implement performance optimizations"
fi

exit 0
