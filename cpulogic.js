module.exports = {
  "presetName": "TEST2",
  "updatedAt": 1783473716105,
  "silent": {
    "baseAggression": 0.4,
    "budgetRichBonus": 0.2,
    "budgetPoorPenalty": -0.2,
    "rosterTightBonus": 0.15,
    "rosterLoosePenalty": -0.1,
    "missingStarterBonus": 0.18,
    "finalFillBonus": 0.22,
    "earlyRoundPenalty": -0.08,
    "richEarlyBonusMax": 0.32,
    "midRoundVarianceMax": 0.2,
    "lateRoundVarianceMax": 0.4,
    "personalityVarianceStep": 0.1,
    "roundVarianceMax": 0.15,
    "maxAggressionCap": 0.95,
    "budgetRichBoost": 0.05,
    "budgetPoorReduction": 0.25,
    "rosterTightBoost": 0.3,
    "rosterLooseReduction": 0.18,
    "emergencyStarterBoost": 0.18,
    "finalRoundFillBoost": 0.34,
    "earlyRoundReduction": 0.02,
    "richEarlyBoost": 0.23,
    "lateRoundAggressionBoost": 0.8,
    "avCenteringStrength": 0.3,
    "avSoftCapLowAvPct": 1.35,
    "avSoftCapMidAvPct": 1.22,
    "avSoftCapHighAvPct": 1.14,
    "avSoftCapBaseBuffer": 2,
    "avSoftCapLateRoundExtraBuffer": 2,
    "avConvergenceWindow": 5,
    "avConvergenceEliteWindow": 5,
    "marketSensitivity": 0.7,
    "paceCatchBidIntensity": 0.6,
    "spreadModeIntensity": 0.45,
    "starTargetAggressionBoost": 0.5,
    "starTargetLowballReduction": 0.3,
    "lowballIntensity": 0.65,
    "cheapFillerBidFrequency": 0.2,
    "spreadBidVolumeMultiplier": 0.68,
    "spreadDollarBidMultiplier": 0.55,
    "spreadDraftChanceFloor": 0.55,
    "spreadFillerBidMax": 1,
    "globalBidVolumeMultiplier": 0.9,
    "earlyRoundMaxBidsCap": 6,
    "coverageAddCap": 6,
    "coverageDraftChanceFloor": 0.65,
    "earlyRoundVolumeBidsEnabled": false,
    "earlyRoundRefillEnabled": false,
    "earlyRoundCoverageEnabled": false,
    "earlyRoundAvFloorMultiplier": 0.78,
    "earlyRoundAvCeilingMultiplier": 1.1,
    "earlyRoundBidCoverageCapEnabled": false,
    "earlyRoundBidCoverageCapMaxRound": 7,
    "earlyRoundMaxPlayersWithBids": 13,
    "midRoundMaxPlayersWithBids": 17,
    "draftChancePrimaryEnabled": true,
    "draftChancePrimaryBaseFloor": 0.76,
    "draftChancePrimaryMinFloor": 0.55,
    "draftChanceNeedDropPerNeedRatio": 0.08,
    "draftChancePressureDropScale": 0.002,
    "earlyTopRankFocusEnabled": true,
    "earlyTopRankFocusMaxRound": 3,
    "earlyTopRankFocusMaxRank": 150,
    "lateRoundPaceThresholdHitEnabled": true,
    "lateRoundPaceThresholdStartRound": 7,
    "lateRoundPaceThresholdPerRoundHit": 0.02,
    "lateRoundPaceThresholdMaxHit": 0.08,
    "lateRoundAggressionDampener": 0.72,
    "globalInterestThresholdScale": 1.15,
    "globalInterestThresholdCap": 0.9,
    "earlyInterestHoldEnabled": true,
    "earlyInterestHoldUntilRound": 7,
    "earlyInterestHoldMaxPressure": 9.5,
    "earlyInterestHoldPaceTolerance": 0.08,
    "affordabilityTradeDownEnabled": true,
    "affordabilityOverAvBudgetCap": 0.4,
    "volumeBidsStartRound": 8,
    "midRoundLikelyDraftedOnlyEnabled": true,
    "midRoundLikelyDraftedMinAV": 14,
    "midRoundLikelyDraftedDraftChanceFloor": 0.65,
    "midRoundLowAvHardCap": 4,
    "avMarketDepthEnabled": true,
    "avMarketDepthMaxRound": 5,
    "avMarketDepthMinAv": 20,
    "avMarketDepthMinBidMultiplier": 0.85,
    "avMarketDepthMinCompetitiveBids": 3,
    "avMarketDepthMaxPlayersPerRound": 6,
    "avMarketDepthBidLowMultiplier": 0.86,
    "avMarketDepthBidHighMultiplier": 1.02,
    "legacyAvDrivenMode": false,
    "legacyAvDrivenMaxRound": 2,
    "starAvailabilityOverride": 0.8,
    "commitmentMode": "C"
  },
  "tied": {
    "baseBidProb": 0.34,
    "preAvShape": 0.8,
    "postAvDrop": 1.8,
    "nearAvStart": 0.94,
    "overAvStart": 1,
    "nearAvWindow": 0.12,
    "overAvWindow": 0.12,
    "fearNearWeight": 0.18,
    "fearOverWeight": 0.28,
    "disciplineWeight": 0.22,
    "budgetHighThreshold": 0.45,
    "budgetMidThreshold": 0.3,
    "budgetPenaltyHigh": 0.55,
    "budgetPenaltyMid": 0.72,
    "backoutBase": 0.08,
    "backoutAggressionScale": 0.35,
    "clockBoost": 1.04
  },
  "silentProfiles": [
    {
      "name": "Balanced",
      "aggression": 1.15,
      "valueHunter": 0.92,
      "sleeperHunter": 0.95,
      "starsAndScrubs": 1.18,
      "QB": 0.95,
      "RB": 1.15,
      "WR": 1,
      "TE": 0.95,
      "K": 0.85,
      "DEF": 0.9
    },
    {
      "name": "Value",
      "aggression": 0.94,
      "valueHunter": 1.15,
      "sleeperHunter": 1.12,
      "starsAndScrubs": 0.9,
      "QB": 1,
      "RB": 0.95,
      "WR": 1.08,
      "TE": 1,
      "K": 0.95,
      "DEF": 0.95
    },
    {
      "name": "Sleeper",
      "aggression": 1.02,
      "valueHunter": 1,
      "sleeperHunter": 1.25,
      "starsAndScrubs": 0.96,
      "QB": 0.92,
      "RB": 1,
      "WR": 1.15,
      "TE": 1.08,
      "K": 0.95,
      "DEF": 0.9
    },
    {
      "name": "Stars & Scrubs",
      "aggression": 1.08,
      "valueHunter": 0.98,
      "sleeperHunter": 1,
      "starsAndScrubs": 1.08,
      "QB": 1.08,
      "RB": 0.94,
      "WR": 1,
      "TE": 1.12,
      "K": 0.9,
      "DEF": 1
    },
    {
      "name": "Conservative",
      "aggression": 0.9,
      "valueHunter": 1.18,
      "sleeperHunter": 1.08,
      "starsAndScrubs": 0.88,
      "QB": 1,
      "RB": 1.05,
      "WR": 0.96,
      "TE": 1,
      "K": 1,
      "DEF": 1.05
    }
  ],
  "tiedProfiles": [
    {
      "name": "Calm",
      "aggression": 0.84,
      "patience": 1.2,
      "fear": 1.25,
      "ego": 0.88,
      "discipline": 1.25,
      "desperation": 0.92
    },
    {
      "name": "Bulldog",
      "aggression": 1.22,
      "patience": 0.82,
      "fear": 0.82,
      "ego": 1.24,
      "discipline": 0.82,
      "desperation": 1.15
    },
    {
      "name": "Patient",
      "aggression": 0.96,
      "patience": 1.28,
      "fear": 0.96,
      "ego": 0.92,
      "discipline": 1.35,
      "desperation": 0.9
    },
    {
      "name": "Balanced",
      "aggression": 1.08,
      "patience": 1,
      "fear": 1.05,
      "ego": 1.1,
      "discipline": 0.96,
      "desperation": 1
    },
    {
      "name": "Anxious",
      "aggression": 0.92,
      "patience": 0.95,
      "fear": 1.12,
      "ego": 1.04,
      "discipline": 1.12,
      "desperation": 1.2
    }
  ],
  "silentBidRanges": {
    "QB": {
      "1-5": {
        "min": 0.65,
        "max": 1.65
      },
      "5-10": {
        "min": 0.7,
        "max": 1.45
      },
      "10-20": {
        "min": 0.75,
        "max": 1.45
      },
      "20-30": {
        "min": 0.8,
        "max": 1.35
      },
      "30-40": {
        "min": 0.85,
        "max": 1.25
      }
    },
    "RB": {
      "1-5": {
        "min": 0.65,
        "max": 1.65
      },
      "5-10": {
        "min": 0.7,
        "max": 1.65
      },
      "10-20": {
        "min": 0.75,
        "max": 1.55
      },
      "20-30": {
        "min": 0.75,
        "max": 1.45
      },
      "30-40": {
        "min": 0.75,
        "max": 1.35
      },
      "40-50": {
        "min": 0.75,
        "max": 1.25
      },
      "50-60": {
        "min": 0.75,
        "max": 1.15
      },
      "60+": {
        "min": 0.75,
        "max": 1.1
      }
    },
    "WR": {
      "1-5": {
        "min": 0.65,
        "max": 1.65
      },
      "5-10": {
        "min": 0.7,
        "max": 1.65
      },
      "10-20": {
        "min": 0.75,
        "max": 1.55
      },
      "20-30": {
        "min": 0.75,
        "max": 1.45
      },
      "30-40": {
        "min": 0.75,
        "max": 1.35
      },
      "40-50": {
        "min": 0.75,
        "max": 1.25
      },
      "50-60": {
        "min": 0.75,
        "max": 1.15
      },
      "60+": {
        "min": 0.75,
        "max": 1.1
      }
    },
    "TE": {
      "1-5": {
        "min": 0.65,
        "max": 1.4
      },
      "5-10": {
        "min": 0.65,
        "max": 1.3
      },
      "10-20": {
        "min": 0.7,
        "max": 1.2
      },
      "20-30": {
        "min": 0.7,
        "max": 1.15
      },
      "30-40": {
        "min": 0.7,
        "max": 1.1
      }
    }
  }
};
