/* ─────────────────────────────────────────────────
   rankings.js  –  My Rankings page logic
   ───────────────────────────────────────────────── */

'use strict';

// ═══════════════════════════════════════════════════
//  Constants
// ═══════════════════════════════════════════════════

const LS_KEY           = 'userRankings';
const DRAFT_STATE_KEY  = 'rankingsDraftState';
const ALL_POSITIONS_KEY = 'ALL';
const POSITIONS        = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];
const RANKING_BOARD_KEYS = [ALL_POSITIONS_KEY, ...POSITIONS];
const DEFAULT_RANKINGS_URLS = ['top250.generated.json', 'top250.json'];
const BOARD_MODE_KEY = 'rankingsBoardMode';
const RANKINGS_THEME_KEY = 'rankingsTheme';
const TIER_INSERT_MODE_KEY = 'rankingsTierInsertMode';
const DRAFT_VIEW_PARAM = 'draftView';
const DEFAULT_STARRED_KEY = 'defaultRankingsStarred';
const STARRED_PLAYERS_KEY = 'rankingsStarredPlayers';
const DRAFT_TEMP_STARRED_KEY = 'rankingsDraftStarredPlayers';

// ═══════════════════════════════════════════════════
//  State
// ═══════════════════════════════════════════════════

let playerPools = {};      // { QB: [...], RB: [...], ... }
let rankings    = [];      // [ { id, name, players: [...] } ]
let rankingsByPos = createEmptyRankingsByPosition();
let draftState  = null;    // latest from localStorage
let defaultRankings = [];  // flat default rankings list

let activePoolTab    = 'QB';
let activeFilterPos  = 'ALL';
let poolSearchQuery  = '';
let isDirty          = false;
let activeBoardType  = 'personal';
let rankingsTheme    = 'dark';
let easyTierInsertMode = false;
let showDraftContext = true;
let isPrintPreview = false;

// Drag state
let dragSource = null;  // { type: 'pool'|'ranking', player, tierIdx, playerIdx }

function getAllFilterButton() {
  return document.querySelector('.pos-filter-btn[data-pos="ALL"]');
}

function getAllPlayersCount() {
  if (Array.isArray(defaultRankings) && defaultRankings.length) {
    return defaultRankings.length;
  }

  return POSITIONS.reduce((total, pos) => total + ((playerPools[pos] || []).length), 0);
}

function updateAllFilterButtonLabel() {
  const allBtn = getAllFilterButton();
  if (!allBtn) return;

  allBtn.textContent = 'TOP';
}

function createEmptyRankingsByPosition() {
  return RANKING_BOARD_KEYS.reduce((boards, pos) => {
    boards[pos] = [];
    return boards;
  }, {});
}

function cloneTierCollection(tiers) {
  return normalizeLoadedRankings(Array.isArray(tiers) ? tiers : []);
}

function normalizeBoardsByPosition(rawBoards) {
  const boards = createEmptyRankingsByPosition();

  RANKING_BOARD_KEYS.forEach(pos => {
    boards[pos] = cloneTierCollection(rawBoards && rawBoards[pos]);
  });

  if (!rawBoards || !Object.prototype.hasOwnProperty.call(rawBoards, ALL_POSITIONS_KEY)) {
    boards[ALL_POSITIONS_KEY] = buildCombinedRankings(boards);
  }

  return boards;
}

function splitLegacyRankingsByPosition(tiers) {
  const boards = createEmptyRankingsByPosition();
  const normalizedTiers = normalizeLoadedRankings(Array.isArray(tiers) ? tiers : []);

  boards[ALL_POSITIONS_KEY] = cloneTierCollection(normalizedTiers);

  normalizedTiers.forEach((tier, tierIdx) => {
    POSITIONS.forEach(pos => {
      const players = tier.players.filter(player => player.position === pos);
      if (!players.length) return;

      boards[pos].push({
        id: `${tier.id || `tier_${tierIdx + 1}`}_${pos}`,
        name: tier.name || `${pos} Tier ${boards[pos].length + 1}`,
        players,
      });
    });
  });

  return boards;
}

function getRankingsBoardForPosition(pos) {
  if (!RANKING_BOARD_KEYS.includes(pos)) return [];
  if (!Array.isArray(rankingsByPos[pos])) rankingsByPos[pos] = [];
  return rankingsByPos[pos];
}

function buildCombinedRankings(sourceBoards = rankingsByPos) {
  const combined = [];

  POSITIONS.forEach(pos => {
    const board = sourceBoards && Array.isArray(sourceBoards[pos]) ? sourceBoards[pos] : [];
    board.forEach((tier, idx) => {
      combined.push({
        id: `${tier.id || `tier_${idx + 1}`}_${pos}_${idx}`,
        name: tier.name || `${pos} Tier ${idx + 1}`,
        players: tier.players.map(player => ({ ...player })),
      });
    });
  });

  return combined;
}

function syncActiveRankings() {
  rankings = getRankingsBoardForPosition(activeFilterPos);
}

function isEditableRankingsView() {
  return activeBoardType === 'personal' && RANKING_BOARD_KEYS.includes(activeFilterPos);
}

// ═══════════════════════════════════════════════════
//  DOM References (set in init)
// ═══════════════════════════════════════════════════

let elRankingsList, elPoolList, elPoolMeta,
    elSaveBtn, elTotalCount,
  elPoolSearch, elDraftBadge, elDraftLegend, elThemeToggleBtn, elTierInsertModeBtn, elClearFilteredBtn,
  elPrintPreviewBtn, elPrintRankingsBtn, elPrintMetaBar, elPrintLayoutSheet;

function updatePersonalRankingsLabel() {
  const personalTab = document.querySelector('.board-tab-btn[data-board="personal"]');
  if (!personalTab) return;

  try {
    const username = String(sessionStorage.getItem('username') || '').trim();
    personalTab.textContent = username ? `${username} Rankings` : 'Personal Rankings';
  } catch (e) {
    personalTab.textContent = 'Personal Rankings';
  }
}

