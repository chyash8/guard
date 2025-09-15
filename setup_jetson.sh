#!/bin/bash

# Configuration
JETSON_IP="192.168.0.101"
JETSON_USER="jetson"  # Replace with your Jetson username
JETSON_PASSWORD="Sakar@123"

echo "Setting up Jetson volume control backend..."

# Check if sshpass is installed
if ! command -v sshpass &> /dev/null; then
    echo "Installing sshpass for automated SSH..."
    sudo apt-get update && sudo apt-get install -y sshpass
fi

# Copy backend files to Jetson
echo "Copying backend files to Jetson..."
sshpass -p "$JETSON_PASSWORD" scp -r src/backend/ $JETSON_USER@$JETSON_IP:~/holo-backend/

# Connect to Jetson and set up the backend
echo "Setting up backend on Jetson..."
sshpass -p "$JETSON_PASSWORD" ssh $JETSON_USER@$JETSON_IP << 'EOF'
cd ~/holo-backend

# Make sure Python3 and pip are installed
sudo apt-get update
sudo apt-get install -y python3 python3-pip libasound2-dev

# Install Python dependencies
pip3 install -r requirements.txt

# Make the run script executable
chmod +x run_api.sh

# Start the API server in the background
echo "Starting FastAPI server..."
nohup ./run_api.sh > api.log 2>&1 &

# Wait a moment for the server to start
sleep 3

# Check if the server is running
if curl -s http://localhost:5000/docs > /dev/null; then
    echo "✅ API server is running successfully!"
    echo "📊 You can check the API docs at: http://192.168.0.101:5000/docs"
else
    echo "❌ API server failed to start. Check the logs:"
    cat api.log
fi
EOF

echo "Setup complete! Your Jetson should now be ready for volume control."
echo "Test the connection by running your React app and trying the volume controls."
