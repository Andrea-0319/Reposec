"""Configuration module for the Security Review System MVP."""
import os
import logging
from pathlib import Path
from typing import List

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
    OPENCODE_MODEL: str = os.getenv("OPENCODE_MODEL", "opencode/minimax-m2.5-free")
    OPENCODE_TIMEOUT: int = _safe_int(os.getenv("OPENCODE_TIMEOUT", "1800"), 1800)
    
    # Paths configuration
    BASE_PATH: Path = Path(__file__).parent
    AGENTS_PATH: Path = BASE_PATH / "agents"
    KNOWLEDGE_PATH: Path = BASE_PATH / "knowledge"
    STATE_PATH: Path = BASE_PATH / "state"
