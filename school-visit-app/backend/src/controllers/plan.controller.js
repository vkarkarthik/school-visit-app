import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/appError.js";
import { VisitPlan } from "../models/VisitPlan.js";
import { appendPlanLogToSheet, buildPlannerDashboardSheet } from "../services/sheets.service.js";
import { sendPlanReminderEmail } from "../services/email.service.js";

function validateEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || ""));
}

function normalizeWorkMode(value) {
  return ["School Visit", "Work From Home", "Work From Office", "Travel", "Other"].includes(value)
    ? value
    : "School Visit";
}

function buildListFilter(query, req) {
  const filter = {};

  if (!req.isAdmin) {
    filter.programManagerEmail = req.userEmail;
  } else if (query.programManagerEmail) {
    filter.programManagerEmail = String(query.programManagerEmail).trim().toLowerCase();
  }

  if (query.status) filter.status = query.status;
  if (query.state) filter.state = query.state;
  if (query.schoolName) filter.schoolName = new RegExp(String(query.schoolName).trim(), "i");
  if (query.purposeOfVisit) filter.purposeOfVisit = query.purposeOfVisit;

  if (query.dateFrom || query.dateTo) {
    filter.plannedDate = {};
    if (query.dateFrom) filter.plannedDate.$gte = new Date(query.dateFrom);
    if (query.dateTo) {
      const end = new Date(query.dateTo);
      end.setHours(23, 59, 59, 999);
      filter.plannedDate.$lte = end;
    }
  }

  return filter;
}

async function syncPlanToSheets(plan, action) {
  await appendPlanLogToSheet(plan, action);
  await buildPlannerDashboardSheet();
}

export const createPlanController = asyncHandler(async (req, res) => {
  const {
    state,
    schoolName,
    city,
    pointOfContact,
    contactNo,
    schoolEmail,
    course,
    programManagerName,
    programManagerEmail,
    purposeOfVisit,
    workMode,
    plannedLocation,
    workPlanned,
    plannedDate,
    plannedStartTime,
    plannedEndTime,
    status,
    planningNotes,
  } = req.body;

  const normalizedManagerEmail = req.isAdmin
    ? String(programManagerEmail || "").trim().toLowerCase()
    : req.userEmail;
  const normalizedManagerName = req.isAdmin
    ? String(programManagerName || "").trim()
    : String(programManagerName || currentUserNameFromEmail(req.userEmail)).trim();
  const normalizedWorkMode = normalizeWorkMode(workMode);
  const isSchoolVisit = normalizedWorkMode === "School Visit";
  const normalizedState = isSchoolVisit ? String(state || "").trim() : String(state || "Internal").trim();
  const normalizedSchoolName = isSchoolVisit
    ? String(schoolName || "").trim()
    : String(schoolName || purposeOfVisit || "Internal Work").trim();

  if (!normalizedManagerName || !normalizedManagerEmail || !purposeOfVisit || !workPlanned || !plannedDate) {
    throw new AppError("Missing required planning fields.", 400);
  }

  if (isSchoolVisit && (!normalizedState || !normalizedSchoolName)) {
    throw new AppError("State and school name are required for school visit plans.", 400);
  }

  if (!validateEmail(normalizedManagerEmail)) {
    throw new AppError("Program manager email is not valid.", 400);
  }

  if (schoolEmail && !validateEmail(schoolEmail)) {
    throw new AppError("School email is not valid.", 400);
  }

  const plan = await VisitPlan.create({
    state: normalizedState,
    schoolName: normalizedSchoolName,
    city,
    pointOfContact,
    contactNo,
    schoolEmail,
    course,
    programManagerName: normalizedManagerName,
    programManagerEmail: normalizedManagerEmail,
    purposeOfVisit,
    workMode: normalizedWorkMode,
    plannedLocation,
    workPlanned,
    plannedDate,
    plannedStartTime,
    plannedEndTime,
    status: ["Draft", "Confirmed", "Completed", "Cancelled"].includes(status) ? status : "Draft",
    planningNotes,
    year: new Date(plannedDate).getFullYear(),
    calendarSyncStatus: "Not Synced",
    notificationStatus: "Not Required",
  });

  try {
    await syncPlanToSheets(plan, "Created");
    plan.plannerSheetStatus = "Saved";
    plan.plannerSheetError = "";
  } catch (error) {
    plan.plannerSheetStatus = "Failed";
    plan.plannerSheetError = error.message || "Failed to save planner log";
  }

  await plan.save();

  res.status(201).json({
    success: true,
    message:
      [
        "Plan saved successfully.",
        plan.plannerSheetStatus === "Saved" ? "Planner log updated in Google Sheet." : "Planner log could not be saved.",
      ]
        .filter(Boolean)
        .join(" "),
    plan,
  });
});

