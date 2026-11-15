'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createTradeService, tradePhase, isLocalTradeSocket } = require('..\\draft-trades');

function fixture() {
  return {
    members: ['Alice', 'Bob'], host: 'Alice', waiverMode: 'skill', tradePrototype: true,
    draftState: {
      currentRound: 2, roundStartAt: Date.now() - 1000, roundEndsAt: Date.now() + 600000,
      teams: [
        { name: 'Alice', budget: 100, roster: [{ id: 1, name: 'One', avgValue: 30, position: 'WR' }] },
        { name: 'Bob', budget: 100, roster: [{ id: 2, name: 'Two', avgValue: 20, position: 'RB' }] },
        { name: 'CPU', budget: 100, roster: [{ id: 3, name: 'Three', avgValue: 10, position: 'TE' }] }
      ],
      allPlayers: [{ id: 1, owner: 'Alice' }, { id: 2, owner: 'Bob' }, { id: 3, owner: 'CPU' }],
      bids: { 10: { Alice: 15, Bob: 20, CPU: 5 } }, submittedMembers: ['Alice', 'Bob'],
      actionReceipts: { old: { ok: true } }
    }
  };
}
const side = (players = [], budget = 0, picks = []) => ({ players, budget, picks });
let requestId = 0;
const offer = (to = 'Bob', give = side([1]), receive = side([2])) => ({
  to, give, receive, requestId: `request-${++requestId}`
});
function service(random = () => 0) {
  return createTradeService({
    isCpu: name => name === 'CPU',
    capacity: () => 4,
    playerValue: player => player.avgValue,
    rosterScore: roster => roster.reduce((sum, player) => sum + player.avgValue, 0),
    waiverScore: team => team.roster.reduce((sum, player) => sum + player.avgValue, 0),
    waiverMode: draft => draft.waiverMode,
    persist() {},
    random
  });
}
const trades = service();
const draft = fixture();
const proposal = trades.propose(draft, 'Alice', offer('Bob', side([1], 10), side([2], 5)));
assert.equal(proposal.ok, true);
assert.equal(draft.draftState.teams[0].roster[0].id, 1, 'An offer must not transfer assets');
assert.equal(trades.respond(draft, 'CPU', { id: proposal.offer.id, action: 'accept' }).reason, 'not_your_offer');
const accepted = trades.respond(draft, 'Bob', { id: proposal.offer.id, action: 'accept' });
assert.equal(accepted.ok, true);
assert.equal(draft.draftState.teams[0].roster[0].id, 2);
assert.equal(draft.draftState.teams[0].budget, 95);
assert.equal(draft.draftState.teams[1].budget, 105);
assert.deepEqual(draft.draftState.bids[10], { CPU: 5 });
assert.deepEqual(draft.draftState.submittedMembers, []);
assert.deepEqual(draft.draftState.tradeBidRevisions, { Alice: 1, Bob: 1 });
assert.equal(draft.draftState.allPlayers[0].owner, 'Bob');
assert.equal(trades.respond(draft, 'Bob', { id: proposal.offer.id, action: 'accept' }).reason, 'offer_not_pending');
assert.equal(JSON.parse(JSON.stringify(draft)).tradeOffers[0].status, 'accepted', 'Trades must survive persistence');

const cashDraft = fixture();
cashDraft.draftState.teams[1].roster[0].bid = 1;
cashDraft.draftState.teams[1].budget = 99;
const cashOffer = trades.propose(cashDraft, 'Alice', offer('Bob', side([], 20), side([2])));
assert.equal(trades.respond(cashDraft, 'Bob', { id: cashOffer.offer.id, action: 'accept' }).ok, true);
assert.equal(cashDraft.draftState.teams[0].budget, 80);
assert.equal(cashDraft.draftState.teams[1].budget, 119, 'Original $1 was already deducted; credit full $20');
const purchased = cashDraft.draftState.teams[0].roster.find(player => player.id === 2);
assert.equal(purchased.acquisitionCost, 20);
assert.equal(purchased.bid, 1, 'Preserve original draft purchase price');
assert.equal(cashDraft.draftState.allPlayers.find(player => player.id === 2).acquisitionCost, 20);
assert.equal(trades.respond(cashDraft, 'Bob', { id: cashOffer.offer.id, action: 'accept' }).reason, 'offer_not_pending');
assert.equal(cashDraft.draftState.teams[1].budget, 119);
const swapOffer = trades.propose(cashDraft, 'Alice', offer('Bob', side([2]), side()));
assert.equal(trades.respond(cashDraft, 'Bob', { id: swapOffer.offer.id, action: 'accept' }).ok, true);
assert.equal(cashDraft.draftState.teams[1].roster[0].acquisitionCost, 20, 'Noncash transfers retain existing cost');
const resale = trades.propose(cashDraft, 'Bob', offer('Alice', side([2]), side([], 30)));
assert.equal(trades.respond(cashDraft, 'Alice', { id: resale.offer.id, action: 'accept' }).ok, true);
assert.equal(cashDraft.draftState.teams[0].roster.find(player => player.id === 2).acquisitionCost, 30);
const savedCash = JSON.parse(JSON.stringify(cashDraft));
delete savedCash.draftState.teams[0].roster.find(player => player.id === 2).acquisitionCost;
delete savedCash.draftState.allPlayers.find(player => player.id === 2).acquisitionCost;
const priorBalances = savedCash.draftState.teams.map(team => team.budget);
trades.getState(savedCash, 'Alice');
assert.equal(savedCash.draftState.teams[0].roster.find(player => player.id === 2).acquisitionCost, 30);
const recoveredRevision = savedCash.draftState.tradeRevision;
trades.getState(savedCash, 'Alice');
assert.equal(savedCash.draftState.tradeRevision, recoveredRevision, 'Recovery is idempotent');
assert.deepEqual(savedCash.draftState.teams.map(team => team.budget), priorBalances, 'Recovery never adjusts balances');

