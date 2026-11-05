'use strict';

const assert = require('node:assert/strict');
const { DEFAULT_RULES, scorePick, scoreMock } = require('../mock-draft-scoring');
const results = [
  { pick: 1, playerId: 'a', position: 'QB', confirmed: true },
  { pick: 2, playerId: 'b', position: 'WR', confirmed: true, traded: true,
    originalTeam: 'ATL', selectingTeam: 'DAL', tradeHistory: ['ATL', 'CLE', 'DAL'] },
  { pick: 3, playerId: 'c', position: 'DB', confirmed: true }
];
const prediction = { pick: 2, playerId: 'b', position: 'WR', team: 'ATL' };
assert.equal(scorePick(prediction, results).points, 15);
assert.equal(scorePick({ ...prediction, playerId: 'wrong' }, results).points, 5);
assert.equal(scorePick({ ...prediction, playerId: 'a', position: 'QB' }, results).points, 3);
assert.equal(scorePick({ ...prediction, playerId: 'wrong', position: 'QB' }, results).points, -3);
assert.equal(scorePick({ ...prediction, trade: true, tradeTo: 'DAL' }, results).points, 30);
assert.equal(scorePick({ ...prediction, trade: true, tradeTo: 'DAL', playerId: 'wrong' }, results).points, 18);
assert.equal(scorePick({ ...prediction, trade: true, tradeTo: 'DAL', playerId: 'wrong', position: 'QB' }, results).points, 12);
assert.equal(scorePick({ ...prediction, trade: true }, results).points, 10);
assert.equal(scorePick({ ...prediction, trade: true, team: 'NYG' }, results).points, -5);
assert.equal(scorePick({ ...prediction, trade: true, tradeTo: 'NYG' }, results).points, -8);
assert.equal(scorePick({ ...prediction, trade: true, team: 'CLE', tradeTo: 'DAL' }, results).points, 30);
assert.equal(scorePick({ ...prediction, pick: 4 }, results).points, null);
assert.equal(scorePick({ ...prediction, playerId: 'wrong', position: 'QB' }, results.slice(0, 2)).points, null);
assert.equal(scorePick({ ...prediction, playerId: 'wrong', position: 'QB' }, results.slice(0, 2), DEFAULT_RULES, 'final').points, -3);
assert.equal(scorePick(prediction, results, { ...DEFAULT_RULES, exact: 21 }).points, 21);
assert.equal(scoreMock({ id: 'test', name: 'Test', picks: [prediction] }, results, DEFAULT_RULES, 'live').total, 15);
assert.equal(scorePick({ pick: 2, playerId: '', position: '', trade: false }, results).points, 0);
assert.equal(scorePick({ ...prediction, playerId: 'a', position: 'WR' }, results).points, 5);
assert.equal(scorePick({ ...prediction, trade: true, tradeTo: 'DAL' }, results).matches.partner, true);
assert.equal(scorePick({ ...prediction, playerId: 'a' }, results, { ...DEFAULT_RULES, range: 20 }).points, 20);
assert.equal(scorePick(prediction, results, { ...DEFAULT_RULES, position: 25 }).points, 25);
assert.equal(scorePick({ ...prediction, trade: true, team: 'DAL' }, results).points, -5);
console.log('22 mock draft scoring assertions passed.');