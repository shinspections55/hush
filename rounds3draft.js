// 3 Round Auction Draft
// Rounds 1-3: live $100 salary-cap auction, 3 players per team, then rounds 4+ switch to snake.
// 30s nomination clock, 10s bid clock that resets on every raise. CPU teams bid with a baseline logic.

const AUCTION_BUDGET = 100;
const AUCTION_PLAYER_LIMIT = 3;
const AUCTION_ROUNDS = 3;
const MIN_BID = 1;
const NOMINATION_SECONDS = 30;
const BID_SECONDS = 10;
const BETWEEN_LOTS_MS = 2200;

const lobbyCode = decodeURIComponent((location.pathname.match(/^\/rounds3draft\/([^/]+)/) || [])[1] || '') || null;
const STORAGE_KEY = `hushRounds3DraftV2:${lobbyCode || 'local'}`;

// ---------- Lobby context ----------

function readLobby() {
  let members = [];
  let capacity = 0;
  if (lobbyCode) {
    try {
      const drafts = JSON.parse(localStorage.getItem('drafts') || '{}');
      const draft = drafts[lobbyCode] || {};
      capacity = Number(draft.capacity) || 0;
      if (Array.isArray(draft.members)) {
        members = draft.members
          .map(member => typeof member === 'string' ? member : member && (member.username || member.name))
          .filter(Boolean)
          .map(String);
      }
    } catch (_error) { /* no lobby data */ }
  }
  const count = Math.min(14, Math.max(4, capacity || members.length || 12));
  return { members, count };
}

const lobby = readLobby();
const TEAM_COUNT = lobby.count;
const username = (sessionStorage.getItem('username') || '').trim();

let teams = Array.from({ length: TEAM_COUNT }, (_, index) =>
  lobby.members[index] || `CPU ${index + 1}`);
let humanIndex = teams.findIndex(name => username && name.toLowerCase() === username.toLowerCase());
if (humanIndex < 0) humanIndex = 0;
if (!lobby.members.length && username) teams[humanIndex] = username;

// ---------- Draft state ----------

let players = [];
let teamBudgets = Array(TEAM_COUNT).fill(AUCTION_BUDGET);
let teamAuctionPlayers = Array(TEAM_COUNT).fill(0);
let teamAuctionSpent = Array(TEAM_COUNT).fill(0);
let teamRosters = Array.from({ length: TEAM_COUNT }, () => []);
let draftedPlayers = [];

let currentRound = 1;
let currentPick = 1; // nomination slot, continues independently of who wins
let draftMode = 'auction';

let phase = 'idle'; // idle | nominating | bidding | between | done
let nominatedPlayer = null;
let currentBid = 0;
let highestBidder = null;

let clockEndsAt = 0;
let clockTimer = null;
let cpuTicker = null;
let betweenTimer = null;
let lastBidAt = 0;
let nextBidGap = 0;

// After any bid (or a fresh nomination), CPUs wait 1-2.8s before reacting.
function bumpBidPacing() {
  lastBidAt = Date.now();
  nextBidGap = 1000 + Math.random() * 1800;
}

let searchTerm = '';
let positionFilter = 'ALL';
let valueScale = 1;
let wonTeamIndex = null;
let playerRankById = new Map();

// CPUs only seriously chase the top of the board - 36 slots get filled, so
// reaching past the top ~50 never makes sense in the auction rounds.
const CPU_TARGET_POOL = 50;

// Spender archetypes: a couple of whales who will pay $60-70 for one stud,
// a few star hunters at $50-60, and the rest spreading money (~2 at $40-45).
function buildCpuPersonalities() {
  const whales = Math.max(1, Math.round(TEAM_COUNT / 6));
  const stars = Math.max(2, Math.round(TEAM_COUNT / 3.5));
  const pool = [];
  for (let i = 0; i < TEAM_COUNT; i++) {
    if (i < whales) pool.push({ archetype: 'whale', maxSingle: 60 + Math.random() * 10 });
    else if (i < whales + stars) pool.push({ archetype: 'star', maxSingle: 50 + Math.random() * 10 });
    else pool.push({ archetype: 'balanced', maxSingle: 40 + Math.random() * 5 });
  }
  // Shuffle so nobody can guess which seat is the whale.
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.map(entry => ({
    ...entry,
    eagerness: 0.85 + Math.random() * 0.45,
    jumpiness: Math.random()
  }));
}

