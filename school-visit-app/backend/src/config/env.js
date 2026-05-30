import dotenv from "dotenv";
dotenv.config();

function cleanOptional(value) {
  const cleaned = String(value || "").trim();
  if (!cleaned || cleaned.toLowerCase() === "undefined" || cleaned.toLowerCase() === "null") {
    return undefined;
  }
  return cleaned;
}

const defaultSchoolMasterRanges = [
  "'Telangana/AP'!A:Z",
  "'North'!A:Z",
  "'Karnataka'!A:Z",
  "'Tamil Nadu'!A:Z",
  "'Kerala'!A:Z",
];
const defaultMailCc = "vasudevan@superteacher.in,bhanu@superteacher.in";

export const env = {
  port: Number(process.env.PORT || 5000),
  mongoUri: process.env.MONGODB_URI,
  frontendUrl: process.env.FRONTEND_URL,
  spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
  newSchoolsSheetName: process.env.GOOGLE_NEW_SCHOOLS_SHEET_NAME || "New Schools",
  sheetsGid: process.env.GOOGLE_SHEETS_GID,
  usePublicSheetsCsv: process.env.GOOGLE_SHEETS_PUBLIC_CSV === "true",
  sheetsRange: process.env.GOOGLE_SHEETS_RANGE || defaultSchoolMasterRanges[0],
  sheetsRanges: (process.env.GOOGLE_SHEETS_RANGES || process.env.GOOGLE_SHEETS_RANGE || defaultSchoolMasterRanges.join(","))
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  googleClientEmail: process.env.GOOGLE_CLIENT_EMAIL || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  googlePrivateKey: process.env.GOOGLE_PRIVATE_KEY,
  googleOAuthClientId: process.env.GOOGLE_OAUTH_CLIENT_ID,
  googleCredentialsPath:
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE || process.env.GOOGLE_APPLICATION_CREDENTIALS,
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
  },
  smtp: {
    host: cleanOptional(process.env.SMTP_HOST),
    port: Number(process.env.SMTP_PORT || 587),
    user: cleanOptional(process.env.SMTP_USER),
    pass: cleanOptional(process.env.SMTP_PASS)?.replace(/\s+/g, ""),
    fromName: cleanOptional(process.env.MAIL_FROM_NAME),
    fromEmail: cleanOptional(process.env.MAIL_FROM_EMAIL),
    cc: cleanOptional(process.env.MAIL_CC) || defaultMailCc,
  },
  gmailScriptUrl: cleanOptional(process.env.GMAIL_SCRIPT_URL),
  appBaseUrl: process.env.APP_BASE_URL || "http://localhost:5173",
};
