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
import logging
import subprocess
import sys
import time
import threading
import re
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
from orchestrator.opencode_client import find_opencode_executable, _validate_model_name
from orchestrator.git_cloner import is_git_url, validate_git_url, parse_repo_name, list_remote_branches

# ---------------------------------------------------------------------------
# Uvicorn access-log filter: suppress noisy polling & static-asset requests
# ---------------------------------------------------------------------------
class _QuietAccessFilter(logging.Filter):
    """Drop repetitive access-log entries that clutter the terminal."""

    # Patterns to suppress (status polling, static assets, favicon)
    _SUPPRESS = re.compile(
        r'"GET /api/scans/\d+/status '
        r'|"GET /assets/'
        r'|"GET /favicon'
    )

    def filter(self, record: logging.LogRecord) -> bool:
        msg = record.getMessage()
        return not self._SUPPRESS.search(msg)


def _install_access_log_filter() -> None:
    """Attach the quiet filter to uvicorn's access logger."""
    uv_access = logging.getLogger("uvicorn.access")
    uv_access.addFilter(_QuietAccessFilter())


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
_MODELS_CACHE_TTL_SECONDS = 60
_models_cache = {
    "models": [],
    "error": None,
    "installed": False,
    "executable": None,
    "ts": 0.0,
}
_models_cache_lock = threading.Lock()
_SCAN_ERROR_FILE = "startup_error.txt"


def _sanitize_repo_path(raw_path: str) -> str:
    """Trim whitespace and surrounding quotes from a user-supplied repository path."""
    return raw_path.strip().strip('"').strip("'")


def _read_scan_error(scan_dir: Path) -> Optional[str]:
    """Return a persisted scan bootstrap error, if present."""
    error_file = scan_dir / _SCAN_ERROR_FILE
    if not error_file.exists() or not error_file.is_file():
        return None

    try:
        return error_file.read_text(encoding="utf-8").strip() or None
    except OSError:
        return None


def _humanize_model_name(model_id: str) -> str:
    """Generate a readable label from an OpenCode model identifier."""
    tail = model_id.split("/", 1)[-1].replace("_", "-")
    parts = [part for part in tail.split("-") if part]
    if not parts:
        return model_id

    return " ".join(
        part.upper() if part.isupper() else part.capitalize() if part.isalpha() else part
        for part in parts
    )


def _extract_model_id_from_line(line: str) -> Optional[str]:
    """Extract a model identifier from a plain-text or table row."""
    cleaned = re.sub(r"\x1b\[[0-9;]*m", "", line).strip()
    if not cleaned or set(cleaned) <= {"-", "=", "+", "|", " "}:
        return None

    candidate_tokens: list[str] = []

    if "|" in cleaned:
        candidate_tokens.extend(cell.strip() for cell in cleaned.split("|") if cell.strip())
    else:
        candidate_tokens.append(cleaned.lstrip("-*• "))

    ignored = {"model", "models", "id", "name", "provider", "available", "installed"}
    for token in candidate_tokens:
        first_chunk = re.split(r"\s{2,}|\s+-\s+|\t", token, maxsplit=1)[0].strip()
        if not first_chunk:
            continue
        lowered = first_chunk.lower()
        if lowered in ignored:
            continue
        try:
            return _validate_model_name(first_chunk)
        except ValueError:
            continue

    return None


def _load_opencode_models(force_refresh: bool = False) -> dict:
    """Return cached OpenCode model metadata with TTL-based refresh."""
    now = time.time()
    with _models_cache_lock:
        if not force_refresh and now - _models_cache["ts"] < _MODELS_CACHE_TTL_SECONDS:
            return dict(_models_cache)

        models: list[dict[str, str]] = []
        error: Optional[str] = None
        installed = False
        executable: Optional[str] = None

        try:
            executable = find_opencode_executable()
            installed = True
            completed = subprocess.run(
                [executable, "models"],
                capture_output=True,
                text=True,
                timeout=15,
                check=False,
            )
            stdout = completed.stdout or ""
            stderr = (completed.stderr or "").strip()

            if completed.returncode != 0:
                error = stderr or "Failed to load models from OpenCode."
            else:
                seen: set[str] = set()
                for line in stdout.splitlines():
                    model_id = _extract_model_id_from_line(line)
                    if model_id and model_id not in seen:
                        seen.add(model_id)
                        models.append({"id": model_id, "name": _humanize_model_name(model_id)})
        except FileNotFoundError as exc:
            error = str(exc)
        except subprocess.TimeoutExpired:
            error = "Timed out while querying OpenCode models."
        except Exception as exc:
            error = f"Unable to query OpenCode models: {exc}"

        _models_cache.update({
            "models": models,
            "error": error,
            "installed": installed,
            "executable": executable,
            "ts": now,
        })
        return dict(_models_cache)


# ---------------------------------------------------------------------------
# Startup: initialize DB
# ---------------------------------------------------------------------------
@app.on_event("startup")
def _startup() -> None:
    db.init_db(Config.DB_PATH)
    _install_access_log_filter()


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


@app.get("/api/health")
async def api_health():
    """Basic API healthcheck used by the frontend settings page."""
    return {
        "status": "ok",
        "version": app.version,
        "timestamp": int(time.time()),
    }


