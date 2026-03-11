# Security Review System — MVP Phase 1

An automated, locally-run, multi-agent security review system powered by OpenCode and LangGraph.

The platform analyzes a target repository through multiple specialized agents, generates a consolidated `security_report.md`, stores structured findings in SQLite, and exposes a local dashboard for launching, browsing, filtering, and comparing scans over time.

## What it does

The review pipeline is orchestrated by LangGraph and includes these agents:
1. **Ingest Agent**: explores the repository, identifies the stack, and builds the initial footprint.
2. **Backend Security**: reviews server-side code for issues such as injection, SSRF, broken access control, and authentication weaknesses.
3. **Frontend Security**: reviews client-side code for risks such as XSS, CORS, and CSP weaknesses.
4. **Secrets & Config**: looks for hardcoded credentials and insecure runtime configuration.
5. **Dependency Risk**: analyzes manifests and dependencies for risky or outdated packages.
6. **Compliance**: maps findings to OWASP Top 10 (2025) and Secure by Design principles.
7. **Aggregator**: deduplicates and consolidates all findings into the final `security_report.md`.

Key runtime characteristics:
- **Sandboxed analysis**: the target repository is copied into `state/scan_<timestamp>/repo_copy` before agents run.
- **Parallel fan-out / fan-in execution**: up to 4 analysis agents can run concurrently.
- **Flexible OpenCode backend**: supports both local CLI execution and SDK-based remote execution.
- **Persistent scan history**: projects, scans, and parsed findings are stored in `state/security_review.db`.
- **Local-only dashboard workflow**: launch scans, inspect reports, compare scans, and manage settings from the browser.

## Tech stack

- **Backend / orchestration**: Python, LangGraph, FastAPI, SQLite
- **Frontend**: React, Vite, Tailwind CSS, Recharts
- **LLM execution**: OpenCode CLI or OpenCode SDK server

## Prerequisites

1. Python 3.10+
2. Node.js 18+
3. **OpenCode**: either the [OpenCode CLI](https://github.com/opencode-ai/opencode) available on your `PATH`, or an accessible OpenCode SDK server

## Installation

```bash
# Set up a virtual environment
python -m venv .venv
.venv\Scripts\activate

# Install backend dependencies
pip install -r requirements.txt

# Install frontend dependencies and build the SPA served by FastAPI
cd frontend
npm install
npm run build
cd ..

# Copy the environment file template
copy .env.example .env
```

The default environment values are:

```dotenv
OPENCODE_BACKEND=cli
# OPENCODE_SDK_URL=http://192.168.1.100:54321
OPENCODE_MODEL=opencode/minimax-m2.5-free
OPENCODE_TIMEOUT=1800
LOG_LEVEL=INFO
```

## CLI usage

Analyze a local repository by passing its path to `main.py`.

```bash
# Basic usage (runs a scan and opens the dashboard report when done)
python main.py "C:\path\to\your\repo"

# Run with up to 4 parallel agents
python main.py "C:\path\to\your\repo" --parallel 4

# Skip auto-opening the dashboard after completion
python main.py "C:\path\to\your\repo" --no-dashboard

# Start the dashboard server only
python main.py --dashboard

# Use the SDK backend against a remote OpenCode server
python main.py "C:\path\to\your\repo" --backend sdk --sdk-url "http://192.168.1.100:54321"

# Override the model used for the scan
python main.py "C:\path\to\your\repo" --model "opencode/glm-5-free"

# Override the per-agent timeout in seconds
python main.py "C:\path\to\your\repo" --timeout 1800

# Copy the final report back into the analyzed repository root
python main.py "C:\path\to\your\repo" --copy-report
```

### CLI notes

- `--parallel` accepts values from 1 to 4.
- `--dashboard` starts the FastAPI server without launching a scan.
- Dashboard-launched scans reuse existing scan IDs and update status in place.
- On startup failures, the system persists a `startup_error.txt` file inside the scan directory so the dashboard can surface the failure reason.

## Interactive dashboard

The application includes a React-based dashboard served by FastAPI at `http://localhost:8000` by default.

You must build the frontend first with `npm run build` inside [frontend](frontend), otherwise FastAPI cannot serve the SPA.

### Available pages

- **Dashboard**: overview of projects and recent scan activity
- **Launch Scan**: browser-based scan launch form for local paths
- **All Scans**: global historical scan list
- **Compare Scans**: side-by-side diff of introduced, resolved, and unchanged findings
- **Settings**: local dashboard preferences and backend connectivity checks

### Dashboard capabilities

- Browse analyzed projects and their scan timelines
- Open detailed scan reports with severity cards and parsed findings
- Filter report findings by severity and OWASP category
- Expand or collapse all findings in the report view
- Detect and display failed scans, including persisted startup errors
- Auto-refresh scan status while a scan is running
- Launch scans directly from the UI with configurable repository path, model, backend, timeout, parallelism, and optional SDK URL
- Delete individual scans or full projects from the dashboard
- Compare two scans to identify new, resolved, and unchanged findings
- Store dashboard preferences in browser `localStorage`

### Settings page

The Settings page lets you manage local dashboard preferences, including:
- API base URL override
- Default SDK URL
- Default model
- Default backend (`cli` or `sdk`)
- Default parallelism
- Default OpenCode timeout

These preferences are stored locally in the browser and are used to prefill the launch form.

The page also exposes lightweight health information from the backend, including:
- API availability and app version
- OpenCode installation status
- number of discoverable models
- any OpenCode discovery error returned by the backend

### Backend service endpoints used by the dashboard

The frontend relies on these FastAPI endpoints:
- `/api/health` — basic API health check and version
- `/api/health/opencode` — OpenCode availability and model discovery status
- `/api/models` — dynamically discovered OpenCode models
- `/api/scans/launch` — launch a new scan from the UI
- `/api/scans/{scan_id}/status` — poll a running scan
- `/api/scans/{id_a}/compare/{id_b}` — compare two scans

## Output

Each scan writes its artifacts into a dedicated directory:

`state/scan_<timestamp>/`

Typical contents include:
- `security_report.md`
- `fingerprint.md`
- per-agent findings such as `findings_backend.md`, `findings_frontend.md`, `findings_deps.md`, `findings_secrets.md`, `findings_compliance.md`
- `logs/`
- `repo_copy/` sandboxed repository clone
- optional `startup_error.txt` if bootstrap fails before the workflow starts

Use `--copy-report` to additionally copy `security_report.md` into the analyzed repository root.

## Testing

The project includes automated tests for the CLI bootstrap flow, orchestration graph, database layer, report parsing, and dashboard API.

```bash
# Install development dependencies
pip install -r requirements-dev.txt

# Run the full test suite
pytest tests/ -v
```

## Notes

- The dashboard implementation is now React/Vite-based. Older documentation that still mentions a vanilla HTML/JS dashboard is outdated.
- [frontend/README.md](frontend/README.md) is still the default Vite template and does not describe the actual project yet.
