"""Tests for orchestrator/logging_utils.py — colored formatter and agent extraction."""
import logging

from orchestrator.logging_utils import ColoredFormatter, AGENT_COLORS, AGENT_EMOJI


class TestExtractAgent:
    """Verifica l'estrazione del nome agente dai messaggi di log."""

    def test_extracts_ingest(self):
        assert ColoredFormatter._extract_agent("[INGEST] Starting...") == "ingest"

    def test_extracts_backend_security(self):
        assert ColoredFormatter._extract_agent("[BACKEND_SECURITY] Analyzing code") == "backend_security"

    def test_no_tag_returns_empty(self):
        """Messaggi senza tag agente ritornano stringa vuota."""
        assert ColoredFormatter._extract_agent("Generic log message") == ""

    def test_extracts_first_tag_only(self):
        """Se ci sono più tag, estrae il primo."""
        result = ColoredFormatter._extract_agent("[INGEST] Processing [COMPLIANCE] extra")
        assert result == "ingest"


class TestFormatPlain:
    """Verifica la formattazione plain (senza colori)."""

    def test_contains_level_and_message(self):
        formatter = ColoredFormatter(use_colors=False)
        record = logging.LogRecord(
            name="test", level=logging.INFO, pathname="", lineno=0,
            msg="Test message", args=(), exc_info=None,
        )
        output = formatter.format(record)
        assert "info" in output.lower()
        assert "Test message" in output

    def test_contains_timestamp(self):
        formatter = ColoredFormatter(use_colors=False)
        record = logging.LogRecord(
            name="test", level=logging.WARNING, pathname="", lineno=0,
            msg="Warning!", args=(), exc_info=None,
        )
        output = formatter.format(record)
        # Il timestamp è in formato HH:MM:SS
        assert ":" in output.split("]")[0]  # Almeno un ":" nel timestamp


class TestFormatColored:
    """Verifica che la formattazione colorata includa codici ANSI."""

    def test_agent_message_has_color(self):
        """Messaggi con tag agente noto includono ANSI escape codes."""
        formatter = ColoredFormatter(use_colors=True)
        # Forziamo use_colors=True anche se non siamo in un TTY
        formatter.use_colors = True
        record = logging.LogRecord(
            name="test", level=logging.INFO, pathname="", lineno=0,
            msg="[INGEST] Starting analysis", args=(), exc_info=None,
        )
        output = formatter.format(record)
        # Deve contenere almeno un codice escape ANSI
        assert "\033[" in output

    def test_error_level_has_red_indicator(self):
        """Messaggi di errore usano indicatore visivo."""
        formatter = ColoredFormatter(use_colors=True)
        formatter.use_colors = True
        record = logging.LogRecord(
            name="test", level=logging.ERROR, pathname="", lineno=0,
            msg="Something failed", args=(), exc_info=None,
        )
        output = formatter.format(record)
        assert "\033[" in output  # Contiene ANSI codes


class TestColorMappings:
    """Verifica coerenza tra colori ed emoji degli agenti."""

    def test_all_agents_have_colors(self):
        """Ogni agente ha un colore assegnato."""
        expected_agents = ["ingest", "backend_security", "frontend_security",
                           "secrets_config", "dependency_risk", "compliance", "aggregator"]
        for agent in expected_agents:
            assert agent in AGENT_COLORS, f"Colore mancante per '{agent}'"

    def test_all_agents_have_emoji(self):
        """Ogni agente ha un emoji assegnato."""
        expected_agents = ["ingest", "backend_security", "frontend_security",
                           "secrets_config", "dependency_risk", "compliance", "aggregator"]
        for agent in expected_agents:
            assert agent in AGENT_EMOJI, f"Emoji mancante per '{agent}'"
