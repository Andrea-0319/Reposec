"""Git repository cloning utilities for remote repository scanning.

Provides URL detection, validation, branch discovery, and shallow cloning
so remote repos are handled identically to local directories by the pipeline.
"""
import re
import subprocess
from pathlib import Path
from typing import Optional

# Strict URL patterns for supported Git protocols
_HTTPS_PATTERN = re.compile(r"^https?://[^\s]+$")
_SSH_PATTERN = re.compile(r"^git@[^\s:]+:[^\s]+$")

# Characters that could enable shell injection (subprocess uses list args, but defense-in-depth)
_DANGEROUS_CHARS = re.compile(r"[;&|`$(){}!\n\r]")


def is_git_url(value: str) -> bool:
    """Detect whether *value* looks like a remote Git URL rather than a local path.

    Supports HTTPS and SSH (git@) formats.
    """
    value = value.strip()
    if _HTTPS_PATTERN.match(value):
        return True
    if _SSH_PATTERN.match(value):
        return True
    # Bare URLs ending in .git (e.g. github.com/owner/repo.git without scheme) — unlikely but safe
    return False


def validate_git_url(url: str) -> str:
    """Sanitize and validate a Git URL, raising ValueError on suspicious input.

    Returns the cleaned URL on success.
    """
    url = url.strip()
    if not url:
        raise ValueError("Git URL cannot be empty")

    if _DANGEROUS_CHARS.search(url):
        raise ValueError(f"URL contains forbidden characters: {url!r}")

    if not (_HTTPS_PATTERN.match(url) or _SSH_PATTERN.match(url)):
        raise ValueError(f"Unsupported Git URL format: {url!r}")

    return url


def parse_repo_name(url: str) -> str:
    """Extract the repository name from a Git URL.

    Examples:
        https://github.com/owner/repo.git  → 'repo'
        git@github.com:owner/repo.git      → 'repo'
        https://github.com/owner/repo      → 'repo'
    """
    # Remove trailing slashes and .git suffix
    cleaned = url.rstrip("/")
    if cleaned.endswith(".git"):
        cleaned = cleaned[:-4]

    # Take the last path segment (works for both HTTPS and SSH)
    # SSH format: git@host:owner/repo → split on '/' takes 'repo'
    name = cleaned.rsplit("/", 1)[-1]
    # Handle SSH colon separator (git@host:repo with no slash)
    if ":" in name:
        name = name.rsplit(":", 1)[-1]

    return name or "unknown-repo"


def list_remote_branches(url: str, timeout: int = 15) -> dict:
    """Discover branches on a remote Git repository.

    Returns: {"branches": [...], "default_branch": "main"|None, "error": None|str}
    """
    url = validate_git_url(url)
    result = {"branches": [], "default_branch": None, "error": None}

    try:
        # Step 1: detect default branch via symbolic ref
        symref_proc = subprocess.run(
            ["git", "ls-remote", "--symref", url, "HEAD"],
            capture_output=True, text=True, timeout=timeout,
        )

        if symref_proc.returncode == 0:
            # Parse: "ref: refs/heads/main\tHEAD"
            for line in symref_proc.stdout.splitlines():
                match = re.match(r"ref:\s+refs/heads/(\S+)\s+HEAD", line)
                if match:
                    result["default_branch"] = match.group(1)
                    break

        # Step 2: list all branches
        heads_proc = subprocess.run(
            ["git", "ls-remote", "--heads", url],
            capture_output=True, text=True, timeout=timeout,
        )

        if heads_proc.returncode != 0:
            stderr = (heads_proc.stderr or "").strip()
            result["error"] = stderr or "Failed to list remote branches"
            return result

        # Parse: "<sha>\trefs/heads/<branch>"
        for line in heads_proc.stdout.splitlines():
            parts = line.split("\t")
            if len(parts) == 2 and parts[1].startswith("refs/heads/"):
                branch_name = parts[1].removeprefix("refs/heads/")
                result["branches"].append(branch_name)

        # Fallback: if symref didn't return a default, guess from common names
        if not result["default_branch"] and result["branches"]:
            for candidate in ("main", "master", "develop"):
                if candidate in result["branches"]:
                    result["default_branch"] = candidate
                    break
            # Last resort: first branch
            if not result["default_branch"]:
                result["default_branch"] = result["branches"][0]

    except subprocess.TimeoutExpired:
        result["error"] = f"Timed out after {timeout}s while querying remote repository"
    except FileNotFoundError:
        result["error"] = "git executable not found — is Git installed?"
    except Exception as e:
        result["error"] = f"Failed to query remote branches: {e}"

    return result


def clone_repo(
    url: str,
    dest: Path,
    branch: Optional[str] = None,
    timeout: int = 300,
) -> Path:
    """Shallow-clone a remote repository to *dest*.

    Uses ``git clone --depth 1`` for efficiency.
    Returns the Path to the cloned directory.
    Raises RuntimeError on clone failure.
    """
    url = validate_git_url(url)
    dest = Path(dest)
    dest.mkdir(parents=True, exist_ok=True)

    cmd = ["git", "clone", "--depth", "1"]
    if branch:
        cmd.extend(["--branch", branch])
    cmd.extend([url, str(dest)])

    try:
        proc = subprocess.run(
            cmd, capture_output=True, text=True, timeout=timeout,
        )
    except subprocess.TimeoutExpired:
        raise RuntimeError(
            f"Git clone timed out after {timeout}s for {url}"
        )
    except FileNotFoundError:
        raise RuntimeError("git executable not found — is Git installed?")

    if proc.returncode != 0:
        stderr = (proc.stderr or "").strip()
        raise RuntimeError(f"git clone failed (exit {proc.returncode}): {stderr}")

    return dest
