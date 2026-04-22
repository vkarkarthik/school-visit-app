import { sheetsClient } from "../config/google.js";
import { env } from "../config/env.js";

function normalizeHeader(header) {
  return String(header || "").trim().toLowerCase();
}

function extractSheetName(range) {
  const match = String(range).match(/^'?(.*?)'?!/);
  return match ? match[1] : "";
}

function mapSheetNameToState(sheetName) {
  const name = String(sheetName || "").trim();

  if (name === "Telangana/AP") return "Telangana/AP";
  if (name === "North") return "North";
  if (name === "Karnataka") return "Karnataka";
  if (name === "Tamil Nadu") return "Tamil Nadu";
  if (name === "Kerala") return "Kerala";

  return name;
}

function mapRowsToSchools(rows, fallbackState = "") {
  if (!rows || !rows.length) return [];

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

  if (schoolIndex === -1) {
    console.warn("Skipping sheet because School Name column not found");
    return [];
  }

  return dataRows
    .filter((row) => String(row[schoolIndex] || "").trim())
    .map((row) => ({
      state:
        stateIndex !== -1
          ? String(row[stateIndex] || "").trim() || fallbackState
          : fallbackState,
      schoolName: String(row[schoolIndex] || "").trim(),
      city: cityIndex !== -1 ? String(row[cityIndex] || "").trim() : "",
      pointOfContact: pocIndex !== -1 ? String(row[pocIndex] || "").trim() : "",
      designation: designationIndex !== -1 ? String(row[designationIndex] || "").trim() : "",
      contactNo: contactIndex !== -1 ? String(row[contactIndex] || "").trim() : "",
      email: emailIndex !== -1 ? String(row[emailIndex] || "").trim() : "",
      course: courseIndex !== -1 ? String(row[courseIndex] || "").trim() : "",
    }));
}

export async function fetchSchoolsFromSheet() {
  const ranges =
    env.sheetsRanges && env.sheetsRanges.length
      ? env.sheetsRanges
      : [env.sheetsRange];

  const response = await sheetsClient.spreadsheets.values.batchGet({
    spreadsheetId: env.spreadsheetId,
    ranges,
  });

  const valueRanges = response.data.valueRanges || [];
  const allSchools = [];

  for (let i = 0; i < valueRanges.length; i++) {
    const vr = valueRanges[i];
    const range = vr.range || ranges[i];
    const rows = vr.values || [];
    const sheetName = extractSheetName(range);
    const fallbackState = mapSheetNameToState(sheetName);

    console.log(`Reading range: ${range}, rows: ${rows.length}`);

    const schools = mapRowsToSchools(rows, fallbackState);
    allSchools.push(...schools);
  }

  const seen = new Set();
  const unique = [];

  for (const school of allSchools) {
    const key = `${school.state}__${school.schoolName}`.toLowerCase();
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