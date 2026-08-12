document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('forgotPasswordForm');
  const status = document.getElementById('forgotStatus');
  if (!form || !status) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    status.textContent = 'Sending reset email...';

    const data = new FormData(form);
    const identifier = String(data.get('identifier') || '').trim();

    try {
      const response = await fetch('/api/auth/request-password-reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ identifier, channel: 'email' })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        status.textContent = payload.error || 'Unable to send reset email.';
        return;
      }

      status.textContent = payload.simulated
        ? 'Reset email simulated on the server. Check delivery configuration in admin delivery debug.'
        : 'Reset email sent. Open the link in that email to finish changing your password.';
    } catch (error) {
      console.error('[forgot-password] request failed:', error);
      status.textContent = 'Unable to send reset email.';
    }
  });
});
