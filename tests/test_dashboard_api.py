"""FASTAPI integration tests using TestClient."""
import pytest
from fastapi.testclient import TestClient
from pathlib import Path
from unittest.mock import patch

# Override DB path for test
from config import Config
from dashboard.app import app, _extract_model_id_from_line
from dashboard.db import init_db, upsert_project, insert_scan

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_test_db(tmp_path: Path):
    """Ensure API tests use an isolated database in tmp_path."""
    test_db = tmp_path / "api_test.db"
    Config.DB_PATH = test_db
    init_db(test_db)
    yield test_db

def test_api_projects_empty():
    """Initially the API should return 0 projects."""
    response = client.get("/api/projects")
    assert response.status_code == 200
    assert response.json() == []

def test_api_scans_not_found():
    """Querying a non-existent project should return 404."""
    response = client.get("/api/projects/999/scans")
    assert response.status_code == 404

def test_launch_scan_invalid_path():
    """Launching an invalid repo path should return 400 Bad Request."""
    response = client.post("/api/scans/launch", json={
        "repo_path": "/valid/path/doesnt/exist_89123891",
        "parallel": 1
    })
    assert response.status_code == 400
    assert "Invalid repo path" in response.json()["detail"]


def test_extract_model_id_from_cli_table_row():
    """Model parser should handle pipe-delimited CLI output rows."""
    assert _extract_model_id_from_line("| opencode/minimax-m2.5-free | Minimax m2.5 Free |") == "opencode/minimax-m2.5-free"


@patch("dashboard.app.find_opencode_executable", return_value="opencode")
@patch("dashboard.app.subprocess.run")
def test_api_models_returns_dynamic_list(mock_run, mock_find):
    """The models API should return parsed entries from the CLI output."""
    mock_run.return_value.returncode = 0
    mock_run.return_value.stdout = "opencode/minimax-m2.5-free\ngpt-4o\n"
    mock_run.return_value.stderr = ""

    response = client.get("/api/models")
    assert response.status_code == 200
    payload = response.json()
    assert payload["models"][0]["id"] == "opencode/minimax-m2.5-free"
    assert payload["models"][1]["id"] == "gpt-4o"


@patch("dashboard.app.find_opencode_executable", side_effect=FileNotFoundError("missing opencode"))
def test_api_health_opencode_returns_missing_state(mock_find):
    """OpenCode health should report a missing executable without failing."""
    from dashboard import app as dashboard_app_module

    dashboard_app_module._models_cache.update({
        "models": [],
        "error": None,
        "installed": False,
        "executable": None,
        "ts": 0.0,
    })

    response = client.get("/api/health/opencode")
    assert response.status_code == 200
    payload = response.json()
    assert payload["installed"] is False
    assert payload["model_count"] == 0
    assert "missing opencode" in payload["error"]


def test_api_health_returns_ok():
    """The health endpoint should expose API status and version."""
    response = client.get("/api/health")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["version"] == app.version

def test_html_routes():
    """Ensure static HTML templates are being served correctly."""
    routes = ["/", "/launch", "/compare"]
    for route in routes:
        response = client.get(route)
        assert response.status_code == 200
        assert "text/html" in response.headers["content-type"]


def test_scan_detail_includes_persisted_startup_error(tmp_path: Path):
    """Scan detail should expose bootstrap failures persisted in the scan directory."""
    project_id = upsert_project("repo", str(tmp_path / "repo"), Config.DB_PATH)
    scan_dir = tmp_path / "scan"
    scan_dir.mkdir()
    (scan_dir / "startup_error.txt").write_text("copy failed\n", encoding="utf-8")
    scan_id = insert_scan(project_id=project_id, scan_dir=str(scan_dir), status="failed", db_path=Config.DB_PATH)

    response = client.get(f"/api/scans/{scan_id}")

    assert response.status_code == 200
    payload = response.json()
    assert payload["scan"]["status"] == "failed"
    assert payload["error"] == "copy failed"


def test_scan_status_includes_persisted_startup_error(tmp_path: Path):
    """Status polling should expose persisted bootstrap errors for failed scans."""
    project_id = upsert_project("repo", str(tmp_path / "repo"), Config.DB_PATH)
    scan_dir = tmp_path / "scan-status"
    scan_dir.mkdir()
    (scan_dir / "startup_error.txt").write_text("recursive copy blocked\n", encoding="utf-8")
    scan_id = insert_scan(project_id=project_id, scan_dir=str(scan_dir), status="failed", db_path=Config.DB_PATH)

    response = client.get(f"/api/scans/{scan_id}/status")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "failed"
    assert payload["error"] == "recursive copy blocked"
