import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET = 'test-only-secret-with-at-least-32-characters';
process.env.VERCEL = '1';
process.env.NODE_ENV = 'production';
process.env.CORS_ORIGINS = 'https://app.example.test';
for (const name of [
  'DATABASE_URL',
  'POSTGRES_URL',
  'BLOB_WEBHOOK_PUBLIC_KEY_STORE_ID',
  'BLOB_WEBHOOK_PUBLIC_KEY_READ_WRITE_TOKEN',
  'BLOB_WEBHOOK_PUBLIC_KEY_WEBHOOK_PUBLIC_KEY'
]) delete process.env[name];

const { default: app } = await import('./index.js');

test('credentialed CORS accepts only exact Capacitor and configured origins', async (context) => {
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  context.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));
  const url = `http://127.0.0.1:${server.address().port}/cors-check`;

  const checkOrigin = (origin) => fetch(url, {
    method: 'OPTIONS',
    headers: {
      ...(origin ? { Origin: origin } : {}),
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'authorization'
    }
  });

  for (const origin of ['capacitor://localhost', 'https://app.example.test']) {
    const response = await checkOrigin(origin);
    assert.equal(response.headers.get('access-control-allow-origin'), origin);
    assert.equal(response.headers.get('access-control-allow-credentials'), 'true');
  }

  for (const origin of ['https://untrusted.example', 'http://localhost:5173', null]) {
    const response = await checkOrigin(origin);
    assert.equal(response.headers.get('access-control-allow-origin'), null);
    assert.equal(response.headers.get('access-control-allow-credentials'), null);
  }
});
