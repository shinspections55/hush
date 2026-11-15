'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

async function main() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'admin-mock-draft-scoring.js'), 'utf8');
  for (const [status, submitted, allowed] of [['paused', true, false], ['final', false, false], ['live', true, true]]) {
    const nodes = new Map();
    const get = id => {
      if (!nodes.has(id)) nodes.set(id, { addEventListener(_name, callback) { this.click = callback; } });
      return nodes.get(id);
    };
    let requests = 0;
    const context = vm.createContext({
      state: { year: 2027, status, mocks: submitted ? [{ status: 'submitted' }] : [], submissions: 'open' },
      busy: false, builderReady: true, builderDirty: false, builderEntryId: '',
      document: { getElementById: get, querySelectorAll: () => [] },
      resultsBody: { querySelectorAll: () => [] },
      run: operation => operation(), requireSaved() {}, message() {},
      request: async () => { requests += 1; }
    });
    vm.runInContext(source.slice(source.indexOf('  function updateActionState()'), source.indexOf('  function renderBuilderControls()')), context);
    vm.runInContext('updateActionState()', context);
    assert.equal(get('scoreAllMocksBtn').disabled, !allowed);
    assert.equal(get('scoringActionHint').textContent.length > 0, !allowed);
    vm.runInContext(source.slice(source.indexOf("  document.getElementById('scoreAllMocksBtn').addEventListener"),
      source.indexOf("  document.getElementById('scoringMockFiles').addEventListener")), context);
    if (allowed) await get('scoreAllMocksBtn').click();
    else await assert.rejects(get('scoreAllMocksBtn').click(), status === 'paused' ? /paused/ : /No submitted mocks/);
    assert.equal(requests, allowed ? 1 : 0);
  }
  console.log('Score guidance: paused/empty requests blocked, submitted live rescoring retained.');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
