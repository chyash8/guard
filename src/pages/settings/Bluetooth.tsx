import { useEffect, useState } from "react";
import SettingsLayout from "@/components/SettingsLayout";
import { Switch } from "@/components/ui/switch";
import { Bluetooth as BluetoothIcon, Plug } from "lucide-react";

const JETSON_IP = window.location.hostname === 'localhost' ? '192.168.0.101' : window.location.hostname;
const API_BASE = `http://${JETSON_IP}:5000/bluetooth`;

interface Device {
  name: string | null;
  address: string;
  type: string;
}

const Bluetooth = () => {
  const [isEnabled, setIsEnabled] = useState<boolean>(false);
  const [loadingToggle, setLoadingToggle] = useState<boolean>(false);
  const [devices, setDevices] = useState<Device[]>([]);
  const [scanning, setScanning] = useState<boolean>(false);
  const [connectingDevice, setConnectingDevice] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [connectedDevice, setConnectedDevice] = useState<string | null>(null);

  // 1️⃣ Fetch current Bluetooth status (initial + every 5s)
  useEffect(() => {
    let retryTimeout: NodeJS.Timeout;
    let isSubscribed = true;

    const fetchStatus = async (retryCount = 0) => {
      if (!isSubscribed) return;

      try {
        console.log("Fetching Bluetooth status...");
        const res = await fetch(`${API_BASE}/status`);
        
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        
        const data = await res.json();
        console.log("Status response:", data);
        
        if (isSubscribed) {
          setIsEnabled(data.status === "on");
          setIsConnected(data.connected);
          setConnectedDevice(data.device || null);
        }
      } catch (err) {
        console.error("Failed to fetch Bluetooth status:", err);
        
        // Retry more frequently on error, up to 3 times
        if (retryCount < 3 && isSubscribed) {
          console.log(`Retrying status fetch in 2s (attempt ${retryCount + 1})...`);
          retryTimeout = setTimeout(() => fetchStatus(retryCount + 1), 2000);
        }
      }
    };

    // Initial fetch
    fetchStatus();

    // Regular polling
    const interval = setInterval(fetchStatus, 5000);

    // Cleanup
    return () => {
      isSubscribed = false;
      clearInterval(interval);
      if (retryTimeout) clearTimeout(retryTimeout);
    };
  }, []);

  // 2️⃣ Toggle Bluetooth
  const handleToggle = async (checked: boolean) => {
    setLoadingToggle(true);
    const state = checked ? "on" : "off";
    
    // Function to attempt toggle with retry
    const attemptToggle = async (retryCount = 0): Promise<boolean> => {
      try {
        console.log(`Attempting to toggle Bluetooth ${state} (attempt ${retryCount + 1})`);
        
        const res = await fetch(`${API_BASE}/toggle`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ state }),
        });

        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        
        const data = await res.json();
        console.log("Toggle response:", data);

        if (data.status === state) {
          console.log(`Successfully toggled Bluetooth ${state}`);
          return true;
        } else {
          console.error(`Toggle failed: Expected ${state}, got ${data.status}`);
          if (data.error) {
            alert(`Failed to toggle Bluetooth: ${data.error}`);
          }
          return false;
        }
      } catch (err) {
        console.error(`Toggle attempt ${retryCount + 1} failed:`, err);
        if (retryCount < 2) { // Try up to 3 times
          console.log("Retrying toggle...");
          await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s before retry
          return attemptToggle(retryCount + 1);
        }
        alert(`Failed to toggle Bluetooth. Please try again in a few moments. Error: ${err.message}`);
        return false;
      }
    };

    try {
      const success = await attemptToggle();
      if (success) {
        setIsEnabled(checked);
        if (!checked) {
          setIsConnected(false);
          setConnectedDevice(null);
          setDevices([]);
        }
      } else {
        // Reset the switch to its previous state
        setIsEnabled(!checked);
      }
    } finally {
      setLoadingToggle(false);
    }
  };

  // 3️⃣ Scan devices when Bluetooth is ON
  useEffect(() => {
    if (!isEnabled) {
      setDevices([]);
      return;
    }

    const scanDevices = async () => {
      setScanning(true);
      try {
        const res = await fetch(`${API_BASE}/scan`);
        const data = await res.json();
        setDevices(data.devices || []);
      } catch (err) {
        console.error("Failed to scan devices:", err);
      } finally {
        setScanning(false);
      }
    };

    scanDevices();
    
    // Scan every 3 seconds for the first 30 seconds
    let fastInterval = setInterval(scanDevices, 3000);
    setTimeout(() => {
      clearInterval(fastInterval);
      // Then switch to scanning every 10 seconds
      fastInterval = setInterval(scanDevices, 10000);
    }, 30000);
    
    return () => clearInterval(fastInterval);
  }, [isEnabled]);

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
        alert(`✅ Successfully connected to ${deviceName}`);
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
        <div className="mb-4">
          <span
            className={`font-semibold ${
              isConnected ? "text-green-600" : "text-red-600"
            }`}
          >
            {isConnected
              ? `Jetson is CONNECTED to ${connectedDevice}`
              : "Jetson is NOT CONNECTED via Bluetooth"}
          </span>
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
              <Switch
                checked={isEnabled}
                onCheckedChange={handleToggle}
                disabled={loadingToggle}
              />
            </div>
          </div>

          {/* Devices Section */}
          <h3 className="text-xl font-bold">DEVICES</h3>
          {!isEnabled && (
            <p className="text-muted-foreground">
              Turn on Bluetooth to see available devices
            </p>
          )}
          {isEnabled && scanning && <p>🔍 Scanning for devices...</p>}
          {isEnabled && !scanning && devices.length === 0 && (
            <p>No devices found.</p>
          )}
          {isEnabled && devices.length > 0 && (
            <ul className="space-y-2">
              {devices.map((device) => {
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
