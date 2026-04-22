import nodemailer from "nodemailer";
import { env } from "../config/env.js";

export const transporter = nodemailer.createTransport({
  host: env.smtp.host,
  port: Number(env.smtp.port),
  secure: Number(env.smtp.port) === 465,
  auth: {
    user: env.smtp.user,
    pass: env.smtp.pass,
  },
  connectionTimeout: 60000,
  greetingTimeout: 60000,
  socketTimeout: 60000,
});

export async function sendVisitReportEmail({ to, subject, html, pdfBuffer }) {
  const response = await fetch(process.env.GMAIL_SCRIPT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to,
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