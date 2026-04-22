import { transporter } from '../config/mailer.js';
import { env } from '../config/env.js';

export async function sendVisitReportEmail({ to, subject, html, pdfBuffer }) {
  await transporter.sendMail({
    from: `"${env.smtp.fromName}" <${env.smtp.fromEmail}>`,
    to,
    cc: env.smtp.cc || undefined,
    subject,
    html,
    attachments: pdfBuffer
      ? [
          {
            filename: 'school-visit-report.pdf',
            content: pdfBuffer,
            contentType: 'application/pdf'
          }
        ]
      : []
  });
}