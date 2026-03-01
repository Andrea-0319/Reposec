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
```

## Output

The final report will be dropped right into the folder of the repository you analyzed:
`C:\path\to\your\repo\security_report.md`

Intermediate outputs and agent execution logs are stored locally within the `state/scan_<timestamp>` directory.

## Rules & Guardrails

- **Read-Only (prompt-enforced)**: Agents are instructed via prompt to never modify the analyzed repository. All outputs are saved in the isolated `state/` workspace. Note: this is a soft constraint — no filesystem-level sandboxing is applied in the MVP.
- **Configurable Models**: Native integration with flexible, free-tier-friendly LLMs supported by OpenCode (`Minimax`, `GLM`).
- **Sequential Pipeline (MVP)**: Analysis agents run sequentially. Parallel fan-out is planned for a future phase.
