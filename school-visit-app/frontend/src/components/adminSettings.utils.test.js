import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSettingsPayload,
  listToText,
  normalizeEmailList,
  normalizeList,
  normalizeSettingsForForm,
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
