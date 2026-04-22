import dotenv from "dotenv";
dotenv.config();

export const env = {
  port: Number(process.env.PORT || 5000),
  mongoUri: process.env.MONGODB_URI,
  frontendUrl: process.env.FRONTEND_URL,
  spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
  sheetsRange: process.env.GOOGLE_SHEETS_RANGE || "Telangana/AP!A:Z",
  sheetsRanges: (process.env.GOOGLE_SHEETS_RANGES || process.env.GOOGLE_SHEETS_RANGE || "Telangana/AP!A:Z")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  googleClientEmail: process.env.GOOGLE_CLIENT_EMAIL,
  googlePrivateKey: process.env.GOOGLE_PRIVATE_KEY,
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
  },
  smtp: {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    fromName: process.env.MAIL_FROM_NAME,
    fromEmail: process.env.MAIL_FROM_EMAIL,
    cc: process.env.MAIL_CC || "",
  },
  appBaseUrl: process.env.APP_BASE_URL || "http://localhost:5173",
};