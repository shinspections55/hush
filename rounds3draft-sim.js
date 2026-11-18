// Temporary localhost helper. Remove this file, its HTML script tag, and its HASHED_ASSETS entry together.
(function () {
  'use strict';

  if (!['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) return;

  const buttons = [];

  function simulateRemainingPhase() {
    if (!players.length) {
      alert('Players are still loading. Try Simulate again in a moment.');
      return;
    }
    if (draftMode === 'complete') {
      alert('This draft is already complete.');
      return;
    }

    const isAuction = draftMode === 'auction';
    const needed = isAuction
      ? teamAuctionPlayers.reduce((sum, count) => sum + Math.max(0, AUCTION_PLAYER_LIMIT - count), 0)
      : Math.max(0, (TOTAL_DRAFT_ROUNDS - currentRound) * TEAM_COUNT + TEAM_COUNT - currentPick + 1);
    if (availablePlayers().length < needed) {
      alert('Cannot simulate this phase: there are not enough available players to fill every remaining slot.');
      return;
    }
    if (isAuction && teamAuctionPlayers.some((count, index) =>
      count < AUCTION_PLAYER_LIMIT && maxAvailableBid(index) < MIN_BID)) {
      alert('Cannot simulate the auction: a team does not have enough budget for its remaining slots.');
      return;
    }

    stopClock();
    stopCpuTicker();
    if (betweenTimer) { clearTimeout(betweenTimer); betweenTimer = null; }
    if (cpuPickTimer) { clearTimeout(cpuPickTimer); cpuPickTimer = null; }
    closeNominateDialog();
    const resolveActiveBid = isAuction && phase === 'bidding' && nominatedPlayer && highestBidder !== null;
    phase = 'simulating';
    wonTeamIndex = null;

    if (isAuction) {
      if (resolveActiveBid) {
        recordAuctionSale(highestBidder, nominatedPlayer, currentBid);
        advanceNomination();
      }
      nominatedPlayer = null;
      currentBid = 0;
      highestBidder = null;
      while (!allRostersFull()) {
        const teamIndex = getNominatorIndex();
        if (teamAuctionPlayers[teamIndex] >= AUCTION_PLAYER_LIMIT) {
          advanceNomination();
          continue;
        }
        const pool = availablePlayers().slice(0, 8);
        const player = pool[Math.floor(Math.random() * pool.length)];
        const price = Math.max(MIN_BID, Math.min(
          maxAvailableBid(teamIndex),
          Math.round(expectedPrice(player) * (0.8 + Math.random() * 0.4))
        ));
        recordAuctionSale(teamIndex, player, price);
        advanceNomination();
      }
      finishAuctionPhase();
    } else {
      while (currentRound <= TOTAL_DRAFT_ROUNDS) {
        const teamIndex = getNominatorIndex();
        recordSnakePick(teamIndex, getAutoPickPlayer(teamIndex));
      }
      finishSnakeDraft();
    }

    buttons.forEach(button => {
      button.textContent = draftMode === 'complete' ? 'Simulation complete' : 'Simulate Draft (Dev)';
      button.disabled = draftMode === 'complete';
    });
  }

  const targets = [
    document.querySelector('.dashboard-header-right'),
    document.querySelector('.r3-dialog-topbar > div')
  ];
  targets.forEach(target => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'r3-btn r3-btn-primary';
    button.textContent = 'Simulate (Dev)';
    button.title = 'Local development only: simulate the remaining auction, then click again to finish the snake draft.';
    button.addEventListener('click', simulateRemainingPhase);
    target.appendChild(button);
    buttons.push(button);
  });
})();
