document.addEventListener('DOMContentLoaded', () => {
  const status = document.getElementById('resetStatus');
  const form = document.getElementById('resetPasswordForm');
  const manualResetFields = document.getElementById('manualResetFields');
  const identifierInput = document.getElementById('resetIdentifier');
  const codeInput = document.getElementById('resetCode');
  const passwordInput = document.getElementById('resetNewPassword');
  const confirmInput = document.getElementById('resetConfirmPassword');
  if (!status || !form || !passwordInput || !confirmInput) return;

  const params = new URLSearchParams(window.location.search);
  const token = String(params.get('token') || '').trim();

  if (token) {
    if (manualResetFields) {
      manualResetFields.hidden = true;
    }
    status.textContent = 'Reset link verified. Enter your new password below.';
  } else {
    status.textContent = 'Enter the verification code from your email along with your email address or username.';
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const newPassword = String(passwordInput.value || '');
    const confirmPassword = String(confirmInput.value || '');
    const identifier = String(identifierInput && identifierInput.value || '').trim();
    const code = String(codeInput && codeInput.value || '').trim();

    if (newPassword.length < 8) {
      status.textContent = 'New password must be at least 8 characters.';
      return;
    }

    if (newPassword !== confirmPassword) {
      status.textContent = 'Passwords do not match.';
      return;
    }

    if (!token && (!identifier || !code)) {
      status.textContent = 'Enter your email/username and verification code, or use the reset link from your email.';
      return;
    }

    status.textContent = 'Resetting password...';

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          token,
          identifier,
          code,
          newPassword
        })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        status.textContent = payload.error || 'Unable to reset password.';
        return;
      }

      status.textContent = 'Password reset successful. You can return to login now.';
      form.reset();
    } catch (error) {
      console.error('[reset-password] request failed:', error);
      status.textContent = 'Unable to reset password.';
    }
  });
});
