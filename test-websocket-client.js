#!/usr/bin/env node

const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:8080/api/v1/ws');

ws.on('open', function open() {
    console.log('=== WebSocket Connected ===');
    
    // Subscribe to scan progress
    const subscribeMessage = {
        type: 'subscribe',
        data: {
            event: 'scan_progress',
            filters: {}  // Subscribe to all scan progress
        }
    };
    
    console.log('Sending subscription:', JSON.stringify(subscribeMessage, null, 2));
    ws.send(JSON.stringify(subscribeMessage));
});

ws.on('message', function message(data) {
    try {
        const msg = JSON.parse(data.toString());
        console.log('\n=== Received WebSocket Message ===');
        console.log('Type:', msg.type);
        console.log('Volume ID:', msg.volume_id);
        console.log('Timestamp:', msg.timestamp);
        
        if (msg.type === 'scan_progress_update') {
            console.log('Scan Progress Data:');
            console.log('- Scan ID:', msg.data.scan_id);
            console.log('- Volume ID:', msg.data.volume_id);
            console.log('- Overall Status:', msg.data.overall_status);
            console.log('- Overall Progress:', msg.data.overall_progress + '%');
            console.log('- Number of Phases:', msg.data.phases.length);
            
            msg.data.phases.forEach((phase, i) => {
                console.log(`  Phase ${i + 1}: ${phase.phase_name} - ${phase.status} (${phase.progress}%)`);
            });
        } else {
            console.log('Full message:', JSON.stringify(msg, null, 2));
        }
        console.log('=============================\n');
    } catch (err) {
        console.error('Failed to parse message:', err);
        console.log('Raw message:', data.toString());
    }
});

ws.on('error', function error(err) {
    console.error('WebSocket error:', err);
});

ws.on('close', function close() {
    console.log('WebSocket connection closed');
});

console.log('Connecting to WebSocket at ws://localhost:8080/api/v1/ws');
console.log('Press Ctrl+C to exit');