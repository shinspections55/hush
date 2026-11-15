'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const builder = read('mock-draft-contest.js');
const admin = read('admin-mock-draft-scoring.js');
for (const mode of ['embedded', 'standalone']) {
  let click;
  const sent = [];
  const self = {};
  const context = vm.createContext({
    ADMIN_BUILDER_MODE: mode !== 'public',
    window: { parent: mode === 'standalone' ? self : { postMessage: value => sent.push(value) } },
    location: { origin: 'http://localhost:8000' },
    document: { getElementById: () => ({ addEventListener(_type, callback) { click = callback; } }) },
    encodeShareMock: () => 'public-token', exportMockDraft: () => ({}),
    setSaveStatus(text, type) { assert.match(text, /Admin Editor/); assert.equal(type, 'error'); }
  });
  if (mode === 'standalone') context.window.parent = context.window;
  vm.runInContext(builder.slice(builder.indexOf("document.getElementById('reviewMockBtn').addEventListener"),
    builder.indexOf("document.getElementById('downloadMockBtn').addEventListener")), context);
  click({ preventDefault() {} });
  assert.equal(context.location.href, mode === 'public' ? 'mock-draft-summary.html?mock=public-token'
    : mode === 'standalone' ? 'admin-mock-draft.html#scoring' : undefined);
  assert.equal(sent.length, mode === 'embedded' ? 1 : 0);
  if (sent.length) assert.equal(sent[0].type, 'hush-mock-review');
}
assert.match(builder, /await publicContestRequest\('\/api\/mock-draft\/entry'/, 'Public submit uses the authenticated account endpoint');

for (const scenario of ['valid', 'wrong-year', 'empty', 'cancel']) {
  let click;
  let loaded;
  let message;
  const nodes = new Map();
  const context = vm.createContext({
    busy: false, builderReady: true, builderDirty: false, builderEntryId: 'old-entry',
    state: { year: 2027 }, prospects: new Map([['test-player', {}]]),
    localStorage: { getItem: () => JSON.stringify({ picks: Array.from({ length: 32 }, (_, index) =>
      ({ playerId: index ? '' : scenario === 'empty' ? '' : scenario === 'wrong-year' ? 'other-player' : 'test-player' })) }) },
    window: { confirm: () => scenario !== 'cancel' }, location: { origin: 'http://localhost:8000' },
    builderFrame: { contentWindow: { postMessage(value) { loaded = value; } } },
    document: { getElementById(id) {
      if (!nodes.has(id)) nodes.set(id, { addEventListener(_type, callback) { click = callback; } });
      return nodes.get(id);
    } },
    renderBuilderControls() {}, updateActionState() {},
    message(text) { message = text; }
  });
  vm.runInContext(admin.slice(admin.indexOf("  document.getElementById('recoverAdminMockBtn').addEventListener"),
    admin.indexOf("  document.getElementById('cloneAdminMockBtn').addEventListener")), context);
  click();
  assert.equal(Boolean(loaded), scenario === 'valid');
  if (loaded) {
    assert.equal(loaded.picks[0].pick, 1);
    assert.equal(loaded.picks[0].playerId, 'test-player');
    assert.equal(context.builderDirty, true);
    assert.equal(context.builderEntryId, '');
  } else if (scenario !== 'cancel') assert.match(message, /No filled|different prospect/);
}

// The parent supplies the catalog before embedded draft recovery.
assert.match(builder, /!ADMIN_BUILDER_MODE && pick\.playerId && !validIds\.has\(pick\.playerId\)/);
const startup = vm.createContext({ adminContextReady: false, window: { parent: {} } });
vm.runInContext(builder.slice(builder.indexOf('function saveMock()'), builder.indexOf('function restoreMock()')), startup);
vm.runInContext('saveMock()', startup); // No writes/changed messages before the parent supplies contest context.
const html = read('admin-mock-draft.html');
assert.match(html, /id="mockAdminBuilderPanel" open/);
assert.match(html, /<details id="advancedScoringPanel"/);
console.log('Simple results: admin review routing, public identity wiring, local recovery, and startup draft preservation passed.');
