# CPU Tuning Lab - Removed Knobs Backup

This document contains all knobs that were removed for simplification. Keep this file in case you need to restore functionality.

---

## Removed Knobs & Their Purposes

### 1. `personalityVarianceStep: 0.18`
**Location:** cpulogic.js `silent` section  
**Purpose:** Added random team-to-team personality variance to aggression  
**How it worked:** `(getTeamSeed(team.name) % 7 - 3) * personalityVarianceStep`  
**Reason for removal:** Overlapped with `roundVarianceMax` creating double randomness  
**To restore:** Add back to cpulogic.js and in cpu-silent-auction.js line ~1390

---

### 2. `midRoundVarianceMax: 0.3` & `lateRoundVarianceMax: 0.23`
**Location:** cpulogic.js `silent` section  
**Purpose:** Different variance amounts for mid-round (4-6) and late-round (7+) play  
**How they worked:** Applied random variance scaled per round phase  
**Reason for removal:** Too many variance knobs (had roundVarianceMax, midRoundVarianceMax, lateRoundVarianceMax, personalityVarianceStep)  
**To restore:** Re-add both to cpulogic.js and apply conditional logic in cpu-silent-auction.js line ~1372

---

### 3. `richEarlyBonusMax: 0.23` (now `richEarlyBoost: 0.23`)
**Location:** cpulogic.js `silent` section  
**Original name:** `richEarlyBonusMax`  
**Purpose:** Max bonus for rich teams bidding early (rounds 1-3)  
**How it worked:** `Math.random() * richEarlyBonusMax - 0.1` at line ~1369 in cpu-silent-auction.js  
**Note:** This was renamed to `richEarlyBoost` but retains same function  
**To restore:** No restoration needed - already in simplified version

---

### 4. `finalFillBonus: 0.22` (now `finalRoundFillBoost: 0.22`)
**Location:** cpulogic.js `silent` section  
**Original name:** `finalFillBonus`  
**Purpose:** Bonus for roster filling in final rounds  
**Issue:** Was applied at TWO scales:
  - Line ~1363: `finalFillBonus * 0.45` (45% of value)
  - Line ~1365: `finalFillBonus * 1.0` (full value)  
**Note:** This was renamed to `finalRoundFillBoost` but retains same dual-application behavior  
**To restore:** No restoration needed - already in simplified version

---

### 5. `missingStarterBonus: 0.18` (now `emergencyStarterBoost: 0.18`)
**Location:** cpulogic.js `silent` section  
**Original name:** `missingStarterBonus`  
**Purpose:** Bonus when team is missing required starters  
**How it worked:** Applied when `isBehindMinimumPace` OR `totalMissing > 0`  
**Note:** This was renamed to `emergencyStarterBoost` but retains same function  
**To restore:** No restoration needed - already in simplified version

---

### 6. `roundVarianceMax: 0.2`
**Location:** cpulogic.js `silent` section  
**Purpose:** Generic round-to-round unpredictability  
**How it worked:** `(Math.random() - 0.5) * (roundVarianceMax * 2)` at line ~1395  
**Reason for removal:** Overlapped with midRoundVarianceMax/lateRoundVarianceMax  
**Current behavior:** Variance is still applied via the round-specific knobs  
**To restore:** Re-add to cpulogic.js and cpu-silent-auction.js line ~1395

---

### 7. `maxAggressionCap: 0.95`
**Location:** cpulogic.js `silent` section  
**Purpose:** Hard cap to prevent CPU aggression from exceeding 0.95  
**How it worked:** `Math.max(0.1, Math.min(maxAggressionCap, baseAggressiveness))`  
**Reason for removal:** Redundant - hard-coded cap can be set directly  
**Current behavior:** Capped at 0.95 in code  
**To restore:** Add back if you want this to be tunable (change hardcoded 0.95 to reference this knob)

---

## Restoration Instructions

### To Restore a Single Knob:

1. **Add to cpulogic.js `silent` section:**
   ```json
   "knobName": value,
   ```

2. **Add to cpu-silent-auction.js DEFAULT_SILENT_TUNING:**
   ```javascript
   knobName: value,
   ```

3. **Apply in logic** (find the location mentioned above)

4. **Restart server**

---

## Original cpulogic.js Silent Config (Before Simplification)

```json
"silent": {
  "baseAggression": 0.4,
  "budgetRichBoost": 0.05,
  "budgetPoorReduction": 0.25,
  "rosterTightBoost": 0.24,
  "rosterLooseReduction": 0.18,
  "emergencyStarterBoost": 0.18,
  "finalRoundFillBoost": 0.22,
  "earlyRoundReduction": 0.02,
  "richEarlyBoost": 0.23,
  "midRoundVarianceMax": 0.3,
  "lateRoundVarianceMax": 0.23,
  "personalityVarianceStep": 0.18,
  "roundVarianceMax": 0.2,
  "maxAggressionCap": 0.95,
  "avCenteringStrength": 0.9
}
```

---

## Code Snippets for Restoration

### Restore `personalityVarianceStep` Logic
**File:** cpu-silent-auction.js (around line 1390)

```javascript
const personalityVariance = (getTeamSeed(team.name) % 7 - 3) * Number(silentTuning.personalityVarianceStep || 0.1);
baseAggressiveness += personalityVariance;
```

### Restore `roundVarianceMax` Logic
**File:** cpu-silent-auction.js (around line 1395)

```javascript
const roundVariance = (Math.random() - 0.5) * (Number(silentTuning.roundVarianceMax || 0.15) * 2);
baseAggressiveness += roundVariance;
```

### Restore `maxAggressionCap` Logic
**File:** cpu-silent-auction.js (around line 1400)

```javascript
baseAggressiveness = Math.max(0.1, Math.min(Number(silentTuning.maxAggressionCap || 0.95), baseAggressiveness));
```

---

## Testing After Restoration

After restoring any knob:
1. Run a silent draft with A-J mode
2. Open browser console (F12)
3. Look for CPU bid logs: `[CPU-Team X] Bid on Player ($Y)`
4. Verify bids are behaving as expected
5. Run 2-3 drafts to see variance patterns

---

**Last Updated:** 2026-07-06  
**Removed For Version:** Simplified CPU Tuning Lab v1
