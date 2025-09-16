from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import subprocess
import asyncio
from bleak import BleakScanner, BleakClient
import screen_brightness_control as sbc
import re

app = FastAPI(title="Jetson + Device API")

# --------------------------
# CORS
# --------------------------
origins = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:8080",
    "http://192.168.0.101:3000",
    "http://192.168.0.101:5173",
    "http://192.168.0.101:8080",
    "http://192.168.0.206:8080",  # Your PC's network IP
    "*"  # Allow all origins for testing
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for now
    allow_credentials=False,  # Must be False when using wildcard
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# --------------------------
# Models
# --------------------------
class ToggleRequest(BaseModel):
    state: str  # "on" or "off"

class ConnectRequest(BaseModel):
    address: str

class VolumeRequest(BaseModel):
    volume: int  # 0-100

# --------------------------
# System control endpoints
# --------------------------

import alsaaudio

def get_mixer():
    """Get the first available mixer that can control volume."""
    try:
        # Try to get PCM mixer from card 0
        return alsaaudio.Mixer('PCM', cardindex=0)
    except:
        try:
            # Try to get Master mixer from card 0
            return alsaaudio.Mixer('Master', cardindex=0)
        except:
            # Try to find any available mixer
            mixers = alsaaudio.mixers()
            if mixers:
                return alsaaudio.Mixer(mixers[0])
            raise Exception("No audio mixers found")

@app.get("/volume")
async def get_volume():
    try:
        mixer = get_mixer()
        
        # Get current volume (returns a list with [left_volume, right_volume])
        try:
            volumes = mixer.getvolume()
        except AttributeError:
            # Some mixers might not support getvolume, try getvol instead
            volumes = [mixer.getvol()[0]]
        
        # Use the left channel volume
        volume = volumes[0]
        return {"volume": volume, "mixer": mixer.mixer(), "card": mixer.cardname()}
    except Exception as e:
        raise HTTPException(status_code=500, 
                          detail=f"Error getting volume: {str(e)}")

@app.post("/volume")
async def set_volume(request: VolumeRequest):
    try:
        # Ensure volume is between 0 and 100
        volume = max(0, min(100, request.volume))
        
        mixer = get_mixer()
        
        # Try to set volume using different methods
        try:
            # Try setvolume first
            mixer.setvolume(volume)
        except AttributeError:
            try:
                # If setvolume fails, try setvol
                mixer.setvol(volume)
            except:
                raise Exception("Failed to set volume using available methods")
            
        # Get the actual volume that was set
        try:
            actual_volume = mixer.getvolume()[0]
        except:
            try:
                actual_volume = mixer.getvol()[0]
            except:
                actual_volume = volume
            
        return {
            "success": True, 
            "volume": actual_volume,
            "mixer": mixer.mixer(),
            "card": mixer.cardname()
        }
    except Exception as e:
        raise HTTPException(status_code=500, 
                          detail=f"Error setting volume: {str(e)}")

# --------------------------
# Bluetooth helper functions
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
    except Exception:
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

# --------------------------
# Routes: Bluetooth
# --------------------------
@app.get("/bluetooth/status")
def get_status():
    return {"status": bluetooth_status()}

@app.post("/bluetooth/toggle")
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

@app.get("/bluetooth/scan")
async def scan():
    devices = await scan_devices(timeout=5)
    return {"devices": devices}

@app.post("/bluetooth/connect")
async def connect(req: ConnectRequest):
    result = await connect_device(req.address)
    if result["status"] != "connected":
        raise HTTPException(status_code=500, detail=result.get("error"))
    return result

# --------------------------
# Routes: Display / Brightness
# --------------------------
@app.post("/display/brightness/{level}")
def set_brightness(level: int):
    try:
        if not 0 <= level <= 100:
            return {"error": "Brightness must be 0-100"}
        sbc.set_brightness(level)
        return {"status": "success", "brightness": level}
    except Exception as e:
        return {"status": "failed", "error": str(e)}

@app.get("/display/brightness")
def get_brightness():
    try:
        current = sbc.get_brightness(display=0)[0]
        return {"brightness": current}
    except Exception as e:
        return {"status": "failed", "error": str(e)}

# --------------------------
# Run server
# --------------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=5000, reload=True)
