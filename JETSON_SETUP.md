# Jetson Volume Control Setup Guide

## Automatic Setup
Run the automated setup script:
```bash
./setup_jetson.sh
```
**Note:** Edit the script first to replace `your-username` with your actual Jetson username.

## Manual Setup

### Step 1: Copy files to Jetson
```bash
scp -r src/backend/ your-username@192.168.0.101:~/holo-backend/
```

### Step 2: SSH into Jetson
```bash
ssh your-username@192.168.0.101
```
Password: `Sakar@123`

### Step 3: Install dependencies on Jetson
```bash
cd ~/holo-backend

# Install system dependencies
sudo apt-get update
sudo apt-get install -y python3 python3-pip libasound2-dev

# Install Python dependencies
pip3 install -r requirements.txt
```

### Step 4: Start the API server
```bash
# Make script executable
chmod +x run_api.sh

# Run the server
./run_api.sh
```

### Step 5: Test the connection
The API will be available at: `http://192.168.0.101:5000`
API documentation: `http://192.168.0.101:5000/docs`

### Step 6: Test from your PC
Start your React development server:
```bash
npm run dev
# or
bun dev
```

## Troubleshooting

### If volume control doesn't work:
1. Check if ALSA is installed on Jetson:
   ```bash
   sudo apt-get install alsa-utils
   ```

2. Test audio devices:
   ```bash
   aplay -l  # List audio devices
   amixer    # List mixers
   ```

3. Check API logs:
   ```bash
   tail -f ~/holo-backend/api.log
   ```

### If connection fails:
1. Verify Jetson IP address: `ip addr show`
2. Check firewall: `sudo ufw status`
3. Test API directly: `curl http://192.168.0.101:5000/volume`
