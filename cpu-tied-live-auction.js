// CPU Tied Live Auction Logic
// Contains functions for handling CPU bidding in tied live auctions

// Bid ranges for tied live auctions (adapted from server.js)
const tiedLiveAuctionBidRanges = {
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

const silentAuctionBidRanges = {
  QB: {
    '1-5': { min: 0.4, max: 1.65 },
    '5-10': { min: 0.5, max: 1.45 },
    '10-20': { min: 0.55, max: 1.35 },
    '20-30': { min: 0.6, max: 1.3 },
    '30-40': { min: 0.85, max: 1.15 },
    '40-50': { min: 0.9, max: 1.1 },
    '50-60': { min: 0.95, max: 1.05 },
    '60+': { min: 0.98, max: 1.02 }
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
  },
  K: {
    '1-5': { min: 0.3, max: 1.8 },
    '5-10': { min: 0.4, max: 1.6 },
    '10-20': { min: 0.5, max: 1.4 },
    '20-30': { min: 0.6, max: 1.3 },
    '30-40': { min: 0.7, max: 1.2 },
    '40-50': { min: 0.8, max: 1.1 },
    '50-60': { min: 0.85, max: 1.05 },
    '60+': { min: 0.9, max: 1.0 }
  },
  DEF: {
    '1-5': { min: 0.3, max: 1.8 },
    '5-10': { min: 0.4, max: 1.6 },
    '10-20': { min: 0.5, max: 1.4 },
    '20-30': { min: 0.6, max: 1.3 },
    '30-40': { min: 0.7, max: 1.2 },
    '40-50': { min: 0.8, max: 1.1 },
    '50-60': { min: 0.85, max: 1.05 },
    '60+': { min: 0.9, max: 1.0 }
  }
};

function getSilentAuctionCap(position, playerAV) {
  const rangeKey = playerAV <= 5 ? '1-5'
    : playerAV <= 10 ? '5-10'
    : playerAV <= 20 ? '10-20'
    : playerAV <= 30 ? '20-30'
    : playerAV <= 40 ? '30-40'
    : playerAV <= 50 ? '40-50'
    : playerAV <= 60 ? '50-60'
    : '60+';
  const range = silentAuctionBidRanges[position]?.[rangeKey];
  return Math.max(1, Math.round((Number(playerAV) || 1) * (range ? range.max : 1.5)));
}

const DEFAULT_TIED_TUNING = {
  baseBidProb: 0.34,
  preAvShape: 0.8,
  postAvDrop: 1.8,
  nearAvStart: 0.94,
  overAvStart: 1.0,
  nearAvWindow: 0.12,
  overAvWindow: 0.12,
  fearNearWeight: 0.18,
  fearOverWeight: 0.28,
  disciplineWeight: 0.22,
  budgetHighThreshold: 0.45,
  budgetMidThreshold: 0.3,
  budgetPenaltyHigh: 0.55,
  budgetPenaltyMid: 0.72,
  top10BargainDiscountTrigger: 0.85,
  top10BargainOverAvAllowance: 1,
  top10BargainForceBidBase: 0.58,
  backoutBase: 0.08,
  backoutAggressionScale: 0.35,
  clockBoost: 1.04
};

const DEFAULT_TIED_PROFILES = [
  { aggression: 0.84, patience: 1.2, fear: 1.25, ego: 0.88, discipline: 1.25, desperation: 0.92 },
  { aggression: 1.22, patience: 0.82, fear: 0.82, ego: 1.24, discipline: 0.82, desperation: 1.15 },
  { aggression: 0.96, patience: 1.28, fear: 0.96, ego: 0.92, discipline: 1.35, desperation: 0.9 },
  { aggression: 1.08, patience: 1.0, fear: 1.05, ego: 1.1, discipline: 0.96, desperation: 1.0 },
  { aggression: 0.92, patience: 0.95, fear: 1.12, ego: 1.04, discipline: 1.12, desperation: 1.2 }
];

function loadCpuLogicConfig() {
  try {
    delete require.cache[require.resolve('./cpulogic')];
    return require('./cpulogic') || {};
  } catch (_error) {
    return {};
  }
}

function getTiedTuning() {
  const cfg = loadCpuLogicConfig();
  return {
    ...DEFAULT_TIED_TUNING,
    ...(cfg && cfg.tied && typeof cfg.tied === 'object' ? cfg.tied : {})
  };
}

function getTiedProfiles() {
  const cfg = loadCpuLogicConfig();
  if (Array.isArray(cfg?.tiedProfiles) && cfg.tiedProfiles.length) {
    return cfg.tiedProfiles;
  }
  return DEFAULT_TIED_PROFILES;
}

// AV ranges for tied auction probabilities (using RB multipliers as base)
const avRanges = {
  1: { min: 1, max: 6 },
  2: { min: 1, max: 7 },
  3: { min: 1, max: 8 },
  4: { min: 1, max: 9 },
  5: { min: 1, max: 10 },
  6: { min: 1, max: 12 },
  7: { min: 1, max: 13 },
  8: { min: 1, max: 14 },
  9: { min: 1, max: 15 },
  10: { min: 1, max: 16 },
  11: { min: 1, max: 17 },
  12: { min: 1, max: 18 },
  13: { min: 1, max: 19 },
  14: { min: 1, max: 20 },
  15: { min: 1, max: 22 },
  16: { min: 1, max: 23 },
  17: { min: 1, max: 24 },
  18: { min: 1, max: 25 },
  19: { min: 1, max: 26 },
  20: { min: 1, max: 28 },
  21: { min: 1, max: 29 },
  22: { min: 1, max: 30 },
  23: { min: 1, max: 31 },
  24: { min: 1, max: 32 },
  25: { min: 1, max: 34 },
  26: { min: 1, max: 36 },
  27: { min: 1, max: 36 },
  28: { min: 1, max: 37 },
  29: { min: 1, max: 38 },
  30: { min: 1, max: 40 },
  31: { min: 1, max: 41 },
  32: { min: 1, max: 42 },
  33: { min: 1, max: 43 },
  34: { min: 1, max: 44 },
  35: { min: 1, max: 46 },
  36: { min: 1, max: 47 },
  37: { min: 1, max: 48 },
  38: { min: 1, max: 49 },
  39: { min: 1, max: 50 },
  40: { min: 1, max: 52 },
  41: { min: 1, max: 53 },
  42: { min: 1, max: 54 },
  43: { min: 1, max: 55 },
  44: { min: 1, max: 56 },
  45: { min: 1, max: 58 },
  46: { min: 1, max: 59 },
  47: { min: 1, max: 60 },
  48: { min: 1, max: 61 },
  49: { min: 1, max: 62 },
  50: { min: 1, max: 64 },
  51: { min: 1, max: 65 },
  52: { min: 1, max: 66 },
  53: { min: 1, max: 67 },
  54: { min: 1, max: 68 },
  55: { min: 1, max: 70 },
  56: { min: 1, max: 71 },
  57: { min: 1, max: 72 },
  58: { min: 1, max: 73 },
  59: { min: 1, max: 74 },
  60: { min: 1, max: 76 }
};

// Function to get shape parameters for the probability curve
function getShapeParams(A) {
  const tuning = getTiedTuning();
  return {
    s1: Number(tuning.preAvShape || 0.8) + (A / 120),
    s2: Number(tuning.postAvDrop || 1.8) + (A / 60)
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getCpuSeed(cpuTeam) {
  const source = String(cpuTeam?.name || cpuTeam?.teamName || 'cpu');
  return source.split('').reduce((seed, char) => seed + char.charCodeAt(0), 0);
}

function getCpuPersonality(cpuTeam) {
  if (cpuTeam.tiePersonality) {
    return cpuTeam.tiePersonality;
  }

  const profiles = getTiedProfiles();
  const profileCount = Math.max(1, profiles.length);
  const profileIndex = getCpuSeed(cpuTeam) % profileCount;
  const selectedProfile = profiles[profileIndex] || {};

  cpuTeam.__tieProfileIndex = profileIndex;
  cpuTeam.__tieProfileName = selectedProfile.name || null;
  cpuTeam.tiePersonality = { ...selectedProfile };
  return cpuTeam.tiePersonality;
}

function getCpuProfileLabel(cpuTeam) {
  const personality = getCpuPersonality(cpuTeam);
  const profileName = cpuTeam.__tieProfileName || personality.name || `Profile-${(cpuTeam.__tieProfileIndex || 0) + 1}`;
  const profileIndex = Number.isInteger(cpuTeam.__tieProfileIndex) ? cpuTeam.__tieProfileIndex + 1 : 1;
  return `${profileName}#${profileIndex}`;
}

function getCpuProfileApproach(cpuTeam) {
  return String(getCpuProfileLabel(cpuTeam)).replace(/#\d+$/, '').replace('&', 'and').trim();
}

function getCpuRoundAggression(cpuTeam, context) {
  const tuning = getTiedTuning();
  const personality = getCpuPersonality(cpuTeam);
  const round = Number(context.round || 1);
  const need = clamp(Number(context.positionNeed || 0.5), 0, 1.5);
  const budget = Math.max(0, Number(context.budgetRemaining || 0));
  const playerAV = Math.max(1, Number(context.playerAV || 1));
  const bid = Math.max(0, Number(context.currentBid || 0));
  const timeLeft = Math.max(0, Number(context.timeLeft || 0));

  // Early rounds trend measured, middle rounds trend assertive, late rounds become selective.
  const roundTrend =
    round <= 4 ? 0.92 + round * 0.02 :
    round <= 10 ? 1.0 + (round - 4) * 0.015 :
    1.08 - Math.min(0.2, (round - 10) * 0.015);

  const budgetFactor = clamp(0.88 + (budget / Math.max(50, playerAV * 6)) * 0.26, 0.82, 1.2);
  const needFactor = clamp(0.9 + need * 0.28, 0.88, 1.22);
  const valueRatio = bid / playerAV;
  const pricePenalty = clamp(1 - Math.max(0, valueRatio - 1) * 0.24, 0.7, 1);
  const clockBoost = timeLeft <= 2 ? Number(tuning.clockBoost || 1.04) : 1;

  return clamp(
    personality.aggression * roundTrend * budgetFactor * needFactor * pricePenalty * clockBoost,
    0.72,
    1.45
  );
}

function buildRoundAggressionMap(activeCpus, context) {
  const scored = activeCpus.map((cpu, idx) => ({
    cpu,
    idx,
    raw: getCpuRoundAggression(cpu, {
      ...context,
      budgetRemaining: cpu.budget,
      positionNeed: cpu.needs?.[context.position] || 0.5
    })
  }));

  // Ensure every team has a unique aggression score within this tick.
  scored.sort((a, b) => a.raw - b.raw || a.idx - b.idx);

  const aggressionMap = new Map();
  scored.forEach((entry, order) => {
    const uniqueBump = (order + 1) * 0.0025;
    aggressionMap.set(entry.cpu, clamp(entry.raw + uniqueBump, 0.72, 1.5));
  });

  return aggressionMap;
}

function getAuctionStateKey(context) {
  return [
    context.position || 'UNK',
    context.playerAV || 0,
    context.round || 0
  ].join(':');
}

function getTieAuctionState(cpuTeam, context) {
  if (!cpuTeam.__tiedAuctionState) {
    cpuTeam.__tiedAuctionState = {
      auctionKey: null,
      commitment: 0,
      fatigue: 0,
      hesitation: 0,
      ticks: 0,
      lastBid: 0,
      recentOverpayStress: 0
    };
  }

  const auctionKey = getAuctionStateKey(context);
  if (cpuTeam.__tiedAuctionState.auctionKey !== auctionKey) {
    cpuTeam.__tiedAuctionState = {
      auctionKey,
      commitment: 0,
      fatigue: cpuTeam.__tiedAuctionState.recentOverpayStress || 0,
      hesitation: 0,
      ticks: 0,
      lastBid: 0,
      recentOverpayStress: cpuTeam.__tiedAuctionState.recentOverpayStress || 0
    };
  }

  return cpuTeam.__tiedAuctionState;
}

function getBudgetPressure(context) {
  const tuning = getTiedTuning();
  if (!context.playerAV || !context.budgetRemaining) return 1;
  const priceShare = context.currentBid / Math.max(1, context.budgetRemaining);
  const avShare = context.currentBid / Math.max(1, context.playerAV);

  if (priceShare >= Number(tuning.budgetHighThreshold || 0.45)) return Number(tuning.budgetPenaltyHigh || 0.55);
  if (priceShare >= Number(tuning.budgetMidThreshold || 0.3)) return Number(tuning.budgetPenaltyMid || 0.72);
  if (avShare > 1.08) return 0.82;
  return 1;
}

function getRosterPressure(context, personality) {
  const needBoost = 1 + (context.positionNeed || 0) * 0.55;
  if (context.timeLeft <= 2) {
    return needBoost * (0.92 + personality.desperation * 0.22);
  }
  return needBoost;
}

function getPsychologyModifiers(cpuTeam, context, baseBidProb) {
  const tuning = getTiedTuning();
  const personality = getCpuPersonality(cpuTeam);
  const state = getTieAuctionState(cpuTeam, context);
  const roundAggression = clamp(
    Number(context.roundAggression || personality.aggression),
    0.72,
    1.5
  );
  state.ticks += 1;

  const overRatio = context.currentBid / Math.max(1, context.playerAV);
  const nearAvPressure = clamp((overRatio - Number(tuning.nearAvStart || 0.94)) / Number(tuning.nearAvWindow || 0.12), 0, 1);
  const overAvPressure = clamp((overRatio - Number(tuning.overAvStart || 1.0)) / Number(tuning.overAvWindow || 0.12), 0, 1);
  const timerPanic = context.timeLeft <= 2 ? personality.desperation * (context.positionNeed || 0.5) : 0;
  const fatiguePenalty = clamp(state.fatigue * 0.08, 0, 0.32);
  const sunkCostBoost = clamp(state.commitment * (0.05 + personality.ego * 0.015), 0, 0.22);
  const fearPenalty = nearAvPressure * Number(tuning.fearNearWeight || 0.18) * personality.fear + overAvPressure * Number(tuning.fearOverWeight || 0.28) * personality.fear;
  const disciplinePenalty = overAvPressure * Number(tuning.disciplineWeight || 0.22) * personality.discipline;
  const budgetPenalty = (1 - getBudgetPressure(context)) * personality.discipline;
  const panicBoost = timerPanic * (0.08 + personality.aggression * 0.04);
  const rosterBoost = (getRosterPressure(context, personality) - 1) * 0.28;
  const bluffChance = clamp(0.03 + personality.ego * 0.03 + sunkCostBoost * 0.25, 0.03, 0.16);
  const hesitationChance = clamp(
    0.08 +
    nearAvPressure * 0.18 +
    overAvPressure * 0.16 +
    personality.patience * 0.06 +
    state.hesitation * 0.08 -
    timerPanic * 0.08,
    0.05,
    0.42
  );

  let bidProb = baseBidProb;
  bidProb *= roundAggression;
  bidProb *= 1 + sunkCostBoost + panicBoost + rosterBoost;
  bidProb *= 1 - fatiguePenalty;
  bidProb *= 1 - clamp(fearPenalty + disciplinePenalty + budgetPenalty, 0, 0.72);

  const backoutBase = Number(tuning.backoutBase || 0.08) + nearAvPressure * 0.14 + overAvPressure * 0.48;
  let backoutProb = backoutBase * personality.fear;
  backoutProb += disciplinePenalty * 0.8 + budgetPenalty * 0.65 + fatiguePenalty * 0.6;
  backoutProb -= sunkCostBoost * 0.45 + timerPanic * 0.08 + rosterBoost * 0.2;
  // Higher round aggression means less willingness to back out this tick.
  backoutProb *= clamp(1.35 - roundAggression * 0.35, 0.62, 1.15);

  if (context.timeLeft <= 1 && timerPanic > 0.08 && overRatio <= 1.08) {
    bidProb *= 1.12;
  }

  return {
    personality,
    state,
    roundAggression,
    bidProb: clamp(bidProb, 0, 0.95),
    backoutProb: clamp(backoutProb, 0.02, 0.95),
    hesitationChance,
    bluffChance,
    overRatio
  };
}

function updateTieAuctionState(state, action, context, overRatio) {
  if (action === 'bid') {
    state.commitment = clamp(state.commitment + 1, 0, 5);
    state.hesitation = 0;
    state.lastBid = context.currentBid + 1;
    state.fatigue = clamp(state.fatigue + 0.18 + Math.max(0, overRatio - 1) * 0.4, 0, 4);
    state.recentOverpayStress = clamp(
      state.recentOverpayStress * 0.82 + Math.max(0, overRatio - 1) * 1.2,
      0,
      3
    );
    return;
  }

  if (action === 'hold') {
    state.hesitation = clamp(state.hesitation + 0.6, 0, 3);
    state.fatigue = clamp(state.fatigue + 0.08, 0, 4);
    state.recentOverpayStress = clamp(state.recentOverpayStress * 0.95, 0, 3);
    return;
  }

  state.commitment = 0;
  state.hesitation = 0;
  state.fatigue = clamp(state.fatigue * 0.55, 0, 4);
  state.recentOverpayStress = clamp(state.recentOverpayStress * 0.92, 0, 3);
}

function getReserveAwareTieMaxPrice(context) {
  const tuning = getTiedTuning();
  const av = Math.max(1, Number(context.playerAV || 1));
  const baseMaxPrice = getSilentAuctionCap(context.position, av);
  const rosterSpotsLeft = Math.max(0, Math.floor(Number(context.rosterSpotsLeft || 0)));
  // Keep at least $1 for each remaining spot after potentially winning this tie auction.
  const reserveAfterWin = Math.max(0, rosterSpotsLeft - 1);
  const reserveLimitedCap = Math.max(1, Math.floor(Number(context.budgetRemaining || 0) - reserveAfterWin));

  const prerank = Math.max(1, Math.floor(Number(context.playerPrerank || 999)));
  const discountTrigger = Math.max(0.5, Math.min(1, Number(tuning.top10BargainDiscountTrigger || 0.9)));
  const isTop10Bargain = prerank <= 10;

  let finalCap = Math.min(baseMaxPrice, reserveLimitedCap);
  if (isTop10Bargain) {
    const avAllowance = Math.max(0, Math.floor(Number(tuning.top10BargainOverAvAllowance || 1)));
    const top10BargainCap = Math.max(1, Math.round(av + avAllowance));
    // In elite bargain tie wars, allow bidding up near AV even if the normal silent cap is lower.
    finalCap = Math.min(reserveLimitedCap, Math.max(baseMaxPrice, top10BargainCap));
  }

  return Math.max(1, finalCap);
}

// Function to get bid probability in tied auctions using the updated model
function getTiedBidProbability(A, p) {
  const tuning = getTiedTuning();
  const range = avRanges[A];
  if (!range) return 0;
  const { min, max } = range;
  const P0 = Number(tuning.baseBidProb || 0.34);
  if (p > max) return 0;
  const { s1 } = getShapeParams(A);

  // BELOW AV
  if (p <= A) {
    const spanToAv = Math.max(1, A - min);
    const x = (p - min) / spanToAv;
    const prob = P0 * Math.pow(1 + (1 - x), s1) * (1 - 0.24 * x);
    return Math.min(0.95, prob);
  }

  // ABOVE AV - soft psychological cliff near AV, then rapid collapse.
  const overRatio = p / Math.max(1, A);
  const avAnchor = P0 * 0.76;
  const sigmoidProb = 0.92 / (1 + Math.exp((overRatio - 1.02) * 8));
  const dollarsOver = p - A;
  const decay = Math.exp(-0.45 * dollarsOver);
  return Math.min(avAnchor * 0.98, sigmoidProb * decay * (avAnchor / P0));
}

// Generate tied auction probabilities for each AV (1-60) based on the updated formula
// This creates a lookup table for easy customization
const tiedAuctionProbabilities = {};
for (let av = 1; av <= 60; av++) {
    tiedAuctionProbabilities[av] = {};
    const range = avRanges[av];
    if (!range) continue;
    const { min, max } = range;
    for (let bid = min; bid <= max; bid++) {
        const bidProb = getTiedBidProbability(av, bid);
        tiedAuctionProbabilities[av][bid] = {
            backout: Math.round((1 - bidProb) * 100) / 100,
            bid: Math.round(bidProb * 100) / 100
        };
    }
}

// Main function for running a tied auction round
function runTiedAuctionRound(state) {
    const cfg = loadCpuLogicConfig();
    const presetName = cfg && cfg.presetName ? String(cfg.presetName).trim() : 'Unknown';
    
    let {
        cpus,              // array of CPU objects
        currentBid,
        playerAV,
        position,
        round,
        timeLeft
    } = state;

    let active = cpus.filter(c => c.isIn);
    const roundAggressionMap = buildRoundAggressionMap(active, {
      currentBid,
      playerAV,
      position,
      round,
      timeLeft
    });

    if (active.length > 0) {
      const cpuSummary = active.map((cpu) => {
        const need = Number(cpu?.needs?.[position] || 0.5);
        const roundAgg = Number(roundAggressionMap.get(cpu) || 0);
        return `${cpu.name}[uses ${getCpuProfileApproach(cpu)} approach|profile:${getCpuProfileLabel(cpu)}|need:${need.toFixed(2)}|roundAgg:${roundAgg.toFixed(2)}|budget:$${Number(cpu.budget || 0).toFixed(0)}]`;
      }).join(' | ');
      console.log('[CPU TIED AUCTION] Using CPU tuning lab preset: "%s" - %s', presetName, cpuSummary);
      console.log(`[CPU TIED][R${round}] ${position} AV:$${playerAV} bid:$${currentBid} t:${timeLeft}s :: ${cpuSummary}`);
    }

    // No need to recalculate aggression since we use probability-based decisions

    // --- 2. Each CPU decides action ---
    let bidders = [];
    let survivors = [];
    let backoutCandidates = [];

    for (let cpu of active) {
        const decision = decideActionDetailed(cpu, {
            currentBid,
            playerAV,
          playerPrerank: Number(state.playerPrerank || 999),
          position,
            teamsRemaining: active.length,
            round,
            budgetRemaining: cpu.budget,
            rosterSpotsLeft: Number(cpu.rosterSpotsLeft || 0),
            positionNeed: cpu.needs[position] || 0.5,
            timeLeft,
            roundAggression: roundAggressionMap.get(cpu)
        });

        console.log(
          `[CPU TIED][DECISION] ${cpu.name} uses ${getCpuProfileApproach(cpu)} approach (profile=${getCpuProfileLabel(cpu)}) action=${decision.action} roundAgg:${Number(decision.roundAggression || roundAggressionMap.get(cpu) || 0).toFixed(2)} backoutIntent:${Number(decision.backoutIntent || 0).toFixed(2)} need:${Number(cpu?.needs?.[position] || 0.5).toFixed(2)} budget:$${Number(cpu.budget || 0).toFixed(0)}`
        );

        if (decision.action === 'backout') {
            backoutCandidates.push({
              cpu,
              backoutIntent: decision.backoutIntent || 0.5,
              roundAggression: decision.roundAggression || 1
            });
            survivors.push(cpu);
        } else {
            survivors.push(cpu);
            if (decision.action === 'bid') bidders.push(cpu);
        }
    }

    // Only one team can back out per tick; higher intent and lower aggression lean toward backing out.
    if (backoutCandidates.length > 0) {
      const weighted = backoutCandidates.map(candidate => ({
        ...candidate,
        backoutWeight: clamp(
          candidate.backoutIntent * (2.1 - candidate.roundAggression),
          0.05,
          2.5
        )
      }));
      const selected = pickWeightedRandom(weighted, 'backoutWeight');
      selected.cpu.isIn = false;
      survivors = survivors.filter(cpu => cpu !== selected.cpu);
      bidders = bidders.filter(cpu => cpu !== selected.cpu);
    }

    // --- 3. Handle outcomes ---

    // Only one left → wins
    if (survivors.length === 1) {
        return {
            type: 'win',
            winner: survivors[0],
            price: currentBid
        };
    }

    // Multiple bidders → pick one to raise
    if (bidders.length > 0) {
        const aggressor = pickRandomCPU(bidders);
      const maxPrice = getReserveAwareTieMaxPrice({
        currentBid,
        playerAV,
        playerPrerank: Number(state.playerPrerank || 999),
        position,
        budgetRemaining: Number(aggressor?.budget || 0),
        rosterSpotsLeft: Number(aggressor?.rosterSpotsLeft || 0)
      });

      if (currentBid + 1 > maxPrice) {
        aggressor.isIn = false;
        return {
          type: 'hold'
        };
      }

        return {
            type: 'bid',
            bidder: aggressor,
            newBid: currentBid + 1
        };
    }

    // --- 4. No bids → endgame logic (prevents deadlock) ---
    if (timeLeft <= 2 && survivors.length > 1) {
        // Try forcing backouts again with stronger pressure
        let remaining = [];

        for (let cpu of survivors) {
            const ratio = currentBid / playerAV;

            const forcedBackoutProb = Math.min(
                0.95,
                (ratio - 1) * 2 + 0.2
            );

            if (Math.random() > forcedBackoutProb) {
                remaining.push(cpu);
            } else {
                cpu.isIn = false;
            }
        }

        if (remaining.length === 1) {
            return {
                type: 'win',
                winner: remaining[0],
                price: currentBid
            };
        }

        if (remaining.length > 1) {
            // Check if bidding would exceed max price
            const maxPrice = getReserveAwareTieMaxPrice({
              currentBid,
              playerAV,
              playerPrerank: Number(state.playerPrerank || 999),
              position,
              budgetRemaining: Number(remaining[0]?.budget || 0),
              rosterSpotsLeft: Number(remaining[0]?.rosterSpotsLeft || 0)
            });
            if (currentBid + 1 > maxPrice) {
                // Force all remaining to back out since bidding would exceed max
                remaining.forEach(cpu => cpu.isIn = false);
                return {
                    type: 'hold' // All backed out
                };
            }
            // Only 2% chance to force final $1 bid, otherwise force backouts
            if (Math.random() < 0.02) {
                const aggressor = pickRandomCPU(remaining);
                return {
                    type: 'bid',
                    bidder: aggressor,
                    newBid: currentBid + 1
                };
            } else {
                // Force backouts instead
                remaining.forEach(cpu => cpu.isIn = false);
                return {
                    type: 'hold'
                };
            }
        }
    }

    // --- 5. Default: hold ---
    return {
        type: 'hold'
    };
}

// Dynamic aggression calculation - recalculated after every event
function getAggression(cpuTeam, context) {
  const {
    currentBid,
    playerAV,
    teamsRemaining,
    round,
    budgetRemaining,
    positionNeed,
    timeLeft
  } = context;

  const valueRatio = currentBid / playerAV;

  // BASE: willingness to exceed AV drops as price rises
  let score = Math.exp(-4 * Math.max(0, valueRatio - 1));

  // NEED: boosts aggression if roster needs this position
  score *= (0.7 + positionNeed * 0.6); // positionNeed: 0 → 1

  // BUDGET: more money = more flexibility
  const budgetFactor = Math.min(1.2, budgetRemaining / 100);
  score *= budgetFactor;

  // COMPETITION: fewer teams = more aggressive
  const compFactor = 1 + (1 / teamsRemaining);
  score *= compFactor;

  // ROUND CONTEXT: early rounds = less urgency
  const roundFactor = 0.8 + (round / 20);
  score *= roundFactor;

  // ENDGAME PRESSURE: last 2-3 seconds = force decisions
  if (timeLeft <= 3) {
    score *= 1.25;
  }

  return score;
}

// Dynamic decision making per CPU per tick
function decideAction(cpuTeam, context) {
  return decideActionDetailed(cpuTeam, context).action;
}

function decideActionDetailed(cpuTeam, context) {
  // Use the tied auction probabilities lookup table
  const probs = tiedAuctionProbabilities[context.playerAV]?.[context.currentBid];
  const bidProb = probs ? probs.bid : 0;
  const tuning = getTiedTuning();
  const maxPrice = getReserveAwareTieMaxPrice(context);

  // Can't bid if over budget
  if (context.currentBid >= maxPrice) {
    const state = getTieAuctionState(cpuTeam, context);
    updateTieAuctionState(state, 'backout', context, context.currentBid / Math.max(1, context.playerAV));
    return { action: 'backout', backoutIntent: 1, roundAggression: context.roundAggression || getCpuPersonality(cpuTeam).aggression };
  }

  const {
    state,
    bidProb: finalBidProb,
    backoutProb,
    hesitationChance,
    bluffChance,
    overRatio,
    roundAggression
  } = getPsychologyModifiers(cpuTeam, context, bidProb);

  const prerank = Math.max(1, Math.floor(Number(context.playerPrerank || 999)));
  const overRatioNow = context.currentBid / Math.max(1, context.playerAV);
  const discountTrigger = Math.max(0.5, Math.min(1, Number(tuning.top10BargainDiscountTrigger || 0.9)));
  const isTop10Bargain = prerank <= 10;

  if (isTop10Bargain && context.currentBid + 1 <= maxPrice) {
    const baseForceBid = Math.max(0.2, Math.min(0.95, Number(tuning.top10BargainForceBidBase || 0.58)));
    const positionNeedBoost = Number(context.positionNeed || 0) * 0.1;

    // Backout chance rises each $1 step, with a gentle pre-85% slope and stronger post-85% slope.
    const preThresholdStep = clamp((overRatioNow - 0.55) / Math.max(0.08, discountTrigger - 0.55), 0, 1);
    const postThresholdStep = clamp((overRatioNow - discountTrigger) / Math.max(0.08, 1.08 - discountTrigger), 0, 1);

    const progressiveBackoutChance = overRatioNow < discountTrigger
      ? clamp(0.03 + (preThresholdStep * 0.11) + (backoutProb * 0.08), 0.02, 0.22)
      : clamp(0.14 + (postThresholdStep * 0.33) + (backoutProb * 0.18), 0.12, 0.58);

    let progressiveBidChance = overRatioNow < discountTrigger
      ? clamp(baseForceBid + ((1 - preThresholdStep) * 0.2) + positionNeedBoost, 0.64, 0.97)
      : clamp(baseForceBid + ((1 - postThresholdStep) * 0.18) + positionNeedBoost - (postThresholdStep * 0.14), 0.34, 0.88);

    // Keep room for hold decisions so outcomes can settle around AV naturally.
    progressiveBidChance = Math.min(progressiveBidChance, 0.96 - progressiveBackoutChance);

    const eliteRoll = Math.random();
    if (eliteRoll < progressiveBackoutChance) {
      updateTieAuctionState(state, 'backout', context, overRatioNow);
      return {
        action: 'backout',
        backoutIntent: clamp(progressiveBackoutChance + Math.max(0, overRatioNow - 1) * 0.3, 0.06, 1),
        roundAggression
      };
    }

    if (eliteRoll < progressiveBackoutChance + progressiveBidChance) {
      updateTieAuctionState(state, 'bid', context, overRatioNow);
      return { action: 'bid', backoutIntent: progressiveBackoutChance * 0.55, roundAggression };
    }

    updateTieAuctionState(state, 'hold', context, overRatioNow);
    return { action: 'hold', backoutIntent: progressiveBackoutChance * 0.8, roundAggression };
  }

  const roll = Math.random();
  const bluffWindow = context.currentBid <= context.playerAV * 1.02 && state.commitment >= 1 && roll < bluffChance;

  if (roll < backoutProb && !bluffWindow) {
    updateTieAuctionState(state, 'backout', context, overRatio);
    return {
      action: 'backout',
      backoutIntent: clamp(backoutProb + Math.max(0, overRatio - 1) * 0.4, 0.05, 1),
      roundAggression
    };
  }

  if (Math.random() < hesitationChance) {
    updateTieAuctionState(state, 'hold', context, overRatio);
    return { action: 'hold', backoutIntent: backoutProb * 0.5, roundAggression };
  }

  if (roll < backoutProb + finalBidProb || bluffWindow) {
    updateTieAuctionState(state, 'bid', context, overRatio);
    return { action: 'bid', backoutIntent: backoutProb * 0.35, roundAggression };
  }

  updateTieAuctionState(state, 'hold', context, overRatio);
  return { action: 'hold', backoutIntent: backoutProb * 0.45, roundAggression };
}

// Helper function: Pick random CPU from array
function pickRandomCPU(cpuArray) {
  return cpuArray[Math.floor(Math.random() * cpuArray.length)];
}

// Weighted random selection based on aggression scores
function pickWeightedRandom(items, weightProperty) {
    const totalWeight = items.reduce((sum, item) => sum + (item[weightProperty] || 1), 0);
    let random = Math.random() * totalWeight;

    for (const item of items) {
        random -= (item[weightProperty] || 1);
        if (random <= 0) {
            return item;
        }
    }

    // Fallback to first item if something goes wrong
    return items[0];
}

// Helper function: Force a CPU to place a bid
function placeForcedBid(code, auctionId, cpuName, bidAmount, drafts, io) {
  const auction = drafts[code].draftState.liveAuctions[auctionId];
  if (!auction) return;

  console.log(`[TIE BREAKER] Forcing ${cpuName} to bid $${bidAmount}`);

  // Update auction state
  auction.currentBid = bidAmount;
  auction.currentWinner = cpuName;
  auction.bids[cpuName] = bidAmount;
  auction.timer = 10; // Reset timer

  // Broadcast the forced bid
  io.to(`draft_${code}`).emit('liveAuctionBidPlaced', {
    auctionId,
    bidder: cpuName,
    amount: bidAmount,
    forced: true
  });
}

// ==================== LEGACY FUNCTIONS (KEPT FOR COMPATIBILITY) ====================

// Helper function: Determine if CPU should back out of a tie breaker situation
function shouldBackOutFromTie(cpuName, currentBid, playerAV, teams) {
  const ratio = currentBid / playerAV;

  // Under value → almost never back out
  if (ratio <= 1.0) return false;

  // Find the CPU team's risk tolerance
  const cpuTeam = teams.find(t => t.name === cpuName);
  const riskTolerance = cpuTeam ? cpuTeam.riskTolerance || 1.0 : 1.0;

  // Over value → increasing chance to back out, modified by risk tolerance
  const backoutProb = Math.min(0.95, (ratio - 1) * 1.5 / riskTolerance);

  const shouldBackOut = Math.random() < backoutProb;
  console.log(`[TIE BREAKER] ${cpuName} - Ratio: ${ratio.toFixed(2)}, Risk: ${riskTolerance.toFixed(2)}, Prob: ${(backoutProb * 100).toFixed(1)}% → ${shouldBackOut ? 'BACK OUT' : 'STAY'}`);

  return shouldBackOut;
}

// Helper function: Reorder roster by position, then by prerank (lower = better)
function reorderRoster(roster) {
  // Define position priority order for sorting
  const positionOrder = { QB: 1, RB: 2, WR: 3, TE: 4, K: 5, DEF: 6 };

  roster.sort((a, b) => {
    // First sort by position priority
    const posA = positionOrder[a.position] || 99;
    const posB = positionOrder[b.position] || 99;
    if (posA !== posB) {
      return posA - posB;
    }
    // Within same position, sort by prerank (lower = better player)
    return a.prerank - b.prerank;
  });
}

// Export functions for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    runTiedAuctionRound,
    getAggression,
    decideAction,
    getTiedBidProbability,
    tiedAuctionProbabilities,
    pickWeightedRandom,
    pickRandomCPU,
    placeForcedBid,
    shouldBackOutFromTie,
    reorderRoster,
    tiedLiveAuctionBidRanges
  };
}