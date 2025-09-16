import pyaudio
import socket

# Audio Config
CHUNK = 1024
FORMAT = pyaudio.paInt16
CHANNELS = 1
RATE = 44100

# Listening config
PORT = 12345

# Setup socket
sock = socket.socket()
sock.bind(("0.0.0.0", PORT))
sock.listen(1)
print(f"🎧 Waiting for incoming audio on port {PORT}...")

conn, addr = sock.accept()
print(f"🔗 Connected by {addr}")

# Setup audio output
p = pyaudio.PyAudio()
stream = p.open(format=FORMAT, channels=CHANNELS, rate=RATE, output=True)

try:
    while True:
        data = conn.recv(CHUNK)
        if not data:
            break
        stream.write(data)
except KeyboardInterrupt:
    print("🛑 Stopped.")
finally:
    stream.stop_stream()
    stream.close()
    p.terminate()
    conn.close()
    sock.close()
