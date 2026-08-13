import {
  browserLocalPersistence,
  clearAuthSession,
  formatAuthError,
  requireCurrentUser,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  syncSessionFromUser,
  auth
} from './firebase-auth.js';

document.addEventListener('DOMContentLoaded', async ()=>{
  const isInstalledApp = (
    (window.matchMedia && (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: fullscreen)').matches ||
      window.matchMedia('(display-mode: minimal-ui)').matches
    )) ||
    window.navigator.standalone === true ||
    (typeof document.referrer === 'string' && document.referrer.startsWith('android-app://'))
  );

  let resolvedUser = '';
  let resolvedProfile = null;
  try {
    const currentUser = await requireCurrentUser();
    const profile = syncSessionFromUser(currentUser);
    resolvedProfile = profile || null;
    resolvedUser = profile && profile.username ? profile.username : '';
  } catch (_error) {
    const fallbackUsername = String(sessionStorage.getItem('username') || localStorage.getItem('lastSignedInUsername') || '').trim();
    const fallbackEmail = String(sessionStorage.getItem('userEmail') || localStorage.getItem('lastSignedInEmail') || '').trim();
    if (fallbackUsername) {
      resolvedUser = fallbackUsername;
      resolvedProfile = {
        username: fallbackUsername,
        email: fallbackEmail
      };
    } else {
      clearAuthSession();
    }
    if (!isInstalledApp) {
      if (!resolvedUser) {
        window.location.href = 'index.html';
        return;
      }
    }
  }

  const user = resolvedUser;
  const greeting = document.getElementById('greeting') || document.getElementById('welcomeUser');
  const welcomeText = document.getElementById('welcomeText');
  const logoutBtn = document.getElementById('logoutBtn');
  const accountBtn = document.getElementById('accountBtn');
  const accountMenu = document.getElementById('accountMenu');
  const editAccountBtn = document.getElementById('editAccountBtn');
  const openFriendsBtn = document.getElementById('openFriendsBtn');
  const friendsMenuNotice = document.getElementById('friendsMenuNotice');
  const friendsMenuPanel = document.getElementById('friendsMenuPanel');
  const friendUsernameInput = document.getElementById('friendUsernameInput');
  const addFriendBtn = document.getElementById('addFriendBtn');
  const friendsMenuStatus = document.getElementById('friendsMenuStatus');
  const friendsMenuList = document.getElementById('friendsMenuList');
  const deleteAccountMenuBtn = document.getElementById('deleteAccountMenuBtn');
  const joinDraft = document.getElementById('joinDraft');
  const joinPrivate = document.getElementById('joinPrivate');
  const walletBalanceEl = document.getElementById('walletBalance');
  const openWalletBtn = document.getElementById('openWallet');
  const completedDraftsBtn = document.getElementById('completedDraftsBtn');
  const toggleDashboardThemeBtn = document.getElementById('toggleDashboardTheme');
  const completedDraftsMenu = document.getElementById('completedDraftsMenu');
  const newsFeedStatus = document.getElementById('newsFeedStatus');
  const newsFeedList = document.getElementById('newsFeedList');
  const downloadAppBtn = document.getElementById('downloadAppBtn');
  const dashboardAppDownload = document.querySelector('.dashboard-app-download');
  const openInstallGuideBtn = document.getElementById('openInstallGuideBtn');
  const installGuideModal = document.getElementById('installGuideModal');
  const closeInstallGuideBtn = document.getElementById('closeInstallGuideBtn');
  const installNowBtn = document.getElementById('installNowBtn');
  const installGuidePromptStatus = document.getElementById('installGuidePromptStatus');
  const appHomeLoginGate = document.getElementById('appHomeLoginGate');
  const appHomeLoginForm = document.getElementById('appHomeLoginForm');
  const draftActionRow = document.querySelector('#draftActions .dashboard-cta-row');

  // Install instructions are website-only; hide all install UI in installed app mode.
  if (isInstalledApp) {
    if (dashboardAppDownload) dashboardAppDownload.classList.add('hidden');
    if (downloadAppBtn) downloadAppBtn.classList.add('download-app-hidden');
    if (installGuideModal) installGuideModal.classList.add('hidden');
  } else {
    if (dashboardAppDownload) dashboardAppDownload.classList.remove('hidden');
  }

  function normalizeEmailValue(value) {
    return String(value || '').trim().toLowerCase();
  }

  function looksLikeEmail(value) {
    const text = normalizeEmailValue(value);
    return text.includes('@') && text.includes('.');
  }

  function resolveEmailFromLocalProfiles(identifier) {
    const key = String(identifier || '').trim().toLowerCase();
    if (!key) return '';

    try {
      const raw = localStorage.getItem('firebaseLocalProfiles');
      if (!raw) return '';
      const profiles = JSON.parse(raw);
      if (!profiles || typeof profiles !== 'object') return '';

      for (const profile of Object.values(profiles)) {
        if (!profile || typeof profile !== 'object') continue;
        const username = String(profile.username || '').trim().toLowerCase();
        const email = normalizeEmailValue(profile.email);
        if (username && username === key && email) {
          return email;
        }
      }
    } catch (_error) {
      // Ignore malformed profile cache.
    }

    return '';
  }

  async function resolveLoginEmail(identifier) {
    const value = String(identifier || '').trim();
    if (!value) {
      throw new Error('Enter your username or email.');
    }

    if (looksLikeEmail(value)) {
      return normalizeEmailValue(value);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    let response;
    try {
      response = await fetch(`/api/auth/resolve-login?identifier=${encodeURIComponent(value)}`, {
        cache: 'no-store',
        signal: controller.signal
      });
    } catch (_error) {
      const localEmail = resolveEmailFromLocalProfiles(value);
      if (localEmail) {
        return localEmail;
      }
      throw new Error('Unable to reach login services. Try email login instead.');
    } finally {
      clearTimeout(timeoutId);
    }

    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload || !payload.ok || !payload.email) {
      const localEmail = resolveEmailFromLocalProfiles(value);
      if (localEmail) {
        return localEmail;
      }
      throw new Error(payload && payload.error ? payload.error : 'Unable to resolve username. Try email instead.');
    }

    return normalizeEmailValue(payload.email);
  }

  if(!user){
    if (!isInstalledApp) {
      // not logged in, redirect back to login for website mode
      window.location.href = 'index.html';
      return;
    }

    if (appHomeLoginForm) {
      // Keep auth fields out of DOM during splash to avoid iOS autofill/FaceID prompts.
      appHomeLoginForm.innerHTML = '';
    }

    const buildAndBindAppLoginForm = () => {
      if (!appHomeLoginForm) return null;
      if (appHomeLoginForm.dataset.ready === '1') {
        return {
          emailInput: appHomeLoginForm.querySelector('#appHomeEmail'),
          passwordInput: appHomeLoginForm.querySelector('#appHomePassword')
        };
      }

      appHomeLoginForm.innerHTML = [
        '<input id="appHomeEmail" type="text" name="identifier" placeholder="Username or email" autocomplete="username" required>',
        '<input id="appHomePassword" type="password" name="password" placeholder="Password" autocomplete="current-password" required>',
        '<button type="submit" class="btn btn-signup">Sign In</button>'
      ].join('');

      const emailInput = appHomeLoginForm.querySelector('#appHomeEmail');
      const passwordInput = appHomeLoginForm.querySelector('#appHomePassword');

      appHomeLoginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const identifier = String(emailInput && emailInput.value || '').trim();
        const password = String(passwordInput && passwordInput.value || '');
        if (!identifier) {
          alert('Enter your username or email.');
          return;
        }
        if (!password) {
          alert('Enter your password.');
          return;
        }

        try {
          if (!auth) throw new Error('Firebase Auth is not configured yet.');
          const resolvedEmail = await resolveLoginEmail(identifier);
          await setPersistence(auth, browserLocalPersistence);
          const credential = await signInWithEmailAndPassword(auth, resolvedEmail, password);
          syncSessionFromUser(credential.user);
          window.location.replace(`dashboard.html?login=${Date.now()}#home`);
        } catch (error) {
          alert(formatAuthError(error, 'Sign in failed.'));
        }
      });

      appHomeLoginForm.dataset.ready = '1';
      return { emailInput, passwordInput };
    };

    const revealAppLoginGate = () => {
      const formControls = buildAndBindAppLoginForm();
      if (greeting) greeting.textContent = 'Welcome to Hush';
      if (welcomeText) welcomeText.textContent = 'Sign in to unlock drafts, rankings, wallet, and account features in the app.';
      if (walletBalanceEl) walletBalanceEl.classList.add('hidden');
      if (accountBtn) accountBtn.classList.add('hidden');
      if (accountMenu) accountMenu.classList.remove('show');
      if (draftActionRow) draftActionRow.classList.add('hidden');
      if (appHomeLoginGate) appHomeLoginGate.classList.remove('hidden');
      if (formControls && formControls.emailInput) formControls.emailInput.disabled = false;
      if (formControls && formControls.passwordInput) formControls.passwordInput.disabled = false;

      try {
        const alertKey = 'appHomeLoginPromptShown';
        if (!sessionStorage.getItem(alertKey)) {
          alert('Please sign in to continue.');
          sessionStorage.setItem(alertKey, '1');
        }
      } catch (_error) {
        // ignore storage errors
      }
    };

    if (window.__hushSplashComplete) {
      revealAppLoginGate();
    } else {
      window.addEventListener('hush:splash-complete', revealAppLoginGate, { once: true });
      // Safety net for missed splash event in cached/edge app states.
      setTimeout(revealAppLoginGate, 3800);
    }

    return;
  }
  if (greeting) greeting.textContent = `Welcome, ${user}!`;
  if (welcomeText) welcomeText.textContent = 'This is your dashboard. Use the account menu to manage your account, sign out, or open your rankings.';

  const friendsNoticeStorageKey = `friends_notice_state_${String(user || '').toLowerCase()}`;

  function parseFriendsNoticeState() {
    try {
      const raw = localStorage.getItem(friendsNoticeStorageKey);
      const parsed = raw ? JSON.parse(raw) : {};
      return {
        lastOutgoing: Array.isArray(parsed.lastOutgoing) ? parsed.lastOutgoing : [],
        lastFriends: Array.isArray(parsed.lastFriends) ? parsed.lastFriends : [],
        unreadAccepted: Array.isArray(parsed.unreadAccepted) ? parsed.unreadAccepted : []
      };
    } catch (_error) {
      return { lastOutgoing: [], lastFriends: [], unreadAccepted: [] };
    }
  }

  function saveFriendsNoticeState(state) {
    try {
      localStorage.setItem(friendsNoticeStorageKey, JSON.stringify({
        lastOutgoing: Array.isArray(state.lastOutgoing) ? state.lastOutgoing : [],
        lastFriends: Array.isArray(state.lastFriends) ? state.lastFriends : [],
        unreadAccepted: Array.isArray(state.unreadAccepted) ? state.unreadAccepted : []
      }));
    } catch (_error) {
      // ignore storage write issues
    }
  }

  function setFriendsNoticeCount(count) {
    if (!friendsMenuNotice) return;
    const numeric = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
    if (numeric <= 0) {
      friendsMenuNotice.classList.add('hidden');
      friendsMenuNotice.textContent = '0';
      return;
    }
    friendsMenuNotice.classList.remove('hidden');
    friendsMenuNotice.textContent = numeric > 99 ? '99+' : String(numeric);
  }

  async function refreshFriendsNotice() {
    if (!user) return;
    try {
      const query = new URLSearchParams({
        username: user,
        email: String(resolvedProfile && resolvedProfile.email || '').trim(),
        fullname: String(resolvedProfile && resolvedProfile.fullname || '').trim(),
        phone: String(resolvedProfile && resolvedProfile.phone || '').trim()
      });
      const response = await fetch(`/api/auth/friends?${query.toString()}`);
      const payload = await response.json();
      if (!response.ok || !payload || !payload.ok) return;

      const incoming = Array.isArray(payload.incomingRequests) ? payload.incomingRequests : [];
      const outgoing = Array.isArray(payload.outgoingRequests) ? payload.outgoingRequests : [];
      const friends = Array.isArray(payload.friends) ? payload.friends : [];

      const currentOutgoing = outgoing
        .map((entry) => String(entry && (entry.usernameKey || entry.username) || '').trim().toLowerCase())
        .filter(Boolean);
      const currentFriends = friends
        .map((entry) => String(entry && (entry.usernameKey || entry.username) || '').trim().toLowerCase())
        .filter(Boolean);

      const previous = parseFriendsNoticeState();
      const newlyAccepted = previous.lastOutgoing.filter((candidate) => (
        !currentOutgoing.includes(candidate) &&
        currentFriends.includes(candidate) &&
        !previous.lastFriends.includes(candidate)
      ));

      const unreadAccepted = Array.from(new Set([
        ...previous.unreadAccepted,
        ...newlyAccepted
      ])).filter((candidate) => currentFriends.includes(candidate));

      saveFriendsNoticeState({
        lastOutgoing: currentOutgoing,
        lastFriends: currentFriends,
        unreadAccepted
      });

      setFriendsNoticeCount(incoming.length + unreadAccepted.length);
    } catch (_error) {
      // ignore polling errors silently
    }
  }

  let friendsLoadedOnce = false;
  let currentFriends = [];

  function setFriendsStatus(message, isError = false) {
    if (!friendsMenuStatus) return;
    if (!message) {
      friendsMenuStatus.textContent = '';
      friendsMenuStatus.classList.add('hidden');
      friendsMenuStatus.classList.remove('is-error');
      return;
    }
    friendsMenuStatus.textContent = message;
    friendsMenuStatus.classList.remove('hidden');
    friendsMenuStatus.classList.toggle('is-error', !!isError);
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function renderFriendsList(friends) {
    if (!friendsMenuList) return;
    currentFriends = Array.isArray(friends) ? friends : [];

    if (!currentFriends.length) {
      friendsMenuList.innerHTML = '<li class="friends-empty">No friends added yet.</li>';
      return;
    }

    friendsMenuList.innerHTML = currentFriends.map((friend) => {
      const friendUsername = String(friend.username || friend.usernameKey || '').trim();
      const friendName = String(friend.fullname || friendUsername || '').trim();
      const safeUsername = escapeHtml(friendUsername);
      const safeName = escapeHtml(friendName);
      return `
        <li class="friends-item">
          <span class="friends-item-label">${safeName} (@${safeUsername})</span>
          <button type="button" class="friend-remove-btn" data-friend="${safeUsername}">Remove</button>
        </li>
      `;
    }).join('');

    friendsMenuList.querySelectorAll('.friend-remove-btn').forEach((btn) => {
      btn.addEventListener('click', async (event) => {
        event.stopPropagation();
        const friendUsername = String(btn.dataset.friend || '').trim();
        if (!friendUsername) return;
        try {
          const response = await fetch('/api/auth/friends/remove', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: user, friendUsername })
          });
          const payload = await response.json();
          if (!response.ok || !payload.ok) {
            throw new Error(payload && payload.error ? payload.error : 'Unable to remove friend');
          }
          renderFriendsList(payload.friends || []);
          setFriendsStatus(`Removed @${friendUsername}.`, false);
        } catch (error) {
          setFriendsStatus(error.message || 'Unable to remove friend.', true);
        }
      });
    });
  }

  async function loadFriends(force = false) {
    if (!force && friendsLoadedOnce) return;
    setFriendsStatus('Loading friends...');
    try {
      const response = await fetch(`/api/auth/friends?username=${encodeURIComponent(user)}`);
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        throw new Error(payload && payload.error ? payload.error : 'Unable to load friends');
      }
      renderFriendsList(payload.friends || []);
      friendsLoadedOnce = true;
      setFriendsStatus('');
    } catch (error) {
      renderFriendsList([]);
      setFriendsStatus(error.message || 'Unable to load friends.', true);
    }
  }

  async function addFriendByUsername() {
    const friendUsername = String(friendUsernameInput && friendUsernameInput.value || '').trim();
    if (!friendUsername) {
      setFriendsStatus('Enter a username first.', true);
      return;
    }
    setFriendsStatus('Adding friend...');
    try {
      const response = await fetch('/api/auth/friends/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user, friendUsername })
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        throw new Error(payload && payload.error ? payload.error : 'Unable to add friend');
      }
      renderFriendsList(payload.friends || []);
      if (friendUsernameInput) friendUsernameInput.value = '';
      setFriendsStatus(`Added @${friendUsername}.`, false);
      friendsLoadedOnce = true;
    } catch (error) {
      setFriendsStatus(error.message || 'Unable to add friend.', true);
    }
  }

  function openInstallGuideModal() {
    if (!installGuideModal) return;
    installGuideModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeInstallGuideModal() {
    if (!installGuideModal) return;
    installGuideModal.classList.add('hidden');
    document.body.style.overflow = '';
  }

  if (openInstallGuideBtn) {
    openInstallGuideBtn.addEventListener('click', (event) => {
      event.preventDefault();
      openInstallGuideModal();
    });
  }

  if (closeInstallGuideBtn) {
    closeInstallGuideBtn.addEventListener('click', closeInstallGuideModal);
  }

  if (installGuideModal) {
    installGuideModal.addEventListener('click', (event) => {
      if (event.target === installGuideModal) {
        closeInstallGuideModal();
      }
    });
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && installGuideModal && !installGuideModal.classList.contains('hidden')) {
      closeInstallGuideModal();
    }
  });

  // PWA Install Prompt Handler
  let deferredPrompt = null;
  if (!isInstalledApp) {
    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      deferredPrompt = event;
      console.log('[PWA] Install prompt available');
      if (downloadAppBtn) {
        downloadAppBtn.classList.remove('download-app-hidden');
      }
      if (installNowBtn) {
        installNowBtn.classList.remove('hidden');
      }
      if (installGuidePromptStatus) {
        installGuidePromptStatus.textContent = 'One-tap install is available on this device. Tap Install App Now or follow the manual steps.';
      }
    });

    window.addEventListener('appinstalled', () => {
      console.log('[PWA] App installed');
      deferredPrompt = null;
      if (downloadAppBtn) {
        downloadAppBtn.classList.add('download-app-hidden');
      }
      if (installNowBtn) {
        installNowBtn.classList.add('hidden');
      }
      if (installGuidePromptStatus) {
        installGuidePromptStatus.textContent = 'App installed. You can launch it from your Home Screen.';
      }
    });
  }

  async function promptInstallIfAvailable() {
    if (!deferredPrompt) {
      openInstallGuideModal();
      return false;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`[PWA] User response to install prompt: ${outcome}`);
    deferredPrompt = null;

    if (installNowBtn) {
      installNowBtn.classList.add('hidden');
    }
    if (downloadAppBtn) {
      downloadAppBtn.classList.add('download-app-hidden');
    }
    if (installGuidePromptStatus) {
      installGuidePromptStatus.textContent = outcome === 'accepted'
        ? 'Install accepted. The app icon should appear shortly.'
        : 'Install prompt dismissed. You can still install using the manual steps.';
    }
    return outcome === 'accepted';
  }

  if (!isInstalledApp && downloadAppBtn) {
    downloadAppBtn.addEventListener('click', async () => {
      await promptInstallIfAvailable();
    });
  }

  if (!isInstalledApp && installNowBtn) {
    installNowBtn.addEventListener('click', async () => {
      await promptInstallIfAvailable();
    });
  }

  let dashboardTheme = 'dark';

  function loadDashboardThemePreference() {
    try {
      if (typeof resolveSiteThemePreference === 'function') {
        dashboardTheme = resolveSiteThemePreference() === 'light' ? 'light' : 'dark';
        return;
      }
      if (typeof getUserThemePreference === 'function') {
        dashboardTheme = getUserThemePreference(user, 'dark');
        return;
      }
      dashboardTheme = localStorage.getItem('dashboardTheme') === 'light' ? 'light' : 'dark';
    } catch (e) {
      dashboardTheme = 'dark';
    }
  }

  function saveDashboardThemePreference() {
    if (user && typeof setUserThemePreference === 'function') {
      try {
        setUserThemePreference(user, dashboardTheme);
      } catch (_error) {
        // ignore and still persist dashboardTheme fallback
      }
    }

    try {
      localStorage.setItem('dashboardTheme', dashboardTheme);
    } catch (e) {
      // ignore
    }
  }

  function setThemeToggleIcon(button, theme) {
    if (!button) return;
    const isLight = theme === 'light';
    button.innerHTML = isLight ? 'Mode: &#9728;' : 'Mode: &#127769;';
    button.setAttribute('aria-label', isLight ? 'Switch to dark mode' : 'Switch to light mode');
    button.setAttribute('title', isLight ? 'Switch to dark mode' : 'Switch to light mode');
  }

  function applyDashboardTheme() {
    const isLight = dashboardTheme === 'light';
    document.body.classList.toggle('dashboard-light-mode', isLight);
    document.body.classList.toggle('light-mode', isLight);
    if (typeof window.applySiteThemePreference === 'function') {
      window.applySiteThemePreference(dashboardTheme);
    }
    if (!toggleDashboardThemeBtn) return;
    setThemeToggleIcon(toggleDashboardThemeBtn, dashboardTheme);
    toggleDashboardThemeBtn.setAttribute('aria-pressed', dashboardTheme === 'light' ? 'true' : 'false');
  }

  function toggleDashboardTheme() {
    dashboardTheme = dashboardTheme === 'light' ? 'dark' : 'light';
    saveDashboardThemePreference();
    applyDashboardTheme();
  }

  loadDashboardThemePreference();
  applyDashboardTheme();

  function formatFeedTime(pubDate) {
    if (!pubDate) return '';
    const parsed = new Date(pubDate);
    if (Number.isNaN(parsed.getTime())) return '';

    const absoluteTime = new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    }).format(parsed);

    if (parsed.getTime() > Date.now()) {
      return absoluteTime;
    }

    const diffMs = parsed.getTime() - Date.now();
    const absDiffMinutes = Math.abs(Math.round(diffMs / 60000));
    const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

    if (absDiffMinutes < 60) {
      return formatter.format(Math.round(diffMs / 60000), 'minute');
    }

    const diffHours = Math.round(diffMs / 3600000);
    if (Math.abs(diffHours) < 24) {
      return formatter.format(diffHours, 'hour');
    }

    const diffDays = Math.round(diffMs / 86400000);
    return formatter.format(diffDays, 'day');
  }

  async function loadSportsNewsFeed() {
    if (!newsFeedList) return;
    try {
      const response = await fetch('/api/rss/sports-news');
      const payload = await response.json();

      if (!response.ok || !payload.ok || !Array.isArray(payload.items) || payload.items.length === 0) {
        throw new Error('No feed items available');
      }

      const items = payload.items.slice(0, 6);
      newsFeedList.innerHTML = items.map((item) => {
        const title = item.title || 'Untitled update';
        const source = item.source || 'RSS';
        const timeText = formatFeedTime(item.publishedAt || item.pubDate);
        const timeMarkup = timeText ? `<span class="feed-time">${timeText}</span>` : '';
        return `
          <li class="news-story-card">
            <a class="news-story-link" href="${item.link}" target="_blank" rel="noopener noreferrer">
              <div class="news-story-topline">
                <span class="feed-source-badge">${source}</span>
                ${timeMarkup}
              </div>
              <div class="news-story-title">${title}</div>
            </a>
          </li>
        `;
      }).join('');

      if (newsFeedStatus) {
        newsFeedStatus.textContent = '';
        newsFeedStatus.classList.add('hidden');
      }
    } catch (error) {
      if (newsFeedStatus) {
        newsFeedStatus.textContent = 'Live feed is temporarily unavailable. Check back shortly.';
        newsFeedStatus.classList.remove('hidden');
      }
      newsFeedList.innerHTML = [
        '<li>Weekly update spotlight</li>',
        '<li>Recent gameplay changes</li>',
        '<li>Upcoming feature notes</li>'
      ].join('');
    }
  }

  loadSportsNewsFeed();

  // wallet display
  function getWallet(){ try{ const raw = localStorage.getItem('wallet'); return raw ? JSON.parse(raw) : { balance:0 }; }catch(e){ return { balance:0 }; } }
  function refreshWallet(){ if(walletBalanceEl){ walletBalanceEl.textContent = '$' + (Number(getWallet().balance)||0).toFixed(2); } }
  refreshWallet();
  // refresh when storage changes or custom event fired
  window.addEventListener('storage', (e)=>{ if(e.key === 'wallet') refreshWallet(); });
  window.addEventListener('wallet-updated', ()=>{ refreshWallet(); });
  if(openWalletBtn){ openWalletBtn.addEventListener('click', ()=>{ window.location.href = 'wallet.html'; }); }

  // Account menu toggle
  if(accountBtn){
    accountBtn.addEventListener('click', ()=>{
      accountMenu.classList.toggle('show');
      // Hide submenu when main menu closes
      if (completedDraftsMenu) completedDraftsMenu.classList.remove('show');
    });
  }

  if (toggleDashboardThemeBtn) {
    toggleDashboardThemeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleDashboardTheme();
    });
  }

  if (editAccountBtn) {
    editAccountBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      window.location.href = 'account.html';
    });
  }

  if (openFriendsBtn) {
    openFriendsBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const previous = parseFriendsNoticeState();
      saveFriendsNoticeState({
        lastOutgoing: previous.lastOutgoing,
        lastFriends: previous.lastFriends,
        unreadAccepted: []
      });
      setFriendsNoticeCount(0);
      window.location.href = 'friends.html';
    });
  }

  if (addFriendBtn) {
    addFriendBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await addFriendByUsername();
    });
  }

  if (friendUsernameInput) {
    friendUsernameInput.addEventListener('click', (e) => e.stopPropagation());
    friendUsernameInput.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        await addFriendByUsername();
      }
    });
  }

  if (deleteAccountMenuBtn) {
    deleteAccountMenuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      window.location.href = 'account.html#delete-account';
    });
  }

  refreshFriendsNotice();
  const friendsNoticePoll = setInterval(refreshFriendsNotice, 10000);
  window.addEventListener('beforeunload', () => {
    clearInterval(friendsNoticePoll);
  });

  // Completed drafts page
  if(completedDraftsBtn){
    completedDraftsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      window.location.href = 'recent-drafts.html';
    });
  }

  // Close menus when clicking outside
  document.addEventListener('click', (e) => {
    if (!accountMenu.contains(e.target) && !accountBtn.contains(e.target)) {
      accountMenu.classList.remove('show');
      if (completedDraftsMenu) completedDraftsMenu.classList.remove('show');
      if (friendsMenuPanel) friendsMenuPanel.classList.add('hidden');
    }
  });

  const LOBBY_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const LOBBY_CODE_LENGTH = 6;

  function generateLobbyCode(existingDrafts = {}) {
    const draftMap = existingDrafts && typeof existingDrafts === 'object' ? existingDrafts : {};
    for (let attempt = 0; attempt < 200; attempt += 1) {
      let code = '';
      for (let i = 0; i < LOBBY_CODE_LENGTH; i += 1) {
        const idx = Math.floor(Math.random() * LOBBY_CODE_ALPHABET.length);
        code += LOBBY_CODE_ALPHABET.charAt(idx);
      }
      if (!draftMap[code]) return code;
    }

    let fallback = '';
    for (let i = 0; i < LOBBY_CODE_LENGTH; i += 1) {
      const idx = Math.floor(Math.random() * LOBBY_CODE_ALPHABET.length);
      fallback += LOBBY_CODE_ALPHABET.charAt(idx);
    }
    return fallback;
  }

  // CTA: join a public draft (find one with available capacity or create a new public draft)
  if(joinDraft) joinDraft.addEventListener('click', (e)=>{
    e.preventDefault();
    const draftsRaw = localStorage.getItem('drafts');
    const drafts = draftsRaw ? JSON.parse(draftsRaw) : {};
    // find a public draft with available space
    let chosen = null;
    for(const k of Object.keys(drafts)){
      const d = drafts[k];
      if(d && d.public){
        const cap = d.capacity ? d.capacity : null;
        const size = d.members ? d.members.length : 0;
        if(!cap || size < cap){ chosen = k; break; }
      }
    }
    // if none found, create one via server if available
    if(!chosen){
      chosen = generateLobbyCode(drafts);
      drafts[chosen] = { members: [], public: true, capacity: 10 };
    }
    // try server-authoritative join if possible
    try{
      if(window.io){
        const socket = io({ reconnection: false });
        socket.emit('createAndJoinDraft', chosen, drafts[chosen], user, (resp)=>{
          if(!resp || !resp.ok){
            if(resp && resp.reason === 'capacity') alert('No public drafts available (all full). Try again later.');
            else alert('Could not join public draft');
            return;
          }
          // merge and navigate
          const draftsRaw2 = localStorage.getItem('drafts');
          const drafts2 = draftsRaw2 ? JSON.parse(draftsRaw2) : {};
          drafts2[chosen] = resp.draft;
          localStorage.setItem('drafts', JSON.stringify(drafts2));
          sessionStorage.setItem('currentDraft', chosen);
          window.location.href = (resp.draft && resp.draft.public) ? 'lobby-public.html' : 'lobby-private.html';
        });
        return;
      }
    }catch(e){ console.warn('socket create/join failed, falling back to local'); }
    // fallback: local join
    const cap = drafts[chosen].capacity ? drafts[chosen].capacity : null;
    if(cap && drafts[chosen].members.length >= cap && !drafts[chosen].members.includes(user)){
      alert('No public drafts available (all full). Try again later.');
      return;
    }
    if(!drafts[chosen].members.includes(user)) drafts[chosen].members.push(user);
    localStorage.setItem('drafts', JSON.stringify(drafts));
  sessionStorage.setItem('currentDraft', chosen);
  window.location.href = drafts[chosen].public ? 'lobby-public.html' : 'lobby-private.html';
  });
  if(joinPrivate) joinPrivate.addEventListener('click', (e)=>{ e.preventDefault(); window.location.href = 'join-private.html'; });
  const startPrivate = document.getElementById('startPrivate');
  if(startPrivate){
    startPrivate.addEventListener('click', async (e)=>{
      e.preventDefault();
      // generate a short unique code
      const code = generateLobbyCode(JSON.parse(localStorage.getItem('drafts') || '{}'));
      const usersRaw = localStorage.getItem('users');
      // create draft and add current user
      const draftsRaw = localStorage.getItem('drafts');
      const drafts = draftsRaw ? JSON.parse(draftsRaw) : {};
      drafts[code] = drafts[code] || { members: [], capacity: 10 };
      // try server create & join
      try{
        if(window.io){
          const socket = io({ reconnection: false });
          socket.emit('createAndJoinDraft', code, drafts[code], user, async (resp)=>{
            const invite = `${location.origin}/${code}`;
            if(!resp || !resp.ok){ alert('Could not create draft'); return; }
            // merge server state
            const draftsRaw2 = localStorage.getItem('drafts');
            const drafts2 = draftsRaw2 ? JSON.parse(draftsRaw2) : {};
            drafts2[code] = resp.draft;
            localStorage.setItem('drafts', JSON.stringify(drafts2));
            sessionStorage.setItem('currentDraft', code);
            try{ await navigator.clipboard.writeText(invite); }
            catch(_){ }
            window.location.href = (resp.draft && resp.draft.public) ? 'lobby-public.html' : 'lobby-private.html';
          });
          return;
        }
      }catch(e){ console.warn('socket create failed, falling back to local', e); }
      // fallback local
      if(!drafts[code].members.includes(user)) drafts[code].members.push(user);
      localStorage.setItem('drafts', JSON.stringify(drafts));
  sessionStorage.setItem('currentDraft', code);
  const invite = `${location.origin}/${code}`;
  try{ await navigator.clipboard.writeText(invite); }
  catch(_){ }
  window.location.href = drafts[code].public ? 'lobby-public.html' : 'lobby-private.html';
    });
  }
  const startPublic = document.getElementById('startPublic');
  if(startPublic){
    startPublic.addEventListener('click', async (e)=>{
      e.preventDefault();
      const code = generateLobbyCode(JSON.parse(localStorage.getItem('drafts') || '{}'));
      const draftsRaw = localStorage.getItem('drafts');
      const drafts = draftsRaw ? JSON.parse(draftsRaw) : {};
      drafts[code] = drafts[code] || { members: [], public: true, capacity: 10 };
      try{
        if(window.io){
          const socket = io({ reconnection: false });
          socket.emit('createAndJoinDraft', code, drafts[code], user, async (resp)=>{
            const invite = `${location.origin}/${code}`;
            if(!resp || !resp.ok){ alert('Could not start public draft'); return; }
            const draftsRaw2 = localStorage.getItem('drafts');
            const drafts2 = draftsRaw2 ? JSON.parse(draftsRaw2) : {};
            drafts2[code] = resp.draft;
            localStorage.setItem('drafts', JSON.stringify(drafts2));
            sessionStorage.setItem('currentDraft', code);
            try{ await navigator.clipboard.writeText(invite); alert('Public draft started. Invite link copied: '+invite); }
            catch(_){ alert('Public draft started. Invite link: '+invite); }
            window.location.href = (resp.draft && resp.draft.public) ? 'lobby-public.html' : 'lobby-private.html';
          });
          return;
        }
      }catch(e){ console.warn('socket create/join failed', e); }
      // fallback local
      if(!drafts[code].members.includes(user)) drafts[code].members.push(user);
      localStorage.setItem('drafts', JSON.stringify(drafts));
  sessionStorage.setItem('currentDraft', code);
  const invite = `${location.origin}/${code}`;
  try{ await navigator.clipboard.writeText(invite); alert('Public draft started. Invite link copied: '+invite); }
  catch(_){ alert('Public draft started. Invite link: '+invite); }
  window.location.href = drafts[code].public ? 'lobby-public.html' : 'lobby-private.html';
    });
  }

  logoutBtn.addEventListener('click', ()=>{
    Promise.resolve(auth ? signOut(auth) : null)
      .catch((error) => console.warn('[dashboard] sign out failed', error))
      .finally(() => {
        clearAuthSession();
        window.location.href = 'index.html';
      });
  });
});
