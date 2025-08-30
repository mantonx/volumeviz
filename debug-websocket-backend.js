#!/usr/bin/env node

const WebSocket = require('ws');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(color, prefix, message) {
  const timestamp = new Date().toISOString();
  console.log(`${colors[color]}[${timestamp}] ${prefix}:${colors.reset} ${message}`);
}

function logMessage(prefix, data) {
  log('cyan', prefix, JSON.stringify(data, null, 2));
}

// Connect to WebSocket
const ws = new WebSocket('ws://localhost:8080/api/v1/ws');
let messageCount = 0;
let lastProgressUpdate = null;
let stats = {
  total: 0,
  scanProgress: 0,
  scanStarted: 0,
  scanComplete: 0,
  volumeUpdates: 0,
  other: 0
};

ws.on('open', function open() {
  log('green', 'CONNECTION', 'Connected to WebSocket server');
  
  // Subscribe to scan progress
  const subscribeMessage = {
    type: 'subscribe',
    data: {
      event: 'scan_progress',
      filters: {
        volume_id: 'volumeviz_movies_dev'
      }
    }
  };
  
  ws.send(JSON.stringify(subscribeMessage));
  log('blue', 'SUBSCRIBE', `Sent subscription: ${JSON.stringify(subscribeMessage)}`);
});

ws.on('message', function message(data) {
  try {
    const parsed = JSON.parse(data);
    messageCount++;
    
    // Update stats
    stats.total++;
    
    if (parsed.type === 'scan_progress_update') {
      stats.scanProgress++;
      lastProgressUpdate = new Date();
    } else if (parsed.type === 'scan_started') {
      stats.scanStarted++;
    } else if (parsed.type === 'scan_complete') {
      stats.scanComplete++;
    } else if (parsed.type === 'volume_updates') {
      stats.volumeUpdates++;
    } else {
      stats.other++;
    }
    
    log('yellow', `MSG #${messageCount}`, `Type: ${parsed.type}`);
    
    if (parsed.data) {
      if (parsed.data.volume_id) {
        log('magenta', 'VOLUME', parsed.data.volume_id);
      }
      if (parsed.data.scan_id) {
        log('magenta', 'SCAN ID', parsed.data.scan_id.slice(0, 8));
      }
      if (parsed.data.overall_progress !== undefined) {
        log('green', 'PROGRESS', `${parsed.data.overall_progress}%`);
      }
    }
    
    // Full message for debugging
    if (process.env.VERBOSE) {
      logMessage('FULL MSG', parsed);
    }
    
  } catch (error) {
    log('red', 'ERROR', `Failed to parse message: ${error.message}`);
    console.log('Raw data:', data.toString());
  }
});

ws.on('error', function error(err) {
  log('red', 'WS ERROR', err.message);
});

ws.on('close', function close() {
  log('red', 'CONNECTION', 'WebSocket connection closed');
  printStats();
});

// Print stats periodically
setInterval(() => {
  printStats();
}, 10000);

function printStats() {
  console.log('\n' + colors.bright + '=== WebSocket Debug Statistics ===' + colors.reset);
  console.log(`Total Messages: ${stats.total}`);
  console.log(`Scan Progress Updates: ${stats.scanProgress}`);
  console.log(`Scan Started: ${stats.scanStarted}`);
  console.log(`Scan Complete: ${stats.scanComplete}`);
  console.log(`Volume Updates: ${stats.volumeUpdates}`);
  console.log(`Other: ${stats.other}`);
  
  if (lastProgressUpdate) {
    const secondsSinceLastProgress = Math.round((new Date() - lastProgressUpdate) / 1000);
    console.log(`Last Progress Update: ${secondsSinceLastProgress}s ago`);
  }
  console.log('================================\n');
}

// Trigger a scan after connecting
setTimeout(() => {
  if (ws.readyState === WebSocket.OPEN) {
    log('blue', 'ACTION', 'Triggering test scan...');
    
    // Using curl to trigger scan
    const { spawn } = require('child_process');
    const curl = spawn('curl', [
      '-X', 'POST',
      'http://localhost:8080/api/v1/volumes/volumeviz_movies_dev/scan',
      '-H', 'Content-Type: application/json'
    ]);
    
    curl.on('close', (code) => {
      log('blue', 'SCAN', `Scan trigger completed with code ${code}`);
    });
  }
}, 2000);

// Handle process termination
process.on('SIGINT', () => {
  log('yellow', 'SHUTDOWN', 'Closing WebSocket connection...');
  ws.close();
  process.exit(0);
});

console.log(colors.bright + 'WebSocket Debug Client Started' + colors.reset);
console.log('Press Ctrl+C to exit');
console.log('Set VERBOSE=1 to see full message details\n');