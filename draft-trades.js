'use strict';

const crypto = require('node:crypto');

function isLocalTradeSocket(socket) {
  const address = socket.handshake.address;
  const host = String(socket.handshake.headers.host || '');
  const origin = String(socket.handshake.headers.origin || '');
  const localHost = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i;
  return ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address)
    && localHost.test(`http://${host}`)
    && (!origin || localHost.test(origin))
    && !socket.handshake.headers['x-forwarded-for'];
}

function tradePhase(draft, now = Date.now()) {
  const state = draft && draft.draftState;
  if (!state || !Array.isArray(state.teams)) return 'unavailable';
  if (draft.waiverState && (draft.waiverState.active || draft.waiverState.completed)) return 'closed';
  const auctions = Object.values(state.liveAuctions || {}).some(auction => auction && auction.active)
    || (state.pendingAuctions || []).length > 0;
  if (state.isProcessingRound || state.pendingRoundResults || auctions) return 'resolving';
  if (Number(state.currentRound) === 10 && Number(state.lastFinalizedRound) === 10) {
    const ties = state.lastRoundResults && state.lastRoundResults.tiedBids;
    if (Array.isArray(ties) && ties.length && Number(state.lastAuctionCompletedRound) !== 10) return 'resolving';
    return 'post';
  }
  if (Number(state.roundStartAt) <= now && Number(state.roundEndsAt) > now) return 'live';
  return 'waiting';
}

