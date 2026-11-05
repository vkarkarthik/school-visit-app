import { env } from "../config/env.js";
import { AppSettings } from "../models/AppSettings.js";

const SETTINGS_CACHE_TTL_MS = 5 * 60 * 1000;
const SETTINGS_KEY = "global";
const DEFAULT_WORK_MODES = ["School Visit", "Work From Home", "Work From Office", "Travel", "Other"];
const DEFAULT_VISIT_PURPOSES = [
  "New School Visit / Demo",
  "Teachers Copy",
  "Induction Training",
  "Teachers Training",
  "Robotics Training",
  "Admin Related Work",
  "Software Installation",
  "Other Works",
];
const DEFAULT_PRIORITIES = ["Critical", "High", "Normal"];
const DEFAULT_ADMIN_EMAILS = [
  "karthik@superteacher.in",
  "karthikv@superteacher.in",
  "vasudevan@superteacher.in",
  "bhanu@superteacher.in",
  "manmohan@superteacher.in",
  "jayasri@superteacher.co.in",
  "marichelvam@superteacher.in",
  "sukumar@superteacher.in",
];

let settingsCache = {
  data: null,
  fetchedAt: 0,
  pending: null,
};

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeStringList(values) {
  const seen = new Set();
  const list = [];

  for (const rawItem of Array.isArray(values) ? values : String(values || "").split(/[\n,]/)) {
    const item = String(rawItem || "").trim();
    if (!item || seen.has(item)) continue;
    seen.add(item);
    list.push(item);
  }

  return list;
}

function normalizeEmailList(values) {
  const seen = new Set();
  const list = [];

  for (const rawItem of Array.isArray(values) ? values : String(values || "").split(",")) {
    const email = normalizeEmail(rawItem);
    if (!email || seen.has(email)) continue;
    seen.add(email);
    list.push(email);
  }

  return list;
}

export function requireAdminEmails(values) {
  const adminEmails = normalizeEmailList(values);
  if (!adminEmails.length) {
    const error = new Error("At least one Admin Email is required to prevent losing admin access.");
    error.statusCode = 400;
    throw error;
  }

  return adminEmails;
}

function normalizeProgramManagers(values) {
  const seen = new Set();
  const list = [];

  for (const item of Array.isArray(values) ? values : []) {
    const email = normalizeEmail(item?.email);
    const name = String(item?.name || "").trim();
    const active = item?.active !== false;

    if (!email || !name || seen.has(email)) continue;
    seen.add(email);
    list.push({ name, email, active });
  }

  return list.sort((a, b) => a.name.localeCompare(b.name));
}function buildDefaultSettings() {
  return {
    adminEmails: normalizeEmailList(DEFAULT_ADMIN_EMAILS),
    commonCc: normalizeEmailList(env.smtp.cc),
    programManagers: [],
    workModes: normalizeStringList(DEFAULT_WORK_MODES),
    visitPurposes: normalizeStringList(DEFAULT_VISIT_PURPOSES),
    priorities: normalizeStringList(DEFAULT_PRIORITIES),
    updatedBy: "",
    updatedAt: null,
  };
}

export function normalizeSettingsDocument(doc) {
  const defaults = buildDefaultSettings();
  const source = doc?.toObject ? doc.toObject() : doc || {};
  const hasOwn = (key) => Object.prototype.hasOwnProperty.call(source, key);

  return {
    adminEmails: normalizeEmailList(hasOwn("adminEmails") ? source.adminEmails : defaults.adminEmails),
    commonCc: normalizeEmailList(hasOwn("commonCc") ? source.commonCc : defaults.commonCc),
    programManagers: normalizeProgramManagers(hasOwn("programManagers") ? source.programManagers : defaults.programManagers),
    workModes: normalizeStringList(hasOwn("workModes") ? source.workModes : defaults.workModes),
    visitPurposes: normalizeStringList(hasOwn("visitPurposes") ? source.visitPurposes : defaults.visitPurposes),
    priorities: normalizeStringList(hasOwn("priorities") ? source.priorities : defaults.priorities),
    updatedBy: normalizeEmail(source.updatedBy),
    updatedAt: source.updatedAt || null,
  };
}

export async function getAppSettings({ forceRefresh = false } = {}) {
  const cacheAge = Date.now() - settingsCache.fetchedAt;
  const hasFreshCache = !forceRefresh && settingsCache.data && cacheAge < SETTINGS_CACHE_TTL_MS;

  if (hasFreshCache) return settingsCache.data;
  if (!forceRefresh && settingsCache.pending) return settingsCache.pending;

  settingsCache.pending = (async () => {
    const doc = await AppSettings.findOne({ key: SETTINGS_KEY }).lean();
    const normalized = normalizeSettingsDocument(doc);
    settingsCache = {
      data: normalized,
      fetchedAt: Date.now(),
      pending: null,
    };
    return normalized;
  })();

  try {
    return await settingsCache.pending;
  } finally {
    settingsCache.pending = null;
  }
}

export async function saveAppSettings(payload, updatedBy = "") {
  const next = {
    key: SETTINGS_KEY,
    adminEmails: requireAdminEmails(payload?.adminEmails),
    commonCc: normalizeEmailList(payload?.commonCc),    programManagers: normalizeProgramManagers(payload?.programManagers),
    workModes: normalizeStringList(payload?.workModes),
    visitPurposes: normalizeStringList(payload?.visitPurposes),
    priorities: normalizeStringList(payload?.priorities),
    updatedBy: normalizeEmail(updatedBy),
  };

  const doc = await AppSettings.findOneAndUpdate(
    { key: SETTINGS_KEY },
    next,
    { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
  );

  const normalized = normalizeSettingsDocument(doc);
  settingsCache = {
    data: normalized,
    fetchedAt: Date.now(),
    pending: null,
  };

  return normalized;
}

export async function getAdminEmailSet() {
  const settings = await getAppSettings();
  return new Set(settings.adminEmails.map(normalizeEmail));
}

export async function isAdminEmail(email) {
  const adminSet = await getAdminEmailSet();
  return adminSet.has(normalizeEmail(email));
}

export async function getCommonCcString() {
  const settings = await getAppSettings();
  return settings.commonCc.join(",");
}
