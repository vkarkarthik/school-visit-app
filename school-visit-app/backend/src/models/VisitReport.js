import mongoose from 'mongoose';

const PhotoSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    originalName: { type: String, required: true }
  },
  { _id: false }
);

const VisitReportSchema = new mongoose.Schema(
  {
    state: { type: String, required: true, index: true },
    schoolName: { type: String, required: true, index: true },
    city: String,
    pointOfContact: String,
    designation: String,
    contactNo: String,
    schoolEmail: { type: String, required: true },
    course: String,
    programManagerName: { type: String, required: true, index: true },
    purposeOfVisit: { type: String, required: true },
    visitDate: { type: Date, required: true, index: true },
    sessionSummary: { type: String, required: true },
    actionItems: String,
    nextVisitDate: Date,
    remarks: String,
    photos: [PhotoSchema],
    pdfUrl: String,
    emailSubject: String,
    emailStatus: {
      type: String,
      enum: ['Sent', 'Failed'],
      default: 'Sent'
    },
    year: { type: Number, required: true, index: true }
  },
  { timestamps: true }
);

export const VisitReport = mongoose.model('VisitReport', VisitReportSchema);