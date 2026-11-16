import test from 'node:test';
import assert from 'node:assert/strict';

process.env.AUTH_SECRET =
  'test-secret-for-the-unit-suite-only-0123456789abcdef0123456789abcdef';

const { signSessionToken, verifySessionToken } = await import(
  '../../lib/auth-edge.ts'
);

const payload = { userId: 'user-1', username: 'admin', displayName: 'Test Admin' };

test('sign + verify roundtrip returns the payload', async () => {
  const token = await signSessionToken(payload);
  const verified = await verifySessionToken(token);
  assert.equal(verified?.userId, payload.userId);
  assert.equal(verified?.username, payload.username);
  assert.equal(verified?.displayName, payload.displayName);
});

test('tampered token is rejected', async () => {
  const token = await signSessionToken(payload);
  const parts = token.split('.');
  // Flip a character in the signature segment
  const sig = parts[2];
  parts[2] = (sig[0] === 'a' ? 'b' : 'a') + sig.slice(1);
  assert.equal(await verifySessionToken(parts.join('.')), null);
});

test('garbage token is rejected (not an exception)', async () => {
  assert.equal(await verifySessionToken('not-a-jwt'), null);
});

test('token signed for a different secret is rejected', async () => {
  const token = await signSessionToken(payload);
  process.env.AUTH_SECRET =
    'a-completely-different-secret-also-long-enough-0123456789abcdef';
  assert.equal(await verifySessionToken(token), null);
  // Restore for any subsequent tests
  process.env.AUTH_SECRET =
    'test-secret-for-the-unit-suite-only-0123456789abcdef0123456789abcdef';
});
