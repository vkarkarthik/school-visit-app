export function normalizeList(values, { keepSchoolVisit = false, lowercase = false } = {}) {
  const source = Array.isArray(values) ? values : String(values || '').split(/[\n,]/);
  const seen = new Set();
  const unique = [];

  for (const rawItem of source) {
    const item = String(rawItem || '').trim();
    const normalized = lowercase ? item.toLowerCase() : item;
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    unique.push(normalized);
  }

  if (keepSchoolVisit && !unique.includes('School Visit')) {
    unique.unshift('School Visit');
  }

  return unique;
}

export function normalizeEmailList(values) {
  return normalizeList(values, { lowercase: true });
}

export function listToText(values, separator = '\n') {
  return normalizeList(values).join(separator);
}

export function normalizeSettingsForForm(settings = {}) {
  return {
    ...settings,
    adminEmails: normalizeEmailList(settings.adminEmails),
    commonCc: normalizeEmailList(settings.commonCc),
    programManagers: (Array.isArray(settings.programManagers) ? settings.programManagers : []).map((manager) => ({
      name: String(manager?.name || ''),
      email: String(manager?.email || ''),
      active: manager?.active !== false,
    })),
    workModes: normalizeList(settings.workModes, { keepSchoolVisit: true }),
    visitPurposes: normalizeList(settings.visitPurposes),
    priorities: normalizeList(settings.priorities),
  };
}

export function settingsSignature(settings) {
  return JSON.stringify(normalizeSettingsForForm(settings));
}

export function buildSettingsPayload(draft, emailText = {}) {
  return {
    ...normalizeSettingsForForm(draft),
    adminEmails: normalizeEmailList(emailText.adminEmails),
    commonCc: normalizeEmailList(emailText.commonCc),
  };
}

export function validateSettingsPayload(settings) {
  if (!normalizeEmailList(settings?.adminEmails).length) {
    return 'At least one Admin Email is required to prevent losing admin access.';
  }

  return '';
}
