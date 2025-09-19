import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Battery, Thermometer, Activity, Zap, QrCode, X } from "lucide-react";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import PasswordDialog from "@/components/PasswordDialog";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { socket } from "@/lib/socket";
import { useToast } from "@/components/ui/use-toast";

interface WifiStatus {
  connected: boolean;
  ssid: string | null;
  signal: number | null;
  error?: string;
  status?: string;
}

const SystemStatus = () => {
  const [showQRModal, setShowQRModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [wifiStatus, setWifiStatus] = useState<WifiStatus | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<number>(Date.now());
  const [retryCount, setRetryCount] = useState(0);
  const [cpuTemp, setCpuTemp] = useState<number | null>(null);
  const [gpuTemp, setGpuTemp] = useState<number | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Handle socket connection status and WiFi updates
  useEffect(() => {
    const handleConnect = () => {
      setSocketConnected(true);
      toast({
        title: "System Connected",
        description: "Connection to system established",
        duration: 3000
      });
    };

    const handleDisconnect = () => {
      setSocketConnected(false);
      toast({
        title: "System Disconnected",
        description: "Connection to system lost",
        variant: "destructive",
        duration: null // Keep showing until reconnected
      });
    };

    const handleWifiStateChange = (data: { status: string, current_network: WifiStatus | null, timestamp: number }) => {
      console.log('WiFi state change:', data);
      setLastUpdate(data.timestamp * 1000); // Convert to milliseconds
      
      if (data.status === 'error') {
        setWifiStatus(data.current_network);
        toast({
          title: "System Error",
          description: data.current_network?.error || "Unknown error occurred",
          variant: "destructive",
          duration: 5000
        });
        return;
      }
      
      if (data.current_network) {
        setWifiStatus(data.current_network);
        setRetryCount(0); // Reset retry count on successful update
        
        if (data.current_network.connected) {
          toast({
            title: "WiFi Connected",
            description: `Connected to ${data.current_network.ssid}`,
            duration: 3000
          });
        } else if (data.current_network.error) {
          toast({
            title: "WiFi Error",
            description: data.current_network.error,
            variant: "destructive",
            duration: null // Keep showing until resolved
          });
        }
      } else if (data.status === "off") {
        setWifiStatus({
          connected: false,
          ssid: null,
          signal: null,
          status: "off"
        });
        toast({
          title: "WiFi Disconnected",
          description: "WiFi is turned off",
          variant: "destructive",
          duration: null // Keep showing until resolved
        });
      }
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("wifi_state_change", handleWifiStateChange);

    // Initial connection status
    setSocketConnected(socket.connected);

    // System temperature monitoring
    const fetchTemperatures = async () => {
      try {
        console.log("Fetching temperatures..."); // Debug log
        const response = await fetch("http://localhost:5000/system/temperature");
        console.log("Response status:", response.status); // Debug log
        if (!response.ok) throw new Error("Failed to fetch temperatures");
        const data = await response.json();
        console.log("Temperature data received:", data); // Debug log
        setCpuTemp(data.cpu);
        setGpuTemp(data.gpu);
      } catch (error) {
        console.error("Error fetching temperatures:", error);
      }
    };

    // Set up temperature polling
    const tempInterval = setInterval(fetchTemperatures, 2000); // Update every 2 seconds
    fetchTemperatures(); // Initial fetch

    // Initial WiFi status fetch
    const fetchInitialStatus = async () => {
      try {
        const response = await fetch("/wifi/connection");
        if (!response.ok) throw new Error("Failed to fetch WiFi status");
        const data = await response.json();
        setWifiStatus(data);
      } catch (error) {
        console.error("Error fetching initial WiFi status:", error);
      }
    };
    
    fetchInitialStatus();

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("wifi_state_change", handleWifiStateChange);
      clearInterval(tempInterval);
    };
  }, [toast]);

  const handlePasswordSuccess = () => {
    setShowPassword(false);
    navigate("/settings/general");
  };
  
  return (
    <div className="w-[1280px] mx-auto bg-background">
      <Header />
      
      <div className="p-8">
        <h1 className="text-2xl font-bold text-center mb-8">SYSTEM STATUS</h1>
        
        <div className="grid grid-cols-2 gap-6 mb-8">
          <Card className="p-6 text-center">
            <CardContent className="p-0">
              <div className="mb-4">
                <div className="w-24 h-24 mx-auto mb-4 relative">
                  <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 36 36">
                    <path
                      className="text-muted fill-none stroke-current stroke-2"
                      d="M18 2.0845
                        a 15.9155 15.9155 0 0 1 0 31.831
                        a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    <path
                      className="text-primary fill-none stroke-current stroke-2"
                      strokeDasharray="80, 100"
                      d="M18 2.0845
                        a 15.9155 15.9155 0 0 1 0 31.831
                        a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-2xl font-bold text-primary">80%</span>
                  </div>
                </div>
              </div>
              <p className="text-muted-foreground font-bold">BATTERY LEVEL</p>
            </CardContent>
          </Card>
          
          <Card className="p-6 text-center">
            <CardContent className="p-0">
              <div className="mb-4">
                <div className="w-24 h-24 mx-auto mb-4 relative">
                  <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 36 36">
                    <path
                      className="text-muted fill-none stroke-current stroke-2"
                      d="M18 2.0845
                        a 15.9155 15.9155 0 0 1 0 31.831
                        a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    <path
                      className="text-primary fill-none stroke-current stroke-2"
                      strokeDasharray="90, 100"
                      d="M18 2.0845
                        a 15.9155 15.9155 0 0 1 0 31.831
                        a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-2xl font-bold text-primary">90%</span>
                  </div>
                </div>
              </div>
              <p className="text-muted-foreground font-bold">SYSTEM HEALTH</p>
            </CardContent>
          </Card>
        </div>
        
          <div className="grid grid-cols-3 gap-6 mb-8">
          <Card className="p-6 text-center">
            <CardContent className="p-0">
              <div className="mb-4">
                <div className={`text-xl font-bold ${socketConnected ? 'text-success' : 'text-destructive'} mb-2`}>
                  {socketConnected ? 'CONNECTED' : 'DISCONNECTED'}
                </div>
              </div>
              <p className="text-muted-foreground font-bold">SYSTEM CONNECTION</p>
            </CardContent>
          </Card>
          
          <Card className="p-6 text-center">
            <CardContent className="p-0">
              <div className="mb-4">
                <div className={`text-xl font-bold ${wifiStatus?.connected ? 'text-success' : 'text-destructive'} mb-2`}>
                  {wifiStatus?.connected ? 'CONNECTED' : 'DISCONNECTED'}
                </div>
                {wifiStatus?.connected && wifiStatus.ssid && (
                  <div className="text-sm text-muted-foreground">{wifiStatus.ssid}</div>
                )}
                {wifiStatus?.signal && (
                  <div className="text-sm text-muted-foreground">Signal: {wifiStatus.signal}%</div>
                )}
              </div>
              <p className="text-muted-foreground font-bold">WIFI STATUS</p>
            </CardContent>
          </Card>
          
          <Card 
            className="p-4 text-center bg-info text-white cursor-pointer hover:bg-info/90 transition-colors"
            onClick={() => setShowPassword(true)}
          >
            <CardContent className="p-0">
              <div className="mb-2">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Zap className="w-4 h-4 text-destructive" />
                  <span className="text-sm font-bold">CHARGING</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>        <div className="grid grid-cols-2 gap-6 mb-8">
          <Card className="p-6 text-center">
            <CardContent className="p-0">
              <div className="mb-4">
                <div className="text-3xl font-bold mb-2">
                  {typeof cpuTemp === 'number' ? `${cpuTemp}°C` : "--°C"}
                </div>
                <div className="text-sm text-muted-foreground">
                  {cpuTemp && cpuTemp > 80 ? "High!" : 
                   cpuTemp && cpuTemp > 60 ? "Warm" : 
                   cpuTemp ? "Normal" : "Reading..."}
                </div>
              </div>
              <p className="text-muted-foreground font-bold">CPU TEMPERATURE</p>
            </CardContent>
          </Card>
          
          <Card className="p-6 text-center">
            <CardContent className="p-0">
              <div className="mb-4">
                <div className="text-3xl font-bold mb-2">
                  {typeof gpuTemp === 'number' ? `${gpuTemp}°C` : "--°C"}
                </div>
                <div className="text-sm text-muted-foreground">
                  {gpuTemp && gpuTemp > 80 ? "High!" : 
                   gpuTemp && gpuTemp > 60 ? "Warm" : 
                   gpuTemp ? "Normal" : "Reading..."}
                </div>
              </div>
              <p className="text-muted-foreground font-bold">GPU TEMPERATURE</p>
            </CardContent>
          </Card>
        </div>
        
        <div className="flex justify-end">
          <button 
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            onClick={() => setShowQRModal(true)}
          >
            <QrCode className="w-4 h-4" />
            QR FOR PRIVACY POLICY
          </button>
        </div>
      </div>
      
      <BottomNav />
      
      <Dialog open={showQRModal} onOpenChange={setShowQRModal}>
        <DialogContent className="max-w-md mx-auto bg-card border border-border rounded-lg">
          <DialogHeader>
            <DialogTitle className="text-center text-lg font-bold mb-4">
              SCAN WITH PHONE FOR PRIVACY POLICY
            </DialogTitle>
          </DialogHeader>
          <div className="flex justify-center p-8">
            <div className="w-64 h-64 bg-white rounded-lg p-4 flex items-center justify-center">
              <svg viewBox="0 0 200 200" className="w-full h-full">
                <defs>
                  <pattern id="qrPattern" patternUnits="userSpaceOnUse" width="10" height="10">
                    <rect width="10" height="10" fill="white"/>
                  </pattern>
                </defs>
                {/* QR Code pattern - simplified representation */}
                <rect x="0" y="0" width="40" height="40" fill="black"/>
                <rect x="160" y="0" width="40" height="40" fill="black"/>
                <rect x="0" y="160" width="40" height="40" fill="black"/>
                <rect x="10" y="10" width="20" height="20" fill="white"/>
                <rect x="170" y="10" width="20" height="20" fill="white"/>
                <rect x="10" y="170" width="20" height="20" fill="white"/>
                <rect x="15" y="15" width="10" height="10" fill="black"/>
                <rect x="175" y="15" width="10" height="10" fill="black"/>
                <rect x="15" y="175" width="10" height="10" fill="black"/>
                
                {/* Random QR pattern blocks */}
                <rect x="50" y="20" width="10" height="10" fill="black"/>
                <rect x="70" y="20" width="10" height="10" fill="black"/>
                <rect x="90" y="20" width="10" height="10" fill="black"/>
                <rect x="110" y="20" width="10" height="10" fill="black"/>
                <rect x="130" y="20" width="10" height="10" fill="black"/>
                
                <rect x="50" y="40" width="10" height="10" fill="black"/>
                <rect x="80" y="40" width="10" height="10" fill="black"/>
                <rect x="120" y="40" width="10" height="10" fill="black"/>
                
                <rect x="60" y="60" width="10" height="10" fill="black"/>
                <rect x="90" y="60" width="10" height="10" fill="black"/>
                <rect x="110" y="60" width="10" height="10" fill="black"/>
                <rect x="140" y="60" width="10" height="10" fill="black"/>
                
                <rect x="50" y="80" width="10" height="10" fill="black"/>
                <rect x="80" y="80" width="10" height="10" fill="black"/>
                <rect x="100" y="80" width="10" height="10" fill="black"/>
                <rect x="130" y="80" width="10" height="10" fill="black"/>
                <rect x="150" y="80" width="10" height="10" fill="black"/>
                
                <rect x="70" y="100" width="10" height="10" fill="black"/>
                <rect x="90" y="100" width="10" height="10" fill="black"/>
                <rect x="120" y="100" width="10" height="10" fill="black"/>
                <rect x="140" y="100" width="10" height="10" fill="black"/>
                
                <rect x="50" y="120" width="10" height="10" fill="black"/>
                <rect x="80" y="120" width="10" height="10" fill="black"/>
                <rect x="110" y="120" width="10" height="10" fill="black"/>
                <rect x="150" y="120" width="10" height="10" fill="black"/>
                
                <rect x="60" y="140" width="10" height="10" fill="black"/>
                <rect x="90" y="140" width="10" height="10" fill="black"/>
                <rect x="130" y="140" width="10" height="10" fill="black"/>
                
                <rect x="50" y="160" width="10" height="10" fill="black"/>
                <rect x="70" y="160" width="10" height="10" fill="black"/>
                <rect x="100" y="160" width="10" height="10" fill="black"/>
                <rect x="120" y="160" width="10" height="10" fill="black"/>
                <rect x="150" y="160" width="10" height="10" fill="black"/>
                
                <rect x="60" y="180" width="10" height="10" fill="black"/>
                <rect x="80" y="180" width="10" height="10" fill="black"/>
                <rect x="110" y="180" width="10" height="10" fill="black"/>
                <rect x="140" y="180" width="10" height="10" fill="black"/>
              </svg>
            </div>
          </div>
          <div className="text-center pb-4">
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <QrCode className="w-4 h-4" />
              QR FOR PRIVACY POLICY
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      <PasswordDialog
        open={showPassword}
        onClose={() => setShowPassword(false)}
        onSuccess={handlePasswordSuccess}
      />
    </div>
  );
};

export default SystemStatus;