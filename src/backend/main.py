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

# Store discovered devices
discovered_devices = {}
last_scan_time = 0
SCAN_INTERVAL = 30  # Minimum seconds between full scans

async def scan_devices(timeout: int = 5, force_scan: bool = False):
    global discovered_devices, last_scan_time
    current_time = time.time()
    
    try:
        # Return cached devices if scan interval hasn't elapsed
        if not force_scan and (current_time - last_scan_time) < SCAN_INTERVAL:
            return list(discovered_devices.values())

        # Stop any ongoing scan
        subprocess.run(["bluetoothctl", "scan", "off"], capture_output=True)
        
        # First attempt to get detailed device info using bluetoothctl
        try:
            subprocess.run(["bluetoothctl", "scan", "on"], timeout=2)  # Start brief scan
            result = subprocess.run(["bluetoothctl", "devices"], capture_output=True, text=True)
            bt_devices = {}
            
            for line in result.stdout.splitlines():
                if line.startswith("Device"):
                    parts = line.split(" ", 2)  # Split into 3 parts: "Device", MAC, and Name
                    if len(parts) >= 2:
                        addr = parts[1]
                        name = parts[2] if len(parts) > 2 else None
                        bt_devices[addr] = {"name": name, "address": addr}
                        addr = parts[1]
                        name = parts[2] if len(parts) > 2 else None
                        bt_devices[addr] = {"name": name, "address": addr}
        except Exception as e:
            print(f"Bluetoothctl scan failed: {e}")
            bt_devices = {}

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
        raise HTTPException(status_code=500, detail=str(e))

async def connect_device(address: str):
    try:
        # Stop scanning before attempting connection
        subprocess.run(["bluetoothctl", "scan", "off"], capture_output=True)
        await asyncio.sleep(1)  # Give time for scan to stop
        
        # Attempt connection with bluetoothctl first
        try:
            subprocess.run(["bluetoothctl", "connect", address], check=True, timeout=10)
            # Check if connection was successful
            result = subprocess.run(["bluetoothctl", "info", address], capture_output=True, text=True)
            if "Connected: yes" in result.stdout:
                return {"status": "connected", "address": address}
        except subprocess.CalledProcessError as e:
            print(f"Bluetoothctl connection failed: {e}")
            # Fall through to try BleakClient
            
        # Try BleakClient as backup
        async with BleakClient(address, timeout=10.0) as client:
            if client.is_connected:
                return {"status": "connected", "address": address}
            return {"status": "failed", "error": "Connection failed with both methods"}
    except Exception as e:
        return {"status": "failed", "error": str(e)}
    finally:
        # Resume scanning after connection attempt
        subprocess.run(["bluetoothctl", "scan", "on"], capture_output=True)

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
    result = await connect_device(req.address)
    if result["status"] != "connected":
        raise HTTPException(status_code=500, detail=result.get("error"))
    return result

@fastapi_app.post("/bluetooth/disconnect")
async def disconnect_bluetooth():
    try:
        # Stop scanning before disconnect
        subprocess.run(["bluetoothctl", "scan", "off"], capture_output=True)
        await asyncio.sleep(1)

        # Get the currently connected device info
        result = subprocess.run(["bluetoothctl", "info"], capture_output=True, text=True)
        
        device_address = None
        device_name = None
        if "Connected: yes" in result.stdout:
            # Extract device information from the info output
            for line in result.stdout.splitlines():
                if line.strip().startswith("Device "):
                    device_address = line.strip().split()[1]
                elif line.strip().startswith("Name: "):
                    device_name = line.split(": ", 1)[1]
            
            if device_address:
                # Disconnect the device
                subprocess.run(["bluetoothctl", "disconnect", device_address], check=True)
                await asyncio.sleep(1)  # Give time for disconnect to complete
                
                # Notify all connected clients about the Bluetooth state change
                status_data = {
                    "status": "on",  # Bluetooth is still on, just disconnected
                    "connected": False,
                    "device": None,
                    "device_name": None,
                    "last_device": {  # Include info about the device that was disconnected
                        "address": device_address,
                        "name": device_name
                    }
                }
                await sio.emit('bluetooth_state_change', status_data)
                return {"status": "disconnected"}
        
        return {"status": "not_connected"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        # Resume scanning after disconnect
        subprocess.run(["bluetoothctl", "scan", "on"], capture_output=True)

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
