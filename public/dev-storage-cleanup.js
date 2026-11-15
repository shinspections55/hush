(function () {
    'use strict';

    if (!['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)) return;

    function trimCompletedDrafts(drafts, currentCode) {
        if (!Array.isArray(drafts)) throw new Error('Completed draft history is not an array');
        const completed = drafts.filter(draft => draft && draft.completed === true);
        const recent = completed.map((draft, index) => ({ draft, index }))
            .sort((a, b) => {
                const aCurrent = currentCode && a.draft.draftCode === currentCode ? 1 : 0;
                const bCurrent = currentCode && b.draft.draftCode === currentCode ? 1 : 0;
                return bCurrent - aCurrent
                    || (Date.parse(b.draft.timestamp) || 0) - (Date.parse(a.draft.timestamp) || 0)
                    || b.index - a.index;
            }).slice(0, 3);
        const kept = new Set(recent.map(entry => entry.draft));
        return drafts.filter(draft => !draft || draft.completed !== true || kept.has(draft));
    }

    function cleanup() {
        let currentCode;
        try {
            currentCode = sessionStorage.getItem('currentDraft');
        } catch (error) {
            console.warn('[dev-storage] Could not identify the active draft:', error);
            return;
        }
        try {
            if (localStorage.getItem('silentDraftDefaultRankingsCache') !== null) {
                localStorage.removeItem('silentDraftDefaultRankingsCache');
                console.info('[dev-storage] Removed rebuildable default rankings cache.');
            }
            if (window.HushDraftHistory) return;
            const raw = localStorage.getItem('completedDrafts');
            if (raw) {
                const trimmed = JSON.stringify(trimCompletedDrafts(JSON.parse(raw), currentCode));
                if (trimmed !== raw) {
                    localStorage.setItem('completedDrafts', trimmed);
                    console.info('[dev-storage] Retained the three newest completed test drafts (including the current draft).');
                }
            }
        } catch (error) {
            console.warn('[dev-storage] Local cleanup failed; unprocessed data was preserved:', error);
        }
        try {
            const raw = localStorage.getItem('hushCriticalBackupV1');
            if (!raw) return;
            const backup = JSON.parse(raw);
            if (!backup || typeof backup !== 'object' || Array.isArray(backup)) {
                throw new Error('Critical backup is not an object');
            }
            if (typeof backup.completedDrafts !== 'string') return;
            const trimmed = JSON.stringify(trimCompletedDrafts(JSON.parse(backup.completedDrafts), currentCode));
            if (trimmed !== backup.completedDrafts) {
                backup.completedDrafts = trimmed;
                localStorage.setItem('hushCriticalBackupV1', JSON.stringify(backup));
                console.info('[dev-storage] Trimmed completed test drafts in the backup; other backup entries are unchanged.');
            }
        } catch (error) {
            console.warn('[dev-storage] Backup cleanup failed; unprocessed backup data was preserved:', error);
        }
    }

    window.HushDevStorage = { cleanup, trimCompletedDrafts };
    cleanup();
    window.addEventListener('pageshow', cleanup);
})();
