import { Router } from 'express';
import { listDevices, getDeviceInfo } from '../controller/deviceController.js';

const router = Router();

router.get('/', listDevices);
router.get('/:deviceId/info', getDeviceInfo);

export default router;
