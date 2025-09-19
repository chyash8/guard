import SettingsLayout from "@/components/SettingsLayout";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Wifi, Lock, Unlock, Loader2, Check, X } from "lucide-react";
import { useEffect, useState } from "react";
import { socket } from "@/lib/socket";
import { API_URL } from "@/lib/config";

type Network = {
  ssid: string;
  security: string;
};

const WiFiSettings = () => {
  const [isEnabled, setIsEnabled] = useState(false);
  const [loadingToggle, setLoadingToggle] = useState(false);
  const [networks, setNetworks] = useState<Network[]>([]);
  const [scanning, setScanning] = useState(false);
  const [connectingTo, setConnectingTo] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [password, setPassword] = useState("");
  const [currentConnection, setCurrentConnection] = useState<Network | null>(null);
  const [showPasswordInput, setShowPasswordInput] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // WebSocket & initial fetch setup
  useEffect(() => {
    const handleWifiState = (data: any) => {
      const isWifiOn = data.status === "on";
      setIsEnabled(isWifiOn);
      
      // Clear networks and connection if WiFi is off
      if (!isWifiOn) {
        setNetworks([]);
        setCurrentConnection(null);
        setShowPasswordInput(null);
        setPassword("");
      } else {
        setCurrentConnection(data.current_network);
      }
    };

    socket.on("wifi_state_change", handleWifiState);

    socket.on("connect", () => {
      console.log("WebSocket connected");
      setError(null);
    });

    socket.on("disconnect", () => {
      console.warn("WebSocket disconnected");
      setError("Lost connection to WiFi server");
    });

    const fetchStatus = async () => {
      try {
        const res = await fetch(`${API_URL}/wifi/status`);
        const data = await res.json();
        setIsEnabled(data.status === "on");

        if (data.status === "on") {
          await fetchCurrentConnection();
        }
      } catch (err) {
        console.error(err);
        setError("Failed to fetch WiFi status");
      }
    };

    fetchStatus();

    return () => {
      socket.disconnect();
      socket.off("wifi_state_change");
      socket.off("connect");
      socket.off("disconnect");
    };
  }, []);

  const fetchCurrentConnection = async () => {
    try {
      const res = await fetch(`${API_URL}/wifi/connection`);
      if (res.ok) {
        const data = await res.json();
        setCurrentConnection(data.connected ? data : null);
      }
    } catch (err) {
      console.error("Failed to fetch connection info:", err);
    }
  };

  const handleToggle = async (checked: boolean) => {
    setLoadingToggle(true);
    setError(null);
    try {
      const state = checked ? "on" : "off";
      console.log(`Sending WiFi toggle request with state: ${state}`);
      setIsEnabled(checked); // Optimistically update the UI
      const res = await fetch(`${API_URL}/wifi/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Toggle failed");
      }

      setTimeout(() => setLoadingToggle(false), 2000);
    } catch (err: any) {
      setError(err.message || "Failed to toggle WiFi");
      setLoadingToggle(false);
    }
  };

  useEffect(() => {
    if (!isEnabled) {
      setNetworks([]);
      setCurrentConnection(null);
      return;
    }

    const scanNetworks = async () => {
      setScanning(true);
      try {
        const res = await fetch(`${API_URL}/wifi/scan`);
        const data = await res.json();
        
        // If WiFi is off, clear networks and return
        if (data.status === "off") {
          setNetworks([]);
          setCurrentConnection(null);
          setIsEnabled(false);
          return;
        }
        
        setNetworks(data.networks || []);
        // Only fetch connection if we got networks back
        if (data.networks && data.networks.length > 0) {
          await fetchCurrentConnection();
        }
      } catch (err) {
        console.error("Scan failed:", err);
        setError("Failed to scan networks");
      } finally {
        setScanning(false);
      }
    };

    scanNetworks();
    const interval = setInterval(scanNetworks, 15000);
    return () => clearInterval(interval);
  }, [isEnabled]);

  const handleConnect = async (network: Network) => {
    if (network.security !== "--" && !password && showPasswordInput !== network.ssid) {
      setShowPasswordInput(network.ssid);
      return;
    }

    setConnectingTo(network.ssid);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/wifi/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
          security: network.security,
        });
        setPassword("");
        setShowPasswordInput(null);
      } else {
        throw new Error(data.error || "Connect failed");
      }
    } catch (err: any) {
      setError(`Failed to connect to ${network.ssid}: ${err.message}`);
    } finally {
      setConnectingTo(null);
    }
  };

  const handleDisconnect = async () => {
    if (!currentConnection) return;
    setDisconnecting(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/wifi/disconnect`, { method: "POST" });
      if (res.ok) {
        setCurrentConnection(null);
      } else {
        throw new Error("Disconnect failed");
      }
    } catch (err) {
      setError("Failed to disconnect");
    } finally {
      setDisconnecting(false);
    }
  };

  const isCurrentNetwork = (network: Network) =>
    currentConnection && currentConnection.ssid === network.ssid;

  return (
    <SettingsLayout>
      <div className="space-y-8">
        <h2 className="text-2xl font-bold">WiFi Settings</h2>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2">
              <X className="w-5 h-5 text-red-600" />
              <p className="text-red-800">{error}</p>
            </div>
          </div>
        )}

        <div className="space-y-6">
          {/* Toggle */}
          <h3 className="text-xl font-bold">WiFi Power</h3>
          <div className="p-6 border rounded-lg">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <Wifi className="w-6 h-6" />
                <div>
                  <p className="font-bold">WiFi</p>
                  <p className="text-sm text-muted-foreground">
                    Enable or disable WiFi
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
              <h3 className="text-xl font-bold">Connected</h3>
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <Check className="text-green-600 w-5 h-5" />
                    <div>
                      <h4 className="font-semibold text-green-800">
                        {currentConnection.ssid}
                      </h4>
                      <p className="text-sm text-green-600">
                        {currentConnection.security !== "--" && (
                          <span>🔒 {currentConnection.security}</span>
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
                    {disconnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Disconnect"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Network List */}
          <h3 className="text-xl font-bold">Available Networks</h3>
          {!isEnabled ? (
            <p className="text-muted-foreground">Enable WiFi to scan networks</p>
          ) : scanning ? (
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <p>Scanning...</p>
            </div>
          ) : networks.length === 0 ? (
            <p>No networks found</p>
          ) : (
            <div className="space-y-2">
              {networks.map((network, idx) => (
                <div key={idx} className="space-y-2">
                  <div
                    className={`flex justify-between items-center p-3 border rounded-lg ${
                      isCurrentNetwork(network)
                        ? "border-green-300 bg-green-50"
                        : "border-gray-200"
                    }`}
                  >
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
                          {network.security !== "--"
                            ? `🔒 ${network.security}`
                            : "🔓 Open"}
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
                            if (e.key === "Enter") {
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
