// Local tuning harness: reports per-round undrafted + tie averages from the admin simulator.
const http = require('http');

const PORT = Number(process.env.SIM_PORT || 8100);
const KEY = process.env.ADMIN_DEBUG_KEY || 'local-sim-only';
const DRAFTS = Number(process.env.SIM_DRAFTS || 30);

function post(path, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = http.request({
      host: '127.0.0.1',
      port: PORT,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'x-admin-key': KEY
      }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, json: JSON.parse(data) });
        } catch (error) {
          resolve({ status: res.statusCode, raw: data.slice(0, 400) });
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function countTies(tieSummary) {
  if (!tieSummary) return 0;
  return Number(tieSummary.totalTies || 0);
}

(async () => {
  const res = await post('/api/admin/simulate-drafts', {
    draftCount: DRAFTS,
    teamCount: 10,
    rounds: 10,
    playersPerRound: 24
  });

  if (res.status !== 200 || !res.json || !res.json.ok) {
    console.error('Simulation failed:', res.status, res.raw || JSON.stringify(res.json).slice(0, 400));
    process.exit(1);
  }

  const sim = res.json.simulation || res.json;
  const rows = sim.drafts || [];
  if (!rows.length) {
    console.error('No drafts returned. Top-level keys:', Object.keys(sim));
    process.exit(1);
  }

  const undraftedByRound = new Map();
  const tiesByRound = new Map();
  const avOfferedByRound = new Map();
  const avDraftedByRound = new Map();
  const avUndraftedByRound = new Map();
  const priceByRound = new Map();

  for (const draft of rows) {
    for (const round of (draft.roundBidDetails || [])) {
      const r = Number(round.round || 0);
      if (!r) continue;
      const results = round.roundPlayerResults || [];
      const undrafted = results.filter((p) => !p.drafted);
      if (!undraftedByRound.has(r)) {
        undraftedByRound.set(r, []);
        tiesByRound.set(r, []);
        avOfferedByRound.set(r, []);
        avDraftedByRound.set(r, []);
        avUndraftedByRound.set(r, []);
        priceByRound.set(r, []);
      }
      undraftedByRound.get(r).push(undrafted.length);
      tiesByRound.get(r).push(countTies(round.tieSummary));
      for (const p of results) {
        avOfferedByRound.get(r).push(Number(p.avgValue || 0));
        if (p.drafted) {
          avDraftedByRound.get(r).push(Number(p.avgValue || 0));
          priceByRound.get(r).push(Number(p.pricePaid || 0));
        } else {
          avUndraftedByRound.get(r).push(Number(p.avgValue || 0));
        }
      }
    }
  }

  const avg = (list) => list.length ? list.reduce((s, n) => s + n, 0) / list.length : 0;
  const rounds = [...undraftedByRound.keys()].sort((a, b) => a - b);

  const undraftedRow = rounds.map((r) => avg(undraftedByRound.get(r)));
  const tiesRow = rounds.map((r) => avg(tiesByRound.get(r)));

  console.log('round      ' + rounds.map((r) => String(r).padStart(6)).join(''));
  console.log('undrafted  ' + undraftedRow.map((v) => v.toFixed(2).padStart(6)).join(''));
  console.log('ties       ' + tiesRow.map((v) => v.toFixed(2).padStart(6)).join(''));
  console.log('AV offered ' + rounds.map((r) => avg(avOfferedByRound.get(r)).toFixed(1).padStart(6)).join(''));
  console.log('AV drafted ' + rounds.map((r) => avg(avDraftedByRound.get(r)).toFixed(1).padStart(6)).join(''));
  console.log('AV undraft ' + rounds.map((r) => avg(avUndraftedByRound.get(r)).toFixed(1).padStart(6)).join(''));
  console.log('avg price  ' + rounds.map((r) => avg(priceByRound.get(r)).toFixed(1).padStart(6)).join(''));

  // Separate "nobody wanted it" from "nobody could take it": only AV>=5 players are real misses.
  const worthy = new Map();
  const worthyUndrafted = new Map();
  for (const draft of rows) {
    for (const round of (draft.roundBidDetails || [])) {
      const r = Number(round.round || 0);
      if (!r) continue;
      if (!worthy.has(r)) { worthy.set(r, []); worthyUndrafted.set(r, []); }
      const results = round.roundPlayerResults || [];
      const w = results.filter((p) => Number(p.avgValue || 0) >= 5);
      worthy.get(r).push(w.length);
      worthyUndrafted.get(r).push(w.filter((p) => !p.drafted).length);
    }
  }
  console.log('AV>=5 offer' + rounds.map((r) => avg(worthy.get(r)).toFixed(1).padStart(6)).join(''));
  console.log('AV>=5 undr ' + rounds.map((r) => avg(worthyUndrafted.get(r)).toFixed(1).padStart(6)).join(''));

  // Are CPUs declining to bid late, or bidding and losing? bidCount answers it.
  const bidsPerPlayer = new Map();
  const spendPerRound = new Map();
  for (const draft of rows) {
    for (const round of (draft.roundBidDetails || [])) {
      const r = Number(round.round || 0);
      if (!r) continue;
      if (!bidsPerPlayer.has(r)) { bidsPerPlayer.set(r, []); spendPerRound.set(r, []); }
      for (const p of (round.playerBidTotals || [])) {
        bidsPerPlayer.get(r).push(Number(p.bidCount || 0));
      }
      spendPerRound.get(r).push(Number(round.totalBidAmount || 0));
    }
  }
  console.log('bids/player' + rounds.map((r) => avg(bidsPerPlayer.get(r) || []).toFixed(2).padStart(6)).join(''));
  console.log('spend/round' + rounds.map((r) => avg(spendPerRound.get(r) || []).toFixed(0).padStart(6)).join(''));

  // Does a player configured at N% actually get drafted about N% of the time?
  const fs = require('fs');
  const path = require('path');
  const configured = new Map();
  for (const pos of ['qb', 'rb', 'wr', 'te', 'k', 'def']) {
    const file = path.join(__dirname, '..', `${pos}.json`);
    if (!fs.existsSync(file)) continue;
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    const list = Array.isArray(parsed) ? parsed : (Object.values(parsed).find((v) => Array.isArray(v)) || []);
    for (const p of list) {
      const pct = Number(p && p.draftChance);
      if (Number.isFinite(pct)) configured.set(String(p.name || '').trim().toLowerCase(), pct);
    }
  }

  const actual = new Map();
  for (const draft of rows) {
    for (const round of (draft.roundBidDetails || [])) {
      for (const p of (round.roundPlayerResults || [])) {
        const k = String(p.playerName || '').trim().toLowerCase();
        if (!configured.has(k)) continue;
        if (!actual.has(k)) actual.set(k, { offered: 0, drafted: 0 });
        const s = actual.get(k);
        s.offered += 1;
        if (p.drafted) s.drafted += 1;
      }
    }
  }

  const buckets = [[0, 20], [20, 40], [40, 60], [60, 80], [80, 101]];
  console.log('');
  console.log('configured %   ->  actual drafted %   (players)');
  for (const [lo, hi] of buckets) {
    const members = [...actual.entries()].filter(([k, s]) => {
      const c = configured.get(k);
      return c >= lo && c < hi && s.offered >= 5;
    });
    if (!members.length) continue;
    const actualRate = members.reduce((sum, [, s]) => sum + (s.drafted / s.offered), 0) / members.length;
    const configuredRate = members.reduce((sum, [k]) => sum + configured.get(k), 0) / members.length;
    console.log(`  ${String(lo).padStart(3)}-${String(hi - 1).padEnd(3)} (avg ${configuredRate.toFixed(0).padStart(3)}%)  ->  ${(actualRate * 100).toFixed(1).padStart(5)}%          (${members.length})`);
  }

  const agg = sim.aggregate || {};
  const balance = (sim.scorecard && sim.scorecard.timing && sim.scorecard.timing.roundBalance) || {};
  console.log('');
  console.log(`undrafted avg R1-5  : ${balance.avgUndraftedEarlyRounds}`);
  console.log(`undrafted avg R7-10 : ${balance.avgUndraftedLateRounds}`);
  console.log(`early/late spread   : ${balance.undraftedEarlyLateSpread}  (target <= ${balance.target && balance.target.maxEarlyLateSpread})`);
  console.log(`round stdDev        : ${balance.undraftedRoundStdDev}  (target <= ${balance.target && balance.target.maxStdDev})`);
  console.log(`withinTarget        : ${balance.withinTarget}`);
  console.log('');
  console.log(`completionRate      : ${agg.completionRate}`);
  console.log(`allCompleteDraftRate: ${agg.allCompleteDraftRate}`);
  console.log(`avgRosterCount      : ${agg.avgRosterCount}`);
  console.log(`avgBudgetRemaining  : ${agg.avgBudgetRemaining}`);
})().catch((error) => {
  console.error('Harness error:', error && error.message ? error.message : error);
  process.exit(1);
});
