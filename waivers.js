document.addEventListener('DOMContentLoaded', () => {
    const DEFAULT_ROSTER_SETTINGS = { QB: 1, WR: 2, RB: 2, TE: 1, FLEX: 1, K: 1, DEF: 1, BN: 13 };
    const DEFAULT_BENCH_CUT_TARGET = 5;
    const MAX_DRAFT_BENCH = 13;
    const username = sessionStorage.getItem('username') || 'Your Team';
    const normalizedUsername = String(username || '').trim().toLowerCase();

    const waiverPageMeta = document.getElementById('waiverPageMeta');
    const waiverPageNotice = document.getElementById('waiverPageNotice');
    const waiverOrderList = document.getElementById('waiverOrderList');
    const waiverPoolList = document.getElementById('waiverPoolList');
    const waiverPositionTabs = document.getElementById('waiverPositionTabs');
    const waiverSearchInput = document.getElementById('waiverSearchInput');
    const waiverStartBtn = document.getElementById('waiverStartBtn');
    const waiverPassBtn = document.getElementById('waiverPassBtn');
    const waiverInlineDropSelect = document.getElementById('waiverInlineDropSelect');
    const waiverOnClockTitle = document.getElementById('waiverOnClockTitle');
    const waiverOnClockMeta = document.getElementById('waiverOnClockMeta');
    const waiverOnClockStarters = document.getElementById('waiverOnClockStarters');
    const waiverOnClockBench = document.getElementById('waiverOnClockBench');
    const waiverTurnAlert = document.getElementById('waiverTurnAlert');
    const waiverTurnAlertText = document.getElementById('waiverTurnAlertText');

    const currentDraft = sessionStorage.getItem('currentDraft');
    let draftSummary = loadSummary();
    let waiverState = null;
    let selectedPosition = 'ALL';
    let lastTurnAlertKey = '';
    let turnAlertTimeout = null;
    let onClockRosterCount = 0;

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

    function parseRankNumber(value, fallback = 999) {
        if (typeof value === 'number' && Number.isFinite(value)) {
            return Math.max(1, Math.floor(value));
        }
        const cleaned = String(value || '').replace(/[^0-9.-]/g, '');
        const parsed = Number.parseInt(cleaned, 10);
        if (Number.isFinite(parsed) && parsed > 0) {
            return parsed;
        }
        return fallback;
    }

    function getPlayerPositionRank(player) {
        const pos = String(player && player.position || '').trim().toUpperCase();
        const positionRankFieldByPos = {
            QB: 'qbRank',
            RB: 'RBrank',
            WR: 'WRrank',
            TE: 'TErank',
            K: 'Krank',
            DEF: 'DEFrank'
        };

        const specificField = positionRankFieldByPos[pos];
        const specificRank = parseRankNumber(specificField ? player && player[specificField] : undefined, NaN);
        if (Number.isFinite(specificRank) && specificRank > 0) return specificRank;

        const positionRank = parseRankNumber(player && player.positionRank, NaN);
        if (Number.isFinite(positionRank) && positionRank > 0) return positionRank;

        return parseRankNumber(player && player.prerank, 999);
    }

    function normalizeWaiverState(rawState) {
        if (!rawState || typeof rawState !== 'object') return null;
        return {
            active: !!rawState.active,
            completed: !!rawState.completed,
            mode: normalizeWaiverMode(rawState.mode),
            order: Array.isArray(rawState.order) ? rawState.order.map(name => String(name || '').trim()).filter(Boolean) : [],
            turnIndex: Math.max(0, Number(rawState.turnIndex || 0)),
            turnDurationMs: Math.max(1000, Number(rawState.turnDurationMs || 180000)),
            turnEndsAt: Number(rawState.turnEndsAt || 0),
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
                    positionRank: getPlayerPositionRank(player),
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

    function getRosterPlayerById(team, playerId) {
        const id = Number(playerId);
        if (!Number.isFinite(id) || !team || !Array.isArray(team.roster)) return null;
        return team.roster.find(player => Number(player && player.id) === id) || null;
    }

    function isStarterPlayerOnTeam(team, playerId) {
        const id = Number(playerId);
        if (!Number.isFinite(id) || !team || !Array.isArray(team.roster)) return false;
        const split = splitRoster(team.roster, getSummaryRosterSettings());
        return (split.slots || []).some(slot => Number(slot && slot.player && slot.player.id) === id);
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
                positionRank: getPlayerPositionRank(player),
                prerank: Number(player.prerank || 999)
            }))
            .sort((a, b) => Number(a.prerank || 999) - Number(b.prerank || 999));
    }

    function getCurrentWaiverTeamName() {
        if (!waiverState || !Array.isArray(waiverState.order) || waiverState.order.length === 0) return '';
        return waiverState.order[Math.max(0, Math.min(Number(waiverState.turnIndex || 0), waiverState.order.length - 1))] || '';
    }

    function isCurrentUserTeamName(teamName) {
        return String(teamName || '').trim().toLowerCase() === normalizedUsername;
    }

    function getUserTeam() {
        return (draftSummary.teams || []).find(team => isCurrentUserTeamName(team.name)) || null;
    }

    function getWaiverSecondsRemaining() {
        if (!waiverState || !waiverState.active) return null;
        const endTs = Number(waiverState.turnEndsAt || 0);
        if (!Number.isFinite(endTs) || endTs <= 0) return null;
        return Math.max(0, Math.ceil((endTs - Date.now()) / 1000));
    }

    function formatClock(secondsTotal) {
        const safeSeconds = Math.max(0, Number(secondsTotal || 0));
        const mins = Math.floor(safeSeconds / 60);
        const secs = safeSeconds % 60;
        return `${String(mins).padStart(1, '0')}:${String(secs).padStart(2, '0')}`;
    }

    function buildOnClockMetaText(rosterCount) {
        if (!waiverState || !waiverState.active) {
            return `Waivers complete | Final roster ${rosterCount}`;
        }
        const secondsLeft = getWaiverSecondsRemaining();
        const timeLabel = secondsLeft == null ? 'Time left --:--' : `Time left ${formatClock(secondsLeft)}`;
        return `On clock now | ${timeLabel} | Roster ${rosterCount}`;
    }

    function isCurrentUserHost() {
        const host = String(draftSummary && draftSummary.host || '').trim();
        return !host || isCurrentUserTeamName(host);
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

        const canAct = !!(waiverState && waiverState.active && isCurrentUserTeamName(getCurrentWaiverTeamName()) && userTeam && (userTeam.roster || []).length > 0);

        waiverPoolList.innerHTML = filtered.length
            ? filtered.map(player => `
                <div class="waiver-pool-item">
                    <span class="pos-badge pos-${escapeHtml(player.position)}">${escapeHtml(player.position)}</span>
                    <span class="waiver-name">${escapeHtml(player.name)} <span class="waiver-meta">${escapeHtml(player.position || 'UNK')} #${getPlayerPositionRank(player)}</span></span>
                    <button type="button" class="account-btn waiver-add-btn" data-player-id="${Number(player.id)}" ${canAct ? '' : 'disabled'}>+</button>
                </div>
            `).join('')
            : '<div class="bench-empty">No available waiver players match the current filters.</div>';

        waiverPoolList.querySelectorAll('.waiver-add-btn').forEach(button => {
            button.addEventListener('click', () => {
                const playerId = Number(button.getAttribute('data-player-id'));
                const player = pool.find(entry => Number(entry.id) === playerId);
                if (!player) return;
                submitWaiverAddDrop(player);
            });
        });
    }

    function renderInlineDropOptions(canAct) {
        if (!waiverInlineDropSelect) return;
        const userTeam = getUserTeam();
        const roster = Array.isArray(userTeam && userTeam.roster)
            ? userTeam.roster.slice().sort((a, b) => Number(a.prerank || 999) - Number(b.prerank || 999))
            : [];

        if (!roster.length) {
            waiverInlineDropSelect.innerHTML = '<option value="">No players to drop</option>';
            waiverInlineDropSelect.disabled = true;
            return;
        }

        const currentValue = String(waiverInlineDropSelect.value || '');
        waiverInlineDropSelect.innerHTML = roster
            .map(entry => `<option value="${Number(entry.id)}">${escapeHtml(entry.name)} (${escapeHtml(entry.position || 'UNK')})</option>`)
            .join('');

        if (currentValue && roster.some(entry => String(Number(entry.id)) === currentValue)) {
            waiverInlineDropSelect.value = currentValue;
        }

        waiverInlineDropSelect.disabled = !canAct;
    }

    function submitWaiverAddDrop(player) {
        if (!socket || !draftSummary.draftCode || !waiverState || !waiverState.active) return;
        const userTeam = getUserTeam();
        const canAct = !!(isCurrentUserTeamName(getCurrentWaiverTeamName()) && userTeam && (userTeam.roster || []).length > 0);
        if (!canAct) {
            alert('It is not your turn to make a waiver move.');
            return;
        }

        const dropPlayerId = Number(waiverInlineDropSelect && waiverInlineDropSelect.value);
        if (!Number.isFinite(dropPlayerId)) {
            alert('Select a player to drop first.');
            return;
        }

        if (isStarterPlayerOnTeam(userTeam, dropPlayerId)) {
            const dropPlayer = getRosterPlayerById(userTeam, dropPlayerId);
            const dropName = String(dropPlayer && dropPlayer.name || 'this starter');
            const confirmed = window.confirm(`Drop ${dropName} from your starting lineup and submit this waiver add/drop?`);
            if (!confirmed) {
                return;
            }
        }

        socket.emit('submitWaiverMove', {
            draftCode: draftSummary.draftCode,
            teamName: username,
            action: 'addDrop',
            addPlayerId: Number(player.id),
            dropPlayerId
        }, (response) => {
            if (!response || !response.ok) {
                alert(`Waiver add/drop failed: ${(response && response.reason) || 'unknown_error'}`);
            }
        });
    }

    function renderOnClockTeamPanel() {
        if (!waiverOnClockTitle || !waiverOnClockMeta || !waiverOnClockStarters || !waiverOnClockBench) {
            return;
        }

        const currentTurn = getCurrentWaiverTeamName();
        const onClockTeam = (draftSummary.teams || []).find(team => team.name === currentTurn) || null;

        if (!onClockTeam) {
            waiverOnClockTitle.textContent = 'On The Clock Team';
            waiverOnClockMeta.textContent = 'Waiting for waivers to start...';
            waiverOnClockStarters.innerHTML = '<div class="bench-empty">No lineup to display.</div>';
            waiverOnClockBench.innerHTML = '<div class="bench-empty">No bench to display.</div>';
            return;
        }

        const roster = Array.isArray(onClockTeam.roster) ? onClockTeam.roster : [];
        const split = splitRoster(roster, getSummaryRosterSettings());
        const starters = Array.isArray(split.slots) ? split.slots : [];
        const bench = Array.isArray(split.bench) ? split.bench : [];

        waiverOnClockTitle.textContent = `${currentTurn}${isCurrentUserTeamName(currentTurn) ? ' (Your Team)' : ''}`;
        onClockRosterCount = roster.length;
        waiverOnClockMeta.textContent = buildOnClockMetaText(onClockRosterCount);

        waiverOnClockStarters.innerHTML = starters.length
            ? starters.map(slot => {
                if (!slot.player) {
                    return `<div class="waiver-team-row"><span class="waiver-team-pos">${escapeHtml(slot.label || '--')}</span><span class="waiver-team-player">Empty</span><span class="waiver-team-cost">-</span></div>`;
                }
                return `<div class="waiver-team-row"><span class="waiver-team-pos">${escapeHtml(slot.label || slot.player.position || 'UNK')}</span><span class="waiver-team-player">${escapeHtml(slot.player.name || 'Unknown')}</span><span class="waiver-team-cost">$${Number(slot.player.bid || 0)}</span></div>`;
            }).join('')
            : '<div class="bench-empty">No starters configured.</div>';

        waiverOnClockBench.innerHTML = bench.length
            ? bench.map(player => `<div class="waiver-team-row"><span class="waiver-team-pos">${escapeHtml(player.position || 'BN')}</span><span class="waiver-team-player">${escapeHtml(player.name || 'Unknown')}</span><span class="waiver-team-cost">$${Number(player.bid || 0)}</span></div>`).join('')
            : '<div class="bench-empty">No bench players.</div>';
    }

    function playTurnDing() {
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            const ctx = new AudioCtx();
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, now);
            osc.frequency.exponentialRampToValueAtTime(1240, now + 0.14);
            gain.gain.setValueAtTime(0.0001, now);
            gain.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.26);
            setTimeout(() => {
                try { ctx.close(); } catch (_error) { /* noop */ }
            }, 400);
        } catch (_error) {
            // Browsers can block autoplay audio until user interaction.
        }
    }

    function showTurnAlert(message) {
        if (!waiverTurnAlert || !waiverTurnAlertText) return;
        waiverTurnAlertText.textContent = String(message || 'Your turn');
        waiverTurnAlert.hidden = false;
        if (turnAlertTimeout) {
            clearTimeout(turnAlertTimeout);
        }
        turnAlertTimeout = setTimeout(() => {
            waiverTurnAlert.hidden = true;
        }, 2400);
    }

    function maybeNotifyTurnChange() {
        if (!waiverState || !waiverState.active) return;
        const currentTurn = getCurrentWaiverTeamName();
        const turnKey = `${draftSummary.draftCode || ''}:${currentTurn}:${Number(waiverState.turnIndex || 0)}:${Number(waiverState.updatedAt || 0)}`;
        if (turnKey === lastTurnAlertKey) return;
        lastTurnAlertKey = turnKey;
        if (isCurrentUserTeamName(currentTurn)) {
            playTurnDing();
            showTurnAlert('Your turn');
        }
    }

    function render() {
        const waiverMode = normalizeWaiverMode(draftSummary && draftSummary.waiverMode);
        const allCutsComplete = areAllTeamsCutComplete();
        const currentTurn = getCurrentWaiverTeamName();
        const userTeam = getUserTeam();
        const canStart = !!(isCurrentUserHost() && waiverMode !== 'off' && (!waiverState || (!waiverState.active && !waiverState.completed)));
        const isUsersTurn = !!(waiverState && waiverState.active && isCurrentUserTeamName(currentTurn));
        const canPass = !!(waiverState && waiverState.active && isUsersTurn);

        waiverPageMeta.textContent = `Draft ${draftSummary.draftCode || 'N/A'} | Waiver Mode: ${waiverMode.toUpperCase()}`;

        if (waiverMode === 'off') {
            waiverPageNotice.textContent = 'Waivers are turned off for this draft.';
            waiverStartBtn.hidden = true;
            waiverPassBtn.hidden = true;
            waiverOrderList.innerHTML = '<div class="bench-empty">Waivers are disabled.</div>';
            waiverPoolList.innerHTML = '<div class="bench-empty">No waiver pool is available because waivers are off.</div>';
            if (waiverInlineDropSelect) {
                waiverInlineDropSelect.innerHTML = '<option value="">No players to drop</option>';
                waiverInlineDropSelect.disabled = true;
            }
            renderOnClockTeamPanel();
            return;
        }

        waiverStartBtn.hidden = !canStart;
        waiverStartBtn.disabled = !canStart;
        waiverPassBtn.hidden = false;
        waiverPassBtn.disabled = !canPass;

        if (!isUsersTurn && waiverTurnAlert && !waiverTurnAlert.hidden) {
            waiverTurnAlert.hidden = true;
            if (turnAlertTimeout) {
                clearTimeout(turnAlertTimeout);
                turnAlertTimeout = null;
            }
        }

        if (!waiverState || (!waiverState.active && !waiverState.completed)) {
            waiverPageNotice.textContent = isCurrentUserHost()
                ? `Waivers are ready. Start when ready using ${waiverMode.toUpperCase()} order.`
                : 'Waivers are enabled. Waiting for the host to start waivers.';
        } else if (waiverState.active) {
            const secondsLeft = getWaiverSecondsRemaining();
            const timerLabel = secondsLeft == null ? '--:--' : formatClock(secondsLeft);
            waiverPageNotice.textContent = isUsersTurn
                ? `It is your waiver turn (${timerLabel} left). Select a drop player above, then tap + on a waiver player, or pass.`
                : `Waivers are active. On the clock: ${currentTurn || 'N/A'} (${timerLabel} left).`;
        } else {
            waiverPageNotice.textContent = `Waivers are complete (${waiverState.mode.toUpperCase()} order).`;
        }

        renderInlineDropOptions(!!(waiverState && waiverState.active && isUsersTurn));
        renderOrder();
        renderOnClockTeamPanel();
        renderPool();
        maybeNotifyTurnChange();
    }

    waiverPassBtn.addEventListener('click', () => {
        if (!socket || !draftSummary.draftCode || !waiverState || !waiverState.active) return;
        const confirmed = window.confirm('Are you sure you want to pass?');
        if (!confirmed) {
            return;
        }
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

    setInterval(() => {
        if (!waiverState || !waiverState.active) return;
        if (!waiverOnClockMeta) return;
        waiverOnClockMeta.textContent = buildOnClockMetaText(onClockRosterCount);
    }, 1000);

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