function loadDefaultStarredNames() {
  try {
    const raw = localStorage.getItem(DEFAULT_STARRED_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter(name => typeof name === 'string' && name) : []);
  } catch (e) {
    return new Set();
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

function isDraftSessionActive() {
  return !!(draftState && draftState.draftCode);
}

function getEffectiveStarredNames() {
  const starred = loadSharedStarredNames();
  if (isDraftSessionActive()) {
    const draftStarred = loadDraftTempStarredNames();
    draftStarred.forEach(name => starred.add(name));
  }
  return starred;
}

function normalizePersistentStarStorage() {
  const sharedStarred = loadSharedStarredNames();
  let changed = false;

  // Migrate old default-only starred storage into shared storage.
  const legacyDefaultStarred = loadDefaultStarredNames();
  legacyDefaultStarred.forEach(name => {
    if (!sharedStarred.has(name)) {
      sharedStarred.add(name);
      changed = true;
    }
  });
  if (changed) {
    saveSharedStarredNames(sharedStarred);
  }

  // Keep legacy key in sync for backward compatibility with draft code paths.
  saveDefaultStarredNames(sharedStarred);
}

function syncInMemoryStars(starredNames) {
  const isStarred = name => starredNames.has(name);

  defaultRankings.forEach(player => {
    player.starred = isStarred(player.name);
  });

  Object.values(rankingsByPos).forEach(board => {
    (Array.isArray(board) ? board : []).forEach(tier => {
      (Array.isArray(tier.players) ? tier.players : []).forEach(player => {
        player.starred = isStarred(player.name);
      });
    });
  });
}

function persistCurrentStars(starredNames) {
  syncInMemoryStars(starredNames);
  saveSharedStarredNames(starredNames);
  saveDefaultStarredNames(starredNames);
  if (!isDraftSessionActive()) {
    saveRankings();
  }
}

function saveDefaultStarredNames(starredNames) {
  try {
    localStorage.setItem(DEFAULT_STARRED_KEY, JSON.stringify([...starredNames].sort()));
  } catch (e) {
    // ignore
  }
}

function getPrintableOwnerName() {
  try {
    const username = String(sessionStorage.getItem('username') || '').trim();
    return username || 'Personal';
  } catch (e) {
    return 'Personal';
  }
}

function buildPrintMetaText() {
  const now = new Date();
  const ts = now.toLocaleString();
  const filterLabel = activeFilterPos === 'ALL' ? 'TOP' : activeFilterPos;
  const boardLabel = activeBoardType === 'default' ? 'Default Rankings' : `${getPrintableOwnerName()} Rankings`;
  return `${boardLabel} | View: ${filterLabel} | Generated: ${ts}`;
}

function updatePrintMetaBar() {
  if (!elPrintMetaBar) return;
  elPrintMetaBar.textContent = isPrintPreview ? buildPrintMetaText() : '';
}

function getPlayersFromBoard(board) {
  const flat = [];
  (Array.isArray(board) ? board : []).forEach(tier => {
    (Array.isArray(tier.players) ? tier.players : []).forEach(player => {
      if (player && player.name) flat.push(player);
    });
  });
  return flat;
}

function getPrintablePlayersByPosition(pos) {
  if (activeBoardType === 'default') {
    let lastTierKey = null;
    let seenAny = false;
    return defaultRankings
      .filter(player => player && player.name && player.position === pos)
      .map(player => {
        const tierKey = player.tierKey || null;
        const hasBreak = seenAny && tierKey !== null && tierKey !== lastTierKey;
        seenAny = true;
        lastTierKey = tierKey;
        return { ...player, _printTierBreakBefore: hasBreak };
      });
  }

  const fromPosBoardEntries = [];
  const posBoard = getRankingsBoardForPosition(pos);
  let seenAnyTierPlayers = false;

  (Array.isArray(posBoard) ? posBoard : []).forEach(tier => {
    const tierPlayers = (Array.isArray(tier && tier.players) ? tier.players : [])
      .filter(player => player && player.name && player.position === pos);

    tierPlayers.forEach((player, idx) => {
      fromPosBoardEntries.push({
        ...player,
        _printTierBreakBefore: seenAnyTierPlayers && idx === 0,
      });
    });

    if (tierPlayers.length) seenAnyTierPlayers = true;
  });

  const source = fromPosBoardEntries.length
    ? fromPosBoardEntries
    : getRankingsBoardForPosition(ALL_POSITIONS_KEY).flatMap((tier, tierIdx) => {
        const tierPlayers = (Array.isArray(tier && tier.players) ? tier.players : [])
          .filter(player => player && player.name && player.position === pos);
        return tierPlayers.map((player, idx) => ({
          ...player,
          _printTierBreakBefore: tierIdx > 0 && idx === 0,
        }));
      });

  const seen = new Set();
  const unique = [];
  source.forEach(player => {
    if (!seen.has(player.name)) {
      seen.add(player.name);
      unique.push(player);
    }
  });
  return unique;
}

function buildPrintSectionMarkup(label, players, startRank = 1) {
  const rows = players.length
    ? players.map((player, idx) => {
        const av = Number.isFinite(Number(player.avgValue)) ? Number(player.avgValue) : 0;
        const tierBreakRow = player._printTierBreakBefore
          ? `<tr class="print-tier-break-row"><td class="print-tier-break-cell" colspan="3"></td></tr>`
          : '';
        return `
          ${tierBreakRow}
          <tr>
            <td class="print-col-rank">${startRank + idx}.</td>
            <td class="print-col-name">${escapeHtml(player.name)}</td>
            <td class="print-col-av">$${av}</td>
          </tr>`;
      }).join('')
    : '<tr><td class="print-col-empty" colspan="3">No ranked players</td></tr>';

  return `
    <section class="print-pos-section">
      <div class="print-pos-header">
        <span class="print-pos-title">${escapeHtml(label)}</span>
        <span class="print-pos-av">AV</span>
      </div>
      <table class="print-pos-table" role="presentation">
        <tbody>${rows}</tbody>
      </table>
    </section>`;
}

function renderPrintLayoutSheet() {
  if (!elPrintLayoutSheet) return;

  let qbPlayers = getPrintablePlayersByPosition('QB');
  let dstPlayers = getPrintablePlayersByPosition('DEF');
  let rbPlayers = getPrintablePlayersByPosition('RB');
  let wrPlayers = getPrintablePlayersByPosition('WR');
  let tePlayers = getPrintablePlayersByPosition('TE');
  let kPlayers = getPrintablePlayersByPosition('K');

  // Hard cap large position groups for one-page printable output.
  qbPlayers = qbPlayers.slice(0, 20);
  dstPlayers = dstPlayers.slice(0, 12);
  tePlayers = tePlayers.slice(0, 20);
  kPlayers = kPlayers.slice(0, 12);
  rbPlayers = rbPlayers.slice(0, 55);
  wrPlayers = wrPlayers.slice(0, 60);

  const rosterSlots = ['QB', 'WR', 'WR', 'RB', 'RB', 'TE', 'Flex', 'K', 'DEF', 'BN', 'BN', 'BN', 'BN', 'BN'];

  // Dynamically split RB/WR to keep one-page print fit, including tier-break divider rows.
  const columnRowBudget = 70;
  const sectionHeaderRows = 2;
  const rosterHeaderRows = 2;
  const rosterRowWeight = 2;
  const minimumRbPrimary = 8;

  const countTierBreakRows = (players) => players.reduce((count, player) => {
    return count + (player && player._printTierBreakBefore ? 1 : 0);
  }, 0);

  const estimateSectionRows = (players) => {
    const bodyRows = players.length ? players.length + countTierBreakRows(players) : 1;
    return sectionHeaderRows + bodyRows;
  };

  const estimateRosterRows = () => rosterHeaderRows + (rosterSlots.length * rosterRowWeight);

  const computeSplitState = () => {
    const leftNonRbRows = estimateSectionRows(qbPlayers) + estimateSectionRows(dstPlayers);
    let rbPrimaryLimit = rbPlayers.length;

    while (
      rbPrimaryLimit > minimumRbPrimary &&
      (leftNonRbRows + estimateSectionRows(rbPlayers.slice(0, rbPrimaryLimit))) > columnRowBudget
    ) {
      rbPrimaryLimit -= 1;
    }

    rbPrimaryLimit = Math.max(minimumRbPrimary, Math.min(rbPlayers.length, rbPrimaryLimit));
    const rbPrimary = rbPlayers.slice(0, rbPrimaryLimit);
    const rbOverflow = rbPlayers.slice(rbPrimaryLimit);

    const centerFixedHeaderRows = sectionHeaderRows + (rbOverflow.length ? sectionHeaderRows : 0);
    const centerAvailRows = Math.max(12, columnRowBudget - centerFixedHeaderRows);
    const rbOverflowCenter = rbOverflow;
    const rbOverflowRows = rbOverflowCenter.length + countTierBreakRows(rbOverflowCenter);

    const minimumWrPrimary = 8;
    let wrPrimaryLimit = wrPlayers.length;

    while (
      wrPrimaryLimit > minimumWrPrimary &&
      (rbOverflowRows + estimateSectionRows(wrPlayers.slice(0, wrPrimaryLimit))) > centerAvailRows
    ) {
      wrPrimaryLimit -= 1;
    }

    wrPrimaryLimit = Math.max(minimumWrPrimary, Math.min(wrPlayers.length, wrPrimaryLimit));
    const wrPrimary = wrPlayers.slice(0, wrPrimaryLimit);
    const wrOverflow = wrPlayers.slice(wrPrimaryLimit);

    const leftRows = estimateSectionRows(qbPlayers) + estimateSectionRows(dstPlayers) + estimateSectionRows(rbPrimary);
    const centerRows = (rbOverflowCenter.length ? estimateSectionRows(rbOverflowCenter) : 0) + estimateSectionRows(wrPrimary);
    const rightRows =
      (wrOverflow.length ? estimateSectionRows(wrOverflow) : 0) +
      estimateSectionRows(tePlayers) +
      estimateSectionRows(kPlayers) +
      estimateRosterRows();

    return {
      rbPrimary,
      rbOverflowCenter,
      wrPrimary,
      wrOverflow,
      maxRows: Math.max(leftRows, centerRows, rightRows),
    };
  };

  let splitState = computeSplitState();

  if (splitState.maxRows > columnRowBudget) {
    const trimOrder = [
      () => qbPlayers,
      () => kPlayers,
      () => dstPlayers,
      () => tePlayers,
      () => rbPlayers,
      () => wrPlayers,
    ];

    let safety = 0;
    while (splitState.maxRows > columnRowBudget && safety < 300) {
      safety += 1;
      let removedAny = false;

      for (const getList of trimOrder) {
        const list = getList();
        if (list.length) {
          list.pop();
          removedAny = true;
        }

        splitState = computeSplitState();
        if (splitState.maxRows <= columnRowBudget) break;
      }

      if (!removedAny) break;
    }
  }

  const { rbPrimary, rbOverflowCenter, wrPrimary, wrOverflow } = splitState;

  const rosterMarkup = rosterSlots.map(slot => `
    <div class="print-roster-row">
      <span class="print-roster-slot">${slot}</span>
      <span class="print-roster-line"></span>
    </div>`).join('');

  const leftColumnSections = [
    buildPrintSectionMarkup('QB', qbPlayers),
    buildPrintSectionMarkup('DST', dstPlayers),
    buildPrintSectionMarkup('RB', rbPrimary, 1),
  ].join('');

  const middleColumnSections = [
    rbOverflowCenter.length ? buildPrintSectionMarkup('RB (Cont.)', rbOverflowCenter, rbPrimary.length + 1) : '',
    buildPrintSectionMarkup('WR', wrPrimary, 1),
  ].join('');

  const rightColumnSections = [
    wrOverflow.length ? buildPrintSectionMarkup('WR (Cont.)', wrOverflow, wrPrimary.length + 1) : '',
    buildPrintSectionMarkup('TE', tePlayers),
    buildPrintSectionMarkup('K', kPlayers),
  ].join('');

  elPrintLayoutSheet.innerHTML = `
    <div class="print-sheet-header" aria-hidden="true">
      <img src="printablehushrank.PNG" alt="" class="print-sheet-header-image">
    </div>
    <div class="print-layout-columns">
      <div class="print-layout-column print-layout-column-left">
        ${leftColumnSections}
      </div>
      <div class="print-layout-column print-layout-column-middle">
        ${middleColumnSections}
      </div>
      <div class="print-layout-column print-layout-column-right">
        ${rightColumnSections}
        <aside class="print-roster-card">
          <h3 class="print-roster-title">${escapeHtml(getPrintableOwnerName())}'s Roster</h3>
          <div class="print-roster-list">
            ${rosterMarkup}
          </div>
        </aside>
      </div>
    </div>`;
}

function computePrintScale() {
  if (!elRankingsList) return 1;

  const rowCount = elRankingsList.querySelectorAll('.ranking-player-row').length;
  const tierCount = elRankingsList.querySelectorAll('.tier-block').length;
  const printRows = elPrintLayoutSheet ? elPrintLayoutSheet.querySelectorAll('.print-pos-table tr').length : 0;
  const estimatedLoad = Math.max(rowCount + (tierCount * 1.5), printRows * 0.9);

  if (estimatedLoad <= 58) return 1;
  if (estimatedLoad <= 70) return 0.97;
  if (estimatedLoad <= 82) return 0.94;
  if (estimatedLoad <= 96) return 0.9;
  if (estimatedLoad <= 112) return 0.86;
  return 0.82;
}

function updatePrintScale() {
  const scale = computePrintScale();
  document.body.style.setProperty('--rankings-print-scale', String(scale));
}

function applyPrintPreviewMode() {
  document.body.classList.toggle('rankings-print-preview', isPrintPreview);
  if (elPrintPreviewBtn) {
    elPrintPreviewBtn.textContent = isPrintPreview ? 'Exit Preview' : 'Print Preview';
    elPrintPreviewBtn.classList.toggle('active', isPrintPreview);
    elPrintPreviewBtn.setAttribute('aria-pressed', isPrintPreview ? 'true' : 'false');
  }
  updatePrintScale();
  updatePrintMetaBar();
}

function togglePrintPreview() {
  isPrintPreview = !isPrintPreview;
  applyPrintPreviewMode();
  renderRankings();
}

function printPersonalRankings() {
  // Keep metadata fresh right before invoking the print dialog.
  if (elPrintMetaBar) {
    elPrintMetaBar.textContent = buildPrintMetaText();
  }

  updatePrintScale();

  window.print();
}

// ═══════════════════════════════════════════════════
//  Init
// ═══════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  elRankingsList = document.getElementById('rankingsList');
  elPoolList     = document.getElementById('poolList');
  elPoolMeta     = document.getElementById('poolMeta');
  elSaveBtn      = document.getElementById('saveRankingsBtn');
  elTotalCount   = document.getElementById('totalCount');
  elPoolSearch   = document.getElementById('poolSearch');
  elDraftBadge   = document.getElementById('draftStatusBadge');
  elDraftLegend  = document.getElementById('draftLegend');
  elThemeToggleBtn = document.getElementById('themeToggleBtn');
  elTierInsertModeBtn = document.getElementById('tierInsertModeBtn');
  elClearFilteredBtn = document.getElementById('clearFilteredRankingsBtn');
  elPrintPreviewBtn = document.getElementById('printPreviewBtn');
  elPrintRankingsBtn = document.getElementById('printRankingsBtn');
  elPrintMetaBar = document.getElementById('printMetaBar');
  elPrintLayoutSheet = document.getElementById('printLayoutSheet');
  showDraftContext = shouldShowDraftContext();
  updatePersonalRankingsLabel();

  loadRankingsThemePreference();
  applyRankingsTheme();
  loadTierInsertModePreference();
  applyTierInsertMode();
  loadRankingsFromStorage();
  normalizePersistentStarStorage();
  loadPlayerPools();
  loadDefaultRankings();
  setupEventListeners();
  setupDraftStatePolling();
  loadBoardModePreference();
  updateBoardModeUI();
  updateClearFilteredButton();
  applyPrintPreviewMode();
});

