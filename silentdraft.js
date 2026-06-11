document.addEventListener('DOMContentLoaded', () => {
    const DRAFTROOM_RANKINGS_MODE_KEY = 'draftroomRankingsMode';
    const DRAFTROOM_RIGHT_VIEW_KEY = 'draftroomRightView';
    const STARRED_PLAYERS_KEY = 'rankingsStarredPlayers';
    const DRAFT_TEMP_STARRED_KEY = 'rankingsDraftStarredPlayers';
    let currentRound = 1;
    const totalRounds = 10;
    const roundDuration = 600; // 10 minutes in seconds
    let timerInterval = null;
    let isDraftEnding = false;

    // Roster constraints are configurable from lobby settings.
    const DEFAULT_ROSTER_SETTINGS = { QB: 1, WR: 2, RB: 2, TE: 1, FLEX: 1, K: 1, DEF: 1, BN: 13 };
    const flexPositions = ['RB', 'WR', 'TE'];
    let rosterSettings = Object.assign({}, DEFAULT_ROSTER_SETTINGS);
    let rosterLimits = {
        QB: { min: 1, max: 14 },
        RB: { min: 2, max: 16 },
        WR: { min: 2, max: 16 },
        TE: { min: 1, max: 14 },
        K: { min: 1, max: 14 },
        DEF: { min: 1, max: 14 }
    };
    let rosterSize = 20;
    const DEFAULT_BENCH_CUT_TARGET = 5;
    const MAX_DRAFT_BENCH = 13;
    const STARTER_SLOT_COUNT = 9;
    let benchCutTarget = DEFAULT_BENCH_CUT_TARGET;
    let roundPositionMinimums = {
        QB: 2,
        RB: 3,
        WR: 3,
        TE: 2,
        K: 1,
        DEF: 1
    };

    function parseRosterNumber(value, fallback, min, max) {
        const parsed = Number.parseInt(value, 10);
        if (Number.isNaN(parsed)) return fallback;
        return Math.max(min, Math.min(max, parsed));
    }

    function normalizeRosterSettings(raw) {
        const merged = Object.assign({}, DEFAULT_ROSTER_SETTINGS, raw || {});
        const normalized = {
            QB: parseRosterNumber(merged.QB, DEFAULT_ROSTER_SETTINGS.QB, 0, 8),
            WR: parseRosterNumber(merged.WR, DEFAULT_ROSTER_SETTINGS.WR, 0, 10),
            RB: parseRosterNumber(merged.RB, DEFAULT_ROSTER_SETTINGS.RB, 0, 10),
            TE: parseRosterNumber(merged.TE, DEFAULT_ROSTER_SETTINGS.TE, 0, 8),
            FLEX: parseRosterNumber(merged.FLEX, DEFAULT_ROSTER_SETTINGS.FLEX, 0, 5),
            K: parseRosterNumber(merged.K, DEFAULT_ROSTER_SETTINGS.K, 0, 5),
            DEF: parseRosterNumber(merged.DEF, DEFAULT_ROSTER_SETTINGS.DEF, 0, 5),
            BN: parseRosterNumber(merged.BN, DEFAULT_ROSTER_SETTINGS.BN, 0, 20)
        };
        const total = normalized.QB + normalized.WR + normalized.RB + normalized.TE + normalized.FLEX + normalized.K + normalized.DEF + normalized.BN;
        if (total < 8) {
            normalized.BN += (8 - total);
        }
        return normalized;
    }

    function applyRosterSettings(raw) {
        rosterSettings = normalizeRosterSettings(raw);

        const flexAndBench = rosterSettings.FLEX + rosterSettings.BN;
        rosterSize = rosterSettings.QB + rosterSettings.WR + rosterSettings.RB + rosterSettings.TE + rosterSettings.FLEX + rosterSettings.K + rosterSettings.DEF + rosterSettings.BN;

        rosterLimits = {
            QB: { min: rosterSettings.QB, max: rosterSettings.QB + rosterSettings.BN },
            RB: { min: rosterSettings.RB, max: rosterSettings.RB + flexAndBench },
            WR: { min: rosterSettings.WR, max: rosterSettings.WR + flexAndBench },
            TE: { min: rosterSettings.TE, max: rosterSettings.TE + flexAndBench },
            K: { min: rosterSettings.K, max: rosterSettings.K + rosterSettings.BN },
            DEF: { min: rosterSettings.DEF, max: rosterSettings.DEF + rosterSettings.BN }
        };

        roundPositionMinimums = {
            QB: rosterSettings.QB > 0 ? Math.max(1, rosterSettings.QB) : 0,
            RB: rosterSettings.RB > 0 ? Math.max(1, rosterSettings.RB) : 0,
            WR: rosterSettings.WR > 0 ? Math.max(1, rosterSettings.WR) : 0,
            TE: rosterSettings.TE > 0 ? Math.max(1, rosterSettings.TE) : 0,
            K: rosterSettings.K > 0 ? Math.max(1, rosterSettings.K) : 0,
            DEF: rosterSettings.DEF > 0 ? Math.max(1, rosterSettings.DEF) : 0
        };
    }

    function normalizeBenchCutTarget(value) {
        const parsed = Number.parseInt(value, 10);
        if (Number.isNaN(parsed)) return DEFAULT_BENCH_CUT_TARGET;
        return Math.max(0, Math.min(parsed, MAX_DRAFT_BENCH));
    }

    function getFlexRequirementCount() {
        return rosterSettings.FLEX || 0;
    }

    applyRosterSettings(DEFAULT_ROSTER_SETTINGS);

    function validateRoster(team) {
        const positionCounts = team.roster.reduce((counts, p) => {
            counts[p.position] = (counts[p.position] || 0) + 1;
            return counts;
        }, {});
        const flexEligibleCount = (positionCounts.RB || 0) + (positionCounts.WR || 0) + (positionCounts.TE || 0);
        return (
            (positionCounts.QB || 0) >= rosterLimits.QB.min &&
            (positionCounts.RB || 0) >= rosterLimits.RB.min &&
            (positionCounts.WR || 0) >= rosterLimits.WR.min &&
            (positionCounts.TE || 0) >= rosterLimits.TE.min &&
            (positionCounts.K || 0) >= rosterLimits.K.min &&
            (positionCounts.DEF || 0) >= rosterLimits.DEF.min &&
            flexEligibleCount >= (rosterLimits.RB.min + rosterLimits.WR.min + rosterLimits.TE.min + getFlexRequirementCount()) &&
            team.roster.length === rosterSize
        );
    }

    // Get username and draft data from session
    const username = sessionStorage.getItem('username') || 'Your Team';
    const normalizedUsername = String(username || '').trim().toLowerCase();
    const currentDraftCode = sessionStorage.getItem('currentDraft');

    function isCurrentUserTeamName(teamName) {
        return String(teamName || '').trim().toLowerCase() === normalizedUsername;
    }
    
    // Global teams array
    let teams = [];
    let autoDraftStatusByTeam = {};
    
    // Get lobby members from server for synchronized state
    let lobbyMembers = [];
    let allDraftMembers = []; // Full member list to determine host
    
    // Global players array loaded from JSON files
    let players = [];
    let draftRoomRankingsMode = 'personal';
    let draftRoomRightViewMode = 'budgets';
    let draftRoomRankingsPosition = 'ALL';
    
    // Load players from JSON files
    async function loadPlayers() {
        const positions = ['qb', 'rb', 'wr', 'te', 'k', 'def'];
        const loadedPlayers = [];
        
        for (const pos of positions) {
            try {
                const response = await fetch(`players%20file/${pos}.json`);
                if (response.ok) {
                    const positionPlayers = await response.json();
                    
                    // Add position and id to each player
                    positionPlayers.forEach((player, index) => {
                        player.position = player.position || pos.toUpperCase();
                        player.id = loadedPlayers.length + index + 1; // Unique ID
                        player.owner = null; // Initially no owner
                        
                        // Set position-specific rank
                        const rankKey = player.position + 'rank';
                        if (player[rankKey]) {
                            player.positionRank = parseInt(player[rankKey].replace('#', ''));
                        } else {
                            player.positionRank = 999; // Fallback
                        }
                    });
                    loadedPlayers.push(...positionPlayers);
                } else {
                    console.warn(`Failed to load ${pos}.json: ${response.status}`);
                }
            } catch (error) {
                console.error(`Error loading ${pos}.json:`, error);
            }
        }
        
        players = loadedPlayers;
        console.log(`[silentdraft] Loaded ${players.length} players from JSON files`);
        return players;
    }
    
    // Connect to server to get authoritative draft state
    function initializeDraft() {
        if (currentDraftCode && window.io) {
            const socket = io();
            socket.emit('getDraftState', currentDraftCode, (response) => {
                if (response && response.ok && response.draft && response.draft.members) {
                    console.log('[silentdraft] Loaded draft state from server:', response.draft.members);
                    // Use server's member list as the source of truth
                    allDraftMembers = response.draft.members; // Keep full list for host check
                    lobbyMembers = response.draft.members.filter(member => member !== username);
                    // Resolve roster settings: prefer server value, fall back to localStorage
                    let resolvedRosterSettings = response.draft.rosterSettings;
                    let resolvedBenchCutTarget = response.draft.benchCutTarget;
                    try {
                        const localRaw = localStorage.getItem('drafts');
                        const localDrafts = localRaw ? JSON.parse(localRaw) : {};
                        const localDraft = localDrafts[currentDraftCode] || {};
                        if (!resolvedRosterSettings && localDraft.rosterSettings) {
                            resolvedRosterSettings = localDraft.rosterSettings;
                            console.log('[silentdraft] Using rosterSettings from localStorage (server had none)');
                        }
                        if (typeof resolvedBenchCutTarget === 'undefined' && typeof localDraft.benchCutTarget !== 'undefined') {
                            resolvedBenchCutTarget = localDraft.benchCutTarget;
                        }
                    } catch (e) { /* ignore */ }

                    // Persist resolved values back to localStorage and update server if needed
                    try {
                        const draftsData = localStorage.getItem('drafts') || '{}';
                        const drafts = JSON.parse(draftsData);
                        if (!drafts[currentDraftCode]) drafts[currentDraftCode] = {};
                        if (response.draft.capacity) drafts[currentDraftCode].capacity = response.draft.capacity;
                        drafts[currentDraftCode].rosterSettings = normalizeRosterSettings(resolvedRosterSettings);
                        drafts[currentDraftCode].benchCutTarget = normalizeBenchCutTarget(resolvedBenchCutTarget);
                        localStorage.setItem('drafts', JSON.stringify(drafts));
                    } catch (e) { /* ignore */ }

                    benchCutTarget = normalizeBenchCutTarget(resolvedBenchCutTarget);
                    applyRosterSettings(resolvedRosterSettings);
                    buildTeamsAndStartDraft();
                } else {
                    console.warn('[silentdraft] Failed to load from server, falling back to localStorage');
                    loadFromLocalStorage();
                    buildTeamsAndStartDraft();
                }
            });
        } else {
            console.warn('[silentdraft] No draft code or socket.io, using localStorage');
            loadFromLocalStorage();
            buildTeamsAndStartDraft();
        }
    }
    
    function loadFromLocalStorage() {
        if (currentDraftCode) {
            const draftsData = localStorage.getItem('drafts');
            if (draftsData) {
                const drafts = JSON.parse(draftsData);
                const currentDraft = drafts[currentDraftCode];
                if (currentDraft && currentDraft.members) {
                    lobbyMembers = currentDraft.members.filter(member => member !== username);
                }
                if (currentDraft) {
                    benchCutTarget = normalizeBenchCutTarget(currentDraft.benchCutTarget);
                }
                applyRosterSettings(currentDraft && currentDraft.rosterSettings);
            }
        }
    }
    
    function buildTeamsAndStartDraft() {
        console.log('[silentdraft] Building teams with members:', lobbyMembers);

        // Get capacity from draft data
        let capacity = 10; // default
        let customBudgets = {};
        if (currentDraftCode) {
            const draftsData = localStorage.getItem('drafts');
            if (draftsData) {
                const drafts = JSON.parse(draftsData);
                const currentDraft = drafts[currentDraftCode];
                if (currentDraft && currentDraft.capacity) {
                    capacity = currentDraft.capacity;
                }
                if (currentDraft) {
                    benchCutTarget = normalizeBenchCutTarget(currentDraft.benchCutTarget);
                }
                if (currentDraft && currentDraft.customBudgets && typeof currentDraft.customBudgets === 'object') {
                    customBudgets = currentDraft.customBudgets;
                }
            }
        }

    const getStartingBudget = (teamName) => {
        const parsed = Number.parseInt(customBudgets[teamName], 10);
        if (Number.isNaN(parsed)) return 200;
        return Math.max(0, Math.min(parsed, 9999));
    };

    // Build teams array first - user's team plus lobby members, then fill with generic teams if needed
    teams = []; // Reset teams array
    teams.push({ name: username, budget: getStartingBudget(username), roster: [] });
    
    // Add lobby members
    lobbyMembers.forEach(member => {
        teams.push({ name: member, budget: getStartingBudget(member), roster: [] });
    });
    
    // Fill remaining slots with generic team names up to capacity total
    for (let i = teams.length + 1; i <= capacity; i++) {
        teams.push({ name: `Team ${i}`, budget: 200, roster: [] });
    }

    // Make draft socket global for bid synchronization
    window.draftSocket = null;
    window.syncedRoundPlayers = null; // Store synced players from server
    window.currentRoundPlayers = null; // Track current round players for pagination
    // Determine if current user is the host (first member in the draft)
    window.isHost = (allDraftMembers.length > 0 && allDraftMembers[0] === username);
    draftRoomRankingsMode = 'personal';
    draftRoomRightViewMode = 'budgets';

    try {
        const savedMode = localStorage.getItem(DRAFTROOM_RANKINGS_MODE_KEY);
        if (savedMode === 'default' || savedMode === 'personal') {
            draftRoomRankingsMode = savedMode;
        }
    } catch (e) {
        draftRoomRankingsMode = 'personal';
    }

    try {
        const savedRightView = localStorage.getItem(DRAFTROOM_RIGHT_VIEW_KEY);
        if (savedRightView === 'rankings' || savedRightView === 'budgets') {
            draftRoomRightViewMode = savedRightView;
        }
    } catch (e) {
        draftRoomRightViewMode = 'budgets';
    }
    
    console.log('[silentdraft] All draft members:', allDraftMembers);
    console.log('[silentdraft] Current user:', username);
    console.log('[silentdraft] Is host:', window.isHost);
    setupRightViewTabs();
    applyRightViewMode();
    setupDraftRoomRankingsTabs();
    setupDraftRoomRankingsPositionTabs();
    renderDraftRoomRankings();

    function updateSocketConnectionIndicator(isConnected, detailText) {
        const indicatorId = 'socket-connection-indicator';
        let indicator = document.getElementById(indicatorId);
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = indicatorId;

            // Place indicator in header if available, fallback to body
            const header = document.querySelector('.header-bar');
            const targetContainer = header ? (header.querySelector('.draft-controls') || header) : document.body;

            indicator.style.display = 'inline-flex';
            indicator.style.alignItems = 'center';
            indicator.style.padding = '6px 10px';
            indicator.style.borderRadius = '999px';
            indicator.style.fontSize = '12px';
            indicator.style.fontWeight = '700';
            indicator.style.letterSpacing = '0.2px';
            indicator.style.border = '1px solid transparent';
            indicator.style.boxShadow = '0 8px 20px rgba(0,0,0,0.12)';
            indicator.style.marginLeft = '10px';
            indicator.style.cursor = 'default';

            targetContainer.appendChild(indicator);
        }

        if (isConnected) {
            indicator.textContent = 'Socket connected';
            indicator.style.background = 'rgba(22, 163, 74, 0.18)';
            indicator.style.color = '#064e3b';
            indicator.style.borderColor = 'rgba(34, 197, 94, 0.25)';
        } else {
            indicator.textContent = detailText || 'Socket disconnected - reconnecting';
            indicator.style.background = 'rgba(220, 38, 38, 0.12)';
            indicator.style.color = '#88111a';
            indicator.style.borderColor = 'rgba(248, 113, 113, 0.35)';
        }
    }
    
    if (window.io && currentDraftCode) {
        window.draftSocket = io();
        window.draftSocket.emit('joinActiveDraft', currentDraftCode, username);
        console.log('[silentdraft] Connected to active draft room, isHost:', window.isHost);

        let reconnectNoticeShown = false;
        updateSocketConnectionIndicator(true);

        window.draftSocket.on('connect', () => {
            updateSocketConnectionIndicator(true);
            if (reconnectNoticeShown) {
                showNotification('Connection restored. Draft is live again.');
                reconnectNoticeShown = false;
            }
        });

        window.draftSocket.on('disconnect', (reason) => {
            updateSocketConnectionIndicator(false, 'Socket disconnected - reconnecting');
            if (!reconnectNoticeShown) {
                showNotification('Connection lost. Attempting to reconnect...');
                reconnectNoticeShown = true;
            }
            console.warn('[silentdraft] Socket disconnected:', reason);
        });

        window.draftSocket.io.on('reconnect_attempt', () => {
            updateSocketConnectionIndicator(false, 'Reconnecting...');
        });

        window.draftSocket.io.on('reconnect_error', () => {
            updateSocketConnectionIndicator(false, 'Reconnect failed - retrying...');
        });

        window.draftSocket.io.on('reconnect_failed', () => {
            updateSocketConnectionIndicator(false, 'Unable to reconnect. Refresh page.');
            showNotification('Unable to reconnect. Please refresh the page.');
        });
        
        // Listen for bid updates from other players
        window.draftSocket.on('bidUpdate', (data) => {
            console.log('[silentdraft] Bid update received:', data);
            // Silent auction - don't show bid details, only submission notification
        });
        
        // Listen for bid submissions (when someone clicks Submit Bids)
        window.draftSocket.on('bidsSubmitted', (data) => {
            console.log('[silentdraft] Player submitted bids:', data.username);
            if (data.username !== username) {
                showSubmissionNotification(data.username);
            }
        });
        
        // Listen for all bids submitted signal
        window.draftSocket.on('allBidsSubmitted', () => {
            if (isDraftEnding) {
                console.log('[silentdraft] Ignoring allBidsSubmitted while draft ending');
                return;
            }
            console.log('[silentdraft] All members have submitted - showing processing modal and starting round processing');
            showProcessingBidsModal();
            processRoundOnServer();
        });
        
        // Listen for round players set by host
        window.draftSocket.on('roundPlayersSet', (roundPlayers) => {
            console.log('[silentdraft] Round players received from host:', roundPlayers.length);
            window.syncedRoundPlayers = roundPlayers;
            
            // If not host, use these players for the round
            if (!window.isHost) {
                displayRoundPlayers(roundPlayers);
            }
        });
        
        // Listen for authoritative round results from server
        window.draftSocket.on('roundResults', (results) => {
            if (isDraftEnding) {
                console.log('[silentdraft] Ignoring roundResults while draft ending');
                return;
            }
            console.log('[silentdraft] Round results received from server:', results.length, 'results');
            console.log('[silentdraft] Full results data:', JSON.stringify(results, null, 2));
            hideProcessingBidsModal();
            const { tiedBids } = applyRoundResults(results);
            showRoundResultsModal(results, window.currentRoundPlayers || window.syncedRoundPlayers || [], () => {
                if (timerInterval) {
                    clearInterval(timerInterval);
                    timerInterval = null;
                }
                
                if (tiedBids.length === 0) {
                    advanceDraftAfterRound();
                }
            });
        });
        
        // Listen for round changes
        window.draftSocket.on('roundStarted', (draftState) => {
            console.log('[silentdraft] New round started:', draftState.currentRound);
            currentRound = draftState.currentRound;
            window.syncedRoundPlayers = null; // Clear for new round
        });
        
        // Listen for initial state sync
        window.draftSocket.on('draftStateSync', (draftState) => {
            console.log('[silentdraft] Draft state synced:', draftState);
            autoDraftStatusByTeam = draftState.autoDraftStatus || autoDraftStatusByTeam;
            if (draftState && draftState.rosterSettings) {
                applyRosterSettings(draftState.rosterSettings);
            }
            autoDraftEnabled = !!autoDraftStatusByTeam[username];
            updateAutoDraftToggleUI();
            // If there are current players already set, use them
            if (draftState.currentPlayers && draftState.currentPlayers.length > 0) {
                window.syncedRoundPlayers = draftState.currentPlayers;
                if (!window.isHost) {
                    displayRoundPlayers(draftState.currentPlayers);
                }
            }
        });

        window.draftSocket.on('autoDraftStatusSync', (statusMap) => {
            autoDraftStatusByTeam = statusMap || {};
            autoDraftEnabled = !!autoDraftStatusByTeam[username];
            updateAutoDraftToggleUI();
            updateUI(getRoundPlayers());
        });

        window.draftSocket.on('autoDraftStatusChanged', (payload) => {
            autoDraftStatusByTeam = (payload && payload.statuses) ? payload.statuses : autoDraftStatusByTeam;
            autoDraftEnabled = !!autoDraftStatusByTeam[username];
            updateAutoDraftToggleUI();
            updateUI(getRoundPlayers());
        });

        // Live roster settings update from lobby host
        window.draftSocket.on('rosterSettingsUpdated', (data) => {
            if (!data) return;
            let settingsChanged = false;
            if (data.rosterSettings) {
                applyRosterSettings(data.rosterSettings);
                settingsChanged = true;
                // Persist to localStorage so re-joins pick it up
                try {
                    const draftsRaw = localStorage.getItem('drafts');
                    const drafts = draftsRaw ? JSON.parse(draftsRaw) : {};
                    if (drafts[currentDraftCode]) {
                        drafts[currentDraftCode].rosterSettings = data.rosterSettings;
                        if (typeof data.benchCutTarget !== 'undefined') {
                            drafts[currentDraftCode].benchCutTarget = data.benchCutTarget;
                        }
                        localStorage.setItem('drafts', JSON.stringify(drafts));
                    }
                } catch (e) { /* ignore */ }
            }
            if (typeof data.benchCutTarget !== 'undefined') {
                benchCutTarget = normalizeBenchCutTarget(data.benchCutTarget);
                settingsChanged = true;
            }
            if (settingsChanged) {
                renderRosterRequirementsSummary();
                updateUI(getRoundPlayers());
            }
        });
    }
    
    // Helper to show bid submission notifications (silent auction - no details)
    function showSubmissionNotification(teamName) {
        const notification = document.createElement('div');
        notification.style.position = 'fixed';
        notification.style.top = '20px';
        notification.style.right = '20px';
        notification.style.background = '#4a5568';
        notification.style.color = 'white';
        notification.style.padding = '12px 20px';
        notification.style.borderRadius = '8px';
        notification.style.zIndex = '9999';
        notification.style.boxShadow = '0 4px 6px rgba(0,0,0,0.3)';
        notification.textContent = `${teamName} has submitted their bids`;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.transition = 'opacity 0.5s';
            notification.style.opacity = '0';
            setTimeout(() => document.body.removeChild(notification), 500);
        }, 3000);
    }
    
    // Process round on server (called when all submitted or timer expires)
    function processRoundOnServer() {
        console.log('[silentdraft] Processing round on server');
        
        // Stop the timer when processing begins
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
            console.log('[silentdraft] Timer cleared for round processing');
        }
        
        const roundPlayers = getRoundPlayers();
        const roundData = {
            roundPlayers: roundPlayers,
            teams: teams,
            rosterSize: rosterSize,
            rosterLimits: rosterLimits,
            flexPositions: flexPositions,
            rosterSettings: rosterSettings,
            allPlayers: players
        };
        
        if (window.draftSocket && currentDraftCode) {
            window.draftSocket.emit('processRound', currentDraftCode, roundData, (response) => {
                if (response && response.ok) {
                    console.log('[silentdraft] Round processing complete');
                }
            });
        }
    }

    function handleRoundTimerExpired() {
        if (window.__silentDraftTimerExpiredHandled) {
            return;
        }
        window.__silentDraftTimerExpiredHandled = true;
        console.log('[silentdraft] Timer expired - auto-submitting bids for this round');

        // Act like this user pressed Submit Bids.
        submitBids({ forceAutoSubmit: true, fromTimer: true });

        // Host finalizes timer expiry by forcing any missing submissions server-side.
        if (window.isHost && window.draftSocket && currentDraftCode) {
            window.draftSocket.emit('forceTimerRoundEnd', currentDraftCode, (response) => {
                if (response && response.ok) {
                    console.log('[silentdraft] Host forced timer round end:', response);
                } else {
                    console.warn('[silentdraft] forceTimerRoundEnd rejected:', response);
                }
            });
        }
    }

  // Full player list (top 250 PPR players)


   


    // Check if adding a player is valid for a team's roster
    function isValidRosterAddition(team, player) {
        if (team.roster.length >= rosterSize) {
            return false;
        }
        const positionCounts = team.roster.reduce((counts, p) => {
            counts[p.position] = (counts[p.position] || 0) + 1;
            return counts;
        }, {});
        const currentCount = positionCounts[player.position] || 0;
        if (currentCount >= rosterLimits[player.position].max) {
            return false;
        }
        return true;
    }

    // Validate roster at draft end
    function validateRoster(team) {
        const positionCounts = team.roster.reduce((counts, p) => {
            counts[p.position] = (counts[p.position] || 0) + 1;
            return counts;
        }, {});
        const flexEligibleCount = (positionCounts.RB || 0) + (positionCounts.WR || 0) + (positionCounts.TE || 0);
        return (
            (positionCounts.QB || 0) >= rosterLimits.QB.min &&
            (positionCounts.RB || 0) >= rosterLimits.RB.min &&
            (positionCounts.WR || 0) >= rosterLimits.WR.min &&
            (positionCounts.TE || 0) >= rosterLimits.TE.min &&
            (positionCounts.K || 0) >= rosterLimits.K.min &&
            (positionCounts.DEF || 0) >= rosterLimits.DEF.min &&
            flexEligibleCount >= (rosterLimits.RB.min + rosterLimits.WR.min + rosterLimits.TE.min + getFlexRequirementCount()) &&
            team.roster.length === rosterSize
        );
    }
    }

    function getRemainingUndraftedPlayers(excludePlayers = []) {
        return players.filter(player => !player.owner && !player.shown && !excludePlayers.includes(player));
    }

    function getMaxSelectionsForCurrentRound(position, excludePlayers = [], currentSelected = []) {
        const totalUndraftedAtPosition = players.filter(player => (
            !player.owner &&
            !player.shown &&
            player.position === position
        )).length;

        const roundsAfterCurrent = Math.max(0, totalRounds - currentRound);
        const futureReserve = roundsAfterCurrent * (roundPositionMinimums[position] || 0);
        const currentRoundMinimum = Math.min(roundPositionMinimums[position] || 0, totalUndraftedAtPosition);
        const maxCurrentRoundTotal = Math.max(currentRoundMinimum, totalUndraftedAtPosition - futureReserve);

        const alreadyCommitted = excludePlayers.filter(player => player.position === position).length +
            currentSelected.filter(player => player.position === position).length;

        return Math.max(0, maxCurrentRoundTotal - alreadyCommitted);
    }

    function canSelectPlayerForCurrentRound(player, excludePlayers = [], currentSelected = []) {
        return getMaxSelectionsForCurrentRound(player.position, excludePlayers, currentSelected) > 0;
    }

    // Get random players for the round with balanced positions and mixed ranks
    function getRandomPlayers(count) {
        const availablePlayers = getRemainingUndraftedPlayers();

        // Sort available players by rank to create relative tiers
        const sortedPlayers = [...availablePlayers].sort((a, b) => a.prerank - b.prerank);
        const totalPlayers = sortedPlayers.length;
        const topTierCount = Math.floor(totalPlayers * 0.25);
        const middleTierCount = Math.floor(totalPlayers * 0.5); // Next 50%
        
        // Create tier arrays based on sorted order
        const topTier = sortedPlayers.slice(0, topTierCount);
        const middleTier = sortedPlayers.slice(topTierCount, topTierCount + middleTierCount);
        const bottomTier = sortedPlayers.slice(topTierCount + middleTierCount);

        console.log(`[getRandomPlayers] Available players: ${totalPlayers}, Top tier: ${topTier.length}, Middle: ${middleTier.length}, Bottom: ${bottomTier.length}`);

        // Prioritize positions to ensure minimums are met, but select randomly from different tiers
        const positionPriority = [
            { pos: 'QB', min: 2, max: 2 },  // Exactly 2 QBs on page 1
            { pos: 'RB', min: 2, max: 3 },
            { pos: 'WR', min: 2, max: 3 },
            { pos: 'TE', min: 1, max: 2 },
            { pos: 'K', min: 1, max: 1 },   // Exactly 1 kicker per page
            { pos: 'DEF', min: 1, max: 1 }  // Exactly 1 defender per page
        ];

        let selectedPlayers = [];

        for (const { pos, min, max } of positionPriority) {
            const posPlayers = availablePlayers.filter(p => p.position === pos);
            const roundAllowance = getMaxSelectionsForCurrentRound(pos, [], selectedPlayers);

            // Categorize position players by tier
            const posTopTier = posPlayers.filter(p => topTier.includes(p));
            const posMiddleTier = posPlayers.filter(p => middleTier.includes(p));
            const posBottomTier = posPlayers.filter(p => bottomTier.includes(p));

            // Select minimum players with tier distribution: ~40% top, ~40% middle, ~20% bottom
            let numToSelect = Math.min(min, posPlayers.length, count - selectedPlayers.length, roundAllowance);

            // Shuffle each tier
            const shuffledTop = [...posTopTier].sort(() => 0.5 - Math.random());
            const shuffledMiddle = [...posMiddleTier].sort(() => 0.5 - Math.random());
            const shuffledBottom = [...posBottomTier].sort(() => 0.5 - Math.random());

            // Distribute selections across tiers
            let selectedFromTop = 0;
            let selectedFromMiddle = 0;
            let selectedFromBottom = 0;

            for (let i = 0; i < numToSelect; i++) {
                // Prioritize tier distribution but fall back if tier is empty
                if (selectedFromTop < Math.ceil(numToSelect * 0.4) && shuffledTop.length > 0) {
                    selectedPlayers.push(shuffledTop.pop());
                    selectedFromTop++;
                } else if (selectedFromMiddle < Math.ceil(numToSelect * 0.4) && shuffledMiddle.length > 0) {
                    selectedPlayers.push(shuffledMiddle.pop());
                    selectedFromMiddle++;
                } else if (shuffledBottom.length > 0) {
                    selectedPlayers.push(shuffledBottom.pop());
                    selectedFromBottom++;
                } else if (shuffledMiddle.length > 0) {
                    selectedPlayers.push(shuffledMiddle.pop());
                    selectedFromMiddle++;
                } else if (shuffledTop.length > 0) {
                    selectedPlayers.push(shuffledTop.pop());
                    selectedFromTop++;
                }
            }

            // If we have room and haven't reached max yet, randomly add more with tier mixing
            const remainingSlots = Math.min(
                max - numToSelect,
                posPlayers.length - numToSelect,
                count - selectedPlayers.length,
                Math.max(0, roundAllowance - numToSelect)
            );
            if (remainingSlots > 0) {
                // Re-categorize remaining players
                const remainingPosPlayers = posPlayers.filter(p => !selectedPlayers.includes(p));
                const remainingTop = remainingPosPlayers.filter(p => topTier.includes(p));
                const remainingMiddle = remainingPosPlayers.filter(p => middleTier.includes(p));
                const remainingBottom = remainingPosPlayers.filter(p => bottomTier.includes(p));

                const shuffledRemainingTop = [...remainingTop].sort(() => 0.5 - Math.random());
                const shuffledRemainingMiddle = [...remainingMiddle].sort(() => 0.5 - Math.random());
                const shuffledRemainingBottom = [...remainingBottom].sort(() => 0.5 - Math.random());

                // Randomly select additional players with tier preference
                for (let i = 0; i < remainingSlots; i++) {
                    const rand = Math.random();
                    if (rand < 0.4 && shuffledRemainingTop.length > 0) {
                        selectedPlayers.push(shuffledRemainingTop.pop());
                    } else if (rand < 0.8 && shuffledRemainingMiddle.length > 0) {
                        selectedPlayers.push(shuffledRemainingMiddle.pop());
                    } else if (shuffledRemainingBottom.length > 0) {
                        selectedPlayers.push(shuffledRemainingBottom.pop());
                    } else if (shuffledRemainingMiddle.length > 0) {
                        selectedPlayers.push(shuffledRemainingMiddle.pop());
                    } else if (shuffledRemainingTop.length > 0) {
                        selectedPlayers.push(shuffledRemainingTop.pop());
                    }
                }
            }
        }

        // Fill remaining slots with random players from mixed tiers
        const remainingCount = count - selectedPlayers.length;
        if (remainingCount > 0) {
            const remainingPlayers = availablePlayers.filter(p =>
                !selectedPlayers.includes(p) &&
                p.position !== 'K' &&
                p.position !== 'DEF' &&
                canSelectPlayerForCurrentRound(p, [], selectedPlayers)
            );

            // Categorize remaining players by tier
            const remainingTop = remainingPlayers.filter(p => topTier.includes(p));
            const remainingMiddle = remainingPlayers.filter(p => middleTier.includes(p));
            const remainingBottom = remainingPlayers.filter(p => bottomTier.includes(p));

            // Shuffle each tier
            const shuffledRemainingTop = [...remainingTop].sort(() => 0.5 - Math.random());
            const shuffledRemainingMiddle = [...remainingMiddle].sort(() => 0.5 - Math.random());
            const shuffledRemainingBottom = [...remainingBottom].sort(() => 0.5 - Math.random());

            // Prioritize WR and RB, but mix ranks
            const wrRbPlayers = remainingPlayers.filter(p => (p.position === 'WR' || p.position === 'RB'));
            const wrRbTop = wrRbPlayers.filter(p => topTier.includes(p));
            const wrRbMiddle = wrRbPlayers.filter(p => middleTier.includes(p));
            const wrRbBottom = wrRbPlayers.filter(p => bottomTier.includes(p));

            const shuffledWrRbTop = [...wrRbTop].sort(() => 0.5 - Math.random());
            const shuffledWrRbMiddle = [...wrRbMiddle].sort(() => 0.5 - Math.random());
            const shuffledWrRbBottom = [...wrRbBottom].sort(() => 0.5 - Math.random());

            // First fill with WR/RB from mixed tiers
            let wrRbAdded = 0;
            for (let i = 0; i < Math.min(remainingCount, wrRbPlayers.length); i++) {
                const rand = Math.random();
                if (rand < 0.4 && shuffledWrRbTop.length > 0) {
                    selectedPlayers.push(shuffledWrRbTop.pop());
                    wrRbAdded++;
                } else if (rand < 0.7 && shuffledWrRbMiddle.length > 0) {
                    selectedPlayers.push(shuffledWrRbMiddle.pop());
                    wrRbAdded++;
                } else if (shuffledWrRbBottom.length > 0) {
                    selectedPlayers.push(shuffledWrRbBottom.pop());
                    wrRbAdded++;
                } else if (shuffledWrRbMiddle.length > 0) {
                    selectedPlayers.push(shuffledWrRbMiddle.pop());
                    wrRbAdded++;
                } else if (shuffledWrRbTop.length > 0) {
                    selectedPlayers.push(shuffledWrRbTop.pop());
                    wrRbAdded++;
                }
                if (wrRbAdded >= remainingCount) break;
            }

            // Then fill remaining with others from mixed tiers
            const stillNeeded = remainingCount - wrRbAdded;
            if (stillNeeded > 0) {
                for (let i = 0; i < stillNeeded; i++) {
                    const rand = Math.random();
                    if (rand < 0.3 && shuffledRemainingTop.length > 0) {
                        selectedPlayers.push(shuffledRemainingTop.pop());
                    } else if (rand < 0.7 && shuffledRemainingMiddle.length > 0) {
                        selectedPlayers.push(shuffledRemainingMiddle.pop());
                    } else if (shuffledRemainingBottom.length > 0) {
                        selectedPlayers.push(shuffledRemainingBottom.pop());
                    } else if (shuffledRemainingMiddle.length > 0) {
                        selectedPlayers.push(shuffledRemainingMiddle.pop());
                    } else if (shuffledRemainingTop.length > 0) {
                        selectedPlayers.push(shuffledRemainingTop.pop());
                    }
                }
            }
        }

        console.log(`[getRandomPlayers] Selected ${selectedPlayers.length} players with rank distribution:`, {
            top: selectedPlayers.filter(p => topTier.includes(p)).length,
            middle: selectedPlayers.filter(p => middleTier.includes(p)).length,
            bottom: selectedPlayers.filter(p => bottomTier.includes(p)).length
        });

        return selectedPlayers.slice(0, count);
    }

    // Get balanced players for page 2 (ensuring minimums are met with mixed ranks)
    function getBalancedPagePlayers(count, excludePlayers = []) {
        const availablePlayers = getRemainingUndraftedPlayers(excludePlayers);

        // Sort available players by rank to create relative tiers
        const sortedPlayers = [...availablePlayers].sort((a, b) => a.prerank - b.prerank);
        const totalPlayers = sortedPlayers.length;
        const topTierCount = Math.floor(totalPlayers * 0.25);
        const middleTierCount = Math.floor(totalPlayers * 0.5); // Next 50%
        
        // Create tier arrays based on sorted order
        const topTier = sortedPlayers.slice(0, topTierCount);
        const middleTier = sortedPlayers.slice(topTierCount, topTierCount + middleTierCount);
        const bottomTier = sortedPlayers.slice(topTierCount + middleTierCount);

        // Prioritize positions to ensure minimums are met for page 2 with mixed ranks
        const positionPriority = [
            { pos: 'QB', min: 1, max: 1 },
            { pos: 'RB', min: 1, max: 2 },
            { pos: 'WR', min: 1, max: 2 },
            { pos: 'TE', min: 1, max: 2 },
            { pos: 'K', min: 0, max: 0 },
            { pos: 'DEF', min: 0, max: 0 }
        ];

        let selectedPlayers = [];
        for (const { pos, min, max } of positionPriority) {
            const posPlayers = availablePlayers.filter(p => p.position === pos && !selectedPlayers.includes(p));
            const roundAllowance = getMaxSelectionsForCurrentRound(pos, excludePlayers, selectedPlayers);

            // Categorize position players by tier
            const posTopTier = posPlayers.filter(p => topTier.includes(p));
            const posMiddleTier = posPlayers.filter(p => middleTier.includes(p));
            const posBottomTier = posPlayers.filter(p => bottomTier.includes(p));

            // Select minimum players with tier distribution: ~40% top, ~40% middle, ~20% bottom
            let numToSelect = Math.min(min, posPlayers.length, count - selectedPlayers.length, roundAllowance);

            // Shuffle each tier
            const shuffledTop = [...posTopTier].sort(() => 0.5 - Math.random());
            const shuffledMiddle = [...posMiddleTier].sort(() => 0.5 - Math.random());
            const shuffledBottom = [...posBottomTier].sort(() => 0.5 - Math.random());

            // Distribute selections across tiers
            let selectedFromTop = 0;
            let selectedFromMiddle = 0;
            let selectedFromBottom = 0;

            for (let i = 0; i < numToSelect; i++) {
                // Prioritize tier distribution but fall back if tier is empty
                if (selectedFromTop < Math.ceil(numToSelect * 0.4) && shuffledTop.length > 0) {
                    selectedPlayers.push(shuffledTop.pop());
                    selectedFromTop++;
                } else if (selectedFromMiddle < Math.ceil(numToSelect * 0.4) && shuffledMiddle.length > 0) {
                    selectedPlayers.push(shuffledMiddle.pop());
                    selectedFromMiddle++;
                } else if (shuffledBottom.length > 0) {
                    selectedPlayers.push(shuffledBottom.pop());
                    selectedFromBottom++;
                } else if (shuffledMiddle.length > 0) {
                    selectedPlayers.push(shuffledMiddle.pop());
                    selectedFromMiddle++;
                } else if (shuffledTop.length > 0) {
                    selectedPlayers.push(shuffledTop.pop());
                    selectedFromTop++;
                }
            }

            // If we have room and haven't reached max yet, randomly add more with tier mixing
            const remainingSlots = Math.min(
                max - numToSelect,
                posPlayers.length - numToSelect,
                count - selectedPlayers.length,
                Math.max(0, roundAllowance - numToSelect)
            );
            if (remainingSlots > 0) {
                // Re-categorize remaining players
                const remainingPosPlayers = posPlayers.filter(p => !selectedPlayers.includes(p));
                const remainingTop = remainingPosPlayers.filter(p => topTier.includes(p));
                const remainingMiddle = remainingPosPlayers.filter(p => middleTier.includes(p));
                const remainingBottom = remainingPosPlayers.filter(p => bottomTier.includes(p));

                const shuffledRemainingTop = [...remainingTop].sort(() => 0.5 - Math.random());
                const shuffledRemainingMiddle = [...remainingMiddle].sort(() => 0.5 - Math.random());
                const shuffledRemainingBottom = [...remainingBottom].sort(() => 0.5 - Math.random());

                // Randomly select additional players with tier preference
                for (let i = 0; i < remainingSlots; i++) {
                    const rand = Math.random();
                    if (rand < 0.4 && shuffledRemainingTop.length > 0) {
                        selectedPlayers.push(shuffledRemainingTop.pop());
                    } else if (rand < 0.8 && shuffledRemainingMiddle.length > 0) {
                        selectedPlayers.push(shuffledRemainingMiddle.pop());
                    } else if (shuffledRemainingBottom.length > 0) {
                        selectedPlayers.push(shuffledRemainingBottom.pop());
                    } else if (shuffledRemainingMiddle.length > 0) {
                        selectedPlayers.push(shuffledRemainingMiddle.pop());
                    } else if (shuffledRemainingTop.length > 0) {
                        selectedPlayers.push(shuffledRemainingTop.pop());
                    }
                }
            }
        }

        // Fill remaining slots with random players from mixed tiers
        const remainingCount = count - selectedPlayers.length;
        if (remainingCount > 0) {
            const remainingPlayers = availablePlayers.filter(p =>
                !selectedPlayers.includes(p) &&
                p.position !== 'K' &&
                p.position !== 'DEF' &&
                canSelectPlayerForCurrentRound(p, excludePlayers, selectedPlayers)
            );

            // Shuffle remaining players from all tiers
            const shuffledRemaining = [...remainingPlayers].sort(() => 0.5 - Math.random());
            selectedPlayers.push(...shuffledRemaining.slice(0, remainingCount));
        }

        return selectedPlayers.slice(0, count);
    }

    function getRoundExtras(requiredPositions, excludePlayers = []) {
        const selectedExtras = [];

        requiredPositions.forEach(position => {
            const availableForPosition = getRemainingUndraftedPlayers(excludePlayers.concat(selectedExtras))
                .filter(player => (
                    player.position === position &&
                    canSelectPlayerForCurrentRound(player, excludePlayers, selectedExtras)
                ));

            if (availableForPosition.length === 0) return;
            const chosen = availableForPosition[Math.floor(Math.random() * availableForPosition.length)];
            if (chosen) selectedExtras.push(chosen);
        });

        return selectedExtras;
    }

    function ensureRequiredPositionsInPool(pool, requiredPositions, excludePlayers = []) {
        const targetCount = pool.length;
        const adjustedPool = [...pool];
        const requiredSet = new Set(requiredPositions || []);

        (requiredPositions || []).forEach(position => {
            const hasPosition = adjustedPool.some(player => player.position === position);
            if (hasPosition) return;

            const replacementCandidates = getRemainingUndraftedPlayers(excludePlayers.concat(adjustedPool))
                .filter(player => (
                    player.position === position &&
                    canSelectPlayerForCurrentRound(player, excludePlayers, adjustedPool)
                ));

            if (replacementCandidates.length === 0) return;
            const replacement = replacementCandidates[Math.floor(Math.random() * replacementCandidates.length)];

            const replaceIndex = adjustedPool.findIndex(player => !requiredSet.has(player.position));
            if (replaceIndex >= 0) {
                adjustedPool[replaceIndex] = replacement;
            } else if (adjustedPool.length < targetCount) {
                adjustedPool.push(replacement);
            }
        });

        return adjustedPool.slice(0, targetCount);
    }

    // Update bid counter
    function updateBidCounter() {
        const bidCounter = document.getElementById('bid-counter');
        if (!bidCounter) return;
        
        const yourTeam = teams.find(t => t.name === username);
        const budget = yourTeam ? yourTeam.budget : 200;
        
        let totalBids = 0;
        Object.values(storedBids).forEach(bid => {
            const amount = parseInt(bid) || 0;
            totalBids += amount;
        });
        
        const remaining = Math.max(0, budget - totalBids);
        bidCounter.textContent = `Total Bids: $${totalBids} | Budget: $${budget} | Remaining: $${remaining}`;
        
        // Color code based on remaining
        if (remaining < 0) {
            bidCounter.style.color = '#dc3545'; // Red for over
        } else if (remaining < 20) {
            bidCounter.style.color = '#ffc107'; // Yellow for low
        } else {
            bidCounter.style.color = '#28a745'; // Green for good
        }
    }

    function getDraftRoomPlayerStatus(playerName) {
        const yourTeam = teams.find(t => t.name === username);
        const userRosterNames = yourTeam ? yourTeam.roster.map(p => p.name) : [];
        const currentRoundNames = (window.currentRoundPlayers || window.syncedRoundPlayers || []).map(p => p.name);
        const playerObj = players.find(p => p.name === playerName);

        if (userRosterNames.includes(playerName)) return 'user-roster';
        if (playerObj && playerObj.owner && !isCurrentUserTeamName(playerObj.owner)) return 'drafted';
        if (currentRoundNames.includes(playerName)) return 'current-round';
        if (playerObj && playerObj.shown && !playerObj.owner) return 'passed';
        return 'available';
    }

    function getDraftRoomDefaultRankings() {
        return [...players]
            .filter(p => p && p.name)
            .sort((a, b) => {
                const rankA = Number.isFinite(a.prerank) ? a.prerank : (Number.isFinite(a.positionRank) ? a.positionRank : 9999);
                const rankB = Number.isFinite(b.prerank) ? b.prerank : (Number.isFinite(b.positionRank) ? b.positionRank : 9999);
                return rankA - rankB;
            })
            .map(p => ({
                name: p.name,
                position: p.position || 'UNK',
                team: p.team || '—',
                avgValue: p.avgValue || p.value || 0,
            }));
    }

    function getDraftRoomPersonalRankings() {
        try {
            const raw = localStorage.getItem('userRankings');
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            const flat = [];

            const appendTierPlayers = (tiers) => {
                (Array.isArray(tiers) ? tiers : []).forEach(tier => {
                    const tierPlayers = Array.isArray(tier.players) ? tier.players : [];
                    tierPlayers.forEach(player => {
                        flat.push({
                            name: player.name,
                            position: player.position || 'UNK',
                            team: player.team || '—',
                            avgValue: player.avgValue || 0,
                        });
                    });
                });
            };

            if (parsed && parsed.boardsByPos && typeof parsed.boardsByPos === 'object') {
                const boardKey = draftRoomRankingsPosition === 'ALL' ? 'ALL' : draftRoomRankingsPosition;
                appendTierPlayers(parsed.boardsByPos[boardKey]);
                return flat;
            }

            appendTierPlayers(parsed && parsed.tiers);
            return flat;
        } catch (e) {
            return [];
        }
    }

    function buildRosterSlotRow(slotLabel, player) {
        return `
            <div class="roster-slot-card">
                <span class="roster-slot-label">${slotLabel}</span>
                <span class="roster-slot-value">${player ? `${player.name} - $${player.bid}` : ''}</span>
            </div>
        `;
    }

    function buildBenchPlayerRow(player) {
        return `
            <div class="bench-player-card">
                <span class="bench-pos-badge">${player.position}</span>
                <span class="bench-player-name">${player.name}</span>
                <span class="bench-player-bid">$${player.bid}</span>
            </div>
        `;
    }

    function getConfiguredSlotBlueprint() {
        const slots = [];
        const addSlots = (label, count, eligiblePositions) => {
            for (let i = 1; i <= count; i++) {
                const slotLabel = count === 1 ? label : `${label}${i}`;
                slots.push({ label: slotLabel, eligible: eligiblePositions });
            }
        };

        addSlots('QB', rosterSettings.QB || 0, ['QB']);
        addSlots('WR', rosterSettings.WR || 0, ['WR']);
        addSlots('RB', rosterSettings.RB || 0, ['RB']);
        addSlots('TE', rosterSettings.TE || 0, ['TE']);
        addSlots('FLEX', rosterSettings.FLEX || 0, ['RB', 'WR', 'TE']);
        addSlots('K', rosterSettings.K || 0, ['K']);
        addSlots('DEF', rosterSettings.DEF || 0, ['DEF']);
        return slots;
    }

    function assignRosterToSlots(roster) {
        const used = [];
        const assignedSlots = getConfiguredSlotBlueprint().map(slot => {
            const player = (roster || [])
                .filter(p => slot.eligible.includes(p.position) && !used.includes(p))
                .sort((a, b) => a.prerank - b.prerank)[0] || null;
            if (player) used.push(player);
            return { label: slot.label, player };
        });
        const bench = (roster || []).filter(p => !used.includes(p)).sort((a, b) => a.prerank - b.prerank);
        return { assignedSlots, bench };
    }

    function renderRosterRequirementsSummary() {
        const summary = document.getElementById('roster-requirements');
        if (summary) {
            summary.remove();
        }

        const benchTitle = document.getElementById('bench-title');
        if (benchTitle) {
              benchTitle.textContent = 'Bench';
        }
    }

    function loadSharedStarredNames() {
        try {
            const raw = localStorage.getItem(STARRED_PLAYERS_KEY);
            const parsed = raw ? JSON.parse(raw) : [];
            return new Set(Array.isArray(parsed) ? parsed.filter(name => typeof name === 'string' && name) : []);
        } catch (e) {
            return new Set();
        }
    }

    function saveSharedStarredNames(starredNames) {
        try {
            localStorage.setItem(STARRED_PLAYERS_KEY, JSON.stringify([...starredNames].sort()));
            localStorage.setItem('defaultRankingsStarred', JSON.stringify([...starredNames].sort()));
        } catch (e) {
            // ignore
        }
    }

    function loadDraftTempStarredNames() {
        try {
            const raw = localStorage.getItem(DRAFT_TEMP_STARRED_KEY);
            const parsed = raw ? JSON.parse(raw) : [];
            return new Set(Array.isArray(parsed) ? parsed.filter(name => typeof name === 'string' && name) : []);
        } catch (e) {
            return new Set();
        }
    }

    function saveDraftTempStarredNames(starredNames) {
        try {
            localStorage.setItem(DRAFT_TEMP_STARRED_KEY, JSON.stringify([...starredNames].sort()));
        } catch (e) {
            // ignore
        }
    }

    function getEffectiveStarredNames() {
        const starred = loadSharedStarredNames();
        const draftStarred = loadDraftTempStarredNames();
        draftStarred.forEach(name => starred.add(name));
        return starred;
    }

    function toggleDraftStarredPlayer(playerName) {
        if (!playerName) return;

        const draftStarred = loadDraftTempStarredNames();
        if (draftStarred.has(playerName)) {
            draftStarred.delete(playerName);
        } else {
            draftStarred.add(playerName);
        }
        saveDraftTempStarredNames(draftStarred);

        const sharedStarred = loadSharedStarredNames();
        if (sharedStarred.has(playerName)) {
            sharedStarred.delete(playerName);
        } else {
            sharedStarred.add(playerName);
        }
        saveSharedStarredNames(sharedStarred);

        renderDraftRoomRankings();
        if (window.currentRoundPlayers) {
            updateUI(window.currentRoundPlayers);
        }
    }

    function getStarredDraftTargets() {
        try {
            const starredNames = getEffectiveStarredNames();

            const raw = localStorage.getItem('userRankings');
            const parsed = raw ? JSON.parse(raw) : null;

            const collectFromTiers = (tiers) => {
                (Array.isArray(tiers) ? tiers : []).forEach(tier => {
                    const tierPlayers = Array.isArray(tier.players) ? tier.players : [];
                    tierPlayers.forEach(player => {
                        if (player && player.starred && player.name) {
                            starredNames.add(player.name);
                        }
                    });
                });
            };
            if (parsed && parsed.boardsByPos && typeof parsed.boardsByPos === 'object') {
                Object.values(parsed.boardsByPos).forEach(collectFromTiers);
                return starredNames;
            }

            collectFromTiers(parsed && parsed.tiers);
            return starredNames;
        } catch (e) {
            return new Set();
        }
    }

    function renderDraftRoomRankings() {
        const list = document.getElementById('draftroom-rankings-list');
        if (!list) return;
        const starredNames = getEffectiveStarredNames();

        const sourcePlayers = draftRoomRankingsMode === 'default'
            ? getDraftRoomDefaultRankings()
            : getDraftRoomPersonalRankings();

        const filteredPlayers = draftRoomRankingsPosition === 'ALL'
            ? sourcePlayers
            : sourcePlayers.filter(p => p.position === draftRoomRankingsPosition);

        if (!sourcePlayers.length) {
            list.innerHTML = `<div style="font-size:12px;color:#6b7280;padding:6px;">${draftRoomRankingsMode === 'default' ? 'Default rankings unavailable.' : 'No personal rankings saved yet.'}</div>`;
            return;
        }

        if (!filteredPlayers.length) {
            if (draftRoomRankingsMode === 'personal') {
                list.innerHTML = `<div style="font-size:12px;color:#9aa0a6;padding:8px;">No personal rankings for ${draftRoomRankingsPosition}. Switch to Default rankings for this position.</div>`;
            } else {
                list.innerHTML = `<div style="font-size:12px;color:#9aa0a6;padding:8px;">No default rankings found for ${draftRoomRankingsPosition}.</div>`;
            }
            return;
        }

        const visible = filteredPlayers.slice(0, 120);
        list.innerHTML = visible.map((player, idx) => {
            const status = getDraftRoomPlayerStatus(player.name);
            const isStarred = starredNames.has(player.name);
            const owner = (() => {
                const matched = players.find(p => p.name === player.name);
                return matched && matched.owner ? matched.owner : '';
            })();

            return `
                <div class="draftroom-rankings-item status-${status}${isStarred ? ' starred' : ''}" data-player-name="${player.name}">
                    <span class="r-num">${idx + 1}</span>
                    <span class="pos-badge pos-${player.position}">${player.position}</span>
                    <span class="r-name">${player.name}
                        <button class="draft-star-btn${isStarred ? ' active' : ''}" type="button" aria-label="${isStarred ? 'Unstar' : 'Star'} ${player.name}" aria-pressed="${isStarred ? 'true' : 'false'}" title="${isStarred ? 'Starred player' : 'Mark as starred'}">
                            <svg class="draft-star-icon" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
                                <polygon points="50,4 61,36 96,40 70,62 78,96 50,78 22,96 30,62 4,40 39,36"></polygon>
                            </svg>
                        </button>
                        ${owner ? ` <span class="r-owner">→ ${owner}</span>` : ''}
                    </span>
                    <span class="r-av">AV $${player.avgValue}</span>
                </div>
            `;
        }).join('');

        list.querySelectorAll('.draft-star-btn').forEach((button) => {
            button.addEventListener('click', (event) => {
                event.stopPropagation();
                const row = button.closest('.draftroom-rankings-item');
                const playerName = row ? row.dataset.playerName : '';
                toggleDraftStarredPlayer(playerName);
            });
        });
    }

    function setupDraftRoomRankingsTabs() {
        const tabs = document.querySelectorAll('.draftroom-rankings-tab');
        if (!tabs || tabs.length === 0) return;

        tabs.forEach(t => t.classList.toggle('active', t.dataset.rankingsMode === draftRoomRankingsMode));

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                draftRoomRankingsMode = tab.dataset.rankingsMode === 'default' ? 'default' : 'personal';
                try {
                    localStorage.setItem(DRAFTROOM_RANKINGS_MODE_KEY, draftRoomRankingsMode);
                } catch (e) {
                    // ignore
                }
                tabs.forEach(t => t.classList.toggle('active', t === tab));
                renderDraftRoomRankings();
            });
        });
    }

    function setupDraftRoomRankingsPositionTabs() {
        const tabs = document.querySelectorAll('.draftroom-rankings-pos-tab');
        if (!tabs || tabs.length === 0) return;

        tabs.forEach(t => t.classList.toggle('active', t.dataset.rankingsPos === draftRoomRankingsPosition));

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                draftRoomRankingsPosition = tab.dataset.rankingsPos || 'ALL';
                tabs.forEach(t => t.classList.toggle('active', t === tab));
                renderDraftRoomRankings();
            });
        });
    }

    function setupRightViewTabs() {
        const tabs = document.querySelectorAll('.right-view-tab');
        if (!tabs || tabs.length === 0) return;

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                draftRoomRightViewMode = tab.dataset.rightView === 'rankings' ? 'rankings' : 'budgets';
                try {
                    localStorage.setItem(DRAFTROOM_RIGHT_VIEW_KEY, draftRoomRightViewMode);
                } catch (e) {
                    // ignore
                }
                applyRightViewMode();
            });
        });
    }

    function applyRightViewMode() {
        const budgetsView = document.getElementById('right-budgets-view');
        const rankingsView = document.getElementById('right-rankings-view');
        const tabs = document.querySelectorAll('.right-view-tab');
        const showBudgets = draftRoomRightViewMode === 'budgets';
        const showRankings = draftRoomRightViewMode === 'rankings';

        tabs.forEach(tab => {
            tab.classList.toggle('active', tab.dataset.rightView === draftRoomRightViewMode);
        });

        if (budgetsView) {
            budgetsView.hidden = !showBudgets;
            budgetsView.classList.toggle('right-view-hidden', !showBudgets);
            budgetsView.style.display = showBudgets ? 'block' : 'none';
        }
        if (rankingsView) {
            rankingsView.hidden = !showRankings;
            rankingsView.classList.toggle('right-view-hidden', !showRankings);
            rankingsView.style.display = showRankings ? 'flex' : 'none';
        }

        if (showRankings) {
            renderDraftRoomRankings();
        }
    }

    // Update UI
    function updateUI(roundPlayers) {
        // Only reset to page 1 when round players actually change (new round)
        const isNewRound = !window.currentRoundPlayers || 
                          !roundPlayers || 
                          roundPlayers.length === 0 || 
                          JSON.stringify(roundPlayers.map(p => p.id).sort()) !== JSON.stringify(window.currentRoundPlayers.map(p => p.id).sort());
        
        if (isNewRound) {
            currentPage = 1;
            window.currentRoundPlayers = roundPlayers ? [...roundPlayers] : null;
            // Store page groupings for results display
            window.page1Players = roundPlayers ? roundPlayers.slice(0, 12) : [];
            window.page2Players = roundPlayers ? roundPlayers.slice(12, 24) : [];
            // Clear stored bids for new round
            storedBids = {};
        }

        renderRosterRequirementsSummary();

        // Players list with pagination
        const playerList = document.getElementById('players-list');
        if (playerList) {
            // Add fade transition to player list
            playerList.style.transition = 'opacity 0.3s ease-in-out';
            playerList.style.opacity = '0';

            const yourTeam = teams.find(t => t.name === username);
            const playersPerPage = 12;
            let currentPlayers = [];

            if (currentPage === 1) {
                // Page 1: show first 12 round players
                currentPlayers = roundPlayers.slice(0, 12);
            } else {
                // Page 2: show the stored page 2 players (not newly generated ones)
                currentPlayers = window.page2Players || [];
            }

            playerList.innerHTML = '';

            let pageButton = document.getElementById('page-switch-btn');
            if (!pageButton) {
                pageButton = document.createElement('button');
                pageButton.id = 'page-switch-btn';
            }

            pageButton.textContent = `Page ${currentPage}/2 - Switch`;
            pageButton.style.cssText = 'padding:8px 12px;background:#3498db;color:white;border:none;border-radius:8px;cursor:pointer;font-size:14px;font-weight:bold;z-index:1000;position:relative;white-space:nowrap;';
            pageButton.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('[silentdraft] Page switch button clicked, switching from page', currentPage);
                
                // Add fade out animation before switching
                playerList.style.opacity = '0';
                
                setTimeout(() => {
                    currentPage = currentPage === 1 ? 2 : 1;
                    updateUI(roundPlayers); // Re-render with new page
                }, 150);
            };

            const leftColumn = document.getElementById('left-column');
            const playersTitle = leftColumn ? leftColumn.querySelector('h2') : null;
            let playersHeaderRow = document.getElementById('draftable-players-header-row');

            if (leftColumn && playersTitle) {
                if (!playersHeaderRow) {
                    playersHeaderRow = document.createElement('div');
                    playersHeaderRow.id = 'draftable-players-header-row';
                    playersHeaderRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px;';
                    leftColumn.insertBefore(playersHeaderRow, playersTitle);
                    playersHeaderRow.appendChild(playersTitle);
                }

                if (pageButton.parentElement !== playersHeaderRow) {
                    playersHeaderRow.appendChild(pageButton);
                }
            }

            currentPlayers.forEach((player, index) => {
                const card = document.createElement('div');
                card.classList.add('player-card');
                const livePlayerState = players.find(p => p.id === player.id) || player;
                const playerOwner = livePlayerState && livePlayerState.owner ? livePlayerState.owner : '';
                if (playerOwner) {
                    card.classList.add(isCurrentUserTeamName(playerOwner) ? 'user-owned-card' : 'drafted-card');
                }
                card.style.cssText = 'opacity: 0; transform: translateY(10px); transition: all 0.3s ease-out; transition-delay: ' + (index * 50) + 'ms;';

                const playerName = player.name || 'Unknown Player';
                const playerPosition = player.position || 'UNK';
                const playerTeam = player.team || 'UNK';
                const playerValue = player.value || 0;
                const ownershipBadge = playerOwner
                    ? `<div class="player-card-status ${isCurrentUserTeamName(playerOwner) ? 'player-card-status-user' : 'player-card-status-other'}">${isCurrentUserTeamName(playerOwner) ? 'Won by you' : `Won by ${playerOwner}`}</div>`
                    : '';

                card.innerHTML = `
                    <div>
                        <p><span style="font-weight: bold; font-size: 20px; background: #3498db; color: white; padding: 4px 8px; border-radius: 4px; margin-right: 8px; display: inline-block;">${playerPosition}</span> <span style="font-size: 15px;">${playerName}</span> (<span style="font-weight: bold;">${playerTeam}</span>)</p>
                        ${ownershipBadge}
                    </div>
                    <input type="number" placeholder="Your bid" data-player-id="${player.id}" 
                           style="width:80px;padding:4px;border:1px solid #ddd;border-radius:4px;font-size:14px;" 
                           min="0" max="${yourTeam ? yourTeam.budget : 200}" 
                           value="${storedBids[player.id] || ''}">
                `;

                playerList.appendChild(card);
            });

            // Trigger fade-in animation after a short delay
            setTimeout(() => {
                playerList.style.opacity = '1';
                const cards = playerList.querySelectorAll('.player-card');
                cards.forEach(card => {
                    card.style.opacity = '1';
                    card.style.transform = 'translateY(0)';
                });
            }, 50);

            // Add typing sound effect and bid storage to all bid inputs
            const playTypingSound = () => {
                try {
                    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                    const oscillator = audioContext.createOscillator();
                    const gainNode = audioContext.createGain();

                    oscillator.connect(gainNode);
                    gainNode.connect(audioContext.destination);

                    // Quick, subtle click sound
                    oscillator.frequency.value = 1200 + Math.random() * 200; // Slight pitch variation
                    oscillator.type = 'sine';

                    gainNode.gain.setValueAtTime(0.05, audioContext.currentTime); // Very quiet
                    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.05);

                    oscillator.start(audioContext.currentTime);
                    oscillator.stop(audioContext.currentTime + 0.05);
                } catch (e) {
                    // Silently fail if audio not supported
                }
            };

            // Attach sound and bid storage to all bid inputs
            document.querySelectorAll('input[data-player-id]').forEach(input => {
                input.addEventListener('input', playTypingSound);
                input.addEventListener('input', (e) => {
                    const playerId = parseInt(e.target.dataset.playerId);
                    storedBids[playerId] = e.target.value;
                    
                    // Update bid counter
                    updateBidCounter();
                    
                    // Check for overbid
                    const bidAmount = parseInt(e.target.value) || 0;
                    const yourTeam = teams.find(t => t.name === username);
                    if (yourTeam && bidAmount > yourTeam.budget) {
                        e.target.classList.add('overbid');
                    } else {
                        e.target.classList.remove('overbid');
                    }
                });
            });

            // Initial update of bid counter
            updateBidCounter();
        }

        // Submit Bids button
        const submitBidsButton = document.getElementById('submit-bids');
        if (submitBidsButton) {
            submitBidsButton.disabled = teams.find(t => t.name === username).roster.length >= rosterSize;
            submitBidsButton.onclick = () => {
                const yourTeam = teams.find(t => t.name === username);
                if (!yourTeam) return;
                
                // First, collect and send all bids to server
                const roundPlayers = getRoundPlayers();
                const bidPromises = [];
                
                roundPlayers.forEach(player => {
                    // Use stored bids instead of DOM inputs, since not all players may be visible
                    let bidAmount = storedBids[player.id] ? parseInt(storedBids[player.id]) : 0;
                    
                    if (isNaN(bidAmount) || bidAmount < 0) bidAmount = 0;
                    
                    // Always send current state so cleared inputs remove stale server bids.
                    if (window.draftSocket && currentDraftCode) {
                        const promise = new Promise((resolve) => {
                            window.draftSocket.emit('placeBid', currentDraftCode, player.id, bidAmount, (response) => {
                                if (response && response.ok) {
                                    console.log(`[silentdraft] Bid sent: ${player.name} = $${bidAmount}`);
                                }
                                resolve();
                            });
                        });
                        bidPromises.push(promise);
                    }
                });
                
                // Wait for all bids to be sent, then notify submission complete
                Promise.all(bidPromises).then(() => {
                    if (window.draftSocket && currentDraftCode) {
                        window.draftSocket.emit('submitBids', currentDraftCode, username, autoDraftEnabled, (response) => {
                            if (response && response.ok) {
                                console.log('[silentdraft] All bids submitted and recorded');
                                
                                // Play success sound
                                try {
                                    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                                    const oscillator1 = audioContext.createOscillator();
                                    const oscillator2 = audioContext.createOscillator();
                                    const gainNode = audioContext.createGain();
                                    
                                    oscillator1.connect(gainNode);
                                    oscillator2.connect(gainNode);
                                    gainNode.connect(audioContext.destination);
                                    
                                    // Two-tone success chime
                                    oscillator1.frequency.value = 800;
                                    oscillator2.frequency.value = 1000;
                                    oscillator1.type = 'sine';
                                    oscillator2.type = 'sine';
                                    
                                    gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
                                    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
                                    
                                    oscillator1.start(audioContext.currentTime);
                                    oscillator2.start(audioContext.currentTime + 0.1);
                                    oscillator1.stop(audioContext.currentTime + 0.3);
                                    oscillator2.stop(audioContext.currentTime + 0.4);
                                } catch (e) {
                                    console.log('[silentdraft] Audio not supported');
                                }
                                
                                submitBidsButton.disabled = true;
                                submitBidsButton.textContent = 'Bids Submitted';
                            }
                        });
                    }
                });
            };
        }

        // Budget
        const budgetElem = document.getElementById('your-budget');
        if (budgetElem) {
            budgetElem.textContent = teams.find(t => t.name === username).budget.toString();
        }

        // Teams list
        const teamsList = document.getElementById('teams-list');
        if (teamsList) {
            teamsList.innerHTML = '';
            teams.forEach(team => {
                // Skip user's own team (shown in center column)
                if (team.name === username) return;
                
                const teamItem = document.createElement('li');
                teamItem.style.cssText = 'cursor:pointer;padding:10px 14px;margin:6px 0;background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:8px;transition:all 0.2s ease;font-size:14px;';
                teamItem.dataset.teamName = team.name;
                
                // Header with arrow
                const header = document.createElement('div');
                header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;';
                header.innerHTML = `
                    <span>${team.name} - $${team.budget} (${team.roster.length}/${rosterSize}) ${autoDraftStatusByTeam[team.name] ? '<span style="display:inline-block;margin-left:8px;padding:1px 6px;border-radius:999px;font-size:11px;font-weight:700;background:rgba(59,130,246,0.2);border:1px solid rgba(59,130,246,0.5);color:#93c5fd;">AUTO</span>' : ''}</span>
                    <span class="dropdown-arrow" style="font-size:12px;transition:transform 0.2s;">▼</span>
                `;
                teamItem.appendChild(header);
                
                // Roster container (initially hidden)
                const rosterDiv = document.createElement('div');
                rosterDiv.className = 'team-roster';
                rosterDiv.style.cssText = 'display:none;margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.1);';
                
                if (team.roster.length > 0) {
                    const assigned = assignRosterToSlots(team.roster);
                    rosterDiv.innerHTML = assigned.assignedSlots.map(slot => (
                        `<div style="margin-top: 4px; display: flex; align-items: center; font-size: 12px;"><b style="font-size: 14px;">${slot.label}</b>: ${slot.player ? `${slot.player.name} - $${slot.player.bid}` : ''}</div>`
                    )).join('');

                    // Bench players (everyone not in starters), sorted by prerank
                    const bench = assigned.bench;
                    if (bench.length > 0) {
                        rosterDiv.innerHTML += '<div style="margin-top: 8px; padding-top: 4px; border-top: 1px solid rgba(255,255,255,0.1);"><b style="font-size: 14px;">Bench:</b></div>';
                        bench.forEach(p => {
                            const benchLine = document.createElement('div');
                            benchLine.style.cssText = 'display:flex;align-items:center;margin:2px 0;font-size:11px;color:#9aa0a6;';
                            benchLine.innerHTML = `<span style="font-weight: bold; font-size: 12px; background: #3498db; color: white; padding: 1px 4px; border-radius: 2px; margin-right: 4px; display: inline-block;">${p.position}</span> <span style="font-size: 12px;">${p.name}</span> - $${p.bid}`;
                            rosterDiv.appendChild(benchLine);
                        });
                    }
                } else {
                    rosterDiv.innerHTML = '<div style="font-size:12px;color:#9aa0a6;font-style:italic;">No players yet</div>';
                }
                
                teamItem.appendChild(rosterDiv);
                
                // Toggle on click
                header.addEventListener('click', () => {
                    const isOpen = rosterDiv.style.display === 'block';
                    const arrow = header.querySelector('.dropdown-arrow');
                    
                    // Close all other team rosters
                    document.querySelectorAll('.team-roster').forEach(r => r.style.display = 'none');
                    document.querySelectorAll('.dropdown-arrow').forEach(a => a.style.transform = 'rotate(0deg)');
                    
                    // Toggle this one
                    if (!isOpen) {
                        rosterDiv.style.display = 'block';
                        arrow.style.transform = 'rotate(180deg)';
                    }
                });
                
                teamsList.appendChild(teamItem);
            });
        }

        // Round info
        const currentRoundElem = document.getElementById('current-round');
        if (currentRoundElem) {
            currentRoundElem.textContent = `Round ${currentRound}/${totalRounds}`;
        }


        // Your team roster (starters: first 6 + 1 Flex)
        const yourTeamElem = document.getElementById('your-team');
        const team = teams.find(t => t.name === username);
        
        // Update team header with username
        const teamHeader = document.getElementById('team-header');
        if (teamHeader) teamHeader.textContent = username;
        let benchPlayersForDisplay = [];
        
        if (yourTeamElem && team) {
            const assigned = assignRosterToSlots(team.roster);
            benchPlayersForDisplay = assigned.bench;

            // Build HTML for each slot
            yourTeamElem.innerHTML = assigned.assignedSlots
                .map(slot => buildRosterSlotRow(slot.label, slot.player))
                .join('');

            // Bench players (everyone not in starters)
            const benchPlayers = document.getElementById('bench-players');
            if (benchPlayers) {
                benchPlayers.innerHTML = benchPlayersForDisplay.length > 0
                    ? benchPlayersForDisplay.map(buildBenchPlayerRow).join('')
                    : '<p class="bench-empty-state">Your bench lineup will be displayed here.</p>';
            }
        } else if (yourTeamElem) {
            yourTeamElem.innerHTML = '<p class="bench-empty-state">Your team lineup will be displayed here.</p>';
        }

        // Bench players display (only if we have the element and team)
        const benchPlayers = document.getElementById('bench-players');
        if (benchPlayers && team && team.roster.length > 0) {
            benchPlayers.innerHTML = benchPlayersForDisplay.length > 0
                ? benchPlayersForDisplay.map(buildBenchPlayerRow).join('')
                : '<p class="bench-empty-state">Your bench lineup will be displayed here.</p>';
        } else if (benchPlayers) {
            benchPlayers.innerHTML = '<p class="bench-empty-state">Your bench lineup will be displayed here.</p>';
        }

        renderDraftRoomRankings();

        // Sync draft state to localStorage for My Rankings page
        saveDraftStateForRankings();
    }

    // Persist a snapshot of live draft state so the Rankings page can poll it
    function saveDraftStateForRankings() {
        try {
            const draftedPlayers = {};
            const passedPlayers  = [];
            players.forEach(p => {
                if (p.owner)      draftedPlayers[p.name] = p.owner;
                else if (p.shown) passedPlayers.push(p.name);
            });
            const userTeam   = teams.find(t => t.name === username);
            const userRoster = userTeam ? userTeam.roster.map(p => p.name) : [];
            const currentRoundNames = (window.currentRoundPlayers || window.syncedRoundPlayers || []).map(p => p.name);
            localStorage.setItem('rankingsDraftState', JSON.stringify({
                draftCode: currentDraftCode,
                currentRound,
                currentRoundPlayers: currentRoundNames,
                draftedPlayers,
                userRoster,
                passedPlayers
            }));
        } catch (e) { /* ignore */ }
    }

    // Process bids for a single player
    function placeBid(player, bidValue, team) {
        if (!bidValue || bidValue <= player.bid || bidValue > team.budget) {
            return false;
        }
        if (!isValidRosterAddition(team, player)) {
            return false;
        }
        player.bid = bidValue;
        team.budget -= bidValue;
        player.owner = team.name;
        team.roster.push(player);
        
        // Sort roster by position priority, then by prerank within position
        const positionOrder = { QB: 1, RB: 2, WR: 3, TE: 4, K: 5, DEF: 6 };
        team.roster.sort((a, b) => {
            const posA = positionOrder[a.position] || 99;
            const posB = positionOrder[b.position] || 99;
            if (posA !== posB) {
                return posA - posB;
            }
            return a.positionRank - b.positionRank;
        });
        
        return true;
    }

    // Helper function to get bid range key
    function getRangeKey(avgValue) {
        if (avgValue <= 5) return '1-5';
        if (avgValue <= 10) return '5-10';
        if (avgValue <= 20) return '10-20';
        if (avgValue <= 30) return '20-30';
        if (avgValue <= 40) return '30-40';
        if (avgValue <= 50) return '40-50';
        if (avgValue <= 60) return '50-60';
        return '60+';
    }

    // Helper function to get bid range for a position and value
    function getBidRange(position, avgValue, useServerRanges = false) {
        const ranges = useServerRanges ? serverSilentAuctionBidRanges : silentAuctionBidRanges;
        const rangeKey = getRangeKey(avgValue);
        return ranges[position]?.[rangeKey] || { min: 0.5, max: 1.5 };
    }

    // Bid ranges for silent auctions (client-side)
    const silentAuctionBidRanges = {
        QB: {
            '1-5': { min: 0.4, max: 1.65 },
            '5-10': { min: 0.5, max: 1.45 },
            '10-20': { min: 0.55, max: 1.35 },
            '20-30': { min: 0.6, max: 1.30 },
            '30-40': { min: 0.85, max: 1.15 },
            '40-50': { min: 0.9, max: 1.1 },
            '50-60': { min: 0.95, max: 1.05 },
            '60+': { min: 0.98, max: 1.02 }
        },
        RB: {
            '1-5': { min: 0.5, max: 1.55 },
            '5-10': { min: 0.6, max: 1.45 },
            '10-20': { min: 0.6, max: 1.4 },
            '20-30': { min: 0.7, max: 1.35 },
            '30-40': { min: 0.8, max: 1.25 },
            '40-50': { min: 0.9, max: 1.15 },
            '50-60': { min: 0.92, max: 1.15 },
            '60+': { min: 0.95, max: 1.08 }
        },
        WR: {
            '1-5': { min: 0.5, max: 1.55 },
            '5-10': { min: 0.6, max: 1.45 },
            '10-20': { min: 0.6, max: 1.4 },
            '20-30': { min: 0.7, max: 1.35 },
            '30-40': { min: 0.8, max: 1.25 },
            '40-50': { min: 0.9, max: 1.15 },
            '50-60': { min: 0.92, max: 1.15 },
            '60+': { min: 0.95, max: 1.08 }
        },
        TE: {
            '1-5': { min: 0.5, max: 1.55 },
            '5-10': { min: 0.6, max: 1.45 },
            '10-20': { min: 0.6, max: 1.4 },
            '20-30': { min: 0.7, max: 1.35 },
            '30-40': { min: 0.8, max: 1.25 },
            '40-50': { min: 0.9, max: 1.15 },
            '50-60': { min: 0.92, max: 1.15 },
            '60+': { min: 0.95, max: 1.08 }
        },
        K: {
            '1-5': { min: 0.3, max: 1.8 },
            '5-10': { min: 0.4, max: 1.6 },
            '10-20': { min: 0.5, max: 1.4 },
            '20-30': { min: 0.6, max: 1.3 },
            '30-40': { min: 0.7, max: 1.2 },
            '40-50': { min: 0.8, max: 1.1 },
            '50-60': { min: 0.85, max: 1.05 },
            '60+': { min: 0.9, max: 1.0 }
        },
        DEF: {
            '1-5': { min: 0.3, max: 1.8 },
            '5-10': { min: 0.4, max: 1.6 },
            '10-20': { min: 0.5, max: 1.4 },
            '20-30': { min: 0.6, max: 1.3 },
            '30-40': { min: 0.7, max: 1.2 },
            '40-50': { min: 0.8, max: 1.1 },
            '50-60': { min: 0.85, max: 1.05 },
            '60+': { min: 0.9, max: 1.0 }
        }
    };

    // Build a live tier snapshot from remaining players (excluding drafted and passed players).
    // Current round players are still considered available in the snapshot.
    function buildCpuTierContext(roundPlayers = []) {
        const roundPlayerIds = new Set((roundPlayers || []).map(p => p.id));
        const remaining = players
            .filter(p => !p.owner && (!p.shown || roundPlayerIds.has(p.id)))
            .sort((a, b) => (a.prerank || 9999) - (b.prerank || 9999));

        const total = remaining.length;
        const q1 = Math.max(1, Math.floor(total * 0.25));
        const q2 = Math.max(q1 + 1, Math.floor(total * 0.5));
        const q3 = Math.max(q2 + 1, Math.floor(total * 0.75));

        const tierByPlayerId = new Map();
        const countsByPosTier = {
            QB:  [0, 0, 0, 0],
            RB:  [0, 0, 0, 0],
            WR:  [0, 0, 0, 0],
            TE:  [0, 0, 0, 0],
            K:   [0, 0, 0, 0],
            DEF: [0, 0, 0, 0]
        };

        remaining.forEach((p, index) => {
            let tier = 3;
            if (index < q1) tier = 0;
            else if (index < q2) tier = 1;
            else if (index < q3) tier = 2;
            tierByPlayerId.set(p.id, tier);

            if (countsByPosTier[p.position]) {
                countsByPosTier[p.position][tier] += 1;
            }
        });

        return { tierByPlayerId, countsByPosTier };
    }

    function getCpuTierScarcityBonus(player, tierContext) {
        if (!tierContext || !tierContext.countsByPosTier[player.position]) return 0;

        const tier = tierContext.tierByPlayerId.has(player.id)
            ? tierContext.tierByPlayerId.get(player.id)
            : 3;
        const counts = tierContext.countsByPosTier[player.position];
        const topTwoLeft = counts[0] + counts[1];
        const inTierLeft = counts[tier];

        let bonus = 0;
        if (tier <= 1 && topTwoLeft <= 3) bonus += 12;
        else if (tier <= 1 && topTwoLeft <= 6) bonus += 7;

        if (inTierLeft <= 2) bonus += 6;
        else if (inTierLeft <= 5) bonus += 3;

        return bonus;
    }

    // Client-side CPU bidding for silent auctions
    function generateClientCPUBids(teams, roundPlayers, username, rosterSize, currentRound, totalRounds) {
        // --- Enhanced Independent CPU Bidding ---
        // Each CPU team independently decides which players to bid on, based on roster needs
        let maxRosterSize = rosterSize + 3;
        let cpuTeams = teams.filter(t => t.name !== username && t.roster.length < maxRosterSize);
        let cpuBids = {};
        const tierContext = buildCpuTierContext(roundPlayers);
        // Assign each CPU team a random 'aggressiveness' factor for this round (lowered)
        let cpuAggressiveness = {};
        cpuTeams.forEach((team, idx) => {
            // Aggressiveness: 0.7 to 1.05 (less aggressive overall)
            cpuAggressiveness[team.name] = 0.7 + Math.random() * 0.35;
        });

        // Calculate bestByPos for each team
        cpuTeams.forEach((team, idx) => {
            let bestByPos = {};
            for (let pos of ['QB','RB','WR','TE','K','DEF']) {
                let playersAtPos = team.roster.filter(p => p.position === pos);
                if (playersAtPos.length > 0) {
                    bestByPos[pos] = Math.max(...playersAtPos.map(p => p.avgValue));
                } else {
                    bestByPos[pos] = 0;
                }
            }
            team.bestByPos = bestByPos;
        });

        // For each player
        roundPlayers.forEach(player => {
            if (player.owner) return;
            // Define probability ranges based on avgValue
            const valueRanges = [
                { min: 1, max: 5, minProb: 0.05, maxProb: 0.25 },
                { min: 5, max: 10, minProb: 0.08, maxProb: 0.25 },
                { min: 10, max: 20, minProb: 0.1, maxProb: 0.45 },
                { min: 20, max: 30, minProb: 0.35, maxProb: 0.55 },
                { min: 30, max: 40, minProb: 0.35, maxProb: 0.65 },
                { min: 40, max: 50, minProb: 0.35, maxProb: 0.75 },
                { min: 50, max: 60, minProb: 0.45, maxProb: 0.85 },
                { min: 60, max: Infinity, minProb: 0.5, maxProb: 0.95 }
            ];
            const range = valueRanges.find(r => player.avgValue >= r.min && player.avgValue < r.max) || valueRanges[valueRanges.length - 1];
            const participationRate = range.minProb + Math.random() * (range.maxProb - range.minProb);
            let adjustedParticipationRate = participationRate;
            if (cpuTeams.length === 10 && currentRound % 2 === 1) {
              adjustedParticipationRate += Math.random() < 0.5 ? 0.05 : -0.05;
              adjustedParticipationRate = Math.max(0, Math.min(1, adjustedParticipationRate));
            }
            const numBidders = Math.round(adjustedParticipationRate * cpuTeams.length);
            const draftProgress = currentRound / totalRounds;
            // Collect potential bidders
            let potentialBidders = [];
            cpuTeams.forEach(team => {
                if (!isValidRosterAddition(team, player)) return;
                const bestByPos = team.bestByPos;
                let improve = player.avgValue - bestByPos[player.position];
                if (bestByPos[player.position] > 20 && player.avgValue < 20) improve -= 10;
                if (bestByPos[player.position] > 5 && player.avgValue < 3) improve -= 20;
                if (improve > 0) improve += 5;
                if (bestByPos[player.position] < 10) improve += 10;
                let avgOther = Object.keys(bestByPos).filter(pos => pos !== player.position).reduce((sum, pos) => sum + bestByPos[pos], 0) / 5;
                if (bestByPos[player.position] < avgOther - 10) improve += 5;
                if ((player.position === 'K' || player.position === 'DEF') && bestByPos[player.position] === 0) improve += 8;
                improve += getCpuTierScarcityBonus(player, tierContext);
                if (draftProgress < 0.55 ? bestByPos[player.position] === 0 : (improve > 0 || bestByPos[player.position] === 0)) {
                    potentialBidders.push({team, improve});
                }
            });
            // Sort by improve desc
            potentialBidders.sort((a, b) => b.improve - a.improve);
            // Select top numBidders
            const selected = potentialBidders.slice(0, numBidders);
            // For each selected, calculate bid
            selected.forEach(({team}) => {
                const bestByPos = team.bestByPos;
                let baseBid;
                if (player.position === 'K' || player.position === 'DEF') {
                    baseBid = player.avgValue * (0.75 + Math.random() * 0.4); // 75-115% for K/DEF
                } else {
                    const bidRange = getBidRange(player.position, player.avgValue);
                    baseBid = player.avgValue * (bidRange.min + Math.random() * (bidRange.max - bidRange.min));
                }
                // Special handling for very low value players
                if (player.avgValue <= 1) {
                    baseBid = Math.random() < 0.75 ? 1 : (1 + Math.floor(Math.random() * 4)); // 75% chance $1, 25% chance $1-4
                }
                if (bestByPos[player.position] === 0) baseBid *= 1.2;
                baseBid += getCpuTierScarcityBonus(player, tierContext);
                let numCompetitors = teams.filter(t => t.name !== team.name && t.budget > team.budget && t.roster.filter(p => p.position === player.position).length === 0).length;
                baseBid += numCompetitors * 5;
                const improve = potentialBidders.find(pb => pb.team === team).improve;
                if (improve > 20) baseBid += 10;
                else if (improve > 10) baseBid += 5;
                else if (improve > 0) baseBid += 2;
                if (Math.random() < 0.15) baseBid = Math.min(baseBid, Math.floor(Math.random() * 5) + 1);
                baseBid = Math.round(baseBid * cpuAggressiveness[team.name]);
                baseBid += Math.floor(Math.random() * 2);
                baseBid += Math.floor(Math.random() * 2) * (Math.random() < 0.5 ? 1 : -1);
                // If roster is full, bid low for bench filling
                if (team.roster.length >= rosterSize) {
                    baseBid = Math.floor(Math.random() * 3) + 1;
                }
                baseBid = Math.min(baseBid, team.budget);
                if (baseBid > 0) {
                    if (!cpuBids[team.name]) cpuBids[team.name] = [];
                    cpuBids[team.name].push({ player, cpuBid: baseBid });
                }
            });
        });

        // Log all CPU bids for debugging
        console.log('=== CPU BIDS FOR THIS ROUND ===');
        Object.keys(cpuBids).forEach(cpuName => {
            if (cpuBids[cpuName].length > 0) {
                console.log(`${cpuName}:`);
                cpuBids[cpuName].forEach(bid => {
                    console.log(`  - ${bid.player.name} (${bid.player.position}): $${bid.cpuBid}`);
                });
            } else {
                console.log(`${cpuName}: No bids`);
            }
        });
        console.log('===============================');

        return cpuBids;
    }

    // Submit all bids for the round
    function submitBids(options = {}) {
        const forceAutoSubmit = !!(options && options.forceAutoSubmit);

        if (!autoDraftEnabled && !forceAutoSubmit) {
            const submitBtn = document.getElementById('submit-bids');
            if (submitBtn && typeof submitBtn.onclick === 'function') {
                submitBtn.onclick();
                return;
            }
        }

        const yourTeam = teams.find(t => t.name === username);
        if (yourTeam.roster.length >= rosterSize) {
            alert('Your roster is full!');
            return;
        }

        const roundPlayers = getRoundPlayers();
        let results = [];
        let anyValidBid = false;
        /** @type {Array<{playerId:number, playerName:string, tiedTeams:string[], bidAmount:number}>} */
        const tiedBids = [];

        // --- Enhanced Independent CPU Bidding ---
        // Each CPU team independently decides which players to bid on, based on roster needs
        let maxRosterSize = rosterSize + 3;
        let cpuTeams = teams.filter(t => t.name !== username && t.roster.length < maxRosterSize);
        let cpuBids = {};
        const tierContext = buildCpuTierContext(roundPlayers);
        // Assign each CPU team a random 'aggressiveness' factor for this round (lowered)
        let cpuAggressiveness = {};
        cpuTeams.forEach((team, idx) => {
            // Aggressiveness: 0.7 to 1.05 (less aggressive overall)
            cpuAggressiveness[team.name] = 0.7 + Math.random() * 0.35;
        });

        // Calculate bestByPos for each team
        cpuTeams.forEach((team, idx) => {
            let bestByPos = {};
            for (let pos of ['QB','RB','WR','TE','K','DEF']) {
                let playersAtPos = team.roster.filter(p => p.position === pos);
                if (playersAtPos.length > 0) {
                    bestByPos[pos] = Math.max(...playersAtPos.map(p => p.avgValue));
                } else {
                    bestByPos[pos] = 0;
                }
            }
            team.bestByPos = bestByPos;
        });

        // Define bid ranges by position and value
        const bidRanges = {
            QB: {
                '1-5': { min: 0.65, max: 1.65 },
                '5-10': { min: 0.7, max: 1.45 },
                '10-20': { min: 0.75, max: 1.45 },
                '20-30': { min: 0.8, max: 1.35 },
                '30-40': { min: 0.85, max: 1.25 },
                
            },
            RB: {
                '1-5': { min: 0.65, max: 1.65 },
                '5-10': { min: 0.70, max: 1.65 },
                '10-20': { min: 0.75, max: 1.55 },
                '20-30': { min: 0.75, max: 1.45},
                '30-40': { min: 0.75, max: 1.35 },
                '40-50': { min: 0.75, max: 1.25 },
                '50-60': { min: 0.75, max: 1.15 },
                '60+': { min: 0.75, max: 1.10 }
            },
            WR: {
                '1-5': { min: 0.65, max: 1.65 },
                '5-10': { min: 0.70, max: 1.65 },
                '10-20': { min: 0.75, max: 1.55 },
                '20-30': { min: 0.75, max: 1.45 },
                '30-40': { min: 0.75, max: 1.35 },
                '40-50': { min: 0.75, max: 1.25},
                '50-60': { min: 0.75, max: 1.15 },
                '60+': { min: 0.75, max: 1.10 }
            },
            TE: {
                '1-5': { min: 0.65, max: 1.4 },
                '5-10': { min: 0.65, max: 1.3 },
                '10-20': { min: 0.70, max: 1.2 },
                '20-30': { min: 0.70, max: 1.15 },
                '30-40': { min: 0.70, max: 1.1},
                
            }
        };

        function getRangeKey(avgValue) {
            if (avgValue <= 5) return '1-5';
            if (avgValue <= 10) return '5-10';
            if (avgValue <= 20) return '10-20';
            if (avgValue <= 30) return '20-30';
            if (avgValue <= 40) return '30-40';
            if (avgValue <= 50) return '40-50';
            if (avgValue <= 60) return '50-60';
            return '60+';
        }

        // For each player
        roundPlayers.forEach(player => {
            if (player.owner) return;
            // Define probability ranges based on avgValue
            const valueRanges = [
                { min: 1, max: 5, minProb: 0.05, maxProb: 0.25 },
                { min: 5, max: 10, minProb: 0.08, maxProb: 0.25 },
                { min: 10, max: 20, minProb: 0.1, maxProb: 0.45 },
                { min: 20, max: 30, minProb: 0.35, maxProb: 0.55 },
                { min: 30, max: 40, minProb: 0.35, maxProb: 0.65 },
                { min: 40, max: 50, minProb: 0.35, maxProb: 0.75 },
                { min: 50, max: 60, minProb: 0.45, maxProb: 0.85 },
                { min: 60, max: Infinity, minProb: 0.5, maxProb: 0.95 }
            ];
            const range = valueRanges.find(r => player.avgValue >= r.min && player.avgValue < r.max) || valueRanges[valueRanges.length - 1];
            const participationRate = range.minProb + Math.random() * (range.maxProb - range.minProb);
            let adjustedParticipationRate = participationRate;
            if (cpuTeams.length === 10 && currentRound % 2 === 1) {
              adjustedParticipationRate += Math.random() < 0.5 ? 0.05 : -0.05;
              adjustedParticipationRate = Math.max(0, Math.min(1, adjustedParticipationRate));
            }
            const numBidders = Math.round(adjustedParticipationRate * cpuTeams.length);
            const draftProgress = currentRound / totalRounds;
            // Collect potential bidders
            let potentialBidders = [];
            cpuTeams.forEach(team => {
                if (!isValidRosterAddition(team, player)) return;
                const bestByPos = team.bestByPos;
                let improve = player.avgValue - bestByPos[player.position];
                if (bestByPos[player.position] > 20 && player.avgValue < 20) improve -= 10;
                if (bestByPos[player.position] > 5 && player.avgValue < 3) improve -= 20;
                if (improve > 0) improve += 5;
                if (bestByPos[player.position] < 10) improve += 10;
                let avgOther = Object.keys(bestByPos).filter(pos => pos !== player.position).reduce((sum, pos) => sum + bestByPos[pos], 0) / 5;
                if (bestByPos[player.position] < avgOther - 10) improve += 5;
                if ((player.position === 'K' || player.position === 'DEF') && bestByPos[player.position] === 0) improve += 8;
                improve += getCpuTierScarcityBonus(player, tierContext);
                if (draftProgress < 0.55 ? bestByPos[player.position] === 0 : (improve > 0 || bestByPos[player.position] === 0)) {
                    potentialBidders.push({team, improve});
                }
            });
            // Sort by improve desc
            potentialBidders.sort((a, b) => b.improve - a.improve);
            // Select top numBidders
            const selected = potentialBidders.slice(0, numBidders);
            // For each selected, calculate bid
            selected.forEach(({team}) => {
                const bestByPos = team.bestByPos;
                let baseBid;
                if (player.position === 'K' || player.position === 'DEF') {
                    baseBid = player.avgValue * (0.75 + Math.random() * 0.4); // 75-115% for K/DEF
                } else {
                    const rangeKey = getRangeKey(player.avgValue);
                    const bidRange = bidRanges[player.position][rangeKey];
                    baseBid = player.avgValue * (bidRange.min + Math.random() * (bidRange.max - bidRange.min));
                }
                // Special handling for very low value players
                if (player.avgValue <= 1) {
                    baseBid = Math.random() < 0.75 ? 1 : (1 + Math.floor(Math.random() * 4)); // 75% chance $1, 25% chance $1-4
                }
                if (bestByPos[player.position] === 0) baseBid *= 1.2;
                baseBid += getCpuTierScarcityBonus(player, tierContext);
                let numCompetitors = teams.filter(t => t.name !== team.name && t.budget > team.budget && t.roster.filter(p => p.position === player.position).length === 0).length;
                baseBid += numCompetitors * 5;
                const improve = potentialBidders.find(pb => pb.team === team).improve;
                if (improve > 20) baseBid += 10;
                else if (improve > 10) baseBid += 5;
                else if (improve > 0) baseBid += 2;
                if (Math.random() < 0.15) baseBid = Math.min(baseBid, Math.floor(Math.random() * 5) + 1);
                baseBid = Math.round(baseBid * cpuAggressiveness[team.name]);
                baseBid += Math.floor(Math.random() * 2);
                baseBid += Math.floor(Math.random() * 2) * (Math.random() < 0.5 ? 1 : -1);
                // If roster is full, bid low for bench filling
                if (team.roster.length >= rosterSize) {
                    baseBid = Math.floor(Math.random() * 3) + 1;
                }
                baseBid = Math.min(baseBid, team.budget);
                if (baseBid > 0) {
                    if (!cpuBids[team.name]) cpuBids[team.name] = [];
                    cpuBids[team.name].push({ player, cpuBid: baseBid });
                }
            });
        });

        // Log all CPU bids for debugging
        console.log('=== CPU BIDS FOR THIS ROUND ===');
        Object.keys(cpuBids).forEach(cpuName => {
            if (cpuBids[cpuName].length > 0) {
                console.log(`${cpuName}:`);
                cpuBids[cpuName].forEach(bid => {
                    console.log(`  - ${bid.player.name} (${bid.player.position}): $${bid.cpuBid}`);
                });
            } else {
                console.log(`${cpuName}: No bids`);
            }
        });
        console.log('===============================');

        // --- Gather all bids for each player (user + all CPU teams) ---
        roundPlayers.forEach(player => {
            if (player.owner) return; // Already assigned

            // Use stored bids instead of DOM queries since not all players may be visible
            let userBid = storedBids[player.id] ? parseInt(storedBids[player.id]) : 0;
            if (isNaN(userBid) || userBid < 0) userBid = 0;

            // Clear any existing error displays for this player if input is visible
            const bidInput = document.querySelector(`input[data-player-id="${player.id}"]`);
            const errorElem = bidInput ? bidInput.parentElement.querySelector('.bid-error') : null;
            if (errorElem) errorElem.style.display = 'none';

            // Validate user bid
            if (userBid > 0) {
                if (userBid <= player.bid) {
                    if (errorElem) {
                        errorElem.textContent = 'Bid must be higher than current.';
                        errorElem.style.display = 'inline';
                    }
                    results.push(`Invalid bid for ${player.name}: Bid must be higher than current ($${player.bid}).`);
                    return;
                }
                if (userBid > yourTeam.budget) {
                    if (errorElem) {
                        errorElem.textContent = 'Bid exceeds your budget.';
                        errorElem.style.display = 'inline';
                    }
                    results.push(`Invalid bid for ${player.name}: Bid exceeds your budget ($${yourTeam.budget}).`);
                    return;
                }
                if (!isValidRosterAddition(yourTeam, player)) {
                    if (errorElem) {
                        errorElem.textContent = 'Roster limit reached for this position.';
                        errorElem.style.display = 'inline';
                    }
                    results.push(`Invalid bid for ${player.name}: Roster limit reached for ${player.position}.`);
                    return;
                }
                
                // Emit bid to server for synchronization
                if (window.draftSocket && currentDraftCode) {
                    window.draftSocket.emit('placeBid', currentDraftCode, player.id, userBid, (response) => {
                        if (response && response.ok) {
                            console.log('[silentdraft] Bid synchronized:', player.name, userBid);
                        }
                    });
                }
            } else if (window.draftSocket && currentDraftCode) {
                window.draftSocket.emit('placeBid', currentDraftCode, player.id, 0, () => {});
            }
// Simulate CPU bidding
const otherTeams = teams.filter(t => t.name !== username && t.roster.length < rosterSize && isValidRosterAddition(t, player));
            const prioritizedTeams = otherTeams.filter(t => {
                const counts = t.roster.reduce((c, p) => {
                    c[p.position] = (c[p.position] || 0) + 1;
                    return c;
                }, {});
                const flexEligibleCount = (counts.RB || 0) + (counts.WR || 0) + (counts.TE || 0);
                return (
                    (player.position === 'QB' && (counts.QB || 0) < rosterLimits.QB.min) ||
                    (player.position === 'RB' && (counts.RB || 0) < rosterLimits.RB.min) ||
                    (player.position === 'WR' && (counts.WR || 0) < rosterLimits.WR.min) ||
                    (player.position === 'TE' && (counts.TE || 0) < rosterLimits.TE.min) ||
                    (player.position === 'K' && (counts.K || 0) < rosterLimits.K.min) ||
                    (player.position === 'DEF' && (counts.DEF || 0) < rosterLimits.DEF.min) ||
                    (flexPositions.includes(player.position) && flexEligibleCount < (rosterLimits.RB.min + rosterLimits.WR.min + rosterLimits.TE.min + getFlexRequirementCount()))
                );
            });
            const biddingTeam = prioritizedTeams.length > 0
                ? prioritizedTeams[Math.floor(Math.random() * prioritizedTeams.length)]
                : otherTeams[Math.floor(Math.random() * otherTeams.length)];
            let cpuBid = 0;
            let cpuWantsToBid = true;

            // Top 5 QBs: $15-35
            // --- Position-based price curve for fallback CPU bidding ---
            const priceBands = {
                QB:   { top: 5,   min: 15, max: 35 },
                RB:   { top: 10,  min: 35, max: 65 },
                WR:   { top: 10,  min: 35, max: 65 },
                TE:   { top: 3,   min: 15, max: 30 },
                K:    { top: 5,   min: 1,  max: 5  },
                DEF:  { top: 5,   min: 1,  max: 5  }
            };
            let band = priceBands[player.position] || { top: 10, min: 2, max: 10 };
            let allAtPos = players.filter(p => p.position === player.position);
            let sortedAtPos = allAtPos.sort((a, b) => a.prerank - b.prerank);
            let posRank = sortedAtPos.findIndex(p => p.id === player.id) + 1;
            let relRank = Math.min(posRank, band.top);
            let baseBid = Math.round(band.max - ((band.max - band.min) * (relRank - 1) / (band.top - 1)));

            // Overall fallback: Top 50 overall: $10-25, 51-100: $4-10, 101-200: $2-6 (60%), 201+: $1-3 (20%)
            if (player.prerank <= 50) baseBid = Math.max(baseBid, Math.floor(Math.random() * 16) + 10);
            else if (player.prerank <= 100) baseBid = Math.max(baseBid, Math.floor(Math.random() * 7) + 4);
            else if (player.prerank <= 200) {
                cpuWantsToBid = Math.random() < 0.6;
                baseBid = Math.max(baseBid, Math.floor(Math.random() * 5) + 2);
            } else {
                cpuWantsToBid = Math.random() < 0.2;
                baseBid = Math.max(baseBid, Math.floor(Math.random() * 3) + 1);
            }

            // Budget management: scale bid if team is running low
            let picksLeft = rosterSize - biddingTeam.roster.length;
            let budgetPerPick = biddingTeam.budget / Math.max(1, picksLeft);
            if (baseBid > budgetPerPick * 1.5) {
                baseBid = Math.max(Math.round(budgetPerPick * (1.1 + Math.random() * 0.2)), band.min);
            }

            // Calculate max willing to pay: $5-6 more than current tied price, adjusted for AV and roster needs
            let maxWillingToPay = player.bid + 5 + Math.floor(Math.random() * 2); // $5-6 over current bid
            if (player.avgValue > 15) maxWillingToPay += Math.floor(player.avgValue * 0.2); // Bonus for high AV players
            if (player.avgValue > 25) maxWillingToPay += Math.floor(player.avgValue * 0.1); // Extra for elite players
            
            // Adjust based on remaining roster spots
            if (picksLeft > 5) {
                maxWillingToPay = Math.min(maxWillingToPay, biddingTeam.budget * 0.6); // More conservative with many spots left
            } else if (picksLeft <= 2) {
                maxWillingToPay = Math.min(maxWillingToPay, biddingTeam.budget * 0.9); // More aggressive when nearly done
            }
            
            maxWillingToPay = Math.min(maxWillingToPay, biddingTeam.budget); // Cap at budget
            baseBid = Math.min(baseBid, maxWillingToPay); // Don't exceed max willing to pay

            // CPU may skip top player to save budget for balance
            if (posRank === 1 && Math.random() < 0.25) cpuWantsToBid = false;

            // Add small random noise
            baseBid += Math.floor(Math.random() * 2);
            baseBid += Math.floor(Math.random() * 2) * (Math.random() < 0.5 ? 1 : -1);
            baseBid = Math.max(band.min, baseBid);
            baseBid = Math.min(baseBid, biddingTeam.budget);
            cpuBid = baseBid;

            // Only bid if CPU wants to bid and has enough budget and bid is higher than current
            if (!cpuWantsToBid || !biddingTeam || cpuBid <= player.bid || cpuBid > biddingTeam.budget) {
                cpuBid = 0;
            }

            // Gather all bids (user + CPU teams)
            let bids = [];
            if (userBid > 0) bids.push({ team: yourTeam, amount: userBid });
            Object.keys(cpuBids).forEach(cpuName => {
                let cpuTeam = teams.find(t => t.name === cpuName);
                let cpuBidObj = cpuBids[cpuName].find(b => b.player === player);
                if (cpuBidObj && cpuTeam && cpuBidObj.cpuBid <= cpuTeam.budget) {
                    bids.push({ team: cpuTeam, amount: cpuBidObj.cpuBid });
                }
            });

            // Find the highest bid(s)
            let maxBid = Math.max(...bids.map(b => b.amount), 0);
            let topBidders = bids.filter(b => b.amount === maxBid);

            if (topBidders.length === 1 && maxBid > 0) {
                // Single winner
                const winner = topBidders[0].team;
                // Find the second highest bid and team
                let secondHighestBid = 0;
                let secondHighestTeam = null;
                if (bids.length > 1) {
                    // Sort bids descending, skip the winner
                    const sortedBids = [...bids].sort((a, b) => b.amount - a.amount);
                    secondHighestBid = sortedBids[1].amount;
                    secondHighestTeam = sortedBids[1].team.name;
                }
                // Winner pays $1 over second highest, or their own bid if only bidder
                const finalPrice = secondHighestBid > 0 ? Math.min(winner.budget, secondHighestBid + 1) : 1;
                player.bid = finalPrice;
                player.owner = winner.name;
                winner.budget -= finalPrice;
                winner.roster.push(player);
                
                // Sort roster by position priority, then by prerank within position
                const positionOrder = { QB: 1, RB: 2, WR: 3, TE: 4, K: 5, DEF: 6 };
                winner.roster.sort((a, b) => {
                    const posA = positionOrder[a.position] || 99;
                    const posB = positionOrder[b.position] || 99;
                    if (posA !== posB) {
                        return posA - posB;
                    }
                    return a.positionRank - b.positionRank;
                });
                
                results.push(
                    `${winner === yourTeam ? 'You' : winner.name} won ${player.name} for $${finalPrice}!` +
                    (secondHighestBid > 0 ? ` (Second highest: $${secondHighestBid} by ${secondHighestTeam})` : '')
                );
                anyValidBid = true;
            } else if (topBidders.length > 1 && maxBid > 0) {
                // Check if all topBidders are CPUs (not user)
                const allCPUs = topBidders.every(b => b.team.name !== username);
                // Only allow CPU-CPU ties about 20% of the time
                if (!allCPUs || Math.random() < 0.2) {
                    tiedBids.push({
                        playerId: player.id,
                        playerName: player.name,
                        tiedTeams: topBidders.map(b => b.team.name),
                        bidAmount: maxBid
                    });
                    // Don't assign yet
                } else {
                    // If not allowing tie, pick a random CPU winner, but have them pay $1 over the second highest bid
                    const sortedBids = [...bids].sort((a, b) => b.amount - a.amount);
                    const winnerObj = topBidders[Math.floor(Math.random() * topBidders.length)];
                    const winner = winnerObj.team;
                    // Find the second highest bid (skip the winner)
                    let secondHighestBid = 0;
                    let secondHighestTeam = null;
                    if (sortedBids.length > 1) {
                        // Find the first bid that is not the winner
                        for (let i = 0; i < sortedBids.length; i++) {
                            if (sortedBids[i].team.name !== winner.name) {
                                secondHighestBid = sortedBids[i].amount;
                                secondHighestTeam = sortedBids[i].team.name;
                                break;
                            }
                        }
                    }
                    // Winner pays $1 over second highest, or their own bid if only bidder
                    const finalPrice = secondHighestBid > 0 ? Math.min(winner.budget, secondHighestBid + 1) : maxBid;
                    player.bid = finalPrice;
                    player.owner = winner.name;
                    winner.budget -= finalPrice;
                    winner.roster.push(player);
                    
                    // Sort roster by position priority, then by prerank within position
                    const positionOrder = { QB: 1, RB: 2, WR: 3, TE: 4, K: 5, DEF: 6 };
                    winner.roster.sort((a, b) => {
                        const posA = positionOrder[a.position] || 99;
                        const posB = positionOrder[b.position] || 99;
                        if (posA !== posB) {
                            return posA - posB;
                        }
                        return a.positionRank - b.positionRank;
                    });
                    
                    results.push(`${winner.name} won ${player.name} for $${finalPrice}! (Second highest: $${secondHighestBid}${secondHighestTeam ? ' by ' + secondHighestTeam : ''})`);
                    anyValidBid = true;
                }
            }
            // else: no valid bids, do nothing
        });

        // Reset bids for unassigned players
        roundPlayers.forEach(player => {
            if (!player.owner) player.bid = 0;
        });

        // Highlight tied players in UI
        if (tiedBids.length > 0) {
            tiedBids.forEach(tied => {
                const playerCard = document.querySelector(`input[data-player-id="${tied.playerId}"]`)?.parentElement;
                if (playerCard) {
                    playerCard.style.border = '2px solid red';
                    playerCard.style.background = '#ffeaea';
                    // Add or update tie message
                    let tieMsg = playerCard.querySelector('.tie-msg');
                    if (!tieMsg) {
                        tieMsg = document.createElement('div');
                        tieMsg.className = 'tie-msg';
                        tieMsg.style.color = 'red';
                        tieMsg.style.marginTop = '6px';
                        playerCard.appendChild(tieMsg);
                    }
                    tieMsg.textContent = `Tie: ${tied.tiedTeams.join(' & ')}`;
                }
            });
        }

        // Mark undrafted free agents

        roundPlayers.forEach(player => {
            if (!player.owner && player.bid === 0) {
                // Check if this player is in a tie
                const tie = tiedBids.find(t => t.playerId === player.id);
                if (tie) {
                    results.push(`${player.name} in a tie between: ${tie.tiedTeams.join(' & ')}`);
                } else {
                    results.push(`${player.name} was undrafted.`);
                }
            }
        });

        // Show round results in a modal and wait for all users to accept
        showRoundResultsModal(results, () => {
            if (timerInterval) {
                clearInterval(timerInterval);
                timerInterval = null;
            }

            window.__silentDraftTimerExpiredHandled = false;

            // Handle tied bids with a live auction or similar mechanism
            if (tiedBids.length > 0) {
                handleLiveAuction(tiedBids, () => {
                    advanceDraftAfterRound();
                });
            } else {
                advanceDraftAfterRound();
            }
        });

        // Notify other users that this user has submitted their bids
        if (window.draftSocket && currentDraftCode) {
            window.draftSocket.emit('submitBids', currentDraftCode, username, autoDraftEnabled, (response) => {
                if (response && response.ok) {
                    console.log('[silentdraft] Bid submission broadcasted');
                }
            });
        }
    }

    // Get current round players
    function getRoundPlayers() {
        // Return all round players, not just the visible ones from DOM
        return window.currentRoundPlayers || window.syncedRoundPlayers || [];
    }

    function advanceDraftAfterRound() {
        if (isDraftEnding) {
            console.log('[silentdraft] advanceDraftAfterRound ignored: draft is ending');
            return;
        }

        if (currentRound >= totalRounds || teams.every(t => t.roster.length >= rosterSize)) {
            endDraft();
            return;
        }

        currentRound++;
        startRound();
    }

    // Apply authoritative round results from server
    function applyRoundResults(results) {
        console.log('[silentdraft] Applying round results:', results);
        const tiedBids = [];
        
        results.forEach(result => {
            if (result.type === 'won') {
                // Find the player and team
                const player = players.find(p => p.id === result.playerId);
                const team = teams.find(t => t.name === result.winnerTeam);
                
                if (player && team) {
                    player.owner = team.name;
                    player.bid = result.pricePaid;
                    team.roster.push(player);
                    
                    // Sort roster by position priority, then by prerank within position
                    const positionOrder = { QB: 1, RB: 2, WR: 3, TE: 4, K: 5, DEF: 6 };
                    team.roster.sort((a, b) => {
                        const posA = positionOrder[a.position] || 99;
                        const posB = positionOrder[b.position] || 99;
                        if (posA !== posB) {
                            return posA - posB;
                        }
                        return a.positionRank - b.positionRank;
                    });
                    
                    team.budget -= result.pricePaid;
                }
            } else if (result.type === 'tied') {
                const player = players.find(p => p.id === result.playerId);
                if (player) {
                    tiedBids.push({
                        playerId: result.playerId,
                        playerName: result.playerName,
                        tiedTeams: result.tiedTeams,
                        bidAmount: result.bidAmount
                    });
                }
            }
            // Undrafted players don't need special handling
        });
        
        // Set up auction listeners IMMEDIATELY if there are ties
        // Server will automatically start auctions when all members accept
        if (tiedBids.length > 0) {
            console.log('[applyRoundResults] Tied bids detected, setting up auction listeners NOW');
            handleLiveAuction(tiedBids, () => {
                // After all auctions complete, advance to next round
                console.log('[applyRoundResults] All auctions complete');
                advanceDraftAfterRound();
            });
        }

        // Sync updated rosters to Rankings page
        saveDraftStateForRankings();

        return { tiedBids };
        
        // Update UI to show the new rosters
        updateUI([]);
        
        // Show results modal
        showRoundResultsModal(results, window.currentRoundPlayers || window.syncedRoundPlayers || [], () => {
            if (timerInterval) {
                clearInterval(timerInterval);
                timerInterval = null;
            }
            
            // If no ties, advance immediately when modal closes
            if (tiedBids.length === 0) {
                advanceDraftAfterRound();
            }
            // If there were ties, the auction completion handler above will advance
        });
    }


    // Show team players (now handled inline with dropdowns)
    function showTeamPlayers(teamName) {
        // This function is no longer needed as rosters are shown inline
        // Kept for backward compatibility
    }

    function showDraftSummary() {
        isDraftEnding = true;
        logDraftEndDebug('showDraftSummary:start', {
            currentDraftCode,
            teamCount: teams.length,
            username
        });

        try {
            localStorage.removeItem(DRAFT_TEMP_STARRED_KEY);
            localStorage.removeItem('rankingsDraftState');
        } catch (e) {
            // ignore
        }

        const draftResults = {
            draftCode: currentDraftCode,
            timestamp: new Date().toISOString(),
            completed: true,
            completionSource: 'draft-summary-page',
            benchCutTarget: normalizeBenchCutTarget(benchCutTarget),
            rosterSettings: Object.assign({}, rosterSettings),
            teams: teams.map(team => ({
                name: team.name,
                budgetRemaining: team.budget,
                roster: team.roster.map(player => ({
                    id: player.id,
                    name: player.name,
                    position: player.position,
                    bid: player.bid,
                    prerank: player.prerank
                }))
            }))
        };

        const completedDraftsRaw = localStorage.getItem('completedDrafts');
        const completedDrafts = completedDraftsRaw ? JSON.parse(completedDraftsRaw) : [];

        const existingIndex = completedDrafts.findIndex(d => d.draftCode === currentDraftCode);
        if (existingIndex >= 0) {
            completedDrafts[existingIndex] = draftResults;
        } else {
            completedDrafts.push(draftResults);
        }

        localStorage.setItem('completedDrafts', JSON.stringify(completedDrafts));
        sessionStorage.setItem('latestDraftSummary', JSON.stringify(draftResults));
        logDraftEndDebug('showDraftSummary:redirect', {
            destination: 'draft-summary.html',
            completedDraftsCount: completedDrafts.length
        });
        window.location.href = 'draft-summary.html';
    }

    function showDraftEndPopup() {
        logDraftEndDebug('showDraftEndPopup');

        const existing = document.getElementById('draft-end-popup-backdrop');
        if (existing) return;

        const backdrop = document.createElement('div');
        backdrop.id = 'draft-end-popup-backdrop';
        backdrop.style.position = 'fixed';
        backdrop.style.inset = '0';
        backdrop.style.background = 'rgba(0,0,0,0.7)';
        backdrop.style.zIndex = '10000';
        backdrop.style.display = 'flex';
        backdrop.style.alignItems = 'center';
        backdrop.style.justifyContent = 'center';

        const modal = document.createElement('div');
        modal.style.background = '#1e293b';
        modal.style.color = '#ffffff';
        modal.style.border = '1px solid rgba(255,255,255,0.2)';
        modal.style.borderRadius = '12px';
        modal.style.padding = '22px';
        modal.style.width = '92%';
        modal.style.maxWidth = '520px';
        modal.style.boxShadow = '0 14px 40px rgba(0,0,0,0.45)';
        modal.innerHTML = `
            <h3 style="margin:0 0 10px 0;color:#2ecc71;font-size:24px;">Draft Completed</h3>
            <p style="margin:0 0 18px 0;line-height:1.5;opacity:0.95;">Hit OK to advance to the draft summary page.</p>
            <button id="draft-end-ok-btn" style="background:#2ecc71;color:#0f172a;border:none;border-radius:8px;padding:10px 16px;font-weight:700;cursor:pointer;">OK</button>
        `;

        backdrop.appendChild(modal);
        document.body.appendChild(backdrop);

        const okBtn = document.getElementById('draft-end-ok-btn');
        if (okBtn) {
            okBtn.addEventListener('click', () => {
                backdrop.remove();
                showDraftSummary();
            });
        }
    }

    function logDraftEndDebug(stage, details = {}) {
        const entry = {
            stage,
            timestamp: new Date().toISOString(),
            round: currentRound,
            username,
            details
        };
        if (!window.__draftEndDebugTrace) window.__draftEndDebugTrace = [];
        window.__draftEndDebugTrace.push(entry);
        console.log('[draft-end-debug]', entry);
        try {
            sessionStorage.setItem('draftEndDebugTrace', JSON.stringify(window.__draftEndDebugTrace));
        } catch (err) {
            console.warn('[draft-end-debug] Could not persist trace:', err);
        }
    }

    // End draft
    function endDraft() {
        if (isDraftEnding) return;
        isDraftEnding = true;

        logDraftEndDebug('endDraft:start', {
            totalRounds,
            teamRosters: teams.map(t => ({ name: t.name, rosterSize: t.roster.length, budget: t.budget }))
        });

        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
        let invalidTeams = [];
        teams.forEach(team => {
            if (!validateRoster(team)) {
                const positionCounts = team.roster.reduce((counts, p) => {
                    counts[p.position] = (counts[p.position] || 0) + 1;
                    return counts;
                }, {});
                invalidTeams.push(`${team.name}: ${JSON.stringify(positionCounts)}`);
            }
        });
        updateUI([]); // Lock/clear UI
        if (invalidTeams.length > 0) {
            console.warn('Invalid rosters:', invalidTeams);
            logDraftEndDebug('endDraft:invalidTeams', { invalidTeams });
        }
        logDraftEndDebug('endDraft:postAlert');

        const yourTeam = teams.find(t => t.name === username);
        if (!yourTeam) {
            console.error('[silentdraft] Could not find user team at draft end:', username);
            logDraftEndDebug('endDraft:missingUserTeam', { username });
            showDraftEndPopup();
            return;
        }

        const maxSummaryTotalPlayers = STARTER_SLOT_COUNT + normalizeBenchCutTarget(benchCutTarget);
        if (yourTeam.roster.length > maxSummaryTotalPlayers) {
            logDraftEndDebug('endDraft:cutBypassed', {
                yourRosterSize: yourTeam.roster.length,
                maxSummaryTotalPlayers,
                reason: 'do_not_block_summary_on_incomplete_teams'
            });
        }
        // If no cut needed, show draft summary
        logDraftEndDebug('endDraft:advanceToSummary');
        showDraftEndPopup();
    }

    let isPaused = false;
    let pausedTimer = 0;
    let autoDraftEnabled = false;

    // Attach event listeners to existing buttons in header
    const nextRoundButton = document.getElementById('next-round');
    const pauseButton = document.getElementById('pause-draft');
    const restartButton = document.getElementById('restart-draft');
    const autoDraftToggleButton = document.getElementById('auto-draft-toggle');

    function updateAutoDraftToggleUI() {
        if (!autoDraftToggleButton) return;
        autoDraftToggleButton.setAttribute('aria-pressed', autoDraftEnabled ? 'true' : 'false');
        autoDraftToggleButton.textContent = autoDraftEnabled ? '🤖 Auto Draft: ON' : '🤖 Auto Draft: OFF';
    }

    if (autoDraftToggleButton) {
        updateAutoDraftToggleUI();
        autoDraftToggleButton.addEventListener('click', () => {
            autoDraftEnabled = !autoDraftEnabled;
            updateAutoDraftToggleUI();
            showNotification(`Auto Draft ${autoDraftEnabled ? 'enabled' : 'disabled'}`);

            if (window.draftSocket && currentDraftCode) {
                window.draftSocket.emit('setAutoDraftStatus', currentDraftCode, username, autoDraftEnabled, () => {});
            }
        });
    }

    if (nextRoundButton) {
        nextRoundButton.addEventListener('click', () => {
            if (timerInterval) {
                clearInterval(timerInterval);
                timerInterval = null;
            }

            const submitBtn = document.getElementById('submit-bids');
            const hasServerSubmitHandler = submitBtn && typeof submitBtn.onclick === 'function';

            if (autoDraftEnabled) {
                // Auto Draft still submits through the server path; the server CPU takes over this team.
                if (hasServerSubmitHandler) {
                    submitBtn.onclick();
                } else {
                    console.warn('[silentdraft] submit-bids handler not ready; cannot submit auto-draft round yet.');
                }
                return;
            }

            // Auto Draft is off: use normal/manual submit flow.
            if (hasServerSubmitHandler) {
                submitBtn.onclick();
            } else {
                console.warn('[silentdraft] submit-bids handler not ready; cannot submit round yet.');
            }
        });
    }

    function showNotification(message) {
        const notice = document.createElement('div');
        notice.style.position = 'fixed';
        notice.style.bottom = '24px';
        notice.style.right = '24px';
        notice.style.zIndex = '10001';
        notice.style.padding = '10px 14px';
        notice.style.borderRadius = '8px';
        notice.style.background = 'rgba(15, 23, 42, 0.92)';
        notice.style.border = '1px solid rgba(148, 163, 184, 0.35)';
        notice.style.color = '#f8fafc';
        notice.style.fontSize = '13px';
        notice.style.fontWeight = '600';
        notice.style.boxShadow = '0 10px 24px rgba(0, 0, 0, 0.35)';
        notice.style.opacity = '0';
        notice.style.transform = 'translateY(8px)';
        notice.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
        notice.textContent = message;

        document.body.appendChild(notice);
        requestAnimationFrame(() => {
            notice.style.opacity = '1';
            notice.style.transform = 'translateY(0)';
        });

        setTimeout(() => {
            notice.style.opacity = '0';
            notice.style.transform = 'translateY(8px)';
            setTimeout(() => notice.remove(), 220);
        }, 2200);
    }

    if (pauseButton) {
        pauseButton.addEventListener('click', () => {
            if (!isPaused) {
                // Pause - emit to server to broadcast to all participants
                if (window.draftSocket) {
                    window.draftSocket.emit('pauseDraft', currentDraftCode, username);
                }
            } else {
                // Resume - emit to server to broadcast to all participants
                if (window.draftSocket) {
                    window.draftSocket.emit('resumeDraft', currentDraftCode, username);
                }
            }
        });
    }

    // Socket event listeners - only set up if socket exists
    if (window.draftSocket) {
        // Listen for pause events from other participants
        window.draftSocket.on('draftPaused', (data) => {
            isPaused = true;
            if (pauseButton) {
                pauseButton.textContent = '▶ Resume Draft';
            }
            if (timerInterval) {
                clearInterval(timerInterval);
                timerInterval = null;
            }
            // Disable bid inputs
            document.querySelectorAll('input[data-player-id]').forEach(input => input.disabled = true);
            const submitBtn = document.getElementById('submit-bids');
            if (submitBtn) submitBtn.disabled = true;
            
            // Show notification
            showNotification(`Draft paused by ${data.pausedBy}`);
        });

        // Listen for resume events from other participants
        window.draftSocket.on('draftResumed', (data) => {
            isPaused = false;
            if (pauseButton) {
                pauseButton.textContent = '⏸ Pause Draft';
            }
            // Enable bid inputs
            document.querySelectorAll('input[data-player-id]').forEach(input => input.disabled = false);
            const submitBtn = document.getElementById('submit-bids');
            if (submitBtn) submitBtn.disabled = false;
            
            // Show notification
            showNotification(`Draft resumed by ${data.resumedBy}`);
            
            // Resume timer
            resumeTimer();
        });

        if (restartButton) {
            restartButton.addEventListener('click', () => {
                if (confirm('Are you sure you want to restart the draft? All progress will be lost.')) {
                    // Emit restart to server to broadcast to all participants
                    window.draftSocket.emit('restartDraft', currentDraftCode, username);
                }
            });
        }

        // Listen for restart events from other participants
        window.draftSocket.on('draftRestarted', (data) => {
            // Reset teams
            teams.forEach(team => {
                team.budget = 200;
                team.roster = [];
            });
            // Reset players
            players.forEach(player => {
                player.bid = 0;
                delete player.owner;
            });
            // Reset round and timer
            currentRound = 1;
            timer = roundDuration;
            if (timerInterval) {
                clearInterval(timerInterval);
                timerInterval = null;
            }
            // Reset pause state
            isPaused = false;
            if (pauseButton) {
                pauseButton.textContent = '⏸ Pause Draft';
            }
            // Remove any cut UI
            let oldCutDiv = document.getElementById('cut-roster-div');
            if (oldCutDiv) oldCutDiv.remove();
            
            // Show notification
            showNotification(`Draft restarted by ${data.restartedBy}`);
            
            // Start draft again
            startRound();
        });
    }

    let timer = roundDuration; // Move timer to outer scope for pause/resume

    // Show round banner with sound effect
    function showRoundBanner(roundNumber) {
        // Remove existing banner if any
        const existingBanner = document.getElementById('roundBanner');
        if (existingBanner) {
            existingBanner.remove();
        }

        // Create banner
        const banner = document.createElement('div');
        banner.id = 'roundBanner';
        banner.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:40px 60px;border-radius:16px;text-align:center;z-index:10000;box-shadow:0 10px 40px rgba(0,0,0,0.5);animation:slideIn 0.3s ease-out;';
        banner.innerHTML = `
            <h1 style="color:#fff;font-size:3em;margin:0;text-shadow:0 2px 10px rgba(0,0,0,0.3);">Round ${roundNumber}</h1>
        `;
        document.body.appendChild(banner);

        // Play round announcement sound
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Play a rising tone sequence
            const playTone = (frequency, startTime, duration) => {
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();
                
                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);
                
                oscillator.frequency.value = frequency;
                oscillator.type = 'sine';
                
                gainNode.gain.setValueAtTime(0.2, startTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
                
                oscillator.start(startTime);
                oscillator.stop(startTime + duration);
            };
            
            // Three ascending tones
            playTone(600, audioContext.currentTime, 0.15);
            playTone(750, audioContext.currentTime + 0.15, 0.15);
            playTone(900, audioContext.currentTime + 0.3, 0.25);
        } catch (e) {
            console.log('[silentdraft] Audio not supported');
        }

        // Remove banner after 2 seconds
        setTimeout(() => {
            banner.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => banner.remove(), 300);
        }, 2000);
    }

    function startRound() {
        // Show round banner
        showRoundBanner(currentRound);
        
        // Wait for banner to display before starting round
        setTimeout(() => {
            if (timerInterval) {
                clearInterval(timerInterval);
                timerInterval = null;
            }
            if (currentRound > totalRounds || teams.every(t => t.roster.length >= rosterSize)) {
                endDraft();
                return;
            }
            timer = roundDuration;
            const timerElement = document.getElementById('timer');
        
        // Host generates and broadcasts players, non-hosts wait for synced players
        if (window.isHost) {
            // Host generates round players with 12 per page and 4 forced extra slots.
            const page1Core = ensureRequiredPositionsInPool(getRandomPlayers(10), ['K', 'DEF']);
            const page2Core = getBalancedPagePlayers(10, page1Core);
            const baseRoundPlayers = page1Core.concat(page2Core);
            const forcedExtras = getRoundExtras(['K', 'DEF', 'RB', 'WR'], baseRoundPlayers);

            const page1Players = [...page1Core];
            const page2Players = [...page2Core];

            const rbExtra = forcedExtras.find(player => player.position === 'RB');
            const wrExtra = forcedExtras.find(player => player.position === 'WR');
            const kExtra = forcedExtras.find(player => player.position === 'K');
            const defExtra = forcedExtras.find(player => player.position === 'DEF');

            if (rbExtra) page1Players.push(rbExtra);
            if (wrExtra) page1Players.push(wrExtra);
            if (kExtra) page2Players.push(kExtra);
            if (defExtra) page2Players.push(defExtra);

            const pickFallback = (exclude) => {
                const pool = getRemainingUndraftedPlayers(exclude)
                    .filter(player => (
                        player.position !== 'K' &&
                        player.position !== 'DEF' &&
                        canSelectPlayerForCurrentRound(player, exclude, [])
                    ));
                return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
            };

            while (page1Players.length < 12) {
                const fallback = pickFallback(page1Players.concat(page2Players));
                if (!fallback) break;
                page1Players.push(fallback);
            }

            while (page2Players.length < 12) {
                const fallback = pickFallback(page1Players.concat(page2Players));
                if (!fallback) break;
                page2Players.push(fallback);
            }

            const roundPlayers = page1Players.concat(page2Players);
            
            // Mark all selected players as shown so they don't appear in future rounds
            roundPlayers.forEach(player => player.shown = true);
            
            console.log('[silentdraft] Host generated round players:', roundPlayers.map(p => p.name));
            updateUI(roundPlayers);
            
            // Broadcast to all members
            if (window.draftSocket && currentDraftCode) {
                window.draftSocket.emit('setRoundPlayers', currentDraftCode, roundPlayers, (response) => {
                    if (response && response.ok) {
                        console.log('[silentdraft] Round players broadcasted to all members');
                    }
                });
            }
        } else {
            // Non-host waits for synced players
            if (window.syncedRoundPlayers && window.syncedRoundPlayers.length > 0) {
                console.log('[silentdraft] Using synced round players:', window.syncedRoundPlayers.map(p => p.name));
                updateUI(window.syncedRoundPlayers);
            } else {
                console.log('[silentdraft] Waiting for host to set round players...');
                // Show loading state
                const playerList = document.getElementById('players-list');
                if (playerList) {
                    playerList.innerHTML = '<div style="text-align:center;padding:40px;color:#cbd5e0;">Waiting for host to start the round...</div>';
                }
            }
        }

        timerInterval = setInterval(() => {
            if (!isPaused) {
                let minutes = Math.floor(timer / 60);
                let seconds = timer % 60;
                if (timerElement) {
                    timerElement.textContent = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
                }
                timer--;
                if (timer < 0) {
                    clearInterval(timerInterval);
                    timerInterval = null;
                    // Timer expired - trigger round processing on server
                    console.log('[silentdraft] Timer expired, processing round');
                    handleRoundTimerExpired();
                }
            }
        }, 1000);
        }, 2300); // Wait for banner to show (2s display + 300ms animation)
    }
    
    // Helper function to display round players (for non-hosts receiving synced players)
    function displayRoundPlayers(roundPlayers) {
        console.log('[silentdraft] Displaying synced round players');
        updateUI(roundPlayers);
    }

    function resumeTimer() {
        const timerElement = document.getElementById('timer');
        timerInterval = setInterval(() => {
            if (!isPaused) {
                let minutes = Math.floor(timer / 60);
                let seconds = timer % 60;
                if (timerElement) {
                    timerElement.textContent = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
                }
                timer--;
                if (timer < 0) {
                    clearInterval(timerInterval);
                    timerInterval = null;
                    // Timer expired - trigger round processing
                    handleRoundTimerExpired();
                }
            }
        }, 1000);
    }

    // Handle live auctions for tied bids
    function handleLiveAuction(tiedBids, onComplete) {
        console.log('[handleLiveAuction] Called with tiedBids:', tiedBids);
        if (!tiedBids || tiedBids.length === 0) {
            console.log('[handleLiveAuction] No tied bids, completing');
            onComplete();
            return;
        }

        // Sort tied bids from highest to lowest
        tiedBids.sort((a, b) => b.bidAmount - a.bidAmount);
        console.log('[handleLiveAuction] Sorted tied bids:', tiedBids);

        // Set up a global listener for all auction starts
        const globalAuctionListener = (data) => {
            console.log('[globalAuctionListener] Received auction start:', data);
            // Check if this auction is one of our tied bids
            const matchingTie = tiedBids.find(t => t.playerId === data.playerId);
            if (matchingTie) {
                console.log('[globalAuctionListener] This is one of our tied bids, setting up UI');
                startLiveAuction(matchingTie, data.auctionId);
            }
        };
        
        // Store the listener and cleanup function
        window.currentAuctionCleanup = () => {
            console.log('[handleLiveAuction] Cleaning up global auction listener');
            window.draftSocket.off('liveAuctionStarted', globalAuctionListener);
        };
        
        window.draftSocket.on('liveAuctionStarted', globalAuctionListener);
        
        // Wait for all auctions to complete (server will emit allMembersAccepted when done)
        const allAuctionsCompleteListener = () => {
            console.log('[handleLiveAuction] All auctions complete, cleaning up');
            window.currentAuctionCleanup();
            window.draftSocket.off('allMembersAccepted', allAuctionsCompleteListener);
            onComplete();
        };
        window.draftSocket.once('allMembersAccepted', allAuctionsCompleteListener);
        
        console.log('[handleLiveAuction] Global listener set up, waiting for server to start auctions...');
    }

    // Start a single live auction for one tied player
    function startLiveAuction(tied, auctionId) {
        console.log('[startLiveAuction] Starting auction for:', tied, 'with auctionId:', auctionId);
        const player = players.find(p => p.id === tied.playerId);
        if (!player) {
            console.log('[startLiveAuction] Player not found:', tied.playerId);
            return;
        }
        console.log('[startLiveAuction] Found player:', player);

        console.log('[startLiveAuction] Checking if user is in tie - username:', username, 'tiedTeams:', tied.tiedTeams);
        const userInTie = tied.tiedTeams.includes(username);
        console.log('[startLiveAuction] userInTie:', userInTie);
        
        let currentBid = tied.bidAmount;
        let currentWinner = null;
        let backedOut = false;

        // Create auction UI
        const auctionDiv = document.createElement('div');
        auctionDiv.id = 'live-auction-modal';
        
        // Add pulsing animation if user is in the auction
        const pulseAnimation = userInTie ? `
            @keyframes auctionPulse {
                0%, 100% { transform: translate(-50%,-50%) scale(1); box-shadow: 0 8px 32px rgba(0,0,0,0.8); }
                50% { transform: translate(-50%,-50%) scale(1.02); box-shadow: 0 8px 48px rgba(52,152,219,0.6); }
            }
        ` : '';
        
        if (userInTie && pulseAnimation) {
            const styleTag = document.createElement('style');
            styleTag.textContent = pulseAnimation;
            document.head.appendChild(styleTag);
        }
        
        const animationStyle = userInTie ? 'animation: auctionPulse 1s ease-in-out 2;' : '';
        
        auctionDiv.style.cssText = `position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(15,15,15,0.98);border:2px solid ${userInTie ? '#2ecc71' : '#3498db'};border-radius:12px;padding:24px;z-index:10000;color:#f5f5f7;box-shadow:0 8px 32px rgba(0,0,0,0.8);min-width:500px;${animationStyle}`;
        
        auctionDiv.innerHTML = `
            <div style="background:linear-gradient(135deg,${userInTie ? '#2ecc71,#27ae60' : '#3498db,#2980b9'});padding:16px;border-radius:8px;margin:-24px -24px 20px -24px;">
                <h3 style="color:#fff;margin:0;text-align:center;font-size:20px;text-transform:uppercase;letter-spacing:1px;">Live Auction${userInTie ? ' - YOU\'RE IN!' : ''}</h3>
            </div>
            <div style="background:rgba(52,152,219,0.1);border:2px solid #3498db;border-radius:8px;padding:16px;margin-bottom:20px;">
                <p style="text-align:center;color:#3498db;font-size:18px;font-weight:bold;margin:0 0 8px 0;">${player.playerName || player.name} (${player.position})</p>
                <p style="text-align:center;color:#f5f5f7;font-size:16px;margin:0 0 8px 0;">Tied at: <span style="color:#2ecc71;font-weight:bold;">$${tied.bidAmount}</span></p>
                <p style="text-align:center;color:#95a5a6;font-size:14px;margin:0;">Competing Teams: <span style="color:#f5f5f7;font-weight:600;">${tied.tiedTeams.join(', ')}</span></p>
            </div>
            <div style="margin:20px 0;text-align:center;">
                <p style="color:#95a5a6;font-size:14px;margin:0 0 8px 0;">Current Bid:</p>
                <div style="display:flex;align-items:center;justify-content:center;gap:20px;">
                    <p id="live-bid-amount" style="font-size:48px;font-weight:bold;margin:0;color:#3498db;">$${currentBid}</p>
                    ${userInTie ? `<button id="bid-up-btn" style="background:#3498db;color:#fff;border:none;border-radius:50%;width:60px;height:60px;font-size:32px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-weight:bold;transition:all 0.2s;">↑</button>` : ''}
                </div>
            </div>
            <p id="auction-countdown" style="text-align:center;color:#2ecc71;font-size:18px;font-weight:bold;margin:16px 0;">Time: 10s</p>
            ${userInTie ? `
                <div style="border-top:1px solid rgba(255,255,255,0.1);padding-top:16px;margin-top:16px;text-align:center;">
                    <label style="display:flex;align-items:center;justify-content:center;gap:8px;cursor:pointer;padding:12px;background:rgba(231,76,60,0.1);border-radius:8px;">
                        <input type="radio" id="backout-radio" name="backout" style="width:18px;height:18px;cursor:pointer;"/>
                        <span style="color:#e74c3c;font-weight:600;">Back Out of Auction</span>
                    </label>
                </div>
            ` : ''}
        `;
        document.body.appendChild(auctionDiv);

        // Play "ding ding ding" sound effect if user is in the tied auction
        if (userInTie) {
            try {
                const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                
                // Create three quick "ding" sounds like a boxing match bell
                const playDing = (frequency, delay) => {
                    setTimeout(() => {
                        const oscillator = audioContext.createOscillator();
                        const gainNode = audioContext.createGain();
                        
                        oscillator.connect(gainNode);
                        gainNode.connect(audioContext.destination);
                        
                        // Bell-like sound with harmonics
                        oscillator.frequency.value = frequency;
                        oscillator.type = 'sine';
                        
                        // Quick attack and decay for bell sound
                        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
                        gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.05); // Quick attack
                        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3); // Decay
                        
                        oscillator.start(audioContext.currentTime);
                        oscillator.stop(audioContext.currentTime + 0.3);
                    }, delay);
                };
                
                // Play three dings with decreasing frequency (like a bell)
                playDing(800, 0);    // First ding
                playDing(700, 200);  // Second ding (slightly lower)
                playDing(600, 400);  // Third ding (even lower)
                
            } catch (e) {
                console.log('[startLiveAuction] Audio not supported for auction sound effect');
            }
        }

        // Socket listener for bid updates
        const bidUpdateHandler = (data) => {
            console.log('[bidUpdateHandler] Received bid update:', data);
            if (data.auctionId !== auctionId) {
                console.log('[bidUpdateHandler] AuctionId mismatch, ignoring');
                return;
            }
            
            console.log('[bidUpdateHandler] Updating currentBid from', currentBid, 'to', data.amount);
            console.log('[bidUpdateHandler] New winner:', data.bidder);
            currentBid = data.amount;
            currentWinner = data.bidder;
            
            updateBidDisplay();
        };
        window.draftSocket.on('liveAuctionBidPlaced', bidUpdateHandler);

        // Timer update listener
        const timerUpdateHandler = (data) => {
            console.log('[timerUpdateHandler] Received timer update:', data);
            if (data.auctionId !== auctionId) return;
            
            const countdown = document.getElementById('auction-countdown');
            if (countdown) {
                countdown.textContent = `Time: ${data.timer}s`;
                console.log('[timerUpdateHandler] Updated countdown display to:', data.timer);
            } else {
                console.log('[timerUpdateHandler] Countdown element not found');
            }
        };
        window.draftSocket.on('liveAuctionTimerUpdate', timerUpdateHandler);

        // Auction complete listener
        const completeHandler = (data) => {
            console.log('[completeHandler] Received liveAuctionEnded event:', data);
            console.log('[completeHandler] Checking auctionId:', data.auctionId, 'vs', auctionId);
            
            if (data.auctionId !== auctionId) {
                console.log('[completeHandler] AuctionId mismatch, ignoring');
                return;
            }
            
            console.log('[completeHandler] AuctionId matches, processing completion');
            
            window.draftSocket.off('liveAuctionBidPlaced', bidUpdateHandler);
            window.draftSocket.off('liveAuctionTimerUpdate', timerUpdateHandler);
            window.draftSocket.off('liveAuctionEnded', completeHandler);
            window.draftSocket.off('liveAuctionBackout', backoutHandler);
            
            // Update local state - award player to winner
            const winnerTeam = teams.find(t => t.name === data.winner);
            if (winnerTeam && player) {
                // Update player owner
                player.owner = data.winner;
                player.bid = data.finalBid;
                
                // Add to winner's roster
                winnerTeam.roster.push(player);
                
                // Sort roster by position priority, then by prerank within position
                const positionOrder = { QB: 1, RB: 2, WR: 3, TE: 4, K: 5, DEF: 6 };
                winnerTeam.roster.sort((a, b) => {
                    const posA = positionOrder[a.position] || 99;
                    const posB = positionOrder[b.position] || 99;
                    if (posA !== posB) {
                        return posA - posB;
                    }
                    return a.positionRank - b.positionRank;
                });
                
                // Deduct from budget
                winnerTeam.budget -= data.finalBid;
                
                console.log('[completeHandler] Updated local state - awarded', player.name, 'to', data.winner, 'for $' + data.finalBid);
            }
            
            console.log('[completeHandler] Showing winner display for 5 seconds');
            console.log('[completeHandler] auctionDiv exists:', !!auctionDiv);
            
            // Show winner
            auctionDiv.innerHTML = `
                <h3 style="color:#2ecc71;margin-top:0;text-align:center;">Auction Complete!</h3>
                <p style="text-align:center;color:#f5f5f7;font-size:18px;margin:16px 0;">${player.playerName || player.name}</p>
                <p style="text-align:center;color:#2ecc71;font-size:24px;font-weight:bold;margin:16px 0;">Winner: ${data.winner}</p>
                <p style="text-align:center;color:#3498db;font-size:20px;margin:16px 0;">Price: $${data.finalBid}</p>
            `;
            
            console.log('[completeHandler] Winner display HTML set, waiting 5 seconds before removing');
            
            // Remove modal after showing winner
            setTimeout(() => {
                console.log('[completeHandler] 5 seconds elapsed, removing winner display');
                if (auctionDiv && auctionDiv.parentNode) {
                    auctionDiv.parentNode.removeChild(auctionDiv);
                    console.log('[completeHandler] Winner display removed');
                } else {
                    console.log('[completeHandler] Could not remove - auctionDiv or parent missing');
                }
            }, 5000);
        };
        window.draftSocket.on('liveAuctionEnded', completeHandler);

        // Backout listener
        const backoutHandler = (data) => {
            if (data.auctionId !== auctionId) return;
            
            // Show message that someone backed out
            const message = document.createElement('p');
            message.style.cssText = 'text-align:center;color:#e74c3c;font-size:14px;margin:8px 0;';
            message.textContent = `${data.teamName} backed out`;
            auctionDiv.appendChild(message);
            
            setTimeout(() => {
                if (message && message.parentNode) {
                    message.parentNode.removeChild(message);
                }
            }, 3000);
        };
        window.draftSocket.on('liveAuctionBackout', backoutHandler);

        // Update bid display color
        function updateBidDisplay() {
            console.log('[updateBidDisplay] Updating display - currentBid:', currentBid, 'currentWinner:', currentWinner, 'username:', username);
            const bidAmount = document.getElementById('live-bid-amount');
            if (bidAmount) {
                bidAmount.textContent = `$${currentBid}`;
                console.log('[updateBidDisplay] Updated bid amount text to:', bidAmount.textContent);
                
                if (currentWinner === null) {
                    bidAmount.style.color = '#3498db'; // Blue - tied
                    console.log('[updateBidDisplay] Color: BLUE (tied)');
                } else if (currentWinner === username) {
                    bidAmount.style.color = '#2ecc71'; // Green - winning
                    console.log('[updateBidDisplay] Color: GREEN (winning)');
                } else {
                    bidAmount.style.color = '#e74c3c'; // Red - losing
                    console.log('[updateBidDisplay] Color: RED (losing)');
                }
            } else {
                console.log('[updateBidDisplay] ERROR: live-bid-amount element not found!');
            }
        }

        // Up arrow button
        const upBtn = document.getElementById('bid-up-btn');
        if (upBtn && userInTie) {
            console.log('[upBtn] Up arrow button found and user is in tie');
            upBtn.onclick = () => {
                console.log('[upBtn] Up arrow clicked!');
                if (backedOut) {
                    console.log('[upBtn] User has backed out, ignoring click');
                    alert('You have backed out of this auction');
                    return;
                }
                
                const newBid = currentBid + 1;
                const yourTeam = teams.find(t => t.name === username);
                console.log('[upBtn] Current bid:', currentBid, '→ New bid:', newBid);
                console.log('[upBtn] User budget:', yourTeam.budget);
                
                if (newBid > yourTeam.budget) {
                    console.log('[upBtn] Bid exceeds budget, rejecting');
                    alert(`Bid exceeds your budget of $${yourTeam.budget}`);
                    return;
                }
                
                if (newBid > 999) {
                    console.log('[upBtn] Bid exceeds max (999), rejecting');
                    alert('Maximum bid is $999');
                    return;
                }
                
                console.log('[upBtn] Sending bid to server via socket...');
                // Send to server - do NOT optimistically update, wait for server broadcast
                window.draftSocket.emit('placeLiveAuctionBid', currentDraftCode, auctionId, newBid, (response) => {
                    console.log('[upBtn] Server response:', response);
                    if (!response || !response.ok) {
                        console.error('[upBtn] Failed to place bid:', response?.reason);
                        alert('Failed to place bid: ' + (response?.reason || 'unknown error'));
                    } else {
                        console.log('[upBtn] Bid successfully placed!');
                    }
                });
                
                // Brief disable
                upBtn.disabled = true;
                upBtn.style.background = '#95a5a6';
                setTimeout(() => {
                    upBtn.disabled = false;
                    upBtn.style.background = '#3498db';
                }, 500);
            };
        }

        // Setup backout radio
        const backoutRadio = document.getElementById('backout-radio');
        if (backoutRadio && userInTie) {
            backoutRadio.onchange = () => {
                if (backoutRadio.checked) {
                    window.draftSocket.emit('backoutLiveAuction', currentDraftCode, auctionId, (response) => {
                        if (response && response.ok) {
                            backedOut = true;
                            alert('You have backed out of this auction');
                            
                            // Disable bidding
                            const upBtn = document.getElementById('bid-up-btn');
                            if (upBtn) {
                                upBtn.disabled = true;
                                upBtn.style.background = '#95a5a6';
                            }
                        }
                    });
                }
            };
        }
    }

    // Show round results modal and wait for all users to accept
