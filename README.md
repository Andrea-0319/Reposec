# Security Review System — MVP Phase 1

An automated, locally-run, multi-agent security review system powered by OpenCode and LangGraph.

This platform sequentially routes a targeted codebase through multiple specialized LLM agents, generating a comprehensive `security_report.md` for your repository without sending data out through non-approved/paid APIs.

## Architecture

The system uses a linear pipeline orchestrated by LangGraph:
1. **Ingest Agent**: Explores the repository to footprint the tech stack and identify relevant source code files.
2. **Backend Security**: Analyzes backend source code for vulnerabilities (Injection, Auth scaling, SSRF, Access Control).
3. **Frontend Security**: Analyzes frontend sources (XSS, CORS, CSP).
4. **Secrets & Config**: Scans for hardcoded secrets and environment misconfigurations.
5. **Dependency Risk**: Highlights outdated packages or risky versions.
6. **Compliance**: Maps all findings to OWASP Top 10 (2025) and Secure by Design principles.
7. **Aggregator**: Consolidates, deduplicates, and produces the final `security_report.md`.

## Prerequisites

1. Python 3.10+
2. [OpenCode CLI](https://github.com/opencode-ai/opencode) installed and available in your `PATH`.

## Installation

```bash
# Set up a virtual environment
python -m venv venv
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy the environment file template
copy .env.example .env
```

## Usage

Analyze a local repository by providing its path to `main.py`.

```bash
# Basic usage
python main.py "C:\path\to\your\repo"

# Verbose logging
python main.py "C:\path\to\your\repo" --verbose

# Specify a custom OpenCode model
python main.py "C:\path\to\your\repo" --model "opencode/glm-5-free"

# Copy the report into the analyzed repo root
python main.py "C:\path\to\your\repo" --copy-report
```

## Output

The final report is saved in the scan directory:
`state/scan_<timestamp>/security_report.md`

Use `--copy-report` to also copy it into the analyzed repository root.

Intermediate outputs (findings, fingerprint) and agent execution logs are stored in the same `state/scan_<timestamp>/` directory.

## Security & Guardrails

- **Sandboxed Execution**: The analyzed repository is copied into an isolated `state/scan_<timestamp>/repo_copy/` directory. All agents work on the copy, which is automatically deleted after the scan. The original repository is never modified.
- **Anti-Prompt-Injection**: Context files injected into agent prompts are sanitized (dangerous patterns neutralized, content truncated, XML-delimited). All agent prompts include explicit safety rules to treat file contents as data only.
- **Input Validation**: Model names are validated against a strict regex whitelist to prevent shell injection.
- **Configurable Models**: Native integration with flexible, free-tier-friendly LLMs supported by OpenCode (`Minimax`, `GLM`).
- **Sequential Pipeline (MVP)**: Analysis agents run sequentially. Parallel fan-out is planned for a future phase.
