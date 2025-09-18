from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import subprocess
import asyncio
import time
from bleak import BleakScanner, BleakClient
import screen_brightness_control as sbc
import alsaaudio
import socketio

# --------------------------
# Setup: Socket.IO + FastAPI
# --------------------------

sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins='*')
fastapi_app = FastAPI(title="Jetson + Device API")

# CORS middleware
fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Final ASGI application
app = socketio.ASGIApp(sio, fastapi_app)

# --------------------------
# Models
# --------------------------

class ToggleRequest(BaseModel):
    state: str

class VoiceChatRequest(BaseModel):
    action: str  # 'start' or 'stop'

class ConnectRequest(BaseModel):
    address: str

class VolumeRequest(BaseModel):
    volume: int

# --------------------------
# Audio
# --------------------------

def get_mixer():
    try:
        return alsaaudio.Mixer('PCM', cardindex=0)
    except:
        try:
            return alsaaudio.Mixer('Master', cardindex=0)
        except:
            mixers = alsaaudio.mixers()
            if mixers:
                return alsaaudio.Mixer(mixers[0])
            raise Exception("No audio mixers found")

@fastapi_app.get("/volume")
async def get_volume():
    try:
        mixer = get_mixer()
        try:
            volumes = mixer.getvolume()
        except AttributeError:
            volumes = [mixer.getvol()[0]]
        return {
            "volume": volumes[0],
            "mixer": mixer.mixer(),
            "card": mixer.cardname()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@fastapi_app.post("/volume")
async def set_volume(request: VolumeRequest):
    try:
        volume = max(0, min(100, request.volume))
        mixer = get_mixer()
        try:
            mixer.setvolume(volume)
        except AttributeError:
            mixer.setvol(volume)
        return {"success": True, "volume": volume}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --------------------------
# Bluetooth
# --------------------------

def safe_bt_command(cmd, timeout=5):
    """Safely run a bluetooth command with proper error handling"""
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        if result.returncode == 0:
            return result
    except subprocess.TimeoutExpired:
        print(f"Command timed out: {cmd}")
    except subprocess.CalledProcessError as e:
        print(f"Command failed: {cmd}, error: {e}")
    except Exception as e:
        print(f"Unexpected error running command: {cmd}, error: {e}")
    return None

def safe_disconnect_device(address):
    """Safely disconnect a bluetooth device with proper error handling"""
    try:
        # Try normal disconnect first
        result = safe_bt_command(["bluetoothctl", "disconnect", address], timeout=5)
        if result and "successful" in result.stdout.lower():
            return True
            
        # If that fails, try power cycling
        safe_bt_command(["bluetoothctl", "power", "off"], timeout=3)
        time.sleep(1)
        safe_bt_command(["bluetoothctl", "power", "on"], timeout=3)
        time.sleep(1)
        
        # Try disconnect again
        result = safe_bt_command(["bluetoothctl", "disconnect", address], timeout=5)
        if result and "successful" in result.stdout.lower():
            return True
            
        # If still not disconnected, try removing the device
        safe_bt_command(["bluetoothctl", "remove", address], timeout=5)
        return True
    except Exception as e:
        print(f"Error in safe_disconnect_device: {e}")
        return False

def bluetooth_on():
    try:
        # First unblock using rfkill
        subprocess.run(["rfkill", "unblock", "bluetooth"], check=True)
        
        # Start the bluetooth service
        subprocess.run(["systemctl", "start", "bluetooth"], check=True)
        time.sleep(2)  # Give time for the service to start
        
        # Turn on using bluetoothctl
        subprocess.run(["bluetoothctl", "power", "on"], check=True)
        time.sleep(1)  # Give time for power on
        
        # Verify the status
        status = bluetooth_status()
        if status != "on":
            raise Exception("Failed to turn Bluetooth on")
            
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}

def bluetooth_off():
    try:
        # First try to disconnect any connected devices
        try:
            result = subprocess.run(["bluetoothctl", "info"], capture_output=True, text=True)
            if "Connected: yes" in result.stdout:
                for line in result.stdout.splitlines():
                    if line.strip().startswith("Device "):
                        device_address = line.strip().split()[1]
                        subprocess.run(["bluetoothctl", "disconnect", device_address], 
                                    check=True, capture_output=True)
                time.sleep(1)  # Give time for disconnect
        except:
            pass  # Continue even if disconnect fails
            
        # Turn off using bluetoothctl
        subprocess.run(["bluetoothctl", "power", "off"], check=True)
        time.sleep(1)  # Give time for power off
        
        # Stop the bluetooth service
        subprocess.run(["systemctl", "stop", "bluetooth"], check=True)
        
        # Block using rfkill
        subprocess.run(["rfkill", "block", "bluetooth"], check=True)
        time.sleep(1)  # Give time for blocking
        
        # Verify the status
        status = bluetooth_status()
        if status != "off":
            raise Exception("Failed to turn Bluetooth off")
            
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}

