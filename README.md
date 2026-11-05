# Single-page Signup

This is a small single-page site combining the provided signup/login HTML and the logo image into `index.html`.

How to run locally (quick methods):

Option A — Python simple server (no install beyond Python):

1. Make sure you have Python installed and `python` is on PATH.
2. In this folder run:

```powershell
python -m http.server 8000
```

3. Open http://localhost:8000 in your browser.

Option B — Node + Express (supports extensionless routes like `/register`):

1. Make sure Node.js and npm are installed.
2. From this folder run:

```powershell
npm install
npm start
```

3. Open http://localhost:8000 in your browser. The Express server will serve static files and will rewrite extensionless routes to their `.html` counterparts (so `/register` will serve `register.html`).

Notes:
- The site now includes a small Express + Socket.IO server for real-time lobby updates. Run `npm install` to install dependencies (Express and Socket.IO).
- The forms are handled by client-side scripts and do not send data to a server in this demo; registration and login use browser storage (localStorage / sessionStorage). Lobby state is synced in real-time via Socket.IO while the server is running (server-side state is ephemeral).
- Replace the image `Explosive Logo with Charcoal and Midnight Background.png` or rename it if needed.

Quick exact Node/PowerShell steps

1. Install Node.js (LTS) if you don't have it. Download from https://nodejs.org/ or use winget/choco.

2. In PowerShell, from the project root run the exact commands below to install deps and start the server:

```powershell
cd 'C:\Users\ampbo\Website'
npm install
npm start
```

3. Open the site in your browser at:

```
http://localhost:8000
```

PowerShell helper (start-and-open.ps1)

If you prefer a single command that will install dependencies if missing, start the server, wait for it to be ready, and open the default browser automatically, use the included `start-and-open.ps1` script:

```powershell
.\start-and-open.ps1
```

The script will:
- run `npm install` if `node_modules` is missing,
- start `npm start` in a subprocess,
- wait for the server to print the "Server listening" line,
- then open your default browser to the correct localhost URL.

## Mobile And PWA Rankings

On screens up to 900px, My Rankings uses full-width **My Rankings** and
**Player Pool** tabs. Search/filter the pool and tap **+** to add players;
switch back to the rankings tab to review them. Tap a player's up/down-arrow
button to move to a rank number (1 means top) or to the top of a tier.
Mobile additions and moves save immediately. Existing bid, star, remove,
position-board, and read-only protections are preserved. Desktop keeps its
two-column layout and drag/drop; printouts omit mobile tabs and controls.

The rankings asset version and service-worker cache are updated so an installed
PWA receives this layout when it reconnects. No existing rankings data is reset.
Test: `node tools/test-rankings-mobile.js`.

## Mock Draft Actual Results and Scoring

Run the Express app (`npm start`), then open `admin-mock-draft.html` and unlock
with the existing admin key. The **Actual Results & Scoring** tab maintains a
32-pick answer key, configurable scoring rules, and imported mock entries.

- Confirm a pick only after setting its player, position, original owner, and
	selecting team. For a trade chain, enter codes such as `ATL > CLE > DAL`.
- **Save Results + Rules** recalculates all imported mocks in Live or Final
	status. Paused saves leave the last published scores unchanged. Resume by
	choosing Live and saving. **Score All Mocks** recalculates saved data only.
- Unconfirmed picks remain pending. A normal miss also stays pending while an
	adjacent pick could still produce a range hit. Only one highest-applicable
	match is awarded per pick. Trade calls use their trade tier instead of adding
	a bonus to a normal pick score; failed exact trades receive the exact-trade
	penalty, and failed team-only calls receive the team-trade penalty.
- The initial values are exact 15, position 5, range 3, miss -3, team trade 10,
	trade + player 30, trade + position 18, correct partner 12, team-trade miss -5,
	and exact-trade miss -8. These can all be edited and rescored.
- Expand an imported entry to see each prediction, its actual-result snapshot,
	score, reason, and player/position/range/trade/partner match flags.
- Import JSON exported by the contest, or use **Import This Browser's Mock**.
	These become submitted entries in the selected contest and can be marked
	Participant or Expert. Public account-bound submission is not connected yet;
	admins can build, save, submit, or import participant entries using this registry.

### Contests, Test Results, and Real NFL Results

- Select a contest and a results dataset in **Actual Results & Scoring**.
	Every contest has separate `TEST / HYPOTHETICAL` and `REAL / NFL` records.
	A dataset's type and source cannot be changed by a save request. Saves require
	explicit contest/dataset IDs, so an invalid ID cannot fall back to real results.
