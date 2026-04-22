import { sheetsClient } from "../config/google.js";
import { env } from "../config/env.js";

function normalizeHeader(header) {
  return String(header || "").trim().toLowerCase();
}

export async function fetchSchoolsFromSheet() {
  try {
    console.log("Spreadsheet ID:", env.spreadsheetId);
    console.log("Sheets Range:", env.sheetsRange);

    const response = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: env.spreadsheetId,
      range: env.sheetsRange,
    });

    const rows = response.data.values || [];
    console.log("Rows fetched:", rows.length);

    if (!rows.length) return [];

    const headers = rows[0].map(normalizeHeader);
    const dataRows = rows.slice(1);

    const getIndex = (...names) => {
      for (const name of names) {
        const index = headers.indexOf(normalizeHeader(name));
        if (index !== -1) return index;
      }
      return -1;
    };

    const schoolIndex = getIndex("School Name");
    const cityIndex = getIndex("City", "City ");
    const stateIndex = getIndex("State");
    const pocIndex = getIndex("Point of Contact");
    const designationIndex = getIndex("Designation");
    const contactIndex = getIndex("Contact No");
    const emailIndex = getIndex("Email");
    const courseIndex = getIndex("Course Selected (2026-2027)");

    return dataRows
      .filter((row) => String(row[schoolIndex] || "").trim())
      .map((row) => ({
        state: String(row[stateIndex] || "").trim(),
        schoolName: String(row[schoolIndex] || "").trim(),
        city: String(row[cityIndex] || "").trim(),
        pointOfContact: String(row[pocIndex] || "").trim(),
        designation: String(row[designationIndex] || "").trim(),
        contactNo: String(row[contactIndex] || "").trim(),
        email: String(row[emailIndex] || "").trim(),
        course: String(row[courseIndex] || "").trim(),
      }));
  } catch (error) {
    console.error("Google Sheets fetch error:", error);
    throw error;
  }
}

export async function getSchoolMaster() {
  const schools = await fetchSchoolsFromSheet();
  const states = [...new Set(schools.map((s) => s.state).filter(Boolean))].sort();
  return { states, schools };
}