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

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
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

# Allow CORS for local dev with Vite matching
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Paths
_DASHBOARD_DIR = Path(__file__).parent
_FRONTEND_DIST = _DASHBOARD_DIR.parent / "frontend" / "dist"

# Track running scans: scan_id → subprocess info
_running_scans: dict[int, dict] = {}


# ---------------------------------------------------------------------------
# Startup: initialize DB
# ---------------------------------------------------------------------------
@app.on_event("startup")
def _startup() -> None:
    db.init_db(Config.DB_PATH)


# ---------------------------------------------------------------------------
# Note: HTML templates have been replaced by the SPA frontend.
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# API: Projects
# ---------------------------------------------------------------------------
@app.get("/api/projects")
async def api_projects():
    """List all projects with latest scan summary."""
    return db.get_projects(Config.DB_PATH)


@app.delete("/api/projects/{project_id}")
async def api_delete_project(project_id: int):
    """Delete a project and all its scans from DB and filesystem."""
    scans = db.get_scans(project_id, Config.DB_PATH)
    
    for scan in scans:
        if scan["id"] in _running_scans:
            raise HTTPException(400, "Cannot delete project with a running scan")
            
    success = db.delete_project(project_id, Config.DB_PATH)
    if not success:
        raise HTTPException(404, "Project not found or failed to delete")
        
    import shutil
    for scan in scans:
        scan_dir = Path(scan["scan_dir"])
        if scan_dir.exists() and scan_dir.is_dir():
            try:
                shutil.rmtree(scan_dir, ignore_errors=True)
            except Exception as e:
                print(f"Failed to delete scan directory {scan_dir}: {e}")
                
    return {"status": "deleted", "project_id": project_id}


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


@app.delete("/api/scans/{scan_id}")
async def api_delete_scan(scan_id: int):
    """Delete a scan from DB and filesystem."""
    scan = db.get_scan_detail(scan_id, Config.DB_PATH)
    if not scan:
        raise HTTPException(404, "Scan not found")
        
    if scan_id in _running_scans:
        raise HTTPException(400, "Cannot delete a running scan")
        
    # Remove from DB
    success = db.delete_scan(scan_id, Config.DB_PATH)
    if not success:
        raise HTTPException(500, "Failed to delete scan from database")
        
    # Remove from filesystem
    scan_dir = Path(scan["scan_dir"])
    if scan_dir.exists() and scan_dir.is_dir():
        import shutil
        try:
            shutil.rmtree(scan_dir, ignore_errors=True)
        except Exception as e:
            # We don't fail the request if file deletion fails but DB succeeded
            print(f"Failed to delete scan directory {scan_dir}: {e}")
            
    return {"status": "deleted", "scan_id": scan_id}


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
                stdout=sys.stdout, stderr=sys.stderr,
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
# SPA Fallback Route
# ---------------------------------------------------------------------------
@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    """Serve built Vite frontend; fallback to index.html for client-side routing."""
    # Previene wildcard overriding sulle api non trovate
    if full_path.startswith("api/"):
        raise HTTPException(status_code=404, detail="API route not found")

    full_requested_path = _FRONTEND_DIST / full_path
    if full_requested_path.is_file():
        return FileResponse(full_requested_path)
    
    index_file = _FRONTEND_DIST / "index.html"
    if not index_file.exists():
        raise HTTPException(status_code=404, detail="Frontend is not built. Run 'npm run build' inside frontend directory.")
    return FileResponse(index_file)

# ---------------------------------------------------------------------------
# Run directly: python -m dashboard.app
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn
    port = getattr(Config, "DASHBOARD_PORT", 8000)
    print(f"Starting Security Review Dashboard on http://localhost:{port}")
    db.init_db(Config.DB_PATH)
    uvicorn.run(app, host="0.0.0.0", port=port)
