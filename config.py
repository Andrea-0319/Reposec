"""Configuration module for the Security Review System MVP."""
import os
import logging
from pathlib import Path
from typing import List, Optional

from dotenv import load_dotenv
from orchestrator.logging_utils import ColoredFormatter

# Load environment variables from .env if present
load_dotenv()

def _safe_int(value: str, fallback: int) -> int:
    """Cast *value* to int, returning *fallback* on failure."""
    try:
        return int(value)
    except (TypeError, ValueError):
        return fallback

def setup_logger(name: str = "security_review", verbose: bool = False) -> logging.Logger:
    """Setup a logger with colored output for the application."""
    logger = logging.getLogger(name)
    if not logger.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(ColoredFormatter())
        logger.addHandler(handler)
    
    level = logging.DEBUG if verbose else logging.INFO
    env_level = os.getenv("LOG_LEVEL")
    if env_level and not verbose:
        level = getattr(logging, env_level.upper(), logging.INFO)
    
    logger.setLevel(level)
    return logger

class Config:
    """System configuration and constants."""
    
    ANALYSIS_AGENTS: List[str] = [
        "backend_security", "frontend_security", 
        "secrets_config", "dependency_risk", "compliance"
    ]
    
    # OpenCode settings
    OPENCODE_BACKEND: str = os.getenv("OPENCODE_BACKEND", "cli")  # "cli" | "sdk"
    OPENCODE_SDK_URL: Optional[str] = os.getenv("OPENCODE_SDK_URL")  # URL server remoto (es. http://192.168.1.100:54321)
    OPENCODE_MODEL: str = os.getenv("OPENCODE_MODEL", "opencode/minimax-m2.5-free")
    OPENCODE_TIMEOUT: int = _safe_int(os.getenv("OPENCODE_TIMEOUT", "1800"), 1800)
    
    # Patterns to exclude when copying the repo for sandboxed analysis
    COPY_IGNORE_PATTERNS: List[str] = [
        ".git", "node_modules", "venv", ".venv", "__pycache__", 
        ".env", ".env.local", ".env.production",
    ]
    
    # Paths configuration
    BASE_PATH: Path = Path(__file__).parent
    AGENTS_PATH: Path = BASE_PATH / "agents"
    KNOWLEDGE_PATH: Path = BASE_PATH / "knowledge"
    STATE_PATH: Path = BASE_PATH / "state"

    # Dashboard configuration
    DASHBOARD_PORT: int = _safe_int(os.getenv("DASHBOARD_PORT", "8000"), 8000)
    DB_PATH: Path = STATE_PATH / "security_review.db"
