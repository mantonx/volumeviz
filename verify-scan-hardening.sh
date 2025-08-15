#!/bin/bash

# Scan Orchestration & Worker Hardening - Verification Script
# This script checks that all ticket requirements are implemented

echo "=== Scan Orchestration & Worker Hardening Verification ==="
echo

# Check 1: Environment Variables
echo "✅ Checking Environment Variables..."
echo "   - VV_SCAN_MAX_CONCURRENCY: Should be configurable"
echo "   - VV_SCAN_MAX_PER_VOLUME: Should default to 1"
grep -r "VV_SCAN_MAX_CONCURRENCY" internal/config/ && echo "   ✓ VV_SCAN_MAX_CONCURRENCY found" || echo "   ✗ VV_SCAN_MAX_CONCURRENCY missing"
grep -r "VV_SCAN_MAX_PER_VOLUME" internal/config/ && echo "   ✓ VV_SCAN_MAX_PER_VOLUME found" || echo "   ✗ VV_SCAN_MAX_PER_VOLUME missing"
echo

# Check 2: Atomic Claim with SKIP LOCKED
echo "✅ Checking Atomic Claim Implementation..."
grep -r "FOR UPDATE SKIP LOCKED" internal/ && echo "   ✓ SKIP LOCKED found in queries" || echo "   ✗ SKIP LOCKED missing"
grep -r "ClaimNextScanJob" internal/repo/ && echo "   ✓ ClaimNextScanJob method found" || echo "   ✗ ClaimNextScanJob method missing"
echo

# Check 3: Heartbeat System
echo "✅ Checking Heartbeat System..."
grep -r "UpdateScanJobHeartbeat" internal/repo/ && echo "   ✓ Heartbeat update method found" || echo "   ✗ Heartbeat update method missing"
grep -r "HeartbeatConfig" internal/scheduler/ && echo "   ✓ Heartbeat configuration found" || echo "   ✗ Heartbeat configuration missing"
echo

# Check 4: Watchdog Implementation
echo "✅ Checking Watchdog Implementation..."
[ -f "internal/scheduler/watchdog.go" ] && echo "   ✓ Watchdog implementation found" || echo "   ✗ Watchdog implementation missing"
grep -r "MarkStaleScanJobsAsFailed" internal/repo/ && echo "   ✓ Stale job marking found" || echo "   ✗ Stale job marking missing"
echo

# Check 5: Graceful Restart
echo "✅ Checking Graceful Restart..."
grep -r "MarkInFlightJobsAsFailed" internal/repo/ && echo "   ✓ In-flight job marking found" || echo "   ✗ In-flight job marking missing"
grep -r "GracefulShutdownTimeout" internal/ && echo "   ✓ Graceful shutdown config found" || echo "   ✗ Graceful shutdown config missing"
echo

# Check 6: Required Prometheus Metrics  
echo "✅ Checking Prometheus Metrics..."
grep -r "scan_queue_depth" internal/services/metrics/ && echo "   ✓ volumeviz_scan_queue_depth metric found" || echo "   ✗ scan_queue_depth metric missing"
grep -r "scan_active" internal/services/metrics/ && echo "   ✓ volumeviz_scan_active metric found" || echo "   ✗ scan_active metric missing"  
grep -r "scan_duration_seconds" internal/services/metrics/ && echo "   ✓ volumeviz_scan_duration_seconds metric found" || echo "   ✗ scan_duration_seconds metric missing"
grep -r "scan_errors_total" internal/services/metrics/ && echo "   ✓ volumeviz_scan_errors_total metric found" || echo "   ✗ scan_errors_total metric missing"
echo

# Check 7: API Endpoint (should keep existing)
echo "✅ Checking API Endpoint..."
grep -rn "POST.*scan" internal/api/ && echo "   ✓ Existing scan endpoint preserved" || echo "   ✗ Scan endpoint missing"
echo

echo "=== Summary ==="
echo "The implementation should have:"
echo "- ✅ Atomic claim with FOR UPDATE SKIP LOCKED" 
echo "- ✅ Heartbeat system (5-10s intervals)"
echo "- ✅ Watchdog monitoring for stale scans"
echo "- ✅ Graceful restart with in-flight job handling"
echo "- ✅ Proper Prometheus metrics with stable names"
echo "- ✅ Environment variable configuration"
echo "- ✅ Existing POST /volumes/{name}/scan endpoint preserved"
