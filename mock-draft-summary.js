'use strict';

const parameters = new URLSearchParams(location.search);
const statusNode = document.getElementById('reportStatus');
const standingsNode = document.getElementById('standingsRows');
const picksNode = document.getElementById('pickBreakdownRows');
let mock = null;
let report = null;
let activeStandings = 'combined';

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
    document.getElementById(rankId).textContent = ranking?.entries.length ? `#${ranking.rank}` : '--';
    document.getElementById(metaId).textContent = ranking?.entries.length
      ? `of ${ranking.total} · score comparison` : 'No scored entries yet';
  });
  renderStandings();
  renderBreakdown();
}

function renderStandings() {
  const ranking = report?.comparisons?.[activeStandings] || { entries: [], rank: 1 };
  standingsNode.replaceChildren();
  const entries = ranking.entries.map(entry => ({ ...entry }));
  entries.splice(Math.min(ranking.rank - 1, entries.length), 0, { name: 'Your mock', role: 'you', total: report.score.total, pending: report.score.pending, you: true });
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
    ? `${ranking.entries.length} scored contest ${activeStandings === 'expert' ? 'experts' : activeStandings === 'participant' ? 'participants' : 'entries'} · your projected position is based on the currently published answer key.`
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

async function loadReport() {
  try {
    mock = decodeMock(parameters.get('mock'));
    const response = await fetch('/api/public/mock-draft/summary', {
      method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contestId: 'contest-2027', picks: mock.picks })
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'Could not score this mock.');
    report = payload;
    document.title = '2027 Mock Draft Score Summary';
    document.getElementById('reportMode').textContent = 'SHARED REPORT';
    const status = payload.resultsStatus === 'paused' ? 'Score preview · official 2027 scoring is paused until results are published.'
        : payload.resultsStatus === 'final' ? 'Final score preview · all published results are applied. This local mock is not a contest submission.'
        : `Live score preview · ${payload.score.pending} picks are pending confirmed results.`;
    statusNode.textContent = status;
    renderSummary();
  } catch (error) {
    document.getElementById('summaryTotal').textContent = '--';
    statusNode.textContent = error.message || 'Could not load this mock draft report.';
    const row = document.createElement('tr');
    cell(row, error.message || 'Could not load the report.');
    picksNode.append(row);
  }
}

document.querySelectorAll('[data-standings]').forEach(button => button.addEventListener('click', () => {
  activeStandings = button.dataset.standings;
  document.querySelectorAll('[data-standings]').forEach(tab => tab.setAttribute('aria-pressed', String(tab === button)));
  renderStandings();
}));
document.getElementById('printReportBtn').addEventListener('click', () => window.print());
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