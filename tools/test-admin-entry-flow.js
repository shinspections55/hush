'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '..', 'admin-mock-draft-scoring.js'), 'utf8');

async function main() {
  for (const scenario of ['new', 'update', 'cancel', 'submit-fails', 'wrong-contest']) {
    let click;
    const calls = [];
    const answerKey = [{ pick: 1, playerId: 'answer-player' }];
    const context = vm.createContext({
      HushMockDeadline: require('../mock-draft-contest-policy'),
      state: { contestId: 'contest-2027', year: scenario === 'wrong-contest' ? 2025 : 2027, submissionPolicy: { deadline: '2027-04-29T23:30:00.000Z' }, results: answerKey,
        mocks: scenario === 'update' ? [{ id: 'existing', status: 'submitted' }] : [] },
      builderEntryId: scenario === 'update' ? 'existing' : '', builderDirty: true,
      requireSaved() {}, builderIdentity: () => ({ name: 'Expert Example', role: 'expert' }),
      readBuilderMock: async () => ({ picks: [] }),
      document: { getElementById: () => ({ addEventListener(_type, callback) { click = callback; } }) },
      window: { confirm: () => scenario !== 'cancel' },
      run: operation => operation(),
      renderBuilderControls() {}, loadBuilderEntry() {}, message() {},
      request: async (action, body) => {
        calls.push(action);
        if (action === '/entry/save' && !context.builderEntryId) context.state.mocks.push({ id: 'saved', status: 'draft' });
        if (action === '/entry/submit') {
          if (scenario === 'submit-fails') throw new Error('Submission failed');
          context.state.mocks.find(entry => entry.id === body.id).status = 'submitted';
        }
      }
    });
    vm.runInContext(source.slice(source.indexOf("  document.getElementById('saveSubmitEntryBtn').addEventListener"),
      source.indexOf("  document.getElementById('saveAdminMockBtn').addEventListener")), context);
    if (scenario === 'wrong-contest') {
      await assert.rejects(click(), /2027 contest/);
      assert.deepEqual(calls, []);
    } else if (scenario === 'submit-fails') {
      await assert.rejects(click(), /Submission failed/);
      assert.equal(context.builderEntryId, 'saved', 'Failed submission keeps saved draft selected for retry');
      assert.equal(context.state.mocks[0].status, 'draft');
      assert.equal(context.builderDirty, false);
    } else {
      await click();
      assert.deepEqual(calls, scenario === 'cancel' ? [] : scenario === 'update' ? ['/entry/save'] : ['/entry/save', '/entry/submit']);
      if (scenario !== 'cancel') assert.equal(context.state.mocks[0].status, 'submitted');
    }
    assert.equal(context.state.results, answerKey, 'Adding entries never rewrites the answer key');
  }
  console.log('Admin entry flow: save/submit, submitted update, cancel, wrong-year guard, draft retry and answer-key preservation passed.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