function loadBoardModePreference() {
  try {
    const saved = localStorage.getItem(BOARD_MODE_KEY);
    if (saved === 'default' || saved === 'personal') {
      activeBoardType = saved;
    }
  } catch (e) {
    activeBoardType = 'personal';
  }
}

function saveBoardModePreference() {
  try {
    localStorage.setItem(BOARD_MODE_KEY, activeBoardType);
  } catch (e) {
    // ignore
  }
}

function loadRankingsThemePreference() {
  try {
    const saved = localStorage.getItem(RANKINGS_THEME_KEY);
    rankingsTheme = saved === 'light' ? 'light' : 'dark';
  } catch (e) {
    rankingsTheme = 'dark';
  }
}

function saveRankingsThemePreference() {
  try {
    localStorage.setItem(RANKINGS_THEME_KEY, rankingsTheme);
  } catch (e) {
    // ignore
  }
}

function loadTierInsertModePreference() {
  try {
    easyTierInsertMode = localStorage.getItem(TIER_INSERT_MODE_KEY) === 'easy';
  } catch (e) {
    easyTierInsertMode = false;
  }
}

function saveTierInsertModePreference() {
  try {
    localStorage.setItem(TIER_INSERT_MODE_KEY, easyTierInsertMode ? 'easy' : 'classic');
  } catch (e) {
    // ignore
  }
}

function applyTierInsertMode() {
  document.body.classList.toggle('rankings-tier-insert-mode', easyTierInsertMode);
  if (!elTierInsertModeBtn) return;
  elTierInsertModeBtn.textContent = `Easy Tier Breaks: ${easyTierInsertMode ? 'On' : 'Off'}`;
  elTierInsertModeBtn.classList.toggle('active', easyTierInsertMode);
  elTierInsertModeBtn.setAttribute('aria-pressed', easyTierInsertMode ? 'true' : 'false');
  elTierInsertModeBtn.title = easyTierInsertMode
    ? 'Always show the between-player tier break buttons.'
    : 'Use the original hover-only tier break buttons.';
}

