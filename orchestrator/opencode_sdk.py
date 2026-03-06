"""SDK backend for OpenCode — executes prompts via the opencode-ai Python package."""
import time
import uuid
from pathlib import Path
from typing import Optional

from config import Config, setup_logger
from orchestrator.opencode_backend import OpenCodeBackend

log = setup_logger("opencode_sdk")


class SDKBackend(OpenCodeBackend):
    """Backend OpenCode basato sul pacchetto Python opencode-ai.
    
    Richiede: pip install opencode-ai
    Flusso: session.create() → session.chat(id, model_id, parts, provider_id)
    Supporta connessione a server remoto via base_url.
    """

    def __init__(self, model: Optional[str] = None, timeout: Optional[int] = None,
                 base_url: Optional[str] = None):
        resolved_model = model or Config.OPENCODE_MODEL
        super().__init__(resolved_model, timeout or Config.OPENCODE_TIMEOUT)
        self._base_url = base_url
        # Lazy import: il pacchetto potrebbe non essere installato
        try:
            from opencode_ai import Opencode
            client_kwargs = {}
            if base_url:
                client_kwargs["base_url"] = base_url
            self._client = Opencode(**client_kwargs)
            log.info("SDK connecting to: %s", base_url or "localhost:54321 (default)")
        except ImportError:
            raise ImportError(
                "opencode-ai SDK non installato. "
                "Installa con: pip install opencode-ai"
            )

    def _parse_model_id(self) -> tuple[str, str]:
        """Estrae provider_id e model_id dal formato 'provider/model'.
        
        Es: 'opencode/minimax-m2.5-free' → ('opencode', 'minimax-m2.5-free')
        """
        if "/" in self.model:
            provider, model = self.model.split("/", 1)
            return provider, model
        # Fallback: provider generico
        return "opencode", self.model

    def execute_prompt(self, prompt: str, working_dir: str,
                       scan_output_dir: str, agent_name: str = "unknown") -> dict:
        """Esegue il prompt tramite l'SDK Python di OpenCode (session-based)."""
        start_time = time.time()
        scan_dir = Path(scan_output_dir)
        prompt_file = None

        try:
            # Scrivi il prompt su file (stessa logica del CLI backend)
            prompt_filename = f".prompt-{agent_name}-{uuid.uuid4().hex[:8]}.md"
            prompt_file = scan_dir / prompt_filename
            prompt_file.write_text(prompt, encoding="utf-8")

            # Messaggio per l'agente
            sdk_prompt = (
                f"Read the file '{prompt_file}'. "
                "It contains your complete task description. "
                "Follow ALL instructions in it precisely and create all required files."
            )

            provider_id, model_id = self._parse_model_id()

            # 1. Crea una sessione
            session = self._client.session.create()
            session_id = session.id

            # 2. Invia il messaggio nella sessione
            response = self._client.session.chat(
                id=session_id,
                model_id=model_id,
                provider_id=provider_id,
                parts=[{"type": "text", "text": sdk_prompt}],
                timeout=float(self.timeout),
            )

            duration = time.time() - start_time
            output = response.content if hasattr(response, "content") else str(response)

            # Salva log per debugging
            self._save_agent_log(agent_name, output, "", 0, duration, scan_dir)

            return {
                "success": True,
                "output": output,
                "error": None,
                "duration": duration,
                "returncode": 0,
            }

        except TimeoutError:
            log.warning("Agent %s timed out after %ds (SDK)", agent_name, self.timeout)
            return {
                "success": False, "output": "", "error": f"Timed out after {self.timeout}s",
                "duration": self.timeout, "returncode": -1,
            }
        except Exception as e:
            log.error("SDK execution failed for %s: %s", agent_name, e)
            return {
                "success": False, "output": "", "error": str(e),
                "duration": time.time() - start_time, "returncode": -1,
            }
        finally:
            # Cleanup prompt file
            if prompt_file and prompt_file.exists():
                try:
                    prompt_file.unlink()
                except OSError:
                    pass

    def _save_agent_log(self, agent_name: str, stdout: str, stderr: str,
                        returncode: int, duration: float, scan_dir: Path):
        """Salva l'output dell'agente per debugging (stessa struttura del CLI backend)."""
        try:
            logs_dir = scan_dir / "logs"
            logs_dir.mkdir(parents=True, exist_ok=True)
            ts = time.strftime("%Y%m%d_%H%M%S")
            log_path = logs_dir / f"{agent_name}_{ts}.log"
            with open(log_path, "w", encoding="utf-8") as f:
                f.write(f"Agent: {agent_name} (SDK backend)\n")
                f.write(f"Return code: {returncode}\n")
                f.write(f"Duration: {duration:.1f}s\n")
                f.write("=" * 60 + "\nOUTPUT:\n")
                f.write(stdout or "(empty)\n")
                if stderr:
                    f.write("\n" + "=" * 60 + "\nSTDERR:\n")
                    f.write(stderr)
        except Exception as e:
            log.warning("Failed to save agent log: %s", e)
