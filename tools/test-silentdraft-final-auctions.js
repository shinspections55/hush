'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const client = fs.readFileSync(path.join(root, 'public', 'silentdraft.js'), 'utf8');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');

function section(source, start, end) {
  const first = source.indexOf(start);
  const last = source.indexOf(end, first + start.length);
  assert.ok(first !== -1 && last !== -1, `Missing source section: ${start}`);
  return source.slice(first, last);
}

function createHarness(round = 10) {
  const listeners = new Map();
  const presentations = new Map();
  const events = [];
  const socket = {
    on(name, callback) {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name).add(callback);
    },
    off(name, callback) {
      if (listeners.has(name)) listeners.get(name).delete(callback);
    },
    emit(name, payload) {
      for (const callback of [...(listeners.get(name) || [])]) callback(payload);
    }
  };
  const context = {
    window: { draftSocket: socket },
    document: { getElementById() { return null; } },
    console: { log() {}, warn() {}, error() {} },
    currentRound: round,
    totalRounds: 10,
    isDraftEnding: false,
    teams: [{ name: 'Team A', roster: [], budget: 100 }],
    liveAuctionPresentationActive: false,
    setLiveAuctionPresentationActive(value) { context.liveAuctionPresentationActive = value; },
    getUniqueRosterPlayers(roster) { return roster; },
    saveDraftStateForRankings() { events.push('saved'); },
    endDraft() { events.push('summary'); },
    advanceDraftAfterRound() { events.push('next round'); },
    startLiveAuction(tied, auctionId, onPresentationComplete, state) {
      events.push(`start:${auctionId}`);
      if (state) events.push(`recover:${state.auctionId}`);
      presentations.set(auctionId, onPresentationComplete);
    }
  };
  vm.runInNewContext(`
    ${section(client, '    function finalizeRoundProgression(', '    function advanceDraftAfterRound()')}
    ${section(client, '    let activeLiveAuctionUi = null;', '    // Start a single live auction for one tied player')}
    globalThis.hooks = { handleLiveAuction, handleLiveAuctionsCompleted, finalizeRoundProgression,
      getBatch: () => activeLiveAuctionBatch, getTeams: () => teams };
  `, context);
  return {
    context, socket, events, hooks: context.hooks,
    finishPresentation(auctionId) {
      context.liveAuctionPresentationActive = false;
      presentations.get(auctionId)();
    }
  };
}

const serverContext = {};
vm.runInNewContext(`
  ${section(server, 'function buildDraftAuctionCompletionPayload(', 'function buildDraftStatePayloadForClient(')}
  globalThis.hooks = { buildDraftAuctionCompletionPayload, buildDraftFinalRoundCompletionPayload };
`, serverContext);
const { buildDraftAuctionCompletionPayload, buildDraftFinalRoundCompletionPayload } = serverContext.hooks;
const team = { name: 'Team A', budget: 70, roster: [{ id: 1, name: 'Winner', bid: 30 }] };
const state = {
  currentRound: 10, lastFinalizedRound: 10, lastAuctionCompletedRound: 10,
  teams: [team], pendingRoundResults: null, lastRoundResults: { tiedBids: [] }
};
assert.equal(buildDraftAuctionCompletionPayload({ draftState: state }).roundNumber, 10);
assert.equal(buildDraftAuctionCompletionPayload({ draftState: { ...state, currentRound: 9 } }), null);
assert.equal(buildDraftFinalRoundCompletionPayload({ draftState: state }).roundNumber, 10);
assert.equal(buildDraftFinalRoundCompletionPayload({ draftState: { ...state, pendingRoundResults: {} } }), null);
assert.equal(buildDraftFinalRoundCompletionPayload({ draftState: { ...state, lastRoundResults: { tiedBids: [{}] } } }), null);

const final = createHarness();
final.hooks.handleLiveAuction([
  { playerId: 1, playerName: 'Winner', tiedTeams: ['Team A', 'Team B'], bidAmount: 30 },
  { playerId: 2, playerName: 'Other', tiedTeams: ['Team A', 'Team B'], bidAmount: 20 }
], () => final.hooks.finalizeRoundProgression());
final.socket.emit('allMembersAccepted');
final.socket.emit('liveAuctionStarted', { playerId: 1, auctionId: 'one' });
final.socket.emit('liveAuctionEnded', { playerId: 1 });
final.finishPresentation('one');
assert.equal(final.events.includes('summary'), false);
final.socket.emit('liveAuctionStarted', { playerId: 2, auctionId: 'two' });
final.socket.emit('liveAuctionEnded', { playerId: 2 });
final.context.liveAuctionPresentationActive = true;
final.hooks.handleLiveAuctionsCompleted({ roundNumber: 10, teams: [team] });
assert.equal(final.events.includes('summary'), false);
final.finishPresentation('two');
assert.equal(final.events.filter(event => event === 'summary').length, 1);
final.hooks.handleLiveAuctionsCompleted({ roundNumber: 10, teams: [team] });
assert.equal(final.events.filter(event => event === 'summary').length, 1);
assert.equal(final.hooks.getTeams()[0].roster[0].name, 'Winner');
assert.equal(final.hooks.getTeams()[0].budget, 70);