def bluetooth_status():
    try:
        # First check bluetooth service status
        service_status = subprocess.run(
            ["systemctl", "is-active", "bluetooth"],
            capture_output=True,
            text=True
        ).stdout.strip()
        
        print(f"Bluetooth service status: {service_status}")
        
        if service_status != "active":
            print("Bluetooth service is not active")
            return "off"

        # Then check rfkill status
        rfkill_result = subprocess.run(
            ["rfkill", "list", "bluetooth"],
            capture_output=True,
            text=True
        )
        print(f"rfkill output: {rfkill_result.stdout}")
        
        if "Soft blocked: yes" in rfkill_result.stdout:
            print("Bluetooth is soft blocked")
            return "off"
            
        # Finally check bluetoothctl power status
        power_result = subprocess.run(
            ["bluetoothctl", "show"],
            capture_output=True,
            text=True
        )
        print(f"bluetoothctl show output: {power_result.stdout}")
        
        if "Powered: yes" in power_result.stdout:
            print("Bluetooth is powered on")
            return "on"
        elif "Powered: no" in power_result.stdout:
            print("Bluetooth is powered off")
            return "off"
            
        # If we can't determine the status definitively, check if adapter exists
        if "Controller" in power_result.stdout:
            print("Bluetooth controller found, assuming on")
            return "on"
            
        print("Unable to determine bluetooth status definitively")
        return "unknown"
    except Exception as e:
        print(f"Error checking bluetooth status: {e}")
        return "unknown"

# Global state management
discovered_devices = {}
last_scan_time = 0
SCAN_INTERVAL = 30  # Minimum seconds between full scans
active_scan_process = None
scanning_lock = asyncio.Lock()  # To prevent concurrent scan operations

def safe_run_sync(cmd, timeout=5, check=False):
    """Safely run a command synchronously with timeout"""
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout, check=check)
        return result
    except subprocess.TimeoutExpired:
        print(f"Command timed out: {cmd}")
        return None
    except subprocess.CalledProcessError as e:
        print(f"Command failed: {cmd}, error: {e}")
        return None
    except Exception as e:
        print(f"Unexpected error running command: {cmd}, error: {e}")
        return None

async def stop_active_scan():
    global active_scan_process
    if active_scan_process:
        try:
            # First try to stop scan via bluetoothctl
            subprocess.run(["bluetoothctl", "scan", "off"], check=True, timeout=5)
            # Then terminate the process if it's still running
            if active_scan_process.poll() is None:
                active_scan_process.terminate()
                await asyncio.sleep(0.5)
                if active_scan_process.poll() is None:
                    active_scan_process.kill()
            active_scan_process = None
        except Exception as e:
            print(f"Error stopping scan: {e}")