const counterDraft = fixture();
const original = trades.propose(counterDraft, 'Alice', offer());
const counter = trades.propose(counterDraft, 'Bob', {
  ...offer('Alice', side([2]), side([1], 5)), counterId: original.offer.id
});
assert.equal(counter.ok, true);
assert.equal(original.offer.status, 'countered');
assert.equal(trades.respond(counterDraft, 'Alice', { id: counter.offer.id, action: 'accept' }).ok, true);

for (const mutation of [
  state => { state.isProcessingRound = true; },
  state => { state.pendingRoundResults = { results: [] }; },
  state => { state.liveAuctions = { test: { active: true } }; },
  state => { state.pendingAuctions = [{}]; },
  state => { state.roundEndsAt = Date.now() - 1; }
]) {
  const blocked = fixture();
  const pending = trades.propose(blocked, 'Alice', offer());
  mutation(blocked.draftState);
  assert.equal(trades.respond(blocked, 'Bob', { id: pending.offer.id, action: 'accept' }).ok, false);
  assert.equal(blocked.draftState.teams[0].roster[0].id, 1);
}
assert.equal(trades.propose(fixture(), 'Alice', offer('Bob', side([], 101), side())).reason, 'insufficient_budget');
assert.equal(trades.propose(fixture(), 'Alice', offer('Bob', side([99]), side())).reason, 'player_no_longer_owned');
assert.equal(trades.propose(fixture(), 'Alice', offer('Bob', side([1, 1]), side())).reason, 'invalid_assets');
assert.equal(trades.propose(fixture(), 'Alice', offer('Bob', side([], -1), side())).reason, 'invalid_assets');
const stale = fixture();
const staleOffer = trades.propose(stale, 'Alice', offer());
stale.draftState.teams[0].roster = [];
assert.equal(trades.respond(stale, 'Bob', { id: staleOffer.offer.id, action: 'accept' }).reason, 'player_no_longer_owned');

const post = fixture();
post.draftState.currentRound = 10;
post.draftState.lastFinalizedRound = 10;
post.draftState.lastRoundResults = { tiedBids: [] };
trades.ensureWaiverPicks(post);
const fixedPicks = structuredClone(post.tradeWaiverPicks);
const alicePick = post.tradeWaiverPicks.find(pick => pick.owner === 'Alice').id;
const pickOffer = trades.propose(post, 'Alice', offer('Bob', side([], 0, [alicePick]), side([2])));
assert.equal(trades.respond(post, 'Bob', { id: pickOffer.offer.id, action: 'accept' }).ok, true);
trades.ensureWaiverPicks(post);
assert.deepEqual(post.tradeWaiverPicks.map(pick => pick.originalTeam), fixedPicks.map(pick => pick.originalTeam));
assert.equal(post.tradeWaiverPicks.filter(pick => pick.owner === 'Alice').length, 0);
assert.equal(post.tradeWaiverPicks.filter(pick => pick.owner === 'Bob').length, 2);
assert.equal(trades.propose(post, 'Alice', offer('Bob', side([], 1), side())).reason, 'budget_live_draft_only');
post.waiverState = { active: true };
assert.equal(trades.propose(post, 'Alice', offer('Bob', side([1]), side())).reason, 'trades_closed');

