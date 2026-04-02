"""
Bulk-publish all CSV rows to HiveMQ as historical data.

IMPORTANT: The Node.js server must be running and subscribed to
`meter/historical/+` BEFORE you run this script. HiveMQ retained messages
only keep the LAST message per topic, so if the server is not listening,
only the final batch (~50 rows) per device will survive.

Usage:  python bulk_publish.py

After this finishes, the server's in-memory store will hold up to
MAX_HISTORY_PER_DEVICE (50 000) readings per device, sorted by timestamp.
Then start meter_simulator.py to append live readings on top.
"""

import argparse
import csv
import json
import os
import sys
import ssl
import time

import paho.mqtt.client as mqtt
from dotenv import load_dotenv

load_dotenv()

BROKER = os.getenv("HIVE_MQ_HOST", "")
PORT = int(os.getenv("HIVE_MQ_PORT", "8883"))
USERNAME = os.getenv("HIVE_MQ_USERNAME", "")
PASSWORD = os.getenv("HIVE_MQ_PASSWORD", "")

CSV_PATH = os.getenv("CSV_PATH", "")
# Publish retained chunks so HiveMQ retains the full history per device.
# (Retained messages are per-topic, so we use many topics per device.)
TOPIC_HISTORICAL_CHUNK = "meter/historical/{deviceid}/seed/{chunk}"
BATCH_SIZE = 1000
BATCH_DELAY = 0.0  # seconds between batches to avoid flooding

NUMERIC_FIELDS = ["e", "f", "ap", "ca", "cb", "cc", "pf", "rp", "va", "vb", "vc"]


def parse_row(row: dict) -> dict:
    parsed = {
        "bucket": row["bucket"],
        "deviceid": row["deviceid"],
        "datatype": row.get("datatype", "TCMData"),
    }
    for field in NUMERIC_FIELDS:
        try:
            parsed[field] = round(float(row[field]), 6)
        except (ValueError, KeyError):
            parsed[field] = 0.0
    return parsed


def main():
    parser = argparse.ArgumentParser(description="Bulk publish historical telemetry to HiveMQ")
    parser.add_argument("--batch-size", type=int, default=BATCH_SIZE, help="Rows per published chunk (default: 1000)")
    parser.add_argument("--batch-delay", type=float, default=BATCH_DELAY, help="Delay between chunks in seconds (default: 0)")
    args = parser.parse_args()

    batch_size = max(1, args.batch_size)
    batch_delay = max(0.0, args.batch_delay)

    if not BROKER or not USERNAME:
        print("ERROR: HiveMQ credentials not found in server/.env")
        sys.exit(1)

    print(f"Connecting to {BROKER}:{PORT} as '{USERNAME}' ...")

    client = mqtt.Client(
        client_id=f"bulk-publisher-{int(time.time())}",
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

    client.on_connect = on_connect
    client.connect(BROKER, PORT)
    client.loop_start()

    timeout = 10
    while not connected and timeout > 0:
        time.sleep(0.5)
        timeout -= 0.5

    if not connected:
        print("ERROR: Could not connect to HiveMQ within timeout")
        client.loop_stop()
        sys.exit(1)

    print(f"Reading CSV: {CSV_PATH}")
    with open(CSV_PATH, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = [parse_row(r) for r in reader]

    print(f"Loaded {len(rows)} rows. Publishing with batch_size={batch_size}, batch_delay={batch_delay}s ...")

    devices = {}
    for row in rows:
        devices.setdefault(row["deviceid"], []).append(row)

    total_published = 0
    for device_id, device_rows in devices.items():
        chunk_idx = 0
        batch = []
        for row in device_rows:
            batch.append(row)
            if len(batch) >= batch_size:
                payload = json.dumps(batch)
                topic = TOPIC_HISTORICAL_CHUNK.format(deviceid=device_id, chunk=chunk_idx)
                client.publish(topic, payload, qos=1, retain=True)
                total_published += len(batch)
                batch = []
                chunk_idx += 1
                if batch_delay > 0:
                    time.sleep(batch_delay)

        if batch:
            payload = json.dumps(batch)
            topic = TOPIC_HISTORICAL_CHUNK.format(deviceid=device_id, chunk=chunk_idx)
            client.publish(topic, payload, qos=1, retain=True)
            total_published += len(batch)
            chunk_idx += 1

        print(f"  {device_id}: published {len(device_rows)} rows as {chunk_idx} retained chunks under 'meter/historical/{device_id}/seed/+'")

    time.sleep(1)
    client.loop_stop()
    client.disconnect()
    print(f"\nDone — {total_published} total readings published to HiveMQ.")


if __name__ == "__main__":
    main()
