module.exports = {
  "presetName": "Version A Completion",
  "updatedAt": 1785112200000,
  "silent": {
    "baseAggression": 0.5,
    "budgetRichBonus": 0.2,
    "budgetPoorPenalty": -0.2,
    "rosterTightBonus": 0.15,
    "rosterLoosePenalty": -0.1,
    "missingStarterBonus": 0.18,
    "finalFillBonus": 0.22,
    "earlyRoundPenalty": -0.08,
    "richEarlyBonusMax": 0.32,
    "midRoundVarianceMax": 0.25,
    "lateRoundVarianceMax": 0.47,
    "personalityVarianceStep": 0.15,
    "roundVarianceMax": 0.2,
    "maxAggressionCap": 0.95,
    "globalInterestThresholdScale": 1.25,
    "globalInterestThresholdCap": 0.95,
    "earlyInterestHoldUntilRound": 7,
    "earlyInterestHoldMaxPressure": 5.5,
    "earlyInterestHoldPaceTolerance": 0.05,
    "earlyTopRankFocusMaxRound": 4,
    "earlyTopRankFocusMaxRank": 120,
    "earlyRoundMaxBidsCap": 6,
    "globalBidVolumeMultiplier": 0.92,
    "spreadBidVolumeMultiplier": 0.65,
    "spreadDollarBidMultiplier": 0.55,
    "volumeBidsStartRound": 7,
    "draftChancePrimaryBaseFloor": 0.68,
    "draftChancePrimaryMinFloor": 0.3,
    "coverageAddCap": 8,
    "coverageDraftChanceFloor": 0.62,
    "starTargetAggressionBoost": 0.6,
    "starTargetLowballReduction": 0.4,
    "spreadModeIntensity": 0.32,
    "spreadDraftChanceFloor": 0.3,
    "midRoundLikelyDraftedOnlyEnabled": false,
    "midRoundLikelyDraftedMinAV": 3,
    "midRoundLikelyDraftedDraftChanceFloor": 0.2,
    "lateRoundPaceThresholdHitEnabled": true,
    "lateRoundPaceThresholdStartRound": 6,
    "lateRoundPaceThresholdPerRoundHit": 0.04,
    "lateRoundPaceThresholdMaxHit": 0.16,
    "paceCatchBidIntensity": 0.9,
    "lateRoundBudgetForcingIntensity": 0.9,
    "affordabilityOverAvBudgetCap": 0.55,
    "earlyRoundBidCoverageCapEnabled": false,
    "avCenteringStrength": 0.58,
    "avConvergenceWindow": 5,
    "avConvergenceEliteWindow": 7,
    "avMarketDepthEnabled": true,
    "avMarketDepthMaxRound": 10,
    "avMarketDepthMinAv": 18,
    "avMarketDepthMinBidMultiplier": 0.88,
    "avMarketDepthMinCompetitiveBids": 3,
    "avMarketDepthMaxPlayersPerRound": 8,
    "avMarketDepthBidLowMultiplier": 0.9,
    "avMarketDepthBidHighMultiplier": 1.04
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
    "clockBoost": 1.04,
    "earlyRoundTieRateMultiplier": 0.4,
    "midRoundTieRateMultiplier": 0.72,
    "lateRoundTieRateMultiplier": 1.02,
    "roundTieRateFloor": 0.0012,
    "roundTieRateCeiling": 0.01
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
