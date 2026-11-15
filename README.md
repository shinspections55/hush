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
- Learn Hush: in the Admin Portal, connect with the admin key and use the Learn
  Hush Editor to load, edit, and save the guide. Changes are shared with visitors
  and stored in `data/learn-hush-content.json`; back up this file or use persistent
  storage when deploying. The Node server is required, and backend changes require
  a restart. Edited blocks are plain text (their original inline formatting is
  removed); unchanged blocks retain their formatting. Stale saves are rejected:
  copy any unsaved edits before reloading the editor.
- Local trade prototype: use the Node server at `http://localhost:8000`.
  Teams/Budgets has Trade buttons and an offer inbox. Humans can accept, decline,
  withdraw, or counter offers. The trade window shows both teams' full rosters,
  acquisition costs, original draft prices, remaining budgets, and selected assets
  side by side. A cash-only purchase of one player records the buyer's payment as
  that player's cost; player swaps and multi-player packages retain existing costs.
  The seller receives the full payment into its budget: selling a $1 player for $20
  means $19 profit, not a $19 budget credit. Prior accepted cash purchases are
  recovered from trade history without changing balances. Unknown prices are shown
  as `--` and excluded from known roster cost totals.
  Trades complete only during silent bidding or on
  the summary before waivers; processing, results, and tied auctions block them.
  In-draft trades exchange players/budget and clear both teams' bids and submissions.
  Summary trades exchange players and individual waiver picks. Order is fixed after
  Round 10 and never recalculated following trades; teams can own zero or multiple
  turns. Capacity and budget are enforced, not starting-position minimums.
  CPUs evaluate the total player AV, individual default rankings, roster fit, budget,
  waiver picks, and estimated profit or loss versus their original draft cost.
  Known cash acquisition costs are used for CPU resale ROI; otherwise previously
  traded players and unknown prices are excluded from ROI estimation.
  Adjusted benefit below -$5 is declined; from -$5 to $0 acceptance rises from 5%
  to 10%, then increases by 8 percentage points per $1, capped at 90%.
  After a rejected offer, there is a 5% chance of a counter if a valid, beneficial
  improvement exists. A CPU counter requires human approval and may ask for more
  budget, a player, or a waiver pick, or offer less budget. Retrying does not reroll.
  This prototype trusts the existing browser username and rejects remote/proxied
  connections. It is not a production account-ownership system.
  Run `node tools\test-draft-trades.js` for focused trade tests.
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

## Silent Auction Winner Rule

In every round, the highest valid bid wins. A bid is valid only when the team has enough budget and roster room for the player. Roster size never gives a lower bid priority. The winner pays $1 more than the next-highest valid bid, but never more than their own bid. Equal top bids go to a live tie auction. Run `node tools\test-silentdraft-bid-integrity.js` to check this rule.

For solo drafts with Auto Draft enabled, automatic submission has a 10-second grace period starting when synchronized bidding opens (or when Auto Draft is enabled during bidding). Repeated state syncs do not restart that countdown. Run `node tools\test-silentdraft-auto-submit.js` to verify the timing.

Completed draft history uses IndexedDB (`hush-draft-history`), with one record per draft code and asynchronous transactional writes. Summaries, cuts, trades, waivers, recent drafts, account export/deletion, and DATABASE AV history use the shared store. Saving changes updates only the affected draft instead of rewriting the full archive. Navigation after completion waits for the save to commit. Existing localStorage history and its backup are migrated automatically; legacy copies are removed only after a successful transaction, and invalid legacy data is preserved with a warning.

Active draft recovery remains server-authoritative using existing persisted snapshots. Small preferences and the live rankings snapshot remain in localStorage. If IndexedDB fails at draft completion, a sessionStorage snapshot allows summary recovery with an explicit console error; if both fail, the draft screen reports the failure rather than navigating without results.

On localhost, 127.0.0.1, and IPv6 loopback, history retains three completed test drafts and login/draft/summary pages remove the rebuildable default rankings cache. Login data, edited rankings, active drafts, and other backup entries are preserved. On hushff.com and other non-loopback hosts, history is not automatically trimmed. IndexedDB has a larger, browser-managed quota but is still browser-local, not a cross-device backup, and clearing site data can remove it. Use account export for a downloadable copy.

