document.addEventListener('DOMContentLoaded', () => {
  const AJ_ROUND_CODES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
  const AJ_REVERSED_START_POSITIONS = new Set(['WR', 'TE', 'K']);
  const PAGE_SIZE = 12;
  const PAGE1_REQUIREMENTS = [
    { pos: 'QB', min: 2 },
    { pos: 'RB', min: 2 },
    { pos: 'WR', min: 2 },
    { pos: 'TE', min: 1 },
    { pos: 'K', min: 1 },
    { pos: 'DEF', min: 1 }
  ];
  const PAGE2_REQUIREMENTS = [
    { pos: 'QB', min: 1 },
    { pos: 'RB', min: 1 },
    { pos: 'WR', min: 1 },
    { pos: 'TE', min: 1 }
  ];

  const sheetSource = document.getElementById('sheetSource');
  const draftCodeField = document.getElementById('draftCodeField');
  const draftCodeInput = document.getElementById('draftCodeInput');
  const generateSheetsBtn = document.getElementById('generateSheetsBtn');
  const printSheetsBtn = document.getElementById('printSheetsBtn');
  const expectedPagesPreview = document.getElementById('expectedPagesPreview');
  const offlineStatus = document.getElementById('offlineStatus');
  const printSheetsContainer = document.getElementById('printSheetsContainer');
  const SHEETS_PER_PACKET = 20;

  const currentDraft = (sessionStorage.getItem('currentDraft') || '').trim();
  if (currentDraft) {
    draftCodeInput.value = currentDraft;
  }

  toggleDraftCodeVisibility();
  updateExpectedPagesPreview();
  sheetSource.addEventListener('change', toggleDraftCodeVisibility);
  sheetSource.addEventListener('change', updateExpectedPagesPreview);
  generateSheetsBtn.addEventListener('click', handleGenerate);
  printSheetsBtn.addEventListener('click', () => window.print());

  function toggleDraftCodeVisibility() {
    const needsDraftCode = sheetSource.value === 'serverRandom';
    draftCodeField.style.display = needsDraftCode ? '' : 'none';
  }

  async function handleGenerate() {
    printSheetsContainer.innerHTML = '';
    const drafterCount = getDrafterCount();

    if (sheetSource.value === 'aj') {
      setStatus('Generating one A-J structured packet...');
      const players = await loadRankingPlayers();
      if (!players.length) {
        setStatus('No ranking players were found to build A-J sheets.');
        return;
      }
      const baseSheets = buildAjSheets(players);
      const packetSheets = buildPacketSheets(baseSheets, drafterCount);
      renderSheets(packetSheets);
      setStatus(`Generated ${packetSheets.length} sheets. Print this packet, then make copies for each team in your league.`);
      return;
    }

    const code = String(draftCodeInput.value || '').trim().toUpperCase();
    if (!code) {
      setStatus('Enter a draft code for server-randomized sheets.');
      return;
    }

    setStatus(`Loading one server-randomized packet for draft ${code}...`);
    const payload = await loadServerRandomizedSheets(code);
    if (!payload.ok) {
      setStatus(payload.message || 'Unable to load server-randomized sheets.');
      return;
    }

    const packetSheets = buildPacketSheets(payload.sheets, drafterCount);
    renderSheets(packetSheets);
    setStatus(`Generated ${packetSheets.length} sheets. Print this packet, then make copies for each team in your league.`);
  }

  function getDrafterCount() {
    return 1;
  }

  function updateExpectedPagesPreview() {
    if (!expectedPagesPreview) return;
    const sourceLabel = sheetSource && sheetSource.value === 'serverRandom' ? 'Server Randomized' : 'A-J Structured';
    expectedPagesPreview.textContent = `Expected print volume (${sourceLabel}): one ${SHEETS_PER_PACKET}-sheet packet.`;
  }

  function getDrafterLetter(index) {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    return letters[index] || `T${index + 1}`;
  }

  function buildPacketSheets(baseSheets, drafterCount) {
    const safeSheets = Array.isArray(baseSheets) ? baseSheets : [];
    const packets = [];

    for (let i = 0; i < drafterCount; i += 1) {
      const drafterLetter = getDrafterLetter(i);
      safeSheets.forEach((sheet, sheetIndex) => {
        packets.push({
          ...sheet,
          packetLetter: drafterLetter,
          packetOrder: i,
          sheetOrder: sheetIndex
        });
      });
    }

    return packets.sort((a, b) => {
      if (a.packetOrder !== b.packetOrder) return a.packetOrder - b.packetOrder;
      return a.sheetOrder - b.sheetOrder;
    });
  }

  async function loadRankingPlayers() {
    const positionPlayers = await loadPositionRankingPlayers();
    if (positionPlayers.length > 0) {
      return positionPlayers;
    }

    const urls = ['/top250.generated.json', '/top250.json'];
    for (const url of urls) {
      try {
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) continue;
        const data = await response.json();
        if (!Array.isArray(data)) continue;

        const normalized = assignFallbackPositionRanks(data)
          .map((player, idx) => normalizePlayer(player, idx + 1))
          .filter((player) => Boolean(player.name) && Boolean(player.position));

        if (normalized.length > 0) {
          return normalized;
        }
      } catch (_err) {
        // try next source
      }
    }
    return [];
  }

  async function loadPositionRankingPlayers() {
    const positions = ['qb', 'rb', 'wr', 'te', 'k', 'def'];
    const groups = await Promise.all(positions.map(async (pos) => {
      try {
        const response = await fetch(`/${pos}.json`, { cache: 'no-store' });
        if (!response.ok) return [];
        const data = await response.json();
        if (!Array.isArray(data)) return [];

        return data
          .map((player, idx) => normalizePositionPlayer(player, pos.toUpperCase(), idx + 1))
          .filter((player) => Boolean(player.name) && Boolean(player.position));
      } catch (_err) {
        return [];
      }
    }));

    return groups.flat();
  }

  function normalizePositionPlayer(player, position, fallbackRank) {
    const rankField = `${String(position || '').toLowerCase()}Rank`;
    const rankRaw = Number.parseInt(player && (player.positionRank || player[rankField] || player.rank || player.prerank), 10);
    const rank = Number.isFinite(rankRaw) ? rankRaw : fallbackRank;
    return {
      name: String(player && (player.name || player.playerName || '')).trim(),
      position,
      team: String(player && (player.team || player.nflTeam || '')).toUpperCase().trim(),
      avgValue: Number(player && player.avgValue || 0),
      rank
    };
  }

  function assignFallbackPositionRanks(players) {
    const counters = new Map();
    return (players || [])
      .slice()
      .sort((a, b) => {
        const aRank = Number.parseInt(a && (a.prerank || a.rank || 9999), 10) || 9999;
        const bRank = Number.parseInt(b && (b.prerank || b.rank || 9999), 10) || 9999;
        return aRank - bRank;
      })
      .map((player) => {
        const position = String(player && player.position || '').toUpperCase().trim();
        const nextRank = (counters.get(position) || 0) + 1;
        counters.set(position, nextRank);
        return { ...player, positionRank: player && player.positionRank ? player.positionRank : nextRank };
      });
  }

  function normalizePlayer(player, fallbackRank) {
    const name = String(player && (player.name || player.playerName || '')).trim();
    const position = String(player && player.position || '').toUpperCase().trim();
    const team = String(player && (player.team || player.nflTeam || '')).toUpperCase().trim();
    const rankField = `${position.toLowerCase()}Rank`;
    const rankRaw = Number.parseInt(player && (player.positionRank || player[rankField] || player.rank || player.prerank), 10);
    const rank = Number.isFinite(rankRaw) ? rankRaw : fallbackRank;
    return { name, position, team, rank };
  }

  function playerKey(player) {
    return [
      String(player && player.name || '').trim().toLowerCase(),
      String(player && player.position || '').trim().toUpperCase(),
      String(player && player.team || '').trim().toUpperCase(),
      Number.parseInt(player && player.rank, 10) || 0
    ].join('|');
  }

  function removePlayersFromPool(pool, picked) {
    const pickedKeys = new Set((picked || []).map(playerKey));
    return (pool || []).filter((player) => !pickedKeys.has(playerKey(player)));
  }

  function comparePlayers(a, b) {
    if (a.rank !== b.rank) return a.rank - b.rank;
    return String(a.name).localeCompare(String(b.name));
  }

  function getAjSlotAssignment(positionRank, position) {
    const normalizedRank = Math.max(1, Number.parseInt(positionRank, 10) || 1);
    const zeroBasedRank = normalizedRank - 1;
    const blockIndex = Math.floor(zeroBasedRank / 10);
    const offset = zeroBasedRank % 10;
    const normalizedPosition = String(position || '').toUpperCase();
    const startsReversed = AJ_REVERSED_START_POSITIONS.has(normalizedPosition);
    const isPageOneBlock = startsReversed ? (blockIndex % 2 === 1) : (blockIndex % 2 === 0);
    const roundIndex = isPageOneBlock ? offset : (AJ_ROUND_CODES.length - 1 - offset);
    const page = isPageOneBlock ? 1 : 2;
    return {
      roundCode: AJ_ROUND_CODES[roundIndex],
      page,
      code: `${AJ_ROUND_CODES[roundIndex]}-${page}`
    };
  }

  function getRequirementMin(requirements, position) {
    const found = (requirements || []).find((req) => req.pos === position);
    return found ? Math.max(0, Number.parseInt(found.min, 10) || 0) : 0;
  }

  function countByPosition(players, position) {
    return (players || []).filter((player) => player.position === position).length;
  }

  function buildAjPagePlayersFromPool(roundCode, pageNumber, pool, requirements, extraExclude = []) {
    const excludedKeys = new Set((extraExclude || []).map(playerKey));
    const available = (pool || []).filter((player) => !excludedKeys.has(playerKey(player)));

    const assigned = available
      .filter((player) => {
        const slot = getAjSlotAssignment(player.rank, player.position);
        return slot.roundCode === roundCode && slot.page === pageNumber;
      })
      .sort(comparePlayers);

    let selected = assigned.slice(0, PAGE_SIZE);
    const requirementMap = new Map((requirements || []).map((req) => [req.pos, Math.max(0, Number.parseInt(req.min, 10) || 0)]));

    (requirements || []).forEach((req) => {
      const neededPosition = req.pos;
      const minRequired = Math.max(0, Number.parseInt(req.min, 10) || 0);

      while (countByPosition(selected, neededPosition) < minRequired) {
        const candidate = available.find((player) => player.position === neededPosition && !selected.some((p) => playerKey(p) === playerKey(player)));
        if (!candidate) break;

        if (selected.length < PAGE_SIZE) {
          selected.push(candidate);
        } else {
          const replaceIndex = selected
            .map((player, index) => ({ player, index }))
            .filter(({ player }) => countByPosition(selected, player.position) > (requirementMap.get(player.position) || 0))
            .sort((a, b) => comparePlayers(b.player, a.player))[0];

          if (!replaceIndex) break;
          selected[replaceIndex.index] = candidate;
        }
      }
    });

    if (selected.length < PAGE_SIZE) {
      const fillers = available
        .filter((player) => !selected.some((p) => playerKey(p) === playerKey(player)))
        .sort(comparePlayers);

      for (const candidate of fillers) {
        if (selected.length >= PAGE_SIZE) break;
        selected.push(candidate);
      }
    }

    return selected.sort(comparePlayers).slice(0, PAGE_SIZE);
  }

  function buildAjSheets(players) {
    let remainingPool = [...players].sort(comparePlayers);
    const sheets = [];

    AJ_ROUND_CODES.forEach((roundCode) => {
      const page1 = buildAjPagePlayersFromPool(roundCode, 1, remainingPool, PAGE1_REQUIREMENTS);
      remainingPool = removePlayersFromPool(remainingPool, page1);

      const page2 = buildAjPagePlayersFromPool(roundCode, 2, remainingPool, PAGE2_REQUIREMENTS);
      remainingPool = removePlayersFromPool(remainingPool, page2);

      sheets.push({
        title: `${roundCode}-1`,
        subtitle: 'A-J Structured Sheet',
        players: page1
      });
      sheets.push({
        title: `${roundCode}-2`,
        subtitle: 'A-J Structured Sheet',
        players: page2
      });
    });

    return sheets;
  }

  function pickRandomFromPool(pool) {
    if (!pool || pool.length === 0) return null;
    const index = Math.floor(Math.random() * pool.length);
    return pool[index];
  }

  function buildRandomPagePlayersFromPool(pool, requirements, pageSize, excludedPositions = []) {
    const selected = [];
    const blocked = new Set((excludedPositions || []).map((pos) => String(pos || '').toUpperCase()));

    const addRandomCandidate = (positionFilter = null) => {
      const candidates = (pool || []).filter((player) => {
        if (selected.some((picked) => playerKey(picked) === playerKey(player))) return false;
        if (blocked.has(String(player.position || '').toUpperCase())) return false;
        if (positionFilter && player.position !== positionFilter) return false;
        return true;
      });

      const chosen = pickRandomFromPool(candidates);
      if (chosen) selected.push(chosen);
      return Boolean(chosen);
    };

    (requirements || []).forEach((req) => {
      const min = Math.max(0, Number.parseInt(req.min, 10) || 0);
      for (let i = 0; i < min; i += 1) {
        addRandomCandidate(req.pos);
      }
    });

    while (selected.length < pageSize) {
      const added = addRandomCandidate();
      if (!added) break;
    }

    return selected.sort(comparePlayers).slice(0, pageSize);
  }

  function buildServerRandomizedTenRoundSheets(players, code) {
    let remainingPool = [...players].sort(comparePlayers);
    const sheets = [];

    AJ_ROUND_CODES.forEach((roundCode) => {
      const page1 = buildRandomPagePlayersFromPool(remainingPool, PAGE1_REQUIREMENTS, PAGE_SIZE, []);
      remainingPool = removePlayersFromPool(remainingPool, page1);

      const page2 = buildRandomPagePlayersFromPool(remainingPool, PAGE2_REQUIREMENTS, PAGE_SIZE, ['K', 'DEF']);
      remainingPool = removePlayersFromPool(remainingPool, page2);

      sheets.push({
        title: `${roundCode}-1`,
        subtitle: `Server Randomized | Draft ${code}`,
        players: page1
      });
      sheets.push({
        title: `${roundCode}-2`,
        subtitle: `Server Randomized | Draft ${code}`,
        players: page2
      });
    });

    return sheets;
  }

  async function loadServerRandomizedSheets(code) {
    const socket = getSocket();
    if (!socket) {
      return { ok: false, message: 'Socket connection unavailable. Refresh and try again.' };
    }

    return new Promise((resolve) => {
      socket.emit('getDraftState', code, (response) => {
        if (!response || !response.ok || !response.draft) {
          resolve({ ok: false, message: 'Draft not found or unavailable.' });
          return;
        }

        const draft = response.draft;
        const allPlayersRaw = Array.isArray(draft.draftState && draft.draftState.allPlayers)
          ? draft.draftState.allPlayers
          : [];

        const fromDraft = allPlayersRaw
          .map((player, idx) => normalizePlayer(player, idx + 1))
          .filter((player) => Boolean(player.name) && Boolean(player.position));

        if (fromDraft.length >= 240) {
          const sheets = buildServerRandomizedTenRoundSheets(fromDraft, code);
          resolve({ ok: true, sheets });
          return;
        }

        loadRankingPlayers().then((fallbackPlayers) => {
          if (!fallbackPlayers.length) {
            resolve({
              ok: false,
              message: 'Unable to build server-randomized 10-round sheets because player data is unavailable.'
            });
            return;
          }

          const sheets = buildServerRandomizedTenRoundSheets(fallbackPlayers, code);
          resolve({ ok: true, sheets });
        });
      });
    });
  }

  function getSocket() {
    if (!window.io) return null;
    if (window.draftSocket) return window.draftSocket;
    window.draftSocket = window.io({ reconnection: false });
    return window.draftSocket;
  }

  function renderSheets(sheets) {
    printSheetsContainer.innerHTML = `
      ${sheets
      .map((sheet) => `
        <article class="print-sheet">
          <div class="print-sheet-top-row">
            <div class="print-sheet-name-block">
              <div class="print-sheet-name-row">
                <span class="name-line" aria-hidden="true"></span>
                <span class="name-label">NAME</span>
              </div>
              <div class="sheet-code-under">${escapeHtml(sheet.title)}</div>
            </div>
            <h2 class="print-sheet-title">HUSH OFFLINE BID SHEET</h2>
          </div>
          <table class="bid-table" role="presentation">
            <tbody>
              ${renderPlayerRows(sheet.players)}
            </tbody>
          </table>
        </article>
      `)
      .join('')}
    `;
  }

  function renderPlayerRows(players) {
    if (!Array.isArray(players) || players.length === 0) {
      return '<tr><td class="bid-empty" colspan="4">No players found for this sheet.</td></tr>';
    }

    const shuffledPlayers = shufflePlayers(players);

    return shuffledPlayers
      .map((player) => `
        <tr>
          <td class="bid-cell-line">_____</td>
          <td class="bid-cell-name">${escapeHtml(player.name)}</td>
          <td class="bid-cell-pos">${escapeHtml(player.position || '')}</td>
          <td class="bid-cell-team">${escapeHtml(player.team || '')}</td>
        </tr>
      `)
      .join('');
  }

  function shufflePlayers(players) {
    const clone = [...players];
    for (let i = clone.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = clone[i];
      clone[i] = clone[j];
      clone[j] = temp;
    }
    return clone;
  }

  function setStatus(message) {
    offlineStatus.textContent = message;
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
});
