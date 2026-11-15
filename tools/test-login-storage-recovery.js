'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const helper = fs.readFileSync(path.join(root, 'public', 'login-storage-recovery.js'), 'utf8')
  .replace(/export function /g, 'function ')
  .replace(/export async function /g, 'async function ');
const quota = () => Object.assign(new Error('storage full'), { name: 'QuotaExceededError' });

async function runLogin(file, { cache, failAgain = false, credentialError = null }) {
  const entries = new Map([
    ['completedDrafts', 'saved-drafts'], ['userRankings', 'saved-rankings'],
    ['firebase:existing', 'saved-auth'], ...(cache ? [['silentDraftDefaultRankingsCache', 'cache']] : [])
  ]);
  const localStorage = {
    getItem: key => entries.has(key) ? entries.get(key) : null,
    setItem: (key, value) => entries.set(key, String(value)),
    removeItem: key => entries.delete(key)
  };
  const session = new Map();
  const sessionStorage = {
    getItem: key => session.get(key) || null,
    setItem: (key, value) => session.set(key, value),
    removeItem: key => session.delete(key)
  };
  let submit;
  let attempts = 0;
  let fallbacks = 0;
  const alerts = [];
  const errors = [];
  const button = { textContent: 'Login', disabled: false };
  const form = {
    querySelector: selector => selector === 'button[type="submit"]' ? button : null,
    addEventListener: (event, handler) => { if (event === 'submit') submit = handler; }
  };
  const document = {
    addEventListener: (event, handler) => { if (event === 'DOMContentLoaded') handler(); },
    getElementById: id => id === 'loginForm' ? form : id === 'rememberPassword' ? { checked: true } : null,
    querySelectorAll: () => []
  };
  const context = {
    localStorage, sessionStorage, document,
    window: { addEventListener() {}, location: { href: '' } },
    FormData: class { get(key) { return key === 'identifier' ? 'test@example.test' : 'password'; } },
    alert: message => alerts.push(message),
    console: { error(error) { errors.push(String(error)); }, warn() {} },
    setTimeout, clearTimeout, AbortController,
    requireFirebaseAuth: () => ({}), browserLocalPersistence: {}, browserSessionPersistence: {},
    setPersistence: async () => {},
    signInWithEmailAndPassword: async () => {
      attempts++;
      if (credentialError) throw credentialError;
      if (attempts === 1 || failAgain) throw quota();
      return { user: {} };
    },
    syncSessionFromUser: () => ({ username: 'Alice' }),
    formatAuthError: (error, fallback) => error.message || fallback,
    fetch: async url => {
      if (String(url).startsWith('/api/auth/resolve-login')) {
        return { ok: true, json: async () => ({ ok: true, email: 'test@example.test' }) };
      }
      fallbacks++;
      return { ok: false, json: async () => ({ error: 'Invalid username or password' }) };
    }
  };
  const script = fs.readFileSync(path.join(root, file), 'utf8')
    .replace(/^import\s*\{[\s\S]*?\}\s*from\s*['"][^'"]+['"];\s*/gm, '');
  vm.runInNewContext(`${helper}\n${script}`, context);
  submit({ preventDefault() {}, target: form });
  for (let i = 0; i < 10; i++) await new Promise(resolve => setImmediate(resolve));
  assert.equal(entries.get('completedDrafts'), 'saved-drafts');
  assert.equal(entries.get('userRankings'), 'saved-rankings');
  assert.equal(entries.get('firebase:existing'), 'saved-auth');
  return { entries, attempts, fallbacks, alerts, errors, location: context.window.location.href, button };
}

(async () => {
  for (const file of ['scripts.js', 'public\\scripts.js']) {
    const success = await runLogin(file, { cache: true });
    assert.equal(success.attempts, 2, JSON.stringify(success.errors));
    assert.equal(success.entries.has('silentDraftDefaultRankingsCache'), false);
    assert.equal(success.location, 'dashboard.html');
    assert.equal(success.fallbacks, 0);

    for (const options of [{ cache: false }, { cache: true, failAgain: true }]) {
      const failure = await runLogin(file, options);
      assert.match(failure.alerts[0], /Browser storage is full/);
      assert.equal(failure.fallbacks, 0);
      assert.equal(failure.button.disabled, false);
    }

    const invalid = await runLogin(file, { cache: true, credentialError: new Error('Bad credentials') });
    assert.equal(invalid.entries.has('silentDraftDefaultRankingsCache'), true);
    assert.equal(invalid.fallbacks, 1);
  }
  console.log('Login storage recovery tests passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
