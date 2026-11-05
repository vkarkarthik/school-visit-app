import multer from "multer";
import { randomUUID } from "crypto";
import { existsSync } from "fs";
import { mkdir, writeFile } from "fs/promises";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import cloudinary from "../config/cloudinary.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/appError.js";
import { generatePdfBuffer } from "../services/pdf.service.js";
import { buildVisitReportEmailOptions, sendFollowUpReminderEmail, sendVisitReportEmail } from "../services/email.service.js";
import { appendNewSchoolToSheet, appendPlanLogToSheet, getSchoolMaster, isPlannerSheetQuotaError, schedulePlannerDashboardRefresh } from "../services/sheets.service.js";
import { getAdminEmailSet, getAppSettings } from "../services/settings.service.js";
import { VisitReport } from "../models/VisitReport.js";
import { VisitPlan } from "../models/VisitPlan.js";
import { TrainingReport } from "../models/TrainingReport.js";
import { buildReportHtml } from "../utils/htmlReportTemplate.js";
import { buildPdfReportHtml } from "../utils/pdfReportTemplate.js";

const memoryStorage = multer.memoryStorage();
export const upload = multer({ storage: memoryStorage });
const controllerDir = dirname(fileURLToPath(import.meta.url));
const reportArchiveDir = join(controllerDir, "../../generated/reports");

function parseEmailList(value) {
  return String(value || "")
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean);
}function normalizeWorkMode(value) {
  const normalized = String(value || "").trim();
  return normalized || "School Visit";
}

function normalizeManagerKey(email, name) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (normalizedEmail) return normalizedEmail;

  return String(name || "Unknown PM")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function mergeManagerIdentity(entry, name, email) {
  const normalizedName = String(name || "").trim();
  const normalizedEmail = String(email || "").trim().toLowerCase();

  if (normalizedName && (entry.name === "Unknown PM" || normalizedName.length > entry.name.length)) {
    entry.name = normalizedName;
  }

  if (normalizedEmail && !entry.email) {
    entry.email = normalizedEmail;
  }
}

async function syncPlanToSheets(plan, action) {
  await appendPlanLogToSheet(plan, action);
  schedulePlannerDashboardRefresh();
}

function applyPlannerSheetSyncError(plan, error) {
  if (isPlannerSheetQuotaError(error)) {
    plan.plannerSheetStatus = "Pending";
    plan.plannerSheetError = "Saved in app. Google Sheet sync queued because the write quota is temporarily busy.";
    schedulePlannerDashboardRefresh();
    return;
  }

  plan.plannerSheetStatus = "Failed";
  plan.plannerSheetError = error.message || "Failed to update planner sheets";
}

function normalizeActionItemsDetailed(value, fallbackActionItems = "", fallbackOwner = "", fallbackDueDate = "") {
  const list = Array.isArray(value)
    ? value
        .map((item) => ({
          title: String(item?.title || "").trim(),
          owner: String(item?.owner || fallbackOwner || "Program Manager").trim(),
          dueDate: item?.dueDate ? new Date(item.dueDate) : fallbackDueDate ? new Date(fallbackDueDate) : undefined,
          status: ["Pending", "In Progress", "Completed", "Blocked"].includes(item?.status) ? item.status : "Pending",
          notes: String(item?.notes || "").trim(),
        }))
        .filter((item) => item.title)
    : [];

  if (list.length) return list;
  if (!String(fallbackActionItems || "").trim()) return [];

  return [
    {
      title: String(fallbackActionItems).trim(),
      owner: fallbackOwner || "Program Manager",
      dueDate: fallbackDueDate ? new Date(fallbackDueDate) : undefined,
      status: "Pending",
      notes: "",
    },
  ];
}

async function savePdfArchive(pdfBuffer, schoolName, visitDate) {
  if (!pdfBuffer) return "";

  if (!existsSync(reportArchiveDir)) {
    await mkdir(reportArchiveDir, { recursive: true });
  }

  const safeSchool = String(schoolName || "school")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 42);
  const safeDate = new Date(visitDate).toISOString().slice(0, 10);
  const fileName = `${safeDate}-${safeSchool}-${randomUUID().slice(0, 8)}.pdf`;
  await writeFile(join(reportArchiveDir, fileName), pdfBuffer);

  return `/api/reports/pdfs/${fileName}`;
}

function buildEmailSubject(report) {
  return `Visit Report | ${report.schoolName} | ${report.purposeOfVisit} | ${new Date(
    report.visitDate
  ).toLocaleDateString("en-IN")}`;
}