const cpuPersonalities = buildCpuPersonalities();

// ---------- Audio (same tone recipes as the silent draft) ----------

let draftAudioContext = null;
let lastCountdownCueKey = '';
let lotCounter = 0;

function getDraftAudioContext() {
  try {
    if (!draftAudioContext) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      draftAudioContext = new Ctx();
    }
    return draftAudioContext;
  } catch (_error) { return null; }
}

function playDraftTone(frequency, durationSeconds, volume) {
  const ctx = getDraftAudioContext();
  if (!ctx) return;

  const scheduleTone = () => {
    try {
      if (ctx.state !== 'running') return;
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      const now = ctx.currentTime;
      gainNode.gain.setValueAtTime(volume, now);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + durationSeconds);
      oscillator.start(now);
      oscillator.stop(now + durationSeconds);
    } catch (_error) { /* ignore audio errors */ }
  };

  if (ctx.state === 'suspended') {
    ctx.resume().then(scheduleTone).catch(() => {});
    return;
  }
  scheduleTone();
}

// Light tick whenever any bid lands.
function playBidTick() {
  playDraftTone(1200 + Math.random() * 200, 0.05, 0.08);
}

// Countdown cues once the bid clock drops under 5 seconds.
function playCountdownCue(second) {
  if (second > 5 || second < 1) return;
  const cueKey = `${lotCounter}-${second}`;
  if (cueKey === lastCountdownCueKey) return;
  lastCountdownCueKey = cueKey;

  if (second === 5) {
    playDraftTone(960, 0.11, 0.18);
    setTimeout(() => playDraftTone(960, 0.11, 0.18), 130);
  } else if (second <= 3) {
    playDraftTone(1040, 0.12, 0.14);
  } else {
    playDraftTone(820, 0.09, 0.1);
  }
}

// Success chime when YOU win the bid - same dual tone as the silent draft submit sound.
function playWinSound() {
  const ctx = getDraftAudioContext();
  if (!ctx) return;
  const schedule = () => {
    try {
      if (ctx.state !== 'running') return;
      const oscillator1 = ctx.createOscillator();
      const oscillator2 = ctx.createOscillator();
      const gainNode = ctx.createGain();
      oscillator1.connect(gainNode);
      oscillator2.connect(gainNode);
      gainNode.connect(ctx.destination);
      oscillator1.frequency.value = 800;
      oscillator2.frequency.value = 1000;
      oscillator1.type = 'sine';
      oscillator2.type = 'sine';
      const now = ctx.currentTime;
      gainNode.gain.setValueAtTime(0.15, now);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      oscillator1.start(now);
      oscillator2.start(now + 0.1);
      oscillator1.stop(now + 0.3);
      oscillator2.stop(now + 0.4);
    } catch (_error) { /* ignore audio errors */ }
  };
  if (ctx.state === 'suspended') { ctx.resume().then(schedule).catch(() => {}); return; }
  schedule();
}

// Light auctioneer gavel: a low thump plus a short woody crack, tapped twice.
function playGavelKnock(delayMs, volume) {
  const ctx = getDraftAudioContext();
  if (!ctx) return;
  const schedule = () => {
    try {
      if (ctx.state !== 'running') return;
      const start = ctx.currentTime + delayMs / 1000;

      // Low thump - fast pitch drop like a mallet hit.
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(220, start);
      osc.frequency.exponentialRampToValueAtTime(70, start + 0.09);
      gain.gain.setValueAtTime(volume, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.13);
      osc.start(start);
      osc.stop(start + 0.14);

      // Woody crack - a tiny filtered noise burst.
      const bufferSize = Math.floor(ctx.sampleRate * 0.03);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const bandpass = ctx.createBiquadFilter();
      bandpass.type = 'bandpass';
      bandpass.frequency.value = 1100;
      bandpass.Q.value = 1.2;
      const noiseGain = ctx.createGain();
      noise.connect(bandpass);
      bandpass.connect(noiseGain);
      noiseGain.connect(ctx.destination);
      noiseGain.gain.setValueAtTime(volume * 0.8, start);
      noiseGain.gain.exponentialRampToValueAtTime(0.0001, start + 0.05);
      noise.start(start);
    } catch (_error) { /* ignore audio errors */ }
  };
  if (ctx.state === 'suspended') { ctx.resume().then(schedule).catch(() => {}); return; }
  schedule();
}

