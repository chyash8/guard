import { useEffect, useState } from "react";
import { socket } from "../lib/socket";

interface VolumeState {
    volume: number;
    muted: boolean;
}

export function useVolume() {
    const [volume, setVolume] = useState<VolumeState>({ volume: 0, muted: false });
    const [isLoading, setIsLoading] = useState(true);

    // Fetch initial volume state
    useEffect(() => {
        fetch('http://127.0.0.1:5000/api/volume')
            .then(res => res.json())
            .then(data => {
                setVolume(data);
                setIsLoading(false);
            })
            .catch(err => {
                console.error('Failed to fetch volume:', err);
                setIsLoading(false);
            });

        // Listen for volume changes
        socket.on('volume_change', (newVolume: VolumeState) => {
            setVolume(newVolume);
        });

        return () => {
            socket.off('volume_change');
        };
    }, []);

    const setSystemVolume = async (newVolume: number) => {
        try {
            const res = await fetch('http://localhost:5000/api/volume', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ volume: newVolume, muted: volume.muted }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setVolume(data);
        } catch (err) {
            console.error('Failed to set volume:', err);
        }
    };

    const toggleMute = async () => {
        try {
            const res = await fetch('http://localhost:5000/api/volume', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ volume: volume.volume, muted: !volume.muted }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setVolume(data);
        } catch (err) {
            console.error('Failed to toggle mute:', err);
        }
    };

    return {
        volume: volume.volume,
        muted: volume.muted,
        isLoading,
        setVolume: setSystemVolume,
        toggleMute,
    };
}