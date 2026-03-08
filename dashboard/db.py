"""SQLite database layer for the Security Review Dashboard.

Manages projects, scans, and findings with a normalized 3-table schema.
Uses context managers for safe connection/transaction handling.
"""
import sqlite3
from pathlib import Path
from typing import Any, Dict, List, Optional
from datetime import datetime


# Default DB path (overridden by Config.DB_PATH at runtime)
_DEFAULT_DB = Path(__file__).parent.parent / "state" / "security_review.db"


def _get_connection(db_path: Optional[Path] = None) -> sqlite3.Connection:
    """Create a connection with row_factory for dict-like access."""
    path = str(db_path or _DEFAULT_DB)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")      # Better concurrent reads
    conn.execute("PRAGMA foreign_keys=ON")        # Enforce FK constraints
    return conn


# ---------------------------------------------------------------------------
# Schema setup
# ---------------------------------------------------------------------------
def init_db(db_path: Optional[Path] = None) -> None:
    """Create tables if they don't exist."""
    conn = _get_connection(db_path)
    try:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS projects (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                name        TEXT    NOT NULL,
                repo_path   TEXT    NOT NULL UNIQUE,
                created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS scans (
                id                INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id        INTEGER NOT NULL REFERENCES projects(id),
                scan_dir          TEXT    NOT NULL UNIQUE,
                started_at        TEXT    NOT NULL DEFAULT (datetime('now')),
                duration_seconds  REAL,
                status            TEXT    NOT NULL DEFAULT 'completed',
                total_findings    INTEGER NOT NULL DEFAULT 0,
                critical          INTEGER NOT NULL DEFAULT 0,
                high              INTEGER NOT NULL DEFAULT 0,
                medium            INTEGER NOT NULL DEFAULT 0,
                low               INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS findings (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                scan_id       INTEGER NOT NULL REFERENCES scans(id),
                title         TEXT    NOT NULL,
                severity      TEXT    NOT NULL,
                owasp         TEXT,
                file          TEXT,
                description   TEXT,
                remediation   TEXT
            );

            CREATE INDEX IF NOT EXISTS idx_scans_project
                ON scans(project_id);
            CREATE INDEX IF NOT EXISTS idx_findings_scan
                ON findings(scan_id);
        """)
        conn.commit()
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Project CRUD
# ---------------------------------------------------------------------------
def upsert_project(name: str, repo_path: str,
                   db_path: Optional[Path] = None) -> int:
    """Insert a project or return the existing id (matched by repo_path)."""
    conn = _get_connection(db_path)
    try:
        row = conn.execute(
            "SELECT id FROM projects WHERE repo_path = ?", (repo_path,)
        ).fetchone()
        if row:
            return row["id"]
        cur = conn.execute(
            "INSERT INTO projects (name, repo_path) VALUES (?, ?)",
            (name, repo_path),
        )
        conn.commit()
        return cur.lastrowid
    finally:
        conn.close()


def get_projects(db_path: Optional[Path] = None) -> List[Dict[str, Any]]:
    """Return all projects with the latest scan summary."""
    conn = _get_connection(db_path)
    try:
        rows = conn.execute("""
            SELECT p.*,
                   s.id            AS last_scan_id,
                   s.started_at    AS last_scan_date,
                   s.status        AS last_scan_status,
                   s.total_findings,
                   s.critical, s.high, s.medium, s.low
            FROM projects p
            LEFT JOIN scans s ON s.id = (
                SELECT id FROM scans
                WHERE project_id = p.id
                ORDER BY started_at DESC LIMIT 1
            )
            ORDER BY p.created_at DESC
        """).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def delete_project(project_id: int, db_path: Optional[Path] = None) -> bool:
    """Delete a project and all its nested scans/findings."""
    conn = _get_connection(db_path)
    try:
        row = conn.execute("SELECT id FROM projects WHERE id = ?", (project_id,)).fetchone()
        if not row:
            return False
            
        conn.execute("DELETE FROM findings WHERE scan_id IN (SELECT id FROM scans WHERE project_id = ?)", (project_id,))
        conn.execute("DELETE FROM scans WHERE project_id = ?", (project_id,))
        conn.execute("DELETE FROM projects WHERE id = ?", (project_id,))
        
        conn.commit()
        return True
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Scan CRUD
# ---------------------------------------------------------------------------
def insert_scan(project_id: int, scan_dir: str,
                duration_seconds: Optional[float] = None,
                status: str = "completed",
                total_findings: int = 0,
                critical: int = 0, high: int = 0,
                medium: int = 0, low: int = 0,
                started_at: Optional[str] = None,
                db_path: Optional[Path] = None) -> int:
    """Record a completed (or running) scan. Returns scan id."""
    conn = _get_connection(db_path)
    try:
        cur = conn.execute(
            """INSERT INTO scans
               (project_id, scan_dir, started_at, duration_seconds,
                status, total_findings, critical, high, medium, low)
               VALUES (?, ?, COALESCE(?, datetime('now')), ?, ?, ?, ?, ?, ?, ?)""",
            (project_id, scan_dir, started_at, duration_seconds,
             status, total_findings, critical, high, medium, low),
        )
        conn.commit()
        return cur.lastrowid
    finally:
        conn.close()


def update_scan_status(scan_id: int, status: str,
                       duration_seconds: Optional[float] = None,
                       db_path: Optional[Path] = None) -> None:
    """Update a scan's status (used during in-progress → completed transitions)."""
    conn = _get_connection(db_path)
    try:
        conn.execute(
            "UPDATE scans SET status = ?, duration_seconds = COALESCE(?, duration_seconds) WHERE id = ?",
            (status, duration_seconds, scan_id),
        )
        conn.commit()
    finally:
        conn.close()


def get_scans(project_id: int,
              db_path: Optional[Path] = None) -> List[Dict[str, Any]]:
    """Return all scans for a project, newest first."""
    conn = _get_connection(db_path)
    try:
        rows = conn.execute(
            "SELECT * FROM scans WHERE project_id = ? ORDER BY started_at DESC",
            (project_id,),
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def get_scan_detail(scan_id: int,
                    db_path: Optional[Path] = None) -> Optional[Dict[str, Any]]:
    """Return full scan row or None."""
    conn = _get_connection(db_path)
    try:
        row = conn.execute("SELECT * FROM scans WHERE id = ?", (scan_id,)).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()



def delete_scan(scan_id: int, db_path: Optional[Path] = None) -> bool:
    """Delete a scan and all its findings from the database."""
    conn = _get_connection(db_path)
    try:
        # Check if scan exists first
        row = conn.execute("SELECT scan_dir FROM scans WHERE id = ?", (scan_id,)).fetchone()
        if not row:
            return False
            
        # Delete dependent findings first (in case FK constraints aren't enough)
        conn.execute("DELETE FROM findings WHERE scan_id = ?", (scan_id,))
        
        # Delete the scan itself
        conn.execute("DELETE FROM scans WHERE id = ?", (scan_id,))
        conn.commit()
        return True
    finally:
        conn.close()

# ---------------------------------------------------------------------------
# Findings CRUD
# ---------------------------------------------------------------------------
def insert_findings(scan_id: int, findings_list: List[Dict[str, Any]],
                    db_path: Optional[Path] = None) -> None:
    """Bulk-insert parsed findings for a scan."""
    conn = _get_connection(db_path)
    try:
        conn.executemany(
            """INSERT INTO findings
               (scan_id, title, severity, owasp, file, description, remediation)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            [
                (scan_id, f["title"], f["severity"], f.get("owasp"),
                 f.get("file"), f.get("description"), f.get("remediation"))
                for f in findings_list
            ],
        )
        # Update parent scan severity counts
        counts = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0}
        for f in findings_list:
            sev = f["severity"].upper()
            if sev in counts:
                counts[sev] += 1
        conn.execute(
            """UPDATE scans SET total_findings = ?,
               critical = ?, high = ?, medium = ?, low = ?
               WHERE id = ?""",
            (len(findings_list), counts["CRITICAL"], counts["HIGH"],
             counts["MEDIUM"], counts["LOW"], scan_id),
        )
        conn.commit()
    finally:
        conn.close()


def get_findings(scan_id: int,
                 db_path: Optional[Path] = None) -> List[Dict[str, Any]]:
    """Return all findings for a scan."""
    conn = _get_connection(db_path)
    try:
        rows = conn.execute(
            "SELECT * FROM findings WHERE scan_id = ? ORDER BY "
            "CASE severity WHEN 'CRITICAL' THEN 0 WHEN 'HIGH' THEN 1 "
            "WHEN 'MEDIUM' THEN 2 WHEN 'LOW' THEN 3 ELSE 4 END, title",
            (scan_id,),
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def get_comparison_data(scan_id_a: int, scan_id_b: int,
                        db_path: Optional[Path] = None) -> Dict[str, Any]:
    """Compare two scans: returns new, resolved, and unchanged findings.

    Matching is done by (title, file) tuple — same finding = same key.
    """
    findings_a = {(f["title"], f["file"]): f for f in get_findings(scan_id_a, db_path)}
    findings_b = {(f["title"], f["file"]): f for f in get_findings(scan_id_b, db_path)}

    keys_a = set(findings_a.keys())
    keys_b = set(findings_b.keys())

    return {
        "scan_a": get_scan_detail(scan_id_a, db_path),
        "scan_b": get_scan_detail(scan_id_b, db_path),
        # Findings present only in B (newer scan) → new issues
        "new": [findings_b[k] for k in keys_b - keys_a],
        # Findings present only in A (older scan) → resolved
        "resolved": [findings_a[k] for k in keys_a - keys_b],
        # Present in both → unchanged
        "unchanged": [findings_b[k] for k in keys_a & keys_b],
    }
