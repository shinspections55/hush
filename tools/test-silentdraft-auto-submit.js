'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'silentdraft.js'), 'utf8');
function section(start, end) {
    const first = source.indexOf(start);
    const last = source.indexOf(end, first + start.length);
    assert.ok(first !== -1 && last > first, `Missing source section: ${start}`);
    return source.slice(first, last);
}

function setup() {
    let now = 100000;
    let nextId = 1;
    const tasks = new Map();
    const submissions = [];
    const button = {
        disabled: false, textContent: 'Submit Bids', dataset: {},
        onclick() {
            submissions.push({ at: now, forced: button.dataset.forceAutoSubmit });
            button.disabled = true;
        }
    };
    function schedule(callback, delay, interval = false) {
        const id = nextId++;
        tasks.set(id, { callback, at: now + delay, delay, interval });
        return id;
    }
    const context = {
        Date: { now: () => now },
        console: { log() {}, warn() {} },
        document: { getElementById: id => id === 'submit-bids' ? button : null },
        autoDraftEnabled: true, allDraftMembers: ['Alice'], isDraftEnding: false, isPaused: false,
        autoDraftSoloGraceTimeoutId: null, autoDraftSoloGraceIntervalId: null,
        timerInterval: null, serverClockOffsetMs: 0, timer: 0,
        setDraftablePlayersVisible() {}, playCountdownCue() {},
        window: { handleRoundTimerExpired() { throw new Error('Unexpected round expiration'); } },
        setTimeout: (callback, delay) => schedule(callback, delay),
        setInterval: (callback, delay) => schedule(callback, delay, true),
        clearTimeout: id => tasks.delete(id),
        clearInterval: id => tasks.delete(id)
    };
    vm.createContext(context);
    vm.runInContext(`
        ${section('    function clearAutoDraftSoloGraceWindow()', '    let pauseLockOverlay')}
        ${section('    function setRoundSubmitEnabled(', '    function setDraftablePlayersVisible(')}
        ${section('    function startLiveRoundTimer(', '    function startLocalRoundTimer(')}
    `, context);
    function advance(ms) {
        const target = now + ms;
        while (true) {
            const next = [...tasks].filter(([, task]) => task.at <= target)
                .sort((a, b) => a[1].at - b[1].at)[0];
            if (!next) break;
            const [id, task] = next;
            now = task.at;
            if (task.interval) task.at += task.delay;
            else tasks.delete(id);
            task.callback();
        }
        now = target;
    }
    return { context, button, submissions, advance, now: () => now };
}

// The authoritative start is in the future: start the grace period only when bidding opens.
{
    const test = setup();
    test.context.startLiveRoundTimer(100750, 280750);
    assert.equal(test.button.disabled, true);
    assert.equal(test.context.autoDraftSoloGraceTimeoutId, null);
    test.advance(700);
    assert.equal(test.submissions.length, 0);
    test.advance(100);
    assert.equal(test.button.disabled, false);
    assert.equal(test.button.textContent, 'Auto submit in 10s');
    const openedAt = test.now();
    test.advance(5000);
    const timerId = test.context.autoDraftSoloGraceTimeoutId;
    test.context.scheduleAutoDraftSoloGraceWindow();
    assert.equal(test.context.autoDraftSoloGraceTimeoutId, timerId, 'Status sync must not restart grace');
    test.context.startLiveRoundTimer(100750, 280750);
    assert.equal(test.context.autoDraftSoloGraceTimeoutId, timerId, 'Round state sync must not restart grace');
    test.advance(4999);
    assert.equal(test.submissions.length, 0);
    test.advance(1);
    assert.equal(test.submissions.length, 1);
    assert.equal(test.submissions[0].at - openedAt, 10000);
    assert.equal(test.submissions[0].forced, '1');
    assert.equal(test.button.dataset.forceAutoSubmit, undefined);
    test.advance(5000);
    assert.equal(test.submissions.length, 1);
}

// Already-live rounds and enabling auto draft during bidding use the same ten-second window.
{
    const test = setup();
    test.context.autoDraftEnabled = false;
    test.context.startLiveRoundTimer(99000, 280000);
    test.advance(5000);
    assert.equal(test.submissions.length, 0);
    test.context.autoDraftEnabled = true;
    test.context.scheduleAutoDraftSoloGraceWindow();
    test.advance(10000);
    assert.equal(test.submissions.length, 1);
}

for (const stop of ['disable', 'pause', 'ending', 'manual', 'multiplayer']) {
    const test = setup();
    test.context.startLiveRoundTimer(99000, 280000);
    test.advance(5000);
    if (stop === 'disable') test.context.autoDraftEnabled = false;
    if (stop === 'pause') test.context.isPaused = true;
    if (stop === 'ending') test.context.isDraftEnding = true;
    if (stop === 'manual') {
        test.button.onclick();
        test.context.clearAutoDraftSoloGraceWindow();
    }
    if (stop === 'multiplayer') test.context.allDraftMembers.push('Bob');
    test.context.scheduleAutoDraftSoloGraceWindow();
    test.advance(15000);
    assert.equal(test.submissions.length, stop === 'manual' ? 1 : 0, stop);
}

console.log('Silent draft auto-submit timing and cancellation tests passed.');
