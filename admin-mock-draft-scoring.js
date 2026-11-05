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
  const builderFrame = document.getElementById('mockAdminBuilderFrame');
  const exportRequests = new Map();

  function message(value, error = false) {
    feedback.textContent = value;
    feedback.classList.toggle('is-error', error);
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
  async function request(action, body, scope) {
    const selection = scope || { contestId: state?.contestId || 'contest-2027', datasetId: state?.datasetId || 'test-default' };
    const query = body ? '' : `?${new URLSearchParams(selection)}`;
    const response = await fetch(`/api/admin/mock-draft/scoring${action}${query}`, {
      cache: 'no-store', method: body ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json', 'x-admin-key': sessionStorage.getItem('adminApiKey') || '' },
      ...(body ? { body: JSON.stringify({ ...body, ...selection, revision: state.revision }) } : {})
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'Scoring request failed');
    const contestChanged = state && state.contestId !== payload.state.contestId;
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
      const name = input('text', result.playerName, `Manual player name at pick ${result.pick}`);
      name.maxLength = 160;
      const posSelect = optionSelect(positions, result.position, `Position at pick ${result.pick}`);
      playerSelect.addEventListener('change', () => {
        const player = prospects.get(playerSelect.value);
        result.playerId = playerSelect.value;
        result.playerName = player ? player.name : '';
        result.position = player ? player.position : '';
        name.value = result.playerName;
        posSelect.value = result.position;
        changed();
      });
      name.addEventListener('input', () => {
        result.playerName = name.value;
        result.playerId = manualId(name.value);
        playerSelect.value = '';
        changed();
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
  }

  function renderSelectors() {
    const contestSelect = document.getElementById('scoringContestSelect');
    contestSelect.replaceChildren();
    state.contests.forEach(contest => {
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
    badge.textContent = state.locked ? 'ADMIN TEST / HISTORICAL REFERENCE' : state.type === 'test' ? 'TEST / HYPOTHETICAL' : 'REAL / NFL';
    badge.classList.toggle('is-real', state.type === 'real');
  }

  function updateActionState() {
    if (!state) return;
    document.getElementById('cloneScoringTestBtn').disabled = busy || state.type !== 'test';
    document.getElementById('resetScoringTestBtn').disabled = busy || state.type !== 'test' || Boolean(state.locked);
    resultsBody.querySelectorAll('input,select').forEach(control => { control.disabled = busy || Boolean(state.locked); });
    document.getElementById('scoringStatus').disabled = busy || Boolean(state.locked);
    document.getElementById('scoringResultsFile').disabled = busy || Boolean(state.locked);
    document.getElementById('mockBuilderName').placeholder = `My ${state.year} Mock`;
    document.getElementById('importLocalMockBtn').disabled = busy || Boolean(state.catalog);
    document.querySelectorAll('[data-calibration-remove]').forEach(control => { control.disabled = true; });
    document.getElementById('toggleScoringSubmissionsBtn').textContent = state.submissions === 'open' ? 'Close Submissions' : 'Open Submissions';
    const entry = state.mocks.find(mock => mock.id === builderEntryId);
    document.getElementById('saveAdminMockBtn').disabled = busy || !builderReady || state.submissions !== 'open' || entry?.status === 'submitted';
    document.getElementById('submitAdminMockBtn').disabled = busy || builderDirty || !entry || entry.status !== 'draft' || state.submissions !== 'open';
  }

  function renderBuilderControls() {
    const select = document.getElementById('mockBuilderEntrySelect'); select.replaceChildren();
    const blank = document.createElement('option'); blank.value = ''; blank.textContent = 'New mock'; select.append(blank);
    state.mocks.forEach(mock => { const option = document.createElement('option'); option.value = mock.id; option.textContent = `${mock.name} (${mock.role}, ${mock.status})`; select.append(option); });
    if (!state.mocks.some(mock => mock.id === builderEntryId)) builderEntryId = '';
    select.value = builderEntryId;
    const entry = state.mocks.find(mock => mock.id === builderEntryId);
    if (!builderDirty) {
      document.getElementById('mockBuilderName').value = entry ? entry.name : '';
      document.getElementById('mockBuilderRole').value = entry ? entry.role : 'participant';
    }
    document.getElementById('mockBuilderStatus').textContent = builderDirty ? 'Unsaved mock changes' : entry?.status === 'submitted' ? 'Submitted entry locked' : entry ? 'Draft saved; not yet submitted' : 'New unsaved mock';
  }

  function loadBuilderEntry() {
    if (!builderReady || !state) return;
    const entry = state.mocks.find(mock => mock.id === builderEntryId);
    builderFrame.contentWindow.postMessage({ type: 'hush-mock-load', picks: entry ? entry.picks : [], locked: entry?.status === 'submitted',
      catalog: state.catalog, teamOrder: state.teamOrder, year: state.year }, location.origin);
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
    ['Rank','Entry','Type','Points','Pending picks','Expected (default rules)','Check'].forEach(label => { const cell = document.createElement('th'); cell.textContent = label; headings.append(cell); }); head.append(headings); table.append(head);
    const body = document.createElement('tbody');
    scores.forEach((score, index) => {
      const rank = scores.findIndex(entry => entry.total === score.total) + 1;
      const expected = state.mocks.find(mock => mock.id === score.id)?.expectedScore;
      const defaults = state.calibrationRules && Object.keys(state.calibrationRules).every(key => state.rules[key] === state.calibrationRules[key]);
      const check = expected == null ? '--' : !state.locked ? 'Custom answer key' : !defaults ? 'Custom rules' : score.total === expected && score.pending === 0 ? 'PASS' : 'FAIL';
      const row = document.createElement('tr'); [rank, score.name, score.role, score.total, score.pending, expected ?? '--', check].forEach(value => { const cell = document.createElement('td'); cell.textContent = value; row.append(cell); }); body.append(row);
    });
    if (!scores.length) { const row = document.createElement('tr'); const cell = document.createElement('td'); cell.colSpan = 7; cell.textContent = 'No scored submissions in this dataset'; row.append(cell); body.append(row); }
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
      if (mock.calibration) { remove.dataset.calibrationRemove = 'true'; remove.disabled = true; }
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
  document.getElementById('saveActualResultsBtn').addEventListener('click', () => run(async () => {
    if (!state) throw new Error('Reload scoring data first');
    if (state.type === 'real' && !window.confirm('Save changes to the REAL NFL draft answer key? Hypothetical picks belong in a TEST dataset.')) return;
    await request('/save', { results: state.results, rules: state.rules, status: document.getElementById('scoringStatus').value,
      year: state.year, confirmReal: state.type === 'real' });
    message(state.status === 'paused' ? 'Saved. Published scores remain paused.' : 'Saved and automatically rescored all imported mocks.');
  }));
  document.getElementById('scoreAllMocksBtn').addEventListener('click', () => run(async () => {
    requireSaved(); await request('/score', {}); message('All imported mocks rescored');
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
    await request('', null, { contestId: contest.id, datasetId: contest.datasets[0].id }); message('Contest selected');
  }));
  document.getElementById('scoringDatasetSelect').addEventListener('change', event => run(async () => {
    if (dirty && !window.confirm('Switch datasets and discard unsaved results or rules?')) { renderSelectors(); return; }
    await request('', null, { contestId: state.contestId, datasetId: event.target.value }); message('Results dataset selected');
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
  document.getElementById('createScoringContestBtn').addEventListener('click', () => run(async () => {
    requireSaved(); if (builderDirty) throw new Error('Save your mock draft before creating another contest');
    await request('/contest/create', { name: document.getElementById('newScoringDatasetName').value.trim() || 'NFL Mock Draft', year: Number(document.getElementById('newScoringContestYear').value) }); message('Created a separate contest with empty TEST and REAL datasets');
  }));
  document.getElementById('load2025CalibrationBtn').addEventListener('click', () => run(async () => {
    requireSaved(); if (builderDirty) throw new Error('Save your mock before loading the calibration contest');
    await request('/calibration/load', {});
    message('2025 admin calibration loaded; historical results locked, five fixtures scored.');
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
  document.getElementById('cloneAdminMockBtn').addEventListener('click', () => {
    const entry = state?.mocks.find(mock => mock.id === builderEntryId);
    if (!entry) { message('Select a saved entry to clone', true); return; }
    builderEntryId = ''; builderDirty = true;
    builderFrame.contentWindow.postMessage({ type: 'hush-mock-load', picks: entry.picks, locked: false }, location.origin);
    document.getElementById('mockBuilderName').value = `${entry.name} copy`; document.getElementById('mockBuilderRole').value = entry.role;
    renderBuilderControls(); updateActionState();
  });
  document.getElementById('saveAdminMockBtn').addEventListener('click', () => run(async () => {
    requireSaved();
    const mock = await readBuilderMock(); const name = document.getElementById('mockBuilderName').value.trim();
    if (!name) throw new Error('Name your mock before saving');
    await request('/entry/save', { mock: { ...mock, id: builderEntryId || undefined, name, role: document.getElementById('mockBuilderRole').value } });
    if (!builderEntryId) builderEntryId = state.mocks.at(-1).id;
    builderDirty = false; loadBuilderEntry(); message('Mock draft saved to the contest; submit it to enter the leaderboards');
  }));
  document.getElementById('submitAdminMockBtn').addEventListener('click', () => run(async () => {
    requireSaved(); if (builderDirty) throw new Error('Save your latest mock changes before submitting');
    if (!window.confirm('Submit this saved mock? Its predictions will be locked.')) return;
    await request('/entry/submit', { id: builderEntryId }); loadBuilderEntry(); message('Mock submitted; it will be scored against each active dataset independently');
  }));
})();