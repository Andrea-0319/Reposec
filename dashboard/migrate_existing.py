"""One-time migration: imports existing state/scan_* folders into the dashboard DB.

Iterates all scan directories, skips those without security_report.md,
and populates: projects → scans → findings.
"""
import sys
from pathlib import Path

# Ensure project root is importable
sys.path.insert(0, str(Path(__file__).parent.parent))

from dashboard.db import init_db, upsert_project, insert_scan, insert_findings
from dashboard.report_parser import (
    parse_report,
    parse_fingerprint,
    extract_severity_counts,
    ProjectInfo,
)


def migrate(state_dir: Path | None = None, db_path: Path | None = None) -> None:
    """Scan every state/scan_* directory and import valid reports into DB."""
    if state_dir is None:
        state_dir = Path(__file__).parent.parent / "state"

    # Initialize the schema
    init_db(db_path)

    scan_dirs = sorted(state_dir.glob("scan_*"))
    print(f"[migrate] Found {len(scan_dirs)} scan directories in {state_dir}")

    imported = 0
    skipped = 0

    for scan_dir in scan_dirs:
        report_path = scan_dir / "security_report.md"
        fingerprint_path = scan_dir / "fingerprint.md"

        # Skip incomplete scans (no report generated)
        if not report_path.exists():
            print(f"  SKIP  {scan_dir.name} — no security_report.md")
            skipped += 1
            continue

        # Parse fingerprint for project info
        if fingerprint_path.exists():
            info = parse_fingerprint(fingerprint_path)
        else:
            info = ProjectInfo(name=scan_dir.name, project_type="Unknown")

        # Parse the security report
        report = parse_report(report_path)
        counts = extract_severity_counts(report.findings)

        # Upsert project (matched by repo_path → use project name as fallback key)
        project_id = upsert_project(
            name=info.name,
            repo_path=info.name,  # Group by project name (original path not available)
            db_path=db_path,
        )

        # Insert scan
        scan_id = insert_scan(
            project_id=project_id,
            scan_dir=str(scan_dir),
            status="completed",
            total_findings=len(report.findings),
            critical=counts["CRITICAL"],
            high=counts["HIGH"],
            medium=counts["MEDIUM"],
            low=counts["LOW"],
            db_path=db_path,
        )

        # Insert parsed findings
        findings_dicts = [
            {
                "title": f.title,
                "severity": f.severity,
                "owasp": f.owasp,
                "file": f.file,
                "description": f.description,
                "remediation": f.remediation,
            }
            for f in report.findings
        ]
        if findings_dicts:
            insert_findings(scan_id, findings_dicts, db_path)

        print(f"  OK    {scan_dir.name} → project='{info.name}', "
              f"findings={len(report.findings)}")
        imported += 1

    print(f"\n[migrate] Done: {imported} imported, {skipped} skipped")


if __name__ == "__main__":
    migrate()
