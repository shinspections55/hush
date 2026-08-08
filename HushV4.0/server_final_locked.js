const express = require('express');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const app = express();
const port = process.env.PORT || 8000;

// Import database module
const { logAuctionResult, logIndividualBid, bulkLogIndividualBids, getPlayerAV, getPlayerAuctionCount, closeDatabase } = require('./database');

// Helper function to get effective AV for CPU bidding (learned value if enough data, otherwise static)
async function getEffectiveAV(player) {
  try {
    // Check if we have learned AV data for this player
    const learnedAV = await getPlayerAV(player.id);
    const auctionCount = await getPlayerAuctionCount(player.id);

    // Use learned value if we have 30+ auctions for this player
    if (learnedAV !== null && auctionCount >= 30) {
      console.log(`[CPU LEARNING] Using learned AV $${learnedAV.toFixed(1)} for ${player.name} (${auctionCount} auctions, static: $${player.avgValue})`);
      return learnedAV;
    }

    // Use static AV if no learned data or insufficient auctions
    return player.avgValue;
  } catch (error) {
    console.error('[CPU LEARNING] Error getting effective AV:', error);
    return player.avgValue; // Fallback to static AV
  }
}

const root = path.join(__dirname, '.');
app.use(express.static(root, { extensions: ['html'] }));

// Global error handlers to prevent crashes
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  console.error(err.stack);
  // Don't exit, just log the error
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit, just log the error
});

