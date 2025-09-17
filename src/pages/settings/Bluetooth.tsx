import { useEffect, useState } from "react";
import SettingsLayout from "@/components/SettingsLayout";
import { Switch } from "@/components/ui/switch";
import { Bluetooth as BluetoothIcon, Plug } from "lucide-react";
import { socket } from "@/lib/socket";

const JETSON_IP = window.location.hostname === 'localhost' ? '192.168.0.101' : window.location.hostname;
const API_BASE = `http://${JETSON_IP}:5000/bluetooth`;

interface Device {
  name: string | null;
  address: string;
  type: string;
}

const Bluetooth = () => {
  const [isEnabled, setIsEnabled] = useState<boolean>(false);
  const [loadingToggle, setLoadingToggle] = useState<boolean>(true);  // Start as loading
  const [devices, setDevices] = useState<Device[]>([]);
  const [scanning, setScanning] = useState<boolean>(false);
  const [connectingDevice, setConnectingDevice] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [connectedDevice, setConnectedDevice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 1️⃣ Fetch current Bluetooth status (initial + every 5s)
  useEffect(() => {
    let retryTimeout: NodeJS.Timeout;
    let isSubscribed = true;

    const fetchStatus = async (retryCount = 0) => {
      if (!isSubscribed) return;

      try {
        setError(null);
        const res = await fetch(`${API_BASE}/status`);
        
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        
        const data = await res.json();
        console.log("Bluetooth status response:", data);
        
        if (isSubscribed) {
          // Update power state
          const bluetoothOn = data.status === "on";
          setIsEnabled(bluetoothOn);
          
          // Update connection state
          setIsConnected(data.connected || false);
          
          if (data.connected && data.device) {
            // Update connected device info
            const connectedDeviceInfo = {
              name: data.device_name || "Connected Device",
              address: data.device,
              type: "Connected Device"
            };
            setConnectedDevice(data.device);
            
            // Ensure connected device is in the list and update its info
            setDevices(prevDevices => {
              const existingDeviceIndex = prevDevices.findIndex(d => d.address === data.device);
              if (existingDeviceIndex === -1) {
                // Add new device at the beginning
                return [connectedDeviceInfo, ...prevDevices];
              } else {
                // Update existing device info and move to top
                const updatedDevices = [...prevDevices];
                updatedDevices.splice(existingDeviceIndex, 1);
                return [
                  {
                    ...prevDevices[existingDeviceIndex],
                    name: data.device_name || prevDevices[existingDeviceIndex].name,
                    type: prevDevices[existingDeviceIndex].type || "Connected Device"
                  },
                  ...updatedDevices
                ];
              }
            });
            
            // If Bluetooth is on, trigger a scan to update device info
            if (bluetoothOn) {
              // Force scan to ensure we have latest device info
              const scanDevices = async () => {
                try {
                  const res = await fetch(`${API_BASE}/scan?force=true`);
                  const data = await res.json();
                  setDevices(prevDevices => {
                    const newDevices = data.devices || [];
                    // Keep our connected device at the top
                    const connectedDevice = prevDevices.find(d => d.address === data.device);
                    if (connectedDevice && !newDevices.some(d => d.address === data.device)) {
                      newDevices.unshift(connectedDevice);
                    }
                    return newDevices;
                  });
                } catch (err) {
                  console.error("Failed to scan for devices:", err);
                }
              };
              if (!scanning) {
                scanDevices();
              }
            }
          } else {
            setConnectedDevice(null);
          }
        }
      } catch (err) {
        console.error("Failed to fetch Bluetooth status:", err);
        setError("Failed to get Bluetooth status");
        
        // Retry more frequently on error, up to 3 times
        if (retryCount < 3 && isSubscribed) {
          console.log(`Retrying status fetch in 2s (attempt ${retryCount + 1})...`);
          retryTimeout = setTimeout(() => fetchStatus(retryCount + 1), 2000);
        }
      } finally {
        setLoadingToggle(false);
      }
    };

    // Initial fetch
    fetchStatus();

    // Regular polling (less frequent)
    const interval = setInterval(fetchStatus, 10000);

    // Cleanup
    return () => {
      isSubscribed = false;
      clearInterval(interval);
      if (retryTimeout) clearTimeout(retryTimeout);
    };
  }, [scanning]);

  // Listen for Bluetooth state changes from Socket.IO
  useEffect(() => {
    if (!socket) return;

    const handleBluetoothStateChange = async (data: any) => {
      console.log("Bluetooth state change:", data);
      
      // Update Bluetooth power state
      setIsEnabled(data.status === "on");
      
      // Update connection state
      const isDeviceConnected = data.connected && data.device;
      setIsConnected(isDeviceConnected);
      setConnectedDevice(isDeviceConnected ? data.device : null);
      
      // Always do a fresh scan after state change
      if (data.status === "on" && !scanning) {
        try {
          const res = await fetch(`${API_BASE}/scan?force=true`);
          const scanData = await res.json();
          setDevices(prevDevices => {
            const newDevices = scanData.devices || [];
            
            // If we have a connected device, ensure it's at the top
            if (isDeviceConnected) {
              const connectedDeviceInfo = {
                name: data.device_name || "Connected Device",
                address: data.device,
                type: "Connected Device"
              };
              
              // Remove any existing entry for this device
              const filteredDevices = newDevices.filter(d => d.address !== data.device);
              
              // Add the connected device at the top
              return [connectedDeviceInfo, ...filteredDevices];
            }
            
            return newDevices;
          });
        } catch (err) {
          console.error("Failed to scan after state change:", err);
          setError("Failed to update device list");
        }
      } else if (!data.status === "on") {
        // Clear device list if Bluetooth is off
        setDevices([]);
      }
    };

    socket.on("bluetooth_state_change", handleBluetoothStateChange);

    return () => {
      socket.off("bluetooth_state_change", handleBluetoothStateChange);
    };
  }, [scanning]);

  // 2️⃣ Toggle Bluetooth
  const handleToggle = async (checked: boolean) => {
    if (loadingToggle) return; // Prevent multiple toggles while processing
    
    setLoadingToggle(true);
    const state = checked ? "on" : "off";
    
    const toggleWithRetry = async (attempts = 3): Promise<boolean> => {
      for (let i = 0; i < attempts; i++) {
        try {
          console.log(`Attempting to toggle Bluetooth ${state} (attempt ${i + 1}/${attempts})`);
          
          const res = await fetch(`${API_BASE}/toggle`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ state }),
          });

          const data = await res.json();
          
          if (!res.ok) {
            throw new Error(data.detail || `HTTP error! status: ${res.status}`);
          }

          console.log("Toggle response:", data);
          
          // If we get here, the toggle was successful
          return true;
          
        } catch (err) {
          console.error(`Toggle attempt ${i + 1} failed:`, err);
          if (i < attempts - 1) {
            console.log(`Waiting before retry ${i + 2}...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
          } else {
            // Last attempt failed
            alert(`Failed to toggle Bluetooth. Please try again in a few moments.\nError: ${err.message}`);
            return false;
          }
        }
      }
      return false;
    };

    try {
      const success = await toggleWithRetry();
      if (success) {
        setIsEnabled(checked);
        if (!checked) {
          // Clear connection state when turning off
          setIsConnected(false);
          setConnectedDevice(null);
          setDevices([]);
        }
      } else {
        // Reset switch state on failure
        setIsEnabled(!checked);
      }
    } finally {
      setLoadingToggle(false);
      
      // If turning on, start a fresh scan after a short delay
      if (checked) {
        setTimeout(() => {
          if (isEnabled) {
            const scanDevices = async () => {
              try {
                const res = await fetch(`${API_BASE}/scan`);
                const data = await res.json();
                setDevices(data.devices || []);
              } catch (err) {
                console.error("Failed to scan after toggle:", err);
              }
            };
            scanDevices();
          }
        }, 3000);
      }
    }
  };

  // 3️⃣ Scan devices when Bluetooth is ON
  useEffect(() => {
    if (!isEnabled || connectingDevice) {
      if (!isEnabled) setDevices([]);
      return;
    }

    const scanDevices = async () => {
      setScanning(true);
      try {
        const res = await fetch(`${API_BASE}/scan`);
        const data = await res.json();
        setDevices(prevDevices => {
          // Keep connected device at top if exists
          const newDevices = data.devices || [];
          if (connectedDevice) {
            const connected = prevDevices.find(d => d.address === connectedDevice);
            if (connected && !newDevices.some(d => d.address === connectedDevice)) {
              newDevices.unshift(connected);
            }
          }
          return newDevices;
        });
      } catch (err) {
        console.error("Failed to scan devices:", err);
        setError("Failed to scan for devices");
      } finally {
        setScanning(false);
      }
    };

    // Initial scan when Bluetooth is enabled
    scanDevices();
    
    // Scan every 30 seconds (reduced frequency, since we have manual scan now)
    const interval = setInterval(scanDevices, 30000);
    
    return () => clearInterval(interval);
  }, [isEnabled, connectingDevice, connectedDevice]);

  // 4️⃣ Connect to a device
  const handleConnect = async (address: string) => {
    setConnectingDevice(address);
    try {
      // First ensure Bluetooth is enabled
      if (!isEnabled) {
        alert("Please enable Bluetooth first");
        return;
      }

      const deviceToConnect = devices.find(d => d.address === address);
      const deviceName = deviceToConnect?.name || 'Unknown Device';

      // Show connecting status
      alert(`Connecting to ${deviceName}...\nPlease make sure your device is in pairing mode.`);

      const res = await fetch(`${API_BASE}/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });
      
      const data = await res.json();
      
      if (data.status === "connected") {
        setIsConnected(true);
        setConnectedDevice(address);
        // Sort devices to show connected device at top
        setDevices(prev => [...prev].sort((a, b) => 
          a.address === address ? -1 : b.address === address ? 1 : 0
        ));
      } else {
        const errorMsg = data.error || "Unknown error occurred";
        alert(`❌ Connection failed:\n${errorMsg}\n\nTips:\n1. Make sure device is in pairing mode\n2. Try turning device off and on\n3. Move closer to the device`);
      }
    } catch (err) {
      console.error("Failed to connect:", err);
      alert("❌ Connection failed. Please check your network connection and try again.");
    } finally {
      setConnectingDevice(null);
    }
  };

  return (
    <SettingsLayout>
      <div className="space-y-8">
        <h2 className="text-2xl font-bold">BLUETOOTH</h2>

        {/* Connection Status */}
        <div className="mb-4 p-4 rounded-lg border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`}></div>
            <div>
              <div className={`font-semibold ${isConnected ? "text-green-600" : "text-red-600"}`}>
                {isConnected ? "Connected" : "Not Connected"}
              </div>
              {isConnected && (
                <div className="text-sm text-gray-600">
                  {devices.find(d => d.address === connectedDevice)?.name || "Unknown Device"}
                </div>
              )}
            </div>
          </div>
          {isConnected && (
            <button
              onClick={async () => {
                try {
                  const res = await fetch(`${API_BASE}/disconnect`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json'
                    }
                  });
                  
                  if (!res.ok) {
                    throw new Error(`HTTP error! status: ${res.status}`);
                  }
                  
                  const data = await res.json();
                  
                  if (data.status === "disconnected") {
                    setIsConnected(false);
                    setConnectedDevice(null);
                    // Refresh device list after disconnect
                    const res = await fetch(`${API_BASE}/scan?force=true`);
                    const scanData = await res.json();
                    setDevices(scanData.devices || []);
                  } else {
                    throw new Error('Disconnect failed: ' + (data.error || 'Unknown error'));
                  }
                } catch (err) {
                  console.error('Disconnect failed:', err);
                  alert('Failed to disconnect. Please try again.');
                }
              }}
              className="px-3 py-1 text-sm text-red-600 border border-red-200 rounded-md hover:bg-red-50 transition-colors"
            >
              Disconnect
            </button>
          )}
        </div>

        <div className="space-y-6">
          {/* Toggle Section */}
          <h3 className="text-xl font-bold">TURN ON & OFF</h3>
          <div className="p-6 border border-border rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <BluetoothIcon className="w-6 h-6" />
                <div>
                  <h4 className="font-bold">BLUETOOTH</h4>
                  <p className="text-sm text-muted-foreground">
                    TURN ON AND OFF BLUETOOTH ON JETSON
                  </p>
                </div>
              </div>
              {loadingToggle ? (
                <div className="w-9 h-5 rounded-full bg-gray-200 animate-pulse" />
              ) : (
                <Switch
                  checked={isEnabled}
                  onCheckedChange={handleToggle}
                  disabled={loadingToggle}
                />
              )}
            </div>
          </div>

          {/* Devices Section */}
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-bold">DEVICES</h3>
            {isEnabled && (
              <button
                onClick={async () => {
                  if (!scanning) {
                    setScanning(true);
                    try {
                      const res = await fetch(`${API_BASE}/scan?force=true`);
                      const data = await res.json();
                      setDevices(prevDevices => {
                        // Keep connected device at top if exists
                        const newDevices = data.devices || [];
                        if (connectedDevice) {
                          const connected = prevDevices.find(d => d.address === connectedDevice);
                          if (connected && !newDevices.some(d => d.address === connectedDevice)) {
                            newDevices.unshift(connected);
                          }
                        }
                        return newDevices;
                      });
                    } catch (err) {
                      console.error("Manual scan failed:", err);
                      setError("Scan failed");
                    } finally {
                      setScanning(false);
                    }
                  }
                }}
                className={`px-4 py-2 rounded-md ${
                  scanning 
                    ? 'bg-gray-100 text-gray-500 cursor-not-allowed' 
                    : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                } flex items-center gap-2 transition-colors`}
                disabled={scanning}
              >
                {scanning ? (
                  <>
                    <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                    Scanning...
                  </>
                ) : (
                  <>
                    🔍 Scan for Devices
                  </>
                )}
              </button>
            )}
          </div>
          {!isEnabled && (
            <p className="text-muted-foreground">
              Turn on Bluetooth to see available devices
            </p>
          )}
          {isEnabled && !scanning && devices.length === 0 && (
            <p>No devices found. Click Scan to search for devices.</p>
          )}
          {isEnabled && devices.length > 0 && (
            <ul className="space-y-2">
              {devices
                .sort((a, b) => {
                  // Always keep connected device first
                  const aConnected = isConnected && connectedDevice === a.address;
                  const bConnected = isConnected && connectedDevice === b.address;
                  if (aConnected && !bConnected) return -1;
                  if (!aConnected && bConnected) return 1;
                  // Then recently seen devices
                  const aRecent = a.last_seen || 0;
                  const bRecent = b.last_seen || 0;
                  if (aRecent !== bRecent) return bRecent - aRecent;
                  // Finally sort by name
                  return (a.name || "").localeCompare(b.name || "");
                })
                .map((device) => {
                  const isDeviceConnected = isConnected && connectedDevice === device.address;
                return (
                  <li
                    key={device.address}
                    className="flex justify-between items-center p-4 border rounded hover:bg-gray-50"
                  >
                    <div className="flex flex-col">
                      <span className="font-semibold text-lg">
                        {device.name || 'Unknown Device'}
                      </span>
                      <span className="text-sm text-gray-500">
                        Type: {device.type}
                      </span>
                      <span className="text-xs text-gray-400 font-mono">
                        {device.address}
                      </span>
                      {isDeviceConnected && (
                        <span className="mt-1 text-green-600 font-bold flex items-center gap-1">
                          <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                          Connected
                        </span>
                      )}
                    </div>
                    <button
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                        isDeviceConnected 
                          ? 'bg-green-600 hover:bg-green-700' 
                          : 'bg-blue-600 hover:bg-blue-700'
                      } text-white transition-colors`}
                      onClick={() => handleConnect(device.address)}
                      disabled={connectingDevice === device.address || isDeviceConnected}
                    >
                      <Plug className="w-5 h-5" />
                      <span>
                        {isDeviceConnected
                          ? "Connected"
                          : connectingDevice === device.address
                            ? "Connecting..."
                            : "Connect"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </SettingsLayout>
  );
};

export default Bluetooth;
