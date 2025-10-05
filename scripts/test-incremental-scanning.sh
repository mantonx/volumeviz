#!/bin/bash
set -e

# VolumeViz Incremental Scanning Test Script
# This script tests the complete incremental scanning workflow

VOLUME_ID="${1:-volumeviz_movies_dev}"
API_URL="${API_URL:-http://localhost:8080}"
TOKEN="${JWT_TOKEN}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}✓${NC} $1"
}

error() {
    echo -e "${RED}✗${NC} $1"
}

warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Check if token is set
if [ -z "$TOKEN" ]; then
    error "JWT_TOKEN environment variable not set"
    echo "Generate a token with:"
    echo "  AUTH_HS256_SECRET=\"your-super-secret-jwt-key-for-development-only-change-in-production\" go run cmd/jwt-gen/main.go -user \"1\" -role \"admin\" -org 1"
    echo "Then export it:"
    echo "  export JWT_TOKEN=\"<your-token>\""
    exit 1
fi

echo "=================================================="
echo "VolumeViz Incremental Scanning Test"
echo "=================================================="
echo "Volume: $VOLUME_ID"
echo "API: $API_URL"
echo ""

# Function to wait for scan completion
wait_for_scan() {
    local scan_id=$1
    local max_wait=${2:-600}  # Default 10 minutes
    local waited=0

    log "Waiting for scan $scan_id to complete..."

    while [ $waited -lt $max_wait ]; do
        # Check scan status via database (more reliable than API)
        status=$(docker exec volumeviz-db-dev psql -U volumeviz -d volumeviz -t -c \
            "SELECT status FROM scan_jobs WHERE scan_id = '$scan_id';" 2>/dev/null | xargs || echo "unknown")

        if [ "$status" = "completed" ]; then
            success "Scan completed!"
            return 0
        elif [ "$status" = "failed" ]; then
            error "Scan failed!"
            return 1
        fi

        printf "."
        sleep 5
        waited=$((waited + 5))
    done

    warn "Scan timeout after ${max_wait}s"
    return 1
}

# Step 1: Check if snapshots table exists
log "Step 1: Verifying database schema..."
if docker exec volumeviz-db-dev psql -U volumeviz -d volumeviz -c "\dt volume_snapshots" 2>&1 | grep -q "volume_snapshots"; then
    success "Database schema ready (volume_snapshots table exists)"
else
    error "Database schema missing - run migration first"
    exit 1
fi

# Step 2: Check current snapshot count
log "Step 2: Checking existing snapshots..."
snapshot_count=$(docker exec volumeviz-db-dev psql -U volumeviz -d volumeviz -t -c \
    "SELECT COUNT(*) FROM volume_snapshots WHERE volume_id = '$VOLUME_ID';" | xargs)
log "Existing snapshots for $VOLUME_ID: $snapshot_count"

# Step 3: Trigger first scan
log "Step 3: Triggering FIRST scan (should create snapshot)..."
response=$(curl -s -H "Authorization: Bearer $TOKEN" \
    -X POST "$API_URL/api/v1/volumes/$VOLUME_ID/scan?method=native&async=true")

scan_id_1=$(echo "$response" | jq -r '.scan_id // empty')
if [ -z "$scan_id_1" ]; then
    error "Failed to start scan"
    echo "Response: $response"
    exit 1
fi

success "First scan started: $scan_id_1"
start_time_1=$(date +%s)

# Wait for first scan to complete
if ! wait_for_scan "$scan_id_1" 600; then
    error "First scan did not complete"
    exit 1
fi

end_time_1=$(date +%s)
duration_1=$((end_time_1 - start_time_1))
log "First scan duration: ${duration_1}s"

# Step 4: Wait a bit for snapshot creation (happens async)
log "Step 4: Waiting for snapshot creation..."
sleep 10

# Check if snapshot was created
new_snapshot_count=$(docker exec volumeviz-db-dev psql -U volumeviz -d volumeviz -t -c \
    "SELECT COUNT(*) FROM volume_snapshots WHERE volume_id = '$VOLUME_ID';" | xargs)

