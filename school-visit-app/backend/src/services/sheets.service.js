import { sheetsClient } from "../config/google.js";
import { env } from "../config/env.js";

const NEW_SCHOOL_HEADERS = [
  "Submitted At",
  "School Name",
  "City",
  "State",
  "Point of Contact",
  "Designation",
  "Contact Number",
  "School Email",
  "Course / Requirement",
  "Purpose of Visit",
  "Visit Date",
  "Submitted By",
  "Submitted By Email",
  "Session Summary",
  "Action Items",
  "Remarks",
  "Report ID",
];

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

function normalizeState(state, fallbackState = "") {
  const value = String(state || "").trim();
  const compact = value.toLowerCase().replace(/\s+/g, "");

  if (!value) return fallbackState;
  if (compact === "tamilnadu") return "Tamil Nadu";
  if (compact === "telangana/ap" || compact === "telanganaandhra" || compact === "telanganaap") return "Telangana/AP";
  if (compact === "karnataka") return "Karnataka";
  if (compact === "kerala") return "Kerala";
  if (compact === "north") return "North";

  return value;
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
  const contactIndex = getIndex("Contact No", "Contact Number");
  const emailIndex = getIndex("Email");
  const courseIndex = getIndex("Course Selected (2026-2027)", "Course Selected", "Course");

  if (schoolIndex === -1) {
    console.warn("Skipping sheet because School Name column not found");
    return [];
  }

  return dataRows
    .filter((row) => String(row[schoolIndex] || "").trim())
    .map((row) => ({
      state:
        stateIndex !== -1
          ? normalizeState(row[stateIndex], fallbackState)
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

function parseCsv(csv) {
  const rows = [];
  let row = [];
  let value = "";
  let inQuotes = false;

  for (let i = 0; i < csv.length; i++) {
    const char = csv[i];
    const next = csv[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      value += '"';
      i++;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(value);
      value = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i++;
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
      continue;
    }

    value += char;
  }

  if (value || row.length) {
    row.push(value);
    rows.push(row);
  }

  return rows;
}

async function fetchSchoolsFromPublicCsv() {
  const url = `https://docs.google.com/spreadsheets/d/${env.spreadsheetId}/export?format=csv&gid=${env.sheetsGid}`;
  const response = await fetch(url);
  const csv = await response.text();

  if (!response.ok || csv.trimStart().startsWith("<")) {
    throw new Error(
      "Google Sheet CSV export failed. Make sure the sheet is accessible to anyone with the link, or fix service account access."
    );
  }

  const rows = parseCsv(csv);
  console.log(`Reading public Google Sheet CSV gid ${env.sheetsGid}, rows: ${rows.length}`);

  return mapRowsToSchools(rows);
}

export async function fetchSchoolsFromSheet() {
  if (env.usePublicSheetsCsv && env.spreadsheetId && env.sheetsGid) {
    try {
      return await fetchSchoolsFromPublicCsv();
    } catch (error) {
      console.warn(`Public Google Sheet CSV fetch failed: ${error.message}`);
    }
  }

  const ranges =
    env.sheetsRanges && env.sheetsRanges.length
      ? env.sheetsRanges
      : [env.sheetsRange];

  let response;
  try {
    response = await sheetsClient.spreadsheets.values.batchGet({
      spreadsheetId: env.spreadsheetId,
      ranges,
    });
  } catch (error) {
    if (String(error.message || "").includes("invalid_grant")) {
      throw new Error(
        "Google Sheets authentication failed. Replace backend/credentials/service-account.json with a valid active service account key, or set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY in backend/.env."
      );
    }

    throw error;
  }

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
    const key = `${school.state}__${school.city}__${school.schoolName}`.toLowerCase();
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

async function ensureNewSchoolsSheet() {
  const spreadsheet = await sheetsClient.spreadsheets.get({
    spreadsheetId: env.spreadsheetId,
    fields: "sheets.properties.title",
  });

  const sheetExists = (spreadsheet.data.sheets || []).some(
    (sheet) => sheet.properties?.title === env.newSchoolsSheetName
  );

  if (!sheetExists) {
    await sheetsClient.spreadsheets.batchUpdate({
      spreadsheetId: env.spreadsheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title: env.newSchoolsSheetName,
              },
            },
          },
        ],
      },
    });
  }

  const headerRange = `'${env.newSchoolsSheetName}'!A1:Q1`;
  const headerResponse = await sheetsClient.spreadsheets.values.get({
    spreadsheetId: env.spreadsheetId,
    range: headerRange,
  });

  if (!headerResponse.data.values?.length) {
    await sheetsClient.spreadsheets.values.update({
      spreadsheetId: env.spreadsheetId,
      range: headerRange,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [NEW_SCHOOL_HEADERS],
      },
    });
  }
}

export async function appendNewSchoolToSheet(report) {
  await ensureNewSchoolsSheet();

  const row = [
    new Date().toLocaleString("en-IN"),
    report.schoolName || "",
    report.city || "",
    report.state || "",
    report.pointOfContact || "",
    report.designation || "",
    report.contactNo || "",
    report.schoolEmail || "",
    report.course || "",
    report.purposeOfVisit || "",
    report.visitDate ? new Date(report.visitDate).toLocaleDateString("en-IN") : "",
    report.programManagerName || "",
    report.programManagerEmail || "",
    report.sessionSummary || "",
    report.actionItems || "",
    report.remarks || "",
    String(report._id || ""),
  ];

  await sheetsClient.spreadsheets.values.append({
    spreadsheetId: env.spreadsheetId,
    range: `'${env.newSchoolsSheetName}'!A:Q`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [row],
    },
  });
}
