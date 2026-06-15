export function buildReportHtml(data) {
  const content = getPurposeEmailContent(data);
  const visitDateText = formatDate(data.visitDate);
  const nextVisitText = data.nextVisitDate
    ? formatDate(data.nextVisitDate)
    : "Will be shared separately based on mutual availability and requirement.";
  const greetingName = buildGreetingName(data.pointOfContact);

  const photosText = data.photos?.length
    ? "Session photos have also been documented and included as part of the reporting process."
    : "Session photos were not attached in this submission.";

  return `
  <div style="font-family: Arial, sans-serif; background:#edf7f3; padding:24px; color:#17202a;">
    <div style="max-width:760px; margin:0 auto; background:#ffffff; border:1px solid #d7e7df; border-radius:14px; overflow:hidden;">
      <div style="height:6px; background:#c9272d;"></div>

      <div style="padding:20px 24px 14px; border-bottom:1px solid #d7e7df;">
        <img src="cid:superteacherLogo" alt="SuperTeacher" style="display:block; width:230px; max-width:70%; height:auto; margin-bottom:14px;" />
        <div style="display:inline-block; background:#e7f5ff; color:#12649b; border:1px solid #c7e9f8; border-radius:999px; padding:5px 10px; font-size:12px; font-weight:700;">
          School Visit Update
        </div>
        <h2 style="margin:10px 0 0; font-size:24px; line-height:1.25; color:#173723;">
          ${escapeHtml(data.schoolName)}
        </h2>
        <p style="margin:6px 0 0; font-size:14px; color:#5e7168;">
          ${escapeHtml(data.purposeOfVisit)} &bull; ${escapeHtml(visitDateText)}
        </p>
      </div>

      <div style="padding:24px; font-size:14px; line-height:1.7;">
        <p style="margin-top:0;">
          Dear <strong>${escapeHtml(greetingName)}</strong>,
        </p>

        <p>
          Please find below the visit update recorded for <strong>${escapeHtml(
            data.schoolName
          )}</strong>. This note documents what was covered, the school team's inputs, and the agreed follow-up points.
        </p>

        <div style="background:#f7fbf9; border:1px solid #d7e7df; border-radius:12px; padding:0; margin:20px 0; overflow:hidden;">
          <div style="background:#ecf8ef; padding:11px 14px; border-bottom:1px solid #d7e7df;">
            <strong style="color:#173723;">Visit Snapshot</strong>
          </div>
          <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%; border-collapse:collapse; font-size:13.5px;">
            ${buildSnapshotRow("School", data.schoolName)}
            ${buildSnapshotRow("School Type", data.isNewSchool ? "New / Prospect School" : "Existing School")}
            ${buildSnapshotRow("Location", `${data.city || "-"}, ${data.state || "-"}`)}
            ${buildSnapshotRow("Course / Program", data.course || "-")}
            ${buildSnapshotRow("Program Manager", data.programManagerName)}
            ${buildSnapshotRow("Purpose of Visit", data.purposeOfVisit)}
            ${buildSnapshotRow("Work Mode", data.workMode || "School Visit")}
            ${buildSnapshotRow("Work Location", data.actualLocation || "-")}
            ${buildSnapshotRow("Date of Visit", visitDateText)}
            ${buildSnapshotRow("Next Planned Follow-up", nextVisitText)}
          </table>
        </div>

        <div style="margin:18px 0;">
          <div style="font-weight:700; color:#173723; margin-bottom:6px;">Visit Objective</div>
          <div style="background:#f7fbf9; border:1px solid #d7e7df; border-radius:10px; padding:12px 14px;">
            ${escapeHtml(content.objective)}
          </div>
        </div>

        <div style="margin:18px 0;">
          <div style="font-weight:700; color:#7b4f13; margin-bottom:6px;">Actual Work Done</div>
          <div style="background:#fffaf0; border:1px solid #ecd9b4; border-radius:10px; padding:12px 14px;">
            ${nl2br(escapeHtml(data.actualWorkDone || "-"))}
          </div>
        </div>

        <div style="margin:18px 0;">
          <div style="font-weight:700; color:#12649b; margin-bottom:6px;">Detailed Session Record</div>
          <div style="background:#fffef9; border:1px solid #d7e7df; border-radius:10px; padding:12px 14px;">
            ${nl2br(escapeHtml(data.sessionSummary))}
          </div>
        </div>

        <div style="margin:18px 0;">
          <div style="font-weight:700; color:#2f8a38; margin-bottom:6px;">Follow-up Plan / Next Steps</div>
          <div style="background:#ecf8ef; border:1px solid #cfe9d6; border-radius:10px; padding:12px 14px;">
            ${nl2br(escapeHtml(data.actionItems || content.defaultActionText))}
          </div>
        </div>

        <p>${photosText}</p>

        <p>
          For your ready reference and record, a <strong>detailed PDF report</strong> containing the complete visit documentation has been attached along with this email.
        </p>

        <p>${escapeHtml(content.closing)}</p>

        <p style="margin-bottom:0;">
          Warm regards,<br>
          <strong>${escapeHtml(data.programManagerName)}</strong><br>
          <span style="color:#5e7168;">Super Teachers Edureforms Pvt Ltd</span>
        </p>
      </div>

      <div style="padding:12px 24px; background:#f7fbf9; border-top:1px solid #d7e7df; color:#5e7168; font-size:12px;">
        This is a system-generated visit communication from Super Teachers Edureforms Pvt Ltd.
      </div>
    </div>
  </div>
  `;
}

