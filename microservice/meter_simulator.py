"""
Meter simulator — generates fully random 3-phase meter readings in real-time
and publishes them to HiveMQ.  Periodically injects fault/alert scenarios
that match the thresholds in alertService.js.

Part of the live pipeline:  python meter_simulator.py

The simulator subscribes to the topic at startup to receive the last retained
message per device to seed the cumulative energy counter `e` so live readings
continue smoothly from historical data.

Optional CLI flags:
    --interval <secs>    Seconds between each publish (default: 10)
    --devices <list>     Comma-separated device IDs (default: DEVICE_IDS from .env)
    --fault-chance <0-1> Probability per tick that a fault scenario fires (default: 0.15)
"""

import argparse
import json
import os
import random
import ssl
import sys
import time
from datetime import datetime, timezone

import paho.mqtt.client as mqtt
from dotenv import load_dotenv

load_dotenv()

BROKER = os.getenv("HIVE_MQ_HOST", "")
PORT = int(os.getenv("HIVE_MQ_PORT", "8883"))
USERNAME = os.getenv("HIVE_MQ_USERNAME", "")
PASSWORD = os.getenv("HIVE_MQ_PASSWORD", "")
ENV_DEVICE_IDS = os.getenv("DEVICE_IDS", "")

TOPIC_LIVE = "meter/live/{deviceid}"
TOPIC_HISTORICAL = "meter/historical/{deviceid}"

# ── helpers ──────────────────────────────────────────────────────────

def clamp(v, lo, hi):
    return max(lo, min(hi, v))

def jitter(base, spread):
    return base + (random.random() * 2 - 1) * spread


# ── per-device state ─────────────────────────────────────────────────

class MeterState:
    """Tracks evolving state for one virtual meter."""

    def __init__(self, device_id, seed_row=None):
        self.device_id = device_id

        if seed_row:
            self.e = float(seed_row.get("e", 0) or 0)
            self.va = float(seed_row.get("va", 230) or 230)
            self.vb = float(seed_row.get("vb", 230) or 230)
            self.vc = float(seed_row.get("vc", 230) or 230)
            self.ca = float(seed_row.get("ca", 4.5) or 4.5)
            self.cb = float(seed_row.get("cb", 4.5) or 4.5)
            self.cc = float(seed_row.get("cc", 4.5) or 4.5)
            raw_pf = float(seed_row.get("pf", 0.95) or 0.95)
            self.pf = abs(raw_pf) if abs(raw_pf) > 0 else 0.95
            self.f = float(seed_row.get("f", 50.0) or 50.0)
            print(f"  {device_id}: seeded from MQTT  e={self.e:.2f}  va={self.va:.1f}")
        else:
            self.e = random.uniform(5000, 15000)
            self.va = random.uniform(228, 232)
            self.vb = random.uniform(228, 232)
            self.vc = random.uniform(228, 232)
            self.ca = random.uniform(3.0, 6.0)
            self.cb = random.uniform(3.0, 6.0)
            self.cc = random.uniform(3.0, 6.0)
            self.pf = random.uniform(0.92, 0.98)
            self.f = random.uniform(49.95, 50.05)
            print(f"  {device_id}: random seed  e={self.e:.2f}")

        self.prev_ap = None

    def normal_tick(self):
        """Evolve one normal (healthy) reading."""
        self.va = clamp(jitter(self.va, 1.5), 225, 235)
        self.vb = clamp(jitter(self.vb, 1.5), 225, 235)
        self.vc = clamp(jitter(self.vc, 1.5), 225, 235)
        self.ca = clamp(jitter(self.ca, 0.4), 2.0, 8.0)
        self.cb = clamp(jitter(self.cb, 0.4), 2.0, 8.0)
        self.cc = clamp(jitter(self.cc, 0.4), 2.0, 8.0)
        self.pf = clamp(jitter(self.pf, 0.015), 0.92, 0.99)
        self.f  = clamp(jitter(50.0, 0.06), 49.85, 50.15)

    def build_reading(self):
        avg_v = (self.va + self.vb + self.vc) / 3
        avg_i = (self.ca + self.cb + self.cc) / 3
        ap = round(avg_v * avg_i * self.pf, 3)
        rp = round(ap * (1 - self.pf), 3)
        e_inc = max(ap / 360000, 0.0005)
        self.e = round(self.e + e_inc, 6)

        reading = {
            "bucket":   datetime.now(timezone.utc).isoformat(),
            "deviceid": self.device_id,
            "datatype": "TCMData",
            "e":  self.e,
            "f":  round(self.f, 3),
            "ap": ap,
            "ca": round(self.ca, 3),
            "cb": round(self.cb, 3),
            "cc": round(self.cc, 3),
            "pf": round(self.pf, 4),
            "rp": rp,
            "va": round(self.va, 3),
            "vb": round(self.vb, 3),
            "vc": round(self.vc, 3),
        }
        self.prev_ap = ap
        return reading


