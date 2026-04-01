# 3-Phase Meter Dashboard - Backend Server

This is the Node.js / Express backend server for the 3-Phase Meter Dashboard. It processes historical CSV telemetry data and streams simulated real-time data, while tracking advanced electrical insights.

## Setup Steps

1. **Install Dependencies**  
   Inside the `server` directory, run:
   ```bash
   npm install
   ```
2. **Setup Environment**  
   Copy the `.env.example` file to create your own configuration:
   ```bash
   cp .env.example .env
   ```
   Ensure settings like `PORT`, `JWT_SECRET`, and `JWT_REFRESH_SECRET` are properly configured.
3. **Data Requirements**  
   The backend retrieves historical info using `csv-parse` on CSV files located in the `data/` directory (e.g. `data/telemetry_export.csv`). Ensure your data is present. You can also run `node scripts/generateCsv.js` to create dummy data if needed.

## How to Run

- **Start in Development Mode:**
  ```bash
  npm run dev
  ```
  *(Runs via nodemon for hot-reloading)*

- **Start in Production Mode:**
  ```bash
  npm start
  ```
The server will default to `http://localhost:3000` or whichever port is defined in `.env`.

## How to Add/Modify Users

Authentication is local and user data (passwords, roles) is stored in the `server/users.config.json` file. All passwords in the JSON block are explicitly hashed with **bcryptjs**.

**To safely add or modify users:**
1. Open the file `scripts/generateUsers.js`.
2. Edit the script to define the desired `username`, plain text `password`, and `role` (either `"admin"` or `"viewer"`). 
3. Run the generation script:
   ```bash
   node scripts/generateUsers.js
   ```
4. This script automatically computes proper bcrypt hashes and forcefully overwrites the contents of `users.config.json`. The server handles picking up the file upon new login attempts.

---

## Endpoints Summary

Most endpoints return a structured JSON response under this pattern:
```json
{
  "success": true,
  "message": "Operation successful",
  "data": { ... }
}
```
*Note: Excluding `/health` & `/auth/login`, all routes require a standard Bearer `Authorization` header containing an actively valid `accessToken`.*

### Core endpoints
| Method | Route | Description | Expected Response (`data` shape) |
|---|---|---|---|
| `GET` | `/health` | Application status | `{ "status": "ok", "timestamp": "..." }` |

### Authentication (`/auth`)
| Method | Route | Description | Expected Response (`data` shape) |
|---|---|---|---|
| `POST` | `/login` | Submit credentials to acquire JWT tokens | `{ "accessToken": "...", "refreshToken": "...", "user": { "username": "...", "role": "..." } }` |
| `POST` | `/refresh` | Get a new set of tokens via rotate cycle | `{ "accessToken": "...", "refreshToken": "..." }` |
| `POST` | `/logout` | Revokes the current `refreshToken` | `null` |

### Devices (`/devices`)
| Method | Route | Description | Expected Response (`data` shape) |
|---|---|---|---|
| `GET` | `/` | Gets list of active device IDs in the system | `{ "devices": ["meter-1", "meter-2"] }` |
| `GET` | `/:deviceId/info` | General static metadata (timeframes) | `{ "firstSeen": "...", "lastSeen": "...", "totalRecords": 100 }` |

### Data / Historical / Live (`/data`)
| Method | Route | Description | Expected Response (`data` shape) |
|---|---|---|---|
| `GET` | `/:deviceId/historical` | Query raw meter logs w/ pagination | Paginated logs: `{ "metadata": {}, "data": [{...}] }` |
| `GET` | `/:deviceId/historical/range` | Time range filter (from/to) | `{ "count": 100, "data": [...] }` |
| `GET` | `/:deviceId/historical/summary`| Min, Max, and Averages across channels | `{ "va": { "min": 0, "max":0, "avg":0 }, "ca": {...}, ... }` |
| `GET` | `/:deviceId/historical/consumption`| Energy consumption bucketed by intervals | `{ "interval": "hourly", "entries": [...] }` |
| `GET` | `/:deviceId/live` | Simulated real-time tick from generator | A single reading log e.g `{ "ap": 120, "pf": 0.9, ... }` |
| `WS` | `/:deviceId/live/stream` | Dedicated WebSocket stream listener | Active real-time binary payload stream of logs. |

### Dashboard Endpoint (`/dashboard`)
| Method | Route | Description | Expected Response (`data` shape) |
|---|---|---|---|
| `GET` | `/:deviceId` | Unified endpoint containing aggregates | `{ "deviceInfo": {}, "liveReading": {}, "summary": {}, "recentReadings": [], "dailyConsumption": [], "loadCurve": [] }` |

### Analytics / Insights (`/insights`)
*All insight endpoints target an isolated analysis and process the respective meter ID parameters.*

| Method | Route | Description |
|---|---|---|
| `GET` | `/:deviceId/peak-demand` | `data`: { "peakApW": 2345, "timestamp": "..." } |
| `GET` | `/:deviceId/energy-cost` | Calculates metric costs based on `?unitPrice` override. |
| `GET` | `/:deviceId/power-factor` | Averages and counts of inadequate PF instances. |
| `GET` | `/:deviceId/phase-imbalance`| Returns percentage variance among phases (A/B/C) to indicate imbalance limits natively. |
| `GET` | `/:deviceId/voltage-stability`| Tracks overall voltage limits via `?nominalVoltage`. |
| `GET` | `/:deviceId/reactive-power` | Totals and highlights of kVAR load implications natively. |
| `GET` | `/:deviceId/frequency-stability`| Tracks standard frequency deviations natively. |
| `GET` | `/:deviceId/anomalies` | Highlights logs spanning over 3 standard deviations. |
| `GET` | `/:deviceId/load-profile` | Breakdown of consumption segments on time-of-day bases natively. |
| `GET` | `/:deviceId/harmonic-distortion`| Metric data of total harmonic offsets natively. |
| `GET` | `/:deviceId/daily-load-curve` | Graph matrix detailing typical 24hr load patterns natively. |
| `GET` | `/:deviceId/capacity-utilization`| Highlights overall max utilization against physical load boundaries via `?ratedCapacity`. |

### System Administration (`/admin` - Requires admin token)
| Method | Route | Description | Expected Response (`data` shape) |
|---|---|---|---|
| `GET` | `/users` | Lists safe user records (hashed password dropped). | `{ "users": [{ "username": "...", "role":"..." }] }` |
| `GET` | `/status` | Server metrics natively processed natively. | `{ "uptime": 86400, "memoryUsage": {}, "deviceCount": 4, "devices": [] }` |
| `POST` | `/reload-csv` | Wipes and resets the CSV memory heap dynamically. | `null` (Success message included) |
