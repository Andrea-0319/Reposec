#!/usr/bin/env bash
# start_dashboard.sh — Launch the Security Review Dashboard (macOS / Linux)
# Usage: chmod +x start_dashboard.sh && ./start_dashboard.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Activate virtual environment
if [ -f ".venv/bin/activate" ]; then
    source .venv/bin/activate
else
    echo "[✗] Virtual environment not found. Run ./setup.sh first."
    exit 1
fi

# Verify frontend is built
if [ ! -f "frontend/dist/index.html" ]; then
    echo "[!] Frontend not built. Building now..."
    cd frontend && npm run build && cd ..
fi

echo ""
echo "  Starting Security Review Dashboard..."
echo "  Open http://localhost:8000 in your browser"
echo "  Press Ctrl+C to stop"
echo ""

python main.py --dashboard
