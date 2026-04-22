import { Router } from 'express';
import {
  createReportController,
  getSchoolTrackingController,
  upload
} from '../controllers/report.controller.js';

const router = Router();

router.post('/', upload.array('photos', 10), createReportController);
router.get('/tracking', getSchoolTrackingController);

export default router;