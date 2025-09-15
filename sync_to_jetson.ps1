$jetsonIp = "192.168.0.101"
$jetsonUser = "jetson"

Write-Host "Syncing code to Jetson..."
Write-Host "1. Creating backend directory on Jetson..."

# Ensure the directory exists on Jetson
ssh $jetsonUser@$jetsonIp "mkdir -p ~/holo-guide-interface/src/backend"

# Copy backend files
Write-Host "2. Copying backend files..."
scp ./src/backend/app.py ./src/backend/requirements.txt $jetsonUser@$jetsonIp`:~/holo-guide-interface/src/backend/

Write-Host "3. Installing Python dependencies..."
ssh -t $jetsonUser@$jetsonIp "cd ~/holo-guide-interface/src/backend && pip3 install -r requirements.txt"

Write-Host "Code sync complete! You can now run start_jetson_backend.ps1 to start the backend."
