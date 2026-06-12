import express from 'express';
import cors from 'cors';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { env } from './config/env.js';
import schoolRoutes from './routes/school.routes.js';
import reportRoutes from './routes/report.routes.js';
import planRoutes from './routes/plan.routes.js';

const app = express();
const appDir = dirname(fileURLToPath(import.meta.url));
const reportArchiveDir = join(appDir, '../generated/reports');

const allowedOrigins = String(env.frontendUrl || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin) || /^https:\/\/school-visit-app.*\.vercel\.app$/.test(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/api/reports/pdfs', express.static(reportArchiveDir));

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'API is running' });
});

app.use('/api/schools', schoolRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/plans', planRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Internal server error'
  });
});

export default app;
