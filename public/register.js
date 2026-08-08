import {
  createUserWithEmailAndPassword,
  formatAuthError,
  requireFirebaseAuth,
  saveStoredProfile,
  syncSessionFromUser,
  updateProfile
} from './firebase-auth.js';

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('registerForm');
  if (!form) return;

  form.querySelectorAll('[data-password-toggle]').forEach((button) => {
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

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const data = new FormData(form);
    const fullname = String(data.get('fullname') || '').trim();
    const email = String(data.get('email') || '').trim();
    const username = String(data.get('username') || '').trim();
    const phone = String(data.get('phone') || '').trim();
    const password = String(data.get('password') || '');
    const password2 = String(data.get('password2') || '');

    if (username.length < 3) {
      alert('Choose a username with at least 3 characters.');
      return;
    }
    if (password !== password2) {
      alert('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      alert('Password must be at least 8 characters.');
      return;
    }

    try {
      const auth = requireFirebaseAuth();
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(credential.user, { displayName: username });
      saveStoredProfile(credential.user.uid, { fullname, email, phone, username });
      syncSessionFromUser(credential.user, { fullname, email, phone, username });

      alert('Account created. You are now signed in.');
      window.location.href = 'dashboard.html';
    } catch (error) {
      console.error('[register] failed:', error);
      alert(formatAuthError(error, 'Unable to create account.'));
    }
  });
});
