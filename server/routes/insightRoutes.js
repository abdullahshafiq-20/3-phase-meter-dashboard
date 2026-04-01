import { Router } from 'express';
import {
  peakDemand,
  energyCost,
  powerFactor,
  phaseImbalance,
  voltageStability,
  reactivePower,
  frequencyStability,
  anomalies,
  loadProfile,
  harmonicDistortion,
  dailyLoadCurve,
  capacityUtilization
} from '../controller/insightController.js';

const router = Router();

router.get('/:deviceId/peak-demand', peakDemand);
router.get('/:deviceId/energy-cost', energyCost);
router.get('/:deviceId/power-factor', powerFactor);
router.get('/:deviceId/phase-imbalance', phaseImbalance);
router.get('/:deviceId/voltage-stability', voltageStability);
router.get('/:deviceId/reactive-power', reactivePower);
router.get('/:deviceId/frequency-stability', frequencyStability);
router.get('/:deviceId/anomalies', anomalies);
router.get('/:deviceId/load-profile', loadProfile);

// ─── Bonus insight endpoints ───────────────────────────────────────
router.get('/:deviceId/harmonic-distortion', harmonicDistortion);
router.get('/:deviceId/daily-load-curve', dailyLoadCurve);
router.get('/:deviceId/capacity-utilization', capacityUtilization);

export default router;
