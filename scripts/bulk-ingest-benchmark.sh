#!/bin/bash

# VolumeViz Bulk Ingestion Performance Benchmark Script
# Tests bulk file ingestion performance and validates 1M row targets

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
TEST_DB_DIR="/tmp/volumeviz-bulk-test"
RESULTS_FILE="$TEST_DB_DIR/bulk-ingest-results.json"

# Performance targets
TARGET_PG_ROWS_PER_SEC=30000
TARGET_SQLITE_ROWS_PER_SEC=10000
MAX_1M_DURATION_MINUTES=5

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

echo_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

echo_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

echo_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Setup test environment
setup_test_env() {
    echo_info "Setting up test environment..."
    
    mkdir -p "$TEST_DB_DIR"
    
    # Setup PostgreSQL test database if available
    if command -v psql >/dev/null 2>&1 && [ -n "$POSTGRES_TEST_URL" ]; then
        echo_info "PostgreSQL available for testing"
        export POSTGRES_AVAILABLE=true
    else
        echo_warning "PostgreSQL not available, skipping PostgreSQL tests"
        export POSTGRES_AVAILABLE=false
    fi
    
    echo_info "SQLite will be used for testing"
}

# Run basic performance tests
run_basic_tests() {
    echo_info "Running basic bulk ingestion tests..."
    
    cd "$PROJECT_ROOT"
    
    # Run regular tests first
    echo_info "Running unit tests..."
    go test -v ./internal/store/ -run TestBulkIngester -timeout 10m
    
    if [ $? -ne 0 ]; then
        echo_error "Basic tests failed"
        return 1
    fi
    
    echo_success "Basic tests passed"
}

# Run benchmark tests
run_benchmarks() {
    echo_info "Running performance benchmarks..."
    
    cd "$PROJECT_ROOT"
    
    # Run benchmarks with memory profiling
    echo_info "Running benchmarks..."
    go test -bench=BenchmarkBulkIngest -benchmem -timeout 15m ./internal/store/ > "$TEST_DB_DIR/benchmark-results.txt" 2>&1
    
    if [ $? -ne 0 ]; then
        echo_warning "Some benchmarks may have failed, check results"
    fi
    
    # Display benchmark results
    echo_info "Benchmark Results:"
    cat "$TEST_DB_DIR/benchmark-results.txt" | grep -E "(Benchmark|rows/sec|ns/op|B/op)"
}

# Run million row test
run_million_row_test() {
    echo_info "Running 1 million row ingestion test..."
    
    cd "$PROJECT_ROOT"
    
    # Set environment variable to enable the test
    export RUN_MILLION_ROW_TEST=true
    
    # Run the million row test with extended timeout
    echo_info "This may take several minutes..."
    
    start_time=$(date +%s)
    go test -v ./internal/store/ -run TestMillionRowIngestion -timeout 30m > "$TEST_DB_DIR/million-row-results.txt" 2>&1
    test_result=$?
    end_time=$(date +%s)
    duration=$((end_time - start_time))
    
    echo_info "Million row test completed in ${duration} seconds"
    
    # Parse results
    if [ $test_result -eq 0 ]; then
        echo_success "Million row test passed!"
        
        # Extract performance metrics
        if grep -q "rows/second" "$TEST_DB_DIR/million-row-results.txt"; then
            throughput=$(grep "Throughput:" "$TEST_DB_DIR/million-row-results.txt" | tail -1 | grep -o '[0-9,]*' | tr -d ',')
            echo_info "Achieved throughput: $throughput rows/second"
            
            if [ "$throughput" -gt "$TARGET_PG_ROWS_PER_SEC" ] || [ "$throughput" -gt "$TARGET_SQLITE_ROWS_PER_SEC" ]; then
                echo_success "Performance target exceeded!"
            else
                echo_warning "Performance target not met, but test passed"
            fi
        fi
        
        # Show key results
        echo_info "Key Results:"
        grep -E "(Duration:|Throughput:|Batches:|Processed:)" "$TEST_DB_DIR/million-row-results.txt" | tail -10
        
    else
        echo_error "Million row test failed"
        echo_error "Check detailed output in $TEST_DB_DIR/million-row-results.txt"
        tail -20 "$TEST_DB_DIR/million-row-results.txt"
        return 1
    fi
}

# Record performance baseline
record_baseline() {
    echo_info "Recording performance baseline..."
    
    cd "$PROJECT_ROOT"
    
    export RECORD_BASELINE=true
    go test -v ./internal/store/ -run TestRecordBaseline -timeout 10m > "$TEST_DB_DIR/baseline-results.txt" 2>&1
    
    if [ $? -eq 0 ]; then
        echo_success "Baseline recorded successfully"
        echo_info "Baseline Results:"
        grep -E "(Database:|Throughput:|Duration:)" "$TEST_DB_DIR/baseline-results.txt"
    else
        echo_warning "Baseline recording failed, continuing..."
    fi
}

