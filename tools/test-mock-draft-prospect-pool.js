'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { makeFixture } = require('./mock-contest-fixture');

const source = fs.readFileSync(path.join(__dirname, '..', 'mock-draft-contest.js'), 'utf8');
function element() {
  return {
    children: [], events: {},
    append(...children) { this.children.push(...children); },
    replaceChildren(...children) { this.children = children.flatMap(child => child.fragment ? child.children : [child]); },
    setAttribute(name, value) { this[name] = value; },
    addEventListener(name, callback) { this.events[name] = callback; }
  };
}
const catalog = makeFixture().catalog;
const context = vm.createContext({
  ADMIN_BUILDER_MODE: true,
  prospects: catalog,
  picks: Array.from({ length: 32 }, () => ({ playerId: '' })),
  searchQuery: '',
  prospectPool: element(), prospectCount: element(), prospectPoolStatus: element(),
  document: {
    createElement: element,
    createDocumentFragment() { return { ...element(), fragment: true }; }
  },
  getProspectsForActiveFilter() { return catalog; },
  createProfileButton: element,
  saveMock() {},
  render() { vm.runInContext('renderProspects()', context); }
});
for (const [start, end] of [
  ['function getProspectById(', 'function getProspectsForActiveFilter('],
  ['function renderProspects()', 'function render()'],
  ['function assignProspect(', 'async function loadDefaultProspects()']
]) {
  vm.runInContext(source.slice(source.indexOf(start), source.indexOf(end)), context);
}
vm.runInContext('renderProspects()', context);
assert.equal(context.prospectPool.children.length, 32);
assert.equal(context.prospectCount.textContent, '32 AVAILABLE');
context.prospectPool.children[0].children.at(-1).events.click();
assert.equal(context.picks[0].playerId, catalog[0].id);
assert.equal(context.prospectPool.children.length, 31);
assert.equal(context.prospectCount.textContent, '31 AVAILABLE');
assert.equal(context.prospectPool.children[0].children[1].children[0].children[0].textContent, catalog[1].name);
vm.runInContext(`assignProspect(${JSON.stringify(catalog[0].id)}, 1)`, context);
assert.equal(context.picks[0].playerId, '');
assert.equal(context.picks[1].playerId, catalog[0].id);
assert.equal(context.picks.filter(pick => pick.playerId === catalog[0].id).length, 1);
vm.runInContext(`assignProspect(${JSON.stringify(catalog[1].id)}, 1)`, context);
assert.equal(context.prospectPool.children.length, 31);
assert.equal(context.prospectPool.children[0].children[1].children[0].children[0].textContent, catalog[0].name, 'Replaced player returns');
context.picks[1].playerId = '';
context.searchQuery = catalog[0].name;
vm.runInContext('renderProspects()', context);
assert.equal(context.prospectPool.children.length, catalog.filter(player => player.name.includes(catalog[0].name)).length);
context.picks[1].playerId = catalog[0].id;
vm.runInContext('renderProspects()', context);
assert.match(context.prospectPool.children[0].textContent, /No prospects match/);
context.searchQuery = '';
context.getProspectsForActiveFilter = () => catalog.filter(player => player.position === 'QB');
vm.runInContext('renderProspects()', context);
assert.equal(context.prospectCount.textContent, `${catalog.filter(player => player.id !== catalog[0].id && player.position === 'QB').length} AVAILABLE`);
context.ADMIN_BUILDER_MODE = false;
context.getProspectsForActiveFilter = () => catalog;
vm.runInContext('renderProspects()', context);
assert.equal(context.prospectPool.children.length, 32, 'Public builder retains its existing drafted-row behavior');
assert.equal(context.prospectPool.children[0].children.at(-1).disabled, true);
console.log('2027 prospect pool: selection, removal, return, filtering, duplicate prevention, and public behavior passed.');
