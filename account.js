import {
  EmailAuthProvider,
  clearAuthSession,
  deleteStoredProfile,
  formatAuthError,
  getStoredProfile,
  requireCurrentUser,
  reauthenticateWithCredential,
  saveStoredProfile,
  sendPasswordResetEmail,
  syncSessionFromUser,
  updateEmail,
  updatePassword
} from './firebase-auth.js';

document.addEventListener('DOMContentLoaded', async () => {
  let currentUser;
  try {
    currentUser = await requireCurrentUser();
  } catch (_error) {
    window.location.href = 'index.html';
    return;
  }

  let username = String(sessionStorage.getItem('username') || currentUser.displayName || '').trim();

  const accountUsername = document.getElementById('accountUsername');
  const accountFullname = document.getElementById('accountFullname');
  const accountEmail = document.getElementById('accountEmail');
  const accountPhone = document.getElementById('accountPhone');
  const accountCurrentPassword = document.getElementById('accountCurrentPassword');
  const profileForm = document.getElementById('accountProfileForm');
  const passwordForm = document.getElementById('accountPasswordForm');
  const deleteForm = document.getElementById('deleteAccountForm');
  const clearSavedLoginBtn = document.getElementById('clearSavedLoginBtn');
  const exportAccountBtn = document.getElementById('exportAccountBtn');
  const profileStatus = document.getElementById('accountProfileStatus');
  const securityStatus = document.getElementById('accountSecurityStatus');
  const deleteStatus = document.getElementById('accountDeleteStatus');

  function setStatus(el, message) {
    if (el) el.textContent = message;
  }

  function removeUserFromPreferenceStore(targetUsername) {
    try {
      const raw = localStorage.getItem('users');
      const users = raw ? JSON.parse(raw) : {};
      if (users && typeof users === 'object') {
        delete users[targetUsername];
        localStorage.setItem('users', JSON.stringify(users));
      }
    } catch (_error) {
      // ignore
    }
  }

  function filterCompletedDrafts(targetUsername) {
    try {
      const raw = localStorage.getItem('completedDrafts');
      const drafts = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(drafts)) return;
      const filtered = drafts.filter((draft) => {
        const teams = Array.isArray(draft && draft.teams) ? draft.teams : [];
        return !teams.some((team) => String(team && team.name || '').trim() === targetUsername);
      });
      localStorage.setItem('completedDrafts', JSON.stringify(filtered));
    } catch (_error) {
      // ignore
    }
  }

  function clearLocalAccountData(targetUsername) {
    removeUserFromPreferenceStore(targetUsername);
    filterCompletedDrafts(targetUsername);

    if (localStorage.getItem('rememberedUsername') === targetUsername) {
      localStorage.removeItem('rememberedUsername');
    }
    localStorage.removeItem('rememberedEmail');

    [
      'userRankings',
      'firebaseLocalProfiles',
      'defaultRankingsStarred',
      'rankingsStarredPlayers',
      'rankingsDraftStarredPlayers',
      'rankingsDraftState',
      'latestDraftSummary'
    ].forEach((key) => localStorage.removeItem(key));

    [
      'username',
      'currentDraft',
      'selectedCompletedDraftCode',
      'latestDraftSummary'
    ].forEach((key) => sessionStorage.removeItem(key));

    clearAuthSession();
  }

  async function loadAccount() {
    setStatus(profileStatus, 'Loading account...');
    try {
      const profile = getStoredProfile(currentUser.uid) || {};
      username = String(profile.username || currentUser.displayName || currentUser.email || username).trim();
      syncSessionFromUser(currentUser, profile);

      if (accountUsername) accountUsername.value = username;
      if (accountFullname) accountFullname.value = profile.fullname || '';
      if (accountEmail) accountEmail.value = currentUser.email || profile.email || '';
      if (accountPhone) accountPhone.value = profile.phone || '';
      setStatus(profileStatus, '');
    } catch (error) {
      console.error('[account] load failed:', error);
      setStatus(profileStatus, formatAuthError(error, 'Unable to load account.'));
    }
  }

  async function reauthenticate(password) {
    const credential = EmailAuthProvider.credential(currentUser.email || '', password);
    await reauthenticateWithCredential(currentUser, credential);
  }

  profileForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    setStatus(profileStatus, 'Saving account changes...');
    try {
      const nextEmail = String(accountEmail.value || '').trim();
      const nextFullname = String(accountFullname.value || '').trim();
      const nextPhone = String(accountPhone.value || '').trim();

      await reauthenticate(String(accountCurrentPassword.value || ''));

      if (nextEmail && nextEmail !== currentUser.email) {
        await updateEmail(currentUser, nextEmail);
      }

      const profile = saveStoredProfile(currentUser.uid, {
        username,
        fullname: nextFullname,
        phone: nextPhone,
        email: nextEmail || currentUser.email || ''
      });
      syncSessionFromUser(currentUser, profile);

      if (accountCurrentPassword) accountCurrentPassword.value = '';
      setStatus(profileStatus, 'Account updated.');
      await loadAccount();
    } catch (error) {
      console.error('[account] profile update failed:', error);
      setStatus(profileStatus, formatAuthError(error, 'Unable to update account.'));
    }
  });

  passwordForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const currentPassword = String(document.getElementById('passwordCurrent').value || '');
    const newPassword = String(document.getElementById('passwordNew').value || '');
    const confirmPassword = String(document.getElementById('passwordConfirm').value || '');

    if (newPassword !== confirmPassword) {
      setStatus(securityStatus, 'New passwords do not match.');
      return;
    }
    if (newPassword.length < 8) {
      setStatus(securityStatus, 'New password must be at least 8 characters.');
      return;
    }

    setStatus(securityStatus, 'Changing password...');
    try {
      await reauthenticate(currentPassword);
      await updatePassword(currentUser, newPassword);

      passwordForm.reset();
      setStatus(securityStatus, 'Password updated.');
    } catch (error) {
      console.error('[account] password change failed:', error);
      setStatus(securityStatus, formatAuthError(error, 'Unable to change password.'));
    }
  });

  if (clearSavedLoginBtn) {
    clearSavedLoginBtn.addEventListener('click', () => {
      if (localStorage.getItem('rememberedUsername') === username) {
        localStorage.removeItem('rememberedUsername');
      }
      localStorage.removeItem('rememberedEmail');
      setStatus(securityStatus, 'Saved browser login cleared for this account.');
    });
  }

  if (exportAccountBtn) {
    exportAccountBtn.addEventListener('click', async () => {
      setStatus(securityStatus, 'Exporting account data...');
      try {
        const exportPayload = {
          exportedAt: new Date().toISOString(),
          account: {
            uid: currentUser.uid,
            email: currentUser.email || '',
            username,
            fullname: String(accountFullname.value || '').trim(),
            phone: String(accountPhone.value || '').trim()
          },
          localData: {
            preferences: localStorage.getItem('users'),
            completedDrafts: localStorage.getItem('completedDrafts'),
            rankings: localStorage.getItem('userRankings')
          }
        };

        const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `${username}-account-export.json`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
        setStatus(securityStatus, 'Account data exported.');
      } catch (error) {
        console.error('[account] export failed:', error);
        setStatus(securityStatus, formatAuthError(error, 'Unable to export account data.'));
      }
    });
  }

  deleteForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const currentPassword = String(document.getElementById('deleteCurrentPassword').value || '');
    const confirmText = String(document.getElementById('deleteConfirmText').value || '').trim();

    if (confirmText !== 'DELETE') {
      setStatus(deleteStatus, 'Type DELETE exactly to confirm account deletion.');
      return;
    }

    setStatus(deleteStatus, 'Deleting account...');
    try {
      await reauthenticate(currentPassword);
      deleteStoredProfile(currentUser.uid);
      await currentUser.delete();

      clearLocalAccountData(username);
      window.location.href = 'index.html';
    } catch (error) {
      console.error('[account] delete failed:', error);
      setStatus(deleteStatus, formatAuthError(error, 'Unable to delete account.'));
    }
  });

  loadAccount();
});