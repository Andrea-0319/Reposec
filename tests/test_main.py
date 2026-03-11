"""Tests for CLI bootstrap helpers in main.py."""
from pathlib import Path
from unittest.mock import patch

from main import _build_copy_ignore, _write_startup_error


def test_build_copy_ignore_skips_internal_state_tree(tmp_path: Path):
    """Self-scans must exclude the tool's internal state directory from the sandbox copy."""
    repo_root = tmp_path / "repo"
    state_dir = repo_root / "state"
    scan_dir = state_dir / "scan_123"
    current_dir = str(repo_root)

    scan_dir.mkdir(parents=True)
    with patch("main.Config.STATE_PATH", state_dir):
        ignored = _build_copy_ignore(repo_root, scan_dir)(current_dir, ["src", "state", "README.md"])

    assert "state" in ignored
    assert "src" not in ignored
    assert "README.md" not in ignored


def test_build_copy_ignore_keeps_unrelated_state_directories(tmp_path: Path):
    """Normal repositories outside the app root should not lose arbitrary state folders."""
    repo_root = tmp_path / "external-repo"
    scan_dir = tmp_path / "scan_456"
    current_dir = str(repo_root)

    repo_root.mkdir()
    scan_dir.mkdir()
    ignored = _build_copy_ignore(repo_root, scan_dir)(current_dir, ["state", "src"])

    assert "state" not in ignored
    assert "src" not in ignored


def test_write_startup_error_persists_message(tmp_path: Path):
    """Bootstrap failures should be persisted for later dashboard inspection."""
    scan_dir = tmp_path / "scan_789"

    _write_startup_error(scan_dir, "copy failed")

    assert (scan_dir / "startup_error.txt").read_text(encoding="utf-8") == "copy failed\n"
