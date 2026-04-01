import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DEVICES = ['METER-001', 'METER-002'];

const jitter = (base, spread) => base + (Math.random() * 2 - 1) * spread;
const clamp = (val, min, max) => Math.max(min, Math.min(max, val));

function generateReadings(deviceId, startDate, hours, intervalMinutes = 15) {
  const rows = [];
  let e = deviceId === 'METER-001' ? 10000.0 : 5000.0;  // starting cumulative energy
  const baseLoad = deviceId === 'METER-001' ? 3500 : 1800; // watts
  let prevVa = 230, prevVb = 230, prevVc = 230;

  const start = new Date(startDate);
  const totalReadings = (hours * 60) / intervalMinutes;

  for (let i = 0; i < totalReadings; i++) {
    const ts = new Date(start.getTime() + i * intervalMinutes * 60 * 1000);
    const hour = ts.getUTCHours();

    // Load profile: higher during business hours (8-18), lower at night
    let loadMultiplier = 0.3;
    if (hour >= 8 && hour <= 18) loadMultiplier = 0.7 + Math.random() * 0.5;
    else if (hour >= 6 && hour < 8) loadMultiplier = 0.4 + Math.random() * 0.3;
    else if (hour > 18 && hour <= 22) loadMultiplier = 0.5 + Math.random() * 0.3;

    // Simulate mild phase imbalance
    const imbalanceFactor = Math.random() < 0.1 ? 1.5 : 0.5;
    const ca = clamp(jitter(baseLoad * loadMultiplier / 230, imbalanceFactor), 0.5, 80);
    const cb = clamp(jitter(baseLoad * loadMultiplier / 230, imbalanceFactor), 0.5, 80);
    const cc = clamp(jitter(baseLoad * loadMultiplier / 230, imbalanceFactor), 0.5, 80);

    // Voltages with realistic walk
    prevVa = clamp(jitter(prevVa, 1.2), 218, 244);
    prevVb = clamp(jitter(prevVb, 1.2), 218, 244);
    prevVc = clamp(jitter(prevVc, 1.2), 218, 244);
    const va = prevVa, vb = prevVb, vc = prevVc;

    // Power factor with occasional dips
    const pfDip = Math.random() < 0.05 ? 0.12 : 0;
    const pf = clamp(0.92 + Math.random() * 0.07 - pfDip, 0.72, 1.0);

    const avgV = (va + vb + vc) / 3;
    const avgI = (ca + cb + cc) / 3;
    const ap = Number((avgV * avgI * pf).toFixed(3));
    const rp = Number((ap * Math.tan(Math.acos(pf))).toFixed(3));
    const f = Number(clamp(jitter(50, 0.06), 49.7, 50.3).toFixed(3));

    // Energy ALWAYS increases (cumulative)
    const eIncrement = ap * (intervalMinutes * 60) / 3600000; // W*s / 3600000 = kWh
    e = Number((e + eIncrement).toFixed(6));

    rows.push({
      bucket: ts.toISOString(),
      deviceid: deviceId,
      datatype: 'TCMData',
      e,
      f,
      ap,
      ca: Number(ca.toFixed(3)),
      cb: Number(cb.toFixed(3)),
      cc: Number(cc.toFixed(3)),
      pf: Number(pf.toFixed(4)),
      rp,
      va: Number(va.toFixed(3)),
      vb: Number(vb.toFixed(3)),
      vc: Number(vc.toFixed(3))
    });
  }

  return rows;
}

// Generate 7 days of readings for each device (15-min intervals = 672 readings/device)
const startDate = '2025-03-20T00:00:00.000Z';
const allRows = [];
for (const device of DEVICES) {
  allRows.push(...generateReadings(device, startDate, 7 * 24, 15));
}

// Sort by timestamp
allRows.sort((a, b) => new Date(a.bucket) - new Date(b.bucket));

// Write CSV
const header = 'bucket,deviceid,datatype,e,f,ap,ca,cb,cc,pf,rp,va,vb,vc';
const lines = allRows.map(r =>
  `${r.bucket},${r.deviceid},${r.datatype},${r.e},${r.f},${r.ap},${r.ca},${r.cb},${r.cc},${r.pf},${r.rp},${r.va},${r.vb},${r.vc}`
);

const outDir = path.resolve(__dirname, '..', 'data');
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, 'sample-readings.csv');
fs.writeFileSync(outPath, [header, ...lines].join('\n') + '\n');
console.log(`Generated ${allRows.length} readings to ${outPath}`);