// Classic double tap when a lot is sold.
function playGavelSound() {
  playGavelKnock(0, 0.18);
  playGavelKnock(170, 0.13);
}

// ---------- Elements ----------

const draftBoard = document.getElementById('draftBoard');
const playerPool = document.getElementById('playerPool');
const roundInfo = document.getElementById('r3RoundInfo');
const nominatorInfo = document.getElementById('r3NominatorInfo');
const idleState = document.getElementById('r3IdleState');
const auctionState = document.getElementById('r3AuctionState');
const nominatingState = document.getElementById('r3NominatingState');
const nominatingText = document.getElementById('r3NominatingText');
const modeNotice = document.getElementById('r3ModeNotice');
const bidControls = document.getElementById('r3BidControls');
const bidHint = document.getElementById('r3BidHint');
const clockEl = document.getElementById('r3Clock');
const nominateDialog = document.getElementById('r3NominateDialog');
const nominateClockEl = document.getElementById('r3NominateClock');

if (lobbyCode) document.getElementById('r3LobbyCode').textContent = `Lobby ${lobbyCode}`;

// ---------- Persistence (committed sales only) ----------

function saveDraftState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      teams, teamBudgets, teamAuctionPlayers, teamAuctionSpent, teamRosters,
      draftedPlayers, currentRound, currentPick, draftMode
    }));
  } catch (_error) { /* storage unavailable */ }
}

function restoreDraftState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const saved = JSON.parse(raw);
    if (!saved || !Array.isArray(saved.teamBudgets) || saved.teamBudgets.length !== TEAM_COUNT) return false;
    teams = saved.teams || teams;
    teamBudgets = saved.teamBudgets;
    teamAuctionPlayers = saved.teamAuctionPlayers || teamAuctionPlayers;
    teamAuctionSpent = saved.teamAuctionSpent || teamAuctionSpent;
    teamRosters = saved.teamRosters || teamRosters;
    draftedPlayers = saved.draftedPlayers || [];
    currentRound = saved.currentRound || 1;
    currentPick = saved.currentPick || 1;
    draftMode = saved.draftMode || 'auction';
    return draftedPlayers.length > 0 || currentRound > 1 || currentPick > 1;
  } catch (_error) { return false; }
}

// ---------- Players ----------

async function loadPlayers() {
  const files = ['/qb.json', '/rb.json', '/wr.json', '/te.json', '/k.json', '/def.json'];
  const lists = await Promise.all(files.map(async file => {
    try {
      const response = await fetch(file);
      if (!response.ok) return [];
      return await response.json();
    } catch (_error) { return []; }
  }));
  players = lists.flat()
    .filter(player => player && player.name)
    .map((player, index) => ({
      id: `${player.position || 'NA'}-${index}-${player.name.replace(/\s+/g, '')}`,
      name: player.name,
      position: String(player.position || '').toUpperCase(),
      team: player.team || '',
      avgValue: Number(player.avgValue) || 0
    }))
    .sort((a, b) => b.avgValue - a.avgValue);

  // Scale $200/14-player average values down to this auction's economy:
  // the league's total auction money spread across the draftable player pool.
  const slotCount = TEAM_COUNT * AUCTION_PLAYER_LIMIT;
  const topValues = players.slice(0, slotCount).reduce((sum, player) => sum + Math.max(player.avgValue, 1), 0);
  valueScale = topValues > 0 ? (TEAM_COUNT * AUCTION_BUDGET * 0.94) / topValues : 1;
  playerRankById = new Map(players.map((player, index) => [player.id, index]));
}

function availablePlayers() {
  return players.filter(player => !draftedPlayers.includes(player.id));
}

// ---------- Auction math ----------

function remainingSlots(teamIndex) {
  return AUCTION_PLAYER_LIMIT - teamAuctionPlayers[teamIndex];
}

// Max a team can bid while reserving $1 for each other unfilled roster spot.
function maxAvailableBid(teamIndex) {
  const remainingPlayers = remainingSlots(teamIndex);
  if (remainingPlayers <= 0) return 0;
  return teamBudgets[teamIndex] - (remainingPlayers - 1);
}