const recovered = createHarness();
recovered.hooks.handleLiveAuction([{ playerId: 1, tiedTeams: ['Team A', 'Team B'], bidAmount: 30 }],
  () => recovered.hooks.finalizeRoundProgression());
const batch = recovered.hooks.getBatch();
batch.recover({ auctionId: 'one', playerId: 1, tiedTeams: ['Team A', 'Team B'], currentBid: 31 });
assert.equal(recovered.hooks.getBatch(), batch);
recovered.socket.emit('liveAuctionStarted', { auctionId: 'two', playerId: 2, playerName: 'Other', tiedTeams: ['Team A', 'Team B'], startBid: 20 });
assert.ok(recovered.events.includes('start:two'));
recovered.hooks.handleLiveAuctionsCompleted({ roundNumber: 10, teams: [team] });
assert.ok(recovered.events.includes('summary'));

const earlier = createHarness(9);
earlier.hooks.handleLiveAuctionsCompleted({ roundNumber: 10, teams: [team] });
assert.equal(earlier.events.length, 0);
earlier.hooks.handleLiveAuctionsCompleted({ roundNumber: 9, teams: [team] });
assert.ok(earlier.events.includes('next round'));

const noTies = createHarness();
noTies.hooks.finalizeRoundProgression(10);
assert.ok(noTies.events.includes('summary'));

async function testSummaryStorage() {
const saved = new Map();
const session = new Map();
const timers = [];
let summaryNavigation;
const storage = map => ({
  getItem(key) { return map.get(key) || null; },
  setItem(key, value) { map.set(key, value); },
  removeItem(key) { map.delete(key); }
});
const summaryContext = {
  window: { location: {}, HushDraftHistory: { async save(value) { saved.set('indexedDraft', JSON.stringify(value)); } } },
  localStorage: storage(saved),
  sessionStorage: storage(session),
  console: { log() {}, warn() {}, error() {} },
  Date,
  currentDraftCode: 'TEST',
  currentRound: 10,
  totalRounds: 10,
  username: 'Team A',
  isDraftEnding: false,
  timerInterval: null,
  teams: [team],
  draftHostName: 'Team A',
  allDraftMembers: ['Team A'],
  benchCutTarget: 3,
  rosterSettings: {},
  teamProfiles: {},
  STARTER_SLOT_COUNT: 9,
  DRAFT_TEMP_STARRED_KEY: 'stars',
  normalizeBenchCutTarget(value) { return value; },
  resolveDraftRoomByeWeek() { return null; },
  validateRoster() { return true; },
  setDraftScreenAwakeEnabled() {},
  updateUI() {},
  logDraftEndDebug() {},
  showDraftFinalizingSplash() { return { remove() {} }; },
  showDraftEndPopup() { summaryNavigation = summaryContext.hooks.showDraftSummary(); },
  setTimeout(callback) { timers.push(callback); }
};
vm.runInNewContext(`
  ${section(client, '    async function showDraftSummary() {', '    function showDraftFinalizingSplash() {')}
  ${section(client, '    function endDraft() {', '    let isPaused = false;')}
  globalThis.hooks = { endDraft, showDraftSummary };
`, summaryContext);
summaryContext.hooks.endDraft();
assert.equal(summaryContext.window.location.href, undefined);
timers.shift()();
await summaryNavigation;
assert.equal(summaryContext.window.location.href, '/draft-summary.html');
const summary = JSON.parse(saved.get('indexedDraft'));
assert.equal(summary.teams[0].roster[0].name, 'Winner');
assert.equal(summary.teams[0].budgetRemaining, 70);

const quotaError = Object.assign(new Error('Storage full'), { name: 'QuotaExceededError' });
const history = JSON.stringify([{ draftCode: 'OLD', completed: true, timestamp: '2026-01-01' }]);
saved.set('completedDrafts', history);
summaryContext.localStorage = {
 ...storage(saved),
 setItem() { throw quotaError; }
};
summaryContext.window.location.href = undefined;
await summaryContext.hooks.showDraftSummary();
assert.equal(summaryContext.window.location.href, '/draft-summary.html', 'Full archive must not block redirect');
assert.equal(saved.get('completedDrafts'), history, 'Existing history must not be deleted');
assert.equal(JSON.parse(saved.get('indexedDraft')).draftCode, 'TEST');

for (const file of ['draft-summary.js', 'public/draft-summary.js']) {
 const script = fs.readFileSync(path.join(root, file), 'utf8');
 const loadContext = {
  window: { HushDraftHistory: {
    async loadSummary() { return summary; },
    async save(value) { saved.set('updatedDraft', JSON.stringify(value)); }
  } },
  localStorage: summaryContext.localStorage, sessionStorage: storage(session),
  console: { warn() {}, error() {} }, draftSummary: summary
 };
 session.set('currentDraft', 'TEST');
 vm.runInNewContext(section(script, '    async function loadSummary()', '    function updateSummaryMeta()'), loadContext);
 assert.equal((await loadContext.loadSummary()).draftCode, 'TEST', `${file}: load from IndexedDB`);
 assert.equal(await loadContext.persistSummary(), true, `${file}: save to IndexedDB`);
}

// Corrupt history is preserved while the valid session summary still opens.
saved.set('completedDrafts', '{invalid');
await summaryContext.hooks.showDraftSummary();
assert.equal(saved.get('completedDrafts'), '{invalid');
assert.equal(summaryContext.window.location.href, '/draft-summary.html');

// If session storage fails, a successful IndexedDB save still allows navigation.
summaryContext.localStorage = storage(saved);
saved.set('completedDrafts', history);
summaryContext.sessionStorage = { ...storage(session), setItem() { throw quotaError; } };
summaryContext.window.location.href = undefined;
await summaryContext.hooks.showDraftSummary();
assert.equal(summaryContext.window.location.href, '/draft-summary.html');
assert.equal(JSON.parse(saved.get('indexedDraft')).draftCode, 'TEST');

summaryContext.window.HushDraftHistory.save = async () => { throw quotaError; };
summaryContext.sessionStorage = storage(session);
summaryContext.window.location.href = undefined;
await summaryContext.hooks.showDraftSummary();
assert.equal(summaryContext.window.location.href, '/draft-summary.html', 'Session fallback after IndexedDB failure');
assert.equal(JSON.parse(session.get('latestDraftSummary')).draftCode, 'TEST');

// No success-shaped navigation if neither location can retain the completed summary.
summaryContext.localStorage = { ...storage(saved), setItem() { throw quotaError; } };
summaryContext.sessionStorage = { ...storage(session), setItem() { throw quotaError; } };
summaryContext.window.location.href = undefined;
const notices = [];
summaryContext.showNotification = message => notices.push(message);
await summaryContext.hooks.showDraftSummary();
assert.equal(summaryContext.window.location.href, undefined);
assert.ok(notices[0].includes('Could not save'));
}