function currentUserNameFromEmail(email) {
  return String(email || "")
    .split("@")[0]
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export const listPlansController = asyncHandler(async (req, res) => {
  const filter = buildListFilter(req.query, req);
  const plans = await VisitPlan.find(filter).sort({ plannedDate: 1, createdAt: -1 }).lean();

  res.json({
    success: true,
    plans,
    summary: {
      totalPlans: plans.length,
      draftPlans: plans.filter((plan) => plan.status === "Draft").length,
      confirmedPlans: plans.filter((plan) => plan.status === "Confirmed").length,
      completedPlans: plans.filter((plan) => plan.status === "Completed").length,
      cancelledPlans: plans.filter((plan) => plan.status === "Cancelled").length,
      convertedPlans: plans.filter((plan) => plan.convertedReportId).length,
      remindersDue: plans.filter((plan) => plan.status === "Confirmed").length,
    },
  });
});

export const updatePlanStatusController = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!["Draft", "Confirmed", "Completed", "Cancelled"].includes(status)) {
    throw new AppError("Invalid plan status.", 400);
  }

  const filter = req.isAdmin ? { _id: id } : { _id: id, programManagerEmail: req.userEmail };
  const plan = await VisitPlan.findOne(filter);

  if (!plan) {
    throw new AppError("Plan not found.", 404);
  }

  if (!req.isAdmin && plan.status === "Completed" && status !== "Completed") {
    throw new AppError("Completed plans are locked for PMs. Please contact admin for changes.", 400);
  }

  plan.status = status;
  plan.calendarSyncStatus = "Not Synced";
  plan.calendarEventId = "";
  plan.calendarSyncError = "";
  plan.notificationStatus = "Not Required";
  plan.notificationError = "";

  try {
    await syncPlanToSheets(plan, "Status Updated");
    plan.plannerSheetStatus = "Saved";
    plan.plannerSheetError = "";
  } catch (error) {
    plan.plannerSheetStatus = "Failed";
    plan.plannerSheetError = error.message || "Failed to save planner log";
  }

  await plan.save();

  res.json({
    success: true,
    message:
      [
        "Plan status updated successfully.",
        plan.plannerSheetStatus === "Saved" ? "Planner log updated in Google Sheet." : "Planner log could not be saved.",
      ]
        .filter(Boolean)
        .join(" "),
    plan,
  });
});

export const sendPlanReminderController = asyncHandler(async (req, res) => {
  const filter = req.isAdmin ? { _id: req.params.id } : { _id: req.params.id, programManagerEmail: req.userEmail };
  const plan = await VisitPlan.findOne(filter);

  if (!plan) {
    throw new AppError("Plan not found.", 404);
  }

  await sendPlanReminderEmail(plan.toObject());
  plan.lastNotifiedAt = new Date();
  plan.notificationStatus = "Sent";
  plan.notificationError = "";
  await plan.save();

  res.json({
    success: true,
    message: "Visit reminder sent successfully.",
  });
});

export const buildPlannerDashboardController = asyncHandler(async (req, res) => {
  const result = await buildPlannerDashboardSheet();

  res.json({
    success: true,
    message: "Planner sheet dashboard created successfully.",
    ...result,
  });
});
