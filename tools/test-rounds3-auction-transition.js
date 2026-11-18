'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'rounds3draft.js'), 'utf8');
function loadFunction(name, context) {
  const start = source.indexOf(`function ${name}(`);
  const end = source.indexOf('\nfunction ', start + 1);
  assert.ok(start >= 0 && end > start, `Could not find ${name}`);
  vm.runInContext(source.slice(start, end), context);
}

function element() {
  return {
    classList: { add() {}, remove() {} },
    style: { setProperty() {} },
    innerHTML: '',
    children: [],
    appendChild(child) { this.children.push(child); }
  };
}

const context = vm.createContext({
  TEAM_COUNT: 4, AUCTION_ROUNDS: 3, AUCTION_PLAYER_LIMIT: 3, TOTAL_DRAFT_ROUNDS: 14,
  PICK_SECONDS: 30, humanIndex: 0, currentRound: 3, currentPick: 4,
  draftMode: 'auction', phase: 'between', teams: ['A', 'B', 'C', 'D'],
  teamAuctionPlayers: [3, 3, 3, 2], teamBudgets: [25, 30, 40, 50],
  teamRosters: Array.from({ length: 4 }, (_, team) =>
    Array.from({ length: team === 3 ? 2 : 3 }, (_, slot) => ({
      id: `${team}-${slot}`, name: `Player ${team}-${slot}`, position: 'WR', price: 10
    }))),
  nominatedPlayer: null, currentBid: 0, highestBidder: null, wonTeamIndex: null,
  betweenTimer: null, roundInfo: element(), nominatorInfo: element(),
  auctionState: element(), nominatingState: element(), nominatingText: element(),
  idleState: element(), modeNotice: element(), draftBoard: element(),
  document: { createElement: element },
  stopClock() {}, stopCpuTicker() {}, closeNominateDialog() {},
  openNominateDialog() {}, startClock() {}, clearTimeout() {}, setTimeout() {},
  transitions: 0,
  startSnakeDraft() { context.transitions++; }
});

for (const name of [
  'getNominatorIndex', 'allRostersFull', 'shortPlayerName', 'renderDraftBoard',
  'updateRoundInfo', 'advanceNomination', 'beginNomination', 'finishAuctionPhase'
]) loadFunction(name, context);

context.advanceNomination();
assert.equal(context.currentRound, 4);
assert.equal(context.draftMode, 'auction', 'Three nomination passes must not end the auction');
assert.equal(context.getNominatorIndex(), 3, 'Auction nominations must keep snaking beyond pass three');
context.beginNomination();
assert.equal(context.phase, 'nominating');
assert.equal(context.transitions, 0);
assert.ok(context.draftBoard.children.every(col => (col.innerHTML.match(/<li/g) || []).length === 3));
assert.ok(context.draftBoard.children.every(col => !col.innerHTML.includes('team-auction-count')));
context.finishAuctionPhase();
assert.equal(context.transitions, 0, 'Open auction slots must block the transition');

context.teamAuctionPlayers[3] = 3;
context.teamRosters[3].push({ id: '3-2', name: 'Final Winner', position: 'RB', price: 15 });
const auctionRosters = JSON.stringify(context.teamRosters);
const auctionBudgets = JSON.stringify(context.teamBudgets);
context.beginNomination();
assert.equal(context.transitions, 1);
assert.equal(context.draftMode, 'snake');
assert.equal(context.currentRound, 4);
assert.equal(context.currentPick, 1);
assert.equal(context.getNominatorIndex(), 0, 'Round four must restart left-to-right');
context.draftBoard.children = [];
context.renderDraftBoard();
assert.ok(context.draftBoard.children.every(col => (col.innerHTML.match(/<li/g) || []).length === 4));
assert.ok(context.draftBoard.children.every(col => col.innerHTML.includes('3/14 players')));
assert.ok(context.draftBoard.children[3].innerHTML.includes('Final Winner'));
assert.ok(context.draftBoard.children[3].innerHTML.includes('$15'));
assert.equal(JSON.stringify(context.teamRosters), auctionRosters, 'Auction results must be preserved');
assert.equal(JSON.stringify(context.teamBudgets), auctionBudgets, 'Auction balances must be preserved');
context.currentRound = 5;
assert.equal(context.getNominatorIndex(), 3, 'Round five must reverse');

context.draftMode = 'auction';
context.teamAuctionPlayers = [3, 1, 3, 2];
context.currentRound = 1;
context.currentPick = 1;
context.beginNomination();
assert.equal(context.getNominatorIndex(), 1, 'Starting or resuming must skip a full nominator');
context.advanceNomination();
assert.equal(context.getNominatorIndex(), 3, 'Forward nominations must skip full teams');
context.advanceNomination();
assert.equal(context.getNominatorIndex(), 3, 'The last eligible team keeps its snake turnaround turn');
context.advanceNomination();
assert.equal(context.getNominatorIndex(), 1, 'Reverse nominations must skip full teams');
context.advanceNomination();
assert.equal(context.currentRound, 3);
assert.equal(context.getNominatorIndex(), 1, 'Skipping must continue across the next snake turnaround');
context.teamAuctionPlayers[1] = 3;
context.advanceNomination();
assert.equal(context.getNominatorIndex(), 3, 'Only the remaining unfilled team may nominate');
context.advanceNomination();
assert.equal(context.getNominatorIndex(), 3, 'The last team may nominate again until full');
context.teamAuctionPlayers[3] = 3;
context.beginNomination();
assert.equal(context.transitions, 2, 'The auction must finish when the last eligible team fills up');

