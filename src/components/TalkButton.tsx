import { Button } from "@/components/ui/button";

const TalkButton = () => {
  return (
    <div className="flex items-center justify-center py-12">
      <Button
        size="lg"
        className="w-64 h-64 rounded-full bg-talk hover:bg-talk/90 text-white text-xl font-bold shadow-2xl transform hover:scale-105 transition-all duration-200"
      >
        PRESS TO<br />TALK
      </Button>
    </div>
  );
};

export default TalkButton;