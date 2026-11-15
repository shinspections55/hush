(function () {
    'use strict';

    const localDev = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);
    let databasePromise;
    let queue = Promise.resolve();

    function openDatabase() {
        if (!databasePromise) databasePromise = new Promise((resolve, reject) => {
            const request = indexedDB.open('hush-draft-history', 1);
            request.onupgradeneeded = () => {
                request.result.createObjectStore('drafts', { keyPath: 'draftCode' });
            };
            request.onsuccess = () => {
                const db = request.result;
                db.onversionchange = () => { db.close(); databasePromise = null; };
                resolve(db);
            };
            request.onerror = () => { databasePromise = null; reject(request.error); };
            request.onblocked = () => console.warn('[draft-history] Database upgrade blocked by another open tab.');
        });
        return databasePromise;
    }

    async function transaction(mode, action) {
        const db = await openDatabase();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('drafts', mode);
            let result;
            tx.oncomplete = () => resolve(result);
            tx.onabort = () => reject(tx.error || new Error('Draft history transaction aborted'));
            try {
                action(tx.objectStore('drafts'), value => { result = value; });
            } catch (error) {
                tx.abort();
                reject(error);
            }
        });
    }

    function serialize(operation) {
        const pending = queue.then(operation);
        queue = pending.catch(error => console.error('[draft-history] Storage operation failed:', error));
        return pending;
    }

    function validate(draft) {
        if (!draft || draft.completed !== true || typeof draft.draftCode !== 'string' || !draft.draftCode.trim()) {
            throw new Error('Completed draft requires a draft code');
        }
    }

    async function prune(currentCode) {
        if (!localDev) return;
        await transaction('readwrite', store => {
            const request = store.getAll();
            request.onsuccess = () => {
                const drafts = request.result.sort((a, b) =>
                    Number(b.draftCode === currentCode) - Number(a.draftCode === currentCode)
                    || (Date.parse(b.timestamp) || 0) - (Date.parse(a.timestamp) || 0));
                drafts.slice(3).forEach(draft => store.delete(draft.draftCode));
            };
        });
    }

    const ready = serialize(async () => {
        await openDatabase();
        const raw = localStorage.getItem('completedDrafts');
        const backupRaw = localStorage.getItem('hushCriticalBackupV1');
        let backup = null;
        try {
            backup = backupRaw ? JSON.parse(backupRaw) : null;
        } catch (error) {
            console.warn('[draft-history] Invalid legacy backup preserved without changes:', error);
        }
        const backupHistory = backup && typeof backup.completedDrafts === 'string' ? backup.completedDrafts : null;
        const entries = new Map();
        const migrated = new Set();
        for (const value of [backupHistory, raw]) {
            if (!value) continue;
            try {
                const drafts = JSON.parse(value);
                if (!Array.isArray(drafts)) throw new Error('Legacy draft history is not an array');
                const completed = drafts.filter(draft => draft && draft.completed === true);
                completed.forEach(validate);
                completed.forEach(draft => entries.set(draft.draftCode, draft));
                migrated.add(value);
            } catch (error) {
                console.warn('[draft-history] Invalid legacy history preserved without changes:', error);
            }
        }
        await transaction('readwrite', store => {
            for (const draft of entries.values()) {
                const request = store.get(draft.draftCode);
                request.onsuccess = () => {
                    if (!request.result) store.put(draft);
                };
            }
        });
        // Only remove legacy copies after the database transaction commits.
        if (raw && migrated.has(raw) && localStorage.getItem('completedDrafts') === raw) localStorage.removeItem('completedDrafts');
        if (backupHistory && migrated.has(backupHistory) && localStorage.getItem('hushCriticalBackupV1') === backupRaw) {
            delete backup.completedDrafts;
            localStorage.setItem('hushCriticalBackupV1', JSON.stringify(backup));
        }
        await prune(sessionStorage.getItem('currentDraft'));
    });

    function list() {
        return ready.then(() => serialize(() => transaction('readonly', (store, result) => {
            const request = store.getAll();
            request.onsuccess = () => result(request.result.sort((a, b) =>
                (Date.parse(b.timestamp) || 0) - (Date.parse(a.timestamp) || 0)));
        })));
    }

    function save(draft) {
        // Capture now so later UI mutations cannot change a queued save.
        validate(draft);
        const snapshot = structuredClone(draft);
        return ready.then(() => serialize(async () => {
            await transaction('readwrite', store => store.put(snapshot));
            try {
                const raw = sessionStorage.getItem('latestDraftSummary');
                if (raw && JSON.parse(raw).draftCode === snapshot.draftCode) {
                    sessionStorage.removeItem('latestDraftSummary');
                }
            } catch (error) {
                console.warn('[draft-history] Could not clear the legacy session snapshot:', error);
            }
            await prune(snapshot.draftCode);
        }));
    }

    function get(code) {
        return ready.then(() => serialize(() => transaction('readonly', (store, result) => {
            const request = store.get(code);
            request.onsuccess = () => result(request.result || null);
        })));
    }

    async function loadSummary() {
        const code = sessionStorage.getItem('currentDraft');
        const legacy = sessionStorage.getItem('latestDraftSummary');
        if (legacy) {
            const draft = JSON.parse(legacy);
            if (draft && draft.completed === true && (!code || draft.draftCode === code)) return draft;
        }
        const exact = code && await get(code);
        if (exact) return exact;
        const drafts = await list();
        return drafts[0] || null;
    }

    function removeForUser(username) {
        return ready.then(() => serialize(() => transaction('readwrite', store => {
            const request = store.getAll();
            request.onsuccess = () => request.result.forEach(draft => {
                if ((draft.teams || []).some(team => String(team.name || '').trim() === username)) {
                    store.delete(draft.draftCode);
                }
            });
        })));
    }

    window.HushDraftHistory = { ready, list, get, save, loadSummary, removeForUser };
})();