function buildGreetingName(pointOfContact) {
  const cleaned = String(pointOfContact || "")
    .split("|")[0]
    .replace(/\s*&\s*/g, " / ")
    .trim();

  return cleaned || "School Team";
}

function buildSnapshotRow(label, value) {
  return `
    <tr>
      <td style="width:34%; padding:9px 14px; border-bottom:1px solid #e4eee9; color:#5e7168; font-weight:700;">${escapeHtml(label)}</td>
      <td style="padding:9px 14px; border-bottom:1px solid #e4eee9; color:#17202a;">${escapeHtml(value || "-")}</td>
    </tr>
  `;
}

function getPurposeEmailContent(data) {
  const purpose = String(data.purposeOfVisit || "").trim().toLowerCase();

  const contentByPurpose = {
    "new school visit / demo": {
      objective:
        "Understand the school's requirement, present the relevant SuperTeacher solution, capture decision-maker feedback, and define the next sales/program follow-up.",
      defaultActionText:
        "Please review the discussed solution internally and share your requirements, questions, or preferred next meeting schedule.",
      closing:
        "Thank you for your time and interest. We look forward to continuing the discussion and supporting your school with the next steps.",
    },
    "teachers copy": {
      objective:
        "Document the teacher copy/material handover, confirm quantities and recipients, explain usage expectations, and record any pending material or coordination requirements.",
      defaultActionText:
        "Please review the materials shared and confirm any pending requirements or support needed from our side.",
      closing:
        "We appreciate the support and coordination extended by your school during this process. We remain available for any further clarification or assistance related to the materials shared.",
    },
    "induction training": {
      objective:
        "Orient the school team on the selected program/module, platform access, implementation workflow, classroom usage expectations, support process, and immediate readiness requirements.",
      defaultActionText:
        "Please review the discussed implementation points internally and keep the relevant team members aligned for the next phase of execution.",
      closing:
        "Thank you for the participation and cooperation extended during the induction session. We look forward to working closely with your team in the upcoming stages of implementation.",
    },
    "teachers training": {
      objective:
        "Train teachers on the specific topics/modules covered during the visit, demonstrate classroom usage, address implementation questions, and capture any additional support required.",
      defaultActionText:
        "Teachers may continue internal practice/review of the covered tools and methods, and any follow-up support points may be shared for the next visit.",
      closing:
        "We sincerely appreciate the active participation of the teaching staff and the support extended by the school team. We look forward to continuing this collaboration through future capacity-building sessions.",
    },
    "robotics training": {
      objective:
        "Conduct a robotics-focused session covering the planned concept/activity, record participation and hands-on outcomes, and identify kit, material, or follow-up support needs.",
      defaultActionText:
        "Please continue encouraging participation and identify any support needs for the next robotics-focused engagement.",
      closing:
        "Thank you for your cooperation and support during the robotics training. We look forward to building further momentum through upcoming sessions and continued engagement.",
    },
    "admin related work": {
      objective:
        "Close or review administrative, documentation, approval, payment, material, or operational coordination items connected to the school's implementation.",
      defaultActionText:
        "Please review the discussed administrative points and support closure of the pending items, wherever applicable.",
      closing:
        "We appreciate the coordination and support provided by your team during this visit. Please feel free to reach out in case any additional clarification or follow-up is required.",
    },
  };

  return (
    contentByPurpose[purpose] || {
      objective:
        "Document the purpose, key discussion points, school inputs, outcomes, and agreed follow-up from the visit.",
      defaultActionText:
        "Please review the discussed points and share any support requirements for the next phase.",
      closing:
        "Thank you for your support and cooperation. We look forward to continued collaboration with your school.",
    }
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
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function nl2br(str) {
  return String(str || "").replace(/\n/g, "<br>");
}
