'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '..', 'ad-placements.js'), 'utf8');

async function exercise({ enabled = true, approved = true, host = 'example.com', imageError = false, twoSlots = false, badId = false, pathname = '/dashboard.html', search = '' } = {}) {
  const slots = Array.from({ length: twoSlots ? 2 : 1 }, () => ({ hidden: true, dataset: { adPlacement: 'dashboard-bottom' },
    classList: { add() {} }, children: [], replaceChildren(...children) { this.children = children; },
    getBoundingClientRect() { return { width: 728 }; } }));
  const observers = [];
  let scripts = 0;
  let requests = 0;
  let configRequests = 0;
  const window = { adsbygoogle: { push() { requests += 1; } } };
  window.self = window;
  window.top = window;
  const config = { adsense: { enabled, launchApproved: approved, publisherId: badId ? 'invalid' : 'ca-pub-1234567890123456', productionHosts: [host] },
    placements: { 'dashboard-bottom': { enabled: true, provider: 'adsense', slotId: '1234567890' } } };
  const context = {
    window, URL, URLSearchParams, location: { href: `https://${host}${pathname}${search}`, pathname, hostname: host, protocol: 'https:', search },
    fetch: async () => { configRequests += 1; return { ok: true, json: async () => config }; },
    document: {
      querySelectorAll: () => slots,
      createElement: tag => ({ tag, dataset: {}, style: {}, append() {} }),
      head: { append(script) { scripts += 1; queueMicrotask(() => imageError ? script.onerror(new Error('blocked')) : script.onload()); } }
    },
    MutationObserver: class {
      constructor(callback) { this.callback = callback; observers.push(this); }
      observe(unit) { this.unit = unit; }
      disconnect() { this.disconnected = true; }
    }
  };
  vm.runInNewContext(source, context);
  await new Promise(resolve => setImmediate(resolve));
  return { slots, observers, scripts, requests, configRequests };
}

async function main() {
  const dashboard = fs.readFileSync(require('node:path').join(__dirname, '..', 'dashboard.html'), 'utf8');
  const middleColumn = dashboard.slice(dashboard.indexOf('dashboard-column-middle'), dashboard.indexOf('dashboard-column-right'));
  assert.ok(middleColumn.includes('data-ad-placement="dashboard-news-footer"'));
  assert.ok(middleColumn.indexOf('data-ad-placement="dashboard-news-footer"') < middleColumn.indexOf('id="newsFeedList"'));
  assert.equal((dashboard.match(/data-ad-placement=/g) || []).length, 2);
  assert.equal(dashboard.includes('dashboard-tools-footer'), false);
  assert.ok(dashboard.indexOf('data-ad-placement="dashboard-bottom"') > dashboard.indexOf('dashboard-column-right'));
  const saved = JSON.parse(fs.readFileSync(require('node:path').join(__dirname, '..', 'ad-placements.json'), 'utf8'));
  assert.equal(saved.adsense.enabled, false);
  assert.equal(saved.adsense.launchApproved, false);
  assert.ok(Object.values(saved.placements).every(value => value === null));
  for (const pathname of ['/dashboard.html', '/mock-draft-contest-intro.html']) {
    const preview = await exercise({ pathname, search: '?adPreview=1' });
    assert.equal(preview.configRequests, 0);
    assert.equal(preview.scripts, 0);
    assert.equal(preview.requests, 0);
    assert.equal(preview.slots[0].hidden, false);
    assert.match(preview.slots[0].children[0].textContent, /preview only/);
  }
  const draftPreview = await exercise({ pathname: '/silentdraft.html', search: '?adPreview=1' });
  assert.equal(draftPreview.slots[0].hidden, true);
  assert.equal(draftPreview.configRequests, 0);
  for (const search of ['', '?draftView=on', '?draftView=on&adPreview=1', '?adPreview=1']) {
    const rankingsDraft = await exercise({ pathname: '/rankings.html', search });
    assert.equal(rankingsDraft.configRequests, 0);
    assert.equal(rankingsDraft.requests, 0);
    assert.equal(rankingsDraft.slots[0].hidden, true);
  }
  const rankingsPreview = await exercise({ pathname: '/rankings.html', search: '?draftView=off&adPreview=1' });
  assert.equal(rankingsPreview.slots[0].hidden, false);
  assert.equal(rankingsPreview.requests, 0);
  const rankingsStandalone = await exercise({ pathname: '/rankings.html', search: '?draftView=off' });
  assert.equal(rankingsStandalone.requests, 1);
  for (const pathname of ['/silentdraft.html', '/silentdraft', '/public/silentdraft.html', '/HushV4.0/silentdraft.html', '/admin-mock-draft.html', '/waivers.html']) {
    const result = await exercise({ pathname });
    assert.equal(result.configRequests, 0, pathname);
    assert.equal(result.scripts, 0, pathname);
    assert.equal(result.requests, 0, pathname);
    assert.equal(result.slots[0].hidden, true, pathname);
  }
  const intro = await exercise({ pathname: '/mock-draft-contest-intro.html' });
  assert.equal(intro.requests, 1);
  for (const options of [{ enabled: false }, { approved: false }, { host: 'localhost' }, { host: '127.0.0.1' }, { badId: true }]) {
    const result = await exercise(options);
    assert.equal(result.scripts, 0);
    assert.equal(result.requests, 0);
    assert.equal(result.slots[0].hidden, true);
  }
  const blocked = await exercise({ imageError: true });
  assert.equal(blocked.requests, 0);
  assert.equal(blocked.slots[0].hidden, true);
  const active = await exercise({ twoSlots: true });
  assert.equal(active.scripts, 1);
  assert.equal(active.requests, 2);
  assert.ok(active.slots.every(slot => slot.hidden === false));
  active.observers[0].unit.dataset.adStatus = 'filled';
  active.observers[0].callback();
  assert.equal(active.slots[0].hidden, false);
  active.observers[1].unit.dataset.adStatus = 'unfilled';
  active.observers[1].callback();
  assert.equal(active.slots[1].hidden, true);
  assert.equal(active.observers[1].disconnected, true);
  console.log('Ad placements passed: draft/admin exclusion, page allowlist, disabled defaults, approval gate, local hosts, invalid IDs, blocked script, single loader, once-per-slot requests, filled visibility, and unfilled collapse.');
}

main().catch(error => { console.error(error); process.exitCode = 1; });