function toggleTierInsertMode() {
  easyTierInsertMode = !easyTierInsertMode;
  saveTierInsertModePreference();
  applyTierInsertMode();
}

function shouldShowDraftContext() {
  try {
    const params = new URLSearchParams(window.location.search || '');
    return params.get(DRAFT_VIEW_PARAM) !== 'off';
  } catch (e) {
    return true;
  }
}

function getVisibleDraftState() {
  return showDraftContext ? draftState : null;
}

function updateClearFilteredButton() {
  if (!elClearFilteredBtn) return;

  const personal = activeBoardType === 'personal';
  const currentBoard = getRankingsBoardForPosition(activeFilterPos);
  const filteredPlayers = currentBoard.reduce((count, tier) => count + tier.players.length, 0);
  const canClearFiltered = personal && filteredPlayers > 0;
  elClearFilteredBtn.textContent = activeFilterPos === 'ALL' ? 'Clear Top' : `Clear ${activeFilterPos}`;
  elClearFilteredBtn.disabled = !canClearFiltered;
  elClearFilteredBtn.title = canClearFiltered
    ? (activeFilterPos === 'ALL'
      ? 'Clear all players from your TOP rankings.'
      : `Clear all ${activeFilterPos} players from your rankings.`)
    : (activeFilterPos === 'ALL'
      ? 'No ranked players in your TOP board to clear.'
      : `No ranked ${activeFilterPos} players to clear.`);
}

function clearFilteredRankings() {
  if (activeBoardType !== 'personal') return;
  const board = getRankingsBoardForPosition(activeFilterPos);
  if (!board.length) return;

  const total = board.reduce((count, tier) => count + tier.players.length, 0);

  if (!total) return;
  const confirmMessage = activeFilterPos === 'ALL'
    ? `Clear all ${total} player${total !== 1 ? 's' : ''} from your TOP rankings?`
    : `Clear all ${total} ${activeFilterPos} player${total !== 1 ? 's' : ''} from your rankings?`;
  if (!confirm(confirmMessage)) return;

  rankingsByPos[activeFilterPos] = [];
  syncActiveRankings();

  markDirty();
  saveRankings();
  renderRankings();
  renderPool(activePoolTab);
}

function applyRankingsTheme() {
  document.body.classList.toggle('rankings-light-mode', rankingsTheme === 'light');
  if (!elThemeToggleBtn) return;
  elThemeToggleBtn.textContent = `Theme: ${rankingsTheme === 'light' ? 'Light' : 'Dark'}`;
  elThemeToggleBtn.setAttribute('aria-pressed', rankingsTheme === 'light' ? 'true' : 'false');
  elThemeToggleBtn.disabled = false;
  elThemeToggleBtn.title = 'Toggle Rankings theme';
}

function toggleRankingsTheme() {
  rankingsTheme = rankingsTheme === 'light' ? 'dark' : 'light';
  saveRankingsThemePreference();
  applyRankingsTheme();
}

async function loadDefaultRankings() {
  const starredNames = getEffectiveStarredNames();

  for (const url of DEFAULT_RANKINGS_URLS) {
    try {
      const response = await fetch(url);
      if (!response.ok) continue;
      const data = await response.json();
      if (!Array.isArray(data)) continue;

      defaultRankings = data
        .map((p, idx) => ({
          name: p.name || '—',
          position: p.position || 'UNK',
          team: p.team || '—',
          avgValue: p.avgValue || 0,
          starred: starredNames.has(p.name || ''),
          prerank: Number.isFinite(p.prerank) ? p.prerank : (idx + 1),
          tierKey: p.tierId ?? p.tierName ?? p.tier ?? null,
        }))
        .sort((a, b) => a.prerank - b.prerank);

      updateAllFilterButtonLabel();
      renderRankings();
      return;
    } catch (e) {
      // try fallback source
    }
  }
}

// ═══════════════════════════════════════════════════
//  Player Pool Loading
// ═══════════════════════════════════════════════════

async function loadPlayerPools() {
  const fileMap = {
    QB:  'qb.json',
    RB:  'rb.json',
    WR:  'wr.json',
    TE:  'te.json',
    K:   'k.json',
    DEF: 'def.json',
  };

  try {
    const fetches = POSITIONS.map(pos =>
      fetch(`players%20file/${fileMap[pos]}`)
        .then(r => r.ok ? r.json() : [])
        .then(data => ({ pos, data: Array.isArray(data) ? data : [] }))
        .catch(() => ({ pos, data: [] }))
    );

    const results = await Promise.all(fetches);
    results.forEach(({ pos, data }) => {
      playerPools[pos] = data.map((p, idx) => normalizePlayer(p, pos, idx));
    });

    updateAllFilterButtonLabel();
    renderPool(activePoolTab);
  } catch (e) {
    elPoolList.innerHTML = '<div class="pool-empty">Failed to load players.</div>';
  }
}

function normalizePlayer(p, pos, idx) {
  // Different rank keys per position
  const rankRaw =
    p.qbRank  !== undefined ? p.qbRank  :
    p.RBrank  !== undefined ? p.RBrank  :
    p.WRrank  !== undefined ? p.WRrank  :
    p.TErank  !== undefined ? p.TErank  :
    p.Krank   !== undefined ? p.Krank   :
    p.DEFrank !== undefined ? p.DEFrank :
    (idx + 1);

  const rank = typeof rankRaw === 'string'
    ? parseInt(rankRaw.replace('#', ''), 10) || (idx + 1)
    : (rankRaw || idx + 1);

  return {
    name:        p.name        || '—',
    position:    p.position    || pos,
    team:        p.team        || '—',
    avgValue:    p.avgValue    || 0,
    draftChance: p.draftChance || 0,
    starred:     getEffectiveStarredNames().has(p.name || ''),
    userBid:     '',
    posRank:     rank,
  };
}

// ═══════════════════════════════════════════════════
//  Render Pool (right panel)
// ═══════════════════════════════════════════════════

function renderPool(pos) {
  activePoolTab = pos;
  const players = playerPools[pos] || [];
  const query   = poolSearchQuery.trim().toLowerCase();

  // Update tab active states
  document.querySelectorAll('.pos-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.pos === pos);
  });

  // Build set of already-added names for quick lookup
  const addedNames = getAddedPlayerNames(activeFilterPos === ALL_POSITIONS_KEY ? ALL_POSITIONS_KEY : pos);

  // Filter by search
  const filtered = query
    ? players.filter(p => p.name.toLowerCase().includes(query) || p.team.toLowerCase().includes(query))
    : players;

  elPoolMeta.textContent = `${filtered.length} players`;

  if (!filtered.length) {
    elPoolList.innerHTML = '<div class="pool-empty">No players found.</div>';
    return;
  }

  const frag = document.createDocumentFragment();

  filtered.forEach(player => {
    const alreadyAdded = addedNames.has(player.name);
    const status       = getPlayerStatus(player.name);

    const row = document.createElement('div');
    row.className = 'pool-player-row';
    if (alreadyAdded) row.classList.add('already-added');
    if (status !== 'available') row.classList.add(`status-${status}`);

    row.draggable = !alreadyAdded && isEditableRankingsView() && (activeFilterPos === ALL_POSITIONS_KEY || activeFilterPos === pos);
    row.dataset.playerName = player.name;
    row.dataset.pos        = pos;

    row.innerHTML = `
      <span class="pool-player-rank">${player.posRank}</span>
      <span class="pos-badge pos-${player.position}">${player.position}</span>
      <span class="pool-player-name">${escapeHtml(player.name)}</span>
      <span class="pool-player-team">${escapeHtml(player.team)}</span>
      <span class="pool-player-val">\$${player.avgValue}</span>
      ${alreadyAdded
        ? '<span class="pool-added-mark">✓</span>'
        : '<button class="pool-add-btn" aria-label="Add">+</button>'
      }
    `;

    if (!alreadyAdded) {
      // Click or + button to add
      row.addEventListener('click', () => addPlayerToRankings(player));
      const addBtn = row.querySelector('.pool-add-btn');
      if (addBtn) {
        addBtn.addEventListener('click', e => {
          e.stopPropagation();
          addPlayerToRankings(player);
        });
      }
      // Drag start from pool
      row.addEventListener('dragstart', e => handlePoolDragStart(e, player));
      row.addEventListener('dragend',   () => row.classList.remove('dragging'));
    }

    frag.appendChild(row);
  });

  elPoolList.innerHTML = '';
  elPoolList.appendChild(frag);
}

