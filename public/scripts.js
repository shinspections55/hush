import {
  browserLocalPersistence,
  browserSessionPersistence,
  formatAuthError,
  requireFirebaseAuth,
  setPersistence,
  signInWithEmailAndPassword,
  syncSessionFromUser
} from './firebase-auth.js';

const HUSH_CRITICAL_BACKUP_KEY = 'hushCriticalBackupV1';
const HUSH_CRITICAL_KEYS = Object.freeze([
  'firebaseLocalProfiles',
  'lastSignedInUsername',
  'lastSignedInEmail',
  'rememberedEmail',
  'users',
  'wallet',
  'userRankings',
  'rankingsDraftState',
  'rankingsStarredPlayers',
  'defaultRankingsStarred',
  'completedDrafts'
]);

function readCriticalBackupStore() {
  try {
    const raw = localStorage.getItem(HUSH_CRITICAL_BACKUP_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (_error) {
    return {};
  }
}

function writeCriticalBackupStore(store) {
  try {
    localStorage.setItem(HUSH_CRITICAL_BACKUP_KEY, JSON.stringify(store));
  } catch (_error) {
    // Ignore quota/private-mode failures; this is a best-effort safety net.
  }
}

function snapshotCriticalLocalData() {
  const store = readCriticalBackupStore();
  let changed = false;

  HUSH_CRITICAL_KEYS.forEach((key) => {
    const value = localStorage.getItem(key);
    if (typeof value === 'string') {
      if (store[key] !== value) {
        store[key] = value;
        changed = true;
      }
    } else if (Object.prototype.hasOwnProperty.call(store, key)) {
      delete store[key];
      changed = true;
    }
  });

  if (changed) {
    writeCriticalBackupStore(store);
  }
}

function restoreCriticalLocalDataIfMissing() {
  const store = readCriticalBackupStore();

  HUSH_CRITICAL_KEYS.forEach((key) => {
    const liveValue = localStorage.getItem(key);
    const backupValue = store[key];
    if (liveValue === null && typeof backupValue === 'string') {
      try {
        localStorage.setItem(key, backupValue);
      } catch (_error) {
        // Ignore storage write failures.
      }
    }
  });
}

function protectCriticalLocalData() {
  restoreCriticalLocalDataIfMissing();
  snapshotCriticalLocalData();
  window.addEventListener('beforeunload', snapshotCriticalLocalData);
}

async function resolveLoginEmail(identifier) {
  const value = String(identifier || '').trim();
  if (!value) {
    throw new Error('Enter your username or email.');
  }

  const response = await fetch(`/api/auth/resolve-login?identifier=${encodeURIComponent(value)}`, {
    cache: 'no-store'
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload || !payload.ok || !payload.email) {
    throw new Error(payload && payload.error ? payload.error : 'Unable to resolve username. Try email instead.');
  }

  return String(payload.email).trim();
}

async function loginWithServerFallback(identifier, password) {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      username: String(identifier || '').trim(),
      password: String(password || '')
    })
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload || !payload.ok) {
    throw new Error(payload && payload.error ? payload.error : 'Login failed.');
  }

  const resolvedUsername = String(payload.username || identifier || '').trim();
  if (resolvedUsername) {
    sessionStorage.setItem('username', resolvedUsername);
    localStorage.setItem('lastSignedInUsername', resolvedUsername);
  }

  if (String(identifier || '').includes('@')) {
    sessionStorage.setItem('userEmail', String(identifier).trim());
    localStorage.setItem('lastSignedInEmail', String(identifier).trim());
  }

  return {
    username: resolvedUsername
  };
}

document.addEventListener('DOMContentLoaded', ()=>{
  protectCriticalLocalData();
  const signup = document.getElementById('signupForm');
  const login = document.getElementById('loginForm');
  const rememberCheckbox = document.getElementById('rememberPassword');

  function initializePasswordToggles(root = document) {
    root.querySelectorAll('[data-password-toggle]').forEach((button) => {
      const field = button.closest('.password-field');
      const input = field ? field.querySelector('input[type="password"], input[type="text"]') : null;
      if (!input) return;

      button.addEventListener('click', () => {
        const shouldShow = input.type === 'password';
        input.type = shouldShow ? 'text' : 'password';
        button.textContent = shouldShow ? 'Hide' : 'Show';
        button.setAttribute('aria-label', shouldShow ? 'Hide password' : 'Show password');
      });
    });
  }

  initializePasswordToggles();

  const rememberedEmail = localStorage.getItem('rememberedEmail') || localStorage.getItem('lastSignedInEmail') || '';
  if (login && rememberedEmail) {
    const identifierInput = login.querySelector('input[name="identifier"]');
    if (identifierInput) identifierInput.value = rememberedEmail;
    if (rememberCheckbox) rememberCheckbox.checked = true;
  }

  function onSignup(e){
    e.preventDefault();
    const form = e.target;
    const data = new FormData(form);
    const username = data.get('username');
    if(!username || username.length < 3){
      alert('Signup: Please enter a username with at least 3 characters.');
      return;
    }
    alert('Signup successful for ' + username + ' (local stub)');
    form.reset();
  }

  function onLogin(e){
    e.preventDefault();
    const form = e.target;
    const submitBtn = form ? form.querySelector('button[type="submit"]') : null;
    const submitBtnDefaultLabel = submitBtn ? submitBtn.textContent : '';
    const setSubmittingState = (isSubmitting) => {
      if (!submitBtn) return;
      submitBtn.disabled = !!isSubmitting;
      submitBtn.textContent = isSubmitting ? 'Signing in...' : submitBtnDefaultLabel;
    };
    const data = new FormData(form);
    const identifier = String(data.get('identifier') || '').trim();
    const password = String(data.get('password') || '');
    const rememberPassword = !!(rememberCheckbox && rememberCheckbox.checked);
    if(!identifier){
      alert('Login: Please enter your username or email.');
      return;
    }
    if(!password){
      alert('Login: Please enter your password.');
      return;
    }

    (async ()=>{
      setSubmittingState(true);
      try{
        const auth = requireFirebaseAuth();
        const resolvedEmail = await resolveLoginEmail(identifier);
        await setPersistence(auth, rememberPassword ? browserLocalPersistence : browserSessionPersistence);
        const credential = await signInWithEmailAndPassword(auth, resolvedEmail, password);
        const profile = syncSessionFromUser(credential.user);

        if (rememberPassword) {
          localStorage.setItem('rememberedEmail', identifier);
        } else {
          localStorage.removeItem('rememberedEmail');
        }

        if (!sessionStorage.getItem('username') && profile && profile.username) {
          sessionStorage.setItem('username', profile.username);
        }
        window.location.href = 'dashboard.html';
      }catch(err){
        console.error(err);

        try {
          await loginWithServerFallback(identifier, password);

          if (rememberPassword) {
            localStorage.setItem('rememberedEmail', identifier);
          } else {
            localStorage.removeItem('rememberedEmail');
          }

          window.location.href = 'dashboard.html';
          return;
        } catch (fallbackError) {
          console.error(fallbackError);
          alert(formatAuthError(err, String(fallbackError && fallbackError.message || 'Login failed.')));
        }
      } finally {
        setSubmittingState(false);
      }
    })();
  }

  if (signup) signup.addEventListener('submit', onSignup);
  if (login) {
    login.addEventListener('submit', onLogin);
    window.__hushLoginHandlerAttached = true;
  }
});
