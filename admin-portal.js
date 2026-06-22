document.addEventListener('DOMContentLoaded', () => {
  const POSITIONS = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];
  const BOARD_POSITIONS = ['TOP', ...POSITIONS];
  const ADMIN_TIER_INSERT_MODE_KEY = 'adminRankingsTierInsertMode';
  const AJ_ROUND_CODES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
  const AJ_REVERSED_START_POSITIONS = new Set(['WR', 'TE', 'K']);

  const keyInput = document.getElementById('adminKeyInput');
  const connectForm = document.getElementById('adminConnectForm');
  const connectStatus = document.getElementById('adminConnectStatus');
  const connectBtn = connectForm ? connectForm.querySelector('button[type="submit"]') : null;
  const refreshOverviewBtn = document.getElementById('refreshOverviewBtn');
  const toggleRawOverviewBtn = document.getElementById('toggleRawOverviewBtn');
  const overviewOutput = document.getElementById('adminOverviewOutput');
  const overviewCharts = document.getElementById('adminOverviewCharts');
  const metricUptime = document.getElementById('metricUptime');
  const metricTotalRequests = document.getElementById('metricTotalRequests');
  const metricAuthUsers = document.getElementById('metricAuthUsers');
  const metricSignedUpEmails = document.getElementById('metricSignedUpEmails');
  const metricPremiumUsers = document.getElementById('metricPremiumUsers');
  const metricDefaultRankings = document.getElementById('metricDefaultRankings');
  const methodChart = document.getElementById('adminMethodChart');
  const statusChart = document.getElementById('adminStatusChart');
  const topPathsChart = document.getElementById('adminTopPathsChart');

  const loadRankingsBtn = document.getElementById('loadRankingsBtn');
  const tierInsertModeBtn = document.getElementById('tierInsertModeBtn');
  const saveRankingsLayoutBtn = document.getElementById('saveRankingsLayoutBtn');
  const saveJsonFileBtn = document.getElementById('saveJsonFileBtn');
  const clearTopBoardBtn = document.getElementById('clearTopBoardBtn');
  const undoRankingsEditBtn = document.getElementById('undoRankingsEditBtn');
  const resetUnsavedBtn = document.getElementById('resetUnsavedBtn');
  const rankingsSourceLabel = document.getElementById('rankingsSourceLabel');
  const addPlayerForm = document.getElementById('addPlayerForm');
  const removePlayerForm = document.getElementById('removePlayerForm');
  const rankingsActionStatus = document.getElementById('rankingsActionStatus');
  const positionTabs = document.getElementById('adminPositionTabs');
  const tierBoard = document.getElementById('adminTierBoard');
  const jsonSaveBanner = document.getElementById('jsonSaveBanner');
  const jsonSaveBannerText = document.getElementById('jsonSaveBannerText');
  const dismissJsonSaveBannerBtn = document.getElementById('dismissJsonSaveBannerBtn');

  let activePosition = 'QB';
  let showingRawOverview = false;
  let positionPlayers = createEmptyBoards();
  let positionMeta = createEmptyBoards();
  let topPlayers = [];
  let topMeta = null;
  let dragSourceIndex = -1;
  let isLayoutDirty = false;
  let undoStack = [];
  let jsonSaveBannerTimer = null;
  let easyTierInsertMode = false;

  function createEmptyBoards() {
    return POSITIONS.reduce((acc, pos) => {
      acc[pos] = null;
      return acc;
    }, {});
  }

  function isTopView(position = activePosition) {
    return position === 'TOP';
  }

  function loadTierInsertModePreference() {
    try {
      easyTierInsertMode = localStorage.getItem(ADMIN_TIER_INSERT_MODE_KEY) === 'easy';
    } catch (_error) {
      easyTierInsertMode = false;
    }
  }

  function saveTierInsertModePreference() {
    try {
      localStorage.setItem(ADMIN_TIER_INSERT_MODE_KEY, easyTierInsertMode ? 'easy' : 'classic');
    } catch (_error) {
      // ignore
    }
  }

  function applyTierInsertMode() {
    if (!tierInsertModeBtn) return;
    tierInsertModeBtn.textContent = `Easy Tier Breaks: ${easyTierInsertMode ? 'On' : 'Off'}`;
    tierInsertModeBtn.classList.toggle('admin-tier-toggle-active', easyTierInsertMode);
    tierInsertModeBtn.setAttribute('aria-pressed', easyTierInsertMode ? 'true' : 'false');
    tierInsertModeBtn.title = easyTierInsertMode
      ? 'Always show the between-player tier break buttons.'
      : 'Use the rankings board without always-visible tier break buttons.';
  }

  function toggleTierInsertMode() {
    easyTierInsertMode = !easyTierInsertMode;
    saveTierInsertModePreference();
    applyTierInsertMode();
    renderActiveBoard();
  }

  function cloneData(value) {
    if (typeof structuredClone === 'function') {
      return structuredClone(value);
    }
    return JSON.parse(JSON.stringify(value));
  }

  function updateUndoButtonState() {
    if (undoRankingsEditBtn) {
      undoRankingsEditBtn.disabled = undoStack.length === 0;
    }
  }

  function updateTopClearButtonState() {
    if (!clearTopBoardBtn) return;
    clearTopBoardBtn.disabled = !isTopView() || !Array.isArray(topPlayers) || topPlayers.length === 0;
  }

  function inferTierBreaks(players) {
    let lastTier = '';
    return (Array.isArray(players) ? players : []).map((player, index) => {
      const tierName = String(player.tier || '').trim();
      const nextPlayer = { ...player };
      nextPlayer.tierBreakBefore = index > 0 && !!tierName && tierName !== lastTier;
      lastTier = tierName || lastTier;
      return nextPlayer;
    });
  }

  function withPersistedTierLabels(players, boardKey = activePosition) {
    let tierNumber = 1;
    return (Array.isArray(players) ? players : []).map((player, index) => {
      if (index > 0 && player.tierBreakBefore) {
        tierNumber += 1;
      }
      return {
        ...player,
        tierBreakBefore: index > 0 ? !!player.tierBreakBefore : false,
        tier: boardKey === 'TOP' ? `Tier ${tierNumber}` : `${boardKey} Tier ${tierNumber}`
      };
    });
  }

  function averageNeighborMetric(previousValue, nextValue, fallback = 0, options = {}) {
    const hasPrevious = Number.isFinite(previousValue);
    const hasNext = Number.isFinite(nextValue);

    let result = fallback;
    if (hasPrevious && hasNext) {
      result = (previousValue + nextValue) / 2;
    } else if (hasPrevious) {
      result = previousValue;
    } else if (hasNext) {
      result = nextValue;
    }

    if (options.round) {
      result = Math.round(result);
    }
    if (Number.isFinite(options.min)) {
      result = Math.max(options.min, result);
    }
    if (Number.isFinite(options.max)) {
      result = Math.min(options.max, result);
    }

    return result;
  }

  function autoAdjustMovedPlayerMetrics(players, movedIndex) {
    if (isTopView() || !Array.isArray(players) || movedIndex < 0 || movedIndex >= players.length) return;

    const movedPlayer = players[movedIndex];
    if (!movedPlayer) return;

    const previousPlayer = movedIndex > 0 ? players[movedIndex - 1] : null;
    const nextPlayer = movedIndex < players.length - 1 ? players[movedIndex + 1] : null;

    movedPlayer.avgValue = averageNeighborMetric(
      previousPlayer ? Number(previousPlayer.avgValue) : NaN,
      nextPlayer ? Number(nextPlayer.avgValue) : NaN,
      Number(movedPlayer.avgValue || 0),
      { round: true, min: 0 }
    );

    movedPlayer.draftChance = averageNeighborMetric(
      previousPlayer ? Number(previousPlayer.draftChance) : NaN,
      nextPlayer ? Number(nextPlayer.draftChance) : NaN,
      Number(movedPlayer.draftChance || 0),
      { round: true, min: 0, max: 100 }
    );
  }

  function clearUndoHistory() {
    undoStack = [];
    updateUndoButtonState();
  }

  function pushUndoSnapshot() {
    undoStack.push({
      activePosition,
      positionPlayers: cloneData(positionPlayers),
      positionMeta: cloneData(positionMeta),
      topPlayers: cloneData(topPlayers),
      topMeta: cloneData(topMeta),
      isLayoutDirty
    });
    if (undoStack.length > 40) {
      undoStack.shift();
    }
    updateUndoButtonState();
  }

  function restoreUndoSnapshot(snapshot) {
    activePosition = snapshot.activePosition;
    positionPlayers = cloneData(snapshot.positionPlayers);
    positionMeta = cloneData(snapshot.positionMeta);
    topPlayers = cloneData(snapshot.topPlayers);
    topMeta = cloneData(snapshot.topMeta);
    setLayoutDirty(snapshot.isLayoutDirty);
    updateRankingsMeta(isTopView() ? topMeta : positionMeta[activePosition], getActivePlayers().length);
    renderActiveBoard();
    updateUndoButtonState();
  }

  function authHeaders() {
    return {
      'Content-Type': 'application/json',
      'x-admin-key': String(keyInput.value || '').trim()
    };
  }

  function parseRankingsHashPosition(hashValue) {
    const raw = String(hashValue || '').replace(/^#/, '').trim().toUpperCase();
    if (!raw) return null;
    const normalized = raw.startsWith('RANKINGS-') ? raw.slice('RANKINGS-'.length) : raw;
    return BOARD_POSITIONS.includes(normalized) ? normalized : null;
  }

  function syncRankingsHash(position) {
    const normalized = BOARD_POSITIONS.includes(position) ? position : 'QB';
    const targetHash = `#rankings-${normalized}`;
    if (window.location.hash !== targetHash) {
      window.history.replaceState(null, '', targetHash);
    }
  }

  function setConnectStatus(message) {
    connectStatus.textContent = message;
  }

  function setConnectApproved(isApproved) {
    if (!connectBtn) return;
    connectBtn.classList.toggle('admin-connect-approved', !!isApproved);
    connectBtn.textContent = isApproved ? 'Connected' : 'Connect';
  }

  function setActionStatus(message) {
    rankingsActionStatus.textContent = message;
  }

  function hideJsonSaveCompletedAlert() {
    if (jsonSaveBannerTimer) {
      window.clearTimeout(jsonSaveBannerTimer);
      jsonSaveBannerTimer = null;
    }
    if (jsonSaveBanner) {
      jsonSaveBanner.classList.add('hidden');
    }
  }

  function showJsonSaveCompletedAlert(message) {
    if (!jsonSaveBanner || !jsonSaveBannerText) return;
    if (jsonSaveBannerTimer) {
      window.clearTimeout(jsonSaveBannerTimer);
    }
    jsonSaveBannerText.textContent = message;
    jsonSaveBanner.classList.remove('hidden');
    jsonSaveBannerTimer = window.setTimeout(() => {
      hideJsonSaveCompletedAlert();
    }, 7000);
  }

  function setLayoutDirty(dirty) {
    isLayoutDirty = !!dirty;
    if (saveRankingsLayoutBtn) {
      saveRankingsLayoutBtn.disabled = !isLayoutDirty;
    }
    if (saveJsonFileBtn) {
      saveJsonFileBtn.disabled = !isLayoutDirty;
    }
    updateUndoButtonState();
    updateTopClearButtonState();
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatNumber(value) {
    const num = Number(value || 0);
    return Number.isFinite(num) ? num.toLocaleString() : '0';
  }

  function formatUptime(seconds) {
    const total = Math.max(0, Number(seconds || 0));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = Math.floor(total % 60);
    return `${h}h ${m}m ${s}s`;
  }

  function formatLastUpdatedText(lastUpdatedAt) {
    if (!lastUpdatedAt) return 'Unknown';
    const date = new Date(Number(lastUpdatedAt));
    return Number.isNaN(date.getTime()) ? 'Unknown' : date.toLocaleString();
  }

  function getAjSlotCode(position, rankNumber) {
    const normalizedPosition = String(position || '').trim().toUpperCase();
    const normalizedRank = Math.max(1, Number.parseInt(rankNumber, 10) || 1);
    const zeroBasedRank = normalizedRank - 1;
    const blockIndex = Math.floor(zeroBasedRank / 10);
    const offset = zeroBasedRank % 10;
    const startsReversed = AJ_REVERSED_START_POSITIONS.has(normalizedPosition);
    const isPageOneBlock = startsReversed ? (blockIndex % 2 === 1) : (blockIndex % 2 === 0);
    const roundIndex = isPageOneBlock ? offset : (AJ_ROUND_CODES.length - 1 - offset);
    const page = isPageOneBlock ? 1 : 2;
    return `${AJ_ROUND_CODES[roundIndex]}${page}`;
  }

  function setOverviewMode(rawMode) {
    showingRawOverview = !!rawMode;
    overviewOutput.classList.toggle('hidden', !showingRawOverview);
    overviewCharts.classList.toggle('hidden', showingRawOverview);
    if (toggleRawOverviewBtn) {
      toggleRawOverviewBtn.textContent = showingRawOverview ? 'Hide Raw Code/Data' : 'Show Raw Code/Data';
    }
  }

  function drawBarChart(canvas, labels, values, options = {}) {
    if (!(canvas instanceof HTMLCanvasElement)) return;

    const dpr = window.devicePixelRatio || 1;
    const cssWidth = Math.max(240, Math.floor(canvas.clientWidth || 240));
    const cssHeight = Math.max(160, Math.floor(Number(canvas.getAttribute('height') || 160)));
    canvas.width = Math.floor(cssWidth * dpr);
    canvas.height = Math.floor(cssHeight * dpr);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssWidth, cssHeight);
    ctx.fillStyle = '#DCE8F4';
    ctx.font = '12px sans-serif';

    if (!labels.length || !values.length) {
      ctx.fillText('No data yet', 12, 22);
      return;
    }

    const maxValue = Math.max(...values, 1);
    const padding = { top: 10, right: 10, bottom: 40, left: 10 };
    const chartW = cssWidth - padding.left - padding.right;
    const chartH = cssHeight - padding.top - padding.bottom;
    const gap = 8;
    const barW = Math.max(10, (chartW - (values.length - 1) * gap) / values.length);

    values.forEach((value, idx) => {
      const barH = Math.max(2, (Math.max(0, value) / maxValue) * chartH);
      const x = padding.left + idx * (barW + gap);
      const y = padding.top + chartH - barH;
      ctx.fillStyle = options.color || '#8FB2D9';
      ctx.fillRect(x, y, barW, barH);
      ctx.fillStyle = '#DCE8F4';
      ctx.fillText(String(Math.round(value)), x, Math.max(10, y - 4));
      ctx.save();
      ctx.translate(x + barW / 2, cssHeight - 8);
      ctx.rotate(-0.45);
      ctx.textAlign = 'right';
      const shortLabel = String(labels[idx] || '').slice(0, 12);
      ctx.fillText(shortLabel, 0, 0);
      ctx.restore();
    });
  }

  function updateOverviewCards(traffic, system) {
    metricUptime.textContent = formatUptime(system.uptimeSeconds || 0);
    metricTotalRequests.textContent = formatNumber(traffic.totalRequests || 0);
    metricAuthUsers.textContent = formatNumber(system.authUsersCount || 0);
    if (metricSignedUpEmails) {
      metricSignedUpEmails.textContent = formatNumber(system.authEmailsCount || 0);
    }
    if (metricPremiumUsers) {
      metricPremiumUsers.textContent = '0';
    }
    metricDefaultRankings.textContent = formatNumber(system.defaultRankingsCount || 0);
  }

  function renderOverviewCharts(traffic) {
    const byMethod = Object.entries(traffic.byMethod || {});
    const statusCodes = Object.entries(traffic.statusCodes || {});
    const topPaths = Array.isArray(traffic.topPaths) ? traffic.topPaths.slice(0, 8) : [];

    drawBarChart(methodChart, byMethod.map(([k]) => k), byMethod.map(([, v]) => Number(v || 0)), { color: '#7FC8A9' });
    drawBarChart(statusChart, statusCodes.map(([k]) => k), statusCodes.map(([, v]) => Number(v || 0)), { color: '#F5C26B' });
    drawBarChart(topPathsChart, topPaths.map((x) => String(x.path || '/')), topPaths.map((x) => Number(x.count || 0)), { color: '#9CB4FF' });
  }

  async function requestJson(url, options = {}) {
    const response = await fetch(url, options);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || `Request failed (${response.status})`);
    }
    return payload;
  }

  function getActivePlayers() {
    if (isTopView()) {
      return Array.isArray(topPlayers) ? topPlayers : [];
    }
    return Array.isArray(positionPlayers[activePosition]) ? positionPlayers[activePosition] : [];
  }

  function updatePositionTabs() {
    if (!positionTabs) return;
    positionTabs.querySelectorAll('.admin-pos-tab').forEach((button) => {
      const isActive = button.dataset.pos === activePosition;
      button.classList.toggle('active', isActive);
      button.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
    updateTopClearButtonState();
  }

  function updateRankingsMeta(meta, count) {
    if (!meta) return;
    const staleText = meta.isStaleWeek ? 'STALE: over 7 days' : 'Fresh: updated this week';
    rankingsSourceLabel.textContent = `${meta.sourceFile} (${count} players) | Last updated: ${formatLastUpdatedText(meta.lastUpdatedAt)} | ${staleText}`;
    rankingsSourceLabel.classList.toggle('admin-stale-text', !!meta.isStaleWeek);
  }

  function rebuildTopPlayersFromPositions() {
    topPlayers = [];
    POSITIONS.forEach((position) => {
      const players = Array.isArray(positionPlayers[position]) ? positionPlayers[position] : [];
      players.forEach((player) => {
        topPlayers.push({ ...player, position });
      });
    });
    topPlayers = inferTierBreaks(topPlayers);

    const lastUpdatedValues = POSITIONS
      .map((position) => positionMeta[position] && positionMeta[position].lastUpdatedAt)
      .filter(Boolean);
    const oldestUpdatedAt = lastUpdatedValues.length ? Math.min(...lastUpdatedValues) : null;
    const stale = POSITIONS.some((position) => positionMeta[position] && positionMeta[position].isStaleWeek);
    topMeta = {
      sourceFile: 'TOP view (all position files)',
      lastUpdatedAt: oldestUpdatedAt,
      isStaleWeek: stale
    };
  }

  function getTopPoolPlayersByPosition() {
    const selectedNames = new Set((Array.isArray(topPlayers) ? topPlayers : []).map((player) => String(player.name || '').toLowerCase()));
    return POSITIONS.reduce((acc, position) => {
      const sourcePlayers = Array.isArray(positionPlayers[position]) ? positionPlayers[position] : [];
      acc[position] = sourcePlayers.filter((player) => !selectedNames.has(String(player.name || '').toLowerCase()));
      return acc;
    }, {});
  }

  function buildTopPoolSection(position, players) {
    const section = document.createElement('section');
    section.className = 'admin-top-pool-section';
    section.innerHTML = `<div class="admin-top-pool-header">${position} Pool</div>`;

    if (!players.length) {
      const empty = document.createElement('div');
      empty.className = 'admin-top-pool-empty';
      empty.textContent = `All ${position} players are already in TOP.`;
      section.appendChild(empty);
      return section;
    }

    players.forEach((player) => {
      const row = document.createElement('div');
      row.className = 'admin-top-pool-row';
      row.innerHTML = `
        <div class="admin-top-pool-copy">
          <span class="admin-rank-player-name">${escapeHtml(player.name || 'Unknown Player')}</span>
          <span class="admin-rank-player-meta">${escapeHtml(player.position || position)} | ${escapeHtml(player.team || 'FA')}</span>
        </div>
        <button type="button" class="btn btn-signup admin-top-add-btn" data-player-name="${escapeHtml(player.name || '')}" data-player-position="${position}">Add</button>
      `;
      section.appendChild(row);
    });

    return section;
  }

  function renderTopBoard() {
    const wrapper = document.createElement('div');
    wrapper.className = 'admin-top-layout';

    const poolColumn = document.createElement('div');
    poolColumn.className = 'admin-top-column admin-top-column-pool';
    poolColumn.innerHTML = '<div class="admin-top-column-title">Player Pool</div>';
    const poolPlayersByPosition = getTopPoolPlayersByPosition();
    POSITIONS.forEach((position) => {
      poolColumn.appendChild(buildTopPoolSection(position, poolPlayersByPosition[position] || []));
    });

    const rankingsColumn = document.createElement('div');
    rankingsColumn.className = 'admin-top-column admin-top-column-rankings';
    const rankingsBlock = document.createElement('div');
    rankingsBlock.className = 'admin-tier-block';
    const header = document.createElement('div');
    header.className = 'admin-tier-header';
    header.innerHTML = '<span class="admin-tier-title">TOP Rankings Board</span>';
    rankingsBlock.appendChild(header);
    rankingsBlock.appendChild(buildDropZone(0));

    const players = getActivePlayers();
    if (!players.length) {
      const empty = document.createElement('div');
      empty.className = 'admin-tier-empty';
      empty.textContent = 'No players in top250.json yet. Add players from the pool to rebuild the TOP board.';
      rankingsBlock.appendChild(empty);
    }

    players.forEach((player, index) => {
      if (index > 0 && player.tierBreakBefore) {
        rankingsBlock.appendChild(buildTierBreakRow(index));
      }
      rankingsBlock.appendChild(buildPlayerRow(player, index));
      if (index < players.length - 1) {
        rankingsBlock.appendChild(buildPlayerGap(index + 1));
      }
      rankingsBlock.appendChild(buildDropZone(index + 1));
    });

    rankingsColumn.appendChild(rankingsBlock);
    wrapper.appendChild(poolColumn);
    wrapper.appendChild(rankingsColumn);

    tierBoard.innerHTML = '';
    tierBoard.appendChild(wrapper);
  }

  function splitTopPlayersIntoPositions() {
    const nextBoards = createEmptyBoards();
    POSITIONS.forEach((position) => {
      nextBoards[position] = [];
    });

    topPlayers.forEach((player) => {
      const position = String(player.position || '').trim().toUpperCase();
      if (!POSITIONS.includes(position)) return;
      nextBoards[position].push({ ...player, position });
    });

    POSITIONS.forEach((position) => {
      positionPlayers[position] = withPersistedTierLabels(nextBoards[position].map((player, index) => ({
        ...player,
        id: index + 1,
        rank: index + 1,
        position
      })), position);
    });
  }

  function buildPlayerGap(insertIdx) {
    const gap = document.createElement('div');
    gap.className = easyTierInsertMode ? 'admin-player-gap' : 'admin-player-gap hidden';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'admin-add-tier-break';
    button.textContent = '+ Add Tier Break';
    button.setAttribute('aria-label', 'Add tier break between these players');
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      const players = getActivePlayers();
      if (insertIdx <= 0 || insertIdx >= players.length) return;
      pushUndoSnapshot();
      players[insertIdx].tierBreakBefore = true;
      if (isTopView()) {
        topPlayers = withPersistedTierLabels(players, 'TOP');
        splitTopPlayersIntoPositions();
      } else {
        positionPlayers[activePosition] = withPersistedTierLabels(players, activePosition);
      }
      setLayoutDirty(true);
      renderActiveBoard();
    });

    gap.appendChild(button);
    return gap;
  }

  function buildTierBreakRow(index) {
    const player = getActivePlayers()[index];
    const row = document.createElement('div');
    row.className = 'admin-tier-break-row';
    row.innerHTML = `
      <span class="admin-tier-break-label">${escapeHtml(String((player && player.tier) || `Tier ${index + 1}`))}</span>
      <button type="button" class="admin-tier-break-remove" data-break-index="${index}">Remove Tier Break</button>
    `;
    return row;
  }

  function buildDropZone(insertIdx) {
    const zone = document.createElement('div');
    zone.className = 'admin-tier-drop-zone';
    zone.dataset.insertIdx = String(insertIdx);
    zone.addEventListener('dragover', (e) => {
      if (dragSourceIndex < 0) return;
      e.preventDefault();
      zone.classList.add('drag-active');
    });
    zone.addEventListener('dragleave', () => {
      zone.classList.remove('drag-active');
    });
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('drag-active');
      const players = getActivePlayers();
      if (dragSourceIndex < 0 || dragSourceIndex >= players.length) return;
      pushUndoSnapshot();
      const moved = players.splice(dragSourceIndex, 1)[0];
      let targetIndex = insertIdx;
      if (dragSourceIndex < insertIdx) targetIndex -= 1;
      const finalIndex = Math.max(0, Math.min(targetIndex, players.length));
      players.splice(finalIndex, 0, moved);
      autoAdjustMovedPlayerMetrics(players, finalIndex);
      dragSourceIndex = -1;
      setLayoutDirty(true);
      renderActiveBoard();
    });
    return zone;
  }

  function buildPlayerRow(player, index) {
    const row = document.createElement('div');
    row.className = 'admin-ranking-player-row';
    row.draggable = true;
    row.dataset.index = String(index);
    const rowPosition = player.position || activePosition;
    const ajSlotCode = !isTopView() ? getAjSlotCode(rowPosition, index + 1) : '';
    if (isTopView()) {
      row.innerHTML = `
        <span class="admin-drag-handle" aria-hidden="true">⠿</span>
        <span class="admin-rank-player-name">${escapeHtml(player.name || 'Unknown Player')}</span>
        <div class="admin-top-row-details">
          <span class="admin-rank-player-meta">#${index + 1} | ${escapeHtml(rowPosition)}</span>
          <label class="admin-av-edit admin-team-edit">
            <span>Team</span>
            <input type="text" class="admin-team-input" maxlength="5" value="${escapeHtml(player.team || '')}" placeholder="FA">
          </label>
        </div>
        <span class="admin-top-rank-label">TOP Rank</span>
        <button type="button" class="btn btn-login admin-row-remove" data-index="${index}">Remove</button>
      `;
    } else {
      row.innerHTML = `
        <span class="admin-drag-handle" aria-hidden="true">⠿</span>
        <span class="admin-rank-player-name">${escapeHtml(player.name || 'Unknown Player')}</span>
        <div class="admin-top-row-details">
          <span class="admin-rank-player-meta">#${index + 1} | ${escapeHtml(rowPosition)} | <span class="admin-aj-slot-badge">${ajSlotCode}</span></span>
          <label class="admin-av-edit admin-team-edit">
            <span>Team</span>
            <input type="text" class="admin-team-input" maxlength="5" value="${escapeHtml(player.team || '')}" placeholder="FA">
          </label>
        </div>
        <div class="admin-player-value-edits">
          <label class="admin-av-edit">
            <span>AV</span>
            <input type="number" class="admin-av-input" min="0" step="1" value="${Number(player.avgValue || 0)}">
          </label>
          <label class="admin-av-edit">
            <span>Draft %</span>
            <input type="number" class="admin-draftchance-input" min="0" max="100" step="1" value="${Number(player.draftChance || 0)}">
          </label>
        </div>
        <button type="button" class="btn btn-login admin-row-remove" data-index="${index}">Remove</button>
      `;
    }

    row.addEventListener('dragstart', (e) => {
      dragSourceIndex = index;
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', player.name || String(index));
      }
      row.classList.add('dragging');
    });

    row.addEventListener('dragend', () => {
      dragSourceIndex = -1;
      document.querySelectorAll('.admin-tier-drop-zone.drag-active, .admin-ranking-player-row.dragging').forEach((el) => {
        el.classList.remove('drag-active', 'dragging');
      });
    });

    const teamInput = row.querySelector('.admin-team-input');
    if (teamInput) {
      teamInput.addEventListener('focus', () => {
        teamInput.dataset.undoStartValue = String(player.team || '');
        teamInput.dataset.undoCaptured = '0';
      });
      teamInput.addEventListener('input', () => {
        const players = getActivePlayers();
        const previousValue = String(teamInput.dataset.undoStartValue || player.team || '');
        const nextValue = String(teamInput.value || '').trim().toUpperCase().slice(0, 5);
        if (teamInput.dataset.undoCaptured !== '1' && nextValue !== previousValue) {
          pushUndoSnapshot();
          teamInput.dataset.undoCaptured = '1';
        }
        teamInput.value = nextValue;
        players[index].team = nextValue;
        setLayoutDirty(true);
      });
      teamInput.addEventListener('blur', () => {
        delete teamInput.dataset.undoStartValue;
        delete teamInput.dataset.undoCaptured;
      });
    }

    const avInput = row.querySelector('.admin-av-input');
    if (avInput) {
      avInput.addEventListener('focus', () => {
        avInput.dataset.undoStartValue = String(player.avgValue || 0);
        avInput.dataset.undoCaptured = '0';
      });
      avInput.addEventListener('input', () => {
        const players = getActivePlayers();
        const previousValue = Number(avInput.dataset.undoStartValue || player.avgValue || 0);
        const nextValue = Number(avInput.value || 0);
        if (avInput.dataset.undoCaptured !== '1' && nextValue !== previousValue) {
          pushUndoSnapshot();
          avInput.dataset.undoCaptured = '1';
        }
        players[index].avgValue = Number(avInput.value || 0);
        setLayoutDirty(true);
      });
      avInput.addEventListener('blur', () => {
        delete avInput.dataset.undoStartValue;
        delete avInput.dataset.undoCaptured;
      });
    }

    const draftChanceInput = row.querySelector('.admin-draftchance-input');
    if (draftChanceInput) {
      draftChanceInput.addEventListener('focus', () => {
        draftChanceInput.dataset.undoStartValue = String(player.draftChance || 0);
        draftChanceInput.dataset.undoCaptured = '0';
      });
      draftChanceInput.addEventListener('input', () => {
        const players = getActivePlayers();
        const previousValue = Number(draftChanceInput.dataset.undoStartValue || player.draftChance || 0);
        const nextValue = Number(draftChanceInput.value || 0);
        if (draftChanceInput.dataset.undoCaptured !== '1' && nextValue !== previousValue) {
          pushUndoSnapshot();
          draftChanceInput.dataset.undoCaptured = '1';
        }
        players[index].draftChance = Math.max(0, Math.min(100, Number(draftChanceInput.value || 0)));
        setLayoutDirty(true);
      });
      draftChanceInput.addEventListener('blur', () => {
        delete draftChanceInput.dataset.undoStartValue;
        delete draftChanceInput.dataset.undoCaptured;
      });
    }

    return row;
  }

  function renderActiveBoard() {
    if (!tierBoard) return;
    updatePositionTabs();
    if (isTopView()) {
      renderTopBoard();
      return;
    }
    const players = getActivePlayers();
    const fragment = document.createDocumentFragment();

    const block = document.createElement('div');
    block.className = 'admin-tier-block';
    const header = document.createElement('div');
    header.className = 'admin-tier-header';
    header.innerHTML = `<span class="admin-tier-title">${activePosition === 'TOP' ? 'TOP Default Rankings Board' : `${activePosition} Rankings File`}</span>`;
    block.appendChild(header);
    block.appendChild(buildDropZone(0));

    if (!players.length) {
      const empty = document.createElement('div');
      empty.className = 'admin-tier-empty';
      empty.textContent = activePosition === 'TOP'
        ? 'No players available in the TOP default rankings board.'
        : `No ${activePosition} players in this file.`;
      block.appendChild(empty);
    }

    players.forEach((player, index) => {
      if (index > 0 && player.tierBreakBefore) {
        block.appendChild(buildTierBreakRow(index));
      }
      block.appendChild(buildPlayerRow(player, index));
      if (index < players.length - 1) {
        block.appendChild(buildPlayerGap(index + 1));
      }
      block.appendChild(buildDropZone(index + 1));
    });

    fragment.appendChild(block);
    tierBoard.innerHTML = '';
    tierBoard.appendChild(fragment);
  }

  async function loadOverview() {
    overviewOutput.textContent = 'Loading overview...';
    try {
      const [traffic, system, delivery] = await Promise.all([
        requestJson('/api/admin/traffic', { headers: { 'x-admin-key': String(keyInput.value || '').trim() } }),
        requestJson('/api/admin/system-status', { headers: { 'x-admin-key': String(keyInput.value || '').trim() } }),
        requestJson('/api/admin/delivery/status', { headers: { 'x-admin-key': String(keyInput.value || '').trim() } })
      ]);
      overviewOutput.textContent = JSON.stringify({ system, traffic, delivery }, null, 2);
      updateOverviewCards(traffic, system);
      renderOverviewCharts(traffic);
      setConnectApproved(true);
      setConnectStatus('');
    } catch (error) {
      overviewOutput.textContent = '';
      setConnectApproved(false);
      setConnectStatus(error.message);
    }
  }

  async function loadPositionRankings(position = activePosition) {
    setActionStatus(`Loading ${position} rankings...`);
    try {
      if (isTopView(position)) {
        await Promise.all(POSITIONS.map(async (pos) => {
          const payload = await requestJson(`/api/admin/rankings/position/${pos}`, {
            headers: { 'x-admin-key': String(keyInput.value || '').trim() }
          });
          positionPlayers[pos] = Array.isArray(payload.players) ? inferTierBreaks(payload.players.map((player) => ({ ...player }))) : [];
          positionMeta[pos] = payload;
        }));

        const defaultPayload = await requestJson('/api/admin/rankings/default', {
          headers: { 'x-admin-key': String(keyInput.value || '').trim() }
        });
        topPlayers = Array.isArray(defaultPayload.players) ? inferTierBreaks(defaultPayload.players.map((player) => ({ ...player }))) : [];
        topMeta = defaultPayload;
        activePosition = 'TOP';
        syncRankingsHash(activePosition);
        updateRankingsMeta(topMeta, topPlayers.length);
        clearUndoHistory();
        setLayoutDirty(false);
        renderActiveBoard();
        setActionStatus('TOP rankings loaded.');
        return;
      }

      const payload = await requestJson(`/api/admin/rankings/position/${position}`, {
        headers: { 'x-admin-key': String(keyInput.value || '').trim() }
      });
      positionPlayers[position] = Array.isArray(payload.players) ? inferTierBreaks(payload.players.map((player) => ({ ...player }))) : [];
      positionMeta[position] = payload;
      activePosition = position;
      syncRankingsHash(activePosition);
      updateRankingsMeta(payload, positionPlayers[position].length);
      clearUndoHistory();
      setLayoutDirty(false);
      renderActiveBoard();
      setActionStatus(`${position} rankings loaded.`);
    } catch (error) {
      setActionStatus(error.message);
    }
  }

  connectForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    setConnectApproved(false);
    setConnectStatus('');
    await loadOverview();
    await loadPositionRankings(activePosition);
  });

  refreshOverviewBtn.addEventListener('click', async () => {
    await loadOverview();
  });

  if (toggleRawOverviewBtn) {
    toggleRawOverviewBtn.addEventListener('click', () => {
      setOverviewMode(!showingRawOverview);
    });
  }

  loadRankingsBtn.addEventListener('click', async () => {
    await loadPositionRankings(activePosition);
  });

  addPlayerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = String(document.getElementById('addName').value || '').trim();
    const team = String(document.getElementById('addTeam').value || '').trim();
    const position = String(document.getElementById('addPosition').value || activePosition).trim().toUpperCase();
    const avgValue = Number(document.getElementById('addAvgValue').value || 0);
    const draftChance = 0;

    setActionStatus(`Adding ${position} player...`);
    try {
      if (isTopView(activePosition)) {
        pushUndoSnapshot();
        const newPlayer = {
          id: topPlayers.length + 1,
          rank: topPlayers.length + 1,
          name,
          position,
          team,
          avgValue,
          draftChance
        };
        topPlayers.push(newPlayer);
        splitTopPlayersIntoPositions();
        addPlayerForm.reset();
        setLayoutDirty(true);
        renderActiveBoard();
        setActionStatus(`${position} player added to TOP board.`);
        return;
      }

      await requestJson(`/api/admin/rankings/position/${position}/add`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ name, team, avgValue, draftChance, position })
      });
      addPlayerForm.reset();
      await loadPositionRankings(position);
    } catch (error) {
      setActionStatus(error.message);
    }
  });

  removePlayerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const rankRaw = document.getElementById('removeId').value;
    const rank = rankRaw ? Number(rankRaw) : 0;
    const name = String(document.getElementById('removeName').value || '').trim();

    setActionStatus(`Removing ${activePosition} player...`);
    try {
      if (isTopView()) {
        pushUndoSnapshot();
        if (rank > 0 && rank <= topPlayers.length) {
          topPlayers.splice(rank - 1, 1);
        } else if (name) {
          const index = topPlayers.findIndex((player) => String(player.name || '').toLowerCase() === name.toLowerCase());
          if (index >= 0) topPlayers.splice(index, 1);
        }
        splitTopPlayersIntoPositions();
        removePlayerForm.reset();
        setLayoutDirty(true);
        renderActiveBoard();
        setActionStatus('Player removed from TOP board.');
        return;
      }

      await requestJson(`/api/admin/rankings/position/${activePosition}/remove`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ rank, name, position: activePosition })
      });
      removePlayerForm.reset();
      await loadPositionRankings(activePosition);
    } catch (error) {
      setActionStatus(error.message);
    }
  });

  if (positionTabs) {
    positionTabs.addEventListener('click', async (e) => {
      const target = e.target;
      if (!(target instanceof HTMLElement) || !target.classList.contains('admin-pos-tab')) return;
      const position = String(target.dataset.pos || '').trim().toUpperCase();
      if (!BOARD_POSITIONS.includes(position)) return;
      await loadPositionRankings(position);
    });
  }

  if (tierBoard) {
    tierBoard.addEventListener('click', async (e) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.classList.contains('admin-top-add-btn')) {
        const playerName = String(target.dataset.playerName || '').trim().toLowerCase();
        const playerPosition = String(target.dataset.playerPosition || '').trim().toUpperCase();
        const poolPlayer = (positionPlayers[playerPosition] || []).find((player) => String(player.name || '').toLowerCase() === playerName);
        if (poolPlayer) {
          pushUndoSnapshot();
          topPlayers.push({ ...poolPlayer, position: playerPosition, tierBreakBefore: false });
          topPlayers = withPersistedTierLabels(topPlayers, 'TOP');
          setLayoutDirty(true);
          renderActiveBoard();
          setActionStatus(`${poolPlayer.name} added to TOP board.`);
        }
        return;
      }
      if (target.classList.contains('admin-tier-break-remove')) {
        const breakIndex = Number(target.dataset.breakIndex || -1);
        const players = getActivePlayers();
        if (breakIndex > 0 && breakIndex < players.length) {
          pushUndoSnapshot();
          players[breakIndex].tierBreakBefore = false;
          if (isTopView()) {
            topPlayers = withPersistedTierLabels(players, 'TOP');
            splitTopPlayersIntoPositions();
          } else {
            positionPlayers[activePosition] = withPersistedTierLabels(players, activePosition);
          }
          setLayoutDirty(true);
          renderActiveBoard();
        }
        return;
      }
      if (!target.classList.contains('admin-row-remove')) return;
      const index = Number(target.dataset.index || -1);
      const players = getActivePlayers();
      if (index < 0 || index >= players.length) return;
      pushUndoSnapshot();
      if (players[index].tierBreakBefore && players[index + 1]) {
        players[index + 1].tierBreakBefore = true;
      }
      players.splice(index, 1);
      if (isTopView()) {
        topPlayers = withPersistedTierLabels(players, 'TOP');
        splitTopPlayersIntoPositions();
      } else {
        positionPlayers[activePosition] = withPersistedTierLabels(players, activePosition);
      }
      setLayoutDirty(true);
      renderActiveBoard();
    });
  }

  async function saveActiveRankingsFile() {
    setActionStatus(`Saving ${activePosition} file...`);
    try {
      if (isTopView()) {
        const topPayload = await requestJson('/api/admin/rankings/default/save', {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({
            players: withPersistedTierLabels(topPlayers, 'TOP').map((player, index) => ({
              ...player,
              id: index + 1,
              prerank: index + 1,
              avgValue: Number(player.avgValue || 0),
              draftChance: Number(player.draftChance || 0)
            }))
          })
        });

        setLayoutDirty(false);
        clearUndoHistory();
        setActionStatus('TOP rankings saved to top250.json.');
        await loadPositionRankings('TOP');
        showJsonSaveCompletedAlert(`Update completed. ${topPayload.sourceFile || 'top250.json'} finished updating on the server.`);
        return;
      }

      const players = withPersistedTierLabels(getActivePlayers(), activePosition).map((player, index) => ({
        ...player,
        id: index + 1,
        rank: index + 1,
        position: activePosition,
        avgValue: Number(player.avgValue || 0),
        draftChance: Number(player.draftChance || 0)
      }));
      const payload = await requestJson(`/api/admin/rankings/position/${activePosition}/save`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ players })
      });
      setLayoutDirty(false);
      clearUndoHistory();
      setActionStatus(`${activePosition} file saved.`);
      await loadPositionRankings(activePosition);
      rankingsSourceLabel.textContent = `${payload.sourceFile} (${payload.count} players)`;
      if (positionMeta[activePosition]) {
        updateRankingsMeta(positionMeta[activePosition], positionMeta[activePosition].count || players.length);
      }
      showJsonSaveCompletedAlert(`Update completed. ${payload.sourceFile || `${activePosition.toLowerCase()}.json`} finished updating on the server.`);
    } catch (error) {
      setActionStatus(error.message);
    }
  }

  if (saveRankingsLayoutBtn) {
    saveRankingsLayoutBtn.addEventListener('click', saveActiveRankingsFile);
  }

  if (tierInsertModeBtn) {
    tierInsertModeBtn.addEventListener('click', toggleTierInsertMode);
  }

  if (saveJsonFileBtn) {
    saveJsonFileBtn.addEventListener('click', saveActiveRankingsFile);
  }

  if (clearTopBoardBtn) {
    clearTopBoardBtn.addEventListener('click', () => {
      if (!isTopView() || !Array.isArray(topPlayers) || topPlayers.length === 0) return;
      pushUndoSnapshot();
      topPlayers = [];
      splitTopPlayersIntoPositions();
      setLayoutDirty(true);
      renderActiveBoard();
      setActionStatus('Cleared all players from the TOP board. Position files were not changed.');
    });
  }

  if (undoRankingsEditBtn) {
    undoRankingsEditBtn.addEventListener('click', () => {
      const snapshot = undoStack.pop();
      if (!snapshot) return;
      restoreUndoSnapshot(snapshot);
      setActionStatus(`Undid last ${activePosition} rankings edit.`);
    });
  }

  if (dismissJsonSaveBannerBtn) {
    dismissJsonSaveBannerBtn.addEventListener('click', () => {
      hideJsonSaveCompletedAlert();
    });
  }

  if (resetUnsavedBtn) {
    resetUnsavedBtn.addEventListener('click', async () => {
      await loadPositionRankings(activePosition);
    });
  }

  clearUndoHistory();
  loadTierInsertModePreference();
  const requestedFromHash = parseRankingsHashPosition(window.location.hash);
  if (requestedFromHash) {
    activePosition = requestedFromHash;
  }
  setLayoutDirty(false);
  applyTierInsertMode();
  updatePositionTabs();
  setOverviewMode(false);
  setConnectApproved(false);

  window.addEventListener('hashchange', async () => {
    const requestedPosition = parseRankingsHashPosition(window.location.hash);
    if (!requestedPosition || requestedPosition === activePosition) return;

    activePosition = requestedPosition;
    updatePositionTabs();

    const managerAnchor = document.getElementById('default-rankings-manager');
    if (managerAnchor) {
      managerAnchor.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    if (String(keyInput.value || '').trim()) {
      await loadPositionRankings(requestedPosition);
    } else {
      renderActiveBoard();
      setActionStatus(`Connect admin access to load ${requestedPosition} rankings.`);
    }
  });

  window.addEventListener('resize', () => {
    try {
      const parsed = JSON.parse(String(overviewOutput.textContent || '{}'));
      if (parsed && parsed.traffic) {
        renderOverviewCharts(parsed.traffic);
      }
    } catch (_error) {
      // ignore
    }
  });
});