from fastapi import FastAPI
from threading import Thread
import subprocess

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
        "pid": simulator_process.pid if is_alive else None
    }


# ✅ Health endpoint (for DigitalOcean / load balancers)
@app.get("/health")
def health_check():
    global simulator_process

    is_alive = simulator_process is not None and simulator_process.poll() is None

    return {
        "status": "healthy" if is_alive else "unhealthy"
    }
