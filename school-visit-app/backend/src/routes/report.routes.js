import { Router } from 'express';
import {
  createReportController,
  getReportsDashboardController,
  getReportPdfController,
  getSchoolTimelineController,
  getSchoolTrackingController,
  previewReportPdfController,
  resendReportEmailController,
  sendFollowUpReminderController,
  updateReportController,
  upload
} from '../controllers/report.controller.js';
import { requireAdmin, requireUser } from '../middleware/auth.js';

const router = Router();

router.post('/', upload.array('photos', 10), createReportController);
router.post('/preview-pdf', previewReportPdfController);
router.get('/:id/pdf', requireAdmin, getReportPdfController);
router.get('/dashboard', requireAdmin, getReportsDashboardController);
router.get('/tracking', requireUser, getSchoolTrackingController);
router.get('/timeline', requireUser, getSchoolTimelineController);
router.patch('/:id', requireAdmin, updateReportController);
router.post('/:id/resend', requireAdmin, resendReportEmailController);
router.post('/:id/send-reminder', requireUser, sendFollowUpReminderController);

export default router;