// ═══════════════════════════════════════════════════
//  Rankings Rendering (left panel)
// ═══════════════════════════════════════════════════

function renderRankings() {
  updatePrintMetaBar();
  updatePrintScale();
  renderPrintLayoutSheet();
  syncInMemoryStars(getEffectiveStarredNames());
  syncActiveRankings();

  if (activeBoardType === 'default') {
    renderDefaultRankings();
    return;
  }

  const filterPos = activeFilterPos;

  // Filter down to visible players per position filter
  const getVisible = tier => {
    const players = filterPos === 'ALL'
      ? tier.players
      : tier.players.filter(p => p.position === filterPos);
    return players;
  };

  // Total count
  const total = rankings.reduce((sum, t) => sum + t.players.length, 0);
  elTotalCount.textContent = `${total} player${total !== 1 ? 's' : ''}`;

  // Empty state
  const isEmpty = total === 0;
  const emptyEl = document.getElementById('rankingsEmpty');
  if (isEmpty) {
    if (!emptyEl) {
      elRankingsList.innerHTML = `
        <div class="rankings-empty" id="rankingsEmpty">
          <div class="empty-icon">📋</div>
          <p>Your rankings board is empty</p>
          <p class="empty-hint">Click players on the right to add them, or drag &amp; drop</p>
        </div>`;
    }
    return;
  }
  // Remove empty state element if present
  if (emptyEl) emptyEl.remove();

  // Compute global rank offsets
  let globalRank = 1;

  const frag = document.createDocumentFragment();

  rankings.forEach((tier, tierIdx) => {
    const visiblePlayers = getVisible(tier);

    // Skip fully-hidden tiers when filter is active
    if (filterPos !== 'ALL' && visiblePlayers.length === 0) {
      globalRank += tier.players.length; // still increment global rank
      return;
    }

    const block = buildTierBlock(tier, tierIdx, visiblePlayers, globalRank, filterPos === 'ALL');
    frag.appendChild(block);

    globalRank += tier.players.length;
  });

  // Preserve scroll
  const prevScrollTop = elRankingsList.scrollTop;
  elRankingsList.innerHTML = '';
  elRankingsList.appendChild(frag);
  elRankingsList.scrollTop = prevScrollTop;

  // Rankings list drop target (for dragging into empty area at end)
  elRankingsList.ondragover  = e => { e.preventDefault(); };
  elRankingsList.ondrop      = e => handleListDrop(e);
}

function renderDefaultRankings() {
  const starredNames = getEffectiveStarredNames();
  syncInMemoryStars(starredNames);
  const filterPos = activeFilterPos;
  const filtered = defaultRankings.filter(p => filterPos === 'ALL' || p.position === filterPos);
  elTotalCount.textContent = `${filtered.length} player${filtered.length !== 1 ? 's' : ''}`;

  if (!filtered.length) {
    elRankingsList.innerHTML = `
      <div class="rankings-empty" id="rankingsEmpty">
        <div class="empty-icon">📋</div>
        <p>Default rankings unavailable</p>
        <p class="empty-hint">Try reloading the page.</p>
      </div>`;
    return;
  }

  const block = document.createElement('div');
  block.className = 'tier-block';

  const header = document.createElement('div');
  header.className = 'tier-header';
  header.innerHTML = `
    <div class="tier-header-left">
      <span class="tier-name">Default Rankings</span>
    </div>
    <div class="tier-header-right">
      <span class="total-count">Read only</span>
    </div>`;
  block.appendChild(header);

  filtered.forEach((player, index) => {
    const status = getPlayerStatus(player.name);
    const row = document.createElement('div');
    row.className = 'ranking-player-row';
    if (status !== 'available') row.classList.add(`status-${status}`);

    const visibleDraftState = getVisibleDraftState();
    const ownerLabel = visibleDraftState && visibleDraftState.draftedPlayers && visibleDraftState.draftedPlayers[player.name]
      ? `<span class="status-owner">→ ${escapeHtml(visibleDraftState.draftedPlayers[player.name])}</span>`
      : '';

    row.innerHTML = `
      <button class="rank-star-btn${starredNames.has(player.name) ? ' active' : ''}" type="button" aria-label="${starredNames.has(player.name) ? 'Unstar' : 'Star'} ${escapeHtml(player.name)}" aria-pressed="${starredNames.has(player.name) ? 'true' : 'false'}" title="${starredNames.has(player.name) ? 'Starred player' : 'Mark as starred'}">
        <svg class="rank-star-icon" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
          <polygon points="50,4 61,36 96,40 70,62 78,96 50,78 22,96 30,62 4,40 39,36"></polygon>
        </svg>
      </button>
      <span class="drag-handle">•</span>
      <span class="rank-num">${index + 1}</span>
      <span class="pos-badge pos-${player.position}">${player.position}</span>
      <span class="rank-player-name">${escapeHtml(player.name)}${ownerLabel}</span>
      <span class="rank-player-team">${escapeHtml(player.team)}</span>
      <span class="rank-player-val">\$${player.avgValue}</span>
    `;

    const starBtn = row.querySelector('.rank-star-btn');
    if (starBtn) {
      starBtn.addEventListener('click', e => {
        e.stopPropagation();
        toggleDefaultPlayerStarred(player.name);
      });
      starBtn.addEventListener('mousedown', e => e.stopPropagation());
      starBtn.addEventListener('dragstart', e => e.preventDefault());
    }

    block.appendChild(row);
  });

  elRankingsList.innerHTML = '';
  elRankingsList.appendChild(block);
  elRankingsList.ondragover = null;
  elRankingsList.ondrop = null;
}

function getTierDisplayLabel(visiblePlayers, tierIdx) {
  if (activeFilterPos !== 'ALL') {
    return `${activeFilterPos} Tier ${tierIdx + 1}`;
  }

  return `Tier ${tierIdx + 1}`;
}

