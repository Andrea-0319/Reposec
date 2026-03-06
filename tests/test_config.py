"""Tests for config.py — configuration helpers and constants."""
import logging
from unittest.mock import patch

from config import _safe_int, setup_logger, Config


# --- _safe_int ---

class TestSafeInt:
    """Verifica la conversione sicura a intero con fallback."""

    def test_valid_string(self):
        assert _safe_int("42", 0) == 42

    def test_invalid_string_returns_fallback(self):
        assert _safe_int("not_a_number", 99) == 99

    def test_none_returns_fallback(self):
        assert _safe_int(None, 10) == 10

    def test_empty_string_returns_fallback(self):
        assert _safe_int("", 5) == 5


# --- setup_logger ---

class TestSetupLogger:
    """Verifica la configurazione del logger."""

    def test_returns_logger_instance(self):
        logger = setup_logger("test_logger_instance")
        assert isinstance(logger, logging.Logger)

    def test_verbose_sets_debug_level(self):
        logger = setup_logger("test_verbose", verbose=True)
        assert logger.level == logging.DEBUG

    def test_default_is_info_level(self):
        logger = setup_logger("test_default")
        assert logger.level == logging.INFO

    @patch.dict("os.environ", {"LOG_LEVEL": "WARNING"})
    def test_env_log_level_override(self):
        """LOG_LEVEL da env sovrascrive il default (ma non verbose)."""
        logger = setup_logger("test_env_level", verbose=False)
        assert logger.level == logging.WARNING


# --- Config ---

class TestConfig:
    """Verifica le costanti di configurazione."""

    def test_analysis_agents_list(self):
        """La lista degli agenti è completa e ordinata come atteso."""
        expected = ["backend_security", "frontend_security", "secrets_config", "dependency_risk", "compliance"]
        assert Config.ANALYSIS_AGENTS == expected

    def test_paths_are_absolute(self):
        """Tutti i path configurati devono essere assoluti."""
        assert Config.BASE_PATH.is_absolute()
        assert Config.AGENTS_PATH.is_absolute()
        assert Config.KNOWLEDGE_PATH.is_absolute()
        assert Config.STATE_PATH.is_absolute()

    def test_copy_ignore_patterns_contains_git(self):
        """I pattern di copia escludono .git e node_modules."""
        assert ".git" in Config.COPY_IGNORE_PATTERNS
        assert "node_modules" in Config.COPY_IGNORE_PATTERNS
