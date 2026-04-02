# 3-Phase Meter Dashboard

A real-time multi-device 3-phase power meter monitoring system. Python meter simulators publish telemetry to HiveMQ Cloud (MQTT), a Node.js backend subscribes and processes all readings in memory, and a React frontend streams live data via WebSocket to display fleet-wide dashboards, analytics, alerts, and insights — all computed from real-time accumulated data.

## Architecture Overview

```
┌─────────────────────┐     MQTT (TLS)     ┌──────────────────────┐     Socket.IO     ┌─────────────────────┐
│   Meter Simulators   │ ────────────────▶  │    HiveMQ Cloud      │ ◀──subscribe──── │   Node.js Server    │
│  (Python scripts)    │   meter/live/+     │    (MQTT Broker)     │                   │  (Express + WS)     │
│                      │                    └──────────────────────┘                   │                     │
│  METER-001           │                                                               │  ┌───────────────┐  │
│  METER-002           │                         ▼ message                             │  │  Data Store    │  │
│  METER-003           │                    ┌──────────────────────┐                   │  │  (in-memory)   │  │
│  ...N devices        │                    │  Server subscribes   │                   │  │  per-device    │  │
└─────────────────────┘                    │  to meter/live/+     │──ingest──────────▶│  │  history       │  │
                                           │  (all devices at     │                   │  └───────────────┘  │
                                           │   once, one sub)     │                   │         │            │
                                           └──────────────────────┘                   │         ▼            │
                                                                                      │  ┌───────────────┐  │
                                                                                      │  │  Socket.IO     │  │
                                                                                      │  │  emit to       │──────▶  React Frontend
                                                                                      │  │  all-devices   │  │       (Vite + Tailwind)
                                                                                      │  │  room instant  │  │
                                                                                      │  └───────────────┘  │
                                                                                      │         │            │
                                                                                      │         ▼            │
                                                                                      │  REST API (JWT)      │
                                                                                      │  /dashboard, /data,  │
                                                                                      │  /insights, /alerts  │
                                                                                      └─────────────────────┘
```

## End-to-End Data Flow

### 1. Meter Simulator (Python) → HiveMQ

The `microservice/meter_simulator.py` script simulates N virtual 3-phase meters. Each tick:

- **Generates realistic telemetry**: voltage (3 phases), current (3 phases), power factor, frequency, active power, reactive power, cumulative energy
- **Injects fault scenarios** probabilistically (15% default) to trigger alerts: under/over voltage, frequency deviation, phase failure, overload, low PF, etc.
- **Publishes JSON** to `meter/live/{deviceId}` on HiveMQ Cloud over MQTTS (TLS, MQTTv5)

**Payload shape:**
```json
{
  "bucket": "2026-04-02T12:00:00.000Z",
  "deviceid": "METER-001",
  "datatype": "TCMData",
  "e": 12345.678, "f": 50.02, "ap": 3456.789,
  "va": 230.5, "vb": 229.8, "vc": 231.2,
  "ca": 5.123, "cb": 4.987, "cc": 5.456,
  "pf": 0.956, "rp": 234.567
}
```

**Running the simulator:**
```bash
cd microservice
pip install -r requirements.txt
python meter_simulator.py --interval 5 --devices METER-001,METER-002,METER-003
```

### 2. HiveMQ → Node.js Server (Single MQTT Subscription)

The server connects to HiveMQ on startup and subscribes to **`meter/live/+`** — a single wildcard subscription that captures data from ALL devices at once. This is the key scalability pattern: **one subscription handles unlimited devices**.

When a message arrives on `meter/live/METER-001`:
1. The topic is parsed to extract `deviceId`
2. The payload is **normalized** (numeric coercion, PF clamp, AP reconstruction if zero)
3. The reading is **ingested into the in-memory data store** (`dataStore.js`)
4. The reading is **immediately emitted** via Socket.IO to:
   - The `device:{deviceId}` room (for per-device subscribers)
   - The `all-devices` room (for fleet-wide dashboard)
5. A device status update is broadcast with `lastSeen` timestamp

**There is NO CSV file dependency.** All data comes from MQTT in real-time. Historical data accumulates in memory as readings arrive (up to 5000 per device, configurable).

### 3. Server → Frontend (WebSocket + REST)

**WebSocket (Socket.IO) — Real-time path:**
- Frontend connects once and joins the `all-devices` room
- Every MQTT message is forwarded instantly — **zero polling delay**
- The socket connection persists across page navigation (LiveProvider wraps the entire app shell)
- If a device stops sending data, a timer shows "X seconds since last data"
- Reconnection is automatic with exponential backoff

