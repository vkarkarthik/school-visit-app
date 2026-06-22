import { sheetsClient } from "../config/google.js";
import { env } from "../config/env.js";
import { VisitPlan } from "../models/VisitPlan.js";

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
const PLANNER_LOG_HEADERS = [
  "Logged At",
  "Action",
  "Plan ID",
  "Status",
  "Program Manager",
  "Program Manager Email",
  "School Name",
  "State",
  "City",
  "Purpose of Visit",
  "Work Planned",
  "Planned Date",
  "Start Time",
  "End Time",
  "Point of Contact",
  "Contact Number",
  "School Email",
  "Course / Requirement",
  "Planning Notes",
  "Work Mode",
  "Planned Location",
  "Priority Level",
  "Day Status",
  "Blockers / Dependencies",
  "Actual Location",
  "Actual Work Done",
  "Closure Notes",
];
const LEGACY_PLANNER_DASHBOARD_SHEET = "Dashboard";
const PLANNER_DASHBOARD_SHEET = "Planner Ops Dashboard";
const MANAGEMENT_DASHBOARD_SHEET = "Management Dashboard";
const PLANNER_DASHBOARD_HELPER_SHEET = "_Planner_Dashboard_Data";
const SCHOOL_MASTER_CACHE_TTL_MS = 10 * 60 * 1000;

let schoolMasterCache = {
  data: null,
  fetchedAt: 0,
  pending: null,
};

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

export async function getSchoolMaster({ forceRefresh = false } = {}) {
  const cacheAge = Date.now() - schoolMasterCache.fetchedAt;
  const hasFreshCache =
    !forceRefresh &&
    schoolMasterCache.data &&
    cacheAge < SCHOOL_MASTER_CACHE_TTL_MS;

  if (hasFreshCache) {
    return schoolMasterCache.data;
  }

  if (!forceRefresh && schoolMasterCache.pending) {
    return schoolMasterCache.pending;
  }

  schoolMasterCache.pending = (async () => {
    const schools = await fetchSchoolsFromSheet();
    const states = [...new Set(schools.map((s) => s.state).filter(Boolean))].sort();
    const data = { states, schools };

    schoolMasterCache = {
      data,
      fetchedAt: Date.now(),
      pending: null,
    };

    return data;
  })();

  try {
    return await schoolMasterCache.pending;
  } catch (error) {
    schoolMasterCache.pending = null;

    if (schoolMasterCache.data) {
      console.warn(`School master refresh failed, using cached data: ${error.message}`);
      return schoolMasterCache.data;
    }

    throw error;
  }
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

async function ensureSheetWithHeadersInSpreadsheet(spreadsheetId, sheetName, headers, headerRange) {
  const spreadsheet = await sheetsClient.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties.title",
  });

  const sheetExists = (spreadsheet.data.sheets || []).some(
    (sheet) => sheet.properties?.title === sheetName
  );

  if (!sheetExists) {
    await sheetsClient.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title: sheetName,
              },
            },
          },
        ],
      },
    });
  }

  const headerResponse = await sheetsClient.spreadsheets.values.get({
    spreadsheetId,
    range: headerRange,
  });

  if (!headerResponse.data.values?.length) {
    await sheetsClient.spreadsheets.values.update({
      spreadsheetId,
      range: headerRange,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [headers],
      },
    });
  }
}

async function getSpreadsheetSheets(spreadsheetId) {
  const spreadsheet = await sheetsClient.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties.sheetId,sheets.properties.title,sheets.properties.hidden",
  });

  return spreadsheet.data.sheets || [];
}

async function ensureSheetInSpreadsheet(spreadsheetId, sheetName, hidden = false) {
  const sheets = await getSpreadsheetSheets(spreadsheetId);
  const existing = sheets.find((sheet) => sheet.properties?.title === sheetName);

  if (existing) {
    return existing.properties;
  }

  const response = await sheetsClient.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          addSheet: {
            properties: {
              title: sheetName,
              hidden,
            },
          },
        },
      ],
    },
  });

  return response.data.replies?.[0]?.addSheet?.properties;
}

async function renameSheetIfNeeded(spreadsheetId, oldTitle, newTitle) {
  const sheets = await getSpreadsheetSheets(spreadsheetId);
  const oldSheet = sheets.find((sheet) => sheet.properties?.title === oldTitle);
  const newSheet = sheets.find((sheet) => sheet.properties?.title === newTitle);

  if (!oldSheet || newSheet) {
    return newSheet?.properties || oldSheet?.properties;
  }

  await sheetsClient.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          updateSheetProperties: {
            properties: {
              sheetId: oldSheet.properties.sheetId,
              title: newTitle,
            },
            fields: "title",
          },
        },
      ],
    },
  });

  return {
    ...oldSheet.properties,
    title: newTitle,
  };
}

async function recreateSheetInSpreadsheet(spreadsheetId, sheetName, hidden = false) {
  const sheets = await getSpreadsheetSheets(spreadsheetId);
  const existing = sheets.find((sheet) => sheet.properties?.title === sheetName);

  if (existing?.properties?.sheetId) {
    await sheetsClient.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            deleteSheet: {
              sheetId: existing.properties.sheetId,
            },
          },
        ],
      },
    });
  }

  return ensureSheetInSpreadsheet(spreadsheetId, sheetName, hidden);
}

function buildPlannerAggregateFormula(pmSheetTitles = []) {
  const escapedHeaders = PLANNER_LOG_HEADERS.map((header) => `"${String(header).replace(/"/g, '""')}"`).join(",");

  if (!pmSheetTitles.length) {
    return `={${escapedHeaders}}`;
  }

  const sheetRanges = pmSheetTitles.map((title) => `'${title.replace(/'/g, "''")}'!A2:AA`).join(";");
  return `={${escapedHeaders};QUERY({${sheetRanges}},"select * where Col1 is not null",0)}`;
}

