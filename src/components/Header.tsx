import { useState, useEffect } from "react";
import { Signal, Battery, Circle } from "lucide-react";

const Header = () => {
  const [dateTime, setDateTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setDateTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Format date as DD/MM/YY
  const formattedDate = dateTime
    .toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
    })
    .replace(/\//g, "/");

  // Format time in 12-hour with AM/PM
  const formattedTime = dateTime.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  return (
    <header className="flex items-center justify-between w-full px-6 py-4 bg-card border-b border-border">
      {/* Left Section */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-primary rounded-sm"></div>
          <div className="w-6 h-6 bg-primary rounded-sm"></div>
        </div>
        <div>
          <h1 className="text-xl font-bold text-primary">Guard Controls</h1>
          <p className="text-sm text-muted-foreground">Sakar Robotics</p>
        </div>
      </div>

      {/* Date & Time in Center */}
      <div className="px-4 py-2 bg-muted rounded-lg text-center">
        <div className="text-xs font-semibold text-muted-foreground">
          {formattedDate}
        </div>
        <div className="text-xl font-bold text-foreground">
          {formattedTime.toUpperCase()}
        </div>
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1 px-2 py-1 bg-success/20 rounded-full">
          <Circle className="w-2 h-2 fill-success text-success" />
          <span className="text-xs text-success font-medium">ONLINE</span>
        </div>

        <div className="flex items-center gap-1 px-2 py-1 bg-info/20 rounded-full">
          <Signal className="w-4 h-4 text-info" />
          <div className="flex gap-1">
            
          </div>
        </div>

        <div className="flex items-center gap-1 px-2 py-1 bg-warning/20 rounded-full">
          <Battery className="w-4 h-4 text-warning" />
          <span className="text-xs text-warning font-medium">80% PWR</span>
        </div>

        <div className="flex items-center gap-1 px-2 py-1 bg-destructive/20 rounded-full">
          <Circle className="w-2 h-2 fill-destructive text-destructive" />
          <span className="text-xs text-destructive font-medium">RECORDING</span>
        </div>
      </div>
    </header>
  );
};

export default Header;
