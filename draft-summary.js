document.addEventListener('DOMContentLoaded', () => {
    const DEFAULT_ROSTER_SETTINGS = { QB: 1, WR: 2, RB: 2, TE: 1, FLEX: 1, K: 1, DEF: 1, BN: 13 };
    const DEFAULT_BENCH_CUT_TARGET = 5;
    const MAX_DRAFT_BENCH = 13;
    const summaryMeta = document.getElementById('summaryMeta');
    const teamList = document.getElementById('teamList');
    const teamHeader = document.getElementById('teamHeader');
    const lineupGrid = document.getElementById('lineupGrid');
    const benchContainer = document.getElementById('benchContainer');

    const username = sessionStorage.getItem('username') || 'Your Team';
    let selectedTeamName = null;
    let draftSummary = loadSummary();

    let socket = window.draftSocket || null;
    if (!socket && window.io) {
        socket = window.io();
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

    function renderSummaryView() {
        updateSummaryMeta();
        renderTeamButtons();

        if (!selectedTeamName && draftSummary.teams.length > 0) {
            selectedTeamName = draftSummary.teams[0].name;
        }

        if (selectedTeamName) {
            renderSelectedTeam();
        }
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

                if (serverDraft.rosterSettings) {
                    draftSummary.rosterSettings = Object.assign({}, serverDraft.rosterSettings);
                }

                if (typeof serverDraft.benchCutTarget !== 'undefined') {
                    draftSummary.benchCutTarget = serverDraft.benchCutTarget;
                }

                refreshSummaryLimits();
                persistSummary();
            }

            onComplete();
        });
    }

    refreshSummaryLimits();

    if (socket && draftSummary.draftCode) {
        socket.emit('joinDraftRoom', draftSummary.draftCode, username);

        socket.on('benchUpdated', (data) => {
            const team = draftSummary.teams.find(t => t.name === data.teamName);
            if (!team) return;

            team.roster = Array.isArray(data.newRoster) ? data.newRoster : team.roster;
            persistSummary();
            refreshSummaryLimits();
            renderTeamButtons();

            if (!selectedTeamName || selectedTeamName === data.teamName) {
                selectedTeamName = data.teamName;
                renderSelectedTeam();
            }
        });

        syncSummaryFromServer(renderSummaryView);
    } else {
        renderSummaryView();
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
                const split = splitRoster(team.roster || [], summaryRosterSettings);
                const requiredCuts = getRequiredCuts(team.roster || [], split.bench);
                const cutText = requiredCuts > 0 ? `<div class="badge warning-badge">Needs ${requiredCuts} cut(s)</div>` : '';

                return `
                    <button class="team-btn ${selectedTeamName === team.name ? 'active' : ''}" data-team-name="${escapeHtml(team.name)}">
                        <div><strong>${escapeHtml(team.name)}</strong></div>
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

    function renderSelectedTeam() {
        const team = draftSummary.teams.find(t => t.name === selectedTeamName);
        if (!team) return;

        teamList.querySelectorAll('.team-btn').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-team-name') === team.name);
        });

        const { slots, bench } = splitRoster(team.roster || [], summaryRosterSettings);
        const remaining = Number.isFinite(team.budgetRemaining) ? team.budgetRemaining : null;
        const requiredCuts = getRequiredCuts(team.roster || [], bench);
        const isCurrentUserTeam = team.name === username;

        teamHeader.innerHTML = `
            <h2 class="team-title">${escapeHtml(team.name)}</h2>
            <div class="summary-meta team-meta">
                ${team.roster.length} players drafted
                ${remaining !== null ? ` | $${remaining} remaining` : ''}
                ${requiredCuts > 0 ? ` | <span class="warning">Needs ${requiredCuts} cut(s)</span>` : ''}
            </div>
        `;

        lineupGrid.innerHTML = slots.map(slot => renderLineupRow(slot.label, slot.player)).join('');

        renderBenchSection(team, slots, bench, requiredCuts, isCurrentUserTeam);
    }

    function renderBenchSection(team, slots, bench, requiredCuts, isCurrentUserTeam) {
        const benchIdSet = new Set(
            (bench || [])
                .map(player => Number(player.id))
                .filter(id => Number.isFinite(id))
        );

        const buildBenchRows = (withCheckboxes = false) => {
            if (bench.length === 0) {
                return '<div class="bench-empty">No bench players.</div>';
            }

            return bench.map(player => {
                const baseContent = `
                    <span class="bench-pos">${escapeHtml(player.position || 'N/A')}</span>
                    <span class="bench-player">${escapeHtml(player.name || 'Unknown')} - $${Number(player.bid || 0)}</span>
                    <span class="bench-rank">Rank ${Number(player.prerank || 999)}</span>
                `;

                if (!withCheckboxes) {
                    return `<div class="bench-item">${baseContent}</div>`;
                }

                return `
                    <label class="bench-item bench-item-cut">
                        <span class="bench-main">${baseContent}</span>
                        <input
                            class="bench-cut-toggle"
                            type="checkbox"
                            name="cut"
                            value="${escapeHtml(player.id !== undefined && player.id !== null ? String(player.id) : '')}"
                            data-player-name="${escapeHtml(player.name || 'Unknown')}"
                            aria-label="Cut ${escapeHtml(player.name || 'Unknown')}"
                        >
                    </label>
                `;
            }).join('');
        };

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

        const benchListHtml = `<div class="bench-list">${buildBenchRows(false)}</div>`;

        if (requiredCuts <= 0) {
            benchContainer.innerHTML = benchListHtml;
            return;
        }

        if (!isCurrentUserTeam) {
            benchContainer.innerHTML = `
                <div class="cut-panel">
                    <p class="warning">This team must cut ${requiredCuts} player(s) to reach max ${maxTotalPlayers} total and max ${maxBenchPlayers} bench.</p>
                </div>
                ${benchListHtml}
            `;
            return;
        }

        benchContainer.innerHTML = `
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
            <div class="cut-panel">
                <h4>Bench View</h4>
                ${benchListHtml}
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