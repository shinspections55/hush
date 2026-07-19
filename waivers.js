document.addEventListener('DOMContentLoaded', () => {
    const DEFAULT_ROSTER_SETTINGS = { QB: 1, WR: 2, RB: 2, TE: 1, FLEX: 1, K: 1, DEF: 1, BN: 13 };
    const DEFAULT_BENCH_CUT_TARGET = 5;
    const MAX_DRAFT_BENCH = 13;
    const username = sessionStorage.getItem('username') || 'Your Team';

    const waiverPageMeta = document.getElementById('waiverPageMeta');
    const waiverPageNotice = document.getElementById('waiverPageNotice');
    const waiverOrderList = document.getElementById('waiverOrderList');
    const waiverPoolList = document.getElementById('waiverPoolList');
    const waiverPositionTabs = document.getElementById('waiverPositionTabs');
    const waiverSearchInput = document.getElementById('waiverSearchInput');
    const waiverStartBtn = document.getElementById('waiverStartBtn');
    const waiverPassBtn = document.getElementById('waiverPassBtn');
    const waiverModalBackdrop = document.getElementById('waiverModalBackdrop');
    const waiverModalPlayer = document.getElementById('waiverModalPlayer');
    const waiverDropSelect = document.getElementById('waiverDropSelect');
    const waiverConfirmBtn = document.getElementById('waiverConfirmBtn');
    const waiverCancelBtn = document.getElementById('waiverCancelBtn');

    const currentDraft = sessionStorage.getItem('currentDraft');
    let draftSummary = loadSummary();
    let waiverState = null;
    let selectedPosition = 'ALL';
    let pendingAddPlayer = null;

    const socket = window.io ? window.io({ reconnection: false }) : null;

    if (!draftSummary || !currentDraft) {
        waiverPageMeta.textContent = 'No draft summary is available.';
        waiverPageNotice.textContent = 'Finish a draft first, then return here for waivers.';
        return;
    }

    if (!draftSummary.draftCode) {
        draftSummary.draftCode = currentDraft;
    }

    function normalizeWaiverMode(value) {
        const normalized = String(value || '').trim().toLowerCase();
        if (normalized === 'random' || normalized === 'skill') return normalized;
        return 'off';
    }

    function normalizeWaiverState(rawState) {
        if (!rawState || typeof rawState !== 'object') return null;
        return {
            active: !!rawState.active,
            completed: !!rawState.completed,
            mode: normalizeWaiverMode(rawState.mode),
            order: Array.isArray(rawState.order) ? rawState.order.map(name => String(name || '').trim()).filter(Boolean) : [],
            turnIndex: Math.max(0, Number(rawState.turnIndex || 0)),
            updatedAt: Number(rawState.updatedAt || Date.now()),
            passesInRow: Math.max(0, Number(rawState.passesInRow || 0)),
            lastAction: rawState.lastAction || null,
            pool: Array.isArray(rawState.pool)
                ? rawState.pool.map(player => ({
                    id: Number(player.id),
                    name: String(player.name || '').trim(),
                    position: String(player.position || 'UNK').trim().toUpperCase(),
                    team: String(player.team || '').trim().toUpperCase(),
                    avgValue: Number(player.avgValue || 0),
                    prerank: Number(player.prerank || 999)
                }))
                : []
        };
    }

    function normalizeSummaryTeam(team) {
        return {
            name: team.name,
            budgetRemaining: Number.isFinite(team.budgetRemaining) ? team.budgetRemaining : Number(team.budget || 0),
            roster: Array.isArray(team.roster)
                ? team.roster.map(player => ({
                    id: player.id,
                    name: player.name,
                    position: player.position,
                    bid: player.bid,
                    prerank: player.prerank
                }))
                : []
        };
    }

    function toRosterInt(value, fallback, min, max) {
        const parsed = Number.parseInt(value, 10);
        if (Number.isNaN(parsed)) return fallback;
        return Math.max(min, Math.min(max, parsed));
    }

    function getSummaryRosterSettings() {
        const raw = (draftSummary && draftSummary.rosterSettings) || {};
        const settings = {
            QB: toRosterInt(raw.QB, DEFAULT_ROSTER_SETTINGS.QB, 0, 8),
            WR: toRosterInt(raw.WR, DEFAULT_ROSTER_SETTINGS.WR, 0, 10),
            RB: toRosterInt(raw.RB, DEFAULT_ROSTER_SETTINGS.RB, 0, 10),
            TE: toRosterInt(raw.TE, DEFAULT_ROSTER_SETTINGS.TE, 0, 8),
            FLEX: toRosterInt(raw.FLEX, DEFAULT_ROSTER_SETTINGS.FLEX, 0, 5),
            K: toRosterInt(raw.K, DEFAULT_ROSTER_SETTINGS.K, 0, 5),
            DEF: toRosterInt(raw.DEF, DEFAULT_ROSTER_SETTINGS.DEF, 0, 5),
            BN: toRosterInt(raw.BN, DEFAULT_ROSTER_SETTINGS.BN, 0, 20)
        };
        const total = settings.QB + settings.WR + settings.RB + settings.TE + settings.FLEX + settings.K + settings.DEF + settings.BN;
        if (total < 8) settings.BN += (8 - total);
        return settings;
    }

    function getBenchCutTarget() {
        const direct = Number.parseInt(draftSummary && draftSummary.benchCutTarget, 10);
        if (Number.isFinite(direct)) {
            return Math.max(0, Math.min(direct, MAX_DRAFT_BENCH));
        }
        return DEFAULT_BENCH_CUT_TARGET;
    }

    function getSlotBlueprint(settings) {
        const slots = [];
        const addSlots = (label, count, eligible) => {
            for (let i = 1; i <= count; i++) {
                slots.push({ label: count === 1 ? label : `${label}${i}`, eligible });
            }
        };

        addSlots('QB', settings.QB || 0, ['QB']);
        addSlots('WR', settings.WR || 0, ['WR']);
        addSlots('RB', settings.RB || 0, ['RB']);
        addSlots('TE', settings.TE || 0, ['TE']);
        addSlots('FLEX', settings.FLEX || 0, ['RB', 'WR', 'TE']);
        addSlots('K', settings.K || 0, ['K']);
        addSlots('DEF', settings.DEF || 0, ['DEF']);
        return slots;
    }

    function splitRoster(roster, settings) {
        const blueprint = getSlotBlueprint(settings);
        const used = [];
        const slots = blueprint.map(slot => {
            const found = (roster || [])
                .filter(player => slot.eligible.includes(player.position) && !used.includes(player))
                .sort((a, b) => Number(a.prerank || 999) - Number(b.prerank || 999))[0] || null;
            if (found) used.push(found);
            return { label: slot.label, player: found };
        });
        const bench = (roster || []).filter(player => !used.includes(player)).sort((a, b) => Number(a.prerank || 999) - Number(b.prerank || 999));
        return { slots, bench };
    }

    function getRequiredCuts(roster, bench) {
        const settings = getSummaryRosterSettings();
        const maxBenchPlayers = getBenchCutTarget();
        const maxTotalPlayers = getSlotBlueprint(settings).length + maxBenchPlayers;
        const overTotal = Math.max(0, (roster || []).length - maxTotalPlayers);
        const overBench = Math.max(0, (bench || []).length - maxBenchPlayers);
        return Math.max(overTotal, overBench);
    }

    function areAllTeamsCutComplete() {
        return (draftSummary.teams || []).every(team => {
            const split = splitRoster(team.roster || [], getSummaryRosterSettings());
            return getRequiredCuts(team.roster || [], split.bench) === 0;
        });
    }

    function getPlayerKey(player) {
        const id = Number(player && player.id);
        if (Number.isFinite(id) && id > 0) return `id:${id}`;
        return `name:${String(player && player.name || '').trim().toLowerCase()}`;
    }

    function getWaiverPoolPlayers() {
        if (waiverState && Array.isArray(waiverState.pool) && waiverState.pool.length > 0) {
            return waiverState.pool.slice().sort((a, b) => Number(a.prerank || 999) - Number(b.prerank || 999));
        }

        const snapshot = Array.isArray(draftSummary && draftSummary.allPlayersSnapshot) ? draftSummary.allPlayersSnapshot : [];
        const rostered = new Set();
        (draftSummary.teams || []).forEach(team => {
            (team.roster || []).forEach(player => rostered.add(getPlayerKey(player)));
        });

        return snapshot
            .filter(player => player && player.name && !rostered.has(getPlayerKey(player)))
            .map(player => ({
                id: Number(player.id),
                name: String(player.name || '').trim(),
                position: String(player.position || 'UNK').trim().toUpperCase(),
                team: String(player.team || '').trim().toUpperCase(),
                avgValue: Number(player.avgValue || 0),
                prerank: Number(player.prerank || 999)
            }))
            .sort((a, b) => Number(a.prerank || 999) - Number(b.prerank || 999));
    }

    function getCurrentWaiverTeamName() {
        if (!waiverState || !Array.isArray(waiverState.order) || waiverState.order.length === 0) return '';
        return waiverState.order[Math.max(0, Math.min(Number(waiverState.turnIndex || 0), waiverState.order.length - 1))] || '';
    }

    function getUserTeam() {
        return (draftSummary.teams || []).find(team => team.name === username) || null;
    }

    function isCurrentUserHost() {
        const host = String(draftSummary && draftSummary.host || '').trim();
        return !host || host === username;
    }

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function persistSummary() {
        if (!draftSummary) return;
        sessionStorage.setItem('latestDraftSummary', JSON.stringify(draftSummary));
    }

    function loadSummary() {
        const currentDraftCode = sessionStorage.getItem('currentDraft');
        const completedRaw = localStorage.getItem('completedDrafts');
        const latestRaw = sessionStorage.getItem('latestDraftSummary');

        if (completedRaw) {
            try {
                const completed = JSON.parse(completedRaw);
                const drafts = Array.isArray(completed) ? completed.filter(draft => draft && draft.completed) : [];
                if (currentDraftCode) {
                    const exact = drafts.find(draft => draft.draftCode === currentDraftCode);
                    if (exact) return exact;
                }
                if (drafts[0]) return drafts.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0))[0];
            } catch (_error) {
                // ignore
            }
        }

        if (latestRaw) {
            try {
                return JSON.parse(latestRaw);
            } catch (_error) {
                // ignore
            }
        }

        return null;
    }

    function syncFromServer() {
        if (!socket || !draftSummary.draftCode) {
            render();
            return;
        }

        socket.emit('joinDraftRoom', draftSummary.draftCode, username);
        socket.emit('getDraftState', draftSummary.draftCode, (response) => {
            if (response && response.ok && response.draft) {
                const serverDraft = response.draft;
                const serverTeams = serverDraft.draftState && Array.isArray(serverDraft.draftState.teams)
                    ? serverDraft.draftState.teams
                    : (Array.isArray(serverDraft.teams) ? serverDraft.teams : []);
                draftSummary.teams = serverTeams.map(normalizeSummaryTeam);
                draftSummary.host = String(serverDraft.host || '').trim();
                draftSummary.waiverMode = normalizeWaiverMode(serverDraft.waiverMode);
                draftSummary.rosterSettings = serverDraft.rosterSettings || draftSummary.rosterSettings;
                draftSummary.benchCutTarget = typeof serverDraft.benchCutTarget !== 'undefined' ? serverDraft.benchCutTarget : draftSummary.benchCutTarget;
                draftSummary.allPlayersSnapshot = serverDraft.draftState && Array.isArray(serverDraft.draftState.allPlayers)
                    ? serverDraft.draftState.allPlayers
                    : (draftSummary.allPlayersSnapshot || []);
                waiverState = normalizeWaiverState(serverDraft.waiverState || null);
                persistSummary();
            }
            render();
        });
    }

    function renderOrder() {
        const order = waiverState && Array.isArray(waiverState.order) ? waiverState.order : [];
        const currentTurn = getCurrentWaiverTeamName();
        waiverOrderList.innerHTML = order.length
            ? order.map((teamName, index) => `
                <div class="waiver-order-item ${waiverState && waiverState.active && currentTurn === teamName ? 'active' : ''}">
                    <span class="waiver-order-rank">${index + 1}</span>
                    <span>${escapeHtml(teamName)}</span>
                    <span class="bench-rank">${waiverState && waiverState.active && currentTurn === teamName ? 'On clock' : 'Waiting'}</span>
                </div>
            `).join('')
            : '<div class="bench-empty">No waiver order available.</div>';
    }

    function renderPool() {
        const userTeam = getUserTeam();
        const pool = getWaiverPoolPlayers();
        const searchTerm = String(waiverSearchInput && waiverSearchInput.value || '').trim().toLowerCase();
        const filtered = pool.filter(player => {
            if (selectedPosition !== 'ALL' && player.position !== selectedPosition) return false;
            if (!searchTerm) return true;
            return player.name.toLowerCase().includes(searchTerm) || player.team.toLowerCase().includes(searchTerm);
        });

        const canAct = !!(waiverState && waiverState.active && getCurrentWaiverTeamName() === username && userTeam && (userTeam.roster || []).length > 0);

        waiverPoolList.innerHTML = filtered.length
            ? filtered.map(player => `
                <div class="waiver-pool-item">
                    <span class="waiver-rank">#${Number(player.prerank || 999)}</span>
                    <span class="pos-badge pos-${escapeHtml(player.position)}">${escapeHtml(player.position)}</span>
                    <span class="waiver-name">${escapeHtml(player.name)} <span class="waiver-meta">${escapeHtml(player.team || 'FA')} | AV $${Number(player.avgValue || 0)}</span></span>
                    <span class="waiver-meta">Default Rank</span>
                    <button type="button" class="account-btn waiver-add-btn" data-player-id="${Number(player.id)}" ${canAct ? '' : 'disabled'}>+</button>
                </div>
            `).join('')
            : '<div class="bench-empty">No undrafted players match the current filters.</div>';

        waiverPoolList.querySelectorAll('.waiver-add-btn').forEach(button => {
            button.addEventListener('click', () => {
                const playerId = Number(button.getAttribute('data-player-id'));
                const player = pool.find(entry => Number(entry.id) === playerId);
                if (!player) return;
                openWaiverModal(player);
            });
        });
    }

    function render() {
        const waiverMode = normalizeWaiverMode(draftSummary && draftSummary.waiverMode);
        const allCutsComplete = areAllTeamsCutComplete();
        const currentTurn = getCurrentWaiverTeamName();
        const userTeam = getUserTeam();
        const canStart = !!(isCurrentUserHost() && waiverMode !== 'off' && (!waiverState || (!waiverState.active && !waiverState.completed)));
        const canPass = !!(waiverState && waiverState.active && currentTurn === username);

        waiverPageMeta.textContent = `Draft ${draftSummary.draftCode || 'N/A'} | Waiver Mode: ${waiverMode.toUpperCase()}`;

        if (waiverMode === 'off') {
            waiverPageNotice.textContent = 'Waivers are turned off for this draft.';
            waiverStartBtn.hidden = true;
            waiverPassBtn.hidden = true;
            waiverOrderList.innerHTML = '<div class="bench-empty">Waivers are disabled.</div>';
            waiverPoolList.innerHTML = '<div class="bench-empty">No waiver pool is available because waivers are off.</div>';
            return;
        }

        waiverStartBtn.hidden = !canStart;
        waiverStartBtn.disabled = !canStart;
        waiverPassBtn.hidden = false;
        waiverPassBtn.disabled = !canPass;

        if (!waiverState || (!waiverState.active && !waiverState.completed)) {
            waiverPageNotice.textContent = isCurrentUserHost()
                ? `Waivers are ready. Start when ready using ${waiverMode.toUpperCase()} order.`
                : 'Waivers are enabled. Waiting for the host to start waivers.';
        } else if (waiverState.active) {
            waiverPageNotice.textContent = currentTurn === username
                ? 'It is your waiver turn. Choose an undrafted player, then drop one player from your roster, or pass.'
                : `Waivers are active. On the clock: ${currentTurn || 'N/A'}.`;
        } else {
            waiverPageNotice.textContent = `Waivers are complete (${waiverState.mode.toUpperCase()} order).`;
        }

        renderOrder();
        renderPool();
    }

    function openWaiverModal(player) {
        const userTeam = getUserTeam();
        const roster = Array.isArray(userTeam && userTeam.roster) ? userTeam.roster.slice().sort((a, b) => Number(a.prerank || 999) - Number(b.prerank || 999)) : [];
        if (!roster.length) {
            alert('You need a player on your roster to make an add/drop move.');
            return;
        }

        pendingAddPlayer = player;
        waiverModalPlayer.textContent = `${player.name} (${player.position}) | Rank ${Number(player.prerank || 999)} | AV $${Number(player.avgValue || 0)}`;
        waiverDropSelect.innerHTML = roster.map(entry => `<option value="${Number(entry.id)}">${escapeHtml(entry.name)} (${escapeHtml(entry.position || 'UNK')})</option>`).join('');
        waiverModalBackdrop.hidden = false;
    }

    function closeWaiverModal() {
        pendingAddPlayer = null;
        waiverModalBackdrop.hidden = true;
    }

    waiverCancelBtn.addEventListener('click', closeWaiverModal);
    waiverModalBackdrop.addEventListener('click', (event) => {
        if (event.target === waiverModalBackdrop) {
            closeWaiverModal();
        }
    });

    waiverConfirmBtn.addEventListener('click', () => {
        if (!socket || !draftSummary.draftCode || !pendingAddPlayer) return;
        const dropPlayerId = Number(waiverDropSelect.value);
        if (!Number.isFinite(dropPlayerId)) {
            alert('Select a player to drop.');
            return;
        }

        socket.emit('submitWaiverMove', {
            draftCode: draftSummary.draftCode,
            teamName: username,
            action: 'addDrop',
            addPlayerId: Number(pendingAddPlayer.id),
            dropPlayerId
        }, (response) => {
            if (!response || !response.ok) {
                alert(`Waiver add/drop failed: ${(response && response.reason) || 'unknown_error'}`);
                return;
            }
            closeWaiverModal();
        });
    });

    waiverPassBtn.addEventListener('click', () => {
        if (!socket || !draftSummary.draftCode || !waiverState || !waiverState.active) return;
        socket.emit('submitWaiverMove', {
            draftCode: draftSummary.draftCode,
            teamName: username,
            action: 'pass'
        }, (response) => {
            if (!response || !response.ok) {
                alert(`Unable to pass turn: ${(response && response.reason) || 'unknown_error'}`);
            }
        });
    });

    waiverStartBtn.addEventListener('click', () => {
        if (!socket || !draftSummary.draftCode) return;
        const mode = normalizeWaiverMode(draftSummary && draftSummary.waiverMode);
        socket.emit('startWaivers', { draftCode: draftSummary.draftCode, mode }, (response) => {
            if (!response || !response.ok) {
                alert(`Unable to start waivers: ${(response && response.reason) || 'unknown_error'}`);
                return;
            }
            waiverState = normalizeWaiverState(response.waiverState || null);
            render();
        });
    });

    if (waiverPositionTabs) {
        waiverPositionTabs.querySelectorAll('.waiver-pos-tab').forEach(button => {
            button.addEventListener('click', () => {
                selectedPosition = button.getAttribute('data-pos') || 'ALL';
                waiverPositionTabs.querySelectorAll('.waiver-pos-tab').forEach(tab => tab.classList.toggle('active', tab === button));
                renderPool();
            });
        });
    }

    if (waiverSearchInput) {
        waiverSearchInput.addEventListener('input', renderPool);
    }

    if (socket) {
        socket.on('benchUpdated', (data) => {
            const team = (draftSummary.teams || []).find(entry => entry.name === data.teamName);
            if (!team) return;
            team.roster = Array.isArray(data.newRoster) ? data.newRoster : team.roster;
            persistSummary();
            render();
        });

        socket.on('waiversStarted', (data) => {
            if (!data || data.draftCode !== draftSummary.draftCode) return;
            waiverState = normalizeWaiverState(data.waiverState || null);
            if (Array.isArray(data.teams)) draftSummary.teams = data.teams.map(normalizeSummaryTeam);
            if (Array.isArray(data.allPlayersSnapshot)) draftSummary.allPlayersSnapshot = data.allPlayersSnapshot;
            persistSummary();
            render();
        });

        socket.on('waiverStateUpdated', (data) => {
            if (!data || data.draftCode !== draftSummary.draftCode) return;
            if (Array.isArray(data.teams)) draftSummary.teams = data.teams.map(normalizeSummaryTeam);
            if (Array.isArray(data.allPlayersSnapshot)) draftSummary.allPlayersSnapshot = data.allPlayersSnapshot;
            waiverState = normalizeWaiverState(data.waiverState || null);
            persistSummary();
            render();
        });
    }

    syncFromServer();
});