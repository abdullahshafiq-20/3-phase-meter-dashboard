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

## Alert engine, health score, and future-risk score

The **`alertService`** evaluates every telemetry row the same way CSV ingestion does: each sample is first passed through **`normalizeTelemetryExportRow`** in `csvDataService` (numeric coercion, `|PF|` clamp, and reconstructed **`ap`** when the export shows `ap = 0` but V/I/PF are valid: `ap = (Va·Ia + Vb·Ib + Vc·Ic) × |PF|`). The live mock path applies the same normalization so alerts, health, and risk stay consistent across **historical CSV** and **live** snapshots.

### Health score (0–100): “how good is this reading?”

Health is a **penalty model** starting at **100**. Branches use **`clamp(x, min, max)`** so penalties do not explode. Nominal line voltage **`Vnom`** comes from `NOMINAL_VOLTAGE` in config (default **230** V from `NOMINAL_VOLTAGE` in `.env`). **`ratedCapacityW`** (default **10_000** W) is used only for an extra penalty when `ap` is very high.

**Per-reading components:**

| Symbol        | Meaning                                                                 |
|---------------|-------------------------------------------------------------------------|
| `F_dev`       | \|f − 50\| (Hz)                                                         |
| `V_avg`       | (Va + Vb + Vc) / 3                                                      |
| `V_dev`       | \|V_avg − Vnom\|                                                        |
| `I_avg`       | mean of `ca`, `cb`, `cc`                                                |
| `I_max`       | max of phase currents                                                   |
| `I_imbalance` | (I_max − I_avg) / I_avg (0 if I_avg negligible)                         |
| `PF_loss`     | max(0, 1 − min(1, \|pf\|))                                              |
| `RP_ratio`    | \|rp\| / \|ap\| capped to [0, 2] (safe divisor if ap ≈ 0)               |
| `Power_spike` | \|ap − ap_prev\| / \|ap_prev\| if previous ap exists, else 0; clamped   |


**Weights** (code constants): `Wf=10`, `Wv=15`, `Wi=20`, `Wpf=25`, `Wrp=15`, `Wspike=15`.

**Formula:**

```text
health = 100
  − Wf  · clamp(F_dev, 0, 1)
  − Wv  · clamp(V_dev / 10, 0, 5)
  − Wi  · clamp(I_imbalance, 0, 1.5)
  − Wpf · clamp(PF_loss, 0, 1)
  − Wrp · clamp(RP_ratio, 0, 1)
  − Wspike · clamp(Power_spike, 0, 1)

if ap > 0.95 × ratedCapacityW  →  health −= 8

health = clamp(health, 0, 100)
```

**Bands:** ≥90 Healthy · ≥75 Slight issues · ≥50 Degrading · &lt;50 Critical.

### Future-risk score (0–1): “how worried should we be about the near term?”

Risk is **not** a physics model; it summarizes a **rolling window** of the last **`RISK_WINDOW = 8`** processed points (each point already has **health** and **alerts**). If the window has fewer than **3** samples, risk is **0**.

**Ingredients:**

1. **Health drop** `drop`: compare the two latest health values in the window:  
   `dHealth = health[h−2] − health[h−1]`, then  
   `drop = clamp(dHealth / 20, 0, 1)` — faster worsening → higher `drop`.

2. **Variability** `variability`: over the window, compute sample standard deviation of **`ap`**, **`pf`**, and average voltage `(Va+Vb+Vc)/3`; normalize rough instability:  
   `varAp = std(ap) / mean(ap)` (if `mean(ap)` small, treat as 0),  
   `varPf = std(pf)`,  
   `varV = std(Vavg) / mean(Vavg)`,  
   then  
   `variability = clamp(varAp + varPf + 2·varV, 0, 3) / 3`.

3. **Violations** `viol`: sum a **severity weight** for every alert in the window: critical **1**, warning **0.5**, info **0.15**; then  
   `viol = clamp(viol / 8, 0, 1)`.

4. **Trend** `trend`: least-squares **slope** of health vs index in the window; **negative** slope (health falling over time) increases risk:  
   `trend = clamp(−slope / 3, 0, 1)`.

**Blend:**

```text
risk = clamp( 0.4·drop + 0.2·variability + 0.2·viol + 0.2·trend , 0, 1 )
```

**Bands:** &lt;0.3 Safe · &lt;0.6 Monitor · &lt;0.8 High risk · ≥0.8 Likely failure soon (operational label, not a warranty).

### Rule-based alerts (summary)

