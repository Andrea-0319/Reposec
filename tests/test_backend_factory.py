"""Tests for orchestrator/backend_factory.py — factory logic and validation."""
import pytest
from unittest.mock import patch, MagicMock

from orchestrator.backend_factory import create_backend, VALID_BACKENDS


class TestCreateBackend:
    """Verifica la factory per la selezione del backend OpenCode."""

    @patch("orchestrator.opencode_client.CLIBackend._find_executable", return_value="/usr/bin/opencode")
    def test_cli_backend_created_by_default(self, mock_find):
        """Senza argomenti, la factory crea un CLIBackend (default)."""
        from orchestrator.opencode_client import CLIBackend
        backend = create_backend(backend_type="cli", model="test-model")
        assert isinstance(backend, CLIBackend)

    @patch("orchestrator.opencode_client.CLIBackend._find_executable", return_value="/usr/bin/opencode")
    def test_cli_with_model_override(self, mock_find):
        """Model e timeout vengono passati al CLIBackend."""
        backend = create_backend(backend_type="cli", model="gpt-4o", timeout=60)
        assert backend.model == "gpt-4o"
        assert backend.timeout == 60

    def test_invalid_backend_type_raises(self):
        """Tipo di backend non valido solleva ValueError con messaggio chiaro."""
        with pytest.raises(ValueError, match="Backend non valido"):
            create_backend(backend_type="invalid_backend")

    def test_valid_backends_constant(self):
        """La costante VALID_BACKENDS contiene esattamente i tipi supportati."""
        assert "cli" in VALID_BACKENDS
        assert "sdk" in VALID_BACKENDS
        assert len(VALID_BACKENDS) == 2

    @patch.dict("sys.modules", {"opencode_ai": None})
    def test_sdk_import_error_has_instructions(self):
        """Se opencode-ai non è installato, l'errore contiene istruzioni di installazione."""
        with pytest.raises(ImportError, match="opencode-ai"):
            create_backend(backend_type="sdk")
