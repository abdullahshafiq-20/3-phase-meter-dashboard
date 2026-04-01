import { Router } from 'express';
import { getDashboard } from '../controller/dashboardController.js';

const router = Router();

router.get('/:deviceId', getDashboard);

export default router;
