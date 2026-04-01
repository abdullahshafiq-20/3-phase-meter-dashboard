import { Router } from 'express';
import { requireRole } from '../middlewares/auth.js';
import { listUsers, getSystemStatus, reloadCsv } from '../controller/adminController.js';

const router = Router();

// All admin routes require the 'admin' role
router.use(requireRole(['admin']));

router.get('/users', listUsers);
router.get('/status', getSystemStatus);
router.post('/reload-csv', reloadCsv);

export default router;
