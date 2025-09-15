import { Button } from "@/components/ui/button";
import { Home, Settings, Info } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";

const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-1/2 transform -translate-x-1/2 mb-6">
      <div className="flex items-center gap-4 bg-card px-6 py-3 rounded-full shadow-lg border border-border">
        <Button
          variant={location.pathname === "/" ? "default" : "ghost"}
          size="sm"
          className="rounded-full p-3"
          onClick={() => navigate("/")}
        >
          <Home className="w-5 h-5" />
        </Button>
        
        <Button
          variant={location.pathname.startsWith("/settings") ? "default" : "ghost"}
          size="sm"
          className="rounded-full p-3"
          onClick={() => navigate("/settings")}
        >
          <Settings className="w-5 h-5" />
        </Button>
        
        <Button
          variant={location.pathname === "/system-status" ? "default" : "ghost"}
          size="sm"
          className="rounded-full p-3"
          onClick={() => navigate("/system-status")}
        >
          <Info className="w-5 h-5" />
        </Button>
      </div>
    </nav>
  );
};

export default BottomNav;