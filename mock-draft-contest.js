'use strict';

const ADMIN_BUILDER_MODE = new URLSearchParams(location.search).get('adminBuilder') === '1';
const MOCK_STORAGE_KEY = ADMIN_BUILDER_MODE ? 'hushAdminMockDraftBuilderV1' : 'hushMockDraftContestV1';
const PROSPECTS_STORAGE_KEY = 'hushMockDraftProspectsV1';
const POSITION_PROSPECT_FILES = {
  QB: '/college%20prospects%202027/QB/qb-prospects-2027.json?v=prospect-assets-2027',
  RB: '/college%20prospects%202027/RB/rb-prospects-2027.json?v=prospect-assets-2027',
  WR: '/college%20prospects%202027/WR/wr-prospects-2027.json?v=prospect-assets-2027',
  TE: '/college%20prospects%202027/TE/te-prospects-2027.json?v=prospect-assets-2027',
  OL: '/college%20prospects%202027/OL/ol-prospects-2027.json?v=prospect-assets-2027',
  DL: '/college%20prospects%202027/DL/dl-prospects-2027.json?v=prospect-assets-2027',
  EDGE: '/college%20prospects%202027/EDGE/edge-prospects-2027.json?v=prospect-assets-2027',
  LB: '/college%20prospects%202027/LB/lb-prospects-2027.json?v=prospect-assets-2027',
  DB: '/college%20prospects%202027/DB/db-prospects-2027.json?v=prospect-assets-2027'
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
const POSITION_ALIASES = {
  C: 'OL', CB: 'DB', DB: 'DB', DE: 'EDGE', DT: 'DL', EDGE: 'EDGE', FS: 'DB', ILB: 'LB',
  LB: 'LB', NT: 'DL', OL: 'OL', OT: 'OL', OG: 'OL', S: 'DB', SAF: 'DB', SS: 'DB'
};

const pickList = document.getElementById('mockPickList');
const prospectPool = document.getElementById('prospectPool');
const prospectPoolStatus = document.getElementById('prospectPoolStatus');
const prospectCount = document.getElementById('prospectCount');
const pickProgress = document.getElementById('mockPickProgress');
const saveStatus = document.getElementById('mockSaveStatus');
const searchInput = document.getElementById('prospectSearch');
const fileInput = document.getElementById('prospectFileInput');
const profileDialog = document.getElementById('prospectProfileDialog');
const profileContent = document.getElementById('prospectProfileContent');

let prospects = [];
let positionProspects = Object.fromEntries(Object.keys(POSITION_PROSPECT_FILES).map(position => [position, []]));
let overallOrder = [];
let picks = Array.from({ length: 32 }, () => ({ playerId: '', team: '', tradeTo: '' }));
let defaultTeamOrder = NFL_TEAMS.map(([code]) => code);
let teamNeeds = {};
let activePosition = 'ALL';
let searchQuery = '';
let saveTimer = null;

function normalizePosition(value) {
  const position = String(value || '').trim().toUpperCase();
  return POSITION_ALIASES[position] || position;
}

function prospectKey(name, school) {
  const slug = value => String(value || '').trim().toLowerCase().normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${slug(name)}::${slug(school)}`;
}

function normalizeProspectRows(payload) {
  const rows = Array.isArray(payload)
    ? payload
    : (Array.isArray(payload && payload.prospects) ? payload.prospects
      : (Array.isArray(payload && payload.players) ? payload.players : []));
  const usedIds = new Set();

  return rows.reduce((result, row, index) => {
    if (!row || typeof row !== 'object') return result;
    const name = String(row.name || row.playerName || row.fullName || '').trim();
    if (!name) return result;
    const school = String(row.school || row.college || row.team || row.schoolName || '').trim();
    const baseId = prospectKey(name, school) || String(row.id || row.playerId || name).trim();
    let id = baseId;
    let suffix = 2;
    while (usedIds.has(id)) id = `${baseId}-${suffix++}`;
    usedIds.add(id);

    result.push({
      id: baseId,
      name,
      position: normalizePosition(row.position || row.pos || row.positionGroup),
      subPosition: String(row.subPosition || ''),
      school,
      rank: Number(row.rank || row.overallRank || row.projection || index + 1),
      height: String(row.height || ''),
      weightLbs: row.weightLbs == null ? '' : row.weightLbs,
      listingMetrics: String(row.listingMetrics || ''),
      summary: String(row.summary || ''),
      imageUrl: String(row.imageUrl || ''),
      schoolLogoUrl: String(row.schoolLogoUrl || ''),
      profileUrl: String(row.profileUrl || '')
    });
    return result;
  }, []);
}

function setSaveStatus(text, state = '') {
  saveStatus.textContent = text;
  saveStatus.classList.toggle('is-saving', state === 'saving');
  saveStatus.classList.toggle('is-error', state === 'error');
}

function saveMock() {
  if (ADMIN_BUILDER_MODE && window.parent !== window) window.parent.postMessage({ type: 'hush-mock-builder-changed' }, location.origin);
  setSaveStatus('Saving...', 'saving');
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    try {
      localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify({ version: 1, picks }));
      setSaveStatus('Saved locally');
    } catch (_error) {
      setSaveStatus('Save unavailable', 'error');
    }
  }, 120);
}

function restoreMock() {
  try {
    const saved = JSON.parse(localStorage.getItem(MOCK_STORAGE_KEY) || 'null');
    if (!saved || !Array.isArray(saved.picks)) return;
    picks = Array.from({ length: 32 }, (_, index) => {
      const pick = saved.picks[index] || {};
      return {
        playerId: String(pick.playerId || ''),
        team: NFL_TEAMS.some(([code]) => code === pick.team) ? pick.team : '',
        tradeTo: NFL_TEAMS.some(([code]) => code === pick.tradeTo) ? pick.tradeTo : '',
        trade: pick.trade === true || Boolean(pick.tradeTo)
      };
    });
  } catch (_error) {
    localStorage.removeItem(MOCK_STORAGE_KEY);
  }
}

function applyDefaultTeamOrder() {
  let changed = false;
  picks = picks.map((pick, index) => {
    if (pick.team || !defaultTeamOrder[index]) return pick;
    changed = true;
    return { ...pick, team: defaultTeamOrder[index] };
  });
  if (changed) saveMock();
}

function getProspectById(id) {
  return prospects.find(prospect => prospect.id === id) || null;
}

function getDraftedIds() {
  return new Set(picks.map(pick => pick.playerId).filter(Boolean));
}

function getProspectsForActiveFilter() {
  if (activePosition !== 'ALL') return positionProspects[activePosition] || [];
  const byId = new Map(prospects.map(prospect => [prospect.id, prospect]));
  const ordered = overallOrder.map((id, index) => {
    const prospect = byId.get(id);
    return prospect ? { ...prospect, displayRank: index + 1 } : null;
  }).filter(Boolean);
  const included = new Set(ordered.map(prospect => prospect.id));
  prospects.forEach(prospect => {
    if (!included.has(prospect.id)) ordered.push({ ...prospect, displayRank: ordered.length + 1 });
  });
  return ordered;
}

function makeProspectImage(source, className, alt) {
  const image = document.createElement('img');
  image.className = className;
  image.alt = alt;
  image.loading = 'eager';
  image.decoding = 'async';
  image.src = source;
  image.addEventListener('error', () => {
    const row = image.parentElement;
    image.remove();
    if (row && row.classList.contains('mock-prospect-row')) row.classList.add('has-no-headshot');
  }, { once: true });
  return image;
}

function createProfileButton(prospect) {
  const button = document.createElement('button');
  button.className = 'mock-profile-button';
  button.type = 'button';
  button.textContent = 'i';
  button.title = `View ${prospect.name} prospect profile`;
  button.setAttribute('aria-label', button.title);
  button.setAttribute('aria-haspopup', 'dialog');
  button.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    showProspectProfile(prospect);
  });
  return button;
}

function showProspectProfile(prospect) {
  profileContent.replaceChildren();
  const hero = document.createElement('header');
  hero.className = 'prospect-profile-hero';
  if (prospect.imageUrl) hero.append(makeProspectImage(prospect.imageUrl, 'prospect-profile-headshot', `${prospect.name} headshot`));

  const identity = document.createElement('div');
  identity.className = 'prospect-profile-identity';
  const school = document.createElement('div');
  school.className = 'prospect-profile-school';
  if (prospect.schoolLogoUrl) school.append(makeProspectImage(prospect.schoolLogoUrl, 'prospect-profile-school-mark', `${prospect.school} mark`));
  const schoolName = document.createElement('span');
  schoolName.textContent = prospect.school || 'School not listed';
  school.append(schoolName);
  const title = document.createElement('h2');
  title.id = 'prospectProfileTitle';
  title.textContent = prospect.name;
  const subtitle = document.createElement('p');
  subtitle.className = 'prospect-profile-subtitle';
  subtitle.textContent = `${prospect.subPosition || prospect.position} · ${prospect.position} prospect · Position rank #${prospect.rank}`;
  identity.append(school, title, subtitle);
  hero.append(identity);
  profileContent.append(hero);

  const facts = document.createElement('dl');
  facts.className = 'prospect-profile-facts';
  const factRows = [
    ['Height', prospect.height],
    ['Weight', prospect.weightLbs === '' || prospect.weightLbs == null ? '' : `${prospect.weightLbs} lb`],
    ['Listing metrics', prospect.listingMetrics]
  ].filter(([, value]) => String(value || '').trim());
  factRows.forEach(([label, value]) => {
    const item = document.createElement('div');
    item.className = 'prospect-profile-fact';
    const term = document.createElement('dt');
    term.textContent = label;
    const detail = document.createElement('dd');
    detail.textContent = value;
    item.append(term, detail);
    facts.append(item);
  });
  if (factRows.length) profileContent.append(facts);

  const summarySection = document.createElement('section');
  summarySection.className = 'prospect-profile-summary';
  const summaryHeading = document.createElement('h3');
  summaryHeading.textContent = 'Scouting summary';
  const summaryText = document.createElement('p');
  summaryText.textContent = String(prospect.summary || '').trim() || 'A scouting summary has not been added yet.';
  summarySection.append(summaryHeading, summaryText);
  profileContent.append(summarySection);

  if (prospect.profileUrl) {
    const sourceLink = document.createElement('a');
    sourceLink.className = 'prospect-profile-source';
    sourceLink.href = prospect.profileUrl;
    sourceLink.target = '_blank';
    sourceLink.rel = 'noopener noreferrer';
    sourceLink.textContent = 'Open full player profile';
    profileContent.append(sourceLink);
  }

  if (!profileDialog.open) profileDialog.showModal();
}

document.getElementById('closeProspectProfileBtn').addEventListener('click', () => profileDialog.close());
profileDialog.addEventListener('click', event => {
  if (event.target === profileDialog) profileDialog.close();
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && profileDialog.open) profileDialog.close();
});

