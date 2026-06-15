import mongoose from "mongoose";

const VisitPlanSchema = new mongoose.Schema(
  {
    state: { type: String, required: true, index: true },
    schoolName: { type: String, required: true, index: true },
    city: String,
    pointOfContact: String,
    contactNo: String,
    schoolEmail: String,
    course: String,
    programManagerName: { type: String, required: true, index: true },
    programManagerEmail: { type: String, required: true, index: true },
    purposeOfVisit: { type: String, required: true, index: true },
    workMode: {
      type: String,
      enum: ["School Visit", "Work From Home", "Work From Office", "Travel", "Other"],
      default: "School Visit",
    },
    plannedLocation: String,
    workPlanned: { type: String, required: true },
    actualLocation: String,
    actualWorkDone: String,
    plannedDate: { type: Date, required: true, index: true },
    plannedStartTime: String,
    plannedEndTime: String,
    status: {
      type: String,
      enum: ["Draft", "Confirmed", "Completed", "Cancelled"],
      default: "Draft",
      index: true,
    },
    planningNotes: String,
    calendarEventId: String,
    calendarSyncStatus: {
      type: String,
      enum: ["Not Synced", "Pending", "Synced", "Failed"],
      default: "Not Synced",
    },
    calendarSyncError: String,
    plannerSheetStatus: {
      type: String,
      enum: ["Pending", "Saved", "Failed"],
      default: "Pending",
    },
    plannerSheetError: String,
    notificationStatus: {
      type: String,
      enum: ["Not Required", "Pending", "Sent", "Failed"],
      default: "Not Required",
    },
    notificationError: String,
    lastNotifiedAt: Date,
    convertedReportId: { type: mongoose.Schema.Types.ObjectId, ref: "VisitReport", index: true },
    convertedAt: Date,
    year: { type: Number, required: true, index: true },
  },
  { timestamps: true }
);

export const VisitPlan = mongoose.model("VisitPlan", VisitPlanSchema);