function buildPlannerDateFormula() {
  return `={"Parsed Planned Date";ARRAYFORMULA(IF(L2:L="",,DATE(VALUE(INDEX(SPLIT(L2:L,"/"),,3)),VALUE(INDEX(SPLIT(L2:L,"/"),,2)),VALUE(INDEX(SPLIT(L2:L,"/"),,1)))))}`;
}

function buildDashboardFilteredFormula() {
  return `=IFERROR(FILTER('${PLANNER_DASHBOARD_HELPER_SHEET}'!A2:AB,'${PLANNER_DASHBOARD_HELPER_SHEET}'!A2:A<>"",IF($B$4="All",'${PLANNER_DASHBOARD_HELPER_SHEET}'!A2:A<>"",'${PLANNER_DASHBOARD_HELPER_SHEET}'!D2:D=$B$4),IF($D$4="All",'${PLANNER_DASHBOARD_HELPER_SHEET}'!A2:A<>"",'${PLANNER_DASHBOARD_HELPER_SHEET}'!E2:E=$D$4),IF($F$4="All",'${PLANNER_DASHBOARD_HELPER_SHEET}'!A2:A<>"",'${PLANNER_DASHBOARD_HELPER_SHEET}'!H2:H=$F$4),IF($H$4="Today",'${PLANNER_DASHBOARD_HELPER_SHEET}'!AB2:AB=TODAY(),IF($H$4="Next 7 Days",('${PLANNER_DASHBOARD_HELPER_SHEET}'!AB2:AB>=TODAY())*('${PLANNER_DASHBOARD_HELPER_SHEET}'!AB2:AB<=TODAY()+7),IF($H$4="Next 30 Days",('${PLANNER_DASHBOARD_HELPER_SHEET}'!AB2:AB>=TODAY())*('${PLANNER_DASHBOARD_HELPER_SHEET}'!AB2:AB<=TODAY()+30),'${PLANNER_DASHBOARD_HELPER_SHEET}'!A2:A<>"")))),"")`;
}

function buildUniquePmFormula() {
  return `={"All";SORT(UNIQUE(FILTER('${PLANNER_DASHBOARD_HELPER_SHEET}'!E2:E,'${PLANNER_DASHBOARD_HELPER_SHEET}'!E2:E<>"')))}`;
}

function buildUniqueStateFormula() {
  return `={"All";SORT(UNIQUE(FILTER('${PLANNER_DASHBOARD_HELPER_SHEET}'!H2:H,'${PLANNER_DASHBOARD_HELPER_SHEET}'!H2:H<>"')))}`;
}

function buildChartRequest({ sheetId, title, chartType = "COLUMN", domainStartRow, domainEndRow, domainColumn, seriesColumn, anchorRow, anchorColumn, width = 420, height = 240 }) {
  return {
    addChart: {
      chart: {
        spec: {
          title,
          basicChart: {
            chartType,
            legendPosition: "NO_LEGEND",
            headerCount: 1,
            axis: [
              { position: "BOTTOM_AXIS", title: title },
              { position: "LEFT_AXIS", title: "Count" },
            ],
            domains: [
              {
                domain: {
                  sourceRange: {
                    sources: [
                      {
                        sheetId,
                        startRowIndex: domainStartRow,
                        endRowIndex: domainEndRow,
                        startColumnIndex: domainColumn,
                        endColumnIndex: domainColumn + 1,
                      },
                    ],
                  },
                },
              },
            ],
            series: [
              {
                series: {
                  sourceRange: {
                    sources: [
                      {
                        sheetId,
                        startRowIndex: domainStartRow,
                        endRowIndex: domainEndRow,
                        startColumnIndex: seriesColumn,
                        endColumnIndex: seriesColumn + 1,
                      },
                    ],
                  },
                },
                dataLabel: {
                  type: "DATA",
                },
              },
            ],
          },
        },
        position: {
          overlayPosition: {
            anchorCell: {
              sheetId,
              rowIndex: anchorRow,
              columnIndex: anchorColumn,
            },
            widthPixels: width,
            heightPixels: height,
          },
        },
      },
    },
  };
}

async function upsertPlannerSnapshotRow(spreadsheetId, sheetName, planId, row) {
  const sheetProps = await ensureSheetInSpreadsheet(spreadsheetId, sheetName, false);
  const response = await sheetsClient.spreadsheets.values.get({
    spreadsheetId,
    range: `'${sheetName}'!A:AA`,
  });

  const rows = response.data.values || [];
  const matchingIndexes = rows
    .slice(1)
    .map((currentRow, index) => ({ currentRow, index }))
    .filter(({ currentRow }) => String(currentRow[2] || "") === String(planId || ""))
    .map(({ index }) => index);
  const existingIndex = matchingIndexes[0] ?? -1;

  if (existingIndex === -1) {
    await sheetsClient.spreadsheets.values.append({
      spreadsheetId,
      range: `'${sheetName}'!A:AA`,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [row],
      },
    });
    return;
  }

  const rowNumber = existingIndex + 2;
  await sheetsClient.spreadsheets.values.update({
    spreadsheetId,
    range: `'${sheetName}'!A${rowNumber}:AA${rowNumber}`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [row],
    },
  });

  const duplicateRowNumbers = matchingIndexes.slice(1).map((index) => index + 2);
  if (duplicateRowNumbers.length) {
    await sheetsClient.spreadsheets.values.batchClear({
      spreadsheetId,
      requestBody: {
        ranges: duplicateRowNumbers.map((currentRowNumber) => `'${sheetName}'!A${currentRowNumber}:AA${currentRowNumber}`),
      },
    });
    await sheetsClient.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: duplicateRowNumbers
          .sort((left, right) => right - left)
          .map((currentRowNumber) => ({
            deleteDimension: {
              range: {
                sheetId: sheetProps.sheetId,
                dimension: "ROWS",
                startIndex: currentRowNumber - 1,
                endIndex: currentRowNumber,
              },
            },
          })),
      },
    });
  }
}