// Market estimate for this auction's economy, and a realistic opening-bid suggestion.
function expectedPrice(player) {
  return Math.max(1, Math.round(Math.max(player.avgValue, 1) * valueScale));
}

function suggestedOpeningBid(player) {
  // Suggest opening around 70% of expected price - a $50 player opens near $35.
  return Math.max(1, Math.round(expectedPrice(player) * 0.7));
}

function getNominatorIndex() {
  return (currentPick - 1) % TEAM_COUNT;
}

function allRostersFull() {
  return teamAuctionPlayers.every(count => count >= AUCTION_PLAYER_LIMIT);
}

// ---------- CPU baseline logic ----------

function cpuMaxPrice(teamIndex, player) {
  const personality = cpuPersonalities[teamIndex];
  const budgetCap = maxAvailableBid(teamIndex);
  if (budgetCap <= 0) return 0;

  const slotsLeft = remainingSlots(teamIndex);
  const rank = playerRankById.has(player.id) ? playerRankById.get(player.id) : CPU_TARGET_POOL;

  // Outside the top 50: a body, not a target. A couple bucks early,
  // a touch more in round 3 if slots still need filling.
  if (rank >= CPU_TARGET_POOL) {
    const filler = currentRound >= AUCTION_ROUNDS && slotsLeft > 0 ? 5 : 2;
    return Math.min(filler, budgetCap);
  }

  // Archetype ceiling: what this team will pay for any single player.
  let cap = Math.min(personality.maxSingle, budgetCap);

  // Value sanity with a generous market premium - studs can overshoot,
  // but nobody blows whale money on the 45th-ranked player.
  const value = expectedPrice(player);
  cap = Math.min(cap, value * 1.25 + 6);

  // Saving money does not help: once round 2+ hits, surplus cash loosens the cap.
  const bankedPerSlot = teamBudgets[teamIndex] / Math.max(slotsLeft, 1);
  if (currentRound >= 2 && bankedPerSlot > cap) {
    cap = Math.min(budgetCap, (cap + bankedPerSlot) / 2);
  }

  // Round 3 desperation: unfilled slots must get bodies.
  if (currentRound >= AUCTION_ROUNDS && slotsLeft > 0) {
    cap = Math.max(cap, Math.min(budgetCap, value * 1.5, bankedPerSlot));
  }

  return Math.max(0, Math.min(Math.floor(cap), budgetCap));
}

function cpuConsiderBids() {
  if (phase !== 'bidding' || !nominatedPlayer) return;
  // Let a beat pass between bids so the room feels like it is processing the price.
  if (Date.now() - lastBidAt < nextBidGap) return;
  for (let teamIndex = 0; teamIndex < TEAM_COUNT; teamIndex++) {
    if (teamIndex === humanIndex || teamIndex === highestBidder) continue;
    if (teamAuctionPlayers[teamIndex] >= AUCTION_PLAYER_LIMIT) continue;

    const personality = cpuPersonalities[teamIndex];
    const cap = cpuMaxPrice(teamIndex, nominatedPlayer);
    const nextBid = currentBid + 1;
    if (nextBid > cap) continue;

    // The further below their ceiling, the more likely they bid this tick.
    const headroom = (cap - currentBid) / Math.max(cap, 1);
    let chance = 0.1 + headroom * 0.45 * personality.eagerness;

    // Chase the board: top-ranked players get extra pursuit.
    const nomRank = playerRankById.has(nominatedPlayer.id) ? playerRankById.get(nominatedPlayer.id) : CPU_TARGET_POOL;
    if (nomRank < 12) chance += 0.12;
    else if (nomRank < 25) chance += 0.06;

    // Cheap filler urgency: never let a $1-2 body walk when slots need filling.
    if (currentBid <= 2 && remainingSlots(teamIndex) > 0 && currentRound >= 2) chance += 0.2;

    if (Math.random() < chance) {
      const headroomDollars = cap - currentBid;
      let raise;
      const roll = Math.random();
      if (roll < 0.45 || headroomDollars <= 2) {
        raise = 1;
      } else if (roll < 0.8) {
        raise = Math.min(2 + Math.floor(Math.random() * 2), headroomDollars); // $2-3 bump
      } else {
        // Confident jump toward their ceiling, scaled by how much room is left.
        const jump = 2 + Math.floor(headroomDollars * (0.15 + personality.jumpiness * 0.2));
        raise = Math.min(jump, headroomDollars);
      }
      placeBid(teamIndex, Math.max(raise, 1), true);
      return; // one CPU bid per tick keeps the room human-paced
    }
  }
}

