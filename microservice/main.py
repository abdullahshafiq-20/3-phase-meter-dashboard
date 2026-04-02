from fastapi import FastAPI
from threading import Thread
import subprocess
from collections import deque

app = FastAPI()

# Global state
simulator_process = None
service_status = {
    "running": False,
    "pid": None
}
recent_logs = deque(maxlen=100)

def read_logs(pipe):
    """Continuously read lines from the process stdout and append to deque."""
    for line in iter(pipe.readline, b''):
        decoded_line = line.decode('utf-8', errors='replace').strip()
        if decoded_line:
            recent_logs.append(decoded_line)

import sys

def start_simulator():
    global simulator_process, service_status

    if simulator_process is None:
        # Use sys.executable to ensure we use the same Python environment (venv)
        # Use python -u to unbuffer output, ensuring logs are readable live
        simulator_process = subprocess.Popen(
            [sys.executable, "-u", "meter_simulator.py"],  
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT
        )

        # Start background thread to capture logs
        log_thread = Thread(target=read_logs, args=(simulator_process.stdout,))
        log_thread.daemon = True
        log_thread.start()

        service_status["running"] = True
        service_status["pid"] = simulator_process.pid


def stop_simulator():
    global simulator_process, service_status

    if simulator_process:
        simulator_process.terminate()
        simulator_process.wait()
        simulator_process = None

        service_status["running"] = False
        service_status["pid"] = None


@app.on_event("startup")
def startup_event():
    thread = Thread(target=start_simulator)
    thread.daemon = True
    thread.start()


@app.on_event("shutdown")
def shutdown_event():
    stop_simulator()


@app.get("/")
def get_status():
    global simulator_process

    is_alive = simulator_process is not None and simulator_process.poll() is None

    return {
        "service": "meter-simulator",
        "status": is_alive,
        "pid": simulator_process.pid if is_alive else None,
        "recent_logs": list(recent_logs)[-10:] # send the last 10 logs in the status
    }

@app.get("/logs")
def get_logs():
    """Return all captured recent logs (up to 100 max)."""
    return {
        "logs": list(recent_logs)
    }

# ✅ Health endpoint (for DigitalOcean / load balancers)
@app.get("/health")
def health_check():
    global simulator_process

    is_alive = simulator_process is not None and simulator_process.poll() is None

    return {
        "status": "healthy" if is_alive else "unhealthy"
    }
