// expose a reusable initializer so public/private lobby pages can call it
window.initializeLobby = function initializeLobby(opts){
  const lobbyRoot = document.getElementById('lobbyBox') || document.body;
  if (lobbyRoot && lobbyRoot.dataset && lobbyRoot.dataset.lobbyInitialized === '1') {
    return;
  }
  if (lobbyRoot && lobbyRoot.dataset) {
    lobbyRoot.dataset.lobbyInitialized = '1';
  }

  const DEFAULT_DRAFT_BENCH = 5;
  const DEFAULT_BENCH_CUT_TARGET = 5;
  const DEFAULT_ROUND_TIMER_MINUTES = 10;
  const DEFAULT_AJ_DRAFT_MODE = true;
  let HUSH_NETWORK_PROFILE = 'high-latency';
  try {
    const storedProfile = String(localStorage.getItem('hushNetworkProfile') || '').trim().toLowerCase();
    if (storedProfile) HUSH_NETWORK_PROFILE = storedProfile;
  } catch (_error) {
    HUSH_NETWORK_PROFILE = 'high-latency';
  }
  const USE_HIGH_LATENCY_PROFILE = HUSH_NETWORK_PROFILE === 'high-latency' || HUSH_NETWORK_PROFILE === 'mobile';
  const LOBBY_HEARTBEAT_INTERVAL_MS = USE_HIGH_LATENCY_PROFILE ? 12000 : 10000;
  const LOBBY_HEARTBEAT_ACK_TIMEOUT_MS = USE_HIGH_LATENCY_PROFILE ? 6000 : 5000;
  const LOBBY_HEARTBEAT_MISS_THRESHOLD = USE_HIGH_LATENCY_PROFILE ? 4 : 3;
  const START_DRAFT_RETRY_BASE_MS = USE_HIGH_LATENCY_PROFILE ? 650 : 500;
  const START_DRAFT_RETRY_MAX_MS = USE_HIGH_LATENCY_PROFILE ? 10000 : 8000;
  const START_DRAFT_ACK_TIMEOUT_MS = USE_HIGH_LATENCY_PROFILE ? 9000 : 7000;
  const START_DRAFT_MAX_RETRIES = USE_HIGH_LATENCY_PROFILE ? 8 : 6;
  const DEFAULT_ROSTER_SETTINGS = { QB: 1, WR: 2, RB: 2, TE: 1, FLEX: 1, SPFLEX: 0, K: 1, DEF: 1, BN: DEFAULT_DRAFT_BENCH };
  const DEFAULT_START_BUDGET = 200;

  function toRosterInt(value, fallback, min, max) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed)) return fallback;
    return Math.max(min, Math.min(max, parsed));
  }

  function normalizeRosterSettings(raw) {
    const merged = Object.assign({}, DEFAULT_ROSTER_SETTINGS, raw || {});
    const normalized = {
      QB: toRosterInt(merged.QB, DEFAULT_ROSTER_SETTINGS.QB, 0, 8),
      WR: toRosterInt(merged.WR, DEFAULT_ROSTER_SETTINGS.WR, 0, 10),
      RB: toRosterInt(merged.RB, DEFAULT_ROSTER_SETTINGS.RB, 0, 10),
      TE: toRosterInt(merged.TE, DEFAULT_ROSTER_SETTINGS.TE, 0, 8),
      FLEX: toRosterInt(merged.FLEX, DEFAULT_ROSTER_SETTINGS.FLEX, 0, 5),
      SPFLEX: toRosterInt(merged.SPFLEX, DEFAULT_ROSTER_SETTINGS.SPFLEX, 0, 5),
      K: toRosterInt(merged.K, DEFAULT_ROSTER_SETTINGS.K, 0, 5),
      DEF: toRosterInt(merged.DEF, DEFAULT_ROSTER_SETTINGS.DEF, 0, 5),
      BN: toRosterInt(merged.BN, DEFAULT_ROSTER_SETTINGS.BN, 0, 20)
    };
    const total = normalized.QB + normalized.WR + normalized.RB + normalized.TE + normalized.FLEX + normalized.SPFLEX + normalized.K + normalized.DEF + normalized.BN;
    if (total < 8) {
      normalized.BN += (8 - total);
    }
    return normalized;
  }

  function rosterSettingsSummary(settings) {
    return '';
  }

  function normalizeBudget(value, fallback) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed)) return fallback;
    return Math.max(0, Math.min(parsed, 9999));
  }

  function normalizeBenchCutTarget(value, fallback) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed)) return fallback;
    return Math.max(0, Math.min(parsed, DEFAULT_DRAFT_BENCH));
  }

  function normalizeRoundTimerMinutes(value, fallback = DEFAULT_ROUND_TIMER_MINUTES) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed)) return fallback;
    return Math.max(3, Math.min(parsed, 10));
  }

  function normalizeWaiverMode(value, fallback = 'off') {
    const normalized = String(value || fallback || '').trim().toLowerCase();
    if (normalized === 'random' || normalized === 'skill') return normalized;
    return 'off';
  }

  function isValidWaiverMode(value) {
    const normalized = String(value || '').trim().toLowerCase();
    return normalized === 'off' || normalized === 'random' || normalized === 'skill';
  }

  function buildAjRoundOrder() {
    const order = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    return order;
  }

  function normalizeCustomBudgets(raw, members) {
    const source = (raw && typeof raw === 'object') ? raw : {};
    const out = {};
    (members || []).forEach((member) => {
      out[member] = normalizeBudget(source[member], DEFAULT_START_BUDGET);
    });
    return out;
  }

  // opts can include pageType if needed later
  const user = sessionStorage.getItem('username');
  const code = sessionStorage.getItem('currentDraft');
  if(!user || !code){ window.location.href='dashboard.html'; return; }
  const userEmail = String(sessionStorage.getItem('userEmail') || localStorage.getItem('lastSignedInEmail') || '').trim();
  const userFullname = String(sessionStorage.getItem('fullname') || '').trim();
  const userPhone = String(sessionStorage.getItem('phone') || '').trim();

  const draftTitle = document.getElementById('draftTitle');
  const draftCode = document.getElementById('draftCode');
  const shareLobbyCodeBtn = document.getElementById('shareLobbyCodeBtn');
  const hostDisplay = document.getElementById('hostDisplay');
  const memberCountBadge = document.getElementById('memberCountBadge');
  const memberList = document.getElementById('memberList');
  const leaveBtn = document.getElementById('leaveBtn');
  const draftTypeRadios = document.getElementsByName('draftType');
  const rounds3DraftTypeRadio = Array.from(draftTypeRadios || []).find((radio) => radio.value === 'rounds3');
  const draftOrderSection = document.getElementById('draftOrderSection');
  const draftOrderRadios = document.getElementsByName('draftOrder');
  const draftCapacityEl = document.getElementById('draftCapacity');
  const setCapacityBtn = document.getElementById('setCapacityBtn');
  const capacitySelect = document.getElementById('capacitySelect');
  const applyCapacityBtn = document.getElementById('applyCapacityBtn');
  const capacityControls = document.getElementById('capacityControls');
  const rosterControls = document.getElementById('rosterControls');
  const rosterSummary = document.getElementById('rosterSummary');
  const applyRosterBtn = document.getElementById('applyRosterBtn');
  const roundTimerMinutesInput = document.getElementById('roundTimerMinutes');
  const ajDraftModeInput = document.getElementById('ajDraftMode');
  const waiverModeInput = document.getElementById('waiverMode');
  const customBudgetControls = document.getElementById('customBudgetControls');
  const toggleBudgetPanelBtn = document.getElementById('toggleBudgetPanelBtn');
  const customBudgetPanel = document.getElementById('customBudgetPanel');
  const customBudgetList = document.getElementById('customBudgetList');
  const applyCustomBudgetsBtn = document.getElementById('applyCustomBudgetsBtn');
  const resetCustomBudgetsBtn = document.getElementById('resetCustomBudgetsBtn');
  const rosterInputMap = {
    QB: document.getElementById('rosterQB'),
    WR: document.getElementById('rosterWR'),
    RB: document.getElementById('rosterRB'),
    TE: document.getElementById('rosterTE'),
    FLEX: document.getElementById('rosterFLEX'),
    SPFLEX: document.getElementById('rosterSPFLEX'),
    K: document.getElementById('rosterK'),
    DEF: document.getElementById('rosterDEF'),
    BN: document.getElementById('rosterBN')
  };

  function updateLobbyConnectionIndicator(state = 'connected', detailText = '') {
    const indicatorId = 'lobby-connection-indicator';
    let indicator = document.getElementById(indicatorId);
    if (!indicator) {
      indicator = document.createElement('span');
      indicator.id = indicatorId;
      indicator.style.display = 'inline-flex';
      indicator.style.alignItems = 'center';
      indicator.style.justifyContent = 'center';
      indicator.style.width = '10px';
      indicator.style.height = '10px';
      indicator.style.borderRadius = '999px';
      indicator.style.border = '1px solid rgba(255,255,255,0.45)';
      indicator.style.marginLeft = '8px';
      indicator.style.verticalAlign = 'middle';
      indicator.style.boxShadow = '0 0 0 1px rgba(0,0,0,0.12)';
      indicator.setAttribute('role', 'status');
      indicator.setAttribute('aria-live', 'polite');
      if (hostDisplay && hostDisplay.parentNode) {
        hostDisplay.appendChild(indicator);
      }
    }

    const normalized = String(state || '').trim().toLowerCase();
    let fill = '#16a34a';
    let glow = 'rgba(22,163,74,0.62)';
    let label = detailText || 'Lobby connection excellent';

    if (normalized === 'good') {
      fill = '#22c55e';
      glow = 'rgba(34,197,94,0.55)';
      label = detailText || 'Lobby connection good';
    } else if (normalized === 'weak') {
      fill = '#f59e0b';
      glow = 'rgba(245,158,11,0.58)';
      label = detailText || 'Lobby connection weak';
    } else if (normalized === 'reconnecting') {
      fill = '#f59e0b';
      glow = 'rgba(245,158,11,0.58)';
      label = detailText || 'Lobby reconnecting';
    } else if (normalized === 'disconnected') {
      fill = '#ef4444';
      glow = 'rgba(239,68,68,0.58)';
      label = detailText || 'Lobby disconnected';
    }

    indicator.style.background = fill;
    indicator.style.boxShadow = `0 0 0 1px rgba(0,0,0,0.12), 0 0 8px ${glow}`;
    indicator.setAttribute('aria-label', label);
    indicator.title = label;
  }
  const rosterStepperButtons = Array.from(document.querySelectorAll('.roster-stepper-btn'));
  const startDraftBtn = document.getElementById('startDraftBtn');
  const hostBanner = document.getElementById('hostBanner');
  const dismissBanner = document.getElementById('dismissBanner');
  let rosterAutosaveTimer = null;
  // closed overlay elements (may be present in page)
  let closedOverlay = document.getElementById('closedOverlay');
  let closedReturnBtn = document.getElementById('closedReturnBtn');

  function isRounds3UnderConstruction() {
    return Boolean(rounds3DraftTypeRadio && rounds3DraftTypeRadio.dataset && rounds3DraftTypeRadio.dataset.underConstruction === 'true');
  }

  function enforceRounds3UnderConstructionDisabled() {
    if (!isRounds3UnderConstruction()) return;
    if (rounds3DraftTypeRadio) {
      rounds3DraftTypeRadio.disabled = true;
      rounds3DraftTypeRadio.checked = false;
    }
  }

  // defensive: ensure DOM elements exist before updating
  if(draftTitle) draftTitle.textContent = `Draft Lobby`;
  if(draftCode) draftCode.textContent = 'Code: ' + code;

  // debug: log current session/local storage state to help diagnose missing members
  try{
    console.debug('[lobby] username:', sessionStorage.getItem('username'));
    console.debug('[lobby] currentDraft:', sessionStorage.getItem('currentDraft'));
    console.debug('[lobby] drafts (raw):', localStorage.getItem('drafts'));
  }catch(e){ console.warn('[lobby] storage access failed', e); }

  const LOBBY_FRIENDS_API_BASE = `${window.location.origin}/api/auth/friends`;
  let cachedLobbyFriends = [];

  function lobbyFriendsApiUrl(path = '', params) {
    const base = `${LOBBY_FRIENDS_API_BASE}${path}`;
    if (!params) return base;
    const search = new URLSearchParams(params).toString();
    return search ? `${base}?${search}` : base;
  }

  function lobbyRequesterProfileParams(extra = {}) {
    return {
      username: user,
      email: userEmail,
      fullname: userFullname,
      phone: userPhone,
      ...extra
    };
  }

  function setRosterDisplayValue(key, value) {
    const valueEl = document.getElementById(`roster${key}Value`);
    if (valueEl) {
      valueEl.textContent = String(value);
    }
  }

  function syncRosterStepperDisplays() {
    Object.entries(rosterInputMap).forEach(([key, input]) => {
      if (!input) return;
      setRosterDisplayValue(key, input.value);
    });
  }

  function adjustRosterValue(key, stepDir) {
    const input = rosterInputMap[key];
    if (!input) return;
    const min = Number.parseInt(input.dataset.min, 10);
    const max = Number.parseInt(input.dataset.max, 10);
    const current = Number.parseInt(input.value, 10);
    const safeCurrent = Number.isFinite(current) ? current : 0;
    const safeMin = Number.isFinite(min) ? min : 0;
    const safeMax = Number.isFinite(max) ? max : safeCurrent;
    const next = Math.max(safeMin, Math.min(safeMax, safeCurrent + stepDir));
    if (next === safeCurrent) return;
    input.value = String(next);
    setRosterDisplayValue(key, next);
    queueRosterAutosave();
  }

  function lobbyEscapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  async function parseLobbyJsonResponse(response, fallbackMessage) {
    const contentType = String(response.headers.get('content-type') || '').toLowerCase();
    const rawText = await response.text();
    let payload = null;

    if (contentType.includes('application/json')) {
      try {
        payload = rawText ? JSON.parse(rawText) : null;
      } catch (_error) {
        payload = null;
      }
    }

    if (!payload && rawText && rawText.trim().startsWith('{')) {
      try {
        payload = JSON.parse(rawText);
      } catch (_error) {
        payload = null;
      }
    }

    if (!response.ok || !payload || payload.ok === false) {
      const message = (payload && payload.error) || fallbackMessage || 'Request failed';
      const error = new Error(message);
      error.status = response.status;
      throw error;
    }

    return payload;
  }

  function ensureShareFriendsModal() {
    let modal = document.getElementById('lobbyShareFriendsModal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'lobbyShareFriendsModal';
    modal.className = 'lobby-share-modal hidden';
    modal.innerHTML = `
      <div class="lobby-share-modal-card" role="dialog" aria-modal="true" aria-labelledby="lobbyShareFriendsTitle">
        <h3 id="lobbyShareFriendsTitle">Share Lobby Code With Friends</h3>
        <p class="lobby-share-modal-copy">Code <strong>${lobbyEscapeHtml(code)}</strong> copied. Select friends to send it to.</p>
        <label class="lobby-share-select-all">
          <input id="lobbyShareSelectAll" type="checkbox">
          <span>Select all friends</span>
        </label>
        <div id="lobbyShareFriendsList" class="lobby-share-friends-list"></div>
        <p id="lobbyShareStatus" class="lobby-share-status"></p>
        <div class="lobby-share-actions">
          <button id="lobbyShareSendBtn" type="button" class="btn btn-signup">Share With Selected</button>
          <button id="lobbyShareCancelBtn" type="button" class="btn">Cancel</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const cancelBtn = document.getElementById('lobbyShareCancelBtn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        modal.classList.add('hidden');
      });
    }

    modal.addEventListener('click', (event) => {
      if (event.target === modal) {
        modal.classList.add('hidden');
      }
    });

    return modal;
  }

  function setLobbyShareStatus(message, isError = false) {
    const statusEl = document.getElementById('lobbyShareStatus');
    if (!statusEl) return;
    statusEl.textContent = String(message || '');
    statusEl.classList.toggle('is-error', !!isError);
  }

  function renderLobbyShareFriends(friends) {
    const listEl = document.getElementById('lobbyShareFriendsList');
    const selectAllEl = document.getElementById('lobbyShareSelectAll');
    const sendBtn = document.getElementById('lobbyShareSendBtn');
    if (!listEl) return;

    const normalized = Array.isArray(friends) ? friends : [];
    cachedLobbyFriends = normalized.map((entry) => ({
      username: String(entry && (entry.usernameKey || entry.username) || '').trim(),
      fullname: String(entry && entry.fullname || '').trim()
    })).filter((entry) => Boolean(entry.username));

    if (!cachedLobbyFriends.length) {
      listEl.innerHTML = '<p class="lobby-share-empty">No friends found yet. Add friends first, then share your lobby code.</p>';
      if (selectAllEl) {
        selectAllEl.checked = false;
        selectAllEl.disabled = true;
      }
      if (sendBtn) sendBtn.disabled = true;
      return;
    }

    listEl.innerHTML = cachedLobbyFriends.map((friend) => {
      const handle = lobbyEscapeHtml(friend.username);
      const label = lobbyEscapeHtml(friend.fullname || friend.username);
      return `
        <label class="lobby-share-friend-row">
          <input type="checkbox" class="lobby-share-friend-checkbox" value="${handle}">
          <span>${label} <small>@${handle}</small></span>
        </label>
      `;
    }).join('');

    if (selectAllEl) {
      selectAllEl.disabled = false;
      selectAllEl.checked = false;
      selectAllEl.onchange = () => {
        const checked = Boolean(selectAllEl.checked);
        listEl.querySelectorAll('.lobby-share-friend-checkbox').forEach((checkbox) => {
          checkbox.checked = checked;
        });
        if (sendBtn) sendBtn.disabled = !checked;
      };
    }

    if (sendBtn) sendBtn.disabled = true;

    listEl.querySelectorAll('.lobby-share-friend-checkbox').forEach((checkbox) => {
      checkbox.addEventListener('change', () => {
        if (!selectAllEl) return;
        const boxes = Array.from(listEl.querySelectorAll('.lobby-share-friend-checkbox'));
        const allChecked = boxes.length > 0 && boxes.every((item) => item.checked);
        selectAllEl.checked = allChecked;
        if (sendBtn) sendBtn.disabled = !boxes.some((item) => item.checked);
      });
    });
  }

  async function loadLobbyFriendsForSharing() {
    const response = await fetch(
      lobbyFriendsApiUrl('', lobbyRequesterProfileParams()),
      { cache: 'no-store' }
    );
    const payload = await parseLobbyJsonResponse(response, 'Unable to load friends list.');
    renderLobbyShareFriends(payload.friends || []);
    return payload;
  }

  async function openShareFriendsModal() {
    const modal = ensureShareFriendsModal();
    modal.classList.remove('hidden');
    setLobbyShareStatus('Loading friends...');
    try {
      await loadLobbyFriendsForSharing();
      if (cachedLobbyFriends.length > 0) {
        setLobbyShareStatus('Select friends and click Share With Selected.');
      } else {
        setLobbyShareStatus('Add friends to unlock sharing from this modal.');
      }
    } catch (error) {
      renderLobbyShareFriends([]);
      setLobbyShareStatus(error.message || 'Unable to load friends list.', true);
    }

    const sendBtn = document.getElementById('lobbyShareSendBtn');
    if (!sendBtn) return;

    sendBtn.onclick = async () => {
      const listEl = document.getElementById('lobbyShareFriendsList');
      if (!listEl) return;
      const selected = Array.from(listEl.querySelectorAll('.lobby-share-friend-checkbox:checked'))
        .map((item) => String(item.value || '').trim())
        .filter(Boolean);

      if (!selected.length) {
        setLobbyShareStatus('Select at least one friend first.', true);
        return;
      }

      sendBtn.disabled = true;
      const originalText = sendBtn.textContent;
      sendBtn.textContent = 'Sharing...';

      const inviteMessage = `Join my Hush lobby. Code: ${code}`;
      const failed = [];
      let sentCount = 0;

      for (const friendUsername of selected) {
        try {
          const response = await fetch(lobbyFriendsApiUrl('/messages/send'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(lobbyRequesterProfileParams({
              friendUsername,
              text: inviteMessage
            }))
          });
          await parseLobbyJsonResponse(response, `Unable to share with @${friendUsername}.`);
          sentCount += 1;
        } catch (_error) {
          failed.push(friendUsername);
        }
      }

      sendBtn.disabled = false;
      sendBtn.textContent = originalText;

      if (sentCount > 0 && failed.length === 0) {
        setLobbyShareStatus(`Shared lobby code with ${sentCount} friend${sentCount === 1 ? '' : 's'}.`);
      } else if (sentCount > 0) {
        setLobbyShareStatus(`Shared with ${sentCount}. Failed: ${failed.map((name) => `@${name}`).join(', ')}`, true);
      } else {
        setLobbyShareStatus('Could not share with selected friends right now.', true);
      }
    };
  }

  function resolveDraftHost(draft) {
    if (!draft || typeof draft !== 'object') return null;
    if (draft.host) return draft.host;
    if (Array.isArray(draft.members) && draft.members.length > 0) return draft.members[0];
    return null;
  }

  function isCurrentUserHost(draft) {
    const host = resolveDraftHost(draft);
    return Boolean(host && host === user);
  }

  function refreshMembers(){
    const draftsRaw = localStorage.getItem('drafts');
    const drafts = draftsRaw ? JSON.parse(draftsRaw) : {};
    const members = (drafts[code] && drafts[code].members) ? drafts[code].members : [];
    const isClosed = Boolean(drafts[code] && drafts[code].closed);
    const host = resolveDraftHost(drafts[code]);
    const isHost = isCurrentUserHost(drafts[code]);

    if (hostDisplay) {
      hostDisplay.textContent = host ? `Host: ${host}` : 'Host: --';
    }

    if (drafts[code] && host && drafts[code].host !== host) {
      drafts[code].host = host;
      localStorage.setItem('drafts', JSON.stringify(drafts));
    }

    console.log('[lobby] Host resolved from server/state:', host);

    memberList.innerHTML = '';
    
    // Get draft order assignments if they exist
    const draftOrderAssignments = (drafts[code] && drafts[code].draftOrderAssignments) ? drafts[code].draftOrderAssignments : {};
    
    members.forEach(m=>{
      const li = document.createElement('li');
      const labels = [];
      if(m === user) labels.push('you');
      if(m === host) labels.push('HOST');
      
      // Show draft order number if rounds3 and random order
      const dtype = drafts[code] && drafts[code].type;
      const draftOrder = drafts[code] && drafts[code].draftOrder;
      let orderNum = '';
      if (dtype === 'rounds3' && draftOrder === 'random' && draftOrderAssignments[m]) {
        orderNum = ` [#${draftOrderAssignments[m]}]`;
      }
      
      li.textContent = m + orderNum + (labels.length ? ' (' + labels.join(', ') + ')' : '');
      memberList.appendChild(li);
    });
    // show draft type
    // Auto-set draft type to silent if not set
    if (!drafts[code]) drafts[code] = {};
    if (!drafts[code].type) {
      drafts[code].type = 'silent';
      localStorage.setItem('drafts', JSON.stringify(drafts));
      try { if (socket) { socket.emit('updateDraft', code, drafts[code]); } } catch (e) {}
    }
    if (typeof drafts[code].ajDraftMode !== 'boolean') {
      drafts[code].ajDraftMode = DEFAULT_AJ_DRAFT_MODE;
      if (drafts[code].ajDraftMode && (!Array.isArray(drafts[code].ajRoundOrder) || drafts[code].ajRoundOrder.length !== 10)) {
        drafts[code].ajRoundOrder = buildAjRoundOrder();
      }
      localStorage.setItem('drafts', JSON.stringify(drafts));
      try { if (socket) { socket.emit('updateDraft', code, drafts[code]); } } catch (e) {}
    }
    let dtype = drafts[code].type || 'silent';
    if (dtype === 'rounds3' && isRounds3UnderConstruction()) {
      dtype = 'silent';
      drafts[code].type = 'silent';
      localStorage.setItem('drafts', JSON.stringify(drafts));
      try { if (socket) { socket.emit('updateDraft', code, drafts[code]); } } catch (_error) {}
    }
    // Set the radio button based on current type
    draftTypeRadios.forEach(radio => {
      if (radio.value === dtype) radio.checked = true;
    });
    enforceRounds3UnderConstructionDisabled();
    // Show/hide draft order section based on draft type
    if (draftOrderSection) {
      draftOrderSection.style.display = dtype === 'rounds3' ? 'flex' : 'none';
    }
    // Set draft order radio if rounds3 is selected
    if (dtype === 'rounds3') {
      const draftOrder = drafts[code].draftOrder || 'manual';
      draftOrderRadios.forEach(radio => {
        if (radio.value === draftOrder) radio.checked = true;
      });
    }
    // show capacity
    const cap = (drafts[code] && drafts[code].capacity) ? drafts[code].capacity : 10;
    if (memberCountBadge) {
      memberCountBadge.textContent = `Users in Lobby: ${members.length}`;
    }
    draftCapacityEl.textContent = cap;
    const rosterSettings = normalizeRosterSettings(drafts[code].rosterSettings);
    const benchCutTarget = normalizeBenchCutTarget(drafts[code].benchCutTarget, DEFAULT_BENCH_CUT_TARGET);
    const roundTimerMinutes = normalizeRoundTimerMinutes(drafts[code].roundTimerMinutes, DEFAULT_ROUND_TIMER_MINUTES);
    const ajDraftMode = typeof drafts[code].ajDraftMode === 'boolean'
      ? drafts[code].ajDraftMode
      : DEFAULT_AJ_DRAFT_MODE;
    const waiverMode = normalizeWaiverMode(drafts[code].waiverMode, 'off');
    const hadSameRoster = JSON.stringify(drafts[code].rosterSettings || {}) === JSON.stringify(rosterSettings);
    if (!hadSameRoster) {
      drafts[code].rosterSettings = rosterSettings;
      localStorage.setItem('drafts', JSON.stringify(drafts));
      try { if (socket) { socket.emit('updateDraft', code, drafts[code]); } } catch (e) {}
    }
    if (drafts[code].benchCutTarget !== benchCutTarget) {
      drafts[code].benchCutTarget = benchCutTarget;
      localStorage.setItem('drafts', JSON.stringify(drafts));
      try { if (socket) { socket.emit('updateDraft', code, drafts[code]); } } catch (e) {}
    }
    if (drafts[code].roundTimerMinutes !== roundTimerMinutes) {
      drafts[code].roundTimerMinutes = roundTimerMinutes;
      localStorage.setItem('drafts', JSON.stringify(drafts));
      try { if (socket) { socket.emit('updateDraft', code, drafts[code]); } } catch (e) {}
    }
    if (Boolean(drafts[code].ajDraftMode) !== ajDraftMode) {
      drafts[code].ajDraftMode = ajDraftMode;
      localStorage.setItem('drafts', JSON.stringify(drafts));
      try { if (socket) { socket.emit('updateDraft', code, drafts[code]); } } catch (e) {}
    }
    if (!isValidWaiverMode(drafts[code].waiverMode) || String(drafts[code].waiverMode).trim().toLowerCase() !== waiverMode) {
      drafts[code].waiverMode = waiverMode;
      localStorage.setItem('drafts', JSON.stringify(drafts));
      try { if (socket) { socket.emit('updateDraft', code, drafts[code]); } } catch (e) {}
    }
    Object.entries(rosterInputMap).forEach(([key, input]) => {
      if (!input) return;
      input.value = String(rosterSettings[key]);
      setRosterDisplayValue(key, rosterSettings[key]);
    });
    if (roundTimerMinutesInput) {
      roundTimerMinutesInput.value = String(roundTimerMinutes);
    }
    if (ajDraftModeInput) {
      ajDraftModeInput.checked = ajDraftMode;
    }
    if (waiverModeInput) {
      waiverModeInput.value = waiverMode;
    }

    const normalizedCustomBudgets = normalizeCustomBudgets(drafts[code].customBudgets, members);
    const hadSameBudgets = JSON.stringify(drafts[code].customBudgets || {}) === JSON.stringify(normalizedCustomBudgets);
    if (!hadSameBudgets) {
      drafts[code].customBudgets = normalizedCustomBudgets;
      localStorage.setItem('drafts', JSON.stringify(drafts));
      try { if (socket) { socket.emit('updateDraft', code, drafts[code]); } } catch (e) {}
    }
    renderCustomBudgetInputs(members, normalizedCustomBudgets, isHost && !isClosed);
    if (rosterSummary) {
      rosterSummary.textContent = rosterSettingsSummary(rosterSettings);
    }
    // reflect current capacity in the select control for host
    try{ if(capacitySelect){ capacitySelect.value = String(cap); } }catch(e){}
    // if draft is closed by server (host left), show closed overlay and disable controls
    if (isClosed) {
      console.log('[lobby] Draft is closed, showing overlay');
      // show overlay (create it if necessary)
      if (!closedOverlay) {
        closedOverlay = document.createElement('div');
        closedOverlay.id = 'closedOverlay';
        closedOverlay.style.position = 'fixed';
        closedOverlay.style.left = '0';
        closedOverlay.style.top = '0';
        closedOverlay.style.right = '0';
        closedOverlay.style.bottom = '0';
        closedOverlay.style.background = 'rgba(0,0,0,0.6)';
        closedOverlay.style.display = 'flex';
        closedOverlay.style.alignItems = 'center';
        closedOverlay.style.justifyContent = 'center';
        closedOverlay.style.zIndex = '9999';
        closedOverlay.innerHTML = `
          <div style="background:#fff;padding:30px;border-radius:12px;text-align:center;max-width:400px;box-shadow:0 10px 30px rgba(0,0,0,0.3);border:1px solid #ddd;">
            <h2 style="margin:0 0 15px 0;color:#333;font-size:24px;">Session Closed</h2>
            <p style="margin:0 0 25px 0;color:#666;font-size:16px;line-height:1.5;">The host has left and the draft is no longer accepting participants.</p>
            <button id="closedReturnBtn" style="background:#007bff;color:#fff;border:none;padding:12px 24px;border-radius:6px;font-size:16px;cursor:pointer;transition:background 0.3s;">Return to Dashboard</button>
          </div>
        `;
        document.body.appendChild(closedOverlay);
        closedReturnBtn = document.getElementById('closedReturnBtn');
        if (closedReturnBtn) {
          closedReturnBtn.addEventListener('click', () => {
            sessionStorage.removeItem('currentDraft');
            clearInterval(poll);
            window.location.href = 'dashboard.html';
          });
        }
      } else {
        closedOverlay.style.display = 'flex';
      }

      // keep leave action available even when closed
      if (leaveBtn) leaveBtn.disabled = false;

      // show a one-time alert to the user in addition to the overlay
      try {
        const alertedKey = `closed_alerted_${code}`;
        if (!sessionStorage.getItem(alertedKey)) {
          // alert is synchronous and will be shown once per session per draft
          alert('The lobby was closed by the host.');
          sessionStorage.setItem(alertedKey, '1');
        }
      } catch (e) {
        // ignore storage errors
      }
    } else {
      if (closedOverlay) closedOverlay.style.display = 'none';
    }
    // notify host when full (show banner once until dismissed)
    const full = cap && members.length >= cap;
    const notifiedKey = `notified_full_${code}`;
    const alreadyNotified = sessionStorage.getItem(notifiedKey);
    if(isHost && full && !alreadyNotified){ if(hostBanner){ hostBanner.style.display = 'block'; } sessionStorage.setItem(notifiedKey, '1'); }
    if(!full){ if(hostBanner){ hostBanner.style.display = 'none'; } sessionStorage.removeItem(notifiedKey); }
    updateDraftTypeControlsState();
    updateCapacityControls();
    updateRosterControlsState();
    updateCustomBudgetControlsState();
    updateStartDraftControlState();
  }

  function renderCustomBudgetInputs(members, budgets, editable) {
    if (!customBudgetList) return;
    customBudgetList.innerHTML = '';
    (members || []).forEach((member) => {
      const row = document.createElement('div');
      row.className = 'custom-budget-row';
      const label = document.createElement('label');
      label.textContent = member;
      const input = document.createElement('input');
      input.type = 'number';
      input.min = '0';
      input.max = '9999';
      input.step = '1';
      input.value = String((budgets && typeof budgets[member] !== 'undefined') ? budgets[member] : DEFAULT_START_BUDGET);
      input.dataset.member = member;
      input.disabled = !editable;
      row.appendChild(label);
      row.appendChild(input);
      customBudgetList.appendChild(row);
    });
  }

  // Countdown banner function - define before use
  function showCountdownBanner(draftType) {
    // Prevent multiple countdowns
    if (document.getElementById('countdownOverlay')) {
      console.log('[lobby] Countdown already showing');
      return;
    }
    
    console.log('[lobby] Starting countdown...');

    let countdownAudioContext = null;
    let countdownAudioKeepAlive = null;

    function getCountdownAudioContext() {
      try {
        if (!countdownAudioContext) {
          const Ctx = window.AudioContext || window.webkitAudioContext;
          if (!Ctx) return null;
          countdownAudioContext = new Ctx();
        }
        return countdownAudioContext;
      } catch (_error) {
        return null;
      }
    }

    function startCountdownAudioKeepAlive() {
      const ctx = getCountdownAudioContext();
      if (!ctx || countdownAudioKeepAlive) return;

      try {
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        oscillator.frequency.value = 30;
        oscillator.type = 'sine';
        gainNode.gain.value = 0.00001;
        oscillator.start();
        countdownAudioKeepAlive = oscillator;
      } catch (_error) {
        countdownAudioKeepAlive = null;
      }
    }

    function stopCountdownAudioKeepAlive() {
      try {
        if (countdownAudioKeepAlive) {
          countdownAudioKeepAlive.stop();
        }
      } catch (_error) {
        // ignore keep-alive stop errors
      } finally {
        countdownAudioKeepAlive = null;
      }
    }
    
    // Create countdown overlay
    const overlay = document.createElement('div');
    overlay.id = 'countdownOverlay';
    overlay.style.position = 'fixed';
    overlay.style.left = '0';
    overlay.style.top = '0';
    overlay.style.right = '0';
    overlay.style.bottom = '0';
    overlay.style.background = 'rgba(0,0,0,0.85)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.zIndex = '10000';
    overlay.innerHTML = `
      <div style="background:linear-gradient(135deg, #667eea 0%, #764ba2 100%);padding:40px;border-radius:16px;text-align:center;max-width:90%;box-shadow:0 10px 40px rgba(0,0,0,0.5);">
        <h1 style="color:#fff;font-size:2.5em;margin:0 0 20px 0;">Draft Starting!</h1>
        <div style="color:#fff;font-size:5em;font-weight:bold;margin:20px 0;transition:transform 0.15s ease;" id="countdownNumber">10</div>
        <p style="color:#f0f0f0;font-size:1.2em;margin:0;">Get ready...</p>
      </div>
    `;
    document.body.appendChild(overlay);
    
    const countdownNumberEl = document.getElementById('countdownNumber');
    let timeLeft = 10;
    
    // Function to play beep sound
    function playBeep(frequency = 800, duration = 150) {
      try {
        const audioContext = getCountdownAudioContext();
        if (!audioContext) return;

        const scheduleTone = () => {
          if (audioContext.state !== 'running') return;

          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();

          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);

          oscillator.frequency.value = frequency;
          oscillator.type = 'sine';

          gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration / 1000);

          oscillator.start(audioContext.currentTime);
          oscillator.stop(audioContext.currentTime + duration / 1000);
        };

        if (audioContext.state === 'suspended') {
          audioContext.resume().then(() => {
            startCountdownAudioKeepAlive();
            scheduleTone();
          }).catch(() => {});
          return;
        }

        startCountdownAudioKeepAlive();
        scheduleTone();
      } catch (e) {
        console.log('[lobby] Audio not supported:', e);
      }
    }
    
    const countdownInterval = setInterval(() => {
      timeLeft--;
      console.log('[lobby] Countdown:', timeLeft);
      
      if (timeLeft > 0) {
        countdownNumberEl.textContent = timeLeft;
        // Play beep sound (higher pitch as countdown gets lower)
        playBeep(400 + (timeLeft * 40), 150);
        // Add pulse animation
        countdownNumberEl.style.transform = 'scale(1.3)';
        setTimeout(() => { 
          countdownNumberEl.style.transform = 'scale(1)'; 
        }, 150);
      } else if (timeLeft === 0) {
        clearInterval(countdownInterval);
        countdownNumberEl.textContent = 'GO!';
        countdownNumberEl.style.color = '#4ade80';
        countdownNumberEl.style.transform = 'scale(1.5)';
        // Play final "GO" sound (higher and longer)
        playBeep(1200, 300);
        console.log('[lobby] Redirecting to draft...');
        setTimeout(() => {
          stopCountdownAudioKeepAlive();
          // Redirect to appropriate draft page
          if (draftType === 'silent') {
            window.location.href = 'silentdraft.html';
          } else if (draftType === 'rounds3') {
            window.location.href = 'rounds3draft.html';
          }
        }, 800);
      }
    }, 1000);
  }

  function maybeStartDraftFromServerState(draft, sourceLabel = 'state-sync') {
    if (!draft || !draft.started) return;
    const serverType = draft.type || 'silent';
    console.log(`[lobby] ${sourceLabel}: draft already started, launching countdown for`, serverType);
    showCountdownBanner(serverType);
  }

  refreshMembers();
  // connect to Socket.IO for real-time updates (guarded)
  let socket = null;
  try{ 
    if(window.io){ 
      socket = io({
        reconnection: true,
        reconnectionAttempts: Infinity,
        randomizationFactor: 0.5,
        reconnectionDelay: 500,
        reconnectionDelayMax: 8000,
        timeout: 20000,
        upgrade: true,
        rememberUpgrade: true,
        transports: ['websocket', 'polling']
      }); 
      console.log('[lobby] Socket.IO connecting...', user);

      let lobbyHeartbeatTimer = null;
      let lobbyHeartbeatInFlight = false;
      let lobbyMissedHeartbeats = 0;

      const clearLobbyHeartbeat = () => {
        if (lobbyHeartbeatTimer) {
          clearInterval(lobbyHeartbeatTimer);
          lobbyHeartbeatTimer = null;
        }
      };

      const classifyLobbyQuality = (rttMs) => {
        if (!Number.isFinite(rttMs)) return { key: 'good', label: 'Good' };
        if (rttMs <= 220) return { key: 'connected', label: 'Excellent' };
        if (rttMs <= 700) return { key: 'good', label: 'Good' };
        return { key: 'weak', label: 'Weak' };
      };

      const sendLobbyHeartbeat = () => {
        if (!socket || !socket.connected || lobbyHeartbeatInFlight) return;
        lobbyHeartbeatInFlight = true;
        const startedAt = Date.now();
        let settled = false;

        const timeoutId = setTimeout(() => {
          if (settled) return;
          settled = true;
          lobbyHeartbeatInFlight = false;
          lobbyMissedHeartbeats += 1;
          if (lobbyMissedHeartbeats >= LOBBY_HEARTBEAT_MISS_THRESHOLD) {
            updateLobbyConnectionIndicator('reconnecting', 'Lobby connection weak - reconnecting...');
            try { socket.connect(); } catch (_e) {}
          }
        }, LOBBY_HEARTBEAT_ACK_TIMEOUT_MS);

        socket.emit('hushHeartbeat', { clientTs: startedAt }, (response) => {
          if (settled) return;
          settled = true;
          clearTimeout(timeoutId);
          lobbyHeartbeatInFlight = false;
          if (!response || response.ok === false) {
            lobbyMissedHeartbeats += 1;
            return;
          }

          lobbyMissedHeartbeats = 0;
          const rtt = Math.max(0, Date.now() - startedAt);
          const quality = classifyLobbyQuality(rtt);
          updateLobbyConnectionIndicator(quality.key, `Lobby connection ${quality.label} (${rtt}ms)`);
        });
      };

      const startLobbyHeartbeat = () => {
        clearLobbyHeartbeat();
        sendLobbyHeartbeat();
        lobbyHeartbeatTimer = setInterval(sendLobbyHeartbeat, LOBBY_HEARTBEAT_INTERVAL_MS);
      };

      const syncHostWaiverModeToServerIfMissing = (serverDraft) => {
        try {
          const draftsRaw = localStorage.getItem('drafts');
          const drafts = draftsRaw ? JSON.parse(draftsRaw) : {};
          const localDraft = drafts[code] || {};
          const isHost = isCurrentUserHost(localDraft);
          if (!isHost) return;

          const serverModeRaw = serverDraft && serverDraft.waiverMode;
          const serverHasMode = isValidWaiverMode(serverModeRaw);
          if (serverHasMode) return;

          const localMode = normalizeWaiverMode(localDraft.waiverMode, 'off');
          localDraft.waiverMode = localMode;
          drafts[code] = localDraft;
          localStorage.setItem('drafts', JSON.stringify(drafts));

          console.log(`[lobby] Server missing waiverMode for ${code}; host syncing local mode "${localMode}"`);
          socket.emit('updateDraft', code, localDraft);
        } catch (e) {
          console.warn('[lobby] Failed to sync waiverMode to server:', e);
        }
      };
      
      // Wait for connection before joining room
      socket.on('connect', () => {
        lobbyMissedHeartbeats = 0;
        updateLobbyConnectionIndicator('good', 'Lobby connected');
        startLobbyHeartbeat();
        console.log('[lobby] Socket connected for user:', user, 'joining room:', code);
        socket.emit('joinDraftRoom', code, user);
        socket.emit('getDraftState', code, (response) => {
          if (response && response.ok && response.draft) {
            const draftsRaw = localStorage.getItem('drafts');
            const drafts = draftsRaw ? JSON.parse(draftsRaw) : {};
            drafts[code] = Object.assign(drafts[code] || {}, response.draft);
            localStorage.setItem('drafts', JSON.stringify(drafts));
            console.log('[lobby] Hydrated draft state from server. Host:', resolveDraftHost(response.draft));
            syncHostWaiverModeToServerIfMissing(response.draft);
            maybeStartDraftFromServerState(response.draft, 'connect-getDraftState');
            refreshMembers();
          }
        });
      });

      socket.io.on('reconnect_attempt', () => {
        console.log('[lobby] Reconnect attempt...');
        updateLobbyConnectionIndicator('reconnecting', 'Lobby reconnecting...');
      });

      socket.io.on('reconnect', () => {
        console.log('[lobby] Reconnected, requesting fresh draft state');
        socket.emit('joinDraftRoom', code, user);
        socket.emit('getDraftState', code, (response) => {
          if (response && response.ok && response.draft) {
            const draftsRaw = localStorage.getItem('drafts');
            const drafts = draftsRaw ? JSON.parse(draftsRaw) : {};
            drafts[code] = Object.assign(drafts[code] || {}, response.draft);
            localStorage.setItem('drafts', JSON.stringify(drafts));
            maybeStartDraftFromServerState(response.draft, 'reconnect-getDraftState');
            refreshMembers();
          }
        });
      });

      socket.io.on('reconnect_error', () => {
        console.warn('[lobby] Reconnect failed, retrying...');
        updateLobbyConnectionIndicator('reconnecting', 'Reconnect failed - retrying...');
      });

      socket.on('disconnect', (reason) => {
        clearLobbyHeartbeat();
        lobbyHeartbeatInFlight = false;
        updateLobbyConnectionIndicator('reconnecting', `Lobby disconnected (${reason || 'network'}) - reconnecting...`);
      });

      socket.on('memberConnectionState', (payload) => {
        if (!payload || !payload.username) return;
        const state = String(payload.state || '').trim().toLowerCase();
        if (state === 'reconnecting') {
          console.log(`[lobby] ${payload.username} reconnecting (${Math.floor(Number(payload.graceMsRemaining || 0) / 1000)}s grace)`);
        }
      });

      socket.on('hostConnectionState', (payload) => {
        if (!payload) return;
        const state = String(payload.state || '').trim().toLowerCase();
        if (state === 'reconnecting') {
          const graceSeconds = Math.max(0, Math.floor(Number(payload.graceMsRemaining || 0) / 1000));
          console.warn(`[lobby] Host reconnecting (${graceSeconds}s grace)`);
          let localDraft = null;
          try {
            const draftsRaw = localStorage.getItem('drafts');
            const drafts = draftsRaw ? JSON.parse(draftsRaw) : {};
            localDraft = drafts && drafts[code] ? drafts[code] : null;
          } catch (_error) {
            localDraft = null;
          }
          if (!isCurrentUserHost(localDraft)) {
            updateLobbyConnectionIndicator('reconnecting', `Host reconnecting (${graceSeconds}s grace)`);
          }
          return;
        }

        if (state === 'connected') {
          console.log('[lobby] Host reconnected');
          updateLobbyConnectionIndicator('good', 'Lobby connected');
        }
      });
      
      socket.on('draftUpdate', (serverDraft) => { 
        console.log('[lobby] Received draftUpdate', serverDraft);
        const draftsRaw = localStorage.getItem('drafts'); 
        const drafts = draftsRaw ? JSON.parse(draftsRaw) : {}; 
        drafts[code] = Object.assign(drafts[code] || {}, serverDraft); 
        localStorage.setItem('drafts', JSON.stringify(drafts)); 
        maybeStartDraftFromServerState(drafts[code], 'draftUpdate');
        refreshMembers(); 
      }); 
      
      socket.on('draftStarted', (draftType) => { 
        console.log(`[lobby] Draft started event received! Type: ${draftType}, User: ${user}`); 
        showCountdownBanner(draftType); 
      });

      socket.on('draftClosed', (payload) => {
        console.log('[lobby] draftClosed event received', payload);
        const draftsRaw = localStorage.getItem('drafts');
        const drafts = draftsRaw ? JSON.parse(draftsRaw) : {};
        drafts[code] = Object.assign(drafts[code] || {}, {
          closed: true,
          host: null
        });
        localStorage.setItem('drafts', JSON.stringify(drafts));
        refreshMembers();

        const popupKey = `closed_alerted_${code}`;
        if (!sessionStorage.getItem(popupKey)) {
          alert('The lobby was closed by the host.');
          sessionStorage.setItem(popupKey, '1');
        }
      });

      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'visible') return;
        if (socket && !socket.connected) {
          try { socket.connect(); } catch (_error) {}
          return;
        }
        if (socket && socket.connected) {
          socket.emit('getDraftState', code, (response) => {
            if (response && response.ok && response.draft) {
              maybeStartDraftFromServerState(response.draft, 'visibility-getDraftState');
            }
          });
        }
      });
    } 
  }catch(e){ 
    console.warn('Socket.IO not available or failed to initialize', e); 
    socket = null; 
  }

  // simple fallback polling in case socket disconnects or is absent
  const poll = setInterval(() => { if (!socket || !socket.connected) refreshMembers(); }, 3000);

  // Handle draft type radio button changes
  draftTypeRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      if (radio.value === 'rounds3' && isRounds3UnderConstruction()) {
        alert('3 rounds auction is under construction right now.');
        const silentRadio = Array.from(draftTypeRadios).find((entry) => entry.value === 'silent');
        if (silentRadio) silentRadio.checked = true;
        if (draftOrderSection) draftOrderSection.style.display = 'none';
        enforceRounds3UnderConstructionDisabled();
        return;
      }

      const draftsRaw = localStorage.getItem('drafts');
      const drafts = draftsRaw ? JSON.parse(draftsRaw) : {};
      const isHost = isCurrentUserHost(drafts[code]);
      
      if (!isHost) {
        alert('Only the host can change the draft type');
        refreshMembers(); // Reset to saved value
        return;
      }
      
      drafts[code] = drafts[code] || { members: [] };
      drafts[code].type = radio.value;
      localStorage.setItem('drafts', JSON.stringify(drafts));
      try { if (socket) { socket.emit('updateDraft', code, drafts[code]); } } catch (e) { console.warn('updateDraft emit failed', e); }
      refreshMembers();
      
      // Show/hide draft order section based on draft type
      if (draftOrderSection) {
        draftOrderSection.style.display = (radio.value === 'rounds3') ? 'block' : 'none';
      }
    });
  });

  // Handle draft order radio button changes
  draftOrderRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      const draftsRaw = localStorage.getItem('drafts');
      const drafts = draftsRaw ? JSON.parse(draftsRaw) : {};
      const members = (drafts[code] && drafts[code].members) ? drafts[code].members : [];
      const isHost = isCurrentUserHost(drafts[code]);
      
      if (!isHost) {
        alert('Only the host can change the draft order');
        refreshMembers(); // Reset to saved value
        return;
      }
      
      drafts[code] = drafts[code] || { members: [] };
      drafts[code].draftOrder = radio.value;
      
      // If random order is selected, generate random draft order numbers
      if (radio.value === 'random') {
        const capacity = drafts[code].capacity || 10;
        
        // Generate array of numbers from 1 to capacity
        const numbers = Array.from({length: capacity}, (_, i) => i + 1);
        
        // Shuffle using Fisher-Yates algorithm
        for (let i = numbers.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
        }
        
        // Assign first N numbers to members
        const assignments = {};
        members.forEach((member, index) => {
          assignments[member] = numbers[index];
        });
        
        drafts[code].draftOrderAssignments = assignments;
      } else {
        // Clear assignments if switching to manual
        delete drafts[code].draftOrderAssignments;
      }
      
      localStorage.setItem('drafts', JSON.stringify(drafts));
      try { if (socket) { socket.emit('updateDraft', code, drafts[code]); } } catch (e) { console.warn('updateDraft emit failed', e); }
      refreshMembers();
    });
  });

  // set capacity (host only)
  if(setCapacityBtn){ /* no-op placeholder reserved for legacy button */ }
  function updateDraftTypeControlsState(){
    const draftsRaw = localStorage.getItem('drafts');
    const drafts = draftsRaw ? JSON.parse(draftsRaw) : {};
    const isHost = isCurrentUserHost(drafts[code]);
    const isClosed = Boolean(drafts[code] && drafts[code].closed);
    const disableControls = !isHost || isClosed;
    draftTypeRadios.forEach((radio) => {
      const isUnderConstructionType = radio.value === 'rounds3' && isRounds3UnderConstruction();
      radio.disabled = disableControls || isUnderConstructionType;
      if (isUnderConstructionType) {
        radio.checked = false;
      }
    });
    draftOrderRadios.forEach((radio) => {
      radio.disabled = disableControls;
    });
    enforceRounds3UnderConstructionDisabled();
  }

  // show/hide capacity controls depending on host
  function updateCapacityControls(){
    const draftsRaw = localStorage.getItem('drafts');
    const drafts = draftsRaw ? JSON.parse(draftsRaw) : {};
    const isHost = isCurrentUserHost(drafts[code]);
    const isClosed = Boolean(drafts[code] && drafts[code].closed);
    const disableControls = !isHost || isClosed;
    if(capacityControls){ capacityControls.classList.toggle('hidden', !isHost); }
    if (capacitySelect) capacitySelect.disabled = disableControls;
    if (applyCapacityBtn) applyCapacityBtn.disabled = disableControls;
  }

  function updateRosterControlsState(){
    const draftsRaw = localStorage.getItem('drafts');
    const drafts = draftsRaw ? JSON.parse(draftsRaw) : {};
    const isHost = isCurrentUserHost(drafts[code]);
    const isClosed = Boolean(drafts[code] && drafts[code].closed);
    const disableControls = !isHost || isClosed;
    if (applyRosterBtn) applyRosterBtn.disabled = disableControls;
    Object.values(rosterInputMap).forEach(input => { if (input) input.disabled = disableControls; });
    rosterStepperButtons.forEach((button) => { button.disabled = disableControls; });
    if (roundTimerMinutesInput) roundTimerMinutesInput.disabled = disableControls;
    if (ajDraftModeInput) ajDraftModeInput.disabled = disableControls;
    if (waiverModeInput) waiverModeInput.disabled = disableControls;
    if (rosterControls) {
      rosterControls.classList.toggle('host-readonly', disableControls);
    }
  }

  function updateCustomBudgetControlsState(){
    const draftsRaw = localStorage.getItem('drafts');
    const drafts = draftsRaw ? JSON.parse(draftsRaw) : {};
    const members = (drafts[code] && drafts[code].members) ? drafts[code].members : [];
    const cap = (drafts[code] && drafts[code].capacity) ? Number(drafts[code].capacity) : 10;
    const isFull = members.length >= cap;
    const isHost = isCurrentUserHost(drafts[code]);
    const isClosed = Boolean(drafts[code] && drafts[code].closed);
    const disableControls = !isHost || isClosed || !isFull;
    if (customBudgetControls) customBudgetControls.classList.toggle('host-readonly', disableControls);
    if (toggleBudgetPanelBtn) toggleBudgetPanelBtn.disabled = disableControls;
    if (applyCustomBudgetsBtn) applyCustomBudgetsBtn.disabled = disableControls;
    if (resetCustomBudgetsBtn) resetCustomBudgetsBtn.disabled = disableControls;
    if (toggleBudgetPanelBtn) {
      toggleBudgetPanelBtn.title = isFull ? '' : 'Custom budgets unlock when lobby is full';
    }
    if (customBudgetPanel && disableControls) {
      customBudgetPanel.classList.add('hidden');
    }
    if (customBudgetList) {
      customBudgetList.querySelectorAll('input').forEach((input) => {
        input.disabled = disableControls;
      });
    }
  }

  function updateStartDraftControlState(){
    if (!startDraftBtn) return;
    const draftsRaw = localStorage.getItem('drafts');
    const drafts = draftsRaw ? JSON.parse(draftsRaw) : {};
    const isHost = isCurrentUserHost(drafts[code]);
    const isClosed = Boolean(drafts[code] && drafts[code].closed);
    const hideStart = !isHost || isClosed;
    startDraftBtn.classList.toggle('hidden', hideStart);
    startDraftBtn.disabled = hideStart;
  }

  if (applyCapacityBtn) {
    applyCapacityBtn.addEventListener('click', () => {
      const draftsRaw = localStorage.getItem('drafts');
      const drafts = draftsRaw ? JSON.parse(draftsRaw) : {};
      const isHost = isCurrentUserHost(drafts[code]);
      if (!isHost) { alert('Only the host can set capacity'); return; }
      const val = capacitySelect.value;
      drafts[code].capacity = parseInt(val) || 10;
      localStorage.setItem('drafts', JSON.stringify(drafts));
      try { if (socket) { socket.emit('updateDraft', code, drafts[code]); } } catch (e) { console.warn('updateDraft emit failed', e); }
      refreshMembers();
      updateCapacityControls();
    });
  }

  function saveRosterChanges(options = {}) {
    const draftsRaw = localStorage.getItem('drafts');
    const drafts = draftsRaw ? JSON.parse(draftsRaw) : {};
    const members = (drafts[code] && drafts[code].members) ? drafts[code].members : [];
    const isHost = isCurrentUserHost(drafts[code]);
    if (!isHost) {
      if (options.showAlert !== false) alert('Only the host can change roster settings');
      return false;
    }

    drafts[code] = drafts[code] || { members: [] };
    drafts[code].rosterSettings = normalizeRosterSettings({
      QB: rosterInputMap.QB ? rosterInputMap.QB.value : undefined,
      WR: rosterInputMap.WR ? rosterInputMap.WR.value : undefined,
      RB: rosterInputMap.RB ? rosterInputMap.RB.value : undefined,
      TE: rosterInputMap.TE ? rosterInputMap.TE.value : undefined,
      FLEX: rosterInputMap.FLEX ? rosterInputMap.FLEX.value : undefined,
      SPFLEX: rosterInputMap.SPFLEX ? rosterInputMap.SPFLEX.value : undefined,
      K: rosterInputMap.K ? rosterInputMap.K.value : undefined,
      DEF: rosterInputMap.DEF ? rosterInputMap.DEF.value : undefined,
      BN: rosterInputMap.BN ? rosterInputMap.BN.value : DEFAULT_DRAFT_BENCH
    });
    drafts[code].benchCutTarget = normalizeBenchCutTarget(
      DEFAULT_BENCH_CUT_TARGET,
      DEFAULT_BENCH_CUT_TARGET
    );
    drafts[code].roundTimerMinutes = normalizeRoundTimerMinutes(
      roundTimerMinutesInput ? roundTimerMinutesInput.value : undefined,
      DEFAULT_ROUND_TIMER_MINUTES
    );
    drafts[code].ajDraftMode = Boolean(ajDraftModeInput && ajDraftModeInput.checked);
    drafts[code].waiverMode = normalizeWaiverMode(waiverModeInput ? waiverModeInput.value : undefined, 'off');
    drafts[code].ajRoundOrder = drafts[code].ajDraftMode
      ? (Array.isArray(drafts[code].ajRoundOrder) && drafts[code].ajRoundOrder.length === 10 ? drafts[code].ajRoundOrder : buildAjRoundOrder())
      : undefined;
    if (!drafts[code].ajDraftMode) {
      delete drafts[code].ajRoundOrder;
    }
    localStorage.setItem('drafts', JSON.stringify(drafts));
    try { if (socket) { socket.emit('updateDraft', code, drafts[code]); } } catch (e) { console.warn('updateDraft emit failed', e); }
    refreshMembers();
    updateRosterControlsState();

    if (applyRosterBtn) {
      const defaultLabel = 'Save Changes';
      const nextLabel = options.auto ? 'Saved' : 'Saved!';
      applyRosterBtn.textContent = nextLabel;
      applyRosterBtn.style.background = '#22c55e';
      applyRosterBtn.style.color = '#fff';
      applyRosterBtn.style.transition = 'background 0.4s, color 0.4s';
      setTimeout(() => {
        applyRosterBtn.textContent = defaultLabel;
        applyRosterBtn.style.background = '';
        applyRosterBtn.style.color = '';
      }, options.auto ? 900 : 1500);
    }

    return true;
  }

  function queueRosterAutosave() {
    if (rosterAutosaveTimer) {
      clearTimeout(rosterAutosaveTimer);
    }
    rosterAutosaveTimer = setTimeout(() => {
      rosterAutosaveTimer = null;
      saveRosterChanges({ auto: true, showAlert: false });
    }, 500);
  }

  if (applyRosterBtn) {
    applyRosterBtn.addEventListener('click', () => {
      saveRosterChanges({ auto: false, showAlert: true });
    });
  }

  rosterStepperButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const key = String(button.dataset.rosterStep || '').trim();
      const stepDir = Number.parseInt(button.dataset.stepDir, 10);
      if (!key || !Number.isFinite(stepDir)) return;
      adjustRosterValue(key, stepDir);
    });
  });
  if (roundTimerMinutesInput) {
    roundTimerMinutesInput.addEventListener('change', queueRosterAutosave);
  }
  if (ajDraftModeInput) {
    ajDraftModeInput.addEventListener('change', queueRosterAutosave);
  }
  if (waiverModeInput) {
    waiverModeInput.addEventListener('change', queueRosterAutosave);
  }

  if (toggleBudgetPanelBtn && customBudgetPanel) {
    toggleBudgetPanelBtn.addEventListener('click', () => {
      customBudgetPanel.classList.toggle('hidden');
    });
  }

  if (applyCustomBudgetsBtn) {
    applyCustomBudgetsBtn.addEventListener('click', () => {
      const draftsRaw = localStorage.getItem('drafts');
      const drafts = draftsRaw ? JSON.parse(draftsRaw) : {};
      const members = (drafts[code] && drafts[code].members) ? drafts[code].members : [];
      const isHost = isCurrentUserHost(drafts[code]);
      if (!isHost) { alert('Only the host can set custom budgets'); return; }
      drafts[code] = drafts[code] || { members: [] };
      const nextBudgets = normalizeCustomBudgets(drafts[code].customBudgets, members);
      if (customBudgetList) {
        customBudgetList.querySelectorAll('input[data-member]').forEach((input) => {
          const member = input.dataset.member;
          if (member) {
            nextBudgets[member] = normalizeBudget(input.value, DEFAULT_START_BUDGET);
          }
        });
      }
      drafts[code].customBudgets = nextBudgets;
      localStorage.setItem('drafts', JSON.stringify(drafts));
      try { if (socket) { socket.emit('updateDraft', code, drafts[code]); } } catch (e) { console.warn('updateDraft emit failed', e); }
      refreshMembers();
      updateCustomBudgetControlsState();
    });
  }

  if (resetCustomBudgetsBtn) {
    resetCustomBudgetsBtn.addEventListener('click', () => {
      const draftsRaw = localStorage.getItem('drafts');
      const drafts = draftsRaw ? JSON.parse(draftsRaw) : {};
      const members = (drafts[code] && drafts[code].members) ? drafts[code].members : [];
      const isHost = isCurrentUserHost(drafts[code]);
      if (!isHost) { alert('Only the host can reset custom budgets'); return; }
      drafts[code] = drafts[code] || { members: [] };
      drafts[code].customBudgets = normalizeCustomBudgets({}, members);
      localStorage.setItem('drafts', JSON.stringify(drafts));
      try { if (socket) { socket.emit('updateDraft', code, drafts[code]); } } catch (e) { console.warn('updateDraft emit failed', e); }
      refreshMembers();
      updateCustomBudgetControlsState();
    });
  }

  // initialize capacity controls visibility
  updateDraftTypeControlsState();
  updateCapacityControls();
  updateRosterControlsState();
  syncRosterStepperDisplays();
  updateCustomBudgetControlsState();
  updateStartDraftControlState();

  if(dismissBanner){ dismissBanner.addEventListener('click', ()=>{ if(hostBanner) hostBanner.style.display = 'none'; sessionStorage.setItem(`notified_full_${code}`,'1'); }); }

  // Start Draft button
  if (startDraftBtn) {
    startDraftBtn.addEventListener('click', () => {
      const draftsRaw = localStorage.getItem('drafts');
      const drafts = draftsRaw ? JSON.parse(draftsRaw) : {};
      const isHost = isCurrentUserHost(drafts[code]);
      
      if (!isHost) {
        alert('Only the host can start the draft');
        return;
      }

      drafts[code] = drafts[code] || { members: [] };
      drafts[code].roundTimerMinutes = normalizeRoundTimerMinutes(
        roundTimerMinutesInput ? roundTimerMinutesInput.value : undefined,
        DEFAULT_ROUND_TIMER_MINUTES
      );
      drafts[code].ajDraftMode = Boolean(ajDraftModeInput && ajDraftModeInput.checked);
      drafts[code].ajRoundOrder = drafts[code].ajDraftMode
        ? buildAjRoundOrder()
        : undefined;
      if (!drafts[code].ajDraftMode) {
        delete drafts[code].ajRoundOrder;
      }
      const selectedRoundTimerMinutes = drafts[code].roundTimerMinutes;
      console.log('[lobby] startDraft selectedRoundTimerMinutes:', selectedRoundTimerMinutes, 'draft state:', drafts[code]);
      localStorage.setItem('drafts', JSON.stringify(drafts));
      try {
        if (socket) {
          socket.emit('updateDraft', code, drafts[code]);
        }
      } catch (e) {
        console.warn('updateDraft emit failed', e);
      }
      
      // Get selected draft type from radio buttons
      const selectedType = Array.from(draftTypeRadios).find(r => r.checked)?.value || 'silent';

      const startDraftRequestId = `startdraft:${code}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;

      const emitStartDraftWithRetry = (attempt = 0) => {
        if (!socket) {
          return;
        }
        if (attempt > START_DRAFT_MAX_RETRIES) {
          console.warn('[lobby] startDraft retries exhausted');
          return;
        }
        if (!socket.connected) {
          const waitMs = Math.min(START_DRAFT_RETRY_MAX_MS, START_DRAFT_RETRY_BASE_MS * Math.pow(2, Math.max(0, attempt)));
          setTimeout(() => emitStartDraftWithRetry(attempt + 1), waitMs);
          return;
        }

        console.log('[lobby] emitting startDraft with timer:', selectedRoundTimerMinutes, 'attempt=', attempt);
        let settled = false;
        const timeoutId = setTimeout(() => {
          if (settled) return;
          settled = true;
          const waitMs = Math.min(START_DRAFT_RETRY_MAX_MS, START_DRAFT_RETRY_BASE_MS * Math.pow(2, Math.max(0, attempt)));
          setTimeout(() => emitStartDraftWithRetry(attempt + 1), waitMs);
        }, START_DRAFT_ACK_TIMEOUT_MS);

        socket.emit('startDraft', code, selectedType, selectedRoundTimerMinutes, { requestId: startDraftRequestId }, (resp) => {
          if (settled) return;
          settled = true;
          clearTimeout(timeoutId);
          if (resp && resp.ok) {
            console.log('Draft start broadcasted to all members');
            return;
          }

          const retryable = resp && (resp.reason === 'host_reconnecting' || resp.reason === 'server_busy');
          if (retryable && attempt < START_DRAFT_MAX_RETRIES) {
            const waitMs = Math.min(START_DRAFT_RETRY_MAX_MS, START_DRAFT_RETRY_BASE_MS * Math.pow(2, Math.max(0, attempt)));
            setTimeout(() => emitStartDraftWithRetry(attempt + 1), waitMs);
          }
        });
      };
      
      // Show countdown banner immediately for host
      showCountdownBanner(selectedType);
      
      // Notify server to start draft for all other members
      emitStartDraftWithRetry(0);
    });
  }

  if(leaveBtn){
    leaveBtn.addEventListener('click', ()=>{
      // Request server to remove this user from the draft
      try{
        if(socket){
          socket.emit('leaveDraft', code, user, (resp)=>{
            sessionStorage.removeItem('currentDraft');
            clearInterval(poll);
            window.location.href = 'dashboard.html';
          });
        } else {
          // fallback path if socket is not available
          throw new Error('no-socket');
        }
      } catch(e){
        const draftsRaw = localStorage.getItem('drafts');
        const drafts = draftsRaw ? JSON.parse(draftsRaw) : {};
        if(drafts[code] && drafts[code].members){
          drafts[code].members = drafts[code].members.filter(m=>m!==user);
          localStorage.setItem('drafts', JSON.stringify(drafts));
        }
        sessionStorage.removeItem('currentDraft');
        clearInterval(poll);
        window.location.href = 'dashboard.html';
      }
    });
  }

  if (shareLobbyCodeBtn) {
    shareLobbyCodeBtn.addEventListener('click', async () => {
      let copied = false;
      try {
        await navigator.clipboard.writeText(code);
        copied = true;
      } catch (_error) {
        copied = false;
      }

      if (!copied) {
        alert(`Lobby code: ${code}`);
      }

      await openShareFriendsModal();
    });
  }
};

// preserve previous behavior: auto-initialize if a page directly includes lobby.js
// Check if DOM is already loaded, if so run immediately, otherwise wait
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', autoInitLobby);
} else {
  autoInitLobby();
}

function autoInitLobby() {
  try{ 
    if(document.getElementById('draftCode')) {
      window.initializeLobby({}); 
    }
  }catch(e){
    console.error('Auto-init lobby error:', e);
  }
}
