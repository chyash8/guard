import { io } from "socket.io-client";

const BACKEND_URL = "http://192.168.0.101:5000";

const socket = io(BACKEND_URL, {
  transports: ["websocket"],
});

socket.on("connect", () => {
  console.log("Connected to server");

  // Emit a test wifi_state_change event
  socket.emit("wifi_state_change", {
    status: "on",
    current_network: {
      ssid: "ExampleNetwork",
      signal: 75,
      security: "WPA2",
    },
  });

  console.log("wifi_state_change event sent");
});

socket.on("disconnect", () => {
  console.log("Disconnected from server");
});

socket.on("connect_error", (err) => {
  console.error("Connection error:", err.message);
});

