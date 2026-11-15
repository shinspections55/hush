'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

function createAccountVerifier(options = {}) {
  const config = fs.readFileSync(path.join(__dirname, 'firebase-config.js'), 'utf8');
  const projectId = options.projectId || process.env.FIREBASE_PROJECT_ID || config.match(/projectId:\s*['"]([^'"]+)['"]/)?.[1];
  if (!projectId) throw new Error('Firebase project ID is required for mock draft submissions');
  const fetchKeys = options.fetch || fetch;
  const now = options.now || Date.now;
  let certificates = {};
  let expiresAt = 0;
  let pendingKeys;
  return async function verifyAccount(req) {
    const token = /^Bearer ([A-Za-z0-9_.-]+)$/.exec(req.get('authorization') || '')?.[1];
    if (!token || token.length > 16000) throw new Error('Sign in to submit or view your contest mock.');
    const parts = token.split('.');
    if (parts.length !== 3) throw new Error('Invalid sign-in token. Sign in again.');
    let header;
    let claims;
    try {
      header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
      claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    } catch {
      throw new Error('Invalid sign-in token. Sign in again.');
    }
    const seconds = Math.floor(now() / 1000);
    if (header.alg !== 'RS256' || typeof header.kid !== 'string' ||
        claims.aud !== projectId || claims.iss !== `https://securetoken.google.com/${projectId}` ||
        typeof claims.sub !== 'string' || !claims.sub || claims.sub.length > 128 ||
        !Number.isFinite(claims.exp) || claims.exp <= seconds ||
        !Number.isFinite(claims.iat) || claims.iat > seconds ||
        !Number.isFinite(claims.auth_time) || claims.auth_time > seconds) {
      throw new Error('Expired or invalid sign-in token. Sign in again.');
    }
    if (expiresAt <= now()) {
      if (!pendingKeys) {
        pendingKeys = (async () => {
          const response = await fetchKeys('https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com',
            { signal: AbortSignal.timeout(10000) });
          if (!response.ok) throw new Error('Unable to verify sign-in right now. Try again.');
          certificates = await response.json();
          const maxAge = Number(/max-age=(\d+)/.exec(response.headers.get('cache-control') || '')?.[1] || 300);
          expiresAt = now() + Math.min(maxAge, 21600) * 1000;
        })().finally(() => { pendingKeys = null; });
      }
      await pendingKeys;
    }
    const certificate = Object.hasOwn(certificates, header.kid) && certificates[header.kid];
    if (typeof certificate !== 'string' ||
        !crypto.verify('RSA-SHA256', Buffer.from(`${parts[0]}.${parts[1]}`), certificate, Buffer.from(parts[2], 'base64url'))) {
      throw new Error('Invalid sign-in signature. Sign in again.');
    }
    const username = typeof claims.name === 'string' ? claims.name.trim() : '';
    if (!username || username.length > 160) throw new Error('Set your account username before entering the mock contest.');
    return { uid: claims.sub, username };
  };
}

module.exports = { createAccountVerifier };
