import nodemailer from "nodemailer";
import { env } from "../config/env.js";

export const transporter = nodemailer.createTransport({
  host: env.smtp.host,
  port: Number(env.smtp.port),
  secure: false, // 587 = false
  auth: {
    user: env.smtp.user,
    pass: env.smtp.pass,
  },
  connectionTimeout: 30000,
  greetingTimeout: 30000,
  socketTimeout: 30000,
  requireTLS: true,
  tls: {
    rejectUnauthorized: false,
  },
});

export async function sendVisitReportEmail({ to, subject, html, pdfBuffer }) {
  const attachments = pdfBuffer
    ? [
        {
          filename: "school-visit-report.pdf",
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ]
    : [];

  return transporter.sendMail({
    from: `"${env.smtp.fromName}" <${env.smtp.fromEmail}>`,
    to,
    cc: env.smtp.cc || undefined,
    subject,
    html,
    attachments,
  });
}