import { io } from "socket.io-client";

// Get the IP dynamically, fallback to localhost if needed
// Always connect to localhost since we're running on the same machine
import { API_URL } from "./config";

// More aggressive reconnection settings
const RECONNECTION_ATTEMPTS = Infinity; // Keep trying forever
const RECONNECTION_DELAY = 1000; // Start with 1 second
const RECONNECTION_DELAY_MAX = 5000; // Max 5 seconds between attempts

export const socket = io(API_URL, {
    transports: ["websocket"], // Only use WebSocket, no HTTP polling
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: RECONNECTION_ATTEMPTS,
    reconnectionDelay: RECONNECTION_DELAY,
    reconnectionDelayMax: RECONNECTION_DELAY_MAX,
    timeout: 5000,
    forceNew: true,
    rememberUpgrade: true,
    rejectUnauthorized: false
});

socket.on("connect", () => {
    console.log("Socket connected");
});

socket.on("disconnect", (reason) => {
    console.log("Socket disconnected:", reason);
    if (reason === "io server disconnect") {
        // Server disconnected us, try to reconnect manually
        socket.connect();
    }
});

socket.on("connect_error", (err) => {
    console.error("Socket connection error:", err);
});

socket.io.on("reconnect", (attempt) => {
    console.log("Socket reconnected after", attempt, "attempts");
});

socket.io.on("reconnect_attempt", (attempt) => {
    console.log("Socket reconnection attempt", attempt);
});