function cpuChooseNomination(teamIndex) {
  const pool = availablePlayers();
  if (!pool.length) return null;
  const top = pool.slice(0, 8);
  // Usually nominate the best player; sometimes shake the room with a value pick.
  const player = Math.random() < 0.72 ? top[0] : top[Math.floor(Math.random() * top.length)];
  // Open somewhere between 55% and 80% of the expected price - realistic, not a steal.
  let openBid = Math.max(MIN_BID, Math.round(expectedPrice(player) * (0.55 + Math.random() * 0.25)));
  // Never open above what this CPU is actually willing to pay - it may get stuck with the bid.
  const ownCap = cpuMaxPrice(teamIndex, player);
  if (ownCap >= MIN_BID) openBid = Math.min(openBid, ownCap);
  return { player, openBid };
}

// ---------- Clocks ----------

function startClock(seconds, onExpire) {
  stopClock();
  clockEndsAt = Date.now() + seconds * 1000;
  clockTimer = setInterval(() => {
    const remaining = Math.max(0, clockEndsAt - Date.now());
    updateClockDisplays(remaining);
    if (remaining <= 0) {
      stopClock();
      onExpire();
    }
  }, 100);
  updateClockDisplays(seconds * 1000);
}

function stopClock() {
  if (clockTimer) { clearInterval(clockTimer); clockTimer = null; }
}

function resetBidClock() {
  clockEndsAt = Date.now() + BID_SECONDS * 1000;
}

function updateClockDisplays(remainingMs) {
  const seconds = Math.ceil(remainingMs / 1000);
  if (phase === 'bidding') {
    clockEl.textContent = seconds;
    clockEl.parentElement.classList.toggle('is-urgent', seconds <= 3);
    playCountdownCue(seconds);
  } else if (phase === 'nominating') {
    nominateClockEl.textContent = seconds;
    nominateClockEl.parentElement.classList.toggle('is-urgent', seconds <= 10);
  }
}

function startCpuTicker() {
  stopCpuTicker();
  cpuTicker = setInterval(cpuConsiderBids, 400);
}

function stopCpuTicker() {
  if (cpuTicker) { clearInterval(cpuTicker); cpuTicker = null; }
}

// ---------- Flow ----------

function startDraft() {
  // Created on a user gesture so the browser allows audio playback.
  const ctx = getDraftAudioContext();
  if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
  idleState.classList.add('hidden');
  beginNomination();
}

function beginNomination() {
  if (draftMode === 'snake' || currentRound > AUCTION_ROUNDS || allRostersFull()) {
    finishAuctionPhase();
    return;
  }
  phase = 'nominating';
  nominatedPlayer = null;
  currentBid = 0;
  highestBidder = null;
  auctionState.classList.add('hidden');
  updateRoundInfo();
  renderDraftBoard();

  const nominator = getNominatorIndex();
  // Show who is on the clock to nominate; stays up until the nomination lands.
  nominatingText.textContent = nominator === humanIndex
    ? `${teams[nominator]}, you're nominating`
    : `${teams[nominator]} is nominating`;
  nominatingState.classList.remove('hidden');

  if (nominator === humanIndex) {
    openNominateDialog();
    startClock(NOMINATION_SECONDS, () => {
      closeNominateDialog();
      const best = availablePlayers()[0];
      if (best) nominatePlayer(best.id, suggestedOpeningBid(best)); else finishAuctionPhase();
    });
  } else {
    // Hold the "is nominating" card for a beat so the room can read it.
    const delay = 2600 + Math.random() * 600;
    startClock(NOMINATION_SECONDS, () => {});
    setTimeout(() => {
      if (phase !== 'nominating') return;
      const choice = cpuChooseNomination(nominator);
      if (choice) nominatePlayer(choice.player.id, choice.openBid); else finishAuctionPhase();
    }, delay);
  }
}

