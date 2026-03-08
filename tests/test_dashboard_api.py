"""FASTAPI integration tests using TestClient."""
import pytest
from fastapi.testclient import TestClient
from pathlib import Path

# Override DB path for test
from config import Config
from dashboard.app import app
from dashboard.db import init_db

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

def test_html_routes():
    """Ensure static HTML templates are being served correctly."""
    routes = ["/", "/launch", "/compare"]
    for route in routes:
        response = client.get(route)
        assert response.status_code == 200
        assert "text/html" in response.headers["content-type"]
