import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/appError.js';
import { TrainingReport } from '../models/TrainingReport.js';

function csvEscape(value) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

function parseDateRange(query) {
  const range = {};
  if (query.dateFrom) range.$gte = new Date(query.dateFrom);
  if (query.dateTo) {
    const end = new Date(query.dateTo);
    end.setHours(23, 59, 59, 999);
    range.$lte = end;
  }
  return range;
}

function buildTrainingFilter(req) {
  const { trainingType, state, schoolName, dateFrom, dateTo, year, pm } = req.query;
  const filter = {};

  if (!req.isAdmin) {
    filter.programManagerEmail = req.userEmail;
  } else if (pm) {
    filter.programManagerEmail = String(pm).trim().toLowerCase();
  }

  if (trainingType) filter.trainingType = trainingType;
  if (state) filter.state = state;
  if (schoolName) filter.schoolName = schoolName;
  if (year) filter.year = Number(year);
  if (dateFrom || dateTo) filter.date = parseDateRange(req.query);

  return filter;
}

function buildTrainingsSummary(trainings) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const summary = {
    total: trainings.length,
    offline: 0,
    online: 0,
    thisMonth: 0,
    attendees: 0,
    hours: 0,
  };

  for (const training of trainings) {
    if (training.trainingType === 'Offline') summary.offline += 1;
    else summary.online += 1;
    if (training.date && new Date(training.date) >= monthStart) summary.thisMonth += 1;
    summary.attendees += Number(training.attendanceCount || 0);
    summary.hours += Number(training.durationHours || 0);
  }

  return summary;
}

export const createTrainingController = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const trainingType = String(body.trainingType || 'Offline').trim() === 'Online' ? 'Online' : 'Offline';
  const title = String(body.title || '').trim();
  const date = body.date ? new Date(body.date) : new Date();

  if (!title) {
    throw new AppError('Training title is required.', 400);
  }
  if (Number.isNaN(date.getTime())) {
    throw new AppError('A valid training date is required.', 400);
  }

  const training = await TrainingReport.create({
    trainingType,
    title,
    date,
    topic: String(body.topic || '').trim(),
    state: String(body.state || '').trim(),
    city: String(body.city || '').trim(),
    schoolName: String(body.schoolName || '').trim(),
    venue: String(body.venue || '').trim(),
    platform: String(body.platform || '').trim(),
    meetingLink: String(body.meetingLink || '').trim(),
    audience: String(body.audience || '').trim(),
    attendanceCount: Math.max(0, Number(body.attendanceCount) || 0),
    durationHours: Math.max(0, Number(body.durationHours) || 0),
    notes: String(body.notes || '').trim(),
    programManagerName: String(body.programManagerName || '').trim() || 'Program Manager',
    programManagerEmail: String(req.userEmail || '').trim().toLowerCase(),
    year: date.getFullYear(),
  });

  res.status(201).json({ success: true, training });
});

export const getTrainingsController = asyncHandler(async (req, res) => {
  const trainings = await TrainingReport.find(buildTrainingFilter(req))
    .sort({ date: -1, createdAt: -1 })
    .lean();

  res.json({
    success: true,
    summary: buildTrainingsSummary(trainings),
    trainings,
  });
});

export const updateTrainingController = asyncHandler(async (req, res) => {
  const training = await TrainingReport.findById(req.params.id);
  if (!training) {
    throw new AppError('Training report not found.', 404);
  }

  const isOwner = String(training.programManagerEmail || '').trim().toLowerCase() === String(req.userEmail || '').trim().toLowerCase();
  if (!req.isAdmin && !isOwner) {
    throw new AppError('You can only edit your own training reports.', 403);
  }

  const body = req.body || {};
  const allowed = [
    'trainingType',
    'title',
    'date',
    'topic',
    'state',
    'city',
    'schoolName',
    'venue',
    'platform',
    'meetingLink',
    'audience',
    'attendanceCount',
    'durationHours',
    'notes',
  ];

  for (const key of allowed) {
    if (body[key] !== undefined) {
      if (key === 'trainingType') {
        training.trainingType = String(body[key]).trim() === 'Online' ? 'Online' : 'Offline';
      } else if (key === 'attendanceCount') {
        training.attendanceCount = Math.max(0, Number(body[key]) || 0);
      } else if (key === 'durationHours') {
        training.durationHours = Math.max(0, Number(body[key]) || 0);
      } else if (key === 'date') {
        const nextDate = new Date(body[key]);
        if (Number.isNaN(nextDate.getTime())) {
          throw new AppError('A valid training date is required.', 400);
        }
        training.date = nextDate;
        training.year = nextDate.getFullYear();
      } else {
        training[key] = String(body[key] ?? '').trim();
      }
    }
  }

  if (!training.title) {
    throw new AppError('Training title is required.', 400);
  }

  await training.save();
  res.json({ success: true, training });
});

export const deleteTrainingController = asyncHandler(async (req, res) => {
  const training = await TrainingReport.findById(req.params.id);
  if (!training) {
    throw new AppError('Training report not found.', 404);
  }

  const isOwner = String(training.programManagerEmail || '').trim().toLowerCase() === String(req.userEmail || '').trim().toLowerCase();
  if (!req.isAdmin && !isOwner) {
    throw new AppError('You can only delete your own training reports.', 403);
  }

  await training.deleteOne();
  res.json({ success: true, message: 'Training report deleted.' });
});

export const exportTrainingsController = asyncHandler(async (req, res) => {
  const trainings = await TrainingReport.find(buildTrainingFilter(req))
    .sort({ date: -1, createdAt: -1 })
    .lean();

  const rows = [
    ['Type', 'Title', 'Date', 'State', 'City', 'School', 'Venue', 'Platform', 'Topic', 'Audience', 'Attendees', 'Duration (hrs)', 'Notes', 'Program Manager', 'PM Email'],
    ...trainings.map((training) => [
      training.trainingType,
      training.title,
      training.date ? new Date(training.date).toISOString().slice(0, 10) : '',
      training.state || '',
      training.city || '',
      training.schoolName || '',
      training.venue || '',
      training.platform || '',
      training.topic || '',
      training.audience || '',
      training.attendanceCount || 0,
      training.durationHours || 0,
      training.notes || '',
      training.programManagerName || '',
      training.programManagerEmail || '',
    ]),
  ];
  const csv = rows.map((row) => row.map(csvEscape).join(',')).join('\r\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="trainings-export-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(csv);
});
