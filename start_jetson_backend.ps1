$jetsonIp = "192.168.0.101"
$jetsonUser = "jetson"

Write-Host "Starting Jetson Backend..."
Write-Host "1. SSH into Jetson..."

# SSH into Jetson and run the commands
ssh -t $jetsonUser@$jetsonIp "cd ~/holo-guide-interface/src/backend && sudo systemctl restart bluetooth && python3 app.py"

Write-Host "✅ Backend should now be running on Jetson"
