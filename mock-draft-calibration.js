'use strict';

const { DEFAULT_RULES, scoreMock } = require('./mock-draft-scoring');
const rows = [
  ['TEN','TEN','Cam Ward','Miami','QB'],
  ['CLE','JAC','Travis Hunter','Colorado','CB'],
  ['NYG','NYG','Abdul Carter','Penn State','EDGE'],
  ['NE','NE','Will Campbell','LSU','OT'],
  ['JAC','CLE','Mason Graham','Michigan','DT'],
  ['LV','LV','Ashton Jeanty','Boise State','RB'],
  ['NYJ','NYJ','Armand Membou','Missouri','OT'],
  ['CAR','CAR','Tetairoa McMillan','Arizona','WR'],
  ['NO','NO','Kelvin Banks Jr.','Texas','OT'],
  ['CHI','CHI','Colston Loveland','Michigan','TE'],
  ['SF','SF','Mykel Williams','Georgia','EDGE'],
  ['DAL','DAL','Tyler Booker','Alabama','OG'],
  ['MIA','MIA','Kenneth Grant','Michigan','DT'],
  ['IND','IND','Tyler Warren','Penn State','TE'],
  ['ATL','ATL','Jalon Walker','Georgia','LB'],
  ['ARI','ARI','Walter Nolen','Ole Miss','DT'],
  ['CIN','CIN','Shemar Stewart','Texas A&M','EDGE'],
  ['SEA','SEA','Grey Zabel','North Dakota State','OG'],
  ['TB','TB','Emeka Egbuka','Ohio State','WR'],
  ['DEN','DEN','Jahdae Barron','Texas','CB'],
  ['PIT','PIT','Derrick Harmon','Oregon','DT'],
  ['LAC','LAC','Omarion Hampton','North Carolina','RB'],
  ['GB','GB','Matthew Golden','Texas','WR'],
  ['MIN','MIN','Donovan Jackson','Ohio State','OG'],
  ['HOU','NYG','Jaxson Dart','Ole Miss','QB'],
  ['LAR','ATL','James Pearce Jr.','Tennessee','EDGE'],
  ['BAL','BAL','Malaki Starks','Georgia','S'],
  ['DET','DET','Tyleik Williams','Ohio State','DT'],
  ['WAS','WAS','Josh Conerly Jr.','Oregon','OT'],
  ['BUF','BUF','Maxwell Hairston','Kentucky','CB'],
  ['KC','PHI','Jihaad Campbell','Alabama','LB'],
  ['PHI','KC','Josh Simmons','Ohio State','OT']
];
const groups = { OT: 'OL', OG: 'OL', DT: 'DL', CB: 'DB', S: 'DB' };
const slug = value => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function makeCalibration() {
  const catalog = rows.map(([, , name, school, subPosition], index) => ({ id: `manual:${slug(name)}`, name, school,
    position: groups[subPosition] || subPosition, subPosition, rank: index + 1, summary: '', imageUrl: '', schoolLogoUrl: '' }));
  const results = rows.map(([originalTeam, selectingTeam], index) => ({ pick: index + 1, originalTeam, selectingTeam,
    playerId: catalog[index].id, playerName: catalog[index].name, position: catalog[index].position, confirmed: true,
    traded: originalTeam !== selectingTeam, tradeHistory: originalTeam !== selectingTeam ? [originalTeam, selectingTeam] : [], notes: '' }));
  const prediction = (player, index) => ({ pick: index + 1, team: results[index].originalTeam, trade: false, tradeTo: '',
    playerId: player.id, playerName: player.name, position: player.position });
  const perfect = catalog.map(prediction);
  const byPosition = new Map();
  catalog.forEach((player, index) => {
    if (!byPosition.has(player.position)) byPosition.set(player.position, []);
    byPosition.get(player.position).push(index);
  });
  const positional = catalog.map((player, index) => {
    const group = byPosition.get(player.position);
    return prediction(catalog[group[(group.indexOf(index) + 1) % group.length]], index);
  });
  const adjacent = catalog.map((_player, index) => prediction(catalog[index % 2 === 0 ? index + 1 : index - 1], index));
  const matchedSlots = new Map();
  function match(slot, visited) {
    for (let playerIndex = 0; playerIndex < catalog.length; playerIndex += 1) {
      if (visited.has(playerIndex) || Math.abs(playerIndex - slot) <= 1 || catalog[playerIndex].position === catalog[slot].position) continue;
      visited.add(playerIndex);
      if (!matchedSlots.has(playerIndex) || match(matchedSlots.get(playerIndex), visited)) {
        matchedSlots.set(playerIndex, slot);
        return true;
      }
    }
    return false;
  }
  catalog.forEach((_player, index) => { if (!match(index, new Set())) throw new Error('Unable to build complete-miss calibration'); });
  const misses = new Array(32);
  matchedSlots.forEach((slot, playerIndex) => { misses[slot] = prediction(catalog[playerIndex], slot); });
  const mixed = structuredClone(adjacent);
  for (let index = 0; index < 4; index += 1) mixed[index] = { ...perfect[index] };
  mixed[1] = { ...mixed[1], trade: true, tradeTo: 'JAC' };
  mixed[4] = { ...prediction(catalog[20], 4), trade: true, tradeTo: 'CLE' };
  mixed[21] = prediction(catalog[5], 21);
  mixed[24] = { ...mixed[24], trade: true, tradeTo: 'NYG' };
  mixed[25] = { ...mixed[25], trade: true };
  mixed[30] = { ...mixed[30], trade: true, tradeTo: 'BUF' };
  mixed[31] = { ...mixed[31], team: 'KC', trade: true };
  const fixtures = [
    { id: 'calibration-a', name: 'Test A - Perfect', picks: perfect, expectedScore: 480 },
    { id: 'calibration-b', name: 'Test B - Position only', picks: positional, expectedScore: 160 },
    { id: 'calibration-c', name: 'Test C - Adjacent pairs', picks: adjacent, expectedScore: 96 },
    { id: 'calibration-d', name: 'Test D - Complete misses', picks: misses, expectedScore: -96 },
    { id: 'calibration-e', name: 'Test E - Mixed trades', picks: mixed, expectedScore: 173 }
  ].map(mock => ({ ...mock, role: 'participant', status: 'submitted', submittedAt: null, calibration: true }));
  fixtures.forEach(mock => {
    if (scoreMock(mock, results, DEFAULT_RULES, 'final').total !== mock.expectedScore) throw new Error(`Calibration failed: ${mock.name}`);
  });
  return { catalog, results, fixtures, teamOrder: results.map(result => result.originalTeam) };
}

module.exports = { makeCalibration };