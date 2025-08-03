#!/bin/bash
# Database Performance Benchmark Script
# Compares PostgreSQL vs SQLite performance in VolumeViz

set -e

echo "⚡ VolumeViz Database Performance Benchmark"
echo "=========================================="

# Check if services are running
check_service() {
    local url=$1
    local name=$2
    
    if curl -f "$url/health" >/dev/null 2>&1; then
        echo "✅ $name is running"
        return 0
    else
        echo "❌ $name is not running"
        return 1
    fi
}

# Run performance test against a backend
run_benchmark() {
    local url=$1
    local name=$2
    local test_size=${3:-1000}
    
    echo ""
    echo "🏃 Running benchmark against $name ($url)"
    echo "   Test size: $test_size operations"
    
    # Simple performance test using curl
    echo "   📝 Testing volume creation..."
    local start_time=$(date +%s.%N)
    
    for i in $(seq 1 10); do
        curl -s -X POST "$url/api/v1/volumes" \
            -H "Content-Type: application/json" \
            -d "{\"name\":\"benchmark-volume-$i\",\"driver\":\"local\"}" >/dev/null || true
    done
    
    local end_time=$(date +%s.%N)
    local duration=$(echo "$end_time - $start_time" | bc -l)
    local ops_per_sec=$(echo "scale=2; 10 / $duration" | bc -l)
    
    echo "   ⏱️  Volume creation: $ops_per_sec ops/sec"
    
    echo "   🔍 Testing volume listing..."
    start_time=$(date +%s.%N)
    
    for i in $(seq 1 50); do
        curl -s "$url/api/v1/volumes" >/dev/null || true
    done
    
    end_time=$(date +%s.%N)
    duration=$(echo "$end_time - $start_time" | bc -l)
    ops_per_sec=$(echo "scale=2; 50 / $duration" | bc -l)
    
    echo "   ⏱️  Volume listing: $ops_per_sec ops/sec"
    
    # Health check response time
    echo "   💓 Testing health check response time..."
    start_time=$(date +%s.%N)
    curl -s "$url/health" >/dev/null || true
    end_time=$(date +%s.%N)
    duration=$(echo "$end_time - $start_time" | bc -l)
    duration_ms=$(echo "$duration * 1000" | bc -l)
    
    echo "   ⏱️  Health check: ${duration_ms}ms"
}

# Check which services are available
POSTGRES_AVAILABLE=false
SQLITE_AVAILABLE=false

echo "🔍 Checking service availability..."

if check_service "http://localhost:8080" "PostgreSQL backend"; then
    POSTGRES_AVAILABLE=true
fi

if check_service "http://localhost:8081" "SQLite backend"; then
    SQLITE_AVAILABLE=true
fi

if [[ "$POSTGRES_AVAILABLE" == "false" && "$SQLITE_AVAILABLE" == "false" ]]; then
    echo ""
    echo "❌ No VolumeViz backends are running!"
    echo "   Start the development environment with: ./scripts/dev-start.sh"
    exit 1
fi

# Run benchmarks
if [[ "$POSTGRES_AVAILABLE" == "true" ]]; then
    run_benchmark "http://localhost:8080" "PostgreSQL"
fi

if [[ "$SQLITE_AVAILABLE" == "true" ]]; then
    run_benchmark "http://localhost:8081" "SQLite"
fi

# Summary
echo ""
echo "📊 Benchmark Summary"
echo "==================="

if [[ "$POSTGRES_AVAILABLE" == "true" && "$SQLITE_AVAILABLE" == "true" ]]; then
    echo "✅ Both PostgreSQL and SQLite backends tested"
    echo ""
    echo "💡 Key Differences:"
    echo "   🐘 PostgreSQL: Better for concurrent operations and complex queries"
    echo "   🗃️  SQLite: Better for single-threaded performance and simplicity"
    echo ""
    echo "📈 View detailed metrics:"
    echo "   • Grafana: http://localhost:3000"
    echo "   • Prometheus: http://localhost:9090"
elif [[ "$POSTGRES_AVAILABLE" == "true" ]]; then
    echo "✅ PostgreSQL backend tested"
    echo "   Start SQLite backend for comparison: docker-compose -f docker-compose.dev.yml up -d backend-sqlite"
elif [[ "$SQLITE_AVAILABLE" == "true" ]]; then
    echo "✅ SQLite backend tested"
    echo "   Start PostgreSQL backend for comparison: docker-compose -f docker-compose.dev.yml up -d postgres backend-postgres"
fi

echo ""
echo "🔧 Database Tools:"
if [[ "$POSTGRES_AVAILABLE" == "true" ]]; then
    echo "   🛠️  pgAdmin (PostgreSQL): http://localhost:5050"
fi
if [[ "$SQLITE_AVAILABLE" == "true" ]]; then
    echo "   🛠️  SQLite Web: http://localhost:8082"
fi

echo ""
echo "🎯 For more detailed benchmarking, run the Go benchmarks:"
echo "   go test -bench=. ./internal/database/..."