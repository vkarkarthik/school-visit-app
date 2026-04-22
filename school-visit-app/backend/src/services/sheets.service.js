import { sheetsClient } from "../config/google.js";
import { env } from "../config/env.js";

function normalizeHeader(header) {
  return String(header || "").trim().toLowerCase();
}

function mapRowsToSchools(rows) {
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
}

export async function fetchSchoolsFromSheet() {
  const allSchools = [];

  for (const range of env.sheetsRanges) {
    const response = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: env.spreadsheetId,
      range,
    });

    const rows = response.data.values || [];
    const schools = mapRowsToSchools(rows);
    allSchools.push(...schools);
  }

  const unique = [];
  const seen = new Set();

  for (const school of allSchools) {
    const key = `${school.state}__${school.schoolName}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(school);
    }
  }

  return unique;
}

export async function getSchoolMaster() {
  const schools = await fetchSchoolsFromSheet();
  const states = [...new Set(schools.map((s) => s.state).filter(Boolean))].sort();

  return { states, schools };
}