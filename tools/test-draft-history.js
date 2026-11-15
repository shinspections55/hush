'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { indexedDB } = require('fake-indexeddb');

async function runDraftHistoryStorageTests(source) {
    'use strict';
    const databases = [];
    const connections = [];
    let phase = 'migration';
    const watchdog = setTimeout(() => { throw new Error(`Draft history test timed out: ${phase}`); }, 10000);
    function check(condition, message) {
        if (!condition) throw new Error(message);
    }
    function harness(host, entries = [], options = {}) {
        const name = `hush-history-test-${crypto.randomUUID()}`;
        databases.push(name);
        const saved = new Map(entries);
        const session = new Map();
        const errors = [];
        const fakeWindow = { location: { hostname: host } };
        const storage = map => ({
            getItem: key => map.has(key) ? map.get(key) : null,
            setItem(key, value) {
                if (options.quota) throw new DOMException('full', 'QuotaExceededError');
                map.set(key, value);
            },
            removeItem: key => map.delete(key)
        });
        const factory = {
            open() {
                if (options.blocked) throw new Error('IndexedDB unavailable');
                const request = indexedDB.open(name, 1);
                request.addEventListener('success', () => connections.push(request.result));
                return request;
            }
        };
        function load() {
            new Function('window', 'indexedDB', 'localStorage', 'sessionStorage', 'console', source)(
                fakeWindow, factory, storage(saved), storage(session),
                { warn(...args) { errors.push(args); }, error(...args) { errors.push(args); } }
            );
            return fakeWindow.HushDraftHistory;
        }
        return { saved, session, errors, load };
    }
    const draft = (code, day = 1) => ({
        draftCode: code, completed: true, timestamp: `2026-11-${String(day).padStart(2, '0')}`,
        teams: [{ name: 'Alice', budgetRemaining: 50, roster: [{ id: 1, bid: 1, acquisitionCost: 20 }] }]
    });
    try {
        const legacy = draft('OLD');
        const test = harness('hushff.com', [
            ['completedDrafts', JSON.stringify([legacy])],
            ['hushCriticalBackupV1', JSON.stringify({ completedDrafts: JSON.stringify([draft('BACKUP')]), userRankings: 'keep' })],
            ['firebase:authUser:test', 'keep login']
        ]);
        const history = test.load();
        await history.ready;
        check((await history.list()).length === 2, 'Migrate archive and backup');
        check(!test.saved.has('completedDrafts'), 'Remove migrated local history after commit');
        check(JSON.parse(test.saved.get('hushCriticalBackupV1')).userRankings === 'keep', 'Preserve other backup data');
        check(!JSON.parse(test.saved.get('hushCriticalBackupV1')).completedDrafts, 'Remove duplicate history backup');
        check(test.saved.get('firebase:authUser:test') === 'keep login', 'Preserve auth');
        const original = draft('NEW', 12);
        phase = 'saving';
        const first = history.save(original);
        original.teams[0].budgetRemaining = 0;
        await first;
        check((await history.get('NEW')).teams[0].budgetRemaining === 50, 'Capture snapshot when queued');
        await Promise.all([history.save({ ...draft('NEW', 12), revision: 1 }), history.save({ ...draft('NEW', 12), revision: 2 })]);
        check((await history.get('NEW')).revision === 2, 'Ordered updates keep latest revision');
        await Promise.all(Array.from({ length: 35 }, (_, i) => history.save(draft(`P${i}`, (i % 28) + 1))));
        check((await history.list()).length === 38, 'Production retains all history beyond AV minimum');
        test.session.set('currentDraft', 'NEW');
        check((await history.loadSummary()).draftCode === 'NEW', 'Exact draft selection');
        const reload = test.load();
        phase = 'reopening';
        await reload.ready;
        check((await reload.get('NEW')).revision === 2, 'Durable reopen');
        test.saved.set('completedDrafts', JSON.stringify([{ ...draft('NEW'), revision: -1 }]));
        const remigrate = test.load();
        await remigrate.ready;
        check((await remigrate.get('NEW')).revision === 2, 'Stale legacy copy cannot overwrite IndexedDB');
        await remigrate.removeForUser('Alice');
        check((await remigrate.list()).length === 0, 'Account deletion removes matching history');
        const dev = harness('localhost');
        phase = 'development retention';
        dev.session.set('currentDraft', 'D0');
        const devHistory = dev.load();
        await devHistory.ready;
        for (let i = 0; i < 5; i++) await devHistory.save(draft(`D${i}`, i + 1));
        check((await devHistory.list()).length === 3, 'Local development retains three drafts');
        const corrupt = harness('hushff.com', [
            ['completedDrafts', '{invalid history'],
            ['hushCriticalBackupV1', '{invalid backup']
        ]);
        const corruptHistory = corrupt.load();
        await corruptHistory.ready;
        await corruptHistory.save(draft('VALID'));
        check(corrupt.saved.get('completedDrafts') === '{invalid history', 'Invalid history is not deleted');
        check(corrupt.saved.get('hushCriticalBackupV1') === '{invalid backup', 'Invalid backup is not deleted');
        check((await corruptHistory.get('VALID')).draftCode === 'VALID', 'Invalid legacy data does not block new saves');
        const fullLocal = harness('hushff.com', [], { quota: true });
        phase = 'quota';
        const fullHistory = fullLocal.load();
        await fullHistory.ready;
        await fullHistory.save(draft('FULL'));
        check((await fullHistory.get('FULL')).draftCode === 'FULL', 'Full localStorage does not block IndexedDB saves');
        const unavailable = harness('hushff.com', [['completedDrafts', JSON.stringify([legacy])]], { blocked: true });
        phase = 'unavailable database';
        const unavailableHistory = unavailable.load();
        let rejected = false;
        try { await unavailableHistory.ready; } catch (error) { rejected = true; }
        check(rejected && unavailable.saved.has('completedDrafts'), 'Failed migration preserves local history');
        unavailable.session.set('currentDraft', 'RECOVERY');
        unavailable.session.set('latestDraftSummary', JSON.stringify(draft('RECOVERY')));
        check((await unavailableHistory.loadSummary()).draftCode === 'RECOVERY', 'Session recovery available when IndexedDB fails');
        for (const page of ['index', 'silentdraft', 'draft-summary', 'waivers', 'recent-drafts', 'account', 'admin-portal']) {
            for (const prefix of ['', 'public\\']) {
                const html = fs.readFileSync(path.join(__dirname, '..', `${prefix}${page}.html`), 'utf8');
                check(html.includes('/public/draft-history.js?v=20261112-idb'), `${prefix}${page} loads the shared store`);
            }
        }
        return { passed: true, checks: 'migration, backup, auth preservation, ordered writes, snapshot isolation, production retention, local retention, reopen, deletion, quota and recovery' };
    } finally {
        phase += ' / cleanup';
        connections.forEach(db => db.close());
        await Promise.all(databases.map(name => new Promise((resolve, reject) => {
            const request = indexedDB.deleteDatabase(name);
            request.onsuccess = resolve;
            request.onerror = () => reject(request.error);
        })));
        clearTimeout(watchdog);
    }
}

runDraftHistoryStorageTests(fs.readFileSync(path.join(__dirname, '..', 'public', 'draft-history.js'), 'utf8'))
    .then(result => console.log('Draft history tests passed:', result.checks))
    .catch(error => { console.error(error); process.exitCode = 1; });
