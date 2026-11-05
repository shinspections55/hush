'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const prospectsRoot = path.join(root, 'college prospects 2027');
const positions = ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'EDGE', 'LB', 'DB'];
const outputPath = path.join(prospectsRoot, 'overall-rankings-2027.json');

const suppliedPrefix = [
  ['Jeremiah Smith', 'Ohio State'],
  ['Dante Moore', 'Oregon'],
  ['Arch Manning', 'Texas'],
  ['Colin Simmons', 'Texas'],
  ['Leonard Moore', 'Notre Dame'],
  ['Dylan Stewart', 'South Carolina'],
  ['Julian Sayin', 'Ohio State'],
  ['Cam Coleman', 'Texas'],
  ['Matayo Uiagalelei', 'Oregon'],
  ['Carter Smith', 'Indiana'],
  ['Cayden Green', 'Missouri'],
  ['Ellis Robinson IV', 'Georgia'],
  ['Trevor Goosby', 'Texas'],
  ['Will Echoles', 'Ole Miss'],
  ['Kyngstonn Viliamu-Asa', 'Notre Dame'],
  ['KJ Bolden', 'Georgia'],
  ['Yhonzae Pierre', 'Alabama'],
  ["Trey'Dez Green", 'LSU'],
  ['David Stone', 'Oklahoma'],
  ['Justin Scott', 'Miami'],
  ['Drew Mestemaker', 'Oklahoma State'],
  ['A.J. Holmes Jr.', 'Texas Tech'],
  ['Jordan Seaton', 'LSU'],
  ["A'Mauri Washington", 'Oregon'],
  ['CJ Carr', 'Notre Dame'],
  ['Sammy Brown', 'Clemson'],
  ['Ahmad Hardy', 'Missouri'],
  ['Chris Cole', 'Georgia'],
  ['Suntarine Perkins', 'Ole Miss'],
  ['Tae Johnson', 'Notre Dame'],
  ['Dashawn Spears', 'LSU'],
  ['Jamari Johnson', 'Oregon'],
  ['Trevor Lauck', 'Iowa'],
  ['Charlie Becker', 'Indiana'],
  ['Jadan Baugh', 'Florida'],
  ['KJ Duff', 'Rutgers'],
  ['Zabien Brown', 'Alabama'],
  ['Damon Wilson II', 'Miami'],
  ['Clev Lubin', 'Louisville'],
  ['Duce Robinson', 'Florida State'],
  ['Kewan Lacy', 'Ole Miss'],
  ['Austin Siereveld', 'Ohio State'],
  ['John Henry Daley', 'Michigan'],
  ['Darian Mensah', 'Miami'],
  ['Kade Pieper', 'Iowa'],
  ['Jelani McDonald', 'Texas'],
  ['Ryan Coleman-Williams', 'Alabama'],
  ['Trinidad Chambliss', 'Ole Miss'],
  ['LaNorris Sellers', 'South Carolina'],
  ['Kelley Jones', 'Mississippi State'],
  ['Will Heldt', 'Clemson'],
  ['Jacarrius Peak', 'South Carolina'],
  ['PJ Williams', 'SMU'],
  ['Bryant Wesco Jr.', 'Clemson'],
  ['Boubacar Traore', 'Notre Dame'],
  ['Nate Frazier', 'Georgia'],
  ['Ryan Wingo', 'Texas'],
  ['Nick Marsh', 'Indiana'],
  ['Ashton Hampton', 'Clemson'],
  ['Kenyatta Jackson Jr.', 'Ohio State'],
  ['Bear Alexander', 'Oregon'],
  ['Mark Fletcher Jr.', 'Miami'],
  ['T.J. Moore', 'Clemson'],
  ['Keon Sabb', 'Alabama'],
  ['Vicari Swain', 'South Carolina'],
  ['Greg Johnson', 'Minnesota'],
  ['Ahmad Moten Sr.', 'Miami'],
  ['Zach Lutmer', 'Iowa'],
  ['Sam Leavitt', 'LSU'],
  ['Rasheem Biles', 'Texas'],
  ['Teitum Tuioti', 'Oregon'],
  ['Jordan Ross', 'LSU']
];

function slug(value) {
  return String(value || '').trim().toLowerCase().normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function keyFor(player) {
  return `${slug(player.name)}::${slug(player.school)}`;
}

function ratingFor(player) {
  const metrics = String(player.listingMetrics || '').replace(/\s/g, '');
  const ratingMatch = metrics.match(/([0-9]{2}\.[0-9])$/);
  if (ratingMatch) return Number(ratingMatch[1]);

  const qbTail = metrics.match(/([0-9]\.[0-9])$/);
  if (player.position === 'QB' && qbTail) {
    const tail = Number(qbTail[1]);
    return tail + (Number(player.rank) <= 2 ? 90 : 80);
  }

  return null;
}

function edgeRole(player) {
  return player.position === 'EDGE' || /ED|EDGE|DE/i.test(String(player.subPosition || ''));
}

function preferenceScore(player) {
  if (edgeRole(player)) return 90;
  if (player.position === 'DL') return 80;
  if (player.position === 'LB') return 70;
  return 60;
}

function main() {
  const playersByKey = new Map();
  positions.forEach(position => {
    const filePath = path.join(prospectsRoot, position, `${position.toLowerCase()}-prospects-2027.json`);
    const board = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    board.forEach(player => {
      const key = keyFor(player);
      const existing = playersByKey.get(key);
      if (!existing || preferenceScore(player) > preferenceScore(existing)) {
        playersByKey.set(key, { ...player, key, rating: ratingFor(player) });
      }
    });
  });

  const orderedKeys = [];
  const included = new Set();
  suppliedPrefix.forEach(([name, school]) => {
    const key = `${slug(name)}::${slug(school)}`;
    if (!playersByKey.has(key)) throw new Error(`Supplied overall prospect is missing: ${name} (${school})`);
    if (!included.has(key)) {
      orderedKeys.push(key);
      included.add(key);
    }
  });

  const remaining = Array.from(playersByKey.values())
    .filter(player => !included.has(player.key))
    .sort((left, right) => {
      const leftRating = left.rating == null ? -1 : left.rating;
      const rightRating = right.rating == null ? -1 : right.rating;
      return rightRating - leftRating || Number(left.rank || 9999) - Number(right.rank || 9999) || left.name.localeCompare(right.name);
    });
  remaining.forEach(player => orderedKeys.push(player.key));

  if (orderedKeys.length !== playersByKey.size || new Set(orderedKeys).size !== orderedKeys.length) {
    throw new Error(`Overall order mismatch: ${orderedKeys.length} keys for ${playersByKey.size} unique prospects`);
  }

  fs.writeFileSync(outputPath, `${JSON.stringify({ order: orderedKeys }, null, 2)}\n`, 'utf8');
  console.log(`Saved ${orderedKeys.length} unique prospects to ${path.relative(root, outputPath)}.`);
  console.log(`First 12: ${suppliedPrefix.slice(0, 12).map(([name]) => name).join(' | ')}`);
}

main();
