import test from 'node:test';
import assert from 'node:assert/strict';
import settingsRouter from './settings.routes.js';
import { requireAdmin } from '../middleware/auth.js';

test('settings update route remains protected by admin authorization', () => {
  const updateLayer = settingsRouter.stack.find(
    (layer) => layer.route?.path === '/' && layer.route?.methods?.put
  );

  assert.ok(updateLayer, 'PUT /api/settings route should exist');
  assert.equal(updateLayer.route.stack[0].handle, requireAdmin);
});

test('settings update authorization rejects a request without a user identity', async () => {
  let statusCode;
  let responseBody;
  const req = { headers: {} };
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(body) {
      responseBody = body;
      return this;
    },
  };
  let nextCalled = false;

  await requireAdmin(req, res, () => {
    nextCalled = true;
  });

  assert.equal(statusCode, 401);
  assert.equal(responseBody?.success, false);
  assert.equal(nextCalled, false);
});
