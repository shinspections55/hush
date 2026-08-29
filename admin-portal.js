document.addEventListener('DOMContentLoaded', () => {
  const POSITIONS = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];
  const BOARD_POSITIONS = ['TOP', ...POSITIONS];
  const ADMIN_TIER_INSERT_MODE_KEY = 'adminRankingsTierInsertMode';
  const ADMIN_KEY_STORAGE_KEY = 'adminApiKey';
  const DATABASE_RANKINGS_SET_KEY = 'databaseRankingsSet';
  const DEFAULT_DATABASE_MIN_DRAFTS = 30;
  const AJ_ROUND_CODES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
  const AJ_REVERSED_START_POSITIONS = new Set(['WR', 'TE', 'K']);
  const ADMIN_CPU_TUNING_KEY = 'adminCpuTuningPreset';
  const ADMIN_CPU_MODELS_KEY = 'adminCpuTuningModels';

  // Detect which page we're on
  const isRankingsManagerPage = document.body.classList.contains('admin-rankings-manager-page');
  const isPortalPage = document.body.classList.contains('admin-portal-page');
  const isCpuTuningPage = document.body.classList.contains('admin-cpu-tuning-page');

  const keyInput = document.getElementById('adminKeyInput');
  const connectForm = document.getElementById('adminConnectForm');
  const connectStatus = document.getElementById('adminConnectStatus');
  const connectBtn = connectForm ? connectForm.querySelector('button[type="submit"]') : null;
  const refreshOverviewBtn = document.getElementById('refreshOverviewBtn');
  const toggleRawOverviewBtn = document.getElementById('toggleRawOverviewBtn');
  const overviewOutput = document.getElementById('adminOverviewOutput');
  const overviewCharts = document.getElementById('adminOverviewCharts');
  const metricUptime = document.getElementById('metricUptime');
  const metricTotalRequests = document.getElementById('metricTotalRequests');
  const metricAuthUsers = document.getElementById('metricAuthUsers');
  const metricSignedUpEmails = document.getElementById('metricSignedUpEmails');
  const metricPremiumUsers = document.getElementById('metricPremiumUsers');
  const metricDefaultRankings = document.getElementById('metricDefaultRankings');
  const metricDatabaseProgress = document.getElementById('metricDatabaseProgress');
  const metricDatabaseProgressDetail = document.getElementById('metricDatabaseProgressDetail');
  const methodChart = document.getElementById('adminMethodChart');
  const statusChart = document.getElementById('adminStatusChart');
  const topPathsChart = document.getElementById('adminTopPathsChart');
  const silentCpuReference = document.getElementById('silentCpuReference');
  const tiedCpuReference = document.getElementById('tiedCpuReference');
  const cpuTuningControls = document.getElementById('cpuTuningControls');
  const cpuTuningDebugOutput = document.getElementById('cpuTuningDebugOutput');
  const cpuTuningDebugMeta = document.getElementById('cpuTuningDebugMeta');
  const cpuTuningStatus = document.getElementById('cpuTuningStatus');
  const cpuPreviewOutput = document.getElementById('cpuPreviewOutput');
  const cpuLoadDefaultsBtn = document.getElementById('cpuLoadDefaultsBtn');
  const cpuSavePresetBtn = document.getElementById('cpuSavePresetBtn');
  const cpuResetPresetBtn = document.getElementById('cpuResetPresetBtn');
  const cpuRunPreviewBtn = document.getElementById('cpuRunPreviewBtn');
  const cpuRunSimulationBtn = document.getElementById('cpuRunSimulationBtn');
  const cpuSimDraftCountInput = document.getElementById('cpuSimDraftCountInput');
  const cpuSimTeamCountInput = document.getElementById('cpuSimTeamCountInput');
  const cpuSimRoundsInput = document.getElementById('cpuSimRoundsInput');
  const cpuSimPlayersPerRoundInput = document.getElementById('cpuSimPlayersPerRoundInput');
  const cpuSimulationOutput = document.getElementById('cpuSimulationOutput');
  const cpuModelNameInput = document.getElementById('cpuModelNameInput');
  const cpuModelSelect = document.getElementById('cpuModelSelect');
  const cpuSaveNamedModelBtn = document.getElementById('cpuSaveNamedModelBtn');
  const cpuLoadNamedModelBtn = document.getElementById('cpuLoadNamedModelBtn');
  const cpuCompareNamedModelBtn = document.getElementById('cpuCompareNamedModelBtn');
  const cpuDeleteNamedModelBtn = document.getElementById('cpuDeleteNamedModelBtn');
  const cpuSaveToServerBtn = document.getElementById('cpuSaveToServerBtn');
  const cpuLoadFromServerBtn = document.getElementById('cpuLoadFromServerBtn');
  const cpuModelList = document.getElementById('cpuModelList');
  const cpuModelDetailsMeta = document.getElementById('cpuModelDetailsMeta');
  const cpuModelDetails = document.getElementById('cpuModelDetails');
  const cpuModelCompareMeta = document.getElementById('cpuModelCompareMeta');
  const cpuModelCompareOutput = document.getElementById('cpuModelCompareOutput');
  const cpuProfileImpactTable = document.getElementById('cpuProfileImpactTable');
  const cpuProfileImpactSummary = document.getElementById('cpuProfileImpactSummary');
  const cpuLogicSourceMeta = document.getElementById('cpuLogicSourceMeta');
  let adminSessionKey = '';

  function getStoredAdminKey() {
    try {
      return String(sessionStorage.getItem(ADMIN_KEY_STORAGE_KEY) || '').trim();
    } catch (_error) {
      return '';
    }
  }

  function getAdminKey() {
    const typedKey = String(keyInput?.value || '').trim();
    return typedKey || adminSessionKey || getStoredAdminKey();
  }

  function restoreAdminKey() {
    try {
      localStorage.removeItem(ADMIN_KEY_STORAGE_KEY);
    } catch (_error) {
      // ignore
    }
    adminSessionKey = getStoredAdminKey();
    if (keyInput) keyInput.value = '';
  }

  function clearStoredAdminKey() {
    try {
      localStorage.removeItem(ADMIN_KEY_STORAGE_KEY);
    } catch (_error) {
      // ignore
    }
    try {
      sessionStorage.removeItem(ADMIN_KEY_STORAGE_KEY);
    } catch (_error) {
      // ignore
    }
    if (keyInput) keyInput.value = '';
    adminSessionKey = '';
  }

  function promoteTypedAdminKeyToSession() {
    const typedKey = String(keyInput?.value || '').trim();
    if (!typedKey) return;
    adminSessionKey = typedKey;
    try {
      sessionStorage.setItem(ADMIN_KEY_STORAGE_KEY, typedKey);
    } catch (_error) {
      // ignore
    }
    if (keyInput) keyInput.value = '';
  }

  function parseRankingsPositionFromHash() {
    const rawHash = String(window.location.hash || '').replace(/^#/, '').trim();
    if (!rawHash) return null;
    const upperHash = rawHash.toUpperCase();
    if (upperHash.startsWith('RANKINGS-')) {
      const requested = upperHash.slice('RANKINGS-'.length);
      if (BOARD_POSITIONS.includes(requested)) return requested;
      return null;
    }
    if (BOARD_POSITIONS.includes(upperHash)) return upperHash;
    return null;
  }

  function updateRankingsHash(position) {
    const safePosition = String(position || '').trim().toUpperCase();
    if (!BOARD_POSITIONS.includes(safePosition)) return;
    const nextHash = `#rankings-${safePosition}`;
    if (window.location.hash === nextHash) return;
    try {
      window.history.replaceState(null, '', nextHash);
    } catch (_error) {
      window.location.hash = nextHash;
    }
  }

  // Only load rankings elements if on the rankings manager page
  const loadRankingsBtn = isRankingsManagerPage ? document.getElementById('loadRankingsBtn') : null;
  const tierInsertModeBtn = isRankingsManagerPage ? document.getElementById('tierInsertModeBtn') : null;
  const saveRankingsLayoutBtn = isRankingsManagerPage ? document.getElementById('saveRankingsLayoutBtn') : null;
  const saveJsonFileBtn = isRankingsManagerPage ? document.getElementById('saveJsonFileBtn') : null;
  const syncTopPositionSelect = isRankingsManagerPage ? document.getElementById('syncTopPositionSelect') : null;
  const syncTopPositionOrderBtn = isRankingsManagerPage ? document.getElementById('syncTopPositionOrderBtn') : null;
  const clearTierBreaksBtn = isRankingsManagerPage ? document.getElementById('clearTierBreaksBtn') : null;
  const clearTopBoardBtn = isRankingsManagerPage ? document.getElementById('clearTopBoardBtn') : null;
  const undoRankingsEditBtn = isRankingsManagerPage ? document.getElementById('undoRankingsEditBtn') : null;
  const resetUnsavedBtn = isRankingsManagerPage ? document.getElementById('resetUnsavedBtn') : null;
  const rankingsSourceLabel = isRankingsManagerPage ? document.getElementById('rankingsSourceLabel') : null;
  const addPlayerForm = isRankingsManagerPage ? document.getElementById('addPlayerForm') : null;
  const removePlayerForm = isRankingsManagerPage ? document.getElementById('removePlayerForm') : null;
  const rankingsActionStatus = isRankingsManagerPage ? document.getElementById('rankingsActionStatus') : null;
  const positionTabs = isRankingsManagerPage ? document.getElementById('adminPositionTabs') : null;
  const tierBoard = isRankingsManagerPage ? document.getElementById('adminTierBoard') : null;
  const jsonSaveBanner = isRankingsManagerPage ? document.getElementById('jsonSaveBanner') : null;
  const jsonSaveBannerText = isRankingsManagerPage ? document.getElementById('jsonSaveBannerText') : null;
  const dismissJsonSaveBannerBtn = isRankingsManagerPage ? document.getElementById('dismissJsonSaveBannerBtn') : null;

  let activePosition = parseRankingsPositionFromHash() || 'QB';
  let showingRawOverview = false;
  let positionPlayers = createEmptyBoards();
  let positionMeta = createEmptyBoards();
  let topPlayers = [];
  let topMeta = null;
  let topRankingsVersion = null;
  let dragSourceIndex = -1;
  let isLayoutDirty = false;
  let isRankingsSaveInFlight = false;
  let undoStack = [];
  let jsonSaveBannerTimer = null;
  let easyTierInsertMode = false;
  let cpuTuningState;
  let cpuNamedModels = {};
  let activeCpuModelName = '';
  let previousProfileImpactSnapshot = {};
  let activeCpuLogicSourceFile = 'cpu-logic.json';
  let cpuSaveToServerResetTimer = null;
  let cpuLoadSelectedResetTimer = null;

  const cpuSilentProfiles = [
    { name: 'Balanced', aggression: 1.15, valueHunter: 0.92, sleeperHunter: 0.95, starsAndScrubs: 1.18, QB: 0.95, RB: 1.15, WR: 1.0, TE: 0.95, K: 0.85, DEF: 0.9 },
    { name: 'Value', aggression: 0.94, valueHunter: 1.15, sleeperHunter: 1.12, starsAndScrubs: 0.9, QB: 1.0, RB: 0.95, WR: 1.08, TE: 1.0, K: 0.95, DEF: 0.95 },
    { name: 'Sleeper', aggression: 1.02, valueHunter: 1.0, sleeperHunter: 1.25, starsAndScrubs: 0.96, QB: 0.92, RB: 1.0, WR: 1.15, TE: 1.08, K: 0.95, DEF: 0.9 },
    { name: 'Stars & Scrubs', aggression: 1.08, valueHunter: 0.98, sleeperHunter: 1.0, starsAndScrubs: 1.08, QB: 1.08, RB: 0.94, WR: 1.0, TE: 1.12, K: 0.9, DEF: 1.0 },
    { name: 'Conservative', aggression: 0.9, valueHunter: 1.18, sleeperHunter: 1.08, starsAndScrubs: 0.88, QB: 1.0, RB: 1.05, WR: 0.96, TE: 1.0, K: 1.0, DEF: 1.05 }
  ];

  const cpuTiedProfiles = [
    { name: 'Calm', aggression: 0.84, patience: 1.2, fear: 1.25, ego: 0.88, discipline: 1.25, desperation: 0.92 },
    { name: 'Bulldog', aggression: 1.22, patience: 0.82, fear: 0.82, ego: 1.24, discipline: 0.82, desperation: 1.15 },
    { name: 'Patient', aggression: 0.96, patience: 1.28, fear: 0.96, ego: 0.92, discipline: 1.35, desperation: 0.9 },
    { name: 'Balanced', aggression: 1.08, patience: 1.0, fear: 1.05, ego: 1.1, discipline: 0.96, desperation: 1.0 },
    { name: 'Anxious', aggression: 0.92, patience: 0.95, fear: 1.12, ego: 1.04, discipline: 1.12, desperation: 1.2 }
  ];

  const cpuSilentBidRanges = {
    QB: { '1-5': { min: 0.65, max: 1.65 }, '5-10': { min: 0.7, max: 1.45 }, '10-20': { min: 0.75, max: 1.45 }, '20-30': { min: 0.8, max: 1.35 }, '30-40': { min: 0.85, max: 1.25 } },
    RB: { '1-5': { min: 0.65, max: 1.65 }, '5-10': { min: 0.7, max: 1.65 }, '10-20': { min: 0.75, max: 1.55 }, '20-30': { min: 0.75, max: 1.45 }, '30-40': { min: 0.75, max: 1.35 }, '40-50': { min: 0.75, max: 1.25 }, '50-60': { min: 0.75, max: 1.15 }, '60+': { min: 0.75, max: 1.1 } },
    WR: { '1-5': { min: 0.65, max: 1.65 }, '5-10': { min: 0.7, max: 1.65 }, '10-20': { min: 0.75, max: 1.55 }, '20-30': { min: 0.75, max: 1.45 }, '30-40': { min: 0.75, max: 1.35 }, '40-50': { min: 0.75, max: 1.25 }, '50-60': { min: 0.75, max: 1.15 }, '60+': { min: 0.75, max: 1.1 } },
    TE: { '1-5': { min: 0.65, max: 1.4 }, '5-10': { min: 0.65, max: 1.3 }, '10-20': { min: 0.7, max: 1.2 }, '20-30': { min: 0.7, max: 1.15 }, '30-40': { min: 0.7, max: 1.1 } }
  };

  const cpuTuningDefaults = {
    silent: {
      baseAggression: 0.5,
      budgetRichBonus: 0.2,
      budgetPoorPenalty: -0.2,
      rosterTightBonus: 0.15,
      rosterLoosePenalty: -0.1,
      missingStarterBonus: 0.18,
      finalFillBonus: 0.22,
      earlyRoundPenalty: -0.08,
      richEarlyBonusMax: 0.32,
      midRoundVarianceMax: 0.2,
      lateRoundVarianceMax: 0.4,
      personalityVarianceStep: 0.1,
      roundVarianceMax: 0.15,
      maxAggressionCap: 0.95,
      finalRoundSpreadStart: 10,
      mustFillBypassStartRound: 2,
      paceGraceRounds: 1,
      affordabilityTradeDownEnabled: true,
      avParticipationCurveEnabled: true,
      cheapFillerBidFrequency: 0.5,
      curve1to9HardMaxBidders: 4,
      curve10to19HardMaxBidders: 5,
      curve20to29HardMaxBidders: 6,
      curve30to39HardMaxBidders: 7,
      curve40to49HardMaxBidders: 8,
      curve50PlusHardMaxBidders: 8,
      draftChanceNeedDropPerNeedRatio: 0.2,
      draftChancePressureDropScale: 0.02,
      earlyInterestHoldMaxPressure: 6.5,
      earlyInterestHoldPaceTolerance: 0.05,
      earlyInterestHoldUntilRound: 8,
      earlyRoundAvCeilingMultiplier: 1.15,
      earlyRoundAvFloorMultiplier: 0.85,
      earlyRoundCoverageEnabled: true,
      earlyRoundRefillEnabled: true,
      earlyRoundVolumeBidsEnabled: true,
      earlyTopRankFocusEnabled: true,
      legacyAvDrivenMaxRound: 4,
      legacyAvDrivenMode: false,
      maxTiesPerRound: 5,
      midRoundLowAvHardCap: 3,
      reserveDraftChanceExponent: 3,
      reserveTargetWins: 17,
      reserveTargetWinsNoise: 3,
      reserveUpsetRoundRate: 0.16,
      spreadBidCap: 8,
      spreadFillerBidMax: 3,
      targetPlayerOverbidMax: 1.15,
      targetPlayerOverbidMin: 1.05,
      trueZeroAvParticipationMultiplier: 0.6,
      commitmentFinalPass: true,
      simulationReserveEnabled: false,
      lowballIntensity: 0.65,
      commitmentMode: 'B',
      marketSensitivity: 0.7,
      band10to19NoBidChance: 0.25,
      band1to9MinTeamPct: 0.1,
      band1to9MaxTeamPct: 0.3,
      band1to9HardMaxTeamPct: 0.45,
      band10to19MinTeamPct: 0.15,
      band10to19MaxTeamPct: 0.3,
      band10to19HardMaxTeamPct: 0.5,
      band20to29MinTeamPct: 0.25,
      band20to29MaxTeamPct: 0.4,
      band20to29HardMaxTeamPct: 0.65,
      band30to39MinTeamPct: 0.35,
      band30to39MaxTeamPct: 0.55,
      band30to39HardMaxTeamPct: 0.75,
      band40to49MinTeamPct: 0.4,
      band40to49MaxTeamPct: 0.6,
      band40to49PullChance: 0.84,
      band50PlusMinTeamPct: 0.4,
      band50PlusMaxTeamPct: 0.6,
      band50PlusPullChance: 0.9,
      bandDefaultPullChance: 0.75,
      topAvHardMaxTeamPct: 0.8,
      topAvPreferredBandPullChance: 0.8,
      trueZeroAvNoBidPenalty: 0.16,
      cpuRosterTargetBonus: 2,
      globalInterestThresholdScale: 1.25,
      globalInterestThresholdCap: 0.95,
      earlyTopRankFocusMaxRound: 3,
      earlyTopRankFocusMaxRank: 180,
      volumeBidsStartRound: 9,
      spreadModeIntensity: 0.32,
      spreadPaceTriggerVariance: -0.5,
      spreadBudgetPerSpotTrigger: 30,
      starTargetAggressionBoost: 0.6,
      starTargetLowballReduction: 0.4,
      avCenteringStrength: 0.58,
      avConvergenceWindow: 5,
      avConvergenceEliteWindow: 7,
      avMarketDepthEnabled: true,
      avMarketDepthMinAv: 12,
      coverageAddCap: 8,
      commitmentVariationFloor: 0.12,
      commitmentBidWeightCap: 5,
      coverageDraftChanceFloor: 0.75,
      kickerDefensePatienceEnabled: true,
      kickerDefenseTopRankTarget: 12,
      kickerDefensePatienceReleaseRound: 9,
      kickerDefenseUpgradeRankGap: 6,
      lateRoundPaceThresholdHitEnabled: true,
      lateRoundPaceThresholdStartRound: 6,
      lateRoundPaceThresholdPerRoundHit: 0.04,
      lateRoundPaceThresholdMaxHit: 0.16,
      lateRoundBudgetForcingIntensity: 0.9,
      paceCatchBidIntensity: 0.9,
      affordabilityOverAvBudgetCap: 0.55,
      midRoundLikelyDraftedMinAV: 3,
      midRoundLikelyDraftedDraftChanceFloor: 0.2,
      earlyAvAccuracyStrength: 0.9,
      avPriceAccuracyStart: 0.94,
      avPriceAccuracyMid: 0.88,
      avPriceAccuracyEnd: 0.75,
      avPriceAccuracyHoldRounds: 6,
      avMarketDepthMaxRound: 10,
      rosterExtraSpots: 6,
      upgradeBudgetFloor: 15,
      commitmentRangeBelowTargetPct: 0.15,
      commitmentRangeAboveTargetPct: 0.10,
      commitmentRangeCenterBandPct: 0.03,
      commitmentRangeLowTeamPct: 0.20,
      commitmentRangeHighTeamPct: 0.20,
      commitmentRangeLockFinalRounds: 2,
      round1ThresholdBias: 0.22,
      round2ThresholdBias: 0.20,
      round3ThresholdBias: 0.18,
      round4ThresholdBias: 0.15,
      round5ThresholdBias: 0.12,
      round6ThresholdBias: -0.04,
      round7ThresholdBias: -0.07,
      round8ThresholdBias: -0.09,
      round9ThresholdBias: -0.11,
      round10ThresholdBias: -0.13,
      roundThresholdBiasScale: 45,
      draftChancePriorityWeight: 1.0,
      
      draftChancePriorityThreshold: 0.60,
      draftChancePrimaryBaseFloor: 0.55,
      draftChancePrimaryMinFloor: 0.25,
      draftChanceLowBidCapPct: 0.15,
      
      draftChancePrimaryEnabled: 1,
      earlyRoundMaxBidsCap: 8,
      globalBidVolumeMultiplier: 1,
      spreadBidVolumeMultiplier: 1.0,
      spreadDollarBidMultiplier: 0.75,
      undraftedCap: 7,
      undraftedCapNoise: 3,
      lateRoundAggressionDampener: 0.55,
      spreadDraftChanceFloor: 0.45,
      midRoundLikelyDraftedOnlyEnabled: 0,
      rosterTightStartRound: 7,
      earlySelectiveMaxRound: 6,
      starterFillTargetRound: 8,
      earlyCheapSkipMaxRound: 5,
      earlyCheapAvThreshold: 8,
      earlyCheapSkipRate: 0.6,
      roundCommitR1Pct: 0.64,
      roundCommitR2Pct: 0.66,
      roundCommitR3Pct: 0.68,
      roundCommitR4Pct: 0.7,
      roundCommitR5Pct: 0.74,
      roundCommitR6Pct: 0.78,
      roundCommitR7Pct: 0.82,
      roundCommitR8Pct: 0.88,
      roundCommitR9Pct: 0.95,
      roundCommitR10Pct: 1.0,
      commitmentTiltMin: 0.82,
      commitmentTiltMax: 1.18,
      paceBandMinMultiplier: 0.80,
      paceBandMaxMultiplier: 1.16,
      paceBandTeamJitter: 0.7,
      avCapMult1to5: 1.24,
      avCapMult5to10: 1.2,
      avCapMult10to20: 1.16,
      avCapMult20to30: 1.12,
      avCapMult30to40: 1.1,
      avCapMult40to50: 1.08,
      avCapMult50to60: 1.07,
      avCapMult60Plus: 1.06,
      avCapBaseBuffer: 1,
      avCapLateRoundExtraBuffer: 1,
      curve1to9Bid1: 0.12,
      curve1to9Bid2: 0.42,
      curve1to9Bid3: 0.3,
      curve1to9Bid4: 0.11,
      curve1to9Bid5: 0.035,
      curve1to9Bid6: 0.01,
      curve1to9Bid7: 0.003,
      curve1to9Bid8: 0.001,
      curve10to19Bid1: 0.06,
      curve10to19Bid2: 0.36,
      curve10to19Bid3: 0.36,
      curve10to19Bid4: 0.15,
      curve10to19Bid5: 0.05,
      curve10to19Bid6: 0.015,
      curve10to19Bid7: 0.004,
      curve10to19Bid8: 0.001,
      curve20to29Bid1: 0.03,
      curve20to29Bid2: 0.24,
      curve20to29Bid3: 0.4,
      curve20to29Bid4: 0.2,
      curve20to29Bid5: 0.08,
      curve20to29Bid6: 0.03,
      curve20to29Bid7: 0.012,
      curve20to29Bid8: 0.004,
      curve30to39Bid1: 0.02,
      curve30to39Bid2: 0.16,
      curve30to39Bid3: 0.32,
      curve30to39Bid4: 0.28,
      curve30to39Bid5: 0.13,
      curve30to39Bid6: 0.05,
      curve30to39Bid7: 0.02,
      curve30to39Bid8: 0.01,
      curve40to49Bid1: 0.02,
      curve40to49Bid2: 0.08,
      curve40to49Bid3: 0.18,
      curve40to49Bid4: 0.36,
      curve40to49Bid5: 0.23,
      curve40to49Bid6: 0.09,
      curve40to49Bid7: 0.03,
      curve40to49Bid8: 0.01,
      curve50PlusBid1: 0.02,
      curve50PlusBid2: 0.04,
      curve50PlusBid3: 0.08,
      curve50PlusBid4: 0.2,
      curve50PlusBid5: 0.26,
      curve50PlusBid6: 0.24,
      curve50PlusBid7: 0.12,
      curve50PlusBid8: 0.04,
      band50PlusMinTeamPct: 0.4,
      band50PlusMaxTeamPct: 0.6,
      band40to49MinTeamPct: 0.4,
      band40to49MaxTeamPct: 0.6,
      band30to39MinTeamPct: 0.35,
      band30to39MaxTeamPct: 0.55,
      band20to29MinTeamPct: 0.25,
      band20to29MaxTeamPct: 0.4,
      band10to19MinTeamPct: 0.15,
      band10to19MaxTeamPct: 0.3,
      band1to9MinTeamPct: 0.1,
      band1to9MaxTeamPct: 0.3,
      band1to9NoBidChance: 0.68,
      band10to19NoBidChance: 0.25,
      bandLowAvNoBidLateRoundRelief: 0.13,
      lowAvEarlyRoundNoBidBoost: 0.02,
      lowAvLateRoundReliefStartRound: 7,
      lowAvCompletionGuardEnabled: 1,
      lowAvCompletionGuardStartRound: 7,
      lowAvCompletionGuardMinRosterRatio: 0.8,
      lowAvCompletionGuardMinBidders: 1,
      band50PlusPullChance: 0.9,
      band40to49PullChance: 0.84,
      bandDefaultPullChance: 0.75,
      topAvHardMaxTeamPct: 0.8,
      topAvPreferredBandPullChance: 0.8,
      avMarketDepthMaxPlayersPerRound: 7,
      avMarketDepthFinalPass: true,
      earlyRoundBidCoverageCapEnabled: true,
      earlyRoundBidCoverageCapMaxRound: 10,
      roundUndraftedTargetEarly: 3,
      roundUndraftedTargetLate: 10,
      roundUndraftedFloor: 2,
      roundUndraftedCeiling: 11,
      bidCoverageCapJitter: 4,
      avMarketDepthMinCompetitiveBids: 4,
      avMarketDepthMinBidMultiplier: 0.88,
      avMarketDepthBidLowMultiplier: 0.9,
      avMarketDepthBidHighMultiplier: 1.04
    },
    tied: {
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
      backoutBase: 0.08,
      backoutAggressionScale: 0.35,
      clockBoost: 1.04
    },
    scenario: {
      profileIndex: 0,
      tiedProfileIndex: 3,
      position: 'WR',
      avgValue: 30,
      round: 5,
      budgetRemaining: 85,
      currentBid: 21,
      playerAV: 24,
      timeLeft: 3,
      teamsRemaining: 6,
      positionNeed: 0.5,
      rosterSpotsLeft: 6,
      playersNeededForMinimum: 2,
      currentBidRatio: 1
    }
  };

  const BUILTIN_CPU_MODELS = {
    'Version 4.0': {
      silent: {
        paceGraceRounds: 1,
        rosterExtraSpots: 8,
        cpuRosterTargetBonus: 2,
        upgradeBudgetFloor: 8,
        earlyAvAccuracyStrength: 0.9,
        avPriceAccuracyStart: 0.94,
        avPriceAccuracyMid: 0.88,
        avPriceAccuracyEnd: 0.75,
        avPriceAccuracyHoldRounds: 6,
        avMarketDepthEnabled: true,
        avMarketDepthFinalPass: true,
        avMarketDepthMaxRound: 10,
        avMarketDepthMinAv: 12,
        avMarketDepthMinBidMultiplier: 0.88,
        avMarketDepthMinCompetitiveBids: 4,
        avMarketDepthMaxPlayersPerRound: 7,
        avMarketDepthBidLowMultiplier: 0.9,
        avMarketDepthBidHighMultiplier: 1.04,
        earlyRoundBidCoverageCapEnabled: true,
        earlyRoundBidCoverageCapMaxRound: 10,
        roundUndraftedTargetEarly: 6,
        roundUndraftedTargetLate: 6,
        roundUndraftedFloor: 4,
        roundUndraftedCeiling: 11,
        bidCoverageCapJitter: 3,
        draftChancePriorityThreshold: 0.45,
        draftChanceLowBidCapPct: 0.45,
        
        kickerDefensePatienceEnabled: true,
        kickerDefenseTopRankTarget: 12,
        kickerDefensePatienceReleaseRound: 9,
        kickerDefenseUpgradeRankGap: 6,
        spreadModeIntensity: 0.32,
        spreadPaceTriggerVariance: -0.5,
        spreadBudgetPerSpotTrigger: 30,
        band1to9NoBidChance: 0.3,
        lowAvEarlyRoundNoBidBoost: 0.05,
        commitmentFinalPass: true,
        commitmentRangeBelowTargetPct: 0.15,
        commitmentRangeAboveTargetPct: 0.1,
        roundCommitR1Pct: 0.64,
        roundCommitR2Pct: 0.66,
        roundCommitR3Pct: 0.68,
        roundCommitR4Pct: 0.7,
        roundCommitR5Pct: 0.74,
        roundCommitR6Pct: 0.78,
        roundCommitR7Pct: 0.82,
        roundCommitR8Pct: 0.88,
        roundCommitR9Pct: 0.95,
        roundCommitR10Pct: 1.0,
        finalRoundSpreadStart: 10,
        mustFillBypassStartRound: 2,
        globalBidVolumeMultiplier: 0.82,
        earlyRoundMaxBidsCap: 5,
        lateRoundAggressionDampener: 0.55,
        round1ThresholdBias: 0.22,
        roundThresholdBiasScale: 45,
        earlySelectiveMaxRound: 6,
        paceBandMinMultiplier: 0.8,
        paceBandMaxMultiplier: 1.16,
        paceBandTeamJitter: 0.7
      }
    },
    'Version 3.0': {
      silent: {
        paceGraceRounds: 1,
        rosterExtraSpots: 8,
        cpuRosterTargetBonus: 2,
        upgradeBudgetFloor: 8,
        earlyAvAccuracyStrength: 0.9,
        avPriceAccuracyStart: 0.94,
        avPriceAccuracyMid: 0.88,
        avPriceAccuracyEnd: 0.75,
        avPriceAccuracyHoldRounds: 6,
        avMarketDepthEnabled: true,
        avMarketDepthFinalPass: true,
        avMarketDepthMaxRound: 10,
        avMarketDepthMinAv: 12,
        
        avMarketDepthMinBidMultiplier: 0.88,
        avMarketDepthMinCompetitiveBids: 4,
        avMarketDepthMaxPlayersPerRound: 7,
        avMarketDepthBidLowMultiplier: 0.9,
        avMarketDepthBidHighMultiplier: 1.04,
        earlyRoundBidCoverageCapEnabled: true,
        earlyRoundBidCoverageCapMaxRound: 10,
        roundUndraftedTargetEarly: 6,
        roundUndraftedTargetLate: 10,
        roundUndraftedFloor: 4,
        roundUndraftedCeiling: 11,
        kickerDefensePatienceReleaseRound: 8,
        band1to9NoBidChance: 0.3,
        lowAvEarlyRoundNoBidBoost: 0.05,
        bidCoverageCapJitter: 3,
        finalRoundSpreadStart: 10,
        mustFillBypassStartRound: 2,
        globalInterestThresholdScale: 1.25,
        globalInterestThresholdCap: 0.95,
        earlyInterestHoldUntilRound: 8,
        earlyInterestHoldMaxPressure: 6.5,
        earlyTopRankFocusMaxRound: 4,
        earlyTopRankFocusMaxRank: 120,
        earlyRoundMaxBidsCap: 5,
        globalBidVolumeMultiplier: 0.82,
        spreadBidVolumeMultiplier: 0.52,
        spreadDollarBidMultiplier: 0.4,
        volumeBidsStartRound: 9,
        spreadModeIntensity: 0.32,
        spreadPaceTriggerVariance: -0.5,
        spreadBudgetPerSpotTrigger: 30,
        avCenteringStrength: 0.58,
        kickerDefensePatienceEnabled: true,
        kickerDefenseTopRankTarget: 12,
        kickerDefensePatienceReleaseRound: 9,
        kickerDefenseUpgradeRankGap: 6,
        
        draftChancePriorityThreshold: 0.45,
        coverageDraftChanceFloor: 0.75,
        lateRoundAggressionDampener: 0.55,
        round1ThresholdBias: 0.22,
        roundThresholdBiasScale: 45,
        earlySelectiveMaxRound: 6,
        undraftedCap: 7,
        undraftedCapNoise: 3,
        paceBandMinMultiplier: 0.8,
        paceBandMaxMultiplier: 1.16,
        paceBandTeamJitter: 0.7
      }
    },
    'Version A': {
      silent: {
        globalInterestThresholdScale: 1.25,
        globalInterestThresholdCap: 0.95,
        earlyInterestHoldUntilRound: 8,
        earlyInterestHoldMaxPressure: 6.5,
        earlyTopRankFocusMaxRound: 4,
        earlyTopRankFocusMaxRank: 120,
        earlyRoundMaxBidsCap: 5,
        globalBidVolumeMultiplier: 0.82,
        spreadBidVolumeMultiplier: 0.52,
        spreadDollarBidMultiplier: 0.4,
        volumeBidsStartRound: 9,
        draftChancePrimaryBaseFloor: 0.82,
        draftChancePrimaryMinFloor: 0.62,
        coverageAddCap: 4,
        coverageDraftChanceFloor: 0.75,
        starTargetAggressionBoost: 0.6,
        starTargetLowballReduction: 0.4,
        spreadModeIntensity: 0.32
      }
    },
    'Version B': {
      silent: {
        globalInterestThresholdScale: 1.32,
        globalInterestThresholdCap: 0.96,
        earlyInterestHoldUntilRound: 8,
        earlyInterestHoldMaxPressure: 5.5,
        earlyTopRankFocusMaxRound: 5,
        earlyTopRankFocusMaxRank: 100,
        earlyRoundMaxBidsCap: 4,
        globalBidVolumeMultiplier: 0.76,
        spreadBidVolumeMultiplier: 0.45,
        spreadDollarBidMultiplier: 0.32,
        volumeBidsStartRound: 9,
        draftChancePrimaryBaseFloor: 0.86,
        draftChancePrimaryMinFloor: 0.66,
        coverageAddCap: 3,
        coverageDraftChanceFloor: 0.8,
        starTargetAggressionBoost: 0.68,
        starTargetLowballReduction: 0.48,
        spreadModeIntensity: 0.24
      }
    }
  };

  cpuTuningState = loadCpuTuningPreset();
  cpuNamedModels = loadCpuNamedModels();

  function ensureBuiltinCpuNamedModels() {
    let changed = false;
    const now = Date.now();

    Object.entries(BUILTIN_CPU_MODELS).forEach(([name, configPatch]) => {
      const modelName = String(name || '').trim();
      if (!modelName || cpuNamedModels[modelName]) return;

      cpuNamedModels[modelName] = {
        modelName,
        createdAt: now,
        updatedAt: now,
        config: mergeDeep(deepClone(cpuTuningDefaults), configPatch || {})
      };
      changed = true;
    });

    if (changed) {
      saveCpuNamedModels(cpuNamedModels);
    }
  }

  ensureBuiltinCpuNamedModels();

  function createEmptyBoards() {
    return POSITIONS.reduce((acc, pos) => {
      acc[pos] = null;
      return acc;
    }, {});
  }

  function isTopView(position = activePosition) {
    return position === 'TOP';
  }

  function loadTierInsertModePreference() {
    try {
      easyTierInsertMode = localStorage.getItem(ADMIN_TIER_INSERT_MODE_KEY) === 'easy';
    } catch (_error) {
      easyTierInsertMode = false;
    }
  }

  function saveTierInsertModePreference() {
    try {
      localStorage.setItem(ADMIN_TIER_INSERT_MODE_KEY, easyTierInsertMode ? 'easy' : 'classic');
    } catch (_error) {
      // ignore
    }
  }

  function applyTierInsertMode() {
    if (!tierInsertModeBtn) return;
    tierInsertModeBtn.textContent = `Easy Tier Breaks: ${easyTierInsertMode ? 'On' : 'Off'}`;
    tierInsertModeBtn.classList.toggle('admin-tier-toggle-active', easyTierInsertMode);
    tierInsertModeBtn.setAttribute('aria-pressed', easyTierInsertMode ? 'true' : 'false');
    tierInsertModeBtn.title = easyTierInsertMode
      ? 'Always show the between-player tier break buttons.'
      : 'Use the rankings board without always-visible tier break buttons.';
  }

  function toggleTierInsertMode() {
    easyTierInsertMode = !easyTierInsertMode;
    saveTierInsertModePreference();
    applyTierInsertMode();
    renderActiveBoard();
  }

  function cloneData(value) {
    if (typeof structuredClone === 'function') {
      return structuredClone(value);
    }
    return JSON.parse(JSON.stringify(value));
  }

  function updateUndoButtonState() {
    if (undoRankingsEditBtn) {
      undoRankingsEditBtn.disabled = undoStack.length === 0;
    }
  }

  function updateTopClearButtonState() {
    if (!clearTopBoardBtn) return;
    clearTopBoardBtn.disabled = !isTopView() || !Array.isArray(topPlayers) || topPlayers.length === 0;
  }

  function hasAnyTierBreaks(players) {
    return Array.isArray(players) && players.some((player, index) => index > 0 && !!player.tierBreakBefore);
  }

  function updateClearTierBreaksButtonState() {
    if (!clearTierBreaksBtn) return;
    const players = getActivePlayers();
    clearTierBreaksBtn.disabled = !hasAnyTierBreaks(players);
  }

  function inferTierBreaks(players) {
    let lastTier = '';
    return (Array.isArray(players) ? players : []).map((player, index) => {
      const tierName = String(player.tier || '').trim();
      const nextPlayer = { ...player };
      nextPlayer.tierBreakBefore = index > 0 && !!tierName && tierName !== lastTier;
      lastTier = tierName || lastTier;
      return nextPlayer;
    });
  }

  function withPersistedTierLabels(players, boardKey = activePosition) {
    let tierNumber = 1;
    return (Array.isArray(players) ? players : []).map((player, index) => {
      if (index > 0 && player.tierBreakBefore) {
        tierNumber += 1;
      }
      return {
        ...player,
        tierBreakBefore: index > 0 ? !!player.tierBreakBefore : false,
        tier: boardKey === 'TOP' ? `Tier ${tierNumber}` : `${boardKey} Tier ${tierNumber}`
      };
    });
  }

  function averageNeighborMetric(previousValue, nextValue, fallback = 0, options = {}) {
    const hasPrevious = Number.isFinite(previousValue);
    const hasNext = Number.isFinite(nextValue);

    let result = fallback;
    if (hasPrevious && hasNext) {
      result = (previousValue + nextValue) / 2;
    } else if (hasPrevious) {
      result = previousValue;
    } else if (hasNext) {
      result = nextValue;
    }

    if (options.round) {
      result = Math.round(result);
    }
    if (Number.isFinite(options.min)) {
      result = Math.max(options.min, result);
    }
    if (Number.isFinite(options.max)) {
      result = Math.min(options.max, result);
    }

    return result;
  }

  function getPlayerDraftChance(player, fallback = 0) {
    if (!player || typeof player !== 'object') return fallback;
    const candidate = Number(
      player.draftChance ??
      player.draftPercent ??
      player.draftedPercent ??
      player.draftedPercentage
    );
    return Number.isFinite(candidate) ? candidate : fallback;
  }

  function setPlayerDraftChance(player, value) {
    if (!player || typeof player !== 'object') return;
    const normalized = Math.max(0, Math.min(100, Number(value) || 0));
    player.draftChance = normalized;

    // Keep legacy aliases synchronized when present in loaded payloads.
    if ('draftPercent' in player) player.draftPercent = normalized;
    if ('draftedPercent' in player) player.draftedPercent = normalized;
    if ('draftedPercentage' in player) player.draftedPercentage = normalized;
  }

  function normalizeDraftChanceField(player) {
    if (!player || typeof player !== 'object') return player;
    return {
      ...player,
      draftChance: getPlayerDraftChance(player, 0)
    };
  }

  function autoAdjustMovedPlayerMetrics(players, movedIndex) {
    if (isTopView() || !Array.isArray(players) || movedIndex < 0 || movedIndex >= players.length) return;

    const movedPlayer = players[movedIndex];
    if (!movedPlayer) return;

    const previousPlayer = movedIndex > 0 ? players[movedIndex - 1] : null;
    const nextPlayer = movedIndex < players.length - 1 ? players[movedIndex + 1] : null;

    movedPlayer.avgValue = averageNeighborMetric(
      previousPlayer ? Number(previousPlayer.avgValue) : NaN,
      nextPlayer ? Number(nextPlayer.avgValue) : NaN,
      Number(movedPlayer.avgValue || 0),
      { round: true, min: 0 }
    );

    const adjustedDraftChance = averageNeighborMetric(
      previousPlayer ? getPlayerDraftChance(previousPlayer, NaN) : NaN,
      nextPlayer ? getPlayerDraftChance(nextPlayer, NaN) : NaN,
      getPlayerDraftChance(movedPlayer, 0),
      { round: true, min: 0, max: 100 }
    );
    setPlayerDraftChance(movedPlayer, adjustedDraftChance);
  }

  function clearUndoHistory() {
    undoStack = [];
    updateUndoButtonState();
  }

  function pushUndoSnapshot() {
    undoStack.push({
      activePosition,
      positionPlayers: cloneData(positionPlayers),
      positionMeta: cloneData(positionMeta),
      topPlayers: cloneData(topPlayers),
      topMeta: cloneData(topMeta),
      isLayoutDirty
    });
    if (undoStack.length > 40) {
      undoStack.shift();
    }
    updateUndoButtonState();
  }

  function restoreUndoSnapshot(snapshot) {
    activePosition = snapshot.activePosition;
    positionPlayers = cloneData(snapshot.positionPlayers);
    positionMeta = cloneData(snapshot.positionMeta);
    topPlayers = cloneData(snapshot.topPlayers);
    topMeta = cloneData(snapshot.topMeta);
    setLayoutDirty(snapshot.isLayoutDirty);
    updateRankingsMeta(isTopView() ? topMeta : positionMeta[activePosition], getActivePlayers().length);
    renderActiveBoard();
    updateUndoButtonState();
  }

  function authHeaders() {
    return {
      'Content-Type': 'application/json',
      'x-admin-key': getAdminKey()
    };
  }

  async function validateAdminKey() {
    const adminKey = getAdminKey();
    if (!adminKey) {
      throw new Error('Enter the admin key.');
    }

    try {
      await requestJson('/api/admin/traffic', {
        headers: {
          'x-admin-key': adminKey
        }
      });
    } catch (error) {
      const message = String(error && error.message || 'Unauthorized');
      if (/unauthorized|401/i.test(message)) {
        clearStoredAdminKey();
        throw new Error('Invalid admin key.');
      }
      throw error;
    }
  }

  function setConnectStatus(message) {
    connectStatus.textContent = message;
  }

  function setConnectApproved(isApproved) {
    if (!connectBtn) return;
    connectBtn.classList.toggle('admin-connect-approved', !!isApproved);
    connectBtn.textContent = isApproved ? 'Connected' : 'Connect';
  }

  function setActionStatus(message) {
    if (rankingsActionStatus) {
      rankingsActionStatus.textContent = message;
    }
  }

  function hideJsonSaveCompletedAlert() {
    if (jsonSaveBannerTimer) {
      window.clearTimeout(jsonSaveBannerTimer);
      jsonSaveBannerTimer = null;
    }
    if (jsonSaveBanner) {
      jsonSaveBanner.classList.add('hidden');
    }
  }

  function showJsonSaveCompletedAlert(message) {
    if (!jsonSaveBanner || !jsonSaveBannerText) return;
    if (jsonSaveBannerTimer) {
      window.clearTimeout(jsonSaveBannerTimer);
    }
    jsonSaveBannerText.textContent = message;
    jsonSaveBanner.classList.remove('hidden');
    jsonSaveBannerTimer = window.setTimeout(() => {
      hideJsonSaveCompletedAlert();
    }, 7000);
  }

  function setLayoutDirty(dirty) {
    isLayoutDirty = !!dirty;
    if (saveRankingsLayoutBtn) {
      saveRankingsLayoutBtn.disabled = !isLayoutDirty;
    }
    if (saveJsonFileBtn) {
      saveJsonFileBtn.disabled = !isLayoutDirty;
    }
    updateUndoButtonState();
    updateTopClearButtonState();
    updateClearTierBreaksButtonState();
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatNumber(value) {
    const num = Number(value || 0);
    return Number.isFinite(num) ? num.toLocaleString() : '0';
  }

  function formatUptime(seconds) {
    const total = Math.max(0, Number(seconds || 0));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = Math.floor(total % 60);
    return `${h}h ${m}m ${s}s`;
  }

  function formatLastUpdatedText(lastUpdatedAt) {
    if (!lastUpdatedAt) return 'Unknown';
    const date = new Date(Number(lastUpdatedAt));
    return Number.isNaN(date.getTime()) ? 'Unknown' : date.toLocaleString();
  }

  function updateDatabaseProgressCard() {
    if (!metricDatabaseProgress || !metricDatabaseProgressDetail) return;

    let completedDraftCount = 0;
    let minDraftsRequired = DEFAULT_DATABASE_MIN_DRAFTS;
    let payloadDraftCount = 0;
    let generatedAt = 0;

    try {
      const completedDraftsRaw = localStorage.getItem('completedDrafts');
      const completedDrafts = completedDraftsRaw ? JSON.parse(completedDraftsRaw) : [];
      completedDraftCount = Array.isArray(completedDrafts) ? completedDrafts.length : 0;
    } catch (_error) {
      completedDraftCount = 0;
    }

    try {
      const payloadRaw = localStorage.getItem(DATABASE_RANKINGS_SET_KEY);
      const payload = payloadRaw ? JSON.parse(payloadRaw) : null;
      const parsedMinimum = Number.parseInt(payload && payload.minDraftsRequired, 10);
      if (Number.isFinite(parsedMinimum) && parsedMinimum > 0) {
        minDraftsRequired = parsedMinimum;
      }
      payloadDraftCount = Number.parseInt(payload && payload.completedDraftCount, 10) || 0;
      generatedAt = Number.parseInt(payload && payload.generatedAt, 10) || 0;
    } catch (_error) {
      payloadDraftCount = 0;
      generatedAt = 0;
    }

    const remaining = Math.max(0, minDraftsRequired - completedDraftCount);
    const pendingSinceLastSync = Math.max(0, completedDraftCount - payloadDraftCount);
    metricDatabaseProgress.textContent = `${completedDraftCount}/${minDraftsRequired} drafts`;

    if (remaining > 0) {
      metricDatabaseProgressDetail.textContent = `${remaining} draft${remaining === 1 ? '' : 's'} until the next DATABASE update.`;
      return;
    }

    if (pendingSinceLastSync > 0) {
      metricDatabaseProgressDetail.textContent = `Threshold reached. ${pendingSinceLastSync} new draft${pendingSinceLastSync === 1 ? '' : 's'} pending next DATABASE sync.`;
      return;
    }

    metricDatabaseProgressDetail.textContent = `DATABASE is up to date. Last generated: ${formatLastUpdatedText(generatedAt)}.`;
  }

  function getAjSlotCode(position, rankNumber) {
    const normalizedPosition = String(position || '').trim().toUpperCase();
    const normalizedRank = Number.parseInt(rankNumber, 10);
    const rankLimitByPosition = { QB: 25, RB: 70, WR: 80, TE: 25, K: 20, DEF: 20 };
    const rankLimit = rankLimitByPosition[normalizedPosition] || 0;
    if (!Number.isFinite(normalizedRank) || normalizedRank < 1 || normalizedRank > rankLimit) return '';

    const zeroBasedRank = normalizedRank - 1;
    const blockIndex = Math.floor(zeroBasedRank / 10);
    const offset = zeroBasedRank % 10;
    const startsReversed = AJ_REVERSED_START_POSITIONS.has(normalizedPosition);
    const isPageOneBlock = startsReversed ? (blockIndex % 2 === 1) : (blockIndex % 2 === 0);
    const roundIndex = isPageOneBlock ? offset : (AJ_ROUND_CODES.length - 1 - offset);
    const page = isPageOneBlock ? 1 : 2;
    return `${AJ_ROUND_CODES[roundIndex]}${page}`;
  }

  function setOverviewMode(rawMode) {
    showingRawOverview = !!rawMode;
    overviewOutput.classList.toggle('hidden', !showingRawOverview);
    overviewCharts.classList.toggle('hidden', showingRawOverview);
    if (toggleRawOverviewBtn) {
      toggleRawOverviewBtn.textContent = showingRawOverview ? 'Hide Raw Code/Data' : 'Show Raw Code/Data';
    }
  }

  function drawBarChart(canvas, labels, values, options = {}) {
    if (!(canvas instanceof HTMLCanvasElement)) return;

    const dpr = window.devicePixelRatio || 1;
    const cssWidth = Math.max(240, Math.floor(canvas.clientWidth || 240));
    const cssHeight = Math.max(160, Math.floor(Number(canvas.getAttribute('height') || 160)));
    canvas.width = Math.floor(cssWidth * dpr);
    canvas.height = Math.floor(cssHeight * dpr);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssWidth, cssHeight);
    ctx.fillStyle = '#DCE8F4';
    ctx.font = '12px sans-serif';

    if (!labels.length || !values.length) {
      ctx.fillText('No data yet', 12, 22);
      return;
    }

    const maxValue = Math.max(...values, 1);
    const padding = { top: 10, right: 10, bottom: 40, left: 10 };
    const chartW = cssWidth - padding.left - padding.right;
    const chartH = cssHeight - padding.top - padding.bottom;
    const gap = 8;
    const barW = Math.max(10, (chartW - (values.length - 1) * gap) / values.length);

    values.forEach((value, idx) => {
      const barH = Math.max(2, (Math.max(0, value) / maxValue) * chartH);
      const x = padding.left + idx * (barW + gap);
      const y = padding.top + chartH - barH;
      ctx.fillStyle = options.color || '#8FB2D9';
      ctx.fillRect(x, y, barW, barH);
      ctx.fillStyle = '#DCE8F4';
      ctx.fillText(String(Math.round(value)), x, Math.max(10, y - 4));
      ctx.save();
      ctx.translate(x + barW / 2, cssHeight - 8);
      ctx.rotate(-0.45);
      ctx.textAlign = 'right';
      const shortLabel = String(labels[idx] || '').slice(0, 12);
      ctx.fillText(shortLabel, 0, 0);
      ctx.restore();
    });
  }

  function updateOverviewCards(traffic, system) {
    metricUptime.textContent = formatUptime(system.uptimeSeconds || 0);
    metricTotalRequests.textContent = formatNumber(traffic.totalRequests || 0);
    metricAuthUsers.textContent = formatNumber(system.authUsersCount || 0);
    if (metricSignedUpEmails) {
      metricSignedUpEmails.textContent = formatNumber(system.authEmailsCount || 0);
    }
    if (metricPremiumUsers) {
      metricPremiumUsers.textContent = '0';
    }
    metricDefaultRankings.textContent = formatNumber(system.defaultRankingsCount || 0);
  }

  function renderOverviewCharts(traffic) {
    const byMethod = Object.entries(traffic.byMethod || {});
    const statusCodes = Object.entries(traffic.statusCodes || {});
    const topPaths = Array.isArray(traffic.topPaths) ? traffic.topPaths.slice(0, 8) : [];

    drawBarChart(methodChart, byMethod.map(([k]) => k), byMethod.map(([, v]) => Number(v || 0)), { color: '#7FC8A9' });
    drawBarChart(statusChart, statusCodes.map(([k]) => k), statusCodes.map(([, v]) => Number(v || 0)), { color: '#F5C26B' });
    drawBarChart(topPathsChart, topPaths.map((x) => String(x.path || '/')), topPaths.map((x) => Number(x.count || 0)), { color: '#9CB4FF' });
  }

  function deepClone(value) {
    if (typeof structuredClone === 'function') return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }

  function mergeDeep(base, override) {
    const output = Array.isArray(base) ? base.slice() : { ...base };
    Object.keys(override || {}).forEach((key) => {
      const baseValue = output[key];
      const overrideValue = override[key];
      if (overrideValue && typeof overrideValue === 'object' && !Array.isArray(overrideValue) && baseValue && typeof baseValue === 'object' && !Array.isArray(baseValue)) {
        output[key] = mergeDeep(baseValue, overrideValue);
      } else {
        output[key] = overrideValue;
      }
    });
    return output;
  }

  function loadCpuTuningPreset() {
    try {
      const raw = localStorage.getItem(ADMIN_CPU_TUNING_KEY);
      if (!raw) return deepClone(cpuTuningDefaults);
      const parsed = JSON.parse(raw);
      return mergeDeep(deepClone(cpuTuningDefaults), parsed || {});
    } catch (_error) {
      return deepClone(cpuTuningDefaults);
    }
  }

  function loadCpuNamedModels() {
    try {
      const raw = localStorage.getItem(ADMIN_CPU_MODELS_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
      const normalized = {};
      Object.entries(parsed).forEach(([name, value]) => {
        const modelName = String(name || '').trim();
        if (!modelName) return;

        const isWrapped = value && typeof value === 'object' && !Array.isArray(value) && value.config && typeof value.config === 'object';
        const config = isWrapped ? value.config : value;
        const createdAt = Number(isWrapped ? (value.createdAt || value.savedAt || value.updatedAt) : Date.now()) || Date.now();
        const updatedAt = Number(isWrapped ? (value.updatedAt || value.savedAt || value.createdAt) : createdAt) || createdAt;

        normalized[modelName] = {
          modelName,
          createdAt,
          updatedAt,
          config: mergeDeep(deepClone(cpuTuningDefaults), config || {})
        };
      });
      return normalized;
    } catch (_error) {
      return {};
    }
  }

  function saveCpuNamedModels(models) {
    try {
      localStorage.setItem(ADMIN_CPU_MODELS_KEY, JSON.stringify(models || {}));
      return true;
    } catch (_error) {
      return false;
    }
  }

  function cloneCpuModelState(state) {
    return {
      silent: deepClone(state?.silent || {}),
      tied: deepClone(state?.tied || {}),
      scenario: deepClone(state?.scenario || {})
    };
  }

  function getSortedCpuModelNames() {
    return Object.keys(cpuNamedModels || {}).sort((a, b) => {
      const aTime = Number(cpuNamedModels[a]?.updatedAt || 0);
      const bTime = Number(cpuNamedModels[b]?.updatedAt || 0);
      if (bTime !== aTime) return bTime - aTime;
      return a.localeCompare(b);
    });
  }

  function renderCpuModelDetails(name) {
    if (!cpuModelDetails || !cpuModelDetailsMeta) return;
    const modelName = String(name || '').trim();
    const model = modelName ? cpuNamedModels[modelName] : null;

    if (!model) {
      cpuModelDetailsMeta.textContent = 'Select a saved model to inspect all slider values.';
      cpuModelDetails.textContent = 'No saved model selected.';
      return;
    }

    cpuModelDetailsMeta.textContent = `Model: ${modelName} | Created: ${formatLastUpdatedText(model.createdAt)} | Updated: ${formatLastUpdatedText(model.updatedAt)}`;
    cpuModelDetails.textContent = JSON.stringify(model.config || {}, null, 2);
  }

  function flattenPrimitiveValues(source, prefix = '', output = {}) {
    if (!source || typeof source !== 'object' || Array.isArray(source)) {
      return output;
    }

    Object.entries(source).forEach(([key, value]) => {
      const nextPath = prefix ? `${prefix}.${key}` : key;
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        flattenPrimitiveValues(value, nextPath, output);
        return;
      }
      output[nextPath] = value;
    });

    return output;
  }

  function toCompareNumber(value) {
    if (typeof value === 'number') return value;
    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
    return Number.NaN;
  }

  function formatComparePrimitive(value) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return Number.isInteger(value) ? String(value) : value.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
    }
    if (typeof value === 'string') return value;
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    return JSON.stringify(value);
  }

  function buildCpuModelDiff(modelConfig, currentConfig) {
    const left = flattenPrimitiveValues(modelConfig || {});
    const right = flattenPrimitiveValues(currentConfig || {});
    const keys = Array.from(new Set([...Object.keys(left), ...Object.keys(right)])).sort((a, b) => a.localeCompare(b));

    return keys.map((key) => {
      const modelValue = left[key];
      const currentValue = right[key];
      const modelNum = toCompareNumber(modelValue);
      const currentNum = toCompareNumber(currentValue);
      let delta = null;
      if (Number.isFinite(modelNum) && Number.isFinite(currentNum)) {
        delta = modelNum - currentNum;
      }

      const changed = Number.isFinite(delta)
        ? Math.abs(delta) > 1e-12
        : String(modelValue) !== String(currentValue);

      return { key, modelValue, currentValue, delta, changed };
    }).filter((entry) => entry.changed);
  }

  function renderCpuModelComparison(name) {
    if (!cpuModelCompareMeta || !cpuModelCompareOutput) return;
    const modelName = String(name || '').trim();
    const model = modelName ? cpuNamedModels[modelName] : null;

    if (!model) {
      cpuModelCompareMeta.textContent = 'Select a saved model, then compare it against current slider values.';
      cpuModelCompareOutput.textContent = 'No model selected for comparison.';
      return;
    }

    const diff = buildCpuModelDiff(model.config || {}, cpuTuningState || {});
    cpuModelCompareMeta.textContent = `Comparing "${modelName}" vs current sliders | Differences: ${diff.length}`;

    if (!diff.length) {
      cpuModelCompareOutput.textContent = 'No differences found. Current sliders match this saved model.';
      return;
    }

    cpuModelCompareOutput.textContent = diff.map((entry) => {
      const modelText = formatComparePrimitive(entry.modelValue);
      const currentText = formatComparePrimitive(entry.currentValue);
      const deltaText = Number.isFinite(entry.delta)
        ? ` | delta=${entry.delta >= 0 ? '+' : ''}${entry.delta.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')}`
        : '';
      return `${entry.key}: model=${modelText} | current=${currentText}${deltaText}`;
    }).join('\n');
  }

  function renderCpuModelLibrary(selectedName = '') {
    if (!cpuModelList) return;

    const names = getSortedCpuModelNames();
    const selected = String(selectedName || cpuModelSelect?.value || '').trim();

    if (!names.length) {
      cpuModelList.innerHTML = '<p class="admin-cpu-note">No saved models yet.</p>';
      renderCpuModelDetails('');
      renderCpuModelComparison('');
      return;
    }

    cpuModelList.innerHTML = names.map((name) => {
      const model = cpuNamedModels[name] || {};
      const isActive = selected === name;
      return `
        <article class="admin-cpu-model-item${isActive ? ' is-active' : ''}" data-model-name="${escapeHtml(name)}">
          <div class="admin-cpu-model-item-head">
            <strong>${escapeHtml(name)}</strong>
            <span class="admin-cpu-model-item-time">Updated: ${escapeHtml(formatLastUpdatedText(model.updatedAt))}</span>
          </div>
          <div class="admin-cpu-model-item-sub">Created: ${escapeHtml(formatLastUpdatedText(model.createdAt))}</div>
          <div class="admin-cpu-model-item-actions">
            <button type="button" class="btn btn-login" data-model-action="inspect" data-model-name="${escapeHtml(name)}">Inspect</button>
            <button type="button" class="btn btn-login" data-model-action="compare" data-model-name="${escapeHtml(name)}">Compare</button>
            <button type="button" class="btn btn-signup" data-model-action="load" data-model-name="${escapeHtml(name)}">Load</button>
            <button type="button" class="btn btn-login" data-model-action="delete" data-model-name="${escapeHtml(name)}">Delete</button>
          </div>
        </article>
      `;
    }).join('');

    const selectedForView = selected && cpuNamedModels[selected] ? selected : names[0];
    renderCpuModelDetails(selectedForView);
    renderCpuModelComparison(selectedForView);
  }

  function getCpuLogicPayload(modelName = 'Custom') {
    return {
      presetName: String(modelName || 'Custom').trim() || 'Custom',
      updatedAt: Date.now(),
      silent: deepClone(cpuTuningState.silent || {}),
      tied: deepClone(cpuTuningState.tied || {}),
      silentProfiles: deepClone(cpuSilentProfiles),
      tiedProfiles: deepClone(cpuTiedProfiles),
      silentBidRanges: deepClone(cpuSilentBidRanges)
    };
  }

  function applyCpuLogicConfigToState(config) {
    if (!config || typeof config !== 'object') return false;
    const merged = mergeDeep(deepClone(cpuTuningDefaults), {
      silent: config.silent || {},
      tied: config.tied || {},
      scenario: cpuTuningState?.scenario || cpuTuningDefaults.scenario
    });
    cpuTuningState = merged;
    saveCpuTuningPreset(cpuTuningState);
    return true;
  }

  function refreshCpuModelSelect(preferredName = '') {
    if (!cpuModelSelect) return;
    const names = getSortedCpuModelNames();
    const current = String(preferredName || activeCpuModelName || cpuModelSelect.value || '').trim();
    cpuModelSelect.innerHTML = `<option value="">Select a model</option>${names.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('')}`;
    if (current && names.includes(current)) {
      cpuModelSelect.value = current;
      activeCpuModelName = current;
    } else if (activeCpuModelName && names.includes(activeCpuModelName)) {
      cpuModelSelect.value = activeCpuModelName;
    } else if (names.length === 1) {
      cpuModelSelect.value = names[0];
      activeCpuModelName = names[0];
    }
    renderCpuModelLibrary(cpuModelSelect.value || activeCpuModelName || current || '');
  }

  function saveNamedCpuModel() {
    const name = String(cpuModelNameInput?.value || '').trim();
    if (!name) {
      setCpuTuningStatus('Enter a model name before saving.', 'error');
      return;
    }
    const existing = cpuNamedModels[name];
    const createdAt = Number(existing?.createdAt || existing?.savedAt || Date.now()) || Date.now();
    cpuNamedModels[name] = {
      modelName: name,
      createdAt,
      updatedAt: Date.now(),
      config: cloneCpuModelState(cpuTuningState)
    };
    activeCpuModelName = name;
    saveCpuNamedModels(cpuNamedModels);
    refreshCpuModelSelect(name);
    if (cpuModelSelect) cpuModelSelect.value = name;
    renderCpuModelComparison(name);
    setCpuTuningStatus(`Saved model "${name}" locally.`, 'success');
  }

  function resolveCpuModelNameForLoad() {
    const selected = String(cpuModelSelect?.value || '').trim();
    if (selected && cpuNamedModels[selected]) return selected;

    const typed = String(cpuModelNameInput?.value || '').trim();
    if (typed && cpuNamedModels[typed]) return typed;

    return '';
  }

  function loadSelectedCpuModel() {
    const selected = resolveCpuModelNameForLoad();
    if (!selected) {
      setCpuTuningStatus('Select a saved model to load.', 'error');
      setLoadSelectedButtonState('error');
      return;
    }
    const model = cpuNamedModels[selected];
    cpuTuningState = mergeDeep(deepClone(cpuTuningDefaults), model.config || {});
    saveCpuTuningPreset(cpuTuningState);
    activeCpuModelName = selected;
    if (cpuModelSelect) cpuModelSelect.value = selected;
    if (cpuModelNameInput) cpuModelNameInput.value = selected;
    renderCpuTuningLab();
    renderCpuModelDetails(selected);
    renderCpuModelComparison(selected);
    setCpuTuningStatus(`Loaded model "${selected}".`, 'success');
    setLoadSelectedButtonState('success', selected);
  }

  function setLoadSelectedButtonState(state, modelName = '') {
    if (!cpuLoadNamedModelBtn) return;

    if (cpuLoadSelectedResetTimer) {
      clearTimeout(cpuLoadSelectedResetTimer);
      cpuLoadSelectedResetTimer = null;
    }

    cpuLoadNamedModelBtn.classList.remove('admin-cpu-button-success', 'admin-cpu-button-error');

    if (state === 'success') {
      cpuLoadNamedModelBtn.disabled = false;
      cpuLoadNamedModelBtn.textContent = 'Loaded ✓';
      cpuLoadNamedModelBtn.classList.add('admin-cpu-button-success');
      if (modelName) {
        cpuLoadNamedModelBtn.title = `Loaded ${modelName}`;
      }
      cpuLoadSelectedResetTimer = setTimeout(() => {
        if (!cpuLoadNamedModelBtn) return;
        cpuLoadNamedModelBtn.textContent = 'Load Selected';
        cpuLoadNamedModelBtn.title = '';
        cpuLoadNamedModelBtn.classList.remove('admin-cpu-button-success', 'admin-cpu-button-error');
        cpuLoadSelectedResetTimer = null;
      }, 2200);
      return;
    }

    if (state === 'error') {
      cpuLoadNamedModelBtn.disabled = false;
      cpuLoadNamedModelBtn.textContent = 'Load Failed';
      cpuLoadNamedModelBtn.classList.add('admin-cpu-button-error');
      cpuLoadSelectedResetTimer = setTimeout(() => {
        if (!cpuLoadNamedModelBtn) return;
        cpuLoadNamedModelBtn.textContent = 'Load Selected';
        cpuLoadNamedModelBtn.title = '';
        cpuLoadNamedModelBtn.classList.remove('admin-cpu-button-success', 'admin-cpu-button-error');
        cpuLoadSelectedResetTimer = null;
      }, 2200);
      return;
    }

    cpuLoadNamedModelBtn.textContent = 'Load Selected';
    cpuLoadNamedModelBtn.title = '';
  }

  function deleteSelectedCpuModel() {
    const selected = String(cpuModelSelect?.value || '').trim();
    if (!selected || !cpuNamedModels[selected]) {
      setCpuTuningStatus('Select a saved model to delete.', 'error');
      return;
    }
    delete cpuNamedModels[selected];
    if (activeCpuModelName === selected) {
      activeCpuModelName = '';
    }
    saveCpuNamedModels(cpuNamedModels);
    refreshCpuModelSelect('');
    renderCpuModelDetails('');
    renderCpuModelComparison('');
    setCpuTuningStatus(`Deleted model "${selected}".`, 'success');
  }

  function setSaveToServerButtonState(state, sourceFile = '') {
    if (!cpuSaveToServerBtn) return;

    if (cpuSaveToServerResetTimer) {
      clearTimeout(cpuSaveToServerResetTimer);
      cpuSaveToServerResetTimer = null;
    }

    cpuSaveToServerBtn.classList.remove('admin-cpu-button-success', 'admin-cpu-button-error');

    if (state === 'saving') {
      cpuSaveToServerBtn.disabled = true;
      cpuSaveToServerBtn.textContent = 'Saving...';
      return;
    }

    cpuSaveToServerBtn.disabled = false;

    if (state === 'success') {
      cpuSaveToServerBtn.textContent = 'Saved ✓';
      cpuSaveToServerBtn.classList.add('admin-cpu-button-success');
      if (sourceFile) {
        cpuSaveToServerBtn.title = `Saved to ${sourceFile}`;
      }
      cpuSaveToServerResetTimer = setTimeout(() => {
        if (!cpuSaveToServerBtn) return;
        cpuSaveToServerBtn.textContent = 'Save Active To cpu-logic.json';
        cpuSaveToServerBtn.title = '';
        cpuSaveToServerBtn.classList.remove('admin-cpu-button-success', 'admin-cpu-button-error');
        cpuSaveToServerResetTimer = null;
      }, 2200);
      return;
    }

    if (state === 'error') {
      cpuSaveToServerBtn.textContent = 'Save Failed';
      cpuSaveToServerBtn.classList.add('admin-cpu-button-error');
      cpuSaveToServerResetTimer = setTimeout(() => {
        if (!cpuSaveToServerBtn) return;
        cpuSaveToServerBtn.textContent = 'Save Active To cpu-logic.json';
        cpuSaveToServerBtn.title = '';
        cpuSaveToServerBtn.classList.remove('admin-cpu-button-success', 'admin-cpu-button-error');
        cpuSaveToServerResetTimer = null;
      }, 2600);
      return;
    }

    cpuSaveToServerBtn.textContent = 'Save Active To cpu-logic.json';
    cpuSaveToServerBtn.title = '';
  }

  async function saveActiveCpuLogicToServer() {
    setSaveToServerButtonState('saving');
    try {
      const modelName = String(cpuModelNameInput?.value || cpuModelSelect?.value || 'Custom').trim() || 'Custom';
      const payload = getCpuLogicPayload(modelName);
      const response = await requestJson('/api/admin/cpu-logic/save', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(payload)
      });
      const sourceFile = String(response?.sourceFile || activeCpuLogicSourceFile || 'cpu-logic.json').trim() || 'cpu-logic.json';
      activeCpuLogicSourceFile = sourceFile;
      updateCpuLogicSourceMeta();
      setCpuTuningStatus(`Saved "${modelName}" to ${sourceFile}.`, 'success');
      setSaveToServerButtonState('success', sourceFile);
    } catch (error) {
      setCpuTuningStatus(error.message || 'Failed to save cpu-logic.json', 'error');
      setSaveToServerButtonState('error');
    }
  }

  async function loadCpuLogicFromServer(options = {}) {
    const silent = !!options.silent;
    try {
      const payload = await requestJson('/api/admin/cpu-logic', {
        headers: { 'x-admin-key': getAdminKey() }
      });
      const sourceFile = String(payload?.sourceFile || activeCpuLogicSourceFile || 'cpu-logic.json').trim() || 'cpu-logic.json';
      activeCpuLogicSourceFile = sourceFile;
      updateCpuLogicSourceMeta();
      const config = payload && payload.config;
      const applied = applyCpuLogicConfigToState(config);
      if (!applied) {
        if (!silent) setCpuTuningStatus('No valid CPU logic config found.', 'error');
        return;
      }

      if (cpuModelNameInput) {
        const serverPresetName = String(config?.presetName || '').trim();
        const existingModelName = String(cpuModelNameInput.value || '').trim();
        if (!silent || !existingModelName) {
          cpuModelNameInput.value = serverPresetName || existingModelName;
        }
      }
      renderCpuTuningLab();
      if (!silent) {
        setCpuTuningStatus(`Loaded ${sourceFile} (${String(config?.presetName || 'Custom')}).`, 'success');
      }
    } catch (error) {
      if (!silent) {
        setCpuTuningStatus(error.message || 'Failed to load CPU logic config', 'error');
      }
    }
  }

  function saveCpuTuningPreset(state) {
    try {
      localStorage.setItem(ADMIN_CPU_TUNING_KEY, JSON.stringify(state));
      return true;
    } catch (_error) {
      return false;
    }
  }

  function resetCpuTuningPreset() {
    cpuTuningState = deepClone(cpuTuningDefaults);
    saveCpuTuningPreset(cpuTuningState);
    renderCpuTuningLab();
    setCpuTuningStatus('Reset to defaults.', 'success');
    runCpuPreview();
  }

  function setCpuTuningStatus(message, tone = 'info') {
    if (!cpuTuningStatus) return;
    cpuTuningStatus.textContent = message || '';
    cpuTuningStatus.dataset.tone = tone;
  }

  function updateCpuLogicSourceMeta() {
    if (!cpuLogicSourceMeta) return;
    const sourceFile = String(activeCpuLogicSourceFile || 'cpu-logic.json').trim() || 'cpu-logic.json';
    cpuLogicSourceMeta.textContent = `Current source file: ${sourceFile} (used by silent draft CPUs)`;
  }

  function setCpuFieldValue(section, key, value) {
    if (!cpuTuningState[section]) cpuTuningState[section] = {};
    cpuTuningState[section][key] = value;
  }

  function getCpuFieldValue(section, key) {
    return cpuTuningState?.[section]?.[key];
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, Number(value)));
  }

  function getStepPrecision(step) {
    const raw = String(step ?? '').trim();
    if (!raw || raw.indexOf('.') === -1) return 0;
    return raw.split('.')[1].length;
  }

  function formatCpuValue(value, precision = 2) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return '--';
    if (precision <= 0) return String(Math.round(numeric));
    return numeric.toFixed(precision);
  }

  function getCpuControlDescription(section, key) {
    const descriptions = {
      silent: {
        roundThresholdBiasScale: 'How hard the per-round threshold bias actually bites. Low values make the round bias sliders nearly cosmetic; raise it to make early rounds genuinely pickier.',
        earlySelectiveMaxRound: 'Last round where CPUs stay selective. Through this round a needed position alone will not justify a bid unless the team is behind pace.',
        starterFillTargetRound: 'Round by which CPUs aim to have their starting lineup filled. Later values stop teams from chasing every empty slot in rounds 1-3.',
        earlyCheapSkipMaxRound: 'Last round where low-value players can be held back for later rounds.',
        earlyCheapAvThreshold: 'Players below this AV count as cheap filler during the early rounds.',
        earlyCheapSkipRate: 'Chance a given cheap player is held back for later rounds. Rolled once per player per round and shared by every CPU, so the draft stays lumpy rather than uniform.',
        roundCommitR1Pct: 'Share of a team\u2019s REMAINING budget it commits during round 1, before the below/above range is applied.',
        roundCommitR2Pct: 'Share of remaining budget committed during round 2.',
        roundCommitR3Pct: 'Share of remaining budget committed during round 3.',
        roundCommitR4Pct: 'Share of remaining budget committed during round 4.',
        roundCommitR5Pct: 'Share of remaining budget committed during round 5.',
        roundCommitR6Pct: 'Share of remaining budget committed during round 6.',
        roundCommitR7Pct: 'Share of remaining budget committed during round 7.',
        roundCommitR8Pct: 'Share of remaining budget committed during round 8.',
        roundCommitR9Pct: 'Share of remaining budget committed during round 9.',
        roundCommitR10Pct: 'Share of remaining budget committed during round 10. Keep at 1.0 so teams finish spending.',
        commitmentTiltMin: 'Lowest per-team spend multiplier applied to the round commitment target. Keeps some teams spending less than the league average.',
        commitmentTiltMax: 'Highest per-team spend multiplier applied to the round commitment target. Keeps some teams spending more than the league average, so all 10 teams do not move as one block.',
        paceBandMinMultiplier: 'Lower bound of the roster pace band, as a multiple of the even per-round pace. Teams below this are treated as behind pace.',
        paceBandMaxMultiplier: 'Upper bound of the roster pace band. Teams above this are treated as ahead of pace and become more selective.',
        paceBandTeamJitter: 'Random per-team shift applied to the pace band so teams do not all cross the pace line on the same round.',
        baseAggression: 'Sets the baseline willingness for CPU teams to push bids before personality and context modifiers apply.',
        budgetRichBoost: 'Raises aggression when a CPU still has a large budget, making it more likely to pay up early.',
        budgetPoorReduction: 'Reduces aggression when budget gets tight so CPU teams conserve cash and avoid overpaying.',
        rosterTightBoost: 'Adds urgency when few roster spots remain, so CPUs are less likely to pass on needed starters.',
        rosterTightStartRound: 'Earliest round where Roster Tight Boost can apply normally. Before this, it only kicks in when a team is clearly behind pace.',
        rosterLooseReduction: 'Lowers urgency when many spots remain, encouraging patience and value hunting.',
        emergencyStarterBoost: 'Boosts bidding pressure when minimum lineup slots are still empty for the CPU team.',
        finalRoundFillBoost: 'Late-round urgency multiplier to force lineup completion before the draft ends.',
        earlyRoundReduction: 'Applies caution in early rounds to reduce reckless opening-round spending.',
        richEarlyBoost: 'Caps the extra early-round aggression that rich-budget teams can receive.',
        lateRoundAggressionBoost: 'Controls late-round spending intensity; higher values make CPUs more aggressive in final rounds.',
        avCenteringStrength: 'Controls how tightly CPU bids cluster around Average Value (AV). Higher = tighter clustering around AV, Lower = more bid variation.',
        marketSensitivity: 'How much CPUs trust market signals (supply/demand, scarcity). Higher = CPUs respond more to position scarcity and budget efficiency.',
        paceCatchBidIntensity: 'Strength of pace-based catch bidding when teams fall behind roster pace. Higher = more aggressive $1-5 catch bids to catch up.',
        lateRoundBudgetForcingIntensity: 'How desperately CPUs try to spend remaining budget in rounds 7+. Higher = more willing to bid on ANY player if budget remains (0=off, 1.0=maximum forcing).',
        spreadBidCap: 'When CPUs have low budget + multiple open roster spots, caps individual bids to spread money across players instead of betting it all on one. Higher = more aggressive spreading (0=off, 1.0=only bid max 15% of budget per player).',
        spreadModeIntensity: 'Controls "spread mode" - CPUs lower aggressive bids on expensive players ($40+) to save budget for multiple cheaper $15-25 players. Higher = more spreading (0=off, 1.0=maximum spreading).',
        starTargetAggressionBoost: 'When CPUs encounter starred targets or priority players, this boosts their bid aggressiveness to override spread mode. Higher = more willing to go all-in on star targets (0=ignore stars, 1.0=maximum star mode).',
        starTargetLowballReduction: 'When targeting a starred player, reduces the lowballing effect. At 1.0, CPUs bid normally on starred targets instead of spreading. Lower = still spread even on stars.',
        lowballIntensity: 'In spread mode, CPUs lower bids on ALL players (not just $40+) to roughly 60-70% of normal bid. Higher = more aggressive lowballing to maximize volume (0=off, 1.0=heavy lowballing on everything).',
        cheapFillerBidFrequency: 'Probability of throwing $1-5 "filler" bids to stretch budget even further when CPUs have multiple open spots. Higher = more frequent cheap filler bids (0=off, 1.0=always throw filler when spreading).',
        starAvailabilityOverride: 'When CPUs\' starred targets are available THIS ROUND, override lowball mode and bid aggressively. Higher threshold = more conservative (only override if many stars available), Lower = eager to override when stars present (0=always lowball, 1.0=only override if 100% of stars available).',
        draftChancePriorityWeight: 'How strongly CPUs obey drafted percentage (draftChance) when filtering and ranking bids. Higher values sharply favor high draftChance players and suppress low draftChance picks.',
        draftChancePriorityThreshold: 'Primary drafted% line CPUs try to stay above for non-critical bids. Players below this line are heavily limited unless they are must-fill/star targets.',
        draftChancePrimaryBaseFloor: 'Base drafted% floor for normal CPU player selection before roster need and completion pressure relax it.',
        draftChancePrimaryMinFloor: 'Lowest drafted% floor allowed after roster need and completion pressure relax the primary floor.',
        draftChanceLowBidCapPct: 'Maximum share of a team\'s bids that may target players below the drafted% threshold. Keeps low-percentage player exposure intentionally small.',
        
        draftChancePrimaryEnabled: 'Enables the primary drafted% selection filter. Use 1 for enabled and 0 for disabled.',
        earlyRoundMaxBidsCap: 'Maximum bids per CPU in rounds 1-3. Higher creates more market coverage without forcing every player to sell.',
        globalBidVolumeMultiplier: 'Global multiplier on CPU bid count. 1.00 is neutral; lower is more selective and higher is broader.',
        spreadBidVolumeMultiplier: 'Multiplier on bid count while a team is spreading across the roster. Higher creates more depth bids.',
        spreadDollarBidMultiplier: 'Multiplier on spread-mode bid amounts. Higher makes depth bids more competitive; lower preserves budget.',
        undraftedCap: 'Target number of undrafted players in a simulator round before soft acceptance rules and completion needs are considered.',
        undraftedCapNoise: 'Random plus/minus variation applied to the simulator undrafted target each round.',
        finalRoundSpreadStart: 'First round where the stronger final-round spread/fill behavior begins. Set to 10 to protect AV through rounds 1-9.',
        mustFillBypassStartRound: 'First round where a must-fill position may skip the interest gate. Set to 2 so round 1 stays selective, since every roster is empty and structurally behind pace.',
        paceGraceRounds: 'Opening rounds treated as on pace regardless of roster size. Prevents round 1 panic bidding when the whole draft is still ahead.',
        
        spreadPaceTriggerVariance: 'How far behind pace a team must fall before it starts spreading bids. Teams at or above this stay picky and chase high AV instead.',
        spreadBudgetPerSpotTrigger: 'Budget per open roster spot below which a team spreads regardless of pace, because it can no longer afford to be selective.',
        kickerDefensePatienceEnabled: 'Teams hold out for a top-ranked kicker or defense instead of filling the slot early with whoever appears.',
        kickerDefenseTopRankTarget: 'Position rank a kicker or defense must beat to be worth an early slot. Ranks worse than this are ignored until the release round.',
        kickerDefensePatienceReleaseRound: 'Round from which teams stop being patient and will take any kicker or defense to complete the roster.',
        kickerDefenseUpgradeRankGap: 'How many position ranks better a kicker or defense must be before a team that already owns one will bid to upgrade.',
        
        cpuRosterTargetBonus: 'Players above the league minimum that CPUs pace toward. Aiming for 16 when 14 is required makes reaching 14 comfortable rather than a scramble.',
        avPriceAccuracyStart: 'Target price-to-AV ratio in round 1. The most accurate point of the draft.',
        avPriceAccuracyMid: 'Target price-to-AV ratio at the end of the hold window. AV still matters strongly up to here.',
        avPriceAccuracyEnd: 'Target price-to-AV ratio in the final round, after budgets have thinned.',
        avPriceAccuracyHoldRounds: 'Rounds over which AV accuracy only drifts slightly. After this the ratio falls toward the final-round target faster.',
        avMarketDepthFinalPass: 'Re-runs the AV market-depth guarantee as the last step. Without it the participation curve and discipline passes strip the competitive bids that keep top-AV prices honest.',
        earlyRoundBidCoverageCapEnabled: 'Caps how many distinct players receive any bid in a round, keeping the highest-AV ones. This is the primary control over undrafted players per round.',
        earlyRoundBidCoverageCapMaxRound: 'Last round the coverage cap applies to. Set to the draft length to hold undrafted counts steady across every round.',
        roundUndraftedTargetEarly: 'Undrafted players aimed for in round 1. Rosters are built early while boards are deep, so this runs lower than the late target.',
        roundUndraftedTargetLate: 'Undrafted players aimed for in the final round. The target ramps linearly from the early value to this one.',
        roundUndraftedFloor: 'Fewest undrafted players allowed in any round. Stops a round from being almost fully drafted.',
        roundUndraftedCeiling: 'Most undrafted players targeted in any round. This bounds the cap, but a round can still exceed it if CPUs decline to bid.',
        bidCoverageCapJitter: 'Random swing applied to the coverage cap each round. Without it every draft returns an identical undrafted count.',
        avMarketDepthMinCompetitiveBids: 'Teams forced to bid near AV on each top-AV player. Since price is second-highest plus one, this is what actually sets the sale price.',
        earlyAvAccuracyStrength: 'How close round 1 spread bids get to full AV. 0.9 means round 1 bids land near 96% of AV instead of the usual 62%.',
        rosterExtraSpots: 'Spots allowed above the preferred roster minimum. 6 gives a 14-player minimum room to reach 20.',
        upgradeBudgetFloor: 'Budget a team needs to keep bidding after reaching its preferred roster size. Treats the roster target as a minimum, not a cap.',
        band50PlusMinTeamPct: 'AV 50+ preferred lower participation bound as a percent of total teams.',
        band50PlusMaxTeamPct: 'AV 50+ preferred upper participation bound as a percent of total teams.',
        band40to49MinTeamPct: 'AV 40-49 preferred lower participation bound as a percent of total teams.',
        band40to49MaxTeamPct: 'AV 40-49 preferred upper participation bound as a percent of total teams.',
        band30to39MinTeamPct: 'AV 30-39 preferred lower participation bound as a percent of total teams.',
        band30to39MaxTeamPct: 'AV 30-39 preferred upper participation bound as a percent of total teams.',
        band20to29MinTeamPct: 'AV 20-29 preferred lower participation bound as a percent of total teams.',
        band20to29MaxTeamPct: 'AV 20-29 preferred upper participation bound as a percent of total teams.',
        band10to19MinTeamPct: 'AV 10-19 preferred lower participation bound as a percent of total teams.',
        band10to19MaxTeamPct: 'AV 10-19 preferred upper participation bound as a percent of total teams.',
        band1to9MinTeamPct: 'AV 1-9 preferred lower participation bound as a percent of total teams.',
        band1to9MaxTeamPct: 'AV 1-9 preferred upper participation bound as a percent of total teams.',
        band1to9NoBidChance: 'Chance that an AV 1-9 player gets no CPU market at all in this round. Higher = more undrafted low-value players.',
        band10to19NoBidChance: 'Chance that an AV 10-19 player gets no CPU market at all in this round.',
        bandLowAvNoBidLateRoundRelief: 'How much AV 1-19 no-bid chance drops per round after round 6. Higher = noticeably more low-AV bidding in rounds 7-10.',
        lowAvEarlyRoundNoBidBoost: 'Extra AV 1-9 no-bid chance applied in rounds 1-3. Higher = fewer cheap early-round bids.',
        lowAvLateRoundReliefStartRound: 'Round when low-AV no-bid relief starts. Earlier start increases cheap-player bidding sooner.',
        lowAvCompletionGuardEnabled: 'If enabled, late rounds enforce a minimum AV 1-9 bidder count when league roster fill is behind.',
        lowAvCompletionGuardStartRound: 'Round when completion guard can begin protecting AV 1-9 participation for roster fill.',
        lowAvCompletionGuardMinRosterRatio: 'Completion guard trigger threshold. If average roster fill ratio is below this, AV 1-9 participation floor is enforced.',
        lowAvCompletionGuardMinBidders: 'Minimum bidder count for AV 1-9 players when completion guard is active.',
        band50PlusPullChance: 'How strongly AV 50+ bidder counts are pulled back into the preferred percent band. Higher = tighter adherence.',
        band40to49PullChance: 'How strongly AV 40-49 bidder counts are pulled back into the preferred percent band. Higher = tighter adherence.',
        bandDefaultPullChance: 'Shared pull strength for AV 1-39 preferred bands. Higher = tighter adherence to each bucket band.',
        topAvHardMaxTeamPct: 'Absolute cap for AV 40+ participation as a percent of total draft teams. Bids above this percentage are not allowed.',
        topAvPreferredBandPullChance: 'Legacy global pull fallback. Used only if per-band pull strengths are not set.',
        commitmentRangeBelowTargetPct: 'Maximum percentage below the round commitment target for the lower-spending teams.',
        commitmentRangeAboveTargetPct: 'Maximum percentage above the round commitment target for the higher-spending teams.',
        commitmentRangeCenterBandPct: 'Most teams stay within this percentage of the round target.',
        commitmentRangeLowTeamPct: 'Share of teams assigned the lower commitment range.',
        commitmentRangeHighTeamPct: 'Share of teams assigned the higher commitment range.',
        commitmentRangeLockFinalRounds: 'Number of final rounds locked to the exact configured target percentage.',
        avMarketDepthMaxPlayersPerRound: 'Maximum number of higher-AV players receiving added market-depth bids in a round.',
        avMarketDepthMinBidMultiplier: 'Minimum bid multiplier versus AV for added market-depth bids.',
        avMarketDepthBidLowMultiplier: 'Lower bid multiplier versus AV for added market-depth bids.',
        avMarketDepthBidHighMultiplier: 'Upper bid multiplier versus AV for added market-depth bids.'
      },
      tied: {
        baseBidProb: 'Baseline chance a CPU continues bidding each tied-auction tick before psychology and budget effects.',
        preAvShape: 'Curve strength while the current price is below AV; shapes how quickly bid confidence ramps up.',
        postAvDrop: 'How sharply CPU confidence falls once price moves above AV.',
        nearAvStart: 'Price ratio threshold where near-AV caution begins.',
        overAvStart: 'Price ratio threshold where true overpay behavior penalties begin.',
        nearAvWindow: 'Width of the near-AV transition zone; larger values make caution increase more gradually.',
        overAvWindow: 'Width of the over-AV transition zone; larger values soften overpay penalties.',
        fearNearWeight: 'How much fear influences decisions near AV pricing.',
        fearOverWeight: 'How much fear influences decisions once over AV; bigger values cause quicker backing out.',
        disciplineWeight: 'Impact of profile discipline on avoiding overpay bids and forcing dropouts.',
        budgetHighThreshold: 'Budget ratio considered healthy; above this, budget penalties are mostly removed.',
        budgetMidThreshold: 'Budget ratio where mild penalties begin before severe low-budget behavior triggers.',
        backoutBase: 'Starting backout probability before AV pressure and profile modifiers are added.',
        backoutAggressionScale: 'How strongly aggressive profiles resist backing out and keep bidding.',
        clockBoost: 'Late-clock urgency factor that makes CPUs push decisions faster when timer is low.'
      },
      scenario: {
        profileIndex: 'Selects which silent-auction personality profile is used in preview calculations.',
        tiedProfileIndex: 'Selects which tied-auction psychology profile is used in preview calculations.',
        position: 'Position context for preview calculations, affecting role-based tuning behavior.',
        avgValue: 'Target market value used by the preview for value-relative pressure calculations.',
        round: 'Draft round context; later rounds increase urgency and can change aggression behavior.',
        budgetRemaining: 'Remaining budget for preview CPU team; drives budget bonus/penalty logic.',
        currentBid: 'Current live auction bid in the preview scenario.',
        playerAV: 'Player AV benchmark used to calculate overpay and caution zones.',
        timeLeft: 'Clock seconds remaining in tied-auction preview; low time adds panic pressure.',
        teamsRemaining: 'How many bidders remain active in the scenario; used as competition context.',
        positionNeed: 'How badly the CPU needs this position; higher values increase willingness to continue bidding.',
        rosterSpotsLeft: 'Open roster slots left for that CPU; fewer spots raise completion urgency.',
        playersNeededForMinimum: 'Minimum required starter slots still empty; increases forced-fill pressure.'
      }
    };

    return descriptions?.[section]?.[key] || '';
  }

  function renderCpuFieldLabel(section, key, label) {
    const helpText = getCpuControlDescription(section, key);
    return `
      <span class="admin-cpu-field-label">
        <span>${escapeHtml(label)}</span>
        ${helpText ? `<button type="button" class="admin-cpu-help-btn" data-help="${escapeHtml(helpText)}" aria-label="About ${escapeHtml(label)}" title="${escapeHtml(helpText)}">?</button>` : ''}
      </span>
    `;
  }

  function makeCpuField(section, key, label, options = {}) {
    const value = getCpuFieldValue(section, key);
    const type = options.type || 'number';
    const minAttr = Number.isFinite(options.min) ? ` min="${options.min}"` : '';
    const maxAttr = Number.isFinite(options.max) ? ` max="${options.max}"` : '';
    const stepAttr = Number.isFinite(options.step) ? ` step="${options.step}"` : '';
    const listAttr = options.list ? ` list="${options.list}"` : '';
    const precision = Number.isFinite(options.precision) ? options.precision : getStepPrecision(options.step);
    if (type === 'select') {
      const choices = Array.isArray(options.choices) ? options.choices : [];
      return `
        <label class="admin-cpu-field">
          ${renderCpuFieldLabel(section, key, label)}
          <select data-cpu-section="${section}" data-cpu-key="${key}">
            ${choices.map((choice) => `<option value="${escapeHtml(String(choice.value))}" ${String(choice.value) === String(value) ? 'selected' : ''}>${escapeHtml(choice.label)}</option>`).join('')}
          </select>
        </label>
      `;
    }

    if (type === 'range') {
      const minValue = Number(options.min);
      const maxValue = Number(options.max);
      const hasBounds = Number.isFinite(minValue) && Number.isFinite(maxValue);
      const typicalMin = Number(options.typicalMin);
      const typicalMax = Number(options.typicalMax);
      const hasTypical = Number.isFinite(typicalMin) && Number.isFinite(typicalMax);
      const defaultBase = Number(cpuTuningDefaults?.[section]?.[key]);
      const providedBase = Number(options.typicalBase);
      const typicalBase = Number.isFinite(providedBase)
        ? providedBase
        : (Number.isFinite(defaultBase) ? defaultBase : Number.NaN);
      const hasTypicalBase = Number.isFinite(typicalBase);
      const rangeText = hasBounds
        ? `Range: ${formatCpuValue(minValue, precision)} to ${formatCpuValue(maxValue, precision)}`
        : '';
      const typicalText = hasTypical
        ? `Typical: ${formatCpuValue(typicalMin, precision)} to ${formatCpuValue(typicalMax, precision)}`
        : '';
      const baseText = hasTypicalBase
        ? `Base: ${formatCpuValue(typicalBase, precision)}`
        : '';
      const hintText = [rangeText, typicalText, baseText].filter(Boolean).join(' | ');
      return `
        <label class="admin-cpu-field admin-cpu-field-slider">
          <span class="admin-cpu-field-head">
            ${renderCpuFieldLabel(section, key, label)}
            <strong class="admin-cpu-field-value" data-cpu-value data-cpu-precision="${precision}">${escapeHtml(formatCpuValue(value, precision))}</strong>
          </span>
          <input type="range" value="${escapeHtml(String(value ?? ''))}" data-cpu-section="${section}" data-cpu-key="${key}" data-cpu-precision="${precision}" ${hasTypical ? `data-cpu-typical-min="${typicalMin}" data-cpu-typical-max="${typicalMax}"` : ''}${minAttr}${maxAttr}${stepAttr}${listAttr}>
          ${hintText ? `<small class="admin-cpu-field-hint">${escapeHtml(hintText)}</small>` : ''}
        </label>
      `;
    }

    return `
      <label class="admin-cpu-field">
        ${renderCpuFieldLabel(section, key, label)}
        <input type="${type}" value="${escapeHtml(String(value ?? ''))}" data-cpu-section="${section}" data-cpu-key="${key}"${minAttr}${maxAttr}${stepAttr}${listAttr}>
      </label>
    `;
  }

  function renderCpuReferenceProfiles(container, title, profiles) {
    if (!container) return;
    container.innerHTML = `
      <p class="admin-cpu-note">${escapeHtml(title)}</p>
      <table class="admin-cpu-table">
        <thead>
          <tr><th>Profile</th><th>Key weights</th></tr>
        </thead>
        <tbody>
          ${profiles.map((profile) => `
            <tr>
              <td><strong>${escapeHtml(profile.name)}</strong></td>
              <td>${Object.entries(profile).filter(([key]) => key !== 'name').map(([key, value]) => `${escapeHtml(key)}=${Number(value).toFixed(2)}`).join(' · ')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  function renderCpuBidRangeTable(container, ranges) {
    if (!container) return;
    container.innerHTML = `
      <p class="admin-cpu-note">Silent auction bid ranges by position/value bucket.</p>
      <table class="admin-cpu-table">
        <thead>
          <tr><th>Position</th><th>Range</th><th>Min</th><th>Max</th></tr>
        </thead>
        <tbody>
          ${Object.entries(ranges).map(([position, positionRanges]) => Object.entries(positionRanges).map(([bucket, bounds]) => `
            <tr>
              <td><strong>${escapeHtml(position)}</strong></td>
              <td>${escapeHtml(bucket)}</td>
              <td>${Number(bounds.min).toFixed(2)}</td>
              <td>${Number(bounds.max).toFixed(2)}</td>
            </tr>
          `).join('')).join('')}
        </tbody>
      </table>
    `;
  }

  function renderCpuParticipationCurveGraph() {
    const host = document.getElementById('cpuParticipationCurveGraph');
    if (!host) return;

    const silent = cpuTuningState?.silent || {};
    const buckets = [
      { label: 'AV 1-9', prefix: 'curve1to9' },
      { label: 'AV 10-19', prefix: 'curve10to19' },
      { label: 'AV 20-29', prefix: 'curve20to29' },
      { label: 'AV 30-39', prefix: 'curve30to39' },
      { label: 'AV 40-49', prefix: 'curve40to49' },
      { label: 'AV 50+', prefix: 'curve50Plus' }
    ];

    const rows = buckets.map((bucket) => {
      const weights = Array.from({ length: 8 }, (_, index) => {
        const key = `${bucket.prefix}Bid${index + 1}`;
        return Math.max(0, Number(silent[key] || 0));
      });
      const total = weights.reduce((sum, value) => sum + value, 0);
      const probs = weights.map((value) => (total > 0 ? (value / total) : 0));

      const bars = probs.map((probability, index) => {
        const pct = probability * 100;
        return `
          <div class="admin-cpu-curve-cell" title="${bucket.label}: ${index + 1} bidders = ${pct.toFixed(1)}%">
            <div class="admin-cpu-curve-track">
              <div class="admin-cpu-curve-bar" style="height:${Math.max(2, Math.min(100, pct)).toFixed(1)}%"></div>
            </div>
            <span class="admin-cpu-curve-x">${index + 1}</span>
            <span class="admin-cpu-curve-p">${pct.toFixed(0)}%</span>
          </div>
        `;
      }).join('');

      return `
        <div class="admin-cpu-curve-row">
          <div class="admin-cpu-curve-label">${bucket.label}</div>
          <div class="admin-cpu-curve-bars">${bars}</div>
        </div>
      `;
    }).join('');

    host.innerHTML = `
      <p class="admin-cpu-note">Participation curve preview by AV bucket. X-axis = bidder count, Y-axis = probability.</p>
      <div class="admin-cpu-curve-chart">${rows}</div>
    `;
  }

  function renderCpuTuningLab() {
    if (!cpuTuningControls) return;

    try {
      renderCpuTuningLabInner();
      const fieldCount = cpuTuningControls.querySelectorAll('[data-cpu-section][data-cpu-key]').length;
      const silentKeyCount = Object.keys(cpuTuningState.silent || {}).length;
      const tiedKeyCount = Object.keys(cpuTuningState.tied || {}).length;
      const summary = `Rendered ${fieldCount} control(s). cpuTuningState: ${silentKeyCount} silent key(s), ${tiedKeyCount} tied key(s). Preset: "${String(cpuTuningState && cpuTuningState.presetName || activeCpuModelName || 'unsaved')}".`;
      if (cpuTuningDebugOutput) cpuTuningDebugOutput.textContent = summary;
      if (cpuTuningDebugMeta) cpuTuningDebugMeta.textContent = fieldCount > 0 ? 'CPU Tuning Lab loaded.' : 'CPU Tuning Lab rendered but found 0 controls.';
      console.log('[CPU Tuning Lab]', summary);
    } catch (error) {
      const message = `Render failed: ${error && error.message ? error.message : error}`;
      if (cpuTuningDebugOutput) cpuTuningDebugOutput.textContent = `${message}\n\n${error && error.stack ? error.stack : ''}`;
      if (cpuTuningDebugMeta) cpuTuningDebugMeta.textContent = 'CPU Tuning Lab failed to render - see debug output below.';
      console.error('[CPU Tuning Lab] renderCpuTuningLab failed:', error);
    }
  }

  function renderCpuTuningLabInner() {
    if (!cpuTuningControls) return;

    refreshCpuModelSelect(cpuModelSelect ? cpuModelSelect.value : '');

    const scenario = cpuTuningState.scenario || {};
    const participationCurveGroups = [
      { label: 'AV 1-9 (10%-30% teams preferred)', prefix: 'curve1to9' },
      { label: 'AV 10-19 (15%-30% teams preferred)', prefix: 'curve10to19' },
      { label: 'AV 20-29 (25%-40% teams preferred)', prefix: 'curve20to29' },
      { label: 'AV 30-39 (35%-55% teams preferred)', prefix: 'curve30to39' },
      { label: 'AV 40-49 (mostly 4 bidders)', prefix: 'curve40to49' },
      { label: 'AV 50+ (4-6 bidders, heavy 6)', prefix: 'curve50Plus' }
    ];
    const participationCurveFields = participationCurveGroups.map((group) => {
      const knobs = Array.from({ length: 8 }, (_, index) => makeCpuField('silent', `${group.prefix}Bid${index + 1}`, `${index + 1} Bidder Weight`, {
        type: 'range',
        min: 0,
        max: 1,
        step: 0.001,
        typicalMin: 0,
        typicalMax: 0.5
      })).join('');
      return `
        <div class="admin-cpu-group">
          <div class="admin-cpu-subtitle">${group.label}</div>
          <div class="admin-cpu-grid">${knobs}</div>
        </div>
      `;
    }).join('');

    cpuTuningControls.innerHTML = `
      <div class="admin-cpu-group">
        <div class="admin-cpu-group-title">Silent Auction Knobs</div>
        <div class="admin-cpu-grid">
          ${makeCpuField('silent', 'baseAggression', 'Base Aggression', { type: 'range', min: 0, max: 1.5, step: 0.01, typicalMin: 0.30, typicalMax: 0.50 })}
          ${makeCpuField('silent', 'budgetRichBoost', 'Budget Rich Boost', { type: 'range', min: 0, max: 0.5, step: 0.01, typicalMin: 0.03, typicalMax: 0.10 })}
          ${makeCpuField('silent', 'budgetPoorReduction', 'Budget Poor Reduction', { type: 'range', min: 0, max: 0.5, step: 0.01, typicalMin: 0.15, typicalMax: 0.35 })}
          ${makeCpuField('silent', 'rosterTightBoost', 'Roster Tight Boost', { type: 'range', min: 0, max: 0.5, step: 0.01, typicalMin: 0.15, typicalMax: 0.30 })}
          ${makeCpuField('silent', 'rosterTightStartRound', 'Roster Tight Start Round', { type: 'range', min: 1, max: 10, step: 1, typicalMin: 6, typicalMax: 8 })}
          ${makeCpuField('silent', 'rosterLooseReduction', 'Roster Loose Reduction', { type: 'range', min: 0, max: 0.5, step: 0.01, typicalMin: 0.10, typicalMax: 0.25 })}
          ${makeCpuField('silent', 'emergencyStarterBoost', 'Emergency Starter Boost', { type: 'range', min: 0, max: 0.5, step: 0.01, typicalMin: 0.10, typicalMax: 0.25 })}
          ${makeCpuField('silent', 'finalRoundFillBoost', 'Final Round Fill Boost', { type: 'range', min: 0, max: 0.5, step: 0.01, typicalMin: 0.15, typicalMax: 0.30 })}
          ${makeCpuField('silent', 'earlyRoundReduction', 'earlyRoundReduction', { type: 'range', min: 0, max: 0.5, step: 0.01, typicalMin: 0.00, typicalMax: 0.05 })}
          ${makeCpuField('silent', 'richEarlyBoost', 'Rich Early Boost', { type: 'range', min: 0, max: 0.5, step: 0.01, typicalMin: 0.15, typicalMax: 0.30 })}
          ${makeCpuField('silent', 'lateRoundAggressionBoost', 'lateRoundAggressionBoost', { type: 'range', min: 0, max: 1, step: 0.01, typicalMin: 0.30, typicalMax: 0.50 })}
          ${makeCpuField('silent', 'lateRoundBudgetForcingIntensity', 'lateRoundBudgetForcingIntensity', { type: 'range', min: 0, max: 1, step: 0.01, typicalMin: 0.50, typicalMax: 0.90 })}
          ${makeCpuField('silent', 'lateRoundAggressionDampener', 'lateRoundAggressionDampener', { type: 'range', min: 0, max: 1, step: 0.01, typicalMin: 0.40, typicalMax: 0.70 })}
          ${makeCpuField('silent', 'finalRoundSpreadStart', 'finalRoundSpreadStart', { type: 'range', min: 1, max: 10, step: 1, precision: 0, typicalMin: 10, typicalMax: 10 })}
          ${makeCpuField('silent', 'mustFillBypassStartRound', 'mustFillBypassStartRound', { type: 'range', min: 1, max: 10, step: 1, precision: 0, typicalMin: 2, typicalMax: 4 })}
          ${makeCpuField('silent', 'paceGraceRounds', 'paceGraceRounds', { type: 'range', min: 0, max: 5, step: 1, precision: 0, typicalMin: 1, typicalMax: 2 })}
          
          ${makeCpuField('silent', 'spreadPaceTriggerVariance', 'spreadPaceTriggerVariance', { type: 'range', min: -3, max: 1, step: 0.1, precision: 1, typicalMin: -1, typicalMax: 0 })}
          ${makeCpuField('silent', 'spreadBudgetPerSpotTrigger', 'spreadBudgetPerSpotTrigger', { type: 'range', min: 0, max: 80, step: 1, precision: 0, typicalMin: 20, typicalMax: 40 })}
          ${makeCpuField('silent', 'kickerDefenseTopRankTarget', 'kickerDefenseTopRankTarget', { type: 'range', min: 1, max: 32, step: 1, precision: 0, typicalMin: 8, typicalMax: 16 })}
          ${makeCpuField('silent', 'kickerDefensePatienceReleaseRound', 'kickerDefensePatienceReleaseRound', { type: 'range', min: 1, max: 10, step: 1, precision: 0, typicalMin: 8, typicalMax: 10 })}
          ${makeCpuField('silent', 'kickerDefenseUpgradeRankGap', 'kickerDefenseUpgradeRankGap', { type: 'range', min: 1, max: 20, step: 1, precision: 0, typicalMin: 3, typicalMax: 8 })}
          
          ${makeCpuField('silent', 'cpuRosterTargetBonus', 'cpuRosterTargetBonus', { type: 'range', min: 0, max: 8, step: 1, precision: 0, typicalMin: 1, typicalMax: 3 })}
          ${makeCpuField('silent', 'avPriceAccuracyStart', 'avPriceAccuracyStart', { type: 'range', min: 0.5, max: 1.1, step: 0.01, precision: 2, typicalMin: 0.9, typicalMax: 1 })}
          ${makeCpuField('silent', 'avPriceAccuracyMid', 'avPriceAccuracyMid', { type: 'range', min: 0.5, max: 1.1, step: 0.01, precision: 2, typicalMin: 0.85, typicalMax: 0.92 })}
          ${makeCpuField('silent', 'avPriceAccuracyEnd', 'avPriceAccuracyEnd', { type: 'range', min: 0.4, max: 1, step: 0.01, precision: 2, typicalMin: 0.7, typicalMax: 0.85 })}
          ${makeCpuField('silent', 'avPriceAccuracyHoldRounds', 'avPriceAccuracyHoldRounds', { type: 'range', min: 1, max: 10, step: 1, precision: 0, typicalMin: 5, typicalMax: 7 })}
          ${makeCpuField('silent', 'earlyAvAccuracyStrength', 'earlyAvAccuracyStrength', { type: 'range', min: 0, max: 1, step: 0.01, precision: 2, typicalMin: 0.7, typicalMax: 0.95 })}
          ${makeCpuField('silent', 'earlyRoundBidCoverageCapMaxRound', 'earlyRoundBidCoverageCapMaxRound', { type: 'range', min: 1, max: 10, step: 1, precision: 0, typicalMin: 6, typicalMax: 10 })}
          ${makeCpuField('silent', 'roundUndraftedTargetEarly', 'roundUndraftedTargetEarly', { type: 'range', min: 0, max: 20, step: 1, precision: 0, typicalMin: 5, typicalMax: 8 })}
          ${makeCpuField('silent', 'roundUndraftedTargetLate', 'roundUndraftedTargetLate', { type: 'range', min: 0, max: 20, step: 1, precision: 0, typicalMin: 8, typicalMax: 12 })}
          ${makeCpuField('silent', 'roundUndraftedFloor', 'roundUndraftedFloor', { type: 'range', min: 0, max: 15, step: 1, precision: 0, typicalMin: 3, typicalMax: 6 })}
          ${makeCpuField('silent', 'roundUndraftedCeiling', 'roundUndraftedCeiling', { type: 'range', min: 1, max: 24, step: 1, precision: 0, typicalMin: 10, typicalMax: 13 })}
          ${makeCpuField('silent', 'simulationReserveEnabled', 'simulationReserveEnabled (0/1)', { type: 'range', min: 0, max: 1, step: 1, typicalMin: 0, typicalMax: 1 })}
          ${makeCpuField('silent', 'bidCoverageCapJitter', 'bidCoverageCapJitter', { type: 'range', min: 0, max: 8, step: 1, precision: 0, typicalMin: 2, typicalMax: 4 })}
          ${makeCpuField('silent', 'avMarketDepthMinCompetitiveBids', 'avMarketDepthMinCompetitiveBids', { type: 'range', min: 1, max: 8, step: 1, precision: 0, typicalMin: 3, typicalMax: 5 })}
          ${makeCpuField('silent', 'rosterExtraSpots', 'rosterExtraSpots', { type: 'range', min: 0, max: 12, step: 1, precision: 0, typicalMin: 3, typicalMax: 6 })}
          ${makeCpuField('silent', 'upgradeBudgetFloor', 'upgradeBudgetFloor', { type: 'range', min: 0, max: 60, step: 1, precision: 0, typicalMin: 10, typicalMax: 25 })}
          ${makeCpuField('silent', 'spreadBidCap', 'Spread Bid Cap', { type: 'range', min: 0, max: 1, step: 0.01, typicalMin: 0.40, typicalMax: 0.75 })}
          ${makeCpuField('silent', 'avCenteringStrength', 'AV Centering Strength', { type: 'range', min: 0, max: 1, step: 0.01, typicalMin: 0.50, typicalMax: 0.95 })}
          ${makeCpuField('silent', 'marketSensitivity', 'Market Sensitivity', { type: 'range', min: 0, max: 1, step: 0.01, typicalMin: 0.50, typicalMax: 0.85 })}
          ${makeCpuField('silent', 'paceCatchBidIntensity', 'Pace Catch Bid Intensity', { type: 'range', min: 0, max: 1, step: 0.01, typicalMin: 0.40, typicalMax: 0.80 })}
          ${makeCpuField('silent', 'spreadModeIntensity', 'spreadModeIntensity', { type: 'range', min: 0, max: 1, step: 0.01, typicalMin: 0.15, typicalMax: 0.40 })}
          ${makeCpuField('silent', 'starTargetAggressionBoost', 'Star Target Aggression Boost', { type: 'range', min: 0, max: 1, step: 0.01, typicalMin: 0.40, typicalMax: 0.75 })}
          ${makeCpuField('silent', 'starTargetLowballReduction', 'Star Target Lowball Reduction', { type: 'range', min: 0, max: 1, step: 0.01, typicalMin: 0.30, typicalMax: 0.70 })}
          ${makeCpuField('silent', 'lowballIntensity', 'Lowball Intensity', { type: 'range', min: 0, max: 1, step: 0.01, typicalMin: 0.55, typicalMax: 0.80 })}
          ${makeCpuField('silent', 'cheapFillerBidFrequency', 'cheapFillerBidFrequency', { type: 'range', min: 0, max: 1, step: 0.01, typicalMin: 0.25, typicalMax: 0.50 })}
          ${makeCpuField('silent', 'earlyRoundMaxBidsCap', 'earlyRoundMaxBidsCap', { type: 'range', min: 3, max: 12, step: 1, precision: 0, typicalMin: 5, typicalMax: 8 })}
          ${makeCpuField('silent', 'globalBidVolumeMultiplier', 'globalBidVolumeMultiplier', { type: 'range', min: 0.35, max: 1.25, step: 0.01, typicalMin: 0.85, typicalMax: 1.05 })}
          ${makeCpuField('silent', 'spreadBidVolumeMultiplier', 'spreadBidVolumeMultiplier', { type: 'range', min: 0.35, max: 1.25, step: 0.01, typicalMin: 0.80, typicalMax: 1.00 })}
          ${makeCpuField('silent', 'spreadDollarBidMultiplier', 'spreadDollarBidMultiplier', { type: 'range', min: 0, max: 1.25, step: 0.01, typicalMin: 0.60, typicalMax: 0.85 })}
          ${makeCpuField('silent', 'starAvailabilityOverride', 'Star Availability Override', { type: 'range', min: 0, max: 1, step: 0.01, typicalMin: 0.60, typicalMax: 0.85 })}
          ${makeCpuField('silent', 'round1ThresholdBias', 'Round 1 Threshold Bias', { type: 'range', min: -0.25, max: 0.25, step: 0.01, typicalMin: 0.04, typicalMax: 0.09 })}
          ${makeCpuField('silent', 'round2ThresholdBias', 'Round 2 Threshold Bias', { type: 'range', min: -0.25, max: 0.25, step: 0.01, typicalMin: 0.01, typicalMax: 0.06 })}
          ${makeCpuField('silent', 'round3ThresholdBias', 'Round 3 Threshold Bias', { type: 'range', min: -0.25, max: 0.25, step: 0.01, typicalMin: -0.01, typicalMax: 0.03 })}
          ${makeCpuField('silent', 'round4ThresholdBias', 'Round 4 Threshold Bias', { type: 'range', min: -0.25, max: 0.25, step: 0.01, typicalMin: -0.03, typicalMax: 0.02 })}
          ${makeCpuField('silent', 'round5ThresholdBias', 'Round 5 Threshold Bias', { type: 'range', min: -0.25, max: 0.25, step: 0.01, typicalMin: -0.04, typicalMax: 0.01 })}
          ${makeCpuField('silent', 'round6ThresholdBias', 'Round 6 Threshold Bias', { type: 'range', min: -0.25, max: 0.25, step: 0.01, typicalMin: -0.07, typicalMax: -0.01 })}
          ${makeCpuField('silent', 'round7ThresholdBias', 'Round 7 Threshold Bias', { type: 'range', min: -0.25, max: 0.25, step: 0.01, typicalMin: -0.08, typicalMax: -0.01 })}
          ${makeCpuField('silent', 'round8ThresholdBias', 'Round 8 Threshold Bias', { type: 'range', min: -0.25, max: 0.25, step: 0.01, typicalMin: -0.09, typicalMax: -0.01 })}
          ${makeCpuField('silent', 'round9ThresholdBias', 'Round 9 Threshold Bias', { type: 'range', min: -0.25, max: 0.25, step: 0.01, typicalMin: -0.10, typicalMax: -0.01 })}
          ${makeCpuField('silent', 'round10ThresholdBias', 'Round 10 Threshold Bias', { type: 'range', min: -0.25, max: 0.25, step: 0.01, typicalMin: -0.10, typicalMax: -0.01 })}
        </div>
      </div>

      <div class="admin-cpu-group">
        <div class="admin-cpu-group-title">Early Round Selectivity</div>
        <div class="admin-cpu-grid">
          ${makeCpuField('silent', 'roundThresholdBiasScale', 'Threshold Bias Strength', { type: 'range', min: 1, max: 80, step: 1, typicalMin: 30, typicalMax: 55 })}
          ${makeCpuField('silent', 'draftChancePriorityWeight', 'draftchancepriorityweight', { type: 'range', min: 0, max: 3, step: 0.05, typicalMin: 1.2, typicalMax: 2.2 })}
          ${makeCpuField('silent', 'draftChancePriorityThreshold', 'draftChancePriorityThreshold', { type: 'range', min: 0, max: 1, step: 0.01, typicalMin: 0.55, typicalMax: 0.70 })}
          ${makeCpuField('silent', 'draftChancePrimaryBaseFloor', 'draftChancePrimaryBaseFloor', { type: 'range', min: 0, max: 1, step: 0.01, typicalMin: 0.45, typicalMax: 0.65 })}
          ${makeCpuField('silent', 'draftChancePrimaryMinFloor', 'draftChancePrimaryMinFloor', { type: 'range', min: 0, max: 1, step: 0.01, typicalMin: 0.20, typicalMax: 0.35 })}
          ${makeCpuField('silent', 'draftChanceLowBidCapPct', 'draftChanceLowBidCapPct', { type: 'range', min: 0, max: 1, step: 0.01, typicalMin: 0.08, typicalMax: 0.20 })}
          
          ${makeCpuField('silent', 'draftChancePrimaryEnabled', 'draftChancePrimaryEnabled (0/1)', { type: 'range', min: 0, max: 1, step: 1, precision: 0, typicalMin: 1, typicalMax: 1 })}
          ${makeCpuField('silent', 'spreadDraftChanceFloor', 'spreadDraftChanceFloor', { type: 'range', min: 0, max: 1, step: 0.01, typicalMin: 0.35, typicalMax: 0.55 })}
          ${makeCpuField('silent', 'midRoundLikelyDraftedOnlyEnabled', 'midRoundLikelyDraftedOnlyEnabled (0/1)', { type: 'range', min: 0, max: 1, step: 1, precision: 0, typicalMin: 0, typicalMax: 1 })}
          ${makeCpuField('silent', 'earlySelectiveMaxRound', 'Selective Through Round', { type: 'range', min: 0, max: 10, step: 1, typicalMin: 5, typicalMax: 7 })}
          ${makeCpuField('silent', 'starterFillTargetRound', 'Lineup Filled By Round', { type: 'range', min: 1, max: 10, step: 1, typicalMin: 7, typicalMax: 9 })}
          ${makeCpuField('silent', 'earlyCheapSkipMaxRound', 'earlyCheapSkipMaxRound', { type: 'range', min: 0, max: 10, step: 1, typicalMin: 4, typicalMax: 6 })}
          ${makeCpuField('silent', 'earlyCheapAvThreshold', 'earlyCheapAvThreshold', { type: 'range', min: 0, max: 20, step: 1, typicalMin: 5, typicalMax: 10 })}
          ${makeCpuField('silent', 'earlyCheapSkipRate', 'earlyCheapSkipRate', { type: 'range', min: 0, max: 1, step: 0.05, typicalMin: 0.45, typicalMax: 0.75 })}
        </div>
      </div>

      <div class="admin-cpu-group">
        <div class="admin-cpu-group-title">Spend Pacing &amp; Team Variance</div>
        <div class="admin-cpu-grid">
          ${makeCpuField('silent', 'roundCommitR1Pct', 'roundCommitR1Pct (% of remaining)', { type: 'range', min: 0, max: 1, step: 0.01, typicalMin: 0.55, typicalMax: 0.70 })}
          ${makeCpuField('silent', 'roundCommitR2Pct', 'roundCommitR2Pct (% of remaining)', { type: 'range', min: 0, max: 1, step: 0.01, typicalMin: 0.58, typicalMax: 0.72 })}
          ${makeCpuField('silent', 'roundCommitR3Pct', 'roundCommitR3Pct (% of remaining)', { type: 'range', min: 0, max: 1, step: 0.01, typicalMin: 0.60, typicalMax: 0.75 })}
          ${makeCpuField('silent', 'roundCommitR4Pct', 'roundCommitR4Pct (% of remaining)', { type: 'range', min: 0, max: 1, step: 0.01, typicalMin: 0.62, typicalMax: 0.78 })}
          ${makeCpuField('silent', 'roundCommitR5Pct', 'roundCommitR5Pct (% of remaining)', { type: 'range', min: 0, max: 1, step: 0.01, typicalMin: 0.66, typicalMax: 0.82 })}
          ${makeCpuField('silent', 'roundCommitR6Pct', 'roundCommitR6Pct (% of remaining)', { type: 'range', min: 0, max: 1, step: 0.01, typicalMin: 0.70, typicalMax: 0.86 })}
          ${makeCpuField('silent', 'roundCommitR7Pct', 'roundCommitR7Pct (% of remaining)', { type: 'range', min: 0, max: 1, step: 0.01, typicalMin: 0.74, typicalMax: 0.90 })}
          ${makeCpuField('silent', 'roundCommitR8Pct', 'roundCommitR8Pct (% of remaining)', { type: 'range', min: 0, max: 1, step: 0.01, typicalMin: 0.82, typicalMax: 0.94 })}
          ${makeCpuField('silent', 'roundCommitR9Pct', 'roundCommitR9Pct (% of remaining)', { type: 'range', min: 0, max: 1, step: 0.01, typicalMin: 0.90, typicalMax: 0.98 })}
          ${makeCpuField('silent', 'roundCommitR10Pct', 'roundCommitR10Pct (% of remaining)', { type: 'range', min: 0, max: 1, step: 0.01, typicalMin: 0.97, typicalMax: 1.0 })}
          ${makeCpuField('silent', 'commitmentTiltMin', 'Team Spend Tilt Min', { type: 'range', min: 0.5, max: 1, step: 0.01, typicalMin: 0.75, typicalMax: 0.90 })}
          ${makeCpuField('silent', 'commitmentTiltMax', 'Team Spend Tilt Max', { type: 'range', min: 1, max: 1.5, step: 0.01, typicalMin: 1.10, typicalMax: 1.25 })}
          ${makeCpuField('silent', 'commitmentRangeBelowTargetPct', 'commitmentRangeBelowTargetPct', { type: 'range', min: 0, max: 0.5, step: 0.01, typicalMin: 0.10, typicalMax: 0.20 })}
          ${makeCpuField('silent', 'commitmentRangeAboveTargetPct', 'commitmentRangeAboveTargetPct', { type: 'range', min: 0, max: 0.5, step: 0.01, typicalMin: 0.05, typicalMax: 0.15 })}
          ${makeCpuField('silent', 'commitmentRangeCenterBandPct', 'commitmentRangeCenterBandPct', { type: 'range', min: 0, max: 0.2, step: 0.01, typicalMin: 0.02, typicalMax: 0.05 })}
          ${makeCpuField('silent', 'commitmentRangeLowTeamPct', 'commitmentRangeLowTeamPct', { type: 'range', min: 0, max: 0.5, step: 0.05, typicalMin: 0.15, typicalMax: 0.25 })}
          ${makeCpuField('silent', 'commitmentRangeHighTeamPct', 'commitmentRangeHighTeamPct', { type: 'range', min: 0, max: 0.5, step: 0.05, typicalMin: 0.15, typicalMax: 0.25 })}
          ${makeCpuField('silent', 'commitmentRangeLockFinalRounds', 'commitmentRangeLockFinalRounds', { type: 'range', min: 0, max: 3, step: 1, precision: 0, typicalMin: 2, typicalMax: 2 })}
          ${makeCpuField('silent', 'paceBandMinMultiplier', 'Pace Band Min Multiplier', { type: 'range', min: 0.3, max: 1.5, step: 0.01, typicalMin: 0.70, typicalMax: 0.90 })}
          ${makeCpuField('silent', 'paceBandMaxMultiplier', 'Pace Band Max Multiplier', { type: 'range', min: 0.3, max: 2, step: 0.01, typicalMin: 1.05, typicalMax: 1.25 })}
          ${makeCpuField('silent', 'paceBandTeamJitter', 'Pace Band Team Jitter', { type: 'range', min: 0, max: 2, step: 0.05, typicalMin: 0.5, typicalMax: 0.9 })}
        </div>
      </div>

      <div class="admin-cpu-group">
        <div class="admin-cpu-group-title">AV Bid Cap Knobs</div>
        <div class="admin-cpu-grid">
          ${makeCpuField('silent', 'avCapMult1to5', 'AV $1-5 Cap Multiplier', { type: 'range', min: 1, max: 1.8, step: 0.01, typicalMin: 1.12, typicalMax: 1.35 })}
          ${makeCpuField('silent', 'avCapMult5to10', 'AV $5-10 Cap Multiplier', { type: 'range', min: 1, max: 1.8, step: 0.01, typicalMin: 1.1, typicalMax: 1.3 })}
          ${makeCpuField('silent', 'avCapMult10to20', 'AV $10-20 Cap Multiplier', { type: 'range', min: 1, max: 1.8, step: 0.01, typicalMin: 1.08, typicalMax: 1.24 })}
          ${makeCpuField('silent', 'avCapMult20to30', 'AV $20-30 Cap Multiplier', { type: 'range', min: 1, max: 1.7, step: 0.01, typicalMin: 1.06, typicalMax: 1.2 })}
          ${makeCpuField('silent', 'avCapMult30to40', 'AV $30-40 Cap Multiplier', { type: 'range', min: 1, max: 1.6, step: 0.01, typicalMin: 1.04, typicalMax: 1.18 })}
          ${makeCpuField('silent', 'avCapMult40to50', 'AV $40-50 Cap Multiplier', { type: 'range', min: 1, max: 1.5, step: 0.01, typicalMin: 1.03, typicalMax: 1.14 })}
          ${makeCpuField('silent', 'avCapMult50to60', 'AV $50-60 Cap Multiplier', { type: 'range', min: 1, max: 1.4, step: 0.01, typicalMin: 1.02, typicalMax: 1.12 })}
          ${makeCpuField('silent', 'avCapMult60Plus', 'AV $60+ Cap Multiplier', { type: 'range', min: 1, max: 1.35, step: 0.01, typicalMin: 1.01, typicalMax: 1.1 })}
          ${makeCpuField('silent', 'avCapBaseBuffer', 'AV Cap Base Buffer', { type: 'range', min: 0, max: 6, step: 1, precision: 0, typicalMin: 0, typicalMax: 3 })}
          ${makeCpuField('silent', 'avCapLateRoundExtraBuffer', 'AV Cap Late-Round Buffer', { type: 'range', min: 0, max: 4, step: 1, precision: 0, typicalMin: 0, typicalMax: 2 })}
        </div>
      </div>

      <div class="admin-cpu-group">
        <div class="admin-cpu-group-title">AV Participation Curve Knobs</div>
        <div class="admin-cpu-grid">
          ${makeCpuField('silent', 'band50PlusMinTeamPct', 'AV 50+ Preferred Team % Min', { type: 'range', min: 0.2, max: 0.9, step: 0.01, typicalMin: 0.35, typicalMax: 0.5 })}
          ${makeCpuField('silent', 'band50PlusMaxTeamPct', 'AV 50+ Preferred Team % Max', { type: 'range', min: 0.25, max: 0.95, step: 0.01, typicalMin: 0.5, typicalMax: 0.7 })}
          ${makeCpuField('silent', 'band40to49MinTeamPct', 'AV 40-49 Preferred Team % Min', { type: 'range', min: 0.2, max: 0.9, step: 0.01, typicalMin: 0.35, typicalMax: 0.5 })}
          ${makeCpuField('silent', 'band40to49MaxTeamPct', 'AV 40-49 Preferred Team % Max', { type: 'range', min: 0.25, max: 0.95, step: 0.01, typicalMin: 0.5, typicalMax: 0.7 })}
          ${makeCpuField('silent', 'band30to39MinTeamPct', 'AV 30-39 Preferred Team % Min', { type: 'range', min: 0.15, max: 0.8, step: 0.01, typicalMin: 0.3, typicalMax: 0.45 })}
          ${makeCpuField('silent', 'band30to39MaxTeamPct', 'AV 30-39 Preferred Team % Max', { type: 'range', min: 0.2, max: 0.9, step: 0.01, typicalMin: 0.45, typicalMax: 0.65 })}
          ${makeCpuField('silent', 'band20to29MinTeamPct', 'AV 20-29 Preferred Team % Min', { type: 'range', min: 0.1, max: 0.7, step: 0.01, typicalMin: 0.2, typicalMax: 0.35 })}
          ${makeCpuField('silent', 'band20to29MaxTeamPct', 'AV 20-29 Preferred Team % Max', { type: 'range', min: 0.15, max: 0.8, step: 0.01, typicalMin: 0.35, typicalMax: 0.5 })}
          ${makeCpuField('silent', 'band10to19MinTeamPct', 'AV 10-19 Preferred Team % Min', { type: 'range', min: 0.05, max: 0.6, step: 0.01, typicalMin: 0.1, typicalMax: 0.25 })}
          ${makeCpuField('silent', 'band10to19MaxTeamPct', 'AV 10-19 Preferred Team % Max', { type: 'range', min: 0.1, max: 0.7, step: 0.01, typicalMin: 0.25, typicalMax: 0.4 })}
          ${makeCpuField('silent', 'band1to9MinTeamPct', 'AV 1-9 Preferred Team % Min', { type: 'range', min: 0.05, max: 0.5, step: 0.01, typicalMin: 0.08, typicalMax: 0.2 })}
          ${makeCpuField('silent', 'band1to9MaxTeamPct', 'AV 1-9 Preferred Team % Max', { type: 'range', min: 0.1, max: 0.7, step: 0.01, typicalMin: 0.2, typicalMax: 0.4 })}
          ${makeCpuField('silent', 'band1to9NoBidChance', 'AV 1-9 No-Bid Chance', { type: 'range', min: 0, max: 0.95, step: 0.01, typicalMin: 0.35, typicalMax: 0.75 })}
          ${makeCpuField('silent', 'band10to19NoBidChance', 'AV 10-19 No-Bid Chance', { type: 'range', min: 0, max: 0.9, step: 0.01, typicalMin: 0.1, typicalMax: 0.4 })}
          ${makeCpuField('silent', 'bandLowAvNoBidLateRoundRelief', 'Low-AV Late-Round Relief', { type: 'range', min: 0, max: 0.25, step: 0.01, typicalMin: 0.06, typicalMax: 0.16 })}
          ${makeCpuField('silent', 'lowAvEarlyRoundNoBidBoost', 'lowAvEarlyRoundNoBidBoost', { type: 'range', min: 0, max: 0.4, step: 0.01, typicalMin: 0.06, typicalMax: 0.16 })}
          ${makeCpuField('silent', 'lowAvLateRoundReliefStartRound', 'lowAvLateRoundReliefStartRound', { type: 'range', min: 4, max: 10, step: 1, precision: 0, typicalMin: 6, typicalMax: 8 })}
          ${makeCpuField('silent', 'lowAvCompletionGuardEnabled', 'lowAvCompletionGuardEnabled (0/1)', { type: 'range', min: 0, max: 1, step: 1, precision: 0, typicalMin: 1, typicalMax: 1 })}
          ${makeCpuField('silent', 'lowAvCompletionGuardStartRound', 'lowAvCompletionGuardStartRound', { type: 'range', min: 5, max: 10, step: 1, precision: 0, typicalMin: 7, typicalMax: 9 })}
          ${makeCpuField('silent', 'lowAvCompletionGuardMinRosterRatio', 'lowAvCompletionGuardMinRosterRatio', { type: 'range', min: 0.5, max: 0.95, step: 0.01, typicalMin: 0.72, typicalMax: 0.88 })}
          ${makeCpuField('silent', 'lowAvCompletionGuardMinBidders', 'lowAvCompletionGuardMinBidders', { type: 'range', min: 0, max: 4, step: 1, precision: 0, typicalMin: 1, typicalMax: 2 })}
          ${makeCpuField('silent', 'band50PlusPullChance', 'AV 50+ Pull Strength', { type: 'range', min: 0, max: 1, step: 0.01, typicalMin: 0.8, typicalMax: 1.0 })}
          ${makeCpuField('silent', 'band40to49PullChance', 'AV 40-49 Pull Strength', { type: 'range', min: 0, max: 1, step: 0.01, typicalMin: 0.7, typicalMax: 0.95 })}
          ${makeCpuField('silent', 'bandDefaultPullChance', 'AV 1-39 Pull Strength', { type: 'range', min: 0, max: 1, step: 0.01, typicalMin: 0.55, typicalMax: 0.9 })}
          ${makeCpuField('silent', 'topAvHardMaxTeamPct', 'AV 40+ Hard Team % Max', { type: 'range', min: 0.3, max: 1, step: 0.01, typicalMin: 0.7, typicalMax: 0.9 })}
          ${makeCpuField('silent', 'avMarketDepthMaxPlayersPerRound', 'avMarketDepthMaxPlayersPerRound', { type: 'range', min: 1, max: 12, step: 1, precision: 0, typicalMin: 3, typicalMax: 6 })}
          ${makeCpuField('silent', 'avMarketDepthMinBidMultiplier', 'avMarketDepthMinBidMultiplier', { type: 'range', min: 0.5, max: 1.2, step: 0.01, typicalMin: 0.85, typicalMax: 1.0 })}
          ${makeCpuField('silent', 'avMarketDepthBidLowMultiplier', 'avMarketDepthBidLowMultiplier', { type: 'range', min: 0.5, max: 1.2, step: 0.01, typicalMin: 0.85, typicalMax: 1.0 })}
          ${makeCpuField('silent', 'avMarketDepthBidHighMultiplier', 'avMarketDepthBidHighMultiplier', { type: 'range', min: 0.5, max: 1.3, step: 0.01, typicalMin: 1.0, typicalMax: 1.1 })}
        </div>
        <div id="cpuParticipationCurveGraph" class="admin-cpu-curve-wrap"></div>
        ${participationCurveFields}
      </div>

      <div class="admin-cpu-group">
        <div class="admin-cpu-group-title">Tied Auction Knobs</div>
        <div class="admin-cpu-grid">
          ${makeCpuField('tied', 'baseBidProb', 'Base Bid Probability', { type: 'range', min: 0, max: 1, step: 0.01, typicalMin: 0.28, typicalMax: 0.42 })}
          ${makeCpuField('tied', 'preAvShape', 'Pre-AV Shape (s1)', { type: 'range', min: 0, max: 3, step: 0.01, typicalMin: 0.60, typicalMax: 1.00 })}
          ${makeCpuField('tied', 'postAvDrop', 'Post-AV Drop (s2)', { type: 'range', min: 0, max: 3, step: 0.01, typicalMin: 1.40, typicalMax: 2.10 })}
          ${makeCpuField('tied', 'nearAvStart', 'Near AV Start', { type: 'range', min: 0.5, max: 1.5, step: 0.01, typicalMin: 0.90, typicalMax: 0.98 })}
          ${makeCpuField('tied', 'overAvStart', 'Over AV Start', { type: 'range', min: 0.5, max: 1.5, step: 0.01, typicalMin: 0.98, typicalMax: 1.05 })}
          ${makeCpuField('tied', 'nearAvWindow', 'Near AV Window', { type: 'range', min: 0, max: 1, step: 0.01, typicalMin: 0.08, typicalMax: 0.16 })}
          ${makeCpuField('tied', 'overAvWindow', 'Over AV Window', { type: 'range', min: 0, max: 1, step: 0.01, typicalMin: 0.08, typicalMax: 0.16 })}
          ${makeCpuField('tied', 'fearNearWeight', 'Fear Weight Near AV', { type: 'range', min: 0, max: 1, step: 0.01, typicalMin: 0.12, typicalMax: 0.24 })}
          ${makeCpuField('tied', 'fearOverWeight', 'Fear Weight Over AV', { type: 'range', min: 0, max: 1, step: 0.01, typicalMin: 0.20, typicalMax: 0.36 })}
          ${makeCpuField('tied', 'disciplineWeight', 'Discipline Weight', { type: 'range', min: 0, max: 1, step: 0.01, typicalMin: 0.14, typicalMax: 0.28 })}
          ${makeCpuField('tied', 'budgetHighThreshold', 'Budget High Threshold', { type: 'range', min: 0, max: 1, step: 0.01, typicalMin: 0.40, typicalMax: 0.52 })}
          ${makeCpuField('tied', 'budgetMidThreshold', 'Budget Mid Threshold', { type: 'range', min: 0, max: 1, step: 0.01, typicalMin: 0.24, typicalMax: 0.36 })}
          ${makeCpuField('tied', 'backoutBase', 'Backout Base', { type: 'range', min: 0, max: 1, step: 0.01, typicalMin: 0.05, typicalMax: 0.12 })}
          ${makeCpuField('tied', 'backoutAggressionScale', 'Backout Aggression Scale', { type: 'range', min: 0, max: 1, step: 0.01, typicalMin: 0.25, typicalMax: 0.42 })}
          ${makeCpuField('tied', 'clockBoost', 'Clock Boost', { type: 'range', min: 0.5, max: 2, step: 0.01, typicalMin: 0.95, typicalMax: 1.12 })}
        </div>
      </div>

      <div class="admin-cpu-group">
        <div class="admin-cpu-group-title">Test Scenario</div>
        <div class="admin-cpu-grid">
          ${makeCpuField('scenario', 'profileIndex', 'Silent Profile', { type: 'select', choices: cpuSilentProfiles.map((profile, index) => ({ value: String(index), label: profile.name })) })}
          ${makeCpuField('scenario', 'tiedProfileIndex', 'Tied Profile', { type: 'select', choices: cpuTiedProfiles.map((profile, index) => ({ value: String(index), label: profile.name })) })}
          ${makeCpuField('scenario', 'position', 'Position', { type: 'select', choices: ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'].map((position) => ({ value: position, label: position })) })}
          ${makeCpuField('scenario', 'avgValue', 'Avg Value / AV', { type: 'range', min: 1, max: 60, step: 1, precision: 0, typicalMin: 18, typicalMax: 40 })}
          ${makeCpuField('scenario', 'round', 'Round', { type: 'range', min: 1, max: 10, step: 1, precision: 0, typicalMin: 3, typicalMax: 8 })}
          ${makeCpuField('scenario', 'budgetRemaining', 'Budget Remaining', { type: 'range', min: 0, max: 500, step: 1, precision: 0, typicalMin: 55, typicalMax: 140 })}
          ${makeCpuField('scenario', 'currentBid', 'Current Bid', { type: 'range', min: 0, max: 500, step: 1, precision: 0, typicalMin: 10, typicalMax: 45 })}
          ${makeCpuField('scenario', 'playerAV', 'Player AV', { type: 'range', min: 1, max: 100, step: 1, precision: 0, typicalMin: 12, typicalMax: 40 })}
          ${makeCpuField('scenario', 'timeLeft', 'Time Left', { type: 'range', min: 0, max: 10, step: 1, precision: 0, typicalMin: 1, typicalMax: 5 })}
          ${makeCpuField('scenario', 'teamsRemaining', 'Teams Remaining', { type: 'range', min: 1, max: 20, step: 1, precision: 0, typicalMin: 3, typicalMax: 10 })}
          ${makeCpuField('scenario', 'positionNeed', 'Position Need', { type: 'range', min: 0, max: 1.5, step: 0.01, typicalMin: 0.35, typicalMax: 0.90 })}
          ${makeCpuField('scenario', 'rosterSpotsLeft', 'Roster Spots Left', { type: 'range', min: 0, max: 20, step: 1, precision: 0, typicalMin: 3, typicalMax: 9 })}
          ${makeCpuField('scenario', 'playersNeededForMinimum', 'Players Needed for Minimum', { type: 'range', min: 0, max: 20, step: 1, precision: 0, typicalMin: 0, typicalMax: 4 })}
        </div>
      </div>
    `;

    if (silentCpuReference) {
      renderCpuReferenceProfiles(silentCpuReference, 'CPU team personalities used in silent auction bidding.', cpuSilentProfiles);
      const silentRanges = document.createElement('div');
      silentRanges.innerHTML = '<div class="admin-cpu-subtitle">Bid Ranges</div>';
      renderCpuBidRangeTable(silentRanges, cpuSilentBidRanges);
      silentCpuReference.appendChild(silentRanges);
    }

    if (tiedCpuReference) {
      tiedCpuReference.innerHTML = `
        <p class="admin-cpu-note">Tied-auction profiles affect bid probability, hesitation, fear, and backout pressure.</p>
        <table class="admin-cpu-table">
          <thead>
            <tr><th>Profile</th><th>Weights</th></tr>
          </thead>
          <tbody>
            ${cpuTiedProfiles.map((profile) => `
              <tr>
                <td><strong>${escapeHtml(profile.name)}</strong></td>
                <td>${Object.entries(profile).filter(([key]) => key !== 'name').map(([key, value]) => `${escapeHtml(key)}=${Number(value).toFixed(2)}`).join(' · ')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div class="admin-cpu-subtitle" style="margin-top:10px;">Core Formula Anchors</div>
        <div class="admin-cpu-pill-row">
          <span class="admin-cpu-pill">P0 = 0.34</span>
          <span class="admin-cpu-pill">s1 = 0.8 + A/120</span>
          <span class="admin-cpu-pill">s2 = 1.8 + A/60</span>
          <span class="admin-cpu-pill">Near AV = 0.94</span>
          <span class="admin-cpu-pill">Over AV = 1.00</span>
        </div>
      `;
    }

    renderCpuParticipationCurveGraph();

    bindCpuTuningControls();
    runCpuPreview();
  }

  function bindCpuTuningControls() {
    if (!cpuTuningControls) return;

    function updateSliderValueLabel(element) {
      if (!(element instanceof HTMLInputElement) || element.type !== 'range') return;
      const valueEl = element.closest('.admin-cpu-field')?.querySelector('[data-cpu-value]');
      const fieldEl = element.closest('.admin-cpu-field');
      if (!valueEl) return;
      const precision = Number(valueEl.getAttribute('data-cpu-precision') || element.dataset.cpuPrecision || 0);
      valueEl.textContent = formatCpuValue(element.value, precision);

      const typicalMin = Number(element.dataset.cpuTypicalMin);
      const typicalMax = Number(element.dataset.cpuTypicalMax);
      const hasTypical = Number.isFinite(typicalMin) && Number.isFinite(typicalMax);
      if (hasTypical) {
        const numericValue = Number(element.value);
        const inRange = numericValue >= typicalMin && numericValue <= typicalMax;
        if (fieldEl) {
          fieldEl.classList.toggle('admin-cpu-field-in-range', inRange);
          fieldEl.classList.toggle('admin-cpu-field-out-of-range', !inRange);
        }
        valueEl.classList.toggle('admin-cpu-field-value-in-range', inRange);
        valueEl.classList.toggle('admin-cpu-field-value-out-of-range', !inRange);
        element.style.accentColor = inRange ? '#4fc18a' : '#e2a84a';
      } else {
        if (fieldEl) {
          fieldEl.classList.remove('admin-cpu-field-in-range', 'admin-cpu-field-out-of-range');
        }
        valueEl.classList.remove('admin-cpu-field-value-in-range', 'admin-cpu-field-value-out-of-range');
        element.style.accentColor = '';
      }
    }

    cpuTuningControls.querySelectorAll('[data-cpu-section][data-cpu-key]').forEach((element) => {
      element.addEventListener('input', () => {
        const section = element.dataset.cpuSection;
        const key = element.dataset.cpuKey;
        const currentValue = element.tagName === 'SELECT' ? element.value : Number(element.value);
        setCpuFieldValue(section, key, Number.isFinite(currentValue) && element.tagName !== 'SELECT' ? currentValue : currentValue);
        updateSliderValueLabel(element);
        renderCpuParticipationCurveGraph();
        runCpuPreview();
      });
      element.addEventListener('change', () => {
        const section = element.dataset.cpuSection;
        const key = element.dataset.cpuKey;
        const currentValue = element.tagName === 'SELECT' ? element.value : Number(element.value);
        setCpuFieldValue(section, key, Number.isFinite(currentValue) && element.tagName !== 'SELECT' ? currentValue : currentValue);
        updateSliderValueLabel(element);
        saveCpuTuningPreset(cpuTuningState);
        renderCpuParticipationCurveGraph();
        runCpuPreview();
      });

      updateSliderValueLabel(element);
    });

    if (cpuModelSelect) {
      cpuModelSelect.onchange = () => {
        const selected = String(cpuModelSelect.value || '').trim();
        activeCpuModelName = selected;
        if (cpuModelNameInput && selected) {
          cpuModelNameInput.value = selected;
        }
        renderCpuModelDetails(selected);
        renderCpuModelComparison(selected);
        renderCpuModelLibrary(selected);
      };
    }

    if (cpuModelList) {
      cpuModelList.onclick = (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        const action = String(target.dataset.modelAction || '').trim();
        const modelName = String(target.dataset.modelName || '').trim();
        if (!action || !modelName) return;

        if (cpuModelSelect) cpuModelSelect.value = modelName;
        if (cpuModelNameInput) cpuModelNameInput.value = modelName;

        if (action === 'inspect') {
          renderCpuModelDetails(modelName);
          renderCpuModelLibrary(modelName);
          return;
        }

        if (action === 'compare') {
          renderCpuModelDetails(modelName);
          renderCpuModelComparison(modelName);
          renderCpuModelLibrary(modelName);
          return;
        }

        if (action === 'load') {
          loadSelectedCpuModel();
          return;
        }

        if (action === 'delete') {
          deleteSelectedCpuModel();
        }
      };
    }

    if (cpuRunPreviewBtn) {
      cpuRunPreviewBtn.onclick = runCpuPreview;
    }
    if (cpuSavePresetBtn) {
      cpuSavePresetBtn.onclick = () => {
        saveCpuTuningPreset(cpuTuningState);
        setCpuTuningStatus('Preset saved locally.', 'success');
      };
    }
    if (cpuResetPresetBtn) {
      cpuResetPresetBtn.onclick = resetCpuTuningPreset;
    }
    if (cpuLoadDefaultsBtn) {
      cpuLoadDefaultsBtn.onclick = () => {
        cpuTuningState = deepClone(cpuTuningDefaults);
        renderCpuTuningLab();
        setCpuTuningStatus('Loaded defaults for preview.', 'success');
        runCpuPreview();
      };
    }
    if (cpuSaveNamedModelBtn) {
      cpuSaveNamedModelBtn.onclick = saveNamedCpuModel;
    }
    if (cpuLoadNamedModelBtn) {
      cpuLoadNamedModelBtn.onclick = loadSelectedCpuModel;
    }
    if (cpuDeleteNamedModelBtn) {
      cpuDeleteNamedModelBtn.onclick = deleteSelectedCpuModel;
    }
    if (cpuCompareNamedModelBtn) {
      cpuCompareNamedModelBtn.onclick = () => {
        const selected = String(cpuModelSelect?.value || '').trim();
        if (!selected || !cpuNamedModels[selected]) {
          setCpuTuningStatus('Select a saved model to compare.', 'error');
          return;
        }
        renderCpuModelComparison(selected);
        setCpuTuningStatus(`Compared "${selected}" against current sliders.`, 'success');
      };
    }
    if (cpuSaveToServerBtn) {
      cpuSaveToServerBtn.onclick = () => {
        void saveActiveCpuLogicToServer();
      };
    }
    if (cpuLoadFromServerBtn) {
      cpuLoadFromServerBtn.onclick = () => {
        void loadCpuLogicFromServer();
      };
    }
    if (cpuRunSimulationBtn) {
      cpuRunSimulationBtn.onclick = () => {
        void runFastDraftSimulations();
      };
    }
  }

  function calculateSilentProfileImpact(profile, state, silentTuning) {
    const round = Math.max(1, Number(state.round || 1));
    const budget = Math.max(0, Number(state.budgetRemaining || 0));
    const rosterSpotsLeft = Math.max(0, Number(state.rosterSpotsLeft || 0));
    const playersNeededForMinimum = Math.max(0, Number(state.playersNeededForMinimum || 0));
    const roundsLeft = Math.max(0, 10 - round);
    const roundsIncludingCurrent = Math.max(1, roundsLeft + 1);
    const isEarlyRound = round <= 3;
    const isLateRound = round >= 7;

    let score = Number(silentTuning.baseAggression || 0);
    const modifiers = [];

    if (budget > 150) {
      const change = Number(silentTuning.budgetRichBonus || 0);
      score += change;
      modifiers.push(`budget > 150: +${change}`);
    } else if (budget < 50) {
      const change = Number(silentTuning.budgetPoorPenalty || 0);
      score += change;
      modifiers.push(`budget < 50: ${change}`);
    }

    if (rosterSpotsLeft <= 3) {
      const change = Number(silentTuning.rosterTightBonus || 0);
      score += change;
      modifiers.push(`roster tight: +${change}`);
    } else if (rosterSpotsLeft >= 10) {
      const change = Number(silentTuning.rosterLoosePenalty || 0);
      score += change;
      modifiers.push(`roster loose: ${change}`);
    }

    if (playersNeededForMinimum > 0 && round >= 7) {
      const change = Number(silentTuning.finalFillBonus || 0);
      score += change;
      modifiers.push(`late fill pressure: +${change}`);
    }
    if (playersNeededForMinimum > 0) {
      const change = Number(silentTuning.missingStarterBonus || 0);
      score += change;
      modifiers.push(`missing starters: +${change}`);
    }

    if (isEarlyRound) {
      const change = Number(silentTuning.earlyRoundPenalty || 0);
      score += change;
      modifiers.push(`early round: ${change}`);
      if (budget > 150 && rosterSpotsLeft <= 8) {
        const earlyRichBonus = Math.max(0, Number(silentTuning.richEarlyBonusMax || 0) - 0.12);
        score += earlyRichBonus;
        modifiers.push(`rich early bonus: +${earlyRichBonus.toFixed(2)}`);
      }
    }

    const varianceCap = isEarlyRound ? 0.22 : isLateRound ? Number(silentTuning.lateRoundVarianceMax || 0) : Number(silentTuning.midRoundVarianceMax || 0);
    const profileFactor = Number(profile.aggression || 1);
    const estimated = clamp(score * profileFactor, 0.1, Number(silentTuning.maxAggressionCap || 1));

    return {
      profile,
      score,
      estimated,
      varianceCap,
      roundsIncludingCurrent,
      modifiers
    };
  }

  function previewSilentAuction(state) {
    const profile = cpuSilentProfiles[Math.max(0, Math.min(cpuSilentProfiles.length - 1, Number(state.profileIndex || 0)))] || cpuSilentProfiles[0];
    const computed = calculateSilentProfileImpact(profile, state, cpuTuningState.silent || {});

    return {
      ...computed,
      bidRange: cpuSilentBidRanges[String(state.position || 'WR').toUpperCase()] || cpuSilentBidRanges.WR
    };
  }

  function classifyAggression(estimated) {
    const value = Number(estimated || 0);
    if (value >= 1.2) return 'Very Aggressive';
    if (value >= 1.0) return 'Aggressive';
    if (value >= 0.8) return 'Balanced';
    if (value >= 0.6) return 'Conservative';
    return 'Very Conservative';
  }

  function formatSigned(value, digits = 3) {
    const numeric = Number(value || 0);
    if (!Number.isFinite(numeric)) return '0';
    const magnitude = Math.abs(numeric).toFixed(digits);
    if (numeric > 0) return `+${magnitude}`;
    if (numeric < 0) return `-${magnitude}`;
    return `+${magnitude}`;
  }

  function renderSilentProfileImpact(state, selectedProfileName = '') {
    if (!cpuProfileImpactTable || !cpuProfileImpactSummary) return;

    const selectedName = String(selectedProfileName || '').trim();
    const currentTuning = cpuTuningState.silent || {};
    const defaultTuning = cpuTuningDefaults.silent || {};
    const previousSnapshot = previousProfileImpactSnapshot || {};

    const rows = cpuSilentProfiles.map((profile) => {
      const current = calculateSilentProfileImpact(profile, state, currentTuning);
      const baseline = calculateSilentProfileImpact(profile, state, defaultTuning);
      const delta = current.estimated - baseline.estimated;
      const prior = Number(previousSnapshot[profile.name]);
      const stepDelta = Number.isFinite(prior) ? current.estimated - prior : 0;
      return {
        profile,
        current,
        baseline,
        delta,
        stepDelta,
        label: classifyAggression(current.estimated),
        isSelected: selectedName ? profile.name === selectedName : false
      };
    });

    cpuProfileImpactTable.innerHTML = `
      <table class="admin-cpu-table admin-cpu-impact-table">
        <thead>
          <tr>
            <th>Profile</th>
            <th>Multiplier</th>
            <th>Estimated Aggression</th>
            <th>Change Since Last Move</th>
            <th>Delta Vs Default</th>
            <th>Behavior</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((row) => `
            ${(() => {
              const isNeutral = Math.abs(row.stepDelta) < 1e-12;
              const stepClass = isNeutral
                ? 'admin-cpu-impact-neutral'
                : (row.stepDelta > 0 ? 'admin-cpu-impact-plus' : 'admin-cpu-impact-minus');
              const stepArrow = isNeutral
                ? '&middot;'
                : (row.stepDelta > 0 ? '&uarr;' : '&darr;');
              return `
            <tr${row.isSelected ? ' class="admin-cpu-impact-selected"' : ''}>
              <td><strong>${escapeHtml(row.profile.name)}</strong></td>
              <td>${Number(row.profile.aggression || 1).toFixed(2)}x</td>
              <td>${row.current.estimated.toFixed(3)}</td>
              <td class="${stepClass}"><span class="admin-cpu-impact-arrow">${stepArrow}</span> ${formatSigned(row.stepDelta)}</td>
              <td class="${row.delta >= 0 ? 'admin-cpu-impact-plus' : 'admin-cpu-impact-minus'}">${row.delta >= 0 ? '+' : ''}${row.delta.toFixed(3)}</td>
              <td>${escapeHtml(row.label)}</td>
            </tr>
          `;
            })()}
          `).join('')}
        </tbody>
      </table>
    `;

    previousProfileImpactSnapshot = rows.reduce((acc, row) => {
      acc[row.profile.name] = row.current.estimated;
      return acc;
    }, {});

    const lead = [...rows].sort((a, b) => b.current.estimated - a.current.estimated)[0];
    const trailing = [...rows].sort((a, b) => a.current.estimated - b.current.estimated)[0];
    const commonScore = rows[0]?.current?.score || 0;
    const commonVariance = rows[0]?.current?.varianceCap || 0;
    const modifiers = rows[0]?.current?.modifiers || [];
    const modifierText = modifiers.length ? modifiers.join(' | ') : 'no situational modifiers active';

    cpuProfileImpactSummary.textContent =
      `Formula: final aggression = clamp((base + situational modifiers) * profile aggression multiplier, 0.10, ${Number(currentTuning.maxAggressionCap || 0).toFixed(2)}). ` +
      `Current adjusted base before profile multipliers: ${commonScore.toFixed(3)}. ` +
      `Variance cap in this round context: ${commonVariance.toFixed(3)}. ` +
      `Active modifiers: ${modifierText}. ` +
      `Highest profile now: ${lead.profile.name} (${lead.current.estimated.toFixed(3)}). ` +
      `Lowest profile now: ${trailing.profile.name} (${trailing.current.estimated.toFixed(3)}).`;
  }

  function previewTiedAuction(state) {
    const profile = cpuTiedProfiles[Math.max(0, Math.min(cpuTiedProfiles.length - 1, Number(state.tiedProfileIndex || 0)))] || cpuTiedProfiles[3];
    const playerAV = Math.max(1, Number(state.playerAV || 1));
    const currentBid = Math.max(0, Number(state.currentBid || 0));
    const timeLeft = Math.max(0, Number(state.timeLeft || 0));
    const positionNeed = Math.max(0, Number(state.positionNeed || 0.5));
    const budget = Math.max(0, Number(state.budgetRemaining || 0));

    const overRatio = currentBid / Math.max(1, playerAV);
    const nearAvPressure = clamp((overRatio - cpuTuningState.tied.nearAvStart) / cpuTuningState.tied.nearAvWindow, 0, 1);
    const overAvPressure = clamp((overRatio - cpuTuningState.tied.overAvStart) / cpuTuningState.tied.overAvWindow, 0, 1);
    const timerPanic = timeLeft <= 2 ? profile.desperation * positionNeed : 0;
    const backoutBase = cpuTuningState.tied.backoutBase + nearAvPressure * 0.14 + overAvPressure * 0.48;
    const fearPenalty = nearAvPressure * cpuTuningState.tied.fearNearWeight * profile.fear + overAvPressure * cpuTuningState.tied.fearOverWeight * profile.fear;
    const disciplinePenalty = overAvPressure * cpuTuningState.tied.disciplineWeight * profile.discipline;
    const budgetPenalty = budget >= 0
      ? (budget / Math.max(1, playerAV)) >= cpuTuningState.tied.budgetHighThreshold
        ? 0
        : (budget / Math.max(1, playerAV)) >= cpuTuningState.tied.budgetMidThreshold
          ? 0.12
          : 0.25
      : 0.25;
    const bidProb = clamp(
      cpuTuningState.tied.baseBidProb * profile.aggression * (1 + timerPanic * 0.1) * (1 - Math.min(0.72, fearPenalty + disciplinePenalty + budgetPenalty)),
      0,
      0.95
    );
    const backoutProb = clamp(
      backoutBase * profile.fear + disciplinePenalty + budgetPenalty + (state.round >= 7 ? 0.08 : 0) - (timerPanic * 0.08),
      0.02,
      0.95
    );

    return { profile, overRatio, nearAvPressure, overAvPressure, bidProb, backoutProb };
  }

  function runCpuPreview() {
    if (!cpuPreviewOutput) return;
    const silent = previewSilentAuction(cpuTuningState.scenario || {});
    const tied = previewTiedAuction(cpuTuningState.scenario || {});
    const scenario = cpuTuningState.scenario || {};
    cpuPreviewOutput.textContent = JSON.stringify({
      scenario,
      silent: {
        profile: silent.profile,
        score: Number(silent.score.toFixed(3)),
        estimatedAggression: Number(silent.estimated.toFixed(3)),
        varianceCap: silent.varianceCap,
        modifiers: silent.modifiers,
        bidRange: silent.bidRange
      },
      tied: {
        profile: tied.profile,
        overRatio: Number(tied.overRatio.toFixed(3)),
        bidProb: Number(tied.bidProb.toFixed(3)),
        backoutProb: Number(tied.backoutProb.toFixed(3))
      },
      note: 'These previews use the same coefficients as the CPU code, but remain local to the admin page.'
    }, null, 2);

    renderSilentProfileImpact(cpuTuningState.scenario || {}, silent?.profile?.name || '');
  }

  async function requestJson(url, options = {}) {
    const headers = Object.assign({}, authHeaders(), options.headers || {});
    const response = await fetch(url, Object.assign({}, options, { headers }));
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || `Request failed (${response.status})`);
    }
    return payload;
  }

  async function runFastDraftSimulations() {
    if (!cpuSimulationOutput) return;

    cpuSimulationOutput.textContent = 'Running fast simulations...';
    if (cpuRunSimulationBtn) cpuRunSimulationBtn.disabled = true;
    setCpuTuningStatus('Running server simulations...', 'info');

    try {
      const payload = {
        draftCount: Number(cpuSimDraftCountInput?.value || 15),
        teamCount: Number(cpuSimTeamCountInput?.value || 10),
        rounds: Number(cpuSimRoundsInput?.value || 10),
        playersPerRound: Number(cpuSimPlayersPerRoundInput?.value || 24)
      };

      const response = await requestJson('/api/admin/simulate-drafts', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(payload)
      });

      const simulation = response.simulation || {};
      const aggregate = simulation.aggregate || {};
      const config = simulation.config || {};

      const summaryLines = [
        `Drafts simulated: ${config.draftCount ?? payload.draftCount}`,
        `Completion rate: ${Math.round(Number(aggregate.completionRate || 0) * 100)}%`,
        `Avg roster count: ${aggregate.avgRosterCount ?? '--'}`,
        `Avg budget remaining: $${aggregate.avgBudgetRemaining ?? '--'}`,
        `All-complete draft rate: ${Math.round(Number(aggregate.allCompleteDraftRate || 0) * 100)}%`,
        `Duration: ${response.durationMs ?? 0} ms`
      ];

      const drafts = Array.isArray(simulation.drafts) ? simulation.drafts : [];
      const sampleLines = drafts.slice(0, 5).map((draft) => {
        const incompleteTeams = (draft.teams || []).filter(team => !team.complete);
        const worstTeam = incompleteTeams.sort((a, b) => a.rosterCount - b.rosterCount)[0];
        const worstText = worstTeam
          ? `worst=${worstTeam.name} (${worstTeam.rosterCount} players, $${worstTeam.budgetRemaining} left)`
          : 'all teams complete';
        return `Draft ${draft.draftNumber}: ${draft.completeTeams}/${draft.teamCount} complete, ${worstText}`;
      });

      cpuSimulationOutput.textContent = `${summaryLines.join('\n')}\n\nSample Drafts:\n${sampleLines.join('\n') || 'No rows'}\n\nRaw:\n${JSON.stringify(response, null, 2)}`;
      setCpuTuningStatus('Simulation completed.', 'success');
    } catch (error) {
      const rawMessage = String(error?.message || 'Simulation failed.');
      const needsRestart = /404|Cannot POST|Failed to fetch/i.test(rawMessage);
      const finalMessage = needsRestart
        ? `${rawMessage} Restart the server (npm start) so the new simulation endpoint is loaded, then refresh.`
        : rawMessage;

      cpuSimulationOutput.textContent = `Simulation failed: ${finalMessage}`;
      setCpuTuningStatus(finalMessage, 'error');
    } finally {
      if (cpuRunSimulationBtn) cpuRunSimulationBtn.disabled = false;
    }
  }

  function getActivePlayers() {
    if (isTopView()) {
      return Array.isArray(topPlayers) ? topPlayers : [];
    }
    return Array.isArray(positionPlayers[activePosition]) ? positionPlayers[activePosition] : [];
  }

  function updatePositionTabs() {
    if (!positionTabs) return;
    positionTabs.querySelectorAll('.admin-pos-tab').forEach((button) => {
      const isActive = button.dataset.pos === activePosition;
      button.classList.toggle('active', isActive);
      button.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
    updateTopClearButtonState();
  }

  function updateRankingsMeta(meta, count) {
    if (!meta) return;
    const staleText = meta.isStaleWeek ? 'STALE: over 7 days' : 'Fresh: updated this week';
    const versionNumber = Number.parseInt(meta.version, 10);
    const versionText = Number.isFinite(versionNumber) && versionNumber > 0 ? ` | Version: v${versionNumber}` : '';
    rankingsSourceLabel.textContent = `${meta.sourceFile} (${count} players) | Last updated: ${formatLastUpdatedText(meta.lastUpdatedAt)} | ${staleText}${versionText}`;
    rankingsSourceLabel.classList.toggle('admin-stale-text', !!meta.isStaleWeek);
  }

  function rebuildTopPlayersFromPositions() {
    topPlayers = [];
    POSITIONS.forEach((position) => {
      const players = Array.isArray(positionPlayers[position]) ? positionPlayers[position] : [];
      players.forEach((player) => {
        topPlayers.push({ ...player, position });
      });
    });
    topPlayers = inferTierBreaks(topPlayers);

    const lastUpdatedValues = POSITIONS
      .map((position) => positionMeta[position] && positionMeta[position].lastUpdatedAt)
      .filter(Boolean);
    const oldestUpdatedAt = lastUpdatedValues.length ? Math.min(...lastUpdatedValues) : null;
    const stale = POSITIONS.some((position) => positionMeta[position] && positionMeta[position].isStaleWeek);
    topMeta = {
      sourceFile: 'TOP view (all position files)',
      lastUpdatedAt: oldestUpdatedAt,
      isStaleWeek: stale
    };
  }

  function getTopPoolPlayersByPosition() {
    const selectedNames = new Set((Array.isArray(topPlayers) ? topPlayers : []).map((player) => String(player.name || '').toLowerCase()));
    return POSITIONS.reduce((acc, position) => {
      const sourcePlayers = Array.isArray(positionPlayers[position]) ? positionPlayers[position] : [];
      acc[position] = sourcePlayers.filter((player) => !selectedNames.has(String(player.name || '').toLowerCase()));
      return acc;
    }, {});
  }

  function buildTopPoolSection(position, players) {
    const section = document.createElement('section');
    section.className = 'admin-top-pool-section';
    section.innerHTML = `<div class="admin-top-pool-header">${position} Pool</div>`;

    if (!players.length) {
      const empty = document.createElement('div');
      empty.className = 'admin-top-pool-empty';
      empty.textContent = `All ${position} players are already in TOP.`;
      section.appendChild(empty);
      return section;
    }

    players.forEach((player) => {
      const row = document.createElement('div');
      row.className = 'admin-top-pool-row';
      row.innerHTML = `
        <div class="admin-top-pool-copy">
          <span class="admin-rank-player-name">${escapeHtml(player.name || 'Unknown Player')}</span>
          <span class="admin-rank-player-meta">${escapeHtml(player.position || position)} | ${escapeHtml(player.team || 'FA')}</span>
        </div>
        <button type="button" class="btn btn-signup admin-top-add-btn" data-player-name="${escapeHtml(player.name || '')}" data-player-position="${position}">Add</button>
      `;
      section.appendChild(row);
    });

    return section;
  }

  function renderTopBoard() {
    const wrapper = document.createElement('div');
    wrapper.className = 'admin-top-layout';

    const poolColumn = document.createElement('div');
    poolColumn.className = 'admin-top-column admin-top-column-pool';
    poolColumn.innerHTML = '<div class="admin-top-column-title">Player Pool</div>';
    const poolPlayersByPosition = getTopPoolPlayersByPosition();
    POSITIONS.forEach((position) => {
      poolColumn.appendChild(buildTopPoolSection(position, poolPlayersByPosition[position] || []));
    });

    const rankingsColumn = document.createElement('div');
    rankingsColumn.className = 'admin-top-column admin-top-column-rankings';
    const rankingsBlock = document.createElement('div');
    rankingsBlock.className = 'admin-tier-block';
    const header = document.createElement('div');
    header.className = 'admin-tier-header';
    header.innerHTML = '<span class="admin-tier-title">TOP Rankings Board</span>';
    rankingsBlock.appendChild(header);
    rankingsBlock.appendChild(buildDropZone(0));

    const players = getActivePlayers();
    if (!players.length) {
      const empty = document.createElement('div');
      empty.className = 'admin-tier-empty';
      empty.textContent = 'No players in top250.json yet. Add players from the pool to rebuild the TOP board.';
      rankingsBlock.appendChild(empty);
    }

    players.forEach((player, index) => {
      if (index > 0 && player.tierBreakBefore) {
        rankingsBlock.appendChild(buildTierBreakRow(index));
      }
      rankingsBlock.appendChild(buildPlayerRow(player, index));
      if (index < players.length - 1) {
        rankingsBlock.appendChild(buildPlayerGap(index + 1));
      }
      rankingsBlock.appendChild(buildDropZone(index + 1));
    });

    rankingsColumn.appendChild(rankingsBlock);
    wrapper.appendChild(poolColumn);
    wrapper.appendChild(rankingsColumn);

    tierBoard.innerHTML = '';
    tierBoard.appendChild(wrapper);
  }

  function splitTopPlayersIntoPositions() {
    const nextBoards = createEmptyBoards();
    POSITIONS.forEach((position) => {
      nextBoards[position] = [];
    });

    topPlayers.forEach((player) => {
      const position = String(player.position || '').trim().toUpperCase();
      if (!POSITIONS.includes(position)) return;
      nextBoards[position].push({ ...player, position });
    });

    POSITIONS.forEach((position) => {
      positionPlayers[position] = withPersistedTierLabels(nextBoards[position].map((player, index) => ({
        ...player,
        id: index + 1,
        rank: index + 1,
        position
      })), position);
    });
  }

  function buildPlayerGap(insertIdx) {
    const gap = document.createElement('div');
    gap.className = easyTierInsertMode ? 'admin-player-gap' : 'admin-player-gap hidden';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'admin-add-tier-break';
    button.textContent = '+ Add Tier Break';
    button.setAttribute('aria-label', 'Add tier break between these players');
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      const players = getActivePlayers();
      if (insertIdx <= 0 || insertIdx >= players.length) return;
      pushUndoSnapshot();
      players[insertIdx].tierBreakBefore = true;
      if (isTopView()) {
        topPlayers = withPersistedTierLabels(players, 'TOP');
        splitTopPlayersIntoPositions();
      } else {
        positionPlayers[activePosition] = withPersistedTierLabels(players, activePosition);
      }
      setLayoutDirty(true);
      renderActiveBoard();
    });

    gap.appendChild(button);
    return gap;
  }

  function buildTierBreakRow(index) {
    const player = getActivePlayers()[index];
    const row = document.createElement('div');
    row.className = 'admin-tier-break-row';
    row.innerHTML = `
      <span class="admin-tier-break-label">${escapeHtml(String((player && player.tier) || `Tier ${index + 1}`))}</span>
      <button type="button" class="admin-tier-break-remove" data-break-index="${index}">Remove Tier Break</button>
    `;
    return row;
  }

  function buildDropZone(insertIdx) {
    const zone = document.createElement('div');
    zone.className = 'admin-tier-drop-zone';
    zone.dataset.insertIdx = String(insertIdx);
    zone.addEventListener('dragover', (e) => {
      if (dragSourceIndex < 0) return;
      e.preventDefault();
      zone.classList.add('drag-active');
    });
    zone.addEventListener('dragleave', () => {
      zone.classList.remove('drag-active');
    });
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('drag-active');
      const players = getActivePlayers();
      if (dragSourceIndex < 0 || dragSourceIndex >= players.length) return;
      pushUndoSnapshot();
      const moved = players.splice(dragSourceIndex, 1)[0];
      let targetIndex = insertIdx;
      if (dragSourceIndex < insertIdx) targetIndex -= 1;
      const finalIndex = Math.max(0, Math.min(targetIndex, players.length));
      players.splice(finalIndex, 0, moved);
      autoAdjustMovedPlayerMetrics(players, finalIndex);
      dragSourceIndex = -1;
      setLayoutDirty(true);
      renderActiveBoard();
    });
    return zone;
  }

  function buildPlayerRow(player, index) {
    const row = document.createElement('div');
    row.className = 'admin-ranking-player-row';
    row.draggable = true;
    row.dataset.index = String(index);
    const rowPosition = player.position || activePosition;
    row.classList.add(`admin-pos-row-${String(rowPosition || '').trim().toUpperCase()}`);
    const ajSlotCode = !isTopView() ? getAjSlotCode(rowPosition, index + 1) : '';
    if (isTopView()) {
      row.innerHTML = `
        <span class="admin-drag-handle" aria-hidden="true">⠿</span>
        <span class="admin-rank-number">#${index + 1}</span>
        <span class="admin-rank-position admin-pos-badge admin-pos-${escapeHtml(String(rowPosition || '').trim().toUpperCase())}">${escapeHtml(rowPosition)}</span>
        <span class="admin-rank-player-name">${escapeHtml(player.name || 'Unknown Player')}</span>
        <label class="admin-av-edit admin-team-edit admin-row-inline-edit">
          <span class="admin-inline-label">Team</span>
          <input type="text" class="admin-team-input" maxlength="5" value="${escapeHtml(player.team || '')}" placeholder="FA">
        </label>
        <button type="button" class="btn btn-login admin-row-remove" data-index="${index}">Remove</button>
      `;
    } else {
      row.innerHTML = `
        <span class="admin-drag-handle" aria-hidden="true">⠿</span>
        <span class="admin-rank-number">#${index + 1}</span>
        <span class="admin-rank-position admin-pos-badge admin-pos-${escapeHtml(String(rowPosition || '').trim().toUpperCase())}">${escapeHtml(rowPosition)}</span>
        <span class="admin-rank-player-name">${escapeHtml(player.name || 'Unknown Player')}</span>
        <label class="admin-av-edit admin-team-edit admin-row-inline-edit">
          <span class="admin-inline-label">Team</span>
          <input type="text" class="admin-team-input" maxlength="5" value="${escapeHtml(player.team || '')}" placeholder="FA">
        </label>
        <label class="admin-av-edit admin-row-inline-edit">
          <span class="admin-inline-label">AV</span>
          <input type="number" class="admin-av-input" min="0" step="1" value="${Number(player.avgValue || 0)}">
        </label>
        <label class="admin-av-edit admin-row-inline-edit">
          <span class="admin-inline-label">Draft%</span>
          <input type="number" class="admin-draftchance-input" min="0" max="100" step="1" value="${getPlayerDraftChance(player, 0)}">
        </label>
        <span class="admin-aj-slot-badge" title="AJ slot">${ajSlotCode}</span>
        <button type="button" class="btn btn-login admin-row-remove" data-index="${index}">Remove</button>
      `;
    }

    row.addEventListener('dragstart', (e) => {
      dragSourceIndex = index;
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', player.name || String(index));
      }
      row.classList.add('dragging');
    });

    row.addEventListener('dragend', () => {
      dragSourceIndex = -1;
      document.querySelectorAll('.admin-tier-drop-zone.drag-active, .admin-ranking-player-row.dragging').forEach((el) => {
        el.classList.remove('drag-active', 'dragging');
      });
    });

    const teamInput = row.querySelector('.admin-team-input');
    if (teamInput) {
      teamInput.addEventListener('focus', () => {
        teamInput.dataset.undoStartValue = String(player.team || '');
        teamInput.dataset.undoCaptured = '0';
      });
      teamInput.addEventListener('input', () => {
        const players = getActivePlayers();
        const previousValue = String(teamInput.dataset.undoStartValue || player.team || '');
        const nextValue = String(teamInput.value || '').trim().toUpperCase().slice(0, 5);
        if (teamInput.dataset.undoCaptured !== '1' && nextValue !== previousValue) {
          pushUndoSnapshot();
          teamInput.dataset.undoCaptured = '1';
        }
        teamInput.value = nextValue;
        players[index].team = nextValue;
        setLayoutDirty(true);
      });
      teamInput.addEventListener('blur', () => {
        delete teamInput.dataset.undoStartValue;
        delete teamInput.dataset.undoCaptured;
      });
    }

    const avInput = row.querySelector('.admin-av-input');
    if (avInput) {
      avInput.addEventListener('focus', () => {
        avInput.dataset.undoStartValue = String(player.avgValue || 0);
        avInput.dataset.undoCaptured = '0';
      });
      avInput.addEventListener('input', () => {
        const players = getActivePlayers();
        const previousValue = Number(avInput.dataset.undoStartValue || player.avgValue || 0);
        const nextValue = Number(avInput.value || 0);
        if (avInput.dataset.undoCaptured !== '1' && nextValue !== previousValue) {
          pushUndoSnapshot();
          avInput.dataset.undoCaptured = '1';
        }
        players[index].avgValue = Number(avInput.value || 0);
        setLayoutDirty(true);
      });
      avInput.addEventListener('blur', () => {
        delete avInput.dataset.undoStartValue;
        delete avInput.dataset.undoCaptured;
      });
    }

    const draftChanceInput = row.querySelector('.admin-draftchance-input');
    if (draftChanceInput) {
      draftChanceInput.addEventListener('focus', () => {
        draftChanceInput.dataset.undoStartValue = String(getPlayerDraftChance(player, 0));
        draftChanceInput.dataset.undoCaptured = '0';
      });
      draftChanceInput.addEventListener('input', () => {
        const players = getActivePlayers();
        const previousValue = Number(draftChanceInput.dataset.undoStartValue || getPlayerDraftChance(player, 0));
        const nextValue = Number(draftChanceInput.value || 0);
        if (draftChanceInput.dataset.undoCaptured !== '1' && nextValue !== previousValue) {
          pushUndoSnapshot();
          draftChanceInput.dataset.undoCaptured = '1';
        }
        setPlayerDraftChance(players[index], nextValue);
        setLayoutDirty(true);
      });
      draftChanceInput.addEventListener('blur', () => {
        delete draftChanceInput.dataset.undoStartValue;
        delete draftChanceInput.dataset.undoCaptured;
      });
    }

    return row;
  }

  function renderActiveBoard() {
    if (!tierBoard) return;
    updatePositionTabs();
    updateClearTierBreaksButtonState();
    if (isTopView()) {
      renderTopBoard();
      return;
    }
    const players = getActivePlayers();
    const fragment = document.createDocumentFragment();

    const block = document.createElement('div');
    block.className = 'admin-tier-block';
    const header = document.createElement('div');
    header.className = 'admin-tier-header';
    header.innerHTML = `<span class="admin-tier-title">${activePosition === 'TOP' ? 'TOP Default Rankings Board' : `${activePosition} Rankings File`}</span>`;
    block.appendChild(header);
    block.appendChild(buildDropZone(0));

    if (!players.length) {
      const empty = document.createElement('div');
      empty.className = 'admin-tier-empty';
      empty.textContent = activePosition === 'TOP'
        ? 'No players available in the TOP default rankings board.'
        : `No ${activePosition} players in this file.`;
      block.appendChild(empty);
    }

    players.forEach((player, index) => {
      if (index > 0 && player.tierBreakBefore) {
        block.appendChild(buildTierBreakRow(index));
      }
      block.appendChild(buildPlayerRow(player, index));
      if (index < players.length - 1) {
        block.appendChild(buildPlayerGap(index + 1));
      }
      block.appendChild(buildDropZone(index + 1));
    });

    fragment.appendChild(block);
    tierBoard.innerHTML = '';
    tierBoard.appendChild(fragment);
  }

  async function loadOverview() {
    overviewOutput.textContent = 'Loading overview...';
    updateDatabaseProgressCard();
    try {
      const [traffic, system, delivery] = await Promise.all([
        requestJson('/api/admin/traffic', { headers: { 'x-admin-key': getAdminKey() } }),
        requestJson('/api/admin/system-status', { headers: { 'x-admin-key': getAdminKey() } }),
        requestJson('/api/admin/delivery/status', { headers: { 'x-admin-key': getAdminKey() } })
      ]);
      overviewOutput.textContent = JSON.stringify({ system, traffic, delivery }, null, 2);
      updateOverviewCards(traffic, system);
      renderOverviewCharts(traffic);
      updateDatabaseProgressCard();
      setConnectApproved(true);
      setConnectStatus('');
    } catch (error) {
      overviewOutput.textContent = '';
      updateDatabaseProgressCard();
      setConnectApproved(false);
      setConnectStatus(error.message);
    }
  }

  async function loadPositionRankings(position = activePosition) {
    setActionStatus(`Loading ${position} rankings...`);
    try {
      let adminKey = getAdminKey();
      if (isTopView(position)) {
        await Promise.all(POSITIONS.map(async (pos) => {
          const payload = await requestJson(`/api/admin/rankings/position/${pos}`, {
            headers: adminKey ? { 'x-admin-key': adminKey } : {}
          });
          positionPlayers[pos] = Array.isArray(payload.players)
            ? inferTierBreaks(payload.players.map((player) => normalizeDraftChanceField({ ...player })))
            : [];
          positionMeta[pos] = payload;
        }));

        const defaultPayload = await requestJson('/api/admin/rankings/default', {
          headers: adminKey ? { 'x-admin-key': adminKey } : {}
        });
        topPlayers = Array.isArray(defaultPayload.players)
          ? inferTierBreaks(defaultPayload.players.map((player) => normalizeDraftChanceField({ ...player })))
          : [];
        topMeta = defaultPayload;
        topRankingsVersion = Number.parseInt(defaultPayload && defaultPayload.version, 10);
        if (!Number.isFinite(topRankingsVersion)) {
          topRankingsVersion = null;
        }
        activePosition = 'TOP';
        updateRankingsHash(activePosition);
        updateRankingsMeta(topMeta, topPlayers.length);
        clearUndoHistory();
        setLayoutDirty(false);
        renderActiveBoard();
        setActionStatus('');
        return;
      }

      const payload = await requestJson(`/api/admin/rankings/position/${position}`, {
        headers: adminKey ? { 'x-admin-key': adminKey } : {}
      });
      positionPlayers[position] = Array.isArray(payload.players)
        ? inferTierBreaks(payload.players.map((player) => normalizeDraftChanceField({ ...player })))
        : [];
      positionMeta[position] = payload;
      if (!isTopView(position)) {
        topRankingsVersion = null;
      }
      activePosition = position;
      updateRankingsHash(activePosition);
      updateRankingsMeta(payload, positionPlayers[position].length);
      clearUndoHistory();
      setLayoutDirty(false);
      renderActiveBoard();
      setActionStatus('');
    } catch (error) {
      setActionStatus(error.message);
    }
  }

  if (connectForm) {
    connectForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      setConnectApproved(false);
      setConnectStatus('');
      try {
        await validateAdminKey();
        promoteTypedAdminKeyToSession();
      } catch (_e) {
        setConnectStatus(_e && _e.message ? _e.message : 'Invalid admin key.');
        return;
      }
      if (isPortalPage) {
        await loadOverview();
        await loadPositionRankings(activePosition);
      } else if (isRankingsManagerPage) {
        setActionStatus('');
        await loadPositionRankings(activePosition);
      }
      setConnectApproved(true);
    });
  }

  if (refreshOverviewBtn) {
    refreshOverviewBtn.addEventListener('click', async () => {
      await loadOverview();
    });
  }

  if (toggleRawOverviewBtn) {
    toggleRawOverviewBtn.addEventListener('click', () => {
      setOverviewMode(!showingRawOverview);
    });
  }

  // Only initialize rankings manager code if on the rankings manager page
  if (isRankingsManagerPage) {
    loadRankingsBtn.addEventListener('click', async () => {
      await loadPositionRankings(activePosition);
    });

    addPlayerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = String(document.getElementById('addName').value || '').trim();
    const team = String(document.getElementById('addTeam').value || '').trim();
    const position = String(document.getElementById('addPosition').value || activePosition).trim().toUpperCase();
    const avgValue = Number(document.getElementById('addAvgValue').value || 0);
    const draftChance = 0;

    setActionStatus(`Adding ${position} player...`);
    try {
      if (isTopView(activePosition)) {
        pushUndoSnapshot();
        const newPlayer = {
          id: topPlayers.length + 1,
          rank: topPlayers.length + 1,
          name,
          position,
          team,
          avgValue,
          draftChance
        };
        topPlayers.push(newPlayer);
        splitTopPlayersIntoPositions();
        addPlayerForm.reset();
        setLayoutDirty(true);
        renderActiveBoard();
        setActionStatus(`${position} player added to TOP board.`);
        return;
      }

      await requestJson(`/api/admin/rankings/position/${position}/add`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ name, team, avgValue, draftChance, position })
      });
      addPlayerForm.reset();
      await loadPositionRankings(position);
    } catch (error) {
      setActionStatus(error.message);
    }
  });

  removePlayerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const rankRaw = document.getElementById('removeId').value;
    const rank = rankRaw ? Number(rankRaw) : 0;
    const name = String(document.getElementById('removeName').value || '').trim();

    setActionStatus(`Removing ${activePosition} player...`);
    try {
      if (isTopView()) {
        pushUndoSnapshot();
        if (rank > 0 && rank <= topPlayers.length) {
          topPlayers.splice(rank - 1, 1);
        } else if (name) {
          const index = topPlayers.findIndex((player) => String(player.name || '').toLowerCase() === name.toLowerCase());
          if (index >= 0) topPlayers.splice(index, 1);
        }
        splitTopPlayersIntoPositions();
        removePlayerForm.reset();
        setLayoutDirty(true);
        renderActiveBoard();
        setActionStatus('Player removed from TOP board.');
        return;
      }

      await requestJson(`/api/admin/rankings/position/${activePosition}/remove`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ rank, name, position: activePosition })
      });
      removePlayerForm.reset();
      await loadPositionRankings(activePosition);
    } catch (error) {
      setActionStatus(error.message);
    }
  });

    if (positionTabs) {
      positionTabs.addEventListener('click', async (e) => {
        const target = e.target;
        if (!(target instanceof HTMLElement) || !target.classList.contains('admin-pos-tab')) return;
        const position = String(target.dataset.pos || '').trim().toUpperCase();
        if (!BOARD_POSITIONS.includes(position)) return;
        await loadPositionRankings(position);
      });
    }

    if (tierBoard) {
      tierBoard.addEventListener('click', async (e) => {
        const target = e.target;
        if (!(target instanceof HTMLElement)) return;
        if (target.classList.contains('admin-top-add-btn')) {
          const playerName = String(target.dataset.playerName || '').trim().toLowerCase();
          const playerPosition = String(target.dataset.playerPosition || '').trim().toUpperCase();
          const poolPlayer = (positionPlayers[playerPosition] || []).find((player) => String(player.name || '').toLowerCase() === playerName);
          if (poolPlayer) {
            pushUndoSnapshot();
            topPlayers.push({ ...poolPlayer, position: playerPosition, tierBreakBefore: false });
            topPlayers = withPersistedTierLabels(topPlayers, 'TOP');
            setLayoutDirty(true);
            renderActiveBoard();
            setActionStatus(`${poolPlayer.name} added to TOP board.`);
          }
          return;
        }
        if (target.classList.contains('admin-tier-break-remove')) {
          const breakIndex = Number(target.dataset.breakIndex || -1);
          const players = getActivePlayers();
          if (breakIndex > 0 && breakIndex < players.length) {
            pushUndoSnapshot();
            players[breakIndex].tierBreakBefore = false;
            if (isTopView()) {
              topPlayers = withPersistedTierLabels(players, 'TOP');
              splitTopPlayersIntoPositions();
            } else {
              positionPlayers[activePosition] = withPersistedTierLabels(players, activePosition);
            }
            setLayoutDirty(true);
            renderActiveBoard();
          }
          return;
        }
        if (!target.classList.contains('admin-row-remove')) return;
        const index = Number(target.dataset.index || -1);
        const players = getActivePlayers();
        if (index < 0 || index >= players.length) return;
        pushUndoSnapshot();
        if (players[index].tierBreakBefore && players[index + 1]) {
          players[index + 1].tierBreakBefore = true;
        }
        players.splice(index, 1);
        if (isTopView()) {
          topPlayers = withPersistedTierLabels(players, 'TOP');
          splitTopPlayersIntoPositions();
        } else {
          positionPlayers[activePosition] = withPersistedTierLabels(players, activePosition);
        }
        setLayoutDirty(true);
        renderActiveBoard();
      });
    }

    async function saveActiveRankingsFile() {
        if (isRankingsSaveInFlight) return;
        isRankingsSaveInFlight = true;
        if (saveJsonFileBtn) saveJsonFileBtn.disabled = true;
        if (saveRankingsLayoutBtn) saveRankingsLayoutBtn.disabled = true;
      setActionStatus(`Saving ${activePosition} file...`);
      try {
        if (isTopView()) {
          const topPayload = await requestJson('/api/admin/rankings/default/save', {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({
                baseVersion: topRankingsVersion,
              players: withPersistedTierLabels(topPlayers, 'TOP').map((player, index) => ({
                ...player,
                id: index + 1,
                prerank: index + 1,
                avgValue: Number(player.avgValue || 0),
                draftChance: Number(player.draftChance || 0)
              }))
            })
          });

            topRankingsVersion = Number.parseInt(topPayload && topPayload.version, 10);
            if (!Number.isFinite(topRankingsVersion)) {
              topRankingsVersion = null;
            }

          setLayoutDirty(false);
          clearUndoHistory();
            setActionStatus(`TOP rankings saved to top250.json (v${topPayload.version || '?'}, saveId ${topPayload.saveId || 'n/a'}).`);
          await loadPositionRankings('TOP');
          showJsonSaveCompletedAlert(`Update completed. ${topPayload.sourceFile || 'top250.json'} finished updating on the server.`);
          return;
        }

        const players = withPersistedTierLabels(getActivePlayers(), activePosition).map((player, index) => ({
          ...player,
          id: index + 1,
          rank: index + 1,
          position: activePosition,
          avgValue: Number(player.avgValue || 0),
          draftChance: Number(player.draftChance || 0)
        }));
        const payload = await requestJson(`/api/admin/rankings/position/${activePosition}/save`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ players })
        });
        setLayoutDirty(false);
        clearUndoHistory();
        setActionStatus(`${activePosition} file saved.`);
        await loadPositionRankings(activePosition);
        rankingsSourceLabel.textContent = `${payload.sourceFile} (${payload.count} players)`;
        if (positionMeta[activePosition]) {
          updateRankingsMeta(positionMeta[activePosition], positionMeta[activePosition].count || players.length);
        }
        showJsonSaveCompletedAlert(`Update completed. ${payload.sourceFile || `${activePosition.toLowerCase()}.json`} finished updating on the server.`);
      } catch (error) {
        setActionStatus(error.message);
      } finally {
        isRankingsSaveInFlight = false;
        setLayoutDirty(isLayoutDirty);
      }
    }

    if (saveRankingsLayoutBtn) {
      saveRankingsLayoutBtn.addEventListener('click', saveActiveRankingsFile);
    }

    if (tierInsertModeBtn) {
      tierInsertModeBtn.addEventListener('click', toggleTierInsertMode);
    }

    if (saveJsonFileBtn) {
      saveJsonFileBtn.addEventListener('click', saveActiveRankingsFile);
    }

    if (syncTopPositionOrderBtn) {
      syncTopPositionOrderBtn.addEventListener('click', async () => {
        const selectedPosition = String(syncTopPositionSelect?.value || 'RB').trim().toUpperCase();
        if (selectedPosition !== 'ALL' && !POSITIONS.includes(selectedPosition)) {
          setActionStatus('Select a valid position source before syncing TOP order.');
          return;
        }

        syncTopPositionOrderBtn.disabled = true;
        if (selectedPosition === 'ALL') {
          setActionStatus('Syncing TOP slots for all positions from position files...');
        } else {
          setActionStatus(`Syncing TOP ${selectedPosition} slots from ${selectedPosition.toLowerCase()}.json...`);
        }
        try {
          const payload = await requestJson('/api/admin/rankings/default/sync-position-order', {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ position: selectedPosition })
          });

          if (isTopView()) {
            await loadPositionRankings('TOP');
          }

          setActionStatus(payload.message || `TOP ${selectedPosition} slots synced successfully.`);
        } catch (error) {
          const rawMessage = String(error?.message || 'Unable to sync TOP position order from selected source.');
          const needsRestart = /404|Cannot POST|Failed to fetch/i.test(rawMessage);
          const finalMessage = needsRestart
            ? `${rawMessage} Restart the server (npm start) so the sync endpoint is loaded, then refresh.`
            : rawMessage;
          setActionStatus(finalMessage);
        } finally {
          syncTopPositionOrderBtn.disabled = false;
        }
      });
    }

    if (clearTopBoardBtn) {
      clearTopBoardBtn.addEventListener('click', () => {
        if (!isTopView() || !Array.isArray(topPlayers) || topPlayers.length === 0) return;
        pushUndoSnapshot();
        topPlayers = [];
        splitTopPlayersIntoPositions();
        setLayoutDirty(true);
        renderActiveBoard();
        setActionStatus('Cleared all players from the TOP board. Position files were not changed.');
      });
    }

    if (clearTierBreaksBtn) {
      clearTierBreaksBtn.addEventListener('click', () => {
        const players = getActivePlayers();
        if (!hasAnyTierBreaks(players)) return;

        pushUndoSnapshot();
        players.forEach((player, index) => {
          if (index > 0) {
            player.tierBreakBefore = false;
          }
        });

        if (isTopView()) {
          topPlayers = withPersistedTierLabels(players, 'TOP');
          splitTopPlayersIntoPositions();
          setActionStatus('Removed all tier breaks from the TOP board.');
        } else {
          positionPlayers[activePosition] = withPersistedTierLabels(players, activePosition);
          setActionStatus(`Removed all tier breaks from ${activePosition} rankings.`);
        }

        setLayoutDirty(true);
        renderActiveBoard();
      });
    }

    if (undoRankingsEditBtn) {
      undoRankingsEditBtn.addEventListener('click', () => {
        const snapshot = undoStack.pop();
        if (!snapshot) return;
        restoreUndoSnapshot(snapshot);
        setActionStatus(`Undid last ${activePosition} rankings edit.`);
      });
    }

    if (dismissJsonSaveBannerBtn) {
      dismissJsonSaveBannerBtn.addEventListener('click', () => {
        hideJsonSaveCompletedAlert();
      });
    }

    if (resetUnsavedBtn) {
      resetUnsavedBtn.addEventListener('click', async () => {
        await loadPositionRankings(activePosition);
      });
    }

    clearUndoHistory();
    loadTierInsertModePreference();
    setLayoutDirty(false);
    applyTierInsertMode();
    updatePositionTabs();

    restoreAdminKey();
    const managerAdminKey = getAdminKey();
    if (!managerAdminKey) {
      setConnectStatus('Enter the admin key.');
      setActionStatus('Admin key not found. Enter it to unlock Admin Rankings Manager.');
    } else {
      setConnectStatus('Checking admin access...');
      setActionStatus('Checking admin access...');
      void validateAdminKey().then(() => {
        setConnectApproved(true);
        setConnectStatus('');
        setActionStatus('');
        void loadPositionRankings(activePosition);
      }).catch((error) => {
        setConnectApproved(false);
        setConnectStatus(error && error.message ? error.message : 'Invalid admin key.');
        setActionStatus(error && error.message ? error.message : 'Invalid admin key.');
      });
    }
  } // End of isRankingsManagerPage

  // Portal page initialization
  if (isPortalPage) {
    restoreAdminKey();
    setOverviewMode(false);
    setConnectApproved(false);
    updateDatabaseProgressCard();

    if (!getAdminKey()) {
      setConnectStatus('Enter the admin key.');
      return;
    }

    setConnectStatus('Checking admin access...');

    void validateAdminKey().then(() => {
      setConnectApproved(true);
      promoteTypedAdminKeyToSession();
      setConnectStatus('');
      refreshCpuModelSelect('');
      renderCpuTuningLab();
      updateCpuLogicSourceMeta();
      void loadCpuLogicFromServer({ silent: true });
    }).catch((error) => {
      setConnectApproved(false);
      setConnectStatus(error && error.message ? error.message : 'Invalid admin key.');
    });

    window.addEventListener('resize', () => {
      try {
        const parsed = JSON.parse(String(overviewOutput.textContent || '{}'));
        if (parsed && parsed.traffic) {
          renderOverviewCharts(parsed.traffic);
        }
      } catch (_error) {
        // ignore
      }
    });
  }

  // Dedicated CPU Tuning Lab page: same connect flow as the portal, scoped to just this page's elements.
  if (isCpuTuningPage) {
    restoreAdminKey();

    if (!getAdminKey()) {
      setConnectStatus('Enter the admin key.');
      if (cpuTuningDebugOutput) cpuTuningDebugOutput.textContent = 'Not connected yet - enter the admin key above and click Connect.';
      return;
    }

    setConnectStatus('Checking admin access...');
    if (cpuTuningDebugOutput) cpuTuningDebugOutput.textContent = 'Checking admin access...';

    void validateAdminKey().then(() => {
      setConnectApproved(true);
      promoteTypedAdminKeyToSession();
      setConnectStatus('');
      refreshCpuModelSelect('');
      renderCpuTuningLab();
      updateCpuLogicSourceMeta();
      void loadCpuLogicFromServer({ silent: true });
    }).catch((error) => {
      setConnectApproved(false);
      const message = error && error.message ? error.message : 'Invalid admin key.';
      setConnectStatus(message);
      if (cpuTuningDebugOutput) cpuTuningDebugOutput.textContent = `Admin key validation failed: ${message}`;
    });
  }
});