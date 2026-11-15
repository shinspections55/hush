'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
const start = source.indexOf('async function processAuctions(');
const end = source.indexOf('function applyWonRoundResultsToDraftState(', start);
assert.ok(start !== -1 && end > start, 'processAuctions not found');

const context = {
  console: { log() {}, warn() {}, error: console.error },
  process: { env: {} },
  currentDraftId: 'bid-integrity-test',
  getConfiguredMaxRosterSize: size => size + 3,
  isValidRosterAddition: () => true,
  applySpecialistParticipationGate: (_player, bids) => bids,
  loadCpuLogicConfig: () => ({ silent: {} }),
  resolvePlayerByeWeek: () => 8,
  bulkLogIndividualBids: async () => {},
  logAuctionResult: async () => {}
};
vm.createContext(context);
vm.runInContext(`${source.slice(start, end)}\nthis.processAuctions = processAuctions;`, context);

const roster = count => Array.from({ length: count }, (_, i) => ({ id: 1000 + i, name: `P${i}` }));
const olave = { id: 19, name: 'Chris Olave', position: 'WR', avgValue: 18 };

async function run(roundNumber, teams, userBids, cpuBids = {}) {
  return context.processAuctions([olave], teams, cpuBids, { 19: userBids }, {}, [], 16, roundNumber);
}

async function main() {
  // Reproduces Round 9: a full roster bid $35, under-filled teams bid $19 and $13.
  for (const round of [1, 9, 10]) {
    const teams = [
      { name: 'Timbee12', budget: 80, roster: roster(15) },
      { name: 'Team 10', budget: 60, roster: roster(10) },
      { name: 'Team 4', budget: 60, roster: roster(10) }
    ];
    const { results } = await run(round, teams, { Timbee12: 35, 'Team 10': 19, 'Team 4': 13 });
    const won = results[0];
    assert.equal(won.type, 'won', `Round ${round}`);
    assert.equal(won.winnerTeam, 'Timbee12', `Round ${round}: the highest bid must win`);
    assert.equal(won.bidAmount, 35);
    assert.equal(won.pricePaid, 20, 'Pays $1 over the second-highest bid');
    assert.equal(won.secondHighestBidder, 'Team 10');
    assert.equal(won.secondHighestBid, 19);
  }

  // Equal top bids still go to a tied live auction, regardless of roster size.
  const tied = await run(10, [
    { name: 'Full', budget: 80, roster: roster(15) },
    { name: 'Short', budget: 80, roster: roster(5) }
  ], { Full: 25, Short: 25 });
  assert.equal(tied.results[0].type, 'tied');
  assert.deepEqual([...tied.results[0].tiedTeams].sort(), ['Full', 'Short']);

  // Ineligible bids (over budget or no roster room) are still excluded.
  const invalid = await run(10, [
    { name: 'Broke', budget: 10, roster: roster(5) },
    { name: 'Maxed', budget: 100, roster: roster(19) },
    { name: 'Valid', budget: 50, roster: roster(12) }
  ], { Broke: 40, Maxed: 50, Valid: 12 });
  assert.equal(invalid.results[0].winnerTeam, 'Valid');
  assert.equal(invalid.results[0].pricePaid, 1);

  console.log('Silent draft bid integrity tests passed (highest valid bid wins in every round).');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
