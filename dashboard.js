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
    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
    window.navigator.standalone === true
  );

  let resolvedUser = sessionStorage.getItem('username');
  if (!resolvedUser) {
    try {
      const currentUser = await requireCurrentUser();
      const profile = syncSessionFromUser(currentUser);
      resolvedUser = profile && profile.username ? profile.username : '';
    } catch (_error) {
      if (!isInstalledApp) {
        window.location.href = 'index.html';
        return;
      }
      resolvedUser = '';
    }
  }

  const user = resolvedUser;
  const greeting = document.getElementById('greeting') || document.getElementById('welcomeUser');
  const welcomeText = document.getElementById('welcomeText');
  const logoutBtn = document.getElementById('logoutBtn');
  const accountBtn = document.getElementById('accountBtn');
  const accountMenu = document.getElementById('accountMenu');
  const editAccountBtn = document.getElementById('editAccountBtn');
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
  const appHomeLoginGate = document.getElementById('appHomeLoginGate');
  const appHomeLoginForm = document.getElementById('appHomeLoginForm');
  const appHomeEmailInput = document.getElementById('appHomeEmail');
  const appHomePasswordInput = document.getElementById('appHomePassword');
  const draftActionRow = document.querySelector('#draftActions .dashboard-cta-row');

  if(!user){
    if (!isInstalledApp) {
      // not logged in, redirect back to login for website mode
      window.location.href = 'index.html';
      return;
    }

    if (greeting) greeting.textContent = 'Welcome to Hush';
    if (welcomeText) welcomeText.textContent = 'Sign in to unlock drafts, rankings, wallet, and account features in the app.';
    if (walletBalanceEl) walletBalanceEl.classList.add('hidden');
    if (accountBtn) accountBtn.classList.add('hidden');
    if (accountMenu) accountMenu.classList.remove('show');
    if (draftActionRow) draftActionRow.classList.add('hidden');
    if (appHomeLoginGate) appHomeLoginGate.classList.remove('hidden');

    try {
      const alertKey = 'appHomeLoginPromptShown';
      if (!sessionStorage.getItem(alertKey)) {
        alert('Please sign in to continue.');
        sessionStorage.setItem(alertKey, '1');
      }
    } catch (_error) {
      // ignore storage errors
    }

    if (appHomeLoginForm) {
      appHomeLoginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const email = String(appHomeEmailInput && appHomeEmailInput.value || '').trim();
        const password = String(appHomePasswordInput && appHomePasswordInput.value || '');
        if (!email || !email.includes('@')) {
          alert('Enter a valid email address.');
          return;
        }
        if (!password) {
          alert('Enter your password.');
          return;
        }

        try {
          if (!auth) throw new Error('Firebase Auth is not configured yet.');
          await setPersistence(auth, browserLocalPersistence);
          const credential = await signInWithEmailAndPassword(auth, email, password);
          syncSessionFromUser(credential.user);
          window.location.href = 'dashboard.html#home';
        } catch (error) {
          alert(formatAuthError(error, 'Sign in failed.'));
        }
      });
    }

    return;
  }
  if (greeting) greeting.textContent = `Welcome, ${user}!`;
  if (welcomeText) welcomeText.textContent = 'This is your dashboard. Use the account menu to manage your account, sign out, or open your rankings.';

  // PWA Install Prompt Handler
  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    console.log('[PWA] Install prompt available');
    if (downloadAppBtn) {
      downloadAppBtn.classList.remove('download-app-hidden');
    }
  });

  window.addEventListener('appinstalled', () => {
    console.log('[PWA] App installed');
    deferredPrompt = null;
    if (downloadAppBtn) {
      downloadAppBtn.classList.add('download-app-hidden');
    }
  });

  if (downloadAppBtn) {
    downloadAppBtn.addEventListener('click', async () => {
      if (!deferredPrompt) {
        console.warn('[PWA] Install prompt not available');
        return;
      }
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`[PWA] User response to install prompt: ${outcome}`);
      deferredPrompt = null;
    });
  }

  let dashboardTheme = 'dark';

  function loadDashboardThemePreference() {
    try {
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
    try {
      if (typeof setUserThemePreference === 'function') {
        setUserThemePreference(user, dashboardTheme);
        return;
      }
      localStorage.setItem('dashboardTheme', dashboardTheme);
    } catch (e) {
      // ignore
    }
  }

  function applyDashboardTheme() {
    document.body.classList.toggle('dashboard-light-mode', dashboardTheme === 'light');
    if (!toggleDashboardThemeBtn) return;
    toggleDashboardThemeBtn.textContent = `Theme: ${dashboardTheme === 'light' ? 'Light' : 'Dark'}`;
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
        newsFeedStatus.textContent = 'Latest sports and fantasy headlines from live RSS feeds.';
      }
    } catch (error) {
      if (newsFeedStatus) {
        newsFeedStatus.textContent = 'Live feed is temporarily unavailable. Check back shortly.';
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

  if (deleteAccountMenuBtn) {
    deleteAccountMenuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      window.location.href = 'account.html#delete-account';
    });
  }

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
    }
  });

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
      chosen = (Math.random().toString(36).substr(2,6)).toUpperCase();
      drafts[chosen] = { members: [], public: true, capacity: 10 };
    }
    // try server-authoritative join if possible
    try{
      if(window.io){
        const socket = io();
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
      const code = (Math.random().toString(36).substr(2,6)).toUpperCase();
      const usersRaw = localStorage.getItem('users');
      // create draft and add current user
      const draftsRaw = localStorage.getItem('drafts');
      const drafts = draftsRaw ? JSON.parse(draftsRaw) : {};
      drafts[code] = drafts[code] || { members: [], capacity: 10 };
      // try server create & join
      try{
        if(window.io){
          const socket = io();
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
      const code = (Math.random().toString(36).substr(2,6)).toUpperCase();
      const draftsRaw = localStorage.getItem('drafts');
      const drafts = draftsRaw ? JSON.parse(draftsRaw) : {};
      drafts[code] = drafts[code] || { members: [], public: true, capacity: 10 };
      try{
        if(window.io){
          const socket = io();
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