function buildTierBlock(tier, tierIdx, visiblePlayers, rankOffset, showAll) {
  const editable = isEditableRankingsView();
  const block = document.createElement('div');
  block.className = 'tier-block';
  block.dataset.tierIdx = tierIdx;

  // ── Tier Header ──
  const header = document.createElement('div');
  header.className = 'tier-header';
  header.dataset.tierIdx = tierIdx;

  const tierLeft = document.createElement('div');
  tierLeft.className = 'tier-header-left';

  const nameSpan = document.createElement('span');
  nameSpan.className = 'tier-name';
  nameSpan.textContent = getTierDisplayLabel(visiblePlayers, tierIdx);

  tierLeft.appendChild(nameSpan);

  const tierRight = document.createElement('div');
  tierRight.className = 'tier-header-right';

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'tier-delete-btn';
  deleteBtn.title = 'Delete tier';
  deleteBtn.textContent = '✕';
  deleteBtn.disabled = !editable;
  deleteBtn.style.display = editable ? '' : 'none';
  deleteBtn.addEventListener('click', e => { e.stopPropagation(); deleteTier(tierIdx); });

  tierRight.appendChild(deleteBtn);

  header.appendChild(tierLeft);
  header.appendChild(tierRight);

  // Header is also a drop target (drop into top of tier)
  if (editable) {
    header.addEventListener('dragover',  e => handleTierHeaderDragOver(e, tierIdx));
    header.addEventListener('dragleave', () => header.classList.remove('drag-target'));
    header.addEventListener('drop',      e => handleTierHeaderDrop(e, tierIdx));
  }

  block.appendChild(header);

  // ── Drop zone at top of tier player list ──
  const topDrop = document.createElement('div');
  topDrop.className = 'tier-drop-target';
  topDrop.dataset.tierIdx   = tierIdx;
  topDrop.dataset.insertIdx = 0;
  if (!editable) topDrop.style.display = 'none';
  if (editable) {
    topDrop.addEventListener('dragover',  e => handleDropZoneDragOver(e, topDrop));
    topDrop.addEventListener('dragleave', () => topDrop.classList.remove('drag-active'));
    topDrop.addEventListener('drop',      e => handleDropZoneDrop(e, tierIdx, 0));
  }
  block.appendChild(topDrop);

  // ── Player rows ──
  let localRank = rankOffset; // running counter within full list

  if (visiblePlayers.length === 0) {
    const msg = document.createElement('div');
    msg.className = 'tier-empty-msg';
    msg.textContent = `No ${activeFilterPos} players in this tier`;
    block.appendChild(msg);
  } else {
    visiblePlayers.forEach((player, visIdx) => {
      // Find real playerIdx in the full tier.players array
      const playerIdx = showAll
        ? visIdx
        : tier.players.findIndex(p => p.name === player.name);

      const status = getPlayerStatus(player.name);

      const row = buildPlayerRow(player, tierIdx, playerIdx, localRank, status);
      block.appendChild(row);

      // Player gap (tier break zone) — show between adjacent players on any editable board
      if (visIdx < visiblePlayers.length - 1) {
        const gap = buildPlayerGap(tierIdx, playerIdx + 1);
        block.appendChild(gap);
      }

      // Drop zone between players
      const dropZone = document.createElement('div');
      dropZone.className = 'tier-drop-target';
      dropZone.dataset.tierIdx   = tierIdx;
      dropZone.dataset.insertIdx = playerIdx + 1;
      if (!editable) dropZone.style.display = 'none';
      if (editable) {
        dropZone.addEventListener('dragover',  e => handleDropZoneDragOver(e, dropZone));
        dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-active'));
        dropZone.addEventListener('drop',      e => handleDropZoneDrop(e, tierIdx, playerIdx + 1));
      }
      block.appendChild(dropZone);

      localRank++;
    });
  }

  return block;
}

function buildPlayerRow(player, tierIdx, playerIdx, globalRank, status) {
  const starredNames = getEffectiveStarredNames();
  const isStarred = starredNames.has(player.name);
  const editable = isEditableRankingsView();
  const row = document.createElement('div');
  row.className = 'ranking-player-row';
  if (status !== 'available') row.classList.add(`status-${status}`);
  row.draggable = editable;
  row.dataset.tierIdx   = tierIdx;
  row.dataset.playerIdx = playerIdx;

  // Draft owner label
  const visibleDraftState = getVisibleDraftState();
  const ownerLabel = visibleDraftState && visibleDraftState.draftedPlayers && visibleDraftState.draftedPlayers[player.name]
    ? `<span class="status-owner">→ ${escapeHtml(visibleDraftState.draftedPlayers[player.name])}</span>`
    : '';

  row.innerHTML = `
    <button class="rank-star-btn${isStarred ? ' active' : ''}" type="button" aria-label="${isStarred ? 'Unstar' : 'Star'} ${escapeHtml(player.name)}" aria-pressed="${isStarred ? 'true' : 'false'}" title="${isStarred ? 'Starred player' : 'Mark as starred'}">
      <svg class="rank-star-icon" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
        <polygon points="50,4 61,36 96,40 70,62 78,96 50,78 22,96 30,62 4,40 39,36"></polygon>
      </svg>
    </button>
    <span class="drag-handle">⠿</span>
    <span class="rank-num">${globalRank}</span>
    <span class="pos-badge pos-${player.position}">${player.position}</span>
    <span class="rank-player-name">${escapeHtml(player.name)}${ownerLabel}</span>
    <span class="rank-player-team">${escapeHtml(player.team)}</span>
    <span class="rank-player-val">\$${player.avgValue}</span>
    <span class="rank-bid-wrap">
      <span class="rank-bid-label">My $</span>
      <input
        class="rank-bid-input"
        type="number"
        min="0"
        step="1"
        value="${player.userBid === undefined || player.userBid === null ? '' : escapeHtml(String(player.userBid))}"
        placeholder="0"
        aria-label="Your bid for ${escapeHtml(player.name)}"
      >
    </span>
    <button class="rank-remove-btn" title="Remove">✕</button>
  `;

  const starBtn = row.querySelector('.rank-star-btn');
  if (starBtn) {
    starBtn.disabled = !editable;
    starBtn.addEventListener('click', e => {
      e.stopPropagation();
      togglePlayerStarred(tierIdx, playerIdx);
    });
    starBtn.addEventListener('mousedown', e => e.stopPropagation());
    starBtn.addEventListener('dragstart', e => e.preventDefault());
  }

  row.querySelector('.rank-remove-btn').addEventListener('click', e => {
    e.stopPropagation();
    removePlayerFromRankings(tierIdx, playerIdx);
  });
  row.querySelector('.rank-remove-btn').disabled = !editable;

  const bidInput = row.querySelector('.rank-bid-input');
  if (bidInput) {
    bidInput.disabled = !editable;
    bidInput.addEventListener('mousedown', e => e.stopPropagation());
    bidInput.addEventListener('click', e => e.stopPropagation());
    bidInput.addEventListener('dragstart', e => e.preventDefault());
    bidInput.addEventListener('input', e => {
      e.stopPropagation();
      setPlayerUserBid(tierIdx, playerIdx, e.target.value);
    });
  }

  row.addEventListener('dragstart', e => handleRankingDragStart(e, tierIdx, playerIdx));
  row.addEventListener('dragend',   () => clearDragIndicators());

  return row;
}

function setPlayerUserBid(tierIdx, playerIdx, rawValue) {
  if (!isEditableRankingsView()) return;
  if (!rankings[tierIdx] || !rankings[tierIdx].players[playerIdx]) return;

  const value = String(rawValue || '').trim();
  if (!value) {
    rankings[tierIdx].players[playerIdx].userBid = '';
  } else {
    const parsed = parseInt(value, 10);
    rankings[tierIdx].players[playerIdx].userBid = Number.isFinite(parsed) && parsed >= 0 ? parsed : '';
  }

  markDirty();
}

function togglePlayerStarred(tierIdx, playerIdx) {
  if (!isEditableRankingsView()) return;
  if (!rankings[tierIdx] || !rankings[tierIdx].players[playerIdx]) return;

  const player = rankings[tierIdx].players[playerIdx];
  if (!player || !player.name) return;

  if (isDraftSessionActive()) {
    const draftStarred = loadDraftTempStarredNames();
    if (draftStarred.has(player.name)) {
      draftStarred.delete(player.name);
    } else {
      draftStarred.add(player.name);
    }
    saveDraftTempStarredNames(draftStarred);
  } else {
    const sharedStarred = loadSharedStarredNames();
    if (sharedStarred.has(player.name)) {
      sharedStarred.delete(player.name);
    } else {
      sharedStarred.add(player.name);
    }
    persistCurrentStars(sharedStarred);
  }

  syncInMemoryStars(getEffectiveStarredNames());
  markDirty();
  renderRankings();
}

function toggleDefaultPlayerStarred(playerName) {
  if (!playerName) return;

  if (isDraftSessionActive()) {
    const draftStarred = loadDraftTempStarredNames();
    if (draftStarred.has(playerName)) {
      draftStarred.delete(playerName);
    } else {
      draftStarred.add(playerName);
    }
    saveDraftTempStarredNames(draftStarred);
  } else {
    const sharedStarred = loadSharedStarredNames();
    if (sharedStarred.has(playerName)) {
      sharedStarred.delete(playerName);
    } else {
      sharedStarred.add(playerName);
    }
    persistCurrentStars(sharedStarred);
  }

  syncInMemoryStars(getEffectiveStarredNames());
  renderRankings();
}