context.players = [
  { id: 'ranked-first', name: 'Ranked First', position: 'WR', avgValue: 50 },
  { id: 'queued-first', name: 'Queued First', position: 'RB', avgValue: 30 },
  { id: 'queued-second', name: 'Queued Second', position: 'QB', avgValue: 20 }
];
context.draftedPlayers = [];
context.queuedPlayerIds = ['queued-first', 'queued-second'];
context.starredPlayerIds = new Set(['queued-second']);
context.PICK_PREFERENCES_KEY = 'test-preferences';
context.preferenceNotice = element();
const storage = new Map();
context.localStorage = {
  getItem: key => storage.get(key) || null,
  setItem: (key, value) => storage.set(key, value)
};
for (const name of [
  'availablePlayers', 'getAutoPickPlayer', 'savePickPreferences', 'restorePickPreferences',
  'removePlayerFromQueue', 'getMyRosterSlots'
]) loadFunction(name, context);
assert.equal(context.getAutoPickPlayer(0).id, 'queued-first');
assert.equal(context.getAutoPickPlayer(1).id, 'ranked-first', 'Human queues must not affect CPU picks');
context.draftedPlayers.push('queued-first');
assert.equal(context.getAutoPickPlayer(0).id, 'queued-second', 'Auto-picks must skip taken queued players');
context.removePlayerFromQueue('queued-first');
context.queuedPlayerIds = [];
context.starredPlayerIds = new Set();
context.restorePickPreferences();
assert.equal(context.queuedPlayerIds.join(','), 'queued-second', 'Queue order must survive restoration');
assert.ok(context.starredPlayerIds.has('queued-second'), 'Stars must survive restoration');
context.draftedPlayers.push('queued-second');
assert.equal(context.getAutoPickPlayer(0).id, 'ranked-first', 'An exhausted queue must fall back to rankings');

context.lobby = { rosterSettings: { QB: 1, RB: 1, FLEX: 1, SPFLEX: 1, BN: 1 } };
context.teamRosters[0] = [
  ...context.players,
  { id: 'extra-qb', position: 'QB', avgValue: 10 }
];
const rosterSlots = context.getMyRosterSlots();
assert.equal(rosterSlots.length, 5);
assert.equal(rosterSlots.find(slot => slot.position === 'QB').player.id, 'queued-second');
assert.equal(rosterSlots.find(slot => slot.position === 'FLEX').player.id, 'ranked-first');
assert.equal(rosterSlots.find(slot => slot.position === 'SPFLEX').player.id, 'extra-qb');
assert.equal(rosterSlots.find(slot => slot.position === 'BN').player, null);
assert.equal(new Set(rosterSlots.filter(slot => slot.player).map(slot => slot.player.id)).size, 4);

const simulatorSource = fs.readFileSync(path.join(__dirname, '..', 'rounds3draft-sim.js'), 'utf8');
vm.runInNewContext(simulatorSource, { location: { hostname: 'hush.example' } });

context.location = { hostname: 'localhost' };
const simButtons = [];
context.document = {
  querySelector: () => ({ appendChild() {} }),
  createElement: () => {
    const button = { addEventListener(_name, handler) { this.click = handler; } };
    simButtons.push(button);
    return button;
  }
};
context.alerts = [];
context.alert = message => context.alerts.push(message);
context.STORAGE_KEY = 'test-draft';
context.MIN_BID = 1;
context.valueScale = 1;
context.teamAuctionSpent = [10, 10, 10, 10];
context.teamAuctionPlayers = [1, 1, 1, 1];
context.teamBudgets = [90, 90, 90, 90];
context.players = Array.from({ length: 120 }, (_, index) => ({
  id: `sim-${index}`, name: `Sim Player ${index}`, position: 'WR', avgValue: 40 - index / 4
}));
context.teamRosters = context.players.slice(0, 4).map(player => [{ ...player, price: 10, round: 1 }]);
context.draftedPlayers = context.players.slice(0, 4).map(player => player.id);
context.queuedPlayerIds = ['sim-50', 'sim-51'];
context.currentRound = 1;
context.currentPick = 2;
context.draftMode = 'auction';
context.phase = 'bidding';
context.nominatedPlayer = context.players[4];
context.highestBidder = 1;
context.currentBid = 9;
context.betweenTimer = 17;
context.cpuPickTimer = 18;
const cancelledTimers = [];
context.clearTimeout = id => cancelledTimers.push(id);
context.renderDraftBoard = () => {};
context.renderSnakePlayerPool = () => {};
context.snakePickStatus = element();
context.snakeClockEl = { ...element(), parentElement: element() };
for (const name of [
  'maxAvailableBid', 'remainingSlots', 'expectedPrice', 'recordAuctionSale',
  'recordSnakePick', 'saveDraftState', 'finishSnakeDraft'
]) loadFunction(name, context);
context.startSnakeDraft = () => context.saveDraftState();
vm.runInContext(simulatorSource, context);
const originalPicks = context.teamRosters.map(roster => roster[0].id);
simButtons[0].click();
assert.equal(context.draftMode, 'snake', 'First simulation must stop at the snake phase');
assert.equal(context.currentRound, 4);
assert.equal(context.currentPick, 1);
assert.ok(context.teamRosters.every(roster => roster.length === 3));
assert.ok(context.teamAuctionPlayers.every(count => count === 3));
assert.ok(context.teamBudgets.every((budget, index) => budget >= 0 && budget + context.teamAuctionSpent[index] === 100));
assert.equal(context.teamRosters[1].find(player => player.id === 'sim-4').price, 9, 'An active winning bid must be honored');
assert.ok(originalPicks.every((id, index) => context.teamRosters[index][0].id === id));
assert.deepEqual(cancelledTimers, [17, 18], 'Simulation must cancel pending progression and CPU picks');
assert.equal(JSON.parse(storage.get(context.STORAGE_KEY)).draftMode, 'snake');

