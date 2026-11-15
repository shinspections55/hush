'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { DEFAULT_RULES, scoreMock } = require('./mock-draft-scoring');
const { retireMockTestContests } = require('./mock-draft-scoring-migration');
const { submissionPolicy } = require('./mock-draft-contest-policy');
const TEAMS = new Set(['ARI','ATL','BAL','BUF','CAR','CHI','CIN','CLE','DAL','DEN','DET','GB','HOU','IND','JAC','KC','LAC','LAR','LV','MIA','MIN','NE','NO','NYG','NYJ','PHI','PIT','SEA','SF','TB','TEN','WAS']);
const POSITIONS = new Set(['QB','RB','WR','TE','OL','DL','EDGE','LB','DB']);

function text(value, limit = 160) {
  if (value != null && typeof value !== 'string') throw new Error('Text fields must be strings');
  const result = String(value || '').trim();
  if (result.length > limit) throw new Error(`Text field exceeds ${limit} characters`);
  return result;
}

function team(value) {
  const result = text(value, 3).toUpperCase();
  if (result && !TEAMS.has(result)) throw new Error('Invalid NFL team code');
  return result;
}

function position(value) {
  const raw = text(value, 10).toUpperCase();
  const result = ({ OT:'OL', OG:'OL', C:'OL', CB:'DB', S:'DB', DT:'DL', DE:'EDGE' })[raw] || raw;
  if (result && !POSITIONS.has(result)) throw new Error('Invalid prospect position');
  return result;
}

function playerId(value) {
  if (value == null) return '';
  return text(value, 300);
}

function normalizeResults(input) {
  if (!Array.isArray(input) || input.length !== 32) throw new Error('Actual results must contain 32 pick slots');
  const selected = new Set();
  return input.map((row, index) => {
    if (!row || row.pick !== index + 1) throw new Error('Actual pick slots must be numbered 1-32 in order');
    const result = { pick: index + 1, originalTeam: team(row.originalTeam), selectingTeam: team(row.selectingTeam),
      playerId: playerId(row.playerId), playerName: text(row.playerName), position: position(row.position),
      traded: row.traded === true, confirmed: row.confirmed === true, notes: text(row.notes, 1000), tradeHistory: [] };
    if (!Array.isArray(row.tradeHistory) || row.tradeHistory.length > 32) throw new Error('Trade history must be an array of team codes');
    result.tradeHistory = row.tradeHistory.map(team);
    if (result.tradeHistory.some(code => !code)) throw new Error('Trade history cannot contain blank teams');
    if (result.confirmed) {
      if (!result.playerId || !result.playerName || !result.position || !result.originalTeam || !result.selectingTeam) throw new Error(`Complete player, position, and team fields before confirming pick ${result.pick}`);
      if (selected.has(result.playerId)) throw new Error('A prospect cannot be confirmed at two picks');
      selected.add(result.playerId);
      if (!result.traded && result.originalTeam !== result.selectingTeam) throw new Error(`Mark pick ${result.pick} as traded when its owner changes`);
      if (result.traded && !result.tradeHistory.length) result.tradeHistory = [result.originalTeam, result.selectingTeam];
      if (result.tradeHistory.length && (result.tradeHistory[0] !== result.originalTeam || result.tradeHistory.at(-1) !== result.selectingTeam)) throw new Error(`Trade history for pick ${result.pick} must start with the original owner and end with the selecting team`);
    }
    return result;
  });
}

function normalizeRules(input) {
  if (!input || typeof input !== 'object') throw new Error('Scoring rules are required');
  return Object.fromEntries(Object.keys(DEFAULT_RULES).map(key => {
    const value = input[key];
    if (!Number.isInteger(value) || value < -100 || value > 100) throw new Error(`Rule ${key} must be an integer from -100 to 100`);
    if ((key.toLowerCase().includes('miss') && value > 0) || (!key.toLowerCase().includes('miss') && value < 0)) throw new Error(`Rule ${key} has the wrong sign`);
    return [key, value];
  }));
}