async function applyPlannerSheetFormatting(spreadsheetId, sheetName) {
  const sheetProps = await ensureSheetInSpreadsheet(spreadsheetId, sheetName, false);

  await sheetsClient.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          updateSheetProperties: {
            properties: {
              sheetId: sheetProps.sheetId,
              gridProperties: {
                frozenRowCount: 1,
              },
            },
            fields: "gridProperties.frozenRowCount",
          },
        },
        {
          repeatCell: {
            range: {
              sheetId: sheetProps.sheetId,
              startRowIndex: 0,
              endRowIndex: 1,
              startColumnIndex: 0,
              endColumnIndex: 27,
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.9, green: 0.95, blue: 1 },
                textFormat: {
                  bold: true,
                  foregroundColor: { red: 0.09, green: 0.22, blue: 0.14 },
                },
                horizontalAlignment: "CENTER",
                verticalAlignment: "MIDDLE",
                wrapStrategy: "WRAP",
              },
            },
            fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,wrapStrategy)",
          },
        },
        {
          repeatCell: {
            range: {
              sheetId: sheetProps.sheetId,
              startRowIndex: 1,
              endRowIndex: 2000,
              startColumnIndex: 11,
              endColumnIndex: 12,
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 1, green: 0.96, blue: 0.82 },
                textFormat: {
                  bold: true,
                  foregroundColor: { red: 0.45, green: 0.29, blue: 0.04 },
                },
                horizontalAlignment: "CENTER",
              },
            },
            fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)",
          },
        },
        {
          updateDimensionProperties: {
            range: {
              sheetId: sheetProps.sheetId,
              dimension: "COLUMNS",
              startIndex: 11,
              endIndex: 12,
            },
            properties: {
              pixelSize: 120,
            },
            fields: "pixelSize",
          },
        },
      ],
    },
  });
}

function buildPlannerRow(plan, action = "Created") {
  return [
    new Date().toLocaleString("en-IN"),
    action,
    String(plan._id || ""),
    plan.status || "",
    plan.programManagerName || "",
    plan.programManagerEmail || "",
    plan.schoolName || "",
    plan.state || "",
    plan.city || "",
    plan.purposeOfVisit || "",
    plan.workPlanned || "",
    plan.plannedDate ? new Date(plan.plannedDate).toLocaleDateString("en-IN") : "",
    plan.plannedStartTime || "",
    plan.plannedEndTime || "",
    plan.pointOfContact || "",
    plan.contactNo || "",
    plan.schoolEmail || "",
    plan.course || "",
    plan.planningNotes || "",
    plan.workMode || "",
    plan.plannedLocation || "",
    plan.priorityLevel || "",
    plan.dailyStatus || "",
    plan.blockers || "",
    plan.actualLocation || "",
    plan.actualWorkDone || "",
    plan.closureNotes || "",
  ];
}

async function rewritePmSnapshotSheets(spreadsheetId, plans = []) {
  const groupedPlans = new Map();

  for (const plan of plans) {
    const sheetName = buildPlannerSheetTabName(plan);
    if (!groupedPlans.has(sheetName)) {
      groupedPlans.set(sheetName, []);
    }
    groupedPlans.get(sheetName).push(plan);
  }

  for (const [sheetName, groupPlans] of groupedPlans.entries()) {
    await ensureSheetWithHeadersInSpreadsheet(
      spreadsheetId,
      sheetName,
      PLANNER_LOG_HEADERS,
      `'${sheetName}'!A1:AA1`
    );

    await sheetsClient.spreadsheets.values.clear({
      spreadsheetId,
      range: `'${sheetName}'!A:AA`,
    });

    await sheetsClient.spreadsheets.values.update({
      spreadsheetId,
      range: `'${sheetName}'!A1:AA1`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [PLANNER_LOG_HEADERS],
      },
    });

    if (groupPlans.length) {
      await sheetsClient.spreadsheets.values.update({
        spreadsheetId,
        range: `'${sheetName}'!A2:AA${groupPlans.length + 1}`,
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: groupPlans.map((plan) => buildPlannerRow(plan, "Current Snapshot")),
        },
      });
    }

    await applyPlannerSheetFormatting(spreadsheetId, sheetName);
  }
}

function buildSlicerRequest({ sheetId, title, dataStartRow = 9, dataEndRow = 1000, dataStartColumn = 23, dataEndColumn = 43, columnIndex, rowIndex, columnAnchor }) {
  return {
    addSlicer: {
      slicer: {
        spec: {
          title,
          columnIndex: dataStartColumn + columnIndex,
          dataRange: {
            sheetId,
            startRowIndex: dataStartRow,
            endRowIndex: dataEndRow,
            startColumnIndex: dataStartColumn,
            endColumnIndex: dataEndColumn,
          },
          applyToPivotTables: false,
          horizontalAlignment: "LEFT",
          textFormat: {
            bold: true,
            fontSize: 10,
          },
        },
        position: {
          overlayPosition: {
            anchorCell: {
              sheetId,
              rowIndex,
              columnIndex: columnAnchor,
            },
            widthPixels: 160,
            heightPixels: 80,
          },
        },
      },
    },
  };
}

