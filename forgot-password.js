import {
  formatAuthError,
  requireFirebaseAuth,
  sendPasswordResetEmail
} from './firebase-auth.js';

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('forgotPasswordForm');
  const status = document.getElementById('forgotStatus');
  if (!form || !status) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    status.textContent = 'Sending reset email...';

    const data = new FormData(form);
    const email = String(data.get('email') || '').trim();

    try {
      const auth = requireFirebaseAuth();
      await sendPasswordResetEmail(auth, email);
      status.textContent = 'Reset email sent. Open the link in that email to finish changing your password.';
    } catch (error) {
      console.error('[forgot-password] request failed:', error);
      status.textContent = formatAuthError(error, 'Unable to send reset email.');
    }
  });
});
