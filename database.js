const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database file path
const dbPath = path.join(__dirname, 'auction_data.db');

// Create database connection
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database');
    initializeDatabase();
  }
});

// Initialize database tables
function initializeDatabase() {
  // Create auction_results table
  db.run(`
    CREATE TABLE IF NOT EXISTS auction_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      draft_id TEXT NOT NULL,
      round_number INTEGER NOT NULL,
      player_id INTEGER NOT NULL,
      player_name TEXT NOT NULL,
      player_position TEXT NOT NULL,
      winning_team TEXT NOT NULL,
      winning_bid INTEGER NOT NULL,
      second_highest_bid INTEGER,
      second_highest_bidder TEXT,
      auction_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      player_avg_value REAL
    )
  `, (err) => {
    if (err) {
      console.error('Error creating auction_results table:', err.message);
    } else {
      console.log('auction_results table ready');
    }
  });

  // Create player_stats table for rolling averages
  db.run(`
    CREATE TABLE IF NOT EXISTS player_stats (
      player_id INTEGER PRIMARY KEY,
      player_name TEXT NOT NULL,
      position TEXT NOT NULL,
      total_auctions INTEGER DEFAULT 0,
      total_value INTEGER DEFAULT 0,
      avg_value REAL DEFAULT 0,
      min_value INTEGER,
      max_value INTEGER,
      last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) {
      console.error('Error creating player_stats table:', err.message);
    } else {
      console.log('player_stats table ready');
    }
  });

  // Create individual_bids table to track all bids for analysis
  db.run(`
    CREATE TABLE IF NOT EXISTS individual_bids (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      draft_id TEXT NOT NULL,
      round_number INTEGER NOT NULL,
      player_id INTEGER NOT NULL,
      player_name TEXT NOT NULL,
      player_position TEXT NOT NULL,
      bidder_team TEXT NOT NULL,
      bid_amount INTEGER NOT NULL,
      bid_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_winning_bid BOOLEAN DEFAULT FALSE,
      is_second_highest BOOLEAN DEFAULT FALSE
    )
  `, (err) => {
    if (err) {
      console.error('Error creating individual_bids table:', err.message);
    } else {
      console.log('individual_bids table ready');
    }
  });

  // Create indexes for better performance
  db.run(`CREATE INDEX IF NOT EXISTS idx_auction_results_player_id ON auction_results(player_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_auction_results_draft_id ON auction_results(draft_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_player_stats_position ON player_stats(position)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_individual_bids_player_id ON individual_bids(player_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_individual_bids_draft_id ON individual_bids(draft_id)`);
}

// Log auction result
function logAuctionResult(draftId, roundNumber, player, winner, winningBid, secondHighestBid = null, secondHighestBidder = null) {
  return new Promise((resolve, reject) => {
    const sql = `
      INSERT INTO auction_results
      (draft_id, round_number, player_id, player_name, player_position, winning_team, winning_bid, second_highest_bid, second_highest_bidder, player_avg_value)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      draftId,
      roundNumber,
      player.id,
      player.name,
      player.position,
      winner.name,
      winningBid,
      secondHighestBid,
      secondHighestBidder,
      player.avgValue || 0
    ];

    db.run(sql, params, function(err) {
      if (err) {
        console.error('Error logging auction result:', err.message);
        reject(err);
      } else {
        console.log(`[DATABASE] Logged auction: ${player.name} to ${winner.name} for $${winningBid}`);
        // Update player stats after logging
        updatePlayerStats(player.id, player.name, player.position, winningBid, secondHighestBid, player.avgValue)
          .then(() => {
            // Mark winning and second highest bids in individual_bids table
            const promises = [];
            if (winner) {
              promises.push(markWinningBid(draftId, roundNumber, player.id, winner.name));
            }
            if (secondHighestBidder) {
              promises.push(markSecondHighestBid(draftId, roundNumber, player.id, secondHighestBidder));
            }
            return Promise.all(promises);
          })
          .then(() => resolve())
          .catch(reject);
      }
    });
  });
}

// Log individual bid for analysis
function logIndividualBid(draftId, roundNumber, player, bidderTeam, bidAmount, isWinning = false, isSecondHighest = false) {
  return new Promise((resolve, reject) => {
    const sql = `
      INSERT INTO individual_bids
      (draft_id, round_number, player_id, player_name, player_position, bidder_team, bid_amount, is_winning_bid, is_second_highest)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      draftId,
      roundNumber,
      player.id,
      player.name,
      player.position,
      bidderTeam,
      bidAmount,
      isWinning ? 1 : 0,
      isSecondHighest ? 1 : 0
    ];

    db.run(sql, params, function(err) {
      if (err) {
        console.error('Error logging individual bid:', err.message);
        reject(err);
      } else {
        console.log(`[DATABASE] Logged bid: ${bidderTeam} bid $${bidAmount} on ${player.name}${isWinning ? ' (WINNING)' : ''}${isSecondHighest ? ' (2ND HIGHEST)' : ''}`);
        resolve();
      }
    });
  });
}

// Mark a bid as the winning bid
function markWinningBid(draftId, roundNumber, playerId, winnerTeam) {
  return new Promise((resolve, reject) => {
    const sql = `
      UPDATE individual_bids
      SET is_winning_bid = 1
      WHERE draft_id = ? AND round_number = ? AND player_id = ? AND bidder_team = ?
    `;

    db.run(sql, [draftId, roundNumber, playerId, winnerTeam], function(err) {
      if (err) {
        console.error('Error marking winning bid:', err.message);
        reject(err);
      } else {
        console.log(`[DATABASE] Marked winning bid for ${winnerTeam} on player ${playerId}`);
        resolve();
      }
    });
  });
}

// Mark a bid as the second highest bid
function markSecondHighestBid(draftId, roundNumber, playerId, secondHighestTeam) {
  return new Promise((resolve, reject) => {
    const sql = `
      UPDATE individual_bids
      SET is_second_highest = 1
      WHERE draft_id = ? AND round_number = ? AND player_id = ? AND bidder_team = ?
    `;

    db.run(sql, [draftId, roundNumber, playerId, secondHighestTeam], function(err) {
      if (err) {
        console.error('Error marking second highest bid:', err.message);
        reject(err);
      } else {
        console.log(`[DATABASE] Marked second highest bid for ${secondHighestTeam} on player ${playerId}`);
        resolve();
      }
    });
  });
}

// Get auction count for a player
function getPlayerAuctionCount(playerId) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT total_auctions FROM player_stats WHERE player_id = ?`, [playerId], (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row ? row.total_auctions : 0);
      }
    });
  });
}

