'use strict';

const DEFAULT_RULES = Object.freeze({
  exact: 15, position: 5, range: 3, miss: -3,
  tradeCall: 10, tradeExactPlayer: 30, tradePosition: 18, tradePartner: 12,
  tradeMiss: -5, tradeExactMiss: -8
});

function samePlayer(prediction, actual) {
  return Boolean(prediction.playerId && actual.playerId && prediction.playerId === actual.playerId);
}

function scorePick(prediction, results, rules = DEFAULT_RULES, status = 'live') {
  const actual = results.find(result => result.pick === prediction.pick);
  const matches = { player: false, position: false, range: false, trade: false, partner: false };
  if (!actual || !actual.confirmed) return { pick: prediction.pick, points: null, reason: 'Awaiting confirmed result', matches };

  matches.player = samePlayer(prediction, actual);
  matches.position = Boolean(prediction.position && prediction.position === actual.position);
  matches.range = results.some(result => result.confirmed && Math.abs(result.pick - prediction.pick) === 1 && samePlayer(prediction, result));
  const chain = actual.tradeHistory || [];
  matches.trade = Boolean(prediction.trade && actual.traded && prediction.team &&
    (actual.originalTeam === prediction.team || chain.slice(0, -1).includes(prediction.team)));
  matches.partner = Boolean(matches.trade && prediction.tradeTo && actual.selectingTeam === prediction.tradeTo &&
    prediction.team !== prediction.tradeTo);

  if (!prediction.playerId && !prediction.position && !prediction.trade) {
    return { pick: prediction.pick, points: 0, reason: 'No prediction', matches };
  }

  if (prediction.trade) {
    if (prediction.tradeTo) {
      if (matches.partner) {
        const candidates = [{ points: rules.tradePartner, reason: 'Correct trade partner' }];
        if (matches.player) candidates.push({ points: rules.tradeExactPlayer, reason: 'Correct trade + player' });
        if (matches.position) candidates.push({ points: rules.tradePosition, reason: 'Correct trade + position' });
        candidates.sort((left, right) => right.points - left.points);
        return { pick: prediction.pick, ...candidates[0], matches };
      }
      return { pick: prediction.pick, points: rules.tradeExactMiss, reason: 'Exact trade prediction missed', matches };
    }
    return { pick: prediction.pick, points: matches.trade ? rules.tradeCall : rules.tradeMiss,
      reason: matches.trade ? 'Correct team trade call' : 'Team trade call missed', matches };
  }

  const candidates = [];
  if (matches.player) candidates.push({ points: rules.exact, reason: 'Exact player at pick' });
  if (matches.position) candidates.push({ points: rules.position, reason: 'Correct position' });
  if (matches.range) candidates.push({ points: rules.range, reason: 'Player within one pick' });
  candidates.sort((left, right) => right.points - left.points);
  const adjacent = [prediction.pick - 1, prediction.pick + 1].filter(pick => pick >= 1 && pick <= 32);
  if (!matches.player && prediction.playerId && status !== 'final' &&
      (!candidates.length || rules.range > candidates[0].points) &&
      adjacent.some(pick => !results.some(result => result.pick === pick && result.confirmed))) {
    return { pick: prediction.pick, points: null, reason: 'Awaiting adjacent picks for range check', matches };
  }
  if (candidates.length) return { pick: prediction.pick, ...candidates[0], matches };
  return { pick: prediction.pick, points: rules.miss, reason: 'Prediction missed', matches };
}

function scoreMock(mock, results, rules, status) {
  const picks = mock.picks.map(prediction => ({ ...scorePick(prediction, results, rules, status),
    actual: results.find(result => result.pick === prediction.pick && result.confirmed) || null }));
  return { id: mock.id, name: mock.name, total: picks.reduce((total, pick) => total + (pick.points || 0), 0),
    pending: picks.filter(pick => pick.points === null).length, picks };
}

module.exports = { DEFAULT_RULES, scorePick, scoreMock };