**REST API — Computed analytics path:**
- Dashboard, Insights, Alerts endpoints compute analytics from the accumulated in-memory data store
- These are called on page load and periodically refreshed
- All insight calculations (peak demand, PF analysis, phase imbalance, anomalies, load curves, etc.) run against real accumulated readings

### 4. Frontend Architecture

**Key design decisions:**
- **LiveProvider wraps the entire app** — WebSocket stays connected even when switching pages
- **All devices stream simultaneously** — the `all-devices` room receives every reading from every meter
- **Per-device history** is maintained client-side (120 samples rolling buffer per device)
- **Dashboard shows cards for ALL devices** — each card shows live readings, online status, and "time since last data"
- **Click a device card** to select it and see detailed analytics below

#### Persistent React state across routes (easier page switching)

Feature providers are mounted **once** around `AppLayout`, not inside each route. That way navigating between Dashboard, Historical, Live, Insights, and Alerts **does not unmount** those providers, so fetched data and UI state are retained:

| Provider | What stays in memory |
|----------|------------------------|
| `DashboardProvider` | Last dashboard payload **per device** (`dashboardByDevice`). Returning to the dashboard shows cached data immediately; the selected device still refreshes on a timer in the background. |
| `InsightsProvider` | Insights payload **per device** (`insightsByDevice`). Switching pages and coming back does not wipe analytics. |
| `HistoricalProvider` | Consumption chart, table page, and date-range filters are **snapshotted per device** when you change the device dropdown, then restored when you select that device again. |
| `AlertsProvider` | Timeline and live alert snapshot **per device**, plus rated-capacity input. |
| `LiveProvider` | Always global — live stream and per-device rolling history are never tied to a single page. |

Together with the persistent Socket.IO session, this makes route changes lightweight: you are not “starting cold” on every navigation.

#### Fleet dashboard — “Unstable” meters (insight-aligned thresholds)

Each fleet card evaluates the **latest live reading** with `client/src/utils/meterStability.js`. Rules are aligned with the server’s `alertService` / insight logic (frequency band, per-phase voltage limits, voltage spread between phases, current imbalance %, load imbalance, phase-loss heuristics, overload vs rated capacity, low PF tiers, reactive-power share, and a **THD-style estimate from PF** matching `insightService`):

- **Unstable** badge: at least one rule breached.
- **Severity**: `critical` vs `warning` (affects card border, tint, and fleet summary counts).
- **Fleet summary** (under the page title): counts how many devices are in critical vs warning breach. **Rated capacity** for overload-style checks comes from the same control as Insights (`InsightsProvider` → shared with the fleet view).

This is a **client-side snapshot** of the latest sample, not a full re-run of all historical insight endpoints; it gives instant operator feedback on the grid of meters.

## Server startup log (HiveMQ + Socket.IO)

When the backend starts successfully against HiveMQ Cloud, logs look like this:

```
HiveMQ connected to <cluster>.s1.eu.hivemq.cloud:8883
Socket.IO server initialized
Live data service: subscribed to HiveMQ live topic (meter/live/+)
Live data service: subscribed to HiveMQ historical topic
Server listening on http://localhost:3000
Waiting for MQTT data from meter simulators...
HiveMQ subscribed to meter/live/+
HiveMQ subscribed to meter/historical/+
```

The **two MQTT subscriptions** are a single wildcard each (`meter/live/+` and `meter/historical/+`): all meters are covered without opening one subscription per device.

## How Values Are Calculated

### At the Backend (dataStore + insightService + alertService)

**Normalization (`normalizeTelemetryExportRow`):**
- All numeric fields coerced to `Number`, with fallback to 0
- Power factor clamped to `|PF|` in [-1, 1]
- If `ap === 0` but V/I/PF are valid: `ap = (Va×Ia + Vb×Ib + Vc×Ic) × |PF|`
- Bucket normalized to ISO timestamp

**Health Score (0–100):**
Penalty model starting at 100, subtracting weighted penalties for:
- Frequency deviation from 50 Hz (weight 10)
- Voltage deviation from nominal (weight 15)
- Current imbalance between phases (weight 20)
- Power factor loss (weight 25)
- Reactive power ratio (weight 15)
- Power spike vs previous reading (weight 15)