# ── fault scenarios ──────────────────────────────────────────────────

FAULT_NAMES = [
    "freq_under",
    "freq_over",
    "volt_under",
    "volt_over",
    "volt_imbalance",
    "phase_imbalance_severe",
    "phase_failure",
    "overload",
    "load_imbalance",
    "pf_very_low",
    "pf_low",
    "ap_surge",
    "ap_drop",
    "power_inefficiency",
    "overload_combined",
]


def apply_fault(state: MeterState, fault: str):
    """Mutate state so the next reading triggers the named alert."""

    if fault == "freq_under":
        state.f = random.uniform(49.0, 49.4)

    elif fault == "freq_over":
        state.f = random.uniform(50.6, 51.0)

    elif fault == "volt_under":
        phase = random.choice(["va", "vb", "vc"])
        setattr(state, phase, random.uniform(195, 209))

    elif fault == "volt_over":
        phase = random.choice(["va", "vb", "vc"])
        setattr(state, phase, random.uniform(246, 255))

    elif fault == "volt_imbalance":
        state.va = random.uniform(220, 224)
        state.vb = random.uniform(235, 240)
        state.vc = random.uniform(228, 232)

    elif fault == "phase_imbalance_severe":
        base = random.uniform(4.0, 6.0)
        state.ca = round(base * 1.5, 3)
        state.cb = round(base * 0.75, 3)
        state.cc = round(base * 0.75, 3)

    elif fault == "phase_failure":
        state.ca = random.uniform(4.0, 7.0)
        state.cb = random.uniform(4.0, 7.0)
        state.cc = random.uniform(0.0, 0.05)

    elif fault == "overload":
        state.ca = random.uniform(72, 85)
        state.cb = random.uniform(72, 85)
        state.cc = random.uniform(72, 85)

    elif fault == "load_imbalance":
        state.ca = random.uniform(6.0, 8.0)
        state.cb = random.uniform(6.0, 8.0)
        state.cc = random.uniform(1.0, 2.5)

    elif fault == "pf_very_low":
        state.pf = random.uniform(0.60, 0.78)

    elif fault == "pf_low":
        state.pf = random.uniform(0.81, 0.89)

    elif fault == "ap_surge":
        state.ca = state.ca * 2.2
        state.cb = state.cb * 2.2
        state.cc = state.cc * 2.2

    elif fault == "ap_drop":
        state.ca = state.ca * 0.3
        state.cb = state.cb * 0.3
        state.cc = state.cc * 0.3

    elif fault == "power_inefficiency":
        state.pf = random.uniform(0.65, 0.82)
        state.ca = random.uniform(8, 12)
        state.cb = random.uniform(8, 12)
        state.cc = random.uniform(8, 12)

    elif fault == "overload_combined":
        state.ca = random.uniform(42, 55)
        state.cb = random.uniform(42, 55)
        state.cc = random.uniform(42, 55)
        state.pf = random.uniform(0.92, 0.98)


