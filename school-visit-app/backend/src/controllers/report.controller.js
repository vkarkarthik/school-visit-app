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
    console.log("Uploading photos...");
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

    console.log("Building email and PDF...");
    const emailSubject = `Visit Report | ${schoolName} | ${purposeOfVisit} | ${new Date(
      visitDate
    ).toLocaleDateString("en-IN")}`;

    const emailHtml = buildReportHtml(payload);
    const pdfHtml = buildPdfReportHtml(payload);
    const pdfBuffer = await generatePdfBuffer(pdfHtml);

    let emailStatus = "Sent";

    try {
      console.log("Sending email...");
      await sendVisitReportEmail({
        to: schoolEmail,
        subject: emailSubject,
        html: emailHtml,
        pdfBuffer,
      });
    } catch (emailError) {
      console.error("Email sending failed:", emailError);
      emailStatus = "Failed";
    }

    console.log("Saving report to MongoDB...");
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
  } catch (error) {
    console.error("Create report failed:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to create report",
      stack: error.stack,
    });
  }
});