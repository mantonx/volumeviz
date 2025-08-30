// Simple WebSocket test without external dependencies
const url = require('url');
const http = require('http');
const crypto = require('crypto');

function createWebSocketClient(wsUrl, onMessage) {
    const parsedUrl = new URL(wsUrl);
    
    // Generate WebSocket key
    const key = crypto.randomBytes(16).toString('base64');
    
    const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || 80,
        path: parsedUrl.pathname,
        headers: {
            'Upgrade': 'websocket',
            'Connection': 'Upgrade',
            'Sec-WebSocket-Key': key,
            'Sec-WebSocket-Version': '13'
        }
    };
    
    const req = http.request(options);
    
    req.on('upgrade', (res, socket, head) => {
        console.log('WebSocket upgraded successfully');
        
        // Subscribe message
        const subscribeMessage = JSON.stringify({
            type: 'subscribe',
            data: {
                event: 'scan_progress',
                filters: {}
            }
        });
        
        // Create WebSocket frame for text message
        const messageBuffer = Buffer.from(subscribeMessage);
        const frame = Buffer.allocUnsafe(2 + 4 + messageBuffer.length);
        
        // FIN bit + text frame opcode
        frame[0] = 0x81;
        // Mask bit + length
        frame[1] = 0x80 | (messageBuffer.length < 126 ? messageBuffer.length : 126);
        
        // Masking key
        const maskingKey = crypto.randomBytes(4);
        maskingKey.copy(frame, 2);
        
        // Masked payload
        for (let i = 0; i < messageBuffer.length; i++) {
            frame[6 + i] = messageBuffer[i] ^ maskingKey[i % 4];
        }
        
        socket.write(frame);
        console.log('Sent subscription message');
        
        socket.on('data', (data) => {
            try {
                // Simple frame parsing - assumes complete frames
                if (data[0] === 0x81) { // Text frame
                    const length = data[1] & 0x7F;
                    if (length < 126) {
                        const message = data.slice(2, 2 + length).toString();
                        onMessage(message);
                    } else {
                        console.log('Long frames not implemented in this simple client');
                    }
                }
            } catch (err) {
                console.error('Error parsing WebSocket frame:', err);
            }
        });
        
        socket.on('error', (err) => {
            console.error('Socket error:', err);
        });
        
        socket.on('close', () => {
            console.log('Socket closed');
        });
    });
    
    req.on('error', (err) => {
        console.error('Request error:', err);
    });
    
    req.end();
}

// Test the WebSocket
console.log('Testing WebSocket connection...');

createWebSocketClient('ws://localhost:8080/api/v1/ws', (message) => {
    try {
        const msg = JSON.parse(message);
        console.log('\n=== WebSocket Message ===');
        console.log('Type:', msg.type);
        if (msg.volume_id) console.log('Volume ID:', msg.volume_id);
        if (msg.data && msg.data.scan_id) console.log('Scan ID:', msg.data.scan_id);
        if (msg.data && msg.data.overall_progress !== undefined) {
            console.log('Progress:', msg.data.overall_progress + '%');
        }
        console.log('========================\n');
    } catch (err) {
        console.error('Failed to parse message:', err);
        console.log('Raw message:', message);
    }
});