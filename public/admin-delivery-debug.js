document.addEventListener('DOMContentLoaded', () => {
  const ADMIN_KEY_STORAGE_KEY = 'adminApiKey';
  const statusForm = document.getElementById('statusForm');
  const testEmailForm = document.getElementById('testEmailForm');
  const adminKeyInput = document.getElementById('adminKeyInput');
  const adminKeyForm = document.getElementById('adminKeyForm');
  const statusText = document.getElementById('statusText');
  const statusJson = document.getElementById('statusJson');
  const sendResult = document.getElementById('sendResult');

  if (!statusForm || !testEmailForm) return;

  function getStoredAdminKey() {
    try {
      return String(localStorage.getItem(ADMIN_KEY_STORAGE_KEY) || '').trim();
    } catch (_error) {
      return '';
    }
  }

  function saveAdminKey(key) {
    try {
      localStorage.setItem(ADMIN_KEY_STORAGE_KEY, String(key || '').trim());
    } catch (_error) {
      // ignore
    }
  }

  function getAdminKey() {
    const typedKey = String(adminKeyInput?.value || '').trim();
    return typedKey || getStoredAdminKey();
  }

  function getHeaders() {
    return {
      'Content-Type': 'application/json',
      'x-admin-key': getAdminKey()
    };
  }

  if (adminKeyInput) {
    adminKeyInput.value = getStoredAdminKey();
  }

  if (adminKeyForm) {
    adminKeyForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const key = getAdminKey();
      if (!key) {
        sendResult.textContent = 'Enter the admin key first.';
        return;
      }
      saveAdminKey(key);
      sendResult.textContent = 'Admin key saved.';
    });
  }

  async function checkStatus() {
    statusText.textContent = 'Checking status...';
    statusJson.textContent = '';

    try {
      const response = await fetch('/api/admin/delivery/status', {
        method: 'GET',
        headers: getHeaders()
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

});