Thresholds include: frequency **49.5–50.5 Hz**; voltage per phase **210–245 V**; voltage spread between phases **>10 V**; phase current imbalance **(I_max − I_avg)/I_avg × 100** with warn **>10%** / critical **>20%**; load spread **(I_max − I_min)/I_max > 0.3**; PF tiers; active-power step **±30%** vs previous sample; reactive-power ratio and trends; combined overload heuristics (see `server/services/alertService.js`). Each alert gets **technical** `message` text plus **consumer** fields (`plainTitle`, `plainSummary`, `whatYouCanDo`) for non-technical operators.

### API surface for alerts

* `GET /alerts/:deviceId/timeline?from=&to=&limit=&ratedCapacity=` — CSV-backed series with per-timestamp **health**, **risk**, and enriched alerts.
* `GET /alerts/:deviceId/live?ratedCapacity=` — latest mock-live reading with **health**, **risk**, and enriched alerts (uses an in-memory ring buffer for the risk window).

### Related configuration

* `NOMINAL_VOLTAGE` — used in health and some alert logic.
* `RATED_PHASE_CURRENT_A` — server reference for ampacity-related thinking (see `.env.example`); client can mirror with `VITE_RATED_PHASE_CURRENT_A` for live deviation readouts.

---

## Frontend capabilities (dashboard, live, insights, alerts)

* **Live WebSocket** opens after login for any main route: `LiveProvider` wraps the app shell (not only the Live page), so the **Dashboard** “Live phase readings” prefer the stream and show connection state; snapshot data fills in until the first message.
* **Live page** charts **max phase voltage** and **max phase current** over time, with reference band and nominal line, plus real-time **voltage drift %**, **stress toward limits %**, and **current vs reference %** (`VITE_NOMINAL_VOLTAGE`, `VITE_RATED_PHASE_CURRENT_A` in `client/.env.example`).
* **Insights** adds **time-series mini-charts** on cards, with red markers where values are stressed (thresholds / percentiles / anomaly timestamps).
* **Alerts** page: health/risk chart over the CSV window, live polling, **plain-language** alert cards, **collapsible** lists (newest / “last in batch” pinned, older entries folded), and a **single reading timestamp** for live so times do not appear to “creep” on every poll.
* **Data** API adds `GET /data/:deviceId/historical/recent?limit=` for efficient chart slices.

---

## Deployment & Sample Data Considerations

### Hosted deployment (DigitalOcean)

[LIVE ACCESS HERE](https://3-phase-meter-dashboard.vercel.app/)

The application is deployed with the **backend running on DigitalOcean** in a **managed, serverless-style app service** environment (hosted service model rather than a long-running VPS you manage by hand). That setup favors a small artifact, predictable memory use, and simple operations.

For that deployment, telemetry is intentionally **not** loaded from the real multi-hundred-megabyte export. The backend uses the **mock / sample CSV** (for example `sample-readings.csv`) so the service stays light, starts reliably, and matches the constraints of a serverless-oriented runtime. The full **~500MB+** single-file telemetry CSV is supported by the codebase for heavy local or dedicated-server testing (see below), but it is **not** what the simplified DigitalOcean deployment uses.

> **NOTE:** By default in development, sample data is also used (`sample-readings.csv`) for a small local footprint.

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

All protected bounds sit behind an `authenticateAccessToken` middleware. Requests to `/devices`, `/data`, `/insights`, `/dashboard`, `/alerts`, and `/admin` require an `Authorization: Bearer <token>` header. Admin endpoints additionally require an `admin` role token block.

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
* `GET /.../historical/recent`
  * Query: `?limit=400` (capped server-side)
  * Response Data: `{ "limit", "total", "data": [ ... last N rows ] }` for charts and light clients.
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

### Alerts & health (`/alerts/:deviceId`)

* `GET /.../timeline?from=&to=&limit=&ratedCapacity=` — time-ordered **health**, **risk**, and **consumer-enriched** alerts over CSV-backed readings.
* `GET /.../live?ratedCapacity=` — one **live** snapshot (mock generator) with health, risk, and plain-language alert copy.

### Admin Tools (`/admin`) *(Requires Admin Role)*
* `GET /admin/users`
  * Response Data: Complete array of user identities (password hashes are intentionally stripped by controller).
* `GET /admin/status`
  * Response Data: Current node runtime analytics, allocated memory footprint, heap statistics tracking active CSV load size in bytes.
* `POST /admin/reload-csv`
  * Response Data: Triggers the internal datastore to flush all records and re-parse the latest designated CSV.
