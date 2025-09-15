import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Battery, Thermometer, Activity, Zap, QrCode, X } from "lucide-react";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import PasswordDialog from "@/components/PasswordDialog";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

const SystemStatus = () => {
  const [showQRModal, setShowQRModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handlePasswordSuccess = () => {
    setShowPassword(false);
    navigate("/settings/general");
  };
  
  return (
    <div className="w-[1280px] h-[800px] mx-auto bg-background">
      <Header />
      
      <div className="p-8 h-[calc(100%-160px)] overflow-y-auto">
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
          <div></div>
          
          <Card className="p-6 text-center">
            <CardContent className="p-0">
              <div className="mb-4">
                <div className="text-xl font-bold text-success mb-2">ACTIVE</div>
              </div>
              <p className="text-muted-foreground font-bold">SYSTEM STATE</p>
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
        </div>
        
        <div className="grid grid-cols-2 gap-6 mb-8">
          <Card className="p-6 text-center">
            <CardContent className="p-0">
              <div className="mb-4">
                <div className="text-3xl font-bold mb-2">20°C</div>
              </div>
              <p className="text-muted-foreground font-bold">BATTERY TEMP</p>
            </CardContent>
          </Card>
          
          <Card className="p-6 text-center">
            <CardContent className="p-0">
              <div className="mb-4">
                <div className="text-3xl font-bold mb-2">23°C</div>
              </div>
              <p className="text-muted-foreground font-bold">CORE TEMP</p>
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