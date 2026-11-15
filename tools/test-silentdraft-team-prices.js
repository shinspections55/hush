'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'silentdraft.js'), 'utf8');
function section(start, end) {
  const first = source.indexOf(start);
  const last = source.indexOf(end, first + start.length);
  assert.ok(first !== -1 && last !== -1, `Missing source section: ${start}`);
  return source.slice(first, last);
}
const context = {
  players: [{ id: 8, name: 'Recovered', bid: 19 }],
  compactRowStyle: 'display:flex;',
  compactLabelStyle: '',
  compactValueStyle: 'flex:1;'
};
vm.runInNewContext(`
  ${section('    function resolveDraftRoomFinalPrice(player)', '    function buildRosterPlayerInline(player)')}
  ${section('                const escapeCompactText =', '                const assigned = assignRosterToSlots(displayedRoster);')}
  this.renderRow = renderCompactRow;
`, context);

for (const [label, player, price] of [
  ['QB', { id: 1, name: 'Starter', bid: 34 }, 34],
  ['WR', { id: 9, name: 'Purchased', acquisitionCost: 20, bid: 1 }, 20],
  ['BN', { id: 2, name: 'Bench', pricePaid: 7 }, 7],
  ['XBN', { id: 3, name: 'Auction', finalBid: 42 }, 42],
  ['WR', { id: 8, name: 'Recovered' }, 19],
  ['RB', { id: 4, name: 'Free', bid: 0 }, 0]
]) {
  const markup = context.renderRow(label, player);
  assert.ok(markup.includes(`title="Player acquisition cost">$${price}</span>`), markup);
}
assert.ok(context.renderRow('TE', { id: 99, name: 'Unknown' }).includes('title="Player acquisition cost">--</span>'));
assert.ok(!context.renderRow('BN', null).includes('team-roster-price'));
assert.ok(context.renderRow('WR', { name: '<img>', bid: 4 }).includes('&lt;img&gt;'));
const tradeContext = {
  normalizedUsername: 'alice',
  tradeController: { createTeamButton: name => ({ team: name }) }
};
vm.runInNewContext(`
  ${section('    function isCurrentUserTeamName(teamName)', '    // Global teams array')}
  this.renderTradeButton = function(team) {
    const children = [];
    const header = { appendChild(button) { children.push(button); } };
    ${section('                if (tradeController && !isCurrentUserTeamName(team.name))', '                header.appendChild(arrow);')}
    return children;
  };
`, tradeContext);
assert.equal(tradeContext.renderTradeButton({ name: ' Alice ' }).length, 0);
assert.equal(tradeContext.renderTradeButton({ name: 'ALICE' }).length, 0);
assert.equal(tradeContext.renderTradeButton({ name: 'Bob' })[0].team, 'Bob');
console.log('Silent draft Teams/Budgets player price tests passed.');
