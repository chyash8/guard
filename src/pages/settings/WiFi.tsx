import SettingsLayout from "@/components/SettingsLayout";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Wifi, Lock, Unlock, Loader2, Check, X } from "lucide-react";
import { useEffect, useState } from "react";

const JETSON_IP = "http://192.168.0.101:5000";

const WiFiSettings = () => {
  const [isEnabled, setIsEnabled] = useState(false);
  const [loadingToggle, setLoadingToggle] = useState(false);
  const [networks, setNetworks] = useState<any[]>([]);
  const [scanning, setScanning] = useState(false);
  const [connectingTo, setConnectingTo] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [selectedNetwork, setSelectedNetwork] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [currentConnection, setCurrentConnection] = useState<any>(null);
  const [showPasswordInput, setShowPasswordInput] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch current WiFi status and connection info
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch(`${JETSON_IP}/wifi/status`);
        if (!res.ok) throw new Error("Failed to fetch WiFi status");
        const data = await res.json();
        setIsEnabled(data.status === "on");
        
        // Also fetch current connection if WiFi is on
        if (data.status === "on") {
          await fetchCurrentConnection();
        }
      } catch (err) {
        console.error("Failed to fetch WiFi status:", err);
        setError("Failed to fetch WiFi status");
      }
    };
    fetchStatus();
  }, []);

  // Fetch current connection info
  const fetchCurrentConnection = async () => {
    try {
      // You'll need to add this endpoint to your backend
      const res = await fetch(`${JETSON_IP}/wifi/connection`);
      if (res.ok) {
        const data = await res.json();
        setCurrentConnection(data.connected ? data : null);
      }
    } catch (err) {
      console.error("Failed to fetch connection info:", err);
    }
  };

  // Toggle WiFi
  const handleToggle = async (checked: boolean) => {
    setLoadingToggle(true);
    setError(null);
    try {
      const state = checked ? "on" : "off";
      const res = await fetch(`${JETSON_IP}/wifi/toggle?state=${state}`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to toggle WiFi");
      const data = await res.json();
      if (data.status === state) {
        setIsEnabled(checked);
        if (!checked) {
          setCurrentConnection(null);
          setNetworks([]);
        }
      }
    } catch (err) {
      console.error("Error toggling WiFi:", err);
      setError("Failed to toggle WiFi");
    } finally {
      setLoadingToggle(false);
    }
  };

  // Scan for networks when WiFi is ON
  useEffect(() => {
    if (!isEnabled) {
      setNetworks([]);
      return;
    }

    const scanNetworks = async () => {
      setScanning(true);
      try {
        const res = await fetch(`${JETSON_IP}/wifi/scan`);
        if (!res.ok) throw new Error("Failed to scan networks");
        const data = await res.json();
        setNetworks(data.networks || []);
        await fetchCurrentConnection(); // Update connection status
      } catch (err) {
        console.error("Failed to scan networks:", err);
        setError("Failed to scan networks");
      } finally {
        setScanning(false);
      }
    };

    scanNetworks();
    const interval = setInterval(scanNetworks, 15000); // Refresh every 15s
    return () => clearInterval(interval);
  }, [isEnabled]);

  // Connect to network
  const handleConnect = async (network: any) => {
    if (network.security !== "--" && !password && showPasswordInput !== network.ssid) {
      setShowPasswordInput(network.ssid);
      return;
    }

    setConnectingTo(network.ssid);
    setError(null);
    try {
      const res = await fetch(`${JETSON_IP}/wifi/connect`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ssid: network.ssid,
          password: network.security !== "--" ? password : null,
        }),
      });

      const data = await res.json();
      
      if (res.ok && data.status === "connected") {
        setCurrentConnection({
          ssid: network.ssid,
          signal: network.signal,
          security: network.security
        });
        setPassword("");
        setShowPasswordInput(null);
      } else {
        throw new Error(data.error || "Failed to connect");
      }
    } catch (err) {
      console.error("Error connecting:", err);
      setError(`Failed to connect to ${network.ssid}: ${err.message}`);
    } finally {
      setConnectingTo(null);
    }
  };

  // Disconnect from current network
  const handleDisconnect = async () => {
    if (!currentConnection) return;
    
    setDisconnecting(true);
    setError(null);
    try {
      const res = await fetch(`${JETSON_IP}/wifi/disconnect`, {
        method: "POST",
      });
      
      if (res.ok) {
        setCurrentConnection(null);
      } else {
        throw new Error("Failed to disconnect");
      }
    } catch (err) {
      console.error("Error disconnecting:", err);
      setError("Failed to disconnect from network");
    } finally {
      setDisconnecting(false);
    }
  };

  const isCurrentNetwork = (network: any) => {
    return currentConnection && currentConnection.ssid === network.ssid;
  };

  return (
    <SettingsLayout>
      <div className="space-y-8">
        <h2 className="text-2xl font-bold">WiFi</h2>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2">
              <X className="w-5 h-5 text-red-600" />
              <p className="text-red-800">{error}</p>
            </div>
          </div>
        )}

        <div className="space-y-6">
          {/* WiFi Toggle */}
          <h3 className="text-xl font-bold">TURN ON & OFF</h3>
          <div className="p-6 border border-border rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Wifi className="w-6 h-6" />
                <div>
                  <h4 className="font-bold">WiFi</h4>
                  <p className="text-sm text-muted-foreground">
                    TURN ON AND OFF WiFi
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

          {/* Current Connection */}
          {currentConnection && (
            <div className="space-y-2">
              <h3 className="text-xl font-bold">CURRENT CONNECTION</h3>
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-green-600" />
                    <div>
                      <h4 className="font-semibold text-green-800">
                        {currentConnection.ssid}
                      </h4>
                      <p className="text-sm text-green-600">
                        Connected • Signal: {currentConnection.signal}%
                        {currentConnection.security !== "--" && (
                          <span className="ml-2">🔒 {currentConnection.security}</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={handleDisconnect}
                    disabled={disconnecting}
                    variant="outline"
                    size="sm"
                  >
                    {disconnecting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "Disconnect"
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Networks */}
          <h3 className="text-xl font-bold">AVAILABLE NETWORKS</h3>
          {!isEnabled && (
            <p className="text-muted-foreground">
              Turn on WiFi to see available networks
            </p>
          )}
          
          {isEnabled && scanning && (
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <p>Scanning for networks...</p>
            </div>
          )}
          
          {isEnabled && !scanning && networks.length === 0 && (
            <p>No networks found.</p>
          )}
          
          {isEnabled && networks.length > 0 && (
            <div className="space-y-2">
              {networks.map((network, idx) => (
                <div key={idx} className="space-y-2">
                  <div className={`flex justify-between items-center p-3 border rounded-lg ${
                    isCurrentNetwork(network) 
                      ? 'border-green-300 bg-green-50' 
                      : 'border-gray-200'
                  }`}>
                    <div className="flex items-center gap-3">
                      {network.security !== "--" ? (
                        <Lock className="w-4 h-4 text-gray-500" />
                      ) : (
                        <Unlock className="w-4 h-4 text-gray-500" />
                      )}
                      <div>
                        <span className="font-medium">
                          {network.ssid || "(Hidden SSID)"}
                        </span>
                        <p className="text-sm text-gray-500">
                          Signal: {network.signal}% • {
                            network.security !== "--" 
                              ? `🔒 ${network.security}` 
                              : "🔓 Open"
                          }
                          {isCurrentNetwork(network) && (
                            <span className="ml-2 text-green-600 font-medium">Connected</span>
                          )}
                        </p>
                      </div>
                    </div>
                    
                    {!isCurrentNetwork(network) && (
                      <Button
                        onClick={() => handleConnect(network)}
                        disabled={connectingTo === network.ssid}
                        size="sm"
                      >
                        {connectingTo === network.ssid ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          "Connect"
                        )}
                      </Button>
                    )}
                  </div>

                  {/* Password Input */}
                  {showPasswordInput === network.ssid && network.security !== "--" && (
                    <div className="ml-7 p-3 bg-gray-50 rounded-lg space-y-3">
                      <div>
                        <label className="block text-sm font-medium mb-1">
                          Password for {network.ssid}
                        </label>
                        <Input
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Enter network password"
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              handleConnect(network);
                            }
                          }}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => handleConnect(network)}
                          disabled={!password || connectingTo === network.ssid}
                          size="sm"
                        >
                          {connectingTo === network.ssid ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            "Connect"
                          )}
                        </Button>
                        <Button
                          onClick={() => {
                            setShowPasswordInput(null);
                            setPassword("");
                          }}
                          variant="outline"
                          size="sm"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </SettingsLayout>
  );
};

export default WiFiSettings;