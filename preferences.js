// preferences.js — shared per-user preference helpers
try {
  if (!sessionStorage.getItem('username')) {
    const rememberedUsername = String(localStorage.getItem('lastSignedInUsername') || '').trim();
    if (rememberedUsername) {
      sessionStorage.setItem('username', rememberedUsername);
    }
  }
  if (!sessionStorage.getItem('userEmail')) {
    const rememberedEmail = String(localStorage.getItem('lastSignedInEmail') || '').trim();
    if (rememberedEmail) {
      sessionStorage.setItem('userEmail', rememberedEmail);
    }
  }
} catch (_error) {
  // ignore session restore errors
}

// Ensure a consistent tab icon across the app without duplicating favicon tags in every HTML file.
try {
  const head = document.head || document.getElementsByTagName('head')[0];
  if (head) {
    let favicon = head.querySelector('link[rel="icon"]');
    if (!favicon) {
      favicon = document.createElement('link');
      favicon.setAttribute('rel', 'icon');
      head.appendChild(favicon);
    }
    favicon.setAttribute('type', 'image/png');
    favicon.setAttribute('href', '/HUSHLOGO.png');
  }
} catch (_error) {
  // ignore favicon setup errors
}

function getUsersPreferenceStore() {
  try {
    const raw = localStorage.getItem('users');
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function setUsersPreferenceStore(users) {
  localStorage.setItem('users', JSON.stringify(users));
}

function getUserPreferences(username) {
  if (!username) return {};
  const users = getUsersPreferenceStore();
  return users?.[username]?.preferences || {};
}

function updateUserPreferences(username, updates) {
  if (!username) return {};
  try {
    const users = getUsersPreferenceStore();
    users[username] = users[username] || {};
    users[username].preferences = {
      ...(users[username].preferences || {}),
      ...updates
    };
    setUsersPreferenceStore(users);
    return users[username].preferences;
  } catch (e) {
    console.warn('updateUserPreferences error', e);
    return {};
  }
}

function getUserThemePreference(username, fallback = 'dark') {
  const preferences = getUserPreferences(username);
  return preferences.theme === 'light' ? 'light' : fallback;
}

function setUserThemePreference(username, theme) {
  return updateUserPreferences(username, { theme: theme === 'light' ? 'light' : 'dark' });
}

// PWA app shell: show app-only navigation and controls when running installed.
(function initPwaAppShell() {
  function isInstalledPwa() {
    try {
      var standaloneDisplay = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
      var iosStandalone = window.navigator && window.navigator.standalone === true;
      return Boolean(standaloneDisplay || iosStandalone);
    } catch (_error) {
      return false;
    }
  }

  function isGuestLikeRoute(pathname) {
    var route = String(pathname || '').toLowerCase();
    return route.endsWith('/index.html') ||
      route.endsWith('/register.html') ||
      route.endsWith('/forgot-password.html') ||
      route.endsWith('/reset-password.html');
  }

  function currentPathname() {
    try {
      return String(window.location.pathname || '');
    } catch (_error) {
      return '';
    }
  }

  function isDraftRoute(pathname) {
    var route = String(pathname || '').toLowerCase();
    return route.endsWith('/silentdraft.html') || route.endsWith('/rounds3draft.html');
  }

  function addShellStyles() {
    if (document.getElementById('pwaShellStyles')) return;
    var style = document.createElement('style');
    style.id = 'pwaShellStyles';
    style.textContent = [
      '.pwa-installed body, body.pwa-installed { padding-bottom: calc(86px + env(safe-area-inset-bottom)); }',
      '.pwa-bottom-nav {',
      '  position: fixed;',
      '  left: 0;',
      '  right: 0;',
      '  bottom: 0;',
      '  z-index: 12000;',
      '  display: grid;',
      '  grid-template-columns: repeat(4, minmax(0, 1fr));',
      '  gap: 6px;',
      '  padding: 10px 10px calc(10px + env(safe-area-inset-bottom));',
      '  border-top: 1px solid rgba(255,255,255,0.18);',
      '  background: linear-gradient(180deg, rgba(9,22,32,0.94) 0%, rgba(8,14,20,0.98) 100%);',
      '  backdrop-filter: blur(12px);',
      '}',
      '.pwa-nav-btn {',
      '  appearance: none;',
      '  border: 0;',
      '  border-radius: 14px;',
      '  min-height: 56px;',
      '  color: #d4e4ed;',
      '  background: rgba(255,255,255,0.06);',
      '  font-weight: 700;',
      '  font-size: 12px;',
      '  line-height: 1.2;',
      '  display: flex;',
      '  flex-direction: column;',
      '  align-items: center;',
      '  justify-content: center;',
      '  gap: 4px;',
      '  letter-spacing: 0.02em;',
      '}',
      '.pwa-nav-btn.is-active {',
      '  background: rgba(86, 172, 219, 0.28);',
      '  color: #ffffff;',
      '  box-shadow: inset 0 0 0 1px rgba(153,225,255,0.45);',
      '}',
      '.pwa-nav-btn .pwa-nav-icon { font-size: 17px; line-height: 1; }',
      '.pwa-settings-sheet {',
      '  position: fixed;',
      '  left: 0;',
      '  right: 0;',
      '  bottom: 0;',
      '  z-index: 12020;',
      '  transform: translateY(100%);',
      '  transition: transform 220ms ease;',
      '  background: #0e1d28;',
      '  color: #e8f4fb;',
      '  border-top-left-radius: 16px;',
      '  border-top-right-radius: 16px;',
      '  box-shadow: 0 -14px 38px rgba(0, 0, 0, 0.42);',
      '  padding: 14px 14px calc(20px + env(safe-area-inset-bottom));',
      '}',
      '.pwa-settings-sheet.is-open { transform: translateY(0); }',
      '.pwa-settings-title { margin: 0 0 10px 0; font-size: 16px; font-weight: 800; }',
      '.pwa-settings-grid { display: grid; gap: 8px; grid-template-columns: 1fr 1fr; }',
      '.pwa-settings-action {',
      '  border: 1px solid rgba(173, 220, 246, 0.34);',
      '  border-radius: 12px;',
      '  background: rgba(255,255,255,0.04);',
      '  color: #eff8ff;',
      '  min-height: 46px;',
      '  font-weight: 700;',
      '  font-size: 13px;',
      '}',
      '.pwa-settings-close { margin-top: 10px; width: 100%; }',
      '.pwa-settings-backdrop {',
      '  position: fixed;',
      '  inset: 0;',
      '  z-index: 12010;',
      '  background: rgba(3, 8, 12, 0.45);',
      '  opacity: 0;',
      '  pointer-events: none;',
      '  transition: opacity 220ms ease;',
      '}',
      '.pwa-settings-backdrop.is-open { opacity: 1; pointer-events: auto; }',
      'body.pwa-app-light { background: #f3f8fd !important; color: #0c2231 !important; }',
      '@media (min-width: 900px) {',
      '  .pwa-bottom-nav { max-width: 640px; margin: 0 auto; border-top-left-radius: 16px; border-top-right-radius: 16px; left: 50%; transform: translateX(-50%); }',
      '  .pwa-settings-sheet { left: 50%; right: auto; width: 640px; transform: translate(-50%, 100%); border-top-left-radius: 16px; border-top-right-radius: 16px; }',
      '  .pwa-settings-sheet.is-open { transform: translate(-50%, 0); }',
      '}',
      '@media (prefers-reduced-motion: reduce) {',
      '  .pwa-settings-sheet, .pwa-settings-backdrop { transition: none; }',
      '}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function resolveActiveTab(pathname) {
    var route = String(pathname || '').toLowerCase();
    if (route.endsWith('/rankings.html')) return 'rankings';
    if (route.endsWith('/dashboard.html')) return 'home';
    if (route.endsWith('/lobby.html') || route.endsWith('/lobby-private.html') || route.endsWith('/lobby-public.html') || route.endsWith('/join-private.html')) return 'draft';
    return '';
  }

  function applyPwaTheme() {
    var theme = 'dark';
    try {
      var stored = localStorage.getItem('pwaAppTheme');
      theme = stored === 'light' ? 'light' : 'dark';
    } catch (_error) {
      theme = 'dark';
    }
    if (document.body) {
      document.body.classList.toggle('pwa-app-light', theme === 'light');
    }
    return theme;
  }

  function navigate(url) {
    window.location.href = url;
  }

  function buildShell() {
    if (document.getElementById('pwaBottomNav')) return;

    addShellStyles();
    var activeTab = resolveActiveTab(currentPathname());

    var nav = document.createElement('nav');
    nav.id = 'pwaBottomNav';
    nav.className = 'pwa-bottom-nav';
    nav.setAttribute('aria-label', 'App navigation');
    nav.innerHTML = [
      '<button type="button" class="pwa-nav-btn" data-tab="home"><span class="pwa-nav-icon" aria-hidden="true">🏠</span><span>Home</span></button>',
      '<button type="button" class="pwa-nav-btn" data-tab="rankings"><span class="pwa-nav-icon" aria-hidden="true">📋</span><span>Rankings</span></button>',
      '<button type="button" class="pwa-nav-btn" data-tab="draft"><span class="pwa-nav-icon" aria-hidden="true">🏈</span><span>Draft</span></button>',
      '<button type="button" class="pwa-nav-btn" data-tab="settings"><span class="pwa-nav-icon" aria-hidden="true">⚙️</span><span>Settings</span></button>'
    ].join('');

    var backdrop = document.createElement('div');
    backdrop.id = 'pwaSettingsBackdrop';
    backdrop.className = 'pwa-settings-backdrop';

    var themeLabel = applyPwaTheme() === 'light' ? 'Theme: Light' : 'Theme: Dark';
    var sheet = document.createElement('section');
    sheet.id = 'pwaSettingsSheet';
    sheet.className = 'pwa-settings-sheet';
    sheet.setAttribute('aria-label', 'Settings quick actions');
    sheet.innerHTML = [
      '<h2 class="pwa-settings-title">Settings</h2>',
      '<div class="pwa-settings-grid">',
      '  <button type="button" class="pwa-settings-action" data-action="wallet">Wallet</button>',
      '  <button type="button" class="pwa-settings-action" data-action="edit-account">Edit Account</button>',
      '  <button type="button" class="pwa-settings-action" data-action="delete-account">Delete Account</button>',
      '  <button type="button" class="pwa-settings-action" data-action="completed-drafts">Completed Drafts</button>',
      '  <button type="button" class="pwa-settings-action" data-action="theme" id="pwaThemeToggleBtn">' + themeLabel + '</button>',
      '  <button type="button" class="pwa-settings-action" data-action="logout">Log out</button>',
      '</div>',
      '<button type="button" class="pwa-settings-action pwa-settings-close" data-action="close-settings">Close</button>'
    ].join('');

    var tabs = nav.querySelectorAll('.pwa-nav-btn');
    tabs.forEach(function (button) {
      var tab = button.getAttribute('data-tab');
      if (tab === activeTab) {
        button.classList.add('is-active');
      }
      button.addEventListener('click', function () {
        if (tab === 'home') {
          navigate('dashboard.html#home');
          return;
        }
        if (tab === 'rankings') {
          navigate('rankings.html?draftView=off');
          return;
        }
        if (tab === 'draft') {
          navigate('dashboard.html#draft-actions');
          return;
        }
        if (tab === 'settings') {
          sheet.classList.add('is-open');
          backdrop.classList.add('is-open');
        }
      });
    });

    function closeSettings() {
      sheet.classList.remove('is-open');
      backdrop.classList.remove('is-open');
    }

    backdrop.addEventListener('click', closeSettings);

    sheet.addEventListener('click', function (event) {
      var trigger = event.target && event.target.closest('[data-action]');
      if (!trigger) return;
      var action = trigger.getAttribute('data-action');
      if (action === 'wallet') {
        navigate('wallet.html');
        return;
      }
      if (action === 'edit-account') {
        navigate('account.html');
        return;
      }
      if (action === 'delete-account') {
        navigate('account.html#delete-account');
        return;
      }
      if (action === 'completed-drafts') {
        navigate('recent-drafts.html');
        return;
      }
      if (action === 'theme') {
        var nextTheme = 'dark';
        try {
          var current = localStorage.getItem('pwaAppTheme') === 'light' ? 'light' : 'dark';
          nextTheme = current === 'light' ? 'dark' : 'light';
          localStorage.setItem('pwaAppTheme', nextTheme);
        } catch (_error) {
          nextTheme = 'dark';
        }
        if (document.body) {
          document.body.classList.toggle('pwa-app-light', nextTheme === 'light');
        }
        var themeBtn = document.getElementById('pwaThemeToggleBtn');
        if (themeBtn) {
          themeBtn.textContent = nextTheme === 'light' ? 'Theme: Light' : 'Theme: Dark';
        }
        return;
      }
      if (action === 'logout') {
        try {
          sessionStorage.removeItem('username');
          sessionStorage.removeItem('userEmail');
          sessionStorage.removeItem('currentDraft');
          localStorage.removeItem('lastSignedInUsername');
          localStorage.removeItem('lastSignedInEmail');
          localStorage.removeItem('rememberedEmail');
        } catch (_error) {
          // ignore logout cleanup errors
        }
        navigate('index.html');
        return;
      }
      if (action === 'close-settings') {
        closeSettings();
      }
    });

    document.body.appendChild(backdrop);
    document.body.appendChild(sheet);
    document.body.appendChild(nav);

    if (window.location.hash === '#draft-actions') {
      var draftActions = document.getElementById('draftActions');
      if (draftActions && draftActions.scrollIntoView) {
        setTimeout(function () {
          draftActions.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      }
    }
  }

  function boot() {
    var path = currentPathname();
    if (!isInstalledPwa() || isGuestLikeRoute(path)) {
      return;
    }
    document.documentElement.classList.add('pwa-installed');
    if (document.body) {
      document.body.classList.add('pwa-installed');
    }
    if (isDraftRoute(path)) {
      return;
    }
    buildShell();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
