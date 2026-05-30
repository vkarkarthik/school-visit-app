import { existsSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const utilsDir = dirname(fileURLToPath(import.meta.url));
const logoPath = join(utilsDir, "../../assets/superteacher-logo.png");
const logoDataUrl = existsSync(logoPath)
  ? `data:image/png;base64,${readFileSync(logoPath).toString("base64")}`
  : "";

export function buildPdfReportHtml(data) {
  const visitDateText = formatDate(data.visitDate);
  const nextVisitText = data.nextVisitDate
    ? formatDate(data.nextVisitDate)
    : "Will be shared separately";

  const generatedDateText = formatDate(new Date());
  const reportId = buildReportId(data);
  const purposeObjective = getPurposeObjective(data.purposeOfVisit);

  const photosHtml = data.photos?.length
    ? data.photos
        .map(
          (photo, index) => `
            <div class="photo-card">
              <div class="photo-label">Supporting Evidence ${index + 1}</div>
              <div class="photo-frame">
                <img src="${photo.url}" alt="${escapeHtml(photo.originalName)}" />
              </div>
              <div class="photo-caption">${escapeHtml(photo.originalName)}</div>
            </div>
          `
        )
        .join("")
    : `<div class="empty-note">No session photos or supporting evidence were uploaded for this visit.</div>`;

  return `
  <html>
    <head>
      <meta charset="utf-8" />
      <style>
        @page {
          size: A4;
          margin: 22mm 14mm 18mm 14mm;
        }

        body {
          font-family: Arial, sans-serif;
          color: #1f2937;
          font-size: 12.5px;
          line-height: 1.6;
          margin: 0;
          padding: 0;
        }

        .page {
          width: 100%;
        }

        .header {
          border-bottom: 4px solid #c9272d;
          padding-bottom: 14px;
          margin-bottom: 18px;
        }

        .header-top {
          display: table;
          width: 100%;
        }

        .header-left,
        .header-right {
          display: table-cell;
          vertical-align: top;
        }

        .header-right {
          text-align: right;
          width: 220px;
        }

        .logo {
          width: 210px;
          height: auto;
          display: block;
          margin-bottom: 12px;
        }

        .org-name {
          font-size: 12px;
          font-weight: 700;
          color: #2f8a38;
          text-transform: uppercase;
        }

        .report-title {
          font-size: 24px;
          font-weight: 700;
          color: #173723;
          margin-top: 6px;
        }

        .report-subtitle {
          margin-top: 4px;
          color: #6b7280;
          font-size: 13px;
        }

        .meta-box {
          border: 1px solid #dbe4f0;
          background: #f7fbf9;
          border-radius: 8px;
          padding: 10px 12px;
          font-size: 11.5px;
        }

        .meta-box div {
          margin-bottom: 4px;
        }

        .meta-box div:last-child {
          margin-bottom: 0;
        }

        .section {
          margin-top: 18px;
          page-break-inside: avoid;
        }

        .section-title {
          font-size: 14px;
          font-weight: 700;
          color: #12649b;
          margin-bottom: 8px;
          padding-bottom: 4px;
          border-bottom: 1px solid #d7e7df;
        }

        table.info-table {
          width: 100%;
          border-collapse: collapse;
          border: 1px solid #d7e7df;
          font-size: 12.5px;
        }

        .info-table td {
          border: 1px solid #d7e7df;
          padding: 8px 10px;
          vertical-align: top;
        }

        .label-cell {
          width: 28%;
          font-weight: 700;
          background: #ecf8ef;
          color: #173723;
        }

        .content-box {
          border: 1px solid #d7e7df;
          background: #fffef9;
          border-radius: 8px;
          padding: 12px 14px;
          white-space: pre-wrap;
          word-break: break-word;
        }

        .summary-box {
          background: #e7f5ff;
          border-color: #c7e9f8;
        }

        .muted {
          color: #6b7280;
        }

        .photos-wrapper {
          margin-top: 10px;
        }

        .photo-card {
          border: 1px solid #d7e7df;
          border-radius: 10px;
          padding: 12px;
          margin-bottom: 16px;
          page-break-inside: avoid;
          background: #ffffff;
        }

        .photo-label {
          font-size: 12px;
          font-weight: 700;
          color: #12649b;
          margin-bottom: 8px;
        }

        .photo-frame {
          border: 1px solid #d7e7df;
          border-radius: 8px;
          background: #f7fbf9;
          text-align: center;
          padding: 10px;
        }

        .photo-frame img {
          max-width: 100%;
          max-height: 420px;
          width: auto;
          height: auto;
          display: inline-block;
          object-fit: contain;
        }

        .photo-caption {
          margin-top: 8px;
          font-size: 11.5px;
          color: #4b5563;
          text-align: center;
          word-break: break-word;
        }

        .empty-note {
          border: 1px dashed #cbd5e1;
          background: #f8fafc;
          color: #6b7280;
          border-radius: 8px;
          padding: 14px;
        }

        .footer {
          margin-top: 28px;
          padding-top: 10px;
          border-top: 1px solid #d7e7df;
          font-size: 11px;
          color: #6b7280;
        }

        .footer-row {
          display: table;
          width: 100%;
        }

        .footer-left,
        .footer-right {
          display: table-cell;
          vertical-align: top;
        }

        .footer-right {
          text-align: right;
        }

        .small-note {
          margin-top: 6px;
          font-size: 10.5px;
          color: #9ca3af;
        }
      </style>
    </head>

    <body>
      <div class="page">
        <div class="header">
          <div class="header-top">
            <div class="header-left">
              ${logoDataUrl ? `<img class="logo" src="${logoDataUrl}" alt="SuperTeacher" />` : `<div class="org-name">SuperTeacher</div>`}
              <div class="org-name">Creating Creators</div>
              <div class="report-title">School Visit Report</div>
              <div class="report-subtitle">
                ${escapeHtml(data.schoolName)} | ${escapeHtml(data.purposeOfVisit)} | ${escapeHtml(visitDateText)}
              </div>
            </div>
            <div class="header-right">
              <div class="meta-box">
                <div><strong>Report ID:</strong> ${escapeHtml(reportId)}</div>
                <div><strong>Generated On:</strong> ${escapeHtml(generatedDateText)}</div>
                <div><strong>Prepared By:</strong> ${escapeHtml(data.programManagerName || "")}</div>
              </div>
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">1. Visit Information</div>
          <table class="info-table">
            <tr>
              <td class="label-cell">School Name</td>
              <td>${escapeHtml(data.schoolName)}</td>
            </tr>
            <tr>
              <td class="label-cell">School Type</td>
              <td>${data.isNewSchool ? "New / Prospect School" : "Existing School"}</td>
            </tr>
            <tr>
              <td class="label-cell">State</td>
              <td>${escapeHtml(data.state)}</td>
            </tr>
            <tr>
              <td class="label-cell">City</td>
              <td>${escapeHtml(data.city || "-")}</td>
            </tr>
            <tr>
              <td class="label-cell">Point of Contact</td>
              <td>${escapeHtml(data.pointOfContact || "-")}</td>
            </tr>
            <tr>
              <td class="label-cell">Designation</td>
              <td>${escapeHtml(data.designation || "-")}</td>
            </tr>
            <tr>
              <td class="label-cell">Contact Number</td>
              <td>${escapeHtml(data.contactNo || "-")}</td>
            </tr>
            <tr>
              <td class="label-cell">Course / Program</td>
              <td>${escapeHtml(data.course || "-")}</td>
            </tr>
            <tr>
              <td class="label-cell">Program Manager</td>
              <td>${escapeHtml(data.programManagerName)}</td>
            </tr>
            <tr>
              <td class="label-cell">Purpose of Visit</td>
              <td>${escapeHtml(data.purposeOfVisit)}</td>
            </tr>
            <tr>
              <td class="label-cell">Visit Date</td>
              <td>${escapeHtml(visitDateText)}</td>
            </tr>
          </table>
        </div>

        <div class="section">
          <div class="section-title">2. Visit Objective</div>
          <div class="content-box">${escapeHtml(purposeObjective)}</div>
        </div>

        <div class="section">
          <div class="section-title">3. Detailed Session Record</div>
          <div class="content-box summary-box">${escapeHtml(data.sessionSummary || "-")}</div>
        </div>

        <div class="section">
          <div class="section-title">4. Follow-up Plan / Next Steps</div>
          <div class="content-box">${escapeHtml(data.actionItems || "No action items noted.")}</div>
        </div>

        <div class="section">
          <div class="section-title">5. Next Visit / Follow-up Schedule</div>
          <div class="content-box">${escapeHtml(nextVisitText)}</div>
        </div>

        <div class="section">
          <div class="section-title">6. Additional Remarks</div>
          <div class="content-box">${escapeHtml(data.remarks || "No additional remarks.")}</div>
        </div>

        <div class="section">
          <div class="section-title">7. Supporting Photos / Evidence</div>
          <div class="photos-wrapper">
            ${photosHtml}
          </div>
        </div>

        <div class="footer">
          <div class="footer-row">
            <div class="footer-left">
              Generated by SuperTeacher
            </div>
            <div class="footer-right">
              Prepared by ${escapeHtml(data.programManagerName || "-")}
            </div>
          </div>
          <div class="small-note">
            This report is system-generated for internal documentation and school communication purposes.
          </div>
        </div>
      </div>
    </body>
  </html>
  `;
}

function buildReportId(data) {
  const school = String(data.schoolName || "SCHOOL")
    .replace(/[^A-Za-z0-9]/g, "")
    .slice(0, 6)
    .toUpperCase();

  const date = data.visitDate ? new Date(data.visitDate) : new Date();
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");

  return `SVR-${school}-${yyyy}${mm}${dd}`;
}

function getPurposeObjective(purposeValue) {
  const purpose = String(purposeValue || "").trim().toLowerCase();
  const objectives = {
    "new school visit / demo":
      "Understand the school's requirement, present the relevant SuperTeacher solution, capture decision-maker feedback, and define the next sales/program follow-up.",
    "teachers copy":
      "Document the teacher copy/material handover, confirm quantities and recipients, explain usage expectations, and record any pending material or coordination requirements.",
    "induction training":
      "Orient the school team on the selected program/module, platform access, implementation workflow, classroom usage expectations, support process, and immediate readiness requirements.",
    "teachers training":
      "Train teachers on the specific topics/modules covered during the visit, demonstrate classroom usage, address implementation questions, and capture any additional support required.",
    "robotics training":
      "Conduct a robotics-focused session covering the planned concept/activity, record participation and hands-on outcomes, and identify kit, material, or follow-up support needs.",
    "admin related work":
      "Close or review administrative, documentation, approval, payment, material, or operational coordination items connected to the school's implementation.",
  };

  return (
    objectives[purpose] ||
    "Document the purpose, key discussion points, school inputs, outcomes, and agreed follow-up from the visit."
  );
}

function formatDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-IN");
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