function makeTeamSelect(value, label) {
  const select = document.createElement('select');
  select.className = 'mock-team-select';
  select.setAttribute('aria-label', label);
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = 'Team';
  select.append(placeholder);
  NFL_TEAMS.forEach(([code, city]) => {
    const option = document.createElement('option');
    option.value = code;
    option.textContent = `${code} · ${city}`;
    option.selected = code === value;
    select.append(option);
  });
  return select;
}

function renderPicks() {
  const fragment = document.createDocumentFragment();
  const filledCount = picks.filter(pick => pick.playerId && getProspectById(pick.playerId)).length;

  picks.forEach((pick, index) => {
    const prospect = getProspectById(pick.playerId);
    const row = document.createElement('article');
    row.className = 'mock-pick-row';
    row.dataset.pickIndex = String(index);
    row.setAttribute('aria-label', `Pick ${index + 1}`);

    const number = document.createElement('span');
    number.className = 'mock-pick-number';
    number.textContent = String(index + 1).padStart(2, '0');

    const teamSelect = makeTeamSelect(pick.team, `Team picking at pick ${index + 1}`);
    const teamChoice = document.createElement('div');
    teamChoice.className = 'mock-team-choice';
    const needsDisplay = document.createElement('div');
    needsDisplay.className = 'mock-team-needs';
    function updateNeedsDisplay() {
      const code = pick.tradeTo || pick.team;
      const entry = teamNeeds[code];
      needsDisplay.replaceChildren();
      needsDisplay.hidden = !entry || !Array.isArray(entry.needs) || !entry.needs.length;
      if (needsDisplay.hidden) return;
      needsDisplay.setAttribute('aria-label', `${entry.name} top needs`);
      const label = document.createElement('span');
      label.className = 'mock-team-needs-label';
      label.textContent = `${code} needs`;
      const list = document.createElement('ol');
      entry.needs.forEach((need, needIndex) => {
        const item = document.createElement('li');
        item.textContent = `${needIndex + 1}. ${need}`;
        list.append(item);
      });
      needsDisplay.append(label, list);
      teamSelect.title = teamNeeds[pick.team]?.name || 'Select an NFL team';
    }
    updateNeedsDisplay();
    teamChoice.append(teamSelect, needsDisplay);
    teamSelect.addEventListener('change', () => {
      picks[index].team = teamSelect.value;
      updateNeedsDisplay();
      saveMock();
    });

    const playerSlot = document.createElement('div');
    playerSlot.className = `mock-player-slot${prospect ? '' : ' is-empty'}`;
    if (prospect) {
      const info = document.createElement('span');
      info.className = 'mock-player-info';
      const nameRow = document.createElement('span');
      nameRow.className = 'mock-player-name-row';
      const name = document.createElement('span');
      name.className = 'mock-player-name';
      name.textContent = prospect.name;
      nameRow.append(name, createProfileButton(prospect));
      const meta = document.createElement('span');
      meta.className = 'mock-player-meta';
      if (prospect.schoolLogoUrl) meta.append(makeProspectImage(prospect.schoolLogoUrl, 'mock-school-mark', `${prospect.school} mark`));
      const schoolName = document.createElement('span');
      schoolName.textContent = prospect.school;
      meta.append(schoolName);
      const position = document.createElement('span');
      position.className = 'mock-player-position';
      position.textContent = prospect.position || '—';
      info.append(nameRow, meta);
      if (prospect.imageUrl) playerSlot.append(makeProspectImage(prospect.imageUrl, 'mock-player-headshot', `${prospect.name} headshot`));
      playerSlot.append(position, info);
      playerSlot.setAttribute('aria-label', `${prospect.position} ${prospect.name}, ${prospect.school}`);
    } else {
      playerSlot.textContent = 'Drop prospect here';
    }

    const clearButton = document.createElement('button');
    clearButton.className = 'mock-clear-pick';
    clearButton.type = 'button';
    clearButton.textContent = '×';
    clearButton.title = prospect ? `Remove ${prospect.name} from pick ${index + 1}` : 'Pick is empty';
    clearButton.setAttribute('aria-label', `Clear pick ${index + 1}`);
    clearButton.disabled = !prospect;
    clearButton.addEventListener('click', () => {
      picks[index].playerId = '';
      saveMock();
      render();
    });

    [row, playerSlot].forEach(target => {
      target.addEventListener('dragover', event => {
        event.preventDefault();
        row.classList.add('is-drop-target');
      });
      target.addEventListener('dragleave', event => {
        if (!row.contains(event.relatedTarget)) row.classList.remove('is-drop-target');
      });
      target.addEventListener('drop', event => {
        event.preventDefault();
        row.classList.remove('is-drop-target');
        const playerId = event.dataTransfer.getData('text/plain');
        if (playerId) assignProspect(playerId, index);
      });
    });

    const tradeDetails = document.createElement('details');
    tradeDetails.className = 'mock-trade-details';
    const tradeSummary = document.createElement('summary');
    tradeSummary.textContent = pick.tradeTo ? `Trade call: to ${pick.tradeTo}` : pick.trade ? 'Team will trade' : 'Add trade prediction';
    const tradeCallLabel = document.createElement('label');
    const tradeCallInput = document.createElement('input');
    tradeCallInput.type = 'checkbox';
    tradeCallInput.checked = pick.trade === true || Boolean(pick.tradeTo);
    tradeCallInput.setAttribute('aria-label', `Team will trade pick ${index + 1}`);
    tradeCallLabel.append(tradeCallInput, document.createTextNode(' Team will trade'));
    tradeCallInput.addEventListener('change', () => {
      picks[index].trade = tradeCallInput.checked;
      if (!tradeCallInput.checked) { picks[index].tradeTo = ''; tradeSelect.value = ''; }
      tradeSummary.textContent = tradeCallInput.checked ? 'Team will trade' : 'Add trade prediction';
      updateNeedsDisplay();
      saveMock();
    });
    const tradeFields = document.createElement('div');
    tradeFields.className = 'mock-trade-fields';
    const tradeLabel = document.createElement('span');
    tradeLabel.textContent = 'Pick traded to';
    const tradeSelect = makeTeamSelect(pick.tradeTo, `Trade recipient for pick ${index + 1}`);
    tradeSelect.classList.add('mock-trade-select');
    tradeSelect.addEventListener('change', () => {
      picks[index].tradeTo = tradeSelect.value;
      picks[index].trade = Boolean(tradeSelect.value) || tradeCallInput.checked;
      tradeCallInput.checked = picks[index].trade;
      tradeSummary.textContent = tradeSelect.value ? `Trade call: to ${tradeSelect.value}` : picks[index].trade ? 'Team will trade' : 'Add trade prediction';
      updateNeedsDisplay();
      saveMock();
    });
    tradeFields.append(tradeLabel, tradeSelect);
    tradeDetails.append(tradeSummary, tradeCallLabel, tradeFields);

    row.append(number, teamChoice, playerSlot, clearButton, tradeDetails);
    fragment.append(row);
  });

  pickList.replaceChildren(fragment);
  pickProgress.innerHTML = `${filledCount} <span>/ 32</span>`;
}

