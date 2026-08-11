document.addEventListener('DOMContentLoaded', async () => {
  const dataContainer = document.getElementById('dataContainer');
  const refreshBtn = document.getElementById('refreshDataBtn');
  const exportBtn = document.getElementById('exportJsonBtn');
  const keyInput = document.getElementById('adminDataKey');

  function getAdminKey() {
    const typedKey = String((keyInput && keyInput.value) || '').trim();
    if (typedKey) return typedKey;
    try {
      return String(localStorage.getItem('adminApiKey') || '').trim();
    } catch (_error) {
      return '';
    }
  }

  if (keyInput) {
    try {
      keyInput.value = String(localStorage.getItem('adminApiKey') || '').trim();
    } catch (_error) {
      // ignore
    }
    keyInput.addEventListener('change', () => {
      try {
        localStorage.setItem('adminApiKey', String(keyInput.value || '').trim());
      } catch (_error) {
        // ignore
      }
    });
  }

  async function loadAllData() {
    dataContainer.innerHTML = '<div class="loading">Loading data...</div>';
    try {
      const adminKey = getAdminKey();
      if (!adminKey) {
        throw new Error('Enter the admin code first.');
      }

      const response = await fetch('/api/admin/all-data', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      displayData(data);
    } catch (error) {
      dataContainer.innerHTML = `<div class="error-message">Error loading data: ${error.message}</div>`;
      console.error('Failed to load data:', error);
    }
  }

  function displayData(data) {
    let html = '';

    if (data.users && data.users.length > 0) {
      html += '<div class="data-section">';
      html += '<h2>Users (' + data.users.length + ')</h2>';
      html += '<table class="data-table"><thead><tr><th>Username</th><th>Email</th><th>Created</th><th>Premium</th></tr></thead><tbody>';
      data.users.forEach((user) => {
        html += `<tr>
          <td>${escapeHtml(user.username)}</td>
          <td>${escapeHtml(user.email || 'N/A')}</td>
          <td>${escapeHtml(user.created_at || 'N/A')}</td>
          <td>${user.is_premium ? 'âœ“' : 'âœ—'}</td>
        </tr>`;
      });
      html += '</tbody></table></div>';
    }

    if (data.drafts && data.drafts.length > 0) {
      html += '<div class="data-section">';
      html += '<h2>Drafts (' + data.drafts.length + ')</h2>';
      html += '<table class="data-table"><thead><tr><th>Code</th><th>Owner</th><th>Status</th><th>Created</th><th>Round</th></tr></thead><tbody>';
      data.drafts.forEach((draft) => {
        html += `<tr>
          <td><strong>${escapeHtml(draft.code)}</strong></td>
          <td>${escapeHtml(draft.owner || 'N/A')}</td>
          <td>${escapeHtml(draft.status || 'active')}</td>
          <td>${escapeHtml(draft.created_at || 'N/A')}</td>
          <td>${draft.current_round || '0'}</td>
        </tr>`;
      });
      html += '</tbody></table></div>';
    }

    if (data.rankings) {
      const positions = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];
      positions.forEach((pos) => {
        if (data.rankings[pos] && data.rankings[pos].length > 0) {
          html += '<div class="data-section">';
          html += '<h2>' + pos + ' Rankings (' + data.rankings[pos].length + ')</h2>';
          html += '<table class="data-table"><thead><tr><th>Rank</th><th>Name</th><th>Team</th><th>AV</th></tr></thead><tbody>';
          data.rankings[pos].slice(0, 50).forEach((player, idx) => {
            html += `<tr>
              <td>${idx + 1}</td>
              <td>${escapeHtml(player.name)}</td>
              <td>${escapeHtml(player.team || 'N/A')}</td>
              <td>${player.avgValue || 0}</td>
            </tr>`;
          });
          html += '</tbody></table>';
          if (data.rankings[pos].length > 50) {
            html += `<p style="color: var(--muted, #999); font-size: 12px; margin: 10px 0 0 0;">Showing 50 of ${data.rankings[pos].length} players</p>`;
          }
          html += '</div>';
        }
      });
    }

    if (data.stats) {
      html += '<div class="data-section">';
      html += '<h2>System Statistics</h2>';
      html += '<div class="data-grid">';
      Object.keys(data.stats).forEach((key) => {
        const value = data.stats[key];
        html += `<div class="data-item">
          <div class="data-item-label">${escapeHtml(key)}</div>
          <div class="data-item-value">${escapeHtml(String(value))}</div>
        </div>`;
      });
      html += '</div></div>';
    }

    dataContainer.innerHTML = html;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  refreshBtn.addEventListener('click', loadAllData);

  exportBtn.addEventListener('click', async () => {
    try {
      const adminKey = getAdminKey();
      const response = await fetch('/api/admin/all-data', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey }
      });
      const data = await response.json();
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `admin-data-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      alert('Failed to export: ' + error.message);
    }
  });

  loadAllData();
});
