# Security Review System — MVP Phase 1

An automated, locally-run, multi-agent security review system powered by OpenCode and LangGraph.

This platform sequentially routes a targeted codebase through multiple specialized LLM agents, generating a comprehensive `security_report.md` for your repository without sending data out through non-approved/paid APIs. It also includes an interactive web Dashboard to visualize, navigate, and compare scan results over time.

## Architecture

The system uses a flexible pipeline orchestrated by LangGraph:
1. **Ingest Agent**: Explores the repository to footprint the tech stack and identify relevant source code files.
2. **Backend Security**: Analyzes backend source code for vulnerabilities (Injection, Auth scaling, SSRF, Access Control).
3. **Frontend Security**: Analyzes frontend sources (XSS, CORS, CSP).
4. **Secrets & Config**: Scans for hardcoded secrets and environment misconfigurations.
5. **Dependency Risk**: Highlights outdated packages or risky versions.
6. **Compliance**: Maps all findings to OWASP Top 10 (2025) and Secure by Design principles.
7. **Aggregator**: Consolidates, deduplicates, and produces the final `security_report.md`.

## Prerequisites

1. Python 3.10+
2. **OpenCode**: Either the [OpenCode CLI](https://github.com/opencode-ai/opencode) installed and available in your `PATH`, or an accessible OpenCode SDK server.

## Installation

```bash
# Set up a virtual environment
python -m venv venv
venv\Scripts\activate

# Install backend dependencies
pip install -r requirements.txt

# Install frontend dependencies and build
cd frontend
npm install
npm run build
cd ..

# Copy the environment file template
copy .env.example .env
```

## Usage

Analyze a local repository by providing its path to `main.py`.

```bash
# Basic usage (opens dashboard automatically after scan)
python main.py "C:\path\to\your\repo"

# Run with up to 4 parallel agents (faster execution)
python main.py "C:\path\to\your\repo" --parallel 4

# Run scan but skip opening the dashboard automatically
python main.py "C:\path\to\your\repo" --no-dashboard

# Start the dashboard server only (no scan launched)
python main.py --dashboard

# Use the Python SDK backend connected to a remote OpenCode server
python main.py "C:\path\to\your\repo" --backend sdk --sdk-url "http://192.168.1.100:54321"

# Specify a custom OpenCode model
python main.py "C:\path\to\your\repo" --model "opencode/glm-5-free"

# Copy the report into the analyzed repo root
python main.py "C:\path\to\your\repo" --copy-report
```

## Interactive Dashboard

The system includes a modern Interactive Web Dashboard built with **React**, **Vite**, **Tailwind CSS**, and **recharts**.
It is accessible at `http://localhost:8000` (by default) once the backend FastAPI server is running. The dashboard allows you to:
- Browse all analyzed projects and their historical scan timelines.
- View detailed scan reports with severity distribution charts and filterable findings.
- Compare two different scans to see exactly what issues were introduced (new), fixed (resolved), or remained unchanged.
- Launch new scans directly from the browser UI with live status polling (seeing the execution logs right from the terminal).

*Note: You must build the frontend (`npm run build` inside the `frontend/` directory) before FastAPI can serve the dashboard!*

## Testing

The project includes a comprehensive test suite using `pytest`.

```bash
# Install development dependencies
pip install -r requirements-dev.txt

# Run all tests
pytest tests/ -v
```


## Output

The final report is saved in the scan directory:
`state/scan_<timestamp>/security_report.md`

Use `--copy-report` to also copy it into the analyzed repository root.

Intermediate outputs (findings, fingerprint) and agent execution logs are stored in the same `state/scan_<timestamp>/` directory.

- **Safety & Guardrails**: Sandboxed execution, prompt sanitization, input validation.
- **Configurable Parallelism**: Agents can run independently with fan-out/fan-in parallel topologies (via `--parallel N`).
- **Flexible Backend**: Supports both local CLI execution and remote Python SDK connections to OpenCode instances.
- **Persistent Storage**: All scans are saved in a local SQLite database (`state/security_review.db`) for trend tracking.
