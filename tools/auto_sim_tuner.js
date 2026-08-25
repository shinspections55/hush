const fs = require('fs');
const path = require('path');

const CPU_JSON = path.join(__dirname, '..', '.hush-data', 'cpu-logic.json');
const TARGET = 8; // target undrafted per round
const TOLERANCE = 0.5;
const MAX_ATTEMPTS = 12;
const DRAFT_COUNT = 25;

async function postSim() {
  const url = 'http://localhost:8000/api/admin/simulate-drafts';
  const body = { draftCount: DRAFT_COUNT, teamCount: 10, rounds: 15, playersPerRound: 24 };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-key': process.env.ADMIN_DEBUG_KEY || 'local-sim-only' },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`Sim request failed: ${res.status}`);
  return res.json();
}

function loadConfig() {
  try {
    const raw = fs.readFileSync(CPU_JSON, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    // fallback to legacy cpulogic
    try {
      delete require.cache[require.resolve('../cpulogic')];
      return require('../cpulogic');
    } catch (e2) {
      return {};
    }
  }
}

function saveConfig(cfg) {
  fs.mkdirSync(path.dirname(CPU_JSON), { recursive: true });
  fs.writeFileSync(CPU_JSON, JSON.stringify(cfg, null, 2), 'utf8');
}

function mean(arr) { return arr.reduce((s,n)=>s+n,0)/Math.max(1,arr.length); }

(async function main(){
  console.log('Auto-sim tuner starting');
  for (let attempt=1; attempt<=MAX_ATTEMPTS; attempt++){
    console.log(`Attempt ${attempt}/${MAX_ATTEMPTS}: running ${DRAFT_COUNT} sims...`);
    let result;
    try {
      result = await postSim();
    } catch (err) {
      console.error('Sim request failed:', err.message || err);
      process.exit(2);
    }
    const rounds = (result.simulation && result.simulation.scorecard && result.simulation.scorecard.timing && result.simulation.scorecard.timing.roundBalance && Array.isArray(result.simulation.scorecard.timing.roundBalance.rounds))
      ? result.simulation.scorecard.timing.roundBalance.rounds.map(r => Number(r.avgUndrafted || 0))
      : null;
    if (!rounds) {
      console.error('Unable to parse round undrafted data from response');
      process.exit(3);
    }
    const avgPerRound = mean(rounds);
    console.log(`Average undrafted per round = ${avgPerRound.toFixed(2)} (target ${TARGET})`);
    if (Math.abs(avgPerRound - TARGET) <= TOLERANCE) {
      console.log('Target achieved. Writing last simulation to last_simulation.json');
      fs.writeFileSync(path.join(__dirname,'last_simulation.json'), JSON.stringify(result, null, 2), 'utf8');
      process.exit(0);
    }

    // adjust config heuristically
    const cfg = loadConfig();
    cfg.silent = cfg.silent || {};
    const currentTargetEarly = Number(cfg.silent.roundUndraftedTargetEarly || 3);
    const currentFloor = Number(cfg.silent.roundUndraftedFloor || 2);
    if (avgPerRound < TARGET) {
      // not enough undrafted -> increase early target/floor to prune more
      cfg.silent.roundUndraftedTargetEarly = currentTargetEarly + 1;
      cfg.silent.roundUndraftedFloor = Math.max(0, currentFloor + 1);
      console.log(`Increasing roundUndraftedTargetEarly -> ${cfg.silent.roundUndraftedTargetEarly}, floor -> ${cfg.silent.roundUndraftedFloor}`);
    } else {
      // too many undrafted -> loosen
      cfg.silent.roundUndraftedTargetEarly = Math.max(0, currentTargetEarly - 1);
      cfg.silent.roundUndraftedFloor = Math.max(0, currentFloor - 1);
      console.log(`Decreasing roundUndraftedTargetEarly -> ${cfg.silent.roundUndraftedTargetEarly}, floor -> ${cfg.silent.roundUndraftedFloor}`);
    }
    saveConfig(cfg);
    console.log('Saved cpu-logic.json; waiting 750ms for server to pick up changes...');
    await new Promise(r=>setTimeout(r,750));
  }
  console.log('Max attempts reached without meeting target. Wrote last_simulation.json for inspection.');
  process.exit(1);
})();
