"""Tests for orchestrator/schema.py — custom state reducers."""
from orchestrator.schema import _merge_agent_outputs, _keep_true, _last_value


# --- _merge_agent_outputs ---

class TestMergeAgentOutputs:
    """Verifica che il reducer faccia merge corretto dei risultati agente."""

    def test_merge_into_empty(self):
        """Merge di un risultato in un dict vuoto."""
        update = {"backend_security": {"success": True, "duration": 1.0, "output": "ok", "error": None}}
        result = _merge_agent_outputs({}, update)
        assert result == update

    def test_merge_preserves_existing(self):
        """I risultati precedenti non vengono sovrascritti da nuovi agenti."""
        current = {"ingest": {"success": True, "duration": 0.5, "output": "done", "error": None}}
        update = {"backend_security": {"success": True, "duration": 1.0, "output": "ok", "error": None}}
        result = _merge_agent_outputs(current, update)
        assert "ingest" in result
        assert "backend_security" in result

    def test_merge_overwrites_same_key(self):
        """Un agente rieseguito sovrascrive il risultato precedente."""
        current = {"ingest": {"success": False, "duration": 0.5, "output": "", "error": "fail"}}
        update = {"ingest": {"success": True, "duration": 1.0, "output": "retry ok", "error": None}}
        result = _merge_agent_outputs(current, update)
        assert result["ingest"]["success"] is True


# --- _keep_true ---

class TestKeepTrue:
    """Verifica il latch: una volta True, resta True."""

    def test_false_false(self):
        assert _keep_true(False, False) is False

    def test_false_true(self):
        assert _keep_true(False, True) is True

    def test_true_false(self):
        """Una volta attivato, non si disattiva."""
        assert _keep_true(True, False) is True

    def test_true_true(self):
        assert _keep_true(True, True) is True


# --- _last_value ---

class TestLastValue:
    """Verifica che last-writer-wins funzioni correttamente."""

    def test_overwrites(self):
        assert _last_value("old", "new") == "new"

    def test_empty_update(self):
        assert _last_value("current", "") == ""