function createTradeService({ isCpu, capacity, playerValue, rosterScore, waiverScore, waiverMode, persist, loadCpuRankings, random = Math.random }) {
  const fail = reason => ({ ok: false, reason });
  const key = value => String(value || '').trim().toLowerCase();

  function ensureWaiverPicks(draft) {
    if (!draft.tradePrototype || Array.isArray(draft.tradeWaiverPicks) || tradePhase(draft) !== 'post' || waiverMode(draft) === 'off') return;
    let order = draft.draftState.teams.slice();
    if (waiverMode(draft) === 'skill') {
      order.sort((a, b) => waiverScore(a, draft) - waiverScore(b, draft) || a.name.localeCompare(b.name));
    } else {
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
    }
    draft.tradeWaiverPicks = order.map((team, index) => ({ id: index + 1, originalTeam: team.name, owner: team.name }));
  }

  function getState(draft, user) {
    ensureWaiverPicks(draft);
    // Recover acquisition costs for trades accepted before cost tracking was added.
    recoverCashPurchases(draft);
    return {
      phase: tradePhase(draft),
      teams: draft.draftState.teams,
      revision: Number(draft.draftState.tradeRevision || 0),
      bidRevision: Number((draft.draftState.tradeBidRevisions || {})[user] || 0),
      waiverPicks: draft.tradeWaiverPicks || [],
      offers: (draft.tradeOffers || []).filter(offer => offer.from === user || offer.to === user).slice(-50)
    };
  }

  function recoverCashPurchases(draft) {
    const seen = new Set();
    let changed = false;
    for (const offer of (draft.tradeOffers || []).slice().reverse().sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))) {
      if (offer.status === 'accepted') changed = recordCashPurchase(draft.draftState, offer, seen) || changed;
    }
    if (changed) draft.draftState.tradeRevision = Number(draft.draftState.tradeRevision || 0) + 1;
    return changed;
  }

  function recordCashPurchase(state, offer, seen = new Set()) {
    const { give, receive } = offer;
    let id;
    let cost;
    if (give.players.length === 0 && receive.players.length === 1
        && give.budget > 0 && receive.budget === 0 && !give.picks.length && !receive.picks.length) {
      id = receive.players[0];
      cost = give.budget;
    } else if (receive.players.length === 0 && give.players.length === 1
        && receive.budget > 0 && give.budget === 0 && !give.picks.length && !receive.picks.length) {
      id = give.players[0];
      cost = receive.budget;
    } else {
      return false;
    }
    if (seen.has(id)) return false;
    seen.add(id);
    let changed = false;
    for (const player of [...state.teams.flatMap(team => team.roster), ...(state.allPlayers || [])]) {
      if (Number(player.id) === id && player.acquisitionCost !== cost) {
        player.acquisitionCost = cost;
        changed = true;
      }
    }
    return changed;
  }

  function normalizeSide(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const players = raw.players || [];
    const picks = raw.picks || [];
    const budget = raw.budget === undefined ? 0 : raw.budget;
    if (!Array.isArray(players) || !Array.isArray(picks) || players.length > 50 || picks.length > 50
        || !Number.isSafeInteger(budget) || budget < 0
        || [...players, ...picks].some(id => !Number.isSafeInteger(id) || id <= 0)
        || new Set(players).size !== players.length || new Set(picks).size !== picks.length) return null;
    return { players: players.slice(), picks: picks.slice(), budget };
  }

  function validate(draft, offer) {
    const phase = tradePhase(draft);
    if (!['live', 'post'].includes(phase)) return fail(`trades_${phase}`);
    const teams = draft.draftState.teams;
    const from = teams.find(team => team.name === offer.from);
    const to = teams.find(team => team.name === offer.to);
    if (!from || !to || from === to) return fail('invalid_teams');
    const give = normalizeSide(offer.give);
    const receive = normalizeSide(offer.receive);
    if (!give || !receive) return fail('invalid_assets');
    if (phase === 'live' && (give.picks.length || receive.picks.length)) return fail('waiver_picks_post_draft_only');
    if (phase === 'post' && (give.budget || receive.budget)) return fail('budget_live_draft_only');
    if (![give, receive].some(side => side.players.length || side.picks.length || side.budget)) return fail('empty_offer');
    for (const [team, side] of [[from, give], [to, receive]]) {
      if (side.budget > Number(team.budget || 0)) return fail('insufficient_budget');
      if (side.players.some(id => !(team.roster || []).some(player => Number(player.id) === id))) return fail('player_no_longer_owned');
      if (side.picks.some(id => !(draft.tradeWaiverPicks || []).some(pick => pick.id === id && pick.owner === team.name))) {
        return fail('waiver_pick_no_longer_owned');
      }
    }
    const fromRoster = from.roster.filter(player => !give.players.includes(Number(player.id)))
      .concat(to.roster.filter(player => receive.players.includes(Number(player.id))));
    const toRoster = to.roster.filter(player => !receive.players.includes(Number(player.id)))
      .concat(from.roster.filter(player => give.players.includes(Number(player.id))));
    if (fromRoster.length > capacity(draft, phase) || toRoster.length > capacity(draft, phase)) return fail('roster_capacity_exceeded');
    if (new Set([...fromRoster, ...toRoster].map(player => Number(player.id))).size !== fromRoster.length + toRoster.length) {
      return fail('duplicate_player');
    }
    return { ok: true, phase, from, to, give, receive, fromRoster, toRoster };
  }

  function evaluateCpuTrade(draft, checked, rankings) {
    const players = (team, side) => side.players.map(id => team.roster.find(player => Number(player.id) === id));
    const incomingPlayers = players(checked.from, checked.give);
    const outgoingPlayers = players(checked.to, checked.receive);
    const av = roster => roster.reduce((sum, player) => sum + Math.max(0, playerValue(player, draft)), 0);
    const pickValue = side => side.picks.reduce((sum, id) => sum + 5 / id, 0);
    const incomingValue = av(incomingPlayers) + checked.give.budget + pickValue(checked.give);
    const outgoingValue = av(outgoingPlayers) + checked.receive.budget + pickValue(checked.receive);

    const rankByPlayer = new Map(rankings.map(player => [
      `${key(player.name)}|${key(player.position)}`, Number(player.prerank)
    ]));
    const rankValue = roster => {
      return roster.reduce((sum, player) => {
        const rank = rankByPlayer.get(`${key(player.name)}|${key(player.position)}`);
        if (!Number.isFinite(rank) || rank <= 0) {
          console.warn('[trades] Default ranking missing for:', player.name);
          return sum;
        }
        return sum + Math.max(-3, Math.min(3, (100 - rank) * 0.03));
      }, 0);
    };
    const rankAdjustment = rankValue(incomingPlayers) - rankValue(outgoingPlayers);
    const rosterChange = rosterScore(checked.toRoster, draft) - rosterScore(checked.to.roster, draft);
    const needAdjustment = Math.max(-5, Math.min(5, (rosterChange - (av(incomingPlayers) - av(outgoingPlayers))) * 0.2));
    const purchasePrices = outgoingPlayers.map(player => {
      const previouslyTraded = (draft.tradeOffers || []).some(offer => offer.status === 'accepted'
        && (offer.give.players.includes(Number(player.id)) || offer.receive.players.includes(Number(player.id))));
      const raw = player.acquisitionCost ?? player.bid;
      if ((previouslyTraded && player.acquisitionCost === undefined) || raw === null || raw === undefined || raw === '') return null;
      const price = Number(raw);
      return Number.isFinite(price) && price > 0 ? price : null;
    });
    const costKnown = purchasePrices.length > 0 && purchasePrices.every(price => price !== null);
    const purchaseCost = costKnown ? purchasePrices.reduce((sum, price) => sum + price, 0) : 0;
    const netProceeds = incomingValue - checked.receive.budget - pickValue(checked.receive);
    const lossPenalty = costKnown ? Math.min(5, Math.max(0, purchaseCost - netProceeds) * 0.2) : 0;
    const profitBonus = costKnown ? Math.min(2, Math.max(0, (netProceeds - purchaseCost) / purchaseCost) * 2) : 0;
    const benefit = incomingValue - outgoingValue + rankAdjustment + needAdjustment + profitBonus - lossPenalty;
    const chance = benefit < -5 ? 0 : benefit < 0 ? 0.1 + benefit * 0.01 : Math.min(0.9, 0.1 + benefit * 0.08);
    return { benefit, chance };
  }

  function buildCpuCounter(draft, offer, checked, rankings, baseline) {
    const give = normalizeSide(offer.receive);
    const receive = normalizeSide(offer.give);
    const candidates = [];
    const add = (nextGive, nextReceive) => {
      const candidate = { from: offer.to, to: offer.from, give: nextGive, receive: nextReceive };
      const valid = validate(draft, candidate);
      if (!valid.ok) return;
      const evaluation = evaluateCpuTrade(draft, {
        ...valid, from: valid.to, to: valid.from, give: valid.receive, receive: valid.give,
        toRoster: valid.fromRoster
      }, rankings);
      if (evaluation.benefit > baseline && evaluation.benefit >= 0) candidates.push({ candidate, benefit: evaluation.benefit });
    };
    if (checked.phase === 'live') {
      const extra = Math.max(1, Math.ceil(5 - baseline));
      const available = Math.max(0, Math.floor(Number(checked.from.budget || 0)) - receive.budget);
      if (available) add(give, { ...receive, budget: receive.budget + Math.min(extra, available) });
      if (give.budget) add({ ...give, budget: Math.max(0, give.budget - extra) }, receive);
    } else {
      for (const pick of draft.tradeWaiverPicks || []) {
        if (pick.owner === offer.from && !receive.picks.includes(pick.id)) {
          add(give, { ...receive, picks: [...receive.picks, pick.id] });
        }
      }
    }
    for (const player of checked.from.roster) {
      const id = Number(player.id);
      if (!receive.players.includes(id)) add(give, { ...receive, players: [...receive.players, id] });
    }
    candidates.sort((a, b) => a.benefit - b.benefit);
    if (!candidates.length) return null;
    const selected = candidates.find(item => item.benefit >= 5) || candidates[candidates.length - 1];
    return {
      ...selected.candidate, id: crypto.randomUUID(), requestId: crypto.randomUUID(),
      phase: offer.phase, status: 'pending', createdAt: Date.now(), counterId: offer.id,
      giveNames: selected.candidate.give.players.map(id => checked.to.roster.find(player => Number(player.id) === id).name),
      receiveNames: selected.candidate.receive.players.map(id => checked.from.roster.find(player => Number(player.id) === id).name)
    };
  }

  function accept(draft, offer) {
    const checked = validate(draft, offer);
    if (!checked.ok) return checked;
    const { from, to, give, receive, fromRoster, toRoster, phase } = checked;
    from.roster = fromRoster;
    to.roster = toRoster;
    from.budget = Number(from.budget || 0) - give.budget + receive.budget;
    to.budget = Number(to.budget || 0) - receive.budget + give.budget;
    for (const team of [from, to]) {
      if (Object.prototype.hasOwnProperty.call(team, 'budgetRemaining')) team.budgetRemaining = team.budget;
    }
    const state = draft.draftState;
    recordCashPurchase(state, offer);
    for (const team of [from, to]) {
      for (const player of team.roster) player.owner = team.name;
    }
    for (const player of state.allPlayers || []) {
      if (give.players.includes(Number(player.id))) player.owner = to.name;
      if (receive.players.includes(Number(player.id))) player.owner = from.name;
    }
    for (const pick of draft.tradeWaiverPicks || []) {
      if (give.picks.includes(pick.id)) pick.owner = to.name;
      if (receive.picks.includes(pick.id)) pick.owner = from.name;
    }
    state.tradeRevision = Number(state.tradeRevision || 0) + 1;
    if (phase === 'live') {
      state.tradeBidRevisions = state.tradeBidRevisions || {};
      for (const team of [from, to]) state.tradeBidRevisions[team.name] = Number(state.tradeBidRevisions[team.name] || 0) + 1;
      for (const bids of Object.values(state.bids || {})) {
        delete bids[from.name];
        delete bids[to.name];
      }
      state.submittedMembers = (state.submittedMembers || []).filter(name => name !== from.name && name !== to.name);
      state.actionReceipts = {};
    }
    if (Array.isArray(draft.teams)) draft.teams = state.teams;
    offer.status = 'accepted';
    offer.updatedAt = Date.now();
    for (const other of draft.tradeOffers) {
      if (other.status === 'pending' && other.id !== offer.id && !validate(draft, other).ok) other.status = 'expired';
    }
    return { ok: true, offer, affectedTeams: phase === 'live' ? [from.name, to.name] : [] };
  }

  function propose(draft, user, input, rankings = []) {
    const to = draft.draftState.teams.find(team => key(team.name) === key(input.to));
    if (!to || to.name === user) return fail('invalid_recipient');
    draft.tradeOffers = draft.tradeOffers || [];
    const retry = draft.tradeOffers.find(offer => offer.from === user && offer.requestId === input.requestId);
    if (retry) return { ok: true, offer: retry };
    if (typeof input.requestId !== 'string' || input.requestId.length < 8 || input.requestId.length > 80) return fail('invalid_request_id');
    if (draft.tradeOffers.length >= 1000) return fail('trade_limit_reached');
    const parent = input.counterId ? draft.tradeOffers.find(offer => offer.id === input.counterId) : null;
    if (input.counterId && (!parent || parent.status !== 'pending' || parent.to !== user || parent.from !== to.name)) return fail('invalid_counter');
    const offer = {
      id: crypto.randomUUID(), requestId: input.requestId, from: user, to: to.name,
      give: normalizeSide(input.give), receive: normalizeSide(input.receive),
      phase: tradePhase(draft), status: 'pending', createdAt: Date.now(), counterId: input.counterId || null
    };
    const checked = validate(draft, offer);
    if (!checked.ok) return checked;
    offer.giveNames = checked.give.players.map(id => checked.from.roster.find(player => Number(player.id) === id).name);
    offer.receiveNames = checked.receive.players.map(id => checked.to.roster.find(player => Number(player.id) === id).name);
    const cpu = isCpu(to.name, draft);
    if (cpu && !rankings.length) return fail('cpu_rankings_unavailable');
    const evaluation = cpu ? evaluateCpuTrade(draft, checked, rankings) : null;
    const cpuAccepted = cpu && random() < evaluation.chance;
    const cpuCounter = cpu && !cpuAccepted && draft.tradeOffers.length < 999 && random() < 0.05
      ? buildCpuCounter(draft, offer, checked, rankings, evaluation.benefit) : null;
    if (parent) parent.status = 'countered';
    draft.tradeOffers.push(offer);
    if (cpu) {
      if (cpuAccepted) return accept(draft, offer);
      if (cpuCounter) {
        offer.status = 'countered';
        offer.cpuDecision = 'CPU sent a counteroffer for a better return.';
        offer.updatedAt = Date.now();
        draft.tradeOffers.push(cpuCounter);
        return { ok: true, offer, counterOffer: cpuCounter };
      }
      offer.status = 'declined';
      offer.cpuDecision = 'CPU declined after evaluating value, rankings, roster fit and return.';
    }
    return { ok: true, offer };
  }

  function respond(draft, user, input) {
    const offer = (draft.tradeOffers || []).find(item => item.id === input.id);
    if (!offer || (offer.to !== user && !(offer.from === user && input.action === 'cancel'))) return fail('not_your_offer');
    if (offer.status !== 'pending') return fail('offer_not_pending');
    if (input.action === 'accept') {
      if (offer.phase !== tradePhase(draft)) return fail('trade_phase_changed');
      return accept(draft, offer);
    }
    if (!['decline', 'cancel'].includes(input.action)) return fail('invalid_action');
    offer.status = input.action === 'cancel' ? 'cancelled' : 'declined';
    offer.updatedAt = Date.now();
    return { ok: true, offer };
  }

  function register(socket, io, drafts) {
    async function run(action, input, cb) {
      if (!isLocalTradeSocket(socket)) {
        if (typeof cb === 'function') cb(fail('local_prototype_only'));
        return;
      }
      const code = String(input && input.code || '');
      const draft = Object.prototype.hasOwnProperty.call(drafts, code) ? drafts[code] : null;
      const user = draft && (draft.members || []).find(name => key(name) === key(socket.data.username));
      if (!draft || !user || socket.data.currentDraft !== code || !draft.draftState) {
        if (typeof cb === 'function') cb(fail('not_in_draft'));
        return;
      }
      const alreadyInitialized = draft.tradePrototype && Array.isArray(draft.draftState.teams);
      const hadWaiverPicks = Array.isArray(draft.tradeWaiverPicks);
      draft.tradePrototype = true;
      if (!Array.isArray(draft.draftState.teams) || !draft.draftState.teams.length) {
        const names = (draft.members || []).slice();
        const count = Math.max(names.length, Math.min(20, Number(draft.capacity) || 10));
        for (let i = names.length + 1; i <= count; i++) {
          if (!names.includes(`Team ${i}`)) names.push(`Team ${i}`);
        }
        draft.draftState.teams = names.map(name => {
          const budget = Number.parseInt((draft.customBudgets || {})[name], 10);
          return { name, roster: [], budget: Number.isFinite(budget) ? Math.max(0, Math.min(9999, budget)) : 200 };
        });
      }
      ensureWaiverPicks(draft);
      const costsRecovered = recoverCashPurchases(draft);
      let rankings = [];
      const recipient = action === 'offer' && draft.draftState.teams.find(team => key(team.name) === key(input && input.to));
      const alreadyOffered = action === 'offer' && (draft.tradeOffers || []).some(offer => offer.from === user && offer.requestId === (input && input.requestId));
      if (recipient && isCpu(recipient.name, draft) && !alreadyOffered) {
        try {
          rankings = await loadCpuRankings();
          if (!Array.isArray(rankings) || !rankings.length) throw new Error('Default rankings are empty');
        } catch (error) {
          console.error('[trades] Cannot evaluate CPU offer without default rankings:', error);
          if (typeof cb === 'function') cb(fail('cpu_rankings_unavailable'));
          return;
        }
        if (drafts[code] !== draft || socket.data.currentDraft !== code
            || !(draft.members || []).some(name => key(name) === key(user))) {
          if (typeof cb === 'function') cb(fail('not_in_draft'));
          return;
        }
      }
      const result = action === 'state' ? { ok: true } : action === 'offer' ? propose(draft, user, input, rankings) : respond(draft, user, input);
      if (result.ok) {
        if (action !== 'state' || costsRecovered || !alreadyInitialized || (!hadWaiverPicks && Array.isArray(draft.tradeWaiverPicks))) persist(code, 'trade');
        if (action !== 'state') {
          // Only local participants can see or act on this prototype.
          for (const peer of io.sockets.sockets.values()) {
            if (!isLocalTradeSocket(peer) || peer.data.currentDraft !== code) continue;
            const member = (draft.members || []).find(name => key(name) === key(peer.data.username));
            if (member) peer.emit('tradeStateUpdated', { ...getState(draft, member), affectedTeams: result.affectedTeams || [] });
          }
        }
      } else {
        console.warn('[trades] Request rejected:', action, result.reason);
      }
      if (typeof cb === 'function') cb(result.ok ? { ...result, state: getState(draft, user) } : result);
    }
    const handle = action => (input, cb) => {
      run(action, input, cb).catch(error => {
        console.error('[trades] Request failed:', action, error);
        if (typeof cb === 'function') cb(fail('trade_server_error'));
      });
    };
    socket.on('getTradeState', handle('state'));
    socket.on('offerTrade', handle('offer'));
    socket.on('respondTrade', handle('respond'));
  }

  return { register, getState, ensureWaiverPicks, validate, propose, respond };
}

module.exports = { createTradeService, tradePhase, isLocalTradeSocket };
