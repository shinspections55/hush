const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'data', 'round-results');
const files = fs.readdirSync(DIR).filter(f => f.endsWith('.json'));

const rounds = new Map();

for (const file of files) {
  try {
    const full = path.join(DIR, file);
    const raw = fs.readFileSync(full, 'utf8');
    const obj = JSON.parse(raw);
    const r = Number(obj.roundNumber || obj.round || (obj.results && obj.results.length ? obj.results[0].round : null));
    if (!Number.isFinite(r)) continue;
    const stats = { undrafted: 0, ties: 0, highestPaid: { price: 0, player: null } };
    for (const res of (obj.results || [])) {
      if (res.type === 'undrafted') stats.undrafted += 1;
      if (res.type === 'tied') {
        stats.ties += 1;
      }
      if (res.type === 'won' || res.type === 'tied') {
        const price = Number(res.pricePaid || res.bidAmount || 0);
        if (price > stats.highestPaid.price) {
          stats.highestPaid.price = price;
          stats.highestPaid.player = (res.playerName || res.player && res.player.name || null);
        }
      }
    }
    if (!rounds.has(r)) rounds.set(r, []);
    rounds.get(r).push(stats);
  } catch (err) {
    // ignore parse errors
  }
}

function mean(arr){ return arr.reduce((s,n)=>s+n,0)/Math.max(1,arr.length); }
function sd(arr){ const m = mean(arr); return Math.sqrt(arr.reduce((s,n)=>s+Math.pow(n-m,2),0)/Math.max(1,arr.length)); }

const out = {};
const sorted = [...rounds.keys()].sort((a,b)=>a-b);
for (const r of sorted) {
  const list = rounds.get(r);
  const undraftedVals = list.map(s=>s.undrafted);
  const tieVals = list.map(s=>s.ties);
  const highest = list.reduce((acc,s)=>{
    if (s.highestPaid.price > (acc.price||0)) return s.highestPaid;
    return acc;
  }, { price:0, player:null });
  out[r] = {
    samples: list.length,
    undrafted: {
      mean: Number(mean(undraftedVals).toFixed(2)),
      sd: Number(sd(undraftedVals).toFixed(2)),
      min: Math.min(...undraftedVals),
      max: Math.max(...undraftedVals),
      values: undraftedVals
    },
    ties: {
      mean: Number(mean(tieVals).toFixed(2)),
      sd: Number(sd(tieVals).toFixed(2)),
      min: Math.min(...tieVals),
      max: Math.max(...tieVals),
      values: tieVals
    },
    highestPaidAcrossDrafts: highest
  };
}

const outPath = path.join(__dirname, 'round_stats_summary.json');
fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
console.log('WROTE', outPath);
