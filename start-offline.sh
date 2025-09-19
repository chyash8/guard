#!/bin/bash

# Start the backend server (FastAPI)
cd /home/jetson/sakar/holo-guide-interface/src/backend
python3 -m uvicorn main:app --reload --host 127.0.0.1 --port 5000 &
BACKEND_PID=$!

# Wait for backend to start
echo "Waiting for backend to start..."
sleep 3

# Start the frontend development server
cd /home/jetson/sakar/holo-guide-interface
npm run dev &
FRONTEND_PID=$!

# Function to handle cleanup
cleanup() {
    echo "Stopping servers..."
    kill $BACKEND_PID
    kill $FRONTEND_PID
    exit 0
}

# Set up signal handling
trap cleanup SIGINT SIGTERM

# Keep script running
wait