Run `node tools\test-draft-history.js` and `node tools\test-silentdraft-final-auctions.js` to verify migration, transaction persistence, retention, recovery, and completion behavior.

## Keeping Auction Data Across Deployments

Git does not store `auction_data.db` (it is ignored). Pushing code does not upload
or back up this data. Replacing a deployment's filesystem **can delete it**.
The host must provide a persistent disk/volume independent of the deployed code.
The repository includes Railway configuration, but that does not provision a volume.

- Set `HUSH_AUCTION_DB_PATH` to an **absolute file path outside the code directory**
  on the attached persistent volume. This applies to auction results, individual
  bids, and accumulated player AV statistics.
- Without this setting, local development continues using the existing
  `auction_data.db` beside the server. Production logs a warning in that mode.
- A configured database must already exist and be non-empty. A missing file
  stops startup rather than silently creating a new market database. Only for a
  deliberately fresh installation, temporarily set `HUSH_ALLOW_NEW_AUCTION_DB=1`;
  remove that flag after initialization.
- Missing SQLite support or a database-open failure stops the server instead
  of continuing with no-op writes.

### First production migration (before any destructive redeployment)

1. Confirm the hosting service and persistent-volume support in the host dashboard.
2. Before redeploying or attaching storage that may restart the current container,
   snapshot the **current production** database and download a copy. Do not replace
   it with your localhost database. Pause drafting for the final migration snapshot
   so newer auctions cannot be lost.
3. Use SQLite's snapshot command below, not a plain file copy of a live database:
   SQLite may have committed data in a separate WAL file.
4. Attach the persistent volume outside the application directory, restore the
   snapshot there, and configure `HUSH_AUCTION_DB_PATH` to that restored file.
   On Railway, a volume mounted at `/var/lib/hush` could use the service variable
   `HUSH_AUCTION_DB_PATH=/var/lib/hush/auction_data.db`. A variable alone is **not**
   a persistent volume. Keep one app replica for this SQLite deployment.
5. Deploy, check the logged database path and historical market counts/AVs, then
   perform a second restart/deploy and verify those same records remain.

Example PowerShell backup (destination directory must already exist):

```powershell
npm run db:backup -- 'D:\HushBackups\market-2026-11-13.sqlite-backup'
```

An optional second argument specifies the absolute source database path. Otherwise
the tool uses `HUSH_AUCTION_DB_PATH` or the legacy local database. Backups never
overwrite an existing file, include committed WAL data, and verify SQLite integrity.
Run it on the **production host** to capture production data. Before this tool is
deployed there, use the host's backup facilities or SQLite's `.backup` command.
Keep scheduled backups off the host as well; a persistent volume is not disaster
recovery. No automatic backup schedule or live hosting configuration is created
by this code change.

Other server JSON data (active-draft recovery, rankings edits, guide content, etc.)
still has separate paths and is **not** moved by `HUSH_AUCTION_DB_PATH`. Browser
IndexedDB is separate too. Run `node tools\test-auction-database-persistence.js`
for focused persistence and backup checks.

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

The Admin Portal's **Mock Draft Challenge Editor** links to the existing
prospect editor (add/remove players, edit profiles and position ranks), the
drag-and-drop **Overall Board**, and **Default Pick Owners**. Choose a team for
each pick and click **Save Default Order**; teams can own multiple picks or no
picks. Defaults apply to new or cleared mocks, not existing saved selections.
Save position-file changes before saving a revised overall ranking.
The pick-owner list is a single vertical column. The separate **Team Needs** tab
edits every NFL team's ordered needs, including teams without a first-round pick.
Enter comma-separated positions and click **Save Team Needs** separately from
saving pick owners. Blank means no listed needs. Reload the mock builder to see
updated needs; pick selections are not changed.
These settings are server JSON files under `college prospects 2027`; include
them in deployment backups and preserve admin edits when deploying updates.

Run the Express app (`npm start`), then open `admin-mock-draft.html` and unlock
with the existing admin key. The **Actual Results & Scoring** tab maintains a
32-pick answer key, configurable scoring rules, and imported mock entries.

