import Header from "@/components/Header";
import TalkButton from "@/components/TalkButton";
import RoutineProgress from "@/components/RoutineProgress";
import BottomNav from "@/components/BottomNav";

const Index = () => {
  return (
    <div className="w-[1280px] h-[800px] mx-auto bg-background">
      <Header />
      
      <div className="flex flex-col items-center justify-center h-[calc(100%-160px)] px-8">
        <div className="w-full max-w-2xl space-y-8">
          <TalkButton />
          <RoutineProgress />
        </div>
      </div>
      
      <BottomNav />
    </div>
  );
};

export default Index;
