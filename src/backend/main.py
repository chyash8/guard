from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import subprocess
import asyncio
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
        subprocess.run(["rfkill", "unblock", "bluetooth"], check=True)
        subprocess.run(["systemctl", "start", "bluetooth"], check=True)
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}

def bluetooth_off():
    try:
        subprocess.run(["systemctl", "stop", "bluetooth"], check=True)
        subprocess.run(["rfkill", "block", "bluetooth"], check=True)
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}

def bluetooth_status():
    try:
        result = subprocess.run(["rfkill", "list", "bluetooth"], capture_output=True, text=True)
        if "Soft blocked: yes" in result.stdout:
            return "off"
        elif "Soft blocked: no" in result.stdout:
            return "on"
        else:
            return "unknown"
    except:
        return "unknown"

async def scan_devices(timeout: int = 5):
    try:
        devices = await BleakScanner.discover(timeout=timeout)
        return [{"name": d.name, "address": d.address} for d in devices]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

async def connect_device(address: str):
    try:
        async with BleakClient(address, timeout=10.0) as client:
            if client.is_connected:
                return {"status": "connected", "address": address}
            return {"status": "failed", "error": "Connection failed"}
    except Exception as e:
        return {"status": "failed", "error": str(e)}

@fastapi_app.get("/bluetooth/status")
def get_status():
    return {"status": bluetooth_status()}

@fastapi_app.post("/bluetooth/toggle")
def toggle_bluetooth(req: ToggleRequest):
    if req.state == "on":
        result = bluetooth_on()
    elif req.state == "off":
        result = bluetooth_off()
    else:
        raise HTTPException(status_code=400, detail="Invalid state")
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["error"])
    return {"status": req.state}

@fastapi_app.get("/bluetooth/scan")
async def scan():
    devices = await scan_devices(timeout=5)
    return {"devices": devices}

@fastapi_app.post("/bluetooth/connect")
async def connect(req: ConnectRequest):
    result = await connect_device(req.address)
    if result["status"] != "connected":
        raise HTTPException(status_code=500, detail=result.get("error"))
    return result

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
        # Build the nmcli command based on whether a password is provided
        if req.password:
            cmd = ["nmcli", "device", "wifi", "connect", req.ssid, "password", req.password]
        else:
            cmd = ["nmcli", "device", "wifi", "connect", req.ssid]
            
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode != 0:
            raise HTTPException(status_code=400, detail=f"Failed to connect: {result.stderr}")
            
        # Wait briefly for connection to establish
        await asyncio.sleep(2)
        
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
    # Get current WiFi status
    try:
        wifi_state = wifi_status()
        current = None
        if wifi_state["status"] == "on":
            current = current_wifi()
        await sio.emit('wifi_state_change', {
            'status': wifi_state["status"],
            'current_network': current
        }, to=sid)
    except Exception as e:
        print(f"Error sending initial WiFi state: {e}")

@sio.event
async def disconnect(sid):
    print(f"Socket.IO client disconnected: {sid}")
