import { Router } from 'express';
import { timeline, liveSnapshot } from '../controller/alertController.js';

const router = Router();

router.get('/:deviceId/timeline', timeline);
router.get('/:deviceId/live', liveSnapshot);

export default router;
