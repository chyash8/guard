import SettingsLayout from "@/components/SettingsLayout";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface QROverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

const QROverlay: React.FC<QROverlayProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg relative max-w-md w-full mx-4">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-500 hover:text-gray-700"
        >
          <X size={24} />
        </button>
        <div className="space-y-4">
          <h4 className="text-xl font-semibold text-center">Scan QR Code</h4>
          <div className="flex justify-center">
            <img
              src="/qrcode_www.sakarrobotics.com.png"
              alt="Report Issue QR Code"
              className="w-64 h-64 object-contain"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

const Help = () => {
  const [isQROpen, setIsQROpen] = useState(false);
  
  const helpSections = {
    "Introduction": "The Guard system is a state-of-the-art mobile manipulation platform designed by Sakar Robotics. This advanced system combines autonomous navigation, precise manipulation, and intelligent control interfaces to automate various industrial tasks. Key features include VoIP communication for remote operation, real-time status monitoring, advanced safety protocols, and seamless integration with existing workflows. The system is built to adapt to different environments while maintaining consistent performance.",
    "Getting Started / Basics": "Begin by ensuring proper power connection and system boot-up. The main interface can be accessed through any modern web browser at the specified IP address. First-time users should configure WiFi settings for stable connectivity. Basic controls include movement commands, manipulation controls, and communication features. The status dashboard provides real-time feedback on system health, battery levels, and connection status. Always ensure proper shutdown procedures to maintain system integrity.", 
    "Navigation Guide": "The interface is organized into distinct sections for efficient control. The top bar displays system status and connection information. The main control area features intuitive movement controls with adjustable precision modes. Use the map view for spatial awareness and path planning. The sidebar provides quick access to frequently used functions. For precise movements, utilize the fine control mode accessed through the settings panel. The bottom navigation bar offers quick access to essential functions and system modes.",
    "Modes & Functions": "The Guard system offers multiple operational modes: Standard Mode for general operations, Precision Mode for detailed tasks, and Safety Mode for sensitive environments. VoIP communication enables real-time voice control and feedback. The manipulation interface provides both pre-programmed routines and manual control options. Advanced functions include autonomous navigation, object recognition, and task sequencing. Each mode has specific safety protocols and operational parameters that can be customized through the settings interface.",
    "How-To Instructions": "Learn to perform common tasks efficiently with our detailed guides. Topics include: Setting up wireless connectivity, Calibrating movement controls, Programming automated routines, Managing user permissions, Configuring safety boundaries, Setting up scheduled tasks, Optimizing battery usage, Creating custom operation profiles, Managing system logs, and Performing regular maintenance checks. Each guide includes troubleshooting tips and best practices.",
    "Troubleshooting": "Address common issues quickly with our comprehensive diagnostic tools. The system includes built-in error detection and reporting. Check the status dashboard for specific error codes and recommended actions. Network connectivity issues can be resolved through the WiFi configuration panel. For movement problems, verify motor status and calibration. System logs provide detailed information for advanced troubleshooting. Regular diagnostic checks help prevent potential issues and maintain optimal performance.",
    "FAQs": "Find answers to common questions about Guard system operation and maintenance. Topics cover battery life optimization, network configuration, movement calibration, software updates, safety features, backup procedures, user management, routine maintenance schedules, performance optimization, and integration with other systems. Updated regularly based on user feedback and system updates. For specific questions not covered here, contact Sakar Robotics support."
  };

  const issueTypes = {
    "Connection / Network Problem": "Issues related to network connectivity affecting system operation. This includes: WiFi connection drops or weak signal strength, VoIP communication interruptions affecting voice commands and feedback, problems connecting to the main dashboard interface, network latency affecting real-time controls, authentication failures, DNS resolution issues, IP address conflicts, or connectivity problems with specific system modules. Please note your network configuration and any recent changes when reporting.",
    "GPS / Location Inaccuracy": "Problems affecting the system's spatial awareness and navigation capabilities. This includes: inaccurate position reporting, drift in mapped locations, navigation path deviations, incorrect room or zone identification, calibration misalignment, sensor fusion errors, mapping inconsistencies, or problems with reference point recognition. Include specific locations and conditions where inaccuracies occur.", 
    "Software / Performance Lag": "Issues impacting system responsiveness and execution speed. This may involve: delayed response to commands, interface sluggishness, slow status updates, processing bottlenecks, memory management issues, high CPU or GPU usage, delayed sensor data processing, slow database operations, or background process conflicts. Note when the lag occurs and what actions trigger it.",
    "Robot Control / Movement Error": "Difficulties related to physical robot operations and control. This covers: unexpected movement behavior, precision control issues, manipulation task failures, gripper malfunctions, motor response problems, movement calibration errors, path planning failures, obstacle avoidance issues, or safety boundary violations. Describe the specific movement or task that failed.",
    "System Crash / App Error": "Critical system failures and application errors affecting operation. This includes: complete system shutdowns, application freezes, unresponsive interfaces, error messages, stack traces, component initialization failures, database corruption, file system errors, or process termination issues. Include any error messages and steps to reproduce the issue.",
    "Camera / Video Issue": "Problems with the visual feedback and camera systems. This covers: video feed interruptions, image quality problems, camera connection losses, frame rate issues, focus problems, exposure adjustments, color calibration errors, camera switching issues, or visual processing delays. Specify which cameras are affected and the viewing conditions."
  };

  return (
    <SettingsLayout>
      <div className="space-y-8">
        <h2 className="text-2xl font-bold">HELP PAGE</h2>
        
        <div className="space-y-4">
          <Accordion type="single" collapsible className="w-full">
            {Object.entries(helpSections).map(([section, description], index) => (
              <AccordionItem key={index} value={`item-${index}`}>
                <AccordionTrigger className="text-left font-bold text-lg">
                  {section}
                </AccordionTrigger>
                <AccordionContent>
                  <p className="text-muted-foreground text-base leading-relaxed py-2">
                    {description}
                  </p>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-bold">REPORT ISSUE</h3>
            <Button 
              variant="outline"
              onClick={() => setIsQROpen(true)}
            >
              📱 QR for Report Issue
            </Button>
          </div>
          <Accordion type="single" collapsible className="w-full">
            {Object.entries(issueTypes).map(([issue, description], index) => (
              <AccordionItem key={index} value={`issue-${index}`}>
                <AccordionTrigger className="text-left font-bold">
                  {issue}
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4">
                    <p className="text-muted-foreground text-base leading-relaxed py-2">
                      {description}
                    </p>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
      <QROverlay isOpen={isQROpen} onClose={() => setIsQROpen(false)} />
    </SettingsLayout>
  );
};

export default Help;