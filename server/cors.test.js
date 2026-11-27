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
  'BLOB_WEBHOOK_PUBLIC_KEY_WEBHOOK_PUBLIC_KEY',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'FACEBOOK_APP_ID',
  'FACEBOOK_APP_SECRET',
  'AUTH_CALLBACK_BASE_URL',
  'PUBLIC_APP_URL'
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

test('password auth reports malformed email addresses without creating accounts', async (context) => {
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  context.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));
  const url = `http://127.0.0.1:${server.address().port}/api/auth`;

  const providersResponse = await fetch(`${url}/providers`);
  assert.deepEqual(await providersResponse.json(), { google: false, facebook: false });

  const unavailableProviderResponse = await fetch(`${url}/google`);
  assert.equal(unavailableProviderResponse.status, 503);

  const registerResponse = await fetch(`${url}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Student', email: 'not-an-email', password: 'password' })
  });
  assert.equal(registerResponse.status, 400);
  assert.match((await registerResponse.json()).error, /البريد الإلكتروني غير صالح/);

  const loginResponse = await fetch(`${url}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'student@example', password: 'password' })
  });
  assert.equal(loginResponse.status, 400);
  assert.match((await loginResponse.json()).error, /البريد الإلكتروني غير صالح/);
});

test('social login advertises only configured providers and protects OAuth state', async (context) => {
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  context.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));
  const url = `http://127.0.0.1:${server.address().port}/api/auth`;
  const previous = {
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    AUTH_CALLBACK_BASE_URL: process.env.AUTH_CALLBACK_BASE_URL,
    PUBLIC_APP_URL: process.env.PUBLIC_APP_URL
  };
  process.env.GOOGLE_CLIENT_ID = 'test-google-client';
  process.env.GOOGLE_CLIENT_SECRET = 'test-only-secret';
  process.env.AUTH_CALLBACK_BASE_URL = 'https://api.example.test';
  process.env.PUBLIC_APP_URL = 'https://app.example.test';

  try {
    const configuredProvidersResponse = await fetch(`${url}/providers`);
    assert.deepEqual(await configuredProvidersResponse.json(), { google: true, facebook: false });

    const startResponse = await fetch(`${url}/google`, { redirect: 'manual' });
    assert.equal(startResponse.status, 302);
    const authorization = new URL(startResponse.headers.get('location'));
    assert.equal(authorization.origin, 'https://accounts.google.com');
    assert.equal(authorization.searchParams.get('redirect_uri'),
      'https://api.example.test/api/auth/google/callback');
    assert.equal(authorization.searchParams.get('client_secret'), null);
    assert.match(startResponse.headers.get('set-cookie'), /HttpOnly/);
    assert.match(startResponse.headers.get('set-cookie'), /Secure/);

    const callbackResponse = await fetch(
      `${url}/google/callback?state=attacker-state&code=fake-code`,
      { headers: { Cookie: 'oauth_state_google=known-state' }, redirect: 'manual' }
    );
    assert.equal(callbackResponse.status, 302);
    assert.equal(callbackResponse.headers.get('location'),
      'https://app.example.test/#oauth_error=invalid_state');

    const exchangeResponse = await fetch(`${url}/exchange`, {
      method: 'POST',
      headers: { Origin: 'https://app.example.test' }
    });
    assert.equal(exchangeResponse.status, 401);

    const untrustedExchangeResponse = await fetch(`${url}/exchange`, {
      method: 'POST',
      headers: { Origin: 'https://attacker.example' }
    });
    assert.equal(untrustedExchangeResponse.status, 403);
  } finally {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});
