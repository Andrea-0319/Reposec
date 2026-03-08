"""FastAPI application: serves the Dashboard API and static frontend.

Endpoints:
  GET  /api/projects                    — list all projects with latest scan
  GET  /api/projects/{id}/scans         — scans timeline for a project
  GET  /api/scans/{id}                  — full scan detail + findings
  GET  /api/scans/{id_a}/compare/{id_b} — compare two scans (new/resolved/unchanged)
  POST /api/scans/launch               — launch a new security scan
  GET  /api/scans/{id}/status           — poll scan status

Static pages:
  /              → index.html
  /project/{id}  → project.html
  /scan/{id}     → report.html
  /compare       → compare.html
  /launch        → launch.html
"""
import subprocess
import sys
import time
import threading
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

# Project-level imports
sys.path.insert(0, str(Path(__file__).parent.parent))
from config import Config
from dashboard import db
from dashboard.report_parser import parse_report, extract_severity_counts

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------
app = FastAPI(title="Security Review Dashboard", version="1.0.0")

# Paths
_DASHBOARD_DIR = Path(__file__).parent
_TEMPLATES_DIR = _DASHBOARD_DIR / "templates"
_STATIC_DIR = _DASHBOARD_DIR / "static"

# Serve static assets (CSS/JS)
app.mount("/static", StaticFiles(directory=str(_STATIC_DIR)), name="static")

# Track running scans: scan_id → subprocess info
_running_scans: dict[int, dict] = {}


# ---------------------------------------------------------------------------
# Startup: initialize DB
# ---------------------------------------------------------------------------
@app.on_event("startup")
def _startup() -> None:
    db.init_db(Config.DB_PATH)


# ---------------------------------------------------------------------------
# HTML page routes
# ---------------------------------------------------------------------------
def _serve_template(filename: str) -> HTMLResponse:
    """Read and serve an HTML template."""
    path = _TEMPLATES_DIR / filename
    if not path.exists():
        raise HTTPException(404, f"Template {filename} not found")
    return HTMLResponse(path.read_text(encoding="utf-8"))


@app.get("/", response_class=HTMLResponse)
async def page_index():
    return _serve_template("index.html")

@app.get("/project/{project_id}", response_class=HTMLResponse)
async def page_project(project_id: int):
    return _serve_template("project.html")

@app.get("/scan/{scan_id}", response_class=HTMLResponse)
async def page_report(scan_id: int):
    return _serve_template("report.html")

@app.get("/compare", response_class=HTMLResponse)
async def page_compare():
    return _serve_template("compare.html")

@app.get("/launch", response_class=HTMLResponse)
async def page_launch():
    return _serve_template("launch.html")


# ---------------------------------------------------------------------------
# API: Projects
# ---------------------------------------------------------------------------
@app.get("/api/projects")
async def api_projects():
    """List all projects with latest scan summary."""
    return db.get_projects(Config.DB_PATH)


# ---------------------------------------------------------------------------
# API: Scans
# ---------------------------------------------------------------------------
@app.get("/api/projects/{project_id}/scans")
async def api_project_scans(project_id: int):
    """Get all scans for a project (timeline)."""
    scans = db.get_scans(project_id, Config.DB_PATH)
    if not scans:
        raise HTTPException(404, "Project not found or has no scans")
    return scans


@app.get("/api/scans/{scan_id}")
async def api_scan_detail(scan_id: int):
    """Full scan detail: metadata + all findings."""
    scan = db.get_scan_detail(scan_id, Config.DB_PATH)
    if not scan:
        raise HTTPException(404, "Scan not found")
    findings = db.get_findings(scan_id, Config.DB_PATH)
    return {"scan": scan, "findings": findings}


@app.get("/api/scans/{scan_id}/status")
async def api_scan_status(scan_id: int):
    """Check if a scan is still running or completed."""
    scan = db.get_scan_detail(scan_id, Config.DB_PATH)
    if not scan:
        raise HTTPException(404, "Scan not found")

    # Check if we're tracking this as a live process
    if scan_id in _running_scans:
        proc_info = _running_scans[scan_id]
        proc = proc_info.get("process")
        if proc and proc.poll() is None:
            return {"status": "running", "scan_id": scan_id}
        else:
            # Process finished — parse results and update DB
            _finalize_scan(scan_id, proc_info)
            del _running_scans[scan_id]

    return {"status": scan["status"], "scan_id": scan_id}