async def scan_devices(timeout: int = 5, force_scan: bool = False):
    global discovered_devices, last_scan_time, active_scan_process
    current_time = time.time()
    
    try:
        # Use the lock to prevent concurrent scans
        async with scanning_lock:
            # Return cached devices if scan interval hasn't elapsed
            if not force_scan and (current_time - last_scan_time) < SCAN_INTERVAL:
                return list(discovered_devices.values())
                
            # Stop any existing scan first
            await stop_active_scan()

            # Stop any ongoing scan
            subprocess.run(["bluetoothctl", "scan", "off"], capture_output=True)
            
            # Initialize devices dict
            bt_devices = {}
            
            # First attempt to get detailed device info using bluetoothctl
            try:
                subprocess.run(["bluetoothctl", "scan", "on"], timeout=2)  # Start brief scan
                result = subprocess.run(["bluetoothctl", "devices"], capture_output=True, text=True)
                
                for line in result.stdout.splitlines():
                    if line.startswith("Device"):
                        parts = line.split(" ", 2)  # Split into 3 parts: "Device", MAC, and Name
                        if len(parts) >= 2:
                            addr = parts[1]
                            name = parts[2] if len(parts) > 2 else None
                            bt_devices[addr] = {"name": name, "address": addr}
            except Exception as e:
                print(f"Bluetoothctl scan failed: {e}")

            try:
                # Then use BleakScanner for additional devices and details
                devices = await BleakScanner.discover(timeout=timeout)
                
                # Update discovered devices with new information
                for d in devices:
                    device_info = discovered_devices.get(d.address, {
                        "name": None,
                        "address": d.address,
                        "type": "Unknown",
                        "last_seen": 0
                    })
                    
                    # Update device info with new data
                    if d.name:
                        device_info["name"] = d.name
                    elif bt_devices.get(d.address, {}).get("name"):
                        device_info["name"] = bt_devices[d.address]["name"]
                    
                    # Try to determine device type from name if not already set
                    if device_info["type"] == "Unknown" and device_info["name"]:
                        name_lower = device_info["name"].lower()
                        if any(keyword in name_lower for keyword in ["headphone", "speaker", "audio"]):
                            device_info["type"] = "Audio Device"
                        elif "mouse" in name_lower:
                            device_info["type"] = "Mouse"
                        elif "keyboard" in name_lower:
                            device_info["type"] = "Keyboard"
                        elif "phone" in name_lower:
                            device_info["type"] = "Phone"
                        elif any(keyword in name_lower for keyword in ["watch", "band", "fit"]):
                            device_info["type"] = "Wearable"
                    
                    device_info["last_seen"] = current_time
                    discovered_devices[d.address] = device_info
                
                # Add any devices from bluetoothctl that weren't found by BleakScanner
                for addr, device in bt_devices.items():
                    if addr not in discovered_devices:
                        device["type"] = "Unknown"
                        device["last_seen"] = current_time
                        discovered_devices[addr] = device
                
                # Remove devices not seen in the last 5 minutes
                stale_time = current_time - 300  # 5 minutes
                discovered_devices = {
                    addr: dev for addr, dev in discovered_devices.items()
                    if dev["last_seen"] > stale_time
                }
                
                last_scan_time = current_time
                return list(discovered_devices.values())
                
            except Exception as e:
                print(f"Error during BleakScanner discovery: {e}")
                # If BleakScanner fails, return whatever devices we found from bluetoothctl
                return [device for device in bt_devices.values()]
                
    except Exception as e:
        print(f"Scan failed: {e}")
        raise HTTPException(status_code=500, detail=f"Scan failed: {str(e)}")

async def connect_device(address: str):
    print(f"\n=== Starting connection process for {address} ===")
    try:
        # Properly stop any active scanning
        print("Stopping active scans...")
        await stop_active_scan()
        await asyncio.sleep(1)  # Give time for scan cleanup
        
        # Prepare adapter for connection
        print("Preparing adapter...")
        try:
            # Ensure adapter is powered and ready
            subprocess.run(["bluetoothctl", "power", "off"], check=True, timeout=5)
            await asyncio.sleep(1)
            subprocess.run(["bluetoothctl", "power", "on"], check=True, timeout=5)
            await asyncio.sleep(1)
            
            # Set necessary modes for connection
            subprocess.run(["bluetoothctl", "pairable", "on"], check=True, timeout=5)
            subprocess.run(["bluetoothctl", "discoverable", "on"], check=True, timeout=5)
            
            print("Attempting connection with bluetoothctl...")
            # First try bluetoothctl connection
            subprocess.run(["bluetoothctl", "connect", address], check=True, timeout=15)
            await asyncio.sleep(2)  # Give connection time to stabilize
            
            # Verify connection
            result = subprocess.run(["bluetoothctl", "info", address], 
                                  capture_output=True, text=True, timeout=5)
            
            if "Connected: yes" in result.stdout:
                print("Bluetoothctl connection successful")
                # Get device name if available
                device_name = None
                for line in result.stdout.splitlines():
                    if line.strip().startswith("Name: "):
                        device_name = line.split(": ", 1)[1]
                        break
                
                return {
                    "status": "connected",
                    "address": address,
                    "name": device_name
                }
                
        except subprocess.CalledProcessError as e:
            print(f"Bluetoothctl connection failed: {e}")
        except subprocess.TimeoutExpired as e:
            print(f"Bluetoothctl connection timed out: {e}")
            
        # If bluetoothctl failed, try BleakClient as backup
        print("Attempting connection with BleakClient...")
        try:
            async with BleakClient(address, timeout=10.0) as client:
                if client.is_connected:
                    print("BleakClient connection successful")
                    return {"status": "connected", "address": address}
                print("BleakClient connection failed")
                return {"status": "failed", "error": "Connection failed with both methods"}
        except Exception as bleak_error:
            print(f"BleakClient connection error: {bleak_error}")
            return {"status": "failed", "error": str(bleak_error)}
            
    except Exception as e:
        print(f"Connection process error: {e}")
        return {"status": "failed", "error": str(e)}
    finally:
        try:
            # Ensure scan is properly restarted
            print("Restarting scan process...")
            subprocess.run(["bluetoothctl", "scan", "off"], check=True, timeout=5)
            await asyncio.sleep(1)
            subprocess.run(["bluetoothctl", "scan", "on"], check=True, timeout=5)
            print("Connection process complete")
        except Exception as cleanup_error:
            print(f"Error during connection cleanup: {cleanup_error}")
            # Don't raise the error as it's cleanup code

