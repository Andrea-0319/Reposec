"""OpenCode client for executing agent tasks."""
import os
import signal
import subprocess
import shutil
import time
from pathlib import Path
from typing import Optional

from config import Config, setup_logger

log = setup_logger("opencode")

# On Windows, CREATE_NEW_PROCESS_GROUP lets us kill the entire process tree.
_IS_WINDOWS = os.name == "nt"

class OpenCodeClient:
    """Client for interacting with opencode CLI."""

    def __init__(self, model: Optional[str] = None, timeout: Optional[int] = None):
        self.model = model or Config.OPENCODE_MODEL
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

    def execute_prompt(self, prompt: str, working_dir: str, agent_name: str = "unknown") -> dict:
        """Execute a prompt using 'opencode run' (non-interactive, one-shot)."""
        start_time = time.time()
        cwd = Path(working_dir)
        prompt_file = None

        try:
            is_script = self._executable.lower().endswith((".cmd", ".bat"))

            # ALWAYS write prompt to file to avoid shell escaping issues
            prompt_file = cwd / ".agent-prompt.md"
            prompt_file.write_text(prompt, encoding="utf-8")
            cli_prompt = (
                "Read the file '.agent-prompt.md' in your current working directory. "
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

            # Persist agent output for post-mortem debugging
            self._save_agent_log(agent_name, stdout, stderr, proc.returncode, duration, cwd)

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
                        returncode: int, duration: float, cwd: Path):
        """Save agent stdout/stderr to a log file for debugging in the specific scan output dir."""
        try:
            logs_dir = cwd / "logs"
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
