'use strict';

const assert = require('node:assert/strict');
const { createTradeService } = require('..\\draft-trades');

const rankings = [
  { name: 'One', position: 'WR', prerank: 100 },
  { name: 'Two', position: 'RB', prerank: 100 },
  { name: 'Extra', position: 'QB', prerank: 100 }
];
const side = (players = [], budget = 0, picks = []) => ({ players, budget, picks });
const makeDraft = () => ({
  members: ['Alice'], tradePrototype: true, waiverMode: 'skill',
  draftState: {
    currentRound: 2, roundStartAt: Date.now() - 1000, roundEndsAt: Date.now() + 600000,
    teams: [
      { name: 'Alice', budget: 100, roster: [{ id: 1, name: 'One', position: 'WR', avgValue: 20 }] },
      { name: 'CPU', budget: 100, roster: [{ id: 2, name: 'Two', position: 'RB', avgValue: 20, bid: 15 }] }
    ],
    allPlayers: [{ id: 1, owner: 'Alice' }, { id: 2, owner: 'CPU' }],
    bids: { 3: { Alice: 5, CPU: 10 } }, submittedMembers: ['Alice', 'CPU']
  }
});
const makeService = random => createTradeService({
  isCpu: name => name === 'CPU', capacity: () => 4,
  playerValue: player => player.avgValue,
  rosterScore: roster => roster.reduce((sum, player) => sum + player.avgValue, 0),
  waiverScore: () => 0, waiverMode: draft => draft.waiverMode, persist() {}, random
});
const proposal = () => ({ to: 'CPU', requestId: 'original-123', give: side([1]), receive: side([2]) });
let counters = 0;
for (let i = 0; i < 1000; i++) {
  const draft = makeDraft();
  let rolls = 0;
  const trades = makeService(() => (++rolls === 1 ? 0.99 : i / 1000));
  const request = proposal();
  const result = trades.propose(draft, 'Alice', request, rankings);
  if (result.offer.status === 'countered') {
    counters++;
    const counter = result.counterOffer;
    assert.equal(counter.status, 'pending');
    assert.equal(counter.from, 'CPU');
    assert.equal(counter.to, 'Alice');
    assert.equal(counter.counterId, result.offer.id);
    assert.ok(counter.receive.budget > 0);
    assert.equal(draft.draftState.teams[0].budget, 100, 'Counter must not transfer assets');
    assert.equal(trades.propose(draft, 'Alice', request).offer.status, 'countered');
    assert.equal(rolls, 2, 'Retry must not reroll');
    assert.equal(trades.respond(draft, 'Alice', { id: counter.id, action: 'accept' }).ok, true);
    assert.equal(draft.draftState.teams[1].budget, 100 + counter.receive.budget);
    assert.equal(draft.draftState.teams[1].roster[0].id, 1);
    assert.deepEqual(draft.draftState.submittedMembers, []);
  } else {
    assert.equal(result.offer.status, 'declined');
  }
}
assert.equal(counters, 50, '5% of rejected offers with a valid counter should receive one');

const post = makeDraft();
post.draftState.currentRound = post.draftState.lastFinalizedRound = 10;
post.draftState.lastRoundResults = { tiedBids: [] };
post.tradeWaiverPicks = [{ id: 1, originalTeam: 'Alice', owner: 'Alice' }];
let roll = 0;
const postTrades = makeService(() => (++roll === 1 ? 0.99 : 0));
const result = postTrades.propose(post, 'Alice', proposal(), rankings);
assert.equal(result.offer.status, 'countered');
assert.deepEqual(result.counterOffer.receive.picks, [1]);
assert.equal(post.tradeWaiverPicks[0].owner, 'Alice');
assert.equal(postTrades.respond(post, 'Alice', { id: result.counterOffer.id, action: 'accept' }).ok, true);
assert.equal(post.tradeWaiverPicks[0].owner, 'CPU');

const impossible = makeDraft();
impossible.draftState.teams[0].budget = 0;
roll = 0;
const noExtra = makeService(() => (++roll === 1 ? 0.99 : 0));
assert.equal(noExtra.propose(impossible, 'Alice', proposal(), rankings).offer.status, 'declined');
assert.equal(impossible.tradeOffers.length, 1);

const stale = makeDraft();
roll = 0;
const staleTrades = makeService(() => (++roll === 1 ? 0.99 : 0));
const staleResult = staleTrades.propose(stale, 'Alice', proposal(), rankings);
stale.draftState.pendingRoundResults = { results: [] };
assert.equal(staleTrades.respond(stale, 'Alice', { id: staleResult.counterOffer.id, action: 'accept' }).ok, false);
assert.equal(stale.draftState.teams[0].roster[0].id, 1);

const reducedBudget = makeDraft();
reducedBudget.draftState.teams[0].budget = 0;
reducedBudget.draftState.teams[0].roster[0].avgValue = 30;
roll = 0;
const reduceTrades = makeService(() => (++roll === 1 ? 0.99 : 0));
const reduced = reduceTrades.propose(reducedBudget, 'Alice', {
  ...proposal(), receive: side([2], 10)
}, rankings);
assert.equal(reduced.offer.status, 'countered');
assert.ok(reduced.counterOffer.give.budget < 10, 'CPU reduces its budget contribution');

const playerCounter = makeDraft();
playerCounter.draftState.currentRound = playerCounter.draftState.lastFinalizedRound = 10;
playerCounter.draftState.lastRoundResults = { tiedBids: [] };
playerCounter.tradeWaiverPicks = [];
playerCounter.draftState.teams[0].roster.push({ id: 3, name: 'Extra', position: 'QB', avgValue: 5 });
roll = 0;
const playerTrades = makeService(() => (++roll === 1 ? 0.99 : 0));
const withPlayer = playerTrades.propose(playerCounter, 'Alice', proposal(), rankings);
assert.equal(withPlayer.offer.status, 'countered');
assert.ok(withPlayer.counterOffer.receive.players.includes(3));
assert.equal(playerTrades.respond(playerCounter, 'Alice', { id: withPlayer.counterOffer.id, action: 'decline' }).ok, true);
assert.equal(playerCounter.draftState.teams[0].roster.length, 2);
console.log('CPU counteroffer tests passed (50/1,000 controlled rejected offers).');
