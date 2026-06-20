// CPU Silent Auction Logic
// Contains functions for generating CPU bids in silent auction rounds

// Bid ranges for silent auctions (adapted from silentdraft.js)
const silentAuctionBidRanges = {
    QB: {
        '1-5': { min: 0.65, max: 1.65 },
        '5-10': { min: 0.7, max: 1.45 },
        '10-20': { min: 0.75, max: 1.45 },
        '20-30': { min: 0.8, max: 1.35 },
        '30-40': { min: 0.85, max: 1.25 },
    },
    RB: {
        '1-5': { min: 0.65, max: 1.65 },
        '5-10': { min: 0.70, max: 1.65 },
        '10-20': { min: 0.75, max: 1.55 },
        '20-30': { min: 0.75, max: 1.45},
        '30-40': { min: 0.75, max: 1.35 },
        '40-50': { min: 0.75, max: 1.25 },
        '50-60': { min: 0.75, max: 1.15 },
        '60+': { min: 0.75, max: 1.10 }
    },
    WR: {
        '1-5': { min: 0.65, max: 1.65 },
        '5-10': { min: 0.70, max: 1.65 },
        '10-20': { min: 0.75, max: 1.55 },
        '20-30': { min: 0.75, max: 1.45 },
        '30-40': { min: 0.75, max: 1.35 },
        '40-50': { min: 0.75, max: 1.25},
        '50-60': { min: 0.75, max: 1.15 },
        '60+': { min: 0.75, max: 1.10 }
    },
    TE: {
        '1-5': { min: 0.65, max: 1.4 },
        '5-10': { min: 0.65, max: 1.3 },
        '10-20': { min: 0.70, max: 1.2 },
        '20-30': { min: 0.70, max: 1.15 },
        '30-40': { min: 0.70, max: 1.1},
    }
};

// Bid ranges for server-side silent auctions (adapted from server.js)
const serverSilentAuctionBidRanges = {
    QB: {
        '1-5': { min: 0.4, max: 1.65 },
        '5-10': { min: 0.5, max: 1.45 },
        '10-20': { min: 0.55, max: 1.35 },
        '20-30': { min: 0.6, max: 1.30 },
        '30-40': { min: 0.85, max: 1.15 }
    },
    RB: {
        '1-5': { min: 0.5, max: 1.55 },
        '5-10': { min: 0.6, max: 1.45 },
        '10-20': { min: 0.6, max: 1.4 },
        '20-30': { min: 0.7, max: 1.35 },
        '30-40': { min: 0.8, max: 1.25 },
        '40-50': { min: 0.9, max: 1.15 },
        '50-60': { min: 0.92, max: 1.15 },
        '60+': { min: 0.95, max: 1.08 }
    },
    WR: {
        '1-5': { min: 0.5, max: 1.55 },
        '5-10': { min: 0.6, max: 1.45 },
        '10-20': { min: 0.6, max: 1.4 },
        '20-30': { min: 0.7, max: 1.35 },
        '30-40': { min: 0.8, max: 1.25 },
        '40-50': { min: 0.9, max: 1.15 },
        '50-60': { min: 0.92, max: 1.15 },
        '60+': { min: 0.95, max: 1.08 }
    },
    TE: {
        '1-5': { min: 0.5, max: 1.55 },
        '5-10': { min: 0.6, max: 1.45 },
        '10-20': { min: 0.6, max: 1.4 },
        '20-30': { min: 0.7, max: 1.35 },
        '30-40': { min: 0.8, max: 1.25 },
        '40-50': { min: 0.9, max: 1.15 },
        '50-60': { min: 0.92, max: 1.15 },
        '60+': { min: 0.95, max: 1.08 }
    }
};

// Helper function to get bid range key
function getRangeKey(avgValue) {
    if (avgValue <= 5) return '1-5';
    if (avgValue <= 10) return '5-10';
    if (avgValue <= 20) return '10-20';
    if (avgValue <= 30) return '20-30';
    if (avgValue <= 40) return '30-40';
    if (avgValue <= 50) return '40-50';
    if (avgValue <= 60) return '50-60';
    return '60+';
}

// Helper function to get bid range for a position and value
function getBidRange(position, avgValue, useServerRanges = false) {
    const ranges = useServerRanges ? serverSilentAuctionBidRanges : silentAuctionBidRanges;
    const rangeKey = getRangeKey(avgValue);
    return ranges[position]?.[rangeKey] || { min: 0.5, max: 1.5 };
}

function isValidRosterAddition(team, player, rosterLimits = null, maxRosterSize = null) {
  return true;
}

const defaultRosterTargets = {
  QB: 2,
  RB: 5,
  WR: 6,
  TE: 2,
  K: 1,
  DEF: 1
};

const draftRoundCount = 10;
const minimumCompletedRosterSize = 14;
const CPU_STAR_TARGET_MIN = 4;
const CPU_STAR_TARGET_MAX = 6;
const CPU_STAR_OVERLAP_MIN = 0.12;
const CPU_STAR_OVERLAP_MAX = 0.22;
const CPU_STAR_POOL_SIZE = 50;
const starterMinimumDefaults = {
  QB: 1,
  RB: 2,
  WR: 2,
  TE: 1,
  K: 1,
  DEF: 1
};

function getMaxRosterSize(rosterSize) {
  const baseRosterSize = Math.max(1, Number(rosterSize) || minimumCompletedRosterSize);
  // Keep a small cutdown cushion above configured roster size.
  return baseRosterSize + 2;
}

function getTargetRosterSize(rosterSize, maxRosterSize) {
  const baseRosterSize = Math.max(1, Number(rosterSize) || minimumCompletedRosterSize);
  // Target is the configured starters + bench total from lobby/server.
  return Math.min(maxRosterSize, baseRosterSize);
}

function getRosterPositionCounts(team) {
  return (team.roster || []).reduce((counts, rosterPlayer) => {
    counts[rosterPlayer.position] = (counts[rosterPlayer.position] || 0) + 1;
    return counts;
  }, {});
}

function getOpenSlots(team, maxRosterSize) {
  return Math.max(0, maxRosterSize - ((team.roster || []).length || 0));
}

function getEffectiveBudget(team, totalBudgetCommitted = 0, maxRosterSize = 19) {
  const openSlots = getOpenSlots(team, maxRosterSize);
  const reserve = openSlots;
  return Math.max(0, team.budget - totalBudgetCommitted - reserve);
}

function getBidBudgetForTeam(team, totalBudgetCommitted = 0, maxRosterSize = 19, bypassReserve = false) {
  if (bypassReserve) {
    return Math.max(0, (team?.budget || 0) - totalBudgetCommitted);
  }
  return getEffectiveBudget(team, totalBudgetCommitted, maxRosterSize);
}

function getTeamSeed(teamName) {
  return String(teamName || '').split('').reduce((seed, char) => seed + char.charCodeAt(0), 0);
}

function getTeamPersonality(teamName) {
  const profiles = [
    { aggression: 1.15, valueHunter: 0.92, sleeperHunter: 0.95, starsAndScrubs: 1.18, QB: 0.95, RB: 1.15, WR: 1.0, TE: 0.95, K: 0.85, DEF: 0.9 },
    { aggression: 0.94, valueHunter: 1.15, sleeperHunter: 1.12, starsAndScrubs: 0.9, QB: 1.0, RB: 0.95, WR: 1.08, TE: 1.0, K: 0.95, DEF: 0.95 },
    { aggression: 1.02, valueHunter: 1.0, sleeperHunter: 1.25, starsAndScrubs: 0.96, QB: 0.92, RB: 1.0, WR: 1.15, TE: 1.08, K: 0.95, DEF: 0.9 },
    { aggression: 1.08, valueHunter: 0.98, sleeperHunter: 1.0, starsAndScrubs: 1.08, QB: 1.08, RB: 0.94, WR: 1.0, TE: 1.12, K: 0.9, DEF: 1.0 },
    { aggression: 0.9, valueHunter: 1.18, sleeperHunter: 1.08, starsAndScrubs: 0.88, QB: 1.0, RB: 1.05, WR: 0.96, TE: 1.0, K: 1.0, DEF: 1.05 }
  ];
  const profile = profiles[getTeamSeed(teamName) % profiles.length];
  return { ...profile };
}

function getPositionTarget(position, rosterLimits = {}) {
  const limit = rosterLimits[position] || {};
  const defaultTarget = defaultRosterTargets[position] || limit.max || 1;
  if (typeof limit.max === 'number') {
    return Math.max(limit.min || 0, Math.min(defaultTarget, limit.max));
  }
  return defaultTarget;
}

function getPositionMinimum(position, rosterLimits = {}) {
  const limit = rosterLimits[position] || {};
  if (typeof limit.min === 'number') {
    return Math.max(0, limit.min);
  }
  return starterMinimumDefaults[position] || 0;
}

function getMissingStarterCounts(team, rosterLimits = {}) {
  const counts = getRosterPositionCounts(team);
  const positions = new Set([
    ...Object.keys(starterMinimumDefaults),
    ...Object.keys(rosterLimits || {})
  ]);

  const missingByPosition = {};
  let totalMissing = 0;

  positions.forEach(position => {
    const minimum = getPositionMinimum(position, rosterLimits);
    if (minimum <= 0) return;
    const current = counts[position] || 0;
    const missing = Math.max(0, minimum - current);
    if (missing > 0) {
      missingByPosition[position] = missing;
      totalMissing += missing;
    }
  });

  return { missingByPosition, totalMissing };
}

function getBenchPositionCounts(team, rosterLimits = {}) {
  const counts = getRosterPositionCounts(team);
  const benchCounts = {};

  Object.keys(counts).forEach(position => {
    const minimum = getPositionMinimum(position, rosterLimits);
    benchCounts[position] = Math.max(0, (counts[position] || 0) - minimum);
  });

  return benchCounts;
}

function getUpgradeGap(team, player, rosterLimits = {}) {
  const roster = team?.roster || [];
  const starterCount = getPositionMinimum(player.position, rosterLimits);
  if (starterCount <= 0) return 0;

  const atPosition = roster
    .filter(rosterPlayer => rosterPlayer.position === player.position)
    .map(rosterPlayer => rosterPlayer.avgValue || 0)
    .sort((a, b) => b - a);

  if (atPosition.length < starterCount) {
    return Math.max(0, player.avgValue || 0);
  }

  const weakestStarter = atPosition[starterCount - 1] || 0;
  return (player.avgValue || 0) - weakestStarter;
}

function getPositionNeedMultiplier(team, position, rosterLimits = {}, maxRosterSize = 19) {
  const counts = getRosterPositionCounts(team);
  const current = counts[position] || 0;
  const target = getPositionTarget(position, rosterLimits);
  const minimum = getPositionMinimum(position, rosterLimits);
  const maxForPosition = rosterLimits[position]?.max;
  const openSlots = getOpenSlots(team, maxRosterSize);
  const { totalMissing } = getMissingStarterCounts(team, rosterLimits);

  if (current < minimum) {
    return 2.15 + Math.min(0.35, openSlots * 0.03);
  }

  if ((position === 'K' || position === 'DEF') && current >= minimum) {
    return 0.34;
  }

  if (totalMissing > 0 && current >= minimum) {
    return 0.72;
  }

  if (typeof maxForPosition === 'number' && current >= maxForPosition) {
    return 0.35;
  }
  if (current === 0) {
    return 1.8;
  }
  if (current < target) {
    return 1.25 + Math.min(0.25, openSlots * 0.02);
  }
  if (current === target) {
    return 1.0;
  }
  return 0.75;
}

