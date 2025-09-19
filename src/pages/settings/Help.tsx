import SettingsLayout from "@/components/SettingsLayout";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { QrCode } from "lucide-react";
import { useState } from "react";

const Help = () => {
  const [showContactQR, setShowContactQR] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<string | null>(null);

  const helpSections = [
    "Introduction",
    "Getting Started / Basics", 
    "Navigation Guide",
    "Modes & Functions",
    "How-To Instructions",
    "Troubleshooting",
    "FAQs"
  ];

  const issueTypes = [
    {
      title: "Connection / Network Problem",
      description: "Issues related to WiFi connectivity, network dropouts, or connection stability problems with the robot."
    },
    {
      title: "GPS / Location Inaccuracy",
      description: "Problems with position accuracy, GPS signal strength, or location-based navigation errors."
    },
    {
      title: "Software / Performance Lag",
      description: "Interface slowdowns, delayed responses, app freezing, or general performance issues."
    },
    {
      title: "Robot Control / Movement Error",
      description: "Difficulties with robot movement, unresponsive controls, or unexpected robot behavior."
    },
    {
      title: "System Crash / App Error",
      description: "Complete system failures, application crashes, error messages, or system restarts."
    },
    {
      title: "Camera / Video Issue",
      description: "Problems with video feed, camera quality, visual artifacts, or streaming delays."
    },
    {
      title: "Other",
      description: "Any other technical issues or problems not covered by the categories above."
    }
  ];

  return (
    <SettingsLayout>
      <div className="space-y-8">
        <h2 className="text-2xl font-bold">HELP PAGE</h2>
        
        <div className="space-y-4">
          <Accordion type="single" collapsible className="w-full">
            {helpSections.map((section, index) => (
              <AccordionItem key={index} value={`item-${index}`}>
                <AccordionTrigger className="text-left font-bold text-lg">
                  {section}
                </AccordionTrigger>
                <AccordionContent>
                  <p className="text-muted-foreground">
                    Help content for {section} would go here.
                  </p>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
        
        <div className="space-y-4">
          <h3 className="text-2xl font-bold">REPORT ISSUE</h3>
          <Accordion type="single" collapsible className="w-full">
            {issueTypes.map((issue, index) => (
              <AccordionItem key={index} value={`issue-${index}`}>
                <AccordionTrigger className="text-left font-bold">
                  {issue.title}
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4">
                    <p className="text-muted-foreground">
                      {issue.description}
                    </p>
                    <Button 
                      variant="secondary"
                      onClick={() => {
                        setSelectedIssue(issue.title);
                        setShowContactQR(true);
                      }}
                    >
                      Report This Issue
                    </Button>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>

      <Dialog open={showContactQR} onOpenChange={setShowContactQR}>
        <DialogContent className="max-w-md mx-auto bg-card border border-border rounded-lg">
          <DialogHeader>
            <DialogTitle className="text-center text-lg font-bold mb-4">
              {selectedIssue 
                ? `REPORT ${selectedIssue.toUpperCase()}`
                : 'CONTACT SAKAR ROBOTICS'}
            </DialogTitle>
          </DialogHeader>
          <div className="flex justify-center p-8">
            <div className="w-64 h-64 bg-white rounded-lg p-4 flex items-center justify-center">
              <img 
                src="/sakar-contact-qr.svg" 
                alt="Contact QR Code"
                className="w-full h-full object-contain"
              />
            </div>
          </div>
          <div className="text-center pb-4">
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <QrCode className="w-4 h-4" />
              SCAN TO CONTACT SUPPORT
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </SettingsLayout>
  );
};

export default Help;