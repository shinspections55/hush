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
    const emailInput = login.querySelector('input[name="email"]');
    if (emailInput) emailInput.value = rememberedEmail;
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
    const data = new FormData(form);
    const email = String(data.get('email') || '').trim();
    const password = String(data.get('password') || '');
    const rememberPassword = !!(rememberCheckbox && rememberCheckbox.checked);
    if(!email || !email.includes('@')){
      alert('Login: Please enter a valid email address.');
      return;
    }

    (async ()=>{
      try{
        const auth = requireFirebaseAuth();
        await setPersistence(auth, rememberPassword ? browserLocalPersistence : browserSessionPersistence);
        const credential = await signInWithEmailAndPassword(auth, email, password);
        const profile = syncSessionFromUser(credential.user);

        if (rememberPassword) {
          localStorage.setItem('rememberedEmail', email);
        } else {
          localStorage.removeItem('rememberedEmail');
        }

        if (!sessionStorage.getItem('username') && profile && profile.username) {
          sessionStorage.setItem('username', profile.username);
        }
        window.location.href = 'dashboard.html';
      }catch(err){
        console.error(err);
        alert(formatAuthError(err, 'Login failed.'));
      }
    })();
  }

  if (signup) signup.addEventListener('submit', onSignup);
  if (login) {
    login.addEventListener('submit', onLogin);
    window.__hushLoginHandlerAttached = true;
  }
});
