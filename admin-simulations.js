document.addEventListener('DOMContentLoaded', () => {
  const ADMIN_KEY_STORAGE_KEY = 'adminApiKey';

  const connectForm = document.getElementById('adminConnectForm');
  const adminKeyInput = document.getElementById('adminKeyInput');
  const adminConnectStatus = document.getElementById('adminConnectStatus');
  const simulateBatchBtn = document.getElementById('simulateBatchBtn');
  const simulationStatus = document.getElementById('simulationStatus');
  const simulationOutput = document.getElementById('simulationOutput');
  const filterDraftNumber = document.getElementById('filterDraftNumber');
  const filterTeamName = document.getElementById('filterTeamName');
  const filterMinBid = document.getElementById('filterMinBid');
  const clearFiltersBtn = document.getElementById('clearFiltersBtn');
  let lastSimulationResult = null;

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
    const filterDraft = Number(filters.draftNumber || 0);
    const filterTeam = String(filters.teamName || '').toLowerCase();
    const filterMinBid = Math.max(0, Number(filters.minBid || 0));

    const lines = [];
    lines.push(`Simulation complete in ${result?.durationMs || 0} ms`);
    lines.push(`Drafts: ${config.draftCount || 0} | Teams per draft: ${config.teamCount || 0} | Rounds: ${config.rounds || 0}`);
    lines.push(`Forced spread mode: ${typeof config.forceSpread === 'boolean' ? (config.forceSpread ? 'ON' : 'OFF') : 'default auto'}`);
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
        return String(team?.name || '').toLowerCase().includes(filterTeam);
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
        const rosterCount = Number(team?.rosterCount || 0);
        const budgetSpent = Number(team?.budgetSpent || 0);
        const budgetRemaining = Number(team?.budgetRemaining || 0);
        const completeMark = team?.complete ? 'yes' : 'no';
        const starterRound = team?.starterCompletedRound ?? 'n/a';
        lines.push(`${teamName}${profileSuffix} | roster=${rosterCount} | spent=$${budgetSpent} | left=$${budgetRemaining} | complete=${completeMark} | starterRound=${starterRound}`);

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

  function renderSimulationOutput() {
    if (!simulationOutput || !lastSimulationResult) return;
    simulationOutput.textContent = buildSimulationReport(lastSimulationResult, getFilters());
  }

  async function runSimulationBatch() {
    const adminKey = getAdminKey();
    if (!adminKey) {
      setStatus('Enter admin key first.', 'error');
      return;
    }

    if (simulateBatchBtn) simulateBatchBtn.disabled = true;
    setStatus('Running 15-draft simulation batch...', 'info');
    if (simulationOutput) simulationOutput.textContent = 'Running simulations...';

    try {
      const result = await requestJson('/api/admin/simulate-drafts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey
        },
        body: JSON.stringify({ draftCount: 15 })
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

      lastSimulationResult = result;
      renderSimulationOutput();
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
    } finally {
      if (simulateBatchBtn) simulateBatchBtn.disabled = false;
    }
  }

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

  if (simulateBatchBtn) {
    simulateBatchBtn.addEventListener('click', () => {
      void runSimulationBatch();
    });
  }

  [filterDraftNumber, filterTeamName, filterMinBid].forEach((input) => {
    if (!input) return;
    input.addEventListener('input', () => {
      renderSimulationOutput();
    });
  });

  if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener('click', () => {
      if (filterDraftNumber) filterDraftNumber.value = '';
      if (filterTeamName) filterTeamName.value = '';
      if (filterMinBid) filterMinBid.value = '';
      renderSimulationOutput();
    });
  }
});
