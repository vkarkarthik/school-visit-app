import { Router } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { env } from '../config/env.js';
import {
  createReportController,
  getReportsDashboardController,
  getSchoolTimelineController,
  getSchoolTrackingController,
  previewReportPdfController,
  resendReportEmailController,
  updateReportController,
  upload
} from '../controllers/report.controller.js';

const router = Router();
const googleAuthClient = env.googleOAuthClientId ? new OAuth2Client(env.googleOAuthClientId) : null;
const ADMIN_EMAILS = new Set([
  'karthik@superteacher.in',
  'karthikv@superteacher.in',
  'vasudevan@superteacher.in',
  'bhanu@superteacher.in'
]);

async function getVerifiedUserEmail(req) {
  const credential = String(req.headers['x-google-credential'] || '');

  if (googleAuthClient && credential) {
    const ticket = await googleAuthClient.verifyIdToken({
      idToken: credential,
      audience: env.googleOAuthClientId
    });
    const payload = ticket.getPayload();
    const email = String(payload?.email || '').trim().toLowerCase();
    const hostedDomain = String(payload?.hd || '').trim().toLowerCase();

    if (payload?.email_verified && email.endsWith('@superteacher.in') && hostedDomain === 'superteacher.in') {
      return email;
    }
  }

  if (!googleAuthClient) {
    return String(req.headers['x-user-email'] || '').trim().toLowerCase();
  }

  return '';
}

async function requireAdmin(req, res, next) {
  let email = '';
  try {
    email = await getVerifiedUserEmail(req);
  } catch {
    email = '';
  }

  if (!ADMIN_EMAILS.has(email)) {
    return res.status(403).json({
      success: false,
      message: 'Admin access required.'
    });
  }

  next();
}

router.post('/', upload.array('photos', 10), createReportController);
router.post('/preview-pdf', previewReportPdfController);
router.get('/dashboard', requireAdmin, getReportsDashboardController);
router.get('/tracking', requireAdmin, getSchoolTrackingController);
router.get('/timeline', requireAdmin, getSchoolTimelineController);
router.patch('/:id', requireAdmin, updateReportController);
router.post('/:id/resend', requireAdmin, resendReportEmailController);

export default router;
