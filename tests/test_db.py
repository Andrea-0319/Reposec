"""Tests for the Security Review Dashboard data layers (SQLite)."""
import pytest
import sqlite3
from pathlib import Path

from dashboard.db import (
    init_db, upsert_project, get_projects, insert_scan, 
    get_scans, insert_findings, get_findings, get_comparison_data, 
    update_scan_status, get_scan_detail
)

@pytest.fixture
def test_db_path(tmp_path: Path) -> Path:
    """Fixture to provide a temporary in-memory/file database."""
    db_file = tmp_path / "test_sec_review.db"
    init_db(db_file)
    return db_file

def test_upsert_project(test_db_path: Path):
    """Test project creation and idempotent upsert."""
    # Create new
    pid1 = upsert_project("Test Project", "/fake/repo", test_db_path)
    assert pid1 > 0
    
    # Upsert existing (should return same ID based on repo_path)
    pid2 = upsert_project("Test Project Renamed", "/fake/repo", test_db_path)
    assert pid1 == pid2
    
    projects = get_projects(test_db_path)
    assert len(projects) == 1
    assert projects[0]["name"] == "Test Project"

def test_scan_and_findings(test_db_path: Path):
    """Test scan insertion, findings insertion, and rollups."""
    pid = upsert_project("App", "/app", test_db_path)
    
    scan_id = insert_scan(
        project_id=pid,
        scan_dir="/fake/scan_dir",
        db_path=test_db_path
    )
    assert scan_id > 0
    
    # Insert findings
    findings = [
        {"title": "Weak Hash", "severity": "CRITICAL", "owasp": "A02"},
        {"title": "No Rate Limit", "severity": "MEDIUM", "file": "auth.py"},
        {"title": "Path Traversal", "severity": "MEDIUM"}
    ]
    
    insert_findings(scan_id, findings, test_db_path)
    
    # Check rollups in scan table
    scan = get_scan_detail(scan_id, test_db_path)
    assert scan["total_findings"] == 3
    assert scan["critical"] == 1
    assert scan["medium"] == 2
    assert scan["high"] == 0
    
    # Retrieve findings
    retrieved = get_findings(scan_id, test_db_path)
    assert len(retrieved) == 3
    assert retrieved[0]["title"] == "Weak Hash"  # Should be sorted (CRITICAL first)

def test_comparison_data(test_db_path: Path):
    """Test the diffing engine between two scans."""
    pid = upsert_project("App Diff", "/app/diff", test_db_path)
    
    scan_a = insert_scan(pid, "/scan_a", db_path=test_db_path)
    scan_b = insert_scan(pid, "/scan_b", db_path=test_db_path)
    
    # Scan A (Older)
    findings_a = [
        {"title": "Issue 1 - Resolved", "file": "f1.py", "severity": "HIGH"},
        {"title": "Issue 2 - Unchanged", "file": "f2.py", "severity": "MEDIUM"}
    ]
    insert_findings(scan_a, findings_a, test_db_path)
    
    # Scan B (Newer)
    findings_b = [
        {"title": "Issue 2 - Unchanged", "file": "f2.py", "severity": "MEDIUM"},
        {"title": "Issue 3 - New", "file": "f3.py", "severity": "LOW"}
    ]
    insert_findings(scan_b, findings_b, test_db_path)
    
    diff = get_comparison_data(scan_a, scan_b, test_db_path)
    
    assert len(diff["new"]) == 1
    assert diff["new"][0]["title"] == "Issue 3 - New"
    
    assert len(diff["resolved"]) == 1
    assert diff["resolved"][0]["title"] == "Issue 1 - Resolved"
    
    assert len(diff["unchanged"]) == 1
    assert diff["unchanged"][0]["title"] == "Issue 2 - Unchanged"
