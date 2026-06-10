document.addEventListener('DOMContentLoaded', () => {
  const summaryMeta = document.getElementById('summaryMeta');
  const draftList = document.getElementById('draftList');
  const teamHeader = document.getElementById('teamHeader');
  const lineupGrid = document.getElementById('lineupGrid');
  const benchContainer = document.getElementById('benchContainer');
  const lookupForm = document.getElementById('lookupForm');
  const codeLookup = document.getElementById('codeLookup');

  const MAX_TOTAL_PLAYERS = 14;
  const MAX_BENCH_PLAYERS = 5;

  const completedDraftsRaw = localStorage.getItem('completedDrafts');
  const parsedDrafts = completedDraftsRaw ? JSON.parse(completedDraftsRaw) : [];
  const isCompletedDraft = (draft) => {
    if (!draft || typeof draft !== 'object') return false;
    return draft.completed === true;
  };
  const completedDrafts = Array.isArray(parsedDrafts) ? parsedDrafts.filter(isCompletedDraft) : [];
  completedDrafts.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));

  let selectedDraftCode = (sessionStorage.getItem('selectedCompletedDraftCode') || '').trim();
  let selectedTeamName = null;

  if (!Array.isArray(completedDrafts) || completedDrafts.length === 0) {
    summaryMeta.textContent = 'No completed drafts were found.';
    draftList.innerHTML = '<p class="summary-meta">Complete a draft first, then it will appear here.</p>';
    return;
  }

  if (!selectedDraftCode || !completedDrafts.find(d => d.draftCode === selectedDraftCode)) {
    selectedDraftCode = completedDrafts[0].draftCode;
  }

  updateMeta();
  renderDraftButtons();
  ensureSelectedTeam();
  renderSelectedTeam();

  lookupForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const code = String(codeLookup.value || '').trim().toUpperCase();
    if (!code) return;

    const found = completedDrafts.find(d => String(d.draftCode || '').toUpperCase() === code);
    if (!found) {
      alert('No completed draft found for that lobby code.');
      return;
    }

    selectedDraftCode = found.draftCode;
    sessionStorage.setItem('selectedCompletedDraftCode', selectedDraftCode);
    ensureSelectedTeam();
    renderDraftButtons();
    renderSelectedTeam();
  });

  function currentDraft() {
    return completedDrafts.find(d => d.draftCode === selectedDraftCode) || completedDrafts[0];
  }

  function updateMeta() {
    summaryMeta.textContent = `${completedDrafts.length} completed drafts | Showing lobby ${selectedDraftCode}`;
  }

  function renderDraftButtons() {
    draftList.innerHTML = completedDrafts.map(draft => {
      const teamCount = Array.isArray(draft.teams) ? draft.teams.length : 0;
      return `
        <button class="draft-btn ${draft.draftCode === selectedDraftCode ? 'active' : ''}" data-code="${escapeHtml(draft.draftCode || '')}">
          <div class="draft-code">Lobby ${escapeHtml(draft.draftCode || 'N/A')}</div>
          <div class="draft-meta">${new Date(draft.timestamp).toLocaleString()} | ${teamCount} teams</div>
        </button>
      `;
    }).join('');

    draftList.querySelectorAll('.draft-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedDraftCode = btn.getAttribute('data-code');
        sessionStorage.setItem('selectedCompletedDraftCode', selectedDraftCode);
        ensureSelectedTeam();
        renderDraftButtons();
        renderSelectedTeam();
      });
    });

    updateMeta();
  }

  function ensureSelectedTeam() {
    const draft = currentDraft();
    const teams = Array.isArray(draft.teams) ? draft.teams : [];
    if (!selectedTeamName || !teams.find(t => t.name === selectedTeamName)) {
      selectedTeamName = teams[0] ? teams[0].name : null;
    }
  }

  function renderSelectedTeam() {
    const draft = currentDraft();
    if (!draft || !Array.isArray(draft.teams) || draft.teams.length === 0) {
      teamHeader.innerHTML = '<p class="summary-meta">No team data in this draft.</p>';
      lineupGrid.innerHTML = '';
      benchContainer.innerHTML = '';
      return;
    }

    const teamButtons = draft.teams.map(team => {
      const split = splitRoster(team.roster || []);
      const requiredCuts = getRequiredCuts(team.roster || [], split.bench);
      const cutText = requiredCuts > 0 ? ` | Needs ${requiredCuts} cut(s)` : '';
      return `
        <button class="team-btn ${selectedTeamName === team.name ? 'active' : ''}" data-team-name="${escapeHtml(team.name)}">
          <div><strong>${escapeHtml(team.name)}</strong></div>
          <div class="badge">${(team.roster || []).length} players${cutText}</div>
        </button>
      `;
    }).join('');

    teamHeader.innerHTML = `
      <h2 class="team-title">Lobby ${escapeHtml(draft.draftCode || 'N/A')}</h2>
      <div class="summary-meta team-meta">Completed ${new Date(draft.timestamp).toLocaleString()}</div>
      <h3 class="summary-section-title mt-14">Teams</h3>
      <div class="team-list">${teamButtons}</div>
    `;

    teamHeader.querySelectorAll('.team-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedTeamName = btn.getAttribute('data-team-name');
        renderSelectedTeam();
      });
    });

    const selectedTeam = draft.teams.find(t => t.name === selectedTeamName) || draft.teams[0];
    const { slots, bench } = splitRoster(selectedTeam.roster || []);
    const requiredCuts = getRequiredCuts(selectedTeam.roster || [], bench);

    const slotOrder = [
      { key: 'QB', label: 'QB' },
      { key: 'WR1', label: 'WR' },
      { key: 'WR2', label: 'WR' },
      { key: 'RB1', label: 'RB' },
      { key: 'RB2', label: 'RB' },
      { key: 'TE', label: 'TE' },
      { key: 'FLEX', label: 'FLEX' },
      { key: 'K', label: 'K' },
      { key: 'DEF', label: 'DEF' }
    ];
    lineupGrid.innerHTML = slotOrder.map(slot => renderLineupRow(slot.label, slots[slot.key])).join('');

    const benchRows = bench.length === 0
      ? '<div class="bench-empty">No bench players.</div>'
      : bench.map(player => `
          <div class="bench-item">
            <span class="bench-pos">${escapeHtml(player.position || 'N/A')}</span>
            <span class="bench-player">${escapeHtml(player.name || 'Unknown')} - $${Number(player.bid || 0)}</span>
            <span class="bench-rank">Rank ${Number(player.prerank || 999)}</span>
          </div>
        `).join('');

    benchContainer.innerHTML = `
      ${requiredCuts > 0 ? `<div class="cut-panel"><p class="warning">Needs ${requiredCuts} cut(s) to reach max ${MAX_TOTAL_PLAYERS} total and max ${MAX_BENCH_PLAYERS} bench.</p></div>` : ''}
      <div class="bench-list">${benchRows}</div>
    `;
  }

  function getRequiredCuts(roster, bench) {
    const overTotal = Math.max(0, roster.length - MAX_TOTAL_PLAYERS);
    const overBench = Math.max(0, bench.length - MAX_BENCH_PLAYERS);
    return Math.max(overTotal, overBench);
  }

  function splitRoster(roster) {
    const slots = {
      QB: null,
      WR1: null,
      WR2: null,
      RB1: null,
      RB2: null,
      TE: null,
      FLEX: null,
      K: null,
      DEF: null
    };

    const used = [];
    const bestAtPos = (pos) => {
      const found = roster
        .filter(p => p.position === pos && !used.includes(p))
        .sort((a, b) => Number(a.prerank || 999) - Number(b.prerank || 999))[0] || null;
      if (found) used.push(found);
      return found;
    };

    slots.QB = bestAtPos('QB');
    slots.WR1 = bestAtPos('WR');
    slots.WR2 = bestAtPos('WR');
    slots.RB1 = bestAtPos('RB');
    slots.RB2 = bestAtPos('RB');
    slots.TE = bestAtPos('TE');
    slots.K = bestAtPos('K');
    slots.DEF = bestAtPos('DEF');

    slots.FLEX = roster
      .filter(p => ['RB', 'WR', 'TE'].includes(p.position) && !used.includes(p))
      .sort((a, b) => Number(a.prerank || 999) - Number(b.prerank || 999))[0] || null;

    if (slots.FLEX) used.push(slots.FLEX);

    const bench = roster
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
