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

const DEFAULT_SILENT_TUNING = {
  baseAggression: 0.5,
  budgetRichBoost: 0.2,
  budgetPoorReduction: 0.2,
  rosterTightBoost: 0.15,
  rosterLooseReduction: 0.1,
  emergencyStarterBoost: 0.18,
  finalRoundFillBoost: 0.22,
  earlyRoundReduction: 0.08,
  richEarlyBoost: 0.32,
  lateRoundAggressionBoost: 0.4,
  midRoundVarianceMax: 0.2,
  lateRoundVarianceMax: 0.4,
  personalityVarianceStep: 0.1,
  roundVarianceMax: 0.15,
  maxAggressionCap: 0.95,
  avCenteringStrength: 0.9,
  marketSensitivity: 0.7
};

const DEFAULT_SILENT_PROFILES = [
  { aggression: 1.15, valueHunter: 0.92, sleeperHunter: 0.95, starsAndScrubs: 1.18, QB: 0.95, RB: 1.15, WR: 1.0, TE: 0.95, K: 0.85, DEF: 0.9 },
  { aggression: 0.94, valueHunter: 1.15, sleeperHunter: 1.12, starsAndScrubs: 0.9, QB: 1.0, RB: 0.95, WR: 1.08, TE: 1.0, K: 0.95, DEF: 0.95 },
  { aggression: 1.02, valueHunter: 1.0, sleeperHunter: 1.25, starsAndScrubs: 0.96, QB: 0.92, RB: 1.0, WR: 1.15, TE: 1.08, K: 0.95, DEF: 0.9 },
  { aggression: 1.08, valueHunter: 0.98, sleeperHunter: 1.0, starsAndScrubs: 1.08, QB: 1.08, RB: 0.94, WR: 1.0, TE: 1.12, K: 0.9, DEF: 1.0 },
  { aggression: 0.9, valueHunter: 1.18, sleeperHunter: 1.08, starsAndScrubs: 0.88, QB: 1.0, RB: 1.05, WR: 0.96, TE: 1.0, K: 1.0, DEF: 1.05 }
];

function loadCpuLogicConfig() {
  try {
    delete require.cache[require.resolve('./cpulogic')];
    return require('./cpulogic') || {};
  } catch (_error) {
    return {};
  }
}

const ROUND_COMMITMENT_CURVE = {
  1: 0.64,
  2: 0.69,
  3: 0.73,
  4: 0.76,
  5: 0.79,
  6: 0.84,
  7: 0.89,
  8: 0.93,
  9: 0.97,
  10: 1.0
};

const ROUND_COMMITMENT_MODE = {
  A: { pullToAverage: 0.25, situationalSwing: 0.11 },
  B: { pullToAverage: 0.55, situationalSwing: 0.08 },
  C: { pullToAverage: 0.82, situationalSwing: 0.05 }
};

function normalizeCommitmentMode(modeRaw = '') {
  const mode = String(modeRaw || '').trim().toUpperCase();
  return ROUND_COMMITMENT_MODE[mode] ? mode : 'B';
}

function getRoundCommitTargetPct(roundNumber) {
  const round = Math.max(1, Math.min(draftRoundCount, Number(roundNumber) || 1));
  return Number(ROUND_COMMITMENT_CURVE[round] || 0.64);
}

function rebalanceFinalRoundCpuBids(cpuBids, cpuTeams, roundPlayers, rosterLimits, maxRosterSize, roundNumber, teamStrategies = {}, commitmentMode = 'B') {
  const cfg = loadCpuLogicConfig();
  const cfgSilent = cfg?.silent || {};
  const round = Math.max(1, Math.min(draftRoundCount, Number(roundNumber) || 1));
  const baseTargetPct = getRoundCommitTargetPct(round);
  const modeKey = normalizeCommitmentMode(commitmentMode);
  const modeCfg = ROUND_COMMITMENT_MODE[modeKey];
  const variationFloor = 0.10;

  const teamMap = new Map((cpuTeams || []).map(team => [String(team && team.name || ''), team]));
  const availablePlayers = Array.isArray(roundPlayers) ? roundPlayers : [];
  const targetPctByTeam = {};
  let changedTeams = 0;

  // Build a first-pass team target to preserve situational behavior.
  Object.keys(cpuBids || {}).forEach((teamName) => {
    const team = teamMap.get(String(teamName || '').trim());
    const budgetRemaining = Math.max(0, Number(team && team.budget || 0));
    if (budgetRemaining <= 0) {
      targetPctByTeam[teamName] = 0;
      return;
    }

    if (round >= draftRoundCount) {
      targetPctByTeam[teamName] = 1;
      return;
    }

    const strategy = teamStrategies && typeof teamStrategies === 'object'
      ? (teamStrategies[teamName] || {})
      : {};

    const needRatio = Number(strategy.needRatio || 0); // >1 means behind
    const completionPressure = Number(strategy.completionPressure || 0); // 0..40
    const isBehindPace = !!strategy.isBehindPace;
    const isAheadOfPace = !!strategy.isAheadOfPace;
    const rosterPressure = Number(strategy.rosterPressure || 0);
    const deterministicNoise = (getTeamSeed(teamName) % 1000) / 1000; // 0..1
    const centeredNoise = (deterministicNoise - 0.5) * 2; // -1..1

    let situational = 0;
    situational += Math.max(-1, Math.min(1.4, needRatio - 0.8)) * 0.08;
    situational += Math.max(0, (completionPressure - 10) / 30) * 0.08;
    situational += Math.max(0, (rosterPressure - 0.7)) * 0.06;
    if (isBehindPace) situational += 0.03;
    if (isAheadOfPace) situational -= 0.03;
    situational += centeredNoise * modeCfg.situationalSwing;

    const minPct = Math.max(0.05, baseTargetPct - variationFloor);
    const maxPct = Math.min(0.99, baseTargetPct + variationFloor);
    const firstPassPct = Math.max(minPct, Math.min(maxPct, baseTargetPct + situational));
    targetPctByTeam[teamName] = firstPassPct;
  });

  // Pull average commitment toward the round target. Mode A is soft, C is strong.
  const targetRows = Object.values(targetPctByTeam).filter(v => Number.isFinite(v) && v > 0);
  if (round < draftRoundCount && targetRows.length > 0) {
    const currentAvg = targetRows.reduce((sum, v) => sum + v, 0) / targetRows.length;
    const avgDelta = (baseTargetPct - currentAvg) * modeCfg.pullToAverage;
    Object.keys(targetPctByTeam).forEach((teamName) => {
      const minPct = Math.max(0.05, baseTargetPct - variationFloor);
      const maxPct = Math.min(0.99, baseTargetPct + variationFloor);
      const adjusted = Number(targetPctByTeam[teamName] || 0) + avgDelta;
      targetPctByTeam[teamName] = Math.max(minPct, Math.min(maxPct, adjusted));
    });
  }

  Object.entries(cpuBids || {}).forEach(([teamName, bids]) => {
    const team = teamMap.get(String(teamName || '').trim());
    const strategy = teamStrategies && typeof teamStrategies === 'object'
      ? (teamStrategies[teamName] || {})
      : {};
    const starredTargetIds = strategy?.starredTargetIds instanceof Set ? strategy.starredTargetIds : new Set();
    const budgetRemaining = Math.max(0, Number(team && team.budget || 0));
    if (budgetRemaining <= 0) return;

    const targetPct = round >= draftRoundCount
      ? 1
      : Number(targetPctByTeam[teamName] || baseTargetPct);
    const targetCommit = round >= draftRoundCount
      ? budgetRemaining
      : Math.max(1, Math.min(budgetRemaining, Math.round(budgetRemaining * targetPct)));

    const normalizedBids = Array.isArray(bids) ? bids.filter(entry => entry && entry.player).map(entry => ({
      player: entry.player,
      cpuBid: Math.max(0, Math.floor(Number(entry.cpuBid || 0)))
    })) : [];

    const validBids = normalizedBids.filter(entry => Number(entry.cpuBid || 0) > 0);

    if (validBids.length === 0) {
      const strictlyValidFallback = [...availablePlayers]
        .filter(player => isValidRosterAddition(team, player, rosterLimits, maxRosterSize))
        .sort((a, b) => Number(b.avgValue || 0) - Number(a.avgValue || 0))[0] || null;
      const softFallback = [...availablePlayers]
        .sort((a, b) => Number(b.avgValue || 0) - Number(a.avgValue || 0))[0] || null;
      const fallbackPlayer = strictlyValidFallback || softFallback;

      if (!fallbackPlayer) return;

      cpuBids[teamName] = [{ player: fallbackPlayer, cpuBid: targetCommit }];
      changedTeams += 1;
      return;
    }

    const sortedBids = [...validBids]
      .sort((a, b) => Number(b.cpuBid || 0) - Number(a.cpuBid || 0) || Number(b.player?.avgValue || 0) - Number(a.player?.avgValue || 0));

    const totalWeight = sortedBids.reduce((sum, entry) => sum + Math.max(1, Number(entry.cpuBid || 0)), 0);
    if (totalWeight <= 0) return;

    const allocations = sortedBids.map(entry => {
      const weight = Math.max(1, Number(entry.cpuBid || 0));
      const exact = (targetCommit * weight) / totalWeight;
      const isTargetPlayer = starredTargetIds.has(getPlayerIdKey(entry.player));
      const bidCap = getHardPlayerBidCap(entry.player, round, budgetRemaining, cfgSilent, {
        isTargetPlayer,
        isMustFillPosition: false
      });
      const floored = Math.max(1, Math.min(Math.floor(exact), bidCap));
      return {
        player: entry.player,
        cpuBid: floored,
        remainder: exact - floored,
        bidCap
      };
    });

    let allocatedTotal = allocations.reduce((sum, entry) => sum + Number(entry.cpuBid || 0), 0);
    let remaining = targetCommit - allocatedTotal;

    if (remaining > 0) {
      const sortedByRemainder = [...allocations].sort((a, b) => b.remainder - a.remainder || Number(b.player?.avgValue || 0) - Number(a.player?.avgValue || 0));
      let cursor = 0;
      let guard = 0;
      while (remaining > 0 && sortedByRemainder.length > 0 && guard < 5000) {
        const candidate = sortedByRemainder[cursor % sortedByRemainder.length];
        if (Number(candidate.cpuBid || 0) < Number(candidate.bidCap || budgetRemaining)) {
          candidate.cpuBid += 1;
          remaining -= 1;
        }
        cursor += 1;
        guard += 1;
        if (guard % sortedByRemainder.length === 0) {
          const anyRoom = sortedByRemainder.some((entry) => Number(entry.cpuBid || 0) < Number(entry.bidCap || budgetRemaining));
          if (!anyRoom) break;
        }
      }
    } else if (remaining < 0) {
      const sortedByBid = [...allocations].sort((a, b) => Number(b.cpuBid || 0) - Number(a.cpuBid || 0) || Number(b.player?.avgValue || 0) - Number(a.player?.avgValue || 0));
      let deficit = Math.abs(remaining);
      let cursor = 0;
      while (deficit > 0 && sortedByBid.length > 0) {
        const entry = sortedByBid[cursor % sortedByBid.length];
        if (entry.cpuBid > 1) {
          entry.cpuBid -= 1;
          deficit -= 1;
        }
        cursor += 1;
        if (cursor > 5000) break;
      }
    }

    cpuBids[teamName] = allocations
      .filter(entry => Number(entry.cpuBid || 0) > 0)
      .map(entry => ({ player: entry.player, cpuBid: Math.max(1, Math.floor(entry.cpuBid || 0)) }));
    changedTeams += 1;
  });

  return changedTeams;
}

function getSilentTuning() {
  const cfg = loadCpuLogicConfig();
  return {
    ...DEFAULT_SILENT_TUNING,
    ...(cfg && cfg.silent && typeof cfg.silent === 'object' ? cfg.silent : {})
  };
}

function getSilentProfiles() {
  const cfg = loadCpuLogicConfig();
  if (Array.isArray(cfg?.silentProfiles) && cfg.silentProfiles.length) {
    return cfg.silentProfiles;
  }
  return DEFAULT_SILENT_PROFILES;
}

function getRawAvValue(playerOrAvgValue) {
  if (playerOrAvgValue && typeof playerOrAvgValue === 'object') {
    return Number(playerOrAvgValue.avgValue || 0);
  }
  return Number(playerOrAvgValue || 0);
}

function getCpuEffectiveAv(playerOrAvgValue) {
  return Math.max(1, getRawAvValue(playerOrAvgValue));
}

function isTrueZeroAv(playerOrAvgValue) {
  return getRawAvValue(playerOrAvgValue) <= 0;
}

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
    const cfg = loadCpuLogicConfig();
    const dynamicRanges = cfg && cfg.silentBidRanges && typeof cfg.silentBidRanges === 'object'
      ? cfg.silentBidRanges
      : silentAuctionBidRanges;
    const ranges = useServerRanges ? serverSilentAuctionBidRanges : dynamicRanges;
    const rangeKey = getRangeKey(avgValue);
    return ranges[position]?.[rangeKey] || { min: 0.5, max: 1.5 };
}

function isValidRosterAddition(team, player, rosterLimits = null, maxRosterSize = null) {
  if (!team || !player) return false;

  const roster = team.roster || [];
  const limitConfig = rosterLimits || {};

  if (typeof maxRosterSize === 'number' && roster.length >= maxRosterSize) {
    return false;
  }

  const position = player.position;
  const positionCounts = getRosterPositionCounts(team);
  const currentAtPosition = positionCounts[position] || 0;
  const configuredMax = limitConfig?.[position]?.max;
  const hasConfiguredMax = typeof configuredMax === 'number';

  if (position === 'K' || position === 'DEF') {
    const configuredMin = Number(limitConfig?.[position]?.min || 1);
    const minimumSpecialists = Math.max(1, configuredMin);
    const inferredMaxRoster = typeof maxRosterSize === 'number'
      ? maxRosterSize
      : getMaxRosterSize(roster.length);
    const nearFullRoster = roster.length >= Math.max(1, inferredMaxRoster - 2);
    const dynamicSpecialistCap = minimumSpecialists + (nearFullRoster ? 1 : 0);
    const specialistCap = hasConfiguredMax
      ? Math.min(configuredMax, dynamicSpecialistCap)
      : dynamicSpecialistCap;
    return currentAtPosition < specialistCap;
  }

  if (hasConfiguredMax && currentAtPosition >= configuredMax) {
    return false;
  }

  // Default hard caps when explicit max values are absent.
  // Keep specialists to one and cap QB at two.
  if (!hasConfiguredMax && (position === 'K' || position === 'DEF') && currentAtPosition >= 1) {
    return false;
  }

  if (position === 'QB') {
    const qbRoster = roster
      .filter(rosterPlayer => rosterPlayer.position === 'QB')
      .map(rosterPlayer => Number(rosterPlayer.avgValue || 0))
      .sort((a, b) => b - a);

    // Never allow more than two QBs.
    if (qbRoster.length >= 2) {
      return false;
    }

    // Always allow the first QB.
    if (qbRoster.length === 0) {
      return true;
    }

    const bestExistingQB = qbRoster[0] || 0;
    const worstExistingQB = qbRoster[qbRoster.length - 1] || 0;
    const candidateQBValue = Number(player.avgValue || 0);
    const upgradeVsBest = candidateQBValue - bestExistingQB;
    const upgradeVsWorst = candidateQBValue - worstExistingQB;

    const inferredMaxRoster = typeof maxRosterSize === 'number'
      ? maxRosterSize
      : getMaxRosterSize(roster.length);
    const openSlots = getOpenSlots(team, inferredMaxRoster);
    const { totalMissing } = getMissingStarterCounts(team, limitConfig);

    const hasEliteStarterQB = bestExistingQB >= 35;
    const stillFillingStarters = totalMissing > 0;
    const endgameBenchFill = !stillFillingStarters && openSlots <= 2;

    // With an elite QB, avoid second QB unless meaningful upgrade or true endgame fill.
    if (hasEliteStarterQB && upgradeVsBest < 6 && !endgameBenchFill) {
      return false;
    }

    // General second-QB rule: require clear upgrade signal.
    if (upgradeVsWorst < 5 && !endgameBenchFill) {
      return false;
    }

    // If starter requirements at other positions are unfinished, block luxury backup QB buys.
    if (stillFillingStarters && upgradeVsWorst < 10) {
      return false;
    }
  }

  if (position === 'TE') {
    const teRoster = roster
      .filter(rosterPlayer => rosterPlayer.position === 'TE')
      .map(rosterPlayer => Number(rosterPlayer.avgValue || 0))
      .sort((a, b) => b - a);

    // Keep TE behavior similar to QB: never more than two.
    if (teRoster.length >= 2) {
      return false;
    }

    // Always allow the first TE.
    if (teRoster.length === 0) {
      return true;
    }

    const bestExistingTE = teRoster[0] || 0;
    const worstExistingTE = teRoster[teRoster.length - 1] || 0;
    const candidateTEValue = Number(player.avgValue || 0);
    const upgradeVsBest = candidateTEValue - bestExistingTE;
    const upgradeVsWorst = candidateTEValue - worstExistingTE;

    const inferredMaxRoster = typeof maxRosterSize === 'number'
      ? maxRosterSize
      : getMaxRosterSize(roster.length);
    const openSlots = getOpenSlots(team, inferredMaxRoster);
    const { totalMissing } = getMissingStarterCounts(team, limitConfig);

    const hasEliteStarterTE = bestExistingTE >= 26;
    const stillFillingStarters = totalMissing > 0;
    const endgameBenchFill = !stillFillingStarters && openSlots <= 2;

    if (hasEliteStarterTE && upgradeVsBest < 5 && !endgameBenchFill) {
      return false;
    }

    if (upgradeVsWorst < 4 && !endgameBenchFill) {
      return false;
    }

    if (stillFillingStarters && upgradeVsWorst < 8) {
      return false;
    }
  }

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
const defaultCompletedRosterSize = 14;

// ============================================================
// GM CONFIDENCE METER
// Each CPU team starts at 100% confidence in their draft plan.
// Every time a starred/wanted player gets taken by a rival:
//   confidence -= 12 points
// Lower confidence → less picky, bids more broadly, reaches for value
// (Persists across rounds for the entire draft session)
// ============================================================
const gmConfidenceMeter = {};

// Calculate required pace per round for a given target roster size and total rounds
function calculateRequiredPacePerRound(targetRosterSize, totalRounds) {
  return targetRosterSize / Math.max(1, totalRounds);
}

// Calculate expected roster size at current round if team is on pace
function getExpectedRosterSizeAtRound(roundNumber, targetRosterSize, totalRounds) {
  const requiredPace = calculateRequiredPacePerRound(targetRosterSize, totalRounds);
  const paceProjection = requiredPace * roundNumber;
  const earlyRoundCutoff = Math.ceil(totalRounds * 0.6);
  const expected = roundNumber <= earlyRoundCutoff
    ? Math.ceil(paceProjection)
    : Math.floor(paceProjection);
  return Math.min(targetRosterSize, expected);
}

// Calculate pace variance (how far behind/ahead of pace is the team?)
function calculatePaceVariance(team, roundNumber, targetRosterSize, totalRounds) {
  const currentSize = team.roster ? team.roster.length : 0;
  const expectedSize = getExpectedRosterSizeAtRound(roundNumber, targetRosterSize, totalRounds);
  return currentSize - expectedSize; // Negative = behind, positive = ahead
}

// Players a team must win per remaining round to reach target roster size.
function calculateRequiredWinsPerRound(currentRosterSize, targetRosterSize, roundsIncludingCurrent) {
  const playersNeeded = Math.max(0, targetRosterSize - currentRosterSize);
  return playersNeeded / Math.max(1, roundsIncludingCurrent);
}

// Determine bidding urgency based on pace
function getPaceAdjustment(paceVariance, roundsLeft) {
  // If significantly behind pace, be aggressive
  if (paceVariance < -2) return 0.25; // Very behind: +0.25 aggressiveness
  if (paceVariance < -1) return 0.15; // Behind: +0.15
  if (paceVariance < 0) return 0.08; // Slightly behind: +0.08
  if (paceVariance === 0) return 0; // On pace: no adjustment
  
  // If ahead of pace in early rounds, relax a bit
  if (roundsLeft > 5 && paceVariance > 1) return -0.12;
  if (roundsLeft > 3 && paceVariance > 2) return -0.08;
  
  return 0;
}

// ============================================================
// DRAFT COMPLETION AI
//
// The core idea:
//   Aggression (bid amount) stays stable throughout the draft.
//   What changes is the INTEREST THRESHOLD — which players
//   qualify as "worth bidding on at all."
//
// Early draft:  high standards (only bid on 75%+ value players)
// Mid draft:    standards drop slightly as roster gaps emerge
// Late/behind:  almost anything qualifies — CPU joins auctions
//               to catch up, NOT to overbid on individual players
//
// This separates:
//   Participation  → rises when behind (interestThreshold drops)
//   Escalation     → stays fixed (baseBid unchanged)
// ============================================================

/**
 * completionPressure: aggregate score of how far behind the CPU is.
 *
 * Feeds into:
 *   - interestThreshold  (lowers acceptable player bar)
 *   - maxBids            (enter more auctions)
 * Does NOT feed into:
 *   - baseBid / bid amounts (aggression stays stable)
 */
function calculateCompletionPressure(currentRosterSize, paceVariance, leagueAvgRosterSize, rosterPressure) {
  // How many roster slots behind expected pace (from paceVariance)
  const behindPace = Math.max(0, -paceVariance);
  
  // How many slots behind league average
  const behindLeague = Math.max(0, leagueAvgRosterSize - currentRosterSize);
  
  // Diminishing desperation curve: each additional slot behind adds less
  // +6 for 1st slot, +5 for 2nd, +4 for 3rd, +3 for 4th, +2 for 5th+ (max ~20)
  function diminishingPenalty(slots) {
    const steps = [6, 5, 4, 3, 2];
    let total = 0;
    for (let i = 0; i < Math.min(Math.ceil(slots), steps.length); i++) {
      total += steps[i] * Math.min(1, slots - i); // Fractional for partial slots
    }
    return total;
  }
  
  const pacePenalty = diminishingPenalty(behindPace);
  const leaguePenalty = diminishingPenalty(behindLeague) * 0.5; // League gap less urgent than pace
  const emergencyPenalty = rosterPressure > 1.0 ? 20 : 0; // Impossible to finish = max pressure
  
  // Total is on 0–40 scale (caps naturally via diminishing returns)
  return Math.min(40, pacePenalty + leaguePenalty + emergencyPenalty);
}

/**
 * minimumInterest: acceptance threshold on a 40–88 scale.
 *   88 = very selective (comfortable, early draft)
 *   70 = normal late draft
 *   55 = behind, casting a wider net
 *   40 = emergency, bid on almost anything that fits the roster
 */
function calculateMinimumInterest(completionPressure) {
  // Each unit of completionPressure drops threshold by ~1.8 points.
  // Lower floor increases participation for behind teams in rounds 6-10.
  return Math.max(30, 90 - completionPressure * 1.8);
}

/**
 * Round-aware threshold bias for player consideration.
 * Early rounds should be a bit more selective to avoid overbidding on the opening wave.
 * Later rounds should loosen slightly so CPU teams stay involved and continue to compete.
 */
function calculateRoundThresholdBias(roundNumber) {
  const round = Math.max(1, Math.min(10, Number(roundNumber) || 1));

  if (round === 1) return 0.06;
  if (round === 2) return 0.03;
  if (round === 3) return 0.01;
  if (round >= 6) return -0.03;
  if (round === 4) return 0;
  if (round === 5) return -0.01;
  return 0;
}

/**
 * Convert minimumInterest (40–88) to teamValue threshold (0.20–0.75).
 * The teamValue scale used inside valuedPlayers.filter().
 */
function minimumInterestToThreshold(minimumInterest) {
  const normalized = Math.max(0, Math.min(1, (minimumInterest - 30) / 60)); // 0 at 30, 1 at 90
  return 0.12 + normalized * 0.62; // 0.12 (emergency) → 0.74 (comfortable)
}

// PASS-FIRST participation gate.
// Higher score = easier to pass. Negative score = must participate.
// This intentionally affects participation only, not bid amount math.
function calculatePassScore(strategy, team, bidAmount, maxRosterSize) {
  const roundsIncludingCurrent = Math.max(1, Number(strategy?.roundsIncludingCurrent || draftRoundCount));
  const currentRosterSize = (team?.roster || []).length;
  const expectedRosterSize = Math.max(
    0,
    Number(strategy?.targetRosterSize || defaultCompletedRosterSize) - Number(strategy?.playersNeededForPace || 0)
  );

  // Base pass chance decays as draft advances (passing gets harder naturally).
  const basePassChance = 1.1 - ((draftRoundCount - roundsIncludingCurrent) * 0.12);

  // Positive factors (encourage passing)
  const rosterComfort = Math.max(0, Number(strategy?.paceVariance || 0)) * 0.65;
  const effectiveBudgetNow = Math.max(1, getEffectiveBudget(team, 0, maxRosterSize));
  const budgetFear = Math.max(0, (Number(bidAmount || 0) / effectiveBudgetNow) - 0.22) * 4.2;

  // Negative factors (discourage passing)
  const rosterPressurePenalty = Math.max(0, Number(strategy?.rosterPressure || 0)) * 1.6;
  const emptyRosterPenalty = currentRosterSize === 0 ? 2.4 : currentRosterSize <= 2 ? 1.2 : 0;
  const missStreakPenalty = Math.max(0, (100 - Number(strategy?.gmConfidence || 100)) / 25);
  const leagueAvg = Number(strategy?.leagueAvgRosterSize || currentRosterSize);
  const leagueBehindPenalty = Math.max(0, leagueAvg - currentRosterSize) * 0.7;
  const completionPressurePenalty = Math.max(0, Number(strategy?.completionPressure || 0)) * 0.08;
  const remainingRosterRisk = Math.max(0, expectedRosterSize - currentRosterSize) * 0.22;

  return (
    basePassChance
    + rosterComfort
    + budgetFear
    - rosterPressurePenalty
    - emptyRosterPenalty
    - missStreakPenalty
    - leagueBehindPenalty
    - completionPressurePenalty
    - remainingRosterRisk
  );
}

// ============================================================
// ROSTER PRESSURE (raw ratio, used by Brain 2)
// rosterPressure = requiredSpots / roundsRemaining
//   < 0.5  → comfortable
//   0.5–1.0 → danger — every round counts
//   > 1.0  → emergency — impossible to fill all gaps in time
// ============================================================
function calculateRosterPressure(requiredSpots, roundsRemaining) {
  if (roundsRemaining <= 0) return requiredSpots > 0 ? 9.99 : 0;
  return requiredSpots / Math.max(1, roundsRemaining);
}

// ============================================================
// BRAIN 3: POSITION SCARCITY
// Measures supply vs demand for a given position.
// scarcity = remainingPlayersAtPosition / teamsStillNeedingPosition
//
//   > 1.5  → abundant - no urgency
//   1.0-1.5 → comfortable - but keep an eye on it
//   0.7-1.0 → tight - grab one soon
//   < 0.7  → PANIC - fewer players remaining than teams that need them
// ============================================================
function calculatePositionScarcity(position, roundPlayers, cpuTeams, rosterLimits) {
  const remaining = (roundPlayers || []).filter(p => !p.owner && p.position === position).length;
  const teamsNeeding = (cpuTeams || []).filter(t => {
    const counts = getRosterPositionCounts(t);
    return (counts[position] || 0) < getPositionMinimum(position, rosterLimits);
  }).length;
  if (teamsNeeding === 0) return 2.0; // Nobody needs this position - no scarcity
  return remaining / teamsNeeding;    // < 1.0 = scarce, < 0.7 = panic
}

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
  return Math.max(1, (rosterSize || 0) + 3);
}

function getRosterCompletionTargets(baseRosterSize, maxRosterSize) {
  const baseTarget = Math.max(1, Number(baseRosterSize || defaultCompletedRosterSize));
  const effectiveMax = Math.max(baseTarget, Number(maxRosterSize || getMaxRosterSize(baseTarget)));
  const floorTarget = Math.max(1, Math.min(baseTarget, baseTarget - 2));
  const stretchTarget = Math.min(effectiveMax, baseTarget + 3);
  return {
    baseTarget,
    floorTarget,
    stretchTarget
  };
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
  const profiles = getSilentProfiles();
  const profile = profiles[getTeamSeed(teamName) % profiles.length];
  return { ...profile };
}

