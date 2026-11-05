'use strict';

(() => {
  const ADMIN_KEY_STORAGE_KEY = 'adminApiKey';
  const POSITIONS = ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'EDGE', 'LB', 'DB'];
  const POSITION_LABELS = {
    QB: 'Quarterbacks', RB: 'Running Backs', WR: 'Wide Receivers', TE: 'Tight Ends',
    OL: 'Offensive Line', DL: 'Defensive Line', EDGE: 'Edge', LB: 'Linebackers', DB: 'Defensive Backs'
  };
  const NFL_TEAMS = [
    ['ARI', 'Arizona'], ['ATL', 'Atlanta'], ['BAL', 'Baltimore'], ['BUF', 'Buffalo'],
    ['CAR', 'Carolina'], ['CHI', 'Chicago'], ['CIN', 'Cincinnati'], ['CLE', 'Cleveland'],
    ['DAL', 'Dallas'], ['DEN', 'Denver'], ['DET', 'Detroit'], ['GB', 'Green Bay'],
    ['HOU', 'Houston'], ['IND', 'Indianapolis'], ['JAC', 'Jacksonville'], ['KC', 'Kansas City'],
    ['LAC', 'LA Chargers'], ['LAR', 'LA Rams'], ['LV', 'Las Vegas'], ['MIA', 'Miami'],
    ['MIN', 'Minnesota'], ['NE', 'New England'], ['NO', 'New Orleans'], ['NYG', 'NY Giants'],
    ['NYJ', 'NY Jets'], ['PHI', 'Philadelphia'], ['PIT', 'Pittsburgh'], ['SEA', 'Seattle'],
    ['SF', 'San Francisco'], ['TB', 'Tampa Bay'], ['TEN', 'Tennessee'], ['WAS', 'Washington']
  ];
  const workspace = document.getElementById('mockAdminWorkspace');
  const keyInput = document.getElementById('mockAdminKeyInput');
  const connectForm = document.getElementById('mockAdminConnectForm');
  const connectStatus = document.getElementById('mockAdminConnectStatus');
  const statusOutput = document.getElementById('mockAdminStatus');
  const titleOutput = document.getElementById('mockAdminViewTitle');
  const roster = document.getElementById('mockProspectRoster');
  const rosterCount = document.getElementById('mockRosterCount');
  const prospectForm = document.getElementById('mockProspectForm');
  const searchInput = document.getElementById('mockProspectSearch');

  let adminKey = '';
  let boards = Object.fromEntries(POSITIONS.map(position => [position, []]));
  let overallOrder = [];
  let teamOrder = NFL_TEAMS.map(([code]) => code);
  let teamNeeds = {};
  let activePosition = 'QB';
  let activeView = 'position';
  let selectedIndex = -1;
  let dragIndex = -1;
  let overallDragIndex = -1;
  let teamDragIndex = -1;
  let dirtyBoards = new Set();
  let overallDirty = false;
  let teamOrderDirty = false;

  function setStatus(message, state = '') {
    statusOutput.textContent = message;
    statusOutput.classList.toggle('is-error', state === 'error');
    statusOutput.classList.toggle('is-saving', state === 'saving');
  }

  function makeProspectImage(source, className, alt) {
    if (!source) return null;
    const image = document.createElement('img');
    image.className = className;
    image.alt = alt;
    image.loading = 'eager';
    image.decoding = 'async';
    image.src = source;
    image.addEventListener('error', () => image.remove(), { once: true });
    return image;
  }

  function getAdminKey() {
    return String(keyInput.value || adminKey || '').trim();
  }

  function headers() {
    return { 'Content-Type': 'application/json', 'x-admin-key': getAdminKey() };
  }

  async function requestJson(url, options = {}) {
    const response = await fetch(url, { cache: 'no-store', ...options });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload || payload.ok === false) {
      const message = payload && payload.error ? payload.error : `Request failed (${response.status})`;
      throw new Error(message);
    }
    return payload;
  }

  async function connectAdmin() {
    adminKey = getAdminKey();
    if (!adminKey) throw new Error('Enter the admin key.');
    await requestJson('/api/admin/traffic', { headers: { 'x-admin-key': adminKey } });
    sessionStorage.setItem(ADMIN_KEY_STORAGE_KEY, adminKey);
    await loadAllBoards();
    workspace.hidden = false;
    keyInput.value = '';
    connectStatus.textContent = 'Connected';
    document.getElementById('mockAdminConnectBtn').textContent = 'Connected';
  }

  function normalizeBoardPlayer(player, position, index) {
    const result = { ...player };
    result.name = String(result.name || '').trim();
    result.position = position;
    result.subPosition = String(result.subPosition || position).trim();
    result.school = String(result.school || '').trim();
    result.rank = index + 1;
    result.height = String(result.height || '').trim();
    result.weightLbs = result.weightLbs === '' || result.weightLbs == null ? '' : Number(result.weightLbs);
    result.listingMetrics = String(result.listingMetrics || '');
    result.summary = String(result.summary || '');
    result.imageUrl = String(result.imageUrl || '');
    result.profileUrl = String(result.profileUrl || '');
    result.schoolLogoUrl = String(result.schoolLogoUrl || '');
    return result;
  }

  async function loadAllBoards() {
    setStatus('Loading prospect boards...');
    const payload = await requestJson('/api/admin/mock-draft/prospects', { headers: { 'x-admin-key': getAdminKey() } });
    boards = Object.fromEntries(POSITIONS.map(position => [
      position,
      Array.isArray(payload.boards && payload.boards[position])
        ? payload.boards[position].map((player, index) => normalizeBoardPlayer(player, position, index))
        : []
    ]));
    overallOrder = Array.isArray(payload.overallOrder) ? payload.overallOrder.map(String) : [];
    teamOrder = Array.isArray(payload.teamOrder) ? payload.teamOrder.map(String) : NFL_TEAMS.map(([code]) => code);
    try {
      const response = await fetch(`/college%20prospects%202027/team-needs-2027.json?v=${Date.now()}`, { cache: 'no-store' });
      if (response.ok) teamNeeds = await response.json();
    } catch (_error) {
      teamNeeds = {};
    }
    dirtyBoards.clear();
    overallDirty = false;
    teamOrderDirty = false;
    selectedIndex = boards[activePosition].length ? 0 : -1;
    reconcileOverallOrder();
    renderActiveView();
    setStatus(`Loaded ${POSITIONS.reduce((count, position) => count + boards[position].length, 0)} position-board entries`);
    document.dispatchEvent(new CustomEvent('mock-admin-boards-loaded', { detail: { boards, teamOrder } }));
  }

  function slug(value) {
    return String(value || '').trim().toLowerCase().normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  function playerKey(player) {
    return `${slug(player.name)}::${slug(player.school)}`;
  }

  function edgeRole(player) {
    return /ED|EDGE|DE/i.test(String(player.subPosition || '')) || player.position === 'EDGE';
  }

  function positionScore(player) {
    if (edgeRole(player)) return 90;
    if (player.position === 'DL') return 80;
    if (player.position === 'LB') return 70;
    return 60;
  }

  function getUniqueProspects() {
    const unique = new Map();
    POSITIONS.forEach(position => {
      boards[position].forEach((player, index) => {
        if (!player.name) return;
        const key = playerKey(player);
        const existing = unique.get(key);
        if (!existing) {
          unique.set(key, { key, player, position, rank: index + 1, sourcePositions: [position] });
          return;
        }
        if (!existing.sourcePositions.includes(position)) existing.sourcePositions.push(position);
        if (positionScore(player) > positionScore(existing.player)) {
          existing.player = player;
          existing.position = position;
          existing.rank = index + 1;
        }
      });
    });
    return unique;
  }

  function reconcileOverallOrder() {
    const unique = getUniqueProspects();
    const seen = new Set();
    overallOrder = overallOrder.filter(key => unique.has(key) && !seen.has(key) && seen.add(key));
    unique.forEach((_player, key) => {
      if (!seen.has(key)) {
        overallOrder.push(key);
        seen.add(key);
      }
    });
  }

  function setActiveView(view, position = activePosition) {
    activeView = view;
    activePosition = position;
    document.querySelectorAll('.mock-admin-tab').forEach(tab => {
      const selected = tab.dataset.view ? tab.dataset.view === view : view === 'position' && tab.dataset.position === position;
      tab.classList.toggle('active', selected);
      tab.setAttribute('aria-pressed', String(selected));
    });
    document.getElementById('positionEditorView').hidden = view !== 'position';
    document.getElementById('overallEditorView').hidden = view !== 'overall';
    document.getElementById('teamOrderEditorView').hidden = view !== 'teams';
    document.getElementById('scoringEditorView').hidden = view !== 'scoring';
    titleOutput.textContent = view === 'position' ? POSITION_LABELS[position] : view === 'overall' ? 'Overall Prospect Ranking' : view === 'scoring' ? 'Actual Results & Scoring' : 'Default Team Draft Order';
    renderActiveView();
  }

  function rerankPosition(position) {
    boards[position].forEach((player, index) => {
      player.position = position;
      player.rank = index + 1;
    });
  }

  function moveItem(items, fromIndex, toIndex) {
    if (fromIndex < 0 || toIndex < 0 || fromIndex >= items.length || toIndex >= items.length || fromIndex === toIndex) return false;
    const [item] = items.splice(fromIndex, 1);
    items.splice(toIndex, 0, item);
    return true;
  }

  function renderPositionRoster() {
    const players = boards[activePosition];
    const query = String(searchInput.value || '').trim().toLowerCase();
    const fragment = document.createDocumentFragment();
    const visible = players.map((player, index) => ({ player, index })).filter(({ player }) =>
      !query || `${player.name} ${player.school} ${player.subPosition}`.toLowerCase().includes(query)
    );
    rosterCount.textContent = `${players.length} players`;
    visible.forEach(({ player, index }) => {
      const row = document.createElement('div');
      row.className = `mock-roster-row${index === selectedIndex ? ' active' : ''}`;
      row.setAttribute('role', 'listitem');
      row.draggable = true;
      row.addEventListener('click', () => {
        selectedIndex = index;
        renderPositionRoster();
        renderPlayerForm();
      });
      row.addEventListener('dragstart', event => {
        dragIndex = index;
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', String(index));
      });
      row.addEventListener('dragover', event => {
        event.preventDefault();
        row.classList.add('drop-target');
      });
      row.addEventListener('dragleave', () => row.classList.remove('drop-target'));
      row.addEventListener('drop', event => {
        event.preventDefault();
        row.classList.remove('drop-target');
        const from = Number(event.dataTransfer.getData('text/plain'));
        if (moveItem(players, from, index)) {
          selectedIndex = index;
          rerankPosition(activePosition);
          dirtyBoards.add(activePosition);
          reconcileOverallOrder();
          renderActiveView();
        }
      });

      const rank = document.createElement('span');
      rank.className = 'mock-row-rank';
      rank.textContent = String(index + 1).padStart(2, '0');
      const headshot = makeProspectImage(player.imageUrl, 'mock-admin-headshot', `${player.name} headshot`);
      const copy = document.createElement('span');
      copy.className = 'mock-row-copy';
      const name = document.createElement('span');
      name.className = 'mock-row-name';
      name.textContent = player.name || 'Unnamed prospect';
      const meta = document.createElement('span');
      meta.className = 'mock-row-meta';
      const schoolMark = makeProspectImage(player.schoolLogoUrl, 'mock-admin-school-mark', `${player.school} mark`);
      if (schoolMark) meta.append(schoolMark);
      const metaText = document.createElement('span');
      metaText.textContent = [player.school || 'School not set', player.subPosition || activePosition].filter(Boolean).join(' · ');
      meta.append(metaText);
      copy.append(name, meta);
      const grip = document.createElement('span');
      grip.className = 'mock-row-grip';
      grip.setAttribute('aria-hidden', 'true');
      grip.textContent = '⠿';
      row.append(rank);
      if (headshot) row.append(headshot);
      row.append(copy, grip);
      fragment.append(row);
    });
    roster.replaceChildren(fragment);
  }

  function renderPlayerForm() {
    const player = boards[activePosition][selectedIndex];
    const fields = Array.from(prospectForm.elements).filter(element => element.name);
    fields.forEach(field => {
      field.disabled = !player;
      if (!player) {
        field.value = '';
        return;
      }
      const value = field.name === 'rank' ? selectedIndex + 1 : player[field.name];
      field.value = value == null ? '' : String(value);
    });
    document.getElementById('mockDetailTitle').textContent = player ? player.name || 'New Prospect' : 'Select a prospect';
    document.getElementById('mockDeleteProspectBtn').disabled = !player;
  }

  function renderOverallRoster() {
    reconcileOverallOrder();
    const unique = getUniqueProspects();
    const target = document.getElementById('mockOverallRoster');
    const fragment = document.createDocumentFragment();
    document.getElementById('mockOverallCount').textContent = `${overallOrder.length} prospects`;
    overallOrder.forEach((key, index) => {
      const entry = unique.get(key);
      if (!entry) return;
      const row = document.createElement('div');
      row.className = 'mock-roster-row mock-overall-row';
      row.setAttribute('role', 'listitem');
      row.draggable = true;
      row.addEventListener('dragstart', event => {
        overallDragIndex = index;
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', String(index));
      });
      row.addEventListener('dragover', event => { event.preventDefault(); row.classList.add('drop-target'); });
      row.addEventListener('dragleave', () => row.classList.remove('drop-target'));
      row.addEventListener('drop', event => {
        event.preventDefault();
        row.classList.remove('drop-target');
        const from = Number(event.dataTransfer.getData('text/plain'));
        if (moveItem(overallOrder, from, index)) {
          overallDirty = true;
          renderOverallRoster();
          updateDirtyButtons();
        }
      });
      const rank = document.createElement('span');
      rank.className = 'mock-row-rank';
      rank.textContent = String(index + 1).padStart(3, '0');
      const headshot = makeProspectImage(entry.player.imageUrl, 'mock-admin-headshot', `${entry.player.name} headshot`);
      const copy = document.createElement('span');
      copy.className = 'mock-row-copy';
      const name = document.createElement('span');
      name.className = 'mock-row-name';
      name.textContent = entry.player.name;
      const meta = document.createElement('span');
      meta.className = 'mock-row-meta';
      const schoolMark = makeProspectImage(entry.player.schoolLogoUrl, 'mock-admin-school-mark', `${entry.player.school} mark`);
      if (schoolMark) meta.append(schoolMark);
      const metaText = document.createElement('span');
      metaText.textContent = `${entry.player.school || 'School not set'} · ${entry.position} · ${entry.sourcePositions.join('/')}`;
      meta.append(metaText);
      copy.append(name, meta);
      const rankInput = document.createElement('input');
      rankInput.type = 'number';
      rankInput.min = '1';
      rankInput.max = String(overallOrder.length);
      rankInput.value = String(index + 1);
      rankInput.className = 'mock-overall-rank-input';
      rankInput.setAttribute('aria-label', `Overall rank for ${entry.player.name}`);
      rankInput.addEventListener('change', () => {
        const requested = Math.max(1, Math.min(overallOrder.length, Number(rankInput.value) || index + 1)) - 1;
        if (moveItem(overallOrder, index, requested)) {
          overallDirty = true;
          renderOverallRoster();
          updateDirtyButtons();
        }
      });
      row.append(rank);
      if (headshot) row.append(headshot);
      row.append(copy, rankInput);
      fragment.append(row);
    });
    target.replaceChildren(fragment);
  }

  function renderTeamOrder() {
    const target = document.getElementById('mockTeamOrderRoster');
    const fragment = document.createDocumentFragment();
    teamOrder.forEach((code, index) => {
      const row = document.createElement('div');
      row.className = 'mock-team-order-row';
      row.draggable = true;
      row.setAttribute('role', 'listitem');
      row.addEventListener('dragstart', event => {
        teamDragIndex = index;
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', String(index));
      });
      row.addEventListener('dragover', event => { event.preventDefault(); row.classList.add('drop-target'); });
      row.addEventListener('dragleave', () => row.classList.remove('drop-target'));
      row.addEventListener('drop', event => {
        event.preventDefault();
        row.classList.remove('drop-target');
        const from = Number(event.dataTransfer.getData('text/plain'));
        if (moveItem(teamOrder, from, index)) {
          teamOrderDirty = true;
          renderTeamOrder();
          updateDirtyButtons();
        }
      });
      const codeLabel = document.createElement('span');
      codeLabel.className = 'mock-team-order-code';
      codeLabel.textContent = code;
      const cityLabel = document.createElement('span');
      cityLabel.className = 'mock-team-order-city';
      cityLabel.textContent = (NFL_TEAMS.find(([teamCode]) => teamCode === code) || [code, code])[1];
      const teamCopy = document.createElement('span');
      teamCopy.className = 'mock-team-order-copy';
      teamCopy.append(cityLabel);
      const entry = teamNeeds[code];
      if (entry && Array.isArray(entry.needs) && entry.needs.length) {
        teamCopy.title = entry.name;
        const needs = document.createElement('span');
        needs.className = 'mock-team-order-needs';
        needs.textContent = entry.needs.map((need, index) => `${index + 1}. ${need}`).join(' / ');
        teamCopy.append(needs);
      }
      const slot = document.createElement('span');
      slot.className = 'mock-team-order-index';
      slot.textContent = String(index + 1).padStart(2, '0');
      row.append(codeLabel, teamCopy, slot);
      fragment.append(row);
    });
    target.replaceChildren(fragment);
  }

  function renderActiveView() {
    if (activeView === 'position') {
      renderPositionRoster();
      renderPlayerForm();
    } else if (activeView === 'overall') {
      renderOverallRoster();
    } else if (activeView === 'teams') {
      renderTeamOrder();
    }
    updateDirtyButtons();
  }

  function updateDirtyButtons() {
    document.getElementById('mockSaveBoardBtn').disabled = !dirtyBoards.has(activePosition);
    document.getElementById('mockSaveOverallBtn').disabled = !overallDirty;
    document.getElementById('mockSaveTeamOrderBtn').disabled = !teamOrderDirty;
  }

  async function savePositionBoard() {
    const players = boards[activePosition];
    if (players.some(player => !String(player.name || '').trim())) throw new Error('Every prospect needs a name before saving.');
    rerankPosition(activePosition);
    setStatus(`Saving ${activePosition} board...`, 'saving');
    await requestJson(`/api/admin/mock-draft/prospects/${encodeURIComponent(activePosition)}/save`, {
      method: 'POST', headers: headers(), body: JSON.stringify({ players })
    });
    dirtyBoards.delete(activePosition);
    reconcileOverallOrder();
    renderActiveView();
    setStatus(`${POSITION_LABELS[activePosition]} saved (${players.length} prospects)`);
  }

  async function saveOverallOrder() {
    reconcileOverallOrder();
    setStatus('Saving overall ranking...', 'saving');
    await requestJson('/api/admin/mock-draft/overall/save', {
      method: 'POST', headers: headers(), body: JSON.stringify({ order: overallOrder })
    });
    overallDirty = false;
    updateDirtyButtons();
    setStatus(`Overall order saved (${overallOrder.length} prospects)`);
  }

  async function saveDefaultTeamOrder() {
    setStatus('Saving default team order...', 'saving');
    await requestJson('/api/admin/mock-draft/team-order/save', {
      method: 'POST', headers: headers(), body: JSON.stringify({ order: teamOrder })
    });
    teamOrderDirty = false;
    updateDirtyButtons();
    setStatus('Default team draft order saved');
  }

  connectForm.addEventListener('submit', async event => {
    event.preventDefault();
    connectStatus.textContent = 'Checking admin access...';
    try {
      await connectAdmin();
    } catch (error) {
      connectStatus.textContent = error.message || 'Unable to unlock admin tools.';
    }
  });

  document.querySelectorAll('.mock-admin-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      if (tab.dataset.position) {
        activePosition = tab.dataset.position;
        selectedIndex = boards[activePosition].length ? 0 : -1;
        searchInput.value = '';
        setActiveView('position', activePosition);
      } else {
        setActiveView(tab.dataset.view);
      }
    });
  });

  searchInput.addEventListener('input', renderPositionRoster);
  document.getElementById('mockReloadBoardBtn').addEventListener('click', async () => {
    if ((dirtyBoards.size || overallDirty || teamOrderDirty) && !window.confirm('Reload from saved files and discard all unsaved edits?')) return;
    try { await loadAllBoards(); } catch (error) { setStatus(error.message, 'error'); }
  });
  document.getElementById('mockSaveBoardBtn').addEventListener('click', async () => {
    try { await savePositionBoard(); } catch (error) { setStatus(error.message, 'error'); }
  });
  document.getElementById('mockSaveOverallBtn').addEventListener('click', async () => {
    try { await saveOverallOrder(); } catch (error) { setStatus(error.message, 'error'); }
  });
  document.getElementById('mockSaveTeamOrderBtn').addEventListener('click', async () => {
    try { await saveDefaultTeamOrder(); } catch (error) { setStatus(error.message, 'error'); }
  });

  prospectForm.addEventListener('input', event => {
    const player = boards[activePosition][selectedIndex];
    if (!player || event.target.name === 'rank') return;
    const { name, value } = event.target;
    player[name] = name === 'weightLbs' ? (value === '' ? '' : Number(value)) : value;
    dirtyBoards.add(activePosition);
    document.getElementById('mockDetailTitle').textContent = player.name || 'New Prospect';
    renderPositionRoster();
    updateDirtyButtons();
  });
  prospectForm.elements.rank.addEventListener('change', () => {
    const targetRank = Number(prospectForm.elements.rank.value);
    if (!Number.isInteger(targetRank)) return;
    const targetIndex = Math.max(0, Math.min(boards[activePosition].length - 1, targetRank - 1));
    if (moveItem(boards[activePosition], selectedIndex, targetIndex)) {
      selectedIndex = targetIndex;
      rerankPosition(activePosition);
      dirtyBoards.add(activePosition);
      reconcileOverallOrder();
      renderActiveView();
    }
  });
  document.getElementById('mockAddProspectBtn').addEventListener('click', () => {
    const players = boards[activePosition];
    players.push({
      rank: players.length + 1, name: '', position: activePosition,
      subPosition: activePosition, school: '', height: '', weightLbs: '',
      listingMetrics: '', summary: '', imageUrl: '', profileUrl: '', schoolLogoUrl: ''
    });
    selectedIndex = players.length - 1;
    dirtyBoards.add(activePosition);
    renderActiveView();
    prospectForm.elements.name.focus();
  });
  document.getElementById('mockDeleteProspectBtn').addEventListener('click', () => {
    const player = boards[activePosition][selectedIndex];
    if (!player || !window.confirm(`Remove ${player.name || 'this prospect'} from ${activePosition}?`)) return;
    boards[activePosition].splice(selectedIndex, 1);
    rerankPosition(activePosition);
    selectedIndex = boards[activePosition].length ? Math.min(selectedIndex, boards[activePosition].length - 1) : -1;
    dirtyBoards.add(activePosition);
    reconcileOverallOrder();
    renderActiveView();
  });

  document.getElementById('mockResetTeamOrderBtn').addEventListener('click', () => {
    if (!window.confirm('Reset the team order to the default NFL code order?')) return;
    teamOrder = NFL_TEAMS.map(([code]) => code);
    teamOrderDirty = true;
    renderTeamOrder();
    updateDirtyButtons();
  });

  try {
    adminKey = String(sessionStorage.getItem(ADMIN_KEY_STORAGE_KEY) || '').trim();
    if (adminKey) connectAdmin().catch(error => {
      sessionStorage.removeItem(ADMIN_KEY_STORAGE_KEY);
      adminKey = '';
      connectStatus.textContent = error.message || 'Reconnect with the admin key.';
    });
  } catch (_error) {
    adminKey = '';
  }
})();