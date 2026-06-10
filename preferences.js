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