The embedded mock builder keeps picks and available prospects side by side
above 700px wide, with independently scrolling lists. Selected prospects leave
the pool and return when their pick is cleared or replaced. Search and position
filters apply to available players; assigning a player to another pick moves
them rather than duplicating them. On phones the pool stacks above the board.
The **Actual Draft Results** table also has its own right-hand available-prospect
pool (below the table on phones). Choose a target pick, then add a player, or use
the table's player selectors. Selected prospects disappear from that pool and
are disabled and labeled "already picked" in other result selectors immediately.
Replacing or clearing a pick returns its former player. Changes remain unsaved
until **Save NFL Results**; changing a player clears that pick's confirmation.
This answer-key pool is separate from the mock-entry builder above it.

### Real 2027 contest workflow

The admin defaults to `contest-2027` / `real-nfl`, exactly the dataset used by
the public website. Contestants sign in at `mock-draft-contest.html`, build their
32 predictions, and click **Submit Mock & See Results**. Their verified username
names the entry; submission opens their account-owned results page immediately.
Before NFL results are published the page shows pending scores, then refreshes
as actual selections arrive. No test picks are used in the real contest.

Admins add named experts using **New Expert Mock**, then **Save & Submit Entry**.
Counts distinguish submitted contestants/experts from saved drafts. A failed
submit after saving retains the selected draft for retry without duplicating it.
The actual NFL answer key is separate from all prediction entries.
The answer-key pool follows the saved 2027 Overall Board rankings; position tabs
combine with search, preserve rankings, and do not alter entered results.

During the NFL draft, enter actual selections, mark completed picks Confirmed,
choose **Live - Scoring**, then **Save NFL Results**. Each save automatically
rescores submitted contestants and experts using the same scoring/report pipeline.
When all 32 actual selections are complete, **Finalize NFL Results & See Scores**
confirms all picks, saves Final status, scores entries, and opens the scoreboard.
It requires explicit confirmation that these are REAL NFL results. It does not
bypass the predictions deadline. No external NFL feed is connected.

The 2025 historical workspaces and 2027 sandbox have been retired. The first
scoring-store access backs up the private JSON file before removing those
contests, entries, and fake results. Real 2027 contests, entries, NFL datasets,
rules, and prospect files are preserved unchanged. Old test page URLs return
410 with real-contest links, old public API mode selectors are rejected, and
the retired initializer/scoring routes no longer exist. Test entries/results
are never promoted to the real contest. Private hypothetical datasets remain
under Advanced and cannot supply website results.

**New Expert Mock** starts an expert entry with a required,
typed expert name. Participant entries use a contestant username (prefilled
from the signed-in session); admins may enter a username for test entries on
someone's behalf. Select the entry type before saving. Entries are scored with
the same rules and included in combined and role-specific standings.
Public **Submit Mock** now stores one submitted entry per verified Firebase UID
in the main 2027 contest. The server verifies the Firebase signature, issuer,
audience, and expiry, and derives the username from the signed account display
name; posted usernames/roles/IDs cannot impersonate another user or an expert.
This is a saved mock submission, not a prize entry. Admin-provided
test usernames and names in shareable preview links are display labels, not
proof of account ownership.

2027 public submissions and admin expert entries can be updated until
**April 29, 2027 at 7:30 PM America/New_York (23:30 UTC)**, 30 minutes before
the scheduled 8 PM Eastern start. Deadline displays use the visitor's browser
locale/time zone via `Intl.DateTimeFormat`, including the date and time-zone
abbreviation, with 7:30 PM Eastern retained as a reference. The shared contest
policy defines the single fixed instant for the server and browser. The server rejects
new entries and updates at and after that exact instant, even if an old tab or
client clock says otherwise. Closing submissions in admin may stop entries
earlier; reopening cannot bypass the deadline.
Use **Save Mock Draft** to update a submitted 2027 admin entry before cutoff.