function nominatePlayer(playerId, openingBid) {
  if (phase !== 'nominating') return;
  const player = players.find(entry => entry.id === playerId);
  if (!player || draftedPlayers.includes(player.id)) return;

  closeNominateDialog();
  stopClock();
  lotCounter++;
  wonTeamIndex = null;
  nominatingState.classList.add('hidden');

  nominatedPlayer = player;
  const nominator = getNominatorIndex();
  const requestedOpen = Math.max(MIN_BID, Math.floor(Number(openingBid) || MIN_BID));

  if (teamAuctionPlayers[nominator] < AUCTION_PLAYER_LIMIT && maxAvailableBid(nominator) >= MIN_BID) {
    // Nominator owns the opening bid, capped at what they can actually pay.
    currentBid = Math.min(requestedOpen, maxAvailableBid(nominator));
    highestBidder = nominator;
  } else {
    // Full-roster nominator sets an asking price they cannot hold themselves.
    currentBid = requestedOpen - 1;
    highestBidder = null;
  }

  phase = 'bidding';
  auctionState.classList.remove('hidden');
  bumpBidPacing();
  updateNominationBox();
  updateBidControls();
  startClock(BID_SECONDS, onBidClockExpire);
  startCpuTicker();
}

function placeBid(teamIndex, raise = 1, fromCpu = false) {
  if (phase !== 'bidding' || !nominatedPlayer) return;

  if (teamAuctionPlayers[teamIndex] >= AUCTION_PLAYER_LIMIT) {
    if (!fromCpu) alert('Your team already has 3 auction players!');
    return;
  }

  const availableBudget = maxAvailableBid(teamIndex);
  const newBid = currentBid + raise;

  if (newBid <= currentBid) return;
  if (newBid > availableBudget) {
    if (!fromCpu) alert('Not enough budget for this bid!');
    return;
  }

  currentBid = newBid;
  highestBidder = teamIndex;
  resetBidClock(); // every raise restarts the 10 second countdown
  bumpBidPacing();
  playBidTick();
  updateNominationBox();
  updateBidControls();
  renderDraftBoard();
}

function onBidClockExpire() {
  stopCpuTicker();
  if (highestBidder !== null) {
    finalizeSale();
  } else {
    // Nobody could open a bid: the player returns to the pool, the slot advances.
    nominatedPlayer = null;
    advanceNomination();
    scheduleNextLot();
  }
}

function finalizeSale() {
  if (!nominatedPlayer || highestBidder === null) return;

  const winningTeam = highestBidder;
  teamBudgets[winningTeam] -= currentBid;
  teamAuctionSpent[winningTeam] += currentBid;
  teamAuctionPlayers[winningTeam]++;
  draftedPlayers.push(nominatedPlayer.id);
  teamRosters[winningTeam].push({ ...nominatedPlayer, price: currentBid, round: currentRound });

  wonTeamIndex = winningTeam;
  playGavelSound();
  // Your win chime follows the gavel so both land clearly.
  if (winningTeam === humanIndex) setTimeout(playWinSound, 380);

  announceSale(winningTeam, nominatedPlayer, currentBid);

  nominatedPlayer = null;
  currentBid = 0;
  highestBidder = null;

  advanceNomination();
  saveDraftState();
  renderDraftBoard();
  scheduleNextLot();
}

function advanceNomination() {
  currentPick++;
  if (currentPick > TEAM_COUNT) {
    currentRound++;
    currentPick = 1;
    if (currentRound > AUCTION_ROUNDS) draftMode = 'snake';
  }
  updateRoundInfo();
}

function scheduleNextLot() {
  phase = 'between';
  updateBidControls();
  if (betweenTimer) clearTimeout(betweenTimer);
  betweenTimer = setTimeout(() => beginNomination(), BETWEEN_LOTS_MS);
}

function announceSale(teamIndex, player, price) {
  document.getElementById('r3NomName').textContent = player.name;
  document.getElementById('r3NomMeta').textContent = `${player.position} · ${player.team}`;
  document.getElementById('r3BidAmount').textContent = `$${price}`;
  const bidderEl = document.getElementById('r3HighBidder');
  const youWon = teamIndex === humanIndex;
  bidderEl.textContent = youWon ? 'SOLD to you!' : `SOLD to ${teams[teamIndex]}`;
  bidderEl.classList.toggle('is-your-win', youWon);
  clockEl.textContent = '0';
}

