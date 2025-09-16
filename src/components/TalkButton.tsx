import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
 
const TalkButton = () => {
  const [isPressed, setIsPressed] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
 
  // Check connection to main dashboard
  const checkConnection = async () => {
    try {
      const response = await fetch('http://localhost:3004/api/ping', {
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
      const response = await fetch('http://localhost:3004/api/talk-control', {
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
 
  const handleMouseDown = () => {
    // Toggle the pressed state
    const newPressedState = !isPressed;
    setIsPressed(newPressedState);
    
    // Send appropriate command based on new state
    if (newPressedState) {
      sendCommand('start-talk');
    } else {
      sendCommand('stop-talk');
    }
  };
 
  const handleMouseUp = () => {
    // Do nothing on mouse up - we only toggle on mouse down
  };
 
  const handleMouseLeave = () => {
    // Do nothing on mouse leave - button stays in current state
  };
 
  // Check connection on component mount and cleanup on unmount
  useEffect(() => {
    checkConnection();
    // Check connection every 5 seconds
    const interval = setInterval(checkConnection, 5000);
    
    // Handle browser/tab close - stop talk if button is pressed
    const handleBeforeUnload = () => {
      if (isPressed) {
        // Use sendBeacon for reliable delivery during page unload
        const data = JSON.stringify({
          command: 'stop-talk',
          timestamp: Date.now(),
          source: 'guard-dashboard-beforeunload'
        });
        
        if (navigator.sendBeacon) {
          navigator.sendBeacon('http://localhost:3004/api/talk-control', data);
        } else {
          // Fallback for browsers without sendBeacon
          fetch('http://localhost:3004/api/talk-control', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: data,
            keepalive: true
          }).catch(() => {});
        }
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    // Cleanup function - ensure talk is stopped when component unmounts
    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      
      // If button was pressed when component unmounts, send stop command
      if (isPressed) {
        console.log('🧹 Component unmounting - stopping talk...');
        fetch('http://localhost:3004/api/talk-control', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            command: 'stop-talk',
            timestamp: Date.now(),
            source: 'guard-dashboard-cleanup'
          }),
        }).catch(error => {
          console.error('Error sending cleanup stop command:', error);
        });
      }
    };
  }, [isPressed]); // Include isPressed in dependency array
 
  return (
    <div className="flex flex-col items-center justify-center py-12 space-y-4">
      <Button
        size="lg"
        className={`w-64 h-64 rounded-full text-white text-xl font-bold shadow-2xl transform transition-all duration-200 ${
          isPressed
            ? 'scale-95 shadow-inner'
            : 'bg-talk hover:bg-talk/90 hover:scale-105'
        }`}
        style={{
          backgroundColor: isPressed ? '#22c55e' : undefined, // Green-500 when pressed
        }}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleMouseDown}
        onTouchEnd={handleMouseUp}
      >
        {isPressed ? 'TALKING...\nCLICK TO STOP' : 'PRESS TO\nTALK'}
      </Button>
      
      {/* Connection Status */}
      <div className={`text-sm font-medium ${isConnected ? 'text-green-500' : 'text-red-500'}`}>
        {isConnected ? '🟢 Connected to Main Dashboard' : '🔴 Main Dashboard Offline'}
      </div>
    </div>
  );
};
 
export default TalkButton;
 