function getStarterUrgencyMultiplier(team, player, strategy, rosterLimits = {}, maxRosterSize = 19) {
  const counts = getRosterPositionCounts(team);
  const currentAtPos = counts[player.position] || 0;
  const minimumAtPos = getPositionMinimum(player.position, rosterLimits);
  const openSlots = getOpenSlots(team, maxRosterSize);
  const roundsLeft = strategy?.roundsIncludingCurrent || draftRoundCount;
  const { missingByPosition, totalMissing } = getMissingStarterCounts(team, rosterLimits);

  if ((missingByPosition[player.position] || 0) > 0) {
    if (roundsLeft <= 2) return 3.0;
    if (roundsLeft <= 3) return 2.65;
    if (roundsLeft <= 5) return 2.15;
    return 1.5;
  }

  if ((player.position === 'K' || player.position === 'DEF') && currentAtPos >= minimumAtPos) {
    if (roundsLeft <= 4) return 0.2;
    return 0.35;
  }

  if (totalMissing > 0 && roundsLeft <= 4) {
    return 0.72;
  }

  if (openSlots <= 2 && player.avgValue >= 28) {
    return 0.9;
  }

  return 1.0;
}

function getBenchCompositionMultiplier(team, player, rosterLimits = {}) {
  const benchCounts = getBenchPositionCounts(team, rosterLimits);
  const benchRB = benchCounts.RB || 0;
  const benchWR = benchCounts.WR || 0;
  const benchTE = benchCounts.TE || 0;
  const benchQB = benchCounts.QB || 0;
  const benchK = benchCounts.K || 0;
  const benchDEF = benchCounts.DEF || 0;

  if (player.position === 'K') {
    return benchK > 0 ? 0.12 : 0.85;
  }
  if (player.position === 'DEF') {
    return benchDEF > 0 ? 0.12 : 0.88;
  }

  if (player.position === 'RB') {
    if (benchRB <= 1) return 1.25;
    if (benchRB >= 3) return 0.82;
  }
  if (player.position === 'WR') {
    if (benchWR <= 1) return 1.25;
    if (benchWR >= 3) return 0.82;
  }

  if (player.position === 'TE') {
    if (benchTE >= 1) return 0.8;
    if (benchRB + benchWR >= 4) return 1.08;
  }

  if (player.position === 'QB') {
    if (benchQB >= 1) return 0.76;
    if (benchRB + benchWR >= 4) return 1.06;
  }

  return 1.0;
}

function getUpgradeOpportunityMultiplier(team, player, strategy, rosterLimits = {}, maxRosterSize = 19, totalBudgetCommitted = 0) {
  const upgradeGap = getUpgradeGap(team, player, rosterLimits);
  if (upgradeGap <= 0) {
    return player.avgValue >= 30 ? 0.96 : 1.0;
  }

  const openSlots = Math.max(1, getOpenSlots(team, maxRosterSize));
  const effectiveBudget = getEffectiveBudget(team, totalBudgetCommitted, maxRosterSize);
  const budgetPerSlot = effectiveBudget / openSlots;
  const roundsLeft = strategy?.roundsIncludingCurrent || draftRoundCount;

  if (budgetPerSlot < 5 && upgradeGap < 10) {
    return 0.84;
  }

  let multiplier = 1.0;

  if (upgradeGap >= 5) multiplier += 0.08;
  if (upgradeGap >= 8) multiplier += 0.12;
  if (upgradeGap >= 12) multiplier += 0.16;

  if (roundsLeft <= 5 && budgetPerSlot >= 8) multiplier += 0.12;
  if (roundsLeft <= 4 && budgetPerSlot >= 11) multiplier += 0.12;
  if (roundsLeft <= 3 && budgetPerSlot >= 14) multiplier += 0.14;

  if ((player.position === 'RB' || player.position === 'WR') && upgradeGap >= 6) {
    multiplier += 0.08;
  }

  if (openSlots <= 3 && upgradeGap >= 7) {
    multiplier += 0.06;
  }

  return Math.min(1.65, multiplier);
}

function getScarcityMultiplier(player, remainingPlayers) {
  const availableAtPosition = remainingPlayers.filter(candidate => !candidate.owner && candidate.position === player.position);
  const betterOrEqualOptions = availableAtPosition.filter(candidate => candidate.avgValue >= player.avgValue).length;

  if (betterOrEqualOptions <= 2) return 1.18;
  if (betterOrEqualOptions <= 5) return 1.1;
  if (availableAtPosition.length <= 8) return 1.06;
  if (player.avgValue <= 10 && availableAtPosition.length >= 15) return 0.94;
  return 1.0;
}

function getDepthMultiplier(team, player, rosterLimits = {}, maxRosterSize = 19) {
  const counts = getRosterPositionCounts(team);
  const current = counts[player.position] || 0;
  const target = getPositionTarget(player.position, rosterLimits);
  const openSlots = getOpenSlots(team, maxRosterSize);

  if (player.avgValue <= 8 && current < target && openSlots >= 4) {
    return 1.18;
  }
  if (player.avgValue <= 8 && (team.roster || []).length >= Math.max(0, maxRosterSize - 7)) {
    return 1.28;
  }
  if (player.avgValue >= 40 && current >= target && openSlots >= 6) {
    return 0.88;
  }
  return 1.0;
}

function getBudgetDisciplineMultiplier(team, totalBudgetCommitted = 0, maxRosterSize = 19) {
  const effectiveBudget = getEffectiveBudget(team, totalBudgetCommitted, maxRosterSize);
  const openSlots = Math.max(1, getOpenSlots(team, maxRosterSize));
  const budgetPerSlot = effectiveBudget / openSlots;

  if (effectiveBudget <= 0) return 0;
  if (budgetPerSlot < 3) return 0.72;
  if (budgetPerSlot < 6) return 0.88;
  if (budgetPerSlot > 18) return 1.08;
  return 1.0;
}

function getRosterCompletionMultiplier(team, player, maxRosterSize = 19) {
  const openSlots = getOpenSlots(team, maxRosterSize);
  let multiplier = 1;

  if (player.avgValue <= 8) {
    multiplier += openSlots * 0.04;
  }
  if ((team.roster || []).length >= 12 && player.avgValue <= 8) {
    multiplier *= 1.2;
  }
  if (openSlots <= 2 && player.avgValue >= 35) {
    multiplier *= 0.82;
  }

  return multiplier;
}

function getPersonalityMultiplier(player, strategy) {
  const personality = strategy?.personality || getTeamPersonality(strategy?.teamName);
  let multiplier = (personality[player.position] || 1) * (personality.valueHunter || 1);

  if (player.avgValue >= 45) {
    multiplier *= personality.starsAndScrubs || 1;
  }
  if (player.avgValue <= 10) {
    multiplier *= personality.sleeperHunter || 1;
  }

  return multiplier;
}

function calculatePlayerValueForTeam(team, player, context) {
  const {
    remainingPlayers = [],
    rosterLimits = {},
    maxRosterSize = 19,
    strategy = null,
    totalBudgetCommitted = 0
  } = context;

  let value = player.avgValue;
  value *= getPositionNeedMultiplier(team, player.position, rosterLimits, maxRosterSize);
  value *= getScarcityMultiplier(player, remainingPlayers);
  value *= getDepthMultiplier(team, player, rosterLimits, maxRosterSize);
  value *= getStarterUrgencyMultiplier(team, player, strategy, rosterLimits, maxRosterSize);
  value *= getBenchCompositionMultiplier(team, player, rosterLimits);
  value *= getUpgradeOpportunityMultiplier(team, player, strategy, rosterLimits, maxRosterSize, totalBudgetCommitted);
  value *= getBudgetDisciplineMultiplier(team, totalBudgetCommitted, maxRosterSize);
  value *= getRosterCompletionMultiplier(team, player, maxRosterSize);
  value *= getPersonalityMultiplier(player, strategy);

  if (player.avgValue <= 8 && (team.roster || []).length >= Math.max(0, maxRosterSize - 7)) {
    value *= 1.15;
  }
  if (player.avgValue >= 45 && getOpenSlots(team, maxRosterSize) >= 6) {
    value *= 0.9;
  }

  return Math.max(0, value);
}

function weightedRandomSample(items, sampleSize, getWeight) {
  const pool = [...items];
  const result = [];
  const targetSize = Math.min(sampleSize, pool.length);

  while (result.length < targetSize && pool.length > 0) {
    const weights = pool.map(item => Math.max(0.01, getWeight(item)));
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    let random = Math.random() * totalWeight;
    let selectedIndex = 0;

    for (let index = 0; index < pool.length; index++) {
      random -= weights[index];
      if (random <= 0) {
        selectedIndex = index;
        break;
      }
    }

    result.push(pool[selectedIndex]);
    pool.splice(selectedIndex, 1);
  }

  return result;
}

