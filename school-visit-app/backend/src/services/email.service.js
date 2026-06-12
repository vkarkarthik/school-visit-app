import nodemailer from "nodemailer";
import { existsSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { env } from "../config/env.js";

const serviceDir = dirname(fileURLToPath(import.meta.url));
const logoPath = join(serviceDir, "../../assets/superteacher-logo.png");
const SMTP_TIMEOUT_MS = 12000;

function createTransporter(port = env.smtp.port) {
  return nodemailer.createTransport({
    host: env.smtp.host,
    port: Number(port),
    secure: Number(port) === 465,
    requireTLS: Number(port) === 587,
    auth: {
      user: env.smtp.user,
      pass: env.smtp.pass,
    },
    tls: {
      servername: env.smtp.host,
    },
    connectionTimeout: SMTP_TIMEOUT_MS,
    greetingTimeout: SMTP_TIMEOUT_MS,
    socketTimeout: SMTP_TIMEOUT_MS,
  });
}

function isConnectionError(error) {
  const message = String(error?.message || "").toLowerCase();
  return (
    error?.code === "ETIMEDOUT" ||
    error?.code === "ESOCKET" ||
    error?.code === "ECONNECTION" ||
    message.includes("timeout") ||
    message.includes("connection")
  );
}

async function sendMailWithFallback(mailOptions) {
  const primaryPort = Number(env.smtp.port || 587);
  const attemptedPorts = [primaryPort];

  if (String(env.smtp.host || "").includes("gmail.com")) {
    attemptedPorts.push(primaryPort === 465 ? 587 : 465);
  }

  let lastError;
  for (const port of [...new Set(attemptedPorts)]) {
    try {
      return await createTransporter(port).sendMail(mailOptions);
    } catch (error) {
      lastError = error;
      if (!isConnectionError(error)) {
        throw error;
      }
    }
  }

  throw lastError;
}

function mergeEmailLists(...values) {
  const seen = new Set();

  return values
    .flatMap((value) => String(value || "").split(","))
    .map((email) => email.trim())
    .filter(Boolean)
    .filter((email) => {
      const key = email.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

async function parseAppsScriptResponse(response) {
  const body = await response.text();

  try {
    return JSON.parse(body);
  } catch {
    const preview = body.trim().slice(0, 120);
    if (preview.startsWith("<!DOCTYPE") || preview.startsWith("<html")) {
      throw new Error(
        "Apps Script returned an HTML page instead of JSON. Check that GMAIL_SCRIPT_URL is the Web App /exec URL and access is set to Anyone."
      );
    }

    throw new Error(`Apps Script returned invalid JSON: ${preview || response.statusText}`);
  }
}

export async function sendVisitReportEmail({ to, cc, replyTo, subject, html, pdfBuffer }) {
  const ccList = mergeEmailLists(replyTo, env.smtp.cc, cc);
  const logoBase64 = existsSync(logoPath) ? readFileSync(logoPath).toString("base64") : "";

  if (env.gmailScriptUrl) {
    let gmailScriptUrl;
    try {
      gmailScriptUrl = new URL(env.gmailScriptUrl);
    } catch {
      throw new Error("GMAIL_SCRIPT_URL is not a valid URL. Remove it or replace it with the deployed Apps Script web app URL.");
    }

    const response = await fetch(gmailScriptUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to,
        cc: ccList.join(","),
        replyTo,
        subject,
        html,
        pdfBase64: pdfBuffer ? Buffer.from(pdfBuffer).toString("base64") : null,
        pdfFileName: "school-visit-report.pdf",
        logoBase64,
        logoContentType: "image/png",
        logoContentId: "superteacherLogo",
      }),
    });

    const result = await parseAppsScriptResponse(response);

    if (!result.success) {
      throw new Error(result.error || "Apps Script email sending failed");
    }

    return result;
  }

  if (!env.smtp.host || !env.smtp.user || !env.smtp.pass) {
    throw new Error("Email sending is not configured. Set GMAIL_SCRIPT_URL or SMTP_HOST, SMTP_USER, and SMTP_PASS.");
  }

  const attachments = pdfBuffer
    ? [
        {
          filename: "school-visit-report.pdf",
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ]
    : [];

  if (existsSync(logoPath)) {
    attachments.push({
      filename: "superteacher-logo.png",
      path: logoPath,
      cid: "superteacherLogo",
    });
  }

  return sendMailWithFallback({
    from: {
      name: env.smtp.fromName || "School Visit Reports",
      address: env.smtp.fromEmail || env.smtp.user,
    },
    to,
    cc: ccList.length ? ccList : undefined,
    replyTo: replyTo || undefined,
    subject,
    html,
    attachments,
  });
}

function buildPlanNotificationHtml(plan) {
  const dateLabel = plan.plannedDate ? new Date(plan.plannedDate).toLocaleDateString("en-IN") : "";
  const timeLabel =
    plan.plannedStartTime || plan.plannedEndTime
      ? `${plan.plannedStartTime || "--"} to ${plan.plannedEndTime || "--"}`
      : "Time not specified";

  return `
    <div style="font-family: Arial, sans-serif; color: #17202a; line-height: 1.5;">
      <h2 style="margin-bottom: 8px;">Visit plan confirmed</h2>
      <p style="margin-top: 0;">A school visit plan has been confirmed in the scheduler.</p>
      <table style="border-collapse: collapse; width: 100%; max-width: 720px;">
        <tbody>
          <tr><td style="padding: 8px; border: 1px solid #d7e7df; font-weight: bold;">Program Manager</td><td style="padding: 8px; border: 1px solid #d7e7df;">${plan.programManagerName || ""} (${plan.programManagerEmail || ""})</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #d7e7df; font-weight: bold;">School</td><td style="padding: 8px; border: 1px solid #d7e7df;">${plan.schoolName || ""}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #d7e7df; font-weight: bold;">Location</td><td style="padding: 8px; border: 1px solid #d7e7df;">${plan.city || ""}, ${plan.state || ""}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #d7e7df; font-weight: bold;">Purpose</td><td style="padding: 8px; border: 1px solid #d7e7df;">${plan.purposeOfVisit || ""}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #d7e7df; font-weight: bold;">Planned Date</td><td style="padding: 8px; border: 1px solid #d7e7df;">${dateLabel}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #d7e7df; font-weight: bold;">Planned Time</td><td style="padding: 8px; border: 1px solid #d7e7df;">${timeLabel}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #d7e7df; font-weight: bold;">Work Planned</td><td style="padding: 8px; border: 1px solid #d7e7df;">${plan.workPlanned || ""}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #d7e7df; font-weight: bold;">Point of Contact</td><td style="padding: 8px; border: 1px solid #d7e7df;">${plan.pointOfContact || "-"} ${plan.contactNo ? `| ${plan.contactNo}` : ""}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #d7e7df; font-weight: bold;">Notes</td><td style="padding: 8px; border: 1px solid #d7e7df;">${plan.planningNotes || "-"}</td></tr>
        </tbody>
      </table>
    </div>
  `;
}

export async function sendPlanNotificationEmail(plan) {
  const to = plan.programManagerEmail;
  const cc = env.smtp.cc;
  const subject = `Visit Plan Confirmed | ${plan.schoolName} | ${plan.programManagerName} | ${new Date(plan.plannedDate).toLocaleDateString("en-IN")}`;
  const html = buildPlanNotificationHtml(plan);
  const logoBase64 = existsSync(logoPath) ? readFileSync(logoPath).toString("base64") : "";

  if (env.gmailScriptUrl) {
    let gmailScriptUrl;
    try {
      gmailScriptUrl = new URL(env.gmailScriptUrl);
    } catch {
      throw new Error("GMAIL_SCRIPT_URL is not a valid URL. Remove it or replace it with the deployed Apps Script web app URL.");
    }

    const response = await fetch(gmailScriptUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to,
        cc,
        replyTo: plan.programManagerEmail,
        subject,
        html,
        pdfBase64: null,
        pdfFileName: null,
        logoBase64,
        logoContentType: "image/png",
        logoContentId: "superteacherLogo",
      }),
    });

    const result = await parseAppsScriptResponse(response);

    if (!result.success) {
      throw new Error(result.error || "Apps Script email sending failed");
    }

    return result;
  }

  return sendMailWithFallback({
    from: {
      name: env.smtp.fromName || "School Visit Planner",
      address: env.smtp.fromEmail || env.smtp.user,
    },
    to,
    cc: cc || undefined,
    subject,
    html,
    attachments: existsSync(logoPath)
      ? [
          {
            filename: "superteacher-logo.png",
            path: logoPath,
            cid: "superteacherLogo",
          },
        ]
      : [],
  });
}