// Update player statistics with new auction data
function updatePlayerStats(playerId, playerName, position, winningBid, secondHighestBid = null, playerCurrentAV = null) {
  return new Promise((resolve, reject) => {
    // First, get current stats
    db.get(`SELECT * FROM player_stats WHERE player_id = ?`, [playerId], (err, row) => {
      if (err) {
        reject(err);
        return;
      }

      // Calculate market value based on bidding competition
      let marketValue;

      if (secondHighestBid !== null && secondHighestBid > 0) {
        // Competitive auction: use top two bids for accurate market value
        marketValue = (winningBid + secondHighestBid) / 2;
        console.log(`[LEARNING] Competitive auction: ${playerName} - Winning: $${winningBid}, Second: $${secondHighestBid}, Market: $${marketValue.toFixed(1)}`);
      } else {
        // Catch bid scenario: player won with minimal competition
        // Include catch bids as they represent successful strategies, but use reasonable minimum
        const minReasonableBid = playerCurrentAV ? Math.max(playerCurrentAV * 0.3, 1) : 1; // At least 30% of current AV or $1
        marketValue = Math.max(winningBid, minReasonableBid);
        console.log(`[LEARNING] Catch bid success: ${playerName} - Won for $${winningBid}, Market value: $${marketValue.toFixed(1)} (min threshold: $${minReasonableBid.toFixed(1)})`);
      }

      let totalAuctions = 1;
      let totalValue = marketValue;
      let minValue = marketValue;
      let maxValue = marketValue;

      if (row) {
        // Update existing stats
        totalAuctions = row.total_auctions + 1;
        totalValue = row.total_value + marketValue;
        minValue = Math.min(row.min_value || marketValue, marketValue);
        maxValue = Math.max(row.max_value || marketValue, marketValue);
      }

      const avgValue = totalValue / totalAuctions;

      const sql = row ?
        `UPDATE player_stats SET total_auctions = ?, total_value = ?, avg_value = ?, min_value = ?, max_value = ?, last_updated = CURRENT_TIMESTAMP WHERE player_id = ?` :
        `INSERT INTO player_stats (player_id, player_name, position, total_auctions, total_value, avg_value, min_value, max_value) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

      const params = row ?
        [totalAuctions, totalValue, avgValue, minValue, maxValue, playerId] :
        [playerId, playerName, position, totalAuctions, totalValue, avgValue, minValue, maxValue];

      db.run(sql, params, function(err) {
        if (err) {
          console.error('Error updating player stats:', err.message);
          reject(err);
        } else {
          console.log(`[DATABASE] Updated stats for ${playerName}: ${totalAuctions} auctions, market value $${marketValue.toFixed(1)}, avg $${avgValue.toFixed(1)}`);
          resolve();
        }
      });
    });
  });
}

// Get updated AV for a player
function getPlayerAV(playerId) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT avg_value FROM player_stats WHERE player_id = ?`, [playerId], (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row ? row.avg_value : null);
      }
    });
  });
}