@fastapi_app.get("/bluetooth/status")
def get_status():
    try:
        # Get the Bluetooth power status first
        status = bluetooth_status()
        
        # If Bluetooth is off, return early
        if status == "off":
            return {"status": "off", "connected": False}
            
        # Check for connected devices using bluetoothctl info
        result = subprocess.run(
            ["bluetoothctl", "info"],
            capture_output=True,
            text=True,
            check=True
        )
        
        connected_device = None
        device_name = None
        is_connected = False
        
        # Parse the bluetoothctl info output
        for line in result.stdout.splitlines():
            line = line.strip()
            if line.startswith("Device "):
                connected_device = line.split()[1]
            elif line.startswith("Name: "):
                device_name = line.split(": ", 1)[1]
            elif line == "Connected: yes":
                is_connected = True
            elif line == "Connected: no":
                is_connected = False

        # Only consider device connected if both device is found AND Connected: yes
        if not is_connected:
            connected_device = None
            device_name = None
                    
        # Print debug info
        print(f"Bluetooth status: Power={status}, Connected={is_connected}, Device={connected_device}, Name={device_name}")
            
        return {
            "status": status,
            "connected": is_connected,
            "device": connected_device if is_connected else None,
            "device_name": device_name if is_connected else None
        }
    except subprocess.CalledProcessError as e:
        print(f"Error running bluetoothctl info: {e}")
        return {"status": bluetooth_status(), "connected": False}
    except Exception as e:
        print(f"Error getting Bluetooth status: {e}")
        return {"status": bluetooth_status(), "connected": False}

@fastapi_app.post("/bluetooth/toggle")
async def toggle_bluetooth(req: ToggleRequest):
    if req.state not in ["on", "off"]:
        raise HTTPException(status_code=400, detail="Invalid state. Use 'on' or 'off'")
    
    # Check current status first
    current = bluetooth_status()
    if current == req.state:
        return {"status": req.state, "message": f"Bluetooth is already {req.state}"}
        
    # Perform the toggle
    if req.state == "on":
        result = bluetooth_on()
    else:
        result = bluetooth_off()
        
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["error"])
        
    # Verify the new status
    await asyncio.sleep(2)  # Give time for the system to update
    new_status = bluetooth_status()
    
    if new_status != req.state:
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to set Bluetooth {req.state}. Current status: {new_status}"
        )
    
    # Clear discovered devices when turning off
    if req.state == "off":
        global discovered_devices
        discovered_devices = {}

@fastapi_app.get("/bluetooth/scan")
async def scan(force: bool = False):
    # Use the force parameter or check scan interval
    current_time = time.time()
    force_scan = force or (current_time - last_scan_time) >= SCAN_INTERVAL
    devices = await scan_devices(timeout=5, force_scan=force_scan)
    return {"devices": devices}

