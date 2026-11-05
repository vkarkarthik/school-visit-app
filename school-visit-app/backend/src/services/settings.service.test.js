import test from 'node:test';
import assert from 'node:assert/strict';
import { AppSettings } from '../models/AppSettings.js';
import {
  normalizeSettingsDocument,
  normalizeStateKey,
  requireAdminEmails,
  requireValidStateCcEmails,
  resolveStateCcEmails,
  saveAppSettings,
} from './settings.service.js';

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

test('normalizes state CC settings while preserving empty state lists', () => {
  const settings = normalizeSettingsDocument({
    adminEmails: ['admin@example.com'],
    commonCc: [],
    stateCcEmails: {
      'Tamil Nadu': 'TNLEAD@example.com, second@example.com',
      Karnataka: [],
    },
  });

  assert.deepEqual(settings.stateCcEmails, {
    'Tamil Nadu': ['tnlead@example.com', 'second@example.com'],
    Karnataka: [],
  });
  assert.deepEqual(normalizeSettingsDocument({}).stateCcEmails, {});
});

test('resolves only the selected state with unambiguous aliases', () => {
  const mapping = {
    'Tamil Nadu': ['tn@example.com'],
    Karnataka: ['ka@example.com'],
    'Telangana/AP': ['combined@example.com'],
    Telangana: ['telangana@example.com'],
    'Andhra Pradesh': ['ap@example.com'],
  };

  assert.deepEqual(resolveStateCcEmails(mapping, ' TN '), ['tn@example.com']);
  assert.deepEqual(resolveStateCcEmails(mapping, 'k-a'), ['ka@example.com']);
  assert.deepEqual(resolveStateCcEmails(mapping, 'Telangana / AP'), ['combined@example.com']);
  assert.deepEqual(resolveStateCcEmails(mapping, 'Telangana'), ['telangana@example.com']);
  assert.deepEqual(resolveStateCcEmails(mapping, 'Andhra Pradesh'), ['ap@example.com']);
  assert.deepEqual(resolveStateCcEmails(mapping, 'Kerala'), []);
  assert.notEqual(normalizeStateKey('Telangana/AP'), normalizeStateKey('Telangana'));
});

test('rejects invalid state CC addresses with a client error', () => {
  assert.throws(
    () => requireValidStateCcEmails({ Karnataka: ['not-an-email'] }),
    (error) => error.statusCode === 400 && error.message === 'Invalid email address in Karnataka CC: not-an-email'
  );
});

test('saves and reloads state CC settings with update validation enabled', async () => {
  const originalFindOneAndUpdate = AppSettings.findOneAndUpdate;
  let capturedUpdate;
  let capturedOptions;

  AppSettings.findOneAndUpdate = async (_filter, update, options) => {
    capturedUpdate = update;
    capturedOptions = options;
    return update;
  };

  try {
    const saved = await saveAppSettings(
      {
        adminEmails: ['admin@example.com'],
        commonCc: ['global@example.com'],
        stateCcEmails: {
          'Tamil Nadu': ['TN@example.com'],
          Karnataka: [],
        },
        programManagers: [],
        workModes: ['School Visit'],
        visitPurposes: ['Training'],
        priorities: ['Normal'],
      },
      'admin@example.com'
    );

    assert.deepEqual(capturedUpdate.stateCcEmails, {
      'Tamil Nadu': ['tn@example.com'],
      Karnataka: [],
    });
    assert.equal(capturedOptions.runValidators, true);
    assert.deepEqual(saved.stateCcEmails, capturedUpdate.stateCcEmails);
  } finally {
    AppSettings.findOneAndUpdate = originalFindOneAndUpdate;
  }
});