function finishAuctionPhase() {
  phase = 'done';
  draftMode = 'snake';
  stopClock();
  stopCpuTicker();
  auctionState.classList.add('hidden');
  idleState.classList.add('hidden');
  nominatingState.classList.add('hidden');
  modeNotice.textContent = 'Auction complete! Rounds 4+ switch to the snake draft - coming in the next update. Auction rosters and budgets are kept.';
  modeNotice.classList.remove('hidden');
  updateRoundInfo();
  renderDraftBoard();
  saveDraftState();
}

// ---------- UI ----------

function updateRoundInfo() {
  if (draftMode === 'snake') {
    roundInfo.textContent = `Round ${Math.max(currentRound, AUCTION_ROUNDS + 1)} · Snake draft`;
    nominatorInfo.textContent = '';
    return;
  }
  const nominator = getNominatorIndex();
  roundInfo.textContent = `Round ${currentRound} · Pick ${currentRound}.${String(currentPick).padStart(2, '0')}`;
  nominatorInfo.textContent = phase === 'bidding'
    ? `Nominated by ${teams[nominator]}`
    : `${teams[nominator]} nominates${nominator === humanIndex ? ' - that\u2019s you!' : ''}`;
}

function updateNominationBox() {
  if (!nominatedPlayer) return;
  document.getElementById('r3NomName').textContent = nominatedPlayer.name;
  document.getElementById('r3NomMeta').textContent = `${nominatedPlayer.position} · ${nominatedPlayer.team} · AV $${nominatedPlayer.avgValue}`;
  document.getElementById('r3BidAmount').textContent = `$${currentBid}`;
  const bidderEl = document.getElementById('r3HighBidder');
  bidderEl.textContent = highestBidder === null ? 'No bids yet' : teams[highestBidder];
  bidderEl.classList.remove('is-your-win');
  updateRoundInfo();
}

function updateBidControls() {
  const canBid = phase === 'bidding'
    && nominatedPlayer
    && teamAuctionPlayers[humanIndex] < AUCTION_PLAYER_LIMIT
    && highestBidder !== humanIndex
    && currentBid + 1 <= maxAvailableBid(humanIndex);
  bidControls.classList.toggle('hidden', phase !== 'bidding' || teamAuctionPlayers[humanIndex] >= AUCTION_PLAYER_LIMIT);
  document.getElementById('r3BidPlusBtn').disabled = !canBid;
  document.getElementById('r3BidCustomBtn').disabled = !canBid;
  if (phase !== 'bidding') return;
  if (highestBidder === humanIndex) {
    bidHint.textContent = 'You are the high bidder';
  } else {
    bidHint.textContent = `Your max bid: $${Math.max(maxAvailableBid(humanIndex), 0)}`;
  }
}

// Short display name for roster slots: "Ja'Marr Chase" -> "J.Chase", suffix-aware ("James Cook III" -> "J.Cook").
function shortPlayerName(player) {
  const parts = String(player.name).trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return player.name;
  if (player.position === 'DEF') return parts[parts.length - 1]; // "Seattle Seahawks" -> "Seahawks"
  const suffixes = new Set(['jr', 'jr.', 'sr', 'sr.', 'ii', 'iii', 'iv', 'v']);
  let index = parts.length - 1;
  while (index > 1 && suffixes.has(parts[index].toLowerCase())) index--;
  return `${parts[0][0]}.${parts[index]}`;
}

function renderDraftBoard() {
  draftBoard.style.setProperty('--r3-team-count', TEAM_COUNT);
  draftBoard.innerHTML = '';
  const nominator = getNominatorIndex();

  teams.forEach((team, index) => {
    const col = document.createElement('div');
    col.className = 'r3-team-col';
    if (index === humanIndex) col.classList.add('is-you');
    if (draftMode === 'auction' && phase !== 'done' && index === nominator && !nominatedPlayer) col.classList.add('is-nominating');
    if (phase === 'bidding' && index === highestBidder) col.classList.add('is-high-bidder');
    if (wonTeamIndex === index) col.classList.add(index === humanIndex ? 'is-won-you' : 'is-won');

    const slots = Array.from({ length: AUCTION_PLAYER_LIMIT }, (_, slot) => {
      const player = teamRosters[index][slot];
      if (!player) return '<li class="r3-roster-empty">Open slot</li>';
      return `<li><span class="r3-roster-pos">${player.position}</span><span class="r3-roster-name" title="${player.name}">${shortPlayerName(player)}</span><span class="r3-roster-price">$${player.price}</span></li>`;
    }).join('');

    col.innerHTML = `
      <h3 title="${team}">${team}${index === humanIndex ? ' <small>(you)</small>' : ''}</h3>
      <div class="team-budget">$<span id="budget-${index}">${teamBudgets[index]}</span></div>
      <div class="team-auction-count"><span id="count-${index}">${teamAuctionPlayers[index]}</span>/${AUCTION_PLAYER_LIMIT} players</div>
      <ul class="r3-roster">${slots}</ul>
    `;
    draftBoard.appendChild(col);
  });
}

