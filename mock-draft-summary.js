'use strict';

const parameters = new URLSearchParams(location.search);
const adminPreview = parameters.get('adminPreview') === '1';
const officialEntry = !adminPreview && parameters.get('submitted') === '1';
const statusNode = document.getElementById('reportStatus');
const standingsNode = document.getElementById('standingsRows');
const picksNode = document.getElementById('pickBreakdownRows');
let mock = null;
let report = null;
let activeStandings = 'combined';
let refreshTimer;
let loadingReport = false;

function decodeMock(value) {
  if (!value || value.length > 50000) throw new Error('This report link is invalid or too large.');
  const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
  const payload = JSON.parse(new TextDecoder().decode(bytes));
  if (payload.format !== 'hush-mock-draft-v1' || !Array.isArray(payload.picks) || payload.picks.length !== 32) {
    throw new Error('This report link does not contain a 32-pick mock.');
  }
  return payload;
}

function cell(row, value, className = '') {
  const node = document.createElement('td');
  node.textContent = value == null || value === '' ? '—' : String(value);
  if (className) node.className = className;
  row.append(node);
  return node;
}

function renderSummary() {
  const filled = mock.picks.filter(pick => pick.prospect?.name || pick.playerName).length;
  document.getElementById('picksFilled').textContent = `${filled} / 32 FILLED`;
  document.getElementById('summaryTotal').textContent = report ? String(report.score.total) : '--';
  document.getElementById('summaryPending').textContent = report
    ? report.score.pending ? `${report.score.pending} picks awaiting confirmed results` : 'All picks scored'
    : 'Score unavailable';
  const comparisons = report?.comparisons || {};
  [['overallRank', 'overallRankMeta', comparisons.combined], ['expertRank', 'expertRankMeta', comparisons.experts],
    ['participantRank', 'participantRankMeta', comparisons.participants]].forEach(([rankId, metaId, ranking]) => {
    const hasStanding = ranking && (officialEntry || ranking.entries.length);
    document.getElementById(rankId).textContent = hasStanding ? `#${ranking.rank}` : '--';
    document.getElementById(metaId).textContent = hasStanding
      ? `of ${ranking.total} · score comparison` : 'No scored entries yet';
  });
  renderStandings();
  renderBreakdown();
}

function renderStandings() {
  if (!report) return;
  const group = { expert: 'experts', participant: 'participants', combined: 'combined' }[activeStandings];
  const ranking = report.comparisons?.[group] || { entries: [], rank: 1 };
  standingsNode.replaceChildren();
  const entries = ranking.entries.map(entry => ({ ...entry }));
  entries.splice(Math.min(ranking.rank - 1, entries.length), 0, { name: report.entry?.name || 'Your mock', role: 'you', total: report.score.total, pending: report.score.pending, you: true });
  entries.forEach((entry, index) => {
    const row = document.createElement('tr');
    if (entry.you) row.className = 'summary-you-row';
    const rank = entry.you ? ranking.rank : ranking.entries.filter(candidate => candidate.total > entry.total).length + 1;
    cell(row, `#${rank}`);
    cell(row, entry.name);
    cell(row, entry.you ? 'YOU' : entry.role === 'expert' ? 'EXPERT' : 'PARTICIPANT');
    cell(row, entry.total, `summary-points${entry.you ? ' positive' : ''}`);
    cell(row, entry.pending);
    standingsNode.append(row);
  });
  document.getElementById('standingsStatus').textContent = ranking.entries.length
    ? `${ranking.entries.length} other scored contest ${activeStandings === 'expert' ? 'experts' : activeStandings === 'participant' ? 'participants' : 'entries'} · ${officialEntry ? 'Your submitted mock is included once. Scores refresh automatically every 10 seconds.' : 'Your projected position is based on the currently published answer key.'}`
    : officialEntry ? 'Your submission is saved. Scores appear as real draft results are confirmed. Refreshes automatically every 10 seconds.'
    : 'No published scores in this group yet. Your mock is shown as a score preview, not an official submission.';
}

function renderBreakdown() {
  picksNode.replaceChildren();
  const scoredByPick = new Map((report?.score.picks || []).map(pick => [pick.pick, pick]));
  mock.picks.forEach((prediction, index) => {
    const player = prediction.prospect || {};
    const scored = scoredByPick.get(index + 1);
    const actual = scored?.actual;
    const row = document.createElement('tr');
    cell(row, String(index + 1).padStart(2, '0'));
    cell(row, prediction.team || '—', 'summary-team');
    const predictionText = player.name || prediction.playerName || (prediction.trade ? 'Team trade call' : 'No pick');
    const predictionMeta = [player.position || prediction.position, player.school].filter(Boolean).join(' · ');
    cell(row, predictionMeta ? `${predictionText} · ${predictionMeta}` : predictionText);
    cell(row, actual ? `${actual.selectingTeam} · ${actual.playerName} (${actual.position})` : 'Awaiting confirmed result');
    cell(row, scored?.reason || 'Awaiting score');
    const points = scored?.points;
    cell(row, points == null ? 'Pending' : `${points > 0 ? '+' : ''}${points}`, `summary-points ${points == null ? 'pending' : points < 0 ? 'negative' : points > 0 ? 'positive' : ''}`);
    picksNode.append(row);
  });
}

async function loadSavedContestReport() {
  const { contestRequest } = await import('./mock-draft-account.js?v=20261115-real-contest');
  return contestRequest('/api/mock-draft/report?year=2027');
}

