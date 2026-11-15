'use strict';

const assert = require('node:assert/strict');
const express = require('express');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { registerScoringRoutes } = require('../mock-draft-scoring-store');
const { makeFixture } = require('./mock-contest-fixture');

async function main() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'hush-scoring-test-'));
  const filePath = path.join(directory, 'state.json');
  const fixture = makeFixture();
  const app = express(); app.use(express.json());
  registerScoringRoutes(app, (req, res, next) => req.get('x-admin-key') === 'test' ? next() : res.sendStatus(401),
    async (target, content) => { await fs.writeFile(`${target}.tmp`, content); await fs.rename(`${target}.tmp`, target); },
    async () => fixture.teamOrder, { filePath });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/admin/mock-draft/scoring`;
  let state;
  async function request(action, body, expected = 200, scope) {
    const selection = scope || { contestId: state?.contestId || 'contest-2027', datasetId: state?.datasetId || 'real-nfl' };
    const response = await fetch(base + action + (body ? '' : `?${new URLSearchParams(selection)}`), {
      method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', 'x-admin-key': 'test' },
      ...(body ? { body: JSON.stringify({ ...selection, revision: state?.revision, ...body }) } : {})
    });
    const payload = await response.json();
    assert.equal(response.status, expected, payload.error);
    if (payload.state) state = payload.state;
    return payload;
  }
  try {
    assert.equal((await fetch(base)).status, 401);
    await request('');
    assert.equal(state.datasetId, 'real-nfl', 'Admin opens the website results, not a private test dataset');
    assert.equal(state.type, 'real');
    assert.equal(state.status, 'paused');
    assert.equal(state.results.length, 32);
    const mock = fixture.fixtures[0];
    await request('/entry/save', { mock: { ...mock, id: undefined, name: 'Named Expert', role: 'expert' } });
    const id = state.mocks.at(-1).id;
    assert.equal(state.mocks[0].status, 'draft');
    assert.equal(state.scores.length, 0);
    await request('/entry/submit', { id });
    assert.equal(state.mocks[0].status, 'submitted');
    await request('/score', {}, 400);
    await request('/save', { year: 2027, status: 'live', results: fixture.results, rules: state.rules }, 400);
    await request('/save', { year: 2027, confirmReal: true, status: 'live', rules: state.rules,
      results: fixture.results.map((row, index) => ({ ...row, confirmed: index === 0 })) });
    assert.equal(state.scores[0].total, 15);
    assert.equal(state.scores[0].pending, 31);
    assert.equal(state.scores[0].role, 'expert');
    const revision = state.revision;
    await request('/save', { revision: revision - 1 }, 409);
    await request('/save', { year: 2027, confirmReal: true, status: 'paused', results: state.results,
      rules: { ...state.rules, exact: 16 } });
    assert.equal(state.scores[0].total, 15, 'Pause holds published scores');
    await request('/score', {}, 400);
    await request('/save', { year: 2027, confirmReal: true, status: 'final', rules: state.rules, results: fixture.results });
    assert.equal(state.scores[0].total, 512);
    assert.equal(state.scores[0].pending, 0);
    const invalid = structuredClone(state.results);
    invalid[1].playerId = invalid[0].playerId;
    const beforeInvalid = await fs.readFile(filePath, 'utf8');
    await request('/save', { year: 2027, confirmReal: true, status: 'final', results: invalid, rules: state.rules }, 400);
    assert.equal(await fs.readFile(filePath, 'utf8'), beforeInvalid);
    await request('/entry/save', { mock: { ...mock, id, name: 'Updated Expert', role: 'expert' } });
    assert.equal(state.mocks[0].status, 'submitted');
    assert.equal(state.scores[0].name, 'Updated Expert');
    const perfectNameOnly = fixture.results.map(row => ({ pick: row.pick, team: row.originalTeam,
      playerName: row.playerName, position: row.position }));
    await request('/import', { mocks: [{ name: 'Another Expert', role: 'expert', picks: perfectNameOnly }] });
    assert.equal(state.scores.at(-1).total, 160, 'Name-only imports match positions; catalog exact picks require shared player IDs');
    await request('/preview', { picks: mock.picks, name: 'Preview Expert', role: 'expert' });
    const preview = await request('/preview', { picks: mock.picks });
    assert.equal(preview.score.total, 512);
    assert.equal(preview.comparisons.experts.entries.length, 2);
    const actualBaseline = structuredClone(state.results);
    await request('/test/reset', {}, 400);
    await request('/test/create', { clone: true }, 400);
    await request('/test/create', { name: 'Private hypothetical' });
    assert.equal(state.type, 'test');
    const privateScope = { contestId: state.contestId, datasetId: state.datasetId };
    await request('/save', { year: 2027, status: 'final', results: fixture.results, rules: state.rules });
    await request('/test/create', { clone: true, name: 'Private clone' });
    await request('/test/reset', {});
    assert.equal(state.results.filter(row => row.confirmed).length, 0);
    assert.equal(state.scores.length, 0);
    await request('', undefined, 200, privateScope);
    assert.equal(state.results.filter(row => row.confirmed).length, 32);
    await request('', undefined, 200, { contestId: 'contest-2027', datasetId: 'real-nfl' });
    assert.deepEqual(state.results, actualBaseline);
    await request('/contest/status', { submissions: 'closed' });
    await request('/entry/save', { mock }, 400);
    await request('/import', { mocks: [mock] }, 400);
    await request('/contest/status', { submissions: 'open' });
    await request('/contest/create', { year: 2025 }, 400);
    await request('/contest/create', { year: 2027, name: 'Other 2027 contest' });
    assert.equal(state.mocks.length, 0);
    assert.equal(state.datasetId, 'real-nfl');
    const otherId = state.contestId;
    await request('/contest/delete', { confirmDelete: 'wrong' }, 400);
    await request('/contest/delete', { confirmDelete: otherId });
    assert.equal(state.contestId, 'contest-2027');
    assert.equal(state.datasetId, 'real-nfl');
    await request('/contest/delete', { confirmDelete: state.contestId }, 400);
    for (const route of ['/sandbox/load', '/calibration/load', '/entry/register-2025', '/entry/submit-2025', '/score-2025']) {
      const response = await fetch(base + route, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-key': 'test' }, body: '{}' });
      assert.equal(response.status, 404, `${route} is retired`);
    }
    await request('/remove', { id });
    assert.equal(state.mocks.length, 1);
    assert.equal(state.scores.length, 1);
    assert.equal(state.scores[0].name, 'Another Expert');
    assert.equal(JSON.parse(await fs.readFile(filePath, 'utf8')).contests[0].datasets.find(item => item.id === 'real-nfl').scores.length, 1);
    console.log('2027 scoring API: real defaults, save/submit/update, named experts, auth, live/final/pause scoring, revisions, imports, previews, private isolation, contest deletion, persistence and retired routes passed.');
  } finally {
    await new Promise(resolve => server.close(resolve));
    await fs.rm(directory, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
