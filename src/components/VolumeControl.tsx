import { useState, useEffect } from 'react'
import { Volume2, VolumeX } from 'lucide-react'
import { Slider } from './ui/slider'
import { Button } from './ui/button'
import { useToast } from './ui/use-toast'

export function VolumeControl() {
    const [volume, setVolume] = useState(50)
    const [isMuted, setIsMuted] = useState(false)
    const { toast } = useToast()
    const previousVolume = useState(50)[0]

    // Fetch initial volume
    useEffect(() => {
        fetchVolume()
    }, [])

    const JETSON_API = "http://127.0.0.1:5000"

    const fetchVolume = async () => {
        try {
            console.log('Fetching volume from:', `${JETSON_API}/volume`)
            const response = await fetch(`${JETSON_API}/volume`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                },
            }).catch(error => {
                console.error('Network error:', error)
                throw new Error(`Network error: ${error.message}. Please check if the Jetson device is accessible at ${JETSON_API}`)
            })
            
            if (!response.ok) {
                const errorText = await response.text()
                console.error('API Error:', response.status, errorText)
                throw new Error(`API returned ${response.status}: ${errorText}`)
            }
            
            const data = await response.json()
            console.log('Volume data:', data)
            setVolume(data.volume)
            
            // Show success toast with mixer info
            toast({
                title: "Volume Updated",
                description: `Using ${data.mixer} on ${data.card}`,
            })
        } catch (error) {
            console.error('Failed to fetch volume:', error)
            toast({
                variant: "destructive",
                title: "Error",
                description: error instanceof Error ? error.message : "Failed to fetch volume. Make sure the Jetson device is accessible.",
            })
        }
    }

    const handleVolumeChange = async (value: number[]) => {
        const newVolume = value[0]
        try {
            const response = await fetch(`${JETSON_API}/volume`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ volume: newVolume }),
            })
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}))
                throw new Error(errorData.detail || 'Failed to set volume')
            }
            
            const data = await response.json()
            setVolume(data.volume)
            setIsMuted(data.volume === 0)
        } catch (error) {
            console.error('Failed to set volume:', error)
            toast({
                variant: "destructive",
                title: "Error",
                description: error instanceof Error ? error.message : "Failed to set volume",
            })
            // Refetch current volume on error
            fetchVolume()
        }
    }

    const toggleMute = async () => {
        try {
            if (isMuted || volume === 0) {
                // If currently muted, restore to previous non-zero volume or 50%
                const restoreVolume = previousVolume > 0 ? previousVolume : 50
                await handleVolumeChange([restoreVolume])
            } else {
                // If not muted, save current volume and set to 0
                await handleVolumeChange([0])
            }
        } catch (error) {
            console.error('Failed to toggle mute:', error)
            toast({
                variant: "destructive",
                title: "Error",
                description: error instanceof Error ? error.message : "Failed to toggle mute",
            })
            // Refetch current volume on error
            fetchVolume()
        }
    }

    return (
        <div className="flex items-center gap-2 w-full max-w-xs">
            <Button
                variant="ghost"
                size="icon"
                onClick={toggleMute}
                className="hover:bg-accent"
            >
                {isMuted || volume === 0 ? (
                    <VolumeX className="h-5 w-5" />
                ) : (
                    <Volume2 className="h-5 w-5" />
                )}
            </Button>
            <Slider
                value={[volume]}
                max={100}
                step={1}
                className="w-full"
                onValueChange={handleVolumeChange}
            />
        </div>
    )
}