@fastapi_app.post("/bluetooth/connect")
async def connect(req: ConnectRequest):
    print(f"Starting connection to device: {req.address}")
    try:
        result = await connect_device(req.address)
        if result["status"] != "connected":
            raise HTTPException(status_code=500, detail=result.get("error"))
        
        # After successful connection, ensure the adapter state is properly maintained
        try:
            print("Setting up post-connection state...")
            # Keep discovery on but reduce its aggressiveness
            subprocess.run(["bluetoothctl", "discoverable", "on"], check=True, timeout=5)
            subprocess.run(["bluetoothctl", "pairable", "on"], check=True, timeout=5)
            
            # Trust the device to maintain connection
            subprocess.run(["bluetoothctl", "trust", req.address], check=True, timeout=5)
            
            # Restart scanning in a controlled way
            subprocess.run(["bluetoothctl", "scan", "off"], check=True, timeout=5)
            await asyncio.sleep(1)
            subprocess.run(["bluetoothctl", "scan", "on"], check=True, timeout=5)
            print("Post-connection setup complete")
        except Exception as setup_error:
            print(f"Warning: Post-connection setup had issues: {setup_error}")
            # Don't fail the connection if post-setup has issues
        
        return result
    except Exception as e:
        print(f"Connection error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

async def run_bt_command(cmd, timeout=5, check=True, retry_count=3):
    """Helper function to run bluetooth commands safely"""
    for attempt in range(retry_count):
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=timeout,
                check=check
            )
            return result
        except subprocess.TimeoutExpired as e:
            print(f"Command {cmd} timed out (attempt {attempt + 1}): {e}")
            if attempt == retry_count - 1:
                raise
        except subprocess.CalledProcessError as e:
            print(f"Command {cmd} failed (attempt {attempt + 1}): {e}")
            if attempt == retry_count - 1:
                raise
        except Exception as e:
            print(f"Unexpected error running {cmd} (attempt {attempt + 1}): {e}")
            if attempt == retry_count - 1:
                raise
        await asyncio.sleep(1)
    return None

def safe_run_sync(cmd, timeout=5, check=False):
    """Safely run a command synchronously with timeout"""
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout, check=check)
        return result
    except subprocess.TimeoutExpired:
        print(f"Command timed out: {cmd}")
        return None
    except subprocess.CalledProcessError as e:
        print(f"Command failed: {cmd}, error: {e}")
        return None
    except Exception as e:
        print(f"Unexpected error running command: {cmd}, error: {e}")
        return None

@fastapi_app.post("/bluetooth/disconnect")
async def disconnect_bluetooth():
    """Handle Bluetooth device disconnection with robust error handling"""
    print("\n=== Starting disconnect process ===")
    # Initialize response at the top level
    response = {"status": "unknown", "success": False}
    
    try:
        async with scanning_lock:  # Use lock for the main disconnect process
            # Initial scan cleanup - don't throw on failure
            print("Initial cleanup...")
            try:
                safe_bt_command(["bluetoothctl", "scan", "off"], timeout=3)
                await asyncio.sleep(0.5)
            except Exception as cleanup_error:
                print(f"Initial cleanup warning (non-fatal): {cleanup_error}")
            
            # Get currently connected device info with error handling
            print("Getting connected device info...")
            device_info = {
                'address': None,
                'name': None,
                'connected': False
            }
            
            result = safe_bt_command(["bluetoothctl", "info"], timeout=5)
            if result and result.stdout:
                for line in result.stdout.splitlines():
                    line = line.strip()
                    if line.startswith("Device "):
                        device_info['address'] = line.split()[1]
                    elif line.startswith("Name: "):
                        device_info['name'] = line.split(": ", 1)[1]
                    elif line == "Connected: yes":
                        device_info['connected'] = True
            
            if not (device_info['connected'] and device_info['address']):
                print("No connected device found")
                return {"status": "not_connected"}
                
            print(f"Found connected device: {device_info['name']} ({device_info['address']})")
            
            # Try to disconnect using our safe_disconnect_device helper
            disconnect_success = safe_disconnect_device(device_info['address'])
            
            if disconnect_success:
                print("\nDevice successfully disconnected, cleaning up...")
                # Final cleanup steps - each step handled separately
                cleanup_errors = []
                
                try:
                    # Reset adapter state - each command separate with error handling
                    cleanup_steps = [
                        ("scan off", ["bluetoothctl", "scan", "off"]),
                        ("power off", ["bluetoothctl", "power", "off"]),
                        ("power on", ["bluetoothctl", "power", "on"]),
                        ("pairable on", ["bluetoothctl", "pairable", "on"]),
                        ("discoverable on", ["bluetoothctl", "discoverable", "on"]),
                        ("scan on", ["bluetoothctl", "scan", "on"])
                    ]
                    
                    for step_name, cmd in cleanup_steps:
                        try:
                            result = safe_bt_command(cmd, timeout=3)
                            if not result:
                                cleanup_errors.append(f"{step_name} failed")
                            await asyncio.sleep(0.5)
                        except Exception as step_error:
                            print(f"Cleanup step '{step_name}' error (non-fatal): {step_error}")
                            cleanup_errors.append(f"{step_name} error: {str(step_error)}")
                            continue  # Continue with next step regardless of errors
                    
                    # Prepare status update for clients - will be sent even if some cleanup failed
                    status_data = {
                        "status": "on",  # Bluetooth is still on, just disconnected
                        "connected": False,
                        "device": None,
                        "device_name": None,
                        "last_device": {
                            "address": device_info['address'],
                            "name": device_info['name']
                        }
                    }
                    
                    # Try to notify clients - don't throw if it fails
                    try:
                        await sio.emit('bluetooth_state_change', status_data)
                    except Exception as emit_error:
                        print(f"Warning: Failed to notify clients (non-fatal): {emit_error}")
                        cleanup_errors.append(f"Client notification failed: {str(emit_error)}")
                    
                except Exception as cleanup_error:
                    print(f"Warning: Main cleanup block error (non-fatal): {cleanup_error}")
                    cleanup_errors.append(f"General cleanup error: {str(cleanup_error)}")
                
                # Always return success if we got this far, but include warnings if any
                response = {
                    "status": "disconnected",
                    "success": True
                }
                if cleanup_errors:
                    response["warnings"] = cleanup_errors
                return response
                
            else:
                # Don't throw exception, return error status instead
                return {
                    "status": "failed",
                    "success": False,
                    "error": "Failed to disconnect device after multiple attempts"
                }
                
    except Exception as e:
        print(f"Error during disconnect process (non-fatal): {e}")
        response = {
            "status": "error",
            "success": False,
            "error": str(e)
        }
    finally:
        try:
            print("\nEnsuring adapter is in clean state...")
            # Basic adapter reset - try each command separately
            cleanup_commands = [
                ("rfkill unblock", ["rfkill", "unblock", "bluetooth"]),
                ("power on", ["bluetoothctl", "power", "on"]),
                ("scan on", ["bluetoothctl", "scan", "on"])
            ]
            
            for cmd_name, cmd in cleanup_commands:
                try:
                    safe_bt_command(cmd, timeout=3)
                    await asyncio.sleep(0.5)
                except Exception as cmd_error:
                    print(f"Final {cmd_name} failed (non-fatal): {cmd_error}")
                    
        except Exception as final_error:
            print(f"Warning: Final cleanup block failed (non-fatal): {final_error}")
        
        print("=== Disconnect process complete ===\n")
        return response  # Always return a response, never throw