const auctionResults = context.teamRosters.map(roster => JSON.stringify(roster));
simButtons[0].click();
assert.equal(context.draftMode, 'complete');
assert.ok(context.teamRosters.every(roster => roster.length === 14));
assert.ok(context.teamRosters.every((roster, index) => JSON.stringify(roster.slice(0, 3)) === auctionResults[index]));
assert.equal(new Set(context.draftedPlayers).size, 56, 'Simulated picks must not contain duplicates');
assert.equal(context.teamRosters[0][3].id, 'sim-50', 'Human simulated picks must honor the queue');
assert.equal(context.queuedPlayerIds.length, 0);
assert.ok(simButtons.every(button => button.disabled));
assert.equal(JSON.parse(storage.get(context.STORAGE_KEY)).draftMode, 'complete');

context.TOTAL_DRAFT_ROUNDS = 8;
context.teamRosters = context.players.slice(0, 12).reduce((rosters, player, index) => {
  rosters[Math.floor(index / 3)].push({ ...player, price: 10, round: 1 });
  return rosters;
}, [[], [], [], []]);
context.draftedPlayers = context.players.slice(0, 12).map(player => player.id);
context.currentRound = 4;
context.currentPick = 1;
context.draftMode = 'snake';
for (let pick = 0; pick < 6; pick++) {
  context.recordSnakePick(context.getNominatorIndex(), context.availablePlayers()[0]);
}
const partialRosters = context.teamRosters.map(roster => JSON.stringify(roster));
simButtons[0].click();
assert.ok(context.teamRosters.every(roster => roster.length === 8), 'Custom roster totals must define the final round');
assert.ok(context.teamRosters.every((roster, index) =>
  JSON.stringify(roster.slice(0, JSON.parse(partialRosters[index]).length)) === partialRosters[index]));
assert.equal(context.teamRosters[1][4].pick, 3, 'Simulation must resume the current snake turn');
assert.equal(context.teamRosters[0][5].round, 6);
assert.equal(context.teamRosters[0][5].pick, 1, 'Round six must resume left-to-right');

context.draftMode = 'auction';
context.teamAuctionPlayers = [0, 0, 0, 0];
context.players = [];
const stateBeforeFailedSim = JSON.stringify(context.teamRosters);
simButtons[0].click();
assert.match(context.alerts.at(-1), /still loading/);
context.players = [{ id: 'only-player' }];
simButtons[0].click();
assert.match(context.alerts.at(-1), /not enough available players/);
assert.equal(JSON.stringify(context.teamRosters), stateBeforeFailedSim, 'Failed simulation must not mutate progress');
context.players = Array.from({ length: 20 }, (_, index) => ({ id: `available-${index}` }));
context.teamBudgets = [0, 100, 100, 100];
simButtons[0].click();
assert.match(context.alerts.at(-1), /not have enough budget/);
assert.equal(JSON.stringify(context.teamRosters), stateBeforeFailedSim, 'Budget failures must preserve existing picks');

loadFunction('beginSnakePick', context);
context.draftMode = 'snake';
context.phase = 'snake-between';
context.currentRound = 4;
context.currentPick = 1;
context.snakePickStatus.textContent = 'Previous pick';
context.beginSnakePick();
assert.equal(context.snakePickStatus.textContent, '', 'Human turns must clear the on-clock message');
context.currentPick = 2;
context.beginSnakePick();
assert.equal(context.snakePickStatus.textContent, 'B is on the clock.', 'CPU turn messages must remain visible');

console.log('3-round auction, queue, roster, and temporary simulation tests passed.');
