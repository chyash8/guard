import { Button } from "@/components/ui/button";
import { Play } from "lucide-react";

const RoutineProgress = () => {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-lg font-bold text-success">ROUTINE STATUS:</span>
          <span className="text-lg font-bold text-success">65%</span>
        </div>
        <div className="w-full bg-muted rounded-full h-3">
          <div className="bg-success h-3 rounded-full" style={{ width: '65%' }}></div>
        </div>
        <p className="text-sm text-muted-foreground">• 30 MINUTES REMAINING</p>
      </div>
      
      <Button
        size="lg"
        className="w-full bg-success hover:bg-success/90 text-white font-bold py-4 rounded-lg flex items-center justify-center gap-2"
      >
        <Play className="w-5 h-5" />
        START ROUTINE
      </Button>
    </div>
  );
};

export default RoutineProgress;