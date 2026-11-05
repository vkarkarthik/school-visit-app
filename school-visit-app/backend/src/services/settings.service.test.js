import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSettingsDocument, requireAdminEmails } from './settings.service.js';

test('preserves intentionally empty admin and CC arrays', () => {
  const settings = normalizeSettingsDocument({ adminEmails: [], commonCc: [] });
  assert.deepEqual(settings.adminEmails, []);
  assert.deepEqual(settings.commonCc, []);
});

test('uses defaults only when email fields are missing', () => {
  const settings = normalizeSettingsDocument({});
  assert.ok(settings.adminEmails.length > 0);
  assert.equal(Array.isArray(settings.commonCc), true);
});

test('normalizes legacy string fields without modifying the stored record', () => {
  const legacyRecord = {
    adminEmails: 'ADMIN@EXAMPLE.COM, second@example.com',
    commonCc: 'CC@EXAMPLE.COM, other@example.com',
    programManagers: 'invalid-legacy-value',
  };

  const settings = normalizeSettingsDocument(legacyRecord);
  assert.deepEqual(settings.adminEmails, ['admin@example.com', 'second@example.com']);
  assert.deepEqual(settings.commonCc, ['cc@example.com', 'other@example.com']);
  assert.deepEqual(settings.programManagers, []);
  assert.equal(legacyRecord.commonCc, 'CC@EXAMPLE.COM, other@example.com');
});

test('rejects saving an empty admin email list with a client error', () => {
  assert.throws(
    () => requireAdminEmails([]),
    (error) =>
      error.statusCode === 400 &&
      error.message === 'At least one Admin Email is required to prevent losing admin access.'
  );
  assert.deepEqual(requireAdminEmails('ADMIN@example.com'), ['admin@example.com']);
});
