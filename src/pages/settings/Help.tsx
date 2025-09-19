import SettingsLayout from "@/components/SettingsLayout";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const Help = () => {
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
    "Connection / Network Problem",
    "GPS / Location Inaccuracy", 
    "Software / Performance Lag",
    "Robot Control / Movement Error",
    "System Crash / App Error",
    "Camera / Video Issue",
    "Other"
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
                  {issue}
                </AccordionTrigger>
                <AccordionContent>
                  <p className="text-muted-foreground">
                    Report form for {issue} would go here.
                  </p>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </SettingsLayout>
  );
};

export default Help;