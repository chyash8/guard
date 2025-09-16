import pyaudio
import socket

# Audio Config
CHUNK = 1024
FORMAT = pyaudio.paInt16
CHANNELS = 1
RATE = 44100

# Receiver IP and Port
RECEIVER_IP = "192.168.0.103"  # Update this to the receiver Jetson's IP
PORT = 12345

# Setup socket
sock = socket.socket()
sock.connect((RECEIVER_IP, PORT))

# Setup audio input
p = pyaudio.PyAudio()
stream = p.open(format=FORMAT, channels=CHANNELS, rate=RATE, input=True, frames_per_buffer=CHUNK)

print("🔴 Sending audio stream... Press Ctrl+C to stop.")

try:
    while True:
        data = stream.read(CHUNK)
        sock.sendall(data)
except KeyboardInterrupt:
    print("🛑 Stopped.")
finally:
    stream.stop_stream()
    stream.close()
    p.terminate()
    sock.close()
