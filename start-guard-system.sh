#!/bin/bash
 
# Guard System Startup Script
# This script starts both the VoIP listener and Guard dashboard
 
echo "🚀 Starting Guard System..."
 
# Check if we're on Jetson (by checking for tvoip directory)
if [ ! -d "$HOME/tvoip" ]; then
    echo "❌ Error: ~/tvoip directory not found"
    echo "Make sure you're running this on the Jetson device"
    exit 1
fi
 
# Check if port 3333 is already in use by our VoIP listener
if ps aux | grep "node index.js --listen 3333" | grep -v grep > /dev/null; then
    echo "✅ VoIP listener already running on port 3333"
    VOIP_PID=$(ps aux | grep "node index.js --listen 3333" | grep -v grep | awk '{print $2}')
    echo "✅ VoIP listener PID: $VOIP_PID"
else
    # Start VoIP listener in background
    echo "🎤 Starting VoIP listener on port 3333..."
    cd ~/tvoip
    nohup node index.js --listen 3333 --input hw:2,0 --output hw:2,0 > voip.log 2>&1 &
    VOIP_PID=$!
 
    # Wait a moment and check if VoIP started successfully
    sleep 3
    if ps -p $VOIP_PID > /dev/null; then
        echo "✅ VoIP listener started successfully (PID: $VOIP_PID)"
    else
        echo "❌ Failed to start VoIP listener"
        echo "Check ~/tvoip/voip.log for errors"
        exit 1
    fi
fi
 
# Return to guard directory and start Vite development server
echo "🌐 Starting Guard dashboard..."
cd "$(dirname "$0")"
echo "📍 Guard dashboard will be available at: http://localhost:8080"
echo "🔗 Connecting to main dashboard at: http://192.168.0.206:3004"
echo ""
echo "Press Ctrl+C to stop both services"
 
# Start Vite (this will run in foreground)
npm run dev:vite-only
 
 