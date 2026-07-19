document.addEventListener('DOMContentLoaded', () => {
  const adminKeyInput = document.getElementById('adminKey');
  const statusForm = document.getElementById('statusForm');
  const testEmailForm = document.getElementById('testEmailForm');
  const testSmsForm = document.getElementById('testSmsForm');
  const statusText = document.getElementById('statusText');
  const statusJson = document.getElementById('statusJson');
  const sendResult = document.getElementById('sendResult');

  if (!adminKeyInput || !statusForm || !testEmailForm || !testSmsForm) return;

  function getHeaders() {
    const key = String(adminKeyInput.value || '').trim();
    return {
      'Content-Type': 'application/json',
      'x-admin-key': key
    };
  }

  async function checkStatus() {
    statusText.textContent = 'Checking status...';
    statusJson.textContent = '';

    try {
      const response = await fetch('/api/admin/delivery/status', {
        method: 'GET',
        headers: {
          'x-admin-key': String(adminKeyInput.value || '').trim()
        }
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok || !payload.ok) {
        statusText.textContent = payload.error || 'Unable to read status.';
        return;
      }

      statusText.textContent = 'Status loaded.';
      statusJson.textContent = JSON.stringify(payload, null, 2);
    } catch (error) {
      console.error('[admin-debug] status error:', error);
      statusText.textContent = 'Network error while loading status.';
    }
  }

  statusForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await checkStatus();
  });

  testEmailForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    sendResult.textContent = 'Sending test email...';

    const to = String(document.getElementById('testEmailTo').value || '').trim();
    const username = String(document.getElementById('testEmailName').value || '').trim();

    try {
      const response = await fetch('/api/admin/delivery/test-email', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ to, username })
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok || !payload.ok) {
        sendResult.textContent = payload.error || 'Failed to send test email.';
        return;
      }

      sendResult.textContent = payload.simulated
        ? 'Test email simulated (provider not configured).'
        : 'Test email sent.';

      await checkStatus();
    } catch (error) {
      console.error('[admin-debug] email test error:', error);
      sendResult.textContent = 'Network error while sending test email.';
    }
  });

  testSmsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    sendResult.textContent = 'Sending test SMS...';

    const to = String(document.getElementById('testSmsTo').value || '').trim();

    try {
      const response = await fetch('/api/admin/delivery/test-sms', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ to })
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok || !payload.ok) {
        sendResult.textContent = payload.error || 'Failed to send test SMS.';
        return;
      }

      sendResult.textContent = payload.simulated
        ? 'Test SMS simulated (provider not configured).'
        : 'Test SMS sent.';

      await checkStatus();
    } catch (error) {
      console.error('[admin-debug] sms test error:', error);
      sendResult.textContent = 'Network error while sending test SMS.';
    }
  });
});
