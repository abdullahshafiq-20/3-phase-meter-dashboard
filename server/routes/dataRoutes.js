import { Router } from 'express';
import {
  getHistorical,
  getRange,
  getSummary,
  getConsumption,
  getLiveSnapshot
} from '../controller/dataController.js';

const router = Router();

// Historical (CSV-backed)
router.get('/:deviceId/historical', getHistorical);
router.get('/:deviceId/historical/range', getRange);
router.get('/:deviceId/historical/summary', getSummary);
router.get('/:deviceId/historical/consumption', getConsumption);

// Live (mock generator)
router.get('/:deviceId/live', getLiveSnapshot);
// WebSocket live stream is handled in app.js via the upgrade event

export default router;
