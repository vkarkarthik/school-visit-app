import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSettingsPayload,
  createStateCcEditor,
  listToText,
  normalizeEmailList,
  normalizeList,
  normalizeSettingsForForm,
  normalizeStateCcEmails,
  normalizeStateKey,
  stateCcEditorToMapping,
  settingsSignature,
  validateSettingsPayload,
} from './adminSettings.utils.js';

test('normalizes email strings and arrays into deduplicated lowercase arrays', () => {
  assert.deepEqual(normalizeEmailList(' First@Example.com, second@example.com\nFIRST@example.com '), [
    'first@example.com',
    'second@example.com',
  ]);
  assert.deepEqual(normalizeEmailList(['One@Example.com', 'one@example.com', 'two@example.com']), [
    'one@example.com',
    'two@example.com',
  ]);
});

test('list rendering is safe for strings, nulls, and unexpected scalar values', () => {
  assert.equal(listToText('One, Two'), 'One\nTwo');
  assert.equal(listToText(null), '');
  assert.equal(listToText(42), '42');
});

test('normalizes malformed settings fields without changing dropdown semantics', () => {
  const normalized = normalizeSettingsForForm({
    adminEmails: 'ADMIN@EXAMPLE.COM',
    commonCc: null,
    programManagers: 'not-an-array',
    workModes: 'Travel, Other',
    visitPurposes: { invalid: true },
    priorities: 'High\nNormal',
  });

  assert.deepEqual(normalized.adminEmails, ['admin@example.com']);
  assert.deepEqual(normalized.commonCc, []);
  assert.deepEqual(normalized.programManagers, []);
  assert.deepEqual(normalized.workModes, ['School Visit', 'Travel', 'Other']);
  assert.deepEqual(normalized.priorities, ['High', 'Normal']);
  assert.equal(Array.isArray(normalized.visitPurposes), true);
});

test('equivalent settings have a stable synchronization signature', () => {
  const first = { adminEmails: ['ADMIN@example.com'], commonCc: ['cc@example.com'] };
  const second = { adminEmails: 'admin@example.com', commonCc: 'cc@example.com' };
  assert.equal(settingsSignature(first), settingsSignature(second));
});

test('empty email lists remain valid arrays', () => {
  const normalized = normalizeSettingsForForm({ adminEmails: [], commonCc: [] });
  assert.deepEqual(normalized.adminEmails, []);
  assert.deepEqual(normalized.commonCc, []);
  assert.deepEqual(normalizeList('', { keepSchoolVisit: true }), ['School Visit']);
});

test('builds a canonical array-typed payload from editable email text', () => {
  const payload = buildSettingsPayload(
    {
      adminEmails: ['old-admin@example.com'],
      commonCc: ['old-cc@example.com'],
      programManagers: [{ name: 'PM One', email: 'pm@example.com', active: true }],
      workModes: ['School Visit', 'Travel'],
      visitPurposes: ['Training'],
      priorities: ['Normal'],
    },
    {
      adminEmails: 'NEW-ADMIN@example.com, second@example.com',
      commonCc: '',
    }
  );

  assert.deepEqual(payload.adminEmails, ['new-admin@example.com', 'second@example.com']);
  assert.deepEqual(payload.commonCc, []);
  assert.equal(Array.isArray(payload.programManagers), true);
  assert.equal(Array.isArray(payload.workModes), true);
});

test('rejects an empty admin email list before saving', () => {
  assert.equal(
    validateSettingsPayload({ adminEmails: [] }),
    'At least one Admin Email is required to prevent losing admin access.'
  );
  assert.equal(validateSettingsPayload({ adminEmails: ['admin@example.com'] }), '');
});

test('normalizes state CC mappings without merging distinct states', () => {
  assert.equal(normalizeStateKey(' TN '), 'tamilnadu');
  assert.equal(normalizeStateKey('Tamil-Nadu'), 'tamilnadu');
  assert.equal(normalizeStateKey('KA'), 'karnataka');
  assert.notEqual(normalizeStateKey('Telangana/AP'), normalizeStateKey('Telangana'));
  assert.notEqual(normalizeStateKey('Telangana/AP'), normalizeStateKey('Andhra Pradesh'));

  assert.deepEqual(
    normalizeStateCcEmails({
      'Tamil Nadu': ['TNLEAD@EXAMPLE.COM'],
      Karnataka: [],
      'Telangana/AP': ['combined@example.com'],
    }),
    {
      'Tamil Nadu': ['tnlead@example.com'],
      Karnataka: [],
      'Telangana/AP': ['combined@example.com'],
    }
  );
});

test('preserves independent unsaved state CC edits and empty lists', () => {
  const editor = createStateCcEditor({
    'Tamil Nadu': ['tn@example.com'],
    Karnataka: ['ka@example.com'],
  });
  editor.tamilnadu.text = 'new-tn@example.com, SECOND@example.com';
  editor.karnataka.text = '';

  assert.deepEqual(stateCcEditorToMapping(editor), {
    'Tamil Nadu': ['new-tn@example.com', 'second@example.com'],
    Karnataka: [],
  });
});

test('includes state CC arrays in the settings payload and reload normalization', () => {
  const payload = buildSettingsPayload(
    {
      adminEmails: ['admin@example.com'],
      commonCc: [],
      stateCcEmails: {},
    },
    { adminEmails: 'admin@example.com', commonCc: 'global@example.com' },
    {
      tamilnadu: { state: 'Tamil Nadu', text: 'tn@example.com' },
      karnataka: { state: 'Karnataka', text: '' },
    }
  );

  assert.deepEqual(payload.stateCcEmails, {
    'Tamil Nadu': ['tn@example.com'],
    Karnataka: [],
  });
  assert.deepEqual(normalizeSettingsForForm(payload).stateCcEmails, payload.stateCcEmails);
});

test('rejects invalid global and state CC email addresses', () => {
  assert.equal(
    validateSettingsPayload({
      adminEmails: ['admin@example.com'],
      commonCc: ['not-an-email'],
      stateCcEmails: {},
    }),
    'Invalid email address in Common Mail CC: not-an-email'
  );
  assert.equal(
    validateSettingsPayload({
      adminEmails: ['admin@example.com'],
      commonCc: [],
      stateCcEmails: { Karnataka: ['broken-address'] },
    }),
    'Invalid email address in Karnataka CC: broken-address'
  );
});