**Risk Score (0–1):**
Rolling window of last 8 readings evaluating:
- Health drop rate (40%)
- Variability of AP, PF, voltage (20%)
- Alert violation accumulation (20%)
- Health trend slope (20%)

**Insight Calculations:**
All computed from the accumulated reading arrays per device:
- Peak demand: max AP across all readings
- Power factor: average, min, max, low-PF event count
- Phase imbalance: `(Imax - Iavg) / Iavg × 100`
- Voltage stability: per-phase std dev, min, max
- Anomalies: energy drops, PF extremes, voltage sag/swell, frequency deviation, power surges
- Load curve: hourly average demand by UTC hour
- THD estimate: `sqrt(1/(cos²PF) - 1) × 100`
- Capacity utilization: AP vs rated capacity percentage

### At the Frontend (LiveContext enrichment)

Each live sample is enriched with:
- `maxV`, `minV`: highest/lowest phase voltage
- `maxA`: highest phase current
- `voltageDriftPct`: deviation from nominal voltage target
- `voltageLimitStressPct`: how close to the 210V/245V danger limits
- `currentVsRatedPct`: peak current vs rated ampacity

## Historical Data Handling

Historical data is the **accumulated live readings stored in memory**. As meters send data, it builds up in the server's data store (up to 5000 readings per device). This means:

1. **No separate historical data fetch needed** — it's the same data that arrived live
2. **Historical API endpoints** (`/data/:id/historical`, `/data/:id/historical/range`) query this accumulated store
3. **Bulk historical import** is supported via `meter/historical/+` MQTT topic — the `bulk_publish.py` script can replay CSV data through the broker
4. **On server restart**, history resets — for persistence, use `bulk_publish.py` to replay data, or add a database layer

## Scalability

### How many meters can connect at once?

**MQTT subscription**: One wildcard subscription (`meter/live/+`) handles unlimited devices. HiveMQ Cloud supports thousands of concurrent publishers on a single topic pattern.

**Server memory**: Each reading is ~200 bytes. At 5000 readings × 100 devices = ~100MB. Adjustable via `MAX_HISTORY_PER_DEVICE`.

**WebSocket fan-out**: Socket.IO rooms efficiently broadcast to connected clients. The `all-devices` room means one emit per reading reaches all dashboard viewers.

**Frontend**: React state management handles per-device data independently. The rolling buffer (120 samples) keeps memory bounded regardless of how long the session runs.

### Subscription model

The server subscribes **once** to `meter/live/+` — this is a single MQTT subscription that matches all device topics. There is no per-device subscription at the server level. When a new meter starts publishing to `meter/live/NEW-DEVICE`, the server automatically picks it up and the frontend discovers it in real-time.

On the frontend, the Socket.IO client joins the `all-devices` room once on connection. Individual device rooms (`device:{id}`) exist for targeted subscriptions but the fleet dashboard uses the global room.

## Project Structure

```
├── microservice/
│   ├── meter_simulator.py      # Live MQTT publisher (simulates N meters)
│   ├── bulk_publish.py         # Batch historical replay from CSV via MQTT
│   ├── requirements.txt        # paho-mqtt, python-dotenv
│   └── .env                    # HiveMQ credentials
│
├── server/
│   ├── app.js                  # Express + Socket.IO + MQTT startup
│   ├── config/
│   │   ├── index.js            # Environment config
│   │   ├── hivemq.js           # MQTT client with wildcard subscription
│   │   └── socket.js           # Socket.IO with all-devices room
│   ├── services/
│   │   ├── dataStore.js        # In-memory per-device data store
│   │   ├── liveDataService.js  # MQTT → dataStore → Socket.IO bridge
│   │   ├── insightService.js   # Analytics computations
│   │   └── alertService.js     # Health, risk, and alert engine
│   ├── controller/             # REST endpoint handlers
│   ├── routes/                 # Express route definitions
│   ├── middlewares/            # JWT auth, logging, error handling
│   └── .env                    # Server config + HiveMQ credentials
│
├── client/
│   ├── src/
│   │   ├── App.jsx             # Route definitions with LiveProvider wrapping all
│   │   ├── context/
│   │   │   ├── LiveContext.jsx  # Global WebSocket: subscribes to ALL devices
│   │   │   ├── DeviceContext.jsx# Device list + selection with polling
│   │   │   ├── DashboardContext.jsx
│   │   │   ├── InsightsContext.jsx
│   │   │   └── HistoricalContext.jsx
│   │   ├── pages/
│   │   │   ├── DashboardPage.jsx   # Fleet view: cards per device + detail
│   │   │   ├── LivePage.jsx        # Real-time charts, instant data
│   │   │   ├── InsightsPage.jsx    # Analytics from accumulated data
│   │   │   ├── AlertsPage.jsx      # Health/risk timeline + live alerts
│   │   │   ├── HistoricalPage.jsx  # Browse accumulated readings
│   │   │   └── AdminPage.jsx       # System status
│   │   ├── components/
│   │   │   ├── AppLayout.jsx       # Sidebar with connection status
│   │   │   └── InsightMiniChart.jsx
│   │   └── services/
│   │       └── api.js              # REST client + Socket.IO factory
│   └── .env                        # VITE_API_URL
│
└── README.md
```

