'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { createAccountVerifier } = require('../mock-draft-account-auth');

async function main() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const seconds = 1800000000;
  let fetches = 0;
  const verify = createAccountVerifier({ projectId: 'test-project', now: () => seconds * 1000,
    fetch: async url => {
      assert.match(url, /^https:\/\/www.googleapis.com\/robot\//);
      fetches += 1;
      return { ok: true, headers: { get: () => 'max-age=3600' },
        json: async () => ({ test: publicKey.export({ type: 'spki', format: 'pem' }) }) };
    } });
  const claims = { sub: 'account-uid', name: 'AccountUsername', aud: 'test-project',
    iss: 'https://securetoken.google.com/test-project', iat: seconds - 10, auth_time: seconds - 20, exp: seconds + 100 };
  function token(changes = {}, header = {}) {
    const data = [JSON.stringify({ alg: 'RS256', kid: 'test', ...header }), JSON.stringify({ ...claims, ...changes })]
      .map(value => Buffer.from(value).toString('base64url')).join('.');
    return `${data}.${crypto.sign('RSA-SHA256', Buffer.from(data), privateKey).toString('base64url')}`;
  }
  const request = value => ({ get: () => value && `Bearer ${value}` });
  assert.deepEqual(await verify(request(token())), { uid: 'account-uid', username: 'AccountUsername' });
  await verify(request(token()));
  assert.equal(fetches, 1, 'Public certificates are cached, tokens never sent to Google');
  for (const changes of [{ exp: seconds }, { aud: 'other' }, { iss: 'wrong' }, { sub: '' },
    { iat: seconds + 1 }, { auth_time: seconds + 1 }, { name: '' }]) {
    await assert.rejects(verify(request(token(changes))));
  }
  await assert.rejects(verify(request(token({}, { alg: 'none' }))));
  await assert.rejects(verify(request(token({}, { kid: '__proto__' }))));
  await assert.rejects(verify(request(null)));
  const valid = token();
  const parts = valid.split('.');
  parts[1] = Buffer.from(JSON.stringify({ ...claims, name: 'Impersonated' })).toString('base64url');
  await assert.rejects(verify(request(parts.join('.'))), /signature/);
  console.log('Firebase account verifier: signed username/UID, signature tampering, issuer, audience, expiry, auth time, algorithm and cert caching passed.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
