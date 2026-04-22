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
  console.log("SMTP config:", {
    host: env.smtp.host,
    port: env.smtp.port,
    user: env.smtp.user,
    fromEmail: env.smtp.fromEmail,
  });

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