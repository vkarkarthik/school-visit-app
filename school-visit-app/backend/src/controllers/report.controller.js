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

  try {
    console.log("STEP 1: Starting report creation");

    let photos = [];
    if (req.files && req.files.length > 0) {
      console.log("STEP 2: Uploading photos to Cloudinary");
      photos = await uploadPhotosToCloudinary(req.files);
      console.log("STEP 2 DONE: Photos uploaded");
    } else {
      console.log("STEP 2 SKIPPED: No photos uploaded");
    }

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

    console.log("STEP 3: Building email HTML");
    const emailSubject = `Visit Report | ${schoolName} | ${purposeOfVisit} | ${new Date(
      visitDate
    ).toLocaleDateString("en-IN")}`;

    const emailHtml = buildReportHtml(payload);

    console.log("STEP 4: Building PDF HTML");
    const pdfHtml = buildPdfReportHtml(payload);

    console.log("STEP 5: Generating PDF buffer");
    const pdfBuffer = await generatePdfBuffer(pdfHtml);
    console.log("STEP 5 DONE: PDF generated");

    let emailStatus = "Sent";
    try {
      console.log("STEP 6: Sending email");
      await sendVisitReportEmail({
        to: schoolEmail,
        subject: emailSubject,
        html: emailHtml,
        pdfBuffer,
      });
      console.log("STEP 6 DONE: Email sent");
    } catch (emailError) {
      console.error("STEP 6 FAILED: Email sending failed", emailError);
      emailStatus = "Failed";
    }

    console.log("STEP 7: Saving report in MongoDB");
    const report = await VisitReport.create({
      ...payload,
      emailSubject,
      emailStatus,
    });
    console.log("STEP 7 DONE: Report saved");

    res.status(201).json({
      success: true,
      message:
        emailStatus === "Sent"
          ? "Report created and email sent."
          : "Report created but email failed.",
      report,
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