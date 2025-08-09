#!/bin/bash
#
# Test script to verify smoke test improvements locally
#

set -euo pipefail

echo "🧪 Testing smoke test script locally..."

# Set test environment
export DB_TYPE=postgres
export DB_HOST=localhost
export DB_PORT=5432
export DB_USER=volumeviz
export DB_PASSWORD=volumeviz
export DB_NAME=volumeviz
export DB_SSLMODE=disable
export LOG_LEVEL=debug
export API_PORT=0  # Use dynamic port
export SMOKE_TIMEOUT=30
export HEALTH_RETRIES=15

# Ensure script is executable
chmod +x ./scripts/smoke-test.sh

# Run the smoke test
echo "Running smoke test with dynamic port selection..."
./scripts/smoke-test.sh

echo "✅ Smoke test completed successfully!"