function normalizeMock(input) {
  if (!input || !Array.isArray(input.picks) || input.picks.length > 32 || !input.picks.length) throw new Error('A mock needs 1-32 predictions');
  const seenPicks = new Set();
  const seenPlayers = new Set();
  const picks = input.picks.map((row, index) => {
    const pick = row.pick == null ? index + 1 : row.pick;
    if (!Number.isInteger(pick) || pick < 1 || pick > 32 || seenPicks.has(pick)) throw new Error('Mock pick numbers must be unique integers from 1-32');
    seenPicks.add(pick);
    const prospect = row.prospect || {};
    const name = text(row.playerName || prospect.name);
    const manualKey = name ? `manual:${name.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}` : '';
    const result = { pick, team: team(row.team), tradeTo: team(row.tradeTo), trade: row.trade === true || Boolean(row.tradeTo),
      playerId: playerId(row.playerId || prospect.id || manualKey), playerName: name, position: position(row.position || prospect.position) };
    if (result.playerId && seenPlayers.has(result.playerId)) throw new Error('A mock cannot select the same prospect twice');
    if (result.playerId) seenPlayers.add(result.playerId);
    if (result.trade && (!result.team || result.tradeTo === result.team)) throw new Error('Trade calls need an original team and a different partner');
    return result;
  });
  const role = input.role || 'participant';
  if (!['participant', 'expert'].includes(role)) throw new Error('Entry role must be participant or expert');
  if (role === 'expert' && !text(input.name)) throw new Error("Enter the expert's name.");
  const username = role === 'participant' ? text(input.username) : '';
  return { id: crypto.randomUUID(), name: username || text(input.name || 'Imported mock'), role,
    ...(username ? { username } : {}), status: 'draft', picks };
}

