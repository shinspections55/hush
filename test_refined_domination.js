// Test refined conservative CPU budget domination strategy
function testBudgetDomination() {
  // Simulate teams with different budgets
  const teams = [
    { name: 'CPU1', budget: 50 },
    { name: 'CPU4', budget: 75 },
    { name: 'CPU7', budget: 120 }, // Conservative CPU with most money
    { name: 'CPU8', budget: 95 },
    { name: 'CPU10', budget: 85 }
  ];

  // Simulate round players
  const roundPlayers = [
    { name: 'Player A', avgValue: 8 },
    { name: 'Player B', avgValue: 12 },
    { name: 'Player C', avgValue: 18, position: 'QB' }, // Best QB in round
    { name: 'Player D', avgValue: 20, position: 'WR' }, // Best WR in round
    { name: 'Player E', avgValue: 6 }
  ];

  // Test the budget domination logic
  function testDomination(teamName, player, bestAtPosition, roundNumber) {
    const team = teams.find(t => t.name === teamName);
    const isConservativeCPU = ['CPU7', 'CPU8', 'CPU9', 'CPU10'].includes(teamName);
    const draftProgress = roundNumber / 20;

    if (!isConservativeCPU || draftProgress <= 0.6) return null;

    // Probabilistic activation based on round
    let activationChance = 0;
    if (roundNumber >= 20) activationChance = 1.0;
    else if (roundNumber >= 19) activationChance = 0.7;
    else if (roundNumber >= 18) activationChance = 0.3;

    if (Math.random() >= activationChance) return null; // Strategy not activated

    // Check if this CPU has the most money left
    const teamBudgets = teams.map(t => ({ name: t.name, budget: t.budget }));
    teamBudgets.sort((a, b) => b.budget - a.budget);
    const hasMostMoney = teamBudgets[0].name === teamName;

    // Check if they need this position
    const needsPosition = bestAtPosition === 0 || (bestAtPosition < 10 && player.avgValue >= 15);

    // Check if this is the best player available in the round
    const roundPlayerValues = roundPlayers.map(p => p.avgValue);
    const maxValueInRound = Math.max(...roundPlayerValues);
    const isBestPlayerInRound = player.avgValue === maxValueInRound;

    if (hasMostMoney && needsPosition && isBestPlayerInRound) {
      const isQB = player.position === 'QB';
      let dominationBid;

      if (isQB) {
        const nextHighestBudget = teamBudgets[1] ? teamBudgets[1].budget : teamBudgets[0].budget - 1;
        dominationBid = Math.min(nextHighestBudget, team.budget);
        dominationBid = Math.max(dominationBid, Math.min(player.avgValue * 1.8, team.budget));
      } else {
        const nextHighestBudget = teamBudgets[1] ? teamBudgets[1].budget : teamBudgets[0].budget - 1;
        dominationBid = nextHighestBudget + 1;
      }

      if (dominationBid <= team.budget) {
        return dominationBid;
      }
    }

    return null;
  }

  console.log('Refined Budget Domination Strategy Test');
  console.log('======================================');
  console.log('Teams:');
  teams.forEach(team => console.log(`  ${team.name}: $${team.budget}`));
  console.log('');
  console.log('Round players:');
  roundPlayers.forEach(player => console.log(`  ${player.name}: ${player.avgValue}pts (${player.position || 'N/A'})`));
  console.log('');

  // Test scenarios
  const scenarios = [
    { team: 'CPU7', player: 'Player C', bestAtPos: 0, round: 18, desc: 'Round 18, CPU7 needs QB, Player C is best QB' },
    { team: 'CPU7', player: 'Player D', bestAtPos: 0, round: 19, desc: 'Round 19, CPU7 needs WR, Player D is best WR' },
    { team: 'CPU7', player: 'Player D', bestAtPos: 0, round: 20, desc: 'Round 20, CPU7 needs WR, Player D is best WR' },
    { team: 'CPU8', player: 'Player D', bestAtPos: 15, round: 20, desc: 'Round 20, CPU8 has good WR, Player D is best WR' }
  ];

  scenarios.forEach(scenario => {
    const player = roundPlayers.find(p => p.name === scenario.player);
    const bids = [];

    // Run multiple tests to see probabilistic activation
    for (let i = 0; i < 20; i++) { // More tests for better probability sampling
      const bid = testDomination(scenario.team, player, scenario.bestAtPos, scenario.round);
      bids.push(bid || 'normal');
    }

    const dominationBids = bids.filter(b => b !== 'normal');
    const avgDominationBid = dominationBids.length > 0 ?
      Math.round(dominationBids.reduce((a, b) => a + b, 0) / dominationBids.length) : null;

    console.log(`${scenario.team} in round ${scenario.round} on ${scenario.player}:`);
    console.log(`  ${dominationBids.length}/20 times used domination`);
    if (scenario.round >= 20) {
      console.log(`  Expected: ~20/20 (100%)`);
    } else if (scenario.round >= 19) {
      console.log(`  Expected: ~14/20 (70%)`);
    } else {
      console.log(`  Expected: ~6/20 (30%)`);
    }
    if (avgDominationBid) {
      console.log(`  Average domination bid: $${avgDominationBid} (${player.position === 'QB' ? 'QB conservative' : 'SP overbid'})`);
    }
    console.log(`  Reason: ${scenario.desc}`);
    console.log('');
  });
}

testBudgetDomination();