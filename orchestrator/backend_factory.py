"""Factory per instanziare il backend OpenCode corretto (CLI o SDK)."""
from typing import Optional

from config import Config, setup_logger
from orchestrator.opencode_backend import OpenCodeBackend

log = setup_logger("backend_factory")

# Tipi di backend supportati
VALID_BACKENDS = ("cli", "sdk")


def create_backend(backend_type: Optional[str] = None,
                   model: Optional[str] = None,
                   timeout: Optional[int] = None,
                   base_url: Optional[str] = None) -> OpenCodeBackend:
    """Instanzia il backend OpenCode in base al tipo selezionato.
    
    Args:
        backend_type: "cli" (subprocess) o "sdk" (opencode-ai). Default da Config.
        model: Override del modello LLM.
        timeout: Override del timeout in secondi.
        base_url: URL del server OpenCode per il backend SDK (None = localhost:54321).
        
    Returns:
        Un'istanza concreta di OpenCodeBackend.
        
    Raises:
        ImportError: Se si richiede SDK ma opencode-ai non è installato.
        ValueError: Se il tipo di backend non è valido.
    """
    backend_type = backend_type or Config.OPENCODE_BACKEND

    if backend_type not in VALID_BACKENDS:
        raise ValueError(
            f"Backend non valido: {backend_type!r}. "
            f"Valori supportati: {VALID_BACKENDS}"
        )

    if backend_type == "sdk":
        try:
            from orchestrator.opencode_sdk import SDKBackend
            log.info("Using SDK backend (opencode-ai)")
            return SDKBackend(model=model, timeout=timeout, base_url=base_url)
        except ImportError:
            raise ImportError(
                "opencode-ai SDK non installato. "
                "Installa con: pip install opencode-ai"
            )
    else:
        from orchestrator.opencode_client import CLIBackend
        log.info("Using CLI backend (subprocess)")
        return CLIBackend(model=model, timeout=timeout)
