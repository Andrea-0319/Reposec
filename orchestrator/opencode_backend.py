"""Abstract base class for OpenCode execution backends (CLI / SDK)."""
from abc import ABC, abstractmethod


class OpenCodeBackend(ABC):
    """Interfaccia comune per i backend OpenCode.
    
    Ogni backend (CLI subprocess, SDK Python) deve implementare execute_prompt()
    e ritornare un dict con la stessa struttura standardizzata.
    """

    def __init__(self, model: str, timeout: int):
        self.model = model
        self.timeout = timeout

    @abstractmethod
    def execute_prompt(self, prompt: str, working_dir: str,
                       scan_output_dir: str, agent_name: str = "unknown") -> dict:
        """Esegue il prompt e ritorna il risultato standardizzato.
        
        Returns:
            dict con chiavi: success (bool), output (str), error (str|None),
            duration (float), returncode (int).
        """
        ...
