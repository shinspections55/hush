'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'dev-storage-cleanup.js'), 'utf8');
const drafts = Array.from({ length: 8 }, (_, index) => ({
    draftCode: `D${index}`, completed: true, timestamp: `2026-11-${String(index + 1).padStart(2, '0')}`
}));
const active = { draftCode: 'ACTIVE', completed: false, roster: ['Keep me'] };

function run(hostname, current = 'ACTIVE', history = [...drafts, active]) {
    const saved = new Map([
        ['completedDrafts', JSON.stringify(history)],
        ['silentDraftDefaultRankingsCache', 'rebuildable'],
        ['drafts', '{"ACTIVE":{"roster":["Keep me"]}}'],
        ['userRankings', '{"edited":true}'],
        ['firebase:authUser:test', 'login'],
        ['rankingsDraftState', 'active rankings snapshot'],
        ['hushCriticalBackupV1', JSON.stringify({
            completedDrafts: JSON.stringify(history), userRankings: 'edited backup', wallet: 'wallet backup'
        })]
    ]);
    const events = {};
    const warnings = [];
    const context = {
        window: { location: { hostname }, addEventListener(name, callback) { events[name] = callback; } },
        localStorage: {
            getItem: key => saved.has(key) ? saved.get(key) : null,
            setItem: (key, value) => saved.set(key, value),
            removeItem: key => saved.delete(key)
        },
        sessionStorage: { getItem: () => current },
        console: { info() {}, warn(...args) { warnings.push(args); } }
    };
    vm.runInNewContext(source, context);
    return { context, saved, events, warnings };
}

for (const host of ['localhost', '127.0.0.1', '[::1]']) {
    const test = run(host);
    const kept = JSON.parse(test.saved.get('completedDrafts'));
    assert.deepEqual(kept.filter(d => d.completed).map(d => d.draftCode), ['D5', 'D6', 'D7']);
    assert.deepEqual(kept.find(d => d.draftCode === 'ACTIVE'), active);
    assert.equal(test.saved.has('silentDraftDefaultRankingsCache'), false);
    assert.equal(test.saved.get('userRankings'), '{"edited":true}');
    assert.equal(test.saved.get('firebase:authUser:test'), 'login');
    assert.equal(test.saved.get('rankingsDraftState'), 'active rankings snapshot');
    assert.equal(test.saved.get('drafts'), '{"ACTIVE":{"roster":["Keep me"]}}');
    const backup = JSON.parse(test.saved.get('hushCriticalBackupV1'));
    assert.equal(backup.completedDrafts, test.saved.get('completedDrafts'));
    assert.equal(backup.userRankings, 'edited backup');
    assert.equal(backup.wallet, 'wallet backup');
    const before = [...test.saved];
    test.events.pageshow();
    assert.deepEqual([...test.saved], before, 'Cleanup is idempotent');
}

const current = run('localhost', 'D0');
assert.deepEqual(JSON.parse(current.saved.get('completedDrafts')).filter(d => d.completed)
    .map(d => d.draftCode), ['D0', 'D6', 'D7'], 'Current summary must survive even when older');
const newDraft = { draftCode: 'NEW', completed: true, timestamp: '2026-11-12' };
const retained = current.context.window.HushDevStorage.trimCompletedDrafts([...drafts, newDraft], 'NEW');
assert.equal(retained.length, 3, 'Trim before save keeps archive bounded on the fourth draft');
assert.ok(retained.includes(newDraft));

for (const host of ['hushff.com', 'www.hushff.com', 'localhost.example.com']) {
    const test = run(host);
    assert.equal(test.context.window.HushDevStorage, undefined);
    assert.equal(JSON.parse(test.saved.get('completedDrafts')).length, 9);
    assert.equal(test.saved.get('silentDraftDefaultRankingsCache'), 'rebuildable');
    assert.deepEqual(test.events, {});
}

const corrupt = run('localhost');
corrupt.saved.set('completedDrafts', '{bad');
corrupt.saved.set('hushCriticalBackupV1', '{bad backup');
corrupt.context.window.HushDevStorage.cleanup();
assert.equal(corrupt.saved.get('completedDrafts'), '{bad');
assert.equal(corrupt.saved.get('hushCriticalBackupV1'), '{bad backup');
assert.equal(corrupt.warnings.length, 2);
corrupt.context.localStorage.setItem = () => { throw Object.assign(new Error('full'), { name: 'QuotaExceededError' }); };
corrupt.saved.set('completedDrafts', JSON.stringify(drafts));
assert.doesNotThrow(() => corrupt.context.window.HushDevStorage.cleanup());
assert.equal(JSON.parse(corrupt.saved.get('completedDrafts')).length, 8);

const migrating = run('localhost');
migrating.saved.set('completedDrafts', JSON.stringify(drafts));
migrating.context.window.HushDraftHistory = {};
migrating.context.window.HushDevStorage.cleanup();
assert.equal(JSON.parse(migrating.saved.get('completedDrafts')).length, 8,
    'Legacy cleanup must leave migration sources intact when IndexedDB history is active');

for (const file of ['index.html', 'public/index.html', 'silentdraft.html', 'public/silentdraft.html',
    'draft-summary.html', 'public/draft-summary.html']) {
    assert.ok(fs.readFileSync(path.join(__dirname, '..', file), 'utf8')
        .includes('/public/dev-storage-cleanup.js?v=20261112-idb'), `${file} loads cleanup`);
}
console.log('Local development storage cleanup, protection, host gating and retention tests passed.');
