'use strict';

function makeFixture() {
  const teamOrder = ['ARI','ATL','BAL','BUF','CAR','CHI','CIN','CLE','DAL','DEN','DET','GB','HOU','IND','JAC','KC','LAC','LAR','LV','MIA','MIN','NE','NO','NYG','NYJ','PHI','PIT','SEA','SF','TB','TEN','WAS'];
  const positions = ['QB','RB','WR','TE','OL','DL','EDGE','LB','DB'];
  const catalog = teamOrder.map((_team, index) => ({ id: `test-player-${index + 1}`,
    name: `Test Player ${String(index + 1).padStart(2, '0')}`, position: positions[index % positions.length], school: 'Test School' }));
  const results = catalog.map((player, index) => ({ pick: index + 1, originalTeam: teamOrder[index],
    selectingTeam: teamOrder[index], playerId: player.id, playerName: player.name, position: player.position,
    confirmed: true, traded: false, tradeHistory: [], notes: '' }));
  const picks = results.map(row => ({ pick: row.pick, team: row.originalTeam, playerId: row.playerId,
    playerName: row.playerName, position: row.position }));
  return { teamOrder, catalog, results, fixtures: [{ id: 'fixture-perfect', name: 'Perfect predictions', role: 'participant', status: 'submitted', picks }] };
}

module.exports = { makeFixture };