- Existing single-registry scoring data migrates to **Migrated scoring test**.
	Its mocks and hypothetical results are retained; the real NFL dataset begins
	empty. Changing the old status to Live does not classify its answers as NFL results.
- **Create / Edit Mock** embeds the contest's drag/drop builder, using separate
	browser storage from a user's normal mock. Search prospects, choose teams,
	select a trade recipient, or check **Team will trade** without a partner.
	**Save Mock Draft** persists an editable draft excluded from the leaderboards.
	**Submit Saved Mock** validates all 32 slots and locks its predictions.
	Submitted entries can be cloned into new drafts rather than overwritten.
- **Create Test** starts empty hypothetical results; **Clone Test** copies only
	the selected test's answers/rules. It creates independent results and scores.
	**Reset Test Results** clears that test's answers and scores and pauses scoring,
	without deleting shared submissions, expert entries, other tests, or real results.
	The server rejects clone/reset requests targeting a real NFL dataset.
- Real answer-key saves require a separate confirmation. They never read from
	the hypothetical answer key. Enter and confirm actual NFL picks manually
	when available; provider automation has not been integrated.
- **Combined**, **Participants**, and **Experts** leaderboards use the selected
	dataset's published scores, include submitted entries only, and use shared
	ranks for tied totals. All use the same scorer and per-pick explanations.
- From the public 2027 builder, **Review mock** opens a standalone report with
	per-pick points/reasons, projected overall/expert/participant standings, and
	share, JSON download, and print actions. The share URL carries a snapshot of
	that mock; other entries' picks are never returned. Paused real results are
	redacted from the public preview. This is a score preview, not an account-bound
	contest submission; public participant submission is still not connected.
- Close submissions before the real NFL draft begins. The server rejects new
	saves, imports, and submissions while closed. Admin reopening is explicit.
- **Create Contest** establishes separate entries/results for another year.
	The current 2027 prospect catalog remains available in the embedded builder;
	other draft classes require historical JSON imports unless a catalog is supplied.
- **Load 2025 Scoring Test** is available only in the admin scoring tab. It creates
	an isolated calibration contest with the supplied 32 first-round selections,
	an admin-only 2025 builder catalog, and a locked historical reference dataset.
	It does not change the public 2027 builder, its default order, or any 2027 dataset.
	Original team means the pre-draft-night owner; draft-night swaps are recorded.
	The five permanent designed fixtures expect 480 (perfect), 160 (position only),
	96 (adjacent pairs), -96 (complete misses), and 173 (mixed trades), respectively.
	The leaderboard reports PASS/FAIL under default rules on the locked reference;
	custom rules or answer keys are labeled separately. These are test entries,
	not expert predictions. Load is idempotent and never restores over edited rules.
	Use **Clone Test** for editable answers and **Clone Entry** for editable mocks.
	Switching back restores the admin builder's 2027 catalog and team needs.

Historical mock import (one entry, or `{ "mocks": [ ... ] }`):

```json
{
	"name": "Historical test",
	"picks": [
		{ "pick": 1, "team": "TEN", "playerName": "Player One", "position": "QB" },
		{ "pick": 2, "team": "CLE", "trade": true, "tradeTo": "JAC", "playerName": "Player Two", "position": "WR" }
	]
}
```

Actual results import requires 32 ordered rows, as an array or `{ "results": [...] }`.
Each row uses `pick`, `originalTeam`, `selectingTeam`, `playerName`, `position`,
`traded`, `confirmed`, `tradeHistory` (array of team codes), and optional `notes`.
Both results and mocks can supply a shared `playerId`. Name-only historical
entries use `manual:` plus a normalized name, e.g. `manual:player-one`.
Use the exact same name on both sides. Use the admin 2025 calibration contest for
historical comparisons. Contest year is immutable after creation. No expert
predictions are preloaded; historical selections are based on the supplied list.

Scoring data is persisted privately in `../.hush-data/mock-draft-scoring-2027.json`
(outside the static website directory). Include this file in future full data
backups. The existing Hush4.6 ZIP predates this feature and is not modified.
There is no live data-provider integration yet.

Tests:

```powershell
node tools/test-mock-draft-scoring.js
node tools/test-mock-draft-scoring-api.js
node tools/test-mock-draft-calibration.js
```
