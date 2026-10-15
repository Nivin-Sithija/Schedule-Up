import test from 'node:test';
import assert from 'node:assert/strict';
import { createPairingController } from '../src/pairing.js';
const image = { mimetype: 'image/png', data: 'test-image' };
test('expired failed pairing restarts and waits for a fresh QR', async () => {
  const calls: string[] = [];
  const controller = createPairingController(async (path, method = 'GET') => {
    calls.push(`${method} ${path}`);
    if (path === '/api/sessions?all=true') return [{ name: 'default', status: 'FAILED' }];
    if (path.endsWith('/restart')) return { status: 'STARTING' };
    if (path === '/api/sessions/default') return { status: 'SCAN_QR_CODE' };
    return image;
  }, async () => {}, 'default', async () => {});
  assert.deepEqual(await controller.qr(), { status: 'SCAN_QR_CODE', ...image });
  assert.deepEqual(calls, ['GET /api/sessions?all=true', 'POST /api/sessions/default/restart', 'GET /api/sessions/default', 'GET /api/default/auth/qr?format=image']);
});
test('connected account is verified and never restarted to obtain a QR', async () => {
  let verified = 0;
  const controller = createPairingController(async (path) => {
    assert.equal(path, '/api/sessions?all=true'); return [{ name: 'default', status: 'WORKING' }];
  }, async () => { verified++; }, 'default');
  assert.deepEqual(await controller.qr(), { status: 'WORKING' });
  assert.ok(verified > 0);
});
test('wrong paired owner is rejected without requesting a QR', async () => {
  const controller = createPairingController(async () => [{ name: 'default', status: 'WORKING' }], async () => { throw new Error('Wrong owner'); }, 'default');
  await assert.rejects(controller.qr(), /Wrong owner/);
});
test('concurrent QR requests share one recovery and failures allow another attempt', async () => {
  let calls = 0;
  const controller = createPairingController(async (path) => {
    if (path === '/api/sessions?all=true') { calls++; return [{ name: 'default', status: 'SCAN_QR_CODE' }]; }
    if (calls === 1) throw new Error('Transient connector failure');
    return image;
  }, async () => {}, 'default');
  const a = controller.qr(), b = controller.qr(); assert.equal(a, b);
  await assert.rejects(a, /Transient/);
  assert.deepEqual(await controller.qr(), { status: 'SCAN_QR_CODE', ...image });
  assert.equal(calls, 2);
});
