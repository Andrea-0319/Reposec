#!/usr/bin/env bash
# setup.sh — Automated setup for Security Review System (macOS / Linux)
# Usage: chmod +x setup.sh && ./setup.sh

set -e

BOLD="\033[1m"
GREEN="\033[0;32m"
RED="\033[0;31m"
RESET="\033[0m"

info()  { echo -e "${BOLD}[+]${RESET} $1"; }
ok()    { echo -e "${GREEN}[✓]${RESET} $1"; }
fail()  { echo -e "${RED}[✗]${RESET} $1"; exit 1; }

# ── Prerequisite checks ──────────────────────────────────────────────

info "Checking prerequisites..."

# Python 3 — try python3 first, then python
PYTHON=""
if command -v python3 &>/dev/null; then
    PYTHON="python3"
elif command -v python &>/dev/null; then
    PYTHON="python"
fi

if [ -z "$PYTHON" ]; then
    fail "Python 3 is not installed. Please install Python 3.10+ and retry."
fi

# Verify version >= 3.10
PY_VERSION=$($PYTHON -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
PY_MAJOR=$($PYTHON -c "import sys; print(sys.version_info.major)")
PY_MINOR=$($PYTHON -c "import sys; print(sys.version_info.minor)")

if [ "$PY_MAJOR" -lt 3 ] || ([ "$PY_MAJOR" -eq 3 ] && [ "$PY_MINOR" -lt 10 ]); then
    fail "Python 3.10+ is required (found $PY_VERSION)."
fi
ok "Python $PY_VERSION found ($PYTHON)"

# Node.js
if ! command -v node &>/dev/null; then
    fail "Node.js is not installed. Please install Node.js 20+ and retry."
fi
NODE_VERSION=$(node --version)
ok "Node.js $NODE_VERSION found"

# npm
if ! command -v npm &>/dev/null; then
    fail "npm is not installed. Please install Node.js (includes npm) and retry."
fi

# Git (optional but recommended)
if command -v git &>/dev/null; then
    ok "Git found (required for remote repo scanning)"
else
    info "Git not found — remote repository scanning will not be available."
fi

# ── Virtual environment ──────────────────────────────────────────────

if [ ! -d ".venv" ]; then
    info "Creating virtual environment..."
    $PYTHON -m venv .venv
    ok "Virtual environment created (.venv/)"
else
    ok "Virtual environment already exists (.venv/)"
fi

# Activate venv
source .venv/bin/activate

# ── Python dependencies ──────────────────────────────────────────────

info "Installing Python dependencies..."
pip install --upgrade pip --quiet
pip install -r requirements.txt --quiet
ok "Python dependencies installed"

# ── Frontend build ───────────────────────────────────────────────────

info "Installing frontend dependencies..."
cd frontend
npm install --silent
ok "Frontend dependencies installed"

info "Building frontend (React + Vite)..."
npm run build
ok "Frontend built successfully"
cd ..

# ── Environment file ─────────────────────────────────────────────────

if [ ! -f ".env" ]; then
    cp .env.example .env
    ok "Created .env from .env.example"
else
    ok ".env already exists (keeping current values)"
fi

# ── Done ─────────────────────────────────────────────────────────────

echo ""
echo -e "${GREEN}${BOLD}Setup complete!${RESET}"
echo ""
echo "  To start the dashboard:"
echo "    ./start_dashboard.sh"
echo ""
echo "  To run a scan from CLI:"
echo "    source .venv/bin/activate"
echo "    python main.py \"/path/to/repo\""
echo ""
