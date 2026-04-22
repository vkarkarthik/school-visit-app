import { Router } from 'express';
import { getSchoolMasterController } from '../controllers/school.controller.js';

const router = Router();
router.get('/master', getSchoolMasterController);

export default router;