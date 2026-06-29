#!/usr/bin/env bash
set -euo pipefail

# xjxz SQLite consistency backup with 7-copy rotation.
# Usage: backup.sh [DB_PATH] [BACKUP_DIR]
#
# WAL mode is on, so a plain `cp` can copy a torn database file.
# `sqlite3 .backup` takes a consistent snapshot while the app keeps
# serving (deployment is uvicorn --workers 1, single writer).

DB_PATH="${1:-/srv/xjxz/backend/xjxz.db}"
BACKUP_DIR="${2:-/srv/xjxz/backups}"
KEEP=7

if [[ ! -f "$DB_PATH" ]]; then
  echo "backup.sh: database not found: $DB_PATH" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

timestamp="$(date +%F-%H%M%S)"
target="$BACKUP_DIR/xjxz-$timestamp.db"

# Consistent snapshot; sqlite3 exits non-zero on error and `set -e` aborts.
sqlite3 "$DB_PATH" ".backup '$target'"
chmod 600 "$target"

# Rotation: keep the newest $KEEP snapshots, delete the rest.
# Filenames are controlled (fixed xjxz-<ts>.db, no spaces/newlines), so
# parsing `ls -t` output is safe here. Using while-read for bash 3.2 compat.
# shellcheck disable=SC2012
while IFS= read -r old_snap; do
  rm -f "$old_snap"
done < <(ls -1t "$BACKUP_DIR"/xjxz-*.db 2>/dev/null | tail -n +$((KEEP + 1)))

kept="$(find "$BACKUP_DIR" -maxdepth 1 -name 'xjxz-*.db' | wc -l | tr -d ' ')"
echo "backup.sh: wrote $target (kept $kept snapshots)"

# Off-site copy (one snapshot must live off the box). Uncomment and set REMOTE:
#   REMOTE="user@offsite-host:/remote/xjxz-backups/"
#   rsync -az --delete "$BACKUP_DIR"/ "$REMOTE"
