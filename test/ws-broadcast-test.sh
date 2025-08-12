#!/bin/bash
# Test WebSocket broadcasting with multiple clients

echo "WebSocket Broadcast Test"
echo "========================"
echo ""
echo "This test will:"
echo "1. Start 3 WebSocket clients"
echo "2. Trigger a broadcast message via curl"
echo "3. Verify all clients receive the message"
echo ""

# Check if server is running
if ! curl -s http://localhost:8080/api/v1/health > /dev/null 2>&1; then
    echo "Error: VolumeViz server is not running on localhost:8080"
    echo "Please start the server first with: go run cmd/server/main.go"
    exit 1
fi

# Create temp directory for client outputs
TMPDIR=$(mktemp -d)
trap "rm -rf $TMPDIR" EXIT

echo "Starting 3 WebSocket clients..."
echo ""

# Start clients in background
for i in 1 2 3; do
    echo "Starting client $i..."
    go run test/ws-client-test.go > "$TMPDIR/client$i.log" 2>&1 &
    PIDS[$i]=$!
done

# Give clients time to connect
sleep 2

echo ""
echo "Clients connected. Now triggering a volume scan to generate broadcast messages..."
echo ""

# Get a volume to scan
VOLUME=$(curl -s http://localhost:8080/api/v1/volumes | jq -r '.data[0].name // empty')

if [ -z "$VOLUME" ]; then
    echo "No volumes found. Creating a test volume..."
    docker volume create volumeviz-test-volume
    VOLUME="volumeviz-test-volume"
fi

echo "Scanning volume: $VOLUME"
echo ""

# Trigger a scan which will broadcast progress messages
SCAN_RESPONSE=$(curl -s -X POST "http://localhost:8080/api/v1/volumes/$VOLUME/scan")
echo "Scan initiated: $SCAN_RESPONSE"
echo ""

# Wait for messages
echo "Waiting 5 seconds for broadcast messages..."
sleep 5

# Check client logs
echo ""
echo "Client outputs:"
echo "==============="
for i in 1 2 3; do
    echo ""
    echo "Client $i messages:"
    echo "-------------------"
    grep -E "(Received message:|scan_progress|scan_complete)" "$TMPDIR/client$i.log" | tail -10
done

# Cleanup
echo ""
echo "Stopping clients..."
for pid in ${PIDS[@]}; do
    kill $pid 2>/dev/null
done

# Remove test volume if we created it
if [ "$VOLUME" = "volumeviz-test-volume" ]; then
    docker volume rm volumeviz-test-volume 2>/dev/null
fi

echo ""
echo "Test complete!"