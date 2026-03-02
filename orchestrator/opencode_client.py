"""OpenCode client for executing agent tasks."""
import os
import re
import signal
import subprocess
import shutil
import time
import uuid
from pathlib import Path
from typing import Optional

from config import Config, setup_logger

log = setup_logger("opencode")

# Regex whitelist: solo alfanumerici, punti, slash e trattini
_MODEL_NAME_RE = re.compile(r'^[\w./-]+$')


def _validate_model_name(model: str) -> str:
    """Validates model name against dangerous characters (shell injection vector)."""
    if not _MODEL_NAME_RE.match(model):
        raise ValueError(
            f"Invalid model name: {model!r}. "
            "Only alphanumeric, dots, slashes, and hyphens are allowed."
        )
    return model

# On Windows, CREATE_NEW_PROCESS_GROUP lets us kill the entire process tree.
_IS_WINDOWS = os.name == "nt"

class OpenCodeClient:
    """Client for interacting with opencode CLI."""

    def __init__(self, model: Optional[str] = None, timeout: Optional[int] = None):
        self.model = _validate_model_name(model or Config.OPENCODE_MODEL)
        self.timeout = timeout or Config.OPENCODE_TIMEOUT
        self._executable = self._find_executable()

    def _find_executable(self) -> str:
        """Find the opencode executable on this system."""
        for name in ["opencode", "opencode.exe", "opencode.cmd"]:
            found = shutil.which(name)
            if found:
                log.debug("Found opencode at: %s", found)
                return found

        raise FileNotFoundError(
            "opencode CLI not found. Install it or add it to PATH.\n"
            "See: https://github.com/opencode-ai/opencode"
        )

    def execute_prompt(self, prompt: str, working_dir: str, 
                       scan_output_dir: str, agent_name: str = "unknown") -> dict:
        """Execute a prompt using 'opencode run' (non-interactive, one-shot).
        
        Args:
            prompt: Full agent prompt text.
            working_dir: CWD for the subprocess (sandboxed repo copy).
            scan_output_dir: Isolated dir for prompt files, logs, and outputs.
            agent_name: Identifier for logging and file naming.
        """
        start_time = time.time()
        cwd = Path(working_dir)
        scan_dir = Path(scan_output_dir)
        prompt_file = None

        try:
            is_script = self._executable.lower().endswith((".cmd", ".bat"))

            # Write prompt to isolated scan dir with unique name (never in target repo)
            prompt_filename = f".prompt-{agent_name}-{uuid.uuid4().hex[:8]}.md"
            prompt_file = scan_dir / prompt_filename
            prompt_file.write_text(prompt, encoding="utf-8")
            
            # Tell the agent where to find its prompt file (absolute path)
            cli_prompt = (
                f"Read the file '{prompt_file}'. "
                "It contains your complete task description. "
                "Follow ALL instructions in it precisely and create all required files."
            )
            
            cmd = [self._executable, "run", "--model", self.model, cli_prompt]

            popen_kwargs = dict(
                cwd=str(cwd),
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                shell=is_script,
            )
            if _IS_WINDOWS:
                popen_kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP
            else:
                popen_kwargs["start_new_session"] = True

            proc = subprocess.Popen(cmd, **popen_kwargs)

            try:
                stdout_bytes, stderr_bytes = proc.communicate(timeout=self.timeout)
            except subprocess.TimeoutExpired:
                log.warning("Agent %s timed out after %ds", agent_name, self.timeout)
                self._kill_proc_tree(proc)
                return {
                    "success": False, "output": "", "error": f"Timed out after {self.timeout}s",
                    "duration": self.timeout, "returncode": -1,
                }

            duration = time.time() - start_time

            # Decode output safely as UTF-8
            stdout = stdout_bytes.decode("utf-8", errors="replace") if stdout_bytes else ""
            stderr = stderr_bytes.decode("utf-8", errors="replace") if stderr_bytes else ""

            # Persist agent output for post-mortem debugging (in scan dir, not repo)
            self._save_agent_log(agent_name, stdout, stderr, proc.returncode, duration, scan_dir)

            return {
                "success": proc.returncode == 0,
                "output": stdout,
                "error": stderr if proc.returncode != 0 else None,
                "duration": duration,
                "returncode": proc.returncode,
            }

        except FileNotFoundError as e:
            return {
                "success": False, "output": "", "error": str(e),
                "duration": time.time() - start_time, "returncode": -1,
            }
        except Exception as e:
            return {
                "success": False, "output": "", "error": str(e),
                "duration": time.time() - start_time, "returncode": -1,
            }
        finally:
            # Clean up temp prompt file
            if prompt_file and prompt_file.exists():
                try:
                    prompt_file.unlink()
                except OSError:
                    pass

    @staticmethod
    def _kill_proc_tree(proc: subprocess.Popen):
        """Kill a process and all its children. Windows-safe."""
        try:
            if _IS_WINDOWS:
                subprocess.run(
                    ["taskkill", "/F", "/T", "/PID", str(proc.pid)],
                    capture_output=True, timeout=10,
                )
            else:
                os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
        except Exception as e:
            log.warning("Failed to kill process tree (pid=%d): %s", proc.pid, e)
        finally:
            proc.kill()
            proc.wait(timeout=5)

    def _save_agent_log(self, agent_name: str, stdout: str, stderr: str,
                        returncode: int, duration: float, scan_dir: Path):
        """Save agent stdout/stderr to a log file inside the scan output directory."""
        try:
            logs_dir = scan_dir / "logs"
            logs_dir.mkdir(parents=True, exist_ok=True)
            ts = time.strftime("%Y%m%d_%H%M%S")
            log_path = logs_dir / f"{agent_name}_{ts}.log"
            with open(log_path, "w", encoding="utf-8") as f:
                f.write(f"Agent: {agent_name}\n")
                f.write(f"Return code: {returncode}\n")
                f.write(f"Duration: {duration:.1f}s\n")
                f.write("=" * 60 + "\nSTDOUT:\n")
                f.write(stdout or "(empty)\n")
                f.write("\n" + "=" * 60 + "\nSTDERR:\n")
                f.write(stderr or "(empty)\n")
        except Exception as e:
            log.warning("Failed to save agent log: %s", e)
