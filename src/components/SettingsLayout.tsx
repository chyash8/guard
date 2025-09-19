import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate, useLocation } from "react-router-dom";
import Header from "./Header";
import BottomNav from "./BottomNav";

interface SettingsLayoutProps {
  children: ReactNode;
}

const SettingsLayout = ({ children }: SettingsLayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { label: "GENERAL", path: "/settings/general" },
    { label: "DISPLAY", path: "/settings/display" },
    { label: "WiFi", path: "/settings/wifi" },
    { label: "ABOUT", path: "/settings/about" },
    { label: "GET HELP", path: "/settings/help" },
  ];

  return (
    <div className="w-[1280px] h-[800px] mx-auto bg-background overflow-hidden">
      <Header />
      
      <div className="flex h-[calc(100%-160px)]">
        <aside className="w-80 bg-secondary p-6 space-y-2">
          {menuItems.map((item) => (
            <Button
              key={item.path}
              variant={location.pathname === item.path ? "default" : "ghost"}
              className="w-full justify-start text-left font-bold py-6 text-lg"
              onClick={() => navigate(item.path)}
            >
              {item.label}
            </Button>
          ))}
        </aside>
        
        <main className="flex-1 p-8 bg-card overflow-y-auto">
          {children}
        </main>
      </div>
      
      <BottomNav />
    </div>
  );
};

export default SettingsLayout;