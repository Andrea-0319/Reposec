"""Shared fixtures for SecurityReviewSystem tests."""
import pytest
from pathlib import Path


@pytest.fixture
def fake_state(tmp_path: Path) -> dict:
    """Minimal SecurityState dict for unit tests (no real repo needed)."""
    scan_dir = tmp_path / "scan_output"
    scan_dir.mkdir()
    return {
        "backend_type": "cli",
        "max_parallel": 1,
        "repo_path": str(tmp_path / "original_repo"),
        "working_repo": str(tmp_path / "repo_copy"),
        "scan_output_dir": str(scan_dir),
        "model_override": None,
        "sdk_url": None,
        "timeout_override": 1800,
        "fingerprint": "",
        "file_manifest": "",
        "current_agent": "",
        "agent_outputs": {},
        "completed_steps": [],
        "errors": [],
        "stop_requested": False,
    }


@pytest.fixture
def tmp_scan_dir(tmp_path: Path) -> Path:
    """Isolated temporary scan directory."""
    scan_dir = tmp_path / "scan"
    scan_dir.mkdir()
    return scan_dir
