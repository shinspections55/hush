# Hush V3.9 Backup

Created: 2026-08-07

## Snapshot
This backup records the GIF manager reliability and Silent Draft GIF sync improvements completed in this session.

## Included changes
- Enabled deletion of built-in GIF categories when requested.
- Removed GIF picker search bar, favorites category, and clear button in Silent Draft.
- Switched Silent Draft GIF picker to load live categories and items from server API so admin changes appear immediately.
- Added safer GIF library persistence in server:
  - Atomic writes for `data/hush-gifs.json`.
  - Automatic per-edit backup snapshots in `data/backups/`.
  - Backup retention pruning (`HUSH_GIF_BACKUP_MAX_FILES`, default 200).
  - Auto-recovery from latest valid backup if primary GIF file is unreadable.

## Notes
- This is a documentation backup record, not a full file archive.
- Backup snapshot JSON files are saved under `data/backups/` during GIF manager edits.
