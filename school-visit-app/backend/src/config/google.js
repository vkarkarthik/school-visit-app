import { google } from 'googleapis';

const auth = new google.auth.GoogleAuth({
  keyFile: 'credentials/service-account.json',
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
});

export const sheetsClient = google.sheets({
  version: 'v4',
  auth
});