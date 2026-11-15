'use strict';

(() => {
  const rows = document.getElementById('liveScoreboardRows');
  const status = document.getElementById('scoreboardStatus');
  const refresh = document.getElementById('refreshScoreboardBtn');
  let entries = [];
  let role = 'combined';
  let loading = false;
  let timer;
  function render() {
    rows.replaceChildren();
    const filtered = entries.filter(entry => role === 'combined' || entry.role === role);
    filtered.forEach(entry => {
      const row = document.createElement('tr');
      const rank = filtered.findIndex(candidate => candidate.total === entry.total) + 1;
      [rank, entry.name, entry.role === 'expert' ? 'EXPERT' : 'CONTESTANT', entry.total, entry.pending].forEach(value => {
        const cell = document.createElement('td');
        cell.textContent = String(value);
        row.append(cell);
      });
      rows.append(row);
    });
    if (!filtered.length) {
      const row = document.createElement('tr');
      const cell = document.createElement('td');
      cell.colSpan = 5;
      cell.textContent = 'No submitted mocks in this group yet.';
      row.append(cell); rows.append(row);
    }
  }
  async function load() {
    if (loading) return;
    loading = true;
    window.clearTimeout(timer);
    refresh.disabled = true;
    try {
      const response = await fetch('/api/public/mock-draft/scoreboard?year=2027', { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Unable to load scoreboard');
      entries = payload.entries;
      render();
      status.textContent = `${payload.resultsStatus === 'paused' ? 'Waiting for published results' : payload.resultsStatus === 'final' ? 'FINAL' : 'LIVE'} - ${payload.confirmed}/32 confirmed picks - ${entries.length} submitted mocks. Updated ${new Date().toLocaleTimeString()}. Auto-refresh every 10 seconds.`;
    } catch (error) {
      status.textContent = `${error.message}. Scores may be out of date; retrying automatically.`;
    } finally {
      loading = false;
      refresh.disabled = false;
      timer = window.setTimeout(() => {
        if (document.visibilityState !== 'hidden') load();
      }, 10000);
    }
  }
  document.querySelectorAll('[data-scoreboard-role]').forEach(button => button.addEventListener('click', () => {
    role = button.dataset.scoreboardRole;
    document.querySelectorAll('[data-scoreboard-role]').forEach(tab => tab.setAttribute('aria-pressed', String(tab === button)));
    render();
  }));
  refresh.addEventListener('click', load);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') load(); });
  load();
})();
