// expose a reusable initializer so public/private lobby pages can call it
window.initializeLobby = function initializeLobby(opts){
  const DEFAULT_DRAFT_BENCH = 5;
  const DEFAULT_BENCH_CUT_TARGET = 5;
  const DEFAULT_ROUND_TIMER_MINUTES = 10;
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
  const startDraftBtn = document.getElementById('startDraftBtn');
  const hostBanner = document.getElementById('hostBanner');
  const dismissBanner = document.getElementById('dismissBanner');
  let rosterAutosaveTimer = null;
  let hasPageExitSignal = false;
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
    const ajDraftMode = Boolean(drafts[code].ajDraftMode);
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

  function setupLobbyVoicePanel(socketInstance) {
    if (!socketInstance || window.__hushLobbyVoiceInitialized) return;

    const hostContainer = document.querySelector('.lobby-options-column') || document.getElementById('lobbyBox');
    if (!hostContainer) return;

    let panel = document.getElementById('lobbyVoicePanel');
    if (!panel) {
      panel = document.createElement('section');
      panel.id = 'lobbyVoicePanel';
      panel.className = 'lobby-voice-panel';
      panel.innerHTML = `
        <div class="lobby-voice-header-row">
          <h3>Voice Lobby</h3>
          <span id="lobbyVoiceStatus" class="lobby-voice-status">Not connected</span>
        </div>
        <div id="lobbyVoiceList" class="lobby-voice-list" aria-live="polite"></div>
        <div class="lobby-voice-actions">
          <button id="lobbyVoiceJoinBtn" type="button" class="type-btn">Join Voice</button>
          <button id="lobbyVoiceMuteBtn" type="button" class="type-btn" disabled>Mute</button>
          <button id="lobbyVoiceDeafenBtn" type="button" class="type-btn" disabled>Deafen</button>
          <button id="lobbyVoicePttBtn" type="button" class="type-btn" disabled>PTT Off</button>
          <button id="lobbyVoiceLeaveBtn" type="button" class="type-btn" disabled>Leave Voice</button>
        </div>
        <div class="lobby-voice-hint">Push-to-talk: enable PTT and hold Space (outside text fields).</div>
        <div id="lobbyVoiceAudioHost" hidden></div>
      `;

      if (hostContainer.classList.contains('lobby-options-column')) {
        hostContainer.insertBefore(panel, hostContainer.firstChild);
      } else {
        const memberColumn = hostContainer.querySelector('.lobby-members-column');
        if (memberColumn && memberColumn.parentNode) {
          memberColumn.parentNode.insertBefore(panel, memberColumn.nextSibling);
        } else {
          hostContainer.appendChild(panel);
        }
      }
    }

    const listEl = document.getElementById('lobbyVoiceList');
    const statusEl = document.getElementById('lobbyVoiceStatus');
    const joinBtn = document.getElementById('lobbyVoiceJoinBtn');
    const muteBtn = document.getElementById('lobbyVoiceMuteBtn');
    const deafenBtn = document.getElementById('lobbyVoiceDeafenBtn');
    const pttBtn = document.getElementById('lobbyVoicePttBtn');
    const leaveBtnEl = document.getElementById('lobbyVoiceLeaveBtn');
    const audioHost = document.getElementById('lobbyVoiceAudioHost');

    if (!listEl || !statusEl || !joinBtn || !muteBtn || !deafenBtn || !pttBtn || !leaveBtnEl || !audioHost) return;

    window.__hushLobbyVoiceInitialized = true;

    const peers = new Map();
    const remoteAudioEls = new Map();
    const remoteVolumes = new Map();
    const participantsBySocketId = new Map();
    const rtcConfig = {
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    };

    let localStream = null;
    let localVoiceJoined = false;
    let joinInFlight = false;
    let selfMuted = false;
    let selfDeafened = false;
    let pttEnabled = false;
    let pttKeyDown = false;
    let localSpeaking = false;
    let speakingLoopId = null;
    let speakingAudioContext = null;
    let speakingAnalyser = null;
    let speakingDataArray = null;

    function participantSort(a, b) {
      const aSelf = a.socketId === socketInstance.id ? 0 : 1;
      const bSelf = b.socketId === socketInstance.id ? 0 : 1;
      if (aSelf !== bSelf) return aSelf - bSelf;
      return String(a.username || '').localeCompare(String(b.username || ''));
    }

    function setVoiceStatus(text) {
      statusEl.textContent = String(text || 'Not connected');
    }

    function updateVoiceButtons() {
      joinBtn.disabled = localVoiceJoined || joinInFlight;
      leaveBtnEl.disabled = !localVoiceJoined;
      muteBtn.disabled = !localVoiceJoined;
      deafenBtn.disabled = !localVoiceJoined;
      pttBtn.disabled = !localVoiceJoined;
      muteBtn.textContent = selfMuted ? 'Unmute' : 'Mute';
      deafenBtn.textContent = selfDeafened ? 'Undeafen' : 'Deafen';
      pttBtn.textContent = pttEnabled ? 'PTT On' : 'PTT Off';
    }

    function ensureSocketConnected(timeoutMs = 7000) {
      if (socketInstance.connected) return Promise.resolve();
      return new Promise((resolve, reject) => {
        let done = false;
        let timerId = null;

        const cleanup = () => {
          socketInstance.off('connect', onConnect);
          socketInstance.off('connect_error', onError);
          if (timerId) {
            window.clearTimeout(timerId);
            timerId = null;
          }
        };

        const finish = (error) => {
          if (done) return;
          done = true;
          cleanup();
          if (error) reject(error);
          else resolve();
        };

        const onConnect = () => finish();
        const onError = (error) => finish(error || new Error('socket_connect_error'));

        socketInstance.on('connect', onConnect);
        socketInstance.on('connect_error', onError);
        try { socketInstance.connect(); } catch (_) {}

        timerId = window.setTimeout(() => {
          finish(new Error('socket_connect_timeout'));
        }, timeoutMs);
      });
    }

    function emitVoiceJoinWithTimeout(timeoutMs = 15000) {
      return new Promise((resolve, reject) => {
        const payload = {
          muted: selfMuted,
          deafened: selfDeafened
        };

        let settled = false;
        const timerId = window.setTimeout(() => {
          if (settled) return;
          settled = true;
          reject(new Error('voice_join_timeout'));
        }, timeoutMs);

        socketInstance.emit('voice:join', code, payload, (response) => {
          if (settled) return;
          settled = true;
          window.clearTimeout(timerId);
          resolve(response || null);
        });
      });
    }

    function getVoiceJoinErrorMessage(response) {
      const reason = String(response && response.reason || '').trim();
      if (reason === 'not_in_draft_room') return 'Join the lobby or draft room first, then try voice again.';
      if (reason === 'not_in_draft') return 'You are not recognized as a member of this draft for voice.';
      if (reason === 'draft_not_found') return 'This draft room is unavailable right now.';
      if (reason === 'voice_lobby_error') return 'Voice lobby failed to initialize. Please retry.';
      return 'Unable to join voice lobby right now. Please try again.';
    }

    function getParticipantStateText(entry) {
      const pieces = [];
      if (entry.deafened) pieces.push('deaf');
      if (entry.muted) pieces.push('muted');
      if (entry.speaking) pieces.push('speaking');
      if (pieces.length === 0) return 'listening';
      return pieces.join(' | ');
    }

    function getRemoteVolumePercent(remoteSocketId) {
      const stored = Number(remoteVolumes.get(String(remoteSocketId)));
      if (Number.isFinite(stored)) {
        return Math.max(0, Math.min(200, Math.round(stored)));
      }
      return 100;
    }

    function renderVoiceParticipants() {
      const list = [...participantsBySocketId.values()];
      const hasSelf = list.some((entry) => entry && entry.socketId === socketInstance.id);
      if (!hasSelf) {
        list.push({
          socketId: socketInstance.id,
          username: user,
          muted: selfMuted,
          deafened: selfDeafened,
          speaking: false
        });
      }

      if (!list.length) {
        listEl.innerHTML = '<div class="lobby-voice-empty">No one in voice yet.</div>';
        return;
      }

      listEl.innerHTML = list.sort(participantSort).map((entry) => {
        const safeName = String(entry.username || 'Member').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const stateText = getParticipantStateText(entry).replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const speakingClass = entry.speaking ? ' is-speaking' : '';
        const selfTag = entry.socketId === socketInstance.id ? ' (You)' : '';
        const isSelf = entry.socketId === socketInstance.id;
        const volumePercent = getRemoteVolumePercent(entry.socketId);
        const inlineAction = isSelf
          ? (localVoiceJoined
            ? '<button type="button" class="lobby-voice-inline-btn is-leave" data-voice-inline="leave" aria-label="Leave voice" title="Leave voice"><span class="lobby-voice-inline-mic">🎤</span><span class="lobby-voice-inline-x">✕</span></button>'
            : '<button type="button" class="lobby-voice-inline-btn" data-voice-inline="join" aria-label="Join voice" title="Join voice">Join <span class="lobby-voice-inline-mic">🎤</span></button>')
          : `<span class="lobby-voice-member-state">${stateText}</span><div class="lobby-voice-volume-wrap"><input type="range" class="lobby-voice-volume" data-voice-volume-socket="${String(entry.socketId || '')}" min="0" max="200" step="1" value="${volumePercent}" aria-label="${safeName} volume"><span class="lobby-voice-volume-value" data-voice-volume-value="${String(entry.socketId || '')}">${volumePercent}%</span></div>`;

        return `<div class="lobby-voice-member${speakingClass}"><span class="lobby-voice-member-name"><span class="lobby-voice-inline-mic">🎤</span>${safeName}${selfTag}</span><span class="lobby-voice-self-action">${inlineAction}</span></div>`;
      }).join('');
    }

    function updateRemoteAudioMutedState() {
      remoteAudioEls.forEach((el, socketId) => {
        const participant = participantsBySocketId.get(socketId);
        const participantMuted = !!(participant && (participant.muted || participant.deafened));
        el.muted = selfDeafened || participantMuted;
        const volumePercent = getRemoteVolumePercent(socketId);
        el.volume = Math.max(0, Math.min(2, volumePercent / 100));
      });
    }

    function applyLocalTrackState() {
      if (!localStream) return;
      const shouldTransmit = localVoiceJoined && !selfDeafened && !selfMuted && (!pttEnabled || pttKeyDown);
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = !!shouldTransmit;
      });
    }

    function emitVoiceMuteState() {
      if (!localVoiceJoined) return;
      socketInstance.emit('voice:mute-state', code, {
        muted: selfMuted,
        deafened: selfDeafened
      });
      const selfParticipant = participantsBySocketId.get(socketInstance.id);
      if (selfParticipant) {
        selfParticipant.muted = selfMuted;
        selfParticipant.deafened = selfDeafened;
        selfParticipant.speaking = false;
        participantsBySocketId.set(socketInstance.id, selfParticipant);
        renderVoiceParticipants();
      }
    }

    function stopSpeakingLoop() {
      if (speakingLoopId) {
        window.clearInterval(speakingLoopId);
        speakingLoopId = null;
      }
      if (speakingAudioContext) {
        try { speakingAudioContext.close(); } catch (_) {}
      }
      speakingAudioContext = null;
      speakingAnalyser = null;
      speakingDataArray = null;
      if (localSpeaking) {
        localSpeaking = false;
        socketInstance.emit('voice:speaking', code, false);
      }
    }

    function startSpeakingLoop() {
      stopSpeakingLoop();
      if (!localStream) return;

      speakingAudioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = speakingAudioContext.createMediaStreamSource(localStream);
      speakingAnalyser = speakingAudioContext.createAnalyser();
      speakingAnalyser.fftSize = 512;
      speakingDataArray = new Uint8Array(speakingAnalyser.fftSize);
      source.connect(speakingAnalyser);

      speakingLoopId = window.setInterval(() => {
        if (!speakingAnalyser || !speakingDataArray) return;
        speakingAnalyser.getByteTimeDomainData(speakingDataArray);
        let total = 0;
        for (let i = 0; i < speakingDataArray.length; i += 1) {
          const normalized = (speakingDataArray[i] - 128) / 128;
          total += Math.abs(normalized);
        }
        const avg = total / speakingDataArray.length;
        const isSpeakingNow = avg > 0.055 && !selfMuted && !selfDeafened && (!pttEnabled || pttKeyDown);
        if (isSpeakingNow !== localSpeaking) {
          localSpeaking = isSpeakingNow;
          socketInstance.emit('voice:speaking', code, localSpeaking);
        }
      }, 220);
    }

    function removeRemoteAudioElement(remoteSocketId) {
      const audioEl = remoteAudioEls.get(remoteSocketId);
      if (audioEl && audioEl.parentNode) {
        audioEl.parentNode.removeChild(audioEl);
      }
      remoteAudioEls.delete(remoteSocketId);
    }

    function closePeer(remoteSocketId) {
      const peer = peers.get(remoteSocketId);
      if (!peer) return;
      try { peer.close(); } catch (_) {}
      peers.delete(remoteSocketId);
      removeRemoteAudioElement(remoteSocketId);
      remoteVolumes.delete(String(remoteSocketId));
    }

    function closeAllPeers() {
      [...peers.keys()].forEach((remoteSocketId) => closePeer(remoteSocketId));
    }

    function getOrCreatePeerConnection(remoteSocketId) {
      if (!remoteSocketId || remoteSocketId === socketInstance.id) return null;
      if (peers.has(remoteSocketId)) return peers.get(remoteSocketId);

      const pc = new RTCPeerConnection(rtcConfig);
      peers.set(remoteSocketId, pc);

      if (localStream) {
        localStream.getTracks().forEach((track) => {
          pc.addTrack(track, localStream);
        });
      }

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socketInstance.emit('voice:signal-ice', code, remoteSocketId, event.candidate);
        }
      };

      pc.ontrack = (event) => {
        const [stream] = event.streams;
        if (!stream) return;
        let audioEl = remoteAudioEls.get(remoteSocketId);
        if (!audioEl) {
          audioEl = document.createElement('audio');
          audioEl.autoplay = true;
          audioEl.playsInline = true;
          remoteAudioEls.set(remoteSocketId, audioEl);
          audioHost.appendChild(audioEl);
        }
        audioEl.srcObject = stream;
        const volumePercent = getRemoteVolumePercent(remoteSocketId);
        audioEl.volume = Math.max(0, Math.min(2, volumePercent / 100));
        updateRemoteAudioMutedState();
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'closed' || pc.connectionState === 'disconnected') {
          closePeer(remoteSocketId);
        }
      };

      return pc;
    }

    async function createOfferFor(remoteSocketId) {
      if (!localVoiceJoined || !localStream) return;
      const pc = getOrCreatePeerConnection(remoteSocketId);
      if (!pc) return;
      const offer = await pc.createOffer({ offerToReceiveAudio: true });
      await pc.setLocalDescription(offer);
      socketInstance.emit('voice:signal-offer', code, remoteSocketId, offer);
    }

    async function finalizeVoiceJoin(participantsRaw) {
      const participants = Array.isArray(participantsRaw) ? participantsRaw : [];

      localVoiceJoined = true;
      joinInFlight = false;
      setVoiceStatus('Connected');
      updateVoiceButtons();

      participantsBySocketId.clear();
      participants.forEach((entry) => {
        if (!entry || !entry.socketId) return;
        participantsBySocketId.set(String(entry.socketId), {
          socketId: String(entry.socketId),
          username: String(entry.username || 'Member'),
          muted: !!entry.muted,
          deafened: !!entry.deafened,
          speaking: !!entry.speaking
        });
      });

      renderVoiceParticipants();
      applyLocalTrackState();
      updateRemoteAudioMutedState();
      startSpeakingLoop();

      const existingPeers = participants
        .map((entry) => String(entry && entry.socketId || '').trim())
        .filter((remoteSocketId) => remoteSocketId && remoteSocketId !== socketInstance.id);

      for (const remoteSocketId of existingPeers) {
        try {
          await createOfferFor(remoteSocketId);
        } catch (error) {
          console.warn('[lobby voice] Failed to create offer for peer:', remoteSocketId, error);
        }
      }
    }

    async function joinVoiceLobby() {
      if (localVoiceJoined || joinInFlight) return;
      joinInFlight = true;
      updateVoiceButtons();
      setVoiceStatus('Joining voice...');

      try {
        await ensureSocketConnected();
        localStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          },
          video: false
        });
      } catch (error) {
        const isMicError = error && (error.name === 'NotAllowedError' || error.name === 'NotFoundError' || error.name === 'NotReadableError');
        alert(isMicError
          ? 'Microphone permission is required for voice chat.'
          : 'Unable to connect to the server for voice right now.');
        joinInFlight = false;
        updateVoiceButtons();
        setVoiceStatus('Not connected');
        return;
      }

      participantsBySocketId.clear();
      renderVoiceParticipants();

      let response = null;
      try {
        response = await emitVoiceJoinWithTimeout();
      } catch (error) {
        if (!localVoiceJoined) {
          console.warn('[lobby voice] Join ack timeout/error:', error);
        }
      }

      if (!response && localVoiceJoined) {
        joinInFlight = false;
        updateVoiceButtons();
        return;
      }

      if (!response || !response.ok) {
        if (localVoiceJoined) {
          joinInFlight = false;
          updateVoiceButtons();
          return;
        }
        alert(getVoiceJoinErrorMessage(response));
        if (localStream) {
          localStream.getTracks().forEach((track) => track.stop());
          localStream = null;
        }
        setVoiceStatus('Not connected');
        joinInFlight = false;
        updateVoiceButtons();
        return;
      }

      if (localVoiceJoined) {
        joinInFlight = false;
        updateVoiceButtons();
        return;
      }

      await finalizeVoiceJoin(response.participants);
    }

    function leaveVoiceLobby({ notifyServer = true } = {}) {
      if (notifyServer) {
        socketInstance.emit('voice:leave', code, () => {});
      }

      localVoiceJoined = false;
      localSpeaking = false;
      stopSpeakingLoop();
      closeAllPeers();
      participantsBySocketId.clear();
      renderVoiceParticipants();

      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
        localStream = null;
      }

      setVoiceStatus('Not connected');
      updateVoiceButtons();
    }

    window.__hushLobbyVoiceLeave = () => leaveVoiceLobby({ notifyServer: true });

    joinBtn.addEventListener('click', () => {
      joinVoiceLobby().catch((error) => {
        console.warn('[lobby voice] Join failed:', error);
      });
    });

    listEl.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const actionBtn = target.closest('[data-voice-inline]');
      if (!(actionBtn instanceof HTMLElement)) return;
      const action = String(actionBtn.getAttribute('data-voice-inline') || '');
      if (action === 'join') {
        joinVoiceLobby().catch((error) => {
          console.warn('[lobby voice] Inline join failed:', error);
        });
        return;
      }
      if (action === 'leave') {
        leaveVoiceLobby({ notifyServer: true });
      }
    });

    listEl.addEventListener('input', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) return;
      if (!target.matches('[data-voice-volume-socket]')) return;

      const remoteSocketId = String(target.getAttribute('data-voice-volume-socket') || '').trim();
      if (!remoteSocketId || remoteSocketId === socketInstance.id) return;

      const value = Number.parseInt(String(target.value || '100'), 10);
      const normalized = Number.isFinite(value) ? Math.max(0, Math.min(200, value)) : 100;
      remoteVolumes.set(remoteSocketId, normalized);

      const audioEl = remoteAudioEls.get(remoteSocketId);
      if (audioEl) {
        audioEl.volume = Math.max(0, Math.min(2, normalized / 100));
      }

      const valueLabels = listEl.querySelectorAll('[data-voice-volume-value]');
      valueLabels.forEach((node) => {
        if (!(node instanceof HTMLElement)) return;
        if (String(node.getAttribute('data-voice-volume-value') || '').trim() !== remoteSocketId) return;
        node.textContent = `${normalized}%`;
      });
    });

    leaveBtnEl.addEventListener('click', () => {
      leaveVoiceLobby({ notifyServer: true });
    });

    muteBtn.addEventListener('click', () => {
      if (!localVoiceJoined) return;
      selfMuted = !selfMuted;
      applyLocalTrackState();
      emitVoiceMuteState();
      updateVoiceButtons();
    });

    deafenBtn.addEventListener('click', () => {
      if (!localVoiceJoined) return;
      selfDeafened = !selfDeafened;
      if (selfDeafened) selfMuted = true;
      applyLocalTrackState();
      updateRemoteAudioMutedState();
      emitVoiceMuteState();
      updateVoiceButtons();
    });

    pttBtn.addEventListener('click', () => {
      if (!localVoiceJoined) return;
      pttEnabled = !pttEnabled;
      applyLocalTrackState();
      updateVoiceButtons();
    });

    document.addEventListener('keydown', (event) => {
      if (!localVoiceJoined || !pttEnabled) return;
      if (event.code !== 'Space') return;
      const activeEl = document.activeElement;
      const isTyping = activeEl && (
        activeEl.tagName === 'INPUT'
        || activeEl.tagName === 'TEXTAREA'
        || activeEl.isContentEditable
      );
      if (isTyping) return;
      pttKeyDown = true;
      applyLocalTrackState();
    });

    document.addEventListener('keyup', (event) => {
      if (event.code !== 'Space') return;
      if (!localVoiceJoined || !pttEnabled) return;
      pttKeyDown = false;
      applyLocalTrackState();
    });

    socketInstance.on('voice:participants', (participants) => {
      const entries = Array.isArray(participants) ? participants : [];
      const hasSelf = entries.some((entry) => String(entry && entry.socketId || '').trim() === String(socketInstance.id || '').trim());

      if (!localVoiceJoined && !(joinInFlight && hasSelf)) return;

      if (joinInFlight && hasSelf) {
        finalizeVoiceJoin(entries).catch((error) => {
          console.warn('[lobby voice] finalize from participants failed:', error);
        });
        return;
      }

      participantsBySocketId.clear();
      entries.forEach((entry) => {
        if (!entry || !entry.socketId) return;
        participantsBySocketId.set(String(entry.socketId), {
          socketId: String(entry.socketId),
          username: String(entry.username || 'Member'),
          muted: !!entry.muted,
          deafened: !!entry.deafened,
          speaking: !!entry.speaking
        });
      });
      renderVoiceParticipants();
      updateRemoteAudioMutedState();
    });

    socketInstance.on('voice:peer-joined', (entry) => {
      if (!localVoiceJoined || !entry || !entry.socketId) return;
      participantsBySocketId.set(String(entry.socketId), {
        socketId: String(entry.socketId),
        username: String(entry.username || 'Member'),
        muted: !!entry.muted,
        deafened: !!entry.deafened,
        speaking: !!entry.speaking
      });
      renderVoiceParticipants();
      updateRemoteAudioMutedState();
    });

    socketInstance.on('voice:peer-left', ({ socketId: remoteSocketId }) => {
      if (!remoteSocketId) return;
      participantsBySocketId.delete(String(remoteSocketId));
      closePeer(String(remoteSocketId));
      renderVoiceParticipants();
    });

    socketInstance.on('voice:peer-updated', (entry) => {
      if (!entry || !entry.socketId) return;
      const key = String(entry.socketId);
      const current = participantsBySocketId.get(key);
      if (!current) return;
      participantsBySocketId.set(key, {
        ...current,
        muted: !!entry.muted,
        deafened: !!entry.deafened,
        speaking: !!entry.speaking
      });
      renderVoiceParticipants();
      updateRemoteAudioMutedState();
    });

    socketInstance.on('voice:signal-offer', async ({ fromSocketId, sdp }) => {
      if (!localVoiceJoined || !fromSocketId || !sdp) return;
      try {
        const pc = getOrCreatePeerConnection(String(fromSocketId));
        if (!pc) return;
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socketInstance.emit('voice:signal-answer', code, String(fromSocketId), answer);
      } catch (error) {
        console.warn('[lobby voice] Failed to handle offer:', error);
      }
    });

    socketInstance.on('voice:signal-answer', async ({ fromSocketId, sdp }) => {
      if (!localVoiceJoined || !fromSocketId || !sdp) return;
      const pc = peers.get(String(fromSocketId));
      if (!pc) return;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      } catch (error) {
        console.warn('[lobby voice] Failed to handle answer:', error);
      }
    });

    socketInstance.on('voice:signal-ice', async ({ fromSocketId, candidate }) => {
      if (!localVoiceJoined || !fromSocketId || !candidate) return;
      const pc = getOrCreatePeerConnection(String(fromSocketId));
      if (!pc) return;
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.warn('[lobby voice] Failed to add ICE candidate:', error);
      }
    });

    socketInstance.on('disconnect', () => {
      if (!localVoiceJoined) return;
      setVoiceStatus('Voice reconnecting...');
      closeAllPeers();
    });

    socketInstance.on('connect', () => {
      if (!localVoiceJoined || !localStream) return;
      socketInstance.emit('voice:join', code, {
        muted: selfMuted,
        deafened: selfDeafened
      }, async (response) => {
        if (!response || !response.ok) return;
        participantsBySocketId.clear();
        const participants = Array.isArray(response.participants) ? response.participants : [];
        participants.forEach((entry) => {
          if (!entry || !entry.socketId) return;
          participantsBySocketId.set(String(entry.socketId), {
            socketId: String(entry.socketId),
            username: String(entry.username || 'Member'),
            muted: !!entry.muted,
            deafened: !!entry.deafened,
            speaking: !!entry.speaking
          });
        });
        renderVoiceParticipants();
        setVoiceStatus('Connected');

        const existingPeers = participants
          .map((entry) => String(entry && entry.socketId || '').trim())
          .filter((remoteSocketId) => remoteSocketId && remoteSocketId !== socketInstance.id);

        for (const remoteSocketId of existingPeers) {
          try {
            await createOfferFor(remoteSocketId);
          } catch (error) {
            console.warn('[lobby voice] Reconnect offer failed:', error);
          }
        }
      });
    });

    window.addEventListener('beforeunload', () => {
      leaveVoiceLobby({ notifyServer: true });
    });

    updateVoiceButtons();
    renderVoiceParticipants();
  }

  refreshMembers();
  // connect to Socket.IO for real-time updates (guarded)
  let socket = null;
  try{ 
    if(window.io){ 
      socket = io({
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
        transports: ['polling', 'websocket']
      }); 
      console.log('[lobby] Socket.IO connecting...', user);

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
        console.log('[lobby] Socket connected for user:', user, 'joining room:', code);
        socket.emit('joinDraftRoom', code, user);
        setupLobbyVoicePanel(socket);
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

  Object.values(rosterInputMap).forEach((input) => {
    if (!input) return;
    input.addEventListener('input', queueRosterAutosave);
    input.addEventListener('change', queueRosterAutosave);
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
      
      // Show countdown banner immediately for host
      showCountdownBanner(selectedType);
      
      // Notify server to start draft for all other members
      if (socket) {
        console.log('[lobby] emitting startDraft with timer:', selectedRoundTimerMinutes);
        socket.emit('startDraft', code, selectedType, selectedRoundTimerMinutes, (resp) => {
          if (resp && resp.ok) {
            console.log('Draft start broadcasted to all members');
          }
        });
      }
    });
  }

  if(leaveBtn){
    leaveBtn.addEventListener('click', ()=>{
      hasPageExitSignal = true;
      try {
        if (typeof window.__hushLobbyVoiceLeave === 'function') {
          window.__hushLobbyVoiceLeave();
        }
      } catch (_error) {}
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

  const signalPageExitLeave = () => {
    if (hasPageExitSignal) return;
    hasPageExitSignal = true;

    try {
      if (typeof window.__hushLobbyVoiceLeave === 'function') {
        window.__hushLobbyVoiceLeave();
      }
    } catch (_error) {}

    try {
      if (socket) {
        socket.emit('leaveDraft', code, user);
      }
    } catch (_error) {}
  };

  window.addEventListener('pagehide', signalPageExitLeave, { capture: true });
  window.addEventListener('beforeunload', signalPageExitLeave, { capture: true });

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
