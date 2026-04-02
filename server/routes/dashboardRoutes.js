import { Router } from 'express';
import { getDashboard, getAllDevicesDashboard } from '../controller/dashboardController.js';

const router = Router();

router.get('/all', getAllDevicesDashboard);
router.get('/:deviceId', getDashboard);

export default router;
