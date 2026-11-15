'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '..', 'admin-mock-draft-scoring.js'), 'utf8');
let loaded;
const context = vm.createContext({
  defaultProspects: new Map(),
  document: { addEventListener(_type, callback) { loaded = callback; } },
  run() {},
});
vm.runInContext(source.slice(source.indexOf('  function slug('), source.indexOf('  function manualId(')), context);
vm.runInContext(source.slice(source.indexOf("  document.addEventListener('mock-admin-boards-loaded'"),
  source.indexOf("  document.getElementById('scoringYear').addEventListener")), context);
loaded({ detail: {
  boards: {
    QB: [{ name: 'Quarterback', school: 'School A' }],
    WR: [{ name: 'Top Receiver', school: 'School B' }, { name: 'Unranked', school: 'School C' }]
  },
  overallOrder: ['top-receiver::school-b', 'missing-player', 'top-receiver::school-b', 'quarterback::school-a']
} });
assert.deepEqual([...context.defaultProspects.keys()], ['top-receiver::school-b', 'quarterback::school-a', 'unranked::school-c']);
assert.equal(context.defaultProspects.get('top-receiver::school-b').position, 'WR');
loaded({ detail: { boards: {}, overallOrder: [] } });
assert.equal(context.defaultProspects.size, 0, 'An empty reload does not retain stale prospects');
console.log('Results ordering: overall rank across positions, duplicates/stale ranks, unranked retention, and empty reload passed.');
