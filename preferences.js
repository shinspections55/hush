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
  var APP_LAST_ROUTE_KEY = 'hushLastAppRoute';
  var APP_SPLASH_SEEN_KEY = 'hushAppSplashSeen';

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

  function enforceAppViewportLock() {
    try {
      var head = document.head || document.getElementsByTagName('head')[0];
      if (!head) return;

      var viewport = head.querySelector('meta[name="viewport"]');
      if (!viewport) {
        viewport = document.createElement('meta');
        viewport.setAttribute('name', 'viewport');
        head.appendChild(viewport);
      }

      viewport.setAttribute(
        'content',
        'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover'
      );

      if (document.documentElement) {
        document.documentElement.style.touchAction = 'manipulation';
      }

      // iOS Safari specific pinch-zoom prevention in standalone mode.
      var preventGestureZoom = function (event) {
        event.preventDefault();
      };

      document.addEventListener('gesturestart', preventGestureZoom, { passive: false });
      document.addEventListener('gesturechange', preventGestureZoom, { passive: false });
      document.addEventListener('gestureend', preventGestureZoom, { passive: false });
    } catch (_error) {
      // ignore viewport lock failures
    }
  }

  function routePathname(routeValue) {
    var route = String(routeValue || '');
    if (!route) return '';
    var withoutQuery = route.split('?')[0];
    return withoutQuery.split('#')[0];
  }

  function getCurrentRoute() {
    var path = currentPathname();
    var search = '';
    var hash = '';
    try {
      search = String(window.location.search || '');
      hash = String(window.location.hash || '');
    } catch (_error) {
      // ignore
    }
    return path + search + hash;
  }

  function rememberCurrentRoute() {
    try {
      var route = getCurrentRoute();
      var path = routePathname(route);
      if (!path || isGuestLikeRoute(path)) return;
      localStorage.setItem(APP_LAST_ROUTE_KEY, route);
    } catch (_error) {
      // ignore route persistence errors
    }
  }

  function resolveLaunchRoute(currentRoute) {
    try {
      var currentPath = routePathname(currentRoute);
      if (/\/dashboard\.html$/i.test(currentPath)) return '';
      return 'dashboard.html#home';
    } catch (_error) {
      return '';
    }
  }

  function addSplashStyles() {
    if (document.getElementById('hushAppSplashStyles')) return;
    var style = document.createElement('style');
    style.id = 'hushAppSplashStyles';
    style.textContent = [
      '.hush-app-splash {',
      '  position: fixed;',
      '  inset: 0;',
      '  z-index: 22000;',
      '  display: flex;',
      '  align-items: center;',
      '  justify-content: center;',
      '  overflow: hidden;',
      '  background: radial-gradient(circle at 50% 40%, rgba(29, 72, 120, 0.22) 0%, rgba(2, 6, 23, 0.985) 52%, #020617 100%);',
      '}',
      '.hush-app-splash.is-exit { animation: hushSplashFadeOut 380ms ease forwards; }',
      '.hush-app-splash-smoke, .hush-app-splash-smoke::before, .hush-app-splash-smoke::after {',
      '  content: "";',
      '  position: absolute;',
      '  width: 75vmax;',
      '  height: 75vmax;',
      '  border-radius: 50%;',
      '  filter: blur(42px);',
      '  opacity: 0;',
      '  background: radial-gradient(circle, rgba(151, 179, 204, 0.24) 0%, rgba(95, 122, 148, 0.09) 45%, rgba(2, 6, 23, 0) 72%);',
      '  animation: hushSmokeDrift 3s ease-out forwards;',
      '}',
      '.hush-app-splash-smoke { transform: translate(-18%, 22%); }',
      '.hush-app-splash-smoke::before { transform: translate(24%, -34%) scale(0.88); animation-delay: 160ms; }',
      '.hush-app-splash-smoke::after { transform: translate(-26%, -38%) scale(1.05); animation-delay: 260ms; }',
      '.hush-app-splash-glow {',
      '  position: absolute;',
      '  width: 224px;',
      '  height: 224px;',
      '  border-radius: 50%;',
      '  background: radial-gradient(circle, rgba(92, 168, 232, 0.62) 0%, rgba(37, 91, 143, 0.22) 42%, rgba(2, 6, 23, 0) 70%);',
      '  opacity: 0;',
      '  animation: hushGlowPulse 3s ease forwards;',
      '}',
      '.hush-app-splash-logo-wrap {',
      '  position: relative;',
      '  display: flex;',
      '  flex-direction: column;',
      '  align-items: center;',
      '  justify-content: center;',
      '  gap: 10px;',
      '  opacity: 0;',
      '  transform: translateY(8px) scale(0.92);',
      '  animation: hushLogoReveal 3s ease forwards;',
      '}',
      '.hush-app-splash-logo {',
      '  width: min(36vw, 166px);',
      '  max-width: 166px;',
      '  min-width: 104px;',
      '  filter: drop-shadow(0 10px 30px rgba(129, 189, 237, 0.34));',
      '}',
      '.hush-app-splash-laces {',
      '  position: absolute;',
      '  width: min(22vw, 98px);',
      '  height: 14px;',
      '  top: 50%;',
      '  left: 50%;',
      '  transform: translate(-50%, -50%);',
      '  border-radius: 999px;',
      '  background: repeating-linear-gradient(90deg, rgba(212, 231, 246, 0.04) 0 7px, rgba(212, 231, 246, 0.78) 7px 9px);',
      '  box-shadow: 0 0 0 rgba(120, 185, 236, 0);',
      '  opacity: 0;',
      '  mix-blend-mode: screen;',
      '  animation: hushLacesIn 3s ease forwards;',
      '}',
      '.hush-app-splash-metal {',
      '  position: absolute;',
      '  inset: 0;',
      '  border-radius: 16px;',
      '  background: linear-gradient(105deg, rgba(255,255,255,0) 22%, rgba(255,255,255,0.88) 47%, rgba(255,255,255,0) 68%);',
      '  mix-blend-mode: screen;',
      '  transform: translateX(-170%) skewX(-8deg);',
      '  animation: hushMetalSweep 3s ease forwards;',
      '  pointer-events: none;',
      '}',
      '.hush-app-splash-title {',
      '  margin: 0;',
      '  font-size: clamp(26px, 5.6vw, 42px);',
      '  letter-spacing: 0.24em;',
      '  color: #dfeaf4;',
      '  text-shadow: 0 0 18px rgba(119, 177, 224, 0.26);',
      '  opacity: 0;',
      '  animation: hushTitleIn 3s ease forwards;',
      '}',
      '@keyframes hushSmokeDrift {',
      '  0% { opacity: 0; transform: translate(-18%, 22%) scale(0.9); }',
      '  26.67% { opacity: 0.62; transform: translate(-7%, 9%) scale(1.01); }',
      '  50% { opacity: 0.55; transform: translate(0%, 0%) scale(1.08); }',
      '  73.33% { opacity: 0.26; transform: translate(7%, -9%) scale(1.14); }',
      '  100% { opacity: 0; transform: translate(12%, -16%) scale(1.18); }',
      '}',
      '@keyframes hushGlowPulse {',
      '  0% { opacity: 0; transform: scale(0.78); }',
      '  26.67% { opacity: 0.82; transform: scale(1.01); }',
      '  50% { opacity: 0.62; transform: scale(1.06); }',
      '  73.33% { opacity: 0.5; transform: scale(1.1); }',
      '  88% { opacity: 0.94; transform: scale(1.03); }',
      '  100% { opacity: 0.34; transform: scale(1.17); }',
      '}',
      '@keyframes hushLogoReveal {',
      '  0% { opacity: 0; transform: translateY(8px) scale(0.9); }',
      '  26.67% { opacity: 0; transform: translateY(8px) scale(0.9); }',
      '  50% { opacity: 0.98; transform: translateY(0) scale(1); }',
      '  100% { opacity: 1; transform: translateY(0) scale(1); }',
      '}',
      '@keyframes hushLacesIn {',
      '  0%, 26.67% { opacity: 0; box-shadow: 0 0 0 rgba(120, 185, 236, 0); }',
      '  36% { opacity: 0.95; box-shadow: 0 0 16px rgba(120, 185, 236, 0.72); }',
      '  50% { opacity: 0.55; box-shadow: 0 0 8px rgba(120, 185, 236, 0.36); }',
      '  73.33%, 100% { opacity: 0; box-shadow: 0 0 0 rgba(120, 185, 236, 0); }',
      '}',
      '@keyframes hushMetalSweep {',
      '  0%, 50% { transform: translateX(-185%) skewX(-8deg); opacity: 0; }',
      '  58% { opacity: 1; }',
      '  73.33% { transform: translateX(185%) skewX(-8deg); opacity: 0.94; }',
      '  100% { transform: translateX(185%) skewX(-8deg); opacity: 0; }',
      '}',
      '@keyframes hushTitleIn {',
      '  0%, 50% { opacity: 0; transform: translateY(8px); }',
      '  73.33% { opacity: 1; transform: translateY(0); }',
      '  100% { opacity: 1; transform: translateY(0); }',
      '}',
      '@supports (-webkit-touch-callout: none) {',
      '  .hush-app-splash-metal { background: linear-gradient(106deg, rgba(255,255,255,0) 20%, rgba(255,255,255,0.96) 48%, rgba(255,255,255,0) 70%); }',
      '  .hush-app-splash-logo { filter: drop-shadow(0 14px 34px rgba(148, 206, 247, 0.42)); }',
      '}',
      '@keyframes hushSplashFadeOut {',
      '  from { opacity: 1; }',
      '  to { opacity: 0; visibility: hidden; }',
      '}',
      '@media (prefers-reduced-motion: reduce) {',
      '  .hush-app-splash-smoke, .hush-app-splash-smoke::before, .hush-app-splash-smoke::after, .hush-app-splash-glow, .hush-app-splash-logo-wrap, .hush-app-splash-metal, .hush-app-splash-laces, .hush-app-splash-title { animation: none; opacity: 1; transform: none; }',
      '}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function showAppSplash(onFinish) {
    addSplashStyles();
    if (document.getElementById('hushAppSplash')) {
      if (typeof onFinish === 'function') onFinish();
      return;
    }

    var splash = document.createElement('div');
    splash.id = 'hushAppSplash';
    splash.className = 'hush-app-splash';
    splash.setAttribute('aria-hidden', 'true');
    splash.innerHTML = [
      '<div class="hush-app-splash-smoke"></div>',
      '<div class="hush-app-splash-glow"></div>',
      '<div class="hush-app-splash-logo-wrap">',
      '  <div style="position:relative;display:inline-flex;align-items:center;justify-content:center;">',
      '    <img class="hush-app-splash-logo" src="/HUSHLOGO.png" alt="">',
      '    <div class="hush-app-splash-laces"></div>',
      '    <div class="hush-app-splash-metal"></div>',
      '  </div>',
      '  <h1 class="hush-app-splash-title">HUSH</h1>',
      '</div>'
    ].join('');

    document.body.appendChild(splash);

    setTimeout(function () {
      splash.classList.add('is-exit');
      setTimeout(function () {
        if (splash.parentNode) splash.parentNode.removeChild(splash);
        if (typeof onFinish === 'function') onFinish();
      }, 420);
    }, 3000);
  }

  function addShellStyles() {
    if (document.getElementById('pwaShellStyles')) return;
    var style = document.createElement('style');
    style.id = 'pwaShellStyles';
    style.textContent = [
      ':root { --app-safe-top: env(safe-area-inset-top); --app-safe-right: env(safe-area-inset-right); --app-safe-bottom: env(safe-area-inset-bottom); --app-safe-left: env(safe-area-inset-left); }',
      'html.pwa-installed, body.pwa-installed { width: 100%; max-width: 100%; min-height: 100svh; min-height: 100dvh; overflow-x: hidden; }',
      'body.pwa-installed { padding-left: var(--app-safe-left); padding-right: var(--app-safe-right); box-sizing: border-box; }',
      'body.pwa-installed .page, body.pwa-installed .container, body.pwa-installed .dashboard-main-centered { box-sizing: border-box; max-width: 100%; }',
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

    enforceAppViewportLock();

    var currentRoute = getCurrentRoute();
    var launchRoute = resolveLaunchRoute(currentRoute);

    var hasSeenSplash = false;
    try {
      hasSeenSplash = sessionStorage.getItem(APP_SPLASH_SEEN_KEY) === '1';
    } catch (_error) {
      hasSeenSplash = false;
    }

    if (!hasSeenSplash) {
      try {
        sessionStorage.setItem(APP_SPLASH_SEEN_KEY, '1');
      } catch (_error) {
        // ignore
      }
      showAppSplash(function () {
        if (launchRoute) {
          window.location.href = launchRoute;
          return;
        }
        rememberCurrentRoute();
      });
    } else {
      rememberCurrentRoute();
    }

    window.addEventListener('pagehide', rememberCurrentRoute);

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
