import mongoose from 'mongoose';

const TrainingReportSchema = new mongoose.Schema(
  {
    trainingType: {
      type: String,
      enum: ['Offline', 'Online'],
      default: 'Offline',
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    date: { type: Date, required: true, index: true },
    topic: String,
    state: String,
    city: String,
    schoolName: String,
    venue: String,
    platform: String,
    meetingLink: String,
    audience: String,
    attendanceCount: { type: Number, default: 0 },
    durationHours: { type: Number, default: 0 },
    notes: String,
    programManagerName: { type: String, required: true, index: true },
    programManagerEmail: { type: String, required: true, index: true },
    year: { type: Number, required: true, index: true },
  },
  { timestamps: true }
);

export const TrainingReport = mongoose.model('TrainingReport', TrainingReportSchema);