## Getting Started

### Prerequisites
- Node.js 18+
- Python 3.8+ (for meter simulator)
- HiveMQ Cloud account (free tier works)

### Setup

**1. Configure HiveMQ credentials:**

Create `.env` files in `server/` and `microservice/` with:
   ```env
HIVE_MQ_HOST=your-cluster.hivemq.cloud
HIVE_MQ_PORT=8883
HIVE_MQ_USERNAME=your-username
HIVE_MQ_PASSWORD=your-password
```

**2. Start the server:**
```bash
cd server
npm install
npm run dev
```

**3. Start the meter simulator:**
```bash
cd microservice
pip install -r requirements.txt
python meter_simulator.py --interval 5 --devices METER-001,METER-002,METER-003
```

**4. Start the frontend:**
```bash
cd client
npm install
npm run dev
```

Open `http://localhost:5173` — login and watch live data appear instantly on the fleet dashboard.

### Environment Variables

**Server (`server/.env`):**
| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP server port |
| `HIVE_MQ_HOST` | — | HiveMQ Cloud hostname |
| `HIVE_MQ_PORT` | `8883` | MQTTS port |
| `HIVE_MQ_USERNAME` | — | MQTT username |
| `HIVE_MQ_PASSWORD` | — | MQTT password |
| `JWT_SECRET` | `change-me-in-env` | JWT signing secret |
| `CORS_ORIGIN` | `http://localhost:5173` | Allowed CORS origin |
| `NOMINAL_VOLTAGE` | `230` | Reference voltage for health calculations |
| `RATED_PHASE_CURRENT_A` | `100` | Reference ampacity |

**Client (`client/.env`):**
| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `http://localhost:3000` | Backend API URL |
| `VITE_NOMINAL_VOLTAGE` | `230` | UI voltage reference |
| `VITE_RATED_PHASE_CURRENT_A` | `100` | UI current reference |

## API Endpoints

All protected routes require `Authorization: Bearer <token>`.

### Auth (`/auth`)
- `POST /auth/login` — Get access + refresh tokens
- `POST /auth/refresh` — Rotate tokens
- `POST /auth/logout` — Revoke refresh token

### Devices (`/devices`)
- `GET /devices` — List all discovered devices with online status

### Dashboard (`/dashboard`)
- `GET /dashboard/all` — Fleet overview: all device statuses + latest readings
- `GET /dashboard/:deviceId` — Full dashboard payload for one device

### Data (`/data/:deviceId`)
- `GET .../historical` — Paginated readings
- `GET .../historical/recent?limit=400` — Last N readings
- `GET .../historical/range?from=&to=` — Time range filter
- `GET .../historical/summary` — Min/max/avg statistics
- `GET .../historical/consumption?interval=hourly|daily` — Energy consumption
- `GET .../live` — Latest reading snapshot

### Insights (`/insights/:deviceId`)
- Peak demand, energy cost, power factor, phase imbalance, voltage stability, reactive power, frequency stability, anomalies, load profile, harmonic distortion, daily load curve, capacity utilization

### Alerts (`/alerts/:deviceId`)
- `GET .../timeline` — Historical health/risk/alerts series
- `GET .../live` — Current health/risk snapshot with plain-language alerts

### Admin (`/admin`)
- `GET /admin/users` — List users
- `GET /admin/status` — System stats + device count

## Managing Users

Users are stored in `server/users.config.json` with bcrypt-hashed passwords:

```json
{
  "users": [
    {
      "username": "admin",
      "passwordHash": "$2b$10$...",
      "role": "admin"
    }
  ]
}
```

Generate a password hash: `node -e "console.log(require('bcryptjs').hashSync('password', 10))"`
