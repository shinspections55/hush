'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createTradeService } = require('..\\draft-trades');

const source = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
const start = source.indexOf('function applyWonRoundResultsToDraftState(');
const end = source.indexOf('function normalizeDraftCodeForFile(', start);
assert.ok(start !== -1 && end > start);
const context = { console, normalizeByeWeekValue: value => value ?? null };
vm.runInNewContext(source.slice(start, end), context);
const commit = context.applyWonRoundResultsToDraftState;
const alice = { name: 'Alice', budget: 200, budgetRemaining: 200, roster: [] };
const bob = { name: 'Bob', budget: 200, roster: [] };
const state = {
  currentRound: 1, roundStartAt: Date.now() - 1000, roundEndsAt: Date.now() + 600000,
  teams: [alice, bob],
  allPlayers: [
    { id: 1, name: 'One', position: 'WR' },
    { id: 2, name: 'Two', position: 'RB' },
    { id: 3, name: 'Three', position: 'TE' }
  ]
};
const won = (id, price, winner = 'Alice') => ({
  type: 'won', playerId: id, playerName: state.allPlayers[id - 1].name,
  winnerTeam: winner, bidAmount: price + 20, pricePaid: price
});
commit(state, 'budget-test', 1, [won(1, 31), won(2, 12, 'Bob')]);
assert.equal(alice.budget, 169, 'Deduct the price paid, not the winning maximum bid');
assert.equal(alice.budgetRemaining, 169);
assert.equal(bob.budget, 188);
commit(state, 'budget-test', 1, [won(1, 31), won(2, 12, 'Bob')]);
assert.equal(alice.budget, 169, 'Replaying results must not charge twice');
assert.equal(bob.budget, 188);

const draft = { members: ['Alice', 'Bob'], draftState: state };
const trades = createTradeService({
  isCpu: () => false, capacity: () => 10, playerValue: () => 1,
  rosterScore: () => 1, waiverScore: () => 1, waiverMode: () => 'off', persist() {}
});
const offered = trades.propose(draft, 'Alice', {
  requestId: 'budget-trade', to: 'Bob',
  give: { players: [1], picks: [], budget: 10 },
  receive: { players: [2], picks: [], budget: 0 }
});
assert.equal(offered.ok, true);
assert.equal(trades.respond(draft, 'Bob', { id: offered.offer.id, action: 'accept' }).ok, true);
assert.equal(alice.budget, 159);
assert.equal(bob.budget, 198);
state.currentRound = 2;
commit(state, 'budget-test', 2, [won(3, 25)]);
assert.equal(alice.budget, 134, 'Later rounds must deduct from the post-trade balance');
assert.equal(alice.budgetRemaining, 134);
assert.equal(bob.budget, 198, 'Receiving a player does not charge its original draft price again');
assert.equal(alice.roster.reduce((sum, player) => sum + player.bid, 0), 37);
commit(state, 'budget-test', 2, [won(3, 25)]);
assert.equal(alice.budget, 134);
console.log('Silent draft budget tests passed.');