function registerScoringRoutes(app, authorize, writeJsonFileAtomically, readTeamOrder, options = {}) {
  const filePath = options.filePath || path.join(__dirname, '..', '.hush-data', 'mock-draft-scoring-2027.json');
  let queue = Promise.resolve();
  const now = options.now || Date.now;
  const policy = contest => submissionPolicy(contest, now());
  let migration;
  function emptyResults(teams) {
    return Array.from({ length: 32 }, (_, index) => ({ pick: index + 1, originalTeam: teams[index], selectingTeam: teams[index],
      playerId: '', playerName: '', position: '', traded: false, confirmed: false, tradeHistory: [], notes: '' }));
  }
  function dataset(id, name, type, results, rules = DEFAULT_RULES) {
    return { id, name, type, source: type === 'test' ? 'hypothetical' : 'nfl', status: 'paused',
      rules: { ...rules }, results: structuredClone(results), scores: [], scoredAt: null };
  }
  async function readState() {
    migration ||= retireMockTestContests(filePath, writeJsonFileAtomically);
    await migration;
    let saved;
    try { saved = JSON.parse(await fs.readFile(filePath, 'utf8')); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    if (saved && saved.version === 2) {
      return saved;
    }
    if (saved && saved.year !== 2027) throw new Error('Legacy non-2027 scoring data cannot be imported into the real 2027 contest.');
    const teams = await readTeamOrder();
    const test = dataset('test-default', saved ? 'Migrated scoring test' : 'Hypothetical Draft #1', 'test', saved ? saved.results : emptyResults(teams), saved ? saved.rules : DEFAULT_RULES);
    if (saved) {
      test.status = saved.status;
      test.scores = (saved.scores || []).map(score => ({ ...score,
        role: (saved.mocks || []).find(mock => mock.id === score.id)?.role || 'participant' }));
      test.scoredAt = saved.scoredAt || null;
    }
    return { version: 2, revision: saved ? saved.revision : 0, contests: [{ id: 'contest-2027', year: 2027,
      name: '2027 NFL Mock Draft', submissions: 'open',
      mocks: (saved ? saved.mocks : []).map(mock => ({ ...mock, role: mock.role || 'participant', status: 'submitted', submittedAt: null })),
      datasets: [test, dataset('real-nfl', 'Actual NFL Draft', 'real', emptyResults(teams))] }] };
  }
  function selectState(root, input) {
    const contest = root.contests.find(item => item.id === (input.contestId || 'contest-2027'));
    if (!contest || contest.year !== 2027 || contest.id === 'sandbox-2027') throw new Error('2027 contest not found');
    const selected = contest.datasets.find(item => item.id === (input.datasetId || 'real-nfl'));
    if (!selected) throw new Error('Results dataset not found');
    return { contest, selected };
  }
  function responseState(root, contest, selected) {
    return { ...selected, revision: root.revision, contestId: contest.id, datasetId: selected.id, year: contest.year,
      contestName: contest.name, submissions: contest.submissions, submissionPolicy: policy(contest), mocks: contest.mocks,
      catalog: contest.catalog || null, teamOrder: contest.teamOrder || null,
      contests: root.contests.map(item => ({ id: item.id, name: item.name, year: item.year,
        datasets: item.datasets.map(results => ({ id: results.id, name: results.name, type: results.type, source: results.source })) })) };
  }
  function recompute(contest, selected) {
    selected.scores = contest.mocks.filter(mock => mock.status === 'submitted')
      .map(mock => ({ ...scoreMock(mock, selected.results, selected.rules, selected.status), role: mock.role }))
      .sort((left, right) => right.total - left.total || left.name.localeCompare(right.name));
    selected.scoredAt = new Date().toISOString();
  }
  function rescoreActive(contest) {
    contest.datasets.forEach(selected => { if (selected.status !== 'paused') recompute(contest, selected); });
  }
  function validateSubmission(mock) {
    if (mock.picks.length !== 32 || mock.picks.some(pick => !pick.team || (!pick.trade && (!pick.playerId || !pick.position)))) {
      throw new Error('Submission needs 32 picks with teams and player/position predictions, or explicit team-only trade calls');
    }
  }
  function mutation(url, change, scoped = true) {
    app.post(url, authorize, (req, res) => {
      const operation = queue.then(async () => {
        const root = await readState();
        if (req.body.revision !== root.revision) return res.status(409).json({ ok: false, error: 'Contest data changed in another tab. Reload before saving.' });
        if (scoped && (!req.body.contestId || !req.body.datasetId)) throw new Error('Explicit contestId and datasetId are required');
        const context = selectState(root, req.body);
        const selection = await change(context.contest, context.selected, req.body, root) || context;
        root.revision += 1;
        await writeJsonFileAtomically(filePath, JSON.stringify(root, null, 2));
        return res.json({ ok: true, state: responseState(root, selection.contest, selection.selected) });
      });
      queue = operation.catch(() => {});
      operation.catch(error => res.status(400).json({ ok: false, error: error.message }));
    });
  }
  app.get('/api/admin/mock-draft/scoring', authorize, async (_req, res) => {
    try {
      const root = await readState();
      const { contest, selected } = selectState(root, _req.query);
      res.set('Cache-Control', 'no-store').json({ ok: true, state: responseState(root, contest, selected) });
    }
    catch (_error) { res.status(500).json({ ok: false, error: 'Unable to load scoring data' }); }
  });
  function summaryReport(contest, selected, picks, identity = {}) {
      const mock = normalizeMock({ name: identity.name || 'Your mock', username: identity.username, role: identity.role || 'participant', picks });
      const published = selected.status !== 'paused';
      const results = published ? selected.results : selected.results.map(result => ({ ...result, playerId: '', playerName: '', position: '', confirmed: false }));
      const score = scoreMock(mock, results, selected.rules, selected.status);
      const scoredEntries = published ? selected.scores.filter(entry => Number.isFinite(entry.total) && entry.id !== identity.entryId) : [];
      const ranks = role => {
        const entries = scoredEntries.filter(entry => role === 'combined' || entry.role === role);
        const ahead = entries.filter(entry => entry.total > score.total).length;
        const tied = entries.filter(entry => entry.total === score.total).length;
        return { rank: ahead + 1, total: entries.length + 1, tied: tied > 0 || entries.length > 0 && score.pending > 0,
          entries: entries.sort((left, right) => right.total - left.total || left.name.localeCompare(right.name))
            .map(entry => ({ name: entry.name, role: entry.role, total: entry.total, pending: entry.pending })) };
      };
      return { ok: true, contest: { id: contest.id, name: contest.name, year: contest.year },
        resultsStatus: selected.status, rules: selected.rules, entry: { name: mock.name, role: mock.role, submitted: Boolean(identity.entryId) }, score, comparisons: {
          combined: ranks('combined'), participants: ranks('participant'), experts: ranks('expert')
        } };
  }
  app.post('/api/admin/mock-draft/scoring/preview', authorize, async (req, res) => {
    try {
      if (!req.body?.contestId || !req.body?.datasetId) throw new Error('Choose a contest and results dataset for the preview');
      const root = await readState();
      const { contest, selected } = selectState(root, req.body);
      res.set('Cache-Control', 'no-store').json({
        ...summaryReport(contest, selected, req.body.picks, req.body),
        adminPreview: true, dataset: { id: selected.id, name: selected.name }
      });
    } catch (error) { res.status(400).json({ ok: false, error: error.message }); }
  });
  app.post('/api/public/mock-draft/summary', async (req, res) => {
    try {
      if (req.query.sandbox != null) throw new Error('Test mode has been retired. Open the real 2027 contest.');
      const root = await readState();
      const contestId = text(req.body?.contestId || 'contest-2027');
      const contest = root.contests.find(item => item.id === contestId && item.id === 'contest-2027' && item.year === 2027);
      const selected = contest?.datasets.find(item => item.type === 'real');
      if (!contest || !selected) return res.status(404).json({ ok: false, error: 'Public contest not found' });
      res.set('Cache-Control', 'no-store').json(summaryReport(contest, selected, req.body?.picks,
        { username: req.body?.username, role: 'participant' }));
    } catch (error) { res.status(400).json({ ok: false, error: error.message }); }
  });
  function publicSelection(root, year, sandbox) {
    if (year != null && Number(year) !== 2027) throw new Error('The contest is for 2027 only.');
    if (sandbox != null) throw new Error('Test mode has been retired. Open the real 2027 contest without the sandbox parameter.');
    const contest = root.contests.find(item => item.id === 'contest-2027' && item.year === 2027);
    const selected = contest?.datasets.find(item => item.id === 'real-nfl' && item.type === 'real');
    if (!contest || !selected) throw new Error('Public contest not found');
    return { contest, selected };
  }
  function publicBoard(contest, selected) {
    const published = selected.status !== 'paused';
    const scores = new Map((published ? selected.scores : []).map(score => [score.id, score]));
    const entries = contest.mocks.filter(mock => mock.status === 'submitted').map(mock => {
      const score = scores.get(mock.id);
      return { id: mock.id, name: mock.name, role: mock.role, total: score?.total || 0, pending: score?.pending ?? 32 };
    }).sort((left, right) => right.total - left.total || left.name.localeCompare(right.name));
    return { ok: true, contest: { id: contest.id, year: contest.year, name: contest.name },
      submissionPolicy: policy(contest), resultsStatus: selected.status, scoredAt: published ? selected.scoredAt : null,
      confirmed: published ? selected.results.filter(result => result.confirmed).length : 0,
      entries: entries.map(entry => ({ ...entry, rank: entries.findIndex(item => item.total === entry.total) + 1 })) };
  }
  async function account(req, res) {
    try {
      if (!options.verifyAccount) throw new Error('Account verification is not configured.');
      return await options.verifyAccount(req);
    } catch (error) {
      res.status(401).json({ ok: false, error: error.message });
      return null;
    }
  }
  app.get('/api/public/mock-draft/scoreboard', async (req, res) => {
    try {
      const { contest, selected } = publicSelection(await readState(), req.query.year, req.query.sandbox);
      res.set('Cache-Control', 'no-store').json(publicBoard(contest, selected));
    } catch (error) { res.status(400).json({ ok: false, error: error.message }); }
  });
  app.get('/api/mock-draft/entry', async (req, res) => {
    const user = await account(req, res);
    if (!user) return;
    try {
      const { contest } = publicSelection(await readState(), req.query.year, req.query.sandbox);
      const entry = contest.mocks.find(mock => mock.ownerUid === user.uid) || null;
      res.set('Cache-Control', 'no-store').json({ ok: true, username: user.username,
        submissionPolicy: policy(contest), entry });
    } catch (error) { res.status(400).json({ ok: false, error: error.message }); }
  });
  app.post('/api/mock-draft/entry', async (req, res) => {
    const user = await account(req, res);
    if (!user) return;
    const operation = queue.then(async () => {
      const root = await readState();
      const { contest } = publicSelection(root, req.body.year, req.query.sandbox);
      if (!policy(contest).open) throw new Error('Submissions are locked. The 2027 deadline is April 29, 2027 at 7:30 PM Eastern, or earlier if closed by admin.');
      const normalized = normalizeMock({ picks: req.body.picks, username: user.username, role: 'participant' });
      validateSubmission(normalized);
      const existing = contest.mocks.find(mock => mock.ownerUid === user.uid);
      if (!existing && contest.mocks.length >= 1000) throw new Error('Contest entry limit reached');
      const entry = { ...normalized, ownerUid: user.uid, status: 'submitted',
        submittedAt: existing?.submittedAt || new Date(now()).toISOString(), updatedAt: new Date(now()).toISOString() };
      if (existing) Object.assign(existing, entry, { id: existing.id });
      else contest.mocks.push(entry);
      rescoreActive(contest);
      root.revision += 1;
      await writeJsonFileAtomically(filePath, JSON.stringify(root, null, 2));
      res.set('Cache-Control', 'no-store').json({ ok: true, entry: existing || entry, submissionPolicy: policy(contest) });
    });
    queue = operation.catch(() => {});
    operation.catch(error => res.status(400).json({ ok: false, error: error.message }));
  });
  app.get('/api/mock-draft/report', async (req, res) => {
    const user = await account(req, res);
    if (!user) return;
    try {
      const { contest, selected } = publicSelection(await readState(), req.query.year, req.query.sandbox);
      const entry = contest.mocks.find(mock => mock.ownerUid === user.uid && mock.status === 'submitted');
      if (!entry) return res.status(404).json({ ok: false, error: 'Submit your mock before opening your contest results.' });
      res.set('Cache-Control', 'no-store').json({ ...summaryReport(contest, selected, entry.picks,
        { name: entry.name, username: entry.username, role: entry.role, entryId: entry.id }),
        mock: { format: 'hush-mock-draft-v1', name: entry.name, username: entry.username, picks: entry.picks },
        submissionPolicy: policy(contest) });
    } catch (error) { res.status(400).json({ ok: false, error: error.message }); }
  });
  mutation('/api/admin/mock-draft/scoring/save', (contest, selected, body) => {
    if (!['paused','live','final'].includes(body.status)) throw new Error('Invalid scoring status');
    if (body.year !== contest.year) throw new Error('Draft year is fixed per contest. Create a separate contest for another year.');
    if (selected.type === 'real' && body.confirmReal !== true) throw new Error('Confirm that you are updating the real NFL answer key');
    const results = normalizeResults(body.results);
    if (selected.locked && (body.status !== 'final' || JSON.stringify(results) !== JSON.stringify(selected.results))) {
      throw new Error('Historical reference results are locked. Clone this test to change the answer key.');
    }
    selected.results = results;
    selected.rules = normalizeRules(body.rules);
    selected.status = body.status;
    if (selected.status !== 'paused') recompute(contest, selected);
  });
  mutation('/api/admin/mock-draft/scoring/import', (contest, _selected, body) => {
    if (!policy(contest).open) throw new Error('Contest submissions are closed or past the deadline');
    if (!Array.isArray(body.mocks) || !body.mocks.length || body.mocks.length > 100 || contest.mocks.length + body.mocks.length > 1000) throw new Error('Import 1-100 mocks (maximum 1000 stored)');
    const mocks = body.mocks.map(input => ({ ...normalizeMock(input), status: 'submitted', submittedAt: new Date().toISOString() }));
    contest.mocks.push(...mocks);
    rescoreActive(contest);
  });
  mutation('/api/admin/mock-draft/scoring/score', (contest, selected) => {
    if (selected.status === 'paused') throw new Error('Scoring is paused. Save Live or Final status before rescoring.');
    recompute(contest, selected);
  });
  mutation('/api/admin/mock-draft/scoring/remove', (contest, _selected, body) => {
    if (!contest.mocks.some(mock => mock.id === body.id)) throw new Error('Mock not found');
    contest.mocks = contest.mocks.filter(mock => mock.id !== body.id);
    contest.datasets.forEach(selected => { selected.scores = selected.scores.filter(score => score.id !== body.id); });
  });
  mutation('/api/admin/mock-draft/scoring/entry/save', (contest, _selected, body) => {
    if (!policy(contest).open) throw new Error('Contest submissions are closed or past the deadline');
    const normalized = normalizeMock(body.mock);
    const existing = body.mock.id && contest.mocks.find(mock => mock.id === body.mock.id);
    if (body.mock.id && !existing) throw new Error('Entry not found in this contest');
    if (existing?.status === 'submitted' && !policy(contest).editable) throw new Error('Submitted entries are locked. Clone to create another entry.');
    if (existing) {
      if (existing.status === 'submitted') validateSubmission(normalized);
      Object.assign(existing, normalized, { id: existing.id, status: existing.status, username: existing.ownerUid ? existing.username : normalized.username,
        name: existing.ownerUid ? existing.name : normalized.name, role: existing.ownerUid ? 'participant' : normalized.role });
      rescoreActive(contest);
    }
    else {
      if (contest.mocks.length >= 1000) throw new Error('Contest entry limit reached');
      contest.mocks.push(normalized);
    }
  });
  mutation('/api/admin/mock-draft/scoring/entry/submit', (contest, _selected, body) => {
    if (!policy(contest).open) throw new Error('Contest submissions are closed or past the deadline');
    const mock = contest.mocks.find(entry => entry.id === body.id);
    if (!mock || mock.status !== 'draft') throw new Error('Save a draft entry before submitting');
    validateSubmission(mock);
    mock.status = 'submitted';
    mock.submittedAt = new Date().toISOString();
    rescoreActive(contest);
  });
  mutation('/api/admin/mock-draft/scoring/test/create', async (contest, selected, body) => {
    if (body.clone && selected.type !== 'test') throw new Error('Only hypothetical tests can be cloned');
    if (contest.datasets.length >= 100) throw new Error('Test dataset limit reached');
    const name = text(body.name || 'New hypothetical draft');
    const next = dataset(`test-${crypto.randomUUID()}`, name, 'test', body.clone ? selected.results : emptyResults(contest.teamOrder || await readTeamOrder()), selected.rules);
    contest.datasets.push(next);
    return { contest, selected: next };
  });
  mutation('/api/admin/mock-draft/scoring/test/reset', async (contest, selected) => {
    if (selected.type !== 'test') throw new Error('Real NFL results cannot be reset through the test tools');
    if (selected.locked) throw new Error('Historical reference results cannot be reset. Clone this test first.');
    selected.results = emptyResults(contest.teamOrder || await readTeamOrder());
    selected.scores = [];
    selected.scoredAt = null;
    selected.status = 'paused';
  });
  mutation('/api/admin/mock-draft/scoring/contest/create', async (_contest, _selected, body, root) => {
    if (body.year !== 2027) throw new Error('Only 2027 contests are supported');
    if (root.contests.length >= 50) throw new Error('Contest limit reached');
    const contest = { id: `contest-${crypto.randomUUID()}`, year: 2027,
      name: text(body.name || '2027 NFL Mock Draft'), submissions: 'open', mocks: [] };
    const results = emptyResults(contest.teamOrder || await readTeamOrder());
    contest.datasets = [dataset('test-default', 'Hypothetical Draft #1', 'test', results), dataset('real-nfl', 'Actual NFL Draft', 'real', results)];
    root.contests.push(contest);
    return { contest, selected: contest.datasets.find(item => item.id === 'real-nfl') };
  });
  mutation('/api/admin/mock-draft/scoring/contest/delete', (contest, _selected, body, root) => {
    if (contest.id === 'contest-2027') throw new Error('The main contest cannot be deleted');
    if (body.confirmDelete !== contest.id) throw new Error('Confirm the selected contest before deleting it');
    const remaining = root.contests.filter(item => item.id !== contest.id);
    const fallback = remaining.find(item => item.id === 'contest-2027') || remaining[0];
    if (!fallback || !fallback.datasets.length) throw new Error('At least one contest with a results dataset must remain');
    root.contests = remaining;
    return { contest: fallback, selected: fallback.datasets.find(item => item.id === 'real-nfl') };
  });
  mutation('/api/admin/mock-draft/scoring/contest/status', (contest, _selected, body) => {
    if (!['open','closed'].includes(body.submissions)) throw new Error('Invalid submission status');
    contest.submissions = body.submissions;
  });
}

module.exports = { registerScoringRoutes, normalizeMock, normalizeResults, normalizeRules };