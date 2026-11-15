'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { retireMockTestContests } = require('../mock-draft-scoring-migration');

async function main() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'hush-retire-tests-'));
  const filePath = path.join(directory, 'state.json');
  const mainContest = { id: 'contest-2027', year: 2027, submissions: 'open', mocks: [{ id: 'real-entry' }],
    datasets: [{ id: 'real-nfl', type: 'real', status: 'paused', results: [] }, { id: 'test-default', type: 'test' }] };
  const other = { ...mainContest, id: 'other-2027' };
  const root = { version: 2, revision: 10, contests: [mainContest, other,
    { id: 'sandbox-2027', year: 2027 }, { id: 'calibration-2025', year: 2025 }, { id: 'other-2025', year: 2025 }] };
  const original = JSON.stringify(root);
  const write = async (target, value) => { await fs.writeFile(`${target}.tmp`, value); await fs.rename(`${target}.tmp`, target); };
  try {
    await fs.writeFile(filePath, original);
    await retireMockTestContests(filePath, write);
    const retained = JSON.parse(await fs.readFile(filePath, 'utf8'));
    assert.equal(retained.revision, 11);
    assert.deepEqual(retained.contests, [mainContest, other], 'Keep every real 2027 field and other 2027 contests intact');
    const backup = (await fs.readdir(directory)).filter(name => name.endsWith('.bak'));
    assert.equal(backup.length, 1);
    assert.equal(await fs.readFile(path.join(directory, backup[0]), 'utf8'), original);
    await retireMockTestContests(filePath, write);
    assert.equal(JSON.parse(await fs.readFile(filePath, 'utf8')).revision, 11, 'Cleanup is idempotent');
    assert.equal((await fs.readdir(directory)).length, 2);
    await fs.writeFile(filePath, original);
    await assert.rejects(retireMockTestContests(filePath, async () => { throw new Error('Write failed'); }), /Write failed/);
    assert.equal(await fs.readFile(filePath, 'utf8'), original, 'Failed migration leaves live file unchanged');
    const broken = JSON.stringify({ ...root, contests: root.contests.slice(2) });
    await fs.writeFile(filePath, broken);
    await assert.rejects(retireMockTestContests(filePath, write), /without the real 2027/);
    assert.equal(await fs.readFile(filePath, 'utf8'), broken);
    const server = (await fs.readFile(path.join(__dirname, '..', 'server.js'), 'utf8')).replace(/\r/g, '');
    const start = server.indexOf('app.use((req, res, next) => {\n  const mockPage');
    const end = server.indexOf('\n\napp.use(express.static(root', start);
    let middleware;
    vm.runInNewContext(server.slice(start, end), { app: { use(callback) { middleware = callback; } } });
    for (const url of ['/mock-draft-contest.html?sandbox=2027', '/admin-mock-draft?workspace=2025', '/mock-draft-summary.html?sandbox=2027', '/mock-draft-scoreboard.html?sandbox=2027', '/mock-draft-contest.html']) {
      const parsed = new URL(url, 'http://localhost');
      let status; let body; let next = false;
      const response = { status(code) { status = code; return this; }, type() { return this; }, send(value) { body = value; } };
      middleware({ path: parsed.pathname, query: Object.fromEntries(parsed.searchParams) }, response, () => { next = true; });
      assert.equal(next, !parsed.search);
      if (parsed.search) { assert.equal(status, 410); assert.match(body, /No test entry or fake results have been transferred/); }
    }
    for (const file of ['admin-mock-draft.html', 'mock-draft-contest.html', 'mock-draft-summary.html', 'mock-draft-scoreboard.html', 'admin-portal.html', 'public\\admin-portal.html']) {
      const html = await fs.readFile(path.join(__dirname, '..', file), 'utf8');
      assert.doesNotMatch(html, /sandbox|workspace=2025|mock-draft-mode\.js|submit2025|load2025/i);
    }
    const adminHtml = await fs.readFile(path.join(__dirname, '..', 'admin-mock-draft.html'), 'utf8');
    const ids = new Set([...adminHtml.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]));
    for (const script of ['admin-mock-draft.js', 'admin-mock-draft-scoring.js']) {
      const source = await fs.readFile(path.join(__dirname, '..', script), 'utf8');
      for (const match of source.matchAll(/getElementById\('([^']+)'\)/g)) {
        assert.ok(ids.has(match[1]), `${script} references missing control ${match[1]}`);
      }
    }
    console.log('Test retirement: exact backup, scoped deletion, idempotency, failure preservation, real data unchanged, old pages blocked and navigation cleaned passed.');
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
