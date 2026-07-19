document.addEventListener('DOMContentLoaded', () => {
  const DEFAULT_MIN_AUCTIONS = 5;
  const DEFAULT_LIMIT = 100;
  const topRisersList = document.getElementById('topRisersList');
  const topFallersList = document.getElementById('topFallersList');
  const trendTableBody = document.getElementById('trendTableBody');
  const tabMoversBtn = document.getElementById('tabMoversBtn');
  const tabAllBtn = document.getElementById('tabAllBtn');
  const moversPanel = document.getElementById('moversPanel');
  const allPanel = document.getElementById('allPanel');

  function setActiveTab(tabName) {
    const tabs = [
      { btn: tabMoversBtn, panel: moversPanel, key: 'movers' },
      { btn: tabAllBtn, panel: allPanel, key: 'all' }
    ];

    tabs.forEach(({ btn, panel, key }) => {
      const active = key === tabName;
      if (btn) {
        btn.classList.toggle('av-tab-btn-active', active);
        btn.setAttribute('aria-selected', active ? 'true' : 'false');
      }
      if (panel) {
        panel.classList.toggle('av-tab-panel-hidden', !active);
      }
    });
  }

  function formatDelta(delta) {
    const n = Number(delta || 0);
    const abs = Math.abs(n).toFixed(2);
    if (n > 0) return { text: `+${abs}`, cls: 'av-up', arrow: 'up', symbol: '&uarr;' };
    if (n < 0) return { text: `-${abs}`, cls: 'av-down', arrow: 'down', symbol: '&darr;' };
    return { text: '0.00', cls: 'av-flat', arrow: 'flat', symbol: '&rarr;' };
  }

  function renderTable(players) {
    if (!Array.isArray(players) || players.length === 0) {
      trendTableBody.innerHTML = '<tr><td colspan="6">No data available yet.</td></tr>';
      return;
    }

    trendTableBody.innerHTML = players.map((player) => {
      const trend = formatDelta(player.delta);
      return `
        <tr>
          <td>${player.playerName}</td>
          <td>${player.position}</td>
          <td>${Number(player.previousReportedAv || 0).toFixed(2)}</td>
          <td>${Number(player.reportedAv || 0).toFixed(2)}</td>
          <td class="${trend.cls}">${trend.text}</td>
          <td>${Number(player.totalAuctions || 0)}</td>
        </tr>
      `;
    }).join('');
  }

  function renderBiggestMovers(players) {
    const safePlayers = Array.isArray(players) ? players : [];
    const risers = [...safePlayers]
      .filter((player) => Number(player.delta || 0) > 0)
      .sort((a, b) => Number(b.delta || 0) - Number(a.delta || 0))
      .slice(0, 5);
    const fallers = [...safePlayers]
      .filter((player) => Number(player.delta || 0) < 0)
      .sort((a, b) => Number(a.delta || 0) - Number(b.delta || 0))
      .slice(0, 5);

    topRisersList.innerHTML = risers.length === 0
      ? '<li class="av-headline-item">No risers yet.</li>'
      : risers.map((player) => {
        const amount = Math.abs(Number(player.delta || 0)).toFixed(2);
        return `<li class="av-headline-item">${player.playerName} <span class="av-up">&uarr; ${amount}</span> up by ${amount} AV since last report.</li>`;
      }).join('');

    topFallersList.innerHTML = fallers.length === 0
      ? '<li class="av-headline-item">No fallers yet.</li>'
      : fallers.map((player) => {
        const amount = Math.abs(Number(player.delta || 0)).toFixed(2);
        return `<li class="av-headline-item">${player.playerName} <span class="av-down">&darr; ${amount}</span> down by ${amount} AV since last report.</li>`;
      }).join('');
  }

  async function loadTrends() {
    const minAuctions = DEFAULT_MIN_AUCTIONS;
    const limit = DEFAULT_LIMIT;

    try {
      const response = await fetch(`/api/public/av-trends?minAuctions=${encodeURIComponent(minAuctions)}&limit=${encodeURIComponent(limit)}`);
      const data = await response.json();

      if (!response.ok || !data || !data.ok) {
        throw new Error((data && data.error) || 'Unable to load AV trend data');
      }

      const players = Array.isArray(data.players) ? data.players : [];
      renderBiggestMovers(players);
      renderTable(players);
    } catch (error) {
      topRisersList.innerHTML = '<li class="av-headline-item">Failed to load trend data.</li>';
      topFallersList.innerHTML = '<li class="av-headline-item">Failed to load trend data.</li>';
      trendTableBody.innerHTML = '<tr><td colspan="6">Failed to load trend data.</td></tr>';
    }
  }

  if (tabMoversBtn) tabMoversBtn.addEventListener('click', () => setActiveTab('movers'));
  if (tabAllBtn) tabAllBtn.addEventListener('click', () => setActiveTab('all'));
  setActiveTab('movers');
  loadTrends();
});
