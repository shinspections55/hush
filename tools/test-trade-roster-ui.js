'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'draft-trades-ui.js'), 'utf8');
const start = source.indexOf('        function assets(');
const end = source.indexOf('        function readSide(', start);
assert.ok(start !== -1 && end > start);
const context = {
    mode: 'draft',
    state: { waiverPicks: [{ id: 2, owner: 'Alice', originalTeam: 'Bob' }] },
    escape: value => String(value).replace(/[&<>"']/g, char => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char])
};
vm.createContext(context);
vm.runInContext(source.slice(start, end), context);

for (const [player, expected] of [
    [{ bid: 34 }, 34],
    [{ pricePaid: 7 }, 7],
    [{ pricePaid: 10, bid: 50 }, 10],
    [{ acquisitionCost: 20, bid: 1 }, 20],
    [{ finalBid: 42 }, 42],
    [{ bid: 0 }, 0],
    [{ pricePaid: null, bid: '19' }, 19],
    [{}, null],
    [{ bid: '' }, null],
    [{ bid: false }, null],
    [{ bid: -2 }, null],
    [{ bid: 'invalid' }, null],
    [{ bidAmount: 80 }, null]
]) assert.equal(context.draftPrice(player), expected);

const team = { name: 'Alice', budget: 85, roster: [
    { id: 1, name: '<img src=x>', position: 'WR', bid: 34 },
    { id: 2, name: 'Free player', position: 'QB', pricePaid: 0 },
    { id: 3, name: 'Unknown price', position: 'RB' }
] };
let html = context.assets(team, 'give', { players: [1], picks: [], budget: 5 });
assert.ok(html.includes('You offer'));
assert.ok(html.includes('3 players'));
assert.ok(html.includes('Known roster cost'));
assert.ok(html.includes('<strong>$34</strong>'));
assert.ok(html.includes('1 price unknown'));
assert.ok(html.includes('name="givePlayers" value="1" checked'));
assert.ok(html.includes('&lt;img src=x&gt;'));
assert.ok(!html.includes('<img src=x>'));
assert.ok(html.includes('acquisition cost">$0'));
assert.ok(html.includes('aria-label="Player cost unknown"'));
assert.ok(html.includes('max="85" step="1" value="5"'));
const purchasedHtml = context.assets({ name: 'Buyer', budget: 80, roster: [
    { id: 4, name: 'Christian Watson', position: 'WR', bid: 1, acquisitionCost: 20 }
] }, 'give');
assert.ok(purchasedHtml.includes('acquisition cost">$20<small>Draft: $1</small>'));
assert.ok(purchasedHtml.includes('<strong>$20</strong>'));

for (const file of ['draft-summary.js', 'public/draft-summary.js', 'waivers.js', 'public/waivers.js']) {
    const script = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    const first = script.indexOf('    function normalizeSummaryTeam(team)');
    const last = script.indexOf('\n    function ', first + 1);
    assert.ok(first !== -1 && last > first, `Missing team normalization in ${file}`);
    const normalized = { resolvePlayerByeWeek: () => 6 };
    vm.createContext(normalized);
    vm.runInContext(script.slice(first, last), normalized);
    const output = normalized.normalizeSummaryTeam({ name: 'Buyer', budget: 80, roster: [
        { id: 4, name: 'Christian Watson', position: 'WR', bid: 1, acquisitionCost: 20 }
    ] });
    assert.equal(output.roster[0].acquisitionCost, 20, file);
    assert.equal(output.roster[0].bid, 1, file);
}

context.mode = 'summary';
html = context.assets(team, 'receive', { players: [], picks: [2], budget: 0 });
assert.ok(html.includes('You receive'));
assert.ok(html.includes('name="receivePicks" value="2" checked'));
assert.ok(!html.includes('type="number"'));
assert.ok(context.assets({ name: 'Bob', roster: [], budget: 0 }, 'give').includes('No rostered players yet.'));

const elements = [];
function element(tag) {
    const node = {
        tag, children: [], attributes: {}, dataset: {}, open: false,
        setAttribute(name, value) { this.attributes[name] = value; },
        append(...children) { this.children.push(...children); },
        prepend(child) { this.children.unshift(child); },
        showModal() { this.open = true; },
        querySelector() { return null; },
        querySelectorAll() { return this.children.filter(node => node.className.includes('trade-team-btn')); },
        addEventListener(event, handler) { this[`on${event}`] = handler; }
    };
    elements.push(node);
    return node;
}
const handlers = {};
const iconContext = {
    window: { location: { hostname: 'localhost' }, addEventListener() {} },
    document: { createElement: element, body: element('body') },
    setInterval() { return 1; },
    clearInterval() {}
};
vm.createContext(iconContext);
vm.runInContext(source, iconContext);
const mount = element('nav');
iconContext.window.HushTrades.create({
    socket: { connected: false, on(event, handler) { handlers[event] = handler; } },
    code: 'test', username: 'Alice', mode: 'draft', mount, onState() {}
});
const button = mount.children[0];
const [icon, badge] = button.children;
assert.equal(icon.src, '/public/assets/trade-icon.png?v=20261112-transparent');
assert.equal(icon.alt, '');
assert.ok(fs.existsSync(path.join(__dirname, '..', 'public', 'assets', 'trade-icon.png')));
assert.equal(badge.hidden, true);
button.onclick();
assert.equal(elements.find(node => node.tag === 'dialog').open, true, 'Icon opens the trade window');
elements.find(node => node.tag === 'dialog').open = false;
handlers.tradeStateUpdated({
    phase: 'live', teams: [], waiverPicks: [],
    offers: [{ id: 'pending-1', from: 'Bob', to: 'Carol', status: 'pending' }]
});
// Keep the pending offer already seen so this update exercises the badge, not notifications.
handlers.tradeStateUpdated({
    phase: 'live', teams: [], waiverPicks: [],
    offers: [{ id: 'pending-1', from: 'Bob', to: 'Alice', status: 'pending' }]
});
assert.equal(button.children[0], icon, 'State updates must preserve the icon');
assert.equal(badge.hidden, false);
assert.equal(badge.textContent, '1');
assert.ok(button.attributes['aria-label'].includes('1 pending'));
handlers.tradeStateUpdated({ phase: 'live', teams: [], waiverPicks: [], offers: [] });
assert.equal(badge.hidden, true);

const teamMount = element('nav');
const teamController = iconContext.window.HushTrades.create({
    socket: { connected: false, on(event, handler) { handlers[event] = handler; } },
    code: 'test', username: 'Alice', mode: 'draft', mount: teamMount, onState() {},
    showLauncher: false
});
assert.equal(teamMount.children.length, 0, 'No launcher above the budgets');
const teamButton = teamController.createTeamButton('Bob');
teamMount.append(teamButton);
assert.ok(teamButton.attributes['aria-label'].includes('Trade with Bob'));
assert.equal(teamButton.children[0].src, '/public/assets/trade-icon.png?v=20261112-transparent');
let stopped = false;
teamButton.onclick({ stopPropagation() { stopped = true; } });
assert.equal(stopped, true, 'Trade click does not expand the team roster');
assert.equal(elements.filter(node => node.tag === 'dialog').at(-1).open, true);
elements.filter(node => node.tag === 'dialog').at(-1).open = false;
handlers.tradeStateUpdated({
    phase: 'live', teams: [], waiverPicks: [],
    offers: [{ id: 'seen', from: 'Bob', to: 'Carol', status: 'pending' }]
});
handlers.tradeStateUpdated({
    phase: 'live', teams: [], waiverPicks: [],
    offers: [{ id: 'seen', from: 'Bob', to: 'Alice', status: 'pending' }]
});
assert.equal(teamButton.children[1].textContent, '1');
assert.equal(teamButton.children[1].hidden, false);

console.log('Trade roster UI price, draft, summary, and escaping tests passed.');