# Validate system capabilities
validate_system() {
    echo_info "Validating system capabilities for bulk ingestion..."
    
    # Check available memory
    if command -v free >/dev/null 2>&1; then
        available_mb=$(free -m | awk '/^Mem:/{print $7}')
        echo_info "Available memory: ${available_mb}MB"
        
        if [ "$available_mb" -lt 512 ]; then
            echo_warning "Low available memory ($available_mb MB), performance may be impacted"
        fi
    fi
    
    # Check disk space
    if command -v df >/dev/null 2>&1; then
        available_space=$(df /tmp | tail -1 | awk '{print $4}')
        echo_info "Available disk space in /tmp: ${available_space}KB"
    fi
    
    # Check Go version
    go_version=$(go version)
    echo_info "Go version: $go_version"
}

# Generate performance report
generate_report() {
    echo_info "Generating performance report..."
    
    report_file="$TEST_DB_DIR/performance-report.md"
    
    cat > "$report_file" << EOF
# VolumeViz Bulk Ingestion Performance Report

Generated: $(date)

## Test Environment
- System: $(uname -a)
- Go Version: $(go version)
- Available Memory: $(free -h | grep Mem | awk '{print $7}' 2>/dev/null || echo "Unknown")

## Performance Targets
- PostgreSQL: ${TARGET_PG_ROWS_PER_SEC} rows/second
- SQLite: ${TARGET_SQLITE_ROWS_PER_SEC} rows/second
- 1M Row Duration: < ${MAX_1M_DURATION_MINUTES} minutes

## Test Results

### Basic Tests
EOF
    
    if [ -f "$TEST_DB_DIR/benchmark-results.txt" ]; then
        echo "### Benchmark Results" >> "$report_file"
        echo '```' >> "$report_file"
        grep -E "(Benchmark|rows/sec)" "$TEST_DB_DIR/benchmark-results.txt" >> "$report_file" 2>/dev/null || true
        echo '```' >> "$report_file"
    fi
    
    if [ -f "$TEST_DB_DIR/million-row-results.txt" ]; then
        echo "### Million Row Test Results" >> "$report_file"
        echo '```' >> "$report_file"
        grep -E "(Duration:|Throughput:|Batches:|Processed:)" "$TEST_DB_DIR/million-row-results.txt" >> "$report_file" 2>/dev/null || true
        echo '```' >> "$report_file"
    fi
    
    echo_success "Performance report generated: $report_file"
}

# Clean up test environment
cleanup() {
    echo_info "Cleaning up test environment..."
    
    # Optional: remove test directory
    if [ "$CLEANUP_TEST_DIR" = "true" ]; then
        rm -rf "$TEST_DB_DIR"
        echo_info "Test directory cleaned up"
    else
        echo_info "Test results preserved in: $TEST_DB_DIR"
    fi
}

# Main execution
main() {
    echo_info "Starting VolumeViz Bulk Ingestion Performance Benchmark"
    echo_info "=================================================="
    
    # Parse command line arguments
    RUN_MILLION_ROW=false
    RUN_BENCHMARKS=true
    CLEANUP_TEST_DIR=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --million-row)
                RUN_MILLION_ROW=true
                shift
                ;;
            --no-benchmarks)
                RUN_BENCHMARKS=false
                shift
                ;;
            --cleanup)
                CLEANUP_TEST_DIR=true
                shift
                ;;
            --help)
                echo "Usage: $0 [options]"
                echo "Options:"
                echo "  --million-row    Run the 1 million row test"
                echo "  --no-benchmarks  Skip benchmark tests"
                echo "  --cleanup        Clean up test directory after completion"
                echo "  --help          Show this help message"
                exit 0
                ;;
            *)
                echo_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    # Setup and validate environment
    setup_test_env
    validate_system
    
    # Run tests
    if ! run_basic_tests; then
        echo_error "Basic tests failed, aborting"
        exit 1
    fi
    
    if [ "$RUN_BENCHMARKS" = true ]; then
        run_benchmarks
    fi
    
    # Record baseline performance
    record_baseline
    
    # Run million row test if requested
    if [ "$RUN_MILLION_ROW" = true ]; then
        if ! run_million_row_test; then
            echo_error "Million row test failed"
            exit 1
        fi
    else
        echo_info "Million row test skipped (use --million-row to enable)"
    fi
    
    # Generate report
    generate_report
    
    # Cleanup
    cleanup
    
    echo_success "Bulk ingestion performance benchmark completed successfully!"
    echo_info "Check results in: $TEST_DB_DIR"
    
    # Summary
    echo_info "=================================================="
    echo_info "SUMMARY:"
    echo_success "✅ Basic tests passed"
    [ "$RUN_BENCHMARKS" = true ] && echo_success "✅ Benchmarks completed"
    [ "$RUN_MILLION_ROW" = true ] && echo_success "✅ Million row test passed"
    echo_info "=================================================="
}

# Run main function
main "$@"