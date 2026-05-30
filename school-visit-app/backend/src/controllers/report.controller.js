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
import { sendVisitReportEmail } from "../services/email.service.js";
import { appendNewSchoolToSheet } from "../services/sheets.service.js";
import { VisitReport } from "../models/VisitReport.js";
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
    sessionSummary,
    actionItems,
    nextVisitDate,
    remarks,
  } = req.body;
  const isNewSchoolVisit = isNewSchool === true || isNewSchool === "true";

  if (
    !state ||
    !schoolName ||
    !schoolEmail ||
    !programManagerName ||
    !programManagerEmail ||
    !purposeOfVisit ||
    !visitDate ||
    !sessionSummary
  ) {
    throw new AppError("Missing required fields.", 400);
  }

  if (isNewSchoolVisit && (!city || !pointOfContact || !contactNo)) {
    throw new AppError("City, point of contact, and contact number are required for new school visits.", 400);
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(schoolEmail)) {
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
      schoolName,
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

    const payload = {
      isNewSchool: isNewSchoolVisit,
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
      sessionSummary,
      actionItems,
      nextVisitDate: nextVisitDate || undefined,
      remarks,
      photos,
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

    let emailStatus = "Sent";
    let emailSentAt = new Date();
    let emailLastError = "";
    try {
      console.log("STEP 6: Sending email");
      await sendVisitReportEmail({
        to: schoolEmail,
        cc: ccEmails,
        replyTo: programManagerEmail,
        subject: emailSubject,
        html: emailHtml,
        pdfBuffer,
      });
      console.log("STEP 6 DONE: Email sent");
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

    if (isNewSchoolVisit) {
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
        emailStatus === "Sent" ? "Report created and email sent." : "Report created but email failed.",
        emailStatus === "Failed" && emailLastError ? `Email error: ${emailLastError}` : "",
        duplicateReport ? "Possible duplicate visit found for the same school, date, and purpose." : "",
        isNewSchoolVisit
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
  if (schoolName) filter.schoolName = schoolName;
  if (state) filter.state = state;
  if (year) filter.year = Number(year);
  if (emailStatus) filter.emailStatus = emailStatus;
  if (programManagerName) filter.programManagerName = new RegExp(programManagerName, "i");
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

  res.json({
    success: true,
    summary: {
      totalReports: reports.length,
      sentReports: reports.filter((r) => r.emailStatus === "Sent").length,
      failedReports: reports.filter((r) => r.emailStatus === "Failed").length,
      newSchoolReports: reports.filter((r) => r.isNewSchool).length,
      pendingNewSchools: reports.filter((r) => r.newSchoolApprovalStatus === "Pending").length,
    },
    reports,
  });
});

export const getReportsDashboardController = asyncHandler(async (req, res) => {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const year = Number(req.query.year || now.getFullYear());
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year + 1, 0, 1);

  const reports = await VisitReport.find({
    visitDate: { $gte: yearStart, $lt: yearEnd },
  })
    .sort({ createdAt: -1 })
    .lean();

  const managerMap = new Map();
  const purposeMap = new Map();

  for (const report of reports) {
    managerMap.set(report.programManagerName, (managerMap.get(report.programManagerName) || 0) + 1);
    purposeMap.set(report.purposeOfVisit, (purposeMap.get(report.purposeOfVisit) || 0) + 1);
  }

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
    },
    byManager: [...managerMap.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count),
    byPurpose: [...purposeMap.entries()]
      .map(([purpose, count]) => ({ purpose, count }))
      .sort((a, b) => b.count - a.count),
    recentReports: reports.slice(0, 10),
    failedReports: reports.filter((r) => r.emailStatus === "Failed").slice(0, 10),
    pendingNewSchools: reports.filter((r) => r.newSchoolApprovalStatus === "Pending").slice(0, 10),
    upcomingFollowUps: reports
      .filter((r) => r.nextVisitDate && new Date(r.nextVisitDate) >= now)
      .sort((a, b) => new Date(a.nextVisitDate) - new Date(b.nextVisitDate))
      .slice(0, 10),
  });
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

export const getSchoolTimelineController = asyncHandler(async (req, res) => {
  const { schoolName, state } = req.query;
  if (!schoolName) {
    throw new AppError("School name is required.", 400);
  }

  const filter = { schoolName };
  if (state) filter.state = state;

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
    "sessionSummary",
    "actionItems",
    "nextVisitDate",
    "remarks",
    "reportStatus",
    "newSchoolApprovalStatus",
    "salesLeadStatus",
  ];
  const patch = {};

  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(req.body, key)) {
      patch[key] = req.body[key] || undefined;
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

  const payload = report.toObject();
  const emailSubject = report.emailSubject || buildEmailSubject(payload);
  const emailHtml = buildReportHtml(payload);
  const pdfHtml = buildPdfReportHtml(payload);
  const pdfBuffer = await generatePdfBuffer(pdfHtml);
  const pdfUrl = report.pdfUrl || (await savePdfArchive(pdfBuffer, report.schoolName, report.visitDate));

  try {
    await sendVisitReportEmail({
      to: report.schoolEmail,
      cc: report.ccEmails,
      replyTo: report.programManagerEmail,
      subject: emailSubject,
      html: emailHtml,
      pdfBuffer,
    });

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
