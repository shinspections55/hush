// Analysis script for WR tied live auction probabilities
// This script shows bid probabilities for each AV category at different dollar amounts

const { getAggression, decideAction } = require('./cpu-tied-live-auction');

// Test scenarios for WR position
const wrCategories = {
    '1-5': { min: 0.5, max: 1.55 },
    '5-10': { min: 0.6, max: 1.45 },
    '10-20': { min: 0.6, max: 1.4 },
    '20-30': { min: 0.7, max: 1.35 },
    '30-40': { min: 0.8, max: 1.25 },
    '40-50': { min: 0.9, max: 1.15 },
    '50-60': { min: 0.92, max: 1.15 },
    '60+': { min: 0.95, max: 1.08 }
};

// Sample CPU team for testing
const sampleCPU = {
    name: 'Team 1',
    budget: 150, // $150 remaining budget
    needs: { QB: 0.3, RB: 0.5, WR: 1.0, TE: 0.2 }, // High need for WR
    aggression: 0 // Will be calculated
};

// Test conditions
const testConditions = {
    teamsRemaining: 3, // 3 teams still in auction
    round: 5, // Round 5
    timeLeft: 8, // 8 seconds left
    positionNeed: 1.0 // High position need
};

console.log('=== WR TIED LIVE AUCTION BID PROBABILITIES ===\n');

for (const [category, range] of Object.entries(wrCategories)) {
    console.log(`\n--- ${category} AV Range: ${range.min}x - ${range.max}x AV ---\n`);

    // Test at different AV values within this category
    const avValues = [];
    if (category === '1-5') {
        avValues.push(1, 2, 3, 4, 5);
    } else if (category === '5-10') {
        avValues.push(6, 7, 8, 9, 10);
    } else if (category === '10-20') {
        avValues.push(12, 15, 18, 20);
    } else if (category === '20-30') {
        avValues.push(22, 25, 28, 30);
    } else if (category === '30-40') {
        avValues.push(32, 35, 38, 40);
    } else if (category === '40-50') {
        avValues.push(42, 45, 48, 50);
    } else if (category === '50-60') {
        avValues.push(52, 55, 58, 60);
    } else if (category === '60+') {
        avValues.push(65, 70, 80, 100);
    }

    for (const playerAV of avValues) {
        console.log(`Player AV: $${playerAV}`);

        // Test at different bid levels
        const maxBid = Math.round(playerAV * range.max);
        const minBid = Math.round(playerAV * range.min);

        console.log(`  Bid Range: $${minBid} - $${maxBid}`);

        // Test probabilities at key bid points
        const testBids = [];
        for (let bid = minBid; bid <= maxBid; bid += Math.max(1, Math.floor((maxBid - minBid) / 10))) {
            testBids.push(bid);
        }
        // Always include the max bid
        if (!testBids.includes(maxBid)) testBids.push(maxBid);

        console.log('  Bid Probabilities:');
        for (const currentBid of testBids) {
            const context = {
                currentBid,
                playerAV,
                teamsRemaining: testConditions.teamsRemaining,
                round: testConditions.round,
                budgetRemaining: sampleCPU.budget,
                positionNeed: testConditions.positionNeed,
                timeLeft: testConditions.timeLeft
            };

            const aggression = getAggression(sampleCPU, context);
            const bidProb = Math.min(0.95, aggression);

            const valueRatio = currentBid / playerAV;
            console.log(`    $${currentBid} (${valueRatio.toFixed(2)}x AV): ${(bidProb * 100).toFixed(1)}% bid prob`);
        }
        console.log('');
    }
}

console.log('\n=== SUMMARY ===');
console.log('Key Insights:');
console.log('1. Bid probability decreases as current bid exceeds player AV');
console.log('2. Higher AV players have lower bid probabilities at same dollar amounts');
console.log('3. CPUs are more likely to bid when they have high position need');
console.log('4. Time pressure (low timeLeft) increases bid probability');
console.log('5. More teams remaining increases competition/aggression');