async function loadReport() {
  if (loadingReport) return;
  loadingReport = true;
  if (refreshTimer) window.clearTimeout(refreshTimer);
  const refresh = document.getElementById('refreshReportBtn');
  refresh.disabled = true;
  try {
    if (!officialEntry) mock = decodeMock(parameters.get('mock'));
    const headers = { 'Content-Type': 'application/json' };
    if (adminPreview) {
      const key = sessionStorage.getItem('adminApiKey');
      if (!key) throw new Error('Unlock the Admin Mock Draft Editor and open Preview Contestant Results from there.');
      headers['x-admin-key'] = key;
    }
    let payload;
    if (officialEntry) {
      payload = await loadSavedContestReport();
      mock = payload.mock;
    } else {
      const response = await fetch(adminPreview ? '/api/admin/mock-draft/scoring/preview' : '/api/public/mock-draft/summary', {
        method: 'POST', cache: 'no-store', headers,
        body: JSON.stringify({ contestId: adminPreview ? parameters.get('contestId') : 'contest-2027',
          username: mock.username, ...(adminPreview ? { name: mock.name, role: mock.role, entryId: parameters.get('entryId') } : {}),
          ...(adminPreview ? { datasetId: parameters.get('datasetId') } : {}), picks: mock.picks })
      });
      payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Could not score this mock.');
    }
    report = payload;
    if (adminPreview) {
      document.querySelector('.summary-back').href = 'admin-mock-draft.html#scoring';
      document.querySelector('.summary-back').textContent = 'Back to 2027 Contest Manager';
    }
    document.title = `${payload.contest.year} Mock Draft Score Summary`;
    document.querySelector('.summary-heading .summary-eyebrow').textContent = `${payload.contest.year} NFL DRAFT · ROUND 1`;
    document.getElementById('reportMode').textContent = adminPreview ? 'ADMIN TEST · CONTESTANT VIEW' : officialEntry ? 'SUBMITTED CONTEST MOCK' : 'SHARED REPORT';
    const status = payload.resultsStatus === 'paused' ? `Score preview · ${payload.contest.year} scoring is paused until results are published.`
        : payload.resultsStatus === 'final' ? 'Final score preview · all published results are applied. This local mock is not a contest submission.'
        : `Live score preview · ${payload.score.pending} picks are pending confirmed results.`;
    statusNode.textContent = officialEntry
      ? `${payload.entry.name} - ${payload.resultsStatus === 'paused' ? 'Submitted. Waiting for confirmed real draft results.' : payload.resultsStatus === 'final' ? 'Final results.' : 'LIVE - scoring as draft results are confirmed.'} Auto-updates every 10 seconds. ${payload.submissionPolicy.open ? `You may update your mock until ${HushMockDeadline.formatDeadline(payload.submissionPolicy.deadline)} (or earlier admin closure).` : 'Predictions locked.'}`
      : adminPreview ? `ADMIN TEST · ${payload.dataset.name} · ${status}` : status;
    renderSummary();
  } catch (error) {
    report = null;
    standingsNode.replaceChildren();
    picksNode.replaceChildren();
    document.getElementById('summaryTotal').textContent = '--';
    document.getElementById('summaryPending').textContent = 'Score unavailable';
    ['overallRank', 'expertRank', 'participantRank'].forEach(id => { document.getElementById(id).textContent = '--'; });
    ['overallRankMeta', 'expertRankMeta', 'participantRankMeta', 'standingsStatus'].forEach(id => { document.getElementById(id).textContent = ''; });
    statusNode.textContent = error.message || 'Could not load this mock draft report.';
    const row = document.createElement('tr');
    cell(row, error.message || 'Could not load the report.');
    picksNode.append(row);
  } finally {
    refresh.disabled = false;
    loadingReport = false;
    if (typeof window.setTimeout === 'function') refreshTimer = window.setTimeout(() => {
      if (document.visibilityState === 'hidden') {
        refreshTimer = null;
        return;
      }
      loadReport();
    }, 10000);
  }
}

document.querySelectorAll('[data-standings]').forEach(button => button.addEventListener('click', () => {
  activeStandings = button.dataset.standings;
  document.querySelectorAll('[data-standings]').forEach(tab => tab.setAttribute('aria-pressed', String(tab === button)));
  renderStandings();
}));
document.getElementById('printReportBtn').addEventListener('click', () => window.print());
document.getElementById('refreshReportBtn').addEventListener('click', loadReport);
if (adminPreview) {
  document.getElementById('shareReportBtn').hidden = true;
  document.querySelector('.summary-back').href = 'admin-mock-draft.html#scoring';
  document.querySelector('.summary-back').textContent = 'Back to Admin Mock Editor';
  document.querySelector('.summary-footnote').textContent = 'Private admin test using the contestant results layout. Refresh scores after saving results in the admin editor. This does not publish test data or submit your mock.';
}
if (officialEntry) {
  document.getElementById('shareReportBtn').hidden = true;
  document.querySelector('.summary-back').href = 'mock-draft-contest.html';
  document.querySelector('.summary-back').textContent = 'Back to my mock';
  document.querySelector('.summary-footnote').textContent = 'This report uses your saved server submission, not browser picks. Each account has one entry for the year. Scores refresh every 10 seconds as admin confirms the real draft results. Experts are added by admin for this year only.';
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') loadReport();
});
document.getElementById('shareReportBtn').addEventListener('click', async event => {
  const button = event.currentTarget;
  try {
    if (navigator.share) await navigator.share({ title: document.title, url: location.href });
    else { await navigator.clipboard.writeText(location.href); button.textContent = 'Link copied'; }
  } catch (error) {
    if (error.name !== 'AbortError') { button.textContent = 'Copy link failed'; }
  }
});
document.getElementById('downloadReportBtn').addEventListener('click', () => {
  if (!mock) return;
  const blob = new Blob([JSON.stringify({ mock, report, downloadedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'hush-mock-draft-summary.json';
  link.click();
  URL.revokeObjectURL(url);
});

loadReport();