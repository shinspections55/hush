'use strict';

const assert = require('node:assert/strict');
const { createTradeService } = require('..\\draft-trades');

async function main() {
  let release;
  let rankingLoads = 0;
  const loadCpuRankings = () => {
    rankingLoads++;
    return new Promise(resolve => { release = resolve; });
  };
  const service = createTradeService({
    isCpu: name => name === 'CPU', capacity: () => 4,
    playerValue: player => player.avgValue,
    rosterScore: roster => roster.reduce((sum, player) => sum + player.avgValue, 0),
    waiverScore: () => 0, waiverMode: () => 'off', persist() {}, loadCpuRankings, random: () => 0
  });
  const handlers = {};
  const socket = {
    handshake: { address: '127.0.0.1', headers: { host: 'localhost:8000', origin: 'http://localhost:8000' } },
    data: { username: 'Alice', currentDraft: 'TEST' },
    on(name, callback) { handlers[name] = callback; },
    emit() {}
  };
  const draft = {
    members: ['Alice'], draftState: {
      teams: [{ name: 'Alice', budget: 100, roster: [] }, { name: 'CPU', budget: 100, roster: [{ id: 1, name: 'Player', position: 'WR', avgValue: 35, bid: 30 }] }],
      currentRound: 1, roundStartAt: Date.now() - 1000, roundEndsAt: Date.now() + 600000
    }
  };
  service.register(socket, { sockets: { sockets: new Map() } }, { TEST: draft });
  const input = {
    code: 'TEST', to: 'CPU', requestId: 'cpu-offer-1',
    give: { players: [], picks: [], budget: 35 }, receive: { players: [1], picks: [], budget: 0 }
  };
  const send = payload => new Promise(resolve => handlers.offerTrade(payload, resolve));
  const pending = send(input);
  release([{ name: 'Player', position: 'WR', prerank: 1 }]);
  const first = await pending;
  assert.equal(first.ok, true);
  assert.equal(first.offer.status, 'accepted');
  assert.equal(draft.draftState.teams[0].budget, 65);
  assert.equal((await send(input)).offer.status, 'accepted');
  assert.equal(rankingLoads, 1, 'Retries must not reload rankings or reroll');

  const second = send({ ...input, requestId: 'cpu-offer-2', receive: { players: [], picks: [], budget: 0 } });
  draft.draftState.pendingRoundResults = { results: [] };
  release([{ name: 'Player', position: 'WR', prerank: 1 }]);
  assert.equal((await second).reason, 'trades_resolving', 'The phase must be rechecked after loading rankings');
  console.log('CPU trade socket tests passed.');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
