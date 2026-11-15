'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { makeFixture } = require('./mock-contest-fixture');
const source = fs.readFileSync(path.join(__dirname, '..', 'admin-mock-draft-scoring.js'), 'utf8');
const elements = new Map();
function element(tag = 'div') {
  return {
    tag, children: [], events: {}, dataset: {}, value: '', disabled: false,
    append(...children) { this.children.push(...children); },
    replaceChildren() { this.children = []; },
    get options() { return this.children; },
    setAttribute(name, value) { this[name] = value; },
    addEventListener(name, callback) { this.events[name] = callback; },
    querySelectorAll(selector) {
      return this.children.flatMap(child => [
        ...(selector === 'select[data-result-player]' && child.tag === 'select' && child.dataset.resultPlayer ? [child] : []),
        ...child.querySelectorAll(selector)
      ]);
    }
  };
}
const document = {
  createElement: element,
  getElementById(id) { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); }
};
const catalog = makeFixture().catalog;
const context = vm.createContext({
  resultsPosition: 'ALL',
  document, state: {
    year: 2027, rules: {}, mocks: [], results: Array.from({ length: 32 }, (_, index) => ({
      pick: index + 1, originalTeam: 'TEN', selectingTeam: 'TEN', playerId: '', playerName: '',
      position: '', confirmed: false, tradeHistory: [], notes: ''
    })), status: 'paused', type: 'test', source: 'hypothetical'
  },
  prospects: new Map(catalog.map(player => [player.id, player])),
  resultsBody: document.getElementById('actualResultsRows'),
  labels: {}, teamCodes: ['TEN'], positions: ['QB','DB','EDGE'], busy: false,
  renderSelectors() {}, renderBuilderControls() {}, renderBreakdowns() {}, renderLeaderboard() {},
  updateActionState() {}, message() {}
});
vm.runInContext(
  source.slice(source.indexOf('  function slug('), source.indexOf('  async function request(')) +
  source.slice(source.indexOf('  function render()'), source.indexOf('  function renderSelectors()')),
  context
);
vm.runInContext('render()', context);
const selects = () => context.resultsBody.querySelectorAll('select[data-result-player]');
const playerAt = index => context.resultsBody.children[index].children[3].children[0];
const option = (index, id) => selects()[index].options.find(item => item.value === id);
function select(index, id) {
  const control = selects()[index];
  control.value = id;
  control.events.change();
}
assert.equal(elements.get('resultsProspectList').children.length, 32);
context.resultsPosition = 'WR';
vm.runInContext('renderResultsProspects()', context);
assert.equal(elements.get('resultsProspectList').children.length, catalog.filter(player => player.position === 'WR').length);
assert.equal(elements.get('resultsProspectList').children[0].children[0].textContent, catalog.find(player => player.position === 'WR').name);
elements.get('resultsProspectSearch').value = catalog[0].name;
vm.runInContext('renderResultsProspects()', context);
assert.equal(elements.get('resultsProspectList').textContent, 'No available prospects match this filter.');
elements.get('resultsProspectSearch').value = '';
context.resultsPosition = 'ALL';
vm.runInContext('renderResultsProspects()', context);
select(0, catalog[0].id);
assert.equal(elements.get('resultsProspectList').children.length, 31);
assert.equal(option(1, catalog[0].id).disabled, true);
assert.match(option(1, catalog[0].id).textContent, /already picked/);
assert.equal(option(0, catalog[0].id).disabled, false);
select(1, catalog[0].id);
assert.equal(context.state.results[1].playerId, '', 'Duplicate selector changes are rejected');
select(0, catalog[1].id);
assert.equal(option(1, catalog[0].id).disabled, false, 'Replaced player becomes available');
select(0, '');
assert.equal(elements.get('resultsProspectList').children.length, 32);
const name = playerAt(0).children[1];
name.value = catalog[0].name;
name.events.input();
assert.equal(option(1, catalog[0].id).disabled, true, 'Manual names also reserve catalog players');
name.value = '';
name.events.input();
const target = elements.get('resultsProspectPick');
target.value = '3';
elements.get('resultsProspectList').children[0].children[1].events.click();
assert.equal(context.state.results[2].playerId, catalog[0].id);
assert.equal(context.state.results[2].confirmed, false);
assert.equal(elements.get('resultsProspectList').children.length, 31);
assert.equal(target.value, '1', 'Sidebar advances to first unfilled result');
elements.get('resultsProspectSearch').value = catalog[1].name;
vm.runInContext('renderResultsProspects()', context);
assert.equal(elements.get('resultsProspectList').children.length, 1);
context.state.locked = true;
vm.runInContext('renderResultsProspects()', context);
const add = elements.get('resultsProspectList').children[0].children[1];
assert.equal(add.disabled, true);
add.events.click();
assert.equal(context.state.results.filter(result => result.playerId).length, 1, 'Locked results cannot be changed');
console.log('Results prospect sidebar: selection, return, duplicate selectors, manual names, search, target pick, and locks passed.');
