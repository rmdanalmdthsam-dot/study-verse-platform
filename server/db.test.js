import { createHmac } from 'crypto';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

process.env.JWT_SECRET = 'test-only-secret-with-at-least-32-characters';

const {
  createMediaToken,
  createToken,
  getMediaTokenClaims,
  verifyMediaToken,
  verifyToken
} = await import('./db.js');
const repoRoot = fileURLToPath(new URL('../', import.meta.url));

test('server database refuses to load without a configured JWT secret', () => {
  const env = { ...process.env, JWT_SECRET: '' };
  const result = spawnSync(process.execPath, [
    '--input-type=module',
    '-e',
    "import('./server/db.js')"
  ], { cwd: repoRoot, env, encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /JWT_SECRET must be configured/);
});

function signedPayload(payload, prefix = '') {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', process.env.JWT_SECRET)
    .update(`${prefix}${encoded}`)
    .digest('base64url');
  return `${encoded}.${signature}`;
}

test('account tokens require a signed, finite future expiration', () => {
  assert.equal(verifyToken(createToken('student-1')), 'student-1');
  assert.equal(verifyToken(signedPayload({ userId: 'student-1', jti: 'session-1' })), null);
  assert.equal(verifyToken(signedPayload({ userId: 'student-1', jti: 'session-1', exp: 'tomorrow' })), null);
  assert.equal(verifyToken(signedPayload({ userId: 'student-1', jti: 'session-1', exp: Date.now() - 1 })), null);
  assert.equal(verifyToken(`${createToken('student-1')}.extra`), null);
});

test('media tokens are short-lived and scoped to one owner and file', () => {
  const token = createMediaToken('student-1', 'file-1', 'session-1');
  assert.equal(verifyMediaToken(token, 'file-1'), 'student-1');
  assert.equal(getMediaTokenClaims(token, 'file-1').sessionId, 'session-1');
  assert.equal(verifyMediaToken(token, 'file-2'), null);
  assert.equal(verifyMediaToken(createToken('student-1'), 'file-1'), null);
  assert.equal(verifyMediaToken(signedPayload({
    purpose: 'file-content',
    userId: 'student-1',
    fileId: 'file-1',
    sessionId: 'session-1',
    exp: Date.now() - 1
  }, 'media:'), 'file-1'), null);
});
