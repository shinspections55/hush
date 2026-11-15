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

function createHarness({ socketPresent = true, connected = true } = {}) {
  let now = 10000;
  let nextTimer = 1;
  const timers = new Map();
  const calls = [];
  const warnings = [];
  let ack;
  const socket = {
    connected,
    emit(event, code, round, callback) {
      calls.push([event, code, round]);
      ack = callback;
    },
    connect() {
      calls.push(['connect']);
    }
  };
  const context = {
    window: { draftSocket: socketPresent ? socket : null, isHost: false, syncedRoundPlayers: null },
    currentDraftCode: 'TEST',
    currentRound: 2,
    totalRounds: 10,
    isDraftEnding: false,
    Date: { now: () => now },
    console: { log() {}, warn(...args) { warnings.push(args); } },
    setTimeout(callback, delay) {
      const id = nextTimer++;
      timers.set(id, { callback, at: now + delay });
      return id;
    },
    clearTimeout(id) { timers.delete(id); },
    setInterval() { return nextTimer++; },
    clearInterval() {},
    resyncDraftConnection(reason) { calls.push(['resync', reason]); return Promise.resolve(true); },
    setRoundSubmitEnabled(enabled, label) { calls.push(['submit', enabled, label]); },
    renderRoundPlayerWaitState(label) { calls.push(['wait', label]); },
    updateUI() {},
    endDraft() { calls.push(['endDraft']); }
  };

  vm.runInNewContext(`
    ${section('    let scheduleConnectionResync = null;', '    if (window.draftSocket && currentDraftCode) {')}
    if (window.draftSocket && currentDraftCode) {
      ${section('        let lastConnectionResyncAt = 0;', '        const runDraftHeartbeat =')}
    }
    ${section('    function advanceDraftAfterRound() {', '    // Apply authoritative round results from server')}
    let roundPlayerWaitRecoveryTimer = null;
    let roundPlayerWaitAttempts = 0;
    ${section('    function clearRoundPlayerWaitRecovery() {', '    function renderRoundPlayerWaitState(message) {')}
    ${section('    function beginRoundPlayerWaitRecovery() {', '    function clearRoundSyncCountdown() {')}
    globalThis.hooks = { advanceDraftAfterRound, beginRoundPlayerWaitRecovery };
  `, context);

  return {
    calls, warnings, hooks: context.hooks, socket,
    acknowledge(response) { assert.equal(typeof ack, 'function'); ack(response); },
    advanceTime(ms) {
      const target = now + ms;
      while (true) {
        const due = [...timers.entries()].filter(([, timer]) => timer.at <= target)
          .sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        timers.delete(due[0]);
        now = due[1].at;
        due[1].callback();
      }
      now = target;
    }
  };
}

const rejected = createHarness();
rejected.hooks.advanceDraftAfterRound();
assert.deepEqual(rejected.calls[0], ['startNextRound', 'TEST', 2]);
rejected.acknowledge({ ok: false, reason: 'round_results_pending' });
rejected.advanceTime(0);
assert.deepEqual(rejected.calls[1], ['resync', 'round-advance-rejected']);

rejected.hooks.advanceDraftAfterRound();
rejected.acknowledge({ ok: false, reason: 'round_processing' });
rejected.advanceTime(1199);
assert.equal(rejected.calls.filter(call => call[0] === 'resync').length, 1);
rejected.advanceTime(1);
assert.deepEqual(rejected.calls.at(-1), ['resync', 'round-advance-rejected']);

const success = createHarness();
success.hooks.advanceDraftAfterRound();
success.acknowledge({ ok: true });
success.advanceTime(2000);
assert.equal(success.calls.length, 1);

const completed = createHarness();
completed.hooks.advanceDraftAfterRound();
completed.acknowledge({ ok: false, reason: 'draft_complete' });
assert.deepEqual(completed.calls.at(-1), ['endDraft']);

const disconnected = createHarness({ connected: false });
disconnected.hooks.beginRoundPlayerWaitRecovery();
disconnected.advanceTime(0);
assert.deepEqual(disconnected.calls.at(-1), ['connect']);

const waiting = createHarness();
waiting.hooks.beginRoundPlayerWaitRecovery();
waiting.advanceTime(0);
assert.deepEqual(waiting.calls.at(-1), ['resync', 'round-player-wait-recovery']);

const unavailable = createHarness({ socketPresent: false });
unavailable.hooks.advanceDraftAfterRound();
unavailable.hooks.beginRoundPlayerWaitRecovery();
assert.ok(unavailable.calls.some(call => call[0] === 'submit' && call[1] === false));
assert.equal(unavailable.warnings.filter(args => args[0].includes('Connection recovery unavailable')).length, 2);

console.log('Silent draft connection recovery tests passed.');
