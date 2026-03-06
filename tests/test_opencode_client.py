"""Tests for orchestrator/opencode_client.py — validation and CLI backend logic."""
import pytest
from pathlib import Path
from unittest.mock import patch, MagicMock

from orchestrator.opencode_client import _validate_model_name, OpenCodeClient, CLIBackend
from orchestrator.opencode_backend import OpenCodeBackend


# --- Inheritance ---

class TestCLIBackendInheritance:
    """Verifica che CLIBackend eredita correttamente da OpenCodeBackend."""

    @patch("orchestrator.opencode_client.CLIBackend._find_executable", return_value="/usr/bin/opencode")
    def test_is_subclass_of_backend(self, mock_find):
        """CLIBackend è un sottotipo di OpenCodeBackend."""
        client = CLIBackend(model="test-model")
        assert isinstance(client, OpenCodeBackend)

    def test_alias_still_works(self):
        """Il backward-compat alias OpenCodeClient punta a CLIBackend."""
        assert OpenCodeClient is CLIBackend


# --- _validate_model_name ---

class TestValidateModelName:
    """Verifica la whitelist di caratteri per i nomi dei modelli."""

    @pytest.mark.parametrize("name", [
        "opencode/minimax-m2.5-free",
        "gpt-4o",
        "claude-3.5-sonnet",
        "my-org/my-model",
        "model_v2.1",
    ])
    def test_valid_names_accepted(self, name):
        """Nomi validi passano senza errori."""
        assert _validate_model_name(name) == name

    @pytest.mark.parametrize("name", [
        "model; rm -rf /",
        "model$(whoami)",
        "model`evil`",
        "model & calc",
        "model | cat /etc/passwd",
        "model\nnewline",
    ])
    def test_dangerous_names_rejected(self, name):
        """Nomi con caratteri pericolosi sollevano ValueError."""
        with pytest.raises(ValueError, match="Invalid model name"):
            _validate_model_name(name)


# --- OpenCodeClient init ---

class TestOpenCodeClientInit:
    """Verifica l'inizializzazione del client."""

    @patch("orchestrator.opencode_client.OpenCodeClient._find_executable", return_value="/usr/bin/opencode")
    def test_default_model_from_config(self, mock_find):
        """Senza override, usa il modello di default da Config."""
        client = OpenCodeClient()
        # Il modello deve essere quello di Config (validato)
        assert "/" in client.model or "-" in client.model  # format plausibile

    @patch("orchestrator.opencode_client.OpenCodeClient._find_executable", return_value="/usr/bin/opencode")
    def test_custom_model_override(self, mock_find):
        """Override del modello viene applicato."""
        client = OpenCodeClient(model="gpt-4o", timeout=60)
        assert client.model == "gpt-4o"
        assert client.timeout == 60

    @patch("orchestrator.opencode_client.OpenCodeClient._find_executable", return_value="/usr/bin/opencode")
    def test_invalid_model_raises(self, mock_find):
        """Modello con caratteri pericolosi solleva ValueError all'init."""
        with pytest.raises(ValueError):
            OpenCodeClient(model="evil; rm -rf /")


# --- execute_prompt ---

class TestExecutePrompt:
    """Verifica l'esecuzione del prompt senza subprocess reali."""

    @patch("orchestrator.opencode_client.subprocess.Popen")
    @patch("orchestrator.opencode_client.OpenCodeClient._find_executable", return_value="/usr/bin/opencode")
    def test_successful_execution(self, mock_find, mock_popen, tmp_path):
        """Esecuzione riuscita ritorna success=True."""
        # Mock del processo
        mock_proc = MagicMock()
        mock_proc.communicate.return_value = (b"Analysis complete", b"")
        mock_proc.returncode = 0
        mock_proc.pid = 12345
        mock_popen.return_value = mock_proc

        client = OpenCodeClient(model="test-model")
        scan_dir = tmp_path / "scan"
        scan_dir.mkdir()

        result = client.execute_prompt(
            prompt="Test prompt",
            working_dir=str(tmp_path),
            scan_output_dir=str(scan_dir),
            agent_name="test_agent",
        )

        assert result["success"] is True
        assert result["output"] == "Analysis complete"
        assert result["error"] is None

    @patch("orchestrator.opencode_client.subprocess.Popen")
    @patch("orchestrator.opencode_client.OpenCodeClient._find_executable", return_value="/usr/bin/opencode")
    def test_timeout_returns_failure(self, mock_find, mock_popen, tmp_path):
        """Timeout del subprocess ritorna success=False con errore chiaro."""
        import subprocess

        mock_proc = MagicMock()
        mock_proc.communicate.side_effect = subprocess.TimeoutExpired(cmd="opencode", timeout=10)
        mock_proc.pid = 12345
        mock_popen.return_value = mock_proc

        client = OpenCodeClient(model="test-model", timeout=10)
        scan_dir = tmp_path / "scan"
        scan_dir.mkdir()

        result = client.execute_prompt(
            prompt="Test prompt",
            working_dir=str(tmp_path),
            scan_output_dir=str(scan_dir),
            agent_name="test_agent",
        )

        assert result["success"] is False
        assert "Timed out" in result["error"]

    @patch("orchestrator.opencode_client.subprocess.Popen")
    @patch("orchestrator.opencode_client.OpenCodeClient._find_executable", return_value="/usr/bin/opencode")
    def test_prompt_file_cleanup(self, mock_find, mock_popen, tmp_path):
        """Il file prompt temporaneo viene rimosso dopo l'esecuzione."""
        mock_proc = MagicMock()
        mock_proc.communicate.return_value = (b"ok", b"")
        mock_proc.returncode = 0
        mock_proc.pid = 12345
        mock_popen.return_value = mock_proc

        client = OpenCodeClient(model="test-model")
        scan_dir = tmp_path / "scan"
        scan_dir.mkdir()

        client.execute_prompt(
            prompt="Test prompt",
            working_dir=str(tmp_path),
            scan_output_dir=str(scan_dir),
            agent_name="cleanup_test",
        )

        # Dopo l'esecuzione, nessun file .prompt-* dovrebbe restare
        prompt_files = list(scan_dir.glob(".prompt-*"))
        assert len(prompt_files) == 0
