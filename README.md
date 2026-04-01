# 3-Phase Meter Dashboard API

A powerful backend for monitoring, evaluating, and deriving insights from 3-phase power meter telemetry. 

## Flow of the Application & Core Data Processing

1. **Initialization**: On startup, the application reads telemetry data from a CSV file defined in `.env` (`CSV_PATH`). Using `csv-parse`, it streams and caches all readings grouped by `deviceId` in memory via `csvDataService`.
2. **Data Cleanup & Calculation**: 
   - Some legacy or partial telemetry exports may report Active Power (`ap`) as string zero (`0E-20`) or raw `0` even when Voltage, Current, and Power Factor are valid. The backend mathematically reconstructs this during loading using individual phase potentials: `Active Power = (Va*Ia + Vb*Ib + Vc*Ic) * |PF|`. 
   - All standard metric limits (e.g., Power Factor) are clamped appropriately for data consistency during the initial parse pass.
3. **Data Availability**: The core datasets are exposed through paginated sets, specific time-range queries, and aggregate summaries (Min/Max/Avg) directly sourced from memory to grant exceptionally fast reads.
4. **Insight Generation**: The `insightService` iterates over the cached arrays to dynamically compute advanced electrical insights like:
   - Peak Demand limits via array reduction.
   - Phase imbalance percentages and standard deviations between Va/Vb/Vc.
   - Harmonic distortion estimations.
   - Dynamic load curves and capacity utilizations mapped chronologically.
5. **Live Data Streaming**: Alongside historical data, a mock generator simulates real-time variations of the latest CSV records, emitting updates via a dedicated WebSocket Server (`ws://host/data/:deviceId/live/stream`) and REST `/live` endpoints to feed live-updating client dashboard charts.

---

## Deployment & Sample Data Considerations

> **NOTE:** By default, sample data is used (`sample-readings.csv`) for the sake of easily deploying the app locally with a small footprint. 

When deploying for production or conducting heavy scale testing with the original telemetry logs:
1. Place your large 500MB+ dataset in the `server/data/` folder.
2. Change the `.env` variable `CSV_PATH` to point to the large file:
   ```env
   CSV_PATH=./data/telemetry_export.csv
   ```
3. Restart the server. The internal memory map will automatically load the large dataset dynamically.
*(Alternatively, you can trigger `POST /admin/reload-csv` to instruct the server to remap the active load without taking Node offline).*

---

## Managing Users

Access to the system requires JWT-based authentication. Users are natively defined in a local JSON configuration rather than an external database dependency. 

### How to Add a New User
1. Navigate to the `server/users.config.json` file.
2. Create a new user object inside the `users` array containing `username`, `passwordHash`, and `role`. 
3. The password must be secured using `bcrypt` (e.g. 10 salt rounds). 
   *(You can quickly generate a bcrypt hash using a simple Node.js script: `console.log(require('bcrypt').hashSync('your_target_password', 10))`).*
4. Example structure:
   ```json
   {
      "username": "new_viewer",
      "passwordHash": "$2b$10$YourGeneratedBcryptHashHere...",
      "role": "viewer" // or "admin"
   }
   ```
5. Save the file and restart the server so the new auth credentials take effect.

---

## API Endpoints Overview

All protected bounds sit behind an `authenticateAccessToken` middleware. Requests to `/devices`, `/data`, `/insights`, `/dashboard`, and `/admin` require an `Authorization: Bearer <token>` header. Admin endpoints additionally require an `admin` role token block.

All responses follow a unified envelope schema:
```json
{
  "success": true,
  "data": { ... } 
}
// OR on error
{
  "success": false,
  "error": { "message": "...", "code": 500 }
}
```

### Authentication (`/auth`)
* `POST /auth/login`
  * Body: `{ "username": "...", "password": "..." }`
  * Response Data: `{ "accessToken": "...", "refreshToken": "...", "user": { "username": "...", "role": "..." } }`
* `POST /auth/refresh`
  * Body: `{ "refreshToken": "..." }`
  * Response Data: `{ "accessToken": "..." }`
* `POST /auth/logout`
  * Body: `{ "refreshToken": "..." }`
  * Response Data: `{ "message": "Logged out successfully" }`

### Devices (`/devices`)
* `GET /devices`
  * Response Data: Array of available `deviceId` strings natively detected in CSV bounds.
* `GET /devices/:deviceId/info`
  * Response Data: Basic bounds metadata e.g. `{ "deviceId": "...", "firstSeen": "...", "lastSeen": "...", "totalReadings": 12000 }`.

### Dashboard (`/dashboard`)
* `GET /dashboard/:deviceId`
  * Response Data: A heavily abstracted composition of current snapshot data, aggregated core insights (peak demand, imbalances, recent anomalies), and recent numerical history to immediately populate the main frontend UI panel.

### Telemetry Data (`/data/:deviceId`)
* `GET /.../historical`
  * Query: `?page=1&limit=50`
  * Response Data: `{ "page": 1, "limit": 50, "total": 12000, "totalPages": 240, "data": [...] }`
* `GET /.../historical/range`
  * Query: `?from=ISO_DATE&to=ISO_DATE`
  * Response Data: Chronological list of raw array nodes passing strict interval rules.
* `GET /.../historical/summary`
  * Response Data: Deep min, max, avg reduction dictionary across properties like voltage and apparent power.
* `GET /.../historical/consumption`
  * Query: `?interval=hourly|daily`
  * Response Data: Chronological buckets holding calculated `consumedKwh`.
* `GET /.../live`
  * Response Data: Current synthesized active data snapshot acting as a single telemetry row.
* `WS /.../live/stream`
  * *WebSocket Protocol Request*: Listens on `ws://.../data/:deviceId/live/stream`. Continually outputs live metric row structures.

### Analytics Insights (`/insights/:deviceId`)
* `GET /.../peak-demand`: Highest recorded kW spikes analysis.
* `GET /.../energy-cost?unitPrice=0.15`: Theoretical monetary burn-down tracking map against power usage.
* `GET /.../power-factor`: Total efficacy indices and discrepancy flags based on aggregate averages.
* `GET /.../phase-imbalance`: Variances calculated between phase tracks (Va/Vb/Vc and Ia/Ib/Ic) detecting grid skewing.
* `GET /.../voltage-stability?nominalVoltage=230`: Dip and swell assessment counting events triggering past grid specifications.
* `GET /.../reactive-power`: Summary analysis tracking strictly vars and reactive power waste margins.
* `GET /.../frequency-stability`: Variance counts against 50Hz/60Hz grid standards.
* `GET /.../anomalies`: Automatically flagged extreme dataset bursts scaling above deviation bands.
* `GET /.../load-profile`: Distribution mapping revealing the ratio of heavy, moderate, and low demand periods.
* `GET /.../harmonic-distortion`: Evaluated deductions predicting potential distortion impacts.
* `GET /.../daily-load-curve`: Averaged hourly behavior plotting base load outlines vs active bounds.
* `GET /.../capacity-utilization?ratedCapacity=X`: Percentage stress evaluation against theoretical peak limit bounds to highlight overlaod warnings.

### Admin Tools (`/admin`) *(Requires Admin Role)*
* `GET /admin/users`
  * Response Data: Complete array of user identities (password hashes are intentionally stripped by controller).
* `GET /admin/status`
  * Response Data: Current node runtime analytics, allocated memory footprint, heap statistics tracking active CSV load size in bytes.
* `POST /admin/reload-csv`
  * Response Data: Triggers the internal datastore to flush all records and re-parse the latest designated CSV.
