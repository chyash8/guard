import SettingsLayout from "@/components/SettingsLayout";
import { VolumeControl } from "@/components/VolumeControl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function General() {
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
                {/* Add other settings here */}
            </div>
        </SettingsLayout>
    );
}
