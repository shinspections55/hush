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
    const waiverTeamSelect = document.getElementById('waiverTeamSelect');
    const waiverOnClockStarters = document.getElementById('waiverOnClockStarters');
    const waiverOnClockBench = document.getElementById('waiverOnClockBench');
    const currentDraft = sessionStorage.getItem('currentDraft');
    let draftSummary = loadSummary();
    let waiverState = null;
    let selectedPosition = 'ALL';
    let onClockRosterCount = 0;
    let waiverCompletionHandled = false;
    let waiverCompletionRedirectTimer = null;
    const WAIVER_APP_SECTION_VIEW_KEY = 'waiverAppSectionViewMode';
    let waiverAppSectionViewMode = 'players';

    try {
        const savedWaiverSection = String(localStorage.getItem(WAIVER_APP_SECTION_VIEW_KEY) || '').trim().toLowerCase();
        if (savedWaiverSection === 'order' || savedWaiverSection === 'teams' || savedWaiverSection === 'players') {
            waiverAppSectionViewMode = savedWaiverSection;
        }
    } catch (_error) {
        // ignore localStorage read failures
    }

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

    const BYE_WEEK_BY_TEAM = Object.freeze({
        ATL: 5,
        ARI: 8,
        BAL: 7,
        BUF: 7,
        CAR: 5,
        CHI: 5,
        CIN: 6,
        CLE: 9,
        DAL: 10,
        DEN: 10,
        DET: 6,
        GB: 5,
        HOU: 6,
        IND: 11,
        JAC: 7,
        KC: 5,
        LAC: 7,
        LAR: 8,
        LV: 13,
        MIA: 6,
        MIN: 6,
        NE: 11,
        NO: 8,
        NYG: 8,
        NYJ: 9,
        PHI: 9,
        PIT: 5,
        SEA: 8,
        SF: 8,
        TB: 9,
        TEN: 9,
        WAS: 7
    });

    const TEAM_ABBREVIATION_ALIASES = Object.freeze({
        JAX: 'JAC',
        LA: 'LAR',
        OAK: 'LV',
        SD: 'LAC',
        STL: 'LAR',
        WSH: 'WAS'
    });

    function normalizeTeamAbbreviation(value) {
        const team = String(value || '').trim().toUpperCase();
        return TEAM_ABBREVIATION_ALIASES[team] || team;
    }

    function normalizeByeWeekValue(rawValue) {
        const parsed = Number.parseInt(rawValue, 10);
        if (Number.isFinite(parsed) && parsed > 0) return parsed;
        return null;
    }

    function resolvePlayerByeWeek(player) {
        const explicit = normalizeByeWeekValue(
            player && (player.byeWeek ?? player.bye ?? player.bye_week ?? player.BYE ?? player.BYEWEEK ?? player.byeweek)
        );
        if (explicit !== null) return explicit;
        const teamAbbr = normalizeTeamAbbreviation(player && player.team);
        return BYE_WEEK_BY_TEAM[teamAbbr] || null;
    }

    function getPlayerByeWeekLabel(player) {
        const byeWeek = resolvePlayerByeWeek(player);
        return byeWeek ? `W${byeWeek}` : '';
    }

    function getPlayerByeWeekMarkup(player) {
        const byeWeekLabel = getPlayerByeWeekLabel(player);
        return byeWeekLabel
            ? `<span class="rank-player-bye" title="Bye Week ${byeWeekLabel.slice(1)}">${byeWeekLabel}</span>`
            : '';
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
            turnDurationMs: Math.max(1000, Number(rawState.turnDurationMs || 120000)),
            preStartEndsAt: Number(rawState.preStartEndsAt || 0),
            turnEndsAt: Number(rawState.turnEndsAt || 0),
            updatedAt: Number(rawState.updatedAt || Date.now()),
            passesInRow: Math.max(0, Number(rawState.passesInRow || 0)),
            lastAction: rawState.lastAction || null,
            teamActivity: Array.isArray(rawState.teamActivity)
                ? rawState.teamActivity.map(entry => ({
                    teamName: String(entry && entry.teamName || '').trim(),
                    type: String(entry && entry.type || 'addDrop').trim(),
                    addPlayerName: String(entry && entry.addPlayerName || '').trim(),
                    addPlayerPosition: String(entry && entry.addPlayerPosition || '').trim().toUpperCase(),
                    dropPlayerName: String(entry && entry.dropPlayerName || '').trim(),
                    dropPlayerPosition: String(entry && entry.dropPlayerPosition || '').trim().toUpperCase(),
                    at: Number(entry && entry.at || 0)
                })).filter(entry => entry.teamName)
                : [],
            pool: Array.isArray(rawState.pool)
                ? rawState.pool.map(player => ({
                    id: Number(player.id),
                    name: String(player.name || '').trim(),
                    position: String(player.position || 'UNK').trim().toUpperCase(),
                    team: String(player.team || '').trim().toUpperCase(),
                    byeWeek: resolvePlayerByeWeek(player),
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
                    team: String(player && player.team || '').trim().toUpperCase(),
                    byeWeek: resolvePlayerByeWeek(player),
                    avgValue: Number(player && player.avgValue || 0),
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
                byeWeek: resolvePlayerByeWeek(player),
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

    function getTeamWaiverActivity(teamName) {
        if (!waiverState || !Array.isArray(waiverState.teamActivity) || !teamName) return null;
        const normalizedTeamName = String(teamName || '').trim().toLowerCase();
        return [...waiverState.teamActivity].reverse().find(entry => String(entry && entry.teamName || '').trim().toLowerCase() === normalizedTeamName) || null;
    }

    function isCurrentUserTeamName(teamName) {
        return String(teamName || '').trim().toLowerCase() === normalizedUsername;
    }

    function isUsersWaiverTurn() {
        return !!(waiverState && waiverState.active && !isWaiverPrestartActive() && isCurrentUserTeamName(getCurrentWaiverTeamName()));
    }

    function isWaiverPrestartActive() {
        if (!waiverState || !waiverState.active || waiverState.completed) return false;
        const preStartEndsAt = Number(waiverState.preStartEndsAt || 0);
        return Number.isFinite(preStartEndsAt) && preStartEndsAt > Date.now();
    }

    function getWaiverPrestartSecondsRemaining() {
        if (!isWaiverPrestartActive()) return null;
        const endTs = Number(waiverState.preStartEndsAt || 0);
        if (!Number.isFinite(endTs) || endTs <= 0) return null;
        return Math.max(0, Math.ceil((endTs - Date.now()) / 1000));
    }

    function forceHideTurnAlert() {
        return;
    }

    function getUserTeam() {
        return (draftSummary.teams || []).find(team => isCurrentUserTeamName(team.name)) || null;
    }

    function getWaiverSecondsRemaining() {
        if (!waiverState || !waiverState.active || isWaiverPrestartActive()) return null;
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
        if (isWaiverPrestartActive()) {
            const prestartSecondsLeft = getWaiverPrestartSecondsRemaining();
            const countdownLabel = prestartSecondsLeft == null ? '--:--' : formatClock(prestartSecondsLeft);
            return `Waivers start in ${countdownLabel} | Roster ${rosterCount}`;
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

    function persistCompletedDraftSummaryWithWaiverChanges() {
        if (!draftSummary) return;

        const normalizedTeams = Array.isArray(draftSummary.teams)
            ? draftSummary.teams.map(normalizeSummaryTeam)
            : [];

        const mergedSummary = {
            ...draftSummary,
            completed: true,
            teams: normalizedTeams,
            waiverState: waiverState ? { ...waiverState } : null,
            waiverCompletedAt: new Date().toISOString()
        };

        draftSummary = mergedSummary;

        try {
            sessionStorage.setItem('latestDraftSummary', JSON.stringify(mergedSummary));
        } catch (_error) {
            // ignore sessionStorage write failures
        }

        try {
            const completedRaw = localStorage.getItem('completedDrafts');
            const completedDrafts = completedRaw ? JSON.parse(completedRaw) : [];
            const list = Array.isArray(completedDrafts) ? completedDrafts : [];
            const draftCode = String(mergedSummary.draftCode || '').trim();
            const existingIndex = list.findIndex((entry) => String(entry && entry.draftCode || '').trim() === draftCode);

            if (existingIndex >= 0) {
                list[existingIndex] = {
                    ...list[existingIndex],
                    ...mergedSummary,
                    completed: true
                };
            } else {
                list.push(mergedSummary);
            }

            localStorage.setItem('completedDrafts', JSON.stringify(list));
        } catch (_error) {
            // ignore localStorage parse/write failures
        }
    }

    function handleWaiverCompletionFlow() {
        if (!waiverState || !waiverState.completed || waiverCompletionHandled) {
            return;
        }

        waiverCompletionHandled = true;
        persistCompletedDraftSummaryWithWaiverChanges();

        waiverPageNotice.textContent = 'Waivers are complete. Returning to updated draft summary...';

        if (waiverCompletionRedirectTimer) {
            clearTimeout(waiverCompletionRedirectTimer);
        }

        waiverCompletionRedirectTimer = setTimeout(() => {
            window.location.href = 'draft-summary.html';
        }, 900);
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
            ? order.map((teamName, index) => {
                const activity = getTeamWaiverActivity(teamName);
                const activityMarkup = activity && activity.type === 'addDrop'
                    ? `
                        <div class="waiver-activity">
                            <div class="waiver-activity-line waiver-activity-add">
                                <span class="waiver-activity-team">${escapeHtml(teamName)}</span>
                                <span class="waiver-activity-move">+ ${escapeHtml(activity.addPlayerPosition || 'UNK')} ${escapeHtml(activity.addPlayerName || 'Player')}</span>
                            </div>
                            <div class="waiver-activity-line waiver-activity-drop">
                                - ${escapeHtml(activity.dropPlayerPosition || 'UNK')} ${escapeHtml(activity.dropPlayerName || 'Player')}
                            </div>
                        </div>
                    `
                    : '';
                const badgeText = waiverState && waiverState.active && currentTurn === teamName
                    ? 'On clock'
                    : activity
                        ? (activity.type === 'addDrop' ? '' : 'Passed')
                        : '';
                return `
                    <div class="waiver-order-item ${waiverState && waiverState.active && currentTurn === teamName ? 'active' : ''}">
                        <span class="waiver-order-rank">${index + 1}</span>
                        <div class="waiver-order-main">
                            ${activity && activity.type === 'addDrop' ? '' : `<span class="waiver-order-team">${escapeHtml(teamName)}</span>`}
                            ${activityMarkup}
                        </div>
                        <span class="bench-rank">${badgeText}</span>
                    </div>
                `;
            }).join('')
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

        const canAct = !!(isUsersWaiverTurn() && userTeam && (userTeam.roster || []).length > 0);

        waiverPoolList.innerHTML = filtered.length
            ? filtered.map(player => `
                <div class="waiver-pool-item">
                    <span class="pos-badge pos-${escapeHtml(player.position)}">${escapeHtml(player.position)}</span>
                    <span class="waiver-name">${escapeHtml(player.name)} ${getPlayerByeWeekMarkup(player)} <span class="waiver-meta">${escapeHtml(player.position || 'UNK')} #${getPlayerPositionRank(player)}</span></span>
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

    function closeWaiverModal() {
        const existing = document.getElementById('waiver-flow-modal');
        if (existing) {
            existing.remove();
        }
    }

    function showWaiverConfirmationModal(addPlayer, dropPlayer) {
        closeWaiverModal();
        const userTeam = getUserTeam();
        const addPosition = String(addPlayer && addPlayer.position || 'UNK').trim().toUpperCase();
        const addName = String(addPlayer && addPlayer.name || 'player').trim();
        const dropPosition = String(dropPlayer && dropPlayer.position || 'UNK').trim().toUpperCase();
        const dropName = String(dropPlayer && dropPlayer.name || 'player').trim();

        const modal = document.createElement('div');
        modal.id = 'waiver-flow-modal';
        modal.style.position = 'fixed';
        modal.style.inset = '0';
        modal.style.background = 'rgba(0, 0, 0, 0.7)';
        modal.style.display = 'flex';
        modal.style.alignItems = 'center';
        modal.style.justifyContent = 'center';
        modal.style.zIndex = '99999';
        modal.style.padding = '16px';

        modal.innerHTML = `
            <div style="width:min(96vw, 480px); background:#111827; border:1px solid #4b5563; border-radius:14px; box-shadow:0 20px 50px rgba(0,0,0,0.4); color:#f9fafb; padding:18px;">
                <div style="font-size:18px; font-weight:700; margin-bottom:8px;">Confirm waiver move</div>
                <div style="font-size:14px; color:#d1d5db; margin-bottom:12px;">This will submit your waiver move for ${escapeHtml(userTeam && userTeam.name ? userTeam.name : 'your team')}.</div>
                <div style="border:1px solid #374151; border-radius:10px; padding:12px; margin-bottom:12px; background:#1f2937;">
                    <div style="font-size:13px; color:#93c5fd; margin-bottom:6px;">Add</div>
                    <div style="font-weight:700;">+ ${escapeHtml(addPosition)} ${escapeHtml(addName)}</div>
                </div>
                <div style="border:1px solid #374151; border-radius:10px; padding:12px; margin-bottom:12px; background:#1f2937;">
                    <div style="font-size:13px; color:#fca5a5; margin-bottom:6px;">Drop</div>
                    <div style="font-weight:700;">- ${escapeHtml(dropPosition)} ${escapeHtml(dropName)}</div>
                </div>
                <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:14px;">
                    <button type="button" data-action="cancel" style="background:#4b5563; color:#fff; border:none; border-radius:8px; padding:10px 14px; cursor:pointer;">Cancel</button>
                    <button type="button" data-action="confirm" style="background:#2563eb; color:#fff; border:none; border-radius:8px; padding:10px 14px; cursor:pointer;">Confirm</button>
                </div>
            </div>
        `;

        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                closeWaiverModal();
            }
        });

        modal.querySelector('[data-action="cancel"]').addEventListener('click', closeWaiverModal);
        modal.querySelector('[data-action="confirm"]').addEventListener('click', () => {
            closeWaiverModal();
            socket.emit('submitWaiverMove', {
                draftCode: draftSummary.draftCode,
                teamName: username,
                action: 'addDrop',
                addPlayerId: Number(addPlayer.id),
                dropPlayerId: Number(dropPlayer.id)
            }, (response) => {
                if (!response || !response.ok) {
                    alert(`Waiver add/drop failed: ${(response && response.reason) || 'unknown_error'}`);
                }
            });
        });

        document.body.appendChild(modal);
    }

    function buildWaiverDropRosterMarkup(roster, selectedDropPlayerId) {
        const rosterView = splitRoster(roster, getSummaryRosterSettings());
        const starterRows = Array.isArray(rosterView.slots) ? rosterView.slots : [];
        const benchRows = Array.isArray(rosterView.bench) ? rosterView.bench : [];
        const maxBench = Number.parseInt(getSummaryRosterSettings().BN, 10) || 0;

        const starterMarkup = starterRows.map(slot => {
            const player = slot && slot.player;
            const isSelected = !!player && String(selectedDropPlayerId) === String(player.id);
            const isEmpty = !player;
            return `
                <button type="button" ${isEmpty ? 'disabled' : ''} data-drop-id="${player ? Number(player.id) : ''}" class="waiver-drop-row${isSelected ? ' selected' : ''}" ${isEmpty ? 'style="opacity:0.65; cursor:not-allowed;"' : ''}>
                    <span class="waiver-drop-slot">${escapeHtml(slot && slot.label ? slot.label : '--')}</span>
                    <span class="waiver-drop-player">${player ? escapeHtml(player.name || 'Unknown') : 'Empty'}</span>
                    <span class="waiver-drop-pos">${player ? escapeHtml(player.position || 'UNK') : ''}</span>
                </button>
            `;
        }).join('');

        const benchMarkup = benchRows.map((player, index) => {
            const isSelected = !!player && String(selectedDropPlayerId) === String(player.id);
            const label = index < maxBench ? 'BN' : 'XBN';
            return `
                <button type="button" data-drop-id="${player ? Number(player.id) : ''}" class="waiver-drop-row${isSelected ? ' selected' : ''}">
                    <span class="waiver-drop-slot">${escapeHtml(label)}</span>
                    <span class="waiver-drop-player">${escapeHtml(player && player.name ? player.name : 'Empty')}</span>
                    <span class="waiver-drop-pos">${escapeHtml(player && player.position ? player.position : 'UNK')}</span>
                </button>
            `;
        }).join('');

        return `${starterMarkup}${benchMarkup}`;
    }

    function beginWaiverAddFlow(player) {
        if (!socket || !draftSummary.draftCode || !waiverState || !waiverState.active) return;
        const userTeam = getUserTeam();
        const canAct = !!(isUsersWaiverTurn() && userTeam && (userTeam.roster || []).length > 0);
        if (!canAct) {
            alert('It is not your turn to make a waiver move.');
            return;
        }

        const roster = Array.isArray(userTeam && userTeam.roster)
            ? userTeam.roster.slice()
            : [];

        closeWaiverModal();

        const modal = document.createElement('div');
        modal.id = 'waiver-flow-modal';
        modal.style.position = 'fixed';
        modal.style.inset = '0';
        modal.style.background = 'rgba(0, 0, 0, 0.72)';
        modal.style.display = 'flex';
        modal.style.alignItems = 'center';
        modal.style.justifyContent = 'center';
        modal.style.zIndex = '99999';
        modal.style.padding = '16px';

        let selectedDropPlayerId = '';

        const renderChoiceContent = () => {
            const rosterList = roster.length
                ? buildWaiverDropRosterMarkup(roster, selectedDropPlayerId)
                : '<div style="color:#d1d5db;">No players to drop.</div>';

            modal.innerHTML = `
                <div style="width:min(96vw, 520px); background:#111827; border:1px solid #4b5563; border-radius:14px; box-shadow:0 20px 50px rgba(0,0,0,0.4); color:#f9fafb; padding:18px;">
                    <div style="font-size:18px; font-weight:700; margin-bottom:8px;">Adding ${escapeHtml(String(player.name || 'player').trim())}</div>
                    <div style="font-size:14px; color:#d1d5db; margin-bottom:12px;">Please select a player to drop from your team.</div>
                    <div style="max-height:360px; overflow:auto; margin-bottom:12px; display:flex; flex-direction:column; gap:8px;">${rosterList}</div>
                    <div style="display:flex; justify-content:flex-end; gap:10px;">
                        <button type="button" data-action="cancel" style="background:#4b5563; color:#fff; border:none; border-radius:8px; padding:10px 14px; cursor:pointer;">Cancel</button>
                        <button type="button" data-action="continue" ${selectedDropPlayerId ? '' : 'disabled'} style="background:#2563eb; color:#fff; border:none; border-radius:8px; padding:10px 14px; cursor:pointer; opacity:${selectedDropPlayerId ? '1' : '0.6'};">Continue</button>
                    </div>
                </div>
            `;

            modal.querySelectorAll('[data-drop-id]').forEach(button => {
                if (button.disabled) return;
                button.addEventListener('click', () => {
                    selectedDropPlayerId = String(button.getAttribute('data-drop-id'));
                    renderChoiceContent();
                });
            });

            const cancelBtn = modal.querySelector('[data-action="cancel"]');
            if (cancelBtn) {
                cancelBtn.addEventListener('click', closeWaiverModal);
            }

            const continueBtn = modal.querySelector('[data-action="continue"]');
            if (continueBtn) {
                continueBtn.addEventListener('click', () => {
                    if (!selectedDropPlayerId) return;
                    const dropPlayer = roster.find(entry => String(entry.id) === String(selectedDropPlayerId));
                    if (dropPlayer) {
                        showWaiverConfirmationModal(player, dropPlayer);
                    }
                });
            }
        };

        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                closeWaiverModal();
            }
        });

        renderChoiceContent();
        document.body.appendChild(modal);
    }

    function submitWaiverAddDrop(player) {
        beginWaiverAddFlow(player);
    }

    function populateWaiverTeamSelector() {
        if (!waiverTeamSelect) return;
        const teams = Array.isArray(draftSummary && draftSummary.teams) ? draftSummary.teams : [];
        const selectedValue = String(waiverTeamSelect.value || '').trim();
        waiverTeamSelect.innerHTML = teams.length
            ? teams.map(team => {
                const name = String(team && team.name || '').trim();
                return `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`;
            }).join('')
            : '<option value="">No teams</option>';

        if (selectedValue && teams.some(team => String(team && team.name || '').trim() === selectedValue)) {
            waiverTeamSelect.value = selectedValue;
        } else if (teams.length) {
            waiverTeamSelect.value = String(teams[0].name || '').trim();
        }
    }

    function getSelectedWaiverTeamName() {
        if (waiverTeamSelect && waiverTeamSelect.value) {
            return String(waiverTeamSelect.value).trim();
        }
        return getCurrentWaiverTeamName();
    }

    function renderOnClockTeamPanel() {
        if (!waiverOnClockTitle || !waiverOnClockMeta || !waiverOnClockStarters || !waiverOnClockBench) {
            return;
        }

        populateWaiverTeamSelector();
        const selectedTeamName = getSelectedWaiverTeamName();
        const onClockTeam = (draftSummary.teams || []).find(team => team.name === selectedTeamName) || null;

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

        waiverOnClockTitle.textContent = `${selectedTeamName}${isCurrentUserTeamName(selectedTeamName) ? ' (Your Team)' : ''}`;
        onClockRosterCount = roster.length;
        waiverOnClockMeta.textContent = buildOnClockMetaText(onClockRosterCount);

        waiverOnClockStarters.innerHTML = starters.length
            ? starters.map(slot => {
                if (!slot.player) {
                    return `<div class="waiver-team-row"><span class="waiver-team-pos">${escapeHtml(slot.label || '--')}</span><span class="waiver-team-player">Empty</span><span class="waiver-team-cost">-</span></div>`;
                }
                const byeMarkup = getPlayerByeWeekMarkup(slot.player);
                return `<div class="waiver-team-row"><span class="waiver-team-pos">${escapeHtml(slot.label || slot.player.position || 'UNK')}</span><span class="waiver-team-player">${escapeHtml(slot.player.name || 'Unknown')} ${byeMarkup}</span><span class="waiver-team-cost">$${Number(slot.player.bid || 0)}</span></div>`;
            }).join('')
            : '<div class="bench-empty">No starters configured.</div>';

        waiverOnClockBench.innerHTML = bench.length
            ? bench.map(player => {
                const byeMarkup = getPlayerByeWeekMarkup(player);
                return `<div class="waiver-team-row"><span class="waiver-team-pos">${escapeHtml(player.position || 'BN')}</span><span class="waiver-team-player">${escapeHtml(player.name || 'Unknown')} ${byeMarkup}</span><span class="waiver-team-cost">$${Number(player.bid || 0)}</span></div>`;
            }).join('')
            : '<div class="bench-empty">No bench players.</div>';
    }


    function maybeNotifyTurnChange() {
        return;
    }

    function isWaiverAppNavSupported() {
        return Boolean(document.body && document.body.classList.contains('pwa-installed'));
    }

    function applyWaiverAppSectionMode(section, options = {}) {
        const mode = (section === 'order' || section === 'teams' || section === 'players') ? section : 'players';
        waiverAppSectionViewMode = mode;

        if (document.body && document.body.classList.contains('waiver-app-nav-enabled')) {
            document.body.setAttribute('data-waiver-app-section', mode);
        }

        document.querySelectorAll('.waiver-app-nav-btn').forEach((button) => {
            button.classList.toggle('is-active', String(button.dataset.waiverSection || '') === mode);
        });

        if (options.persist !== false) {
            try {
                localStorage.setItem(WAIVER_APP_SECTION_VIEW_KEY, mode);
            } catch (_error) {
                // ignore localStorage write failures
            }
        }
    }

    function refreshWaiverAppNavState() {
        const nav = document.getElementById('waiver-app-nav');
        if (!nav || !document.body) return;

        const enabled = isWaiverAppNavSupported();
        nav.hidden = !enabled;
        document.body.classList.toggle('waiver-app-nav-enabled', enabled);

        if (!enabled) {
            document.body.removeAttribute('data-waiver-app-section');
            return;
        }

        applyWaiverAppSectionMode(waiverAppSectionViewMode, { persist: false });
    }

    function setupWaiverAppNav() {
        const nav = document.getElementById('waiver-app-nav');
        if (!nav) return;

        nav.querySelectorAll('.waiver-app-nav-btn').forEach((button) => {
            button.addEventListener('click', () => {
                applyWaiverAppSectionMode(button.dataset.waiverSection, { persist: true });
            });
        });

        refreshWaiverAppNavState();
        window.addEventListener('resize', refreshWaiverAppNavState);
    }

    function render() {
        const waiverMode = normalizeWaiverMode(draftSummary && draftSummary.waiverMode);
        const allCutsComplete = areAllTeamsCutComplete();
        const currentTurn = getCurrentWaiverTeamName();
        const userTeam = getUserTeam();
        const canStart = !!(isCurrentUserHost() && waiverMode !== 'off' && (!waiverState || (!waiverState.active && !waiverState.completed)));
        const isUsersTurn = isUsersWaiverTurn();
        const prestartActive = isWaiverPrestartActive();
        const canPass = !!(waiverState && waiverState.active && !prestartActive && isUsersTurn);

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

        if (!waiverState || (!waiverState.active && !waiverState.completed)) {
            forceHideTurnAlert();
        }

        if (!waiverState || (!waiverState.active && !waiverState.completed)) {
            waiverPageNotice.textContent = isCurrentUserHost()
                ? `Waivers are ready. Start when ready using ${waiverMode.toUpperCase()} order.`
                : 'Waivers are enabled. Waiting for the host to start waivers.';
        } else if (waiverState.active) {
            if (prestartActive) {
                const prestartSeconds = getWaiverPrestartSecondsRemaining();
                const prestartLabel = prestartSeconds == null ? '--:--' : formatClock(prestartSeconds);
                waiverPageNotice.textContent = `Waivers begin in ${prestartLabel}. First team on the clock: ${currentTurn || 'N/A'}.`;
            } else {
                const secondsLeft = getWaiverSecondsRemaining();
                const timerLabel = secondsLeft == null ? '--:--' : formatClock(secondsLeft);
                waiverPageNotice.textContent = isUsersTurn
                    ? `It is your waiver turn (${timerLabel} left). Select a drop player above, then tap + on a waiver player, or pass.`
                    : `Waivers are active. On the clock: ${currentTurn || 'N/A'} (${timerLabel} left).`;
            }
        } else {
            waiverPageNotice.textContent = `Waivers are complete (${waiverState.mode.toUpperCase()} order).`;
        }

        renderInlineDropOptions(!!(waiverState && waiverState.active && !prestartActive && isUsersTurn));
        renderOrder();
        renderOnClockTeamPanel();
        renderPool();
        maybeNotifyTurnChange();
        handleWaiverCompletionFlow();
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

    if (waiverTeamSelect) {
        waiverTeamSelect.addEventListener('change', () => {
            renderOnClockTeamPanel();
        });
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

    setupWaiverAppNav();
    syncFromServer();
});