const rankings = [
  { name: 'One', position: 'WR', prerank: 1 },
  { name: 'Three', position: 'TE', prerank: 100 }
];
for (const [amount, expected] of [[35, 100], [40, 500], [50, 900]]) {
  let acceptedCpu = 0;
  for (let i = 0; i < 1000; i++) {
    const cpuDraft = fixture();
    cpuDraft.draftState.teams[2].roster[0].avgValue = 35;
    const cpuService = service(() => i / 1000);
    const input = offer('CPU', side([], amount), side([3]));
    const response = cpuService.propose(cpuDraft, 'Alice', input, rankings);
    if (response.offer.status === 'accepted') acceptedCpu++;
    const retry = cpuService.propose(cpuDraft, 'Alice', input);
    assert.equal(retry.offer.status, response.offer.status);
    assert.equal(cpuDraft.tradeOffers.length, 1);
  }
  assert.equal(acceptedCpu, expected, `Unexpected acceptance rate for $${amount}`);
}
const unfair = service(() => 0.5).propose(fixture(), 'Alice', offer('CPU', side([], 1), side([3])), rankings);
assert.equal(unfair.offer.status, 'declined', 'Unfair trades cannot pass the random roll');
const sameValue = fixture();
sameValue.draftState.teams[0].roster[0].avgValue = 10;
assert.equal(service(() => 0.3).propose(sameValue, 'Alice', offer('CPU', side([1]), side([3])), rankings).offer.status, 'accepted', 'A higher default rank improves an equal-AV offer');
const lowerRank = fixture();
lowerRank.draftState.teams[0].roster[0].avgValue = 10;
const reversedRankings = rankings.map(player => ({ ...player, prerank: 102 - player.prerank }));
assert.equal(service(() => 0.5).propose(lowerRank, 'Alice', offer('CPU', side([1]), side([3])), reversedRankings).offer.status, 'declined');
const costLoss = fixture();
costLoss.draftState.teams[2].roster[0].bid = 20;
assert.equal(service(() => 0.09).propose(costLoss, 'Alice', offer('CPU', side([], 10), side([3])), rankings).offer.status, 'declined', 'A sale below original cost reduces benefit');
const profitable = fixture();
profitable.draftState.teams[2].roster[0].bid = 5;
assert.equal(service(() => 0.2).propose(profitable, 'Alice', offer('CPU', side([], 10), side([3])), rankings).offer.status, 'accepted', 'Profit relative to cost improves acceptance');
const previouslyTraded = fixture();
previouslyTraded.draftState.teams[2].roster[0].bid = 5;
previouslyTraded.tradeOffers = [{ from: 'Bob', requestId: 'old-trade', status: 'accepted', give: side([3]), receive: side() }];
assert.equal(service(() => 0.2).propose(previouslyTraded, 'Alice', offer('CPU', side([], 10), side([3])), rankings).offer.status, 'declined', 'Do not treat another owner’s price as the CPU cost');
const noRanks = fixture();
assert.equal(service().propose(noRanks, 'Alice', offer('CPU', side([], 10), side([3]))).reason, 'cpu_rankings_unavailable');
assert.equal(noRanks.tradeOffers.length, 0);
const fitService = createTradeService({
  isCpu: name => name === 'CPU', capacity: () => 4,
  playerValue: player => player.avgValue,
  rosterScore: roster => roster.reduce((sum, player) => sum + player.avgValue + (player.position === 'WR' ? 10 : 0), 0),
  waiverScore: () => 0, waiverMode: () => 'skill', persist() {}, random: () => 0.2
});
const fit = fixture();
fit.draftState.teams[0].roster[0].avgValue = 10;
const equalRanks = rankings.map(player => ({ ...player, prerank: 50 }));
assert.equal(fitService.propose(fit, 'Alice', offer('CPU', side([1]), side([3])), equalRanks).offer.status, 'accepted', 'Roster fit increases acceptance');
const postCpu = fixture();
postCpu.draftState.currentRound = postCpu.draftState.lastFinalizedRound = 10;
postCpu.draftState.lastRoundResults = { tiedBids: [] };
postCpu.tradeWaiverPicks = [{ id: 1, originalTeam: 'Alice', owner: 'Alice' }];
assert.equal(service(() => 0).propose(postCpu, 'Alice', offer('CPU', side([], 0, [1]), side()), rankings).offer.status, 'accepted', 'Post-draft picks contribute value');

const socket = (address = '127.0.0.1', host = 'localhost:8000', origin = 'http://localhost:8000') => ({
  handshake: { address, headers: { host, origin } }
});
assert.equal(isLocalTradeSocket(socket()), true);
assert.equal(isLocalTradeSocket(socket('192.168.1.1')), false);
assert.equal(isLocalTradeSocket(socket('127.0.0.1', 'hush.example')), false);
assert.equal(isLocalTradeSocket(socket('127.0.0.1', 'localhost:8000', 'http://evil.example')), false);
const proxy = socket();
proxy.handshake.headers['x-forwarded-for'] = '127.0.0.1';
assert.equal(isLocalTradeSocket(proxy), false);