async function testResume(response) {
 const calls = [];
 const context = {
   window: { draftSocket: {} },
   currentDraftCode: 'TEST',
   username: 'Team A',
   lastSeenDraftStateVersion: 0,
   activeLiveAuctionBatch: null,
   console: { log() {}, warn() {} },
   emitSocketAckWithRetry() { return Promise.resolve(response); },
   updateLastSeenDraftStateVersion() {},
   applyDraftMetaFromServer() {},
   applyDraftStatePayload() {},
   applyResumeEvent() {},
   handleAuthoritativeRoundResults() {},
   handleLiveAuctionSyncPayload(auction) { calls.push(['active', auction.auctionId]); },
   handleLiveAuction(ties) { calls.push(['pending', ties.length]); },
   handleLiveAuctionsCompleted(payload) { calls.push(['completed', payload.roundNumber]); },
   finalizeRoundProgression() {}
 };
 vm.runInNewContext(`
   ${section(client, '        const resumeActiveDraftState =', '        const resyncDraftConnection =')}
   globalThis.resume = resumeActiveDraftState;
 `, context);
 assert.equal(await context.resume('test'), true);
 return calls;
}

(async () => {
 await testSummaryStorage();
 assert.deepEqual(await testResume({ ok: true, mode: 'noop', pendingAuctions: [{ playerId: 2 }] }), [['pending', 1]]);
 assert.deepEqual(await testResume({ ok: true, mode: 'noop', activeAuction: { auctionId: 'one' }, pendingAuctions: [{ playerId: 2 }] }), [['active', 'one']]);
 assert.deepEqual(await testResume({ ok: true, mode: 'noop', completedAuctions: { roundNumber: 10 } }), [['completed', 10]]);
 assert.deepEqual(await testResume({ ok: true, mode: 'noop', completedFinalRound: { roundNumber: 10 } }), [['completed', 10]]);
 console.log('Silent draft final-round auction tests passed.');
})().catch(error => {
 console.error(error);
 process.exitCode = 1;
});