# ---------------------------------------------------------------------------
# API: Compare
# ---------------------------------------------------------------------------
@app.get("/api/scans/{id_a}/compare/{id_b}")
async def api_compare(id_a: int, id_b: int):
    """Compare two scans: returns new, resolved, unchanged findings."""
    data = db.get_comparison_data(id_a, id_b, Config.DB_PATH)
    if not data["scan_a"] or not data["scan_b"]:
        raise HTTPException(404, "One or both scans not found")
    return data


# ---------------------------------------------------------------------------
# API: Launch new scan
# ---------------------------------------------------------------------------
class LaunchRequest(BaseModel):
    repo_path: str
    model: Optional[str] = None
    backend: Optional[str] = None
    parallel: int = 1


@app.post("/api/scans/launch")
async def api_launch_scan(req: LaunchRequest):
    """Launch a new security scan as a subprocess."""
    repo = Path(req.repo_path).resolve()
    if not repo.exists() or not repo.is_dir():
        raise HTTPException(400, f"Invalid repo path: {req.repo_path}")

    # Clamp parallel to valid range
    parallel = max(1, min(req.parallel, 4))

    # Create project entry
    project_id = db.upsert_project(
        name=repo.name, repo_path=str(repo), db_path=Config.DB_PATH
    )

    # Create scan directory
    scan_dir = Config.STATE_PATH / f"scan_{int(time.time())}"
    scan_dir.mkdir(parents=True, exist_ok=True)

    # Record scan as "running"
    scan_id = db.insert_scan(
        project_id=project_id,
        scan_dir=str(scan_dir),
        status="running",
        db_path=Config.DB_PATH,
    )

    # Build subprocess command
    cmd = [sys.executable, str(Config.BASE_PATH / "main.py"), str(repo),
           "--parallel", str(parallel)]
    if req.model:
        cmd.extend(["--model", req.model])
    if req.backend:
        cmd.extend(["--backend", req.backend])

    # Launch in background thread (non-blocking)
    def _run():
        try:
            proc = subprocess.Popen(
                cmd, cwd=str(Config.BASE_PATH),
                stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
            )
            _running_scans[scan_id] = {
                "process": proc,
                "scan_dir": str(scan_dir),
                "start_time": time.time(),
            }
            proc.wait()  # Block this thread until complete
            _finalize_scan(scan_id, _running_scans.get(scan_id, {}))
            _running_scans.pop(scan_id, None)
        except Exception as e:
            db.update_scan_status(scan_id, "failed", db_path=Config.DB_PATH)

    thread = threading.Thread(target=_run, daemon=True)
    thread.start()

    # Return immediately — frontend will poll status
    _running_scans[scan_id] = {"scan_dir": str(scan_dir), "start_time": time.time()}

    return {"scan_id": scan_id, "status": "running"}


def _finalize_scan(scan_id: int, proc_info: dict) -> None:
    """Parse the completed scan's report and update DB."""
    scan_dir = Path(proc_info.get("scan_dir", ""))
    report_path = scan_dir / "security_report.md"
    duration = time.time() - proc_info.get("start_time", time.time())

    if report_path.exists():
        report = parse_report(report_path)
        counts = extract_severity_counts(report.findings)

        findings_dicts = [
            {
                "title": f.title, "severity": f.severity, "owasp": f.owasp,
                "file": f.file, "description": f.description,
                "remediation": f.remediation,
            }
            for f in report.findings
        ]
        if findings_dicts:
            db.insert_findings(scan_id, findings_dicts, Config.DB_PATH)

        db.update_scan_status(scan_id, "completed", duration, Config.DB_PATH)
    else:
        db.update_scan_status(scan_id, "failed", duration, Config.DB_PATH)


# ---------------------------------------------------------------------------
# Run directly: python -m dashboard.app
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn
    port = getattr(Config, "DASHBOARD_PORT", 8000)
    print(f"Starting Security Review Dashboard on http://localhost:{port}")
    db.init_db(Config.DB_PATH)
    uvicorn.run(app, host="0.0.0.0", port=port)
