import mongoose from 'mongoose';

const PhotoSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    originalName: { type: String, required: true }
  },
  { _id: false }
);

const ActionItemSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    owner: { type: String, default: "Program Manager" },
    dueDate: Date,
    status: {
      type: String,
      enum: ["Pending", "In Progress", "Completed", "Blocked"],
      default: "Pending",
      index: true,
    },
    notes: String,
  },
  { _id: true }
);

const VisitReportSchema = new mongoose.Schema(
  {
    state: { type: String, required: true, index: true },
    schoolName: { type: String, required: true, index: true },
    isNewSchool: { type: Boolean, default: false, index: true },
    city: String,
    pointOfContact: String,
    designation: String,
    contactNo: String,
    schoolEmail: { type: String, required: true },
    course: String,
    programManagerName: { type: String, required: true, index: true },
    programManagerEmail: { type: String, required: true },
    ccEmails: String,
    purposeOfVisit: { type: String, required: true },
    visitDate: { type: Date, required: true, index: true },
    sourcePlanId: { type: mongoose.Schema.Types.ObjectId, ref: "VisitPlan", index: true },
    sessionSummary: { type: String, required: true },
    actionItems: String,
    actionItemsDetailed: [ActionItemSchema],
    nextVisitDate: Date,
    remarks: String,
    reportStatus: {
      type: String,
      enum: ['Draft', 'Sent', 'Needs Correction', 'Archived'],
      default: 'Sent',
      index: true
    },
    newSchoolApprovalStatus: {
      type: String,
      enum: ['Not Required', 'Pending', 'Approved', 'Duplicate', 'Converted'],
      default: 'Not Required',
      index: true
    },
    salesLeadStatus: {
      type: String,
      enum: ['Not Required', 'Pending', 'Contacted', 'Demo Done', 'Proposal Sent', 'Converted', 'Not Interested'],
      default: 'Not Required',
      index: true
    },
    photos: [PhotoSchema],
    pdfUrl: String,
    newSchoolSheetStatus: {
      type: String,
      enum: ['Not Required', 'Saved', 'Failed'],
      default: 'Not Required'
    },
    newSchoolSheetError: String,
    emailSubject: String,
    emailSentAt: Date,
    emailLastError: String,
    resendCount: { type: Number, default: 0 },
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