if [ "$new_snapshot_count" -gt "$snapshot_count" ]; then
    success "Snapshot created! (count: $snapshot_count → $new_snapshot_count)"

    # Get snapshot details
    snapshot_info=$(docker exec volumeviz-db-dev psql -U volumeviz -d volumeviz -t -c \
        "SELECT id, scan_method, total_size, file_count, folder_count, created_at
         FROM volume_snapshots
         WHERE volume_id = '$VOLUME_ID'
         ORDER BY created_at DESC LIMIT 1;")
    log "Latest snapshot: $snapshot_info"
else
    warn "Snapshot not created yet (count still: $new_snapshot_count)"
    warn "Check logs: docker logs volumeviz-backend-postgres-dev | grep -i snapshot"
fi

# Step 5: Trigger second scan (should use incremental)
log "Step 5: Triggering SECOND scan (should use incremental)..."
sleep 2

response=$(curl -s -H "Authorization: Bearer $TOKEN" \
    -X POST "$API_URL/api/v1/volumes/$VOLUME_ID/scan?method=native&async=true")

scan_id_2=$(echo "$response" | jq -r '.scan_id // empty')
if [ -z "$scan_id_2" ]; then
    error "Failed to start second scan"
    echo "Response: $response"
    exit 1
fi

success "Second scan started: $scan_id_2"
start_time_2=$(date +%s)

# Check logs for incremental scan message
sleep 3
if docker logs volumeviz-backend-postgres-dev 2>&1 | grep -q "Using incremental scan for volume $VOLUME_ID"; then
    success "✨ INCREMENTAL SCAN DETECTED in logs!"
else
    warn "Incremental scan not detected in logs (might be too early or snapshot too old)"
fi

# Wait for second scan
if ! wait_for_scan "$scan_id_2" 600; then
    error "Second scan did not complete"
    exit 1
fi

end_time_2=$(date +%s)
duration_2=$((end_time_2 - start_time_2))
log "Second scan duration: ${duration_2}s"

# Step 6: Compare performance
log "Step 6: Performance comparison..."
if [ "$duration_2" -lt "$duration_1" ]; then
    time_saved=$((duration_1 - duration_2))
    percent_saved=$((100 * time_saved / duration_1))
    success "Second scan was ${percent_saved}% faster! (saved ${time_saved}s)"
else
    warn "Second scan took longer (${duration_2}s vs ${duration_1}s)"
    warn "This might be due to: first scan still indexing, cache effects, or system load"
fi

# Step 7: Test snapshot API
log "Step 7: Testing snapshot API endpoints..."

# Test /stats endpoint
stats_response=$(curl -s -H "Authorization: Bearer $TOKEN" \
    "$API_URL/api/v1/org/1/snapshots/stats")
if echo "$stats_response" | jq -e '.total_snapshots' > /dev/null 2>&1; then
    total=$(echo "$stats_response" | jq -r '.total_snapshots')
    success "Snapshot stats API works (total snapshots: $total)"
else
    warn "Snapshot stats API returned unexpected response"
fi

# Test /volumes/:id endpoint
volume_snapshots=$(curl -s -H "Authorization: Bearer $TOKEN" \
    "$API_URL/api/v1/org/1/snapshots/volumes/$VOLUME_ID")
if echo "$volume_snapshots" | jq -e '.snapshots' > /dev/null 2>&1; then
    count=$(echo "$volume_snapshots" | jq -r '.count')
    success "Volume snapshots API works ($count snapshots)"
else
    warn "Volume snapshots API returned unexpected response"
fi

# Test /latest endpoint
latest_snapshot=$(curl -s -H "Authorization: Bearer $TOKEN" \
    "$API_URL/api/v1/org/1/snapshots/volumes/$VOLUME_ID/latest")
if echo "$latest_snapshot" | jq -e '.ID' > /dev/null 2>&1; then
    snapshot_id=$(echo "$latest_snapshot" | jq -r '.ID')
    success "Latest snapshot API works (ID: $snapshot_id)"
else
    warn "Latest snapshot API returned unexpected response"
fi

# Final summary
echo ""
echo "=================================================="
echo "Test Summary"
echo "=================================================="
echo "Volume: $VOLUME_ID"
echo "First scan: ${duration_1}s"
echo "Second scan: ${duration_2}s"
if [ "$duration_2" -lt "$duration_1" ]; then
    echo -e "${GREEN}Performance improvement: $((100 * (duration_1 - duration_2) / duration_1))%${NC}"
else
    echo -e "${YELLOW}No performance improvement detected${NC}"
fi
echo "Snapshots created: $((new_snapshot_count - snapshot_count))"
echo ""
echo "Database check:"
docker exec volumeviz-db-dev psql -U volumeviz -d volumeviz -c \
    "SELECT id, volume_id, scan_method, total_size, file_count,
            to_char(created_at, 'YYYY-MM-DD HH24:MI:SS') as created
     FROM volume_snapshots
     WHERE volume_id = '$VOLUME_ID'
     ORDER BY created_at DESC
     LIMIT 3;"

echo ""
success "Test completed!"