function renderProspects() {
  const draftedIds = getDraftedIds();
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const sourceProspects = getProspectsForActiveFilter();
  const filtered = sourceProspects.filter(prospect =>
    !normalizedQuery || `${prospect.name} ${prospect.school} ${prospect.position} ${prospect.subPosition}`.toLowerCase().includes(normalizedQuery)
  );

  prospectCount.textContent = `${sourceProspects.length} PLAYERS`;
  if (!prospects.length) {
    prospectPool.replaceChildren();
    const empty = document.createElement('div');
    empty.className = 'mock-pool-empty';
    const heading = document.createElement('strong');
    heading.textContent = 'Prospects are ready when you are';
    const message = document.createElement('span');
    message.textContent = 'Add a mock-draft-prospects.json file to the site, or import a prospect JSON file above.';
    empty.append(heading, message);
    prospectPool.append(empty);
    prospectPoolStatus.textContent = 'No prospect file loaded';
    return;
  }

  if (!filtered.length) {
    prospectPool.innerHTML = '<div class="mock-pool-empty">No prospects match this filter.</div>';
    prospectPoolStatus.textContent = '0 matching prospects';
    return;
  }

  const fragment = document.createDocumentFragment();
  filtered.forEach(prospect => {
    const drafted = draftedIds.has(prospect.id);
    const row = document.createElement('div');
    row.className = `mock-prospect-row${drafted ? ' is-drafted' : ''}${prospect.imageUrl ? '' : ' has-no-headshot'}`;
    row.draggable = !drafted;
    row.addEventListener('dragstart', event => {
      event.dataTransfer.setData('text/plain', prospect.id);
      event.dataTransfer.effectAllowed = 'move';
    });

    const rank = document.createElement('span');
    rank.className = 'mock-prospect-rank';
    const displayRank = prospect.displayRank || prospect.rank;
    rank.textContent = Number.isFinite(displayRank) ? String(displayRank) : '—';
    const identity = document.createElement('span');
    identity.className = 'mock-prospect-identity';
    const nameRow = document.createElement('span');
    nameRow.className = 'mock-prospect-name-row';
    const name = document.createElement('span');
    name.className = 'mock-prospect-name';
    name.textContent = prospect.name;
    nameRow.append(name, createProfileButton(prospect));
    const school = document.createElement('span');
    school.className = 'mock-prospect-school';
    if (prospect.schoolLogoUrl) school.append(makeProspectImage(prospect.schoolLogoUrl, 'mock-school-mark', `${prospect.school} mark`));
    const schoolName = document.createElement('span');
    schoolName.textContent = prospect.school;
    school.append(schoolName);
    identity.append(nameRow, school);
    const position = document.createElement('span');
    position.className = 'mock-prospect-pos';
    position.textContent = prospect.position || '—';
    const addButton = document.createElement('button');
    addButton.className = 'mock-add-prospect';
    addButton.type = 'button';
    addButton.textContent = drafted ? '✓' : '+';
    addButton.disabled = drafted;
    addButton.title = drafted ? 'Already selected' : `Add ${prospect.name} to next open pick`;
    addButton.setAttribute('aria-label', addButton.title);
    addButton.addEventListener('click', () => assignProspect(prospect.id));

    if (prospect.imageUrl) row.append(rank, makeProspectImage(prospect.imageUrl, 'mock-pool-headshot', `${prospect.name} headshot`), identity, position, addButton);
    else row.append(rank, identity, position, addButton);
    fragment.append(row);
  });
  prospectPool.replaceChildren(fragment);
  prospectPoolStatus.textContent = `${filtered.length} prospects shown · ${draftedIds.size} selected`;
}

