'use strict';

const assert = require('node:assert/strict');
const express = require('express');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { registerScoringRoutes } = require('../mock-draft-scoring-store');

async function main() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'hush-scoring-test-'));
  const filePath = path.join(directory, 'state.json');
  const app = express(); app.use(express.json());
  const teams = ['ARI','ATL','BAL','BUF','CAR','CHI','CIN','CLE','DAL','DEN','DET','GB','HOU','IND','JAC','KC','LAC','LAR','LV','MIA','MIN','NE','NO','NYG','NYJ','PHI','PIT','SEA','SF','TB','TEN','WAS'];
  const authorize = (req, res, next) => req.get('x-admin-key') === 'test-only' ? next() : res.status(401).json({ error: 'Unauthorized' });
  registerScoringRoutes(app, authorize, async (target, content) => {
    await fs.writeFile(`${target}.tmp`, content); await fs.rename(`${target}.tmp`, target);
  }, async () => teams, { filePath });
  const serve = process.argv.includes('--serve');
  if (serve) {
    const root = path.resolve(__dirname, '..');
    app.get('/api/admin/traffic', authorize, (_req, res) => res.json({ ok: true }));
    app.get('/api/admin/mock-draft/prospects', authorize, async (_req, res) => {
      const boards = {};
      for (const position of ['QB','RB','WR','TE','OL','DL','EDGE','LB','DB']) {
        boards[position] = JSON.parse(await fs.readFile(path.join(root, 'college prospects 2027', position, `${position.toLowerCase()}-prospects-2027.json`), 'utf8'));
      }
      const overall = JSON.parse(await fs.readFile(path.join(root, 'college prospects 2027', 'overall-rankings-2027.json'), 'utf8'));
      res.json({ ok: true, boards, overallOrder: overall.order, teamOrder: teams });
    });
    app.get('/api/public/mock-draft/default-team-order', (_req, res) => res.json({ ok: true, order: teams }));
    app.get('/api/public/mock-draft/overall-order', async (_req, res) => {
      const data = JSON.parse(await fs.readFile(path.join(root, 'college prospects 2027', 'overall-rankings-2027.json'), 'utf8'));
      res.json({ ok: true, order: data.order });
    });
    app.use(['/mock-draft-calibration.js', '/tools/test-mock-draft-calibration.js'], (_req, res) => res.sendStatus(404));
    app.use(express.static(root));
  }
  const server = app.listen(serve ? 8001 : 0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  if (serve) {
    console.log(`Temporary admin workflow server: http://127.0.0.1:8001/admin-mock-draft.html; storage: ${directory}`);
    async function cleanup() {
      await new Promise(resolve => server.close(resolve));
      await fs.rm(directory, { recursive: true, force: true });
    }
    process.once('SIGINT', cleanup);
    process.once('SIGTERM', cleanup);
    return;
  }
  const base = `http://127.0.0.1:${server.address().port}/api/admin/mock-draft/scoring`;
  try {
    let response = await fetch(base); assert.equal(response.status, 401);
    async function request(action, body, scope = { contestId: 'contest-2027', datasetId: 'test-default' }) {
      response = await fetch(base + action + (body ? '' : `?${new URLSearchParams(scope)}`), { method: body ? 'POST' : 'GET',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': 'test-only' },
        ...(body ? { body: JSON.stringify({ ...scope, ...body }) } : {}) });
      return response.json();
    }
    let payload = await request(''); let state = payload.state;
    assert.equal(state.status, 'paused'); assert.equal(state.results.length, 32);
    payload = await request('/import', { revision: state.revision, mocks: [{ name: 'Historical test', picks: [
      { pick: 1, playerName: 'Player One', position: 'QB', team: 'ARI' },
      { pick: 2, playerName: 'Player Two', position: 'WR', team: 'ATL', tradeTo: 'DAL' }
    ] }] }); state = payload.state; assert.equal(state.scores.length, 0);
    state.results[0] = { ...state.results[0], playerId: 'manual:player-one', playerName: 'Player One', position: 'QB', confirmed: true };
    state.results[1] = { ...state.results[1], playerId: 'manual:player-two', playerName: 'Player Two', position: 'WR',
      originalTeam: 'ATL', selectingTeam: 'DAL', traded: true, confirmed: true, tradeHistory: ['ATL','CLE','DAL'] };
    payload = await request('/save', { ...state, status: 'live' }); state = payload.state;
    assert.equal(state.scores[0].total, 45); assert.equal(state.scores[0].picks[1].matches.partner, true);
    const savedRevision = state.revision;
    await request('/save', { ...state, revision: savedRevision - 1 }); assert.equal(response.status, 409);
    payload = await request('/save', { ...state, status: 'paused', rules: { ...state.rules, exact: 21 } }); state = payload.state;
    assert.equal(state.scores[0].total, 45);
    await request('/score', { revision: state.revision }); assert.equal(response.status, 400);
    payload = await request('/save', { ...state, status: 'live' }); state = payload.state;
    assert.equal(state.scores[0].total, 51);
    const invalid = structuredClone(state); invalid.results[1].playerId = invalid.results[0].playerId;
    await request('/save', invalid); assert.equal(response.status, 400);
    payload = await request('/score', { revision: state.revision }); state = payload.state;
    assert.equal(state.scores[0].total, 51);
    const persisted = JSON.parse(await fs.readFile(filePath, 'utf8'));
    assert.equal(persisted.contests[0].datasets[0].scores[0].picks[0].actual.playerName, 'Player One');
    const realScope = { contestId: 'contest-2027', datasetId: 'real-nfl' };
    let real = (await request('', undefined, realScope)).state;
    assert.equal(real.type, 'real'); assert.equal(real.source, 'nfl');
    assert.equal(real.results.filter(result => result.confirmed).length, 0);
    const realBaseline = structuredClone(real.results);
    await request('/test/reset', { revision: state.revision }, realScope); assert.equal(response.status, 400);
    await request('/save', { ...real, status: 'live' }, realScope); assert.equal(response.status, 400);
    const clone = (await request('/test/create', { revision: state.revision, clone: true, name: 'Trade test clone' })).state;
    assert.equal(clone.type, 'test'); assert.notEqual(clone.datasetId, state.datasetId);
    const cloneScope = { contestId: clone.contestId, datasetId: clone.datasetId };
    const reset = (await request('/test/reset', { revision: clone.revision }, cloneScope)).state;
    assert.equal(reset.mocks.length, 1); assert.equal(reset.scores.length, 0);
    assert.equal(reset.results.filter(result => result.confirmed).length, 0);
    state = (await request('')).state;
    assert.equal(state.results[0].confirmed, true);
    assert.deepEqual((await request('', undefined, realScope)).state.results, realBaseline);

    const realResults = real.results.map((result, index) => index < 2 ? { ...state.results[index] } : result);
    const pausedReal = await request('/save', { revision: state.revision, results: realResults, rules: real.rules, status: 'paused', year: 2027, confirmReal: true }, realScope);
    assert.ok(pausedReal.state, JSON.stringify(pausedReal));
    const previewPicks = teams.map((code, index) => ({ pick: index + 1, team: code }));
    previewPicks[0] = { ...previewPicks[0], playerId: 'manual:player-one', playerName: 'Player One', position: 'QB' };
    previewPicks[1] = { ...previewPicks[1], trade: true, tradeTo: 'DAL', playerId: 'manual:player-two', playerName: 'Player Two', position: 'WR' };
    const unpublishedReport = await fetch(base.replace('/api/admin/mock-draft/scoring', '/api/public/mock-draft/summary'), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contestId: 'contest-2027', picks: previewPicks })
    }).then(result => result.json());
    assert.equal(unpublishedReport.resultsStatus, 'paused');
    assert.equal(unpublishedReport.score.pending, 32);
    assert.equal(unpublishedReport.score.picks[0].actual, null);
    assert.equal(unpublishedReport.comparisons.combined.entries.length, 0);
    const savedReal = await request('/save', { revision: pausedReal.state.revision, results: realResults, rules: real.rules, status: 'live', year: 2027, confirmReal: true }, realScope);
    assert.ok(savedReal.state, JSON.stringify(savedReal));
    real = savedReal.state;
    const publishedRealBaseline = structuredClone(real.results);
    assert.equal(real.results.filter(result => result.confirmed).length, 2);
    const publicSummary = await fetch(base.replace('/api/admin/mock-draft/scoring', '/api/public/mock-draft/summary'), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contestId: 'contest-2027', picks: previewPicks })
    });
    assert.equal(publicSummary.status, 200);
    const publicReport = await publicSummary.json();
    assert.equal(publicReport.report, undefined);
    assert.equal(publicReport.score.total, 45);
    assert.equal(publicReport.score.pending, 30);
    assert.equal(publicReport.comparisons.combined.rank, 1);
    assert.equal(publicReport.comparisons.combined.total, 2);
    assert.equal(publicReport.comparisons.experts.entries.length, 0);
    assert.equal(Object.hasOwn(publicReport.comparisons.combined.entries[0], 'picks'), false);
    await fetch(base.replace('/api/admin/mock-draft/scoring', '/api/public/mock-draft/summary'), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contestId: 'missing-contest', picks: previewPicks })
    }).then(async result => { assert.equal(result.status, 404); });

    state = (await request('')).state;
    const builderPicks = teams.map((code, index) => ({ pick: index + 1, team: code, playerName: `Builder Player ${index + 1}`, position: 'QB' }));
    let draft = (await request('/entry/save', { revision: state.revision, mock: { name: 'Expert builder', role: 'expert', picks: builderPicks } })).state;
    const entry = draft.mocks.find(mock => mock.name === 'Expert builder');
    assert.equal(entry.status, 'draft'); assert.equal(draft.scores.some(score => score.id === entry.id), false);
    draft = (await request('/entry/submit', { revision: draft.revision, id: entry.id })).state;
    assert.equal(draft.mocks.find(mock => mock.id === entry.id).status, 'submitted');
    assert.equal(draft.scores.find(score => score.id === entry.id).role, 'expert');
    await request('/entry/save', { revision: draft.revision, mock: { ...entry, name: 'Overwrite submitted' } }); assert.equal(response.status, 400);
    draft = (await request('/contest/status', { revision: draft.revision, submissions: 'closed' })).state;
    await request('/entry/save', { revision: draft.revision, mock: { name: 'Closed submission', picks: builderPicks } }); assert.equal(response.status, 400);
    await request('/test/create', { revision: draft.revision, clone: true }, realScope); assert.equal(response.status, 400);
    const other = (await request('/contest/create', { revision: draft.revision, year: 2025, name: '2025 expert calibration' })).state;
    assert.equal(other.year, 2025); assert.equal(other.mocks.length, 0);
    assert.equal(other.results.filter(result => result.confirmed).length, 0);
    state = (await request('')).state;
    assert.deepEqual((await request('', undefined, realScope)).state.results, publishedRealBaseline);
    state = (await request('/remove', { revision: state.revision, id: entry.id })).state;
    await request('/remove', { revision: state.revision, id: state.mocks[0].id });
    const final = (await request('')).state; assert.equal(final.mocks.length, 0); assert.equal(final.scores.length, 0);
    const originalContest = structuredClone(JSON.parse(await fs.readFile(filePath, 'utf8')).contests.find(contest => contest.id === 'contest-2027'));
    assert.equal((await fetch(`${base}/calibration/load`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 401);
    assert.equal((await fetch(base.replace('/api/admin/', '/api/public/') + '/calibration')).status, 404);
    let historical = (await request('/calibration/load', { revision: final.revision })).state;
    const historicalScope = { contestId: historical.contestId, datasetId: historical.datasetId };
    assert.equal(historical.year, 2025); assert.equal(historical.locked, true);
    assert.equal(historical.type, 'test'); assert.equal(historical.source, 'historical');
    assert.equal(historical.catalog.length, 32); assert.equal(historical.results.filter(result => result.confirmed).length, 32);
    assert.equal(historical.teamOrder[1], 'CLE'); assert.equal(historical.teamOrder[24], 'HOU');
    assert.deepEqual(historical.scores.map(score => score.total).sort((left, right) => right - left), [480,173,160,96,-96]);
    const hiddenHistorical = await fetch(base.replace('/api/admin/mock-draft/scoring', '/api/public/mock-draft/summary'), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contestId: 'calibration-2025', picks: historical.mocks[0].picks })
    });
    assert.equal(hiddenHistorical.status, 404);
    await request('/test/reset', { revision: historical.revision }, historicalScope); assert.equal(response.status, 400);
    await request('/remove', { revision: historical.revision, id: historical.mocks[0].id }, historicalScope); assert.equal(response.status, 400);
    await request('/save', { ...historical, status: 'paused' }, historicalScope); assert.equal(response.status, 400);
    const changedReference = structuredClone(historical); changedReference.results[0].playerName = 'Changed name';
    await request('/save', changedReference, historicalScope); assert.equal(response.status, 400);
    historical = (await request('/save', { ...historical, rules: { ...historical.rules, exact: 16 } }, historicalScope)).state;
    assert.equal(historical.scores.find(score => score.id === 'calibration-a').total, 512);
    historical = (await request('/calibration/load', { revision: historical.revision }, historicalScope)).state;
    assert.equal(historical.mocks.length, 5); assert.equal(historical.rules.exact, 16);
    const hypothetical = (await request('/test/create', { revision: historical.revision, clone: true, name: '2025 trade experiment' }, historicalScope)).state;
    assert.equal(hypothetical.locked, undefined); assert.equal(hypothetical.source, 'hypothetical');
    const hypotheticalScope = { contestId: hypothetical.contestId, datasetId: hypothetical.datasetId };
    const historicalReset = (await request('/test/reset', { revision: hypothetical.revision }, hypotheticalScope)).state;
    assert.equal(historicalReset.results[1].originalTeam, 'CLE'); assert.equal(historicalReset.results[24].originalTeam, 'HOU');
    assert.equal(historicalReset.results.filter(result => result.confirmed).length, 0);
    assert.equal((await request('', undefined, historicalScope)).state.results.filter(result => result.confirmed).length, 32);
    historical = (await request('/import', { revision: historicalReset.revision, mocks: [{ name: 'Name-only historical expert import', role: 'expert',
      picks: historical.results.map(result => ({ pick: result.pick, team: result.originalTeam, playerName: result.playerName, position: result.position })) }] }, historicalScope)).state;
    assert.equal(historical.scores.find(score => score.name === 'Name-only historical expert import').total, 512);
    assert.equal(historical.scores.find(score => score.name === 'Name-only historical expert import').role, 'expert');
    assert.deepEqual(JSON.parse(await fs.readFile(filePath, 'utf8')).contests.find(contest => contest.id === 'contest-2027'), originalContest);
    console.log('2025 admin-only calibration API: auth, exact totals, locked reference, permanent fixtures, idempotency, custom rules, independent clone/reset, name-only imports, and 2027 isolation passed.');
    await fs.writeFile(filePath, JSON.stringify({ revision: 8, year: 2025, status: 'live', rules: state.rules,
      results: state.results, mocks: [{ id: 'legacy-entry', name: 'Legacy test', picks: builderPicks }], scores: [], scoredAt: null }));
    const migrated = (await request('')).state;
    assert.equal(migrated.type, 'test'); assert.equal(migrated.source, 'hypothetical');
    assert.equal(migrated.name, 'Migrated scoring test'); assert.equal(migrated.year, 2025);
    assert.equal(migrated.mocks[0].status, 'submitted'); assert.equal(migrated.results[0].confirmed, true);
    assert.equal((await request('', undefined, realScope)).state.results.filter(result => result.confirmed).length, 0);
    await request('/score', { revision: migrated.revision });
    const migratedFile = JSON.parse(await fs.readFile(filePath, 'utf8'));
    assert.equal(migratedFile.version, 2); assert.equal(migratedFile.contests[0].datasets[1].scores.length, 0);
    console.log('Scoring API tests passed: save/submit/lock, roles, authorization, import, auto-score, pause/resume, revisions, test/real isolation, clone/reset, separate contests, persistence.');
  } finally {
    await new Promise(resolve => server.close(resolve));
    await fs.rm(directory, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });