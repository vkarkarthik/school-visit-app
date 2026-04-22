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
  <div style="font-family: Arial, sans-serif; background:#f4f6f9; padding:24px; color:#222;">
    <div style="max-width:720px; margin:0 auto; background:#ffffff; border:1px solid #e5e7eb; border-radius:12px; overflow:hidden;">
      
      <div style="background:#1f6feb; color:#ffffff; padding:20px 24px;">
        <h2 style="margin:0; font-size:22px;">School Visit Update</h2>
        <p style="margin:8px 0 0; font-size:14px; opacity:0.95;">
          ${escapeHtml(data.schoolName)} | ${escapeHtml(data.purposeOfVisit)} | ${escapeHtml(visitDateText)}
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

        <div style="background:#f9fafb; border:1px solid #e5e7eb; border-radius:10px; padding:16px; margin:18px 0;">
          <p style="margin:0 0 10px;"><strong>Visit Snapshot</strong></p>
          <ul style="margin:0; padding-left:18px;">
            <li><strong>School:</strong> ${escapeHtml(data.schoolName)}</li>
            <li><strong>Location:</strong> ${escapeHtml(data.city || "")}, ${escapeHtml(data.state || "")}</li>
            <li><strong>Program Manager:</strong> ${escapeHtml(data.programManagerName)}</li>
            <li><strong>Purpose of Visit:</strong> ${escapeHtml(data.purposeOfVisit)}</li>
            <li><strong>Date of Visit:</strong> ${escapeHtml(visitDateText)}</li>
            <li><strong>Next Planned Follow-up:</strong> ${escapeHtml(nextVisitText)}</li>
          </ul>
        </div>

        <p>
          <strong>Brief Session Summary:</strong><br>
          ${nl2br(escapeHtml(data.sessionSummary))}
        </p>

        <p>
          <strong>Immediate Follow-up / Next Steps:</strong><br>
          ${nl2br(escapeHtml(data.actionItems || content.defaultActionText))}
        </p>

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
          <span style="color:#555;">Super Teachers</span>
        </p>
      </div>
    </div>
  </div>
  `;
}

function getPurposeEmailContent(data) {
  const purpose = String(data.purposeOfVisit || "").trim().toLowerCase();

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