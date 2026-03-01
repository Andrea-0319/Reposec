"""Colored logging utilities for the Security Review System."""
import logging
import re
import sys
from datetime import datetime

# Agent-specific colors for terminal output
AGENT_COLORS = {
    "ingest": "\033[94m",           # Blue
    "backend_security": "\033[96m", # Cyan
    "frontend_security": "\033[92m",# Green
    "secrets_config": "\033[93m",   # Yellow
    "dependency_risk": "\033[95m",  # Magenta
    "compliance": "\033[91m",       # Red
    "aggregator": "\033[1;32m",     # Bold Green
}

# Agent emojis displayed next to agent names
AGENT_EMOJI = {
    "ingest": "🔍",
    "backend_security": "🛡️",
    "frontend_security": "🌐",
    "secrets_config": "🔑",
    "dependency_risk": "📦",
    "compliance": "📋",
    "aggregator": "✅",
    "error": "❌",
    "success": "✓",
    "warning": "⚠️",
    "info": "ℹ️",
}

COLOR_RESET = "\033[0m"
COLOR_BOLD = "\033[1m"
COLOR_RED = "\033[91m"
COLOR_GREEN = "\033[92m"
COLOR_YELLOW = "\033[93m"
COLOR_BLUE = "\033[94m"
COLOR_CYAN = "\033[96m"

# Regex to detect agent names like "[INGEST]", "[BACKEND_SECURITY]", etc.
_AGENT_TAG_RE = re.compile(r"\[([A-Z_]+)\]")


class ColoredFormatter(logging.Formatter):
    """Custom formatter with per-agent colors and emoji indicators."""

    def __init__(self, use_colors: bool = True):
        super().__init__()
        self.use_colors = use_colors and sys.stdout.isatty()

    def format(self, record: logging.LogRecord) -> str:
        if not self.use_colors:
            return self._format_plain(record)
        return self._format_colored(record)

    def _format_plain(self, record: logging.LogRecord) -> str:
        timestamp = datetime.now().strftime("%H:%M:%S")
        level = record.levelname.lower()
        msg = record.getMessage()
        return f"[{timestamp}] [{level}] {msg}"

    def _format_colored(self, record: logging.LogRecord) -> str:
        timestamp = datetime.now().strftime("%H:%M:%S")
        msg = record.getMessage()
        
        # Detect agent name from the message (e.g. "[INGEST] Starting...")
        agent_name = self._extract_agent(msg)
        agent_color = AGENT_COLORS.get(agent_name, "")
        emoji = AGENT_EMOJI.get(agent_name, "")
        
        # Level-based icon for non-agent messages
        level_color = COLOR_RESET
        level_icon = "ℹ️"
        if record.levelno >= logging.ERROR:
            level_color = COLOR_RED
            level_icon = "❌"
        elif record.levelno >= logging.WARNING:
            level_color = COLOR_YELLOW
            level_icon = "⚠️"
        elif record.levelno >= logging.INFO:
            level_color = COLOR_GREEN
            level_icon = "✓"
        
        # Use agent color if available, otherwise fall back to level color
        msg_color = agent_color if agent_color else level_color
        icon = emoji if emoji else level_icon

        return (
            f"{COLOR_BOLD}{timestamp}{COLOR_RESET} "
            f"{icon}  "
            f"{msg_color}{msg}{COLOR_RESET}"
        )

    @staticmethod
    def _extract_agent(msg: str) -> str:
        """Extract agent name from a log message like '[INGEST] Starting...'"""
        match = _AGENT_TAG_RE.search(msg)
        if match:
            return match.group(1).lower()
        return ""
