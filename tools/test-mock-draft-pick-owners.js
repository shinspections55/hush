'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const express = require('express');

async function main() {
  const root = path.resolve(__dirname, '..');
  const serverSource = await fs.readFile(path.join(root, 'server.js'), 'utf8');
  const clientSource = await fs.readFile(path.join(root, 'mock-draft-contest.js'), 'utf8');
  const adminSource = await fs.readFile(path.join(root, 'admin-mock-draft.js'), 'utf8');
  const teams = ['ARI','ATL','BAL','BUF','CAR','CHI','CIN','CLE','DAL','DEN','DET','GB','HOU','IND','JAC','KC','LAC','LAR','LV','MIA','MIN','NE','NO','NYG','NYJ','PHI','PIT','SEA','SF','TB','TEN','WAS'];
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'hush-pick-owners-'));
  const file = path.join(directory, 'owners.json');
  const needsFile = path.join(directory, 'team-needs-2027.json');
  const originalNeeds = JSON.parse(await fs.readFile(path.join(root, 'college prospects 2027', 'team-needs-2027.json'), 'utf8'));
  await fs.writeFile(needsFile, JSON.stringify(originalNeeds));
  const app = express();
  app.use(express.json());
  const errors = [];
  const context = vm.createContext({
    app, fs, path, MOCK_DRAFT_DATA_DIRECTORY: directory, MOCK_DRAFT_TEAM_CODES: teams, MOCK_DRAFT_TEAM_ORDER_FILE: file,
    console: { error: (...args) => errors.push(args) },
    requireAdminDebugKey: (req, res, next) => req.get('x-admin-key') === 'test-only' ? next() : res.sendStatus(401),
    writeJsonFileAtomically: async (target, text) => {
      await fs.writeFile(`${target}.tmp`, text);
      await fs.rename(`${target}.tmp`, target);
    }
  });
  vm.runInContext(
    serverSource.slice(serverSource.indexOf('async function readMockDraftTeamOrder()'), serverSource.indexOf("app.get('/api/admin/mock-draft/prospects'")) +
    serverSource.slice(serverSource.indexOf('const MOCK_DRAFT_TEAM_NEEDS_FILE ='), serverSource.indexOf("app.post('/api/admin/mock-draft/team-order/save'")) +
    serverSource.slice(serverSource.indexOf("app.post('/api/admin/mock-draft/team-order/save'"), serverSource.indexOf("require('./mock-draft-scoring-store').registerScoringRoutes")),
    context
  );
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const endpoint = '/api/admin/mock-draft/team-order/save';
  const publicEndpoint = '/api/public/mock-draft/default-team-order';
  const order = teams.slice();
  order[1] = 'ARI';
  async function save(value, key = 'test-only') {
    return fetch(base + endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-key': key }, body: JSON.stringify({ order: value }) });
  }
  try {
    const needsEndpoint = '/api/admin/mock-draft/team-needs';
    assert.equal((await fetch(base + needsEndpoint)).status, 401);
    async function saveNeeds(needs, key = 'test-only') {
      return fetch(base + needsEndpoint + '/save', { method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': key }, body: JSON.stringify({ needs }) });
    }
    const needs = Object.fromEntries(teams.map(code => [code, originalNeeds[code].needs]));
    needs.ARI = [' WR ', 'iOL', 'CB'];
    needs.ATL = [];
    assert.equal((await saveNeeds(needs, 'wrong')).status, 401);
    assert.equal((await saveNeeds(needs)).status, 200);
    const savedNeeds = JSON.parse(await fs.readFile(needsFile, 'utf8'));
    assert.equal(savedNeeds.ARI.name, originalNeeds.ARI.name);
    assert.deepEqual(savedNeeds.ARI.needs, ['WR', 'iOL', 'CB']);
    assert.deepEqual(savedNeeds.ATL.needs, []);
    const reloadedNeeds = await (await fetch(base + needsEndpoint, { headers: { 'x-admin-key': 'test-only' } })).json();
    assert.deepEqual(reloadedNeeds.teamNeeds, savedNeeds);
    for (const invalid of [{}, { ...needs, ARI: [''] }, { ...needs, ARI: ['X'.repeat(21)] },
      { ...needs, ARI: [42] }, { ...needs, ARI: Array(11).fill('QB') }, { ...needs, XXX: [] }]) {
      assert.equal((await saveNeeds(invalid)).status, 400);
      assert.deepEqual(JSON.parse(await fs.readFile(needsFile, 'utf8')), savedNeeds);
    }
    assert.deepEqual((await (await fetch(base + publicEndpoint)).json()).order, teams);
    assert.equal((await save(order, 'wrong')).status, 401);
    assert.equal((await save(order)).status, 200);
    assert.deepEqual(JSON.parse(await fs.readFile(file, 'utf8')).order, order);
    assert.deepEqual((await (await fetch(base + publicEndpoint)).json()).order, order);
    for (const invalid of [order.slice(1), [...order, 'ARI'], order.map((code, index) => index ? code : 'XXX'), null]) {
      assert.equal((await save(invalid)).status, 400);
      assert.deepEqual(JSON.parse(await fs.readFile(file, 'utf8')).order, order);
    }
    const client = vm.createContext({
      NFL_TEAMS: teams.map(code => [code, code]), defaultTeamOrder: teams.slice(),
      picks: Array.from({ length: 32 }, (_, index) => ({ playerId: index === 0 ? 'saved-player' : '', team: index === 0 ? 'DAL' : '', tradeTo: '' })),
      fetch: async () => ({ ok: true, json: async () => ({ order }) }),
      saveMock() {}, renderPicks() {}, console, prospectPoolStatus: { textContent: '' }
    });
    vm.runInContext(
      clientSource.slice(clientSource.indexOf('function applyDefaultTeamOrder()'), clientSource.indexOf('function getProspectById(')) +
      clientSource.slice(clientSource.indexOf('async function loadDefaultTeamOrder()'), clientSource.indexOf('async function loadTeamNeeds()')),
      client
    );
    await vm.runInContext('loadDefaultTeamOrder()', client);
    assert.equal(client.picks[0].team, 'DAL', 'Existing pick owner is preserved');
    assert.equal(client.picks[0].playerId, 'saved-player');
    assert.equal(client.picks[1].team, 'ARI', 'Repeated owner reaches new picks');
    client.picks = Array.from({ length: 32 }, () => ({ team: '', playerId: '', tradeTo: '' }));
    await vm.runInContext('loadDefaultTeamOrder()', client);
    assert.deepEqual(Array.from(client.picks, pick => pick.team), order);
    function element() {
      return {
        children: [], events: {}, classList: { add() {}, remove() {} },
        append(...children) { this.children.push(...children); },
        replaceChildren(fragment) { this.children = fragment.children; },
        setAttribute(name, value) { this[name] = value; },
        addEventListener(name, callback) { this.events[name] = callback; }
      };
    }
    const roster = element();
    const admin = vm.createContext({
      testWorkspace: false,
      document: { createElement: element, createDocumentFragment: element, getElementById: () => roster },
      NFL_TEAMS: teams.map(code => [code, code]), teamOrder: teams.slice(), teamNeeds: {},
      teamOrderDirty: false, updateDirtyButtons() {}
    });
    vm.runInContext(adminSource.slice(adminSource.indexOf('  function renderTeamOrder()'), adminSource.indexOf('  function renderTeamNeeds()')), admin);
    vm.runInContext('renderTeamOrder()', admin);
    assert.equal(roster.children.length, 32);
    const select = roster.children[1].children[1].children[0];
    assert.equal(select['aria-label'], 'Pick 2 owner');
    assert.equal(select.children.length, 32);
    select.value = 'ARI';
    select.events.change();
    assert.equal(admin.teamOrder[0], 'ARI');
    assert.equal(admin.teamOrder[1], 'ARI');
    assert.equal(admin.teamOrderDirty, true);
    assert.equal(roster.children[1].children[1].children[0].value, 'ARI');
    admin.teamNeeds = structuredClone(savedNeeds);
    vm.runInContext(adminSource.slice(adminSource.indexOf('  function renderTeamNeeds()'), adminSource.indexOf('  function renderActiveView()')), admin);
    vm.runInContext('renderTeamNeeds()', admin);
    assert.equal(roster.children.length, 32, 'All teams have needs controls, including teams without picks');
    const needsInput = roster.children[0].children[1];
    assert.equal(needsInput.value, 'WR, iOL, CB');
    needsInput.value = 'QB, OT, EDGE';
    needsInput.events.input();
    assert.deepEqual(Array.from(admin.teamNeeds.ARI.needs), ['QB', 'OT', 'EDGE']);
    assert.equal(admin.teamNeedsDirty, true);
    const views = Object.fromEntries(['positionEditorView', 'overallEditorView', 'teamOrderEditorView', 'teamNeedsEditorView', 'scoringEditorView'].map(id => [id, { hidden: true }]));
    const tabs = ['teams', 'needs'].map(view => ({
      dataset: { view }, classList: { toggle(_name, selected) { this.selected = selected; } },
      setAttribute(name, value) { this[name] = value; }
    }));
    admin.document.getElementById = id => views[id];
    admin.document.querySelectorAll = () => tabs;
    admin.titleOutput = {};
    admin.activePosition = 'QB';
    admin.renderActiveView = () => {};
    vm.runInContext(adminSource.slice(adminSource.indexOf('  function setActiveView('), adminSource.indexOf('  function rerankPosition(')), admin);
    vm.runInContext("setActiveView('needs')", admin);
    assert.equal(views.teamNeedsEditorView.hidden, false);
    assert.equal(views.teamOrderEditorView.hidden, true);
    assert.equal(tabs[1]['aria-pressed'], 'true');
    assert.equal(admin.titleOutput.textContent, 'Team Needs');
    vm.runInContext("setActiveView('teams')", admin);
    assert.equal(views.teamNeedsEditorView.hidden, true);
    assert.equal(views.teamOrderEditorView.hidden, false);
    assert.equal(tabs[1]['aria-pressed'], 'false');
    assert.deepEqual(Array.from(admin.teamNeeds.ARI.needs), ['QB', 'OT', 'EDGE'], 'Tab switches preserve unsaved needs');
    await fs.writeFile(file, '{"order":["XXX"]}');
    assert.equal((await fetch(base + publicEndpoint)).status, 500);
    assert.equal(errors.length, 1, 'Invalid saved configuration is logged');
    console.log('Mock draft pick-owner and team-needs API, persistence, validation, and client defaults passed.');
  } finally {
    await new Promise(resolve => server.close(resolve));
    await fs.rm(directory, { recursive: true, force: true });
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