# ── main ─────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="3-Phase Meter Simulator (random generation)")
    parser.add_argument("--interval", type=float, default=10.0,
                        help="Seconds between publishes (default: 10)")
    env_default = ENV_DEVICE_IDS if ENV_DEVICE_IDS else "METER-001,METER-002"
    parser.add_argument("--devices", default=env_default,
                        help="Comma-separated device IDs (default: DEVICE_IDS from .env)")
    parser.add_argument("--fault-chance", type=float, default=0.15,
                        help="Probability per tick of injecting a fault (default: 0.15)")
    parser.add_argument(
        "--publish-topic",
        choices=["historical", "live"],
        default="historical",
        help="Publish readings to meter/historical/{deviceid} (default) or meter/live/{deviceid}",
    )
    args = parser.parse_args()

    if not BROKER or not USERNAME:
        print("ERROR: HiveMQ credentials not found in .env")
        sys.exit(1)

    device_ids = [d.strip() for d in args.devices.split(",") if d.strip()]

    print(f"Devices: {device_ids}")
    print(f"Interval: {args.interval}s   Fault chance: {args.fault_chance * 100:.0f}%")

    print(f"\nConnecting to {BROKER}:{PORT} ...")

    client = mqtt.Client(
        client_id=f"meter-simulator-{int(time.time())}",
        protocol=mqtt.MQTTv5,
    )
    client.username_pw_set(USERNAME, PASSWORD)
    client.tls_set(tls_version=ssl.PROTOCOL_TLS_CLIENT)

    connected = False

    def on_connect(c, userdata, flags, rc, properties=None):
        nonlocal connected
        if rc == 0:
            connected = True
            print("Connected to HiveMQ broker")
        else:
            print(f"Connection failed with code {rc}")

    def on_disconnect(c, userdata, rc, properties=None):
        nonlocal connected
        connected = False
        if rc != 0:
            print(f"Unexpected disconnection (rc={rc}), reconnecting ...")

    client.on_connect = on_connect
    client.on_disconnect = on_disconnect
    client.connect(BROKER, PORT)
    client.loop_start()

    timeout = 10
    while not connected and timeout > 0:
        time.sleep(0.5)
        timeout -= 0.5

    if not connected:
        print("ERROR: Could not connect to HiveMQ")
        client.loop_stop()
        sys.exit(1)

    # Fetch seeds from broker
    print("Fetching seed values from broker (reading retained messages)...")
    seed_rows = {}
    def on_seed_message(c, userdata, msg):
        try:
            payload = json.loads(msg.payload.decode())
            did = payload.get("deviceid")
            if did and did in device_ids:
                seed_rows[did] = payload
        except Exception:
            pass

    client.on_message = on_seed_message
    topic_filter = TOPIC_HISTORICAL.format(deviceid="+") if args.publish_topic == "historical" else TOPIC_LIVE.format(deviceid="+")
    client.subscribe(topic_filter)
    
    # Wait up to 3 seconds for retained messages to arrive
    time.sleep(3)
    
    client.unsubscribe(topic_filter)
    client.on_message = None

    # Initialize meters
    meters = {did: MeterState(did, seed_rows.get(did)) for did in device_ids}

    print("Simulator running — press Ctrl+C to stop\n")

    try:
        while True:
            for did, meter in meters.items():
                fault_name = None

                if random.random() < args.fault_chance:
                    fault_name = random.choice(FAULT_NAMES)
                    apply_fault(meter, fault_name)
                else:
                    meter.normal_tick()

                reading = meter.build_reading()
                topic = (TOPIC_HISTORICAL if args.publish_topic == "historical" else TOPIC_LIVE).format(deviceid=did)
                # Using retain=True so that restarting the script can fetch the last values as seed
                client.publish(topic, json.dumps(reading), qos=1, retain=True)

                tag = f"  ** FAULT: {fault_name}" if fault_name else ""
                print(
                    f"[{reading['bucket']}] {did}  "
                    f"ap={reading['ap']:>9.3f}W  "
                    f"va={reading['va']:.1f}  vb={reading['vb']:.1f}  vc={reading['vc']:.1f}  "
                    f"ca={reading['ca']:.2f}  cb={reading['cb']:.2f}  cc={reading['cc']:.2f}  "
                    f"pf={reading['pf']:.3f}  f={reading['f']:.2f}"
                    f"{tag}"
                )

            time.sleep(args.interval)

    except KeyboardInterrupt:
        print("\nStopping simulator ...")
    finally:
        client.loop_stop()
        client.disconnect()
        print("Disconnected from HiveMQ. Bye!")


if __name__ == "__main__":
    main()