function buildPlayerGap(tierIdx, insertAfterPlayerIdx) {
  const editable = isEditableRankingsView();
  const gap = document.createElement('div');
  gap.className = 'player-gap';

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'add-tier-here-btn';
  btn.textContent = '+ Add Tier Break';
  btn.setAttribute('aria-label', 'Add tier break between these players');
  btn.disabled = !editable;
  gap.style.display = editable ? '' : 'none';
  btn.addEventListener('click', e => {
    e.stopPropagation();
    addTierBreakAt(tierIdx, insertAfterPlayerIdx);
  });

  gap.appendChild(btn);
  return gap;
}

// ═══════════════════════════════════════════════════
//  Tier CRUD
// ═══════════════════════════════════════════════════

function deleteTier(tierIdx) {
  if (!isEditableRankingsView()) return;
  const tier = rankings[tierIdx];
  if (!tier) return;

  if (tier.players.length > 0) {
    // Merge players into adjacent tier (prefer previous)
    const targetIdx = tierIdx > 0 ? tierIdx - 1 : (rankings.length > 1 ? 0 : -1);
    if (targetIdx !== -1 && targetIdx !== tierIdx) {
      const beforeSplice = rankings.slice(0, tierIdx);
      const afterSplice  = rankings.slice(tierIdx + 1);
      // Merge into target
      if (targetIdx < tierIdx) {
        rankings[targetIdx].players.push(...tier.players);
      } else {
        rankings[targetIdx - 1].players.unshift(...tier.players);
      }
      rankings.splice(tierIdx, 1);
    } else {
      // Only tier remaining — just clear players but keep tier
      rankings.splice(tierIdx, 1);
      if (rankings.length === 0) {
        // Keep at least one tier
        // Do nothing — let rankings be empty
      }
    }
  } else {
    rankings.splice(tierIdx, 1);
  }

  markDirty();
  renderRankings();
}

function addTierBreakAt(tierIdx, splitAtIdx) {
  if (!isEditableRankingsView()) return;
  // splitAtIdx is the index BEFORE which the new tier should start
  const sourceTier  = rankings[tierIdx];
  if (!sourceTier || splitAtIdx <= 0 || splitAtIdx >= sourceTier.players.length) return;

  const upperPlayers = sourceTier.players.slice(0, splitAtIdx);
  const lowerPlayers = sourceTier.players.slice(splitAtIdx);

  const newTier = {
    id:      'tier_' + Date.now(),
    name:    `Tier ${rankings.length + 1}`,
    players: lowerPlayers,
  };

  rankings[tierIdx].players = upperPlayers;
  rankings.splice(tierIdx + 1, 0, newTier);

  markDirty();
  renderRankings();
}

// ═══════════════════════════════════════════════════
//  Add / Remove Players
// ═══════════════════════════════════════════════════

function addPlayerToRankings(player) {
  if (activeBoardType !== 'personal') return;
  const targetBoardKey = activeFilterPos === ALL_POSITIONS_KEY ? ALL_POSITIONS_KEY : player.position;
  const targetBoard = getRankingsBoardForPosition(targetBoardKey);

  // Check if already added
  for (const tier of targetBoard) {
    if (tier.players.some(p => p.name === player.name)) {
      return; // already in rankings
    }
  }

  // If no tiers exist yet, create Tier 1
  if (targetBoard.length === 0) {
    targetBoard.push({
      id:      'tier_1',
      name:    'Tier 1',
      players: [],
    });
  }

  // Add to end of last tier
  targetBoard[targetBoard.length - 1].players.push({ ...player, starred: false, userBid: '' });

  markDirty();
  renderRankings();
  renderPool(activePoolTab);
}

function removePlayerFromRankings(tierIdx, playerIdx) {
  if (!isEditableRankingsView()) return;

  if (!rankings[tierIdx]) return;
  rankings[tierIdx].players.splice(playerIdx, 1);

  // Remove empty tiers (but keep at least one? — no, remove all empty tiers)
  rankings = rankings.filter(t => t.players.length > 0);

  markDirty();
  renderRankings();
  renderPool(activePoolTab);
}

// ═══════════════════════════════════════════════════
//  Drag & Drop
// ═══════════════════════════════════════════════════

function handlePoolDragStart(e, player) {
  if (!isEditableRankingsView()) return;
  if (activeFilterPos !== ALL_POSITIONS_KEY && player.position !== activeFilterPos) return;

  dragSource = { type: 'pool', player };
  e.dataTransfer.effectAllowed = 'copy';
  e.dataTransfer.setData('text/plain', player.name);
  e.currentTarget.classList.add('dragging');
}

function handleRankingDragStart(e, tierIdx, playerIdx) {
  if (!isEditableRankingsView()) return;

  dragSource = { type: 'ranking', tierIdx, playerIdx };
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', rankings[tierIdx].players[playerIdx].name);
  e.currentTarget.classList.add('dragging');
}

function handleTierHeaderDragOver(e, tierIdx) {
  if (!dragSource) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = dragSource.type === 'pool' ? 'copy' : 'move';
  e.currentTarget.classList.add('drag-target');
}

function handleTierHeaderDrop(e, tierIdx) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-target');
  if (!dragSource) return;
  performDrop(tierIdx, 0); // drop at top of tier
}

function handleDropZoneDragOver(e, zoneEl) {
  if (!dragSource) return;
  e.preventDefault();
  e.stopPropagation();
  e.dataTransfer.dropEffect = dragSource.type === 'pool' ? 'copy' : 'move';
  zoneEl.classList.add('drag-active');
}

function handleDropZoneDrop(e, tierIdx, insertIdx) {
  e.preventDefault();
  e.stopPropagation();
  document.querySelectorAll('.tier-drop-target').forEach(z => z.classList.remove('drag-active'));
  if (!dragSource) return;
  performDrop(tierIdx, insertIdx);
}

function handleListDrop(e) {
  e.preventDefault();
  if (!dragSource) return;

  // Drop onto blank area of rankings list = add to end of last tier
  if (rankings.length === 0) {
    if (dragSource.type === 'pool') {
      addPlayerToRankings(dragSource.player);
    }
    return;
  }

  const lastTierIdx = rankings.length - 1;
  performDrop(lastTierIdx, rankings[lastTierIdx].players.length);
}

function performDrop(targetTierIdx, insertIdx) {
  if (!rankings[targetTierIdx]) return;

  if (dragSource.type === 'pool') {
    const player = dragSource.player;

    // Check if already added
    for (const tier of rankings) {
      if (tier.players.some(p => p.name === player.name)) {
        dragSource = null;
        clearDragIndicators();
        return;
      }
    }

    // Insert into target tier at insertIdx
    rankings[targetTierIdx].players.splice(insertIdx, 0, { ...player });

  } else if (dragSource.type === 'ranking') {
    const { tierIdx: srcTierIdx, playerIdx: srcPlayerIdx } = dragSource;
    if (!rankings[srcTierIdx]) return;

    const player = rankings[srcTierIdx].players[srcPlayerIdx];

    // Adjust insertIdx if moving within same tier and src comes before target
    let adjustedInsert = insertIdx;
    if (srcTierIdx === targetTierIdx && srcPlayerIdx < insertIdx) {
      adjustedInsert--;
    }

    // Remove from source
    rankings[srcTierIdx].players.splice(srcPlayerIdx, 1);

    // Clean up empty tiers
    const emptySourceTier = rankings[srcTierIdx] && rankings[srcTierIdx].players.length === 0;
    if (emptySourceTier) {
      rankings.splice(srcTierIdx, 1);
      // Adjust target index if source was before target
      if (srcTierIdx < targetTierIdx) {
        targetTierIdx--;
      }
    }

    if (!rankings[targetTierIdx]) {
      // Target tier was removed or doesn't exist — add to last available
      if (rankings.length > 0) {
        rankings[rankings.length - 1].players.push(player);
      } else {
        rankings.push({ id: 'tier_1', name: 'Tier 1', players: [player] });
      }
    } else {
      rankings[targetTierIdx].players.splice(
        Math.max(0, Math.min(adjustedInsert, rankings[targetTierIdx].players.length)),
        0,
        player
      );
    }
  }

  dragSource = null;
  markDirty();
  renderRankings();
  renderPool(activePoolTab);
  clearDragIndicators();
}