function getTeamProfileLabel(teamName, personality = null) {
  const profiles = getSilentProfiles();
  const profileCount = Math.max(1, profiles.length);
  const profileIndex = getTeamSeed(teamName) % profileCount;
  const source = personality || profiles[profileIndex] || {};
  const profileName = source && source.name ? source.name : `Profile-${profileIndex + 1}`;
  return `${profileName}#${profileIndex + 1}`;
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
    if (benchRB >= 3) return 0.95;
  }
  if (player.position === 'WR') {
    if (benchWR <= 1) return 1.25;
    if (benchWR >= 3) return 0.95;
  }

  if (player.position === 'TE') {
    if (benchTE >= 1) return 0.55;
    if (benchRB + benchWR >= 4) return 1.08;
  }

  if (player.position === 'QB') {
    const bestQB = Math.max(
      0,
      ...(team.roster || [])
        .filter(rosterPlayer => rosterPlayer.position === 'QB')
        .map(rosterPlayer => Number(rosterPlayer.avgValue || 0))
    );
    if (bestQB >= 35) return 0.58;
    if (benchQB >= 1) return 0.7;
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
  const missingStarterCount = Math.max(0, Number(strategy?.missingStarterCount || 0));
  const startersCompleted = missingStarterCount === 0;

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

  // Post-starter phase: allocate remaining bench budget toward real upgrades.
  // This keeps behavior purposeful once minimum starters are in place.
  if (startersCompleted && openSlots > 0) {
    const upgradeFloor = Number(player?.avgValue || 0) >= 14 ? 3 : 2;
    const canAffordUpgradeSwing = budgetPerSlot >= Math.max(5, (Number(player?.avgValue || 0) * 0.5));

    if (upgradeGap >= upgradeFloor && canAffordUpgradeSwing) {
      multiplier += 0.16;
      if (budgetPerSlot >= 12 && upgradeGap >= 6) {
        multiplier += 0.12;
      }
    } else if (upgradeGap < 2 && budgetPerSlot < 10) {
      // If not a meaningful upgrade, preserve budget for better bench upgrades later.
      multiplier *= 0.9;
    }
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

function getTeamBidDiversityMultiplier(teamName, player, roundNumber) {
  const safeTeam = String(teamName || '');
  const safePlayerId = Number(player?.id || 0);
  const teamSeed = getTeamSeed(safeTeam);
  const teamBias = ((teamSeed % 13) - 6) * 0.003; // ~ -1.8% to +1.8%
  const playerNoise = (getTeamPlayerNoise(safeTeam, safePlayerId, roundNumber) - 0.5) * 0.04; // ~ -2% to +2%
  const roundWave = (((Number(roundNumber) || 1) % 4) - 1.5) * 0.0025; // ~ -0.4% to +0.6%

  const raw = 1 + teamBias + playerNoise + roundWave;
  return Math.max(0.955, Math.min(1.045, raw));
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
  const manualStarTargetsByTeam = (options && typeof options.manualStarTargetsByTeam === 'object' && options.manualStarTargetsByTeam)
    ? options.manualStarTargetsByTeam
    : {};
  const forceRebuild = !!options.forceRebuild;
  const overlapChance = typeof options.overlapChance === 'number'
    ? options.overlapChance
    : rollCpuStarOverlapChance();

  const assignmentOrder = shuffledCopy(cpuTeams || []);

  assignmentOrder.forEach(team => {
    const teamName = String(team?.name || '');
    if (!teamName) return;

    const manualTargets = Array.isArray(manualStarTargetsByTeam[teamName])
      ? manualStarTargetsByTeam[teamName].map(getPlayerIdKey).filter(Boolean)
      : [];

    if (manualTargets.length > 0) {
      const uniqueManualTargets = [...new Set(manualTargets)];
      team.__cpuStarTargetIds = uniqueManualTargets;
      assignedByTeam[teamName] = new Set(uniqueManualTargets);
      return;
    }

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
  const pool = (availablePlayers || []).slice(0, Math.min(30, availablePlayers.length));
  if (pool.length === 0 || maxBids <= 0) {
    return [];
  }

  const sampled = weightedRandomSample(
    pool,
    Math.min(maxBids, pool.length),
    entry => {
      const playerId = entry?.player?.id;
      const exposureCount = playerExposureCounts[playerId] || 0;
      const exposurePenalty = 1 / (1 + (exposureCount * 0.85));
      const noise = 0.82 + (getTeamPlayerNoise(teamName, playerId, roundNumber) * 0.45);
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

function enforceRoundAuctionCoverage(cpuBids, cpuTeams, roundPlayers, teamStrategies, rosterLimits, maxRosterSize, roundNumber) {
  const cfg = loadCpuLogicConfig();
  const coverageAddCapBase = Math.max(0, Math.floor(Number(cfg?.silent?.coverageAddCap ?? 10)));
  const coverageDraftChanceFloorRaw = Number(cfg?.silent?.coverageDraftChanceFloor ?? 0.5);
  const coverageDraftChanceFloor = Math.max(0, Math.min(1, coverageDraftChanceFloorRaw > 1 ? (coverageDraftChanceFloorRaw / 100) : coverageDraftChanceFloorRaw));
  const normalizeDraftChance = (player) => {
    const raw = Number(player?.draftChance ?? 0);
    if (!Number.isFinite(raw) || raw <= 0) return 0;
    return raw > 1 ? Math.max(0, Math.min(1, raw / 100)) : Math.max(0, Math.min(1, raw));
  };
  const safeBids = cpuBids && typeof cpuBids === 'object' ? cpuBids : {};
  const safeTeams = Array.isArray(cpuTeams) ? cpuTeams : [];
  const availablePlayers = (roundPlayers || []).filter(player => player && !player.owner);
  if (availablePlayers.length === 0 || safeTeams.length === 0) return 0;

  const coveredPlayerIds = new Set();
  Object.values(safeBids).forEach((teamBidList) => {
    (teamBidList || []).forEach((bid) => {
      const playerId = Number(bid?.player?.id);
      if (playerId > 0) coveredPlayerIds.add(playerId);
    });
  });

  const uncoveredPlayers = availablePlayers.filter(player => !coveredPlayerIds.has(Number(player.id)));
  const lateRoundCoverageBoost = Number(roundNumber) >= 7 ? 2 : 0;
  const coverageAddCap = coverageAddCapBase + lateRoundCoverageBoost;
  let coverageAdds = 0;

  for (const player of uncoveredPlayers) {
    if (coverageAdds >= coverageAddCap) break;
    if (Number(roundNumber) <= 2 && normalizeDraftChance(player) < coverageDraftChanceFloor) {
      continue;
    }

    const candidates = safeTeams
      .map((team) => {
        const teamName = String(team?.name || '');
        const strategy = teamStrategies?.[teamName] || {};
        const teamBidList = safeBids[teamName] || [];
        if (!teamName || teamBidList.some(entry => Number(entry?.player?.id) === Number(player.id))) {
          return null;
        }

        const targetRoster = Number(strategy.targetRosterSize || maxRosterSize);
        const rosterCount = Array.isArray(team?.roster) ? team.roster.length : 0;
        if (rosterCount >= targetRoster) return null;
        if (!isValidRosterAddition(team, player, rosterLimits, maxRosterSize)) return null;

        const committed = teamBidList.reduce((sum, bid) => sum + Math.max(0, Number(bid?.cpuBid || 0)), 0);
        const reserveBypass = Number(roundNumber) >= 6
          || Number(strategy.needRatio || 0) >= 0.75
          || Number(strategy.playersNeededForMinimum || 0) >= Number(strategy.roundsIncludingCurrent || draftRoundCount);
        const budgetNow = getBidBudgetForTeam(team, committed, maxRosterSize, reserveBypass);
        if (budgetNow < 1) return null;

        const missingByPosition = getMissingStarterCounts(team, rosterLimits).missingByPosition || {};
        return {
          team,
          teamName,
          strategy,
          budgetNow,
          bidCount: teamBidList.length,
          missingAtPosition: Number(missingByPosition[player.position] || 0),
          rosterCount
        };
      })
      .filter(Boolean)
      .sort((a, b) => {
        if (b.missingAtPosition !== a.missingAtPosition) return b.missingAtPosition - a.missingAtPosition;
        const aNeedRatio = Number(a.strategy?.needRatio || 0);
        const bNeedRatio = Number(b.strategy?.needRatio || 0);
        if (bNeedRatio !== aNeedRatio) return bNeedRatio - aNeedRatio;
        const aNeedPlayers = Number(a.strategy?.playersNeededForMinimum || 0);
        const bNeedPlayers = Number(b.strategy?.playersNeededForMinimum || 0);
        if (bNeedPlayers !== aNeedPlayers) return bNeedPlayers - aNeedPlayers;
        if (a.bidCount !== b.bidCount) return a.bidCount - b.bidCount;
        if (a.rosterCount !== b.rosterCount) return a.rosterCount - b.rosterCount;
        return b.budgetNow - a.budgetNow;
      });

    const pick = candidates[0];
    if (!pick) continue;

    const missingNeed = pick.missingAtPosition > 0;
    const baseCoverageBid = missingNeed ? 2 : 1;
    const safeBid = Math.max(1, Math.min(baseCoverageBid, pick.budgetNow));
    safeBids[pick.teamName] = safeBids[pick.teamName] || [];
    safeBids[pick.teamName].push({ player, cpuBid: safeBid });
    coveredPlayerIds.add(Number(player.id));
    coverageAdds += 1;
  }

  return coverageAdds;
}

function applyEarlyRoundBidCoverageCap(cpuBids, roundPlayers, roundNumber) {
  const cfg = loadCpuLogicConfig();
  const enabled = cfg?.silent?.earlyRoundBidCoverageCapEnabled !== false;
  const maxRound = Math.max(1, Math.floor(Number(cfg?.silent?.earlyRoundBidCoverageCapMaxRound ?? 2)));
  const earlyRoundMaxPlayersWithBids = Math.max(1, Math.floor(Number(cfg?.silent?.earlyRoundMaxPlayersWithBids ?? 10)));
  const midRoundMaxPlayersWithBids = Math.max(
    earlyRoundMaxPlayersWithBids,
    Math.floor(Number(cfg?.silent?.midRoundMaxPlayersWithBids ?? (earlyRoundMaxPlayersWithBids + 2)))
  );
  const maxPlayersWithBids = Number(roundNumber) <= 4
    ? earlyRoundMaxPlayersWithBids
    : midRoundMaxPlayersWithBids;
  if (!enabled || Number(roundNumber) > maxRound) return 0;

  const playerMeta = new Map();
  (Array.isArray(roundPlayers) ? roundPlayers : []).forEach((player) => {
    const id = Number(player?.id || 0);
    if (!id) return;
    const rawDraftChance = Number(player?.draftChance ?? 0);
    const draftChance = !Number.isFinite(rawDraftChance) || rawDraftChance <= 0
      ? 0
      : (rawDraftChance > 1 ? Math.max(0, Math.min(1, rawDraftChance / 100)) : Math.max(0, Math.min(1, rawDraftChance)));
    playerMeta.set(id, {
      avgValue: Number(player?.avgValue || 0),
      draftChance
    });
  });

  const bidStats = new Map();
  Object.values(cpuBids || {}).forEach((teamBidList) => {
    (teamBidList || []).forEach((bid) => {
      const id = Number(bid?.player?.id || 0);
      if (!id) return;
      const current = bidStats.get(id) || { totalBid: 0, teamCount: 0 };
      current.totalBid += Math.max(0, Number(bid?.cpuBid || 0));
      current.teamCount += 1;
      bidStats.set(id, current);
    });
  });

  if (bidStats.size <= maxPlayersWithBids) return 0;

  const rankedIds = Array.from(bidStats.entries())
    .sort((a, b) => {
      const aId = Number(a[0]);
      const bId = Number(b[0]);
      const aMeta = playerMeta.get(aId) || { avgValue: 0, draftChance: 0 };
      const bMeta = playerMeta.get(bId) || { avgValue: 0, draftChance: 0 };
      if (bMeta.avgValue !== aMeta.avgValue) return bMeta.avgValue - aMeta.avgValue;
      if (bMeta.draftChance !== aMeta.draftChance) return bMeta.draftChance - aMeta.draftChance;
      if (b[1].totalBid !== a[1].totalBid) return b[1].totalBid - a[1].totalBid;
      return b[1].teamCount - a[1].teamCount;
    })
    .map(([id]) => Number(id));

  const keepIds = new Set(rankedIds.slice(0, maxPlayersWithBids));
  let removed = 0;
  Object.keys(cpuBids || {}).forEach((teamName) => {
    const original = Array.isArray(cpuBids[teamName]) ? cpuBids[teamName] : [];
    const filtered = original.filter((bid) => keepIds.has(Number(bid?.player?.id || 0)));
    removed += Math.max(0, original.length - filtered.length);
    cpuBids[teamName] = filtered;
  });

  return removed;
}

function enforceAvMarketDepth(cpuBids, cpuTeams, roundPlayers, teamStrategies, rosterLimits, maxRosterSize, roundNumber) {
  const cfg = loadCpuLogicConfig();
  const enabled = cfg?.silent?.avMarketDepthEnabled !== false;
  const maxRound = Math.max(1, Math.floor(Number(cfg?.silent?.avMarketDepthMaxRound ?? 7)));
  if (!enabled || Number(roundNumber) > maxRound) return 0;

  const minAv = Math.max(1, Number(cfg?.silent?.avMarketDepthMinAv ?? 24));
  const minBidMultiplier = Math.max(0.5, Math.min(1.2, Number(cfg?.silent?.avMarketDepthMinBidMultiplier ?? 0.76)));
  const minCompetitiveBids = Math.max(1, Math.floor(Number(cfg?.silent?.avMarketDepthMinCompetitiveBids ?? 3)));
  const maxPlayersPerRound = Math.max(1, Math.floor(Number(cfg?.silent?.avMarketDepthMaxPlayersPerRound ?? 7)));
  const bidLowMultiplier = Math.max(0.5, Math.min(1.2, Number(cfg?.silent?.avMarketDepthBidLowMultiplier ?? 0.78)));
  const bidHighMultiplier = Math.max(bidLowMultiplier, Math.min(1.3, Number(cfg?.silent?.avMarketDepthBidHighMultiplier ?? 0.98)));

  const targets = (Array.isArray(roundPlayers) ? roundPlayers : [])
    .filter((player) => player && !player.owner && Number(player.avgValue || 0) >= minAv)
    .sort((a, b) => Number(b.avgValue || 0) - Number(a.avgValue || 0))
    .slice(0, maxPlayersPerRound);

  let added = 0;

  targets.forEach((player) => {
    const playerId = Number(player.id || 0);
    if (!playerId) return;
    const av = getCpuEffectiveAv(player);
    const trueZeroAv = isTrueZeroAv(player);
    const minCompetitiveBid = Math.max(1, Math.round(av * minBidMultiplier));

    const existingBids = [];
    Object.entries(cpuBids || {}).forEach(([teamName, bids]) => {
      (bids || []).forEach((bid) => {
        if (Number(bid?.player?.id || 0) === playerId) {
          existingBids.push({ teamName, amount: Math.max(0, Number(bid?.cpuBid || 0)) });
        }
      });
    });

    const competitiveCount = existingBids.filter((entry) => entry.amount >= minCompetitiveBid).length;
    const participationTarget = pickParticipationTargetCountFromCurve(
      cfg?.silent || {},
      av,
      roundNumber,
      Array.isArray(cpuTeams) ? cpuTeams.length : 0,
      { isTrueZeroAv: trueZeroAv }
    );
    if (existingBids.length > participationTarget) {
      const keepTeams = new Set(
        existingBids
          .slice()
          .sort((a, b) => b.amount - a.amount)
          .slice(0, participationTarget)
          .map((entry) => entry.teamName)
      );

      Object.keys(cpuBids || {}).forEach((teamName) => {
        const bids = Array.isArray(cpuBids[teamName]) ? cpuBids[teamName] : [];
        cpuBids[teamName] = bids.filter((bid) => {
          if (Number(bid?.player?.id || 0) !== playerId) return true;
          return keepTeams.has(String(teamName));
        });
      });
    }
    const needed = Math.max(0, minCompetitiveBids - competitiveCount);
    if (needed <= 0) return;

    const bidderTeamNames = new Set(existingBids.map((entry) => entry.teamName));

    const candidates = (Array.isArray(cpuTeams) ? cpuTeams : [])
      .map((team) => {
        const teamName = String(team?.name || '');
        if (!teamName || bidderTeamNames.has(teamName)) return null;
        if (!isValidRosterAddition(team, player, rosterLimits, maxRosterSize)) return null;

        const teamBids = cpuBids[teamName] || [];
        const committed = teamBids.reduce((sum, bid) => sum + Math.max(0, Number(bid?.cpuBid || 0)), 0);
        const strategy = teamStrategies?.[teamName] || {};
        const reserveBypass = Number(roundNumber) >= 6
          || Number(strategy.needRatio || 0) >= 0.75
          || Number(strategy.playersNeededForMinimum || 0) >= Number(strategy.roundsIncludingCurrent || draftRoundCount);
        const budgetNow = getBidBudgetForTeam(team, committed, maxRosterSize, reserveBypass);
        if (budgetNow < minCompetitiveBid) return null;

        return {
          team,
          teamName,
          budgetNow,
          aggr: Number(strategy.aggressiveness || 0.8),
          need: Number(strategy.needRatio || 0)
        };
      })
      .filter(Boolean)
      .sort((a, b) => {
        if (b.need !== a.need) return b.need - a.need;
        if (b.aggr !== a.aggr) return b.aggr - a.aggr;
        return b.budgetNow - a.budgetNow;
      });

    for (let i = 0; i < Math.min(needed, candidates.length); i += 1) {
      const c = candidates[i];
      const targetBid = Math.round(av * (bidLowMultiplier + Math.random() * (bidHighMultiplier - bidLowMultiplier)));
      const competitiveBid = Math.max(minCompetitiveBid, targetBid);
      const amount = Math.min(c.budgetNow, competitiveBid);
      if (amount < minCompetitiveBid) continue;
      cpuBids[c.teamName] = cpuBids[c.teamName] || [];
      cpuBids[c.teamName].push({ player, cpuBid: amount });
      added += 1;
    }
  });

  return added;
}

function applyAvParticipationCurve(cpuBids, roundPlayers, roundNumber) {
  const safeBids = cpuBids && typeof cpuBids === 'object' ? cpuBids : {};
  const cfg = loadCpuLogicConfig();
  const enabled = cfg?.silent?.avParticipationCurveEnabled === true;
  if (!enabled) return 0;
  const totalTeamCount = Math.max(0, Object.keys(safeBids).length);
  const playerById = new Map((Array.isArray(roundPlayers) ? roundPlayers : []).map((player) => [Number(player?.id || 0), player]));
  let removed = 0;

  Object.keys(safeBids).forEach((teamName) => {
    const teamBids = Array.isArray(safeBids[teamName]) ? safeBids[teamName] : [];
    safeBids[teamName] = teamBids;
  });

  const bidsByPlayerId = new Map();
  Object.entries(safeBids).forEach(([teamName, bids]) => {
    (Array.isArray(bids) ? bids : []).forEach((bid) => {
      const playerId = Number(bid?.player?.id || 0);
      if (!playerId) return;
      if (!bidsByPlayerId.has(playerId)) bidsByPlayerId.set(playerId, []);
      bidsByPlayerId.get(playerId).push({ teamName, bid });
    });
  });

  bidsByPlayerId.forEach((entries, playerId) => {
    const player = playerById.get(Number(playerId)) || null;
    const av = getCpuEffectiveAv(player);
    const trueZeroAv = isTrueZeroAv(player);
    const targetCount = pickParticipationTargetCountFromCurve(cfg?.silent || {}, av, roundNumber, totalTeamCount, { isTrueZeroAv: trueZeroAv });

    if (entries.length <= targetCount) return;

    const keepTeams = new Set(
      entries
        .slice()
        .sort((a, b) => Number(b.bid?.cpuBid || 0) - Number(a.bid?.cpuBid || 0))
        .slice(0, targetCount)
        .map((entry) => String(entry.teamName || ''))
    );

    Object.keys(safeBids).forEach((teamName) => {
      const original = Array.isArray(safeBids[teamName]) ? safeBids[teamName] : [];
      const filtered = original.filter((bid) => {
        if (Number(bid?.player?.id || 0) !== playerId) return true;
        return keepTeams.has(String(teamName || ''));
      });
      removed += Math.max(0, original.length - filtered.length);
      safeBids[teamName] = filtered;
    });
  });

  return removed;
}

function pruneTeamBidsByPositionPlan(teamBids, team, strategy, rosterLimits = {}, maxRosterSize = 19) {
  const bids = Array.isArray(teamBids) ? teamBids : [];
  const roster = team?.roster || [];
  const currentCounts = getRosterPositionCounts(team || { roster: [] });
  const additionalCounts = {};

  const qbs = roster
    .filter(player => player.position === 'QB')
    .map(player => Number(player.avgValue || 0))
    .sort((a, b) => b - a);
  const currentQBCount = qbs.length;
  const bestExistingQB = qbs[0] || 0;
  const roundsIncludingCurrent = strategy?.roundsIncludingCurrent || draftRoundCount;
  const emergencyFill = roundsIncludingCurrent <= 2 && (strategy?.playersNeededForMinimum || 0) > 0;
  const stillMissingStarters = (strategy?.missingStarterCount || 0) > 0;

  const sortedBids = [...bids].sort((a, b) => Number(b?.cpuBid || 0) - Number(a?.cpuBid || 0));
  const kept = [];

  for (const bid of sortedBids) {
    const player = bid?.player;
    const pos = player?.position;
    if (!player || !pos) continue;

    const currentAtPos = currentCounts[pos] || 0;
    const addedAtPos = additionalCounts[pos] || 0;
    const projectedAtPos = currentAtPos + addedAtPos;

    if (pos === 'QB') {
      const qbCap = 2;
      if (projectedAtPos >= qbCap) continue;

      // Never queue more than one QB bid in a single round.
      if (addedAtPos >= 1) continue;

      if (currentQBCount >= 1) {
        const candidateValue = Number(player.avgValue || 0);
        const upgradeVsBest = candidateValue - bestExistingQB;

        if (bestExistingQB >= 35 && upgradeVsBest < 6 && !emergencyFill) continue;
        if (stillMissingStarters && upgradeVsBest < 10 && !emergencyFill) continue;
      }
    }

    if (pos === 'TE') {
      const teCap = 2;
      if (projectedAtPos >= teCap) continue;

      // Avoid submitting multiple TE bids in one round.
      if (addedAtPos >= 1) continue;

      const teRoster = roster
        .filter(rosterPlayer => rosterPlayer.position === 'TE')
        .map(rosterPlayer => Number(rosterPlayer.avgValue || 0))
        .sort((a, b) => b - a);
      const bestExistingTE = teRoster[0] || 0;
      const candidateValue = Number(player.avgValue || 0);
      const upgradeVsBest = candidateValue - bestExistingTE;

      if (teRoster.length >= 1) {
        if (bestExistingTE >= 26 && upgradeVsBest < 5 && !emergencyFill) continue;
        if (stillMissingStarters && upgradeVsBest < 8 && !emergencyFill) continue;
      }
    }

    if (pos === 'K' || pos === 'DEF') {
      // Keep specialist slots realistic: usually one of each.
      if (projectedAtPos >= 1) continue;
      if (addedAtPos >= 1) continue;
    }

    kept.push(bid);
    additionalCounts[pos] = addedAtPos + 1;
  }

  return kept;
}

function enforceCpuTieRates(cpuBids, cpuTeams, roundPlayers, roundNumber, rosterLimits, maxRosterSize) {
  roundNumber = Number(roundNumber) || 1;
  const cfg = loadCpuLogicConfig();
  const tiedCfg = cfg?.tied || {};
  const playerById = new Map((Array.isArray(roundPlayers) ? roundPlayers : []).map(player => [Number(player?.id || 0), player]));
  const cpuBudgetByTeam = cpuTeams.reduce((acc, team) => {
    acc[team.name] = team.budget;
    return acc;
  }, {});
  const roundTieMultiplier = roundNumber <= 2
    ? Number(tiedCfg.earlyRoundTieRateMultiplier ?? 0.4)
    : roundNumber <= 5
      ? Number(tiedCfg.midRoundTieRateMultiplier ?? 0.72)
      : Number(tiedCfg.lateRoundTieRateMultiplier ?? 1.02);
  const roundTieFloor = Math.max(0.0004, Number(tiedCfg.roundTieRateFloor ?? 0.0012) * 0.55);
  const roundTieCeiling = Math.max(roundTieFloor, Math.min(0.008, Number(tiedCfg.roundTieRateCeiling ?? 0.01) * 0.72));

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

    const player = playerById.get(Number(playerId)) || null;
    const playerAv = Math.max(0, Number(player?.avgValue || 0));

    const maxBid = Math.max(...refs.map(ref => ref.bidRef.cpuBid), 0);
    if (maxBid <= 0) return;

    const topRefs = refs.filter(ref => ref.bidRef.cpuBid === maxBid);
    if (topRefs.length < 2) return;

    const isTwoWayTie = topRefs.length === 2;
    let allowTieRate = roundTieFloor;
    if (isTwoWayTie) {
      if (maxBid <= 2 || playerAv <= 3) {
        allowTieRate = Math.max(roundTieFloor, 0.0068 * roundTieMultiplier);
      } else if (playerAv <= 10) {
        allowTieRate = Math.max(roundTieFloor, 0.0032 * roundTieMultiplier);
      } else if (playerAv <= 25) {
        allowTieRate = Math.max(roundTieFloor, 0.0019 * roundTieMultiplier);
      } else {
        allowTieRate = Math.max(roundTieFloor, 0.0011 * roundTieMultiplier);
      }

      if (roundNumber >= 8 && playerAv <= 10) {
        allowTieRate = Math.min(roundTieCeiling, allowTieRate + 0.0004);
      }
    } else {
      allowTieRate = Math.max(roundTieFloor, (playerAv <= 5 ? 0.00028 : 0.00016) * roundTieMultiplier);
    }

    allowTieRate = Math.min(roundTieCeiling, allowTieRate);

    if (Math.random() <= allowTieRate) {
      if (isTwoWayTie) twoWayObserved++;
      else threePlusObserved++;
      return;
    }

    // Determine winner: rounds 8-10 use budget/roster awareness, earlier rounds use random
    let winnerRef;
    if (roundNumber >= 8) {
      winnerRef = resolveTieWithBudgetAwareness(topRefs, cpuBudgetByTeam, cpuTeams, rosterLimits, maxRosterSize);
    } else {
      const winnerIndex = Math.floor(Math.random() * topRefs.length);
      winnerRef = topRefs[winnerIndex];
    }

    const winner = winnerRef;
    const winnerBudget = cpuBudgetByTeam[winner.teamName] || winner.bidRef.cpuBid;

    let winnerBid = winner.bidRef.cpuBid;
    if (winnerBid <= 1 && winnerBid + 1 <= winnerBudget) {
      winnerBid += 1;
      winner.bidRef.cpuBid = winnerBid;
    }

    topRefs.forEach((ref, index) => {
      if (ref.teamName === winner.teamName) return; // Match by team name instead of index
      if (winnerBid > 1) {
        ref.bidRef.cpuBid = Math.min(ref.bidRef.cpuBid, winnerBid - 1);
      } else {
        // If winner cannot be raised above $1 (ultra-tight budget), clear competing $1 bids
        // so we do not carry unresolved 2+/3+/4+ way ties into auction processing.
        ref.bidRef.cpuBid = 0;
      }
    });
  });

  if (twoWayObserved > 0 || threePlusObserved > 0) {
    console.log(`[CPU TIES] Preserved ties this round -> two-way: ${twoWayObserved}, three-plus: ${threePlusObserved}`);
  }
}

// ===== OPPONENT BUDGET-AWARE TIE RESOLUTION =====
// For rounds 8-10: intelligently resolve ties based on team budgets, roster needs, and draft progress
function resolveTieWithBudgetAwareness(tiedRefs, cpuBudgetByTeam, cpuTeams, rosterLimits, maxRosterSize) {
  // Score each tied team on factors: budget tightness, roster completeness, position need
  const teamScores = {};
  const dynamicTargetRoster = Math.max(1, Number(maxRosterSize || 19) - 3);
  const dynamicFloorRoster = Math.max(1, dynamicTargetRoster - 2);

  tiedRefs.forEach(ref => {
    const teamName = ref.teamName;
    const team = cpuTeams.find(t => t.name === teamName);
    if (!team) {
      teamScores[teamName] = { score: 0, factors: {} };
      return;
    }

    let score = 0;
    const factors = {};

    // Factor 1: Budget tightness (teams with less budget get priority to force spending)
    // Score: 0-25 points
    const budget = cpuBudgetByTeam[teamName] || team.budget;
    const budgetTightness = 1 - Math.min(1, budget / 200); // 0 = rich ($200+), 1 = poor ($0)
    const budgetScore = budgetTightness * 25;
    factors.budgetTightness = budgetTightness.toFixed(2);
    factors.budgetScore = budgetScore.toFixed(1);
    score += budgetScore;

    // Factor 2: Roster incompleteness (teams further from 14-player minimum get priority)
    // Score: 0-30 points
    const rosterSize = (team.roster || []).length;
    const targetRosterSize = dynamicTargetRoster;
    const playersNeededToTarget = Math.max(0, targetRosterSize - rosterSize);
    const incompletenessScore = Math.min(30, playersNeededToTarget * 3);
    factors.rosterSize = rosterSize;
    factors.playersNeeded = playersNeededToTarget;
    factors.incompletenessScore = incompletenessScore.toFixed(1);
    score += incompletenessScore;

    // Factor 3: Roster spot availability (teams with more open spots need priority)
    // Score: 0-20 points
    const openSlots = getOpenSlots(team, maxRosterSize) || 0;
    const spotAvailabilityScore = Math.min(20, openSlots * 2);
    factors.openSlots = openSlots;
    factors.spotAvailabilityScore = spotAvailabilityScore.toFixed(1);
    score += spotAvailabilityScore;

    // Factor 4: Budget per open slot ratio (tight budget + many slots = high desperation)
    // Score: 0-15 points
    let budgetPerSlotScore = 0;
    if (openSlots > 0) {
      const budgetPerSlot = budget / openSlots;
      const desperation = 1 - Math.min(1, budgetPerSlot / 25); // 0 = rich/slot ($25+), 1 = poor/slot ($0)
      budgetPerSlotScore = desperation * 15;
    }
    factors.budgetPerSlotScore = budgetPerSlotScore.toFixed(1);
    score += budgetPerSlotScore;

    // Factor 5: Position-specific urgency (does this team need this position?)
    // Only applies if we can determine position from player data
    // Score: 0-10 points
    let positionUrgencyScore = 0;
    if (rosterLimits && rosterLimits.RB && rosterLimits.WR) {
      // Use a default position check based on team roster balance
      const positionCounts = {};
      (team.roster || []).forEach(p => {
        positionCounts[p.position] = (positionCounts[p.position] || 0) + 1;
      });
      
      // Check for critical position deficiencies
      const rbCount = positionCounts['RB'] || 0;
      const wrCount = positionCounts['WR'] || 0;
      if (rbCount < (rosterLimits['RB']?.min || 2) && wrCount >= (rosterLimits['WR']?.max || 4)) {
        // Team is RB-starved and WR-rich - would appreciate RB
        positionUrgencyScore = 8;
      } else if (wrCount < (rosterLimits['WR']?.min || 2) && rbCount >= (rosterLimits['RB']?.max || 3)) {
        // Team is WR-starved and RB-rich - would appreciate WR
        positionUrgencyScore = 8;
      }
    }
    factors.positionUrgencyScore = positionUrgencyScore.toFixed(1);
    score += positionUrgencyScore;

    // Factor 6: Floor completion emergency (late-round tie-break safety)
    // Teams below dynamic floor get heavy priority to prevent floor misses.
    const playersNeededToFloor = Math.max(0, dynamicFloorRoster - rosterSize);
    const floorEmergencyScore = playersNeededToFloor > 0 ? Math.min(45, playersNeededToFloor * 15) : 0;
    factors.floorEmergencyScore = floorEmergencyScore.toFixed(1);
    score += floorEmergencyScore;

    teamScores[teamName] = {
      score,
      factors,
      priority: score // Used for sorting
    };
  });

  // Log the decision for transparency
  const sortedByPriority = Object.entries(teamScores)
    .sort((a, b) => b[1].score - a[1].score);
  
  if (sortedByPriority.length > 1) {
    console.log(`[CPU TIES - BUDGET-AWARE] Multi-way tie resolution:`);
    sortedByPriority.forEach(([teamName, scoreData], idx) => {
      const placement = idx === 0 ? 'WINNER' : `#${idx + 1}`;
      console.log(
        `  ${placement}: ${teamName} score=${scoreData.score.toFixed(1)} ` +
        `(budget=${scoreData.factors.budgetScore}, roster=${scoreData.factors.incompletenessScore}, ` +
        `spots=${scoreData.factors.spotAvailabilityScore}, desperation=${scoreData.factors.budgetPerSlotScore}, ` +
        `posNeed=${scoreData.factors.positionUrgencyScore}, floor=${scoreData.factors.floorEmergencyScore}) ` +
        `[${scoreData.factors.budgetTightness} tight, ${scoreData.factors.rosterSize}/${dynamicTargetRoster} roster, ${scoreData.factors.openSlots} open]`
      );
    });
  }

  // Return the highest-scoring team as winner
  const winnerTeamName = sortedByPriority[0][0];
  return tiedRefs.find(ref => ref.teamName === winnerTeamName);
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

  if (player.avgValue <= 10) {
    const lowAvSpread = player.avgValue <= 3
      ? 0.62 + (Math.random() * 0.86)
      : player.avgValue <= 6
        ? 0.72 + (Math.random() * 0.62)
        : 0.76 + (Math.random() * 0.24);
    shapedBid = Math.round(shapedBid * lowAvSpread);

    // Encourage more realistic cheap-end outcomes for depth and specialists, but with wider variance.
    if (player.position === 'K' || player.position === 'DEF') {
      const cheapRoll = Math.random();
      if (cheapRoll < 0.55) {
        shapedBid = Math.min(shapedBid, 1 + Math.floor(Math.random() * 5)); // 1-5
      }

      if ((strategy?.mustFillPositions || []).includes(player.position)) {
        const lateRoundCap = roundsLeft <= 2 ? 6 : 4;
        shapedBid = Math.min(shapedBid, lateRoundCap);
      }
    } else {
      const cheapRoll = Math.random();
      if (cheapRoll < 0.5) {
        shapedBid = Math.min(shapedBid, 1 + Math.floor(Math.random() * 5)); // 1-5
      } else if (cheapRoll > 0.85) {
        shapedBid = Math.min(shapedBid + 2, bidRemainingBudget);
      }
    }
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
    if (isEarlyRound) return { minPct: 0.95, maxPct: 1.06, rareMaxPct: 1.08, rareChance: 0.01 };
    if (isMidRound) return { minPct: 0.94, maxPct: 1.05, rareMaxPct: 1.09, rareChance: 0.012 };
    return { minPct: 0.93, maxPct: 1.04, rareMaxPct: 1.08, rareChance: 0.012 };
  }

  if (avgValue >= 35) {
    if (isEarlyRound) return { minPct: 0.92, maxPct: 1.08, rareMaxPct: 1.11, rareChance: 0.012 };
    if (isMidRound) return { minPct: 0.9, maxPct: 1.08, rareMaxPct: 1.12, rareChance: 0.015 };
    return { minPct: 0.89, maxPct: 1.06, rareMaxPct: 1.1, rareChance: 0.015 };
  }

  if (avgValue >= 20) {
    if (isEarlyRound) return { minPct: 0.88, maxPct: 1.1, rareMaxPct: 1.16, rareChance: 0.02 };
    if (isMidRound) return { minPct: 0.86, maxPct: 1.1, rareMaxPct: 1.18, rareChance: 0.022 };
    return { minPct: 0.84, maxPct: 1.08, rareMaxPct: 1.16, rareChance: 0.022 };
  }

  // Lower-value players need wider practical variance due to small-dollar granularity.
  if (avgValue <= 10) {
    if (isEarlyRound) return { minPct: 0.42, maxPct: 1.38, rareMaxPct: 1.6, rareChance: 0.12 };
    if (isMidRound) return { minPct: 0.4, maxPct: 1.4, rareMaxPct: 1.65, rareChance: 0.14 };
    return { minPct: 0.38, maxPct: 1.34, rareMaxPct: 1.58, rareChance: 0.12 };
  }
  if (isEarlyRound) return { minPct: 0.58, maxPct: 1.26, rareMaxPct: 1.35, rareChance: 0.08 };
  if (isMidRound) return { minPct: 0.54, maxPct: 1.28, rareMaxPct: 1.4, rareChance: 0.1 };
  return { minPct: 0.52, maxPct: 1.22, rareMaxPct: 1.34, rareChance: 0.09 };
}

function clampBidToDynamicBand(player, bidAmount, roundNumber, strategy, bidRemainingBudget) {
  const effectiveAv = getCpuEffectiveAv(player);
  const band = getDynamicBidBand(effectiveAv, roundNumber, strategy);
  const expansionPct = 0.02 + (Math.random() * 0.04);
  const expandedMinPct = Math.max(0.25, band.minPct * (1 - expansionPct));
  const expandedMaxPct = band.maxPct * (1 + expansionPct);
  const expandedRareMaxPct = band.rareMaxPct * (1 + expansionPct);

  const baseFloor = Math.max(1, Math.round(effectiveAv * expandedMinPct));
  const baseCeiling = Math.max(baseFloor, Math.round(effectiveAv * expandedMaxPct));
  const rareCeiling = Math.max(baseCeiling, Math.round(effectiveAv * expandedRareMaxPct));
  const ceiling = Math.random() < band.rareChance ? rareCeiling : baseCeiling;

  // AV band acts as a soft ceiling so roster/round structure drives behavior.
  return Math.max(1, Math.min(bidAmount, ceiling, bidRemainingBudget));
}

function getPlayerAvSoftBidCap(player, roundNumber, budgetCap, cfgSilent = {}, options = {}) {
  const av = getCpuEffectiveAv(player);
  const safeBudgetCap = Math.max(1, Number(budgetCap || 1));
  const round = Math.max(1, Number(roundNumber || 1));
  const isStarredTarget = !!options.isStarredTarget;
  const isMustFillPosition = !!options.isMustFillPosition;

  const multiplierByBucket = {
    '1-5': Math.max(1.0, Number(cfgSilent?.avCapMult1to5 ?? 1.24)),
    '5-10': Math.max(1.0, Number(cfgSilent?.avCapMult5to10 ?? 1.2)),
    '10-20': Math.max(1.0, Number(cfgSilent?.avCapMult10to20 ?? 1.16)),
    '20-30': Math.max(1.0, Number(cfgSilent?.avCapMult20to30 ?? 1.12)),
    '30-40': Math.max(1.0, Number(cfgSilent?.avCapMult30to40 ?? 1.1)),
    '40-50': Math.max(1.0, Number(cfgSilent?.avCapMult40to50 ?? 1.08)),
    '50-60': Math.max(1.0, Number(cfgSilent?.avCapMult50to60 ?? 1.07)),
    '60+': Math.max(1.0, Number(cfgSilent?.avCapMult60Plus ?? 1.06))
  };
  const bucket = getRangeKey(av);
  const bucketMultiplier = multiplierByBucket[bucket] || 1.1;
  const baseBuffer = Math.max(0, Number(cfgSilent?.avCapBaseBuffer ?? 1));
  const lateRoundExtraBuffer = Math.max(0, Number(cfgSilent?.avCapLateRoundExtraBuffer ?? 1));

  let cap = Math.floor((av * bucketMultiplier) + baseBuffer);
  if (round >= 8) {
    cap += lateRoundExtraBuffer;
  }
  if (isStarredTarget || isMustFillPosition) {
    cap += 1;
  }

  return Math.max(1, Math.min(cap, safeBudgetCap));
}

function getTargetOverbidAllowance(cfgSilent = {}, isTargetPlayer = false) {
  if (!isTargetPlayer) return 0;
  const minOverbid = Math.max(0, Math.floor(Number(cfgSilent?.targetPlayerOverbidMin ?? 2)));
  const maxOverbidRaw = Math.max(minOverbid, Math.floor(Number(cfgSilent?.targetPlayerOverbidMax ?? 3)));
  const maxOverbid = Math.max(minOverbid, maxOverbidRaw);
  if (maxOverbid <= minOverbid) return minOverbid;
  return minOverbid + Math.floor(Math.random() * ((maxOverbid - minOverbid) + 1));
}

function getHardPlayerBidCap(player, roundNumber, budgetCap, cfgSilent = {}, options = {}) {
  const safeBudgetCap = Math.max(1, Number(budgetCap || 1));
  const avSoftCap = getPlayerAvSoftBidCap(player, roundNumber, safeBudgetCap, cfgSilent, {
    isStarredTarget: !!options.isTargetPlayer,
    isMustFillPosition: !!options.isMustFillPosition
  });
  const allowance = getTargetOverbidAllowance(cfgSilent, !!options.isTargetPlayer);
  return Math.max(1, Math.min(safeBudgetCap, avSoftCap + allowance));
}

function pullBidTowardAV(player, bidAmount, roundNumber) {
  const effectiveAv = getCpuEffectiveAv(player);
  if (effectiveAv < 20) {
    return bidAmount;
  }

  // Gentle center-weighting only — the old 0.68 weight was collapsing all CPUs into a tiny dollar window
  // making integer ties near-certain for high-value players. This is just a soft nudge now.
  const avWeight = roundNumber <= 3 ? 0.16 : roundNumber <= 7 ? 0.12 : 0.08;
  return Math.round((effectiveAv * avWeight) + (bidAmount * (1 - avWeight)));
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

    const cfg = loadCpuLogicConfig();
    const zeroAvParticipationMultiplier = Math.max(0.25, Math.min(0.95, Number(cfg?.silent?.trueZeroAvParticipationMultiplier ?? 0.72)));

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
      const effectiveAv = getCpuEffectiveAv(player);
      const trueZeroAv = isTrueZeroAv(player);
        // Define probability ranges based on avgValue
        const valueRanges = [
          { min: 1, max: 5, minProb: 0.02, maxProb: 0.10 },
          { min: 5, max: 10, minProb: 0.03, maxProb: 0.14 },
          { min: 10, max: 20, minProb: 0.06, maxProb: 0.26 },
          { min: 20, max: 30, minProb: 0.18, maxProb: 0.38 },
          { min: 30, max: 40, minProb: 0.22, maxProb: 0.48 },
          { min: 40, max: 50, minProb: 0.26, maxProb: 0.60 },
          { min: 50, max: 60, minProb: 0.34, maxProb: 0.74 },
          { min: 60, max: Infinity, minProb: 0.40, maxProb: 0.84 }
        ];
        const range = valueRanges.find(r => effectiveAv >= r.min && effectiveAv < r.max) || valueRanges[0];
        let participationRate = range.minProb + Math.random() * (range.maxProb - range.minProb);
        if (trueZeroAv) {
          participationRate *= zeroAvParticipationMultiplier;
        }
        // Further decrease participation in first 3 rounds, EXCEPT for big names
        if (currentRound <= 3) {
          if (effectiveAv >= 40) {
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
          let improve = effectiveAv - bestByPos[player.position];
          if (bestByPos[player.position] > 20 && effectiveAv < 20) improve -= 10;
          if (bestByPos[player.position] > 5 && effectiveAv < 3) improve -= 20;
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
              baseBid = effectiveAv * (0.65 + Math.random() * 0.22); // 65-87% for K/DEF (further reduced)
            } else {
              const bidRange = getBidRange(player.position, effectiveAv);
              // Further reduce the bid range for all positions
              const reducedMin = bidRange.min * 0.85;
              const reducedMax = bidRange.min + 0.55 * (bidRange.max - bidRange.min);
              baseBid = effectiveAv * (reducedMin + Math.random() * (reducedMax - reducedMin));
              // Add a hard cap: never bid more than 1.05x avgValue for any player
              baseBid = Math.min(baseBid, effectiveAv * 1.05);
            }
            // Special handling for very low value players
            if (effectiveAv <= 1) {
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
async function generateServerCPUBids(teams, roundPlayers, allPlayers, rosterSize, rosterLimits, humanMembers, roundNumber, options = {}) {
  try {
    const cfg = loadCpuLogicConfig();
    const presetName = cfg && cfg.presetName ? String(cfg.presetName).trim() : 'Unknown';
    const commitmentMode = normalizeCommitmentMode(options?.commitmentMode || cfg?.silent?.commitmentMode || 'B');
    console.log('[CPU SILENT AUCTION] Round %d: Generating bids using CPU tuning lab preset: "%s"', roundNumber, presetName);
    console.log(`[CPU SILENT AUCTION] Commitment mode ${commitmentMode} active for round ${Number(roundNumber) || 1}`);
    
    // Filter to CPU teams. Team X names are always treated as CPU even if present in member lists.
    const maxRosterSize = getMaxRosterSize(rosterSize);
    const normalizedHumanMembers = new Set((humanMembers || []).map(name => String(name || '').trim().toLowerCase()));
    const cpuTeams = (teams || []).filter((team) => {
      const teamName = String(team && team.name || '').trim();
      if (!teamName) return false;
      if (/^Team\s+\d+$/i.test(teamName)) return true;
      return !normalizedHumanMembers.has(teamName.toLowerCase());
    });
    const cpuBids = {};
    const thresholdDebug = (options && options.thresholdDebug && options.thresholdDebug.enabled)
      ? options.thresholdDebug
      : null;
    const thresholdDebugCollector = Array.isArray(options?.thresholdDebugCollector)
      ? options.thresholdDebugCollector
      : null;

    console.log(`[generateCPUBids] Human members: ${humanMembers.join(', ')}`);
    console.log(`[generateCPUBids] CPU teams: ${cpuTeams.map(t => t.name).join(', ')}`);

    const draftOverlapChance = rollCpuStarOverlapChance();
    const autoDraftStarPlayerIdsByTeam = (options && typeof options.autoDraftStarPlayerIdsByTeam === 'object' && options.autoDraftStarPlayerIdsByTeam)
      ? options.autoDraftStarPlayerIdsByTeam
      : {};
    const starTargetInit = initializeCpuStarTargets(cpuTeams, allPlayers, {
      overlapChance: draftOverlapChance,
      forceRebuild: Number(roundNumber) === 1,
      manualStarTargetsByTeam: autoDraftStarPlayerIdsByTeam
    });
    const cpuStarTargetsByTeam = starTargetInit.assignedByTeam || {};
    const silentTuning = getSilentTuning();

    if (Number(roundNumber) === 1) {
      console.log(`[generateCPUBids] CPU star overlap rate this draft: ${(draftOverlapChance * 100).toFixed(1)}%`);
    }

    // ============================================================
    // GM CONFIDENCE METER UPDATE
    // Check how many wanted players have already been drafted by rivals.
    // This runs before strategy calculation so strategy can use the confidence value.
    // ============================================================
    for (const team of cpuTeams) {
      if (!(team.name in gmConfidenceMeter)) {
        gmConfidenceMeter[team.name] = 100; // Start at full confidence
      }
      
      if (roundNumber > 1) {
        // Count how many starred targets are now owned by someone else
        const starredIds = cpuStarTargetsByTeam[team.name] || new Set();
        let lostWantedPlayers = 0;
        for (const starId of starredIds) {
          const wantedPlayer = (allPlayers || []).find(p => 
            getPlayerIdKey(p) === starId || String(p.id) === String(starId)
          );
          if (wantedPlayer && wantedPlayer.owner) lostWantedPlayers++;
        }
        
        const newConfidence = Math.max(20, 100 - (lostWantedPlayers * 12));
        const prevConfidence = gmConfidenceMeter[team.name];
        gmConfidenceMeter[team.name] = newConfidence;
        
        if (newConfidence < prevConfidence) {
          console.log(`[CPU-${team.name}] GM CONFIDENCE: ${prevConfidence}% → ${newConfidence}% (${lostWantedPlayers}/${starredIds.size} starred targets gone — becoming less selective, bidding broader)`);
        }
      }
    }

    // Generate dynamic bidding strategies for each CPU team based on situation
    const teamStrategies = {};
    const leagueAvgRosterSizeGlobal = cpuTeams.reduce((sum, t) => sum + ((t.roster || []).length), 0)
      / Math.max(1, cpuTeams.length);
    const leagueMinRosterSizeGlobal = cpuTeams.reduce((minRoster, t) => {
      const rosterSize = Array.isArray(t?.roster) ? t.roster.length : 0;
      return Math.min(minRoster, rosterSize);
    }, Number.POSITIVE_INFINITY);
    for (const team of cpuTeams) {
      // Calculate situational factors
      const currentRosterSize = team.roster ? team.roster.length : 0;
      const rosterSpotsLeft = maxRosterSize - currentRosterSize;
      const roundsLeft = draftRoundCount - roundNumber;
      const roundsIncludingCurrent = Math.max(1, roundsLeft + 1);
      const completionTargets = getRosterCompletionTargets(rosterSize, maxRosterSize);
      const targetRosterSize = Math.min(maxRosterSize, completionTargets.baseTarget);
      const targetPlayersPerRound = targetRosterSize / Math.max(1, draftRoundCount);
      const expectedRosterByNow = Math.min(targetRosterSize, Math.ceil(targetPlayersPerRound * roundNumber));
      const earlyPaceGap = Math.max(0, expectedRosterByNow - currentRosterSize);
      const requiredWinsPerRound = calculateRequiredWinsPerRound(currentRosterSize, targetRosterSize, roundsIncludingCurrent);
      const baselineWinsPerRound = calculateRequiredPacePerRound(targetRosterSize, draftRoundCount);
      const isWinRateBehind = requiredWinsPerRound > baselineWinsPerRound;
      const winRatePressure = Math.max(0, requiredWinsPerRound - baselineWinsPerRound);
      
      // Keep draft targets aligned to the configured completed roster size.
      // Do not intentionally chase over-target roster counts.
      const draftBufferTarget = targetRosterSize;
      
      const playersNeededForMinimum = Math.max(0, targetRosterSize - currentRosterSize);
      const rosterFloorTarget = Math.min(targetRosterSize, completionTargets.floorTarget);
      const playersNeededForFloor = Math.max(0, rosterFloorTarget - currentRosterSize);
      const playersNeededForBuffer = Math.max(0, draftBufferTarget - currentRosterSize);
      const isBehindMinimumPace = playersNeededForMinimum > roundsIncludingCurrent;
      const isBehindFloorPace = playersNeededForFloor > roundsIncludingCurrent;
      const isBehindBufferPace = playersNeededForBuffer > roundsIncludingCurrent; // New: behind draft buffer target
      const isFinalRoundFill = roundNumber >= draftRoundCount && playersNeededForMinimum > 0;
      const rosterFloorMode = playersNeededForFloor > 0
        && (roundsIncludingCurrent <= 5 || isBehindFloorPace || roundNumber >= 7);
      const leagueFloorUnlocked = Number(leagueMinRosterSizeGlobal) >= Number(rosterFloorTarget);
      const leagueTargetUnlocked = Number(leagueMinRosterSizeGlobal) >= Number(targetRosterSize);
      let desiredRosterCap = Math.min(maxRosterSize, rosterFloorTarget);
      if (leagueFloorUnlocked && !leagueTargetUnlocked) {
        desiredRosterCap = Math.min(maxRosterSize, targetRosterSize);
      } else if (leagueTargetUnlocked) {
        desiredRosterCap = Math.min(maxRosterSize, completionTargets.stretchTarget);
      }

      // Keep some bidding pressure for rounds 9-10 by reserving ~2 spots for endgame,
      // unless the team is already behind completion pace.
      const preEndgameCap = Math.max(rosterFloorTarget, targetRosterSize - 2);
      if (roundsIncludingCurrent > 2 && !isBehindMinimumPace) {
        desiredRosterCap = Math.min(desiredRosterCap, preEndgameCap);
      }

      const topTalentMode = currentRosterSize >= targetRosterSize
        && currentRosterSize < desiredRosterCap
        && leagueFloorUnlocked
        && Number(team.budget || 0) >= 25;
      
      // Calculate pace variance for intelligent drafting
      const paceVariance = calculatePaceVariance(team, roundNumber, targetRosterSize, draftRoundCount);
      const requiredPace = calculateRequiredPacePerRound(targetRosterSize, draftRoundCount);
      const paceAdjustment = getPaceAdjustment(paceVariance, roundsIncludingCurrent);
      
      // Pace-based bid decision: if behind pace, bid more to catch up
      const playersNeededForPace = Math.max(0, Math.ceil(requiredPace * roundsIncludingCurrent) - currentRosterSize);
      const isBehindPace = paceVariance < 0 || (roundNumber <= 6 && earlyPaceGap > 0);
      const isAheadOfPace = paceVariance > 1;
      
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
      let baseAggressiveness = Number(silentTuning.baseAggression || 0.5); // Default moderate

      // Budget-based adjustments
      if (team.budget > 150) baseAggressiveness += Number(silentTuning.budgetRichBoost || 0);
      else if (team.budget < 50) baseAggressiveness -= Number(silentTuning.budgetPoorReduction || 0);

      // Roster needs adjustments
      if (rosterSpotsLeft <= 3) baseAggressiveness += Number(silentTuning.rosterTightBoost || 0);
      else if (rosterSpotsLeft >= 10) baseAggressiveness -= Number(silentTuning.rosterLooseReduction || 0);
      if (playersNeededForMinimum > 0 && roundNumber >= 7) baseAggressiveness += Number(silentTuning.finalRoundFillBoost || 0) * 0.45;
      if (isBehindMinimumPace) baseAggressiveness += Number(silentTuning.emergencyStarterBoost || 0);
      if (isFinalRoundFill) baseAggressiveness += Number(silentTuning.finalRoundFillBoost || 0);
      if (totalMissing > 0 && roundsIncludingCurrent <= 5) baseAggressiveness += Number(silentTuning.emergencyStarterBoost || 0) * 0.78;

      // Pace-based adjustment - critical for intelligent roster filling
      baseAggressiveness += paceAdjustment;
      if (isBehindPace && roundsIncludingCurrent <= 4) {
        baseAggressiveness += 0.12; // Extra urgency in mid-game if behind pace
      }
      if (roundNumber <= 6 && earlyPaceGap > 0) {
        baseAggressiveness += Math.min(0.16, earlyPaceGap * 0.06);
      }
      if (isWinRateBehind) {
        baseAggressiveness += Math.min(0.12, winRatePressure * 0.10);
      }

      // Round-based adjustments - more flexible, allow strategic early aggression
      if (isEarlyRound) {
        // Reduce early round aggressiveness to prevent overbidding
        baseAggressiveness -= Number(silentTuning.earlyRoundReduction || 0);
        // Rich teams can be aggressive early if they want to secure talent
        if (team.budget > 150 && rosterSpotsLeft <= 8) {
          baseAggressiveness += Math.random() * Number(silentTuning.richEarlyBoost || 0.32) - 0.1;
        } else {
          baseAggressiveness += Math.random() * 0.22 - 0.15; // Slightly less variance
        }
      } else if (isLateRound) {
        baseAggressiveness += Math.random() * Number(silentTuning.lateRoundAggressionBoost || 0.4) - 0.1;
      } else if (isMidRound) {
        baseAggressiveness += Math.random() * Number(silentTuning.midRoundVarianceMax || 0.2) - 0.1;
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
      const personalityVariance = (getTeamSeed(team.name) % 7 - 3) * Number(silentTuning.personalityVarianceStep || 0.1);
      baseAggressiveness += personalityVariance;

      // Add round-to-round unpredictability
      const roundVariance = (Math.random() - 0.5) * (Number(silentTuning.roundVarianceMax || 0.15) * 2);
      baseAggressiveness += roundVariance;
      baseAggressiveness = Math.max(0.1, Math.min(Number(silentTuning.maxAggressionCap || 0.95), baseAggressiveness));

      const personality = getTeamPersonality(team.name);
      baseAggressiveness = Math.max(0.1, Math.min(0.95, baseAggressiveness * personality.aggression));

      const starredTargetIds = cpuStarTargetsByTeam[team.name] || new Set();
      const starTargetState = getCpuStarTargetState(starredTargetIds, allPlayers, roundPlayers);
      
      // ===== STAR AVAILABILITY MODE OVERRIDE =====
      // Calculate percentage of starred targets available this round
      let starAvailabilityPercentage = 0;
      if (starredTargetIds.size > 0) {
        starAvailabilityPercentage = starTargetState.availableNowIds.size / starredTargetIds.size;
      }
      
      const starAvailabilityOverride = Number(silentTuning.starAvailabilityOverride || 0.8);
      const shouldOverrideLowballMode = starAvailabilityPercentage >= (1 - starAvailabilityOverride);
      
      if (starTargetState.availableNowIds.size > 0) {
        baseAggressiveness = Math.min(0.97, baseAggressiveness + 0.05);
      }

      // ===== DYNAMIC BIDDING STRATEGY BASED ON ROSTER STATE =====
      // Determine bidding approach (spread wide vs focus narrow) based on team situation
      
      // Count critical position gaps (missing starters)
      const missingCriticalStarters = Object.entries(missingByPosition || {})
        .filter(([pos, count]) => count > 0)
        .map(([pos]) => pos);
      
      // Calculate position balance (is team top-heavy in one position?)
      const positionImbalance = (() => {
        const counts = Object.values(getRosterPositionCounts(team));
        const max = Math.max(...counts, 0);
        const min = Math.min(...counts, 0);
        return max - min; // Higher = more imbalanced
      })();
      
      // Budget health classification
      let budgetHealth = 'comfortable'; // default
      if (team.budget < 30) budgetHealth = 'desperate';
      else if (team.budget < 50) budgetHealth = 'tight';
      else if (team.budget > 120) budgetHealth = 'rich';
      
      // Roster fullness
      const rosterFullnessPercent = (currentRosterSize / maxRosterSize) * 100;

      // ============================================================
      // THREE-BRAIN ARCHITECTURE METRICS
      // Brain 1: Player Desire  (handled by aggressiveness above)
      // Brain 2: Roster Survival (rosterPressure)
      // Brain 3: Draft Survival  (positionScarcity, dynamicBudgetReserve)
      // ============================================================

      // Brain 2: Roster Pressure — how urgently must this team win bids?
      // Uses requiredSpots = minimum starters still missing (totalMissing)
      // rosterPressure > 1.0 means it's mathematically impossible to fill all gaps → emergency
      const rosterPressure = calculateRosterPressure(totalMissing, roundsIncludingCurrent);
      if (rosterPressure > 1.0) {
        console.log(`[CPU-${team.name}] ⚠ ROSTER EMERGENCY: Need ${totalMissing} starters with only ${roundsIncludingCurrent} rounds left (pressure=${rosterPressure.toFixed(2)}) — ignoring AV, bidding for legal roster`);
      } else if (rosterPressure > 0.75) {
        console.log(`[CPU-${team.name}] ⚡ ROSTER DANGER: pressure=${rosterPressure.toFixed(2)} (${totalMissing} needed, ${roundsIncludingCurrent} rounds) — every round counts`);
      }

      // Brain 3a: Position Scarcity — per-position supply vs demand snapshot
      const positionScarcity = {};
      for (const pos of ['QB', 'RB', 'WR', 'TE', 'K', 'DEF']) {
        positionScarcity[pos] = calculatePositionScarcity(pos, roundPlayers, cpuTeams, rosterLimits);
        // Log panic-level scarcity for positions this team still needs
        const teamNeedsPos = missingCriticalStarters.includes(pos);
        if (teamNeedsPos && positionScarcity[pos] < 0.7) {
          console.log(`[CPU-${team.name}] 🚨 SCARCITY PANIC: ${pos} scarce — ${positionScarcity[pos].toFixed(2)} players/team needing (must grab NOW)`);
        }
      }

      // Brain 3b: Dynamic Budget Reserve — always keep $1 per required roster spot
      // This is a visible minimum the bidding engine must respect before spending freely
      const dynamicBudgetReserve = Math.max(0, totalMissing); // $1 per missing starter minimum

      // GM Confidence — did the draft go as planned?
      const gmConfidence = gmConfidenceMeter[team.name] ?? 100;

      // ============================================================
      // DRAFT COMPLETION AI: completionPressure → interestThreshold
      //
      // Instead of raising aggression when behind, we LOWER STANDARDS.
      // The CPU stays just as aggressive per player — it just considers
      // more players acceptable. This prevents late-draft price inflation:
      // all teams bid on more auctions, but at the same prices.
      //
      // completionPressure (0–40):
      //   based on how far behind the CPU is vs pace AND league average
      //
      // minimumInterest (40–88):
      //   how selective the CPU is (88 = very picky, 40 = joins anything)
      //
      // interestThreshold (0.20–0.75):
      //   the teamValue floor for a player to be considered "worth bidding"
      // ============================================================

      // League average roster size (how is everyone else doing?)
      const leagueAvgRosterSize = leagueAvgRosterSizeGlobal;
      
      const completionPressure = calculateCompletionPressure(
        currentRosterSize,
        paceVariance,
        leagueAvgRosterSize,
        rosterPressure
      );

      const earlyInterestHoldEnabled = silentTuning.earlyInterestHoldEnabled !== false;
      const earlyInterestHoldUntilRound = Math.max(1, Math.min(draftRoundCount, Math.floor(Number(silentTuning.earlyInterestHoldUntilRound ?? 7))));
      const earlyInterestHoldMaxPressure = Math.max(0, Math.min(30, Number(silentTuning.earlyInterestHoldMaxPressure ?? 9.5)));
      const earlyInterestHoldPaceTolerance = Math.max(0, Math.min(0.5, Number(silentTuning.earlyInterestHoldPaceTolerance ?? 0.08)));
      const isPreLateRounds = Number(roundNumber) < earlyInterestHoldUntilRound;
      const isMildPaceLag = (requiredWinsPerRound || 0) <= ((baselineWinsPerRound || 1.4) + earlyInterestHoldPaceTolerance);
      const shouldHoldEarlyThreshold = earlyInterestHoldEnabled && isPreLateRounds && isMildPaceLag && rosterPressure < 1;
      const effectiveCompletionPressure = shouldHoldEarlyThreshold
        ? Math.min(completionPressure, earlyInterestHoldMaxPressure)
        : completionPressure;

      const minimumInterest = calculateMinimumInterest(effectiveCompletionPressure);
      const roundThresholdBias = calculateRoundThresholdBias(roundNumber);
      const interestThreshold = minimumInterestToThreshold(minimumInterest + roundThresholdBias * 18);

      // Need Ratio: how many players I need vs how many nomination rounds remain
      // This is the "Roster Completion Score" — works with any lobby size
      const playersNeededTotal = Math.max(0, targetRosterSize - currentRosterSize);
      const needRatio = roundsIncludingCurrent > 0 ? playersNeededTotal / roundsIncludingCurrent : 0;
      
      if (effectiveCompletionPressure > 20) {
        console.log(`[CPU-${team.name}] COMPLETION PRESSURE=${effectiveCompletionPressure.toFixed(1)} | Interest dropped to ${minimumInterest.toFixed(0)}/88 (threshold=${interestThreshold.toFixed(2)}) | Roster: ${currentRosterSize}/${targetRosterSize} | League avg: ${leagueAvgRosterSize.toFixed(1)} | NeedRatio: ${needRatio.toFixed(2)}`);
      } else if (effectiveCompletionPressure > 10) {
        console.log(`[CPU-${team.name}] Behind pace: pressure=${effectiveCompletionPressure.toFixed(1)}, threshold=${interestThreshold.toFixed(2)} (widening player pool)`);
      }
      let bidStrategyDirection = 'balanced'; // default
      
      if (missingCriticalStarters.length >= 3) {
        // Many position gaps = FOCUS STRATEGY
        // Bid narrowly on critical positions, be selective
        bidStrategyDirection = 'focus';
        console.log(`[CPU-${team.name}] FOCUS STRATEGY: ${missingCriticalStarters.length} critical gaps [${missingCriticalStarters.join(', ')}] - bid on fewer players, target specific needs`);
      } else if (missingCriticalStarters.length === 0 && currentRosterSize < 12) {
        // Starters filled but need bench = SPREAD STRATEGY
        // Bid widely on bench/depth players, any position
        bidStrategyDirection = 'spread';
        console.log(`[CPU-${team.name}] SPREAD STRATEGY: Starters filled (${currentRosterSize}/${maxRosterSize} players) - bid on many players to fill bench`);
      } else if (budgetHealth === 'desperate') {
        // Low budget = OPPORTUNISTIC STRATEGY
        // Bid on cheap players, look for bargains
        bidStrategyDirection = 'opportunistic';
        console.log(`[CPU-${team.name}] OPPORTUNISTIC STRATEGY: Budget=$${team.budget} (desperate) - focus on bargain $1-15 range`);
      } else if (positionImbalance >= 4) {
        // Very imbalanced roster = BALANCE STRATEGY
        // Prioritize underrepresented positions
        bidStrategyDirection = 'balance';
        console.log(`[CPU-${team.name}] BALANCE STRATEGY: Roster imbalanced (spread ${positionImbalance} across positions) - prioritize weak spots`);
      }

      const computedSpreadFillMode = roundNumber >= 7 && currentRosterSize < targetRosterSize && rosterSpotsLeft >= 2;
      const forcedSpreadMode = typeof options?.forceSpread === 'boolean' ? options.forceSpread : null;

      teamStrategies[team.name] = {
        aggressiveness: baseAggressiveness,
        budgetPerRound,
        budgetHealth,
        bidStrategyDirection,
        missingCriticalStarters,
        rosterFullnessPercent,
        positionImbalance,
        rosterSpotsLeft,
        roundsLeft,
        roundsIncludingCurrent,
        targetRosterSize,
        desiredRosterCap,
        rosterFloorTarget,
        playersNeededForFloor,
        rosterFloorMode,
        topTalentMode,
        draftBufferTarget,
        playersNeededForMinimum,
        playersNeededForBuffer,
        isBehindMinimumPace,
        isBehindFloorPace,
        isBehindBufferPace,
        mustFillRoster: isBehindMinimumPace || isBehindFloorPace || isFinalRoundFill,
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
        starAvailabilityPercentage,
        shouldOverrideLowballMode,
        missingStarterCount: totalMissing,
        emergencyStarterFillMode: roundsIncludingCurrent <= 3 && mustFillPositions.length > 0,
        spreadFillMode: forcedSpreadMode === null ? computedSpreadFillMode : forcedSpreadMode,
        draftBufferMode: isBehindBufferPace && currentRosterSize < targetRosterSize && rosterSpotsLeft >= 1,
        fillNeedPositions: [...new Set([
          ...mustFillPositions,
          ...proactiveFillPositions,
          ...underrepresentedPositions,
          ...(currentRosterSize < targetRosterSize && rosterSpotsLeft >= 2 ? ['RB', 'WR', 'TE'] : [])
        ])],
        roundNumber, // Track current round for market analysis
        paceVariance, // How far behind/ahead of pace
        requiredPace, // Required players per round
        targetPlayersPerRound,
        expectedRosterByNow,
        earlyPaceGap,
        requiredWinsPerRound,
        baselineWinsPerRound,
        isWinRateBehind,
        winRatePressure,
        isBehindPace, // Behind pace flag
        isAheadOfPace, // Ahead of pace flag
        playersNeededForPace, // Players needed to catch up to pace
        // === THREE-BRAIN ARCHITECTURE ===
        rosterPressure,        // Brain 2: how urgent is it to draft players?
        positionScarcity,      // Brain 3a: per-position supply vs demand
        dynamicBudgetReserve,  // Brain 3b: minimum $$ to keep for legal roster
        gmConfidence,          // GM Confidence Meter: 100 = plan intact, 20 = scrambling
        // === DRAFT COMPLETION AI ===
        completionPressure: effectiveCompletionPressure,    // 0–40: how far behind schedule (pace + league avg), with optional early-round hold
        minimumInterest,       // 40–88: acceptance threshold (drops as pressure rises)
        interestThreshold,     // 0.20–0.75: teamValue floor for player consideration
        needRatio,             // playersNeeded / roundsRemaining (lobby-agnostic)
        leagueAvgRosterSize    // current average roster size across all CPU teams
      };

      const profileLabel = getTeamProfileLabel(team.name, personality);
      const profileApproach = String(profileLabel).replace(/#\d+$/, '').replace('&', 'and').trim();
      const starredTargets = Array.from(starredTargetIds)
        .map((playerId) => {
          const player = (allPlayers || []).find((candidate) => getPlayerIdKey(candidate) === playerId)
            || (roundPlayers || []).find((candidate) => getPlayerIdKey(candidate) === playerId);
          if (!player) return null;
          return {
            id: Number(player?.id || 0) || null,
            name: String(player?.name || ''),
            position: String(player?.position || ''),
            avgValue: Number(player?.avgValue || 0),
            prerank: Number(player?.prerank || 0) || null
          };
        })
        .filter(Boolean)
        .sort((a, b) => {
          if (Number(a?.prerank || 9999) !== Number(b?.prerank || 9999)) {
            return Number(a?.prerank || 9999) - Number(b?.prerank || 9999);
          }
          return String(a?.name || '').localeCompare(String(b?.name || ''));
        });
      team.cpuProfileLabel = profileLabel;
      team.cpuProfileApproach = profileApproach;
      team.cpuStarTargetIds = Array.from(starredTargetIds);
      team.cpuStarTargets = starredTargets;
      console.log(`[generateCPUBids] ${team.name} uses ${profileApproach} approach (profile=${profileLabel}) (aggr:${Number(personality.aggression || 1).toFixed(2)}, value:${Number(personality.valueHunter || 1).toFixed(2)}, sleeper:${Number(personality.sleeperHunter || 1).toFixed(2)}, stars:${Number(personality.starsAndScrubs || 1).toFixed(2)}) strategy: ${baseAggressiveness.toFixed(2)}x aggressive, $${budgetPerRound.toFixed(0)}/round, ${rosterSpotsLeft} spots left, must-fill: [${mustFillPositions.join(', ')}], underrep: [${underrepresentedPositions.join(', ')}], stars: ${starredTargetIds.size}, stars-now: ${starTargetState.availableNowIds.size}, wins/round need: ${requiredWinsPerRound.toFixed(2)} (base ${baselineWinsPerRound.toFixed(2)})`);
    }

    const playerExposureCounts = {};

    // Used for pre-loop budget snapshot math below.
    // Team-specific emergency bypass is still computed again inside the team loop.
    const reserveBypass = Number(roundNumber) >= 6 || Object.values(teamStrategies).some((strategy) => {
      if (!strategy) return false;
      const needRatio = Number(strategy.needRatio || 0);
      const playersNeeded = Number(strategy.playersNeededForMinimum || 0);
      const roundsOpen = Number(strategy.roundsIncludingCurrent || draftRoundCount);
      return needRatio >= 0.75 || playersNeeded >= roundsOpen;
    });

    // Build opponent budget map for Round 10 strategic decisions
    const opponentBudgetMap = {};
    for (const team of cpuTeams) {
      const budgetRemaining = getBidBudgetForTeam(team, 0, maxRosterSize, reserveBypass) || team.budget;
      opponentBudgetMap[team.name] = budgetRemaining;
    }
    const wealthiestOpponentBudget = Math.max(...Object.values(opponentBudgetMap));
    const wealthiestTeamName = Object.keys(opponentBudgetMap).find(name => opponentBudgetMap[name] === wealthiestOpponentBudget);
    
    // Find 2nd wealthiest for efficient bidding by wealthiest team
    const sortedBudgets = Object.values(opponentBudgetMap).sort((a, b) => b - a);
    const secondWealthiestBudget = sortedBudgets.length > 1 ? sortedBudgets[1] : 0;
    
    if (Number(roundNumber) === draftRoundCount) {
      console.log(`[generateCPUBids] Round 10 budget snapshot: ${Object.entries(opponentBudgetMap).map(([name, budget]) => `${name}=$${budget}`).join(', ')} | Wealthiest: ${wealthiestTeamName} ($${wealthiestOpponentBudget}) | 2nd Wealthiest: $${secondWealthiestBudget}`);
    }

    // Generate bids for each CPU team
    for (const team of cpuTeams) {
      const strategy = teamStrategies[team.name];
      cpuBids[team.name] = [];
      const positionCounts = getRosterPositionCounts(team);
      const strategicCap = Math.min(
        maxRosterSize,
        Math.max(1, Number(strategy.desiredRosterCap || strategy.targetRosterSize || maxRosterSize))
      );
      const effectiveRosterCap = Number(roundNumber) >= 6 ? maxRosterSize : strategicCap;

      if ((team.roster || []).length >= effectiveRosterCap) {
        console.log(`[CPU-${team.name}] At strategic roster cap (${effectiveRosterCap}), skipping low-value depth bids`);
        continue;
      }

      // Load config once per team (for use in spread mode logic and filler bids)
      const cfg = loadCpuLogicConfig();
      const cheapFillerBidFrequency = cfg?.silent?.cheapFillerBidFrequency || 0.35;
      const spreadBidVolumeMultiplier = Math.max(0.35, Math.min(1.25, Number(cfg?.silent?.spreadBidVolumeMultiplier ?? 1.0)));
      const spreadDollarBidMultiplier = Math.max(0, Math.min(1.25, Number(cfg?.silent?.spreadDollarBidMultiplier ?? 1.0)));
      const spreadDraftChanceFloorRaw = Number(cfg?.silent?.spreadDraftChanceFloor ?? 0.55);
      const spreadFillerBidMax = Math.max(0, Math.min(3, Math.floor(Number(cfg?.silent?.spreadFillerBidMax ?? 2))));
      const globalBidVolumeMultiplier = Math.max(0.35, Math.min(1.25, Number(cfg?.silent?.globalBidVolumeMultiplier ?? 1.0)));
      const earlyRoundMaxBidsCap = Math.max(3, Math.min(12, Math.floor(Number(cfg?.silent?.earlyRoundMaxBidsCap ?? 6))));
      const earlyTopRankFocusEnabled = cfg?.silent?.earlyTopRankFocusEnabled !== false;
      const earlyTopRankFocusMaxRound = Math.max(1, Math.min(draftRoundCount, Math.floor(Number(cfg?.silent?.earlyTopRankFocusMaxRound ?? 3))));
      const earlyTopRankFocusMaxRank = Math.max(50, Math.min(250, Math.floor(Number(cfg?.silent?.earlyTopRankFocusMaxRank ?? 150))));
      const volumeBidsStartRound = Math.max(1, Math.min(draftRoundCount, Math.floor(Number(cfg?.silent?.volumeBidsStartRound ?? 8))));
      const midRoundLikelyDraftedOnlyEnabled = cfg?.silent?.midRoundLikelyDraftedOnlyEnabled !== false;
      const midRoundLikelyDraftedMinAV = Math.max(0, Number(cfg?.silent?.midRoundLikelyDraftedMinAV ?? 6));
      const midRoundLikelyDraftedDraftChanceFloorRaw = Number(cfg?.silent?.midRoundLikelyDraftedDraftChanceFloor ?? 0.35);
      const midRoundLowAvHardCap = Math.max(0, Number(cfg?.silent?.midRoundLowAvHardCap ?? 3));
      const draftChancePrimaryEnabled = cfg?.silent?.draftChancePrimaryEnabled !== false;
      const draftChancePrimaryBaseFloor = Math.max(0, Math.min(1, Number(cfg?.silent?.draftChancePrimaryBaseFloor ?? 0.5)));
      const draftChancePrimaryMinFloor = Math.max(0, Math.min(draftChancePrimaryBaseFloor, Number(cfg?.silent?.draftChancePrimaryMinFloor ?? 0.14)));
      const draftChanceNeedDropPerNeedRatio = Math.max(0, Math.min(0.5, Number(cfg?.silent?.draftChanceNeedDropPerNeedRatio ?? 0.2)));
      const draftChancePressureDropScale = Math.max(0, Math.min(0.03, Number(cfg?.silent?.draftChancePressureDropScale ?? 0.008)));
      const lateRoundPaceThresholdHitEnabled = cfg?.silent?.lateRoundPaceThresholdHitEnabled !== false;
      const lateRoundPaceThresholdStartRound = Math.max(1, Math.min(draftRoundCount, Math.floor(Number(cfg?.silent?.lateRoundPaceThresholdStartRound ?? 7))));
      const lateRoundPaceThresholdPerRoundHit = Math.max(0, Math.min(0.08, Number(cfg?.silent?.lateRoundPaceThresholdPerRoundHit ?? 0.02)));
      const lateRoundPaceThresholdMaxHit = Math.max(0, Math.min(0.2, Number(cfg?.silent?.lateRoundPaceThresholdMaxHit ?? 0.08)));
      const globalInterestThresholdScale = Math.max(1, Math.min(1.5, Number(cfg?.silent?.globalInterestThresholdScale ?? 1)));
      const globalInterestThresholdCap = Math.max(0.75, Math.min(0.98, Number(cfg?.silent?.globalInterestThresholdCap ?? 0.9)));
      const affordabilityTradeDownEnabled = cfg?.silent?.affordabilityTradeDownEnabled !== false;
      const affordabilityOverAvBudgetCap = Math.max(0.2, Math.min(0.8, Number(cfg?.silent?.affordabilityOverAvBudgetCap ?? 0.4)));
      const earlyRoundVolumeBidsEnabled = cfg?.silent?.earlyRoundVolumeBidsEnabled === true;
      const earlyRoundRefillEnabled = cfg?.silent?.earlyRoundRefillEnabled === true;
      const earlyRoundCoverageEnabled = cfg?.silent?.earlyRoundCoverageEnabled === true;
      const earlyRoundAvFloorMultiplier = Math.max(0.55, Math.min(1.2, Number(cfg?.silent?.earlyRoundAvFloorMultiplier ?? 0.78)));
      const earlyRoundAvCeilingMultiplier = Math.max(0.8, Math.min(1.35, Number(cfg?.silent?.earlyRoundAvCeilingMultiplier ?? 1.1)));
      const normalizeDraftChance = (player) => {
        const raw = Number(player?.draftChance ?? 0);
        if (!Number.isFinite(raw) || raw <= 0) return 0;
        return raw > 1 ? Math.max(0, Math.min(1, raw / 100)) : Math.max(0, Math.min(1, raw));
      };
      const spreadDraftChanceFloor = Math.max(0, Math.min(1, spreadDraftChanceFloorRaw > 1 ? (spreadDraftChanceFloorRaw / 100) : spreadDraftChanceFloorRaw));
      const midRoundLikelyDraftedDraftChanceFloor = Math.max(0, Math.min(1, midRoundLikelyDraftedDraftChanceFloorRaw > 1 ? (midRoundLikelyDraftedDraftChanceFloorRaw / 100) : midRoundLikelyDraftedDraftChanceFloorRaw));
      const inMidRounds = Number(roundNumber) >= 3 && Number(roundNumber) <= 7;
      const thresholdDebugMinRound = Math.max(1, Math.min(draftRoundCount, Number(thresholdDebug?.minRound ?? 6)));
      const thresholdDebugMaxRound = Math.max(thresholdDebugMinRound, Math.min(draftRoundCount, Number(thresholdDebug?.maxRound ?? draftRoundCount)));
      const thresholdDebugTeams = new Set((Array.isArray(thresholdDebug?.teams) ? thresholdDebug.teams : []).map((n) => String(n || '').trim().toLowerCase()).filter(Boolean));
      const thresholdDebugPlayers = new Set((Array.isArray(thresholdDebug?.players) ? thresholdDebug.players : []).map((n) => String(n || '').trim().toLowerCase()).filter(Boolean));
      const thresholdDebugMaxSamplesPerTeamRound = Math.max(1, Math.min(500, Number(thresholdDebug?.maxSamplesPerTeamRound ?? 2)));
      let thresholdDebugSamplesForTeamRound = 0;
      const thresholdDebugSampledPlayerIds = new Set();

      const debugRoundNumber = Number(roundNumber) || 1;
      const debugThresholdBase = Math.min(
        globalInterestThresholdCap,
        Number(strategy.interestThreshold ?? 0.74) * globalInterestThresholdScale
      );
      const debugDebtWidening = (strategy.needRatio || 0) >= 0.9
        ? 0.18
        : (strategy.completionPressure || 0) >= 12
          ? 0.1
          : 0;
      const debugWinRateWidening = (strategy.requiredWinsPerRound || 0) > (strategy.baselineWinsPerRound || 1.4)
        ? Math.min(0.18, ((strategy.requiredWinsPerRound || 0) - (strategy.baselineWinsPerRound || 1.4)) * 0.22)
        : 0;
      const debugPressureWidening = (strategy.completionPressure || 0) >= 18 ? 0.06 : 0;
      const debugFloorWidening = strategy.rosterFloorMode
        ? ((strategy.roundsIncludingCurrent || draftRoundCount) <= 3 ? 0.12 : 0.08)
        : 0;
      const debugFloorEndgameWidening = (
        (strategy.roundsIncludingCurrent || draftRoundCount) <= 2
        && (strategy.playersNeededForFloor || 0) > 0
      ) ? 0.22 : 0;
      const debugStageSinceLateStart = Math.max(0, debugRoundNumber - lateRoundPaceThresholdStartRound + 1);
      const debugIsBehindPace = (strategy.requiredWinsPerRound || 0) > ((strategy.baselineWinsPerRound || 1.4) + 0.01);
      const debugHasOpenRosterNeed = (strategy.rosterSpotsLeft || 0) > 0;
      const debugLateRoundPaceWidening = (lateRoundPaceThresholdHitEnabled && debugStageSinceLateStart > 0 && debugIsBehindPace && debugHasOpenRosterNeed)
        ? Math.min(lateRoundPaceThresholdMaxHit, debugStageSinceLateStart * lateRoundPaceThresholdPerRoundHit)
        : 0;
      const debugRoundThresholdBias = calculateRoundThresholdBias(debugRoundNumber);
      const debugEffectiveThreshold = Math.max(
        0.02,
        debugThresholdBase
          - debugDebtWidening
          - debugWinRateWidening
          - debugPressureWidening
          - debugFloorWidening
          - debugFloorEndgameWidening
          - debugLateRoundPaceWidening
          + debugRoundThresholdBias * 0.08
      );

      const shouldCollectRoundSnapshot = !!(
        thresholdDebug
        && thresholdDebugCollector
        && debugRoundNumber >= thresholdDebugMinRound
        && debugRoundNumber <= thresholdDebugMaxRound
        && (thresholdDebugTeams.size === 0 || thresholdDebugTeams.has(String(team?.name || '').toLowerCase()))
      );

      if (shouldCollectRoundSnapshot) {
        const snapshotCandidate = (roundPlayers || [])
          .filter((p) => !p?.owner && isValidRosterAddition(team, p, rosterLimits, effectiveRosterCap))
          .sort((a, b) => Number(b?.avgValue || 0) - Number(a?.avgValue || 0))[0] || null;

        if (snapshotCandidate) {
          const snapshotTeamValue = calculatePlayerValueForTeam(team, snapshotCandidate, {
            remainingPlayers: roundPlayers,
            rosterLimits,
            maxRosterSize: effectiveRosterCap,
            strategy,
            totalBudgetCommitted: 0
          });
          thresholdDebugCollector.push({
            sampleType: 'roundSnapshot',
            round: debugRoundNumber,
            teamName: String(team?.name || ''),
            playerName: String(snapshotCandidate?.name || ''),
            position: String(snapshotCandidate?.position || ''),
            avgValue: Number(snapshotCandidate?.avgValue || 0),
            draftChance: Number(snapshotCandidate?.draftChance || 0),
            teamValue: Number(snapshotTeamValue || 0),
            thresholdBase: Number(debugThresholdBase || 0),
            debtWidening: Number(debugDebtWidening || 0),
            winRateWidening: Number(debugWinRateWidening || 0),
            pressureWidening: Number(debugPressureWidening || 0),
            floorWidening: Number(debugFloorWidening || 0),
            floorEndgameWidening: Number(debugFloorEndgameWidening || 0),
            lateRoundPaceWidening: Number(debugLateRoundPaceWidening || 0),
            stageSinceLateStart: Number(debugStageSinceLateStart || 0),
            isBehindPace: !!debugIsBehindPace,
            requiredWinsPerRound: Number(strategy.requiredWinsPerRound || 0),
            baselineWinsPerRound: Number(strategy.baselineWinsPerRound || 0),
            rosterSpotsLeft: Number(strategy.rosterSpotsLeft || 0),
            effectiveThreshold: Number(debugEffectiveThreshold || 0),
            passesThreshold: Number(snapshotTeamValue || 0) >= debugEffectiveThreshold
          });
        }
      }
      const collectThresholdDebugSample = (player, teamValueOverride = null) => {
        const debugPlayerId = Number(player?.id || 0);
        const debugRoundNumberLocal = Number(roundNumber) || 1;
        const shouldCollectThresholdDebug = !!(
          thresholdDebug
          && thresholdDebugCollector
          && debugRoundNumberLocal >= thresholdDebugMinRound
          && debugRoundNumberLocal <= thresholdDebugMaxRound
          && (thresholdDebugTeams.size === 0 || thresholdDebugTeams.has(String(team?.name || '').toLowerCase()))
          && (thresholdDebugPlayers.size === 0 || thresholdDebugPlayers.has(String(player?.name || '').toLowerCase()))
          && thresholdDebugSamplesForTeamRound < thresholdDebugMaxSamplesPerTeamRound
          && (!debugPlayerId || !thresholdDebugSampledPlayerIds.has(debugPlayerId))
        );

        if (!shouldCollectThresholdDebug || !player) return null;

        const computedTeamValue = Number.isFinite(Number(teamValueOverride))
          ? Number(teamValueOverride)
          : Number(calculatePlayerValueForTeam(team, player, {
              remainingPlayers: roundPlayers,
              rosterLimits,
              maxRosterSize: effectiveRosterCap,
              strategy,
              totalBudgetCommitted
            }) || 0);
        const passesThreshold = computedTeamValue >= debugEffectiveThreshold;

        thresholdDebugCollector.push({
          sampleType: 'playerThreshold',
          playerId: debugPlayerId,
          round: debugRoundNumberLocal,
          teamName: String(team?.name || ''),
          playerName: String(player?.name || ''),
          position: String(player?.position || ''),
          avgValue: Number(player?.avgValue || 0),
          draftChance: Number(player?.draftChance || 0),
          teamValue: computedTeamValue,
          thresholdBase: Number(debugThresholdBase || 0),
          debtWidening: Number(debugDebtWidening || 0),
          winRateWidening: Number(debugWinRateWidening || 0),
          pressureWidening: Number(debugPressureWidening || 0),
          floorWidening: Number(debugFloorWidening || 0),
          floorEndgameWidening: Number(debugFloorEndgameWidening || 0),
          lateRoundPaceWidening: Number(debugLateRoundPaceWidening || 0),
          stageSinceLateStart: Number(debugStageSinceLateStart || 0),
          isBehindPace: !!debugIsBehindPace,
          requiredWinsPerRound: Number(strategy.requiredWinsPerRound || 0),
          baselineWinsPerRound: Number(strategy.baselineWinsPerRound || 0),
          rosterSpotsLeft: Number(strategy.rosterSpotsLeft || 0),
          effectiveThreshold: Number(debugEffectiveThreshold || 0),
          passesThreshold
        });

        if (debugPlayerId) {
          thresholdDebugSampledPlayerIds.add(debugPlayerId);
        }
        thresholdDebugSamplesForTeamRound += 1;
        return passesThreshold;
      };
      const isLikelyDraftedMidRound = (player) => {
        if (!player) return false;
        const av = Number(player.avgValue || 0);
        const draftChance = normalizeDraftChance(player);
        return av >= midRoundLikelyDraftedMinAV || draftChance >= midRoundLikelyDraftedDraftChanceFloor;
      };
      const getDynamicDraftChanceFloor = (player, isMustKeepPosition = false) => {
        if (!draftChancePrimaryEnabled || Number(roundNumber) === draftRoundCount || isMustKeepPosition) return 0;
        let floor = draftChancePrimaryBaseFloor;
        floor -= Math.max(0, Number(strategy.needRatio || 0)) * draftChanceNeedDropPerNeedRatio;
        floor -= Math.max(0, Number(strategy.completionPressure || 0)) * draftChancePressureDropScale;
        if ((strategy.playersNeededForMinimum || 0) >= (strategy.roundsIncludingCurrent || draftRoundCount)) {
          floor -= 0.1;
        }
        if (Number(player?.avgValue || 0) >= midRoundLikelyDraftedMinAV) {
          floor = Math.min(floor, 0.22);
        }
        if (Number(roundNumber) <= 3) {
          floor = Math.max(floor, 0.45);
        } else if (Number(roundNumber) <= 5) {
          floor = Math.max(floor, 0.35);
        }
        return Math.max(draftChancePrimaryMinFloor, Math.min(1, floor));
      };
      const passesMidRoundGuard = (player, isMustKeepPosition = false) => {
        if (!inMidRounds) return true;
        if (isMustKeepPosition) return true;
        if (!player) return false;
        const av = Number(player.avgValue || 0);
        if (av <= midRoundLowAvHardCap) return false;
        if (!midRoundLikelyDraftedOnlyEnabled) return true;
        return isLikelyDraftedMidRound(player);
      };

      // Track total budget committed to bids this round
      let totalBudgetCommitted = 0;
      const reserveBypass = Number(roundNumber) >= 6
        || !!strategy.emergencyStarterFillMode
        || Number(strategy.needRatio || 0) >= 0.75
        || Number(strategy.playersNeededForMinimum || 0) >= Number(strategy.roundsIncludingCurrent || draftRoundCount);

      // DYNAMIC BUDGET RESERVE (Brain 3b):
      // Always keep at least $1 per missing starter slot so the team can
      // still draft a legal roster. This is calculated as a hard floor on
      // spendable budget, separate from the existing getEffectiveBudget reserve.
      const dynamicReserveFloor = strategy.dynamicBudgetReserve || 0;
      const spendableBudget = Math.max(0, (team.budget - dynamicReserveFloor));

      // Check if team has any budget left to bid
      const remainingBudget = Math.min(
        getBidBudgetForTeam(team, totalBudgetCommitted, effectiveRosterCap, reserveBypass),
        spendableBudget - totalBudgetCommitted
      );
      if (remainingBudget <= 0) {
        console.log(`[CPU-${team.name}] No budget remaining (spendable=$${spendableBudget}, reserve=$${dynamicReserveFloor} for ${strategy.dynamicBudgetReserve} missing starters), skipping bids`);
        continue;
      }

      const valuationContext = {
        remainingPlayers: roundPlayers,
        rosterLimits,
        maxRosterSize: effectiveRosterCap,
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
          if (!player.owner && isValidRosterAddition(team, player, rosterLimits, effectiveRosterCap)) {
            // ============================================================
            // BENCH SUPPRESSION (Brain 2 + Brain 3 gate)
            // If this team has critical starter gaps AND rosterPressure is
            // meaningful, block bench-filling bids entirely.
            // This is a HARD BLOCK, not a probability reduction.
            // Exceptions: starred targets and must-fill positions always pass.
            // ============================================================
            const isStarred = strategy.starredTargetIds?.has(getPlayerIdKey(player));
            const isMustFill = (strategy.mustFillPositions || []).includes(player.position);

            // Early rounds should concentrate on top-ranked players unless this is a starred
            // target or a required roster-fill position.
            if (earlyTopRankFocusEnabled && Number(roundNumber) <= earlyTopRankFocusMaxRound && !isStarred && !isMustFill) {
              const overallRank = Number(player?.prerank ?? player?.rank ?? player?.positionRank ?? Number.POSITIVE_INFINITY);
              if (Number.isFinite(overallRank) && overallRank > earlyTopRankFocusMaxRank) {
                return false;
              }
            }

            if (strategy.topTalentMode && !isStarred && !isMustFill && Number(player.avgValue || 0) < 16) {
              return false;
            }
            
            if (!isStarred && !isMustFill && strategy.rosterPressure > 0.85 && strategy.missingCriticalStarters.length > 0) {
              // Check if this player would fill a starting slot (counts toward minimum)
              const teamPosCount = (team.roster || []).filter(p => p.position === player.position).length;
              const playerFillsStarter = teamPosCount < getPositionMinimum(player.position, rosterLimits);
              const completionEmergency = (strategy.completionPressure || 0) >= 14;
              const lateRoundCatchUp = (strategy.roundsIncludingCurrent || draftRoundCount) <= 3;
              const severeNeedRatio = (strategy.needRatio || 0) >= 1.0;
              
              if (!playerFillsStarter && !completionEmergency && !lateRoundCatchUp && !severeNeedRatio) {
                // Hard block: team needs starters, this player would only fill a bench slot
                return false;
              }
            }

            // Prefer RB/WR/TE bench depth over extra specialists unless required.
            // Keep this strict before endgame so teams do not stack K/DEF early.
            if ((player.position === 'K' || player.position === 'DEF') && !isMustFill) {
              const specialistFilled = (positionCounts[player.position] || 0) >= getPositionMinimum(player.position, rosterLimits);
              if (specialistFilled) {
                const inEndgame = (strategy.roundsIncludingCurrent || draftRoundCount) <= 2;
                const stillNeedPlayers = (strategy.playersNeededForMinimum || 0) > 0;
                if (!inEndgame || stillNeedPlayers) {
                  return false;
                }
              }
            }

            const draftChance = normalizeDraftChance(player);
            const dynamicDraftChanceFloor = getDynamicDraftChanceFloor(player, isStarred || isMustFill);
            if (!isStarred && !isMustFill && draftChance < dynamicDraftChanceFloor) {
              return false;
            }

            if (affordabilityTradeDownEnabled && !isStarred && !isMustFill) {
              const budgetNow = getBidBudgetForTeam(team, totalBudgetCommitted, effectiveRosterCap, reserveBypass);
              const av = Number(player?.avgValue || 0);
              const affordableAvCap = Math.max(2, budgetNow * affordabilityOverAvBudgetCap);
              if (av > affordableAvCap && budgetNow < av) {
                return false;
              }
            }
            return true;
          }
          // --- ENHANCEMENT: Allow star hunting for bench if budget allows ---
          // If team has filled starting spot for this position, but player is a big name and team has surplus budget, allow bidding for bench
          const isBigName = player.avgValue >= 40;
          const openSlots = getOpenSlots(team, effectiveRosterCap);
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
            mustFillPriority = 2.5;
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
          if (player.avgValue >= 40 && team.budget > 25 && getOpenSlots(team, effectiveRosterCap) > 0) {
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

          // Strongly downweight extra K/DEF unless they still fill a required starter slot.
          if (isSpecialist && !missingStarterAtPosition) {
            const endgame = (strategy.roundsIncludingCurrent || draftRoundCount) <= 2;
            if (!endgame || (strategy.playersNeededForMinimum || 0) > 0) {
              mustFillPriority = Math.min(mustFillPriority, 0.28);
            } else {
              mustFillPriority = Math.min(mustFillPriority, 0.5);
            }
          }

          if (isStarredTarget) {
            mustFillPriority = Math.max(mustFillPriority, 1.8);
          } else if (holdForUnavailableStar && !(strategy.mustFillPositions || []).includes(player.position)) {
            mustFillPriority = Math.min(mustFillPriority, 0.82);
          }

          // ============================================================
          // BRAIN 2: ROSTER PRESSURE SCALING
          // The more urgent it is to fill the roster, the more this team
          // prioritizes players that fill a needed starter slot.
          // Comfort zone: pressure < 0.5 → no extra boost
          // Danger zone:  pressure 0.5-1.0 → scale up needed positions
          // Emergency:    pressure > 1.0 → ALL starter bids get max priority
          // ============================================================
          const playerNeedsStarter = strategy.missingCriticalStarters.includes(player.position);
          if (strategy.rosterPressure > 0.5 && playerNeedsStarter) {
            const pressureBoost = Math.min(3.0, (strategy.rosterPressure - 0.5) * 4);
            mustFillPriority = Math.max(mustFillPriority, 1 + pressureBoost);
          }

          // ============================================================
          // BRAIN 3: POSITION SCARCITY PANIC
          // If this position has fewer remaining players than teams that need it,
          // override everything and bid now — supply is disappearing.
          // ============================================================
          const posScarcityValue = (strategy.positionScarcity || {})[player.position] ?? 2.0;
          if (playerNeedsStarter) {
            if (posScarcityValue < 0.7) {
              // PANIC: Must grab this position NOW before it dries up
              mustFillPriority = Math.max(mustFillPriority, 4.5);
            } else if (posScarcityValue < 1.0) {
              // TIGHT: Grab one soon
              mustFillPriority = Math.max(mustFillPriority, 2.5);
            } else if (posScarcityValue < 1.5) {
              // COMFORTABLE but keep watching
              mustFillPriority = Math.max(mustFillPriority, 1.5);
            }
          }

          // ============================================================
          // FINAL 3 ROUNDS: OVERRIDE PERSONALITIES
          // Human managers don't stay "patient" in round 8-10 if they still
          // don't have a defense. In the final 3 rounds, bid by survival need.
          //   Team full  → 5% selection chance
          //   Fills starter → 95% (max priority)
          //   Fills bench  → 60% (moderate priority)
          // ============================================================
          const isFinalThreeRounds = strategy.roundsIncludingCurrent <= 3;
          if (isFinalThreeRounds) {
            const teamPosCounts = getRosterPositionCounts(team);
            const teamIsFull = getOpenSlots(team, effectiveRosterCap) <= 0;
            const playerFillsStarter = (teamPosCounts[player.position] || 0) < getPositionMinimum(player.position, rosterLimits);
            
            if (teamIsFull) {
              mustFillPriority = 0.05; // 5%: already have a full roster, stop bidding
            } else if (playerFillsStarter) {
              mustFillPriority = Math.max(mustFillPriority, 5.0); // 95%: must get this starter
            } else {
              mustFillPriority = Math.max(mustFillPriority, 1.5); // 60%: bench depth is OK
            }
          }

          // ============================================================
          // GM CONFIDENCE MULTIPLIER
          // When a team's draft plan is falling apart (starred targets all gone),
          // they become less selective: bid on more positions, reach further.
          // 100% confidence → normal selection weights
          //  80% confidence → 15% broader targeting
          //  60% confidence → 35% broader targeting
          //  40% confidence → 60% broader targeting (reaching for value)
          //  20% confidence → scramble mode (bid on almost anything that fits)
          // ============================================================
          const gmConf = strategy.gmConfidence ?? 100;
          const gmConfBoost = gmConf >= 80 ? 1.00
                            : gmConf >= 60 ? 1.15
                            : gmConf >= 40 ? 1.35
                            : 1.60;
          mustFillPriority *= gmConfBoost;

          return {
            player,
            teamValue,
            mustFillPriority,
            earlySpecialistTarget,
            selectionWeight: Math.max(0.25, teamValue * mustFillPriority * specialistOpportunityMultiplier * (player.avgValue >= 45 ? 1.05 : 1) * (isStarredTarget ? 1.2 : 1))
          };
        })
        .filter(entry => {
          if (Number(roundNumber) === draftRoundCount) {
            return true;
          }

          const isMustFillPosition = (strategy.mustFillPositions || []).includes(entry?.player?.position);
          if (isMustFillPosition) return true;
          
          // DYNAMIC INTEREST THRESHOLD (Draft Completion AI)
          // Replaces the old hard 0.75 / 0.2 split.
          // interestThreshold drops as completionPressure rises:
          //   Comfortable (on pace, league average) → 0.75 (only high-value players)
          //   Slightly behind                       → 0.60
          //   Behind pace + below league avg        → 0.45
          //   Emergency (pressure > 20)             → 0.20 (almost anything that fits)
          // This is the "should I PASS?" gate — passing becomes harder when behind.
          const threshold = Math.min(
            globalInterestThresholdCap,
            (strategy.interestThreshold ?? 0.74) * globalInterestThresholdScale
          );
          const debtWidening = (strategy.needRatio || 0) >= 0.9
            ? 0.18
            : (strategy.completionPressure || 0) >= 12
              ? 0.1
              : 0;
          const winRateWidening = (strategy.requiredWinsPerRound || 0) > (strategy.baselineWinsPerRound || 1.4)
            ? Math.min(0.18, ((strategy.requiredWinsPerRound || 0) - (strategy.baselineWinsPerRound || 1.4)) * 0.22)
            : 0;
          const pressureWidening = (strategy.completionPressure || 0) >= 18 ? 0.06 : 0;
          const floorWidening = strategy.rosterFloorMode
            ? ((strategy.roundsIncludingCurrent || draftRoundCount) <= 3 ? 0.12 : 0.08)
            : 0;
          const floorEndgameWidening = (
            (strategy.roundsIncludingCurrent || draftRoundCount) <= 2
            && (strategy.playersNeededForFloor || 0) > 0
          ) ? 0.22 : 0;
          // Situational late-round pacing hit:
          // R7/R8/R9/R10 => -2/-4/-6/-8 points (0.02 each stage) only when behind pace.
          const currentRoundNumber = Number(roundNumber) || 1;
          const round6to10BaseWidening = currentRoundNumber >= 6 && currentRoundNumber <= draftRoundCount
            ? 0.015
            : 0;
          const stageSinceLateStart = Math.max(0, currentRoundNumber - lateRoundPaceThresholdStartRound + 1);
          const isBehindPace = (strategy.requiredWinsPerRound || 0) > ((strategy.baselineWinsPerRound || 1.4) + 0.01);
          const hasOpenRosterNeed = (strategy.rosterSpotsLeft || 0) > 0;
          const lateRoundPaceWidening = (lateRoundPaceThresholdHitEnabled && stageSinceLateStart > 0 && isBehindPace && hasOpenRosterNeed)
            ? Math.min(lateRoundPaceThresholdMaxHit, stageSinceLateStart * lateRoundPaceThresholdPerRoundHit)
            : 0;

          const effectiveThreshold = Math.max(
            0.02,
            threshold
              - debtWidening
              - winRateWidening
              - pressureWidening
              - floorWidening
              - floorEndgameWidening
                - round6to10BaseWidening
              - lateRoundPaceWidening
          );
          const passesThreshold = entry.teamValue >= effectiveThreshold;

          collectThresholdDebugSample(entry?.player, entry?.teamValue);

          return passesThreshold;
        })
        .sort((a, b) => b.selectionWeight - a.selectionWeight);

      const priorityFillPositions = [...new Set([...(strategy.mustFillPositions || []), ...(strategy.proactiveFillPositions || [])])];

      // If there are fill-priority positions, bid on those first.
      let availablePlayers;
      if (Number(roundNumber) === draftRoundCount) {
        availablePlayers = [...valuedPlayers];
      } else if (!strategy.spreadFillMode && priorityFillPositions.length > 0) {
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

      if (inMidRounds && midRoundLikelyDraftedOnlyEnabled) {
        const mustKeep = new Set([...(strategy.mustFillPositions || []), ...(priorityFillPositions || [])]);
        const filtered = availablePlayers.filter((entry) => {
          const player = entry?.player;
          if (!player) return false;
          return passesMidRoundGuard(player, mustKeep.has(player.position));
        });
        if (filtered.length > 0) {
          availablePlayers = filtered;
        }
      }

      // In spread mode, avoid flooding bids onto low-probability players.
      // Use draftChance from rankings/POS files to keep drafted volume realistic.
      if (strategy.spreadFillMode && Number(roundNumber) < draftRoundCount) {
        const mustKeep = new Set([...(strategy.fillNeedPositions || []), ...(strategy.mustFillPositions || [])]);
        const filtered = availablePlayers.filter((entry) => {
          const player = entry?.player;
          if (!player) return false;
          if (mustKeep.has(player.position)) return true;
          return normalizeDraftChance(player) >= spreadDraftChanceFloor;
        });
        if (filtered.length >= 4) {
          availablePlayers = filtered;
        }
      }

      if (Number(roundNumber) === draftRoundCount) {
        availablePlayers = [...availablePlayers];
      }

      // Number of bids based on strategy and budget
      // AGGRESSIVE BID VOLUME: CPUs should bid on 5-10 players per round, with 3-5 being $1 bids
      let maxBids = 1;
      
      // Base calculation
      if (strategy.isRich) maxBids += 1;
      if (strategy.isDesperate) maxBids += 1;
      if (strategy.aggressiveness > 0.7) maxBids += 1;
      if (remainingBudget > 30) maxBids += 1;
      if (strategy.mustFillRoster) maxBids += Math.min(2, strategy.playersNeededForMinimum);

      // STRATEGY-SPECIFIC BID VOLUME ADJUSTMENTS
      // Different strategies have different bid volume targets
      switch(strategy.bidStrategyDirection) {
        case 'focus':
          // FOCUS: Critical needs should stay targeted, but not so narrow that teams miss roster completion.
          maxBids = Math.min(7, maxBids + 1);
          console.log(`[CPU-${team.name}] FOCUS MODE: Targeting up to 8 bids (critical position gaps with completion safety)`);
          break;
        case 'spread':
          // SPREAD: Starters filled = bid on MANY players (8-10 bids)
          maxBids = Math.max(6, maxBids + 2);
          console.log(`[CPU-${team.name}] SPREAD MODE: Targeting 8-10 bids (starters filled, filling bench depth)`);
          break;
        case 'opportunistic':
          // OPPORTUNISTIC: Budget-constrained = bid on BARGAINS only (5-6 bids, mostly $1-5)
          maxBids = Math.min(5, maxBids + 1);
          console.log(`[CPU-${team.name}] OPPORTUNISTIC MODE: Bidding on 5-6 bargain players (tight budget)`);
          break;
        case 'balance':
          // BALANCE: Roster imbalanced = bid on TARGETED positions (6-7 bids focused on weak spots)
          maxBids = Math.min(6, maxBids + 1);
          console.log(`[CPU-${team.name}] BALANCE MODE: Targeting 6-7 bids on underrepresented positions`);
          break;
        default:
          // BALANCED: Steady approach (6-7 bids)
          maxBids = Math.min(6, maxBids + 1);
      }

      // DRAFT COMPLETION AI: Behind-schedule teams enter MORE auctions, NOT bigger bids.
      // This is participation pressure, not bid escalation.
      // The bid amounts stay exactly the same — the CPU just considers more players "acceptable."
      // completionPressure 0-40 scale: low = comfortable, high = behind schedule
      if (strategy.completionPressure > 6) {
        maxBids += 1; // Slightly behind: broaden auction coverage a bit
      }
      if (strategy.completionPressure > 12) {
        maxBids += 1; // Noticeably behind: one extra auction entry
      }
      if (strategy.completionPressure > 20) {
        maxBids += 1; // Significantly behind: modest participation boost
        console.log(`[CPU-${team.name}] COMPLETION AI: pressure=${strategy.completionPressure.toFixed(0)} → maxBids boosted to ${maxBids} (widening net, NOT raising prices)`);
      }

      // Hard participation floor for teams behind roster pace.
      // This prevents low-roster/high-cash outcomes by forcing enough auction entries
      // while keeping bid sizing logic unchanged.
      if ((strategy.needRatio || 0) >= 0.85) {
        const floorFromNeed = Math.min(10, 6 + Math.ceil((strategy.needRatio - 0.85) * 7));
        maxBids = Math.max(maxBids, floorFromNeed);
      }
      if (roundNumber <= 6 && (strategy.earlyPaceGap || 0) > 0) {
        const paceFloor = Math.min(8, 5 + Math.min(3, Math.ceil(strategy.earlyPaceGap)));
        maxBids = Math.max(maxBids, paceFloor);
      }
      if ((strategy.requiredWinsPerRound || 0) > (strategy.baselineWinsPerRound || 1.4)) {
        const winRateGap = Math.max(0, (strategy.requiredWinsPerRound || 0) - (strategy.baselineWinsPerRound || 1.4));
        const winRateFloor = Math.min(9, 6 + Math.ceil(winRateGap * 3));
        maxBids = Math.max(maxBids, winRateFloor);
      }
      if ((strategy.needRatio || 0) >= 1.0) {
        const mustFillFloor = Math.min(
          8,
          Math.max(6, ((strategy.mustFillPositions || []).length || 0) + 4)
        );
        maxBids = Math.max(maxBids, mustFillFloor);
      }
      if ((strategy.roundsIncludingCurrent || draftRoundCount) <= 3 && (strategy.playersNeededForMinimum || 0) >= 2) {
        maxBids = Math.max(maxBids, 9);
      }
      if ((strategy.roundsIncludingCurrent || draftRoundCount) <= 2 && (strategy.playersNeededForMinimum || 0) > 0) {
        const endgameNeedFloor = Math.min(14, Math.max(10, ((strategy.playersNeededForMinimum || 0) * 3) + 4));
        maxBids = Math.max(maxBids, endgameNeedFloor);
      }
      if ((strategy.roundsIncludingCurrent || draftRoundCount) <= 2 && (strategy.playersNeededForFloor || 0) > 0) {
        const floorEndgameBidFloor = Math.min(15, Math.max(11, ((strategy.playersNeededForFloor || 0) * 4) + 4));
        maxBids = Math.max(maxBids, floorEndgameBidFloor);
      }
      if (strategy.rosterFloorMode) {
        const floorBidCount = (strategy.roundsIncludingCurrent || draftRoundCount) <= 3 ? 10 : 8;
        maxBids = Math.max(maxBids, floorBidCount);
      }
      if ((strategy.targetRosterSize || 0) >= 16) {
        if ((strategy.needRatio || 0) >= 1.0) {
          maxBids = Math.max(maxBids, 10);
        }
        if ((strategy.roundsIncludingCurrent || draftRoundCount) <= 4 && (strategy.playersNeededForMinimum || 0) >= 2) {
          maxBids = Math.max(maxBids, 10);
        }
      }
      if ((strategy.completionPressure || 0) >= 18) {
        maxBids = Math.max(maxBids, 8);
      }

      // If a team still has healthy budget after round 5, keep taking shots at quality upgrades.
      if (roundNumber >= 6) {
        const slotsLeft = Math.max(1, strategy.rosterSpotsLeft || getOpenSlots(team, maxRosterSize));
        const budgetPerSpot = remainingBudget / slotsLeft;
        if (budgetPerSpot >= 9) maxBids += 1;
        if (budgetPerSpot >= 14 && slotsLeft <= 5) maxBids += 1;
      }

      // In late rounds (7+), significantly increase bid opportunities
      if (roundNumber >= 7 && remainingBudget > 30) {
        maxBids += 2;
        if (remainingBudget > 80) maxBids += 2;
      }

      // ROSTER FILL MODE: Bid on 8-10 players to build 15-16 player roster
      if (strategy.spreadFillMode) {
        const minSpreadBids = Math.min(
          Math.max(4, Math.round(10 * spreadBidVolumeMultiplier)),
          Math.max(Math.max(4, Math.round(7 * spreadBidVolumeMultiplier)), strategy.rosterSpotsLeft),
          availablePlayers.length
        );
        maxBids = Math.max(maxBids, minSpreadBids);
      }

      if (strategy.spreadFillMode || strategy.bidStrategyDirection === 'spread') {
        maxBids = Math.max(2, Math.round(maxBids * spreadBidVolumeMultiplier));
      }

      maxBids = Math.max(2, Math.round(maxBids * globalBidVolumeMultiplier));

      if (Number(roundNumber) <= 3 && !strategy.mustFillRoster) {
        maxBids = Math.min(maxBids, earlyRoundMaxBidsCap);
      }

      // STAR PURSUIT MODE: Reduce to 5 main bids but add systematic $1s
      if (strategy.starAvailabilityPercentage > 0.4 && strategy.shouldOverrideLowballMode) {
        // Stars are available and we're pursuing them - but do not sacrifice completion.
        const completionRisk = (strategy.needRatio || 0) >= 0.9 || (strategy.playersNeededForMinimum || 0) > (strategy.roundsIncludingCurrent || draftRoundCount);
        if (!completionRisk) {
          const starFocusBids = 6;
          if (maxBids > starFocusBids) {
            maxBids = starFocusBids;
          }
        }
      }

      if (strategy.topTalentMode && !strategy.rosterFloorMode && Number(roundNumber) !== draftRoundCount) {
        maxBids = Math.max(3, Math.min(5, maxBids));
      }

      if (strategy.emergencyStarterFillMode) {
        const emergencyBidCount = Math.min(6, Math.max(4, strategy.mustFillPositions.length + 2));
        maxBids = Math.max(maxBids, emergencyBidCount);
      }

      if (Number(roundNumber) === draftRoundCount) {
        maxBids = availablePlayers.length;
      } else {
        maxBids = Math.min(maxBids, availablePlayers.length);
      }

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
        const cfg = loadCpuLogicConfig();
        let maxBid = Math.min(
          Math.max(Math.round(trueValue), isMustFillPosition ? 1 : 0),
          bidRemainingBudget
        );

        const hardPlayerBidCap = getHardPlayerBidCap(player, roundNumber, bidRemainingBudget, cfg?.silent || {}, {
          isTargetPlayer: isStarredTarget,
          isMustFillPosition
        });
        maxBid = Math.min(maxBid, hardPlayerBidCap);

        const lateRoundFillPush = Number(roundNumber) >= 7 && (strategy.fillNeedPositions || []).includes(player.position);
        if (lateRoundFillPush) {
          maxBid = Math.min(bidRemainingBudget, hardPlayerBidCap);
        }

        if (maxBid <= 0) {
          continue;
        }

        let baseBid = Math.round(trueValue * (0.78 + strategy.aggressiveness * 0.18));

        // NOTE: Bid amounts are intentionally NOT scaled by rosterPressure or completionPressure.
        // When a team is behind, they enter MORE auctions (via interestThreshold + maxBids),
        // but they bid at the SAME prices. This prevents late-draft price inflation.

        // ===== SPREAD MODE LOGIC =====
        // CPUs balance between: spreading cheaply across many players vs going after high-AV targets
        const legacyAvDrivenMaxRound = Math.max(1, Math.floor(Number(cfg?.silent?.legacyAvDrivenMaxRound ?? 4)));
        const legacyAvDrivenMode = (cfg?.silent?.legacyAvDrivenMode === true) && Number(roundNumber) <= legacyAvDrivenMaxRound;
        const spreadModeIntensity = legacyAvDrivenMode ? 0 : (cfg?.silent?.spreadModeIntensity || 0.6);
        const starTargetAggressionBoost = cfg?.silent?.starTargetAggressionBoost || 0.5;
        const starTargetLowballReduction = cfg?.silent?.starTargetLowballReduction || 0.3;
        const lowballIntensity = cfg?.silent?.lowballIntensity || 0.65;

        // Determine if CPU is in spread mode: multiple open spots and constrained budget
        const openSlots = getOpenSlots(team, maxRosterSize) || 1;
        const budgetRemaining = getBidBudgetForTeam(team, 0, maxRosterSize, reserveBypass) || team.budget;
        const budgetPerSpot = openSlots > 0 ? budgetRemaining / openSlots : budgetRemaining;
        
        // ROUND 8+ OVERRIDE: From round 8 onward, teams should spend their remaining budget aggressively.
        const isFinalRound = Number(roundNumber) >= 8;
        const lateRoundAggressionDampener = Math.max(0.5, Math.min(1, Number(cfg?.silent?.lateRoundAggressionDampener ?? 0.72)));
        const lateRoundAggression = isFinalRound
          ? Math.max(0.3, Number(strategy.aggressiveness || 0.9) * lateRoundAggressionDampener)
          : Number(strategy.aggressiveness || 0.9);
        let isInSpreadMode = !isFinalRound && spreadModeIntensity > 0 && (openSlots >= 4 || budgetPerSpot < 30);
        const starModeActive = !legacyAvDrivenMode && strategy.shouldOverrideLowballMode && isStarredTarget;
        
        // Round 10 strategy: Check if CPU can afford to win their star vs wealthiest opponent
        let canAffordStarInFinalRound = true;
        let isWealthiestTeam = team.name === wealthiestTeamName;
        
        if (isFinalRound && isStarredTarget && starModeActive) {
          if (isWealthiestTeam) {
            // THIS TEAM IS WEALTHIEST: Can bid efficiently (just over 2nd place) OR evaluate if better opportunities exist
            // Probabilistic decision: 70% of the time bid efficiently for star, 30% of time explore alternatives
            const shouldBidEfficientlyForStar = Math.random() < 0.70;
            
            if (shouldBidEfficientlyForStar) {
              // Bid just $1 over 2nd wealthiest team to guarantee win
              canAffordStarInFinalRound = true;
              console.log(`[CPU-${team.name}] ROUND 10 WEALTHIEST TEAM: ${player.name} ($${player.avgValue} AV) | Strategy: BID EFFICIENTLY (just over $${secondWealthiestBudget} to guarantee)`);
            } else {
              // Probabilistically decide to explore other options (40-50 AV players) instead
              console.log(`[CPU-${team.name}] ROUND 10 WEALTHIEST TEAM: ${player.name} ($${player.avgValue} AV) | Strategy: EXPLORE ALTERNATIVES (evaluate 40-50 AV tier vs this star)`);
              // Will evaluate other players more aggressively below
            }
          } else {
            // NOT WEALTHIEST: Check if we can afford against wealthiest opponent
            const wealthiestEstimatedBid = Math.round(player.avgValue * (1.05 + (0.10 * 0.7))); // 1.05-1.15x AV estimate
            canAffordStarInFinalRound = budgetRemaining > wealthiestEstimatedBid;
            
            if (!canAffordStarInFinalRound) {
              console.log(`[CPU-${team.name}] ROUND 10 STAR UNAFFORDABLE: ${player.name} ($${player.avgValue} AV, est $${wealthiestEstimatedBid}) | Our budget: $${budgetRemaining} | Wealthiest opponent (${wealthiestTeamName}): $${wealthiestOpponentBudget} | Pivoting to catch-bid + spread on $20-30 AV tier`);
            }
          }
        }
        
        // STAR AVAILABILITY MODE: If CPU's starred targets are available, also apply aggressive mode
        // (Spreading and aggressive modes can both be active!)
        
        
        // Calculate budget health to determine spending flexibility for starred players
        const budgetHealthy = budgetRemaining > 50; // Healthy buffer
        const budgetTight = budgetRemaining < 50;   // Very tight
        
        if (starModeActive && isInSpreadMode) {
          console.log(`[CPU-${team.name}] SPREADING + STAR MODE: Will spread on non-stars AND go aggressive on ${player.name} (${(strategy.starAvailabilityPercentage * 100).toFixed(0)}% of stars available, budget=$${budgetRemaining})`);
        }
        
        const isStarOrPriority = isStarredTarget || (strategy.starredTargetIds?.size > 0 && strategy.starredTargetIds?.has(getPlayerIdKey(player)));
        
        // ===== BUDGET-AWARE AV RANGE BIDDING =====
        // Different AV multiplier ranges for different scenarios:
        // - Spreading (non-star): LOW range (0.55-0.75x AV) to find deals
        // - Star mode with healthy budget: HIGH range (0.95-1.15x AV) to feel confident
        // - Star mode with tight budget: MID-HIGH range (0.85-1.05x AV) but allow exceeding max budget if needed
        // - ROUND 10: ALL OUT - bid high on all players to fill roster
        
        // SPREAD MODE: Apply lowballing to ALL players (not just expensive) when spreading
        if (isFinalRound) {
          const finalNeedPositions = new Set([
            ...(strategy.mustFillPositions || []),
            ...(strategy.proactiveFillPositions || []),
            ...(strategy.underrepresentedPositions || [])
          ]);
          const needsThisPlayer = finalNeedPositions.has(player.position);
          const isBenchNeed = !needsThisPlayer && (strategy.playersNeededForMinimum || 0) > 0;

          if (isWealthiestTeam && isStarOrPriority) {
            const efficientMultiplier = 0.96 + (0.04 * lateRoundAggression);
            baseBid = Math.max(Math.round(trueValue * efficientMultiplier), secondWealthiestBudget + 1);
            maxBid = budgetRemaining;
            console.log(`[CPU-${team.name}] ROUND 8+ ANCHOR: ${player.name} ($${player.avgValue} AV) bid=$${baseBid} (wealthiest team, anchoring on top target)`);
          } else if (needsThisPlayer) {
            const needMultiplier = 0.88 + (0.10 * lateRoundAggression);
            baseBid = Math.max(1, Math.round(trueValue * needMultiplier));
            maxBid = budgetRemaining;
            console.log(`[CPU-${team.name}] ROUND 8+ NEED BID: ${player.name} ($${player.avgValue} AV) bid=$${baseBid} (needs ${player.position}, budget=$${budgetRemaining})`);
          } else if (isBenchNeed || budgetPerSpot > 18 || strategy.completionPressure > 12) {
            const spreadMultiplier = 0.68 + (0.08 * lateRoundAggression);
            baseBid = Math.max(1, Math.round(trueValue * spreadMultiplier));
            maxBid = budgetRemaining;
            console.log(`[CPU-${team.name}] ROUND 8+ SPREAD: ${player.name} ($${player.avgValue} AV) bid=$${baseBid} (budget=$${budgetRemaining}, spots=${openSlots})`);
          } else {
            const catchMultiplier = 0.50 + (0.08 * lateRoundAggression);
            baseBid = Math.max(1, Math.round(trueValue * catchMultiplier));
            maxBid = budgetRemaining;
            console.log(`[CPU-${team.name}] ROUND 8+ CATCH: ${player.name} ($${player.avgValue} AV) bid=$${baseBid} (late bench filler or depth)`);
          }
        } else if (isInSpreadMode && !isStarOrPriority && lowballIntensity > 0) {
          // Bid in LOW range of AV to find deals (~55-75% of AV depending on lowballing intensity)
          const lowAVMultiplier = 0.55 + (0.2 * (1 - lowballIntensity)); // 0.55 to 0.75 as intensity goes 1.0 to 0
          const originalBid = baseBid;
          baseBid = Math.round(trueValue * lowAVMultiplier);
          
          if (lowballIntensity > 0.3) {
            console.log(`[CPU-${team.name}] Spread mode: lowballing ${player.name} ($${player.avgValue} AV, bid=$${baseBid}@${(lowAVMultiplier*100).toFixed(0)}%) (budget: $${budgetRemaining}, ${openSlots} spots)`);
          }
        }
        // STAR MODE: Bid more confidently with high AV range or allow budget override
        else if (isFinalRound && isStarOrPriority && isStarredTarget) {
          if (isWealthiestTeam && canAffordStarInFinalRound && Math.random() < 0.70) {
            // WEALTHIEST TEAM EFFICIENT BID: Evaluate if 2nd-wealthiest is competing for this star
            // If they seem disinterested (no bids on stars so far), just bid AV and move on
            // Otherwise, bid $1 over 2nd place to guarantee win
            
            const competitorInterestEstimate = Math.random(); // Simulate: is 2nd-wealthiest going for this?
            const secondPlaceCompeting = competitorInterestEstimate < 0.65; // 65% chance they're competing
            
            if (!secondPlaceCompeting) {
              // 2nd place doesn't seem interested: just bid AV and explore other spending
              const avBid = Math.round(player.avgValue * (0.98 + (0.05 * strategy.aggressiveness))); // ~1.0x AV
              baseBid = avBid;
              maxBid = budgetRemaining;
              console.log(`[CPU-${team.name}] ROUND 10 AV BID ON STAR: ${player.name} ($${player.avgValue} AV) bid=$${baseBid}@1.0x AV (2nd place not competing, bid normally then explore other spending)`);
            } else {
              // 2nd place is competing: bid efficiently ($1 over 2nd place)
              const efficientBid = secondWealthiestBudget + 1;
              baseBid = efficientBid;
              maxBid = budgetRemaining; // Can spend more if needed, but start efficient
              console.log(`[CPU-${team.name}] ROUND 10 EFFICIENT BID: ${player.name} ($${player.avgValue} AV) bid=$${baseBid} (just over 2nd place $${secondWealthiestBudget} since they're competing)`);
            }
          } else if (canAffordStarInFinalRound) {
            // ROUND 10 OVERRIDE: Go all-out on affordable stars in final round
            const finalRoundStarMultiplier = 0.88 + (0.14 * lateRoundAggression); // toned down: thresholds already raise participation
            baseBid = Math.round(trueValue * finalRoundStarMultiplier);
            maxBid = budgetRemaining; // Willing to spend all budget in round 10
            console.log(`[CPU-${team.name}] ROUND 10 STAR ALL-OUT: ${player.name} ($${player.avgValue} AV) bid=$${baseBid}@${(finalRoundStarMultiplier*100).toFixed(0)}% (willing to spend up to $${maxBid})`);
          } else {
            // ROUND 10 STAR UNAFFORDABLE: Make catch-bid, then spread on $20-30 AV tier
            const catchBidMultiplier = 0.38 + (0.10 * lateRoundAggression); // lower chase pressure on unaffordable stars
            baseBid = Math.round(trueValue * catchBidMultiplier);
            console.log(`[CPU-${team.name}] ROUND 10 STAR CATCH-BID: ${player.name} ($${player.avgValue} AV) bid=$${baseBid}@${(catchBidMultiplier*100).toFixed(0)}% (low chance, will spread on $20-30 AV tier)`);
            
            // Flag this for player evaluation so we don't over-commit to unaffordable stars
            // (Let normal spread logic take over for other players)
            if (baseBid > budgetRemaining * 0.15) {
              baseBid = Math.ceil(Math.random() * 3) + 1; // Just throw $1-4 catch-bid
            }
          }
        } else if (isStarOrPriority && starModeActive && isStarredTarget) {
          // Bid at HIGH end of AV range to feel confident winning starred targets
          // Reserve budget for remaining spots (can be spread across multiple bids), then bid rest on star
          
          // Calculate reserve: all remaining open slots get $1 minimum each
          // (e.g., 4 slots = $4 reserve that can be spread across various bids in the round)
          const minimumPerSlot = 1;
          const reserveForAllSpots = openSlots * minimumPerSlot;
          const availableForStar = Math.max(budgetRemaining * 0.5, budgetRemaining - reserveForAllSpots); // Don't go below 50% safety floor
          
          if (budgetTight) {
            // Very tight budget: willing to spend almost everything on this star
            const highAVMultiplier = 0.90 + (0.15 * strategy.aggressiveness); // 0.90 to 1.05 based on aggression
            baseBid = Math.round(trueValue * highAVMultiplier);
            maxBid = Math.round(availableForStar); // Spend available after reserving for all spots
            console.log(`[CPU-${team.name}] STAR MODE BUDGET TIGHT: ${player.name} ($${player.avgValue} AV) bid=$${baseBid}@${(highAVMultiplier*100).toFixed(0)}% | ${openSlots} spots need $${reserveForAllSpots} reserve, willing to spend $${maxBid} on star`);
          } else if (budgetHealthy) {
            // Healthy budget: still bid aggressively on star, keep safety margin beyond other spots
            const safetyMultiplier = 1.2; // Keep 20% extra safety buffer even with healthy budget
            const adjustedReserve = reserveForAllSpots * safetyMultiplier;
            const maxBidHealthy = Math.round(budgetRemaining - adjustedReserve);
            
            const highAVMultiplier = 0.95 + (0.15 * strategy.aggressiveness); // 0.95 to 1.10 based on aggression
            baseBid = Math.round(trueValue * highAVMultiplier);
            maxBid = Math.max(Math.round(budgetRemaining * 0.60), maxBidHealthy); // At least 60% of budget, or whatever after reserve
            console.log(`[CPU-${team.name}] STAR MODE HEALTHY BUDGET: ${player.name} ($${player.avgValue} AV) bid=$${baseBid}@${(highAVMultiplier*100).toFixed(0)}% | ${openSlots} spots (reserve $${adjustedReserve}), willing to spend $${maxBid} on star (budget=$${budgetRemaining})`);
          } else {
            // Medium budget: balanced approach, reserve for all spots then bid rest on star
            const midHighAVMultiplier = 0.80 + (0.20 * strategy.aggressiveness); // 0.80 to 1.00
            baseBid = Math.round(trueValue * midHighAVMultiplier);
            maxBid = Math.round(availableForStar); // Reserve minimum, bid the rest
            console.log(`[CPU-${team.name}] STAR MODE MEDIUM BUDGET: ${player.name} ($${player.avgValue} AV) bid=$${baseBid}@${(midHighAVMultiplier*100).toFixed(0)}% | ${openSlots} spots need $${reserveForAllSpots} reserve, willing to spend $${maxBid} on star`);
          }
        }
        
        // AFFORDABILITY CHECK: If bid is too expensive relative to remaining budget, consider alternatives
        // (But NOT for starred players when in star mode - they're willing to spend)
        if (baseBid > budgetRemaining * 0.25 && isInSpreadMode && !isStarOrPriority) {
          // Bid would consume >25% of remaining budget in spread mode - too risky for non-priority
          // Option 1: Skip this bid (handled later in evaluation)
          // Option 2: Throw a cheap filler bid instead
          if (cheapFillerBidFrequency > Math.random()) {
            // Throw a cheap $1-5 filler bid to maintain presence
            baseBid = Math.ceil(Math.random() * 4) + 1; // $1-5
            console.log(`[CPU-${team.name}] Budget too tight for ${player.name}, throwing $${baseBid} filler bid instead (remaining: $${budgetRemaining})`);
          }
        }
        
        // ROUND 10 PIVOT: If star unaffordable, focus on $20-30 AV tier instead
        if (isFinalRound && !canAffordStarInFinalRound && !isStarOrPriority) {
          const playerAV = player.avgValue || 0;
          const isInMidTier = playerAV >= 18 && playerAV <= 32; // Focus on $20-30 AV range
          
          if (isInMidTier) {
            // Bid more aggressively on mid-tier players as fallback strategy
            const midTierMultiplier = 0.82 + (0.18 * strategy.aggressiveness); // 0.82-1.00x AV
            baseBid = Math.round(trueValue * midTierMultiplier);
            console.log(`[CPU-${team.name}] ROUND 10 PIVOT: ${player.name} ($${playerAV} AV) bid=$${baseBid}@${(midTierMultiplier*100).toFixed(0)}% (spreading on mid-tier since star unaffordable)`);
          } else if (playerAV < 18) {
            // Skip very cheap players when we can spread on mid-tier
            continue;
          }
        }
        
        if (strategy.topTalentMode && Number(player?.avgValue || 0) >= 20) {
          // Slight quality premium, but avoid inflating prices broadly.
          baseBid = Math.round(baseBid * 1.08);
        }

        // Use position-specific bid ranges from your original table
        const bidRange = getBidRange(player.position, player.avgValue, true);
        // Use the full range — the Math.min(0.2) cap was collapsing all CPUs into a tiny window causing frequent integer ties
        let baseMultiplier;
        if (isStarredTarget && starModeActive) {
          // When going after starred targets: bid at high end of range for confidence
          const highRangeBias = 0.60 + Math.random() * 0.40; // 60-100% through range
          baseMultiplier = bidRange.min + ((bidRange.max - bidRange.min) * highRangeBias);
        } else if (isStarredTarget) {
          const lowRangeBias = Math.random() * 0.38;
          baseMultiplier = bidRange.min + ((bidRange.max - bidRange.min) * lowRangeBias);
        } else {
          baseMultiplier = bidRange.min + Math.random() * (bidRange.max - bidRange.min);
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
          const lateCheapBoost = 1 + (0.08 * lateRoundAggression);
          const lateCoreBoost = 0.95 + (0.05 * lateRoundAggression);
          situationalMultiplier *= player.avgValue <= 10 ? lateCheapBoost : lateCoreBoost;
        }

        if (isStarredTarget) {
          situationalMultiplier *= 1.08;
        } else if (holdForUnavailableStar) {
          situationalMultiplier *= 0.86;
        }

        baseBid = Math.round(baseBid * situationalMultiplier);

        // Add randomized jitter for unpredictability without collapsing to the same integer bids.
        let randomFactor;
        if (player.avgValue >= 50) {
          randomFactor = 0.78 + Math.random() * 0.34; // 0.78–1.12 for premium players
        } else if (player.avgValue >= 35) {
          randomFactor = 0.74 + Math.random() * 0.36; // 0.74–1.10
        } else if (player.avgValue >= 20) {
          randomFactor = 0.70 + Math.random() * 0.42; // 0.70–1.12
        } else if (player.avgValue <= 10) {
          randomFactor = 0.56 + Math.random() * 0.72; // 0.56–1.28 for low-AV players
        } else {
          randomFactor = 0.64 + Math.random() * 0.48; // 0.64–1.12 for mid-tier players
        }
        baseBid = Math.round(baseBid * randomFactor);

        if (player.avgValue <= 8) {
          baseBid = Math.round(baseBid * (0.8 + Math.random() * 0.2));
        }

        if (player.avgValue <= 10 && baseBid <= 8) {
          const cheapPlayerJitter = player.avgValue <= 3 ? 2 : 1;
          const cheapBoostRoll = Math.random();
          if (cheapBoostRoll < 0.7) {
            baseBid = Math.max(1, Math.min(maxBid, baseBid + cheapPlayerJitter));
          }
        }

        // Organic tie reduction: each team values the same player a touch differently.
        // This keeps behavior realistic while reducing identical integer bids.
        const teamBidDiversityMultiplier = getTeamBidDiversityMultiplier(team.name, player, roundNumber);
        baseBid = Math.round(baseBid * teamBidDiversityMultiplier);

        baseBid = pullBidTowardAV(player, baseBid, roundNumber);
        baseBid = clampBidToDynamicBand(player, baseBid, roundNumber, strategy, bidRemainingBudget);

        baseBid = applyLowCostBidShaping(player, baseBid, strategy, bidRemainingBudget);

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

        // In top-talent mode, prioritize quality targets but maintain price discipline.
        // Non-star bids should usually stay around AV (or slightly above for elite tiers).
        if (strategy.topTalentMode && !isStarredTarget) {
          const av = Number(player?.avgValue || 0);
          const nonStarValueCeiling = av >= 35
            ? Math.round(av * 1.08)
            : av >= 24
              ? Math.round(av * 1.05)
              : Math.round(av * 1.00);
          if (av > 0) {
            baseBid = Math.min(baseBid, Math.max(1, nonStarValueCeiling));
          }
        }

        baseBid = softenEliteBid(player, baseBid, strategy);

        if (strategy.mustFillRoster && player.avgValue <= 14) {
          const fillFloorBase = player.position === 'K' || player.position === 'DEF'
            ? 1
            : Math.max(1, Math.ceil(strategy.budgetPerRound * 0.14));
          const fillFloor = Math.min(bidRemainingBudget, fillFloorBase);
          baseBid = Math.max(baseBid, fillFloor);
        }

        if (strategy.rosterFloorMode && (strategy.fillNeedPositions || []).includes(player.position) && player.avgValue <= 18) {
          const roundsOpen = (strategy.roundsIncludingCurrent || draftRoundCount);
          const lateFloor = roundsOpen <= 2 ? 5 : (roundsOpen <= 3 ? 3 : 2);
          baseBid = Math.max(baseBid, Math.min(bidRemainingBudget, lateFloor));
        }

        if (
          (strategy.roundsIncludingCurrent || draftRoundCount) <= 2
          && (strategy.playersNeededForMinimum || 0) > 0
          && (strategy.fillNeedPositions || []).includes(player.position)
          && player.avgValue <= 24
        ) {
          const targetEndgameFloor = Math.min(
            bidRemainingBudget,
            Math.max(4, Math.ceil((player.avgValue || 1) * 0.35))
          );
          baseBid = Math.max(baseBid, targetEndgameFloor);
        }

        // Completion-safe cap: preserve enough budget to fill required slots.
        // This prevents teams from buying too many expensive stars and stalling at 7-12 players.
        if ((strategy.playersNeededForMinimum || 0) >= 2 && (strategy.roundsIncludingCurrent || draftRoundCount) <= 6) {
          const slotsNeed = Math.max(1, Number(strategy.playersNeededForMinimum || 1));
          const budgetPerNeededSlot = Math.max(2, Math.floor(bidRemainingBudget / slotsNeed));
          const conservativeCap = Math.max(4, Math.floor(budgetPerNeededSlot * 1.45));
          const mustFillCap = Math.max(conservativeCap, Math.floor(budgetPerNeededSlot * 1.7));

          if (isMustFillPosition) {
            baseBid = Math.min(baseBid, mustFillCap);
          } else if (!isStarredTarget) {
            baseBid = Math.min(baseBid, conservativeCap);
          }
        }

        // Sub-12 floor cap: when below the roster floor, protect enough budget to keep adding players.
        // This is stricter than completion-safe cap and is only active while the team is under 12.
        if (strategy.rosterFloorMode && (strategy.playersNeededForFloor || 0) > 0) {
          const roundsOpen = (strategy.roundsIncludingCurrent || draftRoundCount);
          const floorSlotsNeed = Math.max(1, Number(strategy.playersNeededForFloor || 1));
          const budgetPerFloorSlot = Math.max(2, Math.floor(bidRemainingBudget / floorSlotsNeed));
          let floorModeCapBase = Math.max(5, Math.floor(budgetPerFloorSlot * 1.15));
          if (roundsOpen <= 3) {
            floorModeCapBase = Math.max(floorModeCapBase, Math.floor(budgetPerFloorSlot * 1.45));
          }
          if (roundsOpen <= 2) {
            floorModeCapBase = Math.max(floorModeCapBase, Math.floor(budgetPerFloorSlot * 1.75));
          }
          const floorModeCap = isMustFillPosition
            ? Math.max(floorModeCapBase, Math.floor(budgetPerFloorSlot * (roundsOpen <= 3 ? 1.65 : 1.3)))
            : floorModeCapBase;
          baseBid = Math.min(baseBid, floorModeCap);
        }

        // Floor emergency push: in final two rounds, teams still below floor must bid competitively
        // on fill-need positions to avoid missing the dynamic floor by 1-2 players.
        if (
          strategy.rosterFloorMode
          && (strategy.playersNeededForFloor || 0) > 0
          && (strategy.roundsIncludingCurrent || draftRoundCount) <= 2
          && ((strategy.fillNeedPositions || []).includes(player.position) || isMustFillPosition)
        ) {
          const floorSlotsNeed = Math.max(1, Number(strategy.playersNeededForFloor || 1));
          const budgetPerFloorSlot = Math.max(3, Math.floor(bidRemainingBudget / floorSlotsNeed));
          const floorEmergencyBid = Math.max(4, Math.floor(budgetPerFloorSlot * 1.55));
          baseBid = Math.max(baseBid, Math.min(maxBid, floorEmergencyBid));
        }

        if (legacyAvDrivenMode) {
          // HushV2.9-style AV-driven bidding: AV is the primary anchor every round.
          // If AV is not affordable, lowball or skip and let cheaper players get bids.
          const av = Math.max(0, Number(player?.avgValue || trueValue || 0));
          if (inMidRounds && midRoundLikelyDraftedOnlyEnabled && av <= 2 && !isMustFillPosition && !(strategy.fillNeedPositions || []).includes(player.position)) {
            continue;
          }
          const legacyBidRange = getBidRange(player.position, av, true);
          const baseRangeMultiplier = legacyBidRange.min + Math.random() * (legacyBidRange.max - legacyBidRange.min);

          // Keep legacy randomness, but constrain around AV so AV remains the main signal.
          let randomFactor;
          if (av >= 45) {
            randomFactor = 0.92 + Math.random() * 0.16; // 0.92-1.08
          } else if (av >= 25) {
            randomFactor = 0.85 + Math.random() * 0.30; // 0.85-1.15
          } else if (av >= 8) {
            randomFactor = 0.8 + Math.random() * 0.4; // 0.8-1.2
          } else {
            randomFactor = 0.7 + Math.random() * 0.6; // 0.7-1.3 for low AV
          }

          const aggrFactor = Math.max(0.82, Math.min(1.1, Number(strategy.aggressiveness || 0.9)));
          let legacyBid = Math.round(av * baseRangeMultiplier * randomFactor * aggrFactor);

          // Affordability behavior from legacy feel:
          // - If AV is unaffordable: either lowball or move to cheaper players.
          if (av > bidRemainingBudget) {
            const canLowball = bidRemainingBudget >= Math.max(1, Math.round(av * 0.45));
            if (!canLowball) {
              continue;
            }
            const lowballMultiplier = 0.5 + Math.random() * 0.2; // 50-70% AV
            legacyBid = Math.round(av * lowballMultiplier);
          }

          // Mid-tier/high-AV players should not clear at deep discounts in mid rounds.
          // If a team cannot afford a competitive AV-based bid, skip and move cheaper.
          if (inMidRounds && av >= 20) {
            const minCompetitive = Math.max(1, Math.round(av * 0.82));
            if (bidRemainingBudget < minCompetitive) {
              continue;
            }
          }

          // AV-centered hard banding: avoid runaway over/under bids.
          let floorMultiplier = av >= 25 ? 0.82 : (av >= 8 ? 0.74 : 0.5);
          let ceilingMultiplier = av >= 25 ? 1.16 : (av >= 8 ? 1.28 : 1.5);
          if (inMidRounds && av >= 20) {
            floorMultiplier = Math.max(floorMultiplier, 0.88);
            ceilingMultiplier = Math.min(ceilingMultiplier, 1.14);
          }
          if (roundNumber >= 8) {
            floorMultiplier = Math.max(floorMultiplier, 0.85);
            ceilingMultiplier = Math.min(ceilingMultiplier, 1.15);
          }

          const avFloor = Math.max(1, Math.round(av * floorMultiplier));
          const avCeiling = Math.max(avFloor, Math.round(av * ceilingMultiplier));
          legacyBid = Math.max(avFloor, Math.min(legacyBid, avCeiling));

          if (inMidRounds && av <= 3 && !isMustFillPosition) {
            const lowAvCap = av <= 1 ? 1 : 2;
            legacyBid = Math.min(legacyBid, lowAvCap);
          }

          baseBid = legacyBid;
        }

        // Final budget and minimum checks
        baseBid = Math.min(baseBid, maxBid);
        baseBid = Math.max(baseBid, 1);

        // Completion emergency floor: when severely behind, avoid too many non-competitive $1 bids.
        // Keep this modest so behavior stays realistic and does not create late-round price spikes.
        if ((strategy.completionPressure || 0) >= 14 && (strategy.roundsIncludingCurrent || draftRoundCount) <= 4) {
          const emergencyFloor = player.avgValue >= 20 ? 3 : 2;
          baseBid = Math.max(baseBid, Math.min(emergencyFloor, maxBid));
        }

        if (!legacyAvDrivenMode) {
          // Apply AV centering to create bell curve distribution around AV
          const avCenteringStrength = cfg && cfg.silent && cfg.silent.avCenteringStrength 
            ? Number(cfg.silent.avCenteringStrength)
            : 0.6;
          const safeCenteringStrength = Math.max(0, Math.min(0.75, avCenteringStrength));
          
          // Generate an AV-centered bid option with controlled variance.
          const avCenteredBid = Math.round(player.avgValue * (0.92 + Math.random() * 0.16));
          
          // Blend current bid with AV-centered bid based on centering strength
          // 0 = pure current behavior, 0.6 = 60% AV-centered, 1.0 = 100% AV-centered
          baseBid = Math.round((baseBid * (1 - safeCenteringStrength)) + (avCenteredBid * safeCenteringStrength));
          baseBid = Math.max(baseBid, 1);
        }

        // Early rounds should anchor closer to AV for real-market opening behavior.
        if (Number(roundNumber) <= 2 && Number(player?.avgValue || 0) >= 18 && !strategy.spreadFillMode) {
          const av = Number(player?.avgValue || 0);
          const avCeiling = Math.min(maxBid, Math.max(1, Math.round(av * earlyRoundAvCeilingMultiplier)));
          if (!isStarredTarget && !isMustFillPosition) {
            baseBid = Math.min(baseBid, avCeiling);
          }
        }

        // ===== SPREAD BID CAP LOGIC =====
        // When CPU has low budget + multiple open roster spots, cap bid to spread money across players
        const spreadBidCap = cfg?.silent?.spreadBidCap || 0.5;
        
        if (!legacyAvDrivenMode && spreadBidCap > 0) {
          const openSpots = getOpenSlots(team, maxRosterSize) || 1;
          const budgetRemaining = getBidBudgetForTeam(team, 0, maxRosterSize, reserveBypass) || team.budget;
          
          // Activate spreading when: multiple open spots (4+) AND budget is tight (<$100)
          const shouldSpreadBid = openSpots >= 4 && budgetRemaining < 100;
          
          if (shouldSpreadBid) {
            // Cap bid per player to stretch budget across spots
            // At spreadBidCap=0.5: max 30% of budget per player (encourages spreading)
            // At spreadBidCap=1.0: max 15% of budget per player (aggressive spreading)
            const spreadPercentage = 0.45 - (spreadBidCap * 0.3); // 0.45 at 0.0, 0.15 at 1.0
            const spreadBidLimit = Math.max(5, Math.floor(budgetRemaining * spreadPercentage));
            baseBid = Math.min(baseBid, spreadBidLimit);
            
            if (baseBid < bidRange.max * 0.8) {
              console.log(`[CPU-${team.name}] Bid spread-capped on ${player.name}: $${baseBid} (spreading across ${openSpots} open spots with $${budgetRemaining} budget)`);
            }
          }
        }

        // Final AV guardrail: re-apply dynamic band after all situational modifiers.
        // This prevents late-stage floor/anchor/pivot logic from bypassing AV ranges.
        const finalClampBudget = Math.max(1, Math.min(maxBid, bidRemainingBudget));
        baseBid = clampBidToDynamicBand(player, baseBid, roundNumber, strategy, finalClampBudget);

        // AV convergence clamp: keep long-run average prices near AV while preserving
        // randomness inside a bounded window.
        const avForConvergence = Math.max(0, Number(player?.avgValue || 0));
        if (avForConvergence >= 20 && !isMustFillPosition && !strategy.spreadFillMode) {
          const avConvergenceWindow = Math.max(3, Number(cfg?.silent?.avConvergenceWindow ?? 5));
          const avConvergenceEliteWindow = Math.max(avConvergenceWindow, Number(cfg?.silent?.avConvergenceEliteWindow ?? 7));
          const convergenceWindow = avForConvergence >= 45 ? avConvergenceEliteWindow : avConvergenceWindow;
          const convergenceCeiling = Math.max(1, Math.min(finalClampBudget, Math.round(avForConvergence + convergenceWindow)));
          baseBid = Math.min(baseBid, convergenceCeiling);
        }

        // Endgame hard cap: thresholds should increase participation, not price inflation.
        // Keep rounds 8-10 close to AV, with slightly wider room on very low-AV players.
        if (Number(roundNumber) >= 8) {
          const av = Math.max(1, Number(player?.avgValue || 1));
          const endgameCapPct = av <= 3 ? 1.6 : av <= 12 ? 1.32 : 1.16;
          const endgameCap = Math.max(1, Math.min(finalClampBudget, Math.round(av * endgameCapPct)));
          baseBid = Math.min(baseBid, endgameCap);
        }

        // Team/player deterministic micro-jitter to reduce same-price collisions.
        const jitterRoll = getTeamPlayerNoise(team.name, player.id, roundNumber);
        if (jitterRoll < 0.12 && baseBid < maxBid) {
          baseBid += 1;
        } else if (jitterRoll > 0.88 && baseBid > 1) {
          baseBid -= 1;
        } else if (jitterRoll > 0.5 && jitterRoll < 0.62 && baseBid > 1) {
          baseBid -= 1;
        }

        // Absolute guardrail: no bid can exceed AV soft cap, except target players allowed +$2-$3.
        // Make the cap slightly less rigid so reasonable variations around AV are preserved.
        const slightlyRelaxedCap = Math.max(hardPlayerBidCap, Math.min(maxBid, hardPlayerBidCap + (player.avgValue >= 30 ? 2 : 1)));
        baseBid = Math.max(1, Math.min(baseBid, slightlyRelaxedCap, maxBid));

        // Strategic bid evaluation: Only bid if team believes it can win
        const bidDecision = evaluateBidStrategy(baseBid, player, team, strategy, cpuTeams, roundPlayers, teamStrategies, rosterLimits, maxRosterSize);

        if (bidDecision === true) {
          const finalBid = Math.max(1, Math.min(baseBid, hardPlayerBidCap, bidRemainingBudget));
          cpuBids[team.name].push({ player, cpuBid: finalBid });
          totalBudgetCommitted += finalBid;
          console.log(`[CPU-${team.name}] Bid on ${player.name} ($${finalBid}) - total committed: $${totalBudgetCommitted}`);
        } else if (bidDecision && bidDecision.shouldBid && bidDecision.isCatchBid) {
          // Catch bid: Use the low catch bid amount instead of calculated bid
          const catchBid = bidDecision.catchBidAmount;
          const finalCatchBid = Math.max(1, Math.min(catchBid, hardPlayerBidCap, bidRemainingBudget));
          if (finalCatchBid <= bidRemainingBudget) {
            cpuBids[team.name].push({ player, cpuBid: finalCatchBid });
            totalBudgetCommitted += finalCatchBid;
            console.log(`[CPU-${team.name}] Catch bid on ${player.name} ($${finalCatchBid}) - total committed: $${totalBudgetCommitted}`);
          } else {
            console.log(`[CPU-${team.name}] Skipping catch bid on ${player.name} ($${finalCatchBid}) - exceeds budget`);
          }
        } else {
          if (strategy.spreadFillMode && (strategy.fillNeedPositions || []).includes(player.position) && bidRemainingBudget > 1) {
            const dynamicCap = getSpreadSingleBidCap(team, player, strategy, bidRemainingBudget, maxRosterSize);
            const fallbackBid = Math.max(1, Math.min(dynamicCap, Math.ceil(dynamicCap * 0.65), hardPlayerBidCap, bidRemainingBudget));
            cpuBids[team.name].push({ player, cpuBid: fallbackBid });
            totalBudgetCommitted += fallbackBid;
            console.log(`[CPU-${team.name}] Spread-fill fallback bid on ${player.name} ($${fallbackBid}) - total committed: $${totalBudgetCommitted}`);
          } else {
            // Skip this bid - team doesn't believe it can win
            console.log(`[CPU-${team.name}] Skipping bid on ${player.name} ($${baseBid}) - poor win odds`);
          }
        }
      }

      console.log(`[CPU-${team.name}] Generated ${cpuBids[team.name].length} bids (strategy: ${(strategy.aggressiveness * 100).toFixed(0)}% aggressive, budget: $${team.budget}, committed: $${totalBudgetCommitted})`);

      // Completion top-up: ensure teams with starter gaps still place enough must-fill bids.
      if ((strategy.mustFillRoster || strategy.emergencyStarterFillMode) && (strategy.mustFillPositions || []).length > 0) {
        const minNeededBids = Math.min(5, Math.max(3, strategy.mustFillPositions.length + 1));
        if (cpuBids[team.name].length < minNeededBids) {
          const missingBidCount = minNeededBids - cpuBids[team.name].length;
          const alreadyBidIds = new Set((cpuBids[team.name] || []).map(entry => Number(entry?.player?.id)));
          const mustFillCandidates = (roundPlayers || [])
            .filter(player => {
              if (!player || player.owner) return false;
              if (alreadyBidIds.has(Number(player.id))) return false;
              if (!(strategy.mustFillPositions || []).includes(player.position)) return false;
              return isValidRosterAddition(team, player, rosterLimits, maxRosterSize);
            })
            .sort((a, b) => Number(b.avgValue || 0) - Number(a.avgValue || 0));

          for (let i = 0; i < Math.min(missingBidCount, mustFillCandidates.length); i += 1) {
            const candidate = mustFillCandidates[i];
            const budgetNow = getBidBudgetForTeam(team, totalBudgetCommitted, maxRosterSize, reserveBypass);
            if (budgetNow <= 0) break;
            const topUpBid = Math.max(1, Math.min(6, Math.ceil((candidate.avgValue || 1) * 0.45), budgetNow));
            cpuBids[team.name].push({ player: candidate, cpuBid: topUpBid });
            totalBudgetCommitted += topUpBid;
            console.log(`[CPU-${team.name}] COMPLETION TOP-UP: ${candidate.name} (${candidate.position}) $${topUpBid}`);
          }
        }
      }

      // LATE ROUND DRAFT BUFFER MODE: Rounds 8-10, boost bidding to reach 15-16 player goal
      // CPUs should be bidding on MORE players even if bits are smaller to maximize roster size
      if (strategy.draftBufferMode && cpuBids[team.name].length < 4) {
        const draftBufferBidLimit = 3; // Add 3-4 more bids in draft buffer mode
        const remainingBids = draftBufferBidLimit - cpuBids[team.name].length;
        
        if (remainingBids > 0) {
          console.log(`[CPU-${team.name}] DRAFT BUFFER MODE: Only ${cpuBids[team.name].length} bids so far, need ${strategy.playersNeededForBuffer} more players (current: ${team.roster?.length || 0}, target: ${strategy.draftBufferTarget}). Adding ${remainingBids} more bids at lower price points`);
          
          // Grab remaining unowned players by AV tier preference
          const unownedByTier = roundPlayers
            .filter(p => !p.owner && !cpuBids[team.name].some(b => b.player.id === p.id))
            .sort((a, b) => (b.avgValue || 0) - (a.avgValue || 0)); // High AV first
          
          for (let i = 0; i < Math.min(remainingBids, unownedByTier.length); i++) {
            const player = unownedByTier[i];
            const budgetRemaining = getBidBudgetForTeam(team, totalBudgetCommitted, maxRosterSize, reserveBypass);
            
            if (budgetRemaining < 2) break; // Not enough budget left
            
            // Bid conservatively on these: just enough to be competitive (~0.65-0.80x AV)
            const draftBufferMultiplier = 0.65 + (Math.random() * 0.15);
            const bufferBid = Math.max(1, Math.round((player.avgValue || 10) * draftBufferMultiplier));
            
            if (bufferBid <= budgetRemaining) {
              cpuBids[team.name].push({ player, cpuBid: bufferBid });
              totalBudgetCommitted += bufferBid;
              console.log(`[CPU-${team.name}] DRAFT BUFFER BID: ${player.name} ($${player.avgValue} AV) bid=$${bufferBid} (roster building to ${strategy.draftBufferTarget})`);
            }
          }
        }
      }

      // SYSTEMATIC $1 FILLER BIDS: Every team bids $1-$2 on extra players based on strategy
      // Volume bid target scales with bidding strategy
      let dollarBidTarget = Math.max(3, Math.min(5, Math.floor(cpuBids[team.name].length * 0.6))); // 3-5 by default
      if (strategy.topTalentMode && !strategy.rosterFloorMode) {
        dollarBidTarget = 0;
      }
      if (Number(roundNumber) <= 2 && !earlyRoundVolumeBidsEnabled) {
        dollarBidTarget = 0;
      }
      if (Number(roundNumber) < volumeBidsStartRound) {
        dollarBidTarget = 0;
      }

      if (Number(roundNumber) >= (draftRoundCount - 1) && (team.roster || []).length < (strategy.targetRosterSize || maxRosterSize)) {
        dollarBidTarget = Math.max(dollarBidTarget, 8);
      }
      
      // Adjust based on strategy direction
      if (strategy.bidStrategyDirection === 'focus') {
        dollarBidTarget = Math.floor(cpuBids[team.name].length * 0.4); // Only 40% $1 bids when focused
        console.log(`[CPU-${team.name}] FOCUS STRATEGY: ${dollarBidTarget} volume bids (quality over quantity)`);
      } else if (strategy.bidStrategyDirection === 'spread') {
        dollarBidTarget = Math.max(5, Math.floor(cpuBids[team.name].length * 0.65)); // 65% $1 bids when spreading
        console.log(`[CPU-${team.name}] SPREAD STRATEGY: ${dollarBidTarget} volume bids (maximize presence)`);
      } else if (strategy.bidStrategyDirection === 'opportunistic') {
        dollarBidTarget = Math.max(4, Math.min(6, cpuBids[team.name].length)); // Almost all $1-2 when budget-tight
        console.log(`[CPU-${team.name}] OPPORTUNISTIC STRATEGY: ${dollarBidTarget} volume bids (bargain hunting)`);
      }
      if (strategy.spreadFillMode || strategy.bidStrategyDirection === 'spread') {
        dollarBidTarget = Math.max(0, Math.round(dollarBidTarget * spreadDollarBidMultiplier));
      }
      dollarBidTarget = Math.max(0, Math.round(dollarBidTarget * globalBidVolumeMultiplier));
      
      const unownedForDollarBids = roundPlayers
        .filter(p => {
          if (!p || p.owner) return false;
          if (cpuBids[team.name].some(b => b.player.id === p.id)) return false;
          const mustKeepPos = (strategy.mustFillPositions || []).includes(p.position);
          const draftChanceFloor = getDynamicDraftChanceFloor(p, mustKeepPos);
          if (!mustKeepPos && normalizeDraftChance(p) < draftChanceFloor) return false;
          if (!passesMidRoundGuard(p, mustKeepPos)) return false;
          return true;
        })
        .sort((a, b) => (a.avgValue || 0) - (b.avgValue || 0)); // Cheapest first
      
      let dollarBidsAdded = 0;
      for (const player of unownedForDollarBids) {
        if (dollarBidsAdded >= dollarBidTarget) break; // Stop at target
        
        const budgetRemaining = getBidBudgetForTeam(team, totalBudgetCommitted, effectiveRosterCap, reserveBypass);
        if (budgetRemaining < 1) break; // No budget left
        
        const dollarBid = Math.random() < 0.7 ? 1 : 2; // 70% $1, 30% $2
        cpuBids[team.name].push({ player, cpuBid: dollarBid });
        totalBudgetCommitted += dollarBid;
        dollarBidsAdded += 1;
        console.log(`[CPU-${team.name}] $${dollarBid} VOLUME BID: ${player.name} (total bids: ${cpuBids[team.name].length})`);
      }

      // In spread mode, optionally add cheap $1-5 filler bids to stretch budget further
      if (strategy.spreadFillMode && cheapFillerBidFrequency > 0 && !inMidRounds) {
        const fillerBudget = getBidBudgetForTeam(team, totalBudgetCommitted, effectiveRosterCap, reserveBypass);
        const fillerCandidates = roundPlayers
          .filter(p => !p.owner && !cpuBids[team.name].some(b => b.player.id === p.id))
          .sort((a, b) => (a.avgValue || 0) - (b.avgValue || 0))
          .slice(0, 10); // Top 10 cheapest available
        
        let fillerBidsAdded = 0;
        for (const filler of fillerCandidates) {
          if (fillerBudget <= 5) break; // Not enough for a filler bid
          if (fillerBidsAdded >= spreadFillerBidMax) break;
          
          const shouldAddFiller = cheapFillerBidFrequency > Math.random();
          if (!shouldAddFiller) continue;
          
          const fillerBid = Math.ceil(Math.random() * 4) + 1; // $1-5
          if (fillerBid > fillerBudget) continue;
          
          cpuBids[team.name].push({ player: filler, cpuBid: fillerBid });
          totalBudgetCommitted += fillerBid;
          fillerBidsAdded++;
          console.log(`[CPU-${team.name}] Added filler bid on ${filler.name} ($${fillerBid}) to stretch budget`);
        }
        
        if (fillerBidsAdded > 0) {
          console.log(`[CPU-${team.name}] Added ${fillerBidsAdded} cheap filler bids (total committed: $${totalBudgetCommitted})`);
        }
      }

      // Enforce per-round position plan before dedupe (QB/TE/K/DEF constrained; RB/WR freer).
      cpuBids[team.name] = pruneTeamBidsByPositionPlan(cpuBids[team.name], team, strategy, rosterLimits, effectiveRosterCap);

      // Keep one bid per player per team (highest bid wins) before global tie shaping.
      cpuBids[team.name] = dedupeTeamBidsByHighest(cpuBids[team.name]);

      // If strict-position pruning reduced bid volume too far, refill from valid remaining players.
      // This keeps participation/completion healthy without forcing post-draft assignment.
      const isBehindWinRate = (strategy.requiredWinsPerRound || 0) > (strategy.baselineWinsPerRound || 1.4);
      let minBenchRefillBids = isBehindWinRate ? 7 : 5;
      if (strategy.topTalentMode && !strategy.rosterFloorMode) {
        minBenchRefillBids = 0;
      }
      if (inMidRounds) {
        minBenchRefillBids = Math.min(minBenchRefillBids, 2);
      }
      if ((strategy.completionPressure || 0) >= 12) minBenchRefillBids += 1;
      if ((strategy.roundsIncludingCurrent || draftRoundCount) <= 4 && (strategy.playersNeededForMinimum || 0) >= 2) minBenchRefillBids += 2;
      if ((strategy.roundsIncludingCurrent || draftRoundCount) <= 3 && (strategy.playersNeededForMinimum || 0) >= 1) minBenchRefillBids += 1;
      minBenchRefillBids = Math.min(10, minBenchRefillBids);
      if (inMidRounds) {
        minBenchRefillBids = Math.min(minBenchRefillBids, 3);
      }
      if ((cpuBids[team.name] || []).length < minBenchRefillBids) {
        if (Number(roundNumber) <= 2 && !earlyRoundRefillEnabled) {
          minBenchRefillBids = 0;
        }
      }
      if (minBenchRefillBids > 0 && (cpuBids[team.name] || []).length < minBenchRefillBids) {
        const existingIds = new Set((cpuBids[team.name] || []).map(entry => Number(entry?.player?.id)));
        const missingByPosition = getMissingStarterCounts(team, rosterLimits).missingByPosition || {};
        const refillCandidates = (roundPlayers || [])
          .filter(player => {
            if (!player || player.owner) return false;
            if (existingIds.has(Number(player.id))) return false;
            if (inMidRounds && midRoundLikelyDraftedOnlyEnabled) {
              const mustKeepPos = (strategy.mustFillPositions || []).includes(player.position);
              if (!passesMidRoundGuard(player, mustKeepPos)) return false;
            }
            const mustKeepPos = (strategy.mustFillPositions || []).includes(player.position);
            const draftChanceFloor = getDynamicDraftChanceFloor(player, mustKeepPos);
            if (!mustKeepPos && normalizeDraftChance(player) < draftChanceFloor) return false;
            return isValidRosterAddition(team, player, rosterLimits, effectiveRosterCap);
          })
          .sort((a, b) => {
            const aNeed = Number(missingByPosition[a.position] || 0) > 0 ? 1 : 0;
            const bNeed = Number(missingByPosition[b.position] || 0) > 0 ? 1 : 0;
            if (bNeed !== aNeed) return bNeed - aNeed;
            const aSpecialist = (a.position === 'K' || a.position === 'DEF') ? 1 : 0;
            const bSpecialist = (b.position === 'K' || b.position === 'DEF') ? 1 : 0;
            if (aSpecialist !== bSpecialist) return aSpecialist - bSpecialist;
            const aFill = (a.position === 'RB' || a.position === 'WR') ? 1 : 0;
            const bFill = (b.position === 'RB' || b.position === 'WR') ? 1 : 0;
            if (bFill !== aFill) return bFill - aFill;
            return Number(b.avgValue || 0) - Number(a.avgValue || 0);
          });

        const refillNeeded = minBenchRefillBids - (cpuBids[team.name] || []).length;
        for (let i = 0; i < Math.min(refillNeeded, refillCandidates.length); i += 1) {
          const candidate = refillCandidates[i];
          const budgetNow = getBidBudgetForTeam(team, totalBudgetCommitted, effectiveRosterCap, reserveBypass);
          if (budgetNow <= 0) break;
          const refillBidCap = ((strategy.roundsIncludingCurrent || draftRoundCount) <= 3 && (strategy.playersNeededForMinimum || 0) > 0)
            ? 8
            : (isBehindWinRate ? 7 : 5);
          const refillBid = Math.max(1, Math.min(refillBidCap, Math.ceil((candidate.avgValue || 1) * 0.42), budgetNow));
          cpuBids[team.name].push({ player: candidate, cpuBid: refillBid });
          totalBudgetCommitted += refillBid;
          existingIds.add(Number(candidate.id));
          console.log(`[CPU-${team.name}] REFILL BID: ${candidate.name} (${candidate.position}) $${refillBid}`);
        }

        // Re-dedupe after refill inserts.
        cpuBids[team.name] = dedupeTeamBidsByHighest(cpuBids[team.name]);
      }

      // Late-round catch-up floor: if still short on roster spots, force broad legal participation.
      // This keeps completion draft-earned (no end-fill) by entering enough auctions in time.
      const urgentCatchUpMode = (
        ((strategy.roundsIncludingCurrent || draftRoundCount) <= 3 && (strategy.playersNeededForMinimum || 0) > 0)
        || (strategy.rosterFloorMode && (strategy.roundsIncludingCurrent || draftRoundCount) <= 5 && (strategy.playersNeededForFloor || 0) > 0)
      );
      const allowMidRoundCatchUp = !inMidRounds || (strategy.playersNeededForMinimum || 0) >= (strategy.roundsIncludingCurrent || draftRoundCount);
      if (urgentCatchUpMode && allowMidRoundCatchUp) {
        if (Number(roundNumber) <= 2 && !earlyRoundCoverageEnabled) {
          // Keep opening rounds selective; catch-up expansion is a later-round tool.
        } else {
        const highTargetLobby = (strategy.targetRosterSize || 0) >= 16;
        const floorEndgameEmergency = (strategy.roundsIncludingCurrent || draftRoundCount) <= 2 && (strategy.playersNeededForFloor || 0) > 0;
        const desiredCatchUpBids = Math.min(
          floorEndgameEmergency ? 18 : (highTargetLobby ? 16 : (strategy.rosterFloorMode ? 13 : 12)),
          Math.max(
            (cpuBids[team.name] || []).length,
            ((strategy.rosterFloorMode ? (strategy.playersNeededForFloor || 0) : (strategy.playersNeededForMinimum || 0)) * (floorEndgameEmergency ? 5 : (highTargetLobby ? 4 : 3))) + 2
          )
        );
        if ((cpuBids[team.name] || []).length < desiredCatchUpBids) {
          const existingIds = new Set((cpuBids[team.name] || []).map(entry => Number(entry?.player?.id)));
          const missingByPosition = getMissingStarterCounts(team, rosterLimits).missingByPosition || {};
          const catchUpCandidates = (roundPlayers || [])
            .filter(player => {
              if (!player || player.owner) return false;
              if (existingIds.has(Number(player.id))) return false;
              if (inMidRounds && midRoundLikelyDraftedOnlyEnabled) {
                const mustKeepPos = (strategy.mustFillPositions || []).includes(player.position);
                if (!passesMidRoundGuard(player, mustKeepPos)) return false;
              }
              const mustKeepPos = (strategy.mustFillPositions || []).includes(player.position);
              const draftChanceFloor = getDynamicDraftChanceFloor(player, mustKeepPos);
              if (!mustKeepPos && normalizeDraftChance(player) < draftChanceFloor) return false;
              return isValidRosterAddition(team, player, rosterLimits, effectiveRosterCap);
            })
            .sort((a, b) => {
              const aNeed = Number(missingByPosition[a.position] || 0) > 0 ? 1 : 0;
              const bNeed = Number(missingByPosition[b.position] || 0) > 0 ? 1 : 0;
              if (bNeed !== aNeed) return bNeed - aNeed;
              const aSpecialist = (a.position === 'K' || a.position === 'DEF') ? 1 : 0;
              const bSpecialist = (b.position === 'K' || b.position === 'DEF') ? 1 : 0;
              if (aSpecialist !== bSpecialist) return aSpecialist - bSpecialist;
              return Number(b.avgValue || 0) - Number(a.avgValue || 0);
            });

          const catchUpNeeded = desiredCatchUpBids - (cpuBids[team.name] || []).length;
          for (let i = 0; i < Math.min(catchUpNeeded, catchUpCandidates.length); i += 1) {
            const candidate = catchUpCandidates[i];
            const budgetNow = getBidBudgetForTeam(team, totalBudgetCommitted, effectiveRosterCap, reserveBypass);
            if (budgetNow <= 0) break;
            const floorEmergency = strategy.rosterFloorMode && (strategy.playersNeededForFloor || 0) >= 2;
            const bidCap = floorEmergency
              ? ((strategy.roundsIncludingCurrent || draftRoundCount) <= 2 ? 14 : 12)
              : ((strategy.playersNeededForMinimum || 0) >= (strategy.roundsIncludingCurrent || draftRoundCount)
                ? (highTargetLobby ? 12 : 9)
                : (highTargetLobby ? 9 : 7));
            const catchUpMultiplier = floorEmergency ? 0.58 : (highTargetLobby ? 0.54 : 0.45);
            const catchUpMinBid = floorEmergency
              ? ((strategy.roundsIncludingCurrent || draftRoundCount) <= 2 ? 4 : 3)
              : (highTargetLobby && (strategy.roundsIncludingCurrent || draftRoundCount) <= 3 ? 2 : 1);
            const catchUpBid = Math.max(catchUpMinBid, Math.min(bidCap, Math.ceil((candidate.avgValue || 1) * catchUpMultiplier), budgetNow));
            cpuBids[team.name].push({ player: candidate, cpuBid: catchUpBid });
            totalBudgetCommitted += catchUpBid;
            existingIds.add(Number(candidate.id));
          }
          cpuBids[team.name] = dedupeTeamBidsByHighest(cpuBids[team.name]);
        }
        }
      }

      // Coverage floor: under-target teams should enter enough auctions each round
      // to avoid no-bid dead zones and naturally finish rosters.
      if ((team.roster || []).length < (strategy.targetRosterSize || maxRosterSize)) {
        if (Number(roundNumber) <= 2 && !earlyRoundCoverageEnabled) {
          // Keep opening rounds selective; coverage floor starts after round 2.
        } else {
        const highTargetLobby = (strategy.targetRosterSize || 0) >= 16;
        let desiredCoverageBids = (strategy.roundNumber || roundNumber) >= 7 ? 11 : 9;
        if (inMidRounds) {
          desiredCoverageBids = Math.min(desiredCoverageBids, 6);
        }
        if ((strategy.needRatio || 0) >= 0.8) desiredCoverageBids += 1;
        if ((strategy.roundsIncludingCurrent || draftRoundCount) <= 3 && (strategy.playersNeededForMinimum || 0) > 0) {
          desiredCoverageBids += 2;
        }
        if (strategy.rosterFloorMode) desiredCoverageBids += 1;
        desiredCoverageBids = Math.min(highTargetLobby ? 16 : (strategy.rosterFloorMode ? 13 : 12), desiredCoverageBids);

        if ((cpuBids[team.name] || []).length < desiredCoverageBids) {
          const existingIds = new Set((cpuBids[team.name] || []).map(entry => Number(entry?.player?.id)));
          const coverageMissingByPosition = getMissingStarterCounts(team, rosterLimits).missingByPosition || {};
          const coverageCandidates = (roundPlayers || [])
            .filter(player => {
              if (!player || player.owner) return false;
              if (existingIds.has(Number(player.id))) return false;
              if (inMidRounds && midRoundLikelyDraftedOnlyEnabled) {
                const mustKeepPos = (strategy.mustFillPositions || []).includes(player.position);
                if (!passesMidRoundGuard(player, mustKeepPos)) return false;
              }
              const mustKeepPos = (strategy.mustFillPositions || []).includes(player.position);
              const draftChanceFloor = getDynamicDraftChanceFloor(player, mustKeepPos);
              if (!mustKeepPos && normalizeDraftChance(player) < draftChanceFloor) return false;
              return isValidRosterAddition(team, player, rosterLimits, maxRosterSize);
            })
            .sort((a, b) => {
              const aNeed = Number(coverageMissingByPosition[a.position] || 0) > 0 ? 1 : 0;
              const bNeed = Number(coverageMissingByPosition[b.position] || 0) > 0 ? 1 : 0;
              if (bNeed !== aNeed) return bNeed - aNeed;
              const aSpecialist = (a.position === 'K' || a.position === 'DEF') ? 1 : 0;
              const bSpecialist = (b.position === 'K' || b.position === 'DEF') ? 1 : 0;
              if (aSpecialist !== bSpecialist) return aSpecialist - bSpecialist;
              const aNoise = getTeamPlayerNoise(team.name, a.id, strategy.roundNumber || roundNumber);
              const bNoise = getTeamPlayerNoise(team.name, b.id, strategy.roundNumber || roundNumber);
              if (bNoise !== aNoise) return bNoise - aNoise;
              return Number(a.avgValue || 0) - Number(b.avgValue || 0);
            });

          const coverageNeeded = desiredCoverageBids - (cpuBids[team.name] || []).length;
          for (let i = 0; i < Math.min(coverageNeeded, coverageCandidates.length); i += 1) {
            const candidate = coverageCandidates[i];
            const budgetNow = getBidBudgetForTeam(team, totalBudgetCommitted, maxRosterSize, reserveBypass);
            if (budgetNow <= 0) break;
            const roundsOpen = (strategy.roundsIncludingCurrent || draftRoundCount);
            const coverageBid = strategy.rosterFloorMode
              ? (roundsOpen <= 2 ? Math.max(3, Math.min(6, budgetNow)) : Math.max(2, Math.min(4, budgetNow)))
              : (highTargetLobby && roundsOpen <= 3
                ? Math.max(2, Math.min(5, budgetNow))
                : Math.max(1, Math.min(2, budgetNow)));
            cpuBids[team.name].push({ player: candidate, cpuBid: coverageBid });
            totalBudgetCommitted += coverageBid;
            existingIds.add(Number(candidate.id));
          }

          cpuBids[team.name] = dedupeTeamBidsByHighest(cpuBids[team.name]);
        }
        }
      }

      // Safety net: if advanced logic yielded no bids, place one low fallback bid.
      if (!cpuBids[team.name] || cpuBids[team.name].length === 0) {
        const fallbackCandidates = (roundPlayers || []).filter(player => {
          if (!player || player.owner) return false;
            if (!isValidRosterAddition(team, player, rosterLimits, effectiveRosterCap)) return false;
            const budgetNow = getBidBudgetForTeam(team, 0, effectiveRosterCap, reserveBypass);
          return budgetNow > 0;
        });

        const prioritizedFallback = fallbackCandidates.sort((a, b) => {
          const aNeed = (strategy.fillNeedPositions || []).includes(a.position) ? 1 : 0;
          const bNeed = (strategy.fillNeedPositions || []).includes(b.position) ? 1 : 0;
          if (bNeed !== aNeed) return bNeed - aNeed;
          const aBench = (a.position === 'RB' || a.position === 'WR') ? 1 : 0;
          const bBench = (b.position === 'RB' || b.position === 'WR') ? 1 : 0;
          if (bBench !== aBench) return bBench - aBench;
          return Number(b.avgValue || 0) - Number(a.avgValue || 0);
        });

        const pick = prioritizedFallback[0] || null;
        if (pick) {
          const budgetNow = getBidBudgetForTeam(team, 0, effectiveRosterCap, reserveBypass);
          const fallbackBid = Math.max(1, Math.min(Math.round((pick.avgValue || 1) * 0.55), 6, budgetNow));
          cpuBids[team.name] = [{ player: pick, cpuBid: fallbackBid }];
          console.log(`[CPU-${team.name}] Fallback bid applied on ${pick.name} ($${fallbackBid})`);
        }
      }

      if (thresholdDebug && thresholdDebugCollector) {
        (cpuBids[team.name] || []).forEach((bidEntry) => {
          collectThresholdDebugSample(bidEntry?.player);
        });
      }
    }

    const coverageAdds = enforceRoundAuctionCoverage(
      cpuBids,
      cpuTeams,
      roundPlayers,
      teamStrategies,
      rosterLimits,
      maxRosterSize,
      roundNumber
    );
    if (coverageAdds > 0) {
      console.log(`[generateCPUBids] Coverage pass added ${coverageAdds} bids to reduce no-bid auctions`);
    }

    const earlyRoundCoverageRemovals = applyEarlyRoundBidCoverageCap(cpuBids, roundPlayers, roundNumber);
    if (earlyRoundCoverageRemovals > 0) {
      console.log(`[generateCPUBids] Early-round bid coverage cap removed ${earlyRoundCoverageRemovals} low-priority bids`);
    }

    const avDepthAdds = enforceAvMarketDepth(
      cpuBids,
      cpuTeams,
      roundPlayers,
      teamStrategies,
      rosterLimits,
      maxRosterSize,
      roundNumber
    );
    if (avDepthAdds > 0) {
      console.log(`[generateCPUBids] AV market-depth pass added ${avDepthAdds} competitive bids`);
    }

    const avParticipationRemovals = applyAvParticipationCurve(
      cpuBids,
      roundPlayers,
      roundNumber
    );
    if (avParticipationRemovals > 0) {
      console.log(`[generateCPUBids] AV participation curve removed ${avParticipationRemovals} excess bids`);
    }

    // Enforce realistic tie rates after CPU bids are generated.
    // In rounds 8-10, use budget-aware tie resolution; earlier rounds use natural tie rates
    enforceCpuTieRates(cpuBids, cpuTeams, roundPlayers, roundNumber, rosterLimits, maxRosterSize);

    const finalRoundRebalanceCount = rebalanceFinalRoundCpuBids(
      cpuBids,
      cpuTeams,
      roundPlayers,
      rosterLimits,
      maxRosterSize,
      roundNumber,
      teamStrategies,
      commitmentMode
    );
    if (finalRoundRebalanceCount > 0) {
      console.log(`[generateCPUBids] Commitment-curve rebalance applied to ${finalRoundRebalanceCount} teams (mode ${commitmentMode})`);
    }

    const finalCurveRemovals = applyAvParticipationCurve(
      cpuBids,
      roundPlayers,
      roundNumber
    );
    if (finalCurveRemovals > 0) {
      console.log(`[generateCPUBids] Final AV participation pass removed ${finalCurveRemovals} excess bids after rebalance`);
    }

    console.log(`[generateCPUBids] Completed - generated bids for ${Object.keys(cpuBids).length} CPU teams`);
    return cpuBids;
  } catch (error) {
    console.error('[generateCPUBids] CRITICAL ERROR generating CPU bids:', error);
    console.error(error.stack);
    return {};
  }
}

// Calculate market premium/discount based on position supply and demand
function calculateMarketMultiplier(position, remainingPlayers, cpuTeams, roundNumber) {
  const cfg = loadCpuLogicConfig();
  const marketSensitivity = cfg?.silent?.marketSensitivity || 0.7;
  
  if (marketSensitivity === 0) return 1.0; // Disabled
  
  // Count quality players left at this position
  const qualityPlayers = remainingPlayers.filter(p => !p.owner && p.position === position && p.avgValue >= 15).length;
  
  // Count CPU teams that still need this position
  const teamsNeedingPosition = cpuTeams.filter(team => {
    const count = team.roster.filter(p => p.position === position).length;
    const needed = getPositionMinimum(position, {});
    return count < needed;
  }).length;
  
  // Scarcity ratio: fewer players/more teams = higher multiplier (more expensive)
  const supplyDemandRatio = teamsNeedingPosition > 0 ? qualityPlayers / Math.max(1, teamsNeedingPosition) : 1.0;
  
  // In late rounds, scarcity matters more
  const latRoundFactor = roundNumber >= 7 ? 1.3 : 1.0;
  
  // Scarcity multiplier: 0.75-1.25 range
  // High scarcity (low ratio) = 1.25x (more expensive)
  // Good supply (high ratio) = 0.75x (cheaper)
  let scarcityMultiplier;
  if (supplyDemandRatio < 0.5) {
    scarcityMultiplier = 1.2; // Scarce - expensive
  } else if (supplyDemandRatio < 0.8) {
    scarcityMultiplier = 1.1; // Moderate scarcity
  } else if (supplyDemandRatio < 1.5) {
    scarcityMultiplier = 1.0; // Normal supply
  } else if (supplyDemandRatio < 2.5) {
    scarcityMultiplier = 0.88; // Good supply - discount
  } else {
    scarcityMultiplier = 0.75; // Abundant supply - significant discount
  }
  
  // Apply late-round factor
  scarcityMultiplier = 1 + ((scarcityMultiplier - 1) * latRoundFactor);
  
  // Blend with base AV: marketSensitivity controls how much market affects perception
  return 1 + ((scarcityMultiplier - 1) * marketSensitivity);
}

// Calculate team's budget efficiency for a position
function calculateBudgetEfficiencyForPosition(team, position, strategy) {
  const rosterSpotsNeeded = getPositionMinimum(position, {}) - team.roster.filter(p => p.position === position).length;
  if (rosterSpotsNeeded <= 0) return 1.0; // Already have enough
  
  const budgetAvailable = strategy?.budgetPerRound || team.budget / 10;
  const budgetPerSpot = budgetAvailable / Math.max(1, rosterSpotsNeeded);
  
  // If budget per spot is tight, this position becomes "expensive" relative to budget
  if (budgetPerSpot < 8) return 1.15; // Tight budget - feels expensive
  if (budgetPerSpot < 15) return 1.05; // Moderate budget
  if (budgetPerSpot < 25) return 0.95; // Comfortable budget
  return 0.85; // Plenty of budget - position feels cheap
}

// Get perceivable AV considering market dynamics and budget constraints
function getPerceivableAV(player, team, cpuTeams, remainingPlayers, strategy, roundNumber) {
  const marketMultiplier = calculateMarketMultiplier(player.position, remainingPlayers, cpuTeams, roundNumber);
  const budgetEfficiency = calculateBudgetEfficiencyForPosition(team, player.position, strategy);
  
  // Market makes player more/less attractive, budget makes it more/less affordable
  // Perceivable AV = How much does this player feel worth to this specific team right now?
  const perceivableAV = player.avgValue * marketMultiplier * budgetEfficiency;
  
  return Math.round(perceivableAV);
}

// Helper function: Evaluate if a CPU should place a bid based on strategy
function evaluateBidStrategy(bidAmount, player, team, strategy, allCpuTeams, remainingPlayers, teamStrategies, rosterLimits, maxRosterSize) {
  // Calculate market-aware perceivable AV early
  const roundNumber = strategy?.roundNumber || 1;
  const perceivableAV = getPerceivableAV(player, team, allCpuTeams, remainingPlayers, strategy, roundNumber);
  const isBargain = perceivableAV < player.avgValue * 0.95; // Player feels cheaper than AV suggests
  
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
    const isCheap = player.avgValue <= 12; // Filler/cheap player (backup QB, kicker, TE depth, etc.)
    
    // Intelligent pace-based catch bidding (controlled by paceCatchBidIntensity knob)
    const cfg = loadCpuLogicConfig();
    const paceCatchBidIntensity = cfg?.silent?.paceCatchBidIntensity || 0.6;
    
    if (paceCatchBidIntensity === 0) return null; // Disabled
    
    // If significantly behind pace, be more willing to throw $1-5 bids on cheap filler
    // to catch up quickly while preserving budget for quality talent
    const paceVariance = strategy?.paceVariance || 0;
    const isBehindPace = strategy?.isBehindPace || false;
    const playersNeededForPace = strategy?.playersNeededForPace || 0;
    
    // Pace urgency: how many players behind pace are we?
    // -1 to -2: moderately behind (1-2 players)
    // -2 or less: significantly behind (2+ players)
    const paceBehindAmount = Math.abs(Math.min(0, paceVariance)); // Convert -2 to 2, -0.5 to 0.5
    
    // Scale thresholds based on intensity knob
    // At 0.5 intensity: require 3+ behind to be "significant" (vs 2+ at 1.0)
    // At 1.0 intensity: require 2+ behind to be "significant"
    const significanceThreshold = 2 + (1 - paceCatchBidIntensity); // 2.0 at intensity 1.0, 3.0 at intensity 0.0
    const moderateThreshold = 1 + (1 - paceCatchBidIntensity) * 0.5; // 1.0 at intensity 1.0, 1.5 at intensity 0.0
    
    const isSignificantlyBehindPace = paceBehindAmount >= significanceThreshold;
    const isModeratelyBehindPace = paceBehindAmount >= moderateThreshold && paceBehindAmount < significanceThreshold;

    let catchBid;
    const roll = Math.random();

    // PACE-AWARE CATCH BID LOGIC (intensity-scaled)
    if (isBehindPace && isCheap) {
      // Team is behind pace and this is a filler player: THROW OUT AGGRESSIVE $1-5 BID
      // This allows teams to catch up to expected roster size with cheap depth first
      if (isSignificantlyBehindPace) {
        // Significantly behind: go for $1 frequently, then 2-4/5 range
        // Intensity scales probabilities: at 0.5 intensity, cut probabilities in half
        const p1Dollar = 0.35 * paceCatchBidIntensity;
        const p2to4 = (0.50 * paceCatchBidIntensity) + (0.5 * (1 - paceCatchBidIntensity)); // Blend toward 2-4
        
        if (roll < p1Dollar) {
          catchBid = 1;
        } else if (roll < p1Dollar + p2to4) {
          catchBid = 2 + Math.floor(Math.random() * 3); // 2-4 range
        } else {
          catchBid = Math.round(5 * paceCatchBidIntensity) || 3; // Scale max from 5 down based on intensity
        }
      } else if (isModeratelyBehindPace) {
        // Moderately behind: still aggressive but less desperate
        const p1Dollar = 0.20 * paceCatchBidIntensity;
        const p2to4 = (0.60 * paceCatchBidIntensity) + (0.2 * (1 - paceCatchBidIntensity));
        
        if (roll < p1Dollar) {
          catchBid = 1;
        } else if (roll < p1Dollar + p2to4) {
          catchBid = 2 + Math.floor(Math.random() * 3); // 2-4 range
        } else {
          catchBid = Math.round(5 * paceCatchBidIntensity) || 3;
        }
      }
    } else {
      // Standard catch bid logic for non-filler or if on pace
      // Sweet spot is 2-6 to reduce tie frequency vs $1.
      if (roll < 0.04) {
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
    }

    const spendCap = isElite ? 0.48 : isPremium ? 0.42 : isCheap ? 0.25 : 0.35;
    const maxCatchByPlan = Math.max(1, Math.floor(spendableNow * spendCap));
    // Scale max cap based on pace intensity for cheap players
    const maxCheapCap = isCheap && isBehindPace ? Math.round(5 * paceCatchBidIntensity) : 10;
    catchBid = Math.min(catchBid, maxCatchByPlan, spendableNow, maxCheapCap);

    // If this is a bargain, be slightly more aggressive on catch bid size
    // But if behind pace with cheap player, don't over-bid (want to conserve for multiple catches)
    if (isBargain && catchBid < 6 && !(isBehindPace && isCheap)) {
      catchBid = Math.min(6, catchBid + Math.ceil(Math.random() * 2));
    }

    if (catchBid < 1) return null;
    return { shouldBid: true, isCatchBid: true, catchBidAmount: catchBid };
  }

  const missingAtPosition = getMissingStarterCounts(team, rosterLimits).missingByPosition[player.position] || 0;
  const upgradeGap = getUpgradeGap(team, player, rosterLimits);
  const openSlots = Math.max(1, getOpenSlots(team, maxRosterSize));
  const effectiveBudgetNow = getEffectiveBudget(team, 0, maxRosterSize);

  // PASS-FIRST gate: when passScore < 0, the CPU should almost always participate.
  // This ramps up participation for behind teams without inflating prices.
  const passScore = calculatePassScore(strategy, team, bidAmount, maxRosterSize);
  const mustBidByPassGate = passScore < 0;

  if (mustBidByPassGate) {
    // Guardrail: for expensive non-critical targets, prefer a controlled catch bid
    // over all-in spending when the team simply needs participation volume.
    const isExpensive = (player?.avgValue || 0) >= 35;
    const isCriticalNeed = missingAtPosition > 0 || (strategy?.mustFillPositions || []).includes(player.position);
    const budgetRisky = Number(bidAmount || 0) > (effectiveBudgetNow * 0.42);

    if (isExpensive && !isCriticalNeed && budgetRisky) {
      return buildCatchBidDecision() || true;
    }

    return true;
  }

  // Completion debt override: if a team is behind schedule, bias toward participation.
  // This only changes "enter auction?" behavior and preserves existing bid-size math.
  const completionDebtMode = (strategy?.needRatio || 0) >= 0.7 || ((strategy?.roundsIncludingCurrent || draftRoundCount) <= 5 && (strategy?.playersNeededForMinimum || 0) >= 2);
  const earlyPaceDebtMode = (strategy?.roundNumber || 1) <= 6 && (strategy?.earlyPaceGap || 0) > 0;
  const winRateDebtMode = (strategy?.requiredWinsPerRound || 0) > (strategy?.baselineWinsPerRound || 1.4);
  if (completionDebtMode || earlyPaceDebtMode || winRateDebtMode) {
    const budgetPerOpenSlot = Math.max(1, Math.floor(effectiveBudgetNow / Math.max(1, openSlots)));
    const debtCapMultiplier = (earlyPaceDebtMode || winRateDebtMode) ? 1.7 : 1.8;
    const affordableBidCap = Math.max(4, Math.round(budgetPerOpenSlot * debtCapMultiplier));
    const isCriticalNeed = missingAtPosition > 0 || (strategy?.mustFillPositions || []).includes(player.position);

    if (isCriticalNeed) {
      return true;
    }

    if (bidAmount <= affordableBidCap) {
      return true;
    }

    // If the projected bid is too expensive for roster catch-up, prefer a controlled catch bid.
    return buildCatchBidDecision() || false;
  }

  if ((strategy?.mustFillRoster && player.avgValue <= 14) || missingAtPosition > 0) {
    return true;
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
  
  // Late-round spending relaxation: lower thresholds if nearing end
  const roundsLeft = strategy?.roundsIncludingCurrent || draftRoundCount;
  const isLateRound = roundsLeft <= 3;
  const thresholdRelaxation = isLateRound ? 0.12 : 0; // Lower threshold by 12% in final rounds

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
    // Relax thresholds in late rounds to ensure budget spending
    const eliteThreshold = 0.28 - thresholdRelaxation;
    // Teams behind pace are more aggressive on elite players
    const paceBoost = strategy?.isBehindPace ? 0.15 : 0;
    // Only bid if win probability > threshold OR team is very aggressive OR has budget
    if (winProbability + urgencyBoost + upgradeBoost + paceBoost > eliteThreshold || strategy.aggressiveness > 0.72 || team.budget > 150) {
      return true;
    }
    // In late rounds, more willing to place catch bids
    const catchBidChance = isLateRound ? 0.22 : 0.14;
    // Rare upside swing with controlled catch-bid sizing.
    if (winProbability < 0.22 && Math.random() < catchBidChance && team.budget >= 3) {
      return buildCatchBidDecision() || false;
    }
    return false;
  }

  // Moderate caution for high-value players
  if (isHighValuePlayer) {
    // Relax thresholds in late rounds
    const highValueThreshold = 0.2 - thresholdRelaxation;
    // Teams behind pace bid more aggressively on high-value players
    const paceBoost = strategy?.isBehindPace ? 0.12 : 0;
    // Only bid if win probability > threshold OR budget commitment is reasonable
    if (winProbability + urgencyBoost + upgradeBoost + paceBoost > highValueThreshold || (winProbability > 0.08 && budgetRatio < 0.22) || (upgradeGap >= 8 && budgetRatio < 0.34)) {
      return true;
    }
    // More aggressive catch-bid opportunities in late rounds
    const catchBidChance = isLateRound ? 0.18 : 0.08;
    // Smaller but still present catch-bid chance for premium players.
    if (winProbability < 0.25 && Math.random() < catchBidChance && team.budget >= 3) {
      return buildCatchBidDecision() || false;
    }
    return false;
  }

  // ===== PACE-BASED CATCH BIDDING =====
  // If significantly behind pace, strategically place $1-5 catch bids on cheap filler
  // This allows teams to catch up to expected roster size quickly while preserving budget for quality talent
  const paceVariance = strategy?.paceVariance || 0;
  const isBehindPace = strategy?.isBehindPace || false;
  const paceBehindAmount = Math.abs(Math.min(0, paceVariance));
  const isSignificantlyBehindPace = paceBehindAmount >= 2;
  const isCheapFillerPlayer = player.avgValue <= 12; // Backup QB, kicker, TE depth, etc.
  
  if (isBehindPace && isCheapFillerPlayer) {
    // Team is behind pace: use catch bid aggressively to fill roster quickly
    // This lets us grab cheap depth (backup QB, kicker, bench TE) at $1-5
    // while preserving budget ($200+) for quality talent in upcoming rounds
    const catchBidDecision = buildCatchBidDecision();
    if (catchBidDecision) {
      return catchBidDecision;
    }
  }

  // More aggressive for mid-tier and value players
  // In late rounds, much more likely to bid and spread budget
  const midTierThreshold = 0.08 - (isLateRound ? 0.15 : 0); // Much more permissive late game
  // If behind pace, be much more willing to bid on any available player
  const midTierPaceBoost = strategy?.isBehindPace ? 0.2 : 0;
  
  // If this player is a bargain, be much more willing to bid
  const bargainBoost = isBargain ? 0.25 : 0; // Huge boost if we think it's undervalued
  
  // ===== LATE-ROUND BUDGET FORCING =====
  // In rounds 7+, if CPU has significant budget left, force bidding to spend it all
  const cfg = loadCpuLogicConfig();
  const lateRoundBudgetForcingIntensity = cfg?.silent?.lateRoundBudgetForcingIntensity || 0.7;
  
  if (isLateRound && lateRoundBudgetForcingIntensity > 0) {
    const budgetRemaining = effectiveBudgetNow || 0;
    const rosterSpotsRemaining = openSlots || 1;
    
    // If CPU has budget left AND roster isn't completely full, force a bid
    // The forcing intensity controls how much of the budget they need to have left
    // At 0.7: force bid if have more than 30% of original budget ($60+)
    const budgetThresholdPercent = (1 - lateRoundBudgetForcingIntensity) * 100; // 30% at intensity 0.7
    const minimumBudgetToForce = (200 * budgetThresholdPercent) / 100;
    
    if (budgetRemaining > minimumBudgetToForce && rosterSpotsRemaining > 0) {
      // Force a bid to spend budget in late rounds
      // Don't waste it by losing to higher bids
      return true;
    }
  }
  
  return (winProbability + urgencyBoost + upgradeBoost + bargainBoost + midTierPaceBoost) > midTierThreshold || strategy.isDesperate || needLevel === 3 || upgradeGap >= 6;
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
    cutLowestRankedPlayers,
    resolveTieWithBudgetAwareness
  };
}

function getParticipationCurveWeights(silentCfg, avgValue, roundNumber) {
  const av = Math.max(0, Number(avgValue || 0));
  const lateRound = Number(roundNumber) >= 7;
  let prefix = 'curve1to9';
  if (av >= 50) prefix = 'curve50Plus';
  else if (av >= 40) prefix = 'curve40to49';
  else if (av >= 30) prefix = 'curve30to39';
  else if (av >= 20) prefix = 'curve20to29';
  else if (av >= 10) prefix = 'curve10to19';

  const defaultsByPrefix = {
    curve1to9: [0.12, 0.42, 0.3, 0.11, 0.035, 0.01, 0.003, 0.001],
    curve10to19: [0.06, 0.36, 0.36, 0.15, 0.05, 0.015, 0.004, 0.001],
    curve20to29: [0.03, 0.24, 0.4, 0.2, 0.08, 0.03, 0.012, 0.004],
    curve30to39: [0.02, 0.16, 0.32, 0.28, 0.13, 0.05, 0.02, 0.01],
    curve40to49: [0.02, 0.08, 0.18, 0.36, 0.23, 0.09, 0.03, 0.01],
    curve50Plus: [0.02, 0.04, 0.08, 0.2, 0.26, 0.24, 0.12, 0.04]
  };

  const defaults = defaultsByPrefix[prefix];
  const weights = defaults.map((fallback, index) => {
    const key = `${prefix}Bid${index + 1}`;
    return Math.max(0, Number(silentCfg?.[key] ?? fallback));
  });

  if (lateRound) {
    if (prefix === 'curve50Plus') {
      weights[4] += 0.03;
      weights[5] += 0.05;
      weights[6] += 0.03;
    } else if (prefix === 'curve40to49') {
      weights[3] += 0.03;
      weights[4] += 0.02;
    } else if (prefix === 'curve30to39') {
      weights[3] += 0.02;
      weights[4] += 0.01;
    }
  }

  return weights;
}

function getParticipationHardMax(silentCfg, avgValue) {
  const av = Math.max(0, Number(avgValue || 0));
  if (av >= 50) return Math.max(1, Math.floor(Number(silentCfg?.curve50PlusHardMaxBidders ?? 8)));
  if (av >= 40) return Math.max(1, Math.floor(Number(silentCfg?.curve40to49HardMaxBidders ?? 7)));
  if (av >= 30) return Math.max(1, Math.floor(Number(silentCfg?.curve30to39HardMaxBidders ?? 6)));
  if (av >= 20) return Math.max(1, Math.floor(Number(silentCfg?.curve20to29HardMaxBidders ?? 5)));
  if (av >= 10) return Math.max(1, Math.floor(Number(silentCfg?.curve10to19HardMaxBidders ?? 4)));
  return Math.max(1, Math.floor(Number(silentCfg?.curve1to9HardMaxBidders ?? 4)));
}

function getParticipationBandConfig(silentCfg, avgValue) {
  const av = Math.max(0, Number(avgValue || 0));
  if (av >= 50) {
    return {
      minPct: Number(silentCfg?.band50PlusMinTeamPct ?? 0.4),
      maxPct: Number(silentCfg?.band50PlusMaxTeamPct ?? 0.6),
      hardPct: Number(silentCfg?.topAvHardMaxTeamPct ?? 0.8),
      pullChance: Number(silentCfg?.band50PlusPullChance ?? 0.9)
    };
  }
  if (av >= 40) {
    return {
      minPct: Number(silentCfg?.band40to49MinTeamPct ?? 0.4),
      maxPct: Number(silentCfg?.band40to49MaxTeamPct ?? 0.6),
      hardPct: Number(silentCfg?.topAvHardMaxTeamPct ?? 0.8),
      pullChance: Number(silentCfg?.band40to49PullChance ?? 0.84)
    };
  }
  if (av >= 30) {
    return {
      minPct: Number(silentCfg?.band30to39MinTeamPct ?? 0.35),
      maxPct: Number(silentCfg?.band30to39MaxTeamPct ?? 0.55),
      hardPct: Number(silentCfg?.band30to39HardMaxTeamPct ?? 0.75),
      pullChance: Number(silentCfg?.bandDefaultPullChance ?? 0.75)
    };
  }
  if (av >= 20) {
    return {
      minPct: Number(silentCfg?.band20to29MinTeamPct ?? 0.25),
      maxPct: Number(silentCfg?.band20to29MaxTeamPct ?? 0.4),
      hardPct: Number(silentCfg?.band20to29HardMaxTeamPct ?? 0.65),
      pullChance: Number(silentCfg?.bandDefaultPullChance ?? 0.75)
    };
  }
  if (av >= 10) {
    return {
      minPct: Number(silentCfg?.band10to19MinTeamPct ?? 0.15),
      maxPct: Number(silentCfg?.band10to19MaxTeamPct ?? 0.3),
      hardPct: Number(silentCfg?.band10to19HardMaxTeamPct ?? 0.5),
      pullChance: Number(silentCfg?.bandDefaultPullChance ?? 0.75)
    };
  }

  return {
    minPct: Number(silentCfg?.band1to9MinTeamPct ?? 0.1),
    maxPct: Number(silentCfg?.band1to9MaxTeamPct ?? 0.3),
    hardPct: Number(silentCfg?.band1to9HardMaxTeamPct ?? 0.45),
    pullChance: Number(silentCfg?.bandDefaultPullChance ?? 0.75)
  };
}

function getLowAvNoBidChance(silentCfg, avgValue, roundNumber, options = {}) {
  const av = Math.max(0, Number(avgValue || 0));
  const round = Math.max(1, Number(roundNumber || 1));
  const lateRoundRelief = Math.max(0, Math.min(0.5, Number(silentCfg?.bandLowAvNoBidLateRoundRelief ?? 0.08)));
  const trueZeroPenalty = Math.max(0, Math.min(0.5, Number(silentCfg?.trueZeroAvNoBidPenalty ?? 0.16)));

  let baseNoBidChance = 0;
  if (av <= 9) {
    baseNoBidChance = Math.max(0, Math.min(0.95, Number(silentCfg?.band1to9NoBidChance ?? 0.55)));
  } else if (av <= 19) {
    baseNoBidChance = Math.max(0, Math.min(0.95, Number(silentCfg?.band10to19NoBidChance ?? 0.25)));
  }

  if (baseNoBidChance <= 0) return 0;

  const lateStage = Math.max(0, round - 6);
  let adjusted = baseNoBidChance - (lateStage * lateRoundRelief);
  if (options?.isTrueZeroAv) {
    adjusted += trueZeroPenalty;
  }
  return Math.max(0, Math.min(0.95, adjusted));
}

function pickParticipationTargetCountFromCurve(silentCfg, avgValue, roundNumber, totalTeams = 0, options = {}) {
  const weights = getParticipationCurveWeights(silentCfg, avgValue, roundNumber);
  const total = weights.reduce((sum, value) => sum + value, 0);
  const av = Math.max(0, Number(avgValue || 0));
  const teams = Math.max(0, Math.floor(Number(totalTeams || 0)));
  const trueZeroAv = !!options?.isTrueZeroAv;

  const noBidChance = getLowAvNoBidChance(silentCfg, av, roundNumber, options);
  if (teams > 0 && noBidChance > 0 && Math.random() < noBidChance) {
    return 0;
  }

  let hardMax = Math.min(weights.length, getParticipationHardMax(silentCfg, av));
  if (trueZeroAv) {
    hardMax = Math.max(1, hardMax - 1);
  }

  if (teams > 0) {
    const bandCfg = getParticipationBandConfig(silentCfg, av);
    const pctHardCeiling = Math.max(0.2, Math.min(1, Number(bandCfg.hardPct || 0.8)));
    const pctPreferredMin = Math.max(0.05, Math.min(1, Number(bandCfg.minPct || 0.25)));
    const pctPreferredMaxRaw = Math.max(0.05, Math.min(1, Number(bandCfg.maxPct || 0.45)));
    const pctPreferredMax = Math.max(pctPreferredMin, pctPreferredMaxRaw);
    const preferredPullChance = Math.max(0, Math.min(1, Number(bandCfg.pullChance ?? silentCfg?.topAvPreferredBandPullChance ?? 0.8)));

    const teamHardMax = Math.max(1, Math.floor(teams * pctHardCeiling));
    hardMax = Math.max(1, Math.min(hardMax, teamHardMax));

    const preferredMinCount = Math.max(1, Math.ceil(teams * pctPreferredMin));
    const preferredMaxCount = Math.max(preferredMinCount, Math.floor(teams * pctPreferredMax));
    const preferredBandMax = Math.min(hardMax, preferredMaxCount);
    const preferredBandMin = Math.min(preferredMinCount, preferredBandMax);

    if (total <= 0) return Math.max(1, hardMax);

    let roll = Math.random() * total;
    let picked = hardMax;
    for (let index = 0; index < weights.length; index += 1) {
      roll -= weights[index];
      if (roll <= 0) {
        picked = Math.max(1, Math.min(index + 1, hardMax));
        break;
      }
    }

    if (preferredBandMax >= preferredBandMin) {
      if (picked > preferredBandMax && Math.random() < preferredPullChance) {
        const span = Math.max(1, preferredBandMax - preferredBandMin + 1);
        picked = preferredBandMin + Math.floor(Math.random() * span);
      } else if (picked < preferredBandMin && Math.random() < (preferredPullChance * 0.6)) {
        const span = Math.max(1, preferredBandMax - preferredBandMin + 1);
        picked = preferredBandMin + Math.floor(Math.random() * span);
      }
    }

    return Math.max(1, Math.min(picked, hardMax));
  }

  if (total <= 0) return Math.max(1, hardMax);

  let roll = Math.random() * total;
  for (let index = 0; index < weights.length; index += 1) {
    roll -= weights[index];
    if (roll <= 0) {
      return Math.max(1, Math.min(index + 1, hardMax));
    }
  }

  return Math.max(1, hardMax);
}