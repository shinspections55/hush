'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const express = require('express');
const vm = require('node:vm');
const { registerScoringRoutes } = require('../mock-draft-scoring-store');
const { makeFixture } = require('./mock-contest-fixture');

async function main() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'hush-entry-names-'));
  const app = express(); app.use(express.json());
  const fixture = makeFixture();
  registerScoringRoutes(app, (req, res, next) => req.get('x-admin-key') === 'test' ? next() : res.sendStatus(401),
    (target, content) => fs.writeFile(target, content), async () => fixture.teamOrder, { filePath: path.join(directory, 'state.json') });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/admin/mock-draft/scoring`;
  let state;
  async function request(action, body, expected = 200) {
    const response = await fetch(base + action, { method: body ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json', 'x-admin-key': 'test' },
      ...(body ? { body: JSON.stringify({ revision: state.revision, contestId: state.contestId, datasetId: state.datasetId, ...body }) } : {}) });
    const payload = await response.json();
    assert.equal(response.status, expected, payload.error);
    if (payload.state) state = payload.state;
    return payload;
  }
  try {
    await request('');
    for (const year of [2027]) {
      const picks = fixture.results.map(row => ({ pick: row.pick, team: row.originalTeam, playerId: row.playerId,
        playerName: row.playerName, position: row.position }));
      await request('/entry/save', { mock: { name: '', role: 'expert', picks } }, 400);
      for (const role of ['expert', 'participant']) {
        const name = role === 'expert' ? 'Expert Example' : 'ignored-custom-title';
        const mock = { name, role, username: 'contestant55', picks };
        await request('/entry/save', { mock });
        await request('/entry/submit', { id: state.mocks.at(-1).id });
        await request('/save', { year, confirmReal: true, status: 'final', rules: state.rules, results: fixture.results });
        const saved = state.mocks.at(-1);
        assert.equal(saved.name, role === 'expert' ? name : 'contestant55');
        assert.equal(saved.username, role === 'expert' ? undefined : 'contestant55');
        assert.equal(saved.role, role);
        const preview = await request('/preview', { ...mock });
        assert.equal(preview.entry.name, saved.name);
        assert.equal(preview.comparisons[role === 'expert' ? 'experts' : 'participants'].entries[0].name, saved.name);
      }
      assert.equal(state.scores.length, 2);
      assert.equal(state.scores[0].total, state.scores[1].total, 'Both roles use identical scoring');
    }
    const source = await fs.readFile(path.join(__dirname, '..', 'admin-mock-draft-scoring.js'), 'utf8');
    const fields = { mockBuilderName: { value: '  Username55  ' }, mockBuilderRole: { value: 'participant' } };
    const context = vm.createContext({ document: { getElementById: id => fields[id] } });
    vm.runInContext(source.slice(source.indexOf('  function builderIdentity()'), source.indexOf("  document.getElementById('previewContestantMockBtn').addEventListener")), context);
    assert.equal(vm.runInContext('builderIdentity().username', context), 'Username55');
    fields.mockBuilderRole.value = 'expert';
    assert.equal(vm.runInContext('builderIdentity().username', context), undefined);
    fields.mockBuilderName.value = ' ';
    assert.throws(() => vm.runInContext('builderIdentity()', context), /expert's name/);
    fields.mockBuilderRole.value = 'participant';
    assert.throws(() => vm.runInContext('builderIdentity()', context), /contestant's username/);

    const builder = await fs.readFile(path.join(__dirname, '..', 'mock-draft-contest.js'), 'utf8');
    let click;
    const publicContext = vm.createContext({
      HushMockDeadline: require('../mock-draft-contest-policy'),
      ADMIN_BUILDER_MODE: false, location: {}, publicEntryReady: true, publicSubmitting: false,
      window: { confirm: () => true },
      document: { getElementById: () => ({ addEventListener(_type, callback) { click = callback; }, setAttribute() {}, removeAttribute() {} }) },
      exportMockDraft: () => ({ picks: [] }),
      publicContestRequest: async (url, body) => { assert.equal(url, '/api/mock-draft/entry'); assert.equal(body.year, 2027); assert.equal(body.username, undefined); },
      setSaveStatus() { assert.fail('Unexpected error'); }
    });
    vm.runInContext(builder.slice(builder.indexOf("document.getElementById('reviewMockBtn').addEventListener"),
      builder.indexOf("document.getElementById('downloadMockBtn').addEventListener")), publicContext);
    await click({ preventDefault() {} });
    assert.equal(publicContext.location.href, 'mock-draft-summary.html?submitted=1');
    console.log('Entry names: expert/username validation, 2027 persistence, equal scoring, standings labels, and signed-in review passed.');
  } finally {
    await new Promise(resolve => server.close(resolve));
    await fs.rm(directory, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
