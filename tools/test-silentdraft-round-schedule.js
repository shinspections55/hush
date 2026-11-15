'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { tradePhase } = require('..\\draft-trades');

const source = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
const start = source.indexOf('function scheduleRoundTimerIfReady(');
const end = source.indexOf('function emitDraftReadinessReport(', start);
assert.ok(start !== -1 && end > start);
let now = 100000;
let connected = ['alice'];
const events = [];
const context = {
  Date: { now: () => now },
  console: { log() {} },
  getActiveHumanDraftMembers: draft => draft.members,
  getConnectedDraftMembers: () => connected,
  normalizeServerRoundTimerMinutes: () => 3,
  recordDraftStateEvent: () => 1,
  schedulePersistDraftState: () => {},
  io: { to: () => ({ emit: (name, payload) => events.push({ name, payload }) }) }
};
vm.runInNewContext(source.slice(start, end), context);
function draft(startAt = null) {
  return {
    members: ['Alice'], draftState: {
      teams: [], currentRound: 2, currentPlayers: [{ id: 1 }],
      roundPlayersReadyMembers: ['Alice'], roundStartAt: startAt, roundEndsAt: null
    }
  };
}
for (const missing of [null, undefined, 0]) {
  const value = draft(missing);
  assert.equal(context.scheduleRoundTimerIfReady('test', value), true);
  assert.equal(value.draftState.roundStartAt, now + 750);
  assert.equal(value.draftState.roundEndsAt, now + 750 + 180000);
  assert.equal(tradePhase(value, now), 'waiting');
  now += 750;
  assert.equal(tradePhase(value, now), 'live');
  const scheduled = value.draftState.roundStartAt;
  context.scheduleRoundTimerIfReady('test', value);
  assert.equal(value.draftState.roundStartAt, scheduled, 'Readiness polls must not restart a scheduled round');
}
const notReady = draft();
connected = [];
assert.equal(context.scheduleRoundTimerIfReady('test', notReady), false);
assert.equal(notReady.draftState.roundStartAt, null);
assert.ok(events.some(event => event.name === 'roundTimerScheduled'));
console.log('Silent draft synchronized round schedule tests passed.');
