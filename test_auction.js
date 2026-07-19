const { generateServerCPUBids } = require('./Backupfiles/TEST5_11/cpu-silent-auction.js');

const rosterLimits = { QB: 2, RB: 5, WR: 5, TE: 2, K: 1, DEF: 1 };
const rosterSize = 16;

const mockPlayers = [
    { id: 1, name: 'Player A', position: 'RB', avgValue: 45 },
    { id: 2, name: 'Player B', position: 'WR', avgValue: 40 },
    { id: 3, name: 'Player C', position: 'QB', avgValue: 35 },
    { id: 4, name: 'Player D', position: 'TE', avgValue: 15 },
    { id: 5, name: 'Player E', position: 'RB', avgValue: 25 },
    { id: 6, name: 'Player F', position: 'WR', avgValue: 20 },
    { id: 7, name: 'Player G', position: 'K', avgValue: 5 },
    { id: 8, name: 'Player H', position: 'DEF', avgValue: 5 },
    { id: 9, name: 'Player I', position: 'WR', avgValue: 12 },
    { id: 10, name: 'Player J', position: 'RB', avgValue: 18 }
];

const cpuMembers = [
    { 
        name: 'CPU 1', 
        budget: 180, 
        roster: mockPlayers.slice(0, 5), 
        strategy: { aggression: 0.5 } 
    },
    { 
        name: 'CPU 2', 
        budget: 160, 
        roster: [], 
        strategy: { aggression: 0.7 } 
    },
    { 
        name: 'CPU 3', 
        budget: 190, 
        roster: mockPlayers.slice(5, 7), 
        strategy: { aggression: 0.3 } 
    }
];

const roundPlayers = mockPlayers.slice(0, 5);
const allPlayers = mockPlayers;

// Signature: (teams, roundPlayers, allPlayers, rosterSize, rosterLimits, humanMembers, roundNumber)
generateServerCPUBids(
    cpuMembers,
    roundPlayers,
    allPlayers,
    rosterSize,
    rosterLimits,
    [], // humanMembers
    8  // roundNumber
).then(bids => {
    console.log('BIDS_RESULT:');
    console.log(JSON.stringify(bids, null, 2));
}).catch(error => {
    console.error('ERROR_CAUGHT:');
    console.error(error.stack);
});