function showRoundResultsModal(serverResults, roundPlayers, onComplete) {
        let resultsDiv = document.createElement('div');
        resultsDiv.id = 'round-results-modal';
        resultsDiv.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(15,15,15,0.98);border:2px solid #2ecc71;border-radius:12px;padding:20px;z-index:10000;color:#f5f5f7;box-shadow:0 8px 32px rgba(0,0,0,0.8);max-width:1200px;width:95%;max-height:85vh;display:flex;flex-direction:column;';
        
        // Build displayResults and group by page
        const displayResults = [];
        serverResults.forEach(result => {
            if (result.type === 'won') {
                const team = teams.find(t => t.name === result.winnerTeam);
                if (team) {
                    let resultText = `${result.playerName} → ${team.name} for $${result.pricePaid} (bid $${result.bidAmount})`;
                    let isWinner = isCurrentUserTeamName(team.name);
                    let isSecondPlace = isCurrentUserTeamName(result.secondHighestBidder);
                    
                    if (result.secondHighestBidder && result.secondHighestBid > 0) {
                        if (isSecondPlace) {
                            resultText += ` | <span style="color: #f39c12; font-weight: bold;">2nd: ${result.secondHighestBidder} ($${result.secondHighestBid})</span>`;
                        } else {
                            resultText += ` | 2nd: ${result.secondHighestBidder} ($${result.secondHighestBid})`;
                        }
                    }
                    
                    if (isWinner) {
                        resultText = `<span style="color: #2ecc71; font-weight: bold;">${resultText}</span>`;
                    }
                    
                    displayResults.push({ playerId: result.playerId, text: resultText, result: result });
                }
            } else if (result.type === 'tied') {
                let tieText = `${result.tiedTeams.join(' and ')} are tied at $${result.bidAmount} for ${result.playerName}`;
                // Highlight ties involving the user in blue
                if (result.tiedTeams.some(teamName => isCurrentUserTeamName(teamName))) {
                    tieText = `<span style="color: #3498db; font-weight: bold;">${tieText}</span>`;
                }
                displayResults.push({ playerId: result.playerId, text: tieText, result: result });
            } else if (result.type === 'undrafted') {
                displayResults.push({ playerId: result.playerId, text: `${result.playerName} was undrafted.`, result: result });
            }
        });

        // Group by page using stored page groupings
        const page1Results = [];
        const page2Results = [];

        displayResults.forEach(item => {
            const player = (window.page1Players || []).find(p => p.id === item.playerId) ||
                          (window.page2Players || []).find(p => p.id === item.playerId);
            if (player) {
                const isPage1Player = (window.page1Players || []).some(p => p.id === item.playerId);
                if (isPage1Player) {
                    page1Results.push(item);
                } else {
                    page2Results.push(item);
                }
            } else {
                // Fallback: if not found in stored pages, put in page 1
                page1Results.push(item);
            }
        });

        const page1List = page1Results.length > 0 ? page1Results.map(item => {
            const bidDetails = item.allBids ? item.allBids
                .sort((a, b) => b.amount - a.amount) // Sort by bid amount descending
                .map(bid => 
                `<div style="display:flex;justify-content:space-between;padding:2px 0;border-bottom:1px solid rgba(255,255,255,0.1);">
                    <span>${bid.teamName}:</span>
                    <span style="font-weight:bold;">$${bid.amount}</span>
                </div>`
            ).join('') : 'No bids';
            
            return `<div style="margin:4px 0;padding:6px 8px;background:rgba(255,255,255,0.05);border-radius:4px;font-size:13px;">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <span>${item.text}</span>
                    <button class="bid-details-btn" data-player-id="${item.playerId}" style="background:#3498db;color:#fff;border:none;border-radius:3px;padding:2px 6px;font-size:11px;cursor:pointer;">Bids ▼</button>
                </div>
                <div class="bid-details" style="display:none;margin-top:8px;padding:8px;background:rgba(0,0,0,0.3);border-radius:4px;max-height:150px;overflow-y:auto;">
                    ${bidDetails}
                </div>
            </div>`;
        }).join('') : '<p>No results for Page 1.</p>';
        const page2List = page2Results.length > 0 ? page2Results.map(item => {
            const bidDetails = item.allBids ? item.allBids
                .sort((a, b) => b.amount - a.amount) // Sort by bid amount descending
                .map(bid => 
                `<div style="display:flex;justify-content:space-between;padding:2px 0;border-bottom:1px solid rgba(255,255,255,0.1);">
                    <span>${bid.teamName}:</span>
                    <span style="font-weight:bold;">$${bid.amount}</span>
                </div>`
            ).join('') : 'No bids';
            
            return `<div style="margin:4px 0;padding:6px 8px;background:rgba(255,255,255,0.05);border-radius:4px;font-size:13px;">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <span>${item.text}</span>
                    <button class="bid-details-btn" data-player-id="${item.playerId}" style="background:#3498db;color:#fff;border:none;border-radius:3px;padding:2px 6px;font-size:11px;cursor:pointer;">Bids ▼</button>
                </div>
                <div class="bid-details" style="display:none;margin-top:8px;padding:8px;background:rgba(0,0,0,0.3);border-radius:4px;max-height:150px;overflow-y:auto;">
                    ${bidDetails}
                </div>
            </div>`;
        }).join('') : '<p>No results for Page 2.</p>';

        resultsDiv.innerHTML = `
            <h3 style="color:#2ecc71;margin:0 0 12px 0;font-size:20px;">Round ${currentRound} Results</h3>
            <div style="display:flex;gap:20px;flex:1;">
                <div style="flex:1;display:flex;flex-direction:column;">
                    <h4 style="color:#3498db;margin:0 0 8px 0;font-size:16px;">Page 1 Results</h4>
                    <div style="flex:1;overflow-y:auto;margin:8px 0;padding-right:8px;border:1px solid rgba(255,255,255,0.1);border-radius:6px;padding:8px;">${page1List}</div>
                </div>
                <div style="flex:1;display:flex;flex-direction:column;">
                    <h4 style="color:#3498db;margin:0 0 8px 0;font-size:16px;">Page 2 Results</h4>
                    <div style="flex:1;overflow-y:auto;margin:8px 0;padding-right:8px;border:1px solid rgba(255,255,255,0.1);border-radius:6px;padding:8px;">${page2List}</div>
                </div>
            </div>
            <p id="waiting-status" style="color:#3498db;text-align:center;margin:12px 0 8px 0;font-size:14px;">Waiting for all members to accept...</p>
            <button id="accept-results-btn" style="width:100%;padding:10px 20px;background:#2ecc71;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:600;font-size:15px;">Accept & Continue</button>
        `;
        document.body.appendChild(resultsDiv);

        // Add event listeners for bid details dropdown buttons
        document.querySelectorAll('.bid-details-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                const detailsDiv = btn.parentElement.nextElementSibling;
                const isVisible = detailsDiv.style.display !== 'none';
                
                // Hide all other bid details first
                document.querySelectorAll('.bid-details').forEach(div => {
                    div.style.display = 'none';
                });
                document.querySelectorAll('.bid-details-btn').forEach(b => {
                    b.textContent = 'Bids ▼';
                });
                
                // Toggle this one
                if (!isVisible) {
                    detailsDiv.style.display = 'block';
                    btn.textContent = 'Bids ▲';
                } else {
                    detailsDiv.style.display = 'none';
                    btn.textContent = 'Bids ▼';
                }
            });
        });

        // Handler for member acceptance updates
        const memberAcceptedHandler = (data) => {
            const statusEl = document.getElementById('waiting-status');
            if (statusEl) {
                statusEl.textContent = data.message;
            }
        };
        
        // Handler for all members accepted
        const allAcceptedHandler = () => {
            if (isDraftEnding) {
                console.log('[silentdraft] Ignoring allMembersAccepted while draft ending');
                return;
            }
            console.log('[silentdraft] All members accepted results, advancing round');
            const statusEl = document.getElementById('waiting-status');
            if (statusEl) {
                statusEl.textContent = 'All members accepted!';
            }
            
            // Clean up listeners
            window.draftSocket.off('memberAcceptedResults', memberAcceptedHandler);
            
            setTimeout(() => {
                if (resultsDiv && resultsDiv.parentNode) {
                    resultsDiv.parentNode.removeChild(resultsDiv);
                }
                onComplete();
            }, 1000);
        };

        // Attach listeners
        window.draftSocket.on('memberAcceptedResults', memberAcceptedHandler);
        window.draftSocket.once('allMembersAccepted', allAcceptedHandler);

        // Use setTimeout to ensure button is fully rendered before attaching handler
        setTimeout(() => {
            const acceptBtn = document.getElementById('accept-results-btn');
            console.log('[silentdraft] Accept button found:', acceptBtn ? 'YES' : 'NO');
            
            if (acceptBtn) {
                acceptBtn.addEventListener('click', function(e) {
                    console.log('[silentdraft] Accept button clicked!');
                    e.preventDefault();
                    e.stopPropagation();
                    
                    // Play success sound
                    try {
                        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                        const oscillator1 = audioContext.createOscillator();
                        const oscillator2 = audioContext.createOscillator();
                        const gainNode = audioContext.createGain();
                        
                        oscillator1.connect(gainNode);
                        oscillator2.connect(gainNode);
                        gainNode.connect(audioContext.destination);
                        
                        // Two-tone success chime
                        oscillator1.frequency.value = 800;
                        oscillator2.frequency.value = 1000;
                        oscillator1.type = 'sine';
                        oscillator2.type = 'sine';
                        
                        gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
                        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
                        
                        oscillator1.start(audioContext.currentTime);
                        oscillator2.start(audioContext.currentTime + 0.1);
                        oscillator1.stop(audioContext.currentTime + 0.3);
                        oscillator2.stop(audioContext.currentTime + 0.4);
                    } catch (e) {
                        console.log('[silentdraft] Audio not supported');
                    }
                    
                    this.disabled = true;
                    this.style.background = '#95a5a6';
                    this.textContent = 'Accepted ✓';
                    
                    // Notify server that this member accepted
                    if (window.draftSocket && currentDraftCode) {
                        console.log('[silentdraft] Emitting acceptRoundResults for:', username);
                        window.draftSocket.emit('acceptRoundResults', currentDraftCode, username, (response) => {
                            if (response && response.ok) {
                                console.log('[silentdraft] Acceptance recorded');
                            } else {
                                console.log('[silentdraft] Acceptance failed:', response);
                            }
                        });
                    } else {
                        console.log('[silentdraft] Cannot emit - socket:', !!window.draftSocket, 'code:', currentDraftCode);
                    }
                });
            } else {
                console.error('[silentdraft] Accept button not found in DOM!');
            }
        }, 100);
    }

    // Show processing bids modal
    function showProcessingBidsModal() {
        // Remove any existing processing modal
        const existingModal = document.getElementById('processing-bids-modal');
        if (existingModal) {
            existingModal.remove();
        }
        
        const modal = document.createElement('div');
        modal.id = 'processing-bids-modal';
        modal.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(15, 15, 15, 0.98);
            border: 2px solid #3498db;
            border-radius: 12px;
            padding: 30px;
            z-index: 10001;
            color: #f5f5f7;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.8);
            text-align: center;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;
        
        modal.innerHTML = `
            <div style="font-size: 18px; font-weight: bold; margin-bottom: 15px; color: #3498db;">
                Processing Bids...
            </div>
            <div style="font-size: 14px; color: #ccc; margin-bottom: 20px;">
                Calculating auction results and determining winners
            </div>
            <div style="display: inline-block; width: 40px; height: 40px; border: 3px solid #3498db; border-radius: 50%; border-top-color: transparent; animation: spin 1s linear infinite;"></div>
            <style>
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            </style>
        `;
        
        document.body.appendChild(modal);
        console.log('[silentdraft] Processing bids modal shown');
    }
    
    // Hide processing bids modal
    function hideProcessingBidsModal() {
        const modal = document.getElementById('processing-bids-modal');
        if (modal) {
            modal.remove();
            console.log('[silentdraft] Processing bids modal hidden');
        }
    } // end buildTeamsAndStartDraft

    // Start the draft
    startRound();
    
    // Initialize by loading players first, then draft state
    loadPlayers().then(() => {
        initializeDraft();
    }).catch(error => {
        console.error('[silentdraft] Failed to load players:', error);
        // Still try to initialize even if players fail to load
        initializeDraft();
    });
});