function buildVisitDateBounds(visitDate) {
  const start = new Date(visitDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

async function uploadPhotosToCloudinary(files = []) {
  const uploads = [];

  for (const file of files) {
    const base64 = `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
    const result = await cloudinary.uploader.upload(base64, {
      folder: "school-visit-reports",
    });

    uploads.push({
      url: result.secure_url,
      publicId: result.public_id,
      originalName: file.originalname,
    });
  }

  return uploads;
}

export const createReportController = asyncHandler(async (req, res) => {
  const {
    isNewSchool,
    state,
    schoolName,
    city,
    pointOfContact,
    designation,
    contactNo,
    schoolEmail,
    course,
    programManagerName,
    programManagerEmail,
    ccEmails,
    purposeOfVisit,
    visitDate,
    workMode,
    actualLocation,
    actualWorkDone,
    sessionSummary,
    actionItems,
    actionItemsDetailed,
    nextVisitDate,
    remarks,
    sourcePlanId,
  } = req.body;
  const isNewSchoolVisit = isNewSchool === true || isNewSchool === "true";
  const normalizedWorkMode = normalizeWorkMode(workMode);
  const isSchoolVisitWork = normalizedWorkMode === "School Visit";
  const normalizedState = String(state || (isSchoolVisitWork ? "" : "Internal")).trim();
  const normalizedSchoolName = String(
    schoolName || (isSchoolVisitWork ? "" : actualLocation || purposeOfVisit || "Internal Work")
  ).trim();
  const normalizedSchoolEmail = String(schoolEmail || "").trim();

  if (
    !programManagerName ||
    !programManagerEmail ||
    !purposeOfVisit ||
    !visitDate ||
    !actualWorkDone ||
    !sessionSummary
  ) {
    throw new AppError("Missing required fields.", 400);
  }

  if (isSchoolVisitWork && (!normalizedState || !normalizedSchoolName || !normalizedSchoolEmail)) {
    throw new AppError("State, school name, and school email are required for school visit reports.", 400);
  }

  if (isSchoolVisitWork && isNewSchoolVisit && (!city || !pointOfContact || !contactNo)) {
    throw new AppError("City, point of contact, and contact number are required for new school visits.", 400);
  }

  if (normalizedSchoolEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedSchoolEmail)) {
    throw new AppError("School email is not valid.", 400);
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(programManagerEmail)) {
    throw new AppError("Program manager email is not valid.", 400);
  }

  if (String(sessionSummary).includes("...") || String(actionItems || "").includes("...")) {
    throw new AppError("Please replace all ... placeholders with actual visit details before sending.", 400);
  }

  const invalidCc = parseEmailList(ccEmails).find((email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
  if (invalidCc) {
    throw new AppError(`Invalid CC email: ${invalidCc}`, 400);
  }

  try {
    console.log("STEP 1: Starting report creation");
    const { start, end } = buildVisitDateBounds(visitDate);
    const duplicateReport = await VisitReport.findOne({
      schoolName: normalizedSchoolName,
      purposeOfVisit,
      visitDate: { $gte: start, $lt: end },
      reportStatus: { $ne: "Archived" },
    }).lean();

    let photos = [];
    if (req.files && req.files.length > 0) {
      console.log("STEP 2: Uploading photos to Cloudinary");
      photos = await uploadPhotosToCloudinary(req.files);
      console.log("STEP 2 DONE: Photos uploaded");
    } else {
      console.log("STEP 2 SKIPPED: No photos uploaded");
    }

    const normalizedActionItemsDetailed = normalizeActionItemsDetailed(
      typeof actionItemsDetailed === "string" ? JSON.parse(actionItemsDetailed || "[]") : actionItemsDetailed,
      actionItems,
      programManagerName,
      nextVisitDate
    );

    const payload = {
      isNewSchool: isSchoolVisitWork ? isNewSchoolVisit : false,
      state: normalizedState,
      schoolName: normalizedSchoolName,
      city,
      pointOfContact,
      designation,
      contactNo,
      schoolEmail: normalizedSchoolEmail,
      course,
      programManagerName,
      programManagerEmail,
      ccEmails,
      purposeOfVisit,
      visitDate,
      workMode: normalizedWorkMode,
      actualLocation,
      actualWorkDone,
      sessionSummary,
      actionItems,
      actionItemsDetailed: normalizedActionItemsDetailed,
      nextVisitDate: nextVisitDate || undefined,
      remarks,
      photos,
      sourcePlanId: sourcePlanId || undefined,
      year: new Date(visitDate).getFullYear(),
    };

    console.log("STEP 3: Building email HTML");
    const emailSubject = buildEmailSubject(payload);

    const emailHtml = buildReportHtml(payload);

    console.log("STEP 4: Building PDF HTML");
    const pdfHtml = buildPdfReportHtml(payload);

    console.log("STEP 5: Generating PDF buffer");
    const pdfBuffer = await generatePdfBuffer(pdfHtml);
    console.log("STEP 5 DONE: PDF generated");

    console.log("STEP 5B: Saving PDF archive");
    const pdfUrl = await savePdfArchive(pdfBuffer, schoolName, visitDate);
    console.log("STEP 5B DONE: PDF archive saved");

    let emailStatus = isSchoolVisitWork ? "Sent" : "Not Required";
    let emailSentAt = isSchoolVisitWork ? new Date() : undefined;
    let emailLastError = "";
    try {
      if (!isSchoolVisitWork) {
        console.log("STEP 6 SKIPPED: Internal work log, email not required");
      } else {
      console.log("STEP 6: Sending email");
      await sendVisitReportEmail(buildVisitReportEmailOptions(payload, {
        subject: emailSubject,
        html: emailHtml,
        pdfBuffer,
      }));
      console.log("STEP 6 DONE: Email sent");
      }
    } catch (emailError) {
      console.error("STEP 6 FAILED: Email sending failed", emailError);
      emailStatus = "Failed";
      emailSentAt = undefined;
      emailLastError = emailError.message || "Email sending failed";
    }

    console.log("STEP 7: Saving report in MongoDB");
    const report = await VisitReport.create({
      ...payload,
      pdfUrl,
      emailSubject,
      emailStatus,
      emailSentAt,
      emailLastError,
      newSchoolApprovalStatus: isNewSchoolVisit ? "Pending" : "Not Required",
      salesLeadStatus: isNewSchoolVisit ? "Pending" : "Not Required",
    });
    console.log("STEP 7 DONE: Report saved");

    if (sourcePlanId) {
      const updatedPlan = await VisitPlan.findByIdAndUpdate(sourcePlanId, {        status: "Completed",
        workMode: normalizedWorkMode,
        actualLocation,
        actualWorkDone,
        convertedReportId: report._id,
        convertedAt: new Date(),
      }, { new: true });

      if (updatedPlan) {
        try {
          await syncPlanToSheets(updatedPlan, "Status Updated");
          updatedPlan.plannerSheetStatus = "Saved";
          updatedPlan.plannerSheetError = "";
          await updatedPlan.save();
        } catch (sheetError) {
          applyPlannerSheetSyncError(updatedPlan, sheetError);
          await updatedPlan.save();
        }
      }
    }

    if (isSchoolVisitWork && isNewSchoolVisit) {
      try {
        console.log("STEP 8: Appending new school to Google Sheet");
        await appendNewSchoolToSheet(report);
        report.newSchoolSheetStatus = "Saved";
        report.newSchoolSheetError = "";
        await report.save();
        console.log("STEP 8 DONE: New school appended");
      } catch (sheetError) {
        console.error("STEP 8 FAILED: New school sheet append failed", sheetError);
        report.newSchoolSheetStatus = "Failed";
        report.newSchoolSheetError = sheetError.message || "Failed to append new school";
        await report.save();
      }
    }

    res.status(201).json({
      success: true,
      message: [
        emailStatus === "Sent"
          ? "Report created and email sent."
          : emailStatus === "Not Required"
            ? "Internal work log saved."
            : "Report created but email failed.",
        emailStatus === "Failed" && emailLastError ? `Email error: ${emailLastError}` : "",
        duplicateReport ? "Possible duplicate visit found for the same school, date, and purpose." : "",
        isSchoolVisitWork && isNewSchoolVisit
          ? report.newSchoolSheetStatus === "Saved"
            ? "New school saved to Google Sheet."
            : "New school report saved, but Google Sheet append failed."
          : "",
      ]
        .filter(Boolean)
        .join(" "),
      report,
      duplicateReport,
    });
  } catch (error) {
    console.error("CREATE REPORT FAILED:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to create report",
      stack: error.stack,
    });
  }
});

export const getSchoolTrackingController = asyncHandler(async (req, res) => {
  const {
    schoolName,
    year,
    state,
    emailStatus,
    programManagerName,
    purposeOfVisit,
    isNewSchool,
    newSchoolApprovalStatus,
    salesLeadStatus,
    dateFrom,
    dateTo,
  } = req.query;

  const filter = {};
  if (!req.isAdmin) filter.programManagerEmail = req.userEmail;
  if (schoolName) filter.schoolName = schoolName;
  if (state) filter.state = state;
  if (year) filter.year = Number(year);
  if (emailStatus) filter.emailStatus = emailStatus;
  if (programManagerName && req.isAdmin) filter.programManagerName = new RegExp(programManagerName, "i");
  if (purposeOfVisit) filter.purposeOfVisit = purposeOfVisit;
  if (isNewSchool === "true") filter.isNewSchool = true;
  if (isNewSchool === "false") filter.isNewSchool = false;
  if (newSchoolApprovalStatus) filter.newSchoolApprovalStatus = newSchoolApprovalStatus;
  if (salesLeadStatus) filter.salesLeadStatus = salesLeadStatus;
  if (dateFrom || dateTo) {
    filter.visitDate = {};
    if (dateFrom) filter.visitDate.$gte = new Date(dateFrom);
    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      filter.visitDate.$lte = toDate;
    }
  }

  const reports = await VisitReport.find(filter)
    .sort({ visitDate: -1, createdAt: -1 })
    .lean();

  const now = new Date();
  const uniqueSchools = new Set(reports.map((report) => `${report.state}__${report.schoolName}`)).size;
  const activeManagers = new Set(reports.map((report) => report.programManagerEmail || report.programManagerName)).size;
  const pendingActionItems = reports.flatMap((report) =>
    (report.actionItemsDetailed || [])
      .filter((item) => item.status !== "Completed")
      .map((item) => ({
        reportId: report._id,
        schoolName: report.schoolName,
        programManagerName: report.programManagerName,
        visitDate: report.visitDate,
        ...item,
      }))
  );
  const overdueFollowUps = reports.filter((report) => report.nextVisitDate && new Date(report.nextVisitDate) < now).length;

  res.json({
    success: true,
    summary: {
      totalReports: reports.length,
      sentReports: reports.filter((r) => r.emailStatus === "Sent").length,
      failedReports: reports.filter((r) => r.emailStatus === "Failed").length,
      newSchoolReports: reports.filter((r) => r.isNewSchool).length,
      pendingNewSchools: reports.filter((r) => r.newSchoolApprovalStatus === "Pending").length,
      uniqueSchools,
      activeManagers,
      pendingActionItems: pendingActionItems.length,
      overdueFollowUps,
    },
    pendingActionItems: pendingActionItems.slice(0, 20),
    reports,
  });
});

export const getReportsDashboardController = asyncHandler(async (req, res) => {
  const adminEmailSet = await getAdminEmailSet();
  const appSettings = await getAppSettings();
  const isAdminEmail = (value) => adminEmailSet.has(String(value || "").trim().toLowerCase());
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);
  const nextWeekEnd = new Date(todayStart);
  nextWeekEnd.setDate(nextWeekEnd.getDate() + 7);
  const nextMonthEnd = new Date(todayStart);
  nextMonthEnd.setDate(nextMonthEnd.getDate() + 30);
  const year = Number(req.query.year || now.getFullYear());
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year + 1, 0, 1);

  const [reports, plans, schoolMaster] = await Promise.all([
    VisitReport.find({
      visitDate: { $gte: yearStart, $lt: yearEnd },
    })
      .sort({ createdAt: -1 })
      .lean(),
    VisitPlan.find({
      plannedDate: { $gte: yearStart, $lt: yearEnd },
    })
      .sort({ plannedDate: 1, createdAt: -1 })
      .lean(),
    getSchoolMaster().catch(() => ({ states: [], schools: [] })),
  ]);

  const managerMap = new Map();
  const purposeMap = new Map();
  const planStatusMap = new Map();
  const planManagerMap = new Map();
  const planDateMap = new Map();
  const allManagerMap = new Map();
  const workModeMap = new Map();
  const stateCoverageMap = new Map();

  for (const manager of appSettings?.programManagers || []) {
    const managerEmail = String(manager.email || "").trim().toLowerCase();
    const managerName = String(manager.name || "").trim() || "Unknown PM";
    if (!managerEmail || manager.active === false || isAdminEmail(managerEmail)) continue;

    const managerKey = normalizeManagerKey(managerEmail, managerName);
    if (!allManagerMap.has(managerKey)) {
      allManagerMap.set(managerKey, {
        key: managerKey,
        name: managerName,
        email: managerEmail,
      });
    }

    if (!managerMap.has(managerKey)) {
      managerMap.set(managerKey, {
        key: managerKey,
        name: managerName,
        email: managerEmail,
        count: 0,
        sentReports: 0,
        failedReports: 0,
        uniqueSchools: new Set(),
        pendingActions: 0,
        upcomingFollowUps: 0,
        latestVisitDate: null,
      });
    }

    if (!planManagerMap.has(managerKey)) {
      planManagerMap.set(managerKey, {
        key: managerKey,
        name: managerName,
        email: managerEmail,
        total: 0,
        draft: 0,
        confirmed: 0,
        completed: 0,
        cancelled: 0,
        planned: 0,
        inProgress: 0,
        closed: 0,
        blocked: 0,
        field: 0,
        internal: 0,
        todayPlans: 0,
        todayClosed: 0,
        overdueOpen: 0,
        openPlans: 0,
      });
    }
  }

  for (const school of schoolMaster?.schools || []) {
    const stateName = String(school.state || "").trim();
    if (!stateName) continue;

    if (!stateCoverageMap.has(stateName)) {
      stateCoverageMap.set(stateName, {
        state: stateName,
        totalSchools: 0,
        coveredSchools: new Set(),
        sentReports: 0,
        managerKeys: new Set(),
        schools: new Map(),
      });
    }

    const stateEntry = stateCoverageMap.get(stateName);
    stateEntry.totalSchools += 1;
    const schoolKey = `${stateName}__${String(school.schoolName || "").trim().toLowerCase()}`;
    if (!stateEntry.schools.has(schoolKey)) {
      stateEntry.schools.set(schoolKey, {
        schoolName: String(school.schoolName || "").trim(),
        city: String(school.city || "").trim(),
        totalVisits: 0,
        covered: false,
        sentReports: 0,
        lastVisitDate: null,
        managers: new Set(),
      });
    }
  }

  for (const report of reports) {
    const managerKey = normalizeManagerKey(report.programManagerEmail, report.programManagerName);
    const managerEmail = String(report.programManagerEmail || "").trim().toLowerCase();
    const stateName = String(report.state || "").trim() || "Unknown";

    if (!stateCoverageMap.has(stateName)) {
      stateCoverageMap.set(stateName, {
        state: stateName,
        totalSchools: 0,
        coveredSchools: new Set(),
        sentReports: 0,
        managerKeys: new Set(),
        schools: new Map(),
      });
    }

    const stateCoverageEntry = stateCoverageMap.get(stateName);
    const normalizedSchoolName = String(report.schoolName || "Unknown School").trim();
    stateCoverageEntry.coveredSchools.add(normalizedSchoolName);
    if (report.emailStatus === "Sent") stateCoverageEntry.sentReports += 1;
    if (!isAdminEmail(managerEmail)) {
      stateCoverageEntry.managerKeys.add(managerKey);
    }
    const schoolKey = `${stateName}__${normalizedSchoolName.toLowerCase()}`;
    if (!stateCoverageEntry.schools.has(schoolKey)) {
      stateCoverageEntry.schools.set(schoolKey, {
        schoolName: normalizedSchoolName,
        city: String(report.city || "").trim(),
        totalVisits: 0,
        covered: false,
        sentReports: 0,
        lastVisitDate: null,
        managers: new Set(),
      });
    }
    const schoolEntry = stateCoverageEntry.schools.get(schoolKey);
    schoolEntry.totalVisits += 1;
    schoolEntry.covered = true;
    if (report.emailStatus === "Sent") schoolEntry.sentReports += 1;
    if (report.visitDate && (!schoolEntry.lastVisitDate || new Date(report.visitDate) > new Date(schoolEntry.lastVisitDate))) {
      schoolEntry.lastVisitDate = report.visitDate;
    }
    if (!isAdminEmail(managerEmail) && report.programManagerName) {
      schoolEntry.managers.add(String(report.programManagerName).trim());
    }

    if (!isAdminEmail(managerEmail)) {
      if (!managerMap.has(managerKey)) {
        managerMap.set(managerKey, {
          key: managerKey,
          name: String(report.programManagerName || "Unknown PM").trim() || "Unknown PM",
          email: managerEmail,
          count: 0,
          sentReports: 0,
          failedReports: 0,
          uniqueSchools: new Set(),
          pendingActions: 0,
          upcomingFollowUps: 0,
          latestVisitDate: null,
        });
      }

      const managerEntry = managerMap.get(managerKey);
      mergeManagerIdentity(managerEntry, report.programManagerName, report.programManagerEmail);
      managerEntry.count += 1;
      if (report.emailStatus === "Sent") managerEntry.sentReports += 1;
      if (report.emailStatus === "Failed") managerEntry.failedReports += 1;
      managerEntry.uniqueSchools.add(`${report.state || "Unknown"}__${report.schoolName || "Unknown School"}`);
      managerEntry.pendingActions += (report.actionItemsDetailed || []).filter((item) => item.status !== "Completed").length;
      if (report.nextVisitDate && new Date(report.nextVisitDate) >= now) {
        managerEntry.upcomingFollowUps += 1;
      }
      if (!managerEntry.latestVisitDate || new Date(report.visitDate) > new Date(managerEntry.latestVisitDate)) {
        managerEntry.latestVisitDate = report.visitDate;
      }
    }

    purposeMap.set(report.purposeOfVisit, (purposeMap.get(report.purposeOfVisit) || 0) + 1);
    const rosterManagerKey = normalizeManagerKey(report.programManagerEmail, report.programManagerName);
    if (!allManagerMap.has(rosterManagerKey)) {
      allManagerMap.set(rosterManagerKey, {
        key: rosterManagerKey,
        name: report.programManagerName || "Unknown PM",
        email: report.programManagerEmail || "",
      });
    }
  }

  for (const plan of plans) {
    planStatusMap.set(plan.status, (planStatusMap.get(plan.status) || 0) + 1);
    workModeMap.set(plan.workMode || "School Visit", (workModeMap.get(plan.workMode || "School Visit") || 0) + 1);

    const managerKey = normalizeManagerKey(plan.programManagerEmail, plan.programManagerName);
    if (!allManagerMap.has(managerKey)) {
      allManagerMap.set(managerKey, {
        key: managerKey,
        name: plan.programManagerName || "Unknown PM",
        email: plan.programManagerEmail || "",
      });
    }
    if (!planManagerMap.has(managerKey)) {
      planManagerMap.set(managerKey, {
        key: managerKey,
        name: plan.programManagerName || "Unknown PM",
        email: plan.programManagerEmail || "",
        total: 0,
        draft: 0,
        confirmed: 0,
        completed: 0,
        cancelled: 0,
        planned: 0,
        inProgress: 0,
        closed: 0,
        blocked: 0,
        field: 0,
        internal: 0,
        todayPlans: 0,
        todayClosed: 0,
        overdueOpen: 0,
        openPlans: 0,
      });
    }

    const managerEntry = planManagerMap.get(managerKey);
    managerEntry.total += 1;
    managerEntry[String(plan.status || "").toLowerCase()] += 1;
    if (plan.dailyStatus === "Planned") managerEntry.planned += 1;
    if (plan.dailyStatus === "In Progress") managerEntry.inProgress += 1;
    if (plan.dailyStatus === "Closed") managerEntry.closed += 1;
    if (plan.dailyStatus === "Blocked") managerEntry.blocked += 1;
    if (plan.workMode === "School Visit") managerEntry.field += 1;
    if (plan.workMode !== "School Visit") managerEntry.internal += 1;

    const dateKey = new Date(plan.plannedDate).toISOString().slice(0, 10);
    if (!planDateMap.has(dateKey)) {
      planDateMap.set(dateKey, {
        date: dateKey,
        total: 0,
        confirmed: 0,
        draft: 0,
        completed: 0,
        cancelled: 0,
      });
    }

    const dateEntry = planDateMap.get(dateKey);
    dateEntry.total += 1;
    dateEntry[String(plan.status || "").toLowerCase()] += 1;

    const plannedDate = new Date(plan.plannedDate);
    const isToday = plannedDate >= todayStart && plannedDate < todayEnd;
    const isOpen = ["Draft", "Confirmed"].includes(plan.status) && plan.dailyStatus !== "Closed";
    if (isToday) {
      managerEntry.todayPlans += 1;
      if (plan.dailyStatus === "Closed") managerEntry.todayClosed += 1;
    }
    if (isOpen) managerEntry.openPlans += 1;
    if (isOpen && plannedDate < todayStart) managerEntry.overdueOpen += 1;
  }

  const pendingActionItems = reports.flatMap((report) =>
    (report.actionItemsDetailed || [])
      .filter((item) => item.status !== "Completed")
      .map((item) => ({
        reportId: report._id,
        schoolName: report.schoolName,
        programManagerName: report.programManagerName,
        nextVisitDate: report.nextVisitDate,
        ...item,
      }))
  );

  const todayPlans = plans.filter((plan) => {
    const plannedDate = new Date(plan.plannedDate);
    return plannedDate >= todayStart && plannedDate < todayEnd;
  });

  const overdueOpenPlans = plans.filter((plan) => {
    const plannedDate = new Date(plan.plannedDate);
    return ["Draft", "Confirmed"].includes(plan.status) && plan.dailyStatus !== "Closed" && plannedDate < todayStart;
  });

  const blockedPlans = plans.filter((plan) => plan.dailyStatus === "Blocked");
  const openClosures = todayPlans.filter((plan) => !["Closed"].includes(plan.dailyStatus) && !["Cancelled"].includes(plan.status));
  const pmRoster = [...allManagerMap.values()]
    .filter((manager) => !isAdminEmail(manager.email))
    .sort((a, b) => a.name.localeCompare(b.name));
  const todayManagerKeys = new Set(
    todayPlans
      .filter((plan) => !isAdminEmail(plan.programManagerEmail))
      .map((plan) => plan.programManagerEmail || plan.programManagerName || "Unknown PM")
  );
  const managersWithoutPlanToday = pmRoster.filter((manager) => !todayManagerKeys.has(manager.key));
  const pmDayBoard = [...planManagerMap.values()]
    .filter((entry) => !isAdminEmail(entry.email))
    .map((entry) => ({
      ...entry,
      overloaded: entry.todayPlans >= 3 || entry.openPlans >= 5,
      closurePending: entry.todayPlans > entry.todayClosed,
    }))
    .sort((a, b) => {
      if (b.blocked !== a.blocked) return b.blocked - a.blocked;
      if (b.overdueOpen !== a.overdueOpen) return b.overdueOpen - a.overdueOpen;
      if (b.todayPlans !== a.todayPlans) return b.todayPlans - a.todayPlans;
      return a.name.localeCompare(b.name);
    });

  res.json({
    success: true,
    summary: {
      totalReports: reports.length,
      monthReports: reports.filter((r) => new Date(r.visitDate) >= monthStart).length,
      sentReports: reports.filter((r) => r.emailStatus === "Sent").length,
      failedReports: reports.filter((r) => r.emailStatus === "Failed").length,
      newSchoolReports: reports.filter((r) => r.isNewSchool).length,
      pendingNewSchools: reports.filter((r) => r.newSchoolApprovalStatus === "Pending").length,
      sheetSyncFailed: reports.filter((r) => r.newSchoolSheetStatus === "Failed").length,
      uniqueSchools: new Set(reports.map((r) => `${r.state}__${r.schoolName}`)).size,
      activeManagers: [...allManagerMap.values()].filter((manager) => !isAdminEmail(manager.email)).length,
      plannedVisits: plans.length,
      convertedPlans: plans.filter((plan) => plan.convertedReportId).length,
      pendingActionItems: pendingActionItems.length,
      overdueFollowUps: reports.filter((r) => r.nextVisitDate && new Date(r.nextVisitDate) < now).length,
    },
    byManager: [...managerMap.values()]
      .map((entry) => ({
        key: entry.key,
        name: entry.name,
        email: entry.email,
        count: entry.count,
        sentReports: entry.sentReports,
        failedReports: entry.failedReports,
        uniqueSchools: entry.uniqueSchools.size,
        pendingActions: entry.pendingActions,
        upcomingFollowUps: entry.upcomingFollowUps,
        latestVisitDate: entry.latestVisitDate,
      }))
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.name.localeCompare(b.name);
      }),
    byPurpose: [...purposeMap.entries()]
      .map(([purpose, count]) => ({ purpose, count }))
      .sort((a, b) => b.count - a.count),
    byStateCoverage: [...stateCoverageMap.values()]
      .map((entry) => {
        const coveredSchools = entry.coveredSchools.size;
        const totalSchools = entry.totalSchools;
        const coveragePercent = totalSchools > 0 ? Math.round((coveredSchools / totalSchools) * 100) : 0;

        return {
          state: entry.state,
          totalSchools,
          coveredSchools,
          uncoveredSchools: Math.max(totalSchools - coveredSchools, 0),
          coveragePercent,
          sentReports: entry.sentReports,
          activeManagers: entry.managerKeys.size,
          schools: [...entry.schools.values()]
            .map((school) => ({
              schoolName: school.schoolName,
              city: school.city,
              totalVisits: school.totalVisits,
              covered: school.covered,
              sentReports: school.sentReports,
              lastVisitDate: school.lastVisitDate,
              managers: [...school.managers].sort(),
            }))
            .sort((a, b) => {
              if (Number(b.covered) !== Number(a.covered)) return Number(b.covered) - Number(a.covered);
              if (b.totalVisits !== a.totalVisits) return b.totalVisits - a.totalVisits;
              if (a.lastVisitDate && b.lastVisitDate && new Date(b.lastVisitDate) - new Date(a.lastVisitDate) !== 0) {
                return new Date(b.lastVisitDate) - new Date(a.lastVisitDate);
              }
              return a.schoolName.localeCompare(b.schoolName);
            }),
        };
      })
      .sort((a, b) => {
        if (b.coveredSchools !== a.coveredSchools) return b.coveredSchools - a.coveredSchools;
        if (b.coveragePercent !== a.coveragePercent) return b.coveragePercent - a.coveragePercent;
        return a.state.localeCompare(b.state);
      }),
    recentReports: reports.slice(0, 10),
    failedReports: reports.filter((r) => r.emailStatus === "Failed").slice(0, 10),
    pendingNewSchools: reports.filter((r) => r.newSchoolApprovalStatus === "Pending").slice(0, 10),
    pendingActionItems: pendingActionItems.slice(0, 10),
    upcomingFollowUps: reports
      .filter((r) => r.nextVisitDate && new Date(r.nextVisitDate) >= now)
      .sort((a, b) => new Date(a.nextVisitDate) - new Date(b.nextVisitDate))
      .slice(0, 10),
    upcomingPlans: plans
      .filter((plan) => ["Confirmed", "Draft"].includes(plan.status) && new Date(plan.plannedDate) >= now)
      .slice(0, 10),
    plannerDashboard: {
      statusMix: [...planStatusMap.entries()]
        .map(([status, count]) => ({ status, count }))
        .sort((a, b) => b.count - a.count),
      byManager: [...planManagerMap.values()].sort((a, b) => b.total - a.total),
      byDate: [...planDateMap.values()]
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, 14),
      todayPlans: plans.filter((plan) => {
        const plannedDate = new Date(plan.plannedDate);
        return plannedDate >= todayStart && plannedDate < todayEnd;
      }),
      nextSevenDaysPlans: plans.filter((plan) => {
        const plannedDate = new Date(plan.plannedDate);
        return ["Draft", "Confirmed"].includes(plan.status) && plannedDate >= todayStart && plannedDate < nextWeekEnd;
      }),
      attentionPlans: plans
        .filter((plan) => {
          const plannedDate = new Date(plan.plannedDate);
          const isOpen = ["Draft", "Confirmed"].includes(plan.status);
          const isPastDue = isOpen && plannedDate < todayStart;
          const syncFailed = plan.plannerSheetStatus === "Failed" || plan.notificationStatus === "Failed";
          return isPastDue || syncFailed;
        })
        .sort((a, b) => new Date(a.plannedDate) - new Date(b.plannedDate))
        .slice(0, 12),
    },
    dailyOperations: {
        date: todayStart,
        totals: {
          todayPlans: todayPlans.length,
          pmPlannedToday: new Set(
            todayPlans
              .filter((plan) => !isAdminEmail(plan.programManagerEmail))
              .map((plan) => plan.programManagerEmail || plan.programManagerName)
          ).size,
          pmWithoutPlanToday: managersWithoutPlanToday.length,
        dayClosed: todayPlans.filter((plan) => plan.dailyStatus === "Closed").length,
        blocked: blockedPlans.length,
        overdueOpen: overdueOpenPlans.length,
        fieldWork: todayPlans.filter((plan) => plan.workMode === "School Visit").length,
        internalWork: todayPlans.filter((plan) => plan.workMode !== "School Visit").length,
        closurePending: openClosures.length,
      },
      workModeMix: [...workModeMap.entries()]
        .map(([mode, count]) => ({ mode, count }))
        .sort((a, b) => b.count - a.count),
      managersWithoutPlanToday,
      blockedPlans: blockedPlans
        .sort((a, b) => new Date(a.plannedDate) - new Date(b.plannedDate))
        .slice(0, 10),
      overdueOpenPlans: overdueOpenPlans
        .sort((a, b) => new Date(a.plannedDate) - new Date(b.plannedDate))
        .slice(0, 10),
      pmDayBoard: pmDayBoard.slice(0, 20),
      focusPlans: todayPlans
        .filter((plan) => ["Critical", "High"].includes(plan.priorityLevel || "Normal"))
        .sort((a, b) => {
          const priorityOrder = { Critical: 0, High: 1, Normal: 2 };
          return (priorityOrder[a.priorityLevel || "Normal"] ?? 2) - (priorityOrder[b.priorityLevel || "Normal"] ?? 2);
        })
        .slice(0, 12),
      nextThirtyDaysOpen: plans.filter((plan) => {
        const plannedDate = new Date(plan.plannedDate);
        return ["Draft", "Confirmed"].includes(plan.status) && plannedDate >= todayStart && plannedDate < nextMonthEnd;
      }).length,
    },
  });
});

function buildReportsCsv(reports) {
  const headers = [
    "Visit Date",
    "State",
    "School",
    "School Type",
    "City",
    "Point of Contact",
    "Designation",
    "Contact No",
    "School Email",
    "Course",
    "PM Name",
    "PM Email",
    "CC Emails",
    "Purpose",
    "Work Mode",
    "Actual Location",
    "Actual Work Done",
    "Session Summary",
    "Action Items",
    "Next Visit Date",
    "Remarks",
    "Email Status",
    "Report Status",
    "New School Status",
    "Sales Lead Status",
    "Photos",
    "PDF URL",
    "Created At",
  ];

  const rows = reports.map((report) => [
    report.visitDate ? new Date(report.visitDate).toISOString().slice(0, 10) : "",
    report.state || "",
    report.schoolName || "",
    report.isNewSchool ? "New / Prospect" : "Existing",
    report.city || "",
    report.pointOfContact || "",
    report.designation || "",
    report.contactNo || "",
    report.schoolEmail || "",
    report.course || "",
    report.programManagerName || "",
    report.programManagerEmail || "",
    report.ccEmails || "",
    report.purposeOfVisit || "",
    report.workMode || "",
    report.actualLocation || "",
    report.actualWorkDone || "",
    report.sessionSummary || "",
    report.actionItems || "",
    report.nextVisitDate ? new Date(report.nextVisitDate).toISOString().slice(0, 10) : "",
    report.remarks || "",
    report.emailStatus || "",
    report.reportStatus || "",
    report.newSchoolApprovalStatus || "",
    report.salesLeadStatus || "",
    Array.isArray(report.photos) ? report.photos.length : 0,
    report.pdfUrl || "",
    report.createdAt ? new Date(report.createdAt).toISOString().slice(0, 10) : "",
  ]);

  return `\uFEFF${[headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\r\n")}`;
}

function csvEscape(value) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function buildReportExportFilter(query) {
  const filter = {};

  if (query.state) filter.state = query.state;
  if (query.schoolName) filter.schoolName = query.schoolName;
  if (query.year) filter.year = Number(query.year);
  if (query.emailStatus) filter.emailStatus = query.emailStatus;
  if (query.purposeOfVisit) filter.purposeOfVisit = query.purposeOfVisit;
  if (query.workMode) filter.workMode = query.workMode;
  if (query.newSchoolApprovalStatus) filter.newSchoolApprovalStatus = query.newSchoolApprovalStatus;
  if (query.salesLeadStatus) filter.salesLeadStatus = query.salesLeadStatus;
  if (query.isNewSchool === "true") filter.isNewSchool = true;
  if (query.isNewSchool === "false") filter.isNewSchool = false;
  if (query.programManagerEmail) filter.programManagerEmail = String(query.programManagerEmail).trim().toLowerCase();
  if (query.programManagerName) filter.programManagerName = new RegExp(String(query.programManagerName).trim(), "i");
  if (query.dateFrom || query.dateTo) filter.visitDate = parseDateRange(query);

  return filter;
}

function setCsvDownloadHeaders(res, filename) {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
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

function buildPeriodRange(query, now = new Date()) {
  if (query.month && /^\d{4}-\d{2}$/.test(query.month)) {
    const [year, month] = query.month.split("-").map(Number);
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1);
    return {
      start,
      end,
      label: `${year}-${String(month).padStart(2, "0")}`,
    };
  }

  const year = Number(query.year || now.getFullYear());
  return {
    start: new Date(year, 0, 1),
    end: new Date(year + 1, 0, 1),
    label: String(year),
  };
}

function normalizeManagerKeyForAggregation(email, name) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (normalizedEmail) return normalizedEmail;
  return String(name || "Unknown PM").trim().toLowerCase().replace(/\s+/g, " ");
}
export const exportReportsController = asyncHandler(async (req, res) => {
  const filter = buildReportExportFilter(req.query);
  const reports = await VisitReport.find(filter).sort({ visitDate: -1, createdAt: -1 }).lean();

  setCsvDownloadHeaders(res, `reports-export-${new Date().toISOString().slice(0, 10)}.csv`);
  res.send(buildReportsCsv(reports));
});

export const getProductivityController = asyncHandler(async (req, res) => {
  const appSettings = await getAppSettings();
  const adminEmailSet = await getAdminEmailSet();
  const isAdminEmail = (value) => adminEmailSet.has(String(value || "").trim().toLowerCase());
  const now = new Date();
  const { start, end, label } = buildPeriodRange(req.query, now);
  const overdueNow = now;

  const [reports, plans, trainings] = await Promise.all([
    VisitReport.find({ visitDate: { $gte: start, $lt: end } }).lean(),
    VisitPlan.find({ plannedDate: { $gte: start, $lt: end } }).lean(),
    TrainingReport.find({ date: { $gte: start, $lt: end } }).lean(),
  ]);

  const managerMap = new Map();

  const addManager = (email, name) => {
    const key = normalizeManagerKeyForAggregation(email, name);
    if (!managerMap.has(key)) {
      managerMap.set(key, {
        key,
        name: String(name || "Unknown PM").trim() || "Unknown PM",
        email: String(email || "").trim().toLowerCase(),
        reports: 0,
        sentReports: 0,
        failedReports: 0,
        visits: 0,
        internalReports: 0,
        uniqueSchools: new Set(),
        pendingActions: 0,
        overdueFollowUps: 0,
        plans: 0,
        completedPlans: 0,
        confirmedPlans: 0,
        cancelledPlans: 0,
        convertedPlans: 0,
        dayClosed: 0,
        dayBlocked: 0,
        fieldPlans: 0,
        internalPlans: 0,
        trainings: 0,
        trainingAttendees: 0,
        latestActivityDate: null,
      });
    }
    return managerMap.get(key);
  };

  for (const manager of appSettings?.programManagers || []) {
    const email = String(manager.email || "").trim().toLowerCase();
    const name = String(manager.name || "").trim();
    if (!email || !name || manager.active === false || isAdminEmail(email)) continue;
    addManager(email, name);
  }

  for (const report of reports) {
    const entry = addManager(report.programManagerEmail, report.programManagerName);
    entry.reports += 1;
    if (report.emailStatus === "Sent") entry.sentReports += 1;
    if (report.emailStatus === "Failed") entry.failedReports += 1;
    if (report.workMode === "School Visit") entry.visits += 1;
    if (report.workMode !== "School Visit") entry.internalReports += 1;
    entry.uniqueSchools.add(`${report.state || "Unknown"}__${report.schoolName || "Unknown School"}`);
    entry.pendingActions += (report.actionItemsDetailed || []).filter((item) => item.status !== "Completed").length;
    if (report.nextVisitDate && new Date(report.nextVisitDate) < overdueNow) entry.overdueFollowUps += 1;
    if (!entry.latestActivityDate || new Date(report.visitDate) > new Date(entry.latestActivityDate)) {
      entry.latestActivityDate = report.visitDate;
    }
  }

  for (const plan of plans) {
    const entry = addManager(plan.programManagerEmail, plan.programManagerName);
    entry.plans += 1;
    if (plan.status === "Completed") entry.completedPlans += 1;
    if (plan.status === "Confirmed") entry.confirmedPlans += 1;
    if (plan.status === "Cancelled") entry.cancelledPlans += 1;
    if (plan.convertedReportId) entry.convertedPlans += 1;
    if (plan.dailyStatus === "Closed") entry.dayClosed += 1;
    if (plan.dailyStatus === "Blocked") entry.dayBlocked += 1;
    if (plan.workMode === "School Visit") entry.fieldPlans += 1;
    if (plan.workMode !== "School Visit") entry.internalPlans += 1;
    if (!entry.latestActivityDate || new Date(plan.plannedDate) > new Date(entry.latestActivityDate)) {
      entry.latestActivityDate = plan.plannedDate;
    }
  }

  for (const training of trainings) {
    const entry = addManager(training.programManagerEmail, training.programManagerName);
    entry.trainings += 1;
    entry.trainingAttendees += Number(training.attendanceCount || 0);
    if (!entry.latestActivityDate || new Date(training.date) > new Date(entry.latestActivityDate)) {
      entry.latestActivityDate = training.date;
    }
  }

  const byManager = [...managerMap.values()]
    .map((entry) => ({
      ...entry,
      uniqueSchools: entry.uniqueSchools.size,
    }))
    .sort((a, b) => b.reports + b.plans - (a.reports + a.plans) || b.reports - a.reports || a.name.localeCompare(b.name));

  const totals = byManager.reduce(
    (acc, entry) => ({
      reports: acc.reports + entry.reports,
      sentReports: acc.sentReports + entry.sentReports,
      failedReports: acc.failedReports + entry.failedReports,
      visits: acc.visits + entry.visits,
      internalReports: acc.internalReports + entry.internalReports,
      uniqueSchools: acc.uniqueSchools + entry.uniqueSchools,
      pendingActions: acc.pendingActions + entry.pendingActions,
      overdueFollowUps: acc.overdueFollowUps + entry.overdueFollowUps,
      plans: acc.plans + entry.plans,
      completedPlans: acc.completedPlans + entry.completedPlans,
      confirmedPlans: acc.confirmedPlans + entry.confirmedPlans,
      cancelledPlans: acc.cancelledPlans + entry.cancelledPlans,
      convertedPlans: acc.convertedPlans + entry.convertedPlans,
      dayClosed: acc.dayClosed + entry.dayClosed,
      dayBlocked: acc.dayBlocked + entry.dayBlocked,
      fieldPlans: acc.fieldPlans + entry.fieldPlans,
      internalPlans: acc.internalPlans + entry.internalPlans,
      trainings: acc.trainings + entry.trainings,
      trainingAttendees: acc.trainingAttendees + entry.trainingAttendees,
    }),
    {
      reports: 0,
      sentReports: 0,
      failedReports: 0,
      visits: 0,
      internalReports: 0,
      uniqueSchools: 0,
      pendingActions: 0,
      overdueFollowUps: 0,
      plans: 0,
      completedPlans: 0,
      confirmedPlans: 0,
      cancelledPlans: 0,
      convertedPlans: 0,
      dayClosed: 0,
      dayBlocked: 0,
      fieldPlans: 0,
      internalPlans: 0,
      trainings: 0,
      trainingAttendees: 0,
    }
  );

  res.json({
    success: true,
    range: { from: start, to: end, label },
    byManager,
    totals,
  });
});

export const getCoverageGapsController = asyncHandler(async (req, res) => {
  const months = Math.max(1, Math.min(120, Number(req.query.months || 12) || 12));
  const stateFilter = String(req.query.state || "").trim();
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);

  const schoolMaster = await getSchoolMaster().catch(() => ({ states: [], schools: [] }));
  const masterSchools = Array.isArray(schoolMaster?.schools) ? schoolMaster.schools : [];
  const oldestRelevant = new Date();
  oldestRelevant.setFullYear(oldestRelevant.getFullYear() - 10);

  const reports = await VisitReport.find(
    { visitDate: { $gte: oldestRelevant } },
    { state: 1, schoolName: 1, visitDate: 1, city: 1, _id: 0 }
  ).lean();

  const lastVisitBySchool = new Map();
  for (const report of reports) {
    const key = `${String(report.state || "").trim().toLowerCase()}__${String(report.schoolName || "").trim().toLowerCase()}`;
    if (key.endsWith("__")) continue;
    const entry = lastVisitBySchool.get(key) || { lastVisitDate: null, totalVisits: 0 };
    entry.totalVisits += 1;
    if (report.visitDate && (!entry.lastVisitDate || new Date(report.visitDate) > new Date(entry.lastVisitDate))) {
      entry.lastVisitDate = report.visitDate;
    }
    lastVisitBySchool.set(key, entry);
  }

  const gaps = [];
  const stateCounts = new Map();
  const monthMs = 1000 * 60 * 60 * 24 * 30.44;

  for (const school of masterSchools) {
    const stateName = String(school.state || "").trim();
    const schoolName = String(school.schoolName || "").trim();
    if (!stateName || !schoolName) continue;
    if (stateFilter && stateName.toLowerCase() !== stateFilter.toLowerCase()) continue;

    const key = `${stateName.toLowerCase()}__${schoolName.toLowerCase()}`;
    const visit = lastVisitBySchool.get(key);
    const lastVisitDate = visit?.lastVisitDate || null;
    const isGap = !lastVisitDate || new Date(lastVisitDate) < cutoff;

    if (!isGap) continue;

    const monthsSince = lastVisitDate
      ? Math.max(1, Math.floor((Date.now() - new Date(lastVisitDate).getTime()) / monthMs))
      : null;
    const stateEntry = stateCounts.get(stateName) || { neverVisited: 0, stale: 0 };
    if (!lastVisitDate) stateEntry.neverVisited += 1;
    else stateEntry.stale += 1;
    stateCounts.set(stateName, stateEntry);

    gaps.push({
      state: stateName,
      schoolName,
      city: String(school.city || "").trim(),
      lastVisitDate,
      totalVisits: visit?.totalVisits || 0,
      monthsSinceLastVisit: monthsSince,
      status: lastVisitDate ? "Stale" : "Never Visited",
    });
  }

  gaps.sort((a, b) => {
    if (a.status !== b.status) return a.status === "Never Visited" ? -1 : 1;
    return (b.monthsSinceLastVisit ?? 9999) - (a.monthsSinceLastVisit ?? 9999) || a.schoolName.localeCompare(b.schoolName);
  });

  const byState = [...stateCounts.entries()]
    .map(([state, counts]) => ({ state, ...counts, total: counts.neverVisited + counts.stale }))
    .sort((a, b) => b.total - a.total);

  res.json({
    success: true,
    months,
    cutoffDate: cutoff,
    summary: {
      totalGaps: gaps.length,
      neverVisited: gaps.filter((gap) => gap.status === "Never Visited").length,
      stale: gaps.filter((gap) => gap.status === "Stale").length,
    },
    byState,
    gaps: gaps.slice(0, 1000),
  });
});

async function buildPmCoverage(email, months = 12, stateFilter = '') {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const windowMonths = Math.max(1, Math.min(120, Number(months) || 12));
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - windowMonths);

  const schoolMaster = await getSchoolMaster().catch(() => ({ states: [], schools: [] }));
  const masterSchools = Array.isArray(schoolMaster?.schools) ? schoolMaster.schools : [];
  const oldestRelevant = new Date();
  oldestRelevant.setFullYear(oldestRelevant.getFullYear() - 10);

  const reports = await VisitReport.find(
    { visitDate: { $gte: oldestRelevant }, programManagerEmail: normalizedEmail },
    { state: 1, schoolName: 1, visitDate: 1, city: 1, _id: 0 }
  ).lean();

  const lastVisitBySchool = new Map();
  for (const report of reports) {
    const key = `${String(report.state || '').trim().toLowerCase()}__${String(report.schoolName || '').trim().toLowerCase()}`;
    if (key.endsWith('__')) continue;
    const entry = lastVisitBySchool.get(key) || { lastVisitDate: null, totalVisits: 0 };
    entry.totalVisits += 1;
    if (report.visitDate && (!entry.lastVisitDate || new Date(report.visitDate) > new Date(entry.lastVisitDate))) {
      entry.lastVisitDate = report.visitDate;
    }
    lastVisitBySchool.set(key, entry);
  }

  const covered = [];
  const notCovered = [];
  const stateCounts = new Map();
  const monthMs = 1000 * 60 * 60 * 24 * 30.44;

  for (const school of masterSchools) {
    const stateName = String(school.state || '').trim();
    const schoolName = String(school.schoolName || '').trim();
    if (!stateName || !schoolName) continue;
    if (stateFilter && stateName.toLowerCase() !== stateFilter.toLowerCase()) continue;

    const key = `${stateName.toLowerCase()}__${schoolName.toLowerCase()}`;
    const visit = lastVisitBySchool.get(key);
    const lastVisitDate = visit?.lastVisitDate || null;
    const isCovered = Boolean(lastVisitDate) && new Date(lastVisitDate) >= cutoff;

    const entry = {
      state: stateName,
      schoolName,
      city: String(school.city || '').trim(),
      lastVisitDate,
      totalVisits: visit?.totalVisits || 0,
      monthsSinceLastVisit: lastVisitDate
        ? Math.max(1, Math.floor((Date.now() - new Date(lastVisitDate).getTime()) / monthMs))
        : null,
    };

    if (isCovered) {
      covered.push(entry);
      const stateEntry = stateCounts.get(stateName) || { covered: 0, notCovered: 0 };
      stateEntry.covered += 1;
      stateCounts.set(stateName, stateEntry);
    } else {
      notCovered.push({ ...entry, status: lastVisitDate ? 'Stale' : 'Never Visited' });
      const stateEntry = stateCounts.get(stateName) || { covered: 0, notCovered: 0 };
      stateEntry.notCovered += 1;
      stateCounts.set(stateName, stateEntry);
    }
  }

  covered.sort((a, b) => a.schoolName.localeCompare(b.schoolName));
  notCovered.sort((a, b) => {
    if (a.status !== b.status) return a.status === 'Never Visited' ? -1 : 1;
    return (b.monthsSinceLastVisit ?? 9999) - (a.monthsSinceLastVisit ?? 9999) || a.schoolName.localeCompare(b.schoolName);
  });

  const totalSchools = covered.length + notCovered.length;

  return {
    months: windowMonths,
    cutoffDate: cutoff,
    summary: {
      totalSchools,
      covered: covered.length,
      notCovered: notCovered.length,
      coveragePercent: totalSchools ? Math.round((covered.length / totalSchools) * 100) : 0,
    },
    byState: [...stateCounts.entries()]
      .map(([state, counts]) => ({ state, ...counts, total: counts.covered + counts.notCovered }))
      .sort((a, b) => b.total - a.total),
    coveredSchools: covered.slice(0, 1000),
    notCoveredSchools: notCovered.slice(0, 1000),
  };
}

export const getMyCoverageController = asyncHandler(async (req, res) => {
  const coverage = await buildPmCoverage(req.userEmail, req.query.months, req.query.state);
  res.json({ success: true, ...coverage });
});

export const getPmCoverageController = asyncHandler(async (req, res) => {
  const pm = String(req.query.pm || '').trim();
  if (!pm) {
    throw new AppError('A program manager email is required.', 400);
  }
  const coverage = await buildPmCoverage(pm, req.query.months, req.query.state);
  res.json({ success: true, ...coverage });
});

export const previewReportPdfController = asyncHandler(async (req, res) => {
  const pdfHtml = buildPdfReportHtml({
    ...req.body,
    isNewSchool: req.body.isNewSchool === true || req.body.isNewSchool === "true",
    photos: [],
  });
  const pdfBuffer = await generatePdfBuffer(pdfHtml);

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", "inline; filename=school-visit-preview.pdf");
  res.send(pdfBuffer);
});

export const getReportPdfController = asyncHandler(async (req, res) => {
  const report = await VisitReport.findById(req.params.id).lean();
  if (!report) {
    throw new AppError("Report not found.", 404);
  }

  const pdfHtml = buildPdfReportHtml({
    ...report,
    isNewSchool: report.isNewSchool === true,
    photos: Array.isArray(report.photos) ? report.photos : [],
  });
  const pdfBuffer = await generatePdfBuffer(pdfHtml);

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `inline; filename="${String(report.schoolName || "school-visit-report").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.pdf"`
  );
  res.send(pdfBuffer);
});

export const getSchoolTimelineController = asyncHandler(async (req, res) => {
  const { schoolName, state } = req.query;
  if (!schoolName) {
    throw new AppError("School name is required.", 400);
  }

  const filter = { schoolName };
  if (state) filter.state = state;
  if (!req.isAdmin) filter.programManagerEmail = req.userEmail;

  const reports = await VisitReport.find(filter)
    .sort({ visitDate: -1, createdAt: -1 })
    .lean();

  res.json({
    success: true,
    schoolName,
    state: state || reports[0]?.state || "",
    reports,
  });
});

export const updateReportController = asyncHandler(async (req, res) => {
  const allowed = [
    "schoolEmail",
    "ccEmails",
    "programManagerName",
    "programManagerEmail",
    "workMode",
    "actualLocation",
    "actualWorkDone",
    "sessionSummary",
    "actionItems",
    "actionItemsDetailed",
    "nextVisitDate",
    "remarks",
    "reportStatus",
    "newSchoolApprovalStatus",
    "salesLeadStatus",
  ];
  const patch = {};

  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(req.body, key)) {
      patch[key] =
        key === "actionItemsDetailed"
          ? normalizeActionItemsDetailed(req.body[key], req.body.actionItems, req.body.programManagerName, req.body.nextVisitDate)
          : req.body[key] || undefined;
    }
  }

  const report = await VisitReport.findByIdAndUpdate(req.params.id, patch, {
    new: true,
    runValidators: true,
  });

  if (!report) {
    throw new AppError("Report not found.", 404);
  }

  res.json({
    success: true,
    message: "Report updated.",
    report,
  });
});

