// Rebuilds draftChance (drafted %) on the ranking files from simulated draft outcomes.
// Usage: node tools/rebuild-draft-chance.js [--write]
const fs = require('fs');
const path = require('path');
const http = require('http');

const repoRoot = path.resolve(__dirname, '..');
const PORT = Number(process.env.SIM_PORT || 8100);
const KEY = process.env.ADMIN_DEBUG_KEY || 'local-sim-only';
const DRAFTS = Number(process.env.SIM_DRAFTS || 80);
const WRITE = process.argv.includes('--write');
const MIN_SAMPLES = 8;

const TARGET_FILES = [
  'qb.json', 'rb.json', 'wr.json', 'te.json', 'k.json', 'def.json', 'top250.json',
  'data/qb.json', 'data/rb.json', 'data/wr.json', 'data/te.json', 'data/k.json', 'data/def.json', 'data/top250.json'
];

function post(body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = http.request({
      host: '127.0.0.1',
      port: PORT,
      path: '/api/admin/simulate-drafts',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'x-admin-key': KEY
      }
    }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (error) { reject(new Error(`Bad response: ${data.slice(0, 200)}`)); }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

const keyOf = (name) => String(name || '').trim().toLowerCase();

function readJson(relPath) {
  const abs = path.join(repoRoot, relPath);
  if (!fs.existsSync(abs)) return null;
  return { abs, data: JSON.parse(fs.readFileSync(abs, 'utf8')) };
}

function playerArrayOf(data) {
  if (Array.isArray(data)) return data;
  const arr = Object.values(data).find((v) => Array.isArray(v));
  return Array.isArray(arr) ? arr : [];
}

(async () => {
  console.log(`Simulating ${DRAFTS} drafts to measure drafted rate per player...`);
  const res = await post({ draftCount: DRAFTS, teamCount: 10, rounds: 10, playersPerRound: 24 });
  if (!res || !res.ok) {
    console.error('Simulation failed:', JSON.stringify(res).slice(0, 300));
    process.exit(1);
  }

  const stats = new Map();
  for (const draft of (res.simulation.drafts || [])) {
    for (const round of (draft.roundBidDetails || [])) {
      for (const p of (round.roundPlayerResults || [])) {
        const k = keyOf(p.playerName);
        if (!k) continue;
        if (!stats.has(k)) stats.set(k, { offered: 0, drafted: 0 });
        const s = stats.get(k);
        s.offered += 1;
        if (p.drafted) s.drafted += 1;
      }
    }
  }

  console.log(`Measured ${stats.size} distinct players.`);

  const rates = [];
  for (const [k, s] of stats) {
    if (s.offered >= MIN_SAMPLES) rates.push({ k, rate: s.drafted / s.offered, offered: s.offered });
  }
  rates.sort((a, b) => b.rate - a.rate);
  console.log(`Players with >=${MIN_SAMPLES} samples: ${rates.length}`);
  console.log('Top 5:', rates.slice(0, 5).map((r) => `${r.k}=${(r.rate * 100).toFixed(0)}%`).join(', '));
  console.log('Bottom 5:', rates.slice(-5).map((r) => `${r.k}=${(r.rate * 100).toFixed(0)}%`).join(', '));

  let totalUpdated = 0;
  const summary = [];

  for (const relPath of TARGET_FILES) {
    const file = readJson(relPath);
    if (!file) continue;
    const players = playerArrayOf(file.data);
    if (!players.length) continue;

    let updated = 0;
    let missing = 0;
    for (const player of players) {
      const s = stats.get(keyOf(player && player.name));
      if (!s || s.offered < MIN_SAMPLES) { missing += 1; continue; }
      const pct = Math.round((s.drafted / s.offered) * 100);
      if (Number(player.draftChance) !== pct) updated += 1;
      player.draftChance = pct;
    }

    summary.push({ file: relPath, players: players.length, updated, unmeasured: missing });
    totalUpdated += updated;

    if (WRITE) {
      const backup = `${file.abs}.bak`;
      if (!fs.existsSync(backup)) fs.copyFileSync(file.abs, backup);
      fs.writeFileSync(file.abs, `${JSON.stringify(file.data, null, 2)}\n`);
    }
  }

  console.table(summary);
  console.log(WRITE ? `WROTE draftChance to ${summary.length} file(s). Backups saved as *.bak` : `DRY RUN - ${totalUpdated} values would change. Re-run with --write to apply.`);
})().catch((error) => {
  console.error('Failed:', error && error.message ? error.message : error);
  process.exit(1);
});
