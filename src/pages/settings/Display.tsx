import SettingsLayout from "@/components/SettingsLayout";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Sun, Moon, Smartphone } from "lucide-react";
import { useState, useEffect } from "react";
import { useTheme } from "next-themes";

const DEVICE_IP = "http://localhost:5000"; // Points to your own laptop

const Display = () => {
  const [brightness, setBrightness] = useState([80]); // slider default
  const { theme, setTheme } = useTheme();

  const themeOptions = [
    { id: "auto", label: "AUTO", icon: Smartphone },
    { id: "light", label: "LIGHT", icon: Sun },
    { id: "dark", label: "DARK", icon: Moon },
  ];

  // 🔹 Fetch current brightness on page load
  useEffect(() => {
    const fetchBrightness = async () => {
      try {
        const res = await fetch(`${DEVICE_IP}/display/brightness`);
        const data = await res.json();
        if (data.brightness !== undefined) {
          setBrightness([data.brightness]);
        }
      } catch (err) {
        console.error("Failed to fetch brightness:", err);
      }
    };
    fetchBrightness();
  }, []);

  // 🔹 Update brightness live as slider moves
  const handleBrightnessChange = async (val: number[]) => {
    setBrightness(val);
    try {
      await fetch(`${DEVICE_IP}/display/brightness/${val[0]}`, {
        method: "POST",
      });
    } catch (err) {
      console.error("Failed to set brightness:", err);
    }
  };

  return (
    <SettingsLayout>
      <div className="space-y-8">
        <h2 className="text-2xl font-bold">DISPLAY</h2>

        {/* Theme Selector */}
        <div className="space-y-6">
          <h3 className="text-xl font-bold">APPEARANCE</h3>
          <div className="grid grid-cols-3 gap-4">
            {themeOptions.map((option) => {
              const Icon = option.icon;
              return (
                <Button
                  key={option.id}
                  variant={theme === option.id ? "default" : "outline"}
                  className="h-32 flex flex-col items-center justify-center gap-3 font-bold"
                  onClick={() => setTheme(option.id)}
                >
                  <Icon className="w-8 h-8" />
                  {option.label}
                </Button>
              );
            })}
          </div>
        </div>

        {/* Brightness Slider */}
        <div className="space-y-4">
          <h3 className="text-xl font-bold">BRIGHTNESS</h3>
          <Slider
            value={brightness}
            onValueChange={handleBrightnessChange}
            max={100}
            step={1}
            className="w-full"
          />
          <p className="text-sm text-muted-foreground">
            Current: {brightness[0]}%
          </p>
        </div>
      </div>
    </SettingsLayout>
  );
};

export default Display;
