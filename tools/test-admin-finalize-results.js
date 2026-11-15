'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '..', 'admin-mock-draft-scoring.js'), 'utf8');
const handler = source.slice(source.indexOf("  document.getElementById('finalizeActualResultsBtn').addEventListener"),
  source.indexOf("  document.getElementById('saveActualResultsBtn').addEventListener"));

async function main() {
  for (const scenario of ['success', 'cancel', 'test-type', 'wrong-year',
    'dirty-builder', 'no-entries', 'draft-only', 'incomplete', 'short-results', 'save-fails']) {
    let click;
    const calls = [];
    const state = {
      contestId: 'contest-2027', datasetId: 'real-nfl', year: 2027, type: 'real',
      status: 'paused', rules: { exact: 15 }, mocks: [{ status: 'submitted' }],
      results: Array.from({ length: 32 }, (_, i) => ({
        pick: i + 1, playerId: `player-${i}`, playerName: `Player ${i}`,
        position: 'QB', originalTeam: 'KC', selectingTeam: 'KC', confirmed: false
      }))
    };
    if (scenario === 'test-type') state.type = 'test';
    if (scenario === 'wrong-year') state.year = 2025;
    if (scenario === 'no-entries') state.mocks = [];
    if (scenario === 'draft-only') state.mocks[0].status = 'draft';
    if (scenario === 'incomplete') state.results[4].playerId = '';
    if (scenario === 'short-results') state.results.pop();
    const original = JSON.stringify(state);
    const location = { href: 'admin-mock-draft.html#scoring' };
    const context = vm.createContext({
      state, location,
      window: { confirm: prompt => { assert.match(prompt, /REAL 2027 NFL/); return scenario !== 'cancel'; } },
      builderDirty: scenario === 'dirty-builder',
      document: { getElementById: () => ({ addEventListener(_event, callback) { click = callback; } }) },
      run: operation => operation(), message() {},
      request: async (action, body, scope) => {
        calls.push({ action, body, scope });
        assert.equal(location.href, 'admin-mock-draft.html#scoring', 'Wait for save before navigation');
        if (scenario === 'save-fails') throw new Error('Save failed');
      }
    });
    vm.runInContext(handler, context);
    if (['success', 'no-entries', 'draft-only'].includes(scenario)) {
      await click();
      assert.equal(calls.length, 1);
      assert.equal(calls[0].action, '/save');
      assert.equal(calls[0].body.status, 'final');
      assert.equal(calls[0].body.confirmReal, true);
      assert.equal(calls[0].body.results.length, 32);
      assert.ok(calls[0].body.results.every(result => result.confirmed));
      assert.equal(calls[0].body.rules, state.rules);
      assert.equal(location.href, 'mock-draft-scoreboard.html');
    } else if (scenario === 'cancel') {
      await click();
      assert.equal(calls.length, 0);
      assert.equal(location.href, 'admin-mock-draft.html#scoring');
    } else {
      await assert.rejects(click(), /REAL NFL|prediction|32 actual|Save failed/i);
      assert.equal(calls.length, scenario === 'save-fails' ? 1 : 0);
      assert.equal(location.href, 'admin-mock-draft.html#scoring');
    }
    assert.equal(JSON.stringify(state), original, 'Keep editor data unchanged until server accepts save');
  }
  console.log('Real results finalize: 32 confirmations, real-results confirmation, final save, navigation, validation and failure preservation passed.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