function stableHash(value) {
  const text = String(value || '');
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getTeamPlayerNoise(teamName, playerId, roundNumber) {
  const hash = stableHash(`${teamName}|${playerId}|${roundNumber}`) % 1000;
  return hash / 999;
}

function getProactivePriorityFloor(roundNumber) {
  const round = Math.max(1, Math.min(draftRoundCount, Number(roundNumber) || 1));
  const progress = (round - 1) / Math.max(1, draftRoundCount - 1);
  // Non-linear ramp: stronger than linear early/mid, with clear late-round urgency peak.
  const curvedProgress = Math.pow(progress, 0.62);
  const minFloor = 1.48;
  const maxFloor = 2.22;
  return minFloor + ((maxFloor - minFloor) * curvedProgress);
}

function getPlayerIdKey(playerOrId) {
  const raw = typeof playerOrId === 'object' ? playerOrId?.id : playerOrId;
  if (raw === null || typeof raw === 'undefined') return '';
  return String(raw);
}

function getTopCpuStarPool(allPlayers = [], poolSize = CPU_STAR_POOL_SIZE) {
  return [...(allPlayers || [])]
    .filter(player => player && typeof player.avgValue === 'number')
    .sort((a, b) => (b.avgValue || 0) - (a.avgValue || 0))
    .slice(0, Math.max(1, poolSize));
}

function shuffledCopy(items) {
  const out = [...(items || [])];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function rollCpuStarOverlapChance() {
  const min = Math.max(0, CPU_STAR_OVERLAP_MIN);
  const max = Math.max(min, CPU_STAR_OVERLAP_MAX);
  return min + (Math.random() * (max - min));
}

function initializeCpuStarTargets(cpuTeams, allPlayers, options = {}) {
  const topPool = getTopCpuStarPool(allPlayers, CPU_STAR_POOL_SIZE);
  const topPoolIds = topPool.map(player => getPlayerIdKey(player)).filter(Boolean);
  const assignedByTeam = {};
  const forceRebuild = !!options.forceRebuild;
  const overlapChance = typeof options.overlapChance === 'number'
    ? options.overlapChance
    : rollCpuStarOverlapChance();

  const assignmentOrder = shuffledCopy(cpuTeams || []);

  assignmentOrder.forEach(team => {
    const teamName = String(team?.name || '');
    if (!teamName) return;

    const existing = !forceRebuild && Array.isArray(team.__cpuStarTargetIds)
      ? team.__cpuStarTargetIds.map(getPlayerIdKey).filter(Boolean)
      : null;

    if (existing && existing.length > 0) {
      assignedByTeam[teamName] = new Set(existing);
      return;
    }

    const targetCount = CPU_STAR_TARGET_MIN + Math.floor(Math.random() * (CPU_STAR_TARGET_MAX - CPU_STAR_TARGET_MIN + 1));
    const chosen = [];
    const chosenSet = new Set();

    const sharedCandidates = Object.values(assignedByTeam).flatMap(set => [...set]);

    while (chosen.length < targetCount) {
      let pickedId = '';

      if (sharedCandidates.length > 0 && Math.random() < overlapChance) {
        const overlapId = sharedCandidates[Math.floor(Math.random() * sharedCandidates.length)];
        if (overlapId && !chosenSet.has(overlapId)) {
          pickedId = overlapId;
        }
      }

      if (!pickedId) {
        const freshPool = topPoolIds.filter(id => id && !chosenSet.has(id));
        if (freshPool.length === 0) break;
        pickedId = freshPool[Math.floor(Math.random() * freshPool.length)];
      }

      if (!pickedId) break;
      chosen.push(pickedId);
      chosenSet.add(pickedId);
    }

    team.__cpuStarTargetIds = chosen;
    assignedByTeam[teamName] = new Set(chosen);
  });

  return {
    assignedByTeam,
    overlapChance
  };
}

function getCpuStarTargetState(starTargetIds, allPlayers, roundPlayers) {
  const starIds = starTargetIds instanceof Set ? starTargetIds : new Set();
  const allById = new Map((allPlayers || []).map(player => [getPlayerIdKey(player), player]));

  const roundAvailableIds = new Set(
    (roundPlayers || [])
      .filter(player => player && !player.owner)
      .map(player => getPlayerIdKey(player))
      .filter(Boolean)
  );

  const pending = [];
  starIds.forEach(playerId => {
    const player = allById.get(playerId);
    if (!player || player.owner) return;
    pending.push(player);
  });

  const availableNowIds = new Set(
    pending
      .filter(player => roundAvailableIds.has(getPlayerIdKey(player)))
      .map(player => getPlayerIdKey(player))
      .filter(Boolean)
  );

  const unavailablePositions = new Set(
    pending
      .filter(player => !availableNowIds.has(getPlayerIdKey(player)))
      .map(player => player.position)
      .filter(Boolean)
  );

  return {
    pendingCount: pending.length,
    availableNowIds,
    unavailablePositions
  };
}

function selectCpuTargetsForTeam(availablePlayers, maxBids, teamName, roundNumber, playerExposureCounts) {
  const pool = (availablePlayers || []).slice(0, Math.min(14, availablePlayers.length));
  if (pool.length === 0 || maxBids <= 0) {
    return [];
  }

  const sampled = weightedRandomSample(
    pool,
    Math.min(maxBids, pool.length),
    entry => {
      const playerId = entry?.player?.id;
      const exposureCount = playerExposureCounts[playerId] || 0;
      const exposurePenalty = 1 / (1 + (exposureCount * 0.55));
      const noise = 0.9 + (getTeamPlayerNoise(teamName, playerId, roundNumber) * 0.25);
      return Math.max(0.01, entry.selectionWeight * exposurePenalty * noise);
    }
  );

  return sampled.sort((a, b) => b.selectionWeight - a.selectionWeight);
}

function enforcePositionCoverage(selectedPlayers, availablePlayers, requiredPositions, maxBids) {
  const required = (requiredPositions || []).filter(Boolean);
  if (required.length === 0) {
    return selectedPlayers || [];
  }

  const finalSelection = [...(selectedPlayers || [])];
  const selectedIds = new Set(finalSelection.map(entry => entry?.player?.id).filter(Boolean));
  const selectedPositions = new Set(finalSelection.map(entry => entry?.player?.position).filter(Boolean));

  required.forEach(position => {
    if (selectedPositions.has(position)) {
      return;
    }

    const fallback = (availablePlayers || []).find(entry => {
      const playerId = entry?.player?.id;
      return entry?.player?.position === position && playerId && !selectedIds.has(playerId);
    });

    if (!fallback) {
      return;
    }

    if (finalSelection.length < maxBids) {
      finalSelection.push(fallback);
      selectedIds.add(fallback.player.id);
      selectedPositions.add(position);
      return;
    }

    // Replace the lowest-weight non-required slot to guarantee one target per required position.
    let replacementIndex = -1;
    let lowestWeight = Infinity;

    for (let i = 0; i < finalSelection.length; i++) {
      const candidate = finalSelection[i];
      const candidatePos = candidate?.player?.position;
      const candidateWeight = candidate?.selectionWeight || 0;
      if (required.includes(candidatePos)) continue;
      if (candidateWeight < lowestWeight) {
        lowestWeight = candidateWeight;
        replacementIndex = i;
      }
    }

    if (replacementIndex >= 0) {
      finalSelection[replacementIndex] = fallback;
      selectedIds.add(fallback.player.id);
      selectedPositions.add(position);
    }
  });

  return dedupePlayerEntriesByBestWeight(finalSelection)
    .sort((a, b) => (b.selectionWeight || 0) - (a.selectionWeight || 0))
    .slice(0, maxBids);
}

function enforceStarTargetCoverage(selectedPlayers, availablePlayers, starTargetIds, maxBids) {
  const starIds = starTargetIds instanceof Set ? starTargetIds : new Set();
  if (!starIds.size) {
    return selectedPlayers || [];
  }

  const finalSelection = [...(selectedPlayers || [])];
  const selectedIdSet = new Set(finalSelection.map(entry => getPlayerIdKey(entry?.player)).filter(Boolean));

  const availableStarEntries = (availablePlayers || [])
    .filter(entry => starIds.has(getPlayerIdKey(entry?.player)))
    .sort((a, b) => (b.selectionWeight || 0) - (a.selectionWeight || 0));

  availableStarEntries.forEach(starEntry => {
    const starId = getPlayerIdKey(starEntry?.player);
    if (!starId || selectedIdSet.has(starId)) return;

    if (finalSelection.length < maxBids) {
      finalSelection.push(starEntry);
      selectedIdSet.add(starId);
      return;
    }

    let replacementIndex = -1;
    let lowestWeight = Infinity;

    for (let i = 0; i < finalSelection.length; i++) {
      const candidate = finalSelection[i];
      const candidateId = getPlayerIdKey(candidate?.player);
      const candidateWeight = candidate?.selectionWeight || 0;
      if (starIds.has(candidateId)) continue;
      if (candidateWeight < lowestWeight) {
        lowestWeight = candidateWeight;
        replacementIndex = i;
      }
    }

    if (replacementIndex >= 0) {
      finalSelection[replacementIndex] = starEntry;
      selectedIdSet.add(starId);
    }
  });

  return dedupePlayerEntriesByBestWeight(finalSelection)
    .sort((a, b) => (b.selectionWeight || 0) - (a.selectionWeight || 0))
    .slice(0, maxBids);
}

function dedupePlayerEntriesByBestWeight(entries) {
  const bestByPlayerId = new Map();
  (entries || []).forEach(entry => {
    const playerId = entry?.player?.id;
    if (!playerId) return;
    const prev = bestByPlayerId.get(playerId);
    if (!prev || (entry.selectionWeight || 0) > (prev.selectionWeight || 0)) {
      bestByPlayerId.set(playerId, entry);
    }
  });
  return Array.from(bestByPlayerId.values());
}

function dedupeTeamBidsByHighest(teamBids) {
  const bestByPlayerId = new Map();
  (teamBids || []).forEach(bid => {
    const playerId = bid?.player?.id;
    if (!playerId) return;
    const prev = bestByPlayerId.get(playerId);
    if (!prev || (bid.cpuBid || 0) > (prev.cpuBid || 0)) {
      bestByPlayerId.set(playerId, bid);
    }
  });
  return Array.from(bestByPlayerId.values());
}

function enforceCpuTieRates(cpuBids, cpuTeams, roundPlayers) {
  const cpuBudgetByTeam = cpuTeams.reduce((acc, team) => {
    acc[team.name] = team.budget;
    return acc;
  }, {});

  const bidRefsByPlayer = {};

  Object.keys(cpuBids || {}).forEach(teamName => {
    (cpuBids[teamName] || []).forEach(bidRef => {
      const playerId = bidRef?.player?.id;
      if (!playerId) return;
      if (!bidRefsByPlayer[playerId]) bidRefsByPlayer[playerId] = [];
      bidRefsByPlayer[playerId].push({ teamName, bidRef });
    });
  });

  let twoWayObserved = 0;
  let threePlusObserved = 0;

  Object.keys(bidRefsByPlayer).forEach(playerId => {
    const refs = bidRefsByPlayer[playerId] || [];
    if (refs.length < 2) return;

    const maxBid = Math.max(...refs.map(ref => ref.bidRef.cpuBid), 0);
    if (maxBid <= 0) return;

    const topRefs = refs.filter(ref => ref.bidRef.cpuBid === maxBid);
    if (topRefs.length < 2) return;

    const isTwoWayTie = topRefs.length === 2;
    // 2-way: preserve ~80% of natural ties so the final observed rate lands ~10-12%
    // 3+: preserve only 2% — they should be rare
    const allowTieRate = isTwoWayTie ? 0.80 : 0.02;

    if (Math.random() <= allowTieRate) {
      if (isTwoWayTie) twoWayObserved++;
      else threePlusObserved++;
      return;
    }

    const winnerIndex = Math.floor(Math.random() * topRefs.length);
    const winner = topRefs[winnerIndex];
    const winnerBudget = cpuBudgetByTeam[winner.teamName] || winner.bidRef.cpuBid;

    let winnerBid = winner.bidRef.cpuBid;
    if (winnerBid <= 1 && winnerBid + 1 <= winnerBudget) {
      winnerBid += 1;
      winner.bidRef.cpuBid = winnerBid;
    }

    topRefs.forEach((ref, index) => {
      if (index === winnerIndex) return;
      if (winnerBid > 1) {
        ref.bidRef.cpuBid = Math.min(ref.bidRef.cpuBid, winnerBid - 1);
      }
    });
  });

  if (twoWayObserved > 0 || threePlusObserved > 0) {
    console.log(`[CPU TIES] Preserved ties this round -> two-way: ${twoWayObserved}, three-plus: ${threePlusObserved}`);
  }
}

function estimateTeamBid(team, player, strategy, context) {
  const maxRosterSize = context.maxRosterSize || 19;
  const trueValue = calculatePlayerValueForTeam(team, player, {
    ...context,
    strategy,
    totalBudgetCommitted: 0
  });
  const effectiveBudget = getEffectiveBudget(team, 0, maxRosterSize);
  if (effectiveBudget <= 0 || trueValue <= 0) {
    return 0;
  }

  let estimatedBid = Math.round(trueValue * (0.8 + ((strategy?.aggressiveness || 0.5) * 0.2)));
  if (player.avgValue <= 8 && strategy?.rosterSpotsLeft >= 4) {
    estimatedBid = Math.round(estimatedBid * 0.9);
  }
  return Math.max(1, Math.min(estimatedBid, effectiveBudget));
}

function softenEliteBid(player, bidAmount, strategy) {
  if (player.avgValue < 45) {
    return bidAmount;
  }

  const aggression = strategy?.aggressiveness || 0.5;
  const personality = strategy?.personality || getTeamPersonality(strategy?.teamName);
  const softAnchor = player.avgValue * (1.12 + aggression * 0.1 + ((personality.starsAndScrubs || 1) - 1) * 0.12);

  if (bidAmount <= softAnchor) {
    return bidAmount;
  }

  const excess = bidAmount - softAnchor;
  const retainedExcess = excess * 0.42;
  return Math.round(softAnchor + retainedExcess);
}

function applyLowCostBidShaping(player, bidAmount, strategy, bidRemainingBudget) {
  let shapedBid = bidAmount;
  const roundsLeft = strategy?.roundsIncludingCurrent || draftRoundCount;

  if (player.avgValue <= 4) {
    if (Math.random() < 0.7) {
      shapedBid = 1;
    } else {
      shapedBid = Math.min(shapedBid, 1 + Math.floor(Math.random() * 3)); // 1-3
    }
  } else if (player.avgValue <= 8) {
    if (Math.random() < 0.62) {
      shapedBid = 4 + Math.floor(Math.random() * 4); // 4-7
    } else if (Math.random() < 0.22) {
      shapedBid = 1 + Math.floor(Math.random() * 3); // occasional 1-3
    }
  }

  if (player.avgValue <= 10) {
    shapedBid = Math.round(shapedBid * (0.76 + Math.random() * 0.18));

    // Encourage more realistic cheap-end outcomes for depth and specialists.
    if (player.position === 'K' || player.position === 'DEF') {
      const cheapRoll = Math.random();
      if (cheapRoll < 0.72) {
        shapedBid = Math.min(shapedBid, 1 + Math.floor(Math.random() * 4)); // 1-4
        if (Math.random() < 0.34) {
          shapedBid = 1;
        }
      }

      // Missing starter K/DEF should still be affordable, not panic overbids.
      if ((strategy?.mustFillPositions || []).includes(player.position)) {
        const lateRoundCap = roundsLeft <= 2 ? 6 : 4;
        shapedBid = Math.min(shapedBid, lateRoundCap);
      }
    } else {
      if (Math.random() < 0.58) {
        shapedBid = Math.min(shapedBid, 1 + Math.floor(Math.random() * 4)); // 1-4
        if (Math.random() < 0.32) {
          shapedBid = 1;
        }
      }
    }
  }

  // Promote occasional cheap depth shots across the low/mid tier.
  if (player.avgValue <= 18 && !(strategy?.mustFillPositions || []).includes(player.position)) {
    if (Math.random() < 0.22) {
      shapedBid = 1;
    } else if (Math.random() < 0.28) {
      shapedBid = Math.min(shapedBid, 1 + Math.floor(Math.random() * 3)); // 1-3
    }
  }

  if (player.avgValue <= 25 && !(strategy?.mustFillPositions || []).includes(player.position) && Math.random() < 0.12) {
    shapedBid = 1;
  }

  return Math.max(1, Math.min(shapedBid, bidRemainingBudget));
}

function getSpreadSingleBidCap(team, player, strategy, bidRemainingBudget, maxRosterSize) {
  const openSlots = Math.max(1, getOpenSlots(team, maxRosterSize));
  const roundsIncludingCurrent = Math.max(1, strategy?.roundsIncludingCurrent || draftRoundCount);
  const mustFillPositions = strategy?.mustFillPositions || [];
  const missingStarterCount = strategy?.missingStarterCount || 0;
  const isMustFillPosition = mustFillPositions.includes(player.position);

  // Keep reserve dollars so one bid does not block filling the rest of the roster.
  let reserveForOthers = Math.max(0, openSlots - 1);
  if (roundsIncludingCurrent <= 2) {
    reserveForOthers = Math.max(0, openSlots - 2);
  }

  const spendableNow = Math.max(1, bidRemainingBudget - reserveForOthers);

  // Desired spread count is dynamic: more open slots -> more spread, fewer rounds -> slightly less spread.
  let desiredSpreadCount = Math.ceil(openSlots * 0.62);
  if (openSlots >= 8) desiredSpreadCount += 1;
  if (missingStarterCount > 0) desiredSpreadCount += 1;
  if (roundsIncludingCurrent <= 3) desiredSpreadCount -= 1;
  if (roundsIncludingCurrent <= 2) desiredSpreadCount -= 1;
  if (isMustFillPosition && roundsIncludingCurrent <= 3) desiredSpreadCount -= 1;

  desiredSpreadCount = Math.max(2, Math.min(8, desiredSpreadCount));

  let cap = Math.ceil(spendableNow / desiredSpreadCount);

  // Position and urgency tuning.
  if (player.position === 'K' || player.position === 'DEF') {
    cap = Math.min(cap, roundsIncludingCurrent <= 2 ? 7 : 6);
  } else {
    cap = Math.min(cap, isMustFillPosition ? 13 : 11);
  }

  if (isMustFillPosition && roundsIncludingCurrent <= 3) {
    cap += 2;
  }

  return Math.max(2, Math.min(cap, bidRemainingBudget));
}

function getDynamicBidBand(avgValue, roundNumber, strategy) {
  const isEarlyRound = roundNumber <= 3;
  const isMidRound = roundNumber >= 4 && roundNumber <= 7;

  if (avgValue >= 50) {
    if (isEarlyRound) return { minPct: 0.72, maxPct: 1.16, rareMaxPct: 1.24, rareChance: 0.03 };
    if (isMidRound) return { minPct: 0.68, maxPct: 1.19, rareMaxPct: 1.28, rareChance: 0.035 };
    return { minPct: 0.64, maxPct: 1.22, rareMaxPct: 1.33, rareChance: 0.045 };
  }

  if (avgValue >= 35) {
    if (isEarlyRound) return { minPct: 0.7, maxPct: 1.18, rareMaxPct: 1.27, rareChance: 0.035 };
    if (isMidRound) return { minPct: 0.66, maxPct: 1.22, rareMaxPct: 1.31, rareChance: 0.045 };
    return { minPct: 0.62, maxPct: 1.27, rareMaxPct: 1.36, rareChance: 0.055 };
  }

  if (avgValue >= 20) {
    if (isEarlyRound) return { minPct: 0.66, maxPct: 1.2, rareMaxPct: 1.31, rareChance: 0.06 };
    if (isMidRound) return { minPct: 0.62, maxPct: 1.25, rareMaxPct: 1.35, rareChance: 0.07 };
    return { minPct: 0.58, maxPct: 1.3, rareMaxPct: 1.4, rareChance: 0.08 };
  }

  // Lower-value players need wider practical variance due to small-dollar granularity.
  if (isEarlyRound) return { minPct: 0.55, maxPct: 1.35, rareMaxPct: 1.45, rareChance: 0.08 };
  if (isMidRound) return { minPct: 0.5, maxPct: 1.4, rareMaxPct: 1.55, rareChance: 0.1 };
  return { minPct: 0.45, maxPct: 1.5, rareMaxPct: 1.7, rareChance: 0.12 };
}

function clampBidToDynamicBand(player, bidAmount, roundNumber, strategy, bidRemainingBudget) {
  const band = getDynamicBidBand(player.avgValue, roundNumber, strategy);
  const expansionPct = 0.10 + (Math.random() * 0.10);
  const expandedMinPct = Math.max(0.25, band.minPct * (1 - expansionPct));
  const expandedMaxPct = band.maxPct * (1 + expansionPct);
  const expandedRareMaxPct = band.rareMaxPct * (1 + expansionPct);

  const baseFloor = Math.max(1, Math.round(player.avgValue * expandedMinPct));
  const baseCeiling = Math.max(baseFloor, Math.round(player.avgValue * expandedMaxPct));
  const rareCeiling = Math.max(baseCeiling, Math.round(player.avgValue * expandedRareMaxPct));
  const ceiling = Math.random() < band.rareChance ? rareCeiling : baseCeiling;

  return Math.max(1, Math.min(Math.max(baseFloor, bidAmount), ceiling, bidRemainingBudget));
}

function pullBidTowardAV(player, bidAmount, roundNumber) {
  if (player.avgValue < 20) {
    return bidAmount;
  }

  // Nudge toward a slightly under-AV anchor so winning prices skew below AV more often.
  const targetAnchor = player.avgValue * (roundNumber <= 3 ? 0.95 : roundNumber <= 7 ? 0.93 : 0.9);
  const avWeight = roundNumber <= 3 ? 0.16 : roundNumber <= 7 ? 0.13 : 0.1;
  return Math.round((targetAnchor * avWeight) + (bidAmount * (1 - avWeight)));
}

function applyAvRangeRandomness(player, bidAmount, roundNumber, bidRemainingBudget) {
  const av = Math.max(1, Number(player?.avgValue || 1));
  let lowPct = 0.52;
  let highPct = 1.3;

  if (av >= 50) {
    lowPct = 0.68;
    highPct = 1.2;
  } else if (av >= 35) {
    lowPct = 0.62;
    highPct = 1.24;
  } else if (av >= 20) {
    lowPct = 0.56;
    highPct = 1.28;
  }

  const low = Math.max(1, Math.round(av * lowPct));
  const high = Math.max(low, Math.round(av * highPct));
  const base = Math.max(low, Math.min(high, bidAmount));

  const underBidBias = Math.max(0.45, Math.min(0.82, 0.62 + (roundNumber >= 7 ? 0.08 : 0)));
  let sampled = base;

  if (Math.random() < underBidBias) {
    const pullDown = Math.random() * Math.random();
    sampled = low + Math.round((base - low) * pullDown);
  } else {
    const pushUp = Math.random();
    sampled = base + Math.round((high - base) * pushUp);
  }

  // Anti-cluster jitter: create more unique integer bids in the same AV band.
  const jitterMax = av >= 45 ? 4 : av >= 25 ? 3 : 2;
  const jitter = Math.floor(Math.random() * ((jitterMax * 2) + 1)) - jitterMax;
  sampled += jitter;

  return Math.max(1, Math.min(sampled, high, bidRemainingBudget));
}

function diversifyBidAgainstExisting(player, bidAmount, existingBidsByPlayer, bidRemainingBudget) {
  const playerId = getPlayerIdKey(player);
  const existing = existingBidsByPlayer[playerId] || [];
  if (existing.length === 0) {
    return Math.max(1, Math.min(bidAmount, bidRemainingBudget));
  }

  let diversifiedBid = bidAmount;
  const duplicateCount = existing.filter(amount => amount === diversifiedBid).length;
  const nearbyCount = existing.filter(amount => Math.abs(amount - diversifiedBid) <= 1).length;

  if (duplicateCount > 0 || nearbyCount >= 2) {
    const av = Math.max(1, Number(player?.avgValue || 1));
    const spread = av >= 55 ? 9 : av >= 40 ? 7 : av >= 25 ? 5 : 3;
    const direction = Math.random() < 0.68 ? -1 : 1; // favor slight underbids
    const jump = 1 + Math.floor(Math.random() * spread);
    diversifiedBid += (direction * jump);
  } else if (Math.random() < 0.2) {
    const micro = 1 + Math.floor(Math.random() * 2);
    diversifiedBid += (Math.random() < 0.65 ? -micro : micro);
  }

  return Math.max(1, Math.min(diversifiedBid, bidRemainingBudget));
}

// Client-side CPU bidding for silent auctions (from silentdraft.js)
function generateClientCPUBids(teams, roundPlayers, username, rosterSize, currentRound, totalRounds) {
    // --- Enhanced Independent CPU Bidding ---
    // Each CPU team independently decides which players to bid on, based on roster needs
    let maxRosterSize = rosterSize + 3;
    let cpuTeams = teams.filter(t => t.name !== username && t.roster.length < maxRosterSize);
    let cpuBids = {};
    // Assign each CPU team a random 'aggressiveness' factor for this round (lowered)
    let cpuAggressiveness = {};
    cpuTeams.forEach((team, idx) => {
      // Aggressiveness: 0.7 to 1.05 (less aggressive overall)
      let base = 0.7 + Math.random() * 0.35;
      // Decrease aggressiveness in first 3 rounds
      if (currentRound <= 3) base -= 0.13;
      cpuAggressiveness[team.name] = Math.max(0.55, base);
    });

    // Calculate bestByPos for each team
    cpuTeams.forEach((team, idx) => {
        let bestByPos = {};
        for (let pos of ['QB','RB','WR','TE','K','DEF']) {
            let playersAtPos = team.roster.filter(p => p.position === pos);
            if (playersAtPos.length > 0) {
                bestByPos[pos] = Math.max(...playersAtPos.map(p => p.avgValue));
            } else {
                bestByPos[pos] = 0;
            }
        }
        team.bestByPos = bestByPos;
    });

    // For each player
    roundPlayers.forEach(player => {
        if (player.owner) return;
        // Define probability ranges based on avgValue
        const valueRanges = [
            { min: 1, max: 5, minProb: 0.03, maxProb: 0.16 },
            { min: 5, max: 10, minProb: 0.05, maxProb: 0.16 },
            { min: 10, max: 20, minProb: 0.07, maxProb: 0.32 },
            { min: 20, max: 30, minProb: 0.22, maxProb: 0.42 },
            { min: 30, max: 40, minProb: 0.22, maxProb: 0.52 },
            { min: 40, max: 50, minProb: 0.22, maxProb: 0.62 },
            { min: 50, max: 60, minProb: 0.32, maxProb: 0.72 },
            { min: 60, max: Infinity, minProb: 0.36, maxProb: 0.82 }
        ];
        const range = valueRanges.find(r => player.avgValue >= r.min && player.avgValue < r.max) || valueRanges[valueRanges.length - 1];
        let participationRate = range.minProb + Math.random() * (range.maxProb - range.minProb);
        // Further decrease participation in first 3 rounds, EXCEPT for big names
        if (currentRound <= 3) {
          if (player.avgValue >= 40) {
            // For stars, keep high participation (no reduction)
            participationRate *= 1.08;
            participationRate = Math.max(participationRate, 0.22); // Ensure at least 22%
          } else {
            participationRate *= 0.62;
          }
        }
        let adjustedParticipationRate = participationRate;
        if (cpuTeams.length === 10 && currentRound % 2 === 1) {
          adjustedParticipationRate += Math.random() < 0.5 ? 0.03 : -0.05;
          adjustedParticipationRate = Math.max(0, Math.min(1, adjustedParticipationRate));
        }
        const numBidders = Math.round(adjustedParticipationRate * cpuTeams.length);
        const draftProgress = currentRound / totalRounds;
        // Collect potential bidders
        let potentialBidders = [];
        cpuTeams.forEach(team => {
            if (!isValidRosterAddition(team, player)) return;
            const bestByPos = team.bestByPos;
            let improve = player.avgValue - bestByPos[player.position];
            if (bestByPos[player.position] > 20 && player.avgValue < 20) improve -= 10;
            if (bestByPos[player.position] > 5 && player.avgValue < 3) improve -= 20;
            if (improve > 0) improve += 5;
            if (bestByPos[player.position] < 10) improve += 10;
            let avgOther = Object.keys(bestByPos).filter(pos => pos !== player.position).reduce((sum, pos) => sum + bestByPos[pos], 0) / 5;
            if (bestByPos[player.position] < avgOther - 10) improve += 5;
            if ((player.position === 'K' || player.position === 'DEF') && bestByPos[player.position] === 0) improve += 8;
            if (draftProgress < 0.55 ? bestByPos[player.position] === 0 : (improve > 0 || bestByPos[player.position] === 0)) {
                potentialBidders.push({team, improve});
            }
        });
        // Sort by improve desc
        potentialBidders.sort((a, b) => b.improve - a.improve);
        // Select top numBidders
        const selected = potentialBidders.slice(0, numBidders);
        // For each selected, calculate bid
        selected.forEach(({team}) => {
            const bestByPos = team.bestByPos;
            let baseBid;
            if (player.position === 'K' || player.position === 'DEF') {
              baseBid = player.avgValue * (0.65 + Math.random() * 0.22); // 65-87% for K/DEF (further reduced)
            } else {
              const bidRange = getBidRange(player.position, player.avgValue);
              // Further reduce the bid range for all positions
              const reducedMin = bidRange.min * 0.85;
              const reducedMax = bidRange.min + 0.55 * (bidRange.max - bidRange.min);
              baseBid = player.avgValue * (reducedMin + Math.random() * (reducedMax - reducedMin));
              // Add a hard cap: never bid more than 1.05x avgValue for any player
              baseBid = Math.min(baseBid, player.avgValue * 1.05);
            }
            // Special handling for very low value players
            if (player.avgValue <= 1) {
                baseBid = Math.random() < 0.75 ? 1 : (1 + Math.floor(Math.random() * 4)); // 75% chance $1, 25% chance $1-4
            }
            if (bestByPos[player.position] === 0) baseBid *= 1.2;
            let numCompetitors = teams.filter(t => t.name !== team.name && t.budget > team.budget && t.roster.filter(p => p.position === player.position).length === 0).length;
            baseBid += numCompetitors * 5;
            const improve = potentialBidders.find(pb => pb.team === team).improve;
            if (improve > 20) baseBid += 10;
            else if (improve > 10) baseBid += 5;
            else if (improve > 0) baseBid += 2;
            if (Math.random() < 0.15) baseBid = Math.min(baseBid, Math.floor(Math.random() * 5) + 1);
            baseBid = Math.round(baseBid * cpuAggressiveness[team.name]);
            baseBid += Math.floor(Math.random() * 2);
            baseBid += Math.floor(Math.random() * 2) * (Math.random() < 0.5 ? 1 : -1);
            // If roster is full, bid low for bench filling
            if (team.roster.length >= rosterSize) {
                baseBid = Math.floor(Math.random() * 3) + 1;
            }
            baseBid = Math.min(baseBid, team.budget);
            if (baseBid > 0) {
                if (!cpuBids[team.name]) cpuBids[team.name] = [];
                cpuBids[team.name].push({ player, cpuBid: baseBid });
            }
        });
    });

    // Log all CPU bids for debugging
    console.log('=== CPU BIDS FOR THIS ROUND ===');
    Object.keys(cpuBids).forEach(cpuName => {
        if (cpuBids[cpuName].length > 0) {
            console.log(`${cpuName}:`);
            cpuBids[cpuName].forEach(bid => {
                console.log(`  - ${bid.player.name} (${bid.player.position}): $${bid.cpuBid}`);
            });
        } else {
            console.log(`${cpuName}: No bids`);
        }
    });
    console.log('===============================');

    return cpuBids;
}

// Server-side CPU bidding for silent auctions (from server.js)
async function generateServerCPUBids(teams, roundPlayers, allPlayers, rosterSize, rosterLimits, humanMembers, roundNumber) {
  try {
    // Filter to only CPU teams (teams not controlled by human members).
    const maxRosterSize = getMaxRosterSize(rosterSize);
    const cpuTeams = teams.filter(t => !humanMembers.includes(t.name));
    const cpuBids = {};

    console.log(`[generateCPUBids] Human members: ${humanMembers.join(', ')}`);
    console.log(`[generateCPUBids] CPU teams: ${cpuTeams.map(t => t.name).join(', ')}`);

    const draftOverlapChance = rollCpuStarOverlapChance();
    const starTargetInit = initializeCpuStarTargets(cpuTeams, allPlayers, {
      overlapChance: draftOverlapChance,
      forceRebuild: Number(roundNumber) === 1
    });
    const cpuStarTargetsByTeam = starTargetInit.assignedByTeam || {};

    if (Number(roundNumber) === 1) {
      console.log(`[generateCPUBids] CPU star overlap rate this draft: ${(draftOverlapChance * 100).toFixed(1)}%`);
    }

    // Generate dynamic bidding strategies for each CPU team based on situation
    const teamStrategies = {};
    for (const team of cpuTeams) {
      // Calculate situational factors
      const currentRosterSize = team.roster ? team.roster.length : 0;
      const rosterSpotsLeft = maxRosterSize - currentRosterSize;
      const roundsLeft = draftRoundCount - roundNumber;
      const roundsIncludingCurrent = Math.max(1, roundsLeft + 1);
      const targetRosterSize = getTargetRosterSize(rosterSize, maxRosterSize);
      const playersNeededForMinimum = Math.max(0, targetRosterSize - currentRosterSize);
      const isBehindMinimumPace = playersNeededForMinimum > roundsIncludingCurrent;
      const isFinalRoundFill = roundNumber >= draftRoundCount && playersNeededForMinimum > 0;
      const budgetPerRound = roundsLeft > 0 ? team.budget / roundsLeft : team.budget;
      const isEarlyRound = roundNumber <= 3;
      const isLateRound = roundNumber >= 7;
      const isMidRound = roundNumber >= 4 && roundNumber <= 6;

      // Analyze current roster needs for position balance
      const currentRoster = team.roster || [];
      const positionCounts = currentRoster.reduce((counts, player) => {
        counts[player.position] = (counts[player.position] || 0) + 1;
        return counts;
      }, {});
      const { missingByPosition, totalMissing } = getMissingStarterCounts(team, rosterLimits);

      // Determine position priorities (what positions the team needs most)
      const positionPriorities = {};
      Object.keys(rosterLimits).forEach(pos => {
        const current = positionCounts[pos] || 0;
        const max = rosterLimits[pos].max;
        const min = rosterLimits[pos].min || 0;
        if (current < min) positionPriorities[pos] = 4; // Critical need
        else if (current < max) positionPriorities[pos] = 2; // Moderate need
        else positionPriorities[pos] = 1; // No immediate need
      });

      if ((positionCounts.K || 0) >= getPositionMinimum('K', rosterLimits)) {
        positionPriorities.K = Math.min(positionPriorities.K || 1, 1);
      }
      if ((positionCounts.DEF || 0) >= getPositionMinimum('DEF', rosterLimits)) {
        positionPriorities.DEF = Math.min(positionPriorities.DEF || 1, 1);
      }

      // --- ENHANCEMENT: Late round must-fill logic ---
      // In the last 3 rounds, build a list of must-fill positions (any required position not yet filled)
      let mustFillPositions = [];
      const shouldForceStarterFill = roundsIncludingCurrent <= 5 || isBehindMinimumPace || totalMissing >= roundsIncludingCurrent;
      if (isLateRound || roundsIncludingCurrent <= 3 || shouldForceStarterFill) {
        mustFillPositions = Object.keys(missingByPosition);
        // Always include K and DEF if not filled
        if ((positionCounts['K'] || 0) < (rosterLimits['K']?.min || 1)) mustFillPositions.push('K');
        if ((positionCounts['DEF'] || 0) < (rosterLimits['DEF']?.min || 1)) mustFillPositions.push('DEF');
        // Remove duplicates
        mustFillPositions = [...new Set(mustFillPositions)];
      }

      // Proactive starter-fill pressure runs all draft: keep missing starter slots in focus
      // until each team fills them, with urgency scaled later in the draft.
      let proactiveFillPositions = Object.keys(missingByPosition || {});
      proactiveFillPositions = [...new Set(proactiveFillPositions)];

      // --- ENHANCEMENT: Roster balance logic ---
      // If team is unbalanced (e.g., 8 WR, 2 RB), prioritize underrepresented positions
      let underrepresentedPositions = [];
      if (isLateRound || roundsIncludingCurrent <= 4 || shouldForceStarterFill) {
        const minRB = rosterLimits['RB']?.min || 2;
        const minWR = rosterLimits['WR']?.min || 2;
        if ((positionCounts['RB'] || 0) < minRB) underrepresentedPositions.push('RB');
        if ((positionCounts['WR'] || 0) < minWR) underrepresentedPositions.push('WR');
        // If team has 2 or fewer RB and 6+ WR, force RB priority
        if ((positionCounts['RB'] || 0) < 3 && (positionCounts['WR'] || 0) > 5) underrepresentedPositions.push('RB');
      }

      // Base aggressiveness influenced by budget and roster needs
      let baseAggressiveness = 0.5; // Default moderate

      // Budget-based adjustments
      if (team.budget > 150) baseAggressiveness += 0.2; // Rich team, more aggressive
      else if (team.budget < 50) baseAggressiveness -= 0.2; // Poor team, more conservative

      // Roster needs adjustments
      if (rosterSpotsLeft <= 3) baseAggressiveness += 0.15; // Desperate for players
      else if (rosterSpotsLeft >= 10) baseAggressiveness -= 0.1; // Can be picky
      if (playersNeededForMinimum > 0 && roundNumber >= 7) baseAggressiveness += 0.08;
      if (isBehindMinimumPace) baseAggressiveness += 0.18;
      if (isFinalRoundFill) baseAggressiveness += 0.22;
      if (totalMissing > 0 && roundsIncludingCurrent <= 5) baseAggressiveness += 0.14;

      // Round-based adjustments - more flexible, allow strategic early aggression
      if (isEarlyRound) {
        // Reduce early round aggressiveness to prevent overbidding
        baseAggressiveness -= 0.08; // Slight decrease for all CPUs in first 3 rounds
        // Rich teams can be aggressive early if they want to secure talent
        if (team.budget > 150 && rosterSpotsLeft <= 8) {
          baseAggressiveness += Math.random() * 0.32 - 0.1; // Slightly less aggressive than before
        } else {
          baseAggressiveness += Math.random() * 0.22 - 0.15; // Slightly less variance
        }
      } else if (isLateRound) {
        baseAggressiveness += Math.random() * 0.4 - 0.1; // Late round desperation
      } else if (isMidRound) {
        baseAggressiveness += Math.random() * 0.2 - 0.1; // Mid round stability
      }

      // Allow strategic early aggression for teams that can afford it
      if (isEarlyRound && team.budget > 120 && rosterSpotsLeft <= 10) {
        // 30% chance for rich teams to be extra aggressive early
        if (Math.random() < 0.3) {
          baseAggressiveness += 0.2; // Bonus aggression for strategic early moves
        }
      }

      // Teams with critical position needs can be aggressive regardless of round
      const criticalNeeds = Object.values(positionPriorities).filter(p => p === 3).length;
      if (criticalNeeds >= 2 && team.budget > 100) {
        baseAggressiveness += 0.15; // Teams with multiple critical needs can be aggressive
      }

      // Add some team-specific personality (consistent but with variance)
      const personalityVariance = (getTeamSeed(team.name) % 7 - 3) * 0.1; // -0.3 to +0.3
      baseAggressiveness += personalityVariance;

      // Add round-to-round unpredictability
      const roundVariance = (Math.random() - 0.5) * 0.3; // ±0.15 variance
      baseAggressiveness += roundVariance;
      baseAggressiveness = Math.max(0.1, Math.min(0.9, baseAggressiveness));

      const personality = getTeamPersonality(team.name);
      baseAggressiveness = Math.max(0.1, Math.min(0.95, baseAggressiveness * personality.aggression));

      const starredTargetIds = cpuStarTargetsByTeam[team.name] || new Set();
      const starTargetState = getCpuStarTargetState(starredTargetIds, allPlayers, roundPlayers);
      if (starTargetState.availableNowIds.size > 0) {
        baseAggressiveness = Math.min(0.97, baseAggressiveness + 0.05);
      }

      teamStrategies[team.name] = {
        aggressiveness: baseAggressiveness,
        budgetPerRound,
        rosterSpotsLeft,
        roundsLeft,
        roundsIncludingCurrent,
        targetRosterSize,
        playersNeededForMinimum,
        isBehindMinimumPace,
        mustFillRoster: isBehindMinimumPace || isFinalRoundFill,
        isDesperate: rosterSpotsLeft <= 3,
        isRich: team.budget > 150,
        isPoor: team.budget < 50,
        personality,
        positionPriorities,
        mustFillPositions,
        proactiveFillPositions,
        underrepresentedPositions,
        starredTargetIds,
        starredTargetAvailableNowIds: starTargetState.availableNowIds,
        starredUnavailablePositions: starTargetState.unavailablePositions,
        missingStarterCount: totalMissing,
        emergencyStarterFillMode: roundsIncludingCurrent <= 4 && mustFillPositions.length > 0,
        spreadFillMode: roundNumber >= 6 && rosterSpotsLeft >= 2,
        fillNeedPositions: [...new Set([
          ...mustFillPositions,
          ...proactiveFillPositions,
          ...underrepresentedPositions,
          ...(rosterSpotsLeft >= 4 ? ['RB', 'WR', 'TE'] : [])
        ])]
      };

      console.log(`[generateCPUBids] ${team.name} strategy: ${baseAggressiveness.toFixed(2)}x aggressive, $${budgetPerRound.toFixed(0)}/round, ${rosterSpotsLeft} spots left, must-fill: [${mustFillPositions.join(', ')}], underrep: [${underrepresentedPositions.join(', ')}], stars: ${starredTargetIds.size}, stars-now: ${starTargetState.availableNowIds.size}`);
    }

    const playerExposureCounts = {};
    const existingBidsByPlayer = {};

    // Generate bids for each CPU team
    for (const team of cpuTeams) {
      const strategy = teamStrategies[team.name];
      cpuBids[team.name] = [];
      const positionCounts = getRosterPositionCounts(team);

      // Track total budget committed to bids this round
      let totalBudgetCommitted = 0;
      const reserveBypass = Number(roundNumber) >= 7 || !!strategy.emergencyStarterFillMode;

      // Check if team has any budget left to bid
      const remainingBudget = getBidBudgetForTeam(team, totalBudgetCommitted, maxRosterSize, reserveBypass);
      if (remainingBudget <= 0) {
        console.log(`[CPU-${team.name}] No budget remaining, skipping bids`);
        continue;
      }

      const valuationContext = {
        remainingPlayers: roundPlayers,
        rosterLimits,
        maxRosterSize,
        strategy,
        totalBudgetCommitted
      };

      const specialistPools = {
        K: (roundPlayers || []).filter(player => !player?.owner && player.position === 'K').sort((a, b) => (b.avgValue || 0) - (a.avgValue || 0)),
        DEF: (roundPlayers || []).filter(player => !player?.owner && player.position === 'DEF').sort((a, b) => (b.avgValue || 0) - (a.avgValue || 0))
      };

      // --- ENHANCED: Prioritize must-fill positions and roster balance in late rounds ---
      let valuedPlayers = roundPlayers
        .filter(player => {
          // Always allow if valid roster addition
          if (!player.owner && isValidRosterAddition(team, player, rosterLimits)) return true;
          // --- ENHANCEMENT: Allow star hunting for bench if budget allows ---
          // If team has filled starting spot for this position, but player is a big name and team has surplus budget, allow bidding for bench
          const isBigName = player.avgValue >= 40;
          const openSlots = getOpenSlots(team, maxRosterSize);
          const enoughBudget = team.budget > 25 && openSlots > 0;
          // Only allow if not already on roster, not owned, and not overfilling by more than 1
          const positionCount = team.roster.filter(p => p.position === player.position).length;
          const maxForPosition = rosterLimits[player.position]?.max || 99;
          if (!player.owner && isBigName && enoughBudget && positionCount >= maxForPosition && openSlots > 0) {
            // Allow one extra star for bench
            return positionCount < maxForPosition + 2;
          }
          return false;
        })
        .map(player => {
          const teamValue = calculatePlayerValueForTeam(team, player, valuationContext);
          const playerIdKey = getPlayerIdKey(player);
          const isStarredTarget = strategy.starredTargetIds?.has(playerIdKey);
          const holdForUnavailableStar = !isStarredTarget && strategy.starredUnavailablePositions?.has(player.position);
          const isSpecialist = player.position === 'K' || player.position === 'DEF';
          const missingStarterAtPosition = (positionCounts[player.position] || 0) < getPositionMinimum(player.position, rosterLimits);
          let specialistOpportunityMultiplier = 1;
          let earlySpecialistTarget = false;

          if (isSpecialist && missingStarterAtPosition && roundNumber <= 6) {
            const pool = specialistPools[player.position] || [];
            const rankIndex = pool.findIndex(candidate => String(candidate?.id) === String(player?.id));
            if (rankIndex >= 0 && pool.length > 0) {
              const topBandCount = Math.max(1, Math.ceil(pool.length * 0.34));
              const isTopSpecialist = rankIndex < topBandCount;
              const teamGateRoll = getTeamPlayerNoise(team.name, player.id, roundNumber);
              const chaseThreshold = roundNumber <= 3 ? 0.68 : 0.58;

              if (isTopSpecialist && teamGateRoll >= chaseThreshold) {
                specialistOpportunityMultiplier = roundNumber <= 3 ? 1.18 : 1.28;
                earlySpecialistTarget = true;
              } else if (!isTopSpecialist) {
                specialistOpportunityMultiplier = roundNumber <= 3 ? 0.9 : 0.95;
              }
            }
          }

          let mustFillPriority = 1;
          // In late rounds, boost must-fill positions
          if ((strategy.mustFillPositions && strategy.mustFillPositions.length > 0) && (strategy.mustFillPositions.includes(player.position))) {
            mustFillPriority = 3.2;
          }
          if ((strategy.proactiveFillPositions || []).includes(player.position)) {
            const proactivePriorityFloor = getProactivePriorityFloor(roundNumber);
            mustFillPriority = Math.max(mustFillPriority, proactivePriorityFloor);
          }
          // In late rounds, boost underrepresented positions for balance
          if ((strategy.underrepresentedPositions && strategy.underrepresentedPositions.length > 0) && (strategy.underrepresentedPositions.includes(player.position))) {
            mustFillPriority = Math.max(mustFillPriority, 2.0);
          }
          // Slightly deprioritize overfilled positions (e.g., 7+ WR)
          if (player.position === 'WR' && (team.roster.filter(p => p.position === 'WR').length > 6)) {
            mustFillPriority = Math.min(mustFillPriority, 0.7);
          }
          // --- ENHANCEMENT: Star hunting for bench ---
          if (player.avgValue >= 40 && team.budget > 25 && getOpenSlots(team, maxRosterSize) > 0) {
            mustFillPriority = Math.max(mustFillPriority, 1.5);
          }

          if (strategy.spreadFillMode) {
            if (player.position === 'K' || player.position === 'DEF') {
              mustFillPriority = Math.min(mustFillPriority, 1.35);
            }
            if (player.position === 'RB' || player.position === 'WR' || player.position === 'TE') {
              mustFillPriority = Math.max(mustFillPriority, 1.2);
            }
          }

          if (isStarredTarget) {
            mustFillPriority = Math.max(mustFillPriority, 1.8);
          } else if (holdForUnavailableStar && !(strategy.mustFillPositions || []).includes(player.position)) {
            mustFillPriority = Math.min(mustFillPriority, 0.82);
          }

          return {
            player,
            teamValue,
            mustFillPriority,
            earlySpecialistTarget,
            selectionWeight: Math.max(0.25, teamValue * mustFillPriority * specialistOpportunityMultiplier * (player.avgValue >= 45 ? 1.05 : 1) * (isStarredTarget ? 1.2 : 1))
          };
        })
        .filter(entry => {
          const isMustFillPosition = (strategy.mustFillPositions || []).includes(entry?.player?.position);
          return isMustFillPosition || entry.teamValue >= (strategy.mustFillRoster || strategy.spreadFillMode ? 0.2 : 0.75);
        })
        .sort((a, b) => b.selectionWeight - a.selectionWeight);

      const priorityFillPositions = [...new Set([...(strategy.mustFillPositions || []), ...(strategy.proactiveFillPositions || [])])];

      // If there are fill-priority positions, bid on those first.
      let availablePlayers;
      if (!strategy.spreadFillMode && priorityFillPositions.length > 0) {
        availablePlayers = valuedPlayers.filter(entry => priorityFillPositions.includes(entry.player.position));
        // If not enough, fill with underrepresented positions
        if (availablePlayers.length < strategy.rosterSpotsLeft && strategy.underrepresentedPositions && strategy.underrepresentedPositions.length > 0) {
          const underrep = valuedPlayers.filter(entry => strategy.underrepresentedPositions.includes(entry.player.position));
          availablePlayers = availablePlayers.concat(underrep);
        }
        // If still not enough, fill with best-available
        if (availablePlayers.length < strategy.rosterSpotsLeft) {
          const bestAvailable = valuedPlayers.filter(entry => !availablePlayers.includes(entry));
          availablePlayers = availablePlayers.concat(bestAvailable);
        }
      } else {
        // No must-fill, just use best-available
        availablePlayers = weightedRandomSample(
          valuedPlayers,
          Math.min(25, valuedPlayers.length),
          entry => entry.selectionWeight
        ).sort((a, b) => b.selectionWeight - a.selectionWeight);
      }

      // Prevent duplicate entries for the same player when building candidate pools.
      availablePlayers = dedupePlayerEntriesByBestWeight(availablePlayers)
        .sort((a, b) => b.selectionWeight - a.selectionWeight);

      // Number of bids based on strategy and budget
      let maxBids = 1;
      if (strategy.isRich) maxBids += 1;
      if (strategy.isDesperate) maxBids += 1;
      if (strategy.aggressiveness > 0.7) maxBids += 1;
      if (remainingBudget > 30) maxBids += 1;
      if (strategy.mustFillRoster) maxBids += Math.min(3, strategy.playersNeededForMinimum);

      // If a team still has healthy budget after round 5, keep taking shots at quality upgrades.
      if (roundNumber >= 6) {
        const slotsLeft = Math.max(1, strategy.rosterSpotsLeft || getOpenSlots(team, maxRosterSize));
        const budgetPerSpot = remainingBudget / slotsLeft;
        if (budgetPerSpot >= 9) maxBids += 1;
        if (budgetPerSpot >= 14 && slotsLeft <= 5) maxBids += 1;
      }

      // In back-half fill mode, spread cheap shots across multiple needs every round.
      if (strategy.spreadFillMode) {
        const minSpreadBids = Math.min(
          9,
          Math.max(5, strategy.rosterSpotsLeft),
          availablePlayers.length
        );
        maxBids = Math.max(maxBids, minSpreadBids);
      }

      if (roundNumber >= 8 && remainingBudget > 0) {
        const lateRoundPressureBids = Math.min(
          10,
          Math.max(6, strategy.rosterSpotsLeft + 1),
          availablePlayers.length
        );
        maxBids = Math.max(maxBids, lateRoundPressureBids);
      }

      if (strategy.emergencyStarterFillMode) {
        const emergencyBidCount = Math.min(4, Math.max(2, strategy.mustFillPositions.length + 1));
        maxBids = Math.max(maxBids, emergencyBidCount);
      }

      maxBids = Math.min(maxBids, availablePlayers.length);

      // Diversify targets so CPU teams do not all pile onto the same players.
      const selectedPlayers = selectCpuTargetsForTeam(
        availablePlayers,
        maxBids,
        team.name,
        roundNumber,
        playerExposureCounts
      );

      const selectedWithCoverage = enforcePositionCoverage(
        selectedPlayers,
        availablePlayers,
        strategy.spreadFillMode ? strategy.fillNeedPositions : priorityFillPositions,
        maxBids
      );

      const selectedWithStars = enforceStarTargetCoverage(
        selectedWithCoverage,
        availablePlayers,
        strategy.starredTargetIds,
        maxBids
      );

      selectedWithStars.forEach(selected => {
        const playerId = selected?.player?.id;
        if (!playerId) return;
        playerExposureCounts[playerId] = (playerExposureCounts[playerId] || 0) + 1;
      });

      for (const selectedPlayer of selectedWithStars) {
        const player = selectedPlayer.player;
        const playerIdKey = getPlayerIdKey(player);
        const isMustFillPosition = (strategy.mustFillPositions || []).includes(player.position);
        const isStarredTarget = strategy.starredTargetIds?.has(playerIdKey);
        const holdForUnavailableStar = !isStarredTarget
          && strategy.starredUnavailablePositions?.has(player.position)
          && !(strategy.mustFillPositions || []).includes(player.position);

        // Check if we still have budget to bid
        const bidRemainingBudget = getBidBudgetForTeam(team, totalBudgetCommitted, maxRosterSize, reserveBypass);
        if (bidRemainingBudget <= 0) {
          console.log(`[CPU-${team.name}] Ran out of budget during bidding, stopping`);
          break;
        }

        const trueValue = calculatePlayerValueForTeam(team, player, {
          remainingPlayers: roundPlayers,
          rosterLimits,
          maxRosterSize,
          strategy,
          totalBudgetCommitted
        });
        let maxBid = Math.min(
          Math.max(Math.round(trueValue), isMustFillPosition ? 1 : 0),
          bidRemainingBudget
        );

        const lateRoundFillPush = Number(roundNumber) >= 7 && (strategy.fillNeedPositions || []).includes(player.position);
        if (lateRoundFillPush) {
          maxBid = bidRemainingBudget;
        }

        if (maxBid <= 0) {
          continue;
        }

        let baseBid = Math.round(trueValue * (0.78 + strategy.aggressiveness * 0.18));

        // Use position-specific bid ranges from your original table
        const bidRange = getBidRange(player.position, player.avgValue, true);
        // Use the full range — the Math.min(0.2) cap was collapsing all CPUs into a tiny window causing frequent integer ties
        let baseMultiplier;
        if (isStarredTarget) {
          const highRangeBias = 0.62 + Math.random() * 0.38;
          baseMultiplier = bidRange.min + ((bidRange.max - bidRange.min) * highRangeBias);
        } else if (holdForUnavailableStar) {
          const lowRangeBias = Math.random() * 0.38;
          baseMultiplier = bidRange.min + ((bidRange.max - bidRange.min) * lowRangeBias);
        } else {
          const lowBiasRoll = Math.pow(Math.random(), 1.55);
          baseMultiplier = bidRange.min + ((bidRange.max - bidRange.min) * lowBiasRoll);
        }

        // Add occasional outlier bids for realism, but keep elite prices in bounds.
        if (Math.random() < 0.03) {
          const outlierType = Math.random();
          if (outlierType < 0.35) {
            baseMultiplier *= 0.6 + Math.random() * 0.2; // 0.6x to 0.8x of normal range
          } else if (outlierType < 0.8) {
            baseMultiplier *= player.avgValue >= 45 ? (1.03 + Math.random() * 0.1) : (1.12 + Math.random() * 0.2);
          } else {
            baseMultiplier *= player.avgValue >= 45 ? (1.12 + Math.random() * 0.12) : (1.28 + Math.random() * 0.32);
          }
        }

        baseBid = Math.round(baseBid * baseMultiplier);

        // Add situational modifiers
        let situationalMultiplier = 1.0;

        // Competition awareness - if many teams are bidding, adjust
        const competingTeams = cpuTeams.length;
        if (competingTeams > 8) situationalMultiplier *= 0.9; // More competition, slightly less aggressive

        // Round position adjustments - allow strategic early aggression
        if (roundNumber <= 2) {
          // Rich teams can be aggressive early, poor teams stay conservative
          if (strategy.isRich && strategy.rosterSpotsLeft <= 10) {
            situationalMultiplier *= 1.12;
          } else {
            situationalMultiplier *= 1.04;
          }
        } else if (roundNumber >= 8) {
          situationalMultiplier *= player.avgValue <= 10 ? 1.18 : 1.05;
        }

        if (isStarredTarget) {
          situationalMultiplier *= 1.08;
        } else if (holdForUnavailableStar) {
          situationalMultiplier *= 0.86;
        }

        baseBid = Math.round(baseBid * situationalMultiplier);

        // Add randomization for unpredictability with a wider spread to avoid repetitive clustering.
        let randomFactor;
        if (player.avgValue >= 50) {
          randomFactor = 0.62 + Math.random() * 0.74; // 0.62–1.36
        } else if (player.avgValue >= 35) {
          randomFactor = 0.58 + Math.random() * 0.84; // 0.58–1.42
        } else {
          randomFactor = 0.5 + Math.random() * 1.0; // 0.50–1.50 for mid/low-value players
        }
        baseBid = Math.round(baseBid * randomFactor);

        // More often shade non-priority bids below AV to create realistic value hunting.
        if (!isMustFillPosition && !isStarredTarget && !holdForUnavailableStar) {
          if (Math.random() < 0.57) {
            baseBid = Math.round(baseBid * (0.72 + Math.random() * 0.22));
          }
        }

        if (player.avgValue <= 8) {
          baseBid = Math.round(baseBid * (0.8 + Math.random() * 0.2));
        }

        baseBid = pullBidTowardAV(player, baseBid, roundNumber);
        baseBid = clampBidToDynamicBand(player, baseBid, roundNumber, strategy, bidRemainingBudget);

        baseBid = applyLowCostBidShaping(player, baseBid, strategy, bidRemainingBudget);
        baseBid = applyAvRangeRandomness(player, baseBid, roundNumber, bidRemainingBudget);

        if (strategy.spreadFillMode && (strategy.fillNeedPositions || []).includes(player.position) && player.avgValue <= 18) {
          const slotsLeft = Math.max(1, getOpenSlots(team, maxRosterSize));
          const softCap = Math.max(2, Math.ceil(bidRemainingBudget / (slotsLeft + 1)));
          const positionalCap = (player.position === 'K' || player.position === 'DEF') ? 6 : 10;
          baseBid = Math.min(baseBid, softCap, positionalCap);
        }

        if (strategy.spreadFillMode) {
          const slotsLeft = Math.max(1, getOpenSlots(team, maxRosterSize));
          const maxSingleBid = getSpreadSingleBidCap(team, player, strategy, bidRemainingBudget, maxRosterSize);

          // In fill mode, avoid burning most of the budget on a single player.
          if (slotsLeft >= 4 && !(strategy.mustFillPositions || []).includes(player.position)) {
            baseBid = Math.min(baseBid, maxSingleBid);
          }
        }

        if (holdForUnavailableStar) {
          const conservativeCap = player.avgValue >= 10
            ? Math.max(2, Math.round(player.avgValue * 0.92))
            : 6;
          baseBid = Math.min(baseBid, conservativeCap, bidRemainingBudget);
        }

        baseBid = softenEliteBid(player, baseBid, strategy);

        if (strategy.mustFillRoster && player.avgValue <= 14) {
          const fillFloorBase = player.position === 'K' || player.position === 'DEF'
            ? 1
            : Math.max(1, Math.ceil(strategy.budgetPerRound * 0.14));
          const fillFloor = Math.min(bidRemainingBudget, fillFloorBase);
          baseBid = Math.max(baseBid, fillFloor);
        }

        // Final budget and minimum checks
        baseBid = Math.min(baseBid, maxBid);
        baseBid = Math.max(baseBid, 1);

        // Team/player deterministic micro-jitter to reduce same-price collisions.
        const jitterRoll = getTeamPlayerNoise(team.name, player.id, roundNumber);
        if (jitterRoll < 0.18 && baseBid < maxBid) {
          baseBid += 1;
        } else if (jitterRoll > 0.9 && baseBid > 1) {
          baseBid -= 1;
        }

        baseBid = diversifyBidAgainstExisting(player, baseBid, existingBidsByPlayer, bidRemainingBudget);
        baseBid = clampBidToDynamicBand(player, baseBid, roundNumber, strategy, bidRemainingBudget);
        baseBid = Math.min(baseBid, maxBid);
        baseBid = Math.max(1, baseBid);

        // Strategic bid evaluation: Only bid if team believes it can win
        const bidDecision = evaluateBidStrategy(baseBid, player, team, strategy, cpuTeams, roundPlayers, teamStrategies, rosterLimits, maxRosterSize);

        if (bidDecision === true) {
          cpuBids[team.name].push({ player, cpuBid: baseBid });
          if (!existingBidsByPlayer[playerIdKey]) existingBidsByPlayer[playerIdKey] = [];
          existingBidsByPlayer[playerIdKey].push(baseBid);
          totalBudgetCommitted += baseBid;
          console.log(`[CPU-${team.name}] Bid on ${player.name} ($${baseBid}) - total committed: $${totalBudgetCommitted}`);
        } else if (bidDecision && bidDecision.shouldBid && bidDecision.isCatchBid) {
          // Catch bid: Use the low catch bid amount instead of calculated bid
          const catchBid = bidDecision.catchBidAmount;
          if (catchBid <= bidRemainingBudget) {
            cpuBids[team.name].push({ player, cpuBid: catchBid });
            if (!existingBidsByPlayer[playerIdKey]) existingBidsByPlayer[playerIdKey] = [];
            existingBidsByPlayer[playerIdKey].push(catchBid);
            totalBudgetCommitted += catchBid;
            console.log(`[CPU-${team.name}] Catch bid on ${player.name} ($${catchBid}) - total committed: $${totalBudgetCommitted}`);
          } else {
            console.log(`[CPU-${team.name}] Skipping catch bid on ${player.name} ($${catchBid}) - exceeds budget`);
          }
        } else {
          if (strategy.spreadFillMode && (strategy.fillNeedPositions || []).includes(player.position) && bidRemainingBudget > 1) {
            const dynamicCap = getSpreadSingleBidCap(team, player, strategy, bidRemainingBudget, maxRosterSize);
            const fallbackBid = Math.max(1, Math.min(dynamicCap, Math.ceil(dynamicCap * 0.65)));
            cpuBids[team.name].push({ player, cpuBid: fallbackBid });
            if (!existingBidsByPlayer[playerIdKey]) existingBidsByPlayer[playerIdKey] = [];
            existingBidsByPlayer[playerIdKey].push(fallbackBid);
            totalBudgetCommitted += fallbackBid;
            console.log(`[CPU-${team.name}] Spread-fill fallback bid on ${player.name} ($${fallbackBid}) - total committed: $${totalBudgetCommitted}`);
          } else {
            // Skip this bid - team doesn't believe it can win
            console.log(`[CPU-${team.name}] Skipping bid on ${player.name} ($${baseBid}) - poor win odds`);
          }
        }
      }

      console.log(`[CPU-${team.name}] Generated ${cpuBids[team.name].length} bids (strategy: ${(strategy.aggressiveness * 100).toFixed(0)}% aggressive, budget: $${team.budget}, committed: $${totalBudgetCommitted})`);

      // Keep one bid per player per team (highest bid wins) before global tie shaping.
      cpuBids[team.name] = dedupeTeamBidsByHighest(cpuBids[team.name]);
    }

    // Enforce realistic tie rates after CPU bids are generated.
    enforceCpuTieRates(cpuBids, cpuTeams, roundPlayers);

    console.log(`[generateCPUBids] Completed - generated bids for ${Object.keys(cpuBids).length} CPU teams`);
    return cpuBids;
  } catch (error) {
    console.error('[generateCPUBids] CRITICAL ERROR generating CPU bids:', error);
    console.error(error.stack);
    return {};
  }
}

// Helper function: Evaluate if a CPU should place a bid based on strategy
function evaluateBidStrategy(bidAmount, player, team, strategy, allCpuTeams, remainingPlayers, teamStrategies, rosterLimits, maxRosterSize) {
  function buildCatchBidDecision() {
    const roundsLeft = strategy?.roundsIncludingCurrent || draftRoundCount;
    const openSpots = Math.max(1, getOpenSlots(team, maxRosterSize));
    const effectiveBudget = getEffectiveBudget(team, 0, maxRosterSize);
    const reserveForOthers = Math.max(0, openSpots - 1);
    const spendableNow = Math.max(0, effectiveBudget - reserveForOthers);

    // Keep catch bids from hurting the odds on roster-filling bids.
    if (spendableNow < 2) return null;

    const isElite = player.avgValue >= 50;
    const isPremium = player.avgValue >= 35;

    let catchBid;
    const roll = Math.random();

    // Keep cheap shots common, including more $1 outcomes.
    if (roll < 0.12) {
      catchBid = 1;
    } else if (roll < 0.96) {
      catchBid = 2 + Math.floor(Math.random() * 5); // 2-6
    } else {
      // 7-10 exists but should be rare and mostly for elite targets.
      if (!isElite || roundsLeft > 5 || Math.random() < 0.55) {
        catchBid = 6;
      } else {
        catchBid = 7 + Math.floor(Math.random() * 4); // 7-10
      }
    }

    const spendCap = isElite ? 0.48 : isPremium ? 0.42 : 0.35;
    const maxCatchByPlan = Math.max(1, Math.floor(spendableNow * spendCap));
    catchBid = Math.min(catchBid, maxCatchByPlan, spendableNow, 10);

    if (!isElite && !isPremium && Math.random() < 0.2) {
      catchBid = 1;
    }

    if (catchBid < 1) return null;
    return { shouldBid: true, isCatchBid: true, catchBidAmount: catchBid };
  }

  const missingAtPosition = getMissingStarterCounts(team, rosterLimits).missingByPosition[player.position] || 0;
  const upgradeGap = getUpgradeGap(team, player, rosterLimits);
  const openSlots = Math.max(1, getOpenSlots(team, maxRosterSize));
  const effectiveBudgetNow = getEffectiveBudget(team, 0, maxRosterSize);
  const roundsIncludingCurrent = strategy?.roundsIncludingCurrent || draftRoundCount;
  const lateRoundAutoBidMode = roundsIncludingCurrent <= 4 && effectiveBudgetNow > 0;

  if ((strategy?.mustFillRoster && player.avgValue <= 14) || missingAtPosition > 0) {
    return true;
  }

  if (lateRoundAutoBidMode) {
    const budgetRatio = bidAmount / Math.max(1, team.budget || 1);
    if (player.avgValue <= 35) {
      return true;
    }
    if (player.avgValue <= 50) {
      return budgetRatio <= 0.58 || missingAtPosition > 0 || upgradeGap >= 6;
    }
    return budgetRatio <= 0.5 || missingAtPosition > 0 || upgradeGap >= 8;
  }

  // Back-half roster fill: prefer placing several affordable bids over waiting for one perfect target.
  if (strategy?.spreadFillMode && openSlots >= 4 && player.avgValue <= 18) {
    return true;
  }

  if (strategy?.spreadFillMode && openSlots >= 4 && missingAtPosition === 0) {
    const maxSingleBid = getSpreadSingleBidCap(team, player, strategy, effectiveBudgetNow, maxRosterSize);
    if (bidAmount > maxSingleBid) {
      return false;
    }
  }

  // Count how many other teams are likely to bid higher
  let competingTeams = 0;
  let higherBidders = 0;
  const needLevel = strategy.positionPriorities?.[player.position] || 1;
  const competitorBuffer = player.avgValue >= 35
    ? Math.max(2, Math.round(bidAmount * 0.06))
    : Math.max(1, Math.round(bidAmount * 0.12));

  for (const otherTeam of allCpuTeams) {
    if (otherTeam.name === team.name) continue;
    if (!isValidRosterAddition(otherTeam, player, rosterLimits, maxRosterSize)) continue;

    const otherStrategy = teamStrategies?.[otherTeam.name] || {
      aggressiveness: 0.5,
      budgetPerRound: otherTeam.budget / 10,
      isRich: otherTeam.budget > 150,
      isPoor: otherTeam.budget < 50,
      rosterSpotsLeft: getOpenSlots(otherTeam, maxRosterSize),
      personality: getTeamPersonality(otherTeam.name)
    };

    const estimatedBid = estimateTeamBid(otherTeam, player, otherStrategy, {
      remainingPlayers,
      rosterLimits,
      maxRosterSize
    });

    competingTeams++;

    if (estimatedBid > bidAmount + competitorBuffer) {
      higherBidders++;
    }
  }

  // Calculate win probability
  const winProbability = competingTeams > 0 ? (competingTeams - higherBidders) / competingTeams : 1.0;
  const urgencyBoost = needLevel >= 4 ? 0.26 : needLevel === 3 ? 0.18 : needLevel === 2 ? 0.08 : 0;
  const upgradeBoost = upgradeGap >= 10 ? 0.24 : upgradeGap >= 7 ? 0.15 : upgradeGap >= 4 ? 0.08 : 0;

  // Decision factors
  const isElitePlayer = player.avgValue >= 50;
  const isHighValuePlayer = player.avgValue >= 35;
  const budgetRatio = bidAmount / team.budget;

  // Mid/late draft affordability filter: do not chase expensive players if it likely blocks roster completion.
  if (player.avgValue >= 22 && (strategy?.roundsIncludingCurrent || draftRoundCount) <= 5) {
    const reserveForRemainingSlots = Math.max(0, openSlots - 1);
    const chaseBudget = Math.max(0, team.budget - reserveForRemainingSlots);
    const affordabilityRatio = chaseBudget / Math.max(1, player.avgValue);
    const allInRisk = bidAmount > chaseBudget * 0.88 && openSlots >= 2;
    const weakWinSignal = winProbability + upgradeBoost < 0.18;
    const effectiveBudgetNow = getEffectiveBudget(team, 0, maxRosterSize);
    const nearAllInOnEffective = bidAmount >= effectiveBudgetNow * 0.88 && openSlots >= 3;

    // Very short stacks can take only occasional upgrade shots, not every round.
    if (affordabilityRatio < 0.58 && openSlots >= 3) {
      const longShotChance = upgradeGap >= 12 ? 0.14 : 0.05;
      if (Math.random() > longShotChance) {
        if ((player.avgValue >= 35 || upgradeGap >= 10) && Math.random() < 0.1) {
          return buildCatchBidDecision() || false;
        }
        return false;
      }
    }

    if (nearAllInOnEffective && winProbability + upgradeBoost < 0.4) {
      if ((player.avgValue >= 35 || upgradeGap >= 10) && Math.random() < 0.08) {
        return buildCatchBidDecision() || false;
      }
      return false;
    }

    if ((affordabilityRatio < 0.72 || (allInRisk && weakWinSignal)) && upgradeGap < 10 && !strategy?.isDesperate) {
      if (player.avgValue >= 35 && Math.random() < 0.06) {
        return buildCatchBidDecision() || false;
      }
      return false;
    }
  }

  // Conservative bidding for elite players
  if (isElitePlayer) {
    // Only bid if win probability > 40% OR team is very aggressive OR has budget
    if (winProbability + urgencyBoost + upgradeBoost > 0.28 || strategy.aggressiveness > 0.72 || team.budget > 150) {
      return true;
    }
    // Rare upside swing with controlled catch-bid sizing.
    else if (winProbability < 0.22 && Math.random() < 0.14 && team.budget >= 3) {
      return buildCatchBidDecision() || false;
    }
    return false;
  }

  // Moderate caution for high-value players
  if (isHighValuePlayer) {
    // Only bid if win probability > 30% OR budget commitment is reasonable
    if (winProbability + urgencyBoost + upgradeBoost > 0.2 || (winProbability > 0.08 && budgetRatio < 0.22) || (upgradeGap >= 8 && budgetRatio < 0.34)) {
      return true;
    }
    // Smaller but still present catch-bid chance for premium players.
    else if (winProbability < 0.25 && Math.random() < 0.08 && team.budget >= 3) {
      return buildCatchBidDecision() || false;
    }
    return false;
  }

  // More aggressive for mid-tier and value players
  // Bid if win probability > 15% OR team desperately needs roster spots
  return winProbability + urgencyBoost + upgradeBoost > 0.08 || strategy.isDesperate || needLevel === 3 || upgradeGap >= 6;
}

// Helper: Cut lowest-ranked players if roster is overfilled (post-draft cleanup)
function cutLowestRankedPlayers(team, maxRosterSize) {
  if ((team.roster || []).length > maxRosterSize) {
    const roster = [...team.roster];
    const kDefPriority = { K: 0, DEF: 1 };

    // Drop extra K/DEF first, then lowest value players.
    roster.sort((a, b) => {
      const aPriority = Object.prototype.hasOwnProperty.call(kDefPriority, a.position) ? kDefPriority[a.position] : 2;
      const bPriority = Object.prototype.hasOwnProperty.call(kDefPriority, b.position) ? kDefPriority[b.position] : 2;
      if (aPriority !== bPriority) return aPriority - bPriority;
      return (a.avgValue || 0) - (b.avgValue || 0);
    });

    while (roster.length > maxRosterSize) {
      roster.shift();
    }

    team.roster = roster;
  }
}

// Export functions for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    generateClientCPUBids,
    generateServerCPUBids,
    evaluateBidStrategy,
    calculatePlayerValueForTeam,
    getEffectiveBudget,
    getPositionNeedMultiplier,
    weightedRandomSample,
    getBidRange,
    getRangeKey,
    silentAuctionBidRanges,
    serverSilentAuctionBidRanges,
    cutLowestRankedPlayers
  };
}