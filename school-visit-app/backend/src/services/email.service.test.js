import test from 'node:test';
import assert from 'node:assert/strict';
import { buildVisitReportEmailOptions, mergeEmailLists } from './email.service.js';

test('merges PM, global, selected-state, and explicit CC without duplicates', () => {
  const recipients = mergeEmailLists(
    'pm@example.com',
    ['global@example.com', 'DUPLICATE@example.com'],
    ['state@example.com', 'duplicate@example.com'],
    'explicit@example.com, PM@example.com'
  );

  assert.deepEqual(recipients, [
    'pm@example.com',
    'global@example.com',
    'duplicate@example.com',
    'state@example.com',
    'explicit@example.com',
  ]);
});

test('ignores empty and malformed optional CC values', () => {
  assert.deepEqual(mergeEmailLists('', [], null, 'not-an-email'), []);
});

test('initial report delivery options include the selected report state', () => {
  const options = buildVisitReportEmailOptions(
    {
      state: 'Tamil Nadu',
      schoolEmail: 'school@example.com',
      programManagerEmail: 'pm@example.com',
      ccEmails: 'extra@example.com',
    },
    { subject: 'Initial report', html: '<p>Report</p>', pdfBuffer: Buffer.from('pdf') }
  );

  assert.equal(options.state, 'Tamil Nadu');
  assert.equal(options.to, 'school@example.com');
  assert.equal(options.cc, 'extra@example.com');
  assert.equal(options.replyTo, 'pm@example.com');
});

test('admin resend delivery options retain the saved report state', () => {
  const savedReport = {
    state: 'Karnataka',
    schoolEmail: 'school@example.com',
    programManagerEmail: 'pm@example.com',
    ccEmails: ['extra@example.com'],
  };
  const options = buildVisitReportEmailOptions(savedReport, {
    subject: 'Resent report',
    html: '<p>Report</p>',
  });

  assert.equal(options.state, 'Karnataka');
  assert.deepEqual(options.cc, ['extra@example.com']);
});