The public **Live scoreboard** (`mock-draft-scoreboard.html`) and **My submitted
mock** report refresh every 10 seconds, and on returning to a visible tab.
Only the main 2027 contest's REAL dataset is published. Saving confirmed real
results as Live or Final atomically recalculates submitted contestants and experts;
the next refresh shows new totals, ranks, and pick breakdowns. A paused scoreboard
shows submitted names with zero points/pending picks and never reveals answer keys.
Others' predictions and account UIDs are never returned by the public scoreboard.
The owner's report loads saved predictions with a fresh Firebase token and excludes
their entry from comparison rows so it appears only once.
No external NFL draft feed is connected: an admin must enter/import
and confirm real results. Run `node tools\\test-public-mock-contest.js` and
`node tools\\test-mock-account-auth.js` for identity/deadline/live-update checks.
Run `node tools\\test-live-mock-ui.js` for automatic-refresh and public submit UI checks.

Browser admin drafts are scoped per contest. **Recover Browser Draft** validates
saved picks against the current catalog before loading them; server entries do
not change until saved/submitted. A contestant username or expert name is required.
**Score All Mocks** only recalculates already-submitted entries against the
selected saved answer key. It is disabled with an explanation when that dataset
is paused or the contest has no submitted entries; it does not submit builder picks.

The preview uses the same scoring/report code as public summaries, requires
admin access, and is labeled ADMIN TEST.
It does not submit the mock or modify results. Its link contains picks but
never the admin key; open it through the unlocked editor in the same browser.

To clean up failed contests, select one and click **Delete Selected Contest**.
Confirming permanently removes that contest and all its saved mocks, datasets,
rules, and scores, then selects the main contest. Other contests are unchanged.
The main `contest-2027` is protected.

- Confirm a pick only after setting its player, position, original owner, and
	selecting team. For a trade chain, enter codes such as `ATL > CLE > DAL`.
- **Save NFL Results** recalculates all imported mocks in Live or Final
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
- From the public 2027 builder, **Submit Mock & See Results** saves the
	account-owned submission and opens its report with per-pick points/reasons,
	overall/expert/participant standings, JSON download, and print actions.
	Shared snapshot previews are not submissions. Paused NFL results are redacted;
	other entries' picks are never returned.
- Close submissions before the real NFL draft begins. The server rejects new
	saves, imports, and submissions while closed. Admin reopening is explicit.
- **Create Contest** establishes separate entries/results for an additional 2027
	contest. Only the main `contest-2027` / `real-nfl` publishes on the website.
	The current 2027 prospect catalog remains available in the embedded builder.
	Prospect headshots and school marks are kept locally in
	`college prospects 2027/assets/headshots/` and `college prospects 2027/assets/schools/`
	and ignored by Git until redistribution rights are confirmed. Rows expand into
	the freed image column when images are absent or fail to load. After licensing,
	add the image folders with
	`git add -f "college prospects 2027/assets/headshots" "college prospects 2027/assets/schools"`.

Mock import (one entry, or `{ "mocks": [ ... ] }`):

```json
{
	"name": "Named Expert",
	"role": "expert",
	"picks": [
		{ "pick": 1, "team": "TEN", "playerName": "Player One", "position": "QB" },
		{ "pick": 2, "team": "CLE", "trade": true, "tradeTo": "JAC", "playerName": "Player Two", "position": "WR" }
	]
}
```

Actual results import requires 32 ordered rows, as an array or `{ "results": [...] }`.
Each row uses `pick`, `originalTeam`, `selectingTeam`, `playerName`, `position`,
`traded`, `confirmed`, `tradeHistory` (array of team codes), and optional `notes`.
Both results and mocks should supply a shared `playerId` for exact-player scoring.
Name-only
entries use `manual:` plus a normalized name, e.g. `manual:player-one`.
Use the exact same name on both sides for name-only imports. A name-only
`manual:` ID is not equivalent to a catalog ID. Contest year is immutable after
creation. No expert predictions are preloaded.

Scoring data is persisted privately in `../.hush-data/mock-draft-scoring-2027.json`
(outside the static website directory). Include this file in future full data
backups. The existing Hush4.6 ZIP predates this feature and is not modified.
There is no live data-provider integration yet.

Tests:

```powershell
node tools/test-mock-draft-scoring.js
node tools/test-mock-draft-scoring-api.js
node tools/test-public-mock-contest.js
node tools/test-mock-test-retirement.js
node tools/test-admin-entry-flow.js
node tools/test-admin-finalize-results.js
node tools/test-live-mock-ui.js
```
