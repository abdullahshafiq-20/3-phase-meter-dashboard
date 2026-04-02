from fastapi import FastAPI
from threading import Thread
import subprocess
import os
import signal

app = FastAPI()

# Global state
simulator_process = None
service_status = {
    "running": False,
    "pid": None
}


def start_simulator():
    global simulator_process, service_status

    if simulator_process is None:
        simulator_process = subprocess.Popen(
            ["python", "meter_simulator.py"],  # adjust filename if needed
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )

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
    # Run simulator in background
    thread = Thread(target=start_simulator)
    thread.daemon = True
    thread.start()


@app.on_event("shutdown")
def shutdown_event():
    stop_simulator()


@app.get("/")
def get_status():
    return {
        "service": "meter-simulator",
        "status": service_status["running"],
        "pid": service_status["pid"]
    }
