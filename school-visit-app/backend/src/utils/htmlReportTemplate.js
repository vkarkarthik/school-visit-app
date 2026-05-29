export function buildReportHtml(data) {
  const content = getPurposeEmailContent(data);

  const visitDateText = formatDate(data.visitDate);
  const nextVisitText = data.nextVisitDate
    ? formatDate(data.nextVisitDate)
    : "Will be shared separately based on mutual availability and requirement.";

  const photosText = data.photos?.length
    ? `Session photos have also been documented and included as part of the reporting process.`
    : `Session photos were not attached in this submission.`;

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
          Dear <strong>${escapeHtml(data.pointOfContact || "School Team")}</strong>,
        </p>

        <p>
          ${content.intro(data)}
        </p>

        <p>
          ${content.body1(data)}
        </p>

        <p>
          ${content.body2(data)}
        </p>

        <div style="background:#f7fbf9; border:1px solid #d7e7df; border-radius:12px; padding:0; margin:20px 0; overflow:hidden;">
          <div style="background:#ecf8ef; padding:11px 14px; border-bottom:1px solid #d7e7df;">
            <strong style="color:#173723;">Visit Snapshot</strong>
          </div>
          <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%; border-collapse:collapse; font-size:13.5px;">
            ${buildSnapshotRow("School", data.schoolName)}
            ${buildSnapshotRow("School Type", data.isNewSchool ? "New / Prospect School" : "Existing School")}
            ${buildSnapshotRow("Location", `${data.city || "-"}, ${data.state || "-"}`)}
            ${buildSnapshotRow("Program Manager", data.programManagerName)}
            ${buildSnapshotRow("Purpose of Visit", data.purposeOfVisit)}
            ${buildSnapshotRow("Date of Visit", visitDateText)}
            ${buildSnapshotRow("Next Planned Follow-up", nextVisitText)}
          </table>
        </div>

        <div style="margin:18px 0;">
          <div style="font-weight:700; color:#12649b; margin-bottom:6px;">Brief Session Summary</div>
          <div style="background:#fffef9; border:1px solid #d7e7df; border-radius:10px; padding:12px 14px;">
            ${nl2br(escapeHtml(data.sessionSummary))}
          </div>
        </div>

        <div style="margin:18px 0;">
          <div style="font-weight:700; color:#2f8a38; margin-bottom:6px;">Immediate Follow-up / Next Steps</div>
          <div style="background:#ecf8ef; border:1px solid #cfe9d6; border-radius:10px; padding:12px 14px;">
            ${nl2br(escapeHtml(data.actionItems || content.defaultActionText))}
          </div>
        </div>

        <p>
          ${photosText}
        </p>

        <p>
          For your ready reference and record, a <strong>detailed PDF report</strong> containing the complete visit documentation has been attached along with this email.
        </p>

        <p>
          ${content.closing(data)}
        </p>

        <p style="margin-bottom:0;">
          Regards,<br>
          <strong>${escapeHtml(data.programManagerName)}</strong><br>
          <span style="color:#5e7168;">SuperTeacher</span>
        </p>
      </div>

      <div style="padding:12px 24px; background:#f7fbf9; border-top:1px solid #d7e7df; color:#5e7168; font-size:12px;">
        This is a system-generated visit communication from SuperTeacher.
      </div>
    </div>
  </div>
  `;
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

  if (purpose === "new school visit / demo") {
    return {
      intro: (data) =>
        `This is to share the update regarding the introductory discussion/demo conducted with <strong>${escapeHtml(
          data.schoolName
        )}</strong> on <strong>${escapeHtml(formatDate(data.visitDate))}</strong>.`,

      body1: () =>
        `The visit focused on understanding the school's requirements, current academic and operational priorities, and the possible fitment of SuperTeacher programs. The discussion/demo was intended to give the school team a clear view of the solution, implementation approach, expected outcomes, and support process.`,

      body2: () =>
        `The interaction also helped identify the next decision points, stakeholders to be aligned, and any information needed for the school to evaluate the program further. This visit has been recorded as a new/prospect school engagement for follow-up and internal tracking.`,

      defaultActionText:
        "Please review the discussed solution internally and share your requirements, questions, or preferred next meeting schedule.",

      closing: () =>
        `Thank you for your time and interest. We look forward to continuing the discussion and supporting your school with the next steps.`
    };
  }

  if (purpose === "teachers copy") {
    return {
      intro: (data) =>
        `This is to share the update regarding the school visit conducted at <strong>${escapeHtml(
          data.schoolName
        )}</strong> for the purpose of teacher materials / teacher copy handover and related coordination.`,

      body1: () =>
        `During the visit, the required academic and implementation-related materials were reviewed/shared, and the necessary coordination was carried out with the concerned school stakeholders. The objective of this visit was to ensure smooth access to the required teaching resources and to support readiness for effective classroom usage.`,

      body2: () =>
        `We also used this opportunity to clarify any immediate queries connected to the materials provided, their intended usage, and the next steps required from the school side for smooth implementation.`,

      defaultActionText:
        "Please review the materials shared and confirm any pending requirements or support needed from our side.",

      closing: () =>
        `We appreciate the support and coordination extended by your school during this process. We remain available for any further clarification or assistance related to the materials shared.`
    };
  }

  if (purpose === "induction training") {
    return {
      intro: (data) =>
        `This is to share the update regarding the induction training conducted at <strong>${escapeHtml(
          data.schoolName
        )}</strong> on <strong>${escapeHtml(formatDate(data.visitDate))}</strong>.`,

      body1: () =>
        `The visit focused on orienting the school team to the program structure, key academic and operational components, available resources, and the overall approach for implementation. The session was designed to build a clear foundational understanding and ensure that the school team is aligned on expectations, usage, and support systems.`,

      body2: () =>
        `The interaction also helped establish the initial roadmap for implementation, clarify early-stage questions, and strengthen readiness for the next phase of engagement. Such induction sessions are important to ensure that the program begins on a strong and well-supported foundation.`,

      defaultActionText:
        "Please review the discussed implementation points internally and keep the relevant team members aligned for the next phase of execution.",

      closing: () =>
        `Thank you for the participation and cooperation extended during the induction session. We look forward to working closely with your team in the upcoming stages of implementation.`
    };
  }

  if (purpose === "teachers training") {
    return {
      intro: (data) =>
        `This is to share the visit update regarding the teachers training session conducted at <strong>${escapeHtml(
          data.schoolName
        )}</strong>.`,

      body1: () =>
        `The session was focused on strengthening teachers’ understanding of the program resources, classroom usage approach, and the practical integration of the tools shared during implementation. The training aimed to build teacher confidence, improve familiarity with the expected workflow, and support effective classroom execution.`,

      body2: () =>
        `In addition to the training delivery, the visit also helped identify areas where further academic or implementation support may be useful. Such teacher-facing sessions are essential in ensuring consistency, quality, and confidence in day-to-day classroom adoption.`,

      defaultActionText:
        "Teachers may continue internal practice/review of the covered tools and methods, and any follow-up support points may be shared for the next visit.",

      closing: () =>
        `We sincerely appreciate the active participation of the teaching staff and the support extended by the school team. We look forward to continuing this collaboration through future capacity-building sessions.`
    };
  }

  if (purpose === "robotics training") {
    return {
      intro: (data) =>
        `This is to share the visit update regarding the robotics training session conducted at <strong>${escapeHtml(
          data.schoolName
        )}</strong>.`,

      body1: () =>
        `The session was designed to provide structured exposure to robotics learning through guided activities, practical engagement, and concept-based interaction. The purpose of the visit was to support understanding, participation, and confidence in the use of robotics-related learning resources and activities.`,

      body2: () =>
        `The training also served as an opportunity to assess readiness, engagement levels, and any additional support that may be required for smoother implementation in future sessions. Hands-on exposure plays an important role in building learner interest and confidence in robotics education.`,

      defaultActionText:
        "Please continue encouraging participation and identify any support needs for the next robotics-focused engagement.",

      closing: () =>
        `Thank you for your cooperation and support during the robotics training. We look forward to building further momentum through upcoming sessions and continued engagement.`
    };
  }

  if (purpose === "admin related work") {
    return {
      intro: (data) =>
        `This is to share the visit update regarding the administrative work carried out during the school visit to <strong>${escapeHtml(
          data.schoolName
        )}</strong>.`,

      body1: () =>
        `The visit focused on completing and reviewing the required administrative coordination, discussing operational matters, and aligning on the relevant documentation or process-related points connected to school implementation. The interaction was intended to ensure smoother coordination and timely completion of necessary formalities.`,

      body2: () =>
        `This visit also helped bring clarity to pending process items, identify the next required actions, and strengthen coordination between the school and our team for ongoing implementation-related needs.`,

      defaultActionText:
        "Please review the discussed administrative points and support closure of the pending items, wherever applicable.",

      closing: () =>
        `We appreciate the coordination and support provided by your team during this visit. Please feel free to reach out in case any additional clarification or follow-up is required.`
    };
  }

  return {
    intro: (data) =>
      `This is to share the visit update regarding the session conducted at <strong>${escapeHtml(
        data.schoolName
      )}</strong>.`,

    body1: () =>
      `The visit was conducted as part of the ongoing implementation and support process. It provided an opportunity to engage with the school team, review progress, and address the relevant requirements connected to the purpose of the visit.`,

    body2: () =>
      `The session also helped identify any next steps, support needs, and areas of continued coordination for smooth implementation going forward.`,

    defaultActionText:
      "Please review the discussed points and share any support requirements for the next phase.",

    closing: () =>
      `Thank you for your support and cooperation. We look forward to continued collaboration with your school.`
  };
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
