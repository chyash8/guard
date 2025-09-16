import { io } from "socket.io-client";

export const socket = io("http://localhost:5000", {
    transports: ["websocket"],
    autoConnect: true,
});

socket.on("connect", () => {
    console.log("Socket connected");
});

socket.on("disconnect", () => {
    console.log("Socket disconnected");
});

socket.on("connect_error", (err) => {
    console.error("Socket connection error:", err);
});