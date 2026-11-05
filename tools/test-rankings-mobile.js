'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '..', 'rankings.js'), 'utf8');
const start = source.indexOf("document.getElementById('movePlayerForm').addEventListener('submit'");
assert.ok(start >= 0);
const submitSource = source.slice(start, source.indexOf('\nwindow.matchMedia', start));
const dropSource = source.slice(source.indexOf('function performDrop('), source.indexOf('function clearDragIndicators('));

function exercise({ sourceTier = 0, sourceIndex = 0, rank = 3, mode = 'rank', tier = 1, singleton = false, editable = true, stale = false } = {}) {
  const player = name => ({ name, position: 'QB', starred: true, userBid: 17 });
  const board = [
    { id: 'one', name: 'Tier 1', players: singleton ? [player('Alpha')] : [player('Alpha'), player('Bravo')] },
    { id: 'two', name: 'Tier 2', players: singleton ? [player('Bravo'), player('Charlie'), player('Delta')] : [player('Charlie'), player('Delta')] }
  ];
  const selected = board[sourceTier].players[sourceIndex];
  const elements = {
    movePlayerForm: { addEventListener(_event, callback) { this.submit = callback; } },
    movePlayerDialog: { close() { this.closed = true; } },
    movePlayerMode: { value: mode }, movePlayerRank: { value: String(rank) }, movePlayerTier: { value: String(tier) },
    movePlayerError: { textContent: '' }, rankingsMobileStatus: { textContent: '' }
  };
  let saves = 0;
  const context = {
    rankings: board, activeFilterPos: 'ALL', activePoolTab: 'QB', dragSource: null,
    mobileMoveTarget: { player: selected, board: stale ? [] : board, position: 'ALL' },
    document: { getElementById: id => elements[id] },
    isEditableRankingsView: () => editable, markDirty() {}, renderRankings() {}, renderPool() {}, clearDragIndicators() {},
    saveRankings() { saves += 1; }
  };
  vm.runInNewContext(dropSource + '\n' + submitSource, context);
  elements.movePlayerForm.submit({ preventDefault() {} });
  const players = board.flatMap(entry => entry.players);
  assert.equal(new Set(players.map(entry => entry.name)).size, 4);
  assert.ok(players.includes(selected));
  assert.equal(selected.userBid, 17);
  assert.equal(selected.starred, true);
  return { order: players.map(entry => entry.name), board, saves, elements };
}

assert.deepEqual(exercise().order, ['Bravo', 'Charlie', 'Alpha', 'Delta']);
assert.deepEqual(exercise({ sourceTier: 1, sourceIndex: 1, rank: 1 }).order, ['Delta', 'Alpha', 'Bravo', 'Charlie']);
assert.deepEqual(exercise({ rank: 4, singleton: true }).order, ['Bravo', 'Charlie', 'Delta', 'Alpha']);
assert.equal(exercise({ rank: 4, singleton: true }).board.length, 1);
assert.deepEqual(exercise({ mode: 'tier', tier: 1 }).order, ['Bravo', 'Alpha', 'Charlie', 'Delta']);
assert.equal(exercise({ mode: 'tier', tier: 0, singleton: true }).saves, 0);
assert.deepEqual(exercise({ mode: 'tier', tier: 0, singleton: true }).order, ['Alpha', 'Bravo', 'Charlie', 'Delta']);
for (const options of [{ rank: 1 }, { rank: 0 }, { rank: 5 }, { editable: false }, { stale: true }]) {
  const result = exercise(options);
  assert.deepEqual(result.order, ['Alpha', 'Bravo', 'Charlie', 'Delta']);
  assert.equal(result.saves, 0);
}
assert.ok(exercise({ stale: true }).elements.movePlayerError.textContent.includes('board changed'));
assert.equal(exercise().saves, 1);
assert.equal(exercise().elements.movePlayerDialog.closed, true);
console.log('Mobile rankings passed: rank up/down/end, cross-tier moves, empty-tier cleanup, singleton no-op, invalid ranks, stale/read-only protection, metadata preservation, and saving.');