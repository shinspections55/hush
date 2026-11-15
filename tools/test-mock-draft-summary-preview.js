'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { makeFixture } = require('./mock-contest-fixture');
const { scoreMock, DEFAULT_RULES } = require('../mock-draft-scoring');

async function main() {
  const historical = makeFixture();
  const mock = { format: 'hush-mock-draft-v1', picks: historical.fixtures[0].picks };
  const token = Buffer.from(JSON.stringify(mock)).toString('base64url');
  const source = fs.readFileSync(path.join(__dirname, '..', 'mock-draft-summary.js'), 'utf8');
  for (const adminPreview of [true, false]) {
    const nodes = new Map();
    function element() {
      return {
        textContent: '', children: [], events: {},
        append(node) { this.children.push(node); },
        replaceChildren() { this.children = []; },
        addEventListener(name, callback) { this.events[name] = callback; }
      };
    }
    const get = id => { if (!nodes.has(id)) nodes.set(id, element()); return nodes.get(id); };
    let responseOK = true;
    const payload = {
      contest: { year: 2027 }, dataset: { name: 'Actual NFL Draft' },
      resultsStatus: 'final', score: scoreMock(mock, historical.results, DEFAULT_RULES, 'final'),
      comparisons: {
        combined: { entries: [{ name: 'Expert A', role: 'expert', total: 160, pending: 0 }], rank: 1, total: 2 },
        experts: { entries: [{ name: 'Expert A', role: 'expert', total: 160, pending: 0 }], rank: 1, total: 2 },
        participants: { entries: [], rank: 1, total: 1 }
      }
    };
    const context = vm.createContext({
      URLSearchParams, Uint8Array, TextDecoder, Buffer,
      atob: value => Buffer.from(value, 'base64').toString('binary'),
      location: { search: `?mock=${token}${adminPreview ? '&adminPreview=1&contestId=contest-2027&datasetId=real-nfl' : ''}` },
      sessionStorage: { getItem: () => 'test-only' },
      window: {},
      document: { getElementById: get, querySelector: get, querySelectorAll: () => [], createElement: element, addEventListener() {} },
      fetch: async (url, options) => {
        assert.equal(url, adminPreview ? '/api/admin/mock-draft/scoring/preview' : '/api/public/mock-draft/summary');
        assert.equal(options.headers['x-admin-key'], adminPreview ? 'test-only' : undefined);
        const body = JSON.parse(options.body);
        assert.equal(body.contestId, 'contest-2027');
        assert.equal(body.datasetId, adminPreview ? 'real-nfl' : undefined);
        return { ok: responseOK, json: async () => responseOK ? payload : { error: 'Preview unavailable' } };
      }
    });
    vm.runInContext(source.replace(/\nloadReport\(\);\s*$/, ''), context);
    await vm.runInContext('loadReport()', context);
    assert.equal(get('summaryTotal').textContent, '480');
    assert.equal(get('pickBreakdownRows').children.length, 32);
    assert.match(get('.summary-heading .summary-eyebrow').textContent, /2027/);
    if (adminPreview) assert.equal(get('shareReportBtn').hidden, true);
    vm.runInContext("activeStandings = 'expert'; renderStandings()", context);
    assert.equal(get('standingsRows').children.length, 2, 'Expert tab includes expert entries and your preview');
    payload.resultsStatus = 'live';
    payload.score = scoreMock(mock, historical.results.map((result, index) => ({ ...result, confirmed: index === 0 })), DEFAULT_RULES, 'live');
    await get('refreshReportBtn').events.click();
    assert.equal(get('summaryTotal').textContent, '15');
    assert.equal(get('summaryPending').textContent, '31 picks awaiting confirmed results');
    responseOK = false;
    await get('refreshReportBtn').events.click();
    assert.equal(get('summaryTotal').textContent, '--');
    assert.equal(get('reportStatus').textContent, 'Preview unavailable');
    assert.equal(get('refreshReportBtn').disabled, false);
  }
  console.log('Contestant summary UI: admin/public routing, year, scores, standings groups, refresh, and errors passed.');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
