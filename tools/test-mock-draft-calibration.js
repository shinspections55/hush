'use strict';

const assert = require('node:assert/strict');
const { makeCalibration } = require('../mock-draft-calibration');
const { scoreMock, DEFAULT_RULES } = require('../mock-draft-scoring');
const { normalizeResults, normalizeMock } = require('../mock-draft-scoring-store');
const calibration = makeCalibration();
assert.equal(calibration.catalog.length, 32);
assert.equal(new Set(calibration.catalog.map(player => player.id)).size, 32);
normalizeResults(calibration.results);
assert.equal(calibration.results[1].originalTeam, 'CLE');
assert.equal(calibration.results[1].selectingTeam, 'JAC');
assert.equal(calibration.results[31].originalTeam, 'PHI');
assert.equal(calibration.results[31].selectingTeam, 'KC');
calibration.fixtures.forEach(fixture => {
  fixture.picks.forEach(pick => assert.equal(pick.position, calibration.catalog.find(player => player.id === pick.playerId).position));
  const score = scoreMock(normalizeMock(fixture), calibration.results, DEFAULT_RULES, 'final');
  assert.equal(score.total, fixture.expectedScore, fixture.name);
  assert.equal(score.pending, 0);
  console.log(`${fixture.name}: expected ${fixture.expectedScore}, actual ${score.total}`);
});
const mixed = scoreMock(calibration.fixtures[4], calibration.results, DEFAULT_RULES, 'final');
assert.equal(mixed.picks[1].points, 30);
assert.equal(mixed.picks[4].points, 18);
assert.equal(mixed.picks[24].points, 12);
assert.equal(mixed.picks[25].points, 10);
assert.equal(mixed.picks[30].points, -8);
assert.equal(mixed.picks[31].points, -5);
console.log('2025 calibration and trade branches passed.');