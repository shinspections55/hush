'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

async function main() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'admin-mock-draft-scoring.js'), 'utf8');
  let click;
  let confirmed = false;
  let warning = '';
  const calls = [];
  const context = vm.createContext({
    state: { contestId: 'failed-test', contestName: 'Failed 2027', year: 2027,
      mocks: [{ id: 'my-mock' }], contests: [{ id: 'failed-test', datasets: [{}, {}] }] },
    dirty: true, builderDirty: true,
    document: { getElementById: () => ({ addEventListener(_name, callback) { click = callback; } }) },
    window: { confirm(text) { warning = text; return confirmed; } },
    run: operation => operation(),
    request: async (...args) => { calls.push(args); },
    message() {}
  });
  vm.runInContext(source.slice(source.indexOf("  document.getElementById('deleteScoringContestBtn').addEventListener"),
    source.indexOf("  document.getElementById('createScoringContestBtn').addEventListener")), context);
  await click();
  assert.equal(calls.length, 0, 'Cancel never deletes');
  assert.match(warning, /Failed 2027/);
  assert.match(warning, /1 saved mock entries/);
  assert.match(warning, /2 results datasets/);
  assert.match(warning, /Unsaved edits/);
  confirmed = true;
  await click();
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], '/contest/delete');
  assert.equal(calls[0][1].confirmDelete, 'failed-test');
  context.state.contestId = 'contest-2027';
  await assert.rejects(click(), /main contest cannot be deleted/);
  assert.equal(calls.length, 1);
  console.log('Contest delete UI: confirmation, cancel, counts, unsaved warning, and main-contest protection passed.');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
