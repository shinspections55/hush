'use strict';

(() => {
  const labels = { exact: 'Exact player / pick', position: 'Correct position', range: 'Within one pick', miss: 'Normal miss',
    tradeCall: 'Team trades (no partner)', tradeExactPlayer: 'Trade + exact player', tradePosition: 'Trade + position',
    tradePartner: 'Correct trade partner', tradeMiss: 'Team trade miss', tradeExactMiss: 'Exact trade miss' };
  const teamCodes = ['ARI','ATL','BAL','BUF','CAR','CHI','CIN','CLE','DAL','DEN','DET','GB','HOU','IND','JAC','KC','LAC','LAR','LV','MIA','MIN','NE','NO','NYG','NYJ','PHI','PIT','SEA','SF','TB','TEN','WAS'];
  const positions = ['QB','RB','WR','TE','OL','DL','EDGE','LB','DB'];
  const feedback = document.getElementById('scoringFeedback');
  const resultsBody = document.getElementById('actualResultsRows');
  let state = null;
  let prospects = new Map();
  let defaultProspects = new Map();
  let dirty = false;
  let busy = false;
  let builderEntryId = '';
  let builderDirty = false;
  let builderReady = false;
  let resultsPosition = 'ALL';
  const builderFrame = document.getElementById('mockAdminBuilderFrame');
  const exportRequests = new Map();

  function message(value, error = false) {
    feedback.textContent = value;
    feedback.classList.toggle('is-error', error);
    if (error) feedback.scrollIntoView({ block: 'nearest' });
  }
  function slug(value) {
    return String(value || '').trim().toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }
  function manualId(name) { return name.trim() ? `manual:${slug(name)}` : ''; }
  function optionSelect(values, value, label) {
    const select = document.createElement('select');
    select.setAttribute('aria-label', label);
    [['', '--'], ...values.map(item => Array.isArray(item) ? item : [item, item])].forEach(([code, caption]) => {
      const option = document.createElement('option');
      option.value = code;
      option.textContent = caption;
      select.append(option);
    });
    select.value = value || '';
    return select;
  }
  function input(type, value, label) {
    const field = document.createElement('input');
    field.type = type;
    if (type === 'checkbox') field.checked = Boolean(value);
    else field.value = value == null ? '' : String(value);
    field.setAttribute('aria-label', label);
    return field;
  }
  function changed() { dirty = true; message('Unsaved results or rules'); }
  function prospectIsSelected(playerId, exceptPick) {
    const player = prospects.get(playerId);
    return state.results.some(result => result.pick !== exceptPick &&
      (result.playerId === playerId || (player && result.playerName && slug(result.playerName) === slug(player.name))));
  }
  function renderResultsProspects() {
    if (!state) return;
    resultsBody.querySelectorAll('select[data-result-player]').forEach(select => {
      const pick = Number(select.dataset.resultPlayer);
      [...select.options].forEach(option => {
        const used = Boolean(option.value) && prospectIsSelected(option.value, pick);
        option.disabled = used;
        const player = prospects.get(option.value);
        if (player) option.textContent = `${player.name} - ${player.school}${used ? ' (already picked)' : ''}`;
      });
    });
    const target = document.getElementById('resultsProspectPick');
    const previousPick = Number(target.value);
    target.replaceChildren();
    state.results.forEach(result => {
      const option = document.createElement('option');
      option.value = String(result.pick);
      option.textContent = `Pick ${result.pick}${result.playerName ? ` - ${result.playerName}` : ''}`;
      target.append(option);
    });
    target.value = String(state.results.some(result => result.pick === previousPick)
      ? previousPick : (state.results.find(result => !result.playerId && !result.playerName) || state.results[0]).pick);
    target.disabled = busy || Boolean(state.locked);
    const query = document.getElementById('resultsProspectSearch').value.trim().toLowerCase();
    const available = [...prospects.entries()].filter(([id]) => !prospectIsSelected(id));
    const filtered = available.filter(([, player]) => (resultsPosition === 'ALL' || player.position === resultsPosition) &&
      `${player.name} ${player.school} ${player.position}`.toLowerCase().includes(query));
    document.getElementById('resultsProspectCount').textContent = `${available.length} available · ${filtered.length} shown`;
    const list = document.getElementById('resultsProspectList');
    list.replaceChildren();
    filtered.forEach(([id, player]) => {
      const row = document.createElement('div');
      row.className = 'mock-results-prospect-row';
      const copy = document.createElement('span');
      copy.textContent = player.name;
      const detail = document.createElement('small');
      detail.textContent = `${player.position} - ${player.school}`;
      copy.append(detail);
      const add = document.createElement('button');
      add.type = 'button';
      add.className = 'mock-admin-button';
      add.textContent = '+';
      add.setAttribute('aria-label', `Add ${player.name} to selected result pick`);
      add.disabled = busy || Boolean(state.locked);
      add.addEventListener('click', () => {
        if (busy || state.locked || prospectIsSelected(id)) return;
        const result = state.results.find(item => item.pick === Number(target.value));
        if (!result) { message('Choose a result pick first', true); return; }
        result.playerId = id;
        result.playerName = player.name;
        result.position = player.position;
        result.confirmed = false;
        changed();
        const next = state.results.find(item => !item.playerId && !item.playerName);
        if (next) target.value = String(next.pick);
        render();
      });
      row.append(copy, add);
      list.append(row);
    });
    if (!filtered.length) list.textContent = 'No available prospects match this filter.';
  }
  async function request(action, body, scope) {
    const selection = scope || { contestId: state?.contestId || 'contest-2027', datasetId: state?.datasetId || 'real-nfl' };
    if (body && state?.year !== 2027) throw new Error('Reload the 2027 contest before making changes.');
    const target = state?.contests.find(contest => contest.id === selection.contestId);
    if (target && target.year !== 2027) throw new Error('Only 2027 contests are supported.');
    const query = body ? '' : `?${new URLSearchParams(selection)}`;
    const response = await fetch(`/api/admin/mock-draft/scoring${action}${query}`, {
      cache: 'no-store', method: body ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json', 'x-admin-key': sessionStorage.getItem('adminApiKey') || '' },
      ...(body ? { body: JSON.stringify({ ...body, ...selection, revision: state.revision }) } : {})
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'Scoring request failed');
    if (payload.state.year !== 2027) throw new Error('The server returned a different year. No editor data was loaded.');
    const contestChanged = !state || state.contestId !== payload.state.contestId;
    state = payload.state;
    prospects = state.catalog ? new Map(state.catalog.map(player => [player.id, player])) : defaultProspects;
    dirty = false;
    if (contestChanged) { builderEntryId = ''; builderDirty = false; }
    render();
    if (contestChanged) loadBuilderEntry();
  }
  async function run(operation) {
    if (busy) return;
    busy = true;
    document.getElementById('scoringEditorView').querySelectorAll('button,input,select').forEach(control => { control.disabled = true; });
    try { await operation(); }
    catch (error) { message(error.message, true); }
    finally {
      busy = false;
      document.getElementById('scoringEditorView').querySelectorAll('button,input,select').forEach(control => { control.disabled = false; });
      updateActionState();
      renderResultsProspects();
    }
  }
  function requireSaved() { if (dirty) throw new Error('Save Results + Rules before importing or rescoring.'); }

  function render() {
    if (!state) return;
    renderSelectors();
    renderBuilderControls();
    document.getElementById('scoringYear').value = state.year;
    document.getElementById('scoringStatus').value = state.status;
    const ruleFields = document.getElementById('scoringRulesFields');
    ruleFields.replaceChildren();
    Object.entries(labels).forEach(([key, caption]) => {
      const label = document.createElement('label');
      label.className = 'mock-field';
      const text = document.createElement('span');
      text.textContent = caption;
      const field = input('number', state.rules[key], caption);
      field.min = '-100'; field.max = '100'; field.step = '1';
      field.addEventListener('input', () => { state.rules[key] = field.value === '' ? null : Number(field.value); changed(); });
      label.append(text, field); ruleFields.append(label);
    });
    resultsBody.replaceChildren();
    state.results.forEach(result => {
      const row = document.createElement('tr');
      function cell(control) { const element = document.createElement('td'); element.append(control); row.append(element); }
      const number = document.createElement('strong'); number.textContent = result.pick; cell(number);
      ['originalTeam', 'selectingTeam'].forEach(key => {
        const select = optionSelect(teamCodes, result[key], `${key} at pick ${result.pick}`);
        select.addEventListener('change', () => { result[key] = select.value; changed(); }); cell(select);
      });
      const playerCell = document.createElement('div');
      const options = [...prospects.entries()].map(([id, player]) => [id, `${player.name} - ${player.school}`]);
      if (result.playerId && !prospects.has(result.playerId)) options.unshift([result.playerId, result.playerName]);
      const playerSelect = optionSelect(options, result.playerId, `Player at pick ${result.pick}`);
      playerSelect.dataset.resultPlayer = String(result.pick);
      const name = input('text', result.playerName, `Manual player name at pick ${result.pick}`);
      name.maxLength = 160;
      const posSelect = optionSelect(positions, result.position, `Position at pick ${result.pick}`);
      playerSelect.addEventListener('change', () => {
        if (playerSelect.value && prospectIsSelected(playerSelect.value, result.pick)) {
          playerSelect.value = result.playerId;
          message('That prospect is already selected at another pick.', true);
          return;
        }
        const player = prospects.get(playerSelect.value);
        result.playerId = playerSelect.value;
        result.playerName = player ? player.name : '';
        result.position = player ? player.position : '';
        name.value = result.playerName;
        posSelect.value = result.position;
        result.confirmed = false;
        confirmed.checked = false;
        changed();
        renderResultsProspects();
      });
      name.addEventListener('input', () => {
        result.playerName = name.value;
        result.playerId = manualId(name.value);
        playerSelect.value = '';
        result.confirmed = false;
        confirmed.checked = false;
        changed();
        renderResultsProspects();
      });
      playerCell.append(playerSelect, name); cell(playerCell);
      posSelect.addEventListener('change', () => { result.position = posSelect.value; changed(); }); cell(posSelect);
      const traded = input('checkbox', result.traded, `Traded pick ${result.pick}`);
      traded.addEventListener('change', () => { result.traded = traded.checked; changed(); }); cell(traded);
      const history = input('text', result.tradeHistory.join(' > '), `Trade chain at pick ${result.pick}`);
      history.placeholder = 'ATL > CLE > DAL'; history.maxLength = 300;
      history.addEventListener('input', () => { result.tradeHistory = history.value.split(/[>,]/).map(value => value.trim().toUpperCase()).filter(Boolean); changed(); }); cell(history);
      const confirmed = input('checkbox', result.confirmed, `Confirmed pick ${result.pick}`);
      confirmed.addEventListener('change', () => { result.confirmed = confirmed.checked; changed(); }); cell(confirmed);
      const notes = input('text', result.notes, `Notes at pick ${result.pick}`); notes.maxLength = 1000;
      notes.addEventListener('input', () => { result.notes = notes.value; changed(); }); cell(notes);
      resultsBody.append(row);
    });
    document.getElementById('scoringPublishedStatus').textContent = `${state.mocks.filter(mock => mock.status === 'submitted').length} submitted entries · ${state.type.toUpperCase()} / ${state.source.toUpperCase()} · ${state.status.toUpperCase()} · ` +
      (state.scoredAt ? `Last scored ${new Date(state.scoredAt).toLocaleString()}${state.status === 'paused' ? ' (scores held)' : ''}` : 'Not scored yet');
    renderBreakdowns();
    renderLeaderboard();
    updateActionState();
    renderResultsProspects();
  }

  function renderSelectors() {
    const contestSelect = document.getElementById('scoringContestSelect');
    contestSelect.replaceChildren();
    state.contests.filter(contest => contest.year === 2027).forEach(contest => {
      const option = document.createElement('option'); option.value = contest.id; option.textContent = contest.name;
      contestSelect.append(option);
    });
    contestSelect.value = state.contestId;
    const datasetSelect = document.getElementById('scoringDatasetSelect');
    datasetSelect.replaceChildren();
    state.contests.find(contest => contest.id === state.contestId).datasets.forEach(dataset => {
      const option = document.createElement('option'); option.value = dataset.id;
      option.textContent = `${dataset.type === 'test' ? 'TEST' : 'REAL NFL'} - ${dataset.name}`; datasetSelect.append(option);
    });
    datasetSelect.value = state.datasetId;
    const badge = document.getElementById('scoringDatasetBadge');
    badge.textContent = state.type === 'test' ? 'PRIVATE HYPOTHETICAL - NOT THE WEBSITE RESULTS' : 'REAL / NFL';
    badge.classList.toggle('is-real', state.type === 'real');
  }

  function updateActionState() {
    if (!state) return;
    document.getElementById('finalizeActualResultsBtn').disabled = busy || state.type !== 'real';
    const submitted = state.mocks.filter(mock => mock.status === 'submitted');
    const expertCount = submitted.filter(mock => mock.role === 'expert').length;
    document.getElementById('contestEntryCount').textContent = `${submitted.length} submitted: ${submitted.length - expertCount} contestants, ${expertCount} experts. ${state.mocks.length - submitted.length} saved drafts (not entered).`;
    document.getElementById('newScoringContestYear').value = 2027;
    document.getElementById('newScoringContestYear').disabled = true;
    const submittedCount = state.mocks.filter(mock => mock.status === 'submitted').length;
    const scoreHint = state.status === 'paused'
      ? 'This results dataset is paused. Save Live or Final status before rescoring.'
      : !submittedCount ? 'There are no submitted mocks in this contest to rescore.' : '';
    document.getElementById('scoreAllMocksBtn').disabled = busy || Boolean(scoreHint);
    document.getElementById('scoreAllMocksBtn').title = scoreHint || 'Recalculate submitted entries using the saved results';
    document.getElementById('scoringActionHint').textContent = scoreHint;
    document.getElementById('deleteScoringContestBtn').disabled = busy || state.contestId === 'contest-2027';
    document.getElementById('previewContestantMockBtn').disabled = busy || !builderReady;
    document.getElementById('cloneScoringTestBtn').disabled = busy || state.type !== 'test';
    document.getElementById('resetScoringTestBtn').disabled = busy || state.type !== 'test' || Boolean(state.locked);
    resultsBody.querySelectorAll('input,select').forEach(control => { control.disabled = busy || Boolean(state.locked); });
    document.getElementById('scoringStatus').disabled = busy || Boolean(state.locked);
    document.getElementById('scoringResultsFile').disabled = busy || Boolean(state.locked);
    const expert = document.getElementById('mockBuilderRole').value === 'expert';
    document.getElementById('mockBuilderNameLabel').textContent = expert ? 'Expert name' : 'Contestant username';
    document.getElementById('mockBuilderName').placeholder = expert ? "Enter the expert's name" : 'Enter contestant username';
    document.getElementById('newExpertMockBtn').disabled = busy || !builderReady || state.submissions !== 'open' || state.submissionPolicy?.open === false;
    document.getElementById('newAdminMockBtn').disabled = busy || !builderReady || state.submissionPolicy?.open === false;
    document.getElementById('importLocalMockBtn').disabled = busy || Boolean(state.catalog);
    document.getElementById('toggleScoringSubmissionsBtn').textContent = state.submissions === 'open' ? 'Close Submissions' : 'Open Submissions';
    const entry = state.mocks.find(mock => mock.id === builderEntryId);
    document.getElementById('saveSubmitEntryBtn').disabled = busy || !builderReady || state.submissions !== 'open' || state.submissionPolicy?.open === false;
    document.getElementById('saveSubmitEntryBtn').textContent = entry?.status === 'submitted' ? 'Update Submitted Entry' : 'Save & Submit Entry';
    document.getElementById('saveAdminMockBtn').disabled = busy || !builderReady || state.submissions !== 'open' ||
      state.submissionPolicy?.open === false || (entry?.status === 'submitted' && !state.submissionPolicy?.editable);
    document.getElementById('submitAdminMockBtn').disabled = busy || builderDirty || !entry || entry.status !== 'draft' || state.submissions !== 'open' || state.submissionPolicy?.open === false;
  }

  function renderBuilderControls() {
    const select = document.getElementById('mockBuilderEntrySelect'); select.replaceChildren();
    const blank = document.createElement('option'); blank.value = ''; blank.textContent = 'New mock'; select.append(blank);
    state.mocks.forEach(mock => { const option = document.createElement('option'); option.value = mock.id; option.textContent = `${mock.name} (${mock.role}, ${mock.status})`; select.append(option); });
    if (!state.mocks.some(mock => mock.id === builderEntryId)) builderEntryId = '';
    select.value = builderEntryId;
    const entry = state.mocks.find(mock => mock.id === builderEntryId);
    if (!builderDirty) {
      document.getElementById('mockBuilderName').value = entry ? entry.name : (sessionStorage.getItem('username') || '');
      document.getElementById('mockBuilderRole').value = entry ? entry.role : 'participant';
    }
    document.getElementById('mockBuilderStatus').textContent = builderDirty ? 'Unsaved mock changes' : entry?.status === 'submitted'
      ? state.submissionPolicy?.editable
        ? `Submitted; editable until ${HushMockDeadline.formatDeadline(state.submissionPolicy.deadline)} (or earlier admin closure)`
        : 'Submitted entry locked'
      : entry ? 'Draft saved; not yet submitted' : 'New unsaved mock';
  }

  function loadBuilderEntry() {
    if (!builderReady || !state) return;
    const entry = state.mocks.find(mock => mock.id === builderEntryId);
    builderFrame.contentWindow.postMessage({ type: 'hush-mock-load', picks: entry ? entry.picks : [], locked: entry?.status === 'submitted' && !state.submissionPolicy?.editable,
      catalog: state.catalog, teamOrder: state.teamOrder, year: state.year,
      storageKey: `hushAdminMockDraftBuilderV1:${state.contestId}` }, location.origin);
    builderDirty = false;
    renderBuilderControls(); updateActionState();
  }

  function readBuilderMock() {
    return new Promise((resolve, reject) => {
      if (!builderReady) { reject(new Error('The mock builder is still loading')); return; }
      const requestId = crypto.randomUUID();
      const timer = setTimeout(() => { exportRequests.delete(requestId); reject(new Error('Builder did not respond. Reload the page.')); }, 8000);
      exportRequests.set(requestId, { resolve, timer });
      builderFrame.contentWindow.postMessage({ type: 'hush-mock-export', requestId }, location.origin);
    });
  }

  window.addEventListener('message', event => {
    if (event.origin !== location.origin || event.source !== builderFrame.contentWindow) return;
    const data = event.data;
    if (!data || typeof data !== 'object') return;
    if (data.type === 'hush-mock-builder-ready') { builderReady = true; loadBuilderEntry(); }
    if (data.type === 'hush-mock-builder-changed') { builderDirty = true; renderBuilderControls(); updateActionState(); }
    if (data.type === 'hush-mock-review') {
      document.getElementById('previewContestantMockBtn').click();
    }
    if (data.type === 'hush-mock-exported' && exportRequests.has(data.requestId)) {
      const pending = exportRequests.get(data.requestId); clearTimeout(pending.timer); exportRequests.delete(data.requestId); pending.resolve(data.mock);
    }
  });

  function renderLeaderboard() {
    const role = document.getElementById('scoringLeaderboardFilter').value;
    const scores = state.scores.filter(score => role === 'combined' || score.role === role).sort((left, right) => right.total - left.total || left.name.localeCompare(right.name));
    const container = document.getElementById('scoringLeaderboard'); container.replaceChildren();
    const table = document.createElement('table'); table.className = 'mock-scoring-table';
    const caption = document.createElement('caption'); caption.textContent = `${state.type === 'test' ? 'Test' : 'Real NFL'} Leaderboard - ${state.name}`; table.append(caption);
    const head = document.createElement('thead'); const headings = document.createElement('tr');
    ['Rank','Entry','Type','Points','Pending picks'].forEach(label => { const cell = document.createElement('th'); cell.textContent = label; headings.append(cell); }); head.append(headings); table.append(head);
    const body = document.createElement('tbody');
    scores.forEach((score, index) => {
      const rank = scores.findIndex(entry => entry.total === score.total) + 1;
      const row = document.createElement('tr'); [rank, score.name, score.role, score.total, score.pending].forEach(value => { const cell = document.createElement('td'); cell.textContent = value; row.append(cell); }); body.append(row);
    });
    if (!scores.length) { const row = document.createElement('tr'); const cell = document.createElement('td'); cell.colSpan = 5; cell.textContent = 'No scored submissions in this dataset'; row.append(cell); body.append(row); }
    table.append(body); container.append(table);
  }

  function renderBreakdowns() {
    const container = document.getElementById('scoringMockBreakdowns');
    container.replaceChildren();
    state.mocks.forEach(mock => {
      const score = state.scores.find(entry => entry.id === mock.id);
      const details = document.createElement('details'); details.className = 'mock-score-breakdown';
      const title = document.createElement('summary');
      title.textContent = `${mock.name} (${mock.role}, ${mock.status}) - ${score ? `${score.total} points (${score.pending} pending)` : 'Not scored'}`;
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'mock-admin-button mock-admin-button-danger'; remove.textContent = 'Remove Entry';
      remove.addEventListener('click', () => run(async () => {
        requireSaved();
        if (!window.confirm(`Remove ${mock.name}?`)) return;
        await request('/remove', { id: mock.id }); message('Entry removed');
      }));
      const wrap = document.createElement('div'); wrap.className = 'mock-scoring-table-wrap';
      const table = document.createElement('table'); table.className = 'mock-scoring-table';
      const head = document.createElement('thead'); const header = document.createElement('tr');
      ['Pick','Prediction','Actual','Points','Reason','Player','Position','Range','Trade','Partner'].forEach(value => {
        const cell = document.createElement('th'); cell.textContent = value; header.append(cell);
      }); head.append(header); table.append(head);
      const body = document.createElement('tbody');
      mock.picks.forEach(prediction => {
        const scored = score && score.picks.find(entry => entry.pick === prediction.pick);
        const row = document.createElement('tr');
        const values = [prediction.pick, `${prediction.team || '--'}${prediction.trade ? ` > ${prediction.tradeTo || '?'}` : ''} - ${prediction.playerName || '--'} (${prediction.position || '--'})`,
          scored && scored.actual ? `${scored.actual.originalTeam} > ${scored.actual.selectingTeam} - ${scored.actual.playerName} (${scored.actual.position})` : '--',
          scored && scored.points !== null ? scored.points : 'Pending', scored ? scored.reason : 'Not scored',
          ...['player','position','range','trade','partner'].map(key => scored ? (scored.matches[key] ? 'Yes' : 'No') : '--')];
        values.forEach(value => { const cell = document.createElement('td'); cell.textContent = value; row.append(cell); }); body.append(row);
      }); table.append(body); wrap.append(table); details.append(title, remove, wrap); container.append(details);
    });
  }

  document.addEventListener('mock-admin-boards-loaded', event => {
    defaultProspects = new Map();
    Object.entries(event.detail.boards).forEach(([position, players]) => players.forEach(player => {
      const id = `${slug(player.name)}::${slug(player.school)}`;
      if (!defaultProspects.has(id)) defaultProspects.set(id, { ...player, position });
    }));
    const ranked = new Map();
    (event.detail.overallOrder || []).forEach(id => {
      if (defaultProspects.has(id)) ranked.set(id, defaultProspects.get(id));
    });
    defaultProspects.forEach((player, id) => {
      if (!ranked.has(id)) ranked.set(id, player);
    });
    defaultProspects = ranked;
    run(async () => { await request(''); loadBuilderEntry(); message('Selected results dataset loaded'); });
  });
  document.getElementById('scoringYear').addEventListener('input', event => {
    if (state) state.year = Number(event.target.value);
    changed();
  });
  document.getElementById('scoringStatus').addEventListener('change', event => {
    if (state) state.status = event.target.value;
    changed();
  });
  document.getElementById('reloadScoringBtn').addEventListener('click', () => run(async () => {
    if (dirty && !window.confirm('Discard unsaved results and rules?')) return;
    await request(''); message('Loaded saved results and rules');
  }));
  document.getElementById('finalizeActualResultsBtn').addEventListener('click', () => run(async () => {
    if (!state || state.year !== 2027 || state.type !== 'real') throw new Error('Select the REAL NFL results dataset first.');
    if (builderDirty) throw new Error('Save or submit the prediction you are editing before opening the scores.');
    const incomplete = state.results.filter(result => !result.playerId || !result.playerName ||
      !result.position || !result.originalTeam || !result.selectingTeam);
    if (state.results.length !== 32 || incomplete.length) {
      throw new Error(`Complete all 32 actual NFL result picks first.${incomplete.length ? ` Missing player, position, or team at pick(s): ${incomplete.map(result => result.pick).join(', ')}.` : ''}`);
    }
    if (!window.confirm('Finalize the REAL 2027 NFL results? This confirms all 32 picks and publishes final scores for this contest. Use only actual NFL draft results.')) return;
    const results = state.results.map(result => ({ ...result, confirmed: true }));
    await request('/save', { results, rules: state.rules, status: 'final', year: 2027, confirmReal: true });
    message('Actual NFL results finalized and submitted entries scored.');
    if (state.contestId === 'contest-2027') location.href = 'mock-draft-scoreboard.html';
  }));
  document.getElementById('saveActualResultsBtn').addEventListener('click', () => run(async () => {
    if (!state) throw new Error('Reload scoring data first');
    if (state.type === 'real' && !window.confirm('Save changes to the REAL NFL draft answer key? Hypothetical picks belong in a TEST dataset.')) return;
    await request('/save', { results: state.results, rules: state.rules, status: document.getElementById('scoringStatus').value,
      year: state.year, confirmReal: state.type === 'real' });
    message(state.status === 'paused' ? 'Saved. Published scores remain paused.' : 'Saved and automatically rescored all imported mocks.');
  }));
  document.getElementById('scoreAllMocksBtn').addEventListener('click', () => run(async () => {
    requireSaved();
    if (state.status === 'paused') throw new Error('This results dataset is paused. Save Live or Final first.');
    if (!state.mocks.some(mock => mock.status === 'submitted')) throw new Error('No submitted mocks to score. Submit your finished mock from Create / Edit Mock first.');
    await request('/score', {}); message('All submitted mocks rescored');
  }));
  document.getElementById('scoringMockFiles').addEventListener('change', event => {
    const files = [...event.target.files];
    run(async () => {
      requireSaved();
      const mocks = [];
      for (const file of files) {
        if (file.size > 2000000) throw new Error('Mock files must be under 2 MB');
        const payload = JSON.parse(await file.text());
        const entries = Array.isArray(payload.mocks) ? payload.mocks : [payload];
        entries.forEach(entry => mocks.push({ ...entry, role: entry.role || document.getElementById('scoringImportRole').value,
          name: entry.name || document.getElementById('scoringImportName').value.trim() || file.name.replace(/\.json$/i, '') }));
      }
      await request('/import', { mocks }); message(`Imported ${mocks.length} mock entries`);
    }).finally(() => { event.target.value = ''; });
  });
  document.getElementById('scoringResultsFile').addEventListener('change', event => {
    const file = event.target.files[0];
    run(async () => {
      if (!file || file.size > 2000000) throw new Error('Choose a results JSON file under 2 MB');
      const payload = JSON.parse(await file.text());
      const rows = Array.isArray(payload) ? payload : payload.results;
      if (!Array.isArray(rows) || rows.length !== 32) throw new Error('Actual results import needs 32 ordered rows');
      if (dirty && !window.confirm('Replace the unsaved actual results?')) return;
      state.results = rows.map((row, index) => ({ pick: index + 1, originalTeam: '', selectingTeam: '', playerId: '', playerName: '',
        position: '', traded: false, confirmed: false, notes: '', tradeHistory: [], ...row,
        playerId: row.playerId || manualId(row.playerName || '') }));
      render(); changed(); message('Results imported into editor. Save to publish them.');
    }).finally(() => { event.target.value = ''; });
  });
  document.getElementById('importLocalMockBtn').addEventListener('click', () => run(async () => {
    requireSaved();
    const local = JSON.parse(localStorage.getItem('hushMockDraftContestV1') || 'null');
    if (!local || !Array.isArray(local.picks)) throw new Error('No mock is saved in this browser');
    const picks = local.picks.map((pick, index) => {
      const player = prospects.get(pick.playerId);
      return { ...pick, pick: index + 1, playerName: player ? player.name : '', position: player ? player.position : '', trade: pick.trade === true || Boolean(pick.tradeTo) };
    });
    await request('/import', { mocks: [{ name: document.getElementById('scoringImportName').value.trim() || 'Browser mock', role: document.getElementById('scoringImportRole').value, picks }] });
    message('Browser mock imported');
  }));

  document.getElementById('scoringContestSelect').addEventListener('change', event => run(async () => {
    if ((dirty || builderDirty) && !window.confirm('Switch contests and discard unsaved editor changes?')) { renderSelectors(); return; }
    const contest = state.contests.find(item => item.id === event.target.value);
    await request('', null, { contestId: contest.id, datasetId: 'real-nfl' }); message('Contest selected');
  }));
  document.getElementById('scoringDatasetSelect').addEventListener('change', event => run(async () => {
    if (dirty && !window.confirm('Switch datasets and discard unsaved results or rules?')) { renderSelectors(); return; }
    await request('', null, { contestId: state.contestId, datasetId: event.target.value }); message('Results dataset selected');
  }));
  document.getElementById('resultsProspectSearch').addEventListener('input', renderResultsProspects);
  document.querySelectorAll('[data-results-position]').forEach(button => button.addEventListener('click', () => {
    resultsPosition = button.dataset.resultsPosition;
    document.querySelectorAll('[data-results-position]').forEach(tab => {
      tab.setAttribute('aria-pressed', String(tab === button));
    });
    renderResultsProspects();
  }));
  document.getElementById('scoringLeaderboardFilter').addEventListener('change', renderLeaderboard);
  document.getElementById('createScoringTestBtn').addEventListener('click', () => run(async () => {
    requireSaved(); await request('/test/create', { name: document.getElementById('newScoringDatasetName').value.trim() || 'New hypothetical draft' }); message('Created empty hypothetical dataset; real NFL results are unchanged');
  }));
  document.getElementById('cloneScoringTestBtn').addEventListener('click', () => run(async () => {
    requireSaved(); await request('/test/create', { clone: true, name: document.getElementById('newScoringDatasetName').value.trim() || `${state.name} copy` }); message('Cloned hypothetical results only; submissions retained');
  }));
  document.getElementById('resetScoringTestBtn').addEventListener('click', () => run(async () => {
    requireSaved(); if (!window.confirm('Clear this TEST answer key and test scores? Submitted entries and real NFL results will remain.')) return;
    await request('/test/reset', {}); message('Test reset; entries and real results preserved');
  }));
  document.getElementById('deleteScoringContestBtn').addEventListener('click', () => run(async () => {
    if (state.contestId === 'contest-2027') throw new Error('The main contest cannot be deleted');
    const contest = state.contests.find(item => item.id === state.contestId);
    const warning = `Permanently delete "${state.contestName}" (${state.year})?\n\nThis removes ${state.mocks.length} saved mock entries and all ${contest.datasets.length} results datasets, rules, and scores in this contest. This cannot be undone. Other contests are unchanged.${dirty || builderDirty ? '\n\nUnsaved edits in this contest will also be discarded.' : ''}`;
    if (!window.confirm(warning)) return;
    await request('/contest/delete', { confirmDelete: state.contestId });
    message('Contest deleted. Switched to the main contest.');
  }));
  document.getElementById('createScoringContestBtn').addEventListener('click', () => run(async () => {
    requireSaved(); if (builderDirty) throw new Error('Save your mock draft before creating another contest');
    await request('/contest/create', { name: document.getElementById('newScoringDatasetName').value.trim() || 'NFL Mock Draft', year: Number(document.getElementById('newScoringContestYear').value) }); message('Created a separate contest with empty TEST and REAL datasets');
  }));
  document.getElementById('toggleScoringSubmissionsBtn').addEventListener('click', () => run(async () => {
    requireSaved(); const submissions = state.submissions === 'open' ? 'closed' : 'open';
    if (!window.confirm(`${submissions === 'open' ? 'Open' : 'Close'} submissions for ${state.contestName}?`)) return;
    await request('/contest/status', { submissions }); message(`Submissions ${submissions}`);
  }));

  document.getElementById('mockBuilderEntrySelect').addEventListener('change', event => {
    if (builderDirty && !window.confirm('Discard unsaved mock changes?')) { renderBuilderControls(); return; }
    builderEntryId = event.target.value; builderDirty = false; loadBuilderEntry();
  });
  ['mockBuilderName','mockBuilderRole'].forEach(id => document.getElementById(id).addEventListener('input', () => {
    builderDirty = true; document.getElementById('mockBuilderStatus').textContent = 'Unsaved mock changes'; updateActionState();
  }));
  document.getElementById('newAdminMockBtn').addEventListener('click', () => {
    if (builderDirty && !window.confirm('Discard the unsaved mock and create a new one?')) return;
    builderEntryId = ''; builderDirty = false; loadBuilderEntry();
  });
  document.getElementById('newExpertMockBtn').addEventListener('click', () => {
    if (busy || !builderReady || state?.submissions !== 'open') return;
    if (builderDirty && !window.confirm('Discard unsaved mock changes and start a new expert mock?')) return;
    builderEntryId = ''; builderDirty = false; loadBuilderEntry();
    document.getElementById('mockBuilderRole').value = 'expert';
    document.getElementById('mockBuilderName').value = '';
    builderDirty = true;
    renderBuilderControls(); updateActionState();
    document.getElementById('mockBuilderName').focus();
  });
  document.getElementById('recoverAdminMockBtn').addEventListener('click', () => {
    if (busy || !builderReady || !state) return;
    try {
      const saved = JSON.parse(localStorage.getItem(`hushAdminMockDraftBuilderV1:${state.contestId}`)
        || localStorage.getItem('hushAdminMockDraftBuilderV1') || 'null');
      if (!Array.isArray(saved?.picks) || saved.picks.length !== 32 || !saved.picks.some(pick => pick.playerId)) {
        throw new Error('No filled admin draft is saved in this browser.');
      }
      if (saved.picks.some(pick => pick.playerId && !prospects.has(pick.playerId))) {
        throw new Error('This browser draft uses a different prospect list. Select the matching contest before recovering it.');
      }
      if (!window.confirm('Load the browser draft into the board? Current unsaved board changes will be replaced; saved entries are unchanged.')) return;
      builderEntryId = '';
      builderDirty = true;
      builderFrame.contentWindow.postMessage({ type: 'hush-mock-load', picks: saved.picks.map((pick, index) => ({ ...pick, pick: index + 1 })), locked: false }, location.origin);
      document.getElementById('mockBuilderName').value = `My ${state.year} Mock`;
      document.getElementById('mockBuilderRole').value = 'participant';
      renderBuilderControls(); updateActionState();
      message('Browser draft recovered. Finish your picks, then submit to see results.');
    } catch (error) { message(error.message, true); }
  });
  document.getElementById('cloneAdminMockBtn').addEventListener('click', () => {
    const entry = state?.mocks.find(mock => mock.id === builderEntryId);
    if (!entry) { message('Select a saved entry to clone', true); return; }
    builderEntryId = ''; builderDirty = true;
    builderFrame.contentWindow.postMessage({ type: 'hush-mock-load', picks: entry.picks, locked: false }, location.origin);
    document.getElementById('mockBuilderName').value = `${entry.name} copy`; document.getElementById('mockBuilderRole').value = entry.role;
    renderBuilderControls(); updateActionState();
  });
  function contestantReportUrl(mock) {
    const bytes = new TextEncoder().encode(JSON.stringify(mock));
    let binary = '';
    bytes.forEach(byte => { binary += String.fromCharCode(byte); });
    const token = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
    const query = new URLSearchParams({ adminPreview: '1', contestId: state.contestId, datasetId: state.datasetId, mock: token });
    if (builderEntryId) query.set('entryId', builderEntryId);
    return `mock-draft-summary.html?${query}`;
  }
  function builderIdentity() {
    const role = document.getElementById('mockBuilderRole').value;
    const name = document.getElementById('mockBuilderName').value.trim();
    if (!name) throw new Error(role === 'expert' ? "Enter the expert's name." : "Enter the contestant's username.");
    return { name, role, ...(role === 'participant' ? { username: name } : {}) };
  }
  document.getElementById('previewContestantMockBtn').addEventListener('click', async () => {
    if (!state || busy || !builderReady) return;
    if (dirty) { message('Save Results + Rules before previewing their scores.', true); return; }
    const preview = window.open('about:blank', '_blank');
    if (!preview) { message('Allow popups for Hush to open the contestant results preview.', true); return; }
    try {
      const mock = { ...await readBuilderMock(), ...builderIdentity() };
      preview.location.href = contestantReportUrl(mock);
      message('Contestant results preview opened. Use Refresh scores after saving new results.');
    } catch (error) {
      preview.close();
      message(error.message || 'Unable to open contestant results preview.', true);
    }
  });
  document.getElementById('saveSubmitEntryBtn').addEventListener('click', () => run(async () => {
    if (!state || state.year !== 2027) throw new Error('Open the 2027 contest first.');
    requireSaved();
    const identity = builderIdentity();
    if (!window.confirm(`Save and submit ${identity.name} as ${identity.role === 'expert' ? 'an expert' : 'a contestant'} in ${state.contestName}? Predictions can be updated until ${HushMockDeadline.formatDeadline(state.submissionPolicy.deadline)}, unless submissions close earlier. The NFL results answer key stays unchanged.`)) return;
    const mock = await readBuilderMock();
    await request('/entry/save', { mock: { ...mock, id: builderEntryId || undefined, ...identity } });
    if (!builderEntryId) builderEntryId = state.mocks.at(-1).id;
    builderDirty = false;
    renderBuilderControls();
    if (state.mocks.find(entry => entry.id === builderEntryId)?.status === 'draft') {
      await request('/entry/submit', { id: builderEntryId });
    }
    loadBuilderEntry();
    message('Entry submitted. The NFL answer key is unchanged. Live/Final results score automatically; Paused results wait for publication.');
  }));
  document.getElementById('saveAdminMockBtn').addEventListener('click', () => run(async () => {
    requireSaved();
    const identity = builderIdentity();
    const mock = await readBuilderMock();
    await request('/entry/save', { mock: { ...mock, id: builderEntryId || undefined, ...identity } });
    if (!builderEntryId) builderEntryId = state.mocks.at(-1).id;
    builderDirty = false; loadBuilderEntry();
    message(state.mocks.find(entry => entry.id === builderEntryId)?.status === 'submitted'
      ? 'Submitted mock updated and rescored against active results.'
      : 'Mock draft saved to the contest; submit it to enter the leaderboards');
  }));
  document.getElementById('submitAdminMockBtn').addEventListener('click', () => run(async () => {
    requireSaved(); if (builderDirty) throw new Error('Save your latest mock changes before submitting');
    if (!window.confirm(state.submissionPolicy?.editable
      ? `Submit this saved mock? You may update it until ${HushMockDeadline.formatDeadline(state.submissionPolicy.deadline)}, unless submissions close earlier.`
      : 'Submit this saved mock? Its predictions will be locked.')) return;
    await request('/entry/submit', { id: builderEntryId }); loadBuilderEntry(); message('Mock submitted; it will be scored against each active dataset independently');
  }));
})();