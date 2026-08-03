# Hush V3.8.1 Backup

Created: 2026-08-02

## Snapshot
This backup records the draft stability fixes and login safety hardening made in this session.

## Included changes
- Prevented login form fallback GET submits when scripts fail to load.
- Added a login submit safety guard in `index.html`.
- Marked login handler attachment in `scripts.js`.
- Made draft round progression server-authoritative in `silentdraft.js`.
- Ensured reconnect sync always applies the server round number.
- Preserved server-side submission gating for manual bid submissions.

## Notes
- This is a documentation backup record, not a full file archive.
- The source files remain in the workspace at their current versions.
