'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { DEADLINE_2027, submissionPolicy, formatDeadline } = require('../mock-draft-contest-policy');

assert.equal(DEADLINE_2027, '2027-04-29T23:30:00.000Z');
const instant = Date.parse(DEADLINE_2027);
const contest = { year: 2027, submissions: 'open' };
assert.equal(submissionPolicy(contest, instant - 1).editable, true);
assert.equal(submissionPolicy(contest, instant).open, false);
assert.equal(submissionPolicy(contest, instant + 1).editable, false);
assert.equal(submissionPolicy({ ...contest, year: 2025 }, instant).deadline, null);
for (const [zone, hour, day] of [
  ['America/New_York', 19, 29], ['America/Chicago', 18, 29],
  ['America/Denver', 17, 29], ['America/Los_Angeles', 16, 29],
  ['Europe/London', 0, 30], ['Asia/Tokyo', 8, 30]
]) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: zone, hour: 'numeric', hourCycle: 'h23', day: 'numeric' })
    .formatToParts(new Date(DEADLINE_2027));
  assert.equal(Number(parts.find(part => part.type === 'hour').value), hour);
  assert.equal(Number(parts.find(part => part.type === 'day').value), day);
  const formatted = formatDeadline(DEADLINE_2027, zone);
  assert.ok(formatted.includes(String(day)));
  assert.match(formatted, /your local time; 7:30 PM Eastern/);
}
assert.match(formatDeadline(DEADLINE_2027, 'America/Chicago'), /6:30/);
assert.match(formatDeadline(DEADLINE_2027, 'America/New_York'), /7:30/);
assert.match(formatDeadline(DEADLINE_2027, 'America/Los_Angeles'), /4:30/);
const node = {};
const browser = vm.createContext({ document: { querySelectorAll: () => [node] } });
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'mock-draft-contest-policy.js'), 'utf8'), browser);
assert.equal(node.dateTime, DEADLINE_2027);
assert.equal(node.textContent, formatDeadline());
assert.equal(browser.HushMockDeadline.DEADLINE_2027, DEADLINE_2027);
for (const file of ['mock-draft-contest.html', 'mock-draft-summary.html', 'mock-draft-scoreboard.html', 'mock-draft-contest-intro.html', 'admin-mock-draft.html']) {
  assert.match(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), /mock-draft-contest-policy\.js\?v=20261115-real-contest/);
}
console.log('Deadline: exact 7:30 PM Eastern cutoff, US daylight time, next-day London/Tokyo conversion, browser-local rendering, and all page wiring passed.');