export async function buildPlannerDashboardSheet() {
  const spreadsheetId = env.plannerSpreadsheetId;
  await renameSheetIfNeeded(spreadsheetId, LEGACY_PLANNER_DASHBOARD_SHEET, PLANNER_DASHBOARD_SHEET);
  const currentPlans = await VisitPlan.find({})
    .sort({ programManagerEmail: 1, plannedDate: 1, createdAt: -1 })
    .lean();
  const pmSheets = [...new Set(currentPlans.map((plan) => buildPlannerSheetTabName(plan)))];

  await rewritePmSnapshotSheets(spreadsheetId, currentPlans);
  await ensureSheetWithHeadersInSpreadsheet(
    spreadsheetId,
    env.plannerLogSheetName,
    PLANNER_LOG_HEADERS,
    `'${env.plannerLogSheetName}'!A1:AA1`
  );
  await sheetsClient.spreadsheets.values.clear({
    spreadsheetId,
    range: `'${env.plannerLogSheetName}'!A:AA`,
  });
  await sheetsClient.spreadsheets.values.update({
    spreadsheetId,
    range: `'${env.plannerLogSheetName}'!A1:AA1`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [PLANNER_LOG_HEADERS],
    },
  });
  if (currentPlans.length) {
    await sheetsClient.spreadsheets.values.update({
      spreadsheetId,
      range: `'${env.plannerLogSheetName}'!A2:AA${currentPlans.length + 1}`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: currentPlans.map((plan) => buildPlannerRow(plan, "Current Snapshot")),
      },
    });
  }
  await applyPlannerSheetFormatting(spreadsheetId, env.plannerLogSheetName);

  const helperProps = await recreateSheetInSpreadsheet(spreadsheetId, PLANNER_DASHBOARD_HELPER_SHEET, true);
  const dashboardProps = await ensureSheetInSpreadsheet(spreadsheetId, PLANNER_DASHBOARD_SHEET, false);
  const managementProps = await recreateSheetInSpreadsheet(spreadsheetId, MANAGEMENT_DASHBOARD_SHEET, false);

  await sheetsClient.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          updateSheetProperties: {
            properties: {
              sheetId: helperProps.sheetId,
              gridProperties: {
                rowCount: 1000,
                columnCount: 52,
              },
            },
            fields: "gridProperties.rowCount,gridProperties.columnCount",
          },
        },
        {
          updateSheetProperties: {
            properties: {
              sheetId: dashboardProps.sheetId,
              gridProperties: {
                rowCount: 1000,
                columnCount: 52,
              },
            },
            fields: "gridProperties.rowCount,gridProperties.columnCount",
          },
        },
      ],
    },
  });

  await sheetsClient.spreadsheets.values.clear({
    spreadsheetId,
    range: `'${PLANNER_DASHBOARD_HELPER_SHEET}'!A:AB`,
  });

  await sheetsClient.spreadsheets.values.update({
    spreadsheetId,
    range: `'${PLANNER_DASHBOARD_HELPER_SHEET}'!A1:AA${currentPlans.length + 1}`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [PLANNER_LOG_HEADERS, ...currentPlans.map((plan) => buildPlannerRow(plan, "Current Snapshot"))],
    },
  });

  await sheetsClient.spreadsheets.values.update({
    spreadsheetId,
    range: `'${PLANNER_DASHBOARD_HELPER_SHEET}'!AB1`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[buildPlannerDateFormula()]],
    },
  });

  await sheetsClient.spreadsheets.values.clear({
    spreadsheetId,
    range: `'${PLANNER_DASHBOARD_SHEET}'!A:AZ`,
  });

  await sheetsClient.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          updateSheetProperties: {
            properties: {
              sheetId: dashboardProps.sheetId,
              gridProperties: {
                rowCount: 1000,
                columnCount: 52,
              },
            },
            fields: "gridProperties.rowCount,gridProperties.columnCount",
          },
        },
      ],
    },
  });

  await sheetsClient.spreadsheets.values.update({
    spreadsheetId,
    range: `'${PLANNER_DASHBOARD_SHEET}'!A1`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [
        ["Planner Ops Dashboard"],
        ["Operational planner view built from PM planning sheets"],
        [],
        ["Status", "All", "Program Manager", "All", "State", "All", "Time Window", "Next 7 Days"],
        [],
        ["Total Plans", '=IFERROR(COUNTA(X11:X),0)', "Draft", '=COUNTIF(AA11:AA,"Draft")', "Confirmed", '=COUNTIF(AA11:AA,"Confirmed")', "Completed", '=COUNTIF(AA11:AA,"Completed")'],
        ["Cancelled", '=COUNTIF(AA11:AA,"Cancelled")', "Today", '=COUNTIFS(AY11:AY,TODAY())', "Next 7 Days", '=COUNTIFS(AY11:AY,">="&TODAY(),AY11:AY,"<="&TODAY()+7)', "Needs Attention", '=IFERROR(COUNT(FILTER(AY11:AY,(AY11:AY<TODAY())*((AA11:AA="Draft")+(AA11:AA="Confirmed")))),0)'],
        [],
        ["Upcoming Visits"],
        ["Date","School","PM","State","Purpose","Status","Time"],
        ["=IFERROR(QUERY({AY11:AY,AD11:AD,AB11:AB,AE11:AE,AG11:AG,AA11:AA,AJ11:AJ&\" - \"&AK11:AK},\"select Col1,Col2,Col3,Col4,Col5,Col6,Col7 where Col1 is not null order by Col1 asc label Col1 'Date',Col2 'School',Col3 'PM',Col4 'State',Col5 'Purpose',Col6 'Status',Col7 'Time'\",0),\"\")"],
        [],
        ["Attention Items"],
        ["Date","School","PM","Status","Work Planned"],
        ["=IFERROR(QUERY({AY11:AY,AD11:AD,AB11:AB,AA11:AA,AH11:AH},\"select Col1,Col2,Col3,Col4,Col5 where Col1 < date '\"&TEXT(TODAY(),\"yyyy-mm-dd\")&\"' and (Col4 = 'Draft' or Col4 = 'Confirmed') order by Col1 asc label Col1 'Date',Col2 'School',Col3 'PM',Col4 'Status',Col5 'Work Planned'\",0),\"\")"],
        [],
        ["Planner Load by PM", "", "", "", "Planner Load by State", "", "", ""],
        ["=IFERROR(QUERY(AB11:AB,\"select Col1, count(Col1) where Col1 is not null group by Col1 order by count(Col1) desc label Col1 'PM', count(Col1) 'Plans'\",0),\"\")"],
        [],
        ["", "", "", "", "", "", "", ""],
        ["=IFERROR(QUERY(AE11:AE,\"select Col1, count(Col1) where Col1 is not null group by Col1 order by count(Col1) desc label Col1 'State', count(Col1) 'Plans'\",0),\"\")"],
        [],
        ["Status Mix", "", "", "", "Purpose Mix", "", "", ""],
        ["=IFERROR(QUERY(AA11:AA,\"select Col1, count(Col1) where Col1 is not null group by Col1 order by count(Col1) desc label Col1 'Status', count(Col1) 'Plans'\",0),\"\")"],
        [],
        ["", "", "", "", "", "", "", ""],
        ["=IFERROR(QUERY(AG11:AG,\"select Col1, count(Col1) where Col1 is not null group by Col1 order by count(Col1) desc label Col1 'Purpose', count(Col1) 'Plans'\",0),\"\")"],
      ],
    },
  });

  await sheetsClient.spreadsheets.values.update({
    spreadsheetId,
    range: `'${PLANNER_DASHBOARD_SHEET}'!AS1`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [
        ["PM List", "State List", "Status List", "Time Window List"],
        [buildUniquePmFormula(), buildUniqueStateFormula(), '={"All";"Draft";"Confirmed";"Completed";"Cancelled"}', '={"Today";"Next 7 Days";"Next 30 Days";"All Time"}'],
      ],
    },
  });

  await sheetsClient.spreadsheets.values.update({
    spreadsheetId,
    range: `'${PLANNER_DASHBOARD_SHEET}'!X10`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [
        [...PLANNER_LOG_HEADERS, "Parsed Planned Date"],
        [buildDashboardFilteredFormula()],
      ],
    },
  });

  await sheetsClient.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          updateSheetProperties: {
            properties: {
              sheetId: dashboardProps.sheetId,
              gridProperties: {
                frozenRowCount: 4,
                frozenColumnCount: 0,
                hideGridlines: true,
              },
            },
            fields: "gridProperties.frozenRowCount,gridProperties.frozenColumnCount,gridProperties.hideGridlines",
          },
        },
        {
          mergeCells: {
            range: {
              sheetId: dashboardProps.sheetId,
              startRowIndex: 0,
              endRowIndex: 1,
              startColumnIndex: 0,
              endColumnIndex: 8,
            },
            mergeType: "MERGE_ALL",
          },
        },
        {
          repeatCell: {
            range: {
              sheetId: dashboardProps.sheetId,
              startRowIndex: 0,
              endRowIndex: 2,
              startColumnIndex: 0,
              endColumnIndex: 8,
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.92, green: 0.97, blue: 0.95 },
                textFormat: { fontSize: 18, bold: true, foregroundColor: { red: 0.09, green: 0.22, blue: 0.14 } },
                horizontalAlignment: "LEFT",
                verticalAlignment: "MIDDLE",
              },
            },
            fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)",
          },
        },
        {
          repeatCell: {
            range: {
              sheetId: dashboardProps.sheetId,
              startRowIndex: 3,
              endRowIndex: 4,
              startColumnIndex: 0,
              endColumnIndex: 8,
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.97, green: 0.99, blue: 0.98 },
                textFormat: { bold: true, foregroundColor: { red: 0.13, green: 0.22, blue: 0.18 } },
                horizontalAlignment: "CENTER",
              },
            },
            fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)",
          },
        },
        {
          repeatCell: {
            range: {
              sheetId: dashboardProps.sheetId,
              startRowIndex: 5,
              endRowIndex: 7,
              startColumnIndex: 0,
              endColumnIndex: 8,
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 1, green: 1, blue: 1 },
                horizontalAlignment: "CENTER",
                verticalAlignment: "MIDDLE",
                textFormat: { bold: true, fontSize: 13 },
              },
            },
            fields: "userEnteredFormat(backgroundColor,horizontalAlignment,verticalAlignment,textFormat)",
          },
        },
        {
          repeatCell: {
            range: {
              sheetId: dashboardProps.sheetId,
              startRowIndex: 9,
              endRowIndex: 10,
              startColumnIndex: 0,
              endColumnIndex: 7,
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.92, green: 0.96, blue: 1 },
                textFormat: { bold: true },
              },
            },
            fields: "userEnteredFormat(backgroundColor,textFormat)",
          },
        },
        {
          repeatCell: {
            range: {
              sheetId: dashboardProps.sheetId,
              startRowIndex: 13,
              endRowIndex: 14,
              startColumnIndex: 0,
              endColumnIndex: 6,
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 1, green: 0.95, blue: 0.9 },
                textFormat: { bold: true },
              },
            },
            fields: "userEnteredFormat(backgroundColor,textFormat)",
          },
        },
        {
          setDataValidation: {
            range: {
              sheetId: dashboardProps.sheetId,
              startRowIndex: 3,
              endRowIndex: 4,
              startColumnIndex: 1,
              endColumnIndex: 2,
            },
            rule: {
              condition: {
                type: "ONE_OF_RANGE",
                values: [{ userEnteredValue: `='${PLANNER_DASHBOARD_SHEET}'!AU2:AU` }],
              },
              strict: true,
              showCustomUi: true,
            },
          },
        },
        {
          setDataValidation: {
            range: {
              sheetId: dashboardProps.sheetId,
              startRowIndex: 3,
              endRowIndex: 4,
              startColumnIndex: 3,
              endColumnIndex: 4,
            },
            rule: {
              condition: {
                type: "ONE_OF_RANGE",
                values: [{ userEnteredValue: `='${PLANNER_DASHBOARD_SHEET}'!AS2:AS` }],
              },
              strict: true,
              showCustomUi: true,
            },
          },
        },
        {
          setDataValidation: {
            range: {
              sheetId: dashboardProps.sheetId,
              startRowIndex: 3,
              endRowIndex: 4,
              startColumnIndex: 5,
              endColumnIndex: 6,
            },
            rule: {
              condition: {
                type: "ONE_OF_RANGE",
                values: [{ userEnteredValue: `='${PLANNER_DASHBOARD_SHEET}'!AT2:AT` }],
              },
              strict: true,
              showCustomUi: true,
            },
          },
        },
        {
          setDataValidation: {
            range: {
              sheetId: dashboardProps.sheetId,
              startRowIndex: 3,
              endRowIndex: 4,
              startColumnIndex: 7,
              endColumnIndex: 8,
            },
            rule: {
              condition: {
                type: "ONE_OF_RANGE",
                values: [{ userEnteredValue: `='${PLANNER_DASHBOARD_SHEET}'!AV2:AV` }],
              },
              strict: true,
              showCustomUi: true,
            },
          },
        },
        {
          updateDimensionProperties: {
            range: {
              sheetId: dashboardProps.sheetId,
              dimension: "COLUMNS",
              startIndex: 18,
              endIndex: 49,
            },
            properties: {
              hiddenByUser: true,
            },
            fields: "hiddenByUser",
          },
        },
      ],
    },
  });

  await sheetsClient.spreadsheets.values.clear({
    spreadsheetId,
    range: `'${MANAGEMENT_DASHBOARD_SHEET}'!A:AZ`,
  });

  await sheetsClient.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          updateSheetProperties: {
            properties: {
              sheetId: managementProps.sheetId,
              gridProperties: {
                rowCount: 1000,
                columnCount: 52,
                frozenRowCount: 4,
                frozenColumnCount: 0,
                hideGridlines: true,
              },
            },
            fields: "gridProperties.rowCount,gridProperties.columnCount,gridProperties.frozenRowCount,gridProperties.frozenColumnCount,gridProperties.hideGridlines",
          },
        },
      ],
    },
  });

  await sheetsClient.spreadsheets.values.update({
    spreadsheetId,
    range: `'${MANAGEMENT_DASHBOARD_SHEET}'!A1`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [
        ["Management Dashboard"],
        ["Executive view of planner performance, risks, and upcoming field activity"],
        [],
        ["Status", "All", "Program Manager", "All", "State", "All", "Time Window", "Next 30 Days"],
        [],
        ["Total Plans", '=IFERROR(COUNTA(X11:X),0)', "Confirmed", '=COUNTIF(AA11:AA,"Confirmed")', "Next 7 Days", '=COUNTIFS(AY11:AY,">="&TODAY(),AY11:AY,"<="&TODAY()+7)', "Needs Attention", '=IFERROR(COUNT(FILTER(AY11:AY,(AY11:AY<TODAY())*((AA11:AA="Draft")+(AA11:AA="Confirmed")))),0)'],
        ["Draft", '=COUNTIF(AA11:AA,"Draft")', "Completed", '=COUNTIF(AA11:AA,"Completed")', "Cancelled", '=COUNTIF(AA11:AA,"Cancelled")', "Today", '=COUNTIFS(AY11:AY,TODAY())'],
        [],
        ["High-Risk / Attention Items"],
        ["Date","School","PM","Status","Work Planned"],
        ["=IFERROR(QUERY({AY11:AY,AD11:AD,AB11:AB,AA11:AA,AH11:AH},\"select Col1,Col2,Col3,Col4,Col5 where Col1 < date '\"&TEXT(TODAY(),\"yyyy-mm-dd\")&\"' and (Col4 = 'Draft' or Col4 = 'Confirmed') order by Col1 asc label Col1 'Date',Col2 'School',Col3 'PM',Col4 'Status',Col5 'Work Planned'\",0),\"\")"],
        [],
        ["Upcoming Visits"],
        ["Date","School","PM","State","Purpose","Status","Time"],
        ["=IFERROR(QUERY({AY11:AY,AD11:AD,AB11:AB,AE11:AE,AG11:AG,AA11:AA,AJ11:AJ&\" - \"&AK11:AK},\"select Col1,Col2,Col3,Col4,Col5,Col6,Col7 where Col1 is not null order by Col1 asc label Col1 'Date',Col2 'School',Col3 'PM',Col4 'State',Col5 'Purpose',Col6 'Status',Col7 'Time'\",0),\"\")"],
        [],
        ["Status Mix", "", "", "PM Load", "", "", "State Load", "", "", "Purpose Mix"],
        ["=IFERROR(QUERY(AA11:AA,\"select Col1, count(Col1) where Col1 is not null group by Col1 order by count(Col1) desc label Col1 'Status', count(Col1) 'Plans'\",0),\"\")","","","=IFERROR(QUERY(AB11:AB,\"select Col1, count(Col1) where Col1 is not null group by Col1 order by count(Col1) desc label Col1 'PM', count(Col1) 'Plans'\",0),\"\")","","","=IFERROR(QUERY(AE11:AE,\"select Col1, count(Col1) where Col1 is not null group by Col1 order by count(Col1) desc label Col1 'State', count(Col1) 'Plans'\",0),\"\")","","","=IFERROR(QUERY(AG11:AG,\"select Col1, count(Col1) where Col1 is not null group by Col1 order by count(Col1) desc label Col1 'Purpose', count(Col1) 'Plans'\",0),\"\")"],
      ],
    },
  });

  await sheetsClient.spreadsheets.values.update({
    spreadsheetId,
    range: `'${MANAGEMENT_DASHBOARD_SHEET}'!AS1`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [
        ["PM List", "State List", "Status List", "Time Window List"],
        [buildUniquePmFormula(), buildUniqueStateFormula(), '={"All";"Draft";"Confirmed";"Completed";"Cancelled"}', '={"Today";"Next 7 Days";"Next 30 Days";"All Time"}'],
      ],
    },
  });

  await sheetsClient.spreadsheets.values.update({
    spreadsheetId,
    range: `'${MANAGEMENT_DASHBOARD_SHEET}'!X10`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [
        [...PLANNER_LOG_HEADERS, "Parsed Planned Date"],
        [buildDashboardFilteredFormula()],
      ],
    },
  });

  await sheetsClient.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          mergeCells: {
            range: {
              sheetId: managementProps.sheetId,
              startRowIndex: 0,
              endRowIndex: 1,
              startColumnIndex: 0,
              endColumnIndex: 10,
            },
            mergeType: "MERGE_ALL",
          },
        },
        {
          repeatCell: {
            range: { sheetId: managementProps.sheetId, startRowIndex: 0, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: 10 },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.91, green: 0.96, blue: 0.92 },
                textFormat: { fontSize: 20, bold: true, foregroundColor: { red: 0.09, green: 0.22, blue: 0.14 } },
              },
            },
            fields: "userEnteredFormat(backgroundColor,textFormat)",
          },
        },
        {
          repeatCell: {
            range: { sheetId: managementProps.sheetId, startRowIndex: 3, endRowIndex: 4, startColumnIndex: 0, endColumnIndex: 8 },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.97, green: 0.99, blue: 0.98 },
                textFormat: { bold: true },
                horizontalAlignment: "CENTER",
              },
            },
            fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)",
          },
        },
        {
          repeatCell: {
            range: { sheetId: managementProps.sheetId, startRowIndex: 5, endRowIndex: 7, startColumnIndex: 0, endColumnIndex: 8 },
            cell: {
              userEnteredFormat: {
                horizontalAlignment: "CENTER",
                textFormat: { bold: true, fontSize: 13 },
              },
            },
            fields: "userEnteredFormat(horizontalAlignment,textFormat)",
          },
        },
        {
          repeatCell: {
            range: { sheetId: managementProps.sheetId, startRowIndex: 9, endRowIndex: 10, startColumnIndex: 0, endColumnIndex: 5 },
            cell: { userEnteredFormat: { backgroundColor: { red: 1, green: 0.93, blue: 0.93 }, textFormat: { bold: true } } },
            fields: "userEnteredFormat(backgroundColor,textFormat)",
          },
        },
        {
          repeatCell: {
            range: { sheetId: managementProps.sheetId, startRowIndex: 13, endRowIndex: 14, startColumnIndex: 0, endColumnIndex: 7 },
            cell: { userEnteredFormat: { backgroundColor: { red: 0.92, green: 0.96, blue: 1 }, textFormat: { bold: true } } },
            fields: "userEnteredFormat(backgroundColor,textFormat)",
          },
        },
        {
          addConditionalFormatRule: {
            index: 0,
            rule: {
              ranges: [{ sheetId: managementProps.sheetId, startRowIndex: 10, endRowIndex: 40, startColumnIndex: 0, endColumnIndex: 5 }],
              booleanRule: {
                condition: { type: "CUSTOM_FORMULA", values: [{ userEnteredValue: '=AND($A11<>"",$A11<TODAY())' }] },
                format: {
                  backgroundColor: { red: 1, green: 0.92, blue: 0.92 },
                  textFormat: { bold: true, foregroundColor: { red: 0.6, green: 0.1, blue: 0.1 } },
                },
              },
            },
          },
        },
        {
          addConditionalFormatRule: {
            index: 0,
            rule: {
              ranges: [{ sheetId: managementProps.sheetId, startRowIndex: 5, endRowIndex: 7, startColumnIndex: 6, endColumnIndex: 8 }],
              booleanRule: {
                condition: { type: "NUMBER_GREATER", values: [{ userEnteredValue: "0" }] },
                format: {
                  backgroundColor: { red: 1, green: 0.88, blue: 0.88 },
                  textFormat: { bold: true, foregroundColor: { red: 0.6, green: 0.1, blue: 0.1 } },
                },
              },
            },
          },
        },
        {
          setDataValidation: {
            range: { sheetId: managementProps.sheetId, startRowIndex: 3, endRowIndex: 4, startColumnIndex: 1, endColumnIndex: 2 },
            rule: { condition: { type: "ONE_OF_RANGE", values: [{ userEnteredValue: `='${MANAGEMENT_DASHBOARD_SHEET}'!AU2:AU` }] }, strict: true, showCustomUi: true },
          },
        },
        {
          setDataValidation: {
            range: { sheetId: managementProps.sheetId, startRowIndex: 3, endRowIndex: 4, startColumnIndex: 3, endColumnIndex: 4 },
            rule: { condition: { type: "ONE_OF_RANGE", values: [{ userEnteredValue: `='${MANAGEMENT_DASHBOARD_SHEET}'!AS2:AS` }] }, strict: true, showCustomUi: true },
          },
        },
        {
          setDataValidation: {
            range: { sheetId: managementProps.sheetId, startRowIndex: 3, endRowIndex: 4, startColumnIndex: 5, endColumnIndex: 6 },
            rule: { condition: { type: "ONE_OF_RANGE", values: [{ userEnteredValue: `='${MANAGEMENT_DASHBOARD_SHEET}'!AT2:AT` }] }, strict: true, showCustomUi: true },
          },
        },
        {
          setDataValidation: {
            range: { sheetId: managementProps.sheetId, startRowIndex: 3, endRowIndex: 4, startColumnIndex: 7, endColumnIndex: 8 },
            rule: { condition: { type: "ONE_OF_RANGE", values: [{ userEnteredValue: `='${MANAGEMENT_DASHBOARD_SHEET}'!AV2:AV` }] }, strict: true, showCustomUi: true },
          },
        },
        buildChartRequest({ sheetId: managementProps.sheetId, title: "Status Mix", chartType: "COLUMN", domainStartRow: 17, domainEndRow: 27, domainColumn: 0, seriesColumn: 1, anchorRow: 1, anchorColumn: 10, width: 360, height: 220 }),
        buildChartRequest({ sheetId: managementProps.sheetId, title: "PM Load", chartType: "BAR", domainStartRow: 17, domainEndRow: 27, domainColumn: 3, seriesColumn: 4, anchorRow: 1, anchorColumn: 16, width: 420, height: 240 }),
        buildChartRequest({ sheetId: managementProps.sheetId, title: "State Load", chartType: "COLUMN", domainStartRow: 17, domainEndRow: 27, domainColumn: 6, seriesColumn: 7, anchorRow: 14, anchorColumn: 10, width: 360, height: 220 }),
        buildChartRequest({ sheetId: managementProps.sheetId, title: "Purpose Mix", chartType: "BAR", domainStartRow: 17, domainEndRow: 29, domainColumn: 9, seriesColumn: 10, anchorRow: 14, anchorColumn: 16, width: 420, height: 240 }),
        buildSlicerRequest({ sheetId: managementProps.sheetId, title: "Status Slicer", columnIndex: 3, rowIndex: 27, columnAnchor: 0 }),
        buildSlicerRequest({ sheetId: managementProps.sheetId, title: "PM Slicer", columnIndex: 4, rowIndex: 27, columnAnchor: 3 }),
        buildSlicerRequest({ sheetId: managementProps.sheetId, title: "State Slicer", columnIndex: 7, rowIndex: 27, columnAnchor: 6 }),
        {
          updateDimensionProperties: {
            range: { sheetId: managementProps.sheetId, dimension: "COLUMNS", startIndex: 23, endIndex: 49 },
            properties: { hiddenByUser: true },
            fields: "hiddenByUser",
          },
        },
      ],
    },
  });

  return {
    spreadsheetId,
    dashboardSheetName: PLANNER_DASHBOARD_SHEET,
    managementSheetName: MANAGEMENT_DASHBOARD_SHEET,
    helperSheetName: PLANNER_DASHBOARD_HELPER_SHEET,
    pmSheetCount: pmSheets.length,
    url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=${managementProps.sheetId}`,
    plannerOpsUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=${dashboardProps.sheetId}`,
    managementUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=${managementProps.sheetId}`,
  };
}

function buildPlannerSheetTabName(plan) {
  const baseName =
    String(plan.programManagerEmail || "").split("@")[0] ||
    String(plan.programManagerName || "").trim() ||
    env.plannerLogSheetName;

  return `PM - ${baseName}`
    .replace(/[\[\]\*\/\\\?\:]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 90);
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

export async function appendPlanLogToSheet(plan, action = "Created") {
  const plannerSpreadsheetId = env.plannerSpreadsheetId;
  const plannerTabName = buildPlannerSheetTabName(plan);

  await ensureSheetWithHeadersInSpreadsheet(
    plannerSpreadsheetId,
    env.plannerLogSheetName,
    PLANNER_LOG_HEADERS,
    `'${env.plannerLogSheetName}'!A1:AA1`
  );

  await ensureSheetWithHeadersInSpreadsheet(
    plannerSpreadsheetId,
    plannerTabName,
    PLANNER_LOG_HEADERS,
    `'${plannerTabName}'!A1:AA1`
  );

  const row = buildPlannerRow(plan, "Current Snapshot");

  await upsertPlannerSnapshotRow(plannerSpreadsheetId, plannerTabName, String(plan._id || ""), row);
  await upsertPlannerSnapshotRow(plannerSpreadsheetId, env.plannerLogSheetName, String(plan._id || ""), row);
  await applyPlannerSheetFormatting(plannerSpreadsheetId, plannerTabName);
  await applyPlannerSheetFormatting(plannerSpreadsheetId, env.plannerLogSheetName);
}
