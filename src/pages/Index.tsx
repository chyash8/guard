import Header from "@/components/Header";
import TalkButton from "@/components/TalkButton";
import RoutineProgress from "@/components/RoutineProgress";
import BottomNav from "@/components/BottomNav";

const Index = () => {
  return (
    <div className="w-full max-w-[1280px] h-screen mx-auto bg-background flex flex-col">
      {/* Top Header */}
      <Header />

      {/* Main Content Area */}
      <main className="flex-grow flex flex-col items-center justify-center px-8">
        <div className="w-full max-w-2xl space-y-8">
          {/* Push-to-Talk Button */}
          <TalkButton /> 

          {/* Routine Progress */}
          <RoutineProgress />
        </div>
      </main>

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  );
};

export default Index;
