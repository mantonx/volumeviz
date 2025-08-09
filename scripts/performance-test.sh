#!/bin/bash

# VolumeViz Performance Testing Script
# This script runs performance tests against the VolumeViz API

set -euo pipefail

# Configuration
API_URL="${API_URL:-http://localhost:8080/api/v1}"
CONCURRENT_USERS="${CONCURRENT_USERS:-10}"
DURATION="${DURATION:-60s}"
REPORT_DIR="performance-reports"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Create report directory
mkdir -p "$REPORT_DIR"

echo -e "${GREEN}=== VolumeViz Performance Testing ===${NC}"
echo "API URL: $API_URL"
echo "Concurrent Users: $CONCURRENT_USERS"
echo "Test Duration: $DURATION"
echo ""

# Check if k6 is installed
if ! command -v k6 &> /dev/null; then
    echo -e "${YELLOW}Warning: k6 is not installed. Installing...${NC}"
    
    # Detect OS and install k6
    if [[ "$OSTYPE" == "darwin"* ]]; then
        brew install k6
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        sudo gpg -k
        sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
        echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
        sudo apt-get update
        sudo apt-get install k6
    else
        echo -e "${RED}Error: Unsupported OS. Please install k6 manually.${NC}"
        exit 1
    fi
fi

# Create k6 test script
cat > "$REPORT_DIR/volumeviz-perf-test.js" << 'EOF'
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const volumeListDuration = new Trend('volume_list_duration', true);
const volumeDetailDuration = new Trend('volume_detail_duration', true);
const healthCheckDuration = new Trend('health_check_duration', true);
const scanDuration = new Trend('scan_duration', true);

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: __ENV.CONCURRENT_USERS || 10 }, // Ramp up
    { duration: __ENV.DURATION || '60s', target: __ENV.CONCURRENT_USERS || 10 }, // Stay at target
    { duration: '30s', target: 0 }, // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'], // 95% of requests under 500ms
    http_req_failed: ['rate<0.1'], // Error rate under 10%
    errors: ['rate<0.1'], // Custom error rate under 10%
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:8080/api/v1';

// Helper function to make requests with error handling
function makeRequest(name, url, params = {}) {
  const startTime = new Date();
  const res = http.get(url, params);
  const duration = new Date() - startTime;
  
  const success = check(res, {
    [`${name} status is 200`]: (r) => r.status === 200,
    [`${name} response time OK`]: (r) => r.timings.duration < 1000,
  });
  
  errorRate.add(!success);
  
  return { response: res, duration: duration };
}

export default function () {
  // Test 1: Health check
  const healthStart = new Date();
  const healthRes = http.get(`${BASE_URL}/health`);
  healthCheckDuration.add(new Date() - healthStart);
  
  check(healthRes, {
    'Health check status is 200': (r) => r.status === 200,
  });
  
  sleep(1);
  
  // Test 2: List volumes
  const listStart = new Date();
  const listRes = http.get(`${BASE_URL}/volumes?page=1&page_size=25`);
  volumeListDuration.add(new Date() - listStart);
  
  const listSuccess = check(listRes, {
    'Volume list status is 200': (r) => r.status === 200,
    'Volume list has data': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.data && Array.isArray(body.data);
      } catch (e) {
        return false;
      }
    },
  });
  
  errorRate.add(!listSuccess);
  
  sleep(1);
  
  // Test 3: Get volume details (if volumes exist)
  try {
    const listBody = JSON.parse(listRes.body);
    if (listBody.data && listBody.data.length > 0) {
      const volumeId = listBody.data[0].id;
      
      const detailStart = new Date();
      const detailRes = http.get(`${BASE_URL}/volumes/${volumeId}`);
      volumeDetailDuration.add(new Date() - detailStart);
      
      const detailSuccess = check(detailRes, {
        'Volume detail status is 200': (r) => r.status === 200,
        'Volume detail has data': (r) => {
          try {
            const body = JSON.parse(r.body);
            return body.data && body.data.id === volumeId;
          } catch (e) {
            return false;
          }
        },
      });
      
      errorRate.add(!detailSuccess);
    }
  } catch (e) {
    console.error('Error parsing volume list response:', e);
  }
  
  sleep(1);
  
  // Test 4: WebSocket connection (if enabled)
  if (__ENV.TEST_WEBSOCKET === 'true') {
    const wsUrl = BASE_URL.replace('http', 'ws') + '/ws';
    try {
      const ws = new WebSocket(wsUrl);
      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'ping' }));
        ws.close();
      };
    } catch (e) {
      console.error('WebSocket test failed:', e);
    }
  }
  
  // Random sleep between 1-3 seconds to simulate real user behavior
  sleep(Math.random() * 2 + 1);
}

// Summary handler
export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    './performance-reports/summary.json': JSON.stringify(data),
    './performance-reports/summary.html': htmlReport(data),
  };
}