# --------------------------
# Brightness
# --------------------------

@fastapi_app.post("/display/brightness/{level}")
def set_brightness(level: int):
    try:
        if not 0 <= level <= 100:
            return {"error": "Brightness must be 0-100"}
        sbc.set_brightness(level)
        return {"status": "success", "brightness": level}
    except Exception as e:
        return {"status": "failed", "error": str(e)}

@fastapi_app.get("/display/brightness")
def get_brightness():
    try:
        current = sbc.get_brightness(display=0)[0]
        return {"brightness": current}
    except Exception as e:
        return {"status": "failed", "error": str(e)}

# --------------------------
# Wi-Fi
# --------------------------

class WifiConnectRequest(BaseModel):
    ssid: str
    password: str | None = None

@fastapi_app.get("/wifi/scan")
def wifi_scan():
    try:
        # Check WiFi status first
        status = wifi_status()
        if status["status"] == "off":
            return {"networks": [], "status": "off"}

        # Get detailed network info including security
        result = subprocess.run(
            ["nmcli", "-t", "-f", "SSID,SIGNAL,SECURITY", "dev", "wifi", "list"],
            capture_output=True,
            text=True,
            check=True
        )
        
        networks = []
        current = current_wifi()
        
        for line in result.stdout.strip().split('\n'):
            if line:
                parts = line.split(":")
                if len(parts) >= 3:
                    ssid = parts[0].strip()
                    signal = int(parts[1]) if parts[1].isdigit() else 0
                    security = parts[2] if parts[2] else "--"
                    
                    if ssid:  # skip empty SSID rows
                        network = {
                            "ssid": ssid,
                            "signal": signal,
                            "security": security
                        }
                        # Mark if this is the current network
                        if current.get("connected") and current.get("ssid") == ssid:
                            network["connected"] = True
                        networks.append(network)
                        
        return {"networks": networks, "status": "on"}
    except Exception as e:
        print(f"Scan error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@fastapi_app.get("/wifi/connection")
def current_wifi():
    try:
        # Get current WiFi status first
        if wifi_status()["status"] != "on":
            return {"connected": False, "ssid": None, "signal": None}
        
        # Get all active connections with detailed info
        connection_result = subprocess.run(
            ["nmcli", "-t", "-f", "TYPE,NAME,DEVICE", "connection", "show", "--active"],
            capture_output=True,
            text=True,
            check=True
        )
        
        wifi_connection = None
        wifi_device = None
        
        # Find active WiFi connection
        for line in connection_result.stdout.strip().split('\n'):
            if line:
                try:
                    conn_type, name, device = line.strip().split(':')
                    if conn_type == "802-11-wireless" or device.startswith('wl'):
                        wifi_connection = name
                        wifi_device = device
                        break
                except ValueError:
                    continue
        
        if not wifi_connection:
            return {"connected": False, "ssid": None, "signal": None}
        
        # Get detailed info about the current connection
        detail_result = subprocess.run(
            ["nmcli", "-t", "-f", "all", "device", "wifi"],
            capture_output=True,
            text=True,
            check=True
        )
        
        for line in detail_result.stdout.strip().split('\n'):
            fields = line.strip().split(':')
            if len(fields) >= 4 and fields[0] == "*":  # '*' indicates current connection
                return {
                    "connected": True,
                    "ssid": fields[1],
                    "signal": int(fields[2]) if fields[2].isdigit() else None,
                    "security": fields[3] if len(fields) > 3 else "--",
                    "device": wifi_device
                }
        
        # Fallback if we found a connection but couldn't get details
        return {
            "connected": True,
            "ssid": wifi_connection,
            "signal": None,
            "security": "--",
            "device": wifi_device
        }
            
    except Exception as e:
        print(f"Error getting WiFi connection: {str(e)}")
        return {"connected": False, "ssid": None, "signal": None}

@fastapi_app.get("/wifi/status")
def wifi_status():
    try:
        # First check if the wifi hardware is blocked
        rfkill = subprocess.run(
            ["rfkill", "list", "wifi"],
            capture_output=True,
            text=True
        )
        
        if "Soft blocked: yes" in rfkill.stdout:
            return {"status": "off", "reason": "blocked"}
            
        # Then check nmcli status
        result = subprocess.run(
            ["nmcli", "radio", "wifi"],
            capture_output=True,
            text=True
        )
        
        if result.returncode == 0:
            status = result.stdout.strip().lower()
            return {"status": "on" if status == "enabled" else "off"}
            
        # If nmcli failed, try checking device status directly
        dev_status = subprocess.run(
            ["nmcli", "device", "status"],
            capture_output=True,
            text=True
        )
        
        if dev_status.returncode == 0:
            # Look for any wifi device that's not unavailable
            for line in dev_status.stdout.split('\n'):
                if 'wifi' in line.lower() and 'unavailable' not in line.lower():
                    return {"status": "on"}
                    
        return {"status": "off", "reason": "unavailable"}
        
    except Exception as e:
        print(f"Error checking WiFi status: {str(e)}")
        # Don't raise an exception, just return off status
        return {"status": "off", "reason": str(e)}

@fastapi_app.post("/wifi/toggle")
async def toggle_wifi(req: ToggleRequest):
    try:
        if req.state not in ["on", "off"]:
            raise HTTPException(status_code=400, detail="Invalid state. Use 'on' or 'off'")
        
        # First check current status
        current_status = wifi_status()
        if current_status["status"] == "on" and req.state == "on":
            return {"status": "on", "message": "WiFi is already on"}
        if current_status["status"] == "off" and req.state == "off":
            return {"status": "off", "message": "WiFi is already off"}
            
        # Execute the toggle command
        result = subprocess.run(
            ["nmcli", "radio", "wifi", req.state],
            capture_output=True,
            text=True
        )
        
        if result.returncode != 0:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to toggle WiFi: {result.stderr}"
            )
        
        # Give the system time to update the WiFi state
        await asyncio.sleep(2)
        
        # Get the updated status
        status = wifi_status()
        current = None
        if status["status"] == "on":
            current = current_wifi()
            
        # Emit the state change to all connected clients
        await sio.emit('wifi_state_change', {
            'status': status["status"],
            'current_network': current
        })
        
        return {"status": status["status"]}
            
    except subprocess.CalledProcessError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to toggle WiFi: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Unexpected error while toggling WiFi: {str(e)}"
        )