async function sendSimpleOperationalEmail({ to, cc, replyTo, subject, html }) {
  const logoBase64 = existsSync(logoPath) ? readFileSync(logoPath).toString("base64") : "";

  if (env.gmailScriptUrl) {
    const response = await fetch(new URL(env.gmailScriptUrl), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to,
        cc,
        replyTo,
        subject,
        html,
        pdfBase64: null,
        pdfFileName: null,
        logoBase64,
        logoContentType: "image/png",
        logoContentId: "superteacherLogo",
      }),
    });

    const result = await parseAppsScriptResponse(response);
    if (!result.success) throw new Error(result.error || "Apps Script email sending failed");
    return result;
  }

  return sendMailWithFallback({
    from: {
      name: env.smtp.fromName || "School Visit Planner",
      address: env.smtp.fromEmail || env.smtp.user,
    },
    to,
    cc: cc || undefined,
    replyTo: replyTo || undefined,
    subject,
    html,
    attachments: existsSync(logoPath)
      ? [
          {
            filename: "superteacher-logo.png",
            path: logoPath,
            cid: "superteacherLogo",
          },
        ]
      : [],
  });
}

export async function sendPlanReminderEmail(plan) {
  const dateLabel = plan.plannedDate ? new Date(plan.plannedDate).toLocaleDateString("en-IN") : "";
  const html = `
    <div style="font-family: Arial, sans-serif; color: #17202a; line-height: 1.6;">
      <h2>Visit reminder</h2>
      <p>This is a reminder for an upcoming school visit plan.</p>
      <p><strong>School:</strong> ${plan.schoolName || ""}</p>
      <p><strong>Date:</strong> ${dateLabel}</p>
      <p><strong>Time:</strong> ${plan.plannedStartTime || "--"} to ${plan.plannedEndTime || "--"}</p>
      <p><strong>Purpose:</strong> ${plan.purposeOfVisit || ""}</p>
      <p><strong>Planned work:</strong> ${plan.workPlanned || ""}</p>
    </div>
  `;

  return sendSimpleOperationalEmail({
    to: plan.programManagerEmail,
    cc: env.smtp.cc,
    replyTo: plan.programManagerEmail,
    subject: `Visit Reminder | ${plan.schoolName} | ${dateLabel}`,
    html,
  });
}

export async function sendFollowUpReminderEmail(report) {
  const nextVisitLabel = report.nextVisitDate ? new Date(report.nextVisitDate).toLocaleDateString("en-IN") : "Not scheduled";
  const html = `
    <div style="font-family: Arial, sans-serif; color: #17202a; line-height: 1.6;">
      <h2>Follow-up reminder</h2>
      <p>A follow-up is due for the report below.</p>
      <p><strong>School:</strong> ${report.schoolName || ""}</p>
      <p><strong>Program Manager:</strong> ${report.programManagerName || ""}</p>
      <p><strong>Next follow-up:</strong> ${nextVisitLabel}</p>
      <p><strong>Action items:</strong> ${report.actionItems || "No action items recorded."}</p>
    </div>
  `;

  return sendSimpleOperationalEmail({
    to: report.programManagerEmail,
    cc: env.smtp.cc,
    replyTo: report.programManagerEmail,
    subject: `Follow-up Reminder | ${report.schoolName} | ${nextVisitLabel}`,
    html,
  });
}
