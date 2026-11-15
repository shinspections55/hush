'use strict';

const assert = require('node:assert/strict');
const express = require('express');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { registerScoringRoutes } = require('../mock-draft-scoring-store');
const { makeFixture } = require('./mock-contest-fixture');
const { DEADLINE_2027 } = require('../mock-draft-contest-policy');

async function main() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'hush-public-contest-'));
  const filePath = path.join(directory, 'state.json');
  let clock = Date.parse(DEADLINE_2027) - 1000;
  const historical = makeFixture();
  const picks = historical.results.map(row => ({ pick: row.pick, team: row.originalTeam, playerId: row.playerId,
    playerName: row.playerName, position: row.position }));
  const app = express(); app.use(express.json());
  registerScoringRoutes(app, (req, res, next) => req.get('x-admin-key') === 'test' ? next() : res.sendStatus(401),
    async (target, content) => { await fs.writeFile(`${target}.tmp`, content); await fs.rename(`${target}.tmp`, target); },
    async () => historical.teamOrder, {
      filePath, now: () => clock, verifyAccount: async req => {
        const name = req.get('authorization');
        if (!['alice', 'bob'].includes(name)) throw new Error('Sign in');
        return { uid: `uid-${name}`, username: name };
      }
    });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  async function api(url, body, user = 'alice', expected = 200) {
    const response = await fetch(base + url, { method: body ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json', authorization: user },
      ...(body ? { body: JSON.stringify(body) } : {}) });
    const payload = await response.json();
    assert.equal(response.status, expected, payload.error);
    return payload;
  }
  let state;
  async function admin(action, body, expected = 200) {
    const response = await fetch(`${base}/api/admin/mock-draft/scoring${action}`, {
      method: body ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json', 'x-admin-key': 'test' },
      ...(body ? { body: JSON.stringify({ revision: state.revision, contestId: state.contestId, datasetId: state.datasetId, ...body }) } : {})
    });
    const payload = await response.json();
    assert.equal(response.status, expected, payload.error);
    if (payload.state) state = payload.state;
    return payload;
  }
  try {
    await api('/api/mock-draft/entry', undefined, 'anonymous', 401);
    await admin('');
    await admin('/entry/save', { mock: { name: 'Expert A', role: 'expert', picks } });
    const expertId = state.mocks.at(-1).id;
    await admin('/entry/submit', { id: expertId });
    const initial = await api('/api/mock-draft/entry', { year: 2027, picks, role: 'expert', username: 'Expert A', id: expertId });
    assert.equal(initial.entry.name, 'alice');
    assert.equal(initial.entry.role, 'participant');
    assert.notEqual(initial.entry.id, expertId);
    await api('/api/mock-draft/entry', { year: 2025, picks }, 'alice', 400);
    await api('/api/mock-draft/entry', { year: 2027, picks: picks.slice(0, 31) }, 'alice', 400);
    const updatedPicks = structuredClone(picks);
    [updatedPicks[0].playerId, updatedPicks[1].playerId] = [updatedPicks[1].playerId, updatedPicks[0].playerId];
    const update = await api('/api/mock-draft/entry', { picks: updatedPicks });
    assert.equal(update.entry.id, initial.entry.id);
    assert.equal(update.entry.status, 'submitted');
    await api('/api/mock-draft/entry', { picks }, 'bob');
    const own = await api('/api/mock-draft/entry');
    assert.equal(own.entry.ownerUid, 'uid-alice');
    assert.deepEqual(own.entry.picks.map(pick => pick.playerId), updatedPicks.map(pick => pick.playerId));
    let board = await api('/api/public/mock-draft/scoreboard');
    assert.equal(board.entries.length, 3);
    assert.ok(board.entries.every(entry => entry.total === 0 && entry.pending === 32));
    assert.equal(JSON.stringify(board).includes('playerId'), false);
    assert.equal(JSON.stringify(board).includes('ownerUid'), false);
    assert.equal(JSON.stringify(board).includes('uid-alice'), false);
    await api('/api/public/mock-draft/scoreboard?year=2025', undefined, 'alice', 400);
    await admin('');
    state.datasetId = 'real-nfl';
    await admin('/save', { year: 2027, confirmReal: true, status: 'live', rules: state.rules,
      results: historical.results.map((row, index) => ({ ...row, confirmed: index === 0 })) });
    board = await api('/api/public/mock-draft/scoreboard');
    assert.equal(board.confirmed, 1);
    assert.equal(board.entries.find(entry => entry.name === 'bob').total, 15);
    let report = await api('/api/mock-draft/report');
    assert.equal(report.entry.name, 'alice');
    assert.equal(report.mock.picks[0].playerId, updatedPicks[0].playerId);
    assert.equal(report.comparisons.combined.entries.filter(entry => entry.name === 'alice').length, 0);
    assert.equal(report.comparisons.combined.total, 3, 'Own account counted exactly once');
    assert.equal(report.comparisons.experts.entries.length, 1);
    await admin('/save', { year: 2027, confirmReal: true, status: 'final', rules: state.rules, results: historical.results });
    board = await api('/api/public/mock-draft/scoreboard');
    assert.equal(board.confirmed, 32);
    assert.equal(board.entries.find(entry => entry.name === 'bob').pending, 0);
    report = await api('/api/mock-draft/report?year=2027');
    assert.equal(report.resultsStatus, 'final');
    clock = Date.parse(DEADLINE_2027) - 1;
    const beforeCutoff = await api('/api/mock-draft/entry', { picks });
    assert.equal(beforeCutoff.submissionPolicy.editable, true);
    clock = Date.parse(DEADLINE_2027);
    await admin('');
    const beforeRejected = await fs.readFile(filePath, 'utf8');
    await api('/api/mock-draft/entry', { picks: updatedPicks }, 'alice', 400);
    await admin('/entry/save', { mock: { id: expertId, name: 'Expert changed too late', role: 'expert', picks } }, 400);
    assert.equal(await fs.readFile(filePath, 'utf8'), beforeRejected, 'Deadline rejections do not mutate saved entries');
    assert.equal((await api('/api/mock-draft/entry')).submissionPolicy.open, false);
    clock += 1;
    await api('/api/mock-draft/entry', { picks }, 'bob', 400);
    await admin('/contest/status', { submissions: 'open' });
    await api('/api/mock-draft/entry', { picks }, 'bob', 400);
    await admin('/save', { year: 2027, confirmReal: true, status: 'live', rules: state.rules,
      results: historical.results.map((row, index) => ({ ...row, confirmed: index === 0 })) });
    assert.equal((await api('/api/mock-draft/report')).score.total, 15, 'NFL result publication still works after predictions lock');
    await admin('/save', { year: 2027, confirmReal: true, status: 'final', rules: state.rules, results: historical.results });
    assert.equal((await api('/api/mock-draft/report')).score.total, 480);
    clock = Date.parse(DEADLINE_2027) - 1;
    await admin('/contest/status', { submissions: 'closed' });
    await api('/api/mock-draft/entry', { picks }, 'alice', 400);
    const beforeRetiredRequests = await fs.readFile(filePath, 'utf8');
    for (const suffix of ['sandbox=2027', 'sandbox=unknown', 'year=2025']) {
      await api(`/api/public/mock-draft/scoreboard?${suffix}`, undefined, 'alice', 400);
      await api(`/api/mock-draft/entry?${suffix}`, undefined, 'alice', 400);
      await api(`/api/mock-draft/entry?${suffix}`, { year: suffix === 'year=2025' ? 2025 : 2027, picks }, 'alice', 400);
      await api(`/api/mock-draft/report?${suffix}`, undefined, 'alice', 400);
    }
    await api('/api/public/mock-draft/summary?sandbox=2027', { picks }, 'alice', 400);
    await api('/api/public/mock-draft/summary', { contestId: 'calibration-2025', picks }, 'alice', 404);
    assert.equal(await fs.readFile(filePath, 'utf8'), beforeRetiredRequests, 'Old test links cannot change real entries or results');
    await admin('/contest/status', { submissions: 'open' });
    const rescored = await api('/api/mock-draft/entry', { picks });
    assert.equal(rescored.entry.id, initial.entry.id);
    assert.equal((await api('/api/mock-draft/report')).score.total, 480, 'Published real results score submitted updates immediately');
    board = await api('/api/public/mock-draft/scoreboard');
    assert.equal(board.entries.length, 3, 'Retired test requests never add real entries');
    assert.ok(board.entries.every(entry => entry.total === 480 && entry.pending === 0));
    console.log('Public 2027 contest: ownership, usernames, experts, one entry/account, exact cutoff, live/final scoring, private picks, no duplicate self, and retired test rejection passed.');
  } finally {
    await new Promise(resolve => server.close(resolve));
    await fs.rm(directory, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