// Fallback: if a path has no extension, try to serve path + '.html' or the join page
app.get('*', (req, res, next) => {
  const urlPath = req.path;
  if (path.extname(urlPath)) return next(); // has extension, let static handle
  const tryFile = path.join(root, urlPath + '.html');
  res.sendFile(tryFile, err => {
    if (!err) return;
    res.sendFile(path.join(root, 'join-private.html'), err2 => {
      if (err2) res.status(404).send('Not found');
    });
  });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// In-memory map of drafts for real-time sync. This mirrors client localStorage but is ephemeral.
const drafts = {};

// Current draft ID for database logging
let currentDraftId = null;

// ==================== AUCTION LOGIC FUNCTIONS ====================

// Helper function: Check if player can be added to roster
function isValidRosterAddition(team, player, rosterLimits) {
  const counts = team.roster.reduce((c, p) => {
    c[p.position] = (c[p.position] || 0) + 1;
    return c;
  }, {});
  
  if ((counts[player.position] || 0) >= rosterLimits[player.position].max) return false;
  return true;
}

// Helper function: Get bid range based on position and AV
function getBidRange(position, avgValue) {
  // Define bid ranges by position and value (from your original table)
  const bidRanges = {
    QB: {
      '1-5': { min: 0.65, max: 1.65 },
      '5-10': { min: 0.7, max: 1.45 },
      '10-20': { min: 0.75, max: 1.45 },
      '20-30': { min: 0.8, max: 1.35 },
      '30-40': { min: 0.85, max: 1.25 },
      '40-50': { min: 1.0, max: 1.8 },
      '50-60': { min: 1.1, max: 1.9 },
      '60+': { min: 1.2, max: 2.0 }
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
      '1-5': { min: 0.4, max: 0.8 },
      '5-10': { min: 0.5, max: 0.9 },
      '10-20': { min: 0.5, max: 1.3 },
      '20-30': { min: 0.6, max: 1.4 },
      '30-40': { min: 0.7, max: 1.5 },
      '40-50': { min: 0.8, max: 1.6 },
      '50-60': { min: 0.9, max: 1.7 },
      '60+': { min: 1.0, max: 1.8 }
    }
  };

  // Get range key based on AV
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

  const positionRanges = bidRanges[position] || bidRanges['RB']; // Default to RB if position not found
  const rangeKey = getRangeKey(avgValue);
  return positionRanges[rangeKey] || { min: 0.5, max: 1.0 }; // Fallback
}
function evaluateBidStrategy(bidAmount, player, team, strategy, allCpuTeams, availablePlayers) {
  // Count how many other teams are likely to bid higher
  let competingTeams = 0;
  let higherBidders = 0;

  for (const otherTeam of allCpuTeams) {
    if (otherTeam.name === team.name) continue;

    const otherStrategy = {
      aggressiveness: 0.5, // Default assumption
      budgetPerRound: otherTeam.budget / 10,
      isRich: otherTeam.budget > 150,
      isPoor: otherTeam.budget < 50
    };

    // Estimate what this team would bid
    const otherBidRange = getBidRange(player.position, player.avgValue);
    let estimatedBid = Math.round(player.avgValue * otherStrategy.aggressiveness);
    const otherMultiplier = otherBidRange.min + Math.random() * (otherBidRange.max - otherBidRange.min);
    estimatedBid = Math.round(estimatedBid * otherMultiplier);

    // Apply budget constraints
    const maxAffordable = Math.min(otherTeam.budget - 10, otherTeam.budget * 0.3);
    estimatedBid = Math.min(estimatedBid, maxAffordable);

    competingTeams++;

    if (estimatedBid > bidAmount) {
      higherBidders++;
    }
  }

  // Calculate win probability
  const winProbability = competingTeams > 0 ? (competingTeams - higherBidders) / competingTeams : 1.0;

  // Decision factors
  const isElitePlayer = player.avgValue >= 50;
  const isHighValuePlayer = player.avgValue >= 35;
  const budgetRatio = bidAmount / team.budget;

  // Conservative bidding for elite players
  if (isElitePlayer) {
    // Only bid if win probability > 40% OR team is very aggressive OR has budget
    if (winProbability > 0.4 || strategy.aggressiveness > 0.7 || team.budget > 150) {
      return true;
    }
    // Catch bid: 10% chance of $1-4 bid on elite players if win probability is very low
    else if (winProbability < 0.3 && Math.random() < 0.1 && team.budget >= 5) {
      // Replace the calculated bid with a catch bid
      const catchBid = Math.floor(Math.random() * 4) + 1; // $1-4
      // We'll need to modify the bid amount - this will be handled in the calling function
      return { shouldBid: true, isCatchBid: true, catchBidAmount: catchBid };
    }
    return false;
  }

  // Moderate caution for high-value players
  if (isHighValuePlayer) {
    // Only bid if win probability > 30% OR budget commitment is reasonable
    if (winProbability > 0.3 || (winProbability > 0.1 && budgetRatio < 0.2)) {
      return true;
    }
    // Catch bid: 5% chance of $1-3 bid on high-value players
    else if (winProbability < 0.4 && Math.random() < 0.05 && team.budget >= 4) {
      const catchBid = Math.floor(Math.random() * 3) + 1; // $1-3
      return { shouldBid: true, isCatchBid: true, catchBidAmount: catchBid };
    }
    return false;
  }

  // More aggressive for mid-tier and value players
  // Bid if win probability > 15% OR team desperately needs roster spots
  return winProbability > 0.15 || strategy.isDesperate;
}

// Helper function: Generate CPU bids for a round (situational and dynamic)
async function generateCPUBids(teams, roundPlayers, allPlayers, rosterSize, rosterLimits, humanMembers, roundNumber) {
  try {
    // Filter to only CPU teams (teams not controlled by human members), allow bench filling
    const maxRosterSize = rosterSize + 3;
    const cpuTeams = teams.filter(t => !humanMembers.includes(t.name) && t.roster.length < maxRosterSize);
    const cpuBids = {};

    console.log(`[generateCPUBids] Human members: ${humanMembers.join(', ')}`);
    console.log(`[generateCPUBids] CPU teams: ${cpuTeams.map(t => t.name).join(', ')}`);

    // Generate dynamic bidding strategies for each CPU team based on situation
    const teamStrategies = {};
    for (const team of cpuTeams) {
      // Calculate situational factors
      const rosterSize = team.roster ? team.roster.length : 0;
      const rosterSpotsLeft = 15 - rosterSize; // Assuming 15 roster spots
      const roundsLeft = 10 - roundNumber;
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

      // Determine position priorities (what positions the team needs most)
      const positionPriorities = {};
      Object.keys(rosterLimits).forEach(pos => {
        const current = positionCounts[pos] || 0;
        const max = rosterLimits[pos].max;
        const min = rosterLimits[pos].min || 0;
        if (current < min) positionPriorities[pos] = 3; // Critical need
        else if (current < max) positionPriorities[pos] = 2; // Moderate need
        else positionPriorities[pos] = 1; // No immediate need
      });

      // Base aggressiveness influenced by budget and roster needs
      let baseAggressiveness = 0.5; // Default moderate

      // Budget-based adjustments
      if (team.budget > 150) baseAggressiveness += 0.2; // Rich team, more aggressive
      else if (team.budget < 50) baseAggressiveness -= 0.2; // Poor team, more conservative

      // Roster needs adjustments
      if (rosterSpotsLeft <= 3) baseAggressiveness += 0.15; // Desperate for players
      else if (rosterSpotsLeft >= 10) baseAggressiveness -= 0.1; // Can be picky

      // Round-based adjustments - more flexible, allow strategic early aggression
      if (isEarlyRound) {
        // Rich teams can be aggressive early if they want to secure talent
        if (team.budget > 150 && rosterSpotsLeft <= 8) {
          baseAggressiveness += Math.random() * 0.4 - 0.1; // Can be more aggressive
        } else {
          baseAggressiveness += Math.random() * 0.3 - 0.15; // Normal early round variance
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
      const teamSeed = team.name.split(' ').pop(); // Use team number as seed
      const personalityVariance = (parseInt(teamSeed) % 7 - 3) * 0.1; // -0.3 to +0.3
      baseAggressiveness += personalityVariance;

      // Add round-to-round unpredictability
      const roundVariance = (Math.random() - 0.5) * 0.3; // ±0.15 variance
      baseAggressiveness += roundVariance;
      baseAggressiveness = Math.max(0.1, Math.min(0.9, baseAggressiveness));

      teamStrategies[team.name] = {
        aggressiveness: baseAggressiveness,
        budgetPerRound,
        rosterSpotsLeft,
        isDesperate: rosterSpotsLeft <= 3,
        isRich: team.budget > 150,
        isPoor: team.budget < 50,
        positionPriorities // Store for later use
      };

      console.log(`[generateCPUBids] ${team.name} strategy: ${baseAggressiveness.toFixed(2)}x aggressive, $${budgetPerRound.toFixed(0)}/round, ${rosterSpotsLeft} spots left`);
    }

    // Generate bids for each CPU team
    for (const team of cpuTeams) {
      const strategy = teamStrategies[team.name];
      cpuBids[team.name] = [];

      // Dynamic bidding based on strategy
      const shuffledPlayers = [...roundPlayers].sort((a, b) => b.avgValue - a.avgValue);
      const availablePlayers = shuffledPlayers.slice(0, Math.min(10, shuffledPlayers.length));

      // Use position priorities from strategy
      const positionPriorities = strategy.positionPriorities;

      // Number of bids based on strategy and budget
      let maxBids = 2; // Base minimum
      if (strategy.isRich) maxBids += 2;
      if (strategy.isDesperate) maxBids += 1;
      if (strategy.aggressiveness > 0.7) maxBids += 1;
      maxBids = Math.min(maxBids, availablePlayers.length);

      // Select players with strategy-based weighting
      const selectedIndices = [];
      for (let i = 0; i < maxBids && selectedIndices.length < maxBids; i++) {
        // Weight selection based on strategy
        let weights = availablePlayers.map((player, idx) => {
          let weight = 10 - idx * 1.5; // Base preference for better players

          // Position priority bonus
          const playerPriority = positionPriorities[player.position] || 1;
          if (playerPriority === 3) weight *= 2.0; // Critical position need
          else if (playerPriority === 2) weight *= 1.3; // Moderate position need

          // Adjust weights based on strategy
          if (strategy.aggressiveness > 0.7 && idx < 3) weight *= 1.5; // Aggressive teams love top players
          if (strategy.isDesperate && idx >= 5) weight *= 0.7; // Desperate teams bid on more players
          if (strategy.isPoor && idx < 2) weight *= 0.8; // Poor teams avoid top talent

          // Rich teams with many spots: sometimes reach for value or balance
          if (strategy.isRich && strategy.rosterSpotsLeft >= 8) {
            // 40% chance to prefer mid-tier players for balance
            if (Math.random() < 0.4) {
              if (idx >= 3 && idx <= 6) weight *= 1.8; // Boost mid-tier players
              if (idx < 2) weight *= 0.6; // Reduce top players
            }
            // 15% chance to reach for value (not for elite players)
            else if (Math.random() < 0.15 && player.avgValue < 40) {
              // Look for value players among available
              const avgValue = player.avgValue;
              if (avgValue >= 25 && idx >= 5) weight *= 2.0; // Value picks
              if (avgValue < 15) weight *= 0.3; // Avoid low-value players
            }
          }

          return Math.max(1, weight);
        });

        const totalWeight = weights.reduce((a, b) => a + b, 0);
        let random = Math.random() * totalWeight;

        for (let j = 0; j < weights.length; j++) {
          random -= weights[j];
          if (random <= 0 && !selectedIndices.includes(j)) {
            selectedIndices.push(j);
            break;
          }
        }
      }

      for (const playerIndex of selectedIndices) {
        const player = availablePlayers[playerIndex];
        let baseBid = Math.round(player.avgValue * strategy.aggressiveness);

        // Use position-specific bid ranges from your original table
        const bidRange = getBidRange(player.position, player.avgValue);
        let baseMultiplier = bidRange.min + Math.random() * (bidRange.max - bidRange.min);

        // Add occasional outlier bids for realism (5% chance of extreme bids)
        if (Math.random() < 0.05) { // 5% chance of outlier
          const outlierType = Math.random();
          if (outlierType < 0.3) { // 30% of outliers are lowball bids
            baseMultiplier *= 0.6 + Math.random() * 0.2; // 0.6x to 0.8x of normal range
          } else if (outlierType < 0.7) { // 40% of outliers are overpays
            baseMultiplier *= 1.2 + Math.random() * 0.3; // 1.2x to 1.5x of normal range
          } else { // 30% of outliers are extreme overpays
            baseMultiplier *= 1.5 + Math.random() * 0.5; // 1.5x to 2.0x of normal range
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
            situationalMultiplier *= 1.2; // Allow early aggression for rich teams
          } else {
            situationalMultiplier *= 1.1; // Normal early round boost
          }
        } else if (roundNumber >= 8) {
          situationalMultiplier *= 1.2; // Late rounds, desperation
        }

        // Budget discipline
        const safeBudget = team.budget - (10 - roundNumber) * 2;
        const maxAffordableBid = Math.max(1, safeBudget);

        baseBid = Math.round(baseBid * situationalMultiplier);

        baseBid = Math.round(baseBid * situationalMultiplier);

        // Add randomization for unpredictability - less extreme for elite players
        let randomFactor;
        if (player.avgValue >= 50) {
          randomFactor = 0.95 + Math.random() * 0.1; // ±5% for elite players (very tight)
        } else if (player.avgValue >= 35) {
          randomFactor = 0.9 + Math.random() * 0.2; // ±10% for high-value players
        } else {
          randomFactor = 0.75 + Math.random() * 0.5; // ±25% for mid/low-value players
        }
        baseBid = Math.round(baseBid * randomFactor);

        // Final budget and minimum checks
        baseBid = Math.min(baseBid, maxAffordableBid);
        baseBid = Math.max(baseBid, 1);

        // Strategic bid evaluation: Only bid if team believes it can win
        const bidDecision = evaluateBidStrategy(baseBid, player, team, strategy, cpuTeams, availablePlayers);

        if (bidDecision === true) {
          cpuBids[team.name].push({ player, cpuBid: baseBid });
        } else if (bidDecision && bidDecision.shouldBid && bidDecision.isCatchBid) {
          // Catch bid: Use the low catch bid amount instead of calculated bid
          cpuBids[team.name].push({ player, cpuBid: bidDecision.catchBidAmount });
          console.log(`[CPU-${team.name}] Catch bid on ${player.name} ($${bidDecision.catchBidAmount}) - long shot!`);
        } else {
          // Skip this bid - team doesn't believe it can win
          console.log(`[CPU-${team.name}] Skipping bid on ${player.name} ($${baseBid}) - poor win odds`);
        }
      }

      console.log(`[CPU-${team.name}] Generated ${cpuBids[team.name].length} bids (strategy: ${(strategy.aggressiveness * 100).toFixed(0)}% aggressive, budget: $${team.budget})`);
    }

    console.log(`[generateCPUBids] Completed - generated bids for ${Object.keys(cpuBids).length} CPU teams`);
    return cpuBids;
  } catch (error) {
    console.error('[generateCPUBids] CRITICAL ERROR generating CPU bids:', error);
    console.error(error.stack);
    // Return empty object on error to prevent server crash
    return {};
  }
}

// Helper function: Process all auctions for a round
async function processAuctions(roundPlayers, teams, cpuBids, userBids, rosterLimits, flexPositions, rosterSize, roundNumber) {
  try {
    const results = [];
    const tiedBids = [];
    const allIndividualBids = []; // Collect all bids for bulk database operations

    console.log(`[processAuctions] Processing ${roundPlayers.length} players`);
    console.log(`[processAuctions] User bids:`, JSON.stringify(userBids));
    console.log(`[processAuctions] CPU teams with bids:`, Object.keys(cpuBids));
    
    // Log which players have user bids
    const playersWithUserBids = Object.keys(userBids).filter(playerId => 
      Object.keys(userBids[playerId]).length > 0
    );
    console.log(`[processAuctions] Players with user bids: ${playersWithUserBids.length} out of ${roundPlayers.length}`);
    playersWithUserBids.forEach(playerId => {
      const player = roundPlayers.find(p => p.id == playerId);
      const bidTeams = Object.keys(userBids[playerId]);
      console.log(`[processAuctions] ${player ? player.name : 'Unknown player'} (${playerId}): bids from ${bidTeams.join(', ')}`);
    });

  roundPlayers.forEach(player => {
    const bids = [];
    
    // Collect user bids from draftState.bids
    Object.keys(userBids[player.id] || {}).forEach(teamName => {
      const team = teams.find(t => t.name === teamName);
      const bidAmount = userBids[player.id][teamName];
      if (team && bidAmount > 0 && bidAmount <= team.budget) {
        bids.push({ team, amount: bidAmount });
        // Collect for bulk logging instead of individual logging
        allIndividualBids.push({
          draftId: currentDraftId || 'default_draft',
          roundNumber,
          player,
          bidderTeam: teamName,
          bidAmount,
          isWinning: false,
          isSecondHighest: false
        });
        console.log(`[processAuctions] ${player.name}: User bid from ${teamName} = $${bidAmount}`);
      }
    });

    // Collect CPU bids
    Object.keys(cpuBids).forEach(cpuName => {
      const cpuTeam = teams.find(t => t.name === cpuName);
      const cpuBidObj = cpuBids[cpuName].find(b => b.player.id === player.id);
      if (cpuBidObj && cpuTeam && cpuBidObj.cpuBid <= cpuTeam.budget) {
        bids.push({ team: cpuTeam, amount: cpuBidObj.cpuBid });
        // Collect for bulk logging instead of individual logging
        allIndividualBids.push({
          draftId: currentDraftId || 'default_draft',
          roundNumber,
          player,
          bidderTeam: cpuName,
          bidAmount: cpuBidObj.cpuBid,
          isWinning: false,
          isSecondHighest: false
        });
        console.log(`[processAuctions] ${player.name}: CPU bid from ${cpuName} = $${cpuBidObj.cpuBid}`);
      }
    });

    console.log(`[processAuctions] ${player.name}: Total bids = ${bids.length}`);

    // Create allBids array with ALL teams (including those who bid $0)
    const allTeamsBids = teams.map(team => {
      // Check if this team bid on this player
      const bidEntry = bids.find(b => b.team.name === team.name);
      return {
        teamName: team.name,
        amount: bidEntry ? bidEntry.amount : 0
      };
    });

    const maxBid = Math.max(...bids.map(b => b.amount), 0);
    const topBidders = bids.filter(b => b.amount === maxBid);

    if (topBidders.length === 1 && maxBid > 0) {
      const winner = topBidders[0].team;
      const secondHighestBid = bids.length > 1 ? Math.max(...bids.filter(b => b.amount < maxBid).map(b => b.amount), 0) : 0;
      const secondHighestBidder = bids.length > 1 ? bids.filter(b => b.amount === secondHighestBid)[0]?.team.name : null;
      const pricePaid = Math.max(secondHighestBid + 1, 1);
      
      // Ensure winner can afford the price (prevent negative budget)
      const finalPrice = Math.min(pricePaid, winner.budget);
      
      // Mark winning and second highest bids in our collected data
      const winnerBidIndex = allIndividualBids.findIndex(b =>
        b.player.id === player.id && b.bidderTeam === winner.name && b.bidAmount === maxBid
      );
      if (winnerBidIndex !== -1) {
        allIndividualBids[winnerBidIndex].isWinning = true;
      }

      if (secondHighestBidder) {
        const secondBidIndex = allIndividualBids.findIndex(b =>
          b.player.id === player.id && b.bidderTeam === secondHighestBidder && b.bidAmount === secondHighestBid
        );
        if (secondBidIndex !== -1) {
          allIndividualBids[secondBidIndex].isSecondHighest = true;
        }
      }
      
      results.push({
        type: 'won',
        playerId: player.id,
        playerName: player.name,
        playerPosition: player.position,
        playerPrerank: player.prerank,
        winnerTeam: winner.name,
        bidAmount: maxBid,
        pricePaid: finalPrice,
        secondHighestBid: secondHighestBid,
        secondHighestBidder: secondHighestBidder,
        allBids: allTeamsBids
      });
    } else if (topBidders.length > 1) {
      tiedBids.push({
        playerId: player.id,
        playerName: player.name,
        tiedTeams: topBidders.map(b => b.team.name),
        bidAmount: maxBid
      });
      results.push({
        type: 'tied',
        playerId: player.id,
        playerName: player.name,
        tiedTeams: topBidders.map(b => b.team.name),
        bidAmount: maxBid,
        allBids: allTeamsBids
      });
    } else {
      results.push({
        type: 'undrafted',
        playerId: player.id,
        playerName: player.name,
        allBids: allTeamsBids
      });
    }
  });

  // Bulk database operations - much more efficient!
  console.log(`[processAuctions] Performing bulk database operations for ${allIndividualBids.length} bids...`);

  try {
    // Bulk insert all individual bids
    if (allIndividualBids.length > 0) {
      await bulkLogIndividualBids(allIndividualBids);
      console.log(`[processAuctions] Bulk logged ${allIndividualBids.length} individual bids`);
    }

    // Log auction results (these are fewer operations)
    const auctionResults = results.filter(r => r.type === 'won');
    for (const result of auctionResults) {
      const player = roundPlayers.find(p => p.id === result.playerId);
      if (player) {
        await logAuctionResult(
          currentDraftId || 'default_draft',
          roundNumber,
          player,
          { name: result.winnerTeam },
          result.pricePaid,
          result.secondHighestBid,
          result.secondHighestBidder
        );
      }
    }
    console.log(`[processAuctions] Logged ${auctionResults.length} auction results`);

  } catch (error) {
    console.error('[processAuctions] Database logging error:', error);
  }

  console.log(`[processAuctions] Completed processing ${results.length} results, ${tiedBids.length} tied bids`);
  return { results, tiedBids };
  } catch (error) {
    console.error('[processAuctions] CRITICAL ERROR processing auctions:', error);
    console.error(error.stack);
    
    // Return empty results on error to prevent server crash
    return { results: [], tiedBids: [] };
  }
}

// ==================== SOCKET.IO HANDLERS ====================

io.on('connection', (socket) => {
  console.log(`[connection] New socket connected: ${socket.id}`);
  
  // join room and receive current state
  socket.on('joinDraftRoom', (code, username) => {
    socket.join(code);
    // Store username in socket data
    if (username) {
      socket.data.username = username;
      socket.data.currentDraft = code;
      console.log(`[joinDraftRoom] ${username} (${socket.id}) joined room ${code}`);
    }
    socket.emit('draftUpdate', drafts[code] || { members: [], type: null, capacity: null, public: false });
  });

  // Client requests to create a draft and join it in one call
  socket.on('createAndJoinDraft', (code, state, username, cb) => {
    drafts[code] = Object.assign(drafts[code] || {}, state || {});
    drafts[code].members = drafts[code].members || [];
    // Set default capacity if not specified
    if (!drafts[code].capacity) drafts[code].capacity = 10;
  // clear any previous closed flag when a host (creator) makes/joins a draft
  if(drafts[code].closed){ delete drafts[code].closed; }

    // Set current draft ID for database logging
    currentDraftId = code;
    // enforce capacity if already set
    const cap = drafts[code].capacity ? drafts[code].capacity : null;
    if(cap && drafts[code].members.length >= cap && !drafts[code].members.includes(username)){
      if(cb) cb({ ok: false, reason: 'capacity' });
      return;
    }
    if(!drafts[code].members.includes(username)) drafts[code].members.push(username);
    socket.join(code);
    socket.data.username = username;
    socket.data.currentDraft = code;
    io.to(code).emit('draftUpdate', drafts[code]);
    if(cb) cb({ ok: true, draft: drafts[code] });
  });

  // Client requests to join an existing draft (server authoritative)
  socket.on('requestJoin', (code, username, cb) => {
  // Important: User must have the code to even call this endpoint
  // The code acts as the access credential for private drafts
  
  // If draft doesn't exist yet, this is the first person creating it
  drafts[code] = drafts[code] || { members: [], type: null, capacity: 10, public: false };
  
  // If draft was closed but a previous member is rejoining, reopen it
  if(drafts[code].closed && drafts[code].members.includes(username)){ 
    console.log(`[requestJoin] ${username} (previous member) reopening closed draft ${code}`);
    delete drafts[code].closed;
  }
  
  // if the draft is still closed after the check above, reject joins
  if(drafts[code].closed){ 
    if(drafts[code].members.includes(username)){
      console.log(`[requestJoin] ${username} (previous member) reopening closed draft ${code}`);
      delete drafts[code].closed;
    } else {
      // Draft is closed and user is not a previous member - reject
      console.log(`[requestJoin] ${username} denied - draft ${code} is closed`);
      if(cb) cb({ ok: false, reason: 'closed' }); 
      return;
    }
  }
    drafts[code].members = drafts[code].members || [];
    const cap = drafts[code].capacity ? drafts[code].capacity : null;
    console.log(`[requestJoin] ${username} -> ${code}: capacity=${cap}, members=${drafts[code].members.length}, already member=${drafts[code].members.includes(username)}`);
    if(cap && drafts[code].members.length >= cap && !drafts[code].members.includes(username)){
      console.log(`[requestJoin] ${username} denied - capacity reached`);
      if(cb) cb({ ok: false, reason: 'capacity' });
      return;
    }
    if(!drafts[code].members.includes(username)) drafts[code].members.push(username);
    socket.join(code);
    socket.data.username = username;
    socket.data.currentDraft = code;
    console.log(`[requestJoin] ${username} joined ${code} successfully. Total members: ${drafts[code].members.length}`);
    io.to(code).emit('draftUpdate', drafts[code]);
    if(cb) cb({ ok: true, draft: drafts[code] });
  });

  // Clients can request to leave a draft; server will update state and broadcast
  socket.on('leaveDraft', (code, username, cb) => {
    if(drafts[code] && drafts[code].members){
      // determine if leaving user is the host (first member)
      const wasHost = drafts[code].members.length && drafts[code].members[0] === username;
      drafts[code].members = drafts[code].members.filter(m => m !== username);
      if(wasHost){
        // mark draft closed so new joins are rejected and notify remaining clients
        drafts[code].closed = true;
      }
      io.to(code).emit('draftUpdate', drafts[code]);
    }
    try{ socket.leave(code); }catch(e){}
    if(cb) cb({ ok: true });
  });

  // Generic state update - still supported but server won't accept member lists blindly
  socket.on('updateDraft', (code, state) => {
    // merge only non-members fields (type, capacity, public, draftOrder, draftOrderAssignments)
    drafts[code] = drafts[code] || { members: [], type: null, capacity: null, public: false };
    const allowed = (({ type, capacity, public: pub, draftOrder, draftOrderAssignments }) => ({ type, capacity, public: pub, draftOrder, draftOrderAssignments }))(state || {});
    // apply allowed fields
    if(typeof allowed.type !== 'undefined') drafts[code].type = allowed.type;
    if(typeof allowed.capacity !== 'undefined') drafts[code].capacity = allowed.capacity;
    if(typeof allowed.public !== 'undefined') drafts[code].public = allowed.public;
    if(typeof allowed.draftOrder !== 'undefined') drafts[code].draftOrder = allowed.draftOrder;
    if(typeof allowed.draftOrderAssignments !== 'undefined') drafts[code].draftOrderAssignments = allowed.draftOrderAssignments;
    console.log(`[updateDraft] ${code} capacity=${drafts[code].capacity} members=${drafts[code].members.length}`);
    io.to(code).emit('draftUpdate', drafts[code]);
  });

  // Host starts the draft - notify all members to navigate to draft page
  socket.on('startDraft', (code, draftType, cb) => {
    console.log(`[startDraft] ${code} type=${draftType} by ${socket.data.username}`);
    // Verify the requester is the host (first member)
    if(drafts[code] && drafts[code].members && drafts[code].members[0] === socket.data.username){
      // Mark draft as started and store the draft type
      drafts[code].started = true;
      drafts[code].type = draftType;
      drafts[code].startedAt = Date.now();
      
      // Get all sockets in this room
      const roomSockets = io.sockets.adapter.rooms.get(code);
      console.log(`[startDraft] Broadcasting to ${roomSockets ? roomSockets.size : 0} sockets in room ${code}`);
      console.log(`[startDraft] Members in draft: ${drafts[code].members.join(', ')}`);
      
      // Broadcast to all members in the room (including host)
      io.to(code).emit('draftStarted', draftType);
      console.log(`[startDraft] Broadcast sent`);
      if(cb) cb({ ok: true });
    } else {
      console.log(`[startDraft] denied - ${socket.data.username} is not the host`);
      if(cb) cb({ ok: false, reason: 'not_host' });
    }
  });

  // Get current draft state from server (for draft page to load)
  socket.on('getDraftState', (code, cb) => {
    console.log(`[getDraftState] ${code} requested by ${socket.data.username}`);
    if(drafts[code]){
      if(cb) cb({ ok: true, draft: drafts[code] });
    } else {
      if(cb) cb({ ok: false, reason: 'not_found' });
    }
  });

  // Join the active draft room for real-time bidding
  socket.on('joinActiveDraft', (code, username) => {
    socket.join(`draft_${code}`);
    socket.data.activeDraftCode = code;
    socket.data.username = username;
    console.log(`[joinActiveDraft] ${username} joined active draft ${code}`);
    
    // Initialize draft state if not exists
    if(!drafts[code].draftState) {
      drafts[code].draftState = {
        currentRound: 1,
        roundTimer: 600,
        currentPlayers: [], // The 10 players for the current round
        completedRounds: [],
        bids: {} // playerId: { teamName: bidAmount }
      };
    }
    
    // Send current draft state to the joining player
    socket.emit('draftStateSync', drafts[code].draftState);
  });

  // Host sets the players for a round (all members will see these same players)
  socket.on('setRoundPlayers', (code, players, cb) => {
    const username = socket.data.username;
    console.log(`[setRoundPlayers] ${username} set ${players.length} players for round ${drafts[code].draftState.currentRound}`);
    
    if(drafts[code] && drafts[code].members && drafts[code].members[0] === username){
      // Host is setting the round players
      drafts[code].draftState.currentPlayers = players;
      
      // Reset submission tracking for new round
      drafts[code].draftState.submittedMembers = [];
      
      // Broadcast to all members in the draft
      io.to(`draft_${code}`).emit('roundPlayersSet', players);
      
      if(cb) cb({ ok: true });
    } else {
      if(cb) cb({ ok: false, reason: 'not_host' });
    }
  });

  // Place a bid on a player
  socket.on('placeBid', (code, playerId, bidAmount, cb) => {
    const username = socket.data.username;
    console.log(`[placeBid] ${username} bid $${bidAmount} on player ${playerId} in draft ${code}`);
    
    if(!drafts[code].draftState.bids[playerId]) {
      drafts[code].draftState.bids[playerId] = {};
    }
    drafts[code].draftState.bids[playerId][username] = bidAmount;
    
    // Broadcast bid to all members in the draft
    io.to(`draft_${code}`).emit('bidUpdate', { playerId, username, bidAmount });
    
    if(cb) cb({ ok: true });
  });

  // User has submitted their bids for the round
  socket.on('submitBids', (code, username, cb) => {
    console.log(`[submitBids] ${username} submitted bids in ${code}`);
    
    if(!drafts[code].draftState.submittedMembers) {
      drafts[code].draftState.submittedMembers = [];
    }
    
    // Track this member's submission
    if(!drafts[code].draftState.submittedMembers.includes(username)) {
      drafts[code].draftState.submittedMembers.push(username);
    }
    
    // Broadcast to all other members in the draft room (not the sender)
    socket.to(`draft_${code}`).emit('bidsSubmitted', { username });
    
    // Check if all non-CPU members have submitted
    const allMembers = drafts[code].members || [];
    const submittedCount = drafts[code].draftState.submittedMembers.length;
    
    console.log(`[submitBids] ${submittedCount}/${allMembers.length} members have submitted`);
    
    if(submittedCount >= allMembers.length) {
      console.log(`[submitBids] All members submitted - triggering round processing`);
      // All members have submitted, trigger round processing
      io.to(`draft_${code}`).emit('allBidsSubmitted');
    }
    
    if(cb) cb({ ok: true });
  });

  // Process round - server authoritatively determines auction results
  socket.on('processRound', async (code, roundData, cb) => {
    const username = socket.data.username;
    console.log(`[processRound] ${username} requested processing round in ${code}`);
    
    if(!drafts[code] || !drafts[code].draftState) {
      if(cb) cb({ ok: false, reason: 'no_draft_state' });
      return;
    }

    // Check if there's an active auction
    const hasActiveAuction = drafts[code].draftState.liveAuctions && 
      Object.values(drafts[code].draftState.liveAuctions).some(auction => auction.active);
    
    if(hasActiveAuction) {
      console.log(`[processRound] Cannot process new round while auction is active in ${code}`);
      if(cb) cb({ ok: false, reason: 'auction_in_progress' });
      return;
    }
    
    // Prevent duplicate round processing with a flag
    if(drafts[code].draftState.isProcessingRound) {
      console.log(`[processRound] Round already processing for ${code}, ignoring duplicate request`);
      if(cb) cb({ ok: false, reason: 'already_processing' });
      return;
    }
    
    // Ensure all members have submitted bids before processing
    const allMembers = drafts[code].members || [];
    const submittedMembers = drafts[code].draftState.submittedMembers || [];
    if (submittedMembers.length < allMembers.length) {
      console.log(`[processRound] Not all members have submitted bids yet (${submittedMembers.length}/${allMembers.length})`);
      if(cb) cb({ ok: false, reason: 'not_all_submitted' });
      return;
    }
    
    drafts[code].draftState.isProcessingRound = true;

    const { roundPlayers, teams, rosterSize, rosterLimits, flexPositions, allPlayers } = roundData;
    const draftState = drafts[code].draftState;
    
    // Store teams, allPlayers and rosterLimits for live auction use
    draftState.teams = teams;
    draftState.allPlayers = allPlayers;
    draftState.rosterLimits = rosterLimits;
    
    // Get all human members (non-CPU teams)
    const humanMembers = drafts[code].members || [];
    
    // Generate CPU bids once on server for consistency
    // Filter out all human members, so only CPU teams get bids generated
    console.log(`[processRound] Starting CPU bid generation...`);
    const cpuBidsPromise = generateCPUBids(teams, roundPlayers, allPlayers, rosterSize, rosterLimits, humanMembers, draftState.currentRound);
    
    // Add timeout to prevent hanging
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('CPU bid generation timeout')), 30000); // 30 second timeout
    });
    
    let cpuBids;
    try {
      cpuBids = await Promise.race([cpuBidsPromise, timeoutPromise]);
      console.log(`[processRound] CPU bid generation completed successfully`);
    } catch (error) {
      console.error(`[processRound] CPU bid generation failed:`, error.message);
      cpuBids = {}; // Use empty bids if generation fails
    }
    
    console.log(`[processRound] Processing round ${draftState.currentRound} with:`);
    console.log(`[processRound] - ${roundPlayers.length} players in round`);
    console.log(`[processRound] - ${humanMembers.length} human members: ${humanMembers.join(', ')}`);
    console.log(`[processRound] - CPU bids generated for ${Object.keys(cpuBids).length} teams`);
    console.log(`[processRound] - User bids available:`, JSON.stringify(draftState.bids, null, 2));
    
    try {
      // Process each player's auction
      const auctionResults = await processAuctions(roundPlayers, teams, cpuBids, draftState.bids, rosterLimits, flexPositions, rosterSize, draftState.currentRound);
      
      // Store complete results (including tiedBids) for auction processing
      draftState.lastRoundResults = auctionResults;
      
      // Broadcast results array to all members (they expect the results array)
      io.to(`draft_${code}`).emit('roundResults', auctionResults.results);
      console.log(`[processRound] Emitted roundResults to room draft_${code}:`, auctionResults.results.length, 'results');
      
      // Reset acceptance tracking for the new round results
      drafts[code].draftState.acceptedMembers = [];
      
      console.log(`[processRound] Results: ${auctionResults.results.length} outcomes, ${auctionResults.tiedBids.length} tied bids`);
      if(cb) cb({ ok: true });
    } catch (error) {
      console.error(`[processRound] ERROR processing auctions:`, error);
      console.error(error.stack);
      
      // Reset processing flag on error
      drafts[code].draftState.isProcessingRound = false;
      
      // Emit error to client
      io.to(`draft_${code}`).emit('roundProcessingError', { 
        message: 'Failed to process round results', 
        error: error.message 
      });
      
      if(cb) cb({ ok: false, reason: 'processing_error', error: error.message });
    } finally {
      // Always reset the processing flag
      drafts[code].draftState.isProcessingRound = false;
    }
  });

  // Member accepts round results
  socket.on('acceptRoundResults', (code, username, cb) => {
    console.log(`[acceptRoundResults] ${username} accepted results in ${code}`);
    
    if(!drafts[code].draftState.acceptedMembers) {
      drafts[code].draftState.acceptedMembers = [];
    }
    
    // Track this member's acceptance
    if(!drafts[code].draftState.acceptedMembers.includes(username)) {
      drafts[code].draftState.acceptedMembers.push(username);
    }
    
    // Only count human members (non-CPU) for acceptance tracking
    const humanMembers = drafts[code].members || [];
    const acceptedCount = drafts[code].draftState.acceptedMembers.length;
    
    console.log(`[acceptRoundResults] ${acceptedCount}/${humanMembers.length} human members have accepted`);
    
    // Broadcast acceptance status
    const remaining = humanMembers.length - acceptedCount;
    io.to(`draft_${code}`).emit('memberAcceptedResults', {
      username,
      acceptedCount,
      totalMembers: humanMembers.length,
      message: remaining > 0 ? `Waiting for ${remaining} more member(s) to accept...` : 'All members accepted!'
    });
    
    // Check if all human members have accepted (CPU teams don't need to accept)
    if(acceptedCount >= humanMembers.length) {
      console.log(`[acceptRoundResults] All ${humanMembers.length} human members accepted - advancing to next round`);
      
      // Store tied bids from last round results for automatic auction processing
      const lastResults = drafts[code].draftState.lastRoundResults;
      console.log(`[acceptRoundResults] lastResults structure:`, JSON.stringify(lastResults, null, 2));
      
      if (lastResults && lastResults.tiedBids && lastResults.tiedBids.length > 0) {
        console.log(`[acceptRoundResults] Found ${lastResults.tiedBids.length} tied bids, will start auctions automatically`);
        try {
          drafts[code].draftState.pendingAuctions = [...lastResults.tiedBids];
          
          // Start the first auction immediately
          const firstTie = drafts[code].draftState.pendingAuctions.shift();
          console.log(`[acceptRoundResults] Starting first auction for:`, firstTie);
          startServerLiveAuction(code, firstTie);
        } catch (err) {
          console.error(`[acceptRoundResults] ERROR starting auction:`, err);
          console.error(err.stack);
          // Proceed to next round on error
          io.to(`draft_${code}`).emit('allMembersAccepted');
        }
      } else {
        console.log(`[acceptRoundResults] No tied bids detected, proceeding to next round`);
        // No ties, proceed to next round
        io.to(`draft_${code}`).emit('allMembersAccepted');
      }
      
      // Reset tracking for next round
      drafts[code].draftState.acceptedMembers = [];
      drafts[code].draftState.submittedMembers = [];
      drafts[code].draftState.isProcessingRound = false; // Reset round processing flag
    }
    
    if(cb) cb({ ok: true });
  });

  // Start next round (host only)
  socket.on('startNextRound', (code, cb) => {
    const username = socket.data.username;
    if(drafts[code] && drafts[code].members && drafts[code].members[0] === username){
      drafts[code].draftState.currentRound++;
      drafts[code].draftState.roundTimer = 600;
      drafts[code].draftState.bids = {};
      
      console.log(`[startNextRound] Round ${drafts[code].draftState.currentRound} started by ${username}`);
      
      // Broadcast new round to all members
      io.to(`draft_${code}`).emit('roundStarted', drafts[code].draftState);
      
      if(cb) cb({ ok: true });
    } else {
      if(cb) cb({ ok: false, reason: 'not_host' });
    }
  });

  // ==================== LIVE AUCTION FOR TIES ====================
  
  // Server function to automatically start live auction when ties are detected
  function startServerLiveAuction(code, tiedBid) {
    console.log(`[startServerLiveAuction] Starting auction for ${tiedBid.playerName} in ${code}`);
    
    if (!drafts[code].draftState.liveAuctions) {
      drafts[code].draftState.liveAuctions = {};
    }
    
    const { playerId, playerName, tiedTeams, bidAmount } = tiedBid;
    
    // Server generates the auctionId
    const auctionId = `${code}_${playerId}_${Date.now()}`;
    console.log(`[startServerLiveAuction] Server-generated auctionId: ${auctionId}`);
    
    drafts[code].draftState.liveAuctions[auctionId] = {
      playerId,
      playerName,
      tiedTeams: [...tiedTeams],
      currentBid: bidAmount,
      currentWinner: null,
      bids: {},
      timer: 10,
      active: true,
      backedOutTeams: [],
      timerInterval: null
    };
    
    // Broadcast auction start
    console.log(`[startServerLiveAuction] Broadcasting liveAuctionStarted to draft_${code}`);
    io.to(`draft_${code}`).emit('liveAuctionStarted', {
      auctionId,
      playerId,
      playerName,
      tiedTeams,
      startBid: bidAmount
    });
    console.log(`[startServerLiveAuction] Broadcast complete`);
    
    // Start timer (code continues below in existing timer interval logic)
    startAuctionTimer(code, auctionId);
  }
  
  // Start auction timer (extracted from old socket handler)
  function startAuctionTimer(code, auctionId) {
    // Start timer
    const timerInterval = setInterval(() => {
      if (!drafts[code]) {
        console.log(`[timerInterval] Draft ${code} missing entirely, clearing interval`);
        clearInterval(timerInterval);
        return;
      }
      
      if (!drafts[code].draftState) {
        console.log(`[timerInterval] Draft state for ${code} is undefined, clearing interval`);
        clearInterval(timerInterval);
        return;
      }
      
      const auction = drafts[code].draftState.liveAuctions[auctionId];
      if (!auction || !auction.active) {
        console.log(`[timerInterval] Auction inactive or missing, clearing interval`);
        clearInterval(timerInterval);
        return;
      }
      
      auction.timer--;
      console.log(`[timerInterval] ${auctionId} timer: ${auction.timer}s`);
      
      // Broadcast timer update
      io.to(`draft_${code}`).emit('liveAuctionTimerUpdate', {
        auctionId,
        timer: auction.timer
      });
      
      // CPU AI bidding - check every 2 seconds during countdown
      if (auction.timer > 0 && auction.timer % 2 === 0) {
        try {
        // Safety check for draftState
        if (!drafts[code]) {
          console.log(`[CPU AI] Draft ${code} missing entirely, clearing interval`);
          clearInterval(timerInterval);
          return;
        }
        if (!drafts[code].draftState) {
          console.log(`[CPU AI] Draft state for ${code} is undefined, clearing interval`);
          clearInterval(timerInterval);
          return;
        }
        if (!drafts[code].draftState.teams) {
          console.log(`[CPU AI] Teams array missing for ${code}, clearing interval`);
          clearInterval(timerInterval);
          return;
        }
        
        // CPU teams are named "Team X" or "Team XX", human users have other names
        const cpuTeams = auction.tiedTeams.filter(t => {
          const team = drafts[code].draftState.teams.find(tm => tm.name === t);
          const isCPU = /^Team \d+$/.test(t);
          const notBackedOut = !auction.backedOutTeams.includes(t);
          return team && isCPU && notBackedOut;
        });
        
        console.log(`[CPU AI] Tied teams: ${auction.tiedTeams.join(', ')}`);
        console.log(`[CPU AI] CPU teams found: ${cpuTeams.join(', ') || 'none'}`);
        console.log(`[CPU AI] Evaluating ${cpuTeams.length} CPU teams for bidding`);
        
        // Skip if no CPU teams in this auction
        if (cpuTeams.length === 0) {
          console.log(`[CPU AI] No CPU teams in auction, skipping AI logic`);
          return;
        }
        
        // Get player data once for all CPUs
        const player = drafts[code].draftState.allPlayers?.find(p => p.id === auction.playerId);
        const prerank = player?.prerank || 999;
        const position = player?.position || '';
        const nextBid = auction.currentBid + 1;
        
        // Collect decisions for each CPU first (don't execute yet)
        const cpuDecisions = [];
        
        cpuTeams.forEach(cpuName => {
          const cpuTeam = drafts[code].draftState.teams.find(t => t.name === cpuName);
          if (!cpuTeam) return;
          
          const budgetLeft = cpuTeam.budget;
          const isCurrentWinner = auction.currentWinner === cpuName;
          
          console.log(`[CPU AI] ${cpuName} - Winner: ${isCurrentWinner}, NextBid: $${nextBid}, Budget: $${budgetLeft}`);
          
          // Calculate max price based on avgValue (same logic as generateCPUBids)
          const avgValue = player?.avgValue || 1;
          
          // Base bidding range: adjust based on player value for strategic spending
          let minMultiplier = 0.6, maxMultiplier = 1.4;
          if (avgValue >= 40) {
            minMultiplier = 0.9; // 90% of value
            maxMultiplier = 1.1; // 110% of value - pay close to actual value for elite players
          } else if (avgValue >= 20) {
            minMultiplier = 0.7; // 70% of value
            maxMultiplier = 1.3; // 130% of value
          }
          
          const minBid = Math.max(1, Math.round(avgValue * minMultiplier));
          const maxBid = Math.round(avgValue * maxMultiplier);
          
          // Over range: adjust based on value (very rare - about 1 in 50 rounds)
          let overMaxMultiplier = 1.15; // Much more conservative overrange
          if (avgValue >= 40) overMaxMultiplier = 1.1; // Even less overpay for elite
          else if (avgValue >= 20) overMaxMultiplier = 1.12;
          
          const overRangeMax = Math.round(avgValue * overMaxMultiplier);
          
          let maxPrice;
          const bidType = Math.random();
          
          // Exclude K and DEF from overrange bidding - they should always bid rationally
          const allowOverrange = position !== 'K' && position !== 'DEF';
          
          if (bidType < 0.99 || !allowOverrange) {
            // 99% chance: bid within normal range (100% for K/DEF)
            // 50% chance to bid under average value to get players cheaply and help CPU budgets
            const lowBidChance = 0.5;
            if (Math.random() < lowBidChance) {
              // Bid low: between minBid and avgValue
              maxPrice = Math.round(minBid + Math.random() * (avgValue - minBid));
            } else {
              // Bid high: between avgValue and maxBid
              maxPrice = Math.round(avgValue + Math.random() * (maxBid - avgValue));
            }
          } else {
            // 1% chance: bid in over range (rare overbidding) - never for K/DEF
            maxPrice = Math.round(avgValue + 1 + Math.random() * (overRangeMax - avgValue));
          }
          
          maxPrice = Math.max(1, maxPrice);
          
          // SCARCITY ANALYSIS - Check how many quality players at this position are still available
          const allPlayers = drafts[code].draftState.allPlayers || [];
          const availableAtPosition = allPlayers.filter(p => 
            p.position === position && 
            !p.owner && 
            p.avgValue >= avgValue * 0.8 && p.avgValue <= avgValue * 1.2 // Players within 20% of current player's value
          );
          
          const topTierAvailable = allPlayers.filter(p => 
            p.position === position && 
            !p.owner && 
            p.avgValue >= 15 // Top tier players ($15+ avgValue)
          );
          
          // Scarcity multiplier based on availability
          let scarcityMultiplier = 1.0;
          
          if (topTierAvailable.length <= 2) {
            scarcityMultiplier = 1.25;
            console.log(`[CPU AI] ${cpuName} - SCARCE position ${position}, only ${topTierAvailable.length} top tier left`);
          } else if (topTierAvailable.length <= 4) {
            scarcityMultiplier = 1.15;
            console.log(`[CPU AI] ${cpuName} - LIMITED position ${position}, ${topTierAvailable.length} top tier left`);
          } else if (availableAtPosition.length >= 10) {
            scarcityMultiplier = 0.90;
            console.log(`[CPU AI] ${cpuName} - ABUNDANT position ${position}, ${availableAtPosition.length} similar players left`);
          }
          
          maxPrice = Math.round(maxPrice * scarcityMultiplier);
          const variancePercent = -0.05 + Math.random() * 0.10;
          maxPrice = Math.round(maxPrice * (1.0 + variancePercent));
          
          // Add unique CPU-specific randomization to reduce ties in live auctions (but allow some)
          const cpuIndex = parseInt(cpuName.replace('Team ', '')) || 1;
          const uniqueVariance = (cpuIndex * 0.01) + (Math.random() * 0.02 - 0.01); // ±1% variation per CPU
          maxPrice = Math.round(maxPrice * (1 + uniqueVariance));
          
          // Check if position is needed for roster requirements
          const counts = cpuTeam.roster.reduce((c, p) => {
            c[p.position] = (c[p.position] || 0) + 1;
            return c;
          }, {});
          
          const rosterLimits = drafts[code].draftState.rosterLimits || {};
          let positionNeeded = false;
          if (position === 'QB' && (counts.QB || 0) < (rosterLimits.QB?.min || 0)) positionNeeded = true;
          if (position === 'RB' && (counts.RB || 0) < (rosterLimits.RB?.min || 0)) positionNeeded = true;
          if (position === 'WR' && (counts.WR || 0) < (rosterLimits.WR?.min || 0)) positionNeeded = true;
          if (position === 'TE' && (counts.TE || 0) < (rosterLimits.TE?.min || 0)) positionNeeded = true;
          if (position === 'K' && (counts.K || 0) < (rosterLimits.K?.min || 0)) positionNeeded = true;
          if (position === 'DEF' && (counts.DEF || 0) < (rosterLimits.DEF?.min || 0)) positionNeeded = true;
          
          if (positionNeeded) {
            maxPrice = Math.round(maxPrice * 1.3);
          }
          
          // Determine what this CPU wants to do
          let action = 'none';
          let reason = '';
          
          if (isCurrentWinner) {
            action = 'none';
            reason = 'already winning';
          } else if (nextBid > budgetLeft) {
            action = 'backout';
            reason = `can't afford $${nextBid} (budget: $${budgetLeft})`;
          } else if (nextBid > maxPrice) {
            action = 'backout';
            reason = `price too high ($${nextBid} > max $${maxPrice})`;
          } else if (Math.random() < 0.65) {
            action = 'bid';
            reason = `bidding $${nextBid}`;
          }
          
          cpuDecisions.push({ cpuName, action, reason, maxPrice, budgetLeft, avgValue });
        });
        
        // Count how many want to back out
        const wantToBackout = cpuDecisions.filter(d => d.action === 'backout');
        const currentlyRemaining = auction.tiedTeams.filter(t => !auction.backedOutTeams.includes(t)).length;
        
        // If all or all-but-one would back out, force at least one to stay
        if (wantToBackout.length >= currentlyRemaining - 1 && wantToBackout.length > 0) {
          console.log(`[CPU AI] ${wantToBackout.length} CPUs want to back out, but only ${currentlyRemaining} teams remain. Forcing one to stay.`);
          // Keep the one with the highest maxPrice (most willing to pay)
          wantToBackout.sort((a, b) => b.maxPrice - a.maxPrice);
          const forcedToStay = wantToBackout[0];
          forcedToStay.action = 'none';
          forcedToStay.reason = 'forced to stay (last bidder)';
          console.log(`[CPU AI] ${forcedToStay.cpuName} forced to stay in auction`);
        }
        
        // Now execute all decisions
        cpuDecisions.forEach(decision => {
          const { cpuName, action, reason } = decision;
          
          if (action === 'backout') {
            console.log(`[CPU AI] ${cpuName} backing out - ${reason}`);
            auction.backedOutTeams.push(cpuName);
            io.to(`draft_${code}`).emit('liveAuctionBackout', { auctionId, username: cpuName });
          } else if (action === 'bid') {
            console.log(`[CPU AI] ${cpuName} ${reason} (budget: $${decision.budgetLeft}, max: $${decision.maxPrice}, avgValue: ${decision.avgValue})`);
            auction.currentBid = nextBid;
            auction.currentWinner = cpuName;
            auction.bids[cpuName] = nextBid;
            auction.timer = 10;
            
            io.to(`draft_${code}`).emit('liveAuctionBidPlaced', {
              auctionId,
              bidder: cpuName,
              amount: nextBid
            });
          } else {
            console.log(`[CPU AI] ${cpuName} no action - ${reason}`);
          }
        });
        
        // Check if only 1 team remains after all CPU decisions
        const remainingTeams = auction.tiedTeams.filter(t => !auction.backedOutTeams.includes(t));
        console.log(`[CPU AI] After CPU decisions: ${remainingTeams.length} teams remaining (${remainingTeams.join(', ')})`);
        if (remainingTeams.length <= 1) {
          console.log(`[CPU AI] Only ${remainingTeams.length} team(s) remain, ending auction early`);
          clearInterval(timerInterval);
          try {
            completeLiveAuction(code, auctionId);
          } catch (earlyCompleteError) {
            console.error(`[CPU AI] Error completing auction early ${auctionId}:`, earlyCompleteError);
            console.error(earlyCompleteError.stack);
          }
          return;
        }
        } catch (aiError) {
          console.error(`[CPU AI] Error in AI bidding logic:`, aiError);
          console.error(aiError.stack);
        }
      }
      
      // Timer expired
      if (auction.timer <= 0) {
        console.log(`[timerInterval] Timer expired for ${auctionId}`);
        clearInterval(timerInterval);
        try {
          completeLiveAuction(code, auctionId);
        } catch (completeError) {
          console.error(`[timerInterval] Error completing auction ${auctionId}:`, completeError);
          console.error(completeError.stack);
        }
      }
    }, 1000);
    
    // Store the interval reference
    const auction = drafts[code].draftState.liveAuctions[auctionId];
    if (auction) {
      auction.timerInterval = timerInterval;
    }
  }
  
  // Function to complete a live auction
  function completeLiveAuction(code, auctionId) {
    try {
      console.log(`[completeLiveAuction] Starting completion for ${auctionId}`);
      
      if (!drafts[code] || !drafts[code].draftState || !drafts[code].draftState.liveAuctions) {
        console.error(`[completeLiveAuction] Draft state missing for ${code}`);
        return;
      }
      
      const auction = drafts[code].draftState.liveAuctions[auctionId];
      if (!auction) {
        console.error(`[completeLiveAuction] Auction ${auctionId} not found`);
        return;
      }
      
      auction.active = false;
      
      // Determine winner
      const remainingTeams = auction.tiedTeams.filter(t => !auction.backedOutTeams.includes(t));
      let winner = auction.currentWinner;
      let winningBid = auction.currentBid;
      
      if (remainingTeams.length === 0) {
        // Everyone backed out - pick random from original
        winner = auction.tiedTeams[Math.floor(Math.random() * auction.tiedTeams.length)];
        winningBid = auction.startBid || auction.currentBid;
      } else if (!winner || auction.backedOutTeams.includes(winner)) {
        // Winner backed out or no one raised bid - pick random from remaining
        winner = remainingTeams[Math.floor(Math.random() * remainingTeams.length)];
      }
      
      console.log(`[completeLiveAuction] Auction ended - Winner: ${winner}, Bid: $${winningBid}`);
      
      // Award player to winner
      const winnerTeam = drafts[code].draftState.teams.find(t => t.name === winner);
      const player = { id: auction.playerId, playerName: auction.playerName };
      
      if (winnerTeam) {
        winnerTeam.budget -= winningBid;
        winnerTeam.roster.push(player);
        console.log(`[completeLiveAuction] Awarded ${auction.playerName} to ${winner} for $${winningBid}`);
      } else {
        console.error(`[completeLiveAuction] Winner team not found: ${winner}`);
      }
      
      console.log(`[completeLiveAuction] Emitting liveAuctionEnded to draft_${code}`);
      io.to(`draft_${code}`).emit('liveAuctionEnded', {
        auctionId,
        winner,
        finalBid: winningBid,
        playerId: auction.playerId,
        playerName: auction.playerName
      });
      
        // Check if there are more pending auctions
      if (drafts[code] && drafts[code].draftState && drafts[code].draftState.pendingAuctions && drafts[code].draftState.pendingAuctions.length > 0) {
        console.log(`[completeLiveAuction] ${drafts[code].draftState.pendingAuctions.length} more auctions pending, starting next in 2 seconds...`);
        setTimeout(() => {
          try {
            if (drafts[code] && drafts[code].draftState && drafts[code].draftState.pendingAuctions && drafts[code].draftState.pendingAuctions.length > 0) {
              const nextTie = drafts[code].draftState.pendingAuctions.shift();
              if (nextTie) {
                startServerLiveAuction(code, nextTie);
              } else {
                console.error(`[completeLiveAuction] nextTie was undefined`);
              }
            }
          } catch (nextAuctionError) {
            console.error(`[completeLiveAuction] Error starting next auction:`, nextAuctionError);
            console.error(nextAuctionError.stack);
          }
        }, 2000);
      } else {
        console.log(`[completeLiveAuction] No more auctions, waiting 6 seconds then emitting allMembersAccepted to draft_${code}`);
        // Wait for winner display to show (5 seconds) plus 1 second buffer before starting next round
        setTimeout(() => {
          try {
            if (drafts[code]) {
              io.to(`draft_${code}`).emit('allMembersAccepted');
              console.log(`[completeLiveAuction] allMembersAccepted emitted successfully`);
            }
          } catch (emitError) {
            console.error(`[completeLiveAuction] Error emitting allMembersAccepted:`, emitError);
            console.error(emitError.stack);
          }
        }, 6000);
      }
    } catch (err) {
      console.error(`[completeLiveAuction] ERROR:`, err);
      console.error(err.stack);
    }
  }
  
  // Place bid in live auction
  socket.on('placeLiveAuctionBid', (code, auctionId, bidAmount, cb) => {
    const username = socket.data.username;
    console.log(`[placeLiveAuctionBid] ${username} bid $${bidAmount}`);
    
    const auction = drafts[code]?.draftState?.liveAuctions?.[auctionId];
    if (!auction || !auction.active) {
      if (cb) cb({ ok: false, reason: 'auction_not_found' });
      return;
    }
    
    if (!auction.tiedTeams.includes(username)) {
      if (cb) cb({ ok: false, reason: 'not_in_auction' });
      return;
    }
    
    if (auction.backedOutTeams.includes(username)) {
      if (cb) cb({ ok: false, reason: 'backed_out' });
      return;
    }
    
    if (bidAmount <= auction.currentBid) {
      if (cb) cb({ ok: false, reason: 'bid_too_low' });
      return;
    }
    
    // Check if team has enough budget
    const team = drafts[code].draftState.teams?.find(t => t.name === username);
    if (team && bidAmount > team.budget) {
      console.log(`[placeLiveAuctionBid] ${username} can't afford $${bidAmount} (budget: $${team.budget})`);
      if (cb) cb({ ok: false, reason: 'insufficient_budget' });
      return;
    }
    
    // Update auction
    auction.currentBid = bidAmount;
    auction.currentWinner = username;
    auction.bids[username] = bidAmount;
    auction.timer = 10; // Reset timer
    
    // Broadcast bid
    io.to(`draft_${code}`).emit('liveAuctionBidPlaced', {
      auctionId,
      bidder: username,
      amount: bidAmount
    });
    
    // CPU counter-bidding
    setTimeout(() => {
      if (!auction.active || !drafts[code]) return;
      
      // CPU teams are named "Team X" or "Team XX", human users have other names
      const cpuTeams = auction.tiedTeams.filter(t => {
        if (!drafts[code] || !drafts[code].draftState || !drafts[code].draftState.teams) return false;
        const team = drafts[code].draftState.teams.find(tm => tm.name === t);
        const isCPU = /^Team \d+$/.test(t);
        const notBackedOut = !auction.backedOutTeams.includes(t);
        return team && isCPU && notBackedOut;
      });
      
      console.log(`[CPU Counter-bid] Auction ${auctionId}: ${cpuTeams.length} CPU teams found:`, cpuTeams);
      
      // Skip if no CPU teams in this auction
      if (cpuTeams.length === 0) {
        console.log(`[CPU Counter-bid] No CPU teams in auction, skipping counter-bid logic`);
        return;
      }
      
      cpuTeams.forEach(cpuName => {
        if (!drafts[code] || !drafts[code].draftState) return;
        const cpuTeam = drafts[code].draftState.teams.find(t => t.name === cpuName);
        if (!cpuTeam) return;
        
        // Calculate willingness to bid based on player value and team needs
        const avgValue = player?.avgValue || 1;
        const isTopPlayer = avgValue >= 15;
        const bidProbability = isTopPlayer ? 0.7 : 0.4; // Higher chance for top players
        
        if (Math.random() < bidProbability) {
          // Calculate a reasonable counter-bid based on avgValue
          let minMultiplier = 0.6, maxMultiplier = 1.4;
          if (avgValue >= 40) {
            minMultiplier = 0.9;
            maxMultiplier = 1.1;
          } else if (avgValue >= 20) {
            minMultiplier = 0.7;
            maxMultiplier = 1.3;
          }
          
          const minBid = Math.max(1, Math.round(avgValue * minMultiplier));
          const maxBid = Math.round(avgValue * maxMultiplier);
          const baseCounterBid = Math.round(minBid + Math.random() * (maxBid - minBid));
          const counterBid = Math.max(auction.currentBid + 1, Math.min(baseCounterBid, cpuTeam.budget));
          
          if (counterBid <= cpuTeam.budget && counterBid <= 999) {
            auction.currentBid = counterBid;
            auction.currentWinner = cpuName;
            auction.bids[cpuName] = counterBid;
            auction.timer = 10;
            
            io.to(`draft_${code}`).emit('liveAuctionBidPlaced', {
              auctionId,
              bidder: cpuName,
              amount: counterBid
            });
          }
        }
      });
    }, 1500);
    
    if (cb) cb({ ok: true });
  });
  
  // Back out of auction
  socket.on('backoutLiveAuction', (code, auctionId, cb) => {
    const username = socket.data.username;
    console.log(`[backoutLiveAuction] ${username} backing out`);
    
    const auction = drafts[code]?.draftState?.liveAuctions?.[auctionId];
    if (!auction || !auction.active) {
      if (cb) cb({ ok: false, reason: 'auction_not_found' });
      return;
    }
    
    if (!auction.tiedTeams.includes(username)) {
      if (cb) cb({ ok: false, reason: 'not_in_auction' });
      return;
    }
    
    auction.backedOutTeams.push(username);
    
    // Broadcast backout
    io.to(`draft_${code}`).emit('liveAuctionBackout', {
      auctionId,
      teamName: username
    });
    
    // Check if only one team left
    const remainingTeams = auction.tiedTeams.filter(t => !auction.backedOutTeams.includes(t));
    if (remainingTeams.length === 1) {
      completeLiveAuction(code, auctionId);
    }
    
    if (cb) cb({ ok: true });
  });

  socket.on('pauseDraft', (code, username) => {
    console.log(`[Pause] ${username} paused draft ${code}`);
    // Broadcast pause to all participants in this draft
    io.to(`draft_${code}`).emit('draftPaused', { pausedBy: username });
  });

  socket.on('resumeDraft', (code, username) => {
    console.log(`[Resume] ${username} resumed draft ${code}`);
    // Broadcast resume to all participants in this draft
    io.to(`draft_${code}`).emit('draftResumed', { resumedBy: username });
  });

  socket.on('restartDraft', (code, username) => {
    console.log(`[Restart] ${username} restarted draft ${code}`);
    // Broadcast restart to all participants in this draft
    io.to(`draft_${code}`).emit('draftRestarted', { restartedBy: username });
  });

  // handle socket disconnect: don't remove from members or close draft
  // (user might just be refreshing or having connection issues)
  socket.on('disconnect', () => {
    // Just log the disconnect, don't modify draft state
    const username = socket.data.username;
    const code = socket.data.currentDraft;
    if(username && code){
      console.log(`[disconnect] ${username} disconnected from ${code}`);
    }
  });
});

// Graceful shutdown handler
process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully...');
  closeDatabase();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  closeDatabase();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

server.listen(port, () => console.log(`Server listening on http://localhost:${port}`));