function render() {
  renderPicks();
  renderProspects();
}

function assignProspect(playerId, requestedIndex) {
  if (!getProspectById(playerId)) return;
  const existingIndex = picks.findIndex(pick => pick.playerId === playerId);
  const targetIndex = Number.isInteger(requestedIndex)
    ? requestedIndex
    : picks.findIndex(pick => !pick.playerId);
  if (targetIndex < 0 || targetIndex >= picks.length) {
    prospectPoolStatus.textContent = 'All 32 picks are filled';
    return;
  }

  if (existingIndex >= 0 && existingIndex !== targetIndex) picks[existingIndex].playerId = '';
  picks[targetIndex].playerId = playerId;
  saveMock();
  render();
}

async function loadDefaultProspects() {
  try {
    const loadedBoards = await Promise.all(Object.entries(POSITION_PROSPECT_FILES).map(async ([position, url]) => {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Could not load ${position} prospect file (${response.status})`);
      const rows = await response.json();
      if (!Array.isArray(rows)) throw new Error(`${position} prospect file is not a JSON array`);
      return [position, normalizeProspectRows(rows.map(player => ({ ...player, position })))];
    }));

    positionProspects = Object.fromEntries(loadedBoards);
    const normalized = loadedBoards.flatMap(([, players]) => players);
    const merged = new Map();
    normalized.forEach(prospect => {
      const key = prospectKey(prospect.name, prospect.school);
      const current = merged.get(key);
      if (!current) {
        prospect.id = key;
        merged.set(key, prospect);
        return;
      }
      const currentIsEdge = current.position === 'EDGE' || /ED|DE/i.test(current.subPosition);
      const nextIsEdge = prospect.position === 'EDGE' || /ED|DE/i.test(prospect.subPosition);
      if (nextIsEdge && !currentIsEdge) {
        prospect.id = key;
        merged.set(key, prospect);
      }
    });

    prospects = Array.from(merged.values());
  await loadOverallOrder();
    const validIds = new Set(prospects.map(prospect => prospect.id));
    let removedStaleSelection = false;
    picks.forEach(pick => {
      if (pick.playerId && !validIds.has(pick.playerId)) {
        pick.playerId = '';
        removedStaleSelection = true;
      }
    });
    if (removedStaleSelection) saveMock();
    prospectPoolStatus.textContent = `Loaded ${prospects.length} college prospects`;
    render();
  } catch (_error) {
    try {
      const savedImport = normalizeProspectRows(JSON.parse(localStorage.getItem(PROSPECTS_STORAGE_KEY) || '[]'));
      if (savedImport.length) {
        prospects = savedImport;
        positionProspects = Object.fromEntries(Object.keys(POSITION_PROSPECT_FILES).map(position => [
          position,
          savedImport.filter(prospect => prospect.position === position)
        ]));
        prospectPoolStatus.textContent = `Loaded ${prospects.length} imported prospects`;
        render();
        return;
      }
    } catch (_storageError) {
      localStorage.removeItem(PROSPECTS_STORAGE_KEY);
    }
    prospectPoolStatus.textContent = 'Could not load the prospect files';
    renderProspects();
  }
}

async function loadOverallOrder() {
  try {
    const response = await fetch('/api/public/mock-draft/overall-order', { cache: 'no-store' });
    if (!response.ok) throw new Error('Overall order request failed');
    const payload = await response.json();
    overallOrder = Array.isArray(payload && payload.order) ? payload.order.map(String) : [];
  } catch (_error) {
    overallOrder = [];
  }
}

async function loadDefaultTeamOrder() {
  try {
    const payload = await fetch('/api/public/mock-draft/default-team-order', { cache: 'no-store' }).then(response => {
      if (!response.ok) throw new Error('Team-order request failed');
      return response.json();
    });
    const teamCodes = new Set(NFL_TEAMS.map(([code]) => code));
    const order = Array.isArray(payload && payload.order) ? payload.order : [];
    if (order.length === NFL_TEAMS.length && new Set(order).size === NFL_TEAMS.length && order.every(code => teamCodes.has(code))) {
      defaultTeamOrder = order;
    }
  } catch (_error) {
    defaultTeamOrder = NFL_TEAMS.map(([code]) => code);
  }
  applyDefaultTeamOrder();
  renderPicks();
}

async function loadTeamNeeds() {
  try {
    const response = await fetch(`/college%20prospects%202027/team-needs-2027.json?v=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error('Team needs unavailable');
    teamNeeds = await response.json();
    renderPicks();
  } catch (_error) {
    teamNeeds = {};
  }
}

searchInput.addEventListener('input', () => {
  searchQuery = searchInput.value;
  renderProspects();
});

document.querySelectorAll('.mock-position-btn').forEach(button => {
  button.addEventListener('click', () => {
    activePosition = button.dataset.position;
    document.querySelectorAll('.mock-position-btn').forEach(tab => {
      const isActive = tab === button;
      tab.classList.toggle('active', isActive);
      tab.setAttribute('aria-pressed', String(isActive));
    });
    renderProspects();
  });
});

fileInput.addEventListener('change', async () => {
  const file = fileInput.files && fileInput.files[0];
  if (!file) return;
  try {
    const loadedProspects = normalizeProspectRows(JSON.parse(await file.text()));
    if (!loadedProspects.length) throw new Error('No usable prospects were found in that JSON file.');
    prospects = loadedProspects;
    try {
      localStorage.setItem(PROSPECTS_STORAGE_KEY, JSON.stringify(prospects));
    } catch (_error) {
      prospectPoolStatus.textContent = 'Imported, but browser storage is full; keep the prospect file handy';
    }
    const validIds = new Set(prospects.map(prospect => prospect.id));
    picks.forEach(pick => {
      if (pick.playerId && !validIds.has(pick.playerId)) pick.playerId = '';
    });
    prospectPoolStatus.textContent = `Imported ${prospects.length} prospects`;
    saveMock();
    render();
  } catch (error) {
    prospectPoolStatus.textContent = error.message || 'Could not read that prospect file';
    prospectPoolStatus.classList.add('is-error');
  } finally {
    fileInput.value = '';
  }
});

document.getElementById('clearMockBtn').addEventListener('click', () => {
  if (!picks.some(pick => pick.playerId || pick.team || pick.tradeTo)) return;
  if (!window.confirm('Clear all players, teams, and trade predictions from this mock?')) return;
  picks = Array.from({ length: 32 }, (_, index) => ({ playerId: '', team: defaultTeamOrder[index] || '', tradeTo: '' }));
  saveMock();
  render();
});

function exportMockDraft() {
  return {
    format: 'hush-mock-draft-v1',
    createdAt: new Date().toISOString(),
    picks: picks.map((pick, index) => {
      const prospect = getProspectById(pick.playerId);
      return {
        pick: index + 1,
        team: pick.team || null,
        tradeTo: pick.tradeTo || null,
        trade: pick.trade === true || Boolean(pick.tradeTo),
        prospect: prospect ? {
          id: prospect.id,
          name: prospect.name,
          position: prospect.position,
          school: prospect.school
        } : null
      };
    })
  };
}

function encodeShareMock(value) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let binary = '';
  bytes.forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

document.getElementById('reviewMockBtn').addEventListener('click', event => {
  event.preventDefault();
  const token = encodeShareMock(exportMockDraft());
  location.href = `mock-draft-summary.html?mock=${token}`;
});

document.getElementById('downloadMockBtn').addEventListener('click', () => {
  const exportData = exportMockDraft();
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'hush-mock-draft.json';
  link.click();
  URL.revokeObjectURL(url);
});

restoreMock();
render();
if (ADMIN_BUILDER_MODE) document.body.classList.add('mock-admin-embedded');
let builderLocked = false;
let loadingEntry = false;
let adminDefaultContext = null;
window.addEventListener('message', event => {
  if (!ADMIN_BUILDER_MODE || event.origin !== location.origin || event.source !== window.parent) return;
  const message = event.data;
  if (!message || typeof message !== 'object') return;
  if (message.type === 'hush-mock-export') {
    window.parent.postMessage({ type: 'hush-mock-exported', requestId: message.requestId, mock: exportMockDraft() }, location.origin);
  }
  if (message.type === 'hush-mock-load' && Array.isArray(message.picks)) {
    loadingEntry = true;
    if (Object.prototype.hasOwnProperty.call(message, 'catalog') && adminDefaultContext) {
      if (Array.isArray(message.catalog)) {
        prospects = message.catalog.map(row => ({ ...normalizeProspectRows([row])[0], id: row.id }));
        positionProspects = Object.fromEntries(Object.keys(POSITION_PROSPECT_FILES).map(position => [position,
          prospects.filter(player => player.position === position)]));
        overallOrder = prospects.map(player => player.id);
        defaultTeamOrder = message.teamOrder.slice();
        teamNeeds = {};
        prospectPoolStatus.textContent = `${message.year} - ${prospects.length} first-round players`;
      } else {
        ({ prospects, positionProspects, overallOrder, defaultTeamOrder, teamNeeds } = adminDefaultContext);
        prospectPoolStatus.textContent = `Loaded ${prospects.length} college prospects`;
      }
    }
    picks = Array.from({ length: 32 }, (_, index) => {
      const pick = message.picks.find(item => item.pick === index + 1) || {};
      return { playerId: String(pick.playerId || pick.prospect?.id || ''), team: pick.team || defaultTeamOrder[index] || '',
        tradeTo: pick.tradeTo || '', trade: pick.trade === true || Boolean(pick.tradeTo) };
    });
    builderLocked = Boolean(message.locked);
    document.body.classList.toggle('mock-builder-locked', builderLocked);
    render();
    loadingEntry = false;
  }
});
if (ADMIN_BUILDER_MODE) {
  document.addEventListener('click', event => {
    if (builderLocked && !event.target.closest('.mock-profile-button, #prospectProfileDialog, .mock-position-btn')) {
      event.preventDefault(); event.stopImmediatePropagation();
    }
  }, true);
  document.addEventListener('change', event => {
    if (builderLocked) { event.stopImmediatePropagation(); render(); }
  }, true);
  document.addEventListener('drop', event => {
    if (builderLocked) { event.preventDefault(); event.stopImmediatePropagation(); }
  }, true);
}
Promise.all([loadDefaultProspects(), loadDefaultTeamOrder(), loadTeamNeeds()]).then(() => {
  if (ADMIN_BUILDER_MODE) adminDefaultContext = { prospects, positionProspects, overallOrder, defaultTeamOrder, teamNeeds };
  if (ADMIN_BUILDER_MODE && !loadingEntry) window.parent.postMessage({ type: 'hush-mock-builder-ready' }, location.origin);
});