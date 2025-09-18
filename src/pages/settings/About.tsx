import SettingsLayout from "@/components/SettingsLayout";

const About = () => {
  return (
    <SettingsLayout>
      <div className="space-y-8">
        <h2 className="text-2xl font-bold">ABOUT</h2>
        
        <div className="space-y-6">
          <div>
            <h3 className="text-xl font-bold mb-4">OUR STORY</h3>
            <div className="space-y-4 text-foreground leading-relaxed">
              <p>
                We founded Sakar Robotics to collapse fragmented point solutions
                into a single extensible mobile manipulation platform. Traditional
                automation required bespoke integration per workflow--slow to
                deploy, rigid to evolve. We architected a composable stack where
                perception, autonomy, manipulation and orchestration cooperate
                natively.
              </p>
              <p>
                Guided by field feedback across regulated, high-mix and
                throughput-critical domains, we iterate on production reality- not
                lab abstractions-- building durable leverage for customers.
              </p>
            </div>
          </div>
          
          <div>
            <h3 className="text-xl font-bold mb-2">SIM CARD NUMBER</h3>
            <p className="text-foreground font-mono">+91 96659 99862</p>
          </div>

          <div>
            <h3 className="text-xl font-bold mb-2">EMAIL</h3>
            <p className="text-foreground font-mono">info@sakarrobotics.com</p>
          </div>
        </div>
      </div>
    </SettingsLayout>
  );
};

export default About;