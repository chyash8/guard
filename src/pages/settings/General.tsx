import SettingsLayout from "@/components/SettingsLayout";
import { VolumeControl } from "@/components/VolumeControl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function General() {
    const handleManual = () => {
        // Add manual mode logic here
        console.log("Manual mode activated");
    };

    const handleReboot = () => {
        // Add reboot logic here
        console.log("System reboot initiated");
    };

    return (
        <SettingsLayout>
            <div className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Volume</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <VolumeControl />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>System Controls</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-6">
                        <div className="w-full max-w-[300px] mx-auto">
                            <Button 
                                variant="destructive" 
                                className="w-full text-lg font-semibold bg-orange-500 hover:bg-orange-600 h-16"
                                onClick={handleManual}
                            >
                                Manual Mode
                            </Button>
                        </div>
                        <div className="w-full max-w-[300px] mx-auto">
                            <Button 
                                className="w-full text-lg font-semibold bg-green-500 hover:bg-green-600 h-16"
                                onClick={handleReboot}
                            >
                                Reboot System
                            </Button>
                        </div>
                    </CardContent>
                </Card>
                {/* Add other settings here */}
            </div>
        </SettingsLayout>
    );
}