export const resendReportEmailController = asyncHandler(async (req, res) => {
  const report = await VisitReport.findById(req.params.id);
  if (!report) {
    throw new AppError("Report not found.", 404);
  }

  if (report.emailStatus === "Not Required" || report.workMode !== "School Visit") {
    throw new AppError("Email resend is not required for internal work logs.", 400);
  }

  const payload = report.toObject();
  const emailSubject = report.emailSubject || buildEmailSubject(payload);
  const emailHtml = buildReportHtml(payload);
  const pdfHtml = buildPdfReportHtml(payload);
  const pdfBuffer = await generatePdfBuffer(pdfHtml);
  const pdfUrl = report.pdfUrl || (await savePdfArchive(pdfBuffer, report.schoolName, report.visitDate));

  try {
    await sendVisitReportEmail(buildVisitReportEmailOptions(payload, {
      subject: emailSubject,
      html: emailHtml,
      pdfBuffer,
    }));

    report.emailStatus = "Sent";
    report.emailSubject = emailSubject;
    report.pdfUrl = pdfUrl;
    report.emailSentAt = new Date();
    report.emailLastError = "";
    report.resendCount += 1;
    await report.save();

    res.json({
      success: true,
      message: "Report email resent successfully.",
      report,
    });
  } catch (error) {
    report.emailStatus = "Failed";
    report.emailSubject = emailSubject;
    report.pdfUrl = pdfUrl;
    report.emailLastError = error.message || "Failed to resend email.";
    report.resendCount += 1;
    await report.save();
    throw new AppError(error.message || "Failed to resend email.", 500);
  }
});

export const sendFollowUpReminderController = asyncHandler(async (req, res) => {
  const filter = req.isAdmin ? { _id: req.params.id } : { _id: req.params.id, programManagerEmail: req.userEmail };
  const report = await VisitReport.findOne(filter);
  if (!report) {
    throw new AppError("Report not found.", 404);
  }

  await sendFollowUpReminderEmail(report.toObject());

  res.json({
    success: true,
    message: "Follow-up reminder sent successfully.",
  });
});