function renderPlayerPool() {
  const available = availablePlayers().filter(player => {
    if (positionFilter !== 'ALL' && player.position !== positionFilter) return false;
    if (searchTerm && !`${player.name} ${player.team}`.toLowerCase().includes(searchTerm)) return false;
    return true;
  });

  playerPool.innerHTML = '';
  available.slice(0, 200).forEach(player => {
    const row = document.createElement('div');
    row.className = 'r3-player-row';
    row.innerHTML = `
      <span class="r3-player-pos">${player.position}</span>
      <span class="r3-player-name">${player.name}</span>
      <span class="r3-player-team">${player.team}</span>
      <span class="r3-player-av" title="Estimated price in this auction">$${expectedPrice(player)}</span>
      <input class="r3-open-bid" type="number" min="1" value="${suggestedOpeningBid(player)}" title="Opening bid (suggested - edit freely)" aria-label="Opening bid for ${player.name}">
      <button class="r3-nominate-btn r3-btn r3-btn-bid" data-player="${player.id}" type="button">Nominate</button>
    `;
    playerPool.appendChild(row);
  });

  if (!available.length) {
    playerPool.innerHTML = '<div class="r3-pool-empty">No players match this filter.</div>';
  }
}

function openNominateDialog() {
  searchTerm = '';
  document.getElementById('r3Search').value = '';
  renderPlayerPool();
  if (!nominateDialog.open) nominateDialog.showModal();
}

function closeNominateDialog() {
  if (nominateDialog.open) nominateDialog.close();
}

// ---------- Events ----------

document.getElementById('r3StartBtn').addEventListener('click', startDraft);

document.getElementById('r3BidPlusBtn').addEventListener('click', () => placeBid(humanIndex, 1));

document.getElementById('r3BidCustomBtn').addEventListener('click', () => {
  const input = document.getElementById('r3CustomBid');
  const raise = Math.floor(Number(input.value));
  if (!raise || raise < 1) { alert('Enter a raise of at least $1.'); return; }
  placeBid(humanIndex, raise);
  input.value = '';
});

document.getElementById('r3CustomBid').addEventListener('keydown', event => {
  if (event.key === 'Enter') document.getElementById('r3BidCustomBtn').click();
});

playerPool.addEventListener('click', event => {
  const nominate = event.target.closest('.r3-nominate-btn');
  if (!nominate) return;
  const input = nominate.parentElement.querySelector('.r3-open-bid');
  nominatePlayer(nominate.dataset.player, input ? input.value : MIN_BID);
});

document.getElementById('r3Search').addEventListener('input', event => {
  searchTerm = event.target.value.trim().toLowerCase();
  renderPlayerPool();
});

document.querySelectorAll('.r3-position-btn').forEach(button => {
  button.addEventListener('click', () => {
    positionFilter = button.dataset.position;
    document.querySelectorAll('.r3-position-btn').forEach(tab => {
      const isActive = tab === button;
      tab.classList.toggle('active', isActive);
      tab.setAttribute('aria-pressed', String(isActive));
    });
    renderPlayerPool();
  });
});

// Nomination dialog must not be dismissed with Escape - the clock decides.
nominateDialog.addEventListener('cancel', event => event.preventDefault());

// ---------- Boot ----------

loadPlayers().then(() => {
  const hasProgress = restoreDraftState();
  renderDraftBoard();
  updateRoundInfo();
  if (draftMode === 'snake' || allRostersFull()) {
    finishAuctionPhase();
    return;
  }
  if (hasProgress) {
    document.getElementById('r3StartBtn').textContent = 'Resume Draft';
  }
});
