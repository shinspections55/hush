// Applies real drafted-percentage data to the ranking files.
//
//   node tools/import-draft-chance.js <inputFile> [--write]
//
// Input is one player per line, name then percent, separated by tab, comma, or
// the last whitespace run. Percent may be "98", "98%", or "0.98".
//   Ja'Marr Chase	100
//   Puka Nacua, 98
//   Tyler Allgeier 5%
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const inputArg = process.argv[2];
const WRITE = process.argv.includes('--write');

const POSITION_FILES = ['qb', 'rb', 'wr', 'te', 'k', 'def'];

if (!inputArg || inputArg.startsWith('--')) {
  console.error('Usage: node tools/import-draft-chance.js <inputFile> [--write]');
  process.exit(2);
}

const inputPath = path.isAbsolute(inputArg) ? inputArg : path.join(repoRoot, inputArg);
if (!fs.existsSync(inputPath)) {
  console.error(`Input file not found: ${inputPath}`);
  process.exit(2);
}

const keyOf = (name) => String(name || '')
  .trim()
  .toLowerCase()
  .replace(/\s+/g, ' ')
  .replace(/[.'`]/g, '')
  .replace(/\s+(jr|sr|ii|iii|iv)$/i, '');

function parseInput(text) {
  const map = new Map();
  const problems = [];

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    let name;
    let pctRaw;
    if (line.includes('\t')) {
      const parts = line.split('\t').map((s) => s.trim()).filter(Boolean);
      name = parts[0];
      pctRaw = parts[parts.length - 1];
    } else if (line.includes(',')) {
      const parts = line.split(',').map((s) => s.trim()).filter(Boolean);
      name = parts[0];
      pctRaw = parts[parts.length - 1];
    } else {
      const match = line.match(/^(.*?)[\s]+([\d.]+%?)$/);
      if (!match) { problems.push(line); continue; }
      name = match[1];
      pctRaw = match[2];
    }

    let pct = Number(String(pctRaw).replace('%', ''));
    if (!Number.isFinite(pct)) { problems.push(line); continue; }
    if (pct > 0 && pct <= 1) pct *= 100; // accept 0-1 scale
    pct = Math.max(0, Math.min(100, Math.round(pct)));

    const k = keyOf(name);
    if (k) map.set(k, pct);
  }

  return { map, problems };
}

const { map, problems } = parseInput(fs.readFileSync(inputPath, 'utf8'));
console.log(`Parsed ${map.size} player percentages from ${path.relative(repoRoot, inputPath)}`);
if (problems.length) {
  console.log(`Skipped ${problems.length} unparsable line(s):`);
  problems.slice(0, 5).forEach((l) => console.log(`   ${l}`));
}

const used = new Set();
const summary = [];

for (const pos of POSITION_FILES) {
  for (const rel of [`${pos}.json`, `data/${pos}.json`]) {
    const abs = path.join(repoRoot, rel);
    if (!fs.existsSync(abs)) continue;

    const data = JSON.parse(fs.readFileSync(abs, 'utf8'));
    const players = Array.isArray(data) ? data : (Object.values(data).find((v) => Array.isArray(v)) || []);
    if (!players.length) continue;

    let updated = 0;
    let unmatched = 0;
    for (const player of players) {
      const k = keyOf(player && player.name);
      if (!map.has(k)) { unmatched += 1; continue; }
      used.add(k);
      const pct = map.get(k);
      if (Number(player.draftChance) !== pct) updated += 1;
      player.draftChance = pct;
    }

    summary.push({ file: rel, players: players.length, updated, unmatched });

    if (WRITE && updated > 0) {
      const backup = `${abs}.pre-import.bak`;
      if (!fs.existsSync(backup)) fs.copyFileSync(abs, backup);
      fs.writeFileSync(abs, `${JSON.stringify(data, null, 2)}\n`);
    }
  }
}

console.table(summary);

const unusedNames = [...map.keys()].filter((k) => !used.has(k));
if (unusedNames.length) {
  console.log(`${unusedNames.length} input name(s) matched no player (check spelling):`);
  unusedNames.slice(0, 10).forEach((n) => console.log(`   ${n}`));
}

console.log(WRITE
  ? 'WROTE updates. Backups saved as *.pre-import.bak'
  : 'DRY RUN - re-run with --write to apply.');