// Get all player stats for analysis
function getAllPlayerStats() {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM player_stats ORDER BY total_auctions DESC, avg_value DESC`, [], (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

// Get auction history for a player
function getPlayerAuctionHistory(playerId, limit = 10) {
  return new Promise((resolve, reject) => {
    db.all(`
      SELECT draft_id, round_number, winning_bid, auction_timestamp
      FROM auction_results
      WHERE player_id = ?
      ORDER BY auction_timestamp DESC
      LIMIT ?
    `, [playerId, limit], (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

// Close database connection
function closeDatabase() {
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err.message);
    } else {
      console.log('Database connection closed');
    }
  });
}

// Bulk log individual bids for performance optimization
function bulkLogIndividualBids(bidDataArray) {
  return new Promise((resolve, reject) => {
    if (!bidDataArray || bidDataArray.length === 0) {
      resolve();
      return;
    }

    const placeholders = bidDataArray.map(() => '(?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
    const values = [];

    bidDataArray.forEach(bidData => {
      values.push(
        bidData.draftId,
        bidData.roundNumber,
        bidData.player.id,
        bidData.player.name,
        bidData.player.position,
        bidData.bidderTeam,
        bidData.bidAmount,
        bidData.isWinning ? 1 : 0,
        bidData.isSecondHighest ? 1 : 0
      );
    });

    const sql = `
      INSERT INTO individual_bids
      (draft_id, round_number, player_id, player_name, player_position, bidder_team, bid_amount, is_winning, is_second_highest)
      VALUES ${placeholders}
    `;

    db.run(sql, values, function(err) {
      if (err) {
        console.error('[bulkLogIndividualBids] Error:', err);
        reject(err);
      } else {
        console.log(`[bulkLogIndividualBids] Successfully inserted ${bidDataArray.length} bids`);
        resolve();
      }
    });
  });
}

module.exports = {
  logAuctionResult,
  logIndividualBid,
  bulkLogIndividualBids,
  markWinningBid,
  markSecondHighestBid,
  getPlayerAV,
  getPlayerAuctionCount,
  getAllPlayerStats,
  getPlayerAuctionHistory,
  closeDatabase
};