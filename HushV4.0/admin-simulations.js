document.addEventListener('DOMContentLoaded', () => {
  const ADMIN_KEY_STORAGE_KEY = 'adminApiKey';
  const LOBBY_DEFAULT_ROSTER_SETTINGS = { QB: 1, WR: 2, RB: 2, TE: 1, FLEX: 1, SPFLEX: 0, K: 1, DEF: 1, BN: 5 };

  const connectForm = document.getElementById('adminConnectForm');
  const adminKeyInput = document.getElementById('adminKeyInput');
  const adminConnectStatus = document.getElementById('adminConnectStatus');
  const simulateBatchBtn = document.getElementById('simulateBatchBtn');
  const simulationDraftCount = document.getElementById('simulationDraftCount');
  const simulationStatus = document.getElementById('simulationStatus');
  const simulationOutput = document.getElementById('simulationOutput');
  const teamSummaryOutput = document.getElementById('teamSummaryOutput');
  const filterDraftNumber = document.getElementById('filterDraftNumber');
  const filterTeamName = document.getElementById('filterTeamName');
  const filterMinBid = document.getElementById('filterMinBid');
  const clearFiltersBtn = document.getElementById('clearFiltersBtn');
  const loadLobbySettingsBtn = document.getElementById('loadLobbySettingsBtn');
  const simulationLobbySummary = document.getElementById('simulationLobbySummary');
  const simRosterInputs = {
    QB: document.getElementById('simRosterQB'),
    WR: document.getElementById('simRosterWR'),
    RB: document.getElementById('simRosterRB'),
    TE: document.getElementById('simRosterTE'),
    FLEX: document.getElementById('simRosterFLEX'),
    SPFLEX: document.getElementById('simRosterSPFLEX'),
    K: document.getElementById('simRosterK'),
    DEF: document.getElementById('simRosterDEF'),
    BN: document.getElementById('simRosterBN')
  };
  const simBenchCutTarget = document.getElementById('simBenchCutTarget');
  const simRoundTimerMinutes = document.getElementById('simRoundTimerMinutes');
  const simAjDraftMode = document.getElementById('simAjDraftMode');
  const simWaiverMode = document.getElementById('simWaiverMode');
  let lastSimulationResult = null;

  function getSelectedDraftCount() {
    const selected = Number.parseInt(String(simulationDraftCount?.value || '15').trim(), 10);
    return Number.isFinite(selected) && selected > 0 ? selected : 15;
  }

  function updateSimulateButtonLabel() {
    if (!simulateBatchBtn) return;
    const draftCount = getSelectedDraftCount();
    simulateBatchBtn.textContent = `Simulate (${draftCount} Draft${draftCount === 1 ? '' : 's'})`;
  }

  function getStoredAdminKey() {
    try {
      return String(localStorage.getItem(ADMIN_KEY_STORAGE_KEY) || '').trim();
    } catch (_error) {
      return '';
    }
  }

  function getAdminKey() {
    const typed = String(adminKeyInput?.value || '').trim();
    return typed || getStoredAdminKey();
  }

  function setStatus(message, tone = 'info') {
    if (!simulationStatus) return;
    simulationStatus.textContent = message || '';
    simulationStatus.dataset.tone = tone;
  }

  function setConnectStatus(message) {
    if (!adminConnectStatus) return;
    adminConnectStatus.textContent = message || '';
  }

  async function requestJson(url, options = {}) {
    const response = await fetch(url, options);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || `Request failed (${response.status})`);
    }
    return payload;
  }

  async function verifyConnection() {
    const adminKey = getAdminKey();
    if (!adminKey) {
      throw new Error('Enter admin key first.');
    }

    await requestJson('/api/admin/traffic', {
      headers: {
        'x-admin-key': adminKey
      }
    });

    try {
      localStorage.setItem(ADMIN_KEY_STORAGE_KEY, adminKey);
    } catch (_error) {
      // ignore
    }
  }

  function formatPlayerLine(player, index) {
    const safe = player || {};
    const name = String(safe.name || 'Unknown');
    const position = String(safe.position || 'UNK');
    const bid = Number(safe.bid || 0);
    const prerank = Number.isFinite(Number(safe.prerank)) ? `#${Number(safe.prerank)}` : '#-';
    return `${String(index + 1).padStart(2, '0')}. ${name} (${position}) - $${bid} [${prerank}]`;
  }

  function getFilters() {
    const draftNumber = Number.parseInt(String(filterDraftNumber?.value || '').trim(), 10);
    const minBid = Number.parseInt(String(filterMinBid?.value || '').trim(), 10);
    return {
      draftNumber: Number.isFinite(draftNumber) && draftNumber > 0 ? draftNumber : null,
      teamName: String(filterTeamName?.value || '').trim().toLowerCase(),
      minBid: Number.isFinite(minBid) && minBid > 0 ? minBid : 0
    };
  }

  function normalizedTeamKey(value) {
    return String(value || '').trim().toLowerCase();
  }

  function toInt(value, fallback, min, max) {
    const parsed = Number.parseInt(String(value ?? '').trim(), 10);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(min, Math.min(max, parsed));
  }

  function normalizeRosterSettings(raw) {
    const merged = Object.assign({}, LOBBY_DEFAULT_ROSTER_SETTINGS, raw || {});
    return {
      QB: toInt(merged.QB, LOBBY_DEFAULT_ROSTER_SETTINGS.QB, 0, 8),
      WR: toInt(merged.WR, LOBBY_DEFAULT_ROSTER_SETTINGS.WR, 0, 10),
      RB: toInt(merged.RB, LOBBY_DEFAULT_ROSTER_SETTINGS.RB, 0, 10),
      TE: toInt(merged.TE, LOBBY_DEFAULT_ROSTER_SETTINGS.TE, 0, 8),
      FLEX: toInt(merged.FLEX, LOBBY_DEFAULT_ROSTER_SETTINGS.FLEX, 0, 5),
      SPFLEX: toInt(merged.SPFLEX, LOBBY_DEFAULT_ROSTER_SETTINGS.SPFLEX, 0, 5),
      K: toInt(merged.K, LOBBY_DEFAULT_ROSTER_SETTINGS.K, 0, 5),
      DEF: toInt(merged.DEF, LOBBY_DEFAULT_ROSTER_SETTINGS.DEF, 0, 5),
      BN: toInt(merged.BN, LOBBY_DEFAULT_ROSTER_SETTINGS.BN, 0, 20)
    };
  }

  function getCurrentLobbyDraft() {
    try {
      const currentDraftCode = String(sessionStorage.getItem('currentDraft') || '').trim();
      const drafts = JSON.parse(String(localStorage.getItem('drafts') || '{}'));
      if (currentDraftCode && drafts && typeof drafts === 'object' && drafts[currentDraftCode]) {
        return drafts[currentDraftCode];
      }
    } catch (_error) {
      // ignore
    }
    return null;
  }

  function summarizeLobbySettings(settings) {
    if (!simulationLobbySummary) return;
    const roster = normalizeRosterSettings(settings?.rosterSettings || settings || {});
    const benchCutTarget = toInt(settings?.benchCutTarget, 5, 0, 13);
    const roundTimerMinutes = toInt(settings?.roundTimerMinutes, 10, 3, 10);
    const waiverMode = String(settings?.waiverMode || 'off').trim().toLowerCase() || 'off';
    const ajDraftMode = Boolean(settings?.ajDraftMode);
    simulationLobbySummary.textContent = `Roster QB ${roster.QB}, WR ${roster.WR}, RB ${roster.RB}, TE ${roster.TE}, FLEX ${roster.FLEX}, SPFLEX ${roster.SPFLEX}, K ${roster.K}, DEF ${roster.DEF}, BN ${roster.BN} | Bench cut ${benchCutTarget} | Round timer ${roundTimerMinutes} min | A-J complex ${ajDraftMode ? 'on' : 'off'} | Waiver ${waiverMode}`;
  }

  function applyLobbySettingsToSimulationForm(settings) {
    const roster = normalizeRosterSettings(settings?.rosterSettings || settings || {});
    Object.entries(simRosterInputs).forEach(([key, input]) => {
      if (!input) return;
      input.value = String(roster[key]);
    });
    if (simBenchCutTarget) simBenchCutTarget.value = String(toInt(settings?.benchCutTarget, 5, 0, 13));
    if (simRoundTimerMinutes) simRoundTimerMinutes.value = String(toInt(settings?.roundTimerMinutes, 10, 3, 10));
    if (simAjDraftMode) simAjDraftMode.checked = Boolean(settings?.ajDraftMode ?? true);
    if (simWaiverMode) simWaiverMode.value = String(settings?.waiverMode || 'off');
    summarizeLobbySettings(settings);
  }

  function getSimulationRosterSettings() {
    return normalizeRosterSettings({
      QB: simRosterInputs.QB?.value,
      WR: simRosterInputs.WR?.value,
      RB: simRosterInputs.RB?.value,
      TE: simRosterInputs.TE?.value,
      FLEX: simRosterInputs.FLEX?.value,
      SPFLEX: simRosterInputs.SPFLEX?.value,
      K: simRosterInputs.K?.value,
      DEF: simRosterInputs.DEF?.value,
      BN: simRosterInputs.BN?.value
    });
  }

  function getLobbySettingsPayload() {
    return {
      rosterSettings: getSimulationRosterSettings(),
      benchCutTarget: toInt(simBenchCutTarget?.value, 5, 0, 13),
      roundTimerMinutes: toInt(simRoundTimerMinutes?.value, 10, 3, 10),
      ajDraftMode: Boolean(simAjDraftMode?.checked),
      waiverMode: String(simWaiverMode?.value || 'off').trim().toLowerCase() || 'off'
    };
  }

  function buildSimulationReport(result, filters = {}) {
    const simulation = result?.simulation || {};
    const config = simulation?.config || {};
    const aggregate = simulation?.aggregate || {};
    const scorecard = simulation?.scorecard || {};
    const budget = scorecard?.budget || {};
    const competition = scorecard?.competition || {};
    const timing = scorecard?.timing || {};
    const roundSpendConsistency = timing?.roundSpendConsistency || {};
    const roundBudgetTracker = timing?.roundBudgetTracker || {};
    const spendSmoothness = timing?.spendSmoothness || {};
    const completion = scorecard?.completion || {};
    const overall = scorecard?.overall || {};
    const flags = Array.isArray(scorecard?.flags) ? scorecard.flags : [];
    const drafts = Array.isArray(simulation?.drafts) ? simulation.drafts : [];
    const thresholdDebugExamples = Array.isArray(simulation?.thresholdDebugExamples) ? simulation.thresholdDebugExamples : [];
    const filterDraft = Number(filters.draftNumber || 0);
    const filterTeam = normalizedTeamKey(filters.teamName || '');
    const filterMinBid = Math.max(0, Number(filters.minBid || 0));
    const playerThresholdSamples = thresholdDebugExamples
      .filter((sample) => sample && sample.sampleType === 'playerThreshold');
    const roundSnapshotSamples = thresholdDebugExamples
      .filter((sample) => sample && sample.sampleType === 'roundSnapshot');
    const selectedThresholdTeam = filterTeam
      || normalizedTeamKey(playerThresholdSamples[0]?.teamName || '')
      || normalizedTeamKey(roundSnapshotSamples[0]?.teamName || '');
    const selectedThresholdSamples = roundSnapshotSamples
      .filter((sample) => normalizedTeamKey(sample?.teamName || '') === selectedThresholdTeam)
      .sort((a, b) => {
        const roundDiff = Number(a?.round || 0) - Number(b?.round || 0);
        if (roundDiff !== 0) return roundDiff;
        return String(a?.teamName || '').localeCompare(String(b?.teamName || ''));
      });
    const selectedPlayerThresholdSamples = playerThresholdSamples
      .filter((sample) => normalizedTeamKey(sample?.teamName || '') === selectedThresholdTeam)
      .sort((a, b) => {
        const roundDiff = Number(a?.round || 0) - Number(b?.round || 0);
        if (roundDiff !== 0) return roundDiff;
        const passDiff = Number(Boolean(b?.passesThreshold)) - Number(Boolean(a?.passesThreshold));
        if (passDiff !== 0) return passDiff;
        const valueDiff = Number(b?.teamValue || 0) - Number(a?.teamValue || 0);
        if (valueDiff !== 0) return valueDiff;
        return String(a?.playerName || '').localeCompare(String(b?.playerName || ''));
      });

    const lines = [];
    lines.push(`Simulation complete in ${result?.durationMs || 0} ms`);
    lines.push(`Drafts: ${config.draftCount || 0} | Teams per draft: ${config.teamCount || 0} | Rounds: ${config.rounds || 0}`);
    lines.push(`Forced spread mode: ${typeof config.forceSpread === 'boolean' ? (config.forceSpread ? 'ON' : 'OFF') : 'default auto'}`);
    if (config.lobbySettings) {
      const lobbyRoster = normalizeRosterSettings(config.lobbySettings.rosterSettings || config.rosterSettings || {});
      const lobbyBench = toInt(config.lobbySettings.benchCutTarget, 5, 0, 13);
      const lobbyTimer = toInt(config.lobbySettings.roundTimerMinutes, 10, 3, 10);
      const lobbyAj = Boolean(config.lobbySettings.ajDraftMode);
      const lobbyWaiver = String(config.lobbySettings.waiverMode || 'off').trim().toLowerCase() || 'off';
      lines.push(`Lobby setup: roster QB ${lobbyRoster.QB}, WR ${lobbyRoster.WR}, RB ${lobbyRoster.RB}, TE ${lobbyRoster.TE}, FLEX ${lobbyRoster.FLEX}, SPFLEX ${lobbyRoster.SPFLEX}, K ${lobbyRoster.K}, DEF ${lobbyRoster.DEF}, BN ${lobbyRoster.BN} | Bench cut ${lobbyBench} | Round timer ${lobbyTimer} min | AJ complex ${lobbyAj ? 'on' : 'off'} | Waiver ${lobbyWaiver}`);
    }
    lines.push('');
    lines.push('Plain-English takeaway:');
    lines.push('- CPU strategy still decides who gets bids.');
    lines.push('- Round totals below are based on bids placed (not only winning prices).');
    lines.push('- In rounds 8, 9, and 10, those bids are rebalanced so the team uses all remaining budget.');
    lines.push('');
    lines.push('Requested summary metrics:');
    lines.push(`- completionRate = ${Number(aggregate.completionRate || 0)}`);
    lines.push(`- allCompleteDraftRate = ${Number(aggregate.allCompleteDraftRate || 0)}`);
    lines.push(`- avgRosterCount = ${Number(aggregate.avgRosterCount || 0)}`);
    lines.push(`- avgUndraftedCount = ${Number(aggregate.avgUndraftedCount || 0)}`);
    lines.push(`- medianUndraftedCount = ${Number(aggregate.medianUndraftedCount || 0)}`);
    lines.push(`- p90UndraftedCount = ${Number(aggregate.p90UndraftedCount || 0)}`);
    lines.push(`- realismScore = ${Number(overall.realismScore || 0)}`);
    lines.push(`- flags = ${flags.length > 0 ? flags.join(', ') : 'none'}`);
    lines.push('');
    lines.push(`Overall realism: ${Number(overall.realismScore || 0)}/100`);
    lines.push(`Draft completion: ${(Number(completion.teamCompletionRate || 0) * 100).toFixed(1)}% of teams finished | ${(Number(completion.allCompleteDraftRate || 0) * 100).toFixed(1)}% of drafts had everyone finish`);
    lines.push(`Undrafted players per draft: avg ${Number(aggregate.avgUndraftedCount || 0)}, median ${Number(aggregate.medianUndraftedCount || 0)}, p90 ${Number(aggregate.p90UndraftedCount || 0)}`);
    lines.push(`Money left at the end: avg $${Number(budget.avgRemaining || 0)}, median $${Number(budget.medianRemaining || 0)}, p90 $${Number(budget.p90Remaining || 0)}`);
    lines.push(`How competitive bidding was: contest rate ${Number(competition.contestRate || 0)}, bid participation ${Number(competition.bidParticipationRate || 0)}, avg bids per auction ${Number(competition.avgBidsPerActiveAuction || 0)}, avg winning price $${Number(competition.avgWinningPrice || 0)}`);
    lines.push(`Starter fill timing: ${Number(timing.starterCompletionRate || 0)} complete by the starter deadline, average starter finished round ${timing.avgStarterCompletionRound ?? 'n/a'}`);
    lines.push(`Late-round bid pressure check: round 1 avg total bids $${Number(roundSpendConsistency.roundOneAvgBidsPlaced || roundSpendConsistency.roundOneAvgSpend || 0)}, last round avg total bids $${Number(roundSpendConsistency.lastRoundAvgBidsPlaced || roundSpendConsistency.lastRoundAvgSpend || 0)}, drop from round 1 to last round ${Number(roundSpendConsistency.roundOneToLastDropPct || 0)}%, biggest drop between any two rounds ${Number(roundSpendConsistency.maxRoundToRoundDropPct || 0)}%`);
    lines.push(`Final-round bid pressure: ${Number(roundSpendConsistency.lastRoundBidUtilizationPct || roundSpendConsistency.lastRoundSpendUtilizationPct || 0)}% of the money available was committed in bids`);
    lines.push(`Spend smoothness: ${Number(spendSmoothness.score || 0)}/100 (${String(spendSmoothness.label || 'unknown')})`);
    const roundSpendRows = Array.isArray(roundSpendConsistency.rounds) ? roundSpendConsistency.rounds : [];
    if (roundSpendRows.length > 0) {
      lines.push('Round-by-round bids placed:');
      roundSpendRows.forEach((row) => {
        lines.push(`- Round ${Number(row.round || 0)}: average total bids $${Number(row.avgTotalBidsPlaced || row.avgSpend || 0)} out of $${Number(row.avgPotentialSpend || 0)} available (${Number(row.spendUtilizationPct || 0)}% committed, $${Number(row.avgBidAmountPerTeam || row.avgSpendPerTeam || 0)} per team, ${Number(row.pctOfRoundOne || 0)}% of round 1, ${Number(row.dropFromPrevPct || 0)}% change vs previous round)`);
      });
    }
    const budgetRows = Array.isArray(roundBudgetTracker.rounds) ? roundBudgetTracker.rounds : [];
    if (budgetRows.length > 0) {
      lines.push('Average money left per team by round:');
      budgetRows.forEach((row) => {
        lines.push(`- Round ${Number(row.round || 0)}: before $${Number(row.avgMoneyLeftPerTeamBeforeRound || 0)}, bids/team $${Number(row.avgBidAmountPerTeam || row.avgSpendPerTeam || 0)}, after $${Number(row.avgMoneyLeftPerTeamAfterRound || 0)}`);
      });
    }
    if (selectedPlayerThresholdSamples.length > 0) {
      const selectedTeamLabel = String(selectedPlayerThresholdSamples[0]?.teamName || selectedThresholdTeam || 'selected team');
      lines.push(`Per-player thresholds for ${selectedTeamLabel}:`);
      let activeRound = null;
      selectedPlayerThresholdSamples.forEach((sample) => {
        const round = Number(sample?.round || 0);
        if (round !== activeRound) {
          activeRound = round;
          lines.push(`- Round ${round}:`);
        }
        const teamValue = Number(sample?.teamValue || 0);
        const thresholdBase = Number(sample?.thresholdBase || 0);
        const effectiveThreshold = Number(sample?.effectiveThreshold || 0);
        const gap = Number((teamValue - effectiveThreshold).toFixed(3));
        const action = sample?.passesThreshold ? 'passes threshold' : `below threshold by ${Math.abs(gap).toFixed(3)}`;
        lines.push(
          `  ${String(sample?.playerName || 'Unknown')} (${String(sample?.position || 'UNK')}) | AV=${Number(sample?.avgValue || 0)} | draftChance=${Number(sample?.draftChance || 0)} | teamValue=${teamValue.toFixed(3)} | interestBase=${thresholdBase.toFixed(3)} | effectiveInterest=${effectiveThreshold.toFixed(3)} | gap=${gap.toFixed(3)} | ${action}`
        );
      });
    }
    if (selectedThresholdSamples.length > 0) {
      const selectedTeamLabel = String(selectedThresholdSamples[0]?.teamName || selectedThresholdTeam || 'selected team');
      lines.push(`Interest timeline for ${selectedTeamLabel}:`);
      selectedThresholdSamples.forEach((sample) => {
        const round = Number(sample.round || 0);
        const teamName = String(sample.teamName || 'Team');
        const playerName = String(sample.playerName || 'Unknown');
        const position = String(sample.position || 'UNK');
        const avgValue = Number(sample.avgValue || 0);
        const draftChance = Number(sample.draftChance || 0);
        const teamValue = Number(sample.teamValue || 0);
        const thresholdBase = Number(sample.thresholdBase || 0);
        const effectiveThreshold = Number(sample.effectiveThreshold || 0);
        const debtWidening = Number(sample.debtWidening || 0);
        const winRateWidening = Number(sample.winRateWidening || 0);
        const pressureWidening = Number(sample.pressureWidening || 0);
        const floorWidening = Number(sample.floorWidening || 0);
        const floorEndgameWidening = Number(sample.floorEndgameWidening || 0);
        const lateRoundPaceWidening = Number(sample.lateRoundPaceWidening || 0);
        const stageSinceLateStart = Number(sample.stageSinceLateStart || 0);
        const requiredWinsPerRound = Number(sample.requiredWinsPerRound || 0);
        const baselineWinsPerRound = Number(sample.baselineWinsPerRound || 0);
        const rosterSpotsLeft = Number(sample.rosterSpotsLeft || 0);
        const isBehindPace = sample.isBehindPace ? 'yes' : 'no';
        const passFail = sample.passesThreshold ? 'PASS' : 'FAIL';
        lines.push(
          `- Round ${round} | ${teamName} | ${playerName} (${position}) | AV=${avgValue} | draftChance=${draftChance} | teamValue=${teamValue.toFixed(3)} | interestBase=${thresholdBase.toFixed(3)} | effectiveInterest=${effectiveThreshold.toFixed(3)} | wideners debt=${debtWidening.toFixed(3)}, winRate=${winRateWidening.toFixed(3)}, pressure=${pressureWidening.toFixed(3)}, floor=${floorWidening.toFixed(3)}, floorEnd=${floorEndgameWidening.toFixed(3)}, latePace=${lateRoundPaceWidening.toFixed(3)} | behindPace=${isBehindPace} | reqWins=${requiredWinsPerRound.toFixed(2)} vs base=${baselineWinsPerRound.toFixed(2)} | spotsLeft=${rosterSpotsLeft} | lateStage=${stageSinceLateStart} | ${passFail}`
        );
      });
    } else if (roundSnapshotSamples.length > 0 || playerThresholdSamples.length > 0) {
      lines.push(`No interest timeline samples matched team filter "${filterTeam}".`);
    }
    if (flags.length > 0) {
      lines.push(`Flags: ${flags.join(', ')}`);
    }
    lines.push(`Filters: draft=${filterDraft || 'all'}, team=${filterTeam || 'all'}, minBid=${filterMinBid || 'all'}`);
    lines.push('');

    let visibleDrafts = 0;
    let visibleTeams = 0;
    let visiblePlayers = 0;

    drafts.forEach((draft) => {
      const draftNum = Number(draft?.draftNumber || 0);
      if (filterDraft > 0 && draftNum !== filterDraft) return;

      const teams = (Array.isArray(draft?.teams) ? draft.teams : []).filter((team) => {
        if (!filterTeam) return true;
        return normalizedTeamKey(team?.name || '') === filterTeam;
      });
      if (teams.length === 0) return;

      visibleDrafts += 1;
      visibleTeams += teams.length;
      lines.push(`=== Draft ${Number(draft?.draftNumber || 0)} | Completion ${(Number(draft?.completionRate || 0) * 100).toFixed(1)}% (${Number(draft?.completeTeams || 0)}/${Number(draft?.teamCount || 0)}) ===`);
      lines.push(`Undrafted in this draft: ${Number(draft?.undraftedCount || 0)}`);
      const undraftedByPosition = draft?.undraftedByPosition || {};
      const undraftedPosParts = Object.entries(undraftedByPosition)
        .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
        .map(([position, count]) => `${position}:${Number(count || 0)}`);
      if (undraftedPosParts.length > 0) {
        lines.push(`Undrafted by position: ${undraftedPosParts.join(', ')}`);
      }
      teams.forEach((team) => {
        const teamName = String(team?.name || 'Team');
        const cpuProfileApproach = String(team?.cpuProfileApproach || '').trim();
        const profileSuffix = cpuProfileApproach ? ` | profile=${cpuProfileApproach}` : '';
        const starTargetTotal = Number(team?.starTargetTotal || 0);
        const starTargetHitCount = Number(team?.starTargetHitCount || 0);
        const starTargetHitPct = Number(team?.starTargetHitPct || 0);
        const starTargetNames = (Array.isArray(team?.starTargets) ? team.starTargets : [])
          .slice(0, 6)
          .map((target) => String(target?.name || '').trim())
          .filter(Boolean);
        const starTargetSuffix = starTargetTotal > 0
          ? ` | targets=${starTargetHitCount}/${starTargetTotal} (${starTargetHitPct.toFixed(1)}%) | starList=${starTargetNames.join(', ') || 'none'}`
          : '';
        const rosterCount = Number(team?.rosterCount || 0);
        const budgetSpent = Number(team?.budgetSpent || 0);
        const budgetRemaining = Number(team?.budgetRemaining || 0);
        const completeMark = team?.complete ? 'yes' : 'no';
        const starterRound = team?.starterCompletedRound ?? 'n/a';
        lines.push(`${teamName}${profileSuffix}${starTargetSuffix} | roster=${rosterCount} | spent=$${budgetSpent} | left=$${budgetRemaining} | complete=${completeMark} | starterRound=${starterRound}`);

        const roster = (Array.isArray(team?.roster) ? team.roster : [])
          .filter(player => Number(player?.bid || 0) >= filterMinBid);
        visiblePlayers += roster.length;
        if (roster.length === 0) {
          lines.push('  (no players match current filters)');
        } else {
          roster.forEach((player, idx) => {
            lines.push(`  ${formatPlayerLine(player, idx)}`);
          });
        }
      });

      const roundBidDetails = Array.isArray(draft?.roundBidDetails) ? draft.roundBidDetails : [];
      if (roundBidDetails.length > 0) {
        lines.push('  Round bid totals (this draft):');
        roundBidDetails.forEach((roundInfo) => {
          lines.push(`  - Round ${Number(roundInfo?.round || 0)}: total bids placed $${Number(roundInfo?.totalBidAmount || 0)} | per-team bids $${Number(roundInfo?.avgBidAmountPerTeam || 0)}`);
          const playerBidTotals = Array.isArray(roundInfo?.playerBidTotals) ? roundInfo.playerBidTotals : [];
          if (playerBidTotals.length === 0) {
            lines.push('      (no bids placed)');
            return;
          }
          playerBidTotals.forEach((playerRow) => {
            lines.push(`      ${String(playerRow?.playerName || 'Unknown')}: $${Number(playerRow?.totalBidAmount || 0)} from ${Number(playerRow?.bidCount || 0)} bids`);
          });
        });
      }

      lines.push('');
    });

    if (visibleDrafts === 0) {
      lines.push('No drafts match current filters.');
    } else {
      lines.push(`Visible results: drafts=${visibleDrafts}, teams=${visibleTeams}, players=${visiblePlayers}`);
    }

    return lines.join('\n');
  }

  function formatTraceRoster(roster) {
    const safeRoster = Array.isArray(roster) ? roster : [];
    if (safeRoster.length === 0) return '(empty)';
    return safeRoster
      .map((player) => `${String(player?.name || 'Unknown')} (${String(player?.position || 'UNK')}) $${Number(player?.bid || 0)}`)
      .join(', ');
  }

  function buildTeamSummaryReport(result, filters = {}) {
    const simulation = result?.simulation || {};
    const teamTrace = simulation?.teamTrace || null;
    const thresholdDebugExamples = Array.isArray(simulation?.thresholdDebugExamples) ? simulation.thresholdDebugExamples : [];
    const tracedTeamFilter = String(filters.teamName || teamTrace?.teamNameFilter || '').trim();
    const normalizedTracedTeamFilter = normalizedTeamKey(tracedTeamFilter);

    if (!teamTrace || !Array.isArray(teamTrace.rounds) || teamTrace.rounds.length === 0) {
      return tracedTeamFilter
        ? `No detailed trace was returned for team filter "${tracedTeamFilter}". Try a more exact team filter like Team 1 and rerun the simulation.`
        : 'Enter a team filter such as Team 1, then rerun the simulation to get a detailed round-by-round trace.';
    }

    const playerThresholdSamples = thresholdDebugExamples
      .filter((sample) => sample && sample.sampleType === 'playerThreshold')
      .filter((sample) => Number(sample?.round || 0) > 0)
      .filter((sample) => {
        if (!normalizedTracedTeamFilter) return true;
        return normalizedTeamKey(sample?.teamName || '') === normalizedTracedTeamFilter;
      });

    const thresholdByRoundTeamPlayer = new Map();
    playerThresholdSamples.forEach((sample) => {
      const key = [
        Number(teamTrace?.draftNumber || 0),
        Number(sample?.round || 0),
        String(sample?.teamName || ''),
        Number(sample?.playerId || 0)
      ].join('|');
      thresholdByRoundTeamPlayer.set(key, sample);
    });

    const thresholdSamplesByRoundTeam = new Map();
    playerThresholdSamples.forEach((sample) => {
      const key = [
        Number(teamTrace?.draftNumber || 0),
        Number(sample?.round || 0),
        String(sample?.teamName || '')
      ].join('|');
      if (!thresholdSamplesByRoundTeam.has(key)) {
        thresholdSamplesByRoundTeam.set(key, []);
      }
      thresholdSamplesByRoundTeam.get(key).push(sample);
    });

    const lines = [];
    lines.push(`Detailed trace for draft ${Number(teamTrace?.draftNumber || 0)} | team filter=${tracedTeamFilter || teamTrace?.teamNameFilter || 'all'}`);
    lines.push('');

    const tracedTeams = Array.isArray(teamTrace?.teams) ? teamTrace.teams : [];
    tracedTeams.forEach((teamMeta) => {
      const starTargets = Array.isArray(teamMeta?.starTargets) ? teamMeta.starTargets : [];
      const acquiredTargets = Array.isArray(teamMeta?.acquiredTargets) ? teamMeta.acquiredTargets : [];
      lines.push(`${String(teamMeta?.teamName || 'Team')} target summary:`);
      lines.push(`- Target hit rate: ${Number(teamMeta?.starTargetHitCount || 0)}/${Number(teamMeta?.starTargetTotal || 0)} (${Number(teamMeta?.starTargetHitPct || 0).toFixed(1)}%)`);
      lines.push(`- Starred targets: ${starTargets.length > 0 ? starTargets.map((target) => `${String(target?.name || 'Unknown')} (${String(target?.position || 'UNK')})`).join(', ') : 'none'}`);
      lines.push(`- Won targets: ${acquiredTargets.length > 0 ? acquiredTargets.map((target) => `${String(target?.name || 'Unknown')} (${String(target?.position || 'UNK')}) $${Number(target?.bid || 0)}`).join(', ') : 'none'}`);
      lines.push('');
    });

    teamTrace.rounds.forEach((roundEntry) => {
      const roundNumber = Number(roundEntry?.round || 0);
      const teams = Array.isArray(roundEntry?.teams) ? roundEntry.teams : [];
      teams.forEach((team) => {
        const teamName = String(team?.teamName || 'Team');
        const profileBits = [String(team?.cpuProfileApproach || '').trim(), String(team?.cpuProfileLabel || '').trim()].filter(Boolean);
        lines.push(`=== Round ${roundNumber} | ${teamName}${profileBits.length ? ` | profile=${profileBits.join(' / ')}` : ''} ===`);
        const roundStarTargets = (Array.isArray(team?.starTargets) ? team.starTargets : []).slice(0, 6);
        if (roundStarTargets.length > 0) {
          lines.push(`Star targets: ${roundStarTargets.map((target) => `${String(target?.name || 'Unknown')} (${String(target?.position || 'UNK')})`).join(', ')}`);
        }
        lines.push(`Budget: before $${Number(team?.budgetBefore || 0)} | after $${Number(team?.budgetAfter || 0)}`);
        lines.push(`Roster before (${Array.isArray(team?.rosterBefore) ? team.rosterBefore.length : 0}): ${formatTraceRoster(team?.rosterBefore)}`);

        const thresholdGroupKey = [
          Number(teamTrace?.draftNumber || 0),
          roundNumber,
          teamName
        ].join('|');
        const roundThresholdSamples = (thresholdSamplesByRoundTeam.get(thresholdGroupKey) || [])
          .slice()
          .sort((a, b) => {
            const passDiff = Number(Boolean(b?.passesThreshold)) - Number(Boolean(a?.passesThreshold));
            if (passDiff !== 0) return passDiff;
            const valueDiff = Number(b?.teamValue || 0) - Number(a?.teamValue || 0);
            if (valueDiff !== 0) return valueDiff;
            return String(a?.playerName || '').localeCompare(String(b?.playerName || ''));
          });
        const bidIds = new Set((Array.isArray(team?.bidsPlaced) ? team.bidsPlaced : []).map((bid) => Number(bid?.playerId || 0)).filter(Boolean));

        const bidsPlaced = Array.isArray(team?.bidsPlaced) ? team.bidsPlaced : [];
        if (bidsPlaced.length === 0) {
          lines.push('Bids placed: none');
        } else {
          lines.push('Bids placed:');
          bidsPlaced.forEach((bid) => {
            const thresholdKey = [
              Number(teamTrace?.draftNumber || 0),
              roundNumber,
              teamName,
              Number(bid?.playerId || 0)
            ].join('|');
            const thresholdSample = thresholdByRoundTeamPlayer.get(thresholdKey);
            if (thresholdSample) {
              lines.push(
                `- ${String(bid?.playerName || 'Unknown')} (${String(bid?.position || 'UNK')}) bid=$${Number(bid?.cpuBid || 0)} | AV=${Number(bid?.avgValue || 0)} | teamValue=${Number(thresholdSample?.teamValue || 0).toFixed(3)} | interestBase=${Number(thresholdSample?.thresholdBase || 0).toFixed(3)} | effectiveInterest=${Number(thresholdSample?.effectiveThreshold || 0).toFixed(3)} | pass=${thresholdSample?.passesThreshold ? 'yes' : 'no'} | wideners debt=${Number(thresholdSample?.debtWidening || 0).toFixed(3)}, winRate=${Number(thresholdSample?.winRateWidening || 0).toFixed(3)}, pressure=${Number(thresholdSample?.pressureWidening || 0).toFixed(3)}, floor=${Number(thresholdSample?.floorWidening || 0).toFixed(3)}, floorEnd=${Number(thresholdSample?.floorEndgameWidening || 0).toFixed(3)}, latePace=${Number(thresholdSample?.lateRoundPaceWidening || 0).toFixed(3)}`
              );
            } else {
              lines.push(`- ${String(bid?.playerName || 'Unknown')} (${String(bid?.position || 'UNK')}) bid=$${Number(bid?.cpuBid || 0)} | AV=${Number(bid?.avgValue || 0)} | threshold sample unavailable`);
            }
          });
        }

        if (roundThresholdSamples.length === 0) {
          lines.push('Interest / threshold board: no threshold-evaluated players captured');
        } else {
          lines.push('Interest / threshold board:');
          roundThresholdSamples.forEach((sample) => {
            const playerId = Number(sample?.playerId || 0);
            const wasBid = bidIds.has(playerId);
            const thresholdBase = Number(sample?.thresholdBase || 0);
            const effectiveThreshold = Number(sample?.effectiveThreshold || 0);
            const teamValue = Number(sample?.teamValue || 0);
            const thresholdGap = Number((teamValue - effectiveThreshold).toFixed(3));
            let reason = '';

            if (!sample?.passesThreshold) {
              reason = `NO BID: below effective interest threshold by ${Math.abs(thresholdGap).toFixed(3)}`;
            } else if (wasBid) {
              reason = 'BID: passed threshold and made final bid list';
            } else {
              reason = 'NO BID: passed threshold but lost out to higher-priority targets / bid-cap selection';
            }

            lines.push(
              `- ${String(sample?.playerName || 'Unknown')} (${String(sample?.position || 'UNK')}) | AV=${Number(sample?.avgValue || 0)} | draftChance=${Number(sample?.draftChance || 0)} | teamValue=${teamValue.toFixed(3)} | interestBase=${thresholdBase.toFixed(3)} | effectiveInterest=${effectiveThreshold.toFixed(3)} | gap=${thresholdGap.toFixed(3)} | pass=${sample?.passesThreshold ? 'yes' : 'no'} | ${reason}`
            );
          });
        }

        const playersWon = Array.isArray(team?.playersWon) ? team.playersWon : [];
        lines.push(`Won this round (${playersWon.length}): ${formatTraceRoster(playersWon)}`);
        lines.push(`Roster after (${Array.isArray(team?.rosterAfter) ? team.rosterAfter.length : 0}): ${formatTraceRoster(team?.rosterAfter)}`);
        lines.push('');
      });
    });

    return lines.join('\n');
  }

  function renderSimulationOutput() {
    if (!simulationOutput || !lastSimulationResult) return;
    simulationOutput.textContent = buildSimulationReport(lastSimulationResult, getFilters());
  }

  function renderTeamSummaryOutput() {
    if (!teamSummaryOutput) return;
    if (!lastSimulationResult) {
      teamSummaryOutput.textContent = 'Pick a team filter, run a simulation, and this panel will show that team\'s bids, thresholds, budgets, and roster movement by round.';
      return;
    }
    teamSummaryOutput.textContent = buildTeamSummaryReport(lastSimulationResult, getFilters());
  }

  async function runSimulationBatch() {
    const adminKey = getAdminKey();
    if (!adminKey) {
      setStatus('Enter admin key first.', 'error');
      return;
    }

    if (simulateBatchBtn) simulateBatchBtn.disabled = true;
    const draftCount = getSelectedDraftCount();
    const currentFilters = getFilters();
    const traceDraftNumber = currentFilters.draftNumber || 1;
    const traceTeamName = String(currentFilters.teamName || '').trim();
    setStatus(`Running ${draftCount}-draft simulation batch...`, 'info');
    if (simulationOutput) simulationOutput.textContent = 'Running simulations...';
    if (teamSummaryOutput) teamSummaryOutput.textContent = 'Running simulations...';

    try {
      const defaultRounds = 10;
      const thresholdTeams = [traceTeamName || 'Team 1'];
      const lobbySettings = getLobbySettingsPayload();
      const result = await requestJson('/api/admin/simulate-drafts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey
        },
        body: JSON.stringify({
          draftCount,
          rounds: defaultRounds,
          rosterSettings: lobbySettings.rosterSettings,
          lobbySettings,
          thresholdDebug: {
            enabled: true,
            minRound: 1,
            maxRound: defaultRounds,
            maxSamplesPerTeamRound: 999,
            teams: thresholdTeams,
            draftNumber: traceDraftNumber
          },
          teamTrace: {
            teamNameFilter: traceTeamName || 'Team 1',
            draftNumber: traceDraftNumber
          }
        })
      });

      const aggregate = result?.simulation?.aggregate || {};
      const scorecard = result?.simulation?.scorecard || {};
      const realismScore = Number(scorecard?.overall?.realismScore || 0);
      const completionPct = Math.round(Number(aggregate.completionRate || 0) * 100);
      const allCompletePct = Math.round(Number(aggregate.allCompleteDraftRate || 0) * 100);

      setStatus(
        `Done. Realism ${realismScore}/100 | Completion ${completionPct}% | All-complete drafts ${allCompletePct}% | Duration ${result.durationMs || 0} ms`,
        'success'
      );

      try {
        localStorage.setItem(ADMIN_KEY_STORAGE_KEY, adminKey);
      } catch (_error) {
        // ignore
      }

      lastSimulationResult = result;
      renderSimulationOutput();
      renderTeamSummaryOutput();
    } catch (error) {
      const rawMessage = String(error?.message || 'Simulation failed.');
      const needsRestart = /404|Cannot POST|Failed to fetch/i.test(rawMessage);
      const finalMessage = needsRestart
        ? `${rawMessage} Restart the server (npm start) so the new simulation endpoint is loaded, then refresh this page.`
        : rawMessage;

      setStatus(finalMessage, 'error');
      if (simulationOutput) {
        simulationOutput.textContent = `Simulation failed: ${finalMessage}`;
      }
      if (teamSummaryOutput) {
        teamSummaryOutput.textContent = `Simulation failed: ${finalMessage}`;
      }
    } finally {
      if (simulateBatchBtn) simulateBatchBtn.disabled = false;
    }
  }

  updateSimulateButtonLabel();

  if (adminKeyInput) {
    const stored = getStoredAdminKey();
    if (stored && !String(adminKeyInput.value || '').trim()) {
      adminKeyInput.value = stored;
    }
  }

  if (connectForm) {
    connectForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      setConnectStatus('Connecting...');
      try {
        await verifyConnection();
        setConnectStatus('Connected.');
        setStatus('Ready to simulate.', 'success');
      } catch (error) {
        setConnectStatus(error.message || 'Connection failed.');
        setStatus('Not connected.', 'error');
      }
    });
  }

  const initialAdminKey = getAdminKey();
  if (initialAdminKey) {
    setConnectStatus('Checking saved admin access...');
    void verifyConnection().then(() => {
      setConnectStatus('Connected.');
      setStatus('Ready to simulate.', 'success');
    }).catch((error) => {
      setConnectStatus(error && error.message ? error.message : 'Connection failed.');
      setStatus('Not connected.', 'error');
    });
  }

  if (simulateBatchBtn) {
    simulateBatchBtn.addEventListener('click', () => {
      void runSimulationBatch();
    });
  }

  if (simulationDraftCount) {
    simulationDraftCount.addEventListener('change', () => {
      updateSimulateButtonLabel();
    });
  }

  [filterDraftNumber, filterTeamName, filterMinBid].forEach((input) => {
    if (!input) return;
    input.addEventListener('input', () => {
      renderSimulationOutput();
      renderTeamSummaryOutput();
    });
  });

  if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener('click', () => {
      if (filterDraftNumber) filterDraftNumber.value = '';
      if (filterTeamName) filterTeamName.value = '';
      if (filterMinBid) filterMinBid.value = '';
      renderSimulationOutput();
      renderTeamSummaryOutput();
    });
  }

  if (loadLobbySettingsBtn) {
    loadLobbySettingsBtn.addEventListener('click', () => {
      const lobbyDraft = getCurrentLobbyDraft();
      if (lobbyDraft) {
        applyLobbySettingsToSimulationForm(lobbyDraft);
        setStatus(`Loaded lobby settings for ${String(sessionStorage.getItem('currentDraft') || 'current draft')}.`, 'success');
      } else {
        applyLobbySettingsToSimulationForm({ ajDraftMode: true, rosterSettings: LOBBY_DEFAULT_ROSTER_SETTINGS, benchCutTarget: 5, roundTimerMinutes: 10, waiverMode: 'off' });
        setStatus('No active lobby found. Loaded default lobby settings with A-J complex on.', 'info');
      }
    });
  }

  applyLobbySettingsToSimulationForm(getCurrentLobbyDraft() || { ajDraftMode: true, rosterSettings: LOBBY_DEFAULT_ROSTER_SETTINGS, benchCutTarget: 5, roundTimerMinutes: 10, waiverMode: 'off' });
});