const source = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
function section(start, end) {
  const first = source.indexOf(start);
  const last = source.indexOf(end, first + start.length);
  assert.ok(first >= 0 && last >= 0, `Missing ${start}`);
  return source.slice(first, last);
}
const context = { Date, buildWaiverPoolFromDraft() { return [{}]; }, WAIVER_PICK_TIMER_MS: 1000 };
vm.runInNewContext(`
  ${section('function getCurrentWaiverTurnTeamName(', 'function getWaiverPlayerValueMaps(')}
  globalThis.hooks = { markWaiverTeamActed, advanceWaiverTurn, finalizeWaiverStateProgress };
`, context);
const waiver = { order: ['Bob', 'Bob', 'CPU'], turnIndex: 0, actedPicks: [], actedTeams: [], active: true };
context.hooks.markWaiverTeamActed(waiver, 'Bob');
context.hooks.advanceWaiverTurn(waiver, {});
context.hooks.finalizeWaiverStateProgress({}, waiver);
assert.equal(waiver.turnIndex, 1, 'A second position owned by Bob is a separate turn');
assert.equal(waiver.active, true);
context.hooks.markWaiverTeamActed(waiver, 'Bob');
context.hooks.advanceWaiverTurn(waiver, {});
assert.equal(waiver.turnIndex, 2);
context.hooks.markWaiverTeamActed(waiver, 'CPU');
context.hooks.advanceWaiverTurn(waiver, {});
assert.equal(waiver.completed, true);

const bidHandlers = {};
const bidDraft = fixture();
bidDraft.draftState.tradeBidRevisions = { Alice: 1 };
const bidContext = {
  socket: { data: { username: 'Alice' }, on(name, callback) { bidHandlers[name] = callback; } },
  ensureDraftStateForSocket() { return bidDraft; },
  resolveDraftMemberName(_draft, name) { return name; },
  io: { to() { return { emit() {} }; } },
  console: { log() {} }
};
vm.runInNewContext(`
  ${section('  const applyUserBidToDraftState =', '  // User has submitted their bids for the round')}
`, bidContext);
let bidResponse;
bidHandlers.syncRoundBids('TEST', [{ playerId: 10, bidAmount: 99 }], response => { bidResponse = response; });
assert.equal(bidResponse.reason, 'trade_bids_reset');
assert.equal(bidDraft.draftState.bids[10].Alice, 15, 'An old retry must not restore cleared bids');
bidHandlers.syncRoundBids('TEST', [{ playerId: 10, bidAmount: 25 }], { tradeBidRevision: 1 }, response => { bidResponse = response; });
assert.equal(bidResponse.ok, true);
assert.equal(bidDraft.draftState.bids[10].Alice, 25);
bidHandlers.placeBid('TEST', 10, 99, { tradeBidRevision: 0 }, response => { bidResponse = response; });
assert.equal(bidResponse.reason, 'trade_bids_reset');

const authoritativeContext = {
  roundData: { teams: [{ name: 'stale client', budget: 9999 }], allPlayers: [{ id: 1, owner: 'stale' }] },
  draftState: { tradeRevision: 1, teams: [{ name: 'server', budget: 85 }], allPlayers: [{ id: 1, owner: 'server' }] }
};
vm.runInNewContext(`
  ${section('    const payload = roundData && typeof roundData', '    const rosterSize = Number.isFinite(Number(payload.rosterSize))')}
  globalThis.selected = { teams, allPlayers };
`, authoritativeContext);
assert.equal(authoritativeContext.selected.teams[0].name, 'server');
assert.equal(authoritativeContext.selected.allPlayers[0].owner, 'server');

const capacityDraft = fixture();
capacityDraft.draftState.teams[1].roster.push(...[4, 5, 6].map(id => ({ id, avgValue: 1 })));
assert.equal(trades.propose(capacityDraft, 'Alice', offer('Bob', side([1]), side())).reason, 'roster_capacity_exceeded');
const declinedDraft = fixture();
const decline = trades.propose(declinedDraft, 'Alice', offer());
assert.equal(trades.respond(declinedDraft, 'Bob', { id: decline.offer.id, action: 'decline' }).offer.status, 'declined');

assert.equal(tradePhase(fixture()), 'live');
console.log('Draft trade tests passed (including 100, 500 and 900 CPU acceptances per 1,000 controlled offers).');
