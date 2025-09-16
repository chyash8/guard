from typing import Optional
import subprocess
import os
import signal
import sys
import atexit

class VoiceChatManager:
    def __init__(self):
        self.process: Optional[subprocess.Popen] = None
        atexit.register(self.cleanup)

    def start(self) -> dict:
        if self.process is not None:
            self.stop()  # Stop any existing process first
            
        try:
            # Get the directory of the index.js file
            base_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
            index_js_path = os.path.join(base_dir, 'index.js')
            
            # Start the voice chat process
            self.process = subprocess.Popen(
                [
                    'node',
                    index_js_path,
                    '--listen', '5001',             # Listen on port 5001
                    '--mic-channels', '1',          # Mono audio
                    '--debug', 'true',              # Enable debug logging
                    '--log', '/tmp/voicechat.log'   # Log to file
                ],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                cwd=base_dir
            )
            
            return {"status": "started", "pid": self.process.pid}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def stop(self) -> dict:
        if self.process is not None:
            try:
                # Try graceful termination first
                self.process.terminate()
                try:
                    self.process.wait(timeout=3)  # Wait up to 3 seconds for graceful shutdown
                except subprocess.TimeoutExpired:
                    self.process.kill()  # Force kill if graceful shutdown fails
                
                self.process = None
                return {"status": "stopped"}
            except Exception as e:
                return {"status": "error", "message": str(e)}
        return {"status": "not_running"}

    def cleanup(self):
        """Cleanup method called on exit"""
        self.stop()

    def status(self) -> dict:
        if self.process is None:
            return {"status": "not_running"}
            
        # Check if process is still running
        if self.process.poll() is None:
            return {"status": "running", "pid": self.process.pid}
        else:
            # Process has terminated
            stdout, stderr = self.process.communicate()
            self.process = None
            return {
                "status": "terminated",
                "exit_code": self.process.returncode,
                "stdout": stdout.decode() if stdout else "",
                "stderr": stderr.decode() if stderr else ""
            }

# Global instance
voice_chat_manager = VoiceChatManager()