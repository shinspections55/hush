// expose a reusable initializer so public/private lobby pages can call it
window.initializeLobby = function initializeLobby(opts){
  const DEFAULT_DRAFT_BENCH = 13;
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

  const draftTitle = document.getElementById('draftTitle');
  const draftCode = document.getElementById('draftCode');
  const hostDisplay = document.getElementById('hostDisplay');
  const memberCountBadge = document.getElementById('memberCountBadge');
  const memberList = document.getElementById('memberList');
  const leaveBtn = document.getElementById('leaveBtn');
  const draftTypeRadios = document.getElementsByName('draftType');
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
  // closed overlay elements (may be present in page)
  let closedOverlay = document.getElementById('closedOverlay');
  let closedReturnBtn = document.getElementById('closedReturnBtn');

  // defensive: ensure DOM elements exist before updating
  if(draftTitle) draftTitle.textContent = `Draft Lobby`;
  if(draftCode) draftCode.textContent = 'Code: ' + code;

  // debug: log current session/local storage state to help diagnose missing members
  try{
    console.debug('[lobby] username:', sessionStorage.getItem('username'));
    console.debug('[lobby] currentDraft:', sessionStorage.getItem('currentDraft'));
    console.debug('[lobby] drafts (raw):', localStorage.getItem('drafts'));
  }catch(e){ console.warn('[lobby] storage access failed', e); }

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
    const dtype = drafts[code].type || 'silent';
    // Set the radio button based on current type
    draftTypeRadios.forEach(radio => {
      if (radio.value === dtype) radio.checked = true;
    });
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
    rosterSettings.BN = DEFAULT_DRAFT_BENCH;
    const benchCutTarget = normalizeBenchCutTarget(drafts[code].benchCutTarget, DEFAULT_BENCH_CUT_TARGET);
    const roundTimerMinutes = normalizeRoundTimerMinutes(drafts[code].roundTimerMinutes, DEFAULT_ROUND_TIMER_MINUTES);
    const ajDraftMode = Boolean(drafts[code].ajDraftMode);
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
    Object.entries(rosterInputMap).forEach(([key, input]) => {
      if (!input) return;
      if (key === 'BN') {
        input.value = String(benchCutTarget);
      } else {
        input.value = String(rosterSettings[key]);
      }
    });
    if (roundTimerMinutesInput) {
      roundTimerMinutesInput.value = String(roundTimerMinutes);
    }
    if (ajDraftModeInput) {
      ajDraftModeInput.checked = ajDraftMode;
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

      // disable interactive controls but allow leaving
      if (capacitySelect) capacitySelect.disabled = true;
      if (applyCapacityBtn) applyCapacityBtn.disabled = true;
      if (applyRosterBtn) applyRosterBtn.disabled = true;
      Object.values(rosterInputMap).forEach(input => { if (input) input.disabled = true; });
      if (roundTimerMinutesInput) roundTimerMinutesInput.disabled = true;
      if (ajDraftModeInput) ajDraftModeInput.disabled = true;
      if (leaveBtn) leaveBtn.disabled = false;

      // show a one-time alert to the user in addition to the overlay
      try {
        const alertedKey = `closed_alerted_${code}`;
        if (!sessionStorage.getItem(alertedKey)) {
          // alert is synchronous and will be shown once per session per draft
          alert('This session has closed — the host has left and the draft is no longer accepting participants.');
          sessionStorage.setItem(alertedKey, '1');
        }
      } catch (e) {
        // ignore storage errors
      }
    } else {
      if (closedOverlay) closedOverlay.style.display = 'none';
      if (capacitySelect) capacitySelect.disabled = false;
      if (applyCapacityBtn) applyCapacityBtn.disabled = false;
      Object.values(rosterInputMap).forEach(input => { if (input) input.disabled = false; });
      if (roundTimerMinutesInput) roundTimerMinutesInput.disabled = false;
      if (ajDraftModeInput) ajDraftModeInput.disabled = false;
    }
    // notify host when full (show banner once until dismissed)
    const full = cap && members.length >= cap;
    const notifiedKey = `notified_full_${code}`;
    const alreadyNotified = sessionStorage.getItem(notifiedKey);
    if(isHost && full && !alreadyNotified){ if(hostBanner){ hostBanner.style.display = 'block'; } sessionStorage.setItem(notifiedKey, '1'); }
    if(!full){ if(hostBanner){ hostBanner.style.display = 'none'; } sessionStorage.removeItem(notifiedKey); }
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

  refreshMembers();
  // connect to Socket.IO for real-time updates (guarded)
  let socket = null;
  try{ 
    if(window.io){ 
      socket = io(); 
      console.log('[lobby] Socket.IO connecting...', user);
      
      // Wait for connection before joining room
      socket.on('connect', () => {
        console.log('[lobby] Socket connected for user:', user, 'joining room:', code);
        socket.emit('joinDraftRoom', code, user);
        socket.emit('getDraftState', code, (response) => {
          if (response && response.ok && response.draft) {
            const draftsRaw = localStorage.getItem('drafts');
            const drafts = draftsRaw ? JSON.parse(draftsRaw) : {};
            drafts[code] = Object.assign(drafts[code] || {}, response.draft);
            localStorage.setItem('drafts', JSON.stringify(drafts));
            console.log('[lobby] Hydrated draft state from server. Host:', resolveDraftHost(response.draft));
            refreshMembers();
          }
        });
      });
      
      socket.on('draftUpdate', (serverDraft) => { 
        console.log('[lobby] Received draftUpdate', serverDraft);
        const draftsRaw = localStorage.getItem('drafts'); 
        const drafts = draftsRaw ? JSON.parse(draftsRaw) : {}; 
        drafts[code] = Object.assign(drafts[code] || {}, serverDraft); 
        localStorage.setItem('drafts', JSON.stringify(drafts)); 
        refreshMembers(); 
      }); 
      
      socket.on('draftStarted', (draftType) => { 
        console.log(`[lobby] Draft started event received! Type: ${draftType}, User: ${user}`); 
        showCountdownBanner(draftType); 
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
  // show/hide capacity controls depending on host
  function updateCapacityControls(){ const draftsRaw = localStorage.getItem('drafts'); const drafts = draftsRaw ? JSON.parse(draftsRaw) : {}; const isHost = isCurrentUserHost(drafts[code]); if(capacityControls){ capacityControls.classList.toggle('hidden', !isHost); } }

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
      BN: DEFAULT_DRAFT_BENCH
    });
    drafts[code].rosterSettings.BN = DEFAULT_DRAFT_BENCH;
    drafts[code].benchCutTarget = normalizeBenchCutTarget(
      rosterInputMap.BN ? rosterInputMap.BN.value : undefined,
      DEFAULT_BENCH_CUT_TARGET
    );
    drafts[code].roundTimerMinutes = normalizeRoundTimerMinutes(
      roundTimerMinutesInput ? roundTimerMinutesInput.value : undefined,
      DEFAULT_ROUND_TIMER_MINUTES
    );
    drafts[code].ajDraftMode = Boolean(ajDraftModeInput && ajDraftModeInput.checked);
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
