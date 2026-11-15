'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
function dom() {
  const nodes = new Map();
  const element = () => ({
    children: [], events: {}, textContent: '', dataset: {},
    append(...children) { this.children.push(...children); },
    replaceChildren() { this.children = []; },
    setAttribute(name, value) { this[name] = value; }, removeAttribute(name) { delete this[name]; },
    addEventListener(type, callback) { this.events[type] = callback; }
  });
  const get = id => { if (!nodes.has(id)) nodes.set(id, element()); return nodes.get(id); };
  return { get, document: { visibilityState: 'visible', getElementById: get, querySelector: get,
    querySelectorAll: () => [], createElement: element, addEventListener() {} } };
}
async function main() {
  const scoreboard = dom();
  let pendingRefresh;
  let live = false;
  let fail = false;
  const boardContext = vm.createContext({
    document: scoreboard.document,
    window: { clearTimeout() {}, setTimeout(callback, delay) { assert.equal(delay, 10000); pendingRefresh = callback; return 1; } },
    fetch: async url => {
      assert.equal(url, '/api/public/mock-draft/scoreboard?year=2027');
      return { ok: !fail, json: async () => fail ? { error: 'Offline' } : ({
        resultsStatus: live ? 'live' : 'paused', confirmed: live ? 1 : 0,
        entries: [{ name: 'contestant55', role: 'participant', total: live ? 15 : 0, pending: live ? 31 : 32 }]
      }) };
    }
  });
  vm.runInContext(read('mock-draft-scoreboard.js'), boardContext);
  await new Promise(resolve => setImmediate(resolve));
  assert.match(scoreboard.get('scoreboardStatus').textContent, /Waiting/);
  assert.equal(scoreboard.get('liveScoreboardRows').children[0].children[3].textContent, '0');
  live = true;
  await pendingRefresh();
  await new Promise(resolve => setImmediate(resolve));
  assert.match(scoreboard.get('scoreboardStatus').textContent, /LIVE.*1\/32/);
  assert.equal(scoreboard.get('liveScoreboardRows').children[0].children[3].textContent, '15');
  fail = true;
  await scoreboard.get('refreshScoreboardBtn').events.click();
  assert.match(scoreboard.get('scoreboardStatus').textContent, /Offline.*out of date/);
  assert.equal(scoreboard.get('refreshScoreboardBtn').disabled, false);

  const summary = dom();
  let reportFetches = 0;
  const payload = { contest: { year: 2027 }, entry: { name: 'contestant55', role: 'participant', submitted: true },
    resultsStatus: 'live', submissionPolicy: { open: false },
    score: { total: 15, pending: 31, picks: [] },
    mock: { picks: Array.from({ length: 32 }, (_, index) => ({ pick: index + 1, playerName: `Player ${index + 1}` })) },
    comparisons: Object.fromEntries(['combined', 'experts', 'participants'].map(group => [group, { rank: 1, total: 1, entries: [] }])) };
  const summaryContext = vm.createContext({
    document: summary.document, URLSearchParams, location: { search: '?submitted=1' },
    window: { clearTimeout() {}, setTimeout(callback, delay) { assert.equal(delay, 10000); pendingRefresh = callback; return 1; } }
  });
  vm.runInContext(read('mock-draft-summary.js').replace(/\nloadReport\(\);\s*$/, ''), summaryContext);
  summaryContext.loadSavedContestReport = async () => { reportFetches += 1; return payload; };
  await vm.runInContext('loadReport()', summaryContext);
  assert.equal(summary.get('summaryTotal').textContent, '15');
  assert.equal(summary.get('overallRank').textContent, '#1');
  assert.equal(summary.get('standingsRows').children.length, 1, 'Saved entry shown once');
  assert.match(summary.get('reportStatus').textContent, /Predictions locked/);
  assert.equal(summary.get('pickBreakdownRows').children.length, 32);
  payload.score.total = 30;
  await pendingRefresh();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(reportFetches, 2);
  assert.equal(summary.get('summaryTotal').textContent, '30');
  payload.submissionPolicy = { open: false, deadline: '2027-04-29T23:30:00.000Z' };
  payload.resultsStatus = 'final';
  await vm.runInContext('loadReport()', summaryContext);
  assert.match(summary.get('reportStatus').textContent, /Final results.*Predictions locked/);

  const builder = read('mock-draft-contest.js');
  const submitHandler = builder.slice(builder.indexOf("document.getElementById('reviewMockBtn').addEventListener"),
    builder.indexOf("document.getElementById('downloadMockBtn').addEventListener"));
  for (const scenario of ['submit', 'cancel', 'locked', 'loading']) {
    const form = dom();
    let submissions = 0;
    const context = vm.createContext({
      HushMockDeadline: require('../mock-draft-contest-policy'),
      ADMIN_BUILDER_MODE: false, publicSubmitting: false, publicEntryReady: scenario !== 'loading',
      window: { confirm: text => {
        assert.match(text, /signed-in username/);
        return scenario !== 'cancel';
      } }, document: form.document, location: {},
      exportMockDraft: () => ({ picks: [] }),
      publicContestRequest: async () => { submissions += 1; if (scenario === 'locked') throw new Error('Submissions are locked'); },
      setSaveStatus() {}
    });
    vm.runInContext(submitHandler, context);
    await form.get('reviewMockBtn').events.click({ preventDefault() {} });
    assert.equal(submissions, ['submit', 'locked'].includes(scenario) ? 1 : 0);
    assert.equal(context.location.href, scenario === 'submit' ? 'mock-draft-summary.html?submitted=1' : undefined);
    if (scenario === 'locked') assert.match(form.get('publicSubmissionStatus').textContent, /locked/);
    assert.equal(context.publicSubmitting, false);
  }
  console.log('Live UI: automatic 10-second scoreboard/report updates, submitted data not link picks, one self row, rank #1, errors/retries, submit/cancel/locked/loading passed.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
