import { google } from "googleapis";
import { existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { env } from "./env.js";

const configDir = dirname(fileURLToPath(import.meta.url));
const defaultCredentialsPath = join(configDir, "../../credentials/service-account.json");
const keyFile = env.googleCredentialsPath || defaultCredentialsPath;

function buildGoogleAuthOptions() {
  const scopes = ["https://www.googleapis.com/auth/spreadsheets"];

  if (env.googleClientEmail && env.googlePrivateKey) {
    console.log(`Google Sheets auth: using env credentials for ${env.googleClientEmail}`);

    return {
      credentials: {
        client_email: env.googleClientEmail,
        private_key: env.googlePrivateKey.replace(/\\n/g, "\n"),
      },
      scopes,
    };
  }

  if (existsSync(keyFile)) {
    console.log(`Google Sheets auth: using key file ${keyFile}`);

    return { keyFile, scopes };
  }

  throw new Error(
    "Google Sheets credentials missing. Set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY, or add backend/credentials/service-account.json."
  );
}

const auth = new google.auth.GoogleAuth({
  ...buildGoogleAuthOptions(),
});

export const sheetsClient = google.sheets({
  version: "v4",
  auth,
});
