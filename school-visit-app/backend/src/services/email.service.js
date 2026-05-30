import nodemailer from "nodemailer";
import { existsSync } from "fs";
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

export async function sendVisitReportEmail({ to, cc, replyTo, subject, html, pdfBuffer }) {
  const ccList = mergeEmailLists(env.smtp.cc, cc);

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
      }),
    });

    const result = await response.json();

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
