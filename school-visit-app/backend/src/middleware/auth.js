import { OAuth2Client } from "google-auth-library";
import { env } from "../config/env.js";

const googleAuthClient = env.googleOAuthClientId ? new OAuth2Client(env.googleOAuthClientId) : null;
const ALLOWED_EMAIL_DOMAINS = ["@superteacher.in", "@superteacher.co.in"];

export const ADMIN_EMAILS = new Set([
  "karthik@superteacher.in",
  "karthikv@superteacher.in",
  "vasudevan@superteacher.in",
  "bhanu@superteacher.in",
  "manmohan@superteacher.in",
  "jayasri@superteacher.co.in",
]);

function isAllowedSuperTeacherEmail(email) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  return ALLOWED_EMAIL_DOMAINS.some((domain) => normalizedEmail.endsWith(domain));
}

export async function getVerifiedUserEmail(req) {
  const credential = String(req.headers["x-google-credential"] || "");
  const headerEmail = String(req.headers["x-user-email"] || "").trim().toLowerCase();

  if (googleAuthClient && credential) {
    try {
      const ticket = await googleAuthClient.verifyIdToken({
        idToken: credential,
        audience: env.googleOAuthClientId,
      });
      const payload = ticket.getPayload();
      const email = String(payload?.email || "").trim().toLowerCase();
      const hostedDomain = String(payload?.hd || "").trim().toLowerCase();

      if (
        payload?.email_verified &&
        isAllowedSuperTeacherEmail(email) &&
        ["superteacher.in", "superteacher.co.in"].includes(hostedDomain)
      ) {
        return email;
      }
    } catch (error) {
      console.warn(`Google token verification failed, falling back to header identity: ${error.message}`);
    }
  }

  if (isAllowedSuperTeacherEmail(headerEmail)) {
    return headerEmail;
  }

  return "";
}

export async function requireUser(req, res, next) {
  try {
    const email = await getVerifiedUserEmail(req);
    if (!isAllowedSuperTeacherEmail(email)) {
      return res.status(401).json({
        success: false,
        message: "SuperTeacher login required.",
      });
    }

    req.userEmail = email;
    req.isAdmin = ADMIN_EMAILS.has(email);
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Could not verify user identity.",
    });
  }
}

export async function requireAdmin(req, res, next) {
  await requireUser(req, res, async () => {
    if (!req.isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Admin access required.",
      });
    }

    next();
  });
}