@fastapi_app.post("/wifi/connect")
async def connect_wifi(req: WifiConnectRequest):
    try:
        # Check if we're currently connected to a network
        current = current_wifi()
        if current["connected"]:
            # If we're already connected to the requested network, return early
            if current["ssid"] == req.ssid:
                return {"status": "connected", "connection": current}
            
            # Disconnect from current network first
            try:
                disconnect_result = subprocess.run(
                    ["nmcli", "device", "disconnect", current["device"]],
                    capture_output=True,
                    text=True,
                    check=True
                )
                # Wait for disconnection
                await asyncio.sleep(2)
            except subprocess.CalledProcessError as e:
                print(f"Warning: Failed to disconnect from current network: {str(e)}")

        # Force a rescan of available networks
        try:
            subprocess.run(["nmcli", "device", "wifi", "rescan"], check=True)
            await asyncio.sleep(1)  # Give time for the scan to complete
        except subprocess.CalledProcessError as e:
            print(f"Warning: Failed to rescan networks: {str(e)}")

        # Build the nmcli command based on whether a password is provided
        if req.password:
            cmd = ["nmcli", "device", "wifi", "connect", req.ssid, "password", req.password]
        else:
            cmd = ["nmcli", "device", "wifi", "connect", req.ssid]
            
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode != 0:
            raise HTTPException(status_code=400, detail=f"Failed to connect: {result.stderr}")
            
        # Wait for connection to establish
        await asyncio.sleep(3)
        
        # Get current connection status
        current = current_wifi()
        if current["connected"] and current["ssid"] == req.ssid:
            # Notify all clients about the new connection
            await sio.emit('wifi_state_change', {
                'status': "on",
                'current_network': current
            })
            return {"status": "connected", "connection": current}
        else:
            raise HTTPException(status_code=400, detail="Connection failed to establish")
            
    except subprocess.CalledProcessError as e:
        raise HTTPException(status_code=500, detail=f"Connection failed: {str(e)}")
        
