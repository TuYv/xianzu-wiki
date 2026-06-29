import os
import shutil
import sqlite3
import subprocess
import time
from pathlib import Path

import pytest

SCRIPT = Path(__file__).resolve().parents[2] / "scripts" / "backup.sh"

needs_sqlite3 = pytest.mark.skipif(
    shutil.which("sqlite3") is None, reason="sqlite3 CLI not installed"
)


def _make_db(path: Path) -> None:
    conn = sqlite3.connect(path)
    conn.execute("CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT)")
    conn.execute("INSERT INTO t (v) VALUES ('hi')")
    conn.commit()
    conn.close()


def test_backup_script_exists_and_executable():
    assert SCRIPT.is_file(), f"missing {SCRIPT}"
    assert os.access(SCRIPT, os.X_OK), "backup.sh must be chmod +x"


@needs_sqlite3
def test_backup_creates_consistent_snapshot(tmp_path):
    db = tmp_path / "xjxz.db"
    backups = tmp_path / "backups"
    _make_db(db)

    subprocess.run(["bash", str(SCRIPT), str(db), str(backups)], check=True)

    snaps = list(backups.glob("xjxz-*.db"))
    assert len(snaps) == 1
    conn = sqlite3.connect(snaps[0])
    assert conn.execute("SELECT v FROM t").fetchone()[0] == "hi"
    conn.close()
    assert oct(snaps[0].stat().st_mode)[-3:] == "600"


@needs_sqlite3
def test_backup_rotation_keeps_seven(tmp_path):
    db = tmp_path / "xjxz.db"
    backups = tmp_path / "backups"
    backups.mkdir()
    _make_db(db)

    # seed 9 older snapshots with strictly increasing mtimes
    for i in range(9):
        f = backups / f"xjxz-2026-01-{i + 1:02d}-000000.db"
        f.write_text("old")
        os.utime(f, (time.time() - (9 - i) * 86400,) * 2)

    subprocess.run(["bash", str(SCRIPT), str(db), str(backups)], check=True)

    snaps = list(backups.glob("xjxz-*.db"))
    assert len(snaps) == 7  # 9 old + 1 new = 10 -> keep newest 7


@needs_sqlite3
def test_backup_missing_db_fails_loudly(tmp_path):
    proc = subprocess.run(
        ["bash", str(SCRIPT), str(tmp_path / "nope.db"), str(tmp_path / "b")],
        capture_output=True,
        text=True,
    )
    assert proc.returncode != 0
    assert "not found" in proc.stderr