// Text summary function
function textSummary(data, options) {
  const { metrics } = data;
  
  let summary = '\n=== Performance Test Results ===\n\n';
  
  // Request metrics
  summary += 'HTTP Requests:\n';
  summary += `  Total: ${metrics.http_reqs.values.count}\n`;
  summary += `  Rate: ${metrics.http_reqs.values.rate.toFixed(2)}/s\n`;
  summary += `  Failed: ${(metrics.http_req_failed.values.rate * 100).toFixed(2)}%\n`;
  summary += `  Duration (p95): ${metrics.http_req_duration.values['p(95)'].toFixed(2)}ms\n`;
  summary += `  Duration (p99): ${metrics.http_req_duration.values['p(99)'].toFixed(2)}ms\n\n`;
  
  // Custom metrics
  summary += 'Endpoint Performance:\n';
  summary += `  Health Check (avg): ${metrics.health_check_duration.values.avg.toFixed(2)}ms\n`;
  summary += `  Volume List (avg): ${metrics.volume_list_duration.values.avg.toFixed(2)}ms\n`;
  summary += `  Volume Detail (avg): ${metrics.volume_detail_duration.values.avg.toFixed(2)}ms\n\n`;
  
  // Virtual users
  summary += 'Virtual Users:\n';
  summary += `  Max: ${metrics.vus_max.values.value}\n`;
  summary += `  Active (avg): ${metrics.vus.values.value}\n\n`;
  
  // Data transfer
  summary += 'Data Transfer:\n';
  summary += `  Received: ${(metrics.data_received.values.count / 1024 / 1024).toFixed(2)} MB\n`;
  summary += `  Sent: ${(metrics.data_sent.values.count / 1024 / 1024).toFixed(2)} MB\n`;
  
  return summary;
}

// HTML report function
function htmlReport(data) {
  const { metrics } = data;
  
  return `
<!DOCTYPE html>
<html>
<head>
    <title>VolumeViz Performance Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        h1 { color: #333; }
        table { border-collapse: collapse; width: 100%; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .good { color: green; }
        .bad { color: red; }
        .metric-card { background: #f8f9fa; padding: 15px; margin: 10px 0; border-radius: 5px; }
    </style>
</head>
<body>
    <h1>VolumeViz Performance Test Report</h1>
    <p>Generated: ${new Date().toISOString()}</p>
    
    <div class="metric-card">
        <h2>Summary</h2>
        <p>Total Requests: ${metrics.http_reqs.values.count}</p>
        <p>Request Rate: ${metrics.http_reqs.values.rate.toFixed(2)}/s</p>
        <p class="${metrics.http_req_failed.values.rate < 0.1 ? 'good' : 'bad'}">
            Failed Requests: ${(metrics.http_req_failed.values.rate * 100).toFixed(2)}%
        </p>
    </div>
    
    <h2>Response Times</h2>
    <table>
        <tr>
            <th>Metric</th>
            <th>Average</th>
            <th>Min</th>
            <th>Max</th>
            <th>P95</th>
            <th>P99</th>
        </tr>
        <tr>
            <td>Overall</td>
            <td>${metrics.http_req_duration.values.avg.toFixed(2)}ms</td>
            <td>${metrics.http_req_duration.values.min.toFixed(2)}ms</td>
            <td>${metrics.http_req_duration.values.max.toFixed(2)}ms</td>
            <td class="${metrics.http_req_duration.values['p(95)'] < 500 ? 'good' : 'bad'}">
                ${metrics.http_req_duration.values['p(95)'].toFixed(2)}ms
            </td>
            <td class="${metrics.http_req_duration.values['p(99)'] < 1000 ? 'good' : 'bad'}">
                ${metrics.http_req_duration.values['p(99)'].toFixed(2)}ms
            </td>
        </tr>
    </table>
    
    <h2>Endpoint Performance</h2>
    <table>
        <tr>
            <th>Endpoint</th>
            <th>Average Response Time</th>
            <th>Min</th>
            <th>Max</th>
        </tr>
        <tr>
            <td>Health Check</td>
            <td>${metrics.health_check_duration.values.avg.toFixed(2)}ms</td>
            <td>${metrics.health_check_duration.values.min.toFixed(2)}ms</td>
            <td>${metrics.health_check_duration.values.max.toFixed(2)}ms</td>
        </tr>
        <tr>
            <td>Volume List</td>
            <td>${metrics.volume_list_duration.values.avg.toFixed(2)}ms</td>
            <td>${metrics.volume_list_duration.values.min.toFixed(2)}ms</td>
            <td>${metrics.volume_list_duration.values.max.toFixed(2)}ms</td>
        </tr>
        <tr>
            <td>Volume Detail</td>
            <td>${metrics.volume_detail_duration.values.avg.toFixed(2)}ms</td>
            <td>${metrics.volume_detail_duration.values.min.toFixed(2)}ms</td>
            <td>${metrics.volume_detail_duration.values.max.toFixed(2)}ms</td>
        </tr>
    </table>
</body>
</html>
  `;
}
EOF

# Run performance test
echo -e "${GREEN}Starting performance test...${NC}"
k6 run \
  -e API_URL="$API_URL" \
  -e CONCURRENT_USERS="$CONCURRENT_USERS" \
  -e DURATION="$DURATION" \
  --out json="$REPORT_DIR/results.json" \
  "$REPORT_DIR/volumeviz-perf-test.js"

# Check if test passed
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Performance test completed successfully${NC}"
    echo "Reports generated in: $REPORT_DIR/"
    echo ""
    echo "View results:"
    echo "  - Summary: $REPORT_DIR/summary.json"
    echo "  - HTML Report: $REPORT_DIR/summary.html"
    echo "  - Raw Data: $REPORT_DIR/results.json"
else
    echo -e "${RED}✗ Performance test failed${NC}"
    exit 1
fi

# Optional: Open HTML report in browser
if command -v open &> /dev/null; then
    open "$REPORT_DIR/summary.html"
elif command -v xdg-open &> /dev/null; then
    xdg-open "$REPORT_DIR/summary.html"
fi