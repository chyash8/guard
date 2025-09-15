#!/bin/bash

JETSON_IP="192.168.0.101"
JETSON_USER="jet"

echo "🚀 Starting Jetson Backend..."
echo "1. SSH into Jetson..."

# SSH into Jetson and run the commands
ssh -t ${JETSON_USER}@${JETSON_IP} "cd ~/holo-guide-interface/src/backend && sudo systemctl restart bluetooth && python3 app.py"

echo "✅ Backend should now be running on Jetson"