@app.get("/api/health/opencode")
async def api_health_opencode():
    """Report OpenCode availability and currently discoverable models."""
    data = _load_opencode_models()
    return {
        "installed": data["installed"],
        "executable": data["executable"],
        "model_count": len(data["models"]),
        "error": data["error"],
        "version": app.version,
    }


@app.get("/api/models")
async def api_models():
    """Return the available OpenCode models discovered from the local CLI."""
    data = _load_opencode_models()
    return {
        "models": data["models"],
        "error": data["error"],
    }


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
    return {
        "scan": scan,
        "findings": findings,
        "error": _read_scan_error(Path(scan["scan_dir"])),
    }


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
            return {"status": "running", "scan_id": scan_id, "error": None}
        else:
            # Process finished — parse results and update DB
            _finalize_scan(scan_id, proc_info)
            del _running_scans[scan_id]
            scan = db.get_scan_detail(scan_id, Config.DB_PATH)

    return {
        "status": scan["status"],
        "scan_id": scan_id,
        "error": _read_scan_error(Path(scan["scan_dir"])),
    }


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
# API: Git branch discovery
# ---------------------------------------------------------------------------
class BranchRequest(BaseModel):
    url: str


@app.post("/api/git/branches")
async def api_git_branches(req: BranchRequest):
    """Discover branches on a remote Git repository."""
    try:
        validate_git_url(req.url)
    except ValueError as e:
        raise HTTPException(400, str(e))

    result = list_remote_branches(req.url, timeout=15)
    return result  # {"branches": [...], "default_branch": ..., "error": ...}


# ---------------------------------------------------------------------------
# API: Launch new scan
# ---------------------------------------------------------------------------
class LaunchRequest(BaseModel):
    repo_path: str
    model: Optional[str] = None
    backend: Optional[str] = None
    sdk_url: Optional[str] = None
    timeout: Optional[int] = None
    parallel: int = 1
    branch: Optional[str] = None


@app.post("/api/scans/launch")
async def api_launch_scan(req: LaunchRequest):
    """Launch a new security scan as a subprocess."""
    req.repo_path = _sanitize_repo_path(req.repo_path)
    remote = is_git_url(req.repo_path)

    if remote:
        # Validate URL format; local path validation is skipped (clone happens in subprocess)
        try:
            validate_git_url(req.repo_path)
        except ValueError as e:
            raise HTTPException(400, str(e))
        project_name = parse_repo_name(req.repo_path)
        repo_display = req.repo_path  # keep original URL for display
    else:
        repo = Path(req.repo_path).resolve()
        if not repo.exists() or not repo.is_dir():
            raise HTTPException(400, f"Invalid repo path: {req.repo_path}")
        project_name = repo.name
        repo_display = str(repo)

    # Clamp parallel to valid range
    parallel = max(1, min(req.parallel, 4))
    timeout = max(1, req.timeout) if req.timeout else None

    # Create project entry
    project_id = db.upsert_project(
        name=project_name, repo_path=repo_display, db_path=Config.DB_PATH
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

    # Build subprocess command — pass the original URL (or local path) to main.py
    cmd = [sys.executable, str(Config.BASE_PATH / "main.py"), req.repo_path,
           "--parallel", str(parallel),
           "--scan-dir", str(scan_dir),
           "--scan-id", str(scan_id),
           "--no-dashboard"]
    if req.branch:
        cmd.extend(["--branch", req.branch])
    if req.model:
        cmd.extend(["--model", req.model])
    if req.backend:
        cmd.extend(["--backend", req.backend])
    if req.sdk_url:
        cmd.extend(["--sdk-url", req.sdk_url])
    if timeout:
        cmd.extend(["--timeout", str(timeout)])

    # Launch in background thread (non-blocking)
    # Pre-populate tracking dict *before* starting the thread to avoid a race
    start_ts = time.time()
    _running_scans[scan_id] = {"scan_dir": str(scan_dir), "start_time": start_ts}

    def _run():
        try:
            proc = subprocess.Popen(
                cmd, cwd=str(Config.BASE_PATH),
                stdout=sys.stdout, stderr=sys.stderr,
            )
            _running_scans[scan_id]["process"] = proc
            proc.wait()  # Block this thread until complete
            _finalize_scan(scan_id, _running_scans.get(scan_id, {}))
            _running_scans.pop(scan_id, None)
        except Exception as e:
            db.update_scan_status(scan_id, "failed", db_path=Config.DB_PATH)
            _running_scans.pop(scan_id, None)

    thread = threading.Thread(target=_run, daemon=True)
    thread.start()

    return {"scan_id": scan_id, "status": "running"}


def _finalize_scan(scan_id: int, proc_info: dict) -> None:
    """Safety-net finalizer: only acts if main.py hasn't already persisted."""
    # Check current status — if main.py already updated it, skip.
    existing = db.get_scan_detail(scan_id, Config.DB_PATH)
    if existing and existing.get("status") == "completed":
        return  # main.py already persisted successfully

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

        db.update_scan_status(scan_id, "completed", duration,
                              total_findings=len(report.findings),
                              critical=counts["CRITICAL"], high=counts["HIGH"],
                              medium=counts["MEDIUM"], low=counts["LOW"],
                              db_path=Config.DB_PATH)
    else:
        db.update_scan_status(scan_id, "failed", duration, db_path=Config.DB_PATH)


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