function clearDragIndicators() {
  document.querySelectorAll('.drag-above, .drag-below, .drag-active, .drag-target')
    .forEach(el => el.classList.remove('drag-above', 'drag-below', 'drag-active', 'drag-target'));
  dragSource = null;
}

// ═══════════════════════════════════════════════════
//  Draft State Polling & Status
// ═══════════════════════════════════════════════════

function setupDraftStatePolling() {
  let lastSnapshot = null;

  const check = () => {
    const wasDraftActive = isDraftSessionActive();
    const raw = localStorage.getItem(DRAFT_STATE_KEY);
    if (raw === lastSnapshot) return;
    lastSnapshot = raw;

    try {
      draftState = raw ? JSON.parse(raw) : null;
    } catch (e) {
      draftState = null;
    }

    // If draft just ended or state got cleared, clear temporary in-draft stars.
    if (wasDraftActive && !isDraftSessionActive()) {
      try {
        localStorage.removeItem(DRAFT_TEMP_STARRED_KEY);
      } catch (e) {
        // ignore
      }
    }

    updateDraftUI();
    syncInMemoryStars(getEffectiveStarredNames());
    renderRankings();
    renderPool(activePoolTab);
  };

  check();
  setInterval(check, 3000);
}

function updateDraftUI() {
  const visibleDraftState = getVisibleDraftState();
  if (visibleDraftState) {
    elDraftBadge.textContent = `🟡 LIVE — Round ${visibleDraftState.currentRound}`;
    elDraftBadge.classList.remove('hidden');
    elDraftLegend.classList.remove('hidden');
  } else {
    elDraftBadge.classList.add('hidden');
    elDraftLegend.classList.add('hidden');
  }
}

function getPlayerStatus(playerName) {
  const visibleDraftState = getVisibleDraftState();
  if (!visibleDraftState) return 'available';

  const {
    currentRoundPlayers = [],
    draftedPlayers      = {},
    userRoster          = [],
    passedPlayers       = [],
  } = visibleDraftState;

  if (userRoster.includes(playerName))        return 'user-roster';
  if (draftedPlayers[playerName])             return 'drafted';
  if (currentRoundPlayers.includes(playerName)) return 'current-round';
  if (passedPlayers.includes(playerName))     return 'passed';
  return 'available';
}

// ═══════════════════════════════════════════════════
//  Persistence
// ═══════════════════════════════════════════════════

function loadRankingsFromStorage() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      rankingsByPos = parsed && parsed.boardsByPos
        ? normalizeBoardsByPosition(parsed.boardsByPos)
        : splitLegacyRankingsByPosition(Array.isArray(parsed.tiers) ? parsed.tiers : []);
    } else {
      rankingsByPos = createEmptyRankingsByPosition();
    }
  } catch (e) {
    rankingsByPos = createEmptyRankingsByPosition();
  }

  syncActiveRankings();
}

function normalizeLoadedRankings(tiers) {
  const starredNames = getEffectiveStarredNames();
  return tiers.map((tier, idx) => ({
    id: tier.id || `tier_${idx + 1}`,
    name: tier.name || `Tier ${idx + 1}`,
    players: Array.isArray(tier.players)
      ? tier.players.map(player => ({
          ...player,
          starred: starredNames.has(player.name || ''),
          userBid: player.userBid === undefined || player.userBid === null
            ? ''
            : player.userBid,
        }))
      : [],
  }));
}

function saveRankings() {
  if (activeBoardType !== 'personal') return;

  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ boardsByPos: rankingsByPos }));
    isDirty = false;
    elSaveBtn.textContent = 'Saved ✓';
    elSaveBtn.classList.remove('unsaved');
    elSaveBtn.classList.add('saved');
  } catch (e) {
    // ignore
  }
}

function markDirty() {
  isDirty = true;
  elSaveBtn.textContent = 'Save';
  elSaveBtn.classList.remove('saved');
  elSaveBtn.classList.add('unsaved');
}

// Auto-save every 30 seconds if dirty
setInterval(() => { if (isDirty) saveRankings(); }, 30000);

// Save before page unload
window.addEventListener('beforeunload', () => { if (isDirty) saveRankings(); });

// ═══════════════════════════════════════════════════
//  Utility
// ═══════════════════════════════════════════════════

function getAddedPlayerNames(pos = activePoolTab) {
  const s = new Set();
  getRankingsBoardForPosition(pos).forEach(t => t.players.forEach(p => s.add(p.name)));
  return s;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ═══════════════════════════════════════════════════
//  Event Listeners
// ═══════════════════════════════════════════════════

function setupEventListeners() {
  if (elThemeToggleBtn) {
    elThemeToggleBtn.addEventListener('click', toggleRankingsTheme);
  }

  if (elTierInsertModeBtn) {
    elTierInsertModeBtn.addEventListener('click', toggleTierInsertMode);
  }

  if (elClearFilteredBtn) {
    elClearFilteredBtn.addEventListener('click', clearFilteredRankings);
  }

  if (elPrintPreviewBtn) {
    elPrintPreviewBtn.addEventListener('click', togglePrintPreview);
  }

  if (elPrintRankingsBtn) {
    elPrintRankingsBtn.addEventListener('click', printPersonalRankings);
  }

  // Save button
  elSaveBtn.addEventListener('click', saveRankings);

  // Position filter bar (left panel)
  document.querySelectorAll('.pos-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activeFilterPos = btn.dataset.pos;
      document.querySelectorAll('.pos-filter-btn').forEach(b =>
        b.classList.toggle('active', b.dataset.pos === activeFilterPos)
      );
      updateClearFilteredButton();
      renderRankings();
      renderPool(activePoolTab);
    });
  });

  // Position tabs (right panel)
  document.querySelectorAll('.pos-tab').forEach(btn => {
    btn.addEventListener('click', () => renderPool(btn.dataset.pos));
  });

  document.querySelectorAll('.board-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activeBoardType = btn.dataset.board === 'default' ? 'default' : 'personal';
      saveBoardModePreference();
      updateBoardModeUI();
      renderRankings();
      renderPool(activePoolTab);
    });
  });

  // Pool search
  elPoolSearch.addEventListener('input', () => {
    poolSearchQuery = elPoolSearch.value;
    renderPool(activePoolTab);
  });

  // Rankings list — global dragover (allow drop anywhere)
  elRankingsList.addEventListener('dragover', e => {
    if (dragSource) e.preventDefault();
  });

  // Global drag cancel
  document.addEventListener('dragend', () => clearDragIndicators());

  // Allow quick exit when preview controls are hidden for clean print view.
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && isPrintPreview) {
      isPrintPreview = false;
      applyPrintPreviewMode();
      renderRankings();
    }
  });
}

function updateBoardModeUI() {
  const personal = activeBoardType === 'personal';
  document.querySelectorAll('.board-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.board === activeBoardType);
  });

  document.querySelectorAll('.pos-tab, #poolSearch').forEach(el => {
    if (!el) return;
    el.disabled = !personal;
  });

  if (elSaveBtn) elSaveBtn.style.display = personal ? '' : 'none';
  if (elTierInsertModeBtn) elTierInsertModeBtn.style.display = personal ? '' : 'none';
  if (elClearFilteredBtn) elClearFilteredBtn.style.display = personal ? '' : 'none';
  if (elPrintPreviewBtn) elPrintPreviewBtn.style.display = '';
  if (elPrintRankingsBtn) elPrintRankingsBtn.style.display = '';
  updateClearFilteredButton();
}

// ═══════════════════════════════════════════════════
//  Initial Render
// ═══════════════════════════════════════════════════

// Rankings renders immediately after DOM ready (inside DOMContentLoaded via loadRankingsFromStorage)
// We call renderRankings here after loadRankingsFromStorage is done
document.addEventListener('DOMContentLoaded', () => {
  renderRankings();
  updateDraftUI();
});

