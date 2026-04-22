import multer from "multer";
import cloudinary from "../config/cloudinary.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/appError.js";
import { generatePdfBuffer } from "../services/pdf.service.js";
import { sendVisitReportEmail } from "../services/email.service.js";
import { VisitReport } from "../models/VisitReport.js";
import { buildReportHtml } from "../utils/htmlReportTemplate.js";
import { buildPdfReportHtml } from "../utils/pdfReportTemplate.js";

const memoryStorage = multer.memoryStorage();
export const upload = multer({ storage: memoryStorage });

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
    state,
    schoolName,
    city,
    pointOfContact,
    designation,
    contactNo,
    schoolEmail,
    course,
    programManagerName,
    purposeOfVisit,
    visitDate,
    sessionSummary,
    actionItems,
    nextVisitDate,
    remarks,
  } = req.body;

  if (
    !state ||
    !schoolName ||
    !schoolEmail ||
    !programManagerName ||
    !purposeOfVisit ||
    !visitDate ||
    !sessionSummary
  ) {
    throw new AppError("Missing required fields.", 400);
  }

  const photos = await uploadPhotosToCloudinary(req.files || []);

  const payload = {
    state,
    schoolName,
    city,
    pointOfContact,
    designation,
    contactNo,
    schoolEmail,
    course,
    programManagerName,
    purposeOfVisit,
    visitDate,
    sessionSummary,
    actionItems,
    nextVisitDate: nextVisitDate || undefined,
    remarks,
    photos,
    year: new Date(visitDate).getFullYear(),
  };

  const emailSubject = `Visit Report | ${schoolName} | ${purposeOfVisit} | ${new Date(
    visitDate
  ).toLocaleDateString("en-IN")}`;

  const emailHtml = buildReportHtml(payload);
  const pdfHtml = buildPdfReportHtml(payload);
  const pdfBuffer = await generatePdfBuffer(pdfHtml);

  let emailStatus = "Sent";

  try {
    await sendVisitReportEmail({
      to: schoolEmail,
      subject: emailSubject,
      html: emailHtml,
      pdfBuffer,
    });
  } catch (error) {
    console.error("Email sending failed:", error);
    emailStatus = "Failed";
  }

  const report = await VisitReport.create({
    ...payload,
    emailSubject,
    emailStatus,
  });

  res.status(201).json({
    success: true,
    message:
      emailStatus === "Sent"
        ? "Report created and email sent."
        : "Report created but email failed.",
    report,
  });
});

export const getSchoolTrackingController = asyncHandler(async (req, res) => {
  const { schoolName, year, state } = req.query;

  const filter = {};
  if (schoolName) filter.schoolName = schoolName;
  if (state) filter.state = state;
  if (year) filter.year = Number(year);

  const reports = await VisitReport.find(filter)
    .sort({ visitDate: -1, createdAt: -1 })
    .lean();

  res.json({
    success: true,
    summary: {
      totalReports: reports.length,
      sentReports: reports.filter((r) => r.emailStatus === "Sent").length,
      failedReports: reports.filter((r) => r.emailStatus === "Failed").length,
    },
    reports,
  });
});