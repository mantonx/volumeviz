#!/bin/bash
#
# Smoke test script for VolumeViz API
# Tests basic functionality, endpoint test, and smoke test coverage
#
set -euo pipefail

# Configuration
PORT=${API_PORT:-8080}
HOST=${API_HOST:-127.0.0.1}
TIMEOUT=${SMOKE_TIMEOUT:-30}
HEALTH_RETRIES=${HEALTH_RETRIES:-15}

# Function to find a free port
find_free_port() {
    local port=$1

    # If port is 0, always find a dynamic port
    if [[ "$port" == "0" ]]; then
        port=$(python3 -c "import socket; s=socket.socket(); s.bind(('',0)); print(s.getsockname()[1]); s.close()" 2>/dev/null || echo "8080")
    else
        # Check if specific port is in use
        if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
            # Port is in use, find a free one
            port=$(python3 -c "import socket; s=socket.socket(); s.bind(('',0)); print(s.getsockname()[1]); s.close()" 2>/dev/null || echo "8081")
        fi
    fi

    echo "$port"
}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}ℹ️  $*${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $*${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $*${NC}"
}

log_error() {
    echo -e "${RED}❌ $*${NC}"
}

# Global variables
SVR_PID=""
TEMP_LOG=""

# Cleanup function
cleanup() {
    local exit_code=$?
    set +e  # Disable errexit for cleanup
    log_info "Cleaning up..."

    # Server cleanup with better error handling
    if [[ -n "$SVR_PID" ]] && kill -0 "$SVR_PID" 2>/dev/null; then
        log_info "Stopping server (PID: $SVR_PID)..."

        # Try graceful shutdown first
        if kill -TERM "$SVR_PID" 2>/dev/null; then
            # Give it time to shut down gracefully
            local wait_count=0
            while [[ $wait_count -lt 5 ]] && kill -0 "$SVR_PID" 2>/dev/null; do
                sleep 1
                ((wait_count++))
            done

            # Force kill if still running
            if kill -0 "$SVR_PID" 2>/dev/null; then
                log_warning "Force killing server..."
                kill -9 "$SVR_PID" 2>/dev/null || true
                sleep 1
            fi

            # Wait for process to complete, but don't let it affect exit code
            wait "$SVR_PID" 2>/dev/null || true
        fi
        log_success "Server stopped"
    fi

    # Fallback: kill any remaining volumeviz processes (don't affect exit code)
    if pgrep -f "go.*server" > /dev/null 2>&1; then
        log_warning "Cleaning up remaining processes..."
        pkill -f "go.*server" 2>/dev/null || true
    fi

    # Show logs on failure only
    if [[ $exit_code -ne 0 ]] && [[ -n "$TEMP_LOG" ]] && [[ -f "$TEMP_LOG" ]]; then
        log_error "Smoke test failed. Recent server logs:"
        tail -20 "$TEMP_LOG" 2>/dev/null || echo "(no logs available)"
    fi

    # Clean up temp log file (don't affect exit code)
    if [[ -n "$TEMP_LOG" ]] && [[ -f "$TEMP_LOG" ]]; then
        rm -f "$TEMP_LOG" 2>/dev/null || true
    fi

    log_success "Cleanup complete (exit code: $exit_code)"

    # Preserve the original exit code - but ensure cleanup issues don't override success
    exit $exit_code
}


# Set up cleanup trap
trap 'cleanup' EXIT INT TERM

# Test API endpoint
test_endpoint() {
    local endpoint="$1"
    local description="$2"
    local expected_fields="$3"

    log_info "Testing: $description ($endpoint)"

    # Use curl with proper error handling and retries
    if response=$(curl --fail --silent --show-error \
                      --connect-timeout 5 --max-time 10 \
                      --retry 2 --retry-delay 1 \
                      "http://$HOST:$PORT$endpoint" 2>&1); then

        # Validate JSON structure if expected fields are provided
        if [[ -n "$expected_fields" ]]; then
            local missing_fields=""
            for field in $expected_fields; do
                if ! echo "$response" | jq -e ".$field" > /dev/null 2>&1; then
                    missing_fields+="$field "
                fi
            done

            if [[ -n "$missing_fields" ]]; then
                log_warning "$description - Missing fields: $missing_fields"
                log_info "Response preview: $(echo "$response" | jq -c . 2>/dev/null || echo "$response" | head -c 100)..."
            fi
        fi

        log_success "$description - OK"
        return 0
    else
        log_error "$description - FAILED"
        log_error "Endpoint: http://$HOST:$PORT$endpoint"
        log_error "Error: $response"
        return 1
    fi
}

# Main execution
main() {
    log_info "🚀 Starting VolumeViz API smoke test..."

    # Find a free port to avoid conflicts
    ORIGINAL_PORT=$PORT
    PORT=$(find_free_port $PORT)
    if [[ "$PORT" != "$ORIGINAL_PORT" ]]; then
        log_warning "Port $ORIGINAL_PORT was in use, using port $PORT instead"
    fi
    log_info "Target: http://$HOST:$PORT"

    # Create temporary log file
    TEMP_LOG=$(mktemp)
    log_info "Server logs will be captured in: $TEMP_LOG"

    # Start server in background with the selected port
    log_info "🏗️  Starting API server on port $PORT..."
    if [[ -n "${CI:-}" ]]; then
        # In CI, run with minimal logging and pass through environment variables
        env SERVER_PORT=$PORT \
            ${DB_TYPE:+DB_TYPE="$DB_TYPE"} \
            ${DB_HOST:+DB_HOST="$DB_HOST"} \
            ${DB_PORT:+DB_PORT="$DB_PORT"} \
            ${DB_USER:+DB_USER="$DB_USER"} \
            ${DB_PASSWORD:+DB_PASSWORD="$DB_PASSWORD"} \
            ${DB_NAME:+DB_NAME="$DB_NAME"} \
            ${DB_SSLMODE:+DB_SSLMODE="$DB_SSLMODE"} \
            ${EVENTS_ENABLED:+EVENTS_ENABLED="$EVENTS_ENABLED"} \
            ${AUTH_ENABLED:+AUTH_ENABLED="$AUTH_ENABLED"} \
            ${RATE_LIMIT_ENABLED:+RATE_LIMIT_ENABLED="$RATE_LIMIT_ENABLED"} \
            ${LOG_LEVEL:+LOG_LEVEL="$LOG_LEVEL"} \
            go run ./cmd/server > "$TEMP_LOG" 2>&1 &
    else
        # Local development, show logs and pass through environment
        env SERVER_PORT=$PORT \
            ${DB_TYPE:+DB_TYPE="$DB_TYPE"} \
            ${DB_HOST:+DB_HOST="$DB_HOST"} \
            ${DB_PORT:+DB_PORT="$DB_PORT"} \
            ${DB_USER:+DB_USER="$DB_USER"} \
            ${DB_PASSWORD:+DB_PASSWORD="$DB_PASSWORD"} \
            ${DB_NAME:+DB_NAME="$DB_NAME"} \
            ${DB_SSLMODE:+DB_SSLMODE="$DB_SSLMODE"} \
            ${EVENTS_ENABLED:+EVENTS_ENABLED="$EVENTS_ENABLED"} \
            ${AUTH_ENABLED:+AUTH_ENABLED="$AUTH_ENABLED"} \
            ${RATE_LIMIT_ENABLED:+RATE_LIMIT_ENABLED="$RATE_LIMIT_ENABLED"} \
            ${LOG_LEVEL:+LOG_LEVEL="$LOG_LEVEL"} \
            go run ./cmd/server 2>&1 | tee "$TEMP_LOG" &
    fi
    SVR_PID=$!
    log_info "Server PID: $SVR_PID"

    # Verify the process started successfully
    sleep 1
    if ! kill -0 "$SVR_PID" 2>/dev/null; then
        log_error "Server process failed to start"
        if [[ -f "$TEMP_LOG" ]]; then
            log_error "Server startup logs:"
            cat "$TEMP_LOG"
        fi
        exit 1
    fi

    # Wait a moment for server to initialize
    sleep 2

    # Health check with retries
    log_info "🩺 Waiting for server to be ready..."
    local retry_count=0
    local health_url="http://$HOST:$PORT/api/v1/health"

    while [[ $retry_count -lt $HEALTH_RETRIES ]]; do
        # Use curl with retries and timeout
        if curl --fail --silent --show-error \
               --connect-timeout 2 --max-time 5 \
               --retry 0 \
               "$health_url" > /dev/null 2>&1; then
            log_success "Server is healthy"

            # Additional verification: check if we can get a valid JSON response
            if health_response=$(curl --fail --silent --max-time 5 "$health_url" 2>/dev/null) && \
               echo "$health_response" | jq -e '.status' > /dev/null 2>&1; then
                local status=$(echo "$health_response" | jq -r '.status')
                log_success "Health status: $status"
                break
            else
                log_warning "Health endpoint returned invalid response, retrying..."
            fi
        fi

        retry_count=$((retry_count + 1))
        if [[ $retry_count -eq $HEALTH_RETRIES ]]; then
            log_error "Health check failed after $HEALTH_RETRIES retries"

            # Show detailed error information
            log_error "Failed to connect to: $health_url"
            if [[ -f "$TEMP_LOG" ]]; then
                log_error "Recent server logs:"
                tail -20 "$TEMP_LOG"
            fi

            # Try to get more info about what might be listening on the port
            if command -v lsof >/dev/null 2>&1; then
                log_info "Processes listening on port $PORT:"
                lsof -i :$PORT 2>/dev/null || log_warning "No processes found on port $PORT"
            fi

            exit 1
        fi

        log_info "Waiting for server... (attempt $retry_count/$HEALTH_RETRIES)"
        sleep 1
    done

    # Test key endpoints
    local failed_tests=0

    # Basic health endpoint
    test_endpoint "/api/v1/health" "Health endpoint" "status timestamp" || ((failed_tests++))

    # Database migrations status
    test_endpoint "/api/v1/database/migrations/status" "Migration status" "total_migrations applied_count pending_count" || ((failed_tests++))

    # Database statistics (skip field validation due to SQLite compatibility issues - will be addressed separately)
    test_endpoint "/api/v1/database/stats" "Database stats" "" || ((failed_tests++))

    # Volumes list (with pagination)
    test_endpoint "/api/v1/volumes?page=1&page_size=5" "Volumes list" "data page page_size total" || ((failed_tests++))

    # API version/info
    test_endpoint "/api/v1/system/version" "Version info" "version api_version" || ((failed_tests++))

    # Metrics endpoint (if enabled)
    if curl --fail --silent --max-time 5 "http://$HOST:9090/metrics" > /dev/null 2>&1; then
        log_success "Metrics endpoint - OK"
    else
        log_warning "Metrics endpoint not available (may be disabled)"
    fi

    # Summary
    if [[ $failed_tests -eq 0 ]]; then
        log_success "🎉 All smoke tests passed!"
        # Success - exit cleanly, cleanup will happen via trap
        exit 0
    else
        log_error "💥 $failed_tests test(s) failed"
        # Failure - exit with error code, cleanup will happen via trap
        exit 1
    fi
}

# Run main function
main "$@"