@fastapi_app.post("/wifi/disconnect")
async def disconnect_wifi():
    try:
        # Get current connection first
        current = current_wifi()
        if not current["connected"]:
            return {"status": "not_connected"}
            
        # Disconnect from WiFi
        result = subprocess.run(
            ["nmcli", "device", "disconnect", current["device"]],
            capture_output=True,
            text=True,
            check=True
        )
        
        # Notify clients about disconnection
        await sio.emit('wifi_state_change', {
            'status': "on",
            'current_network': None
        })
        
        return {"status": "disconnected"}
    except subprocess.CalledProcessError as e:
        raise HTTPException(status_code=500, detail=f"Failed to disconnect: {str(e)}")



# --------------------------
# Voice Chat
# --------------------------

from process_manager import voice_chat_manager

@fastapi_app.post("/voice-chat/control")
async def control_voice_chat(request: VoiceChatRequest):
    if request.action == "start":
        result = voice_chat_manager.start()
        if result["status"] == "error":
            raise HTTPException(status_code=500, detail=result["message"])
        return result
    elif request.action == "stop":
        result = voice_chat_manager.stop()
        if result["status"] == "error":
            raise HTTPException(status_code=500, detail=result["message"])
        return result
    else:
        raise HTTPException(status_code=400, detail="Invalid action. Use 'start' or 'stop'")

@fastapi_app.get("/voice-chat/status")
async def voice_chat_status():
    return voice_chat_manager.status()

# --------------------------
# Socket.IO
# --------------------------

@sio.event
async def connect(sid, environ):
    print(f"Socket.IO client connected: {sid}")
    try:
        # Get current WiFi status
        wifi_state = wifi_status()
        current = None
        if wifi_state["status"] == "on":
            current = current_wifi()
        await sio.emit('wifi_state_change', {
            'status': wifi_state["status"],
            'current_network': current
        }, to=sid)
        
        # Get current Bluetooth status and emit to the new client
        bt_status = get_status()
        print(f"Sending initial Bluetooth status to client {sid}:", bt_status)
        await sio.emit('bluetooth_state_change', bt_status, to=sid)
        
        # Also broadcast current status to all clients to ensure sync
        await sio.emit('bluetooth_state_change', bt_status)
    except Exception as e:
        print(f"Error sending initial states: {e}")

@sio.event
async def disconnect(sid):
    print(f"Socket.IO client disconnected: {sid}")
