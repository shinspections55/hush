// Test conservative CPU late-round bidding on high-value players
const CPU_AGGRESSIVENESS_BASE = 0.6;
const EARLY_DRAFT_MULTIPLIER = 1.1;
const LATE_DRAFT_MULTIPLIER = 0.9;

const cpuPersonalities = {
  'CPU1': { baseMultiplier: 1.4, earlyBonus: 1.3, latePenalty: 0.85 },
  'CPU2': { baseMultiplier: 1.2, earlyBonus: 1.2, latePenalty: 0.9 },
  'CPU3': { baseMultiplier: 1.1, earlyBonus: 1.15, latePenalty: 0.95 },
  'CPU4': { baseMultiplier: 1.0, earlyBonus: 1.1, latePenalty: 0.95 },
  'CPU5': { baseMultiplier: 0.9, earlyBonus: 1.05, latePenalty: 0.97 },
  'CPU6': { baseMultiplier: 0.8, earlyBonus: 1.0, latePenalty: 0.98 },
  'CPU7': { baseMultiplier: 0.6, earlyBonus: 0.75, latePenalty: 1.5 },
  'CPU8': { baseMultiplier: 0.5, earlyBonus: 0.65, latePenalty: 1.7 },
  'CPU9': { baseMultiplier: 0.4, earlyBonus: 0.55, latePenalty: 1.8 },
  'CPU10': { baseMultiplier: 0.3, earlyBonus: 0.45, latePenalty: 2.0 }
};

function calculateAggressiveness(teamName, roundNumber) {
  const personality = cpuPersonalities[teamName] || { baseMultiplier: 1.0, earlyBonus: 1.0, latePenalty: 1.0 };
  const draftProgress = roundNumber / 20;
  let roundMultiplier = 1.0;

  if (draftProgress < 0.3) {
    roundMultiplier = personality.earlyBonus;
  } else if (draftProgress > 0.7) {
    roundMultiplier = personality.latePenalty;
  }

  return CPU_AGGRESSIVENESS_BASE * personality.baseMultiplier * roundMultiplier;
}

// Simulate bidding on a high-value player (20 points) in late round
function simulateLateRoundBid(playerValue, cpuName) {
  const round = 18; // Late round (90% progress)
  let aggressiveness = calculateAggressiveness(cpuName, round);
  
  // Base bid calculation (simplified)
  const rangeKey = playerValue <= 20 ? '10-20' : '20-30';
  const bidRanges = {
    QB: { '10-20': { min: 0.6, max: 1.2 }, '20-30': { min: 0.7, max: 1.3 } },
    RB: { '10-20': { min: 0.6, max: 1.2 }, '20-30': { min: 0.7, max: 1.3 } },
    WR: { '10-20': { min: 0.6, max: 1.2 }, '20-30': { min: 0.7, max: 1.3 } },
    TE: { '10-20': { min: 0.6, max: 1.2 }, '20-30': { min: 0.7, max: 1.3 } }
  };
  
  let baseBid = playerValue * (bidRanges.QB[rangeKey].min + Math.random() * (bidRanges.QB[rangeKey].max - bidRanges.QB[rangeKey].min));
  
  // Conservative CPU late-round boost for high-value players
  const isConservativeCPU = ['CPU7', 'CPU8', 'CPU9', 'CPU10'].includes(cpuName);
  if (isConservativeCPU && playerValue >= 15) {
    baseBid *= 1.5; // 50% boost
    aggressiveness *= 1.5; // Additional aggressiveness boost
  }
  
  return Math.round(baseBid * aggressiveness);
}

console.log('Conservative CPU Late-Round Bidding Test');
console.log('=========================================');
console.log('Testing bids on 20-point QB in Round 18 (late draft)');
console.log('Conservative CPUs get 30% boost on high-value players');
console.log('');

['CPU1', 'CPU4', 'CPU7', 'CPU8', 'CPU9', 'CPU10'].forEach(cpu => {
  const bids = [];
  for (let i = 0; i < 5; i++) {
    bids.push(simulateLateRoundBid(20, cpu));
  }
  const avgBid = Math.round(bids.reduce((a, b) => a + b, 0) / bids.length);
  console.log(`${cpu}: ${bids.join(', ')} (avg: $${avgBid})`);
});

console.log('');
console.log('Expected Results:');
console.log('- CPU7-CPU10 should bid competitively ($15-25 range)');
console.log('- They should not be priced out of good late-round players');