document.addEventListener('DOMContentLoaded', () => {
    const DEFAULT_ROSTER_SETTINGS = { QB: 1, WR: 2, RB: 2, TE: 1, FLEX: 1, K: 1, DEF: 1, BN: 13 };
    const DEFAULT_BENCH_CUT_TARGET = 5;
    const MAX_DRAFT_BENCH = 13;
    const summaryMeta = document.getElementById('summaryMeta');
    const teamList = document.getElementById('teamList');
    const teamPrevBtn = document.getElementById('teamPrevBtn');
    const teamNextBtn = document.getElementById('teamNextBtn');
    const teamSelect = document.getElementById('teamSelect');
    const teamHeader = document.getElementById('teamHeader');
    const summarySyncStatus = document.getElementById('summarySyncStatus');
    const cutAlertContainer = document.getElementById('cutAlertContainer');
    const incompleteBannerContainer = document.getElementById('incompleteBannerContainer');
    const finalRosterSection = document.getElementById('finalRosterSection');
    const lineupGrid = document.getElementById('lineupGrid');
    const benchContainer = document.getElementById('benchContainer');
    const waiverSection = document.getElementById('waiverSection');
    const waiverModeSelect = document.getElementById('waiverModeSelect');
    const startWaiversBtn = document.getElementById('startWaiversBtn');
    const startWaiversTopBtn = document.getElementById('startWaiversTopBtn');
    const startWaiversSideBtn = document.getElementById('startWaiversSideBtn');
    const openWaiversPageBtn = document.getElementById('openWaiversPageBtn');
    const waiverHostPrompt = document.getElementById('waiverHostPrompt');
    const waiverStatus = document.getElementById('waiverStatus');
    const waiverOrderList = document.getElementById('waiverOrderList');
    const waiverMoveForm = document.getElementById('waiverMoveForm');
    const waiverAddPlayerSelect = document.getElementById('waiverAddPlayerSelect');
    const waiverDropPlayerSelect = document.getElementById('waiverDropPlayerSelect');
    const submitWaiverMoveBtn = document.getElementById('submitWaiverMoveBtn');
    const passWaiverTurnBtn = document.getElementById('passWaiverTurnBtn');

    const username = sessionStorage.getItem('username') || 'Your Team';
    let selectedTeamName = null;
    let draftSummary = loadSummary();
    let waiverState = null;
    let waiverReadyPromptShown = false;
    let delayedCpuCutSyncTimer = null;
    let lastWaiverDebugSignature = '';

    function setSummarySyncStatus(message, tone = 'info') {
        if (!summarySyncStatus) return;
        if (!message) {
            summarySyncStatus.textContent = '';
            summarySyncStatus.hidden = true;
            summarySyncStatus.dataset.tone = '';
            return;
        }

        summarySyncStatus.textContent = message;
        summarySyncStatus.hidden = false;
        summarySyncStatus.dataset.tone = tone;
    }

    let socket = window.draftSocket || null;
    if (!socket && window.io) {
        socket = window.io({ reconnection: false });
        window.draftSocket = socket;
    }

    if (!draftSummary) {
        summaryMeta.textContent = 'No completed draft found for this session.';
        teamHeader.innerHTML = '<p class="warning">Start or finish a draft first, then this page will populate automatically.</p>';
        return;
    }

    let summaryRosterSettings = getSummaryRosterSettings();
    let maxBenchPlayers = getBenchCutTarget();
    let starterSlotCount = getSlotBlueprint(summaryRosterSettings).length;
    let maxTotalPlayers = starterSlotCount + maxBenchPlayers;

    function refreshSummaryLimits() {
        summaryRosterSettings = getSummaryRosterSettings();
        maxBenchPlayers = getBenchCutTarget();
        starterSlotCount = getSlotBlueprint(summaryRosterSettings).length;
        maxTotalPlayers = starterSlotCount + maxBenchPlayers;
    }

    function buildConsoleSharePayload() {
        const payloadTeams = (draftSummary?.teams || []).map(team => ({
            name: team?.name || '',
            profile: team?.profile || draftSummary?.teamProfiles?.[team?.name] || null,
            budgetRemaining: Number(team?.budgetRemaining || 0),
            rosterCount: Array.isArray(team?.roster) ? team.roster.length : 0,
            roster: (team?.roster || []).map(player => ({
                id: player?.id,
                name: player?.name,
                position: player?.position,
                bid: Number(player?.bid || 0),
                prerank: player?.prerank
            }))
        }));

        return {
            draftCode: draftSummary?.draftCode || null,
            host: draftSummary?.host || null,
            timestamp: draftSummary?.timestamp || null,
            rosterSettings: Object.assign({}, summaryRosterSettings || {}),
            participationTracker: draftSummary?.participationTracker || null,
            teamProfiles: Object.assign({}, draftSummary?.teamProfiles || {}),
            teams: payloadTeams
        };
    }

    function logDraftParticipationTracker() {
        const tracker = draftSummary && draftSummary.participationTracker;
        if (!tracker || typeof tracker !== 'object') {
            console.log('[DRAFT PARTICIPATION] No participation data is available for this draft summary yet.');
            return;
        }

        const history = Array.isArray(tracker.history) ? tracker.history : [];
        const lastRound = tracker.lastRound || (history.length ? history[history.length - 1] : null);

        console.group('%c[DRAFT PARTICIPATION SUMMARY]', 'background: #0D47A1; color: white; font-weight: bold; padding: 4px 8px; border-radius: 4px;');
        console.log(`Rounds tracked: ${history.length}`);
        if (Number.isFinite(Number(tracker.baselineAvgBidPerPlayer))) {
            console.log(`Starting point: average bid per player was $${Number(tracker.baselineAvgBidPerPlayer).toFixed(2)}`);
        }

        if (lastRound) {
            const dropPct = Number(lastRound.dropFromBaselinePct || 0);
            console.log(`Most recent round (R${Number(lastRound.roundNumber || 0)}): total bids placed $${Number(lastRound.totalBidAmount || 0).toFixed(2)} ($${Number(lastRound.totalBidAmountPerTeam || 0).toFixed(2)} per team), ${Number(lastRound.teamsWithBid || 0)}/${Number(lastRound.teamsInDraft || 0)} teams bid, ${dropPct.toFixed(1)}% below the starting average bid/player`);
        }

        if (history.length > 0) {
            history.forEach((round) => {
                const roundNumber = Number(round && round.roundNumber || 0);
                const totalBidAmount = Number(round && round.totalBidAmount || 0);
                const totalBidAmountPerTeam = Number(round && round.totalBidAmountPerTeam || 0);
                console.log(`Round ${roundNumber}: total bids placed $${totalBidAmount.toFixed(2)} | per-team bids $${totalBidAmountPerTeam.toFixed(2)}`);

                const playerBidTotals = Array.isArray(round && round.playerBidTotals) ? round.playerBidTotals : [];
                if (playerBidTotals.length > 0) {
                    playerBidTotals.forEach((playerRow) => {
                        console.log(`  - ${String(playerRow && playerRow.playerName || 'Unknown')}: $${Number(playerRow && playerRow.totalBidAmount || 0).toFixed(2)} from ${Number(playerRow && playerRow.bidCount || 0)} bids`);
                    });
                }
            });

            const compact = history.map((round) => ({
                round: Number(round.roundNumber || 0),
                avgBidPerPlayer: Number(round.avgBidPerPlayer || 0),
                totalBidAmount: Number(round.totalBidAmount || 0),
                totalBidAmountPerTeam: Number(round.totalBidAmountPerTeam || 0),
                teamsWithBid: Number(round.teamsWithBid || 0),
                teamsInDraft: Number(round.teamsInDraft || 0),
                dropFromBaselinePct: Number(round.dropFromBaselinePct || 0)
            }));
            console.table(compact);
        }

        console.groupEnd();
    }

    function setupConsoleShareHelpers() {
        const payload = buildConsoleSharePayload();
        const payloadJson = JSON.stringify(payload, null, 2);

        // Expose global helpers for quick copy/paste from DevTools.
        window.hushDraftSummaryExport = payload;
        window.getHushDraftSummaryExportText = () => JSON.stringify(buildConsoleSharePayload(), null, 2);
        window.copyHushDraftSummaryExport = async () => {
            const text = JSON.stringify(buildConsoleSharePayload(), null, 2);
            if (!navigator?.clipboard?.writeText) {
                console.warn('[DRAFT SUMMARY EXPORT] Clipboard API not available. Use getHushDraftSummaryExportText() and copy manually.');
                return text;
            }
            await navigator.clipboard.writeText(text);
            console.log('[DRAFT SUMMARY EXPORT] Copied to clipboard.');
            return text;
        };

        console.group('%c[DRAFT SUMMARY EXPORT - COPY/PASTE]', 'background: #00695C; color: white; font-weight: bold; padding: 4px 8px; border-radius: 4px;');
        console.log('Run copyHushDraftSummaryExport() to copy full results to clipboard.');
        console.log('Run getHushDraftSummaryExportText() to print raw JSON text.');
        console.log('Or expand window.hushDraftSummaryExport in console.');
        console.log('--- BEGIN HUSH_DRAFT_EXPORT_JSON ---');
        console.log(payloadJson);
        console.log('--- END HUSH_DRAFT_EXPORT_JSON ---');
        console.groupEnd();
    }

    function logCpuApproachAnalysis() {
        // Log CPU team profiles and roster completion to console for analysis
        if (!draftSummary || !draftSummary.teams) {
            console.log('[DEBUG] draftSummary missing or empty:', { draftSummary });
            return;
        }
        
        // Normalize profiles because some older summaries stored profile data only in teamProfiles map.
        const teamsWithProfiles = (draftSummary.teams || []).map(team => ({
            ...team,
            profile: team.profile || draftSummary?.teamProfiles?.[team.name] || null
        }));

        // DEBUG: Check what's in draftSummary
        console.log('[DEBUG] draftSummary.teamProfiles:', draftSummary.teamProfiles);
        console.log('[DEBUG] draftSummary.teams:', teamsWithProfiles.map(t => ({ name: t.name, profile: t.profile })));
        
        const targetRosterSize = Object.values(summaryRosterSettings || {}).reduce((sum, val) => {
            return sum + (typeof val === 'number' ? val : (parseInt(val) || 0));
        }, 0);
        
        console.group('%c[DRAFT SUMMARY] CPU TEAM APPROACH ANALYSIS', 'background: #1976D2; color: white; font-weight: bold; padding: 4px 8px; border-radius: 4px;');
        console.log(`Target Roster Size: ${targetRosterSize} players`);
        console.log(`Draft Code: ${draftSummary.draftCode || 'N/A'}`);
        console.log(`Host: ${draftSummary.host || 'N/A'}`);
        console.log('');
        
        // Separate CPU teams and auto-draft teams
        const cpuTeams = teamsWithProfiles.filter(t => t.profile && !t.profile.includes('Auto Draft'));
        const autoDraftTeams = teamsWithProfiles.filter(t => t.profile && t.profile.includes('Auto Draft'));
        
        if (cpuTeams.length === 0 && autoDraftTeams.length === 0) {
            console.log('No CPU or Auto Draft teams found in this draft.');
            console.log('[DEBUG] Full draftSummary:', draftSummary);
            console.groupEnd();
            return;
        }
        
        // Log CPU teams
        if (cpuTeams.length > 0) {
            console.log('%cCPU TEAMS:', 'background: #9C27B0; color: white; padding: 2px 4px; border-radius: 2px; font-weight: bold;');
            cpuTeams.forEach((team, idx) => {
                const rosterSize = team.roster ? team.roster.length : 0;
                const budgetSpent = 200 - (team.budgetRemaining || 0);
                const completionPercent = Math.round((rosterSize / targetRosterSize) * 100);
                const isComplete = rosterSize >= targetRosterSize;
                const completionStatus = isComplete ? '✓ COMPLETE' : `⚠ INCOMPLETE (${rosterSize}/${targetRosterSize})`;
                
                const style = isComplete 
                    ? 'color: #4CAF50; font-weight: bold;' 
                    : 'color: #FF9800; font-weight: bold;';
                
                console.log(`%c${idx + 1}. ${team.name} (${team.profile})`, style);
                console.log(`   Status: ${completionStatus} (${completionPercent}%)`);
                console.log(`   Roster: ${rosterSize}/${targetRosterSize} players`);
                console.log(`   Budget: $${budgetSpent} spent (${team.budgetRemaining || 0} remaining)`);
            });
            console.log('');
        }
        
        // Log auto-draft teams
        if (autoDraftTeams.length > 0) {
            console.log('%cAUTO DRAFT TEAMS:', 'background: #FF6F00; color: white; padding: 2px 4px; border-radius: 2px; font-weight: bold;');
            autoDraftTeams.forEach((team, idx) => {
                const rosterSize = team.roster ? team.roster.length : 0;
                const budgetSpent = 200 - (team.budgetRemaining || 0);
                const completionPercent = Math.round((rosterSize / targetRosterSize) * 100);
                const isComplete = rosterSize >= targetRosterSize;
                const completionStatus = isComplete ? '✓ COMPLETE' : `⚠ INCOMPLETE (${rosterSize}/${targetRosterSize})`;
                
                const style = isComplete 
                    ? 'color: #4CAF50; font-weight: bold;' 
                    : 'color: #FF9800; font-weight: bold;';
                
                console.log(`%c${idx + 1}. ${team.name} (${team.profile})`, style);
                console.log(`   Status: ${completionStatus} (${completionPercent}%)`);
                console.log(`   Roster: ${rosterSize}/${targetRosterSize} players`);
                console.log(`   Budget: $${budgetSpent} spent (${team.budgetRemaining || 0} remaining)`);
            });
            console.log('');
        }
        
        // Summary statistics
        const allBiddingTeams = [...cpuTeams, ...autoDraftTeams];
        const completeTeams = allBiddingTeams.filter(t => (t.roster ? t.roster.length : 0) >= targetRosterSize);
        const incompleteTeams = allBiddingTeams.length - completeTeams.length;
        
        console.log('%cSUMMARY:', 'font-weight: bold; background: #f5f5f5; padding: 2px 4px;');
        console.log(`Finished rosters: ${completeTeams.length}/${allBiddingTeams.length}`);
        console.log(`Not finished yet: ${incompleteTeams}/${allBiddingTeams.length}`);
        
        // Group by profile (including auto-draft)
        const byProfile = {};
        allBiddingTeams.forEach(team => {
            const profile = team.profile || 'Unknown';
            if (!byProfile[profile]) byProfile[profile] = [];
            byProfile[profile].push({
                name: team.name,
                size: team.roster ? team.roster.length : 0,
                complete: (team.roster ? team.roster.length : 0) >= targetRosterSize
            });
        });
        
        console.log('%cBy Approach:', 'font-weight: bold; background: #f5f5f5; padding: 2px 4px;');
        Object.keys(byProfile).sort().forEach(profile => {
            const teams = byProfile[profile];
            const completeInProfile = teams.filter(t => t.complete).length;
            console.log(`  ${profile}: ${completeInProfile}/${teams.length} finished (${teams.map(t => t.name).join(', ')})`);
        });
        
        console.groupEnd();
    }

    function renderSummaryView() {
        updateSummaryMeta();
        renderTeamButtons();
        renderTeamSelect();

        if (!selectedTeamName && draftSummary.teams.length > 0) {
            selectedTeamName = draftSummary.teams[0].name;
        }

        if (selectedTeamName) {
            renderSelectedTeam();
        }

        if (draftSummary && draftSummary.host) {
            const isHost = String(draftSummary.host || '').trim() === username;
            setSummarySyncStatus(
                isHost
                    ? 'Host detected. CPU cuts will auto-sync and waivers will be ready once complete.'
                    : 'Summary synced. CPU cuts and waiver readiness are updating in the background.',
                'info'
            );
        }
        
        // Log CPU approach analysis to console
        logCpuApproachAnalysis();
        logDraftParticipationTracker();
        setupConsoleShareHelpers();
    }

    function selectTeamByOffset(offset) {
        const teams = Array.isArray(draftSummary.teams) ? draftSummary.teams : [];
        if (teams.length === 0) return;

        const currentIndex = Math.max(0, teams.findIndex(team => team.name === selectedTeamName));
        const nextIndex = (currentIndex + offset + teams.length) % teams.length;
        selectedTeamName = teams[nextIndex].name;
        renderSelectedTeam();
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
                    prerank: player.prerank,
                    avgValue: Number(player.avgValue || player.value || 0)
                }))
                : []
        };
    }

    function getSnapshotPlayerByIdentity(player) {
        const snapshot = Array.isArray(draftSummary && draftSummary.allPlayersSnapshot)
            ? draftSummary.allPlayersSnapshot
            : [];
        if (!snapshot.length || !player) return null;

        const playerId = Number(player.id);
        if (Number.isFinite(playerId) && playerId > 0) {
            const byId = snapshot.find(item => Number(item && item.id) === playerId);
            if (byId) return byId;
        }

        const playerName = String(player.name || '').trim().toLowerCase();
        if (!playerName) return null;
        const playerPos = String(player.position || '').trim().toUpperCase();
        return snapshot.find(item => {
            const itemName = String(item && item.name || '').trim().toLowerCase();
            const itemPos = String(item && item.position || '').trim().toUpperCase();
            return itemName === playerName && (!playerPos || itemPos === playerPos);
        }) || null;
    }

    function getPlayerAvgValue(player) {
        const direct = Number(player && (player.avgValue ?? player.value));
        if (Number.isFinite(direct)) {
            return direct;
        }

        const snapshotPlayer = getSnapshotPlayerByIdentity(player);
        const fromSnapshot = Number(snapshotPlayer && snapshotPlayer.avgValue);
        return Number.isFinite(fromSnapshot) ? fromSnapshot : 0;
    }

    function getTeamTotalAvgValue(team) {
        const roster = Array.isArray(team && team.roster) ? team.roster : [];
        return roster.reduce((sum, player) => sum + getPlayerAvgValue(player), 0);
    }

    function syncSummaryFromServer(onComplete) {
        if (!socket || !draftSummary || !draftSummary.draftCode) {
            onComplete();
            return;
        }

        socket.emit('getDraftState', draftSummary.draftCode, (response) => {
            if (response && response.ok && response.draft) {
                const serverDraft = response.draft;
                const serverTeams = (serverDraft.draftState && Array.isArray(serverDraft.draftState.teams))
                    ? serverDraft.draftState.teams
                    : (Array.isArray(serverDraft.teams) ? serverDraft.teams : null);

                if (Array.isArray(serverTeams) && serverTeams.length > 0) {
                    draftSummary.teams = serverTeams.map(normalizeSummaryTeam);
                }

                if (serverDraft.draftState && Array.isArray(serverDraft.draftState.allPlayers)) {
                    draftSummary.allPlayersSnapshot = serverDraft.draftState.allPlayers.map(player => ({
                        id: Number(player.id),
                        name: String(player.name || '').trim(),
                        position: String(player.position || '').trim().toUpperCase(),
                        team: String(player.team || '').trim().toUpperCase(),
                        avgValue: Number(player.avgValue || player.value || 0),
                        prerank: Number(player.prerank || player.positionRank || 999),
                        owner: player.owner || null,
                        shown: !!player.shown
                    }));
                }

                if (serverDraft.host) {
                    draftSummary.host = String(serverDraft.host || '').trim();
                }

                waiverState = normalizeWaiverState(serverDraft.waiverState || null);

                if (serverDraft.rosterSettings) {
                    draftSummary.rosterSettings = Object.assign({}, serverDraft.rosterSettings);
                }

                if (typeof serverDraft.benchCutTarget !== 'undefined') {
                    draftSummary.benchCutTarget = serverDraft.benchCutTarget;
                }

                if (serverDraft.draftState && serverDraft.draftState.participationTracker) {
                    draftSummary.participationTracker = serverDraft.draftState.participationTracker;
                }

                draftSummary.waiverMode = normalizeWaiverMode(serverDraft.waiverMode);

                refreshSummaryLimits();
                persistSummary();
            }

            onComplete();
        });
    }

    function scheduleDelayedSummarySync() {
        if (!socket || !draftSummary || !draftSummary.draftCode) return;
        if (delayedCpuCutSyncTimer) {
            clearTimeout(delayedCpuCutSyncTimer);
        }

        setSummarySyncStatus('Syncing CPU cuts and waiver readiness...', 'info');
        delayedCpuCutSyncTimer = setTimeout(() => {
            syncSummaryFromServer(() => {
                renderSummaryView();
                setSummarySyncStatus('CPU cuts and waiver readiness refreshed.', 'success');
                setTimeout(() => setSummarySyncStatus(''), 2500);
            });
        }, 10000);
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
                    position: String(player.position || '').trim().toUpperCase(),
                    team: String(player.team || '').trim().toUpperCase(),
                    avgValue: Number(player.avgValue || 0),
                    prerank: Number(player.prerank || 999)
                }))
                : []
        };
    }

    function normalizeWaiverMode(value) {
        const normalized = String(value || '').trim().toLowerCase();
        if (normalized === 'random' || normalized === 'skill') return normalized;
        return 'off';
    }

    function getPlayerKey(player) {
        const id = Number(player && player.id);
        if (Number.isFinite(id) && id > 0) return `id:${id}`;
        return `name:${String(player && player.name || '').trim().toLowerCase()}`;
    }

    function getCurrentWaiverTeamName() {
        if (!waiverState || !Array.isArray(waiverState.order) || waiverState.order.length === 0) return '';
        return waiverState.order[Math.max(0, Math.min(waiverState.turnIndex, waiverState.order.length - 1))] || '';
    }

    function getWaiverPoolPlayers() {
        if (waiverState && Array.isArray(waiverState.pool) && waiverState.pool.length > 0) {
            return waiverState.pool.slice().sort((a, b) => Number(a.prerank || 999) - Number(b.prerank || 999));
        }

        const snapshot = Array.isArray(draftSummary && draftSummary.allPlayersSnapshot)
            ? draftSummary.allPlayersSnapshot
            : [];

        const rostered = new Set();
        (Array.isArray(draftSummary && draftSummary.teams) ? draftSummary.teams : []).forEach(team => {
            (Array.isArray(team && team.roster) ? team.roster : []).forEach(player => {
                rostered.add(getPlayerKey(player));
            });
        });

        return snapshot
            .filter(player => player && player.name && !rostered.has(getPlayerKey(player)))
            .map(player => ({
                id: Number(player.id),
                name: player.name,
                position: player.position || 'UNK',
                team: player.team || '',
                avgValue: Number(player.avgValue || 0),
                prerank: Number(player.prerank || 999)
            }))
            .sort((a, b) => Number(a.prerank || 999) - Number(b.prerank || 999));
    }

    function canCurrentUserControlWaivers() {
        const host = String(draftSummary && draftSummary.host || '').trim();
        if (!host) return true;
        return host === username;
    }

    function areAllTeamsCutComplete() {
        const teams = Array.isArray(draftSummary && draftSummary.teams) ? draftSummary.teams : [];
        return teams.every(team => {
            const split = splitRoster(team.roster || [], summaryRosterSettings);
            return getRequiredCuts(team.roster || [], split.bench) === 0;
        });
    }

    function getTeamsCutDebugSnapshot() {
        const teams = Array.isArray(draftSummary && draftSummary.teams) ? draftSummary.teams : [];
        return teams.map(team => {
            const split = splitRoster(team.roster || [], summaryRosterSettings);
            const requiredCuts = getRequiredCuts(team.roster || [], split.bench);
            return {
                teamName: String(team && team.name || '').trim() || 'Unknown Team',
                requiredCuts,
                benchCount: (split.bench || []).length,
                benchCutTarget: maxBenchPlayers,
                rosterCount: Array.isArray(team && team.roster) ? team.roster.length : 0,
                maxTotalPlayers
            };
        });
    }

    function renderWaiverSection() {
        if (!waiverSection || !waiverStatus || !waiverOrderList) return;

        const canControl = canCurrentUserControlWaivers();
        const activeTurnTeam = getCurrentWaiverTeamName();
        const hostName = String(draftSummary && draftSummary.host || '').trim();
        const teams = Array.isArray(draftSummary && draftSummary.teams) ? draftSummary.teams : [];
        const userTeam = (Array.isArray(draftSummary && draftSummary.teams) ? draftSummary.teams : []).find(team => team.name === username) || null;
        const poolPlayers = getWaiverPoolPlayers();
        const configuredMode = normalizeWaiverMode(draftSummary && draftSummary.waiverMode);
        const allCutsComplete = areAllTeamsCutComplete();
        const cutSnapshot = getTeamsCutDebugSnapshot();
        const cutBlockers = cutSnapshot.filter(entry => entry.requiredCuts > 0);

        const canStartTopButton = !!(canControl && configuredMode !== 'off' && (!waiverState || (!waiverState.active && !waiverState.completed)));
        if (startWaiversTopBtn) {
            startWaiversTopBtn.hidden = false;
            startWaiversTopBtn.disabled = false;
            startWaiversTopBtn.textContent = canStartTopButton ? 'Start Waivers' : 'Open Waivers';
        }
        if (startWaiversSideBtn) {
            startWaiversSideBtn.hidden = false;
            startWaiversSideBtn.disabled = false;
            startWaiversSideBtn.textContent = canStartTopButton ? 'Start Waivers' : 'Open Waivers';
        }

        if (configuredMode === 'off') {
            const modeOffSignature = JSON.stringify({
                draftCode: draftSummary && draftSummary.draftCode,
                mode: configuredMode,
                hasStartBtn: !!startWaiversBtn,
                hasTopBtn: !!startWaiversTopBtn
            });
            if (modeOffSignature !== lastWaiverDebugSignature) {
                lastWaiverDebugSignature = modeOffSignature;
                console.log(`[START WAIVERS BUTTON DEBUG] hidden because waiver mode is OFF (draft=${String(draftSummary && draftSummary.draftCode || 'unknown')}, hasStartBtn=${!!startWaiversBtn}, hasTopBtn=${!!startWaiversTopBtn})`);
            }

            waiverSection.hidden = true;
            return;
        }

        waiverSection.hidden = false;

        if (waiverModeSelect) {
            waiverModeSelect.value = configuredMode;
            waiverModeSelect.disabled = true;
        }

        if (openWaiversPageBtn) {
            openWaiversPageBtn.style.display = '';
        }

        if (waiverHostPrompt) {
            waiverHostPrompt.hidden = true;
            waiverHostPrompt.textContent = '';
        }

        const canStart = !!(canControl && (!waiverState || (!waiverState.active && !waiverState.completed)));
        const cannotStartReasons = [];
        if (!canControl) cannotStartReasons.push('not_controller');
        if (waiverState && waiverState.active) cannotStartReasons.push('waivers_already_active');
        if (waiverState && waiverState.completed) cannotStartReasons.push('waivers_completed');

        const debugSignature = JSON.stringify({
            draftCode: draftSummary && draftSummary.draftCode,
            username,
            hostName,
            teamCount: teams.length,
            configuredMode,
            canControl,
            allCutsComplete,
            waiverActive: !!(waiverState && waiverState.active),
            waiverCompleted: !!(waiverState && waiverState.completed),
            canStart,
            blockers: cutBlockers.map(entry => `${entry.teamName}:${entry.requiredCuts}`).sort()
        });

        if (debugSignature !== lastWaiverDebugSignature) {
            lastWaiverDebugSignature = debugSignature;
            console.log(`[WAIVER UI DEBUG] draft=${String(draftSummary && draftSummary.draftCode || 'unknown')} user=${username} host=${hostName || 'none'} mode=${configuredMode} teams=${teams.length} canControl=${canControl} allCutsComplete=${allCutsComplete} waiverActive=${!!(waiverState && waiverState.active)} waiverCompleted=${!!(waiverState && waiverState.completed)} canStart=${canStart} reasons=${cannotStartReasons.join('|') || 'none'}`);

            const primaryBtnState = startWaiversBtn
                ? `startBtn{display:${startWaiversBtn.style.display || '(default)'},disabled:${!!startWaiversBtn.disabled}}`
                : 'startBtn{missing:true}';
            const topBtnState = startWaiversTopBtn
                ? `topBtn{hidden:${!!startWaiversTopBtn.hidden},disabled:${!!startWaiversTopBtn.disabled}}`
                : 'topBtn{missing:true}';
            console.log(`[START WAIVERS BUTTON DEBUG] draft=${String(draftSummary && draftSummary.draftCode || 'unknown')} canStart=${canStart} reasons=${cannotStartReasons.join('|') || 'none'} ${primaryBtnState} ${topBtnState}`);

            if (cutBlockers.length > 0) {
                console.log(`[WAIVER UI DEBUG] cut blockers: ${cutBlockers.map(entry => `${entry.teamName}{cuts:${entry.requiredCuts},bench:${entry.benchCount}/${entry.benchCutTarget},roster:${entry.rosterCount}/${entry.maxTotalPlayers}}`).join(' | ')}`);
            }
        }

        if (startWaiversBtn) {
            startWaiversBtn.disabled = !canStart;
            startWaiversBtn.style.display = canStart ? '' : 'none';
        }
        if (startWaiversTopBtn) {
            startWaiversTopBtn.hidden = false;
            startWaiversTopBtn.disabled = false;
            startWaiversTopBtn.textContent = canStart ? 'Start Waivers' : 'Open Waivers';
        }
        if (startWaiversSideBtn) {
            startWaiversSideBtn.hidden = false;
            startWaiversSideBtn.disabled = false;
            startWaiversSideBtn.textContent = canStart ? 'Start Waivers' : 'Open Waivers';
        }

        if (!waiverState || (!waiverState.active && !waiverState.completed)) {
            if (canControl) {
                waiverStatus.textContent = `Waivers are ready to start (${configuredMode.toUpperCase()}).`;
                waiverOrderList.innerHTML = '<div class="bench-empty">Start waivers now or open the waiver page first.</div>';
                if (waiverHostPrompt) {
                    waiverHostPrompt.hidden = false;
                    waiverHostPrompt.textContent = 'Host alert: waivers can be started now.';
                }
                if (!waiverReadyPromptShown) {
                    waiverReadyPromptShown = true;
                    alert('Waivers are ready to start.');
                }
            } else {
                waiverStatus.textContent = `Waivers are enabled (${configuredMode.toUpperCase()}). Waiting for the host to start them.`;
                waiverOrderList.innerHTML = '<div class="bench-empty">The host will start waivers when ready.</div>';
            }

            if (waiverAddPlayerSelect) waiverAddPlayerSelect.innerHTML = '<option value="">No players available</option>';
            if (waiverDropPlayerSelect) waiverDropPlayerSelect.innerHTML = '<option value="">No roster selected</option>';
            if (submitWaiverMoveBtn) submitWaiverMoveBtn.disabled = true;
            if (passWaiverTurnBtn) passWaiverTurnBtn.disabled = true;
            return;
        }

        waiverReadyPromptShown = true;
        waiverStatus.textContent = waiverState.active
            ? `Waivers active (${waiverState.mode.toUpperCase()} order). On the clock: ${activeTurnTeam || 'N/A'}.`
            : `Waivers completed (${waiverState.mode.toUpperCase()} order).`;

        waiverOrderList.innerHTML = (waiverState.order || []).length
            ? waiverState.order.map((teamName, index) => `
                <div class="waiver-order-item ${waiverState.active && index === waiverState.turnIndex ? 'active' : ''}">
                    <span class="waiver-order-rank">${index + 1}</span>
                    <span>${escapeHtml(teamName)}</span>
                    <span class="bench-rank">${waiverState.active && index === waiverState.turnIndex ? 'On clock' : 'Waiting'}</span>
                </div>
            `).join('')
            : '<div class="bench-empty">No waiver order available.</div>';

        if (waiverAddPlayerSelect) {
            waiverAddPlayerSelect.innerHTML = poolPlayers.length
                ? poolPlayers.map(player => `<option value="${escapeHtml(String(player.id))}">${escapeHtml(player.name)} (${escapeHtml(player.position)}) - Rank ${Number(player.prerank || 999)}</option>`).join('')
                : '<option value="">No players available</option>';
        }

        if (waiverDropPlayerSelect) {
            const roster = Array.isArray(userTeam && userTeam.roster) ? userTeam.roster : [];
            waiverDropPlayerSelect.innerHTML = roster.length
                ? roster.map(player => `<option value="${escapeHtml(String(player.id))}">${escapeHtml(player.name)} (${escapeHtml(player.position || 'UNK')})</option>`).join('')
                : '<option value="">No players on roster</option>';
        }

        const userCanAct = !!(waiverState.active && userTeam && activeTurnTeam === userTeam.name && poolPlayers.length > 0 && (userTeam.roster || []).length > 0);
        if (submitWaiverMoveBtn) submitWaiverMoveBtn.disabled = !userCanAct;
        if (passWaiverTurnBtn) passWaiverTurnBtn.disabled = !(waiverState.active && userTeam && activeTurnTeam === userTeam.name);
    }

    refreshSummaryLimits();

    if (teamPrevBtn) {
        teamPrevBtn.addEventListener('click', () => selectTeamByOffset(-1));
    }
    if (teamNextBtn) {
        teamNextBtn.addEventListener('click', () => selectTeamByOffset(1));
    }

    if (socket && draftSummary.draftCode) {
        socket.emit('joinDraftRoom', draftSummary.draftCode, username);

        socket.on('benchUpdated', (data) => {
            const team = draftSummary.teams.find(t => t.name === data.teamName);
            if (!team) return;

            team.roster = Array.isArray(data.newRoster) ? data.newRoster : team.roster;
            persistSummary();
            refreshSummaryLimits();
            renderTeamButtons();
            renderTeamSelect();

            if (!selectedTeamName || selectedTeamName === data.teamName) {
                selectedTeamName = data.teamName;
                renderSelectedTeam();
            } else {
                renderWaiverSection();
            }
        });

        socket.on('waiversStarted', (data) => {
            if (!data || data.draftCode !== draftSummary.draftCode) return;
            waiverState = normalizeWaiverState(data.waiverState || null);
            renderWaiverSection();
        });

        socket.on('waiverStateUpdated', (data) => {
            if (!data || data.draftCode !== draftSummary.draftCode) return;

            if (Array.isArray(data.teams) && data.teams.length > 0) {
                draftSummary.teams = data.teams.map(normalizeSummaryTeam);
            }

            if (Array.isArray(data.allPlayersSnapshot)) {
                draftSummary.allPlayersSnapshot = data.allPlayersSnapshot;
            }

            waiverState = normalizeWaiverState(data.waiverState || null);
            persistSummary();
            renderTeamButtons();
            renderTeamSelect();
            renderSelectedTeam();

            if (waiverState && waiverState.active) {
                setSummarySyncStatus('Waivers are ready and updating live.', 'success');
            }
        });

        syncSummaryFromServer(() => {
            renderSummaryView();
            scheduleDelayedSummarySync();
        });
    } else {
        renderSummaryView();
    }

    const startWaiversAndOpenPage = () => {
            const mode = normalizeWaiverMode(draftSummary && draftSummary.waiverMode);
            const canControl = canCurrentUserControlWaivers();
            const canStart = !!(canControl && mode !== 'off' && (!waiverState || (!waiverState.active && !waiverState.completed)));

            if (!canStart) {
                window.location.href = 'waivers.html';
                return;
            }

            if (!socket || !draftSummary || !draftSummary.draftCode) {
                alert('Realtime connection unavailable. Refresh and try again.');
                return;
            }

            socket.emit('startWaivers', { draftCode: draftSummary.draftCode, mode }, (response) => {
                if (!response || !response.ok) {
                    alert(`Unable to start waivers: ${(response && response.reason) || 'unknown_error'}`);
                    return;
                }
                waiverState = normalizeWaiverState(response.waiverState || null);
                renderWaiverSection();
                window.location.href = 'waivers.html';
            });
    };

    if (startWaiversBtn) {
        startWaiversBtn.addEventListener('click', startWaiversAndOpenPage);
    }

    if (startWaiversTopBtn) {
        startWaiversTopBtn.addEventListener('click', startWaiversAndOpenPage);
    }

    if (startWaiversSideBtn) {
        startWaiversSideBtn.addEventListener('click', startWaiversAndOpenPage);
    }

    if (waiverMoveForm) {
        waiverMoveForm.addEventListener('submit', (event) => {
            event.preventDefault();
            if (!socket || !draftSummary || !draftSummary.draftCode || !waiverState || !waiverState.active) return;

            const addPlayerId = Number(waiverAddPlayerSelect && waiverAddPlayerSelect.value);
            const dropPlayerId = Number(waiverDropPlayerSelect && waiverDropPlayerSelect.value);
            if (!Number.isFinite(addPlayerId) || !Number.isFinite(dropPlayerId)) {
                alert('Select both an add player and a drop player.');
                return;
            }

            socket.emit('submitWaiverMove', {
                draftCode: draftSummary.draftCode,
                teamName: username,
                action: 'addDrop',
                addPlayerId,
                dropPlayerId
            }, (response) => {
                if (!response || !response.ok) {
                    alert(`Waiver add/drop failed: ${(response && response.reason) || 'unknown_error'}`);
                }
            });
        });
    }

    if (passWaiverTurnBtn) {
        passWaiverTurnBtn.addEventListener('click', () => {
            if (!socket || !draftSummary || !draftSummary.draftCode || !waiverState || !waiverState.active) return;
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
    }

    function loadSummary() {
        const currentDraft = sessionStorage.getItem('currentDraft');
        const completedRaw = localStorage.getItem('completedDrafts');
        const latestRaw = sessionStorage.getItem('latestDraftSummary');

        const isCompletedDraft = (draft) => {
            if (!draft || typeof draft !== 'object') return false;
            return draft.completed === true;
        };

        if (completedRaw) {
            try {
                const completed = JSON.parse(completedRaw);
                const completedOnly = Array.isArray(completed) ? completed.filter(isCompletedDraft) : [];
                if (completedOnly.length > 0) {
                    if (currentDraft) {
                        const byCode = completedOnly.find(d => d.draftCode === currentDraft);
                        if (byCode) return byCode;
                    }

                    // Fallback to newest completed draft by timestamp.
                    const sorted = [...completedOnly].sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
                    if (sorted[0]) return sorted[0];
                }
            } catch (err) {
                console.warn('[draft-summary] Invalid completedDrafts payload', err);
            }
        }

        if (latestRaw) {
            try {
                const latest = JSON.parse(latestRaw);
                return isCompletedDraft(latest) ? latest : null;
            } catch (err) {
                console.warn('[draft-summary] Invalid latestDraftSummary payload', err);
            }
        }

        return null;
    }

    function persistSummary() {
        if (!draftSummary) return;

        sessionStorage.setItem('latestDraftSummary', JSON.stringify(draftSummary));

        const completedRaw = localStorage.getItem('completedDrafts');
        if (!completedRaw) return;

        try {
            const completed = JSON.parse(completedRaw);
            if (!Array.isArray(completed)) return;

            const idx = completed.findIndex(d => d.draftCode === draftSummary.draftCode);
            if (idx >= 0) {
                completed[idx] = draftSummary;
                localStorage.setItem('completedDrafts', JSON.stringify(completed));
            }
        } catch (err) {
            console.warn('[draft-summary] Failed to persist completed summary', err);
        }
    }

    function updateSummaryMeta() {
        const teamCount = Array.isArray(draftSummary.teams) ? draftSummary.teams.length : 0;
        summaryMeta.textContent = `Draft ${draftSummary.draftCode || 'N/A'} | ${new Date(draftSummary.timestamp).toLocaleString()} | ${teamCount} teams`;
    }

    function renderTeamButtons() {
        teamList.innerHTML = draftSummary.teams
            .map(team => {
                const remaining = Number.isFinite(team.budgetRemaining) ? team.budgetRemaining : null;
                const spentText = remaining !== null ? `$${Math.max(0, 200 - remaining)} spent` : `${team.roster.length} players`;
                const profileText = team.profile ? `(${team.profile})` : '';
                const teamValue = Math.round(getTeamTotalAvgValue(team));
                const split = splitRoster(team.roster || [], summaryRosterSettings);
                const requiredCuts = getRequiredCuts(team.roster || [], split.bench);
                const cutText = requiredCuts > 0
                    ? `<div class="badge warning-badge">Needs ${requiredCuts} cut(s)</div>`
                    : '<div class="badge success-badge">Cuts complete</div>';

                return `
                    <button class="team-btn ${selectedTeamName === team.name ? 'active' : ''}" data-team-name="${escapeHtml(team.name)}">
                        <div><strong>${escapeHtml(team.name)}</strong> <span class="team-value-inline">Team Value: $${teamValue}</span> <span class="team-profile">${escapeHtml(profileText)}</span></div>
                        <div class="badge">${spentText}</div>
                        ${cutText}
                    </button>
                `;
            })
            .join('');

        teamList.querySelectorAll('.team-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                selectedTeamName = btn.getAttribute('data-team-name');
                renderSelectedTeam();
            });
        });
    }

    function renderTeamSelect() {
        if (!teamSelect) return;

        teamSelect.innerHTML = draftSummary.teams
            .map(team => {
                const split = splitRoster(team.roster || [], summaryRosterSettings);
                const requiredCuts = getRequiredCuts(team.roster || [], split.bench);
                const suffix = requiredCuts > 0 ? ` (Needs ${requiredCuts} cut${requiredCuts === 1 ? '' : 's'})` : '';
                const profileText = team.profile ? ` (${team.profile})` : '';
                const teamValue = Math.round(getTeamTotalAvgValue(team));
                return `<option value="${escapeHtml(team.name)}">${escapeHtml(team.name)} | Team Value: $${teamValue}${escapeHtml(profileText)}${suffix}</option>`;
            })
            .join('');

        if (!selectedTeamName && draftSummary.teams.length > 0) {
            selectedTeamName = draftSummary.teams[0].name;
        }

        teamSelect.value = selectedTeamName || '';
        teamSelect.onchange = () => {
            selectedTeamName = teamSelect.value;
            renderSelectedTeam();
        };
    }

    function renderSelectedTeam() {
        const team = draftSummary.teams.find(t => t.name === selectedTeamName);
        if (!team) return;

        teamList.querySelectorAll('.team-btn').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-team-name') === team.name);
        });

        const { slots, bench } = splitRoster(team.roster || [], summaryRosterSettings);
        const remaining = Number.isFinite(team.budgetRemaining) ? team.budgetRemaining : null;
        const requiredCuts = getRequiredCuts(team.roster || [], bench);
        const incompleteSlots = slots.filter(slot => !slot.player).map(slot => slot.label);
        const isCurrentUserTeam = team.name === username;
        const teamValue = Math.round(getTeamTotalAvgValue(team));
        
        // Build approach/profile string for display
        const approachText = team.profile ? ` — ${team.profile}` : '';

        teamHeader.innerHTML = `
            <h2 class="team-title">${escapeHtml(team.name)} <span class="team-value-inline">Team Value: $${teamValue}</span>${escapeHtml(approachText)}</h2>
            <div class="summary-meta team-meta">
                ${team.roster.length} players drafted
                ${remaining !== null ? ` | $${remaining} remaining` : ''}
                ${requiredCuts > 0 ? ` | <span class="warning">Needs ${requiredCuts} cut(s)</span>` : ''}
            </div>
        `;

        if (teamSelect && teamSelect.value !== team.name) {
            teamSelect.value = team.name;
        }

        cutAlertContainer.innerHTML = '';
        incompleteBannerContainer.innerHTML = '';

        finalRosterSection.style.display = '';
        lineupGrid.innerHTML = slots.map(slot => renderLineupRow(slot.label, slot.player)).join('');
        renderBenchSection(bench);

        if (requiredCuts > 0) {
            renderCutWorkflow(team, slots, bench, requiredCuts, isCurrentUserTeam);
        }

        const incompleteBench = maxBenchPlayers > 0 && bench.length < maxBenchPlayers;
        const benchMissing = Math.max(0, maxBenchPlayers - bench.length);

        let incompleteBannerHtml = '';
        if (incompleteSlots.length > 0) {
            incompleteBannerHtml += `
                <div class="incomplete-banner">
                    Roster incomplete: missing starter slots ${escapeHtml(incompleteSlots.join(', '))}.
                </div>
            `;
        }
        if (incompleteBench) {
            incompleteBannerHtml += `
                <div class="incomplete-banner bench-incomplete-banner">
                    Bench incomplete: ${benchMissing} bench ${benchMissing === 1 ? 'spot' : 'spots'} unfilled (${bench.length}/${maxBenchPlayers}).
                </div>
            `;
        }
        if (incompleteBannerHtml) {
            incompleteBannerContainer.innerHTML = incompleteBannerHtml;
        }

        renderWaiverSection();
    }

    function renderBenchSection(bench) {
        if (!Array.isArray(bench) || bench.length === 0) {
            benchContainer.innerHTML = '<div class="bench-list"><div class="bench-empty">No bench players.</div></div>';
            return;
        }

        benchContainer.innerHTML = `
            <div class="bench-list">
                ${bench.map(player => `
                    <div class="bench-item">
                        <span class="bench-pos">${escapeHtml(player.position || 'N/A')}</span>
                        <span class="bench-player">${escapeHtml(player.name || 'Unknown')} - $${Number(player.bid || 0)}</span>
                        <span class="bench-rank">Rank ${Number(player.prerank || 999)}</span>
                    </div>
                `).join('')}
            </div>
        `;
    }

    function renderCutWorkflow(team, slots, bench, requiredCuts, isCurrentUserTeam) {
        cutAlertContainer.innerHTML = `
            <div class="cut-alert">
                <h4>Cuts Required Before Final Roster</h4>
                <p>${escapeHtml(team.name)} must cut ${requiredCuts} player(s) to reach max ${maxTotalPlayers} total players and max ${maxBenchPlayers} bench players.</p>
            </div>
        `;

        if (!isCurrentUserTeam) {
            cutAlertContainer.innerHTML += '<div class="roster-hold-note">This team still needs cuts. Their current roster is shown live and will update when cuts are finalized.</div>';
            return;
        }

        const renderCutCheckboxRow = (player, slotLabel, isBenchPlayer) => {
            const warningText = isBenchPlayer ? '' : '<span class="warning cut-inline-warning">Starter cut requires confirmation</span>';
            return `
                <label class="bench-item bench-item-cut">
                    <span class="bench-main">
                        <span class="bench-pos">${escapeHtml(slotLabel || player.position || 'N/A')}</span>
                        <span class="bench-player">${escapeHtml(player.name || 'Unknown')} - $${Number(player.bid || 0)}</span>
                        <span class="bench-rank">Rank ${Number(player.prerank || 999)}</span>
                        ${warningText}
                    </span>
                    <input
                        class="bench-cut-toggle"
                        type="checkbox"
                        name="cut"
                        value="${escapeHtml(player.id !== undefined && player.id !== null ? String(player.id) : '')}"
                        data-player-name="${escapeHtml(player.name || 'Unknown')}"
                        data-bench-player="${isBenchPlayer ? 'true' : 'false'}"
                        aria-label="Cut ${escapeHtml(player.name || 'Unknown')}"
                    >
                </label>
            `;
        };

        const buildStarterCutRows = () => {
            const slottedPlayers = Array.isArray(slots) ? slots.filter(slot => slot.player) : [];
            if (slottedPlayers.length === 0) {
                return '<div class="bench-empty">No starter slots filled.</div>';
            }

            return slottedPlayers
                .map(slot => renderCutCheckboxRow(slot.player, slot.label, false))
                .join('');
        };

        const buildBenchCutRows = () => {
            if (bench.length === 0) {
                return '<div class="bench-empty">No bench players.</div>';
            }

            return bench
                .slice()
                .sort((a, b) => Number(a.prerank || 999) - Number(b.prerank || 999))
                .map(player => renderCutCheckboxRow(player, player.position, true))
                .join('');
        };

        cutAlertContainer.innerHTML += `
            <div class="cut-panel">
                <h4>Cut Players Required</h4>
                <p>Select exactly <strong>${requiredCuts}</strong> player(s) to cut from anywhere on your roster. Rule: max ${maxTotalPlayers} total players and max ${maxBenchPlayers} bench players.</p>
                <form id="cut-bench-form">
                    <div class="cut-form-section">
                        <div class="cut-form-heading">Starting Lineup</div>
                        <div class="bench-list">${buildStarterCutRows()}</div>
                    </div>
                    <div class="cut-form-section">
                        <div class="cut-form-heading">Bench By Default Top Ranking</div>
                        <div class="bench-list">${buildBenchCutRows()}</div>
                    </div>
                    <button type="submit" class="account-btn cut-btn">Confirm Cuts</button>
                </form>
            </div>
        `;

        const form = document.getElementById('cut-bench-form');
        if (!form) return;

        form.querySelectorAll('input[name="cut"]').forEach(input => {
            input.addEventListener('change', () => {
                if (!input.checked || input.dataset.benchPlayer === 'true') {
                    return;
                }

                const playerName = String(input.dataset.playerName || 'this starter');
                const confirmed = window.confirm(`Cut ${playerName} even though they are currently in a starting lineup spot?`);
                if (!confirmed) {
                    input.checked = false;
                }
            });
        });

        form.addEventListener('submit', (e) => {
            e.preventDefault();

            const selectedInputs = Array.from(form.querySelectorAll('input[name="cut"]:checked'));
            if (selectedInputs.length !== requiredCuts) {
                alert(`Select exactly ${requiredCuts} player(s) to cut.`);
                return;
            }

            const selectedIds = selectedInputs
                .map(el => Number(el.value))
                .filter(id => Number.isFinite(id));
            const selectedNames = selectedInputs
                .map(el => String(el.dataset.playerName || '').trim())
                .filter(Boolean);
            const cutSelections = selectedInputs.map(el => ({
                id: Number(el.value),
                name: String(el.dataset.playerName || '').trim()
            }));

            console.log('[draft-summary] submitting cuts', {
                teamName: team.name,
                requiredCuts,
                selectedCount: selectedInputs.length,
                selectedIds,
                selectedNames,
                cutSelections
            });

            if (!socket) {
                alert('Realtime connection is not available. Please refresh and try again.');
                return;
            }

            const button = form.querySelector('button[type="submit"]');
            if (button) button.disabled = true;

            socket.emit('cutPlayers', {
                draftCode: draftSummary.draftCode,
                teamName: team.name,
                cutIds: selectedIds,
                cutNames: selectedNames,
                cutSelections
            }, (response) => {
                if (button) button.disabled = false;
                if (!response || !response.ok) {
                    const reason = response && response.reason ? response.reason : 'unknown_error';
                    console.warn('[draft-summary] cutPlayers failed', response);
                    if (typeof reason === 'string' && reason.startsWith('must_cut_exactly_')) {
                        const parts = reason.split('_');
                        const required = parts[3] || requiredCuts;
                        const debug = response && response.debug
                            ? `\n\nDebug: required=${response.debug.requiredCuts}, selected=${response.debug.requestedSelectionCount}, matched=${response.debug.matchedSelectionCount}, roster=${response.debug.rosterSize}, bench=${response.debug.benchSize}`
                            : '';
                        alert(`Cut failed: you must select exactly ${required} player(s).${debug}`);
                    } else {
                        alert(`Cut failed: ${reason}`);
                    }
                }
            });
        });
    }

    function getRequiredCuts(roster, bench) {
        const overTotal = Math.max(0, roster.length - maxTotalPlayers);
        const overBench = Math.max(0, bench.length - maxBenchPlayers);
        return Math.max(overTotal, overBench);
    }

    function getBenchCutTarget() {
        const direct = Number.parseInt(draftSummary && draftSummary.benchCutTarget, 10);
        if (Number.isFinite(direct)) {
            return Math.max(0, Math.min(direct, MAX_DRAFT_BENCH));
        }

        const legacy = Number.parseInt(draftSummary && draftSummary.rosterSettings && draftSummary.rosterSettings.BN, 10);
        if (Number.isFinite(legacy) && legacy <= MAX_DRAFT_BENCH) {
            return Math.max(0, legacy);
        }

        return DEFAULT_BENCH_CUT_TARGET;
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

    function toRosterInt(value, fallback, min, max) {
        const parsed = Number.parseInt(value, 10);
        if (Number.isNaN(parsed)) return fallback;
        return Math.max(min, Math.min(max, parsed));
    }

    function getSlotBlueprint(settings) {
        const slots = [];
        const addSlots = (label, count, eligible) => {
            for (let i = 1; i <= count; i++) {
                const slotLabel = count === 1 ? label : `${label}${i}`;
                slots.push({ label: slotLabel, eligible });
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
                .filter(p => slot.eligible.includes(p.position) && !used.includes(p))
                .sort((a, b) => Number(a.prerank || 999) - Number(b.prerank || 999))[0] || null;
            if (found) used.push(found);
            return { label: slot.label, player: found };
        });

        const bench = (roster || [])
            .filter(p => !used.includes(p))
            .sort((a, b) => Number(a.prerank || 999) - Number(b.prerank || 999));

        return { slots, bench };
    }

    function renderLineupRow(label, player) {
        if (!player) {
            return `
                <div class="lineup-row empty">
                    <span class="lineup-pos">${label}</span>
                    <span class="lineup-player">Empty</span>
                </div>
            `;
        }

        return `
            <div class="lineup-row">
                <span class="lineup-pos">${label}</span>
                <span class="lineup-player">${escapeHtml(player.name || 'Unknown')} - $${Number(player.bid || 0)}</span>
            </div>
        `;
    }

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
});