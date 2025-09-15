from flask import Flask, request, jsonify
from flask_cors import CORS
import alsaaudio
import logging
import subprocess
import json
import re
from typing import List, Dict, Optional

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# WiFi management functions
def check_wifi_interface():
    """Check if wifi interface exists and return its name"""
    try:
        # Try common interface names
        interfaces = ["wlan0", "wifi0", "wireless0"]
        for interface in interfaces:
            result = subprocess.run(["iwconfig", interface], capture_output=True, text=True)
            if result.returncode == 0 and "802.11" in result.stdout:
                return interface
        return None
    except Exception as e:
        logger.error(f"Error checking wifi interface: {e}")
        return None
def _run_command(command: List[str]) -> tuple[str, str, int]:
    try:
        logger.debug(f"Running command: {' '.join(command)}")
        process = subprocess.Popen(
            command,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        stdout, stderr = process.communicate()
        logger.debug(f"Command output - stdout: {stdout}, stderr: {stderr}, code: {process.returncode}")
        return stdout, stderr, process.returncode
    except Exception as e:
        logger.error(f"Error running command {' '.join(command)}: {str(e)}")
        return "", str(e), 1

def get_mixer():
    try:
        return alsaaudio.Mixer('Master')
    except alsaaudio.ALSAAudioError:
        try:
            return alsaaudio.Mixer('PCM')
        except alsaaudio.ALSAAudioError:
            logger.error("Could not find a suitable audio mixer")
            return None

@app.route('/volume', methods=['GET'])
def get_volume():
    mixer = get_mixer()
    if mixer:
        try:
            volume = mixer.getvolume()[0]
            logger.info(f"Current volume: {volume}")
            return jsonify({"volume": volume})
        except Exception as e:
            logger.error(f"Error getting volume: {str(e)}")
            return jsonify({"error": str(e)}), 500
    return jsonify({"error": "No audio mixer available"}), 500

@app.route('/volume', methods=['POST'])
def set_volume():
    mixer = get_mixer()
    if mixer:
        try:
            data = request.get_json()
            volume = data.get('volume', 50)
            mixer.setvolume(int(volume))
            logger.info(f"Volume set to: {volume}")
            return jsonify({"success": True, "volume": volume})
        except Exception as e:
            logger.error(f"Error setting volume: {str(e)}")
            return jsonify({"error": str(e)}), 500
    return jsonify({"error": "No audio mixer available"}), 500

# WiFi Routes
@app.route('/wifi/status', methods=['GET'])
def get_wifi_status():
    try:
        # First check if interface is up
        ifconfig_out, _, _ = _run_command(["ifconfig", "wlan0"])
        is_interface_up = "UP" in ifconfig_out
        
        if not is_interface_up:
            return jsonify({
                "status": "off",
                "connected": False,
                "current_network": None,
                "debug_info": "Interface is down"
            })

        # Check current connection using ip route
        route_out, _, _ = _run_command(["ip", "route"])
        is_connected = "default via" in route_out and "wlan0" in route_out
        
        # Get current SSID if connected
        if is_connected:
            iwconfig_out, _, _ = _run_command(["iwconfig", "wlan0"])
            ssid = None
            for line in iwconfig_out.split('\n'):
                if 'ESSID:' in line:
                    ssid = line.split('ESSID:"')[1].split('"')[0]
                    break
        else:
            ssid = None

        logger.debug(f"WiFi Status - Interface up: {is_interface_up}, Connected: {is_connected}, SSID: {ssid}")
        
        return jsonify({
            "status": "on" if is_interface_up else "off",
            "connected": is_connected,
            "current_network": ssid,
            "debug_info": {
                "interface_status": ifconfig_out,
                "route_info": route_out
            }
        })
        
    except Exception as e:
        logger.error(f"Error checking WiFi status: {str(e)}")
        return jsonify({
            "error": f"Failed to check WiFi status: {str(e)}",
            "status": "unknown",
            "connected": False,
            "current_network": None
        }), 500

@app.route('/wifi/toggle', methods=['POST'])
def toggle_wifi():
    state = request.args.get('state')
    if state not in ["on", "off"]:
        return jsonify({"error": "Invalid state. Use 'on' or 'off'"}), 400
    
    command = "ifconfig wlan0 up" if state == "on" else "ifconfig wlan0 down"
    stdout, stderr, code = _run_command(command.split())
    
    if code != 0:
        return jsonify({"error": f"Failed to toggle WiFi: {stderr}"}), 500
    
    # Verify the state
    check_stdout, _, check_code = _run_command(["iwconfig", "wlan0"])
    is_enabled = "no wireless extensions" not in check_stdout.lower()
    actual_state = "on" if is_enabled else "off"
    
    return jsonify({
        "status": actual_state,
        "success": actual_state == state
    })

@app.route('/wifi/scan', methods=['GET'])
def scan_networks():
    # Force a new scan
    _run_command(["iwlist", "wlan0", "scanning"])
    
    # Get scan results
    stdout, stderr, code = _run_command(["iwlist", "wlan0", "scanning"])
    
    if code != 0:
        return jsonify({"error": f"Failed to scan networks: {stderr}"}), 500

    networks = []
    current_network = None
    ssid = None
    signal = 0
    security = "--"

    for line in stdout.split('\n'):
        line = line.strip()
        if 'ESSID:' in line:
            # If we have a previous network, add it
            if ssid:
                networks.append({
                    "ssid": ssid,
                    "signal": signal,
                    "security": security
                })
            # Start new network
            ssid = line.split('ESSID:"')[1].rstrip('"')
            signal = 0
            security = "--"
        elif 'Quality=' in line:
            try:
                quality = line.split('Quality=')[1].split(' ')[0]
                current, max_val = map(int, quality.split('/'))
                signal = int((current / max_val) * 100)
            except (IndexError, ValueError):
                signal = 0
        elif 'Encryption key:' in line:
            security = "WPA/WPA2" if "on" in line.lower() else "--"

    # Sort by signal strength
    networks.sort(key=lambda x: x["signal"], reverse=True)
    return jsonify({"networks": networks})

@app.route('/wifi/connection', methods=['GET'])
def get_connection():
    try:
        # Get detailed connection info
        iwconfig_out, _, code = _run_command(["iwconfig", "wlan0"])
        if code != 0:
            return jsonify({"connected": False, "error": "Failed to get WiFi info"})

        # Check if we're connected
        if "Not-Associated" in iwconfig_out:
            return jsonify({
                "connected": False,
                "debug_info": iwconfig_out
            })

        # Parse connection details
        ssid = None
        signal_strength = 0
        frequency = None
        bit_rate = None

        for line in iwconfig_out.split('\n'):
            if 'ESSID:' in line:
                ssid = line.split('ESSID:"')[1].split('"')[0]
            if 'Frequency:' in line:
                frequency = line.split('Frequency:')[1].split(' ')[0]
            if 'Bit Rate=' in line:
                bit_rate = line.split('Bit Rate=')[1].split(' ')[0]
            if 'Link Quality=' in line:
                try:
                    quality = line.split('Link Quality=')[1].split(' ')[0]
                    current, max_val = map(int, quality.split('/'))
                    signal_strength = int((current / max_val) * 100)
                except:
                    signal_strength = 0

        # Get IP address
        ip_out, _, _ = _run_command(["ip", "addr", "show", "wlan0"])
        ip_address = None
        for line in ip_out.split('\n'):
            if 'inet ' in line:
                ip_address = line.split('inet ')[1].split('/')[0]
                break

        logger.debug(f"Connection details - SSID: {ssid}, Signal: {signal_strength}, IP: {ip_address}")

        return jsonify({
            "connected": bool(ssid and ip_address),
            "ssid": ssid,
            "signal": signal_strength,
            "ip_address": ip_address,
            "details": {
                "frequency": frequency,
                "bit_rate": bit_rate
            },
            "debug_info": iwconfig_out
        })

    except Exception as e:
        logger.error(f"Error getting connection info: {str(e)}")
        return jsonify({
            "connected": False,
            "error": f"Failed to get connection info: {str(e)}"
        }), 500

@app.route('/wifi/connect', methods=['POST'])
def connect_wifi():
    data = request.get_json()
    ssid = data.get('ssid')
    password = data.get('password')

    if not ssid:
        return jsonify({"error": "SSID is required"}), 400

    try:
        # Create wpa_supplicant configuration
        if password:
            config_cmd = f'wpa_passphrase "{ssid}" "{password}" > /tmp/wpa_supplicant.conf'
        else:
            config_cmd = f'echo "network={{\\n    ssid=\\"{ssid}\\"\\n    key_mgmt=NONE\\n}}" > /tmp/wpa_supplicant.conf'
        
        _run_command(["bash", "-c", config_cmd])
        
        # Stop any existing wpa_supplicant
        _run_command(["killall", "wpa_supplicant"])
        
        # Start wpa_supplicant with new config
        _run_command(["wpa_supplicant", "-B", "-i", "wlan0", "-c", "/tmp/wpa_supplicant.conf"])
        
        # Get IP using DHCP
        _run_command(["dhclient", "wlan0"])
        
        # Verify connection
        stdout, _, code = _run_command(["iwgetid", "-r"])
        if code == 0 and stdout.strip() == ssid:
            return jsonify({"status": "connected"})
                
        return jsonify({"error": "Failed to verify connection", "status": "failed"}), 500
                
    except Exception as e:
        return jsonify({"error": f"Connection error: {str(e)}"}), 500

@app.route('/wifi/disconnect', methods=['POST'])
def disconnect_wifi():
    # Kill dhclient and wpa_supplicant
    _run_command(["killall", "dhclient"])
    _run_command(["killall", "wpa_supplicant"])
    
    # Release IP
    _run_command(["ip", "addr", "flush", "dev", "wlan0"])
    
    # Verify disconnection
    stdout, _, code = _run_command(["iwgetid", "-r"])
    if stdout.strip():
        return jsonify({"error": "Failed to disconnect completely"}), 500
        
    return jsonify({"status": "disconnected"})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
