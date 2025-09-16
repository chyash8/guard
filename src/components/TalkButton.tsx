import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
 
const TalkButton = () => {
  const [isPressed, setIsPressed] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
 
  // Check connection to main dashboard
  const checkConnection = async () => {
    try {
      const response = await fetch('http://192.168.0.206:3004/api/ping', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      setIsConnected(response.ok);
      return response.ok;
    } catch (error) {
      setIsConnected(false);
      return false;
    }
  };
 
  // Send command to main dashboard
  const sendCommand = async (command: 'start-talk' | 'stop-talk') => {
    try {
      const response = await fetch('http://192.168.0.206:3004/api/talk-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command,
          timestamp: Date.now(),
          source: 'guard-dashboard'
        }),
      });
      
      if (!response.ok) {
        console.error('Failed to send command to main dashboard');
      }
    } catch (error) {
      console.error('Error communicating with main dashboard:', error);
    }
  };
 
  const handleMouseDown = async () => {
    setIsPressed(true);
    await sendCommand('start-talk');
  };
 
  const handleMouseUp = async () => {
    setIsPressed(false);
    await sendCommand('stop-talk');
  };
 
  const handleMouseLeave = async () => {
    if (isPressed) {
      setIsPressed(false);
      await sendCommand('stop-talk');
    }
  };
 
  // Check connection on component mount
  useEffect(() => {
    checkConnection();
    // Check connection every 5 seconds
    const interval = setInterval(checkConnection, 5000);
    return () => clearInterval(interval);
  }, []);
 
  return (
    <div className="flex flex-col items-center justify-center py-12 space-y-4">
      <Button
        size="lg"
        className={`w-64 h-64 rounded-full text-white text-xl font-bold shadow-2xl transform transition-all duration-200 ${
          isPressed
            ? 'bg-red-600 scale-95 shadow-inner'
            : 'bg-talk hover:bg-talk/90 hover:scale-105'
        }`}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleMouseDown}
        onTouchEnd={handleMouseUp}
      >
        PRESS TO<br />TALK
      </Button>
      
      {/* Connection Status */}
      <div className={`text-sm font-medium ${isConnected ? 'text-green-500' : 'text-red-500'}`}>
        {isConnected ? '🟢 Connected to Main Dashboard' : '🔴 Main Dashboard Offline'}
      </div>
    </div>
  );
};
 
export default TalkButton;
 