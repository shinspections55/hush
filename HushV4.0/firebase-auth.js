import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  EmailAuthProvider,
  browserLocalPersistence,
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  deleteUser,
  getAuth,
  onAuthStateChanged,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  updateEmail,
  updatePassword,
  updateProfile
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

const PROFILE_STORE_KEY = 'firebaseLocalProfiles';
const REQUIRED_FIREBASE_KEYS = ['apiKey', 'authDomain', 'projectId', 'appId'];

function readFirebaseConfig() {
  const config = window.HUSH_FIREBASE_CONFIG;
  if (!config || typeof config !== 'object') return null;

  const isValid = REQUIRED_FIREBASE_KEYS.every((key) => {
    const value = String(config[key] || '').trim();
    return value && !/REPLACE_WITH_|YOUR_|CHANGE_ME/i.test(value);
  });

  return isValid ? config : null;
}

function readProfileStore() {
  try {
    const raw = localStorage.getItem(PROFILE_STORE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (_error) {
    return {};
  }
}

function writeProfileStore(store) {
  localStorage.setItem(PROFILE_STORE_KEY, JSON.stringify(store));
}

function fallbackUsernameFromEmail(email) {
  const normalized = String(email || '').trim();
  if (!normalized.includes('@')) return normalized;
  return normalized.split('@')[0];
}

export function getFirebaseSetupMessage() {
  return 'Firebase Auth is not configured yet. Update firebase-config.js with your Firebase project keys, then enable Email/Password in Firebase Console.';
}

const firebaseConfig = readFirebaseConfig();
const firebaseApp = firebaseConfig ? initializeApp(firebaseConfig) : null;
const auth = firebaseApp ? getAuth(firebaseApp) : null;

export {
  EmailAuthProvider,
  auth,
  browserLocalPersistence,
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  deleteUser,
  onAuthStateChanged,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  updateEmail,
  updatePassword,
  updateProfile
};

export function requireFirebaseAuth() {
  if (!auth) {
    throw new Error(getFirebaseSetupMessage());
  }
  return auth;
}

export function getStoredProfile(uid) {
  if (!uid) return null;
  const store = readProfileStore();
  return store[uid] || null;
}

export function saveStoredProfile(uid, updates = {}) {
  if (!uid) return null;
  const store = readProfileStore();
  const existing = store[uid] && typeof store[uid] === 'object' ? store[uid] : {};
  const next = {
    ...existing,
    ...updates
  };
  store[uid] = next;
  writeProfileStore(store);
  return next;
}

export function deleteStoredProfile(uid) {
  if (!uid) return;
  const store = readProfileStore();
  delete store[uid];
  writeProfileStore(store);
}

export function clearAuthSession() {
  [
    'username',
    'userEmail',
    'firebaseUid',
    'lastSignedInUsername',
    'lastSignedInEmail'
  ].forEach((key) => {
    sessionStorage.removeItem(key);
  });

  localStorage.removeItem('lastSignedInUsername');
  localStorage.removeItem('lastSignedInEmail');
}

export function syncSessionFromUser(user, overrides = {}) {
  if (!user) {
    clearAuthSession();
    return null;
  }

  const storedProfile = getStoredProfile(user.uid) || {};
  const profile = {
    ...storedProfile,
    ...overrides
  };
  const username = String(
    profile.username || user.displayName || fallbackUsernameFromEmail(profile.email || user.email) || 'User'
  ).trim();
  const email = String(profile.email || user.email || '').trim();

  if (username) {
    sessionStorage.setItem('username', username);
    localStorage.setItem('lastSignedInUsername', username);
  }
  if (email) {
    sessionStorage.setItem('userEmail', email);
    localStorage.setItem('lastSignedInEmail', email);
  }
  sessionStorage.setItem('firebaseUid', user.uid);

  saveStoredProfile(user.uid, {
    username,
    email,
    fullname: String(profile.fullname || '').trim(),
    phone: String(profile.phone || '').trim()
  });

  return {
    username,
    email,
    fullname: String(profile.fullname || '').trim(),
    phone: String(profile.phone || '').trim()
  };
}

export async function resolveCurrentUser() {
  const instance = requireFirebaseAuth();
  if (instance.currentUser) {
    return instance.currentUser;
  }

  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(instance, (user) => {
      unsubscribe();
      resolve(user || null);
    });
  });
}

export async function requireCurrentUser() {
  const user = await resolveCurrentUser();
  if (!user) {
    throw new Error('You must be signed in to continue.');
  }
  return user;
}

export function formatAuthError(error, fallback = 'Authentication request failed.') {
  const code = String(error && error.code || '').trim();
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Invalid email or password.';
    case 'auth/email-already-in-use':
      return 'That email address is already in use.';
    case 'auth/invalid-email':
      return 'Enter a valid email address.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.';
    case 'auth/missing-password':
      return 'Enter your password.';
    case 'auth/requires-recent-login':
      return 'Please sign in again, then retry this action.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a moment and try again.';
    case 'auth/network-request-failed':
      return 'Network error while contacting Firebase.';
    default:
      return String(error && error.message || fallback);
  }
}
