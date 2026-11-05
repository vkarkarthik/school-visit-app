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

const STATE_ABBREVIATIONS = {
  tn: 'tamilnadu',
  ka: 'karnataka',
  kl: 'kerala',
  wb: 'westbengal',
};

export function normalizeStateKey(value) {
  const compact = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

  return STATE_ABBREVIATIONS[compact] || compact;
}

export function normalizeStateCcEmails(values) {
  const entries = values instanceof Map
    ? [...values.entries()]
    : values && typeof values === 'object' && !Array.isArray(values)
      ? Object.entries(values)
      : [];
  const byStateKey = new Map();

  for (const [rawState, rawEmails] of entries) {
    const state = String(rawState || '').trim();
    const stateKey = normalizeStateKey(state);
    if (!state || !stateKey) continue;

    byStateKey.set(stateKey, {
      state,
      emails: normalizeEmailList(rawEmails),
    });
  }

  return Object.fromEntries([...byStateKey.values()].map(({ state, emails }) => [state, emails]));
}

export function createStateCcEditor(values) {
  const editor = {};

  for (const [state, emails] of Object.entries(normalizeStateCcEmails(values))) {
    editor[normalizeStateKey(state)] = {
      state,
      text: listToText(emails, ', '),
    };
  }

  return editor;
}

export function stateCcEditorToMapping(editor) {
  const mapping = {};

  for (const entry of Object.values(editor && typeof editor === 'object' ? editor : {})) {
    const state = String(entry?.state || '').trim();
    if (!state || !normalizeStateKey(state)) continue;
    mapping[state] = normalizeEmailList(entry?.text);
  }

  return normalizeStateCcEmails(mapping);
}

export function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

export function listToText(values, separator = '\n') {
  return normalizeList(values).join(separator);
}

export function normalizeSettingsForForm(settings = {}) {
  return {
    ...settings,
    adminEmails: normalizeEmailList(settings.adminEmails),
    commonCc: normalizeEmailList(settings.commonCc),
    stateCcEmails: normalizeStateCcEmails(settings.stateCcEmails),
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

export function buildSettingsPayload(draft, emailText = {}, stateCcEditor) {
  return {
    ...normalizeSettingsForForm(draft),
    adminEmails: normalizeEmailList(emailText.adminEmails),
    commonCc: normalizeEmailList(emailText.commonCc),
    stateCcEmails:
      stateCcEditor === undefined
        ? normalizeStateCcEmails(draft?.stateCcEmails)
        : stateCcEditorToMapping(stateCcEditor),
  };
}

export function validateSettingsPayload(settings) {
  const adminEmails = normalizeEmailList(settings?.adminEmails);
  if (!adminEmails.length) {
    return 'At least one Admin Email is required to prevent losing admin access.';
  }

  const emailGroups = [
    ['Admin Emails', adminEmails],
    ['Common Mail CC', normalizeEmailList(settings?.commonCc)],
    ...Object.entries(normalizeStateCcEmails(settings?.stateCcEmails)).map(([state, emails]) => [
      `${state} CC`,
      emails,
    ]),
  ];

  for (const [label, emails] of emailGroups) {
    const invalidEmail = emails.find((email) => !isValidEmail(email));
    if (invalidEmail) return `Invalid email address in ${label}: ${invalidEmail}`;
